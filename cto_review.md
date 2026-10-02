# CTO Review: Production-Hardened Automation System

After reviewing all three design documents (`architecture_design.md`, `backend_architecture.md`, `ai_automation_system.md`), here are the gaps I found and the hardened system I'd ship instead.

---

## 1. Critical Issues Found

### A. Race Conditions in Follow-up Cancellation
**Problem:** The current system cancels follow-ups *after* detecting an inbound email. But the cron job and the webhook are independent processes. If the cron fires at 10:00:03 and the webhook processes the reply at 10:00:05, the follow-up email is already sent — the lead gets a robotic "bumping this up" seconds after replying.

**Fix:** Add a **pre-send verification step** inside the cron executor. Before sending ANY email, re-query the lead's current state.

### B. No Idempotency on Webhook Processing
**Problem:** Inbound webhooks can fire multiple times (provider retries on timeout). The current design will insert duplicate messages and potentially re-trigger stage movements or AI classification calls.

**Fix:** Use `external_message_id` as a unique constraint. Reject duplicates at the database level.

### C. Missing Bounce & Error Handling
**Problem:** The system assumes every outbound email succeeds. If the email bounces (bad address), the lead stays in "Contacted" and receives follow-ups to a dead inbox, burning API credits and hurting sender reputation.

**Fix:** Handle bounce webhooks. Auto-move bounced leads to a "Dead" stage and kill their automation.

### D. AI Classification Without Fallback
**Problem:** If the OpenAI API is down or returns garbage, the pipeline freezes. There's no fallback for intent classification.

**Fix:** Default to `neutral` on any AI failure. The lead moves to "Replied" (safe default) and the founder reviews manually.

---

## 2. Improved Automation Logic

### Hardened Follow-up Scheduler

```
FUNCTION processFollowupQueue():

  jobs = SELECT * FROM automation_jobs
         WHERE status = 'pending'
         AND scheduled_for <= NOW()
         AND locked_until IS NULL OR locked_until < NOW()   -- prevent double-processing
         ORDER BY scheduled_for ASC
         LIMIT 50                                           -- batch size cap
         FOR UPDATE SKIP LOCKED                             -- row-level lock

  FOR EACH job IN jobs:

    -- STEP 1: Lock the job to prevent duplicate execution
    UPDATE automation_jobs SET locked_until = NOW() + '5 minutes' WHERE id = job.id

    -- STEP 2: PRE-SEND VERIFICATION (fixes the race condition)
    lead = SELECT * FROM leads WHERE id = job.lead_id
    latestInbound = SELECT * FROM messages
                    WHERE lead_id = lead.id AND direction = 'inbound'
                    ORDER BY sent_at DESC LIMIT 1

    IF latestInbound EXISTS:
      -- A reply came in between scheduling and execution. Abort.
      UPDATE automation_jobs SET status = 'cancelled' WHERE id = job.id
      CONTINUE

    IF lead.stage_id != 'CONTACTED_STAGE_ID':
      -- Lead was manually moved. Respect the founder's override.
      UPDATE automation_jobs SET status = 'cancelled' WHERE id = job.id
      CONTINUE

    IF lead.followup_count >= MAX_FOLLOWUPS:
      -- Safety net. Should never happen, but prevents infinite loops.
      UPDATE automation_jobs SET status = 'cancelled' WHERE id = job.id
      CONTINUE

    -- STEP 3: Send the follow-up
    TRY:
      result = sendFollowupEmail(lead)
      IF result.bounced:
        moveLeadToStage(lead.id, 'DEAD')
        cancelAllPendingJobs(lead.id)
        CONTINUE

      -- STEP 4: Log the message
      INSERT INTO messages (lead_id, direction, content) VALUES (...)

      -- STEP 5: Update state
      UPDATE leads SET followup_count = followup_count + 1,
                       last_contacted_at = NOW()
                   WHERE id = lead.id
      UPDATE automation_jobs SET status = 'completed', executed_at = NOW()
                             WHERE id = job.id

      -- STEP 6: Schedule next follow-up ONLY if under the cap
      IF lead.followup_count + 1 < MAX_FOLLOWUPS:
        scheduleNextFollowup(lead.id, FOLLOWUP_DELAY_DAYS)

    CATCH error:
      UPDATE automation_jobs SET status = 'failed',
                                 error_message = error.message,
                                 retry_count = retry_count + 1
                             WHERE id = job.id
      -- Failed jobs are retried next cycle if retry_count < 3
```

### Hardened Inbound Email Handler

```
FUNCTION handleInboundEmail(payload):

  -- STEP 1: Idempotency check
  existing = SELECT id FROM messages WHERE external_message_id = payload.messageId
  IF existing:
    RETURN 200  -- Already processed. Silently accept to prevent webhook retries.

  -- STEP 2: Lead lookup (by thread first, then email fallback)
  lead = findLeadByThreadId(payload.threadId)
  IF NOT lead:
    lead = findLeadByEmail(payload.from)
  IF NOT lead:
    logOrphanEmail(payload)  -- Store it for manual review. Don't crash.
    RETURN 200

  -- STEP 3: Store the message
  INSERT INTO messages (lead_id, external_message_id, thread_id, direction, content)
    VALUES (lead.id, payload.messageId, payload.threadId, 'inbound', payload.body)

  -- STEP 4: Cancel ALL pending automation for this lead IMMEDIATELY
  UPDATE automation_jobs SET status = 'cancelled'
    WHERE lead_id = lead.id AND status = 'pending'

  -- STEP 5: Classify intent (with fallback)
  TRY:
    intent = classifyIntent(payload.body)  -- 'interested', 'not_interested', 'neutral'
  CATCH:
    intent = 'neutral'                     -- Safe default on AI failure

  -- STEP 6: Move pipeline stage based on intent
  SWITCH intent:
    CASE 'interested':
      moveLeadToStage(lead.id, 'QUALIFIED')
      generateSuggestedReply(lead, payload.body)  -- AI drafts a response for founder
    CASE 'not_interested':
      moveLeadToStage(lead.id, 'ARCHIVED')
    CASE 'neutral':
      moveLeadToStage(lead.id, 'REPLIED')
      generateSuggestedReply(lead, payload.body)

  -- STEP 7: Log the automation event for auditability
  INSERT INTO automation_log (lead_id, event, intent, timestamp)
    VALUES (lead.id, 'inbound_reply_processed', intent, NOW())
```

---

## 3. Final Pipeline Rules (Definitive)

| Current Stage | Trigger | New Stage | Side Effects |
|---|---|---|---|
| **Lead** | Founder sends first email | **Contacted** | Schedule Follow-up 1 at Day +3 |
| **Contacted** | Follow-up 1 sent (auto) | **Contacted** | Schedule Follow-up 2 at Day +4. Update `followup_count`. |
| **Contacted** | Follow-up 2 sent (auto) | **Contacted** | Max reached. No more jobs scheduled. Lead stays here for manual action. |
| **Contacted** | Reply received, intent = `interested` | **Qualified** | Cancel all jobs. Generate AI reply draft. |
| **Contacted** | Reply received, intent = `neutral` | **Replied** | Cancel all jobs. Generate AI reply draft. |
| **Contacted** | Reply received, intent = `not_interested` | **Archived** | Cancel all jobs. No draft. |
| **Contacted** | Email bounced | **Dead** | Cancel all jobs. Flag email as invalid. |
| **Replied** | Founder sends manual reply | **Replied** | No automation. Founder is in control. |
| **Replied** | Founder marks as qualified | **Qualified** | Manual override. |
| **Qualified** | Founder marks as converted | **Converted** | Manual override. |
| **Any Stage** | Founder drags card manually | **Target Stage** | Cancel all pending jobs if moved OUT of "Contacted". |

### Rules That Are NOT Automated (By Design)
- `Replied → Qualified`: Always manual. The founder decides when a conversation becomes a real opportunity.
- `Qualified → Converted`: Always manual. Represents a closed deal — never automated.
- Re-entering the sequence: If a founder drags a lead BACK to "Contacted", a new follow-up sequence is NOT auto-started. The founder must explicitly re-trigger outreach.

---

## 4. Failure Handling System

### Schema Addition: `automation_log` (Audit Trail)

```sql
CREATE TABLE automation_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  event TEXT NOT NULL,        -- 'followup_sent', 'reply_processed', 'job_failed', 'bounce_received'
  intent TEXT,                -- 'interested', 'not_interested', 'neutral' (nullable)
  error_message TEXT,         -- Only populated on failures
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add to automation_jobs for retry logic
ALTER TABLE automation_jobs ADD COLUMN locked_until TIMESTAMPTZ;
ALTER TABLE automation_jobs ADD COLUMN retry_count INTEGER DEFAULT 0;
ALTER TABLE automation_jobs ADD COLUMN error_message TEXT;
```

### Retry Policy

| Failure Type | Behavior |
|---|---|
| Email send fails (API timeout) | Job stays `failed`. Retried on next cron cycle. Max 3 retries, then permanently `failed`. |
| AI classification fails (OpenAI down) | Defaults to `neutral`. Lead goes to "Replied". Founder reviews. |
| Webhook delivers duplicate | Rejected silently via `UNIQUE(external_message_id)`. Returns 200 to stop provider retries. |
| Lead deleted mid-sequence | `ON DELETE CASCADE` on `automation_jobs` cleans up automatically. |
| Cron job crashes mid-batch | `FOR UPDATE SKIP LOCKED` ensures no job is double-processed. `locked_until` expires after 5 min for stuck rows. |

### Dead Letter Queue (Simple)

Any job that fails 3 times is flagged as permanently failed. A daily summary Edge Function sends the founder a single notification:

```
"3 follow-up emails failed to send yesterday. Review them here: [link]"
```

This prevents silent failures from accumulating unnoticed.

---

## 5. Cost Optimization

| Concern | Decision |
|---|---|
| **LLM model** | Use `gpt-4o-mini` for both drafting and classification. At ~$0.15/1M input tokens, even 1000 leads/month costs < $1. Do NOT use `gpt-4o` unless the founder explicitly upgrades. |
| **Cron frequency** | Run every **15 minutes**, not every minute. Follow-ups are day-scale operations; minute-level precision wastes compute. |
| **Batch size** | Process max **50 jobs per cron cycle**. Prevents Edge Function timeouts on large backlogs. |
| **Realtime subscriptions** | Subscribe ONLY to the `leads` table, not `messages` or `automation_jobs`. The frontend doesn't need live job status. |
| **Email provider** | Resend free tier = 100 emails/day. More than enough for a solo founder's MVP. Only upgrade if volume exceeds this. |
| **Database queries** | Add indexes on `automation_jobs(status, scheduled_for)` and `messages(lead_id, direction)`. These are the two hot query paths. |

```sql
-- Critical indexes for production performance
CREATE INDEX idx_jobs_pending ON automation_jobs(status, scheduled_for) WHERE status = 'pending';
CREATE INDEX idx_messages_lead ON messages(lead_id, direction, sent_at DESC);
CREATE INDEX idx_leads_stage ON leads(stage_id);
```
