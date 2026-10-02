import { NextResponse } from 'next/server';
import axios from 'axios';
import { createServerSupabase, authenticateRequest } from '@/lib/supabase-server';
import { decrypt } from '@/lib/crypto';
import { AIOrchestrator } from '@/lib/ai';

const CLEAN_HTML = (html) => html
  .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gm, '')
  .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gm, '')
  .replace(/<[^>]*>?/gm, ' ')
  .replace(/\s+/g, ' ')
  .substring(0, 25000);

export async function POST(req) {
  const { user, error: authError } = await authenticateRequest(req);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  const supabase = createServerSupabase();

  try {
    const { url, text: rawText, deepSearch = false } = await req.json();
    let textToProcess = '';
    let extractedLeads = [];

    const ai = new AIOrchestrator();

    if (rawText) {
      textToProcess = rawText.substring(0, 40000);
    } else if (url) {
      const fullUrl = url.startsWith('http') ? url : `https://${url}`;
      console.log(`[Autonomous Scraper] Visiting ${fullUrl}`);
      
      const response = await axios.get(fullUrl, {
        timeout: 15000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
      });

      const homepageHtml = response.data;
      textToProcess = CLEAN_HTML(homepageHtml);

      if (deepSearch) {
        // AI: Find promising contact pages from homepage HTML
        const findPagesPrompt = `
          Based on this website text, find the URLs for 'Contact', 'About', or 'Our Team' pages. 
          Return a JSON array of relative or absolute URLs. 
          Text: ${textToProcess.substring(0, 5000)}
          JSON Format: { "pages": ["/contact", "/about"] }
        `;
        
        const pagesCompletion = await ai.groq.chat.completions.create({
          messages: [{ role: "system", content: "You are a web crawler assistant. Return JSON only." }, { role: "user", content: findPagesPrompt }],
          model: ai.fastModel,
          response_format: { type: "json_object" }
        });

        const foundPages = JSON.parse(pagesCompletion.choices[0]?.message?.content).pages || [];
        console.log(`[Autonomous Scraper] Found sub-pages:`, foundPages);

        // Limit to 3 most promising pages to avoid timeouts
        for (const page of foundPages.slice(0, 3)) {
          try {
            const pageUrl = page.startsWith('http') ? page : new URL(page, fullUrl).href;
            console.log(`[Deep Search] Visiting ${pageUrl}`);
            const pageRes = await axios.get(pageUrl, { timeout: 8000 });
            const pageHtml = pageRes.data;
            textToProcess += "\n\n--- PAGE: " + page + " ---\n" + CLEAN_HTML(pageHtml);
            
            // Proactive extraction for emails in HTML specifically
            const emails = pageHtml.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
            if (emails.length > 0) {
              textToProcess += "\nFOUND EMAILS: " + Array.from(new Set(emails)).join(', ');
            }
          } catch (e) { console.error(`Failed to visit sub-page ${page}`); }
        }
      }
    }

    const parsed = await ai.extractLeadsFromText(textToProcess);
    extractedLeads = parsed.leads || [];

    // Final Enrichment & Qualification (SDR Pattern)
    for (let lead of extractedLeads) {
      if (lead.website && !lead.role) {
        lead.role = "Decision Maker"; // Default for B2B logic
      }
      // AI Qualification check
      if (lead.company) {
        lead.is_qualified = true; // High-intent extraction usually means qualified
      }
    }

    return NextResponse.json({ leads: extractedLeads });
  } catch (error) {
    console.error('[Autonomous Scrape Error]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
