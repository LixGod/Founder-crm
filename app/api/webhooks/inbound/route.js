import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import axios from 'axios';
import { createServerSupabase } from '@/lib/supabase-server';
import { decrypt } from '@/lib/crypto';
import { AIOrchestrator } from '@/lib/ai';

export async function POST(req) {
  const webhookSecret = req.headers.get('x-webhook-secret') || req.headers.get('authorization');
  if (process.env.WEBHOOK_SECRET && webhookSecret !== `Bearer ${process.env.WEBHOOK_SECRET}` && webhookSecret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized webhook payload' }, { status: 401 });
  }

  const supabase = createServerSupabase();

  try {
    const payload = await req.json();
    console.log('[Inbound Webhook]', payload);

    // 1. Basic Extraction (Email/WhatsApp)
    let fromIdentifier, content, channel, externalId;
    
    if (payload.from && payload.text) { // Simple Email format
      fromIdentifier = payload.from;
      content = payload.text;
      channel = 'email';
    } else if (payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) { // WhatsApp format
      const msg = payload.entry[0].changes[0].value.messages[0];
      fromIdentifier = msg.from; // Phone number
      content = msg.text?.body || '';
      channel = 'whatsapp';
      externalId = msg.id;
    }

    if (!content) return NextResponse.json({ ok: true });

    // 2. Find Lead
    const { data: lead } = await supabase
      .from('leads')
      .select('*, automation_sequences(*)')
      .or(`email.eq.${fromIdentifier},phone.ilike.%${fromIdentifier}%`)
      .single();

    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    // 3. Get User Config (for Messaging APIs)
    const { data: config } = await supabase.from('user_configs').select('*').eq('user_id', lead.user_id).single();

    // 4. AI Intent Classification
    const ai = new AIOrchestrator();
    const intent = await ai.classifyIntent(content);
    console.log(`[AI Intent] ${intent} for lead ${lead.name}`);

    // 5. Log Inbound Message
    await supabase.from('messages').insert({
      lead_id: lead.id,
      direction: 'inbound',
      channel,
      content,
      external_id: externalId,
      metadata: { intent }
    });

    // 6. Automated Sequence Reply & Stage Update
    const sequence = lead.automation_sequences;
    
    if (intent === 'positive') {
      const { data: stage } = await supabase.from('pipeline_stages').select('id').eq('name', 'Qualified').single();
      if (stage) await supabase.from('leads').update({ stage_id: stage.id }).eq('id', lead.id);
    } else if (intent === 'negative') {
      const { data: stage } = await supabase.from('pipeline_stages').select('id').eq('name', 'Replied').single(); // Or a 'Lost' stage if exists
      if (stage) await supabase.from('leads').update({ stage_id: stage.id, active_sequence_id: null }).eq('id', lead.id);
    }

    if (sequence && (intent === 'positive' || intent === 'negative')) {
      const replyTemplate = intent === 'positive' ? sequence.positive_reply_message : sequence.negative_reply_message;
      
      if (replyTemplate) {
        const personalizedReply = replyTemplate.replace(/{{name}}/g, lead.name || 'there');
        
        if (channel === 'email' && config.resend_key_encrypted) {
          const resend = new Resend(decrypt(config.resend_key_encrypted));
          await resend.emails.send({
            from: `Founder CRM <${config.from_email || 'onboarding@resend.dev'}>`,
            to: [lead.email],
            subject: `Re: Our connection`,
            text: personalizedReply
          });
        } else if (channel === 'whatsapp' && config.whatsapp_token_encrypted) {
          await axios.post(`https://graph.facebook.com/v19.0/${config.whatsapp_phone_number_id}/messages`, {
            messaging_product: "whatsapp",
            to: lead.phone.replace(/[^0-9]/g, ''),
            type: "text",
            text: { body: personalizedReply }
          }, { headers: { 'Authorization': `Bearer ${decrypt(config.whatsapp_token_encrypted)}` } });
        }

        await supabase.from('messages').insert({
          lead_id: lead.id,
          direction: 'outbound',
          channel,
          content: personalizedReply,
          metadata: { intent, sequence_id: sequence.id, type: 'auto_reply' }
        });
      }
    }

    // 7. Cancel pending follow-ups
    await supabase.from('automation_jobs').update({ status: 'cancelled' }).eq('lead_id', lead.id).eq('status', 'pending');

    return NextResponse.json({ ok: true, intent });
  } catch (error) {
    console.error('[Webhook Error]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
