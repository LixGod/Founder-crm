import { NextResponse } from 'next/server';
import { createServerSupabase, authenticateRequest } from '@/lib/supabase-server';
import { decrypt } from '@/lib/crypto';
import { Resend } from 'resend';
import axios from 'axios';

export async function POST(req) {
  const { user, error: authError } = await authenticateRequest(req);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  const supabase = createServerSupabase();

  try {
    const { leadIds, sequenceId } = await req.json();
    if (!leadIds?.length || !sequenceId) {
      return NextResponse.json({ error: 'leadIds and sequenceId are required' }, { status: 400 });
    }

    const { data: sequence } = await supabase.from('automation_sequences').select('*').eq('id', sequenceId).single();
    const { data: config } = await supabase.from('user_configs').select('*').eq('user_id', user.id).single();

    if (!sequence) return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });
    if (!config) return NextResponse.json({ error: 'Messaging not configured' }, { status: 400 });

    const results = [];
    const { data: leads } = await supabase.from('leads').select('*').in('id', leadIds);

    for (const lead of leads) {
      const personalizedMsg = sequence.starter_message
        .replace(/{{name}}/g, lead.name || 'there')
        .replace(/{{company}}/g, lead.company || 'your company');

      const channelsSent = [];

      if (sequence.channels.includes('email') && lead.email) {
        try {
          const resendKey = decrypt(config.resend_key_encrypted);
          const fromEmail = config.from_email || 'onboarding@resend.dev';
          const resend = new Resend(resendKey);
          await resend.emails.send({
            from: `Founder CRM <${fromEmail}>`,
            to: [lead.email],
            subject: `Connection Request — ${lead.name}`,
            text: personalizedMsg
          });
          channelsSent.push('email');
        } catch (e) { console.error('Email fail:', e.message); }
      }

      if (sequence.channels.includes('whatsapp') && lead.phone) {
        try {
          const waToken = decrypt(config.whatsapp_token_encrypted);
          const waPhoneId = config.whatsapp_phone_number_id;
          await axios.post(`https://graph.facebook.com/v19.0/${waPhoneId}/messages`, {
            messaging_product: "whatsapp",
            to: lead.phone.replace(/[^0-9]/g, ''),
            type: "text",
            text: { body: personalizedMsg }
          }, { headers: { 'Authorization': `Bearer ${waToken}` } });
          channelsSent.push('whatsapp');
        } catch (e) { console.error('WhatsApp fail:', e.message); }
      }

      if (channelsSent.length > 0) {
        await supabase.from('messages').insert(channelsSent.map(ch => ({
          lead_id: lead.id,
          direction: 'outbound',
          channel: ch,
          content: personalizedMsg,
          metadata: { sequence_id: sequence.id, step: 'starter' }
        })));

        if (sequence.followup_message) {
          await supabase.from('automation_jobs').insert({
            lead_id: lead.id,
            user_id: user.id,
            job_type: 'follow_up',
            scheduled_for: new Date(Date.now() + (sequence.followup_delay_hours || 24) * 60 * 60 * 1000).toISOString(),
            status: 'pending',
            metadata: { sequence_id: sequence.id, content: sequence.followup_message }
          });
        }
        
        // Enroll lead in sequence
        await supabase.from('leads').update({ active_sequence_id: sequenceId }).eq('id', lead.id);
        results.push({ leadId: lead.id, channels: channelsSent });
      }
    }

    return NextResponse.json({ success: true, processed: results.length });
  } catch (error) {
    console.error('[Campaign Error]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
