import { NextResponse } from 'next/server';
import axios from 'axios';
import { Resend } from 'resend';
import { createServerSupabase, authenticateRequest } from '@/lib/supabase-server';
import { decrypt } from '@/lib/crypto';

export async function POST(req) {
  const { user, error: authError } = await authenticateRequest(req);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  const supabase = createServerSupabase();

  try {
    const { leadId, content, channel } = await req.json();
    if (!leadId || !content || !channel) {
      return NextResponse.json({ error: 'leadId, content, and channel are required' }, { status: 400 });
    }

    const { data: lead } = await supabase.from('leads').select('*').eq('id', leadId).eq('user_id', user.id).single();
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    const { data: config } = await supabase.from('user_configs').select('*').eq('user_id', user.id).single();
    if (!config) return NextResponse.json({ error: 'Messaging not configured.' }, { status: 400 });

    let externalId = null;

    if (channel === 'email') {
      const resendKey = decrypt(config.resend_key_encrypted);
      const fromEmail = config.from_email || 'onboarding@resend.dev';
      
      if (!resendKey) return NextResponse.json({ error: 'Resend API key missing.' }, { status: 400 });

      const resend = new Resend(resendKey);
      const { data, error } = await resend.emails.send({
        from: `Adscaleengine <${fromEmail}>`,
        to: [lead.email],
        subject: `Following up — ${lead.company || 'your team'}`,
        text: content,
      });

      if (error) {
        if (error.name === 'validation_error' || error.statusCode === 403) {
          throw new Error(`Resend Error: ${error.message}. TIP: Ensure ${fromEmail} is verified in Resend.`);
        }
        throw new Error(error.message);
      }
      externalId = data?.id;

    } else if (channel === 'whatsapp') {
      const waToken = decrypt(config.whatsapp_token_encrypted);
      const waPhoneId = config.whatsapp_phone_number_id;
      if (!waToken || !waPhoneId) return NextResponse.json({ error: 'WhatsApp credentials incomplete.' }, { status: 400 });

      const waRes = await axios.post(
        `https://graph.facebook.com/v19.0/${waPhoneId}/messages`,
        {
          messaging_product: "whatsapp",
          to: lead.phone.replace(/[^0-9]/g, ''),
          type: "text",
          text: { body: content }
        },
        { headers: { 'Authorization': `Bearer ${waToken}` } }
      );
      externalId = waRes.data?.messages?.[0]?.id;
    }

    await supabase.from('messages').insert({
      lead_id: leadId,
      direction: 'outbound',
      channel,
      content,
      external_id: externalId
    });

    await supabase.from('leads').update({ last_contacted_at: new Date().toISOString() }).eq('id', leadId);

    return NextResponse.json({ success: true, externalId });
  } catch (error) {
    console.error('[Send Error]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
