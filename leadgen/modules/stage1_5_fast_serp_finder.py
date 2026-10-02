"""
Stage 1.5 — Fast API-based Email Discovery
Line of Defense 1: Organic Google Search for emails.
Much faster than scraping.
"""

import os, re, requests, json, time, sys
from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv

# Fix for Windows Unicode encoding issues
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

# Load keys (comma separated list)
SERPAPI_KEYS = [k.strip() for k in (os.getenv("SERPAPI_KEYS") or os.getenv("SERPAPI_KEY") or "").split(",") if k.strip()]
EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")

def serp_find_email(biz_name: str, city: str) -> str:
    """Use SerpAPI organic search to find emails in snippets."""
    query = f'"{biz_name}" {city} email contact'
    for i, key in enumerate(SERPAPI_KEYS):
        params = {
            "engine": "google",
            "q": query,
            "api_key": key,
            "num": 5
        }
        
        try:
            resp = requests.get("https://serpapi.com/search", params=params, timeout=15)
            data = resp.json()
            
            if "error" in data and ("credit" in data["error"].lower() or "limit" in data["error"].lower()):
                if i < len(SERPAPI_KEYS) - 1:
                    print(f"    [serp-fast] key {i+1} limited, rotating...")
                    continue

            # Check snippets and metadata
            combined_text = ""
            for result in data.get("organic_results", []):
                combined_text += f" {result.get('snippet', '')} {result.get('title', '')} "
                
            emails = EMAIL_RE.findall(combined_text)
            if emails:
                # Filter out common junk
                filtered = [e for e in emails if not any(skip in e.lower() for skip in ["example", "youremail", ".png", ".jpg", "test@"])]
                if filtered:
                    return filtered[0].lower()
            break # Success or no emails found, don't rotate unless error
        except Exception as e:
            if i < len(SERPAPI_KEYS) - 1:
                continue
            print(f"    [serp-fast] error for {biz_name}: {e}")
        
    return ""

def run_stage1_5(businesses: list[dict]) -> list[dict]:
    """First Line of Defense: Quick API-based email lookup."""
    print(f"\n[Stage 1.5] Fast API-based email lookup for {len(businesses)} businesses...")
    
    def process_biz(args):
        i, biz = args
        # Skip if already has email (unlikely from Stage 1 but good to check)
        if biz.get("email"):
            return biz
            
        email = serp_find_email(biz["name"], biz["city"])
        if email:
            print(f"    ⚡ Fast-find success for {biz['name']}: {email}")
            biz["email"] = email
            biz["email_source"] = "serp_organic"
        
        return biz

    enriched = []
    with ThreadPoolExecutor(max_workers=5) as executor:
        enriched = list(executor.map(process_biz, enumerate(businesses)))

    found = sum(1 for b in enriched if b.get("email"))
    print(f"\n[Stage 1.5] Done — {found} emails found via fast-search")
    return enriched

if __name__ == "__main__":
    in_path  = os.path.join(os.path.dirname(__file__), '..', 'output', 'stage1_raw.json')
    out_path = os.path.join(os.path.dirname(__file__), '..', 'output', 'stage1_5_fast.json')

    with open(in_path) as f:
        businesses = json.load(f)

    enriched = run_stage1_5(businesses)

    with open(out_path, 'w') as f:
        json.dump(enriched, f, indent=2)
    print(f"\n[Stage 1.5] Saved → {out_path}")
