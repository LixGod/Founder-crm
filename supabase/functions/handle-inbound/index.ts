import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

serve(async (req) => {
  try {
    const payload = await req.json()
    const { from, subject, text, threadId } = payload // Expecting Resend webhook format

    // 1. Find Lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('email', from.email || from)
      .single()

    if (!lead) return new Response("Lead not found", { status: 404 })

    // 2. Log Message
    await supabase.from('messages').insert({
      lead_id: lead.id,
      direction: 'inbound',
      content_text: text,
      subject: subject,
      external_message_id: payload.id
    })

    // 3. Cancel Pending Automations
    await supabase
      .from('automation_jobs')
      .update({ status: 'cancelled' })
      .eq('lead_id', lead.id)
      .eq('status', 'pending')

    // 4. Update Pipeline Stage to 'Replied'
    // We'd ideally use AI here for intent classification as designed, but for MVP we move to Replied.
    const { data: stages } = await supabase.from('pipeline_stages').select('id').eq('name', 'Replied').single()
    if (stages) {
      await supabase.from('leads').update({ stage_id: stages.id }).eq('id', lead.id)
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})
