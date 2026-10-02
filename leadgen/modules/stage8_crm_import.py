"""
Stage 8 — CRM Sync (Supabase)
Input  : final scored leads
Output : leads inserted into the 'leads' table in Supabase
"""

import os, json, requests, sys
from dotenv import load_dotenv

# Fix for Windows Unicode encoding issues
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

def push_to_crm(businesses: list[dict], owner_id: str = None) -> int:
    """Push leads to Supabase 'leads' table."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("    [!] Supabase credentials missing, skipping CRM sync")
        return 0

    print(f"\n[Stage 8] Syncing {len(businesses)} leads to Supabase...")
    
    # 1. Get default stage_id if not provided
    # (In a real app, we'd query pipeline_stages, but here we'll let Supabase defaults handle it or use a placeholder)
    
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }

    count = 0
    for biz in businesses:
        # Map fields to 'leads' table schema
        lead_data = {
            "name":           biz.get("owner_name") or biz.get("name"),
            "email":          biz.get("email"),
            "phone":          biz.get("phone_cleaned") or biz.get("phone"),
            "company":        biz.get("name"),
            "linkedin_url":   biz.get("owner_linkedin"),
            "source_channel": "ai_scraper",
            "context": {
                "icp_score":     biz.get("icp_score"),
                "icp_tier":      biz.get("icp_tier"),
                "icp_reasoning": biz.get("icp_reasoning"),
                "outreach_note": biz.get("outreach_angle"),
                "niche":         biz.get("niche"),
                "city":          biz.get("city")
            }
        }
        
        if owner_id:
            lead_data["owner_id"] = owner_id

        try:
            resp = requests.post(
                f"{SUPABASE_URL}/rest/v1/leads",
                headers=headers,
                json=lead_data,
                timeout=10
            )
            if resp.status_code in [201, 204]:
                count += 1
                print(f"    ✓ Synced: {biz['name']}")
            else:
                print(f"    [!] Failed to sync {biz['name']}: {resp.text}")
        except Exception as e:
            print(f"    [!] Error syncing {biz['name']}: {e}")

    print(f"\n[Stage 8] Done — {count} leads synced to CRM")
    return count

if __name__ == "__main__":
    in_path = os.path.join(os.path.dirname(__file__), '..', 'output', 'stage6_scored.json')
    if not os.path.exists(in_path):
        print(f"File not found: {in_path}")
        sys.exit(1)

    with open(in_path) as f:
        businesses = json.load(f)

    push_to_crm(businesses)
