-- =============================================================================
-- FOUNDER CRM ENTERPRISE - MASTER PRODUCTION SCHEMA
-- Includes: Leads, Pipelines, Multi-channel Sequences, AI Automation, RLS
-- =============================================================================

-- 0. CLEANUP (WARNING: Resets your DB. Comment out if updating existing)
DROP TABLE IF EXISTS public.automation_jobs CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.leads CASCADE;
DROP TABLE IF EXISTS public.user_configs CASCADE;
DROP TABLE IF EXISTS public.pipeline_stages CASCADE;
DROP TABLE IF EXISTS public.automation_sequences CASCADE;

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLES

-- Pipeline Stages
CREATE TABLE public.pipeline_stages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  order_index INTEGER NOT NULL
);

-- Automation Sequences (Templates)
CREATE TABLE public.automation_sequences (
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

-- User API Configurations
CREATE TABLE public.user_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  resend_key_encrypted TEXT,
  whatsapp_token_encrypted TEXT,
  whatsapp_phone_number_id TEXT,
  from_email TEXT DEFAULT 'onboarding@resend.dev',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Leads
CREATE TABLE public.leads (
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
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp', 'linkedin')),
  content TEXT NOT NULL,
  external_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- Automation Jobs (Upcoming tasks)
CREATE TABLE public.automation_jobs (
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

-- 3. SECURITY (RLS)

ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own stages" ON public.pipeline_stages FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);

ALTER TABLE public.user_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own configs" ON public.user_configs FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.automation_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own sequences" ON public.automation_sequences FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own leads" ON public.leads FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view messages for their leads" ON public.messages FOR ALL USING (
    EXISTS (SELECT 1 FROM public.leads WHERE leads.id = messages.lead_id AND leads.user_id = auth.uid())
);

ALTER TABLE public.automation_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own jobs" ON public.automation_jobs FOR ALL USING (auth.uid() = user_id);

-- 4. REAL-TIME (Safe creation)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE 
    public.leads, 
    public.messages, 
    public.pipeline_stages,
    public.automation_jobs;

-- 5. REFRESH CACHE
NOTIFY pgrst, 'reload schema';
