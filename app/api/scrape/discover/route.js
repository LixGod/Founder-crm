import { NextResponse } from 'next/server';
import axios from 'axios';
import { createServerSupabase, authenticateRequest } from '@/lib/supabase-server';
import { decrypt } from '@/lib/crypto';
import { AIOrchestrator } from '@/lib/ai';

export async function POST(req) {
  const { user, error: authError } = await authenticateRequest(req);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  const supabase = createServerSupabase();

  try {
    const { niche, location, limit = 10 } = await req.json();
    if (!niche || !location) return NextResponse.json({ error: 'Niche and Location are required.' }, { status: 400 });

    const ai = new AIOrchestrator();
    
    // Hybrid Discovery: Search + AI Reasoning
    const searchQuery = `${niche} in ${location} website email owner`;
    const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;
    
    let searchContext = "";
    try {
      console.log(`[Discovery] Searching for context: ${searchQuery}`);
      const response = await axios.get(ddgUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
        timeout: 10000
      });
      searchContext = response.data.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gm, '').replace(/<[^>]*>?/gm, ' ').substring(0, 20000);
    } catch (e) {
      console.warn('[Discovery] Search context failed, falling back to pure AI knowledge.');
    }

    const discoveryPrompt = `
      You are a world-class Lead Generation SDR.
      Goal: Find ${limit} high-quality B2B leads for "${niche}" in "${location}".
      
      Below is search result text for context (might be messy):
      ---
      ${searchContext}
      ---
      
      Using the search results above AND your own knowledge of this specific area:
      1. Identify the top ${limit} businesses.
      2. For each, extract/predict: company, name (owner/CEO), email, phone, website, linkedin, and role.
      
      Rules:
      - If search result is empty, use your training data to find REAL businesses.
      - Prioritize businesses with specific websites.
      - Return ONLY a JSON object: { "leads": [...] }
    `;

    try {
      const completion = await ai.groq.chat.completions.create({
        messages: [{ role: "system", content: "You are a lead generation bot. Return JSON only." }, { role: "user", content: discoveryPrompt }],
        model: ai.model,
        response_format: { type: "json_object" }
      });

      // Strip markdown code blocks before parsing (e.g. ```json ... ```)
      const rawContent = completion.choices[0].message.content;
      const cleanContent = rawContent.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
      let extractedLeads = [];
      try {
        extractedLeads = JSON.parse(cleanContent).leads || [];
      } catch (e) {
        console.error('[JSON Parse Error] Failed to parse AI output', cleanContent);
        return NextResponse.json({ error: 'AI generated invalid data format.' }, { status: 500 });
      }
      
      // 1. Validation Layer (FAANG Audit Fix)
      const invalidDomains = ['yelp.com', 'justdial.com', 'houzz.com', 'yellowpages.com', 'tripadvisor.com', 'zomato.com', 'facebook.com', 'instagram.com', 'linkedin.com'];
      const fakeEmailPatterns = [/example\.com/i, /yourdomain\.com/i, /duckduckgo\.com/i, /fake@/i, /test@/i, /email@/i];
      
      extractedLeads = extractedLeads.filter(lead => {
        if (!lead.company || lead.company.length < 2) return false;
        
        // Reject aggregator websites
        if (lead.website) {
          try {
            const url = new URL(lead.website.startsWith('http') ? lead.website : `https://${lead.website}`);
            if (invalidDomains.some(d => url.hostname.includes(d))) return false;
          } catch(e) {}
        }
        
        // Strip fake emails
        if (lead.email && fakeEmailPatterns.some(p => p.test(lead.email))) {
          lead.email = null;
        }
        
        return true;
      }).map(lead => ({
        ...lead,
        context: { source: 'ai_discovery', query: searchQuery, confidence: lead.email ? 0.9 : 0.6 }
      }));

      if (extractedLeads.length > 0) {
        return NextResponse.json({ leads: extractedLeads });
      }
    } catch (e) {
      console.error('[Discovery Error]', e.message);
    }

    return NextResponse.json({ 
      error: 'Discovery failed. Please try a different niche or location.'
    }, { status: 500 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
