# CRM Backend Architecture

This document outlines the backend design for the AI CRM MVP, focusing on a simple yet scalable architecture utilizing **Supabase** (PostgreSQL, Realtime, Edge Functions).

## 1. Database Schema (Supabase/PostgreSQL)

The schema is relational and leverages JSONB for flexible data structures where appropriate.

```sql
-- Pipeline Stages (Lead, Contacted, Replied, Qualified, Converted)
CREATE TABLE pipeline_stages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  order_index INTEGER NOT NULL
);

-- Leads
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  company TEXT,
  stage_id UUID REFERENCES pipeline_stages(id),
  last_contacted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  context JSONB -- Stores summary or notes for AI context
);

-- Messages (Emails)
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  external_message_id TEXT, -- e.g., Gmail message ID
  thread_id TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  subject TEXT,
  content_text TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- Automation Rules (Defines the logic)
CREATE TABLE automation_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  trigger_event TEXT NOT NULL, -- e.g., 'email_sent', 'email_received'
  delay_days INTEGER DEFAULT 0,
  action_type TEXT NOT NULL, -- e.g., 'send_followup', 'move_stage'
  is_active BOOLEAN DEFAULT TRUE
);

-- Automation Jobs (Queue for background processing)
CREATE TABLE automation_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES automation_rules(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled', 'failed')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  executed_at TIMESTAMPTZ
);
```

## 2. Pipeline System

* **Kanban Data Source:** The frontend fetches all `leads` joined with `pipeline_stages` and orders them by `stage.order_index`.
* **Drag-and-Drop Updates:** Dragging a card triggers a Supabase `UPDATE` query on `leads.stage_id`. 
* **Real-time:** The frontend subscribes to `Supabase Realtime` on the `leads` table. Any stage update instantly reflects across browser tabs.

## 3. Email System

* **Provider:** Integration with an API provider like **Resend** (for outbound) or **Nylas/Gmail API** (if native OAuth is preferred).
* **Outbound:** When an email is sent via the application, it is immediately inserted into the `messages` table with `direction = 'outbound'`.
* **Inbound & Tracking Replies:** Use the email provider's Inbound Webhook (e.g., Resend Inbound Parse).
  * Webhook points to a Supabase Edge Function.
  * The function parses the email, finds the matching `thread_id` or `lead_id` (via sender email), and inserts it into `messages` as `inbound`.

## 4. Automation Engine & Event System

The automation engine operates via an Event-Driven model and Background Queues.

### Triggers & Background Jobs
* **Scheduling:** When an outbound email is sent, a Database Trigger (or the sending API route) inserts a row into `automation_jobs`.
  * *Example:* "Send Follow-up" job scheduled for `NOW() + interval '3 days'`.
* **Cron Execution:** Use **Supabase pg_cron** to run a function every hour:
  ```sql
  SELECT process_pending_jobs() 
  FROM automation_jobs 
  WHERE status = 'pending' AND scheduled_for <= NOW();
  ```
  The `process_pending_jobs` Edge Function interacts with the LLM to generate the text and sends the follow-up email.

### Auto Stage Movement Logic
This is handled inside the Supabase Edge Function processing the inbound email webhooks.

1. **If reply received:**
   * Inbound webhook fires -> Insert `message`.
   * **Action:** `UPDATE leads SET stage_id = (SELECT id FROM pipeline_stages WHERE name = 'Replied')`.
   * **Action:** `UPDATE automation_jobs SET status = 'cancelled' WHERE lead_id = [X] AND status = 'pending'`. *(Cancels the pending 3-day follow-up).*

2. **If positive intent -> move to "Qualified":**
   * *Enhancement:* Before updating the stage to "Replied", the Edge Function passes the inbound email content to OpenAI:
     `"Is this email showing positive intent? Reply YES or NO."`
   * If `YES`, move the lead straight to "Qualified".
   * If `NO`, move the lead to "Replied" (or a "Rejected" stage) for manual review.

## Summary of the Stack for 2-Week MVP
* **Database & Auth:** Supabase (PostgreSQL, Row Level Security).
* **Realtime:** Supabase Realtime (WebSockets).
* **Background Jobs:** Supabase `pg_cron` invoking Supabase Edge Functions.
* **Email:** Resend (Outbound + Inbound webhooks) or Gmail API.
* **AI:** OpenAI API (gpt-4o-mini for fast drafting and intent classification).
