import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

serve(async (req) => {
  try {
    console.log("Processing follow-ups...")
    
    // 1. Fetch pending jobs that are due
    const { data: jobs, error: jobsError } = await supabase
      .from('automation_jobs')
      .select('*, leads(*)')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .limit(50)

    if (jobsError) throw jobsError

    const results = []

    for (const job of jobs) {
      const lead = job.leads
      
      // 2. Pre-send verification (Hardened logic from cto_review.md)
      // Check if lead has replied or moved stages
      const { data: latestInbound } = await supabase
        .from('messages')
        .select('*')
        .eq('lead_id', lead.id)
        .eq('direction', 'inbound')
        .order('sent_at', { ascending: false })
        .limit(1)
        .single()

      if (latestInbound || lead.stage_id !== job.expected_stage_id) {
        await supabase.from('automation_jobs').update({ status: 'cancelled' }).eq('id', job.id)
        continue
      }

      // 3. Generate & Send Email via Resend
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'Founder CRM <onboarding@resend.dev>',
          to: [lead.email],
          subject: `Checking in: ${lead.company}`,
          text: `Hi ${lead.name}, just wanted to follow up on my previous note. Any thoughts on how we can help with ${lead.company}?`,
        }),
      })

      if (!emailRes.ok) {
        const err = await emailRes.text()
        console.error(`Failed to send email for lead ${lead.id}: ${err}`)
        await supabase.from('automation_jobs').update({ status: 'failed', error_message: err }).eq('id', job.id)
        continue
      }

      // 4. Update Database
      await supabase.from('messages').insert({
        lead_id: lead.id,
        direction: 'outbound',
        content_text: "Automated follow-up sent.",
        subject: `Checking in: ${lead.company}`
      })

      await supabase.from('automation_jobs').update({ 
        status: 'completed', 
        executed_at: new Date().toISOString() 
      }).eq('id', job.id)

      await supabase.from('leads').update({ 
        last_contacted_at: new Date().toISOString() 
      }).eq('id', lead.id)

      results.push({ leadId: lead.id, status: 'sent' })
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})
