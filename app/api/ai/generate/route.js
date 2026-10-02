import { NextResponse } from 'next/server';
import { createServerSupabase, authenticateRequest } from '@/lib/supabase-server';
import { decrypt } from '@/lib/crypto';
import { AIOrchestrator } from '@/lib/ai';

export async function POST(req) {
  const { user, error: authError } = await authenticateRequest(req);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  const supabase = createServerSupabase();

  try {
    const { leadId, type, context } = await req.json();
    if (!leadId) return NextResponse.json({ error: 'leadId is required' }, { status: 400 });

    const { data: lead } = await supabase.from('leads').select('*').eq('id', leadId).eq('user_id', user.id).single();
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    const ai = new AIOrchestrator();
    let message;

    if (type === 'outreach') {
      message = await ai.generateOutreach(lead, context || {});
    } else if (type === 'followup') {
      const { data: history } = await supabase
        .from('messages')
        .select('direction, content')
        .eq('lead_id', leadId)
        .order('sent_at', { ascending: true })
        .limit(10);
      message = await ai.generateFollowUp(lead, history || []);
    } else if (type === 'linkedin') {
      message = await ai.generateLinkedInOutreach(lead);
    } else {
      return NextResponse.json({ error: 'Invalid generation type' }, { status: 400 });
    }

    return NextResponse.json({ message });
  } catch (error) {
    console.error('[AI Generate Error]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
