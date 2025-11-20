import requests
import pandas as pd
import re
import json
import time
import os

# --- CONFIGURATION ---
CLUB_ID = "26830" 
SHEET_ID = "1wQoBB5cEk1UhhQekHLgI0AAq-4NFTdU516WgGVUTOww"
GID = "944629031"
CSV_URL = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={GID}"
OUTPUT_FILE = "bonk_cup_data.json"

# The specific IDs that failed (from your log)
MISSING_IDS = [
    "53067", "52364", "51972", "51613", 
    "51230", "50854", "50130"
]

# ==============================================================================
# 🛑 PASTE YOUR COOKIE BELOW
# ==============================================================================
YOUR_COOKIE_STRING = "" 

HEADERS = {
    'Host': 'trackmania.io',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate', 
    'Referer': 'https://trackmania.io/',
    'Connection': 'keep-alive',
    'Cookie': YOUR_COOKIE_STRING
}

def get_winners_data():
    try:
        df = pd.read_csv(CSV_URL)
        df.columns = df.columns.str.strip()
        if 'Edition #' in df.columns:
            df.rename(columns={'Edition #': 'Edition'}, inplace=True)
        if 'Edition' in df.columns:
            df['Edition'] = df['Edition'].astype(str)
            return df
        return pd.DataFrame()
    except:
        return pd.DataFrame()

def get_campaign_details(campaign_id):
    url = f"https://trackmania.io/api/campaign/{CLUB_ID}/{campaign_id}"
    try:
        response = requests.get(url, headers=HEADERS)
        if response.status_code == 200:
            return response.json()
        elif response.status_code == 429:
            print("   (Rate Limit Hit... Sleeping 60s)...")
            time.sleep(60)
            return get_campaign_details(campaign_id) # Retry once
        return None
    except Exception as e:
        print(f"Error: {e}")
        return None

def main():
    # 1. Load Existing Data
    if not os.path.exists(OUTPUT_FILE):
        print("❌ Error: bonk_cup_data.json not found.")
        return

    with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
        final_data = json.load(f)
    
    print(f"Loaded existing file with {len(final_data)} cups.")
    
    # 2. Fetch Missing Data
    winners_df = get_winners_data()
    print(f"Fetching {len(MISSING_IDS)} missing campaigns...")

    for c_id in MISSING_IDS:
        print(f"Fetching ID {c_id}...", end=" ")
        data = get_campaign_details(c_id)
        
        if data:
            name = data.get('name', 'Unknown')
            publish_time = data.get('publishTime')
            
            edition_match = re.search(r'(\d+)(?!.*\d)', name)
            edition_number = edition_match.group(1) if edition_match else None
            
            winner_name = "Unknown"
            if edition_number and not winners_df.empty:
                winner_row = winners_df[winners_df['Edition'] == str(edition_number)]
                if not winner_row.empty:
                    winner_name = winner_row.iloc[0]['Winner']

            maps = []
            for playlist_item in data.get('playlist', []):
                maps.append({
                    "name": playlist_item.get('name'),
                    "author": playlist_item.get('author'),
                    "time_author": playlist_item.get('authorScore'),
                    "uid": playlist_item.get('mapUid'),
                })

            if edition_number:
                entry = {
                    "edition": int(edition_number),
                    "campaign_name": name,
                    "publish_date": publish_time,
                    "winner": winner_name,
                    "tm_io_url": f"https://trackmania.io/#/campaigns/{CLUB_ID}/{c_id}",
                    "maps": maps
                }
                final_data.append(entry)
                print(f"✅ Added (#{edition_number})")
            else:
                print(f"⚠️ Skipped (No Edition)")
            
            time.sleep(1.5)
        else:
            print("❌ Failed")

    # 3. Sort & Save
    print("Sorting and saving...")
    final_data.sort(key=lambda x: x['edition'], reverse=True)

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(final_data, f, indent=4)

    print(f"✅ DONE! Your file now has {len(final_data)} cups.")

if __name__ == "__main__":
    main()