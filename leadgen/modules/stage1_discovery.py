"""
Stage 1 — Business Discovery via SerpAPI (Google Maps)
Input : niche + city (user provided)
Output: list of businesses with name, address, phone, website, rating
"""

import os, requests, json, time, sys
from dotenv import load_dotenv

# Fix for Windows Unicode encoding issues
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

# Load keys (comma separated list)
SERPAPI_KEYS = [k.strip() for k in (os.getenv("SERPAPI_KEYS") or os.getenv("SERPAPI_KEY") or "").split(",") if k.strip()]
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "").strip()

def discover_businesses(niche: str, city: str, limit: int = 20) -> list[dict]:
    """
    Search Google Maps for businesses matching niche + city.
    Returns list of raw business records.
    """
    if GOOGLE_MAPS_API_KEY:
        try:
            return discover_businesses_google_maps(niche, city, limit)
        except Exception as e:
            print(f"  [!] Google Maps API failed: {e}. Falling back to SerpAPI...")
    
    if SERPAPI_KEYS:
        return discover_businesses_serpapi(niche, city, limit)
        
    print("  [!] No API keys available for discovery.")
    return []

def discover_businesses_google_maps(niche: str, city: str, limit: int = 20) -> list[dict]:
    print(f"\n[Stage 1] Discovering via Google Maps API: '{niche}' in '{city}' (limit={limit})")
    results = []
    
    url = "https://places.googleapis.com/v1/places:searchText"
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.primaryType,places.googleMapsUri,places.id,nextPageToken"
    }
    
    page_token = ""
    
    while len(results) < limit:
        payload = {
            "textQuery": f"{niche} in {city}",
            "pageSize": min(20, limit - len(results))
        }
        if page_token:
            payload["pageToken"] = page_token
            
        resp = requests.post(url, headers=headers, json=payload, timeout=30)
        if resp.status_code != 200:
            raise Exception(f"HTTP {resp.status_code}: {resp.text}")
        data = resp.json()
        
        places = data.get("places", [])
        if not places:
            print(f"  [!] No more results found via Google Maps API.")
            break
            
        for place in places:
            if len(results) >= limit:
                break
                
            biz = {
                "name":        place.get("displayName", {}).get("text", ""),
                "address":     place.get("formattedAddress", ""),
                "location":    place.get("formattedAddress", ""),
                "phone":       place.get("nationalPhoneNumber", ""),
                "website":     place.get("websiteUri", ""),
                "category":    place.get("primaryType", ""),
                "maps_url":    place.get("googleMapsUri", ""),
                "place_id":    place.get("id", ""),
                "niche":       niche,
                "city":        city,
                "email":       "", # Placeholder for fast search
                "owner_name":  "",
                "instagram":   "",
                "linkedin":    "",
                "facebook":    "",
            }
            results.append(biz)
            print(f"  ✓ [{len(results)}] {biz['name']} | {biz['phone']} | {biz['website']}")
            
        page_token = data.get("nextPageToken", "")
        if not page_token:
            break
            
        time.sleep(0.5)
        
    print(f"\n[Stage 1] Done — {len(results)} businesses found via Google Maps API")
    return results

def discover_businesses_serpapi(niche: str, city: str, limit: int = 20) -> list[dict]:
    """
    Fallback: Search Google Maps using SerpAPI.
    """
    print(f"\n[Stage 1] Discovering via SerpAPI: '{niche}' in '{city}' (limit={limit})")
    results = []
    start = 0

    while len(results) < limit:
        params = {
            "engine": "google_maps",
            "q": f"{niche} in {city}",
            "type": "search",
            "start": start,
            "hl": "en",
        }
        for i, key in enumerate(SERPAPI_KEYS):
            params["api_key"] = key
            try:
                resp = requests.get("https://serpapi.com/search", params=params, timeout=30)
                data = resp.json()
                
                if "error" in data and ("credit" in data["error"].lower() or "limit" in data["error"].lower()):
                    if i < len(SERPAPI_KEYS) - 1:
                        print(f"  [!] SerpAPI key {i+1} limited, rotating...")
                        continue
                break # Success or non-rotatable error
            except Exception as e:
                if i < len(SERPAPI_KEYS) - 1:
                    continue
                print(f"  [!] SerpAPI request failed: {e}")
                break

        if "error" in data:
            print(f"  [!] SerpAPI error: {data['error']}")
            break

        places = data.get("local_results", [])
        if not places:
            print(f"  [!] No more results at offset {start}")
            break

        for place in places:
            if len(results) >= limit:
                break

            # Line 1: Get what's directly on Maps
            biz = {
                "name":        place.get("title", ""),
                "address":     place.get("address", ""),
                "location":    place.get("address", ""),
                "phone":       place.get("phone", ""),
                "website":     place.get("website", ""),
                "category":    place.get("type", ""),
                "maps_url":    place.get("link", ""),
                "place_id":    place.get("place_id", ""),
                "niche":       niche,
                "city":        city,
                "email":       "", # Placeholder for fast search
                "owner_name":  "",
                "instagram":   "",
                "linkedin":    "",
                "facebook":    "",
            }

            # Capture social links if present in Maps result
            for link in place.get("links", []):
                l_url = link.get("link", "").lower()
                if "instagram.com" in l_url: biz["instagram"] = l_url
                if "facebook.com" in l_url:  biz["facebook"] = l_url
                if "linkedin.com" in l_url:  biz["linkedin"] = l_url

            results.append(biz)
            print(f"  ✓ [{len(results)}] {biz['name']} | {biz['phone']} | {biz['website']}")

        start += len(places)
        if len(places) < 20:
            break
        time.sleep(0.5)

    print(f"\n[Stage 1] Done — {len(results)} businesses found via SerpAPI")
    return results


if __name__ == "__main__":
    import sys
    niche = input("Enter niche (e.g. dental clinics): ").strip()
    city  = input("Enter city  (e.g. Mumbai):          ").strip()
    limit = int(input("How many leads? (default 20):      ").strip() or "20")

    results = discover_businesses(niche, city, limit)

    out_path = os.path.join(os.path.dirname(__file__), '..', 'output', 'stage1_raw.json')
    with open(out_path, 'w') as f:
        json.dump(results, f, indent=2)
    print(f"\n[Stage 1] Saved → {out_path}")
