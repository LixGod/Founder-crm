import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import axios from 'axios';
import { createServerSupabase } from '@/lib/supabase-server';
import { decrypt } from '@/lib/crypto';
import { AIOrchestrator } from '@/lib/ai';

export async function POST(req) {
  const cronSecret = req.headers.get('x-cron-secret');
  if (cronSecret !== process.env.CRON_SECRET && process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerSupabase();
  const results = [];

  try {
    const { data: jobs } = await supabase
      .from('automation_jobs')
      .select('*, leads(*)')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .is('locked_until', null)
      .limit(10);

    if (!jobs?.length) return NextResponse.json({ processed: 0 });

    const processJob = async (job) => {
      const lead = job.leads;
      if (!lead) return;

      // Lock job
      await supabase.from('automation_jobs').update({ 
        locked_until: new Date(Date.now() + 5 * 60 * 1000).toISOString() 
      }).eq('id', job.id);

      try {
        const { data: config } = await supabase.from('user_configs').select('*').eq('user_id', job.user_id).single();
        if (!config) throw new Error('Configuration missing for this user.');

        // Get conversation history for context
        const { data: history } = await supabase
          .from('messages')
          .select('direction, content')
          .eq('lead_id', lead.id)
          .order('sent_at', { ascending: true })
          .limit(10);

        // Use AI to generate follow-up
        const ai = new AIOrchestrator();
        const personalizedMsg = await ai.generateFollowUp(lead, history || []);

        const resendKey = decrypt(config.resend_key_encrypted);
        const fromEmail = config.from_email || 'onboarding@resend.dev';

        let sent = false;
        if (lead.email && resendKey) {
          const resend = new Resend(resendKey);
          await resend.emails.send({
            from: `Founder CRM <${fromEmail}>`,
            to: [lead.email],
            subject: `Re: Our connection`,
            text: personalizedMsg
          });
          sent = true;
        } else if (lead.phone && config.whatsapp_token_encrypted) {
          await axios.post(`https://graph.facebook.com/v19.0/${config.whatsapp_phone_number_id}/messages`, {
            messaging_product: "whatsapp",
            to: lead.phone.replace(/[^0-9]/g, ''),
            type: "text",
            text: { body: personalizedMsg }
          }, { headers: { 'Authorization': `Bearer ${decrypt(config.whatsapp_token_encrypted)}` } });
          sent = true;
        }

        if (sent) {
          await supabase.from('messages').insert({
            lead_id: lead.id,
            direction: 'outbound',
            channel: lead.email ? 'email' : 'whatsapp',
            content: personalizedMsg,
            metadata: { job_id: job.id, type: 'ai_followup' }
          });

          await supabase.from('automation_jobs').update({ status: 'completed', executed_at: new Date().toISOString() }).eq('id', job.id);
          return { leadId: lead.id, status: 'sent' };
        } else {
          throw new Error('No valid channel or missing credentials to send follow-up.');
        }
      } catch (jobErr) {
        console.error(`[Follow-up Job Error] Lead: ${lead.id}`, jobErr.message);
        await supabase.from('automation_jobs').update({ 
          status: 'failed', 
          locked_until: null,
          error_message: jobErr.message 
        }).eq('id', job.id);
        throw jobErr;
      }
    };

    const jobResults = await Promise.allSettled(jobs.map(processJob));
    
    for (const res of jobResults) {
      if (res.status === 'fulfilled' && res.value) {
        results.push(res.value);
      }
    }

    return NextResponse.json({ processed: results.length, total_attempted: jobs.length, results });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
