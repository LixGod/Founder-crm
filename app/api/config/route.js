import { NextResponse } from 'next/server';
import { createServerSupabase, authenticateRequest } from '@/lib/supabase-server';
import { encrypt } from '@/lib/crypto';

export async function POST(req) {
  const { user, error: authError } = await authenticateRequest(req);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  const supabase = createServerSupabase();

  try {
    const { resendKey, fromEmail, whatsappToken, whatsappPhoneId, groqKey, linkedinToken } = await req.json();

    const updateData = {
      user_id: user.id,
      whatsapp_phone_number_id: whatsappPhoneId || null,
    };

    if (resendKey) updateData.resend_key_encrypted = encrypt(resendKey);
    if (fromEmail) updateData.from_email = fromEmail;
    if (whatsappToken) updateData.whatsapp_token_encrypted = encrypt(whatsappToken);
    if (groqKey) updateData.groq_key_encrypted = encrypt(groqKey);
    if (linkedinToken) updateData.linkedin_token_encrypted = encrypt(linkedinToken);

    const { error } = await supabase.from('user_configs').upsert(updateData, { onConflict: 'user_id' });

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Config Save Error]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req) {
  const { user, error: authError } = await authenticateRequest(req);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  const supabase = createServerSupabase();

  const { data, error } = await supabase
    .from('user_configs')
    .select('resend_key_encrypted, whatsapp_token_encrypted, whatsapp_phone_number_id, from_email, groq_key_encrypted, linkedin_token_encrypted, updated_at')
    .eq('user_id', user.id)
    .single();

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    hasResendKey: !!data?.resend_key_encrypted,
    hasWhatsAppConfig: !!(data?.whatsapp_token_encrypted && data?.whatsapp_phone_number_id),
    hasGroqKey: !!(data?.groq_key_encrypted || process.env.GROQ_API_KEY),
    hasLinkedInKey: !!data?.linkedin_token_encrypted,
    fromEmail: data?.from_email || 'onboarding@resend.dev',
    updatedAt: data?.updated_at || null,
  });
}
