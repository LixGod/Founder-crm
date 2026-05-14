import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { authenticateRequest } from '@/lib/supabase-server';

// Path to the leadgen directory (at project root)
const LEADGEN_DIR = path.join(process.cwd(), 'leadgen');
const OUTPUT_DIR  = path.join(LEADGEN_DIR, 'output');

export async function POST(req) {
  const { user, error: authError } = await authenticateRequest(req);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  const { niche, city, limit = 20, skipScrape = false, syncCrm = true } = await req.json();

  if (!niche || !city) {
    return NextResponse.json({ error: 'niche and city are required' }, { status: 400 });
  }

  // Build SSE stream
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (data) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch (_) {}
      };

      const args = [
        path.join(LEADGEN_DIR, 'run_pipeline.py'),
        '--niche', niche,
        '--city', city,
        '--limit', String(limit),
      ];
      if (skipScrape) args.push('--skip-scrape');
      if (syncCrm)    args.push('--sync');

      send({ type: 'start', message: `🚀 Starting pipeline: "${niche}" in "${city}" (limit ${limit})` });

      const child = spawn('python', args, {
        cwd: LEADGEN_DIR,
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      // Stream stdout line-by-line
      let buffer = '';
      child.stdout.on('data', (chunk) => {
        buffer += chunk.toString('utf8');
        const lines = buffer.split('\n');
        buffer = lines.pop(); // incomplete last line
        for (const line of lines) {
          if (line.trim()) {
            send({ type: 'log', message: line.trim() });
          }
        }
      });

      // Stream stderr
      child.stderr.on('data', (chunk) => {
        const text = chunk.toString('utf8').trim();
        if (text) send({ type: 'warn', message: text });
      });

      child.on('close', async (code) => {
        // flush remaining buffer
        if (buffer.trim()) send({ type: 'log', message: buffer.trim() });

        if (code !== 0) {
          send({ type: 'error', message: `Pipeline exited with code ${code}` });
          controller.close();
          return;
        }

        // Read final leads from stage6_scored.json
        try {
          const scoredPath = path.join(OUTPUT_DIR, 'stage6_scored.json');
          if (fs.existsSync(scoredPath)) {
            const leads = JSON.parse(fs.readFileSync(scoredPath, 'utf8'));
            send({ type: 'done', leads, message: `✅ Pipeline complete — ${leads.length} leads scored` });
          } else {
            send({ type: 'done', leads: [], message: '✅ Pipeline complete (no scored output found)' });
          }
        } catch (e) {
          send({ type: 'done', leads: [], message: '✅ Pipeline complete' });
        }

        controller.close();
      });

      child.on('error', (err) => {
        send({ type: 'error', message: `Failed to start pipeline: ${err.message}` });
        controller.close();
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
