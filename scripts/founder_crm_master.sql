-- =============================================================================
-- FOUNDER CRM ENTERPRISE - DEFINITIVE MASTER PRODUCTION SCHEMA
-- Includes EVERY feature, table, column, and hotfix from all previous schemas.
-- =============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TABLES (Idempotent)

-- Pipeline Stages
CREATE TABLE IF NOT EXISTS public.pipeline_stages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  order_index INTEGER NOT NULL
);

-- Automation Sequences (Templates)
CREATE TABLE IF NOT EXISTS public.automation_sequences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  starter_message TEXT,
  followup_message TEXT,
  followup_delay_hours INTEGER DEFAULT 24,
  positive_reply_message TEXT,
  negative_reply_message TEXT,
  channels TEXT[] DEFAULT ARRAY['email'],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- User API Configurations (Combines schema_v2 & v3 fields)
CREATE TABLE IF NOT EXISTS public.user_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  groq_key_encrypted TEXT,
  groq_tag TEXT,
  resend_key_encrypted TEXT,
  resend_tag TEXT,
  whatsapp_token_encrypted TEXT,
  whatsapp_tag TEXT,
  whatsapp_phone_number_id TEXT,
  linkedin_token_encrypted TEXT,
  linkedin_tag TEXT,
  from_email TEXT DEFAULT 'onboarding@resend.dev',
  encryption_iv TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Leads
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  stage_id UUID REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
  source_channel TEXT DEFAULT 'manual',
  last_contacted_at TIMESTAMPTZ,
  linkedin_url TEXT,
  active_sequence_id UUID REFERENCES public.automation_sequences(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  context JSONB DEFAULT '{}'::jsonb
);

-- Messages
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp', 'linkedin')),
  content TEXT NOT NULL,
  external_id TEXT,
  thread_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- Automation Settings
CREATE TABLE IF NOT EXISTS public.automation_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  followup_delay_hours INTEGER DEFAULT 24,
  max_followups INTEGER DEFAULT 3,
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(user_id)
);

-- Automation Jobs (Upcoming tasks)
CREATE TABLE IF NOT EXISTS public.automation_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled', 'failed')),
  job_type TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  executed_at TIMESTAMPTZ,
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  locked_until TIMESTAMPTZ
);

-- Automation Rules
CREATE TABLE IF NOT EXISTS public.automation_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL,
  condition JSONB DEFAULT '{}'::jsonb,
  action_type TEXT NOT NULL,
  action_params JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. INDEXES
CREATE INDEX IF NOT EXISTS idx_leads_user ON public.leads(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_lead ON public.messages(lead_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled ON public.automation_jobs(status, scheduled_for) WHERE status = 'pending';

-- 4. STRICT SECURITY (RLS)
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own stages" ON public.pipeline_stages;
CREATE POLICY "Users can manage their own stages" ON public.pipeline_stages FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);

ALTER TABLE public.user_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own configs" ON public.user_configs;
CREATE POLICY "Users can manage their own configs" ON public.user_configs FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.automation_sequences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own sequences" ON public.automation_sequences;
CREATE POLICY "Users can manage their own sequences" ON public.automation_sequences FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own leads" ON public.leads;
CREATE POLICY "Users can manage their own leads" ON public.leads FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view messages for their leads" ON public.messages;
CREATE POLICY "Users can view messages for their leads" ON public.messages FOR ALL USING (
    EXISTS (SELECT 1 FROM public.leads WHERE leads.id = messages.lead_id AND leads.user_id = auth.uid())
);

ALTER TABLE public.automation_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own jobs" ON public.automation_jobs;
CREATE POLICY "Users can manage their own jobs" ON public.automation_jobs FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own rules" ON public.automation_rules;
CREATE POLICY "Users can manage their own rules" ON public.automation_rules FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.automation_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own automation settings" ON public.automation_settings;
CREATE POLICY "Users can manage their own automation settings" ON public.automation_settings FOR ALL USING (auth.uid() = user_id);

-- 5. DEFAULT SYSTEM SEED DATA (Stages)
INSERT INTO public.pipeline_stages (user_id, name, order_index)
SELECT 
    NULL,
    name, 
    idx
FROM (VALUES 
    ('Lead', 0),
    ('Contacted', 1),
    ('Qualified', 2),
    ('Proposal', 3),
    ('Won', 4),
    ('Lost', 5)
) AS t(name, idx)
ON CONFLICT DO NOTHING;

-- 6. REAL-TIME PUBLICATION CONFIG
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

-- Try adding tables to publication (Catch exceptions if already added)
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.leads; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.pipeline_stages; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.automation_jobs; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.automation_sequences; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.automation_rules; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 7. CACHE RELOAD
NOTIFY pgrst, 'reload schema';
