import { NextResponse } from 'next/server';
import axios from 'axios';
import { createServerSupabase, authenticateRequest } from '@/lib/supabase-server';

export async function POST(req) {
  const { user, error: authError } = await authenticateRequest(req);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  const supabase = createServerSupabase();

  try {
    const { leadId } = await req.json();
    const { data: lead } = await supabase.from('leads').select('*').eq('id', leadId).single();

    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    // Try to determine website
    let website = lead.context?.original_data?.website || lead.context?.website;
    
    // Fallback: If no website but we have company name, try to construct a likely one
    if (!website && lead.company) {
      const cleanName = lead.company.toLowerCase().replace(/[^a-z0-9]/g, '');
      website = `https://www.${cleanName}.com`; // Basic guess
    }

    if (!website) return NextResponse.json({ error: 'No website found for this lead' }, { status: 400 });

    // Scrape the website
    console.log(`[Enriching] Scraping ${website} for ${lead.name}`);
    
    const response = await axios.get(website, {
      timeout: 10000,
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    });

    const html = response.data.substring(0, 50000);
    
    // Find email using regex
    const emailMatch = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    let email = emailMatch ? emailMatch[0] : null;

    // If still no email, check common sub-pages
    if (!email) {
      const pages = ['/contact', '/about', '/contact-us'];
      for (const page of pages) {
        try {
          const pageRes = await axios.get(`${website}${page}`, { timeout: 5000 });
          const pageHtml = pageRes.data.substring(0, 20000);
          const subMatch = pageHtml.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
          if (subMatch) {
            email = subMatch[0];
            break;
          }
        } catch (e) { /* ignore page errors */ }
      }
    }

    if (email) {
      await supabase.from('leads').update({ email }).eq('id', leadId);
      return NextResponse.json({ email });
    }

    return NextResponse.json({ email: null });
  } catch (error) {
    console.error('[Enrichment Error]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
