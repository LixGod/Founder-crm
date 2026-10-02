# Lead Generation Pipeline

Full automated pipeline: Google Maps discovery → website scraping → email finding → owner enrichment → phone verification → ICP scoring → CSV export.

## Setup

```bash
# 1. Install dependencies
pip install requests python-dotenv

# 2. Keys are already in .env — don't commit this file to git

# 3. Run the pipeline
python run_pipeline.py
```

## Usage

### Interactive (recommended for first run)
```bash
python run_pipeline.py
# Prompts for: niche, city, lead count
```

### CLI flags
```bash
python run_pipeline.py --niche "dental clinics" --city "Mumbai" --limit 50
```

### Resume from a specific stage (saves API credits)
```bash
python run_pipeline.py --resume-from 3   # skip discovery + scraping, start at email finding
python run_pipeline.py --resume-from 6   # just re-score existing leads
```

### Skip slow website scraping
```bash
python run_pipeline.py --niche "CA firms" --city "Pune" --limit 30 --skip-scrape
```

### Sync to CRM (Supabase)
```bash
python run_pipeline.py --niche "SaaS companies" --city "Bangalore" --sync
```

## Pipeline stages

| Stage | Module | What it does | APIs used |
|-------|--------|-------------|-----------|
| 1 | stage1_discovery.py | Google Maps search → business list | SerpAPI |
| 2 | stage2_scraper.py | Scrape websites for emails + owner hints | scrape.do, Firecrawl |
| 3 | stage3_email_finder.py | Domain → work email | Snov.io, Hunter.io |
| 4 | stage4_owner_enrichment.py | Domain → decision maker name + title | Apollo.io |
| 5 | stage5_phone_verify.py | Validate + format phone numbers | Numverify |
| 6 | stage6_icp_scorer.py | Score lead 1-10, assign Hot/Warm/Cold | Groq llama-3.3-70b |
| 7 | stage7_export.py | Clean CSV export | — |
| 8 | stage8_crm_import.py | Push leads to Supabase 'leads' table | Supabase REST |

## Output files

All intermediate and final files go to `output/`:

```
output/
  stage1_raw.json          ← raw Google Maps data
  stage2_scraped.json      ← + website emails + owner hints
  stage3_emails.json       ← + Snov/Hunter emails
  stage4_owners.json       ← + Apollo owner names
  stage5_phones.json       ← + verified phones
  stage6_scored.json       ← + ICP scores
  leads_<niche>_<city>_<ts>.csv   ← FINAL export
```

## Final lead record fields

| Field | Source |
|-------|--------|
| Company name | Google Maps (SerpAPI) |
| Website | Google Maps |
| Phone (verified) | Google Maps + Numverify |
| Address | Google Maps |
| Email | crawl4ai regex + Snov.io / Hunter.io |
| Owner name | Apollo + website /about page |
| Owner title | Apollo |
| LinkedIn URL | Apollo |
| ICP score (1-10) | Groq llama-3.3-70b |
| ICP tier | Hot / Warm / Cold |
| Outreach angle | Groq (personalized hook) |

## Tips

- Start with `--limit 10` for a smoke test before running at scale
- Use `--resume-from 3` if scraping times out — stage 2 results are saved
- Hot leads (score 8-10) have email + owner name + valid phone
- The `outreach_angle` field gives you a personalized first-line for cold email
