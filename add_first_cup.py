import requests
import pandas as pd
import json
import time
import os

# --- CONFIGURATION ---
CLUB_ID = "26830" 
SHEET_ID = "1wQoBB5cEk1UhhQekHLgI0AAq-4NFTdU516WgGVUTOww"
GID = "944629031"
CSV_URL = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={GID}"
OUTPUT_FILE = "bonk_cup_data.json"

# The ID for the first cup
TARGET_ID = "9760"

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
    
    # Check if already exists to prevent duplicates
    for entry in final_data:
        if str(entry.get('edition')) == "1":
            print("⚠️ Edition #1 is already in your file!")
            return

    print(f"Loaded existing file. Fetching First Cup (ID: {TARGET_ID})...")
    
    # 2. Fetch The First Cup
    winners_df = get_winners_data()
    data = get_campaign_details(TARGET_ID)

    if data:
        name = data.get('name', 'Unknown')
        publish_time = data.get('publishTime')
        
        # --- MANUAL OVERRIDE FOR FIRST CUP ---
        print(f"Found campaign: '{name}'")
        print("Applying manual fix: Setting Edition to 1.")
        edition_number = "1"
        # -------------------------------------

        winner_name = "Unknown"
        if not winners_df.empty:
            # Look for Edition "1" in the sheet
            winner_row = winners_df[winners_df['Edition'] == edition_number]
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

        entry = {
            "edition": int(edition_number),
            "campaign_name": name,
            "publish_date": publish_time,
            "winner": winner_name,
            "tm_io_url": f"https://trackmania.io/#/campaigns/{CLUB_ID}/{TARGET_ID}",
            "maps": maps
        }
        
        final_data.append(entry)
        
        # 3. Sort & Save
        print("Sorting and saving...")
        final_data.sort(key=lambda x: x['edition'], reverse=True)

        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(final_data, f, indent=4)

        print(f"✅ DONE! Edition #1 has been added.")
        
    else:
        print("❌ Failed to fetch data. Check your Cookie string.")

if __name__ == "__main__":
    main()