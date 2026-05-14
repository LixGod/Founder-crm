# AI & Automation System Design

This document details the practical implementation of the AI features and automation workflows for the founder CRM MVP.

## 1. Follow-up System

A robust, simple queuing system to ensure leads don't fall through the cracks.

*   **Time-Based Triggers:** 
    *   Follow-up 1: 3 days after the initial outreach.
    *   Follow-up 2: 7 days after the initial outreach (4 days after Follow-up 1).
*   **Max Follow-up Count:** Capped at **2 automated follow-ups** per lead to avoid spamming and maintain domain reputation.
*   **Stop Conditions:** The follow-up sequence is immediately **cancelled** if any of the following occur:
    *   `inbound_email_received` == TRUE (Lead replied).
    *   Lead is manually moved out of the "Contacted" stage.
    *   Max follow-up count (2) is reached.

## 2. AI Message Generation

The core LLM implementation for drafting emails, utilizing the context of the user's business and the lead's profile.

*   **Personalization Logic:**
    *   **User Context:** Pre-saved summary of what the founder does (e.g., "I run a B2B SaaS that automates inventory for retail stores. My value prop is saving 10 hours a week.").
    *   **Lead Context:** Data extracted from the lead profile (Name, Company, and any custom notes like "Saw their post on LinkedIn about inventory struggles").
    *   **Message Tone:** Kept short, casual, and value-driven (founder-to-founder style).

## 3. Reply Handling & Intent Classification

Automated processing of incoming emails to determine the next best action.

*   **Detect Reply:** Handled via inbound webhooks (e.g., Resend Inbound Parse). When an email arrives matching an active `thread_id` or lead `email`, it is logged in the `messages` table.
*   **Intent Classification:** The inbound email content is sent to a lightweight LLM (e.g., `gpt-4o-mini`) via a Supabase Edge Function to categorize the intent into three distinct buckets:
    *   `interested`: Asking for a call, pricing, or more info.
    *   `not_interested`: Explicit rejection, unsubscribe, or "not right now."
    *   `neutral`: OOO (Out of Office) replies, "who is this?", or forwarding to someone else.
*   **Suggest Reply:** If the intent is `interested` or `neutral`, the AI immediately generates a suggested response draft and attaches it to the lead profile for the founder to review.

## 4. Pipeline Automation

Rules for moving leads across the Kanban board without manual intervention.

*   **Trigger: Reply Received**
    *   *Action:* Immediately pause the follow-up sequence.
*   **Trigger: Intent Classified**
    *   *If `interested`:* Move stage from "Contacted" → **"Qualified"**.
    *   *If `neutral`:* Move stage from "Contacted" → **"Replied"**.
    *   *If `not_interested`:* Move stage from "Contacted" → **"Archived"** (or a closed/lost stage).

## 5. Example Internal System Prompts

These are the system prompts used under the hood to instruct the LLM.

### A. First Outreach Prompt
```text
System: You are an expert sales founder writing a brief, highly personalized cold outreach email.
Context:
- User Business: {user_business_context}
- Lead Name: {lead_name}
- Lead Company: {lead_company}
- Additional Notes: {lead_notes}

Instructions:
1. Keep it under 4 sentences.
2. Do not use corporate jargon. Write like a human founder emailing another human.
3. Reference their company or notes in the first sentence.
4. End with a low-friction question (e.g., "Open to a quick chat?", "Worth exploring?").
5. Return ONLY the email body text. Do not include subject lines or placeholder brackets.
```

### B. Follow-Up Prompt
```text
System: You are writing a polite, brief follow-up email to a lead who hasn't responded to your initial outreach.
Context: 
- User Business: {user_business_context}
- Previous Email Sent: {previous_email_body}

Instructions:
1. Keep it under 2 sentences.
2. Reference the previous email briefly (e.g., "Bumping this up," "Checking in to see if you caught my last note").
3. Add ONE tiny new piece of value or angle related to {user_business_context}.
4. Return ONLY the email body text.
```

### C. Intent Classification Prompt
```text
System: Analyze the following email reply from a prospect and classify their intent into exactly ONE of the following categories:
- "interested": They want to learn more, book a meeting, asked for pricing, or are open to chatting.
- "not_interested": They said no, asked to be removed, or clearly stated it's not a fit.
- "neutral": Out of office auto-reply, "who is this?", "forwarding this to my colleague", or ambiguous.

Email Reply Content:
"{inbound_email_content}"

Output format: Return ONLY the exact category string (interested, not_interested, or neutral).
```
