-- RUN THIS IN YOUR SUPABASE SQL EDITOR
-- 1. Add the column if it was missed
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS linkedin_url TEXT;

-- 2. Force refresh the PostgREST cache (the "schema cache")
NOTIFY pgrst, 'reload schema';
