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
ID_FILE = "campaign_ids.txt"

# ==============================================================================
# 🛑 COOKIE SECTION
# If the script STILL fails with "Expecting value...", you MUST paste the cookie below.
# But first, let's try with just the headers you provided.
# ==============================================================================
YOUR_COOKIE_STRING = "" 

# HEADERS: Matched exactly to your Firefox request
HEADERS = {
    'Host': 'trackmania.io',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.5',
    # Modified to ensure python requests can handle the compression
    'Accept-Encoding': 'gzip, deflate', 
    'Referer': 'https://trackmania.io/',
    'Connection': 'keep-alive',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'Priority': 'u=0',
}

# If you pasted a cookie above, we add it to the headers
if YOUR_COOKIE_STRING:
    HEADERS['Cookie'] = YOUR_COOKIE_STRING

def get_winners_data():
    print("Fetching Winners from Google Sheet...")
    try:
        df = pd.read_csv(CSV_URL)
        df.columns = df.columns.str.strip()
        if 'Edition #' in df.columns:
            df.rename(columns={'Edition #': 'Edition'}, inplace=True)
        if 'Edition' in df.columns:
            df['Edition'] = df['Edition'].astype(str)
            return df
        return pd.DataFrame()
    except Exception as e:
        print(f"⚠️ Error fetching Google Sheet: {e}")
        return pd.DataFrame()

def get_campaign_details(campaign_id):
    # CORRECTED URL STRUCTURE: Now includes the CLUB_ID (26830)
    url = f"https://trackmania.io/api/campaign/{CLUB_ID}/{campaign_id}"
    
    try:
        response = requests.get(url, headers=HEADERS)
        
        # Check if blocked (HTML response instead of JSON)
        content_type = response.headers.get('Content-Type', '')
        if 'html' in content_type:
            return "BLOCKED"

        if response.status_code == 200:
            return response.json()
        elif response.status_code == 404:
            print(f"❌ ID {campaign_id} not found (404).")
        else:
            print(f"❌ Error fetching ID {campaign_id}: Status {response.status_code}")
        return None
    except Exception as e:
        print(f"❌ Network error for ID {campaign_id}: {e}")
        return None

def main():
    if not os.path.exists(ID_FILE):
        print(f"❌ Error: '{ID_FILE}' not found. Please run extract_ids.py first.")
        return

    with open(ID_FILE, 'r') as f:
        campaign_ids = [line.strip() for line in f.readlines() if line.strip()]
    
    unique_ids = list(dict.fromkeys(campaign_ids))
    print(f"Loaded {len(unique_ids)} campaigns to process.")

    winners_df = get_winners_data()
    final_data = []
    total = len(unique_ids)

    print("\n--- Starting Data Download ---")

    for index, c_id in enumerate(unique_ids):
        print(f"[{index + 1}/{total}] Fetching Campaign ID: {c_id}...", end=" ", flush=True)
        
        data = get_campaign_details(c_id)
        
        if data == "BLOCKED":
            print("\n❌ BLOCKED! The server knows this is a script.")
            print("   SOLUTION: You MUST go back to the 'Network' tab in Firefox,")
            print("   copy the 'Cookie' value, and paste it into YOUR_COOKIE_STRING in the script.")
            break
        
        if data:
            name = data.get('name', 'Unknown')
            publish_time = data.get('publishTime')
            
            edition_match = re.search(r'(\d+)$', name)
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
                print(f"✅ OK")
            else:
                print(f"⚠️ No Edition # found")

            time.sleep(0.1) 
        else:
            print("Skipping (No Data).")

    final_data.sort(key=lambda x: x['edition'], reverse=True)

    with open('bonk_cup_data.json', 'w', encoding='utf-8') as f:
        json.dump(final_data, f, indent=4)

    print(f"\n✅ DONE! Saved {len(final_data)} campaigns to 'bonk_cup_data.json'")

if __name__ == "__main__":
    main()