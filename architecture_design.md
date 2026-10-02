# AI CRM MVP Design

## 1. Core Features (Max 6)
1. **Interactive Kanban Board:** Visual pipeline management with predefined stages (Lead → Contacted → Replied → Qualified → Converted).
2. **Native Email Integration:** SMTP/IMAP or OAuth integration (e.g., Gmail) to send and receive emails directly within the CRM.
3. **AI Message Generator:** Context-aware LLM integration to instantly draft personalized outreach and follow-up emails based on lead data and user's value proposition.
4. **Time-Based Email Sequencing:** Simple drip campaigns that schedule automated follow-ups if a lead hasn't replied within a designated time frame (e.g., Day 2, Day 5).
5. **Automated Stage Transitions:** Logic that automatically moves leads across the Kanban board based on email activity (e.g., auto-moving to "Replied" upon receiving an inbound email).
6. **Lead Management (CRUD + Import):** Basic functionality to add leads manually, take text notes, and bulk import via CSV.

## 2. User Flow (Step-by-Step)
1. **Setup & Context:** The founder connects their email account and inputs a brief summary of their product/service offering to provide context for the AI.
2. **Lead Ingestion:** The founder uploads a CSV of leads. These appear in the **"Lead"** column.
3. **Outreach Generation:** The founder clicks on a lead. The AI instantly generates a personalized introductory email draft.
4. **Review & Send:** The founder reviews, tweaks, and hits "Send." The lead is automatically moved to the **"Contacted"** column.
5. **Automated Follow-up:** If the lead doesn't reply in 3 days, the system automatically drafts a follow-up and either sends it (if auto-send is enabled) or queues it for manual approval.
6. **Engagement:** When the lead replies, the system detects the incoming email and automatically moves the lead to the **"Replied"** column. 
7. **Closing:** The founder engages directly with the lead from the CRM, ultimately moving them manually to **"Qualified"** or **"Converted"**.

## 3. Automation Logic
* **Follow-up Triggers (Time-Based):**
  * *Condition:* Lead is in "Contacted" stage AND `current_time` > `last_email_sent_time` + `X_days` AND `reply_received` == False.
  * *Action:* Generate follow-up draft using AI. Queue for review or execute send.
* **Stage Movement (Activity-Based):**
  * *Event:* Outbound email successfully sent. → *Action:* Update status to "Contacted".
  * *Event:* Inbound email received from lead's email address. → *Action:* Update status to "Replied" and pause any pending automated follow-ups.

## 4. What to Exclude (To Ensure 2-Week Build)
* **WhatsApp & LinkedIn Outreach:** Excluded per constraints to minimize API complexity and focus solely on email.
* **Multi-User Collaboration:** No RBAC (Role-Based Access Control), team sharing, or permission levels. It's strictly for a single founder.
* **Complex Analytics & Reporting:** No chart dashboards, conversion rate tracking, or custom report generation.
* **Third-Party Integrations:** No Zapier, Slack webhooks, Stripe billing integration, or calendar scheduling (e.g., Calendly) native embeds.
* **Custom Customization:** No custom fields, custom pipeline stages, or complex lead scoring algorithms.

## 5. Final MVP Definition
A lightweight, single-player Kanban CRM designed specifically for a solo founder. It centralizes lead data and email communications into a single interface. By combining basic email automation (time-based follow-ups) with AI-generated messaging, it eliminates the manual effort of writing outreach emails and tracking who needs a follow-up, acting as an automated sales assistant strictly focused on moving leads from initial discovery to conversation.
