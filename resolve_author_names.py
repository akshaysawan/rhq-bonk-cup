import requests
import json
import time
import os

# --- CONFIGURATION ---
INPUT_FILE = "bonk_cup_data.json"
OUTPUT_FILE = "bonk_cup_data.json" # Overwrite the same file

# ==============================================================================
# 🛑 PASTE YOUR COOKIE BELOW
# ==============================================================================
YOUR_COOKIE_STRING = "" 

HEADERS = {
    'Host': 'trackmania.io',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.5',
    # Keeping this simple to ensure Python can handle the response without extra libraries
    'Accept-Encoding': 'gzip, deflate', 
    'Referer': 'https://trackmania.io/',
    'Connection': 'keep-alive',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'Priority': 'u=0',
    'Cookie': YOUR_COOKIE_STRING
}

# Cache to store resolved names so we don't ask API twice for the same person
author_cache = {}

def get_player_name(account_id):
    # 1. Check cache first
    if account_id in author_cache:
        return author_cache[account_id]

    # 2. Fetch from API
    url = f"https://trackmania.io/api/player/{account_id}"
    try:
        print(f"   > Resolving ID {account_id}...", end=" ")
        response = requests.get(url, headers=HEADERS)
        
        # Check for Block
        content_type = response.headers.get('Content-Type', '')
        if 'html' in content_type:
            print("❌ BLOCKED! Check Cookie.")
            return account_id

        if response.status_code == 200:
            data = response.json()
            name = data.get('displayname', data.get('name', 'Unknown'))
            
            print(f"Found: {name}")
            author_cache[account_id] = name
            
            # Be polite to API
            time.sleep(0.6) 
            return name
        elif response.status_code == 429:
            print("Rate Limit (429). Sleeping 60s...")
            time.sleep(60)
            return get_player_name(account_id) # Retry
        else:
            print(f"Error {response.status_code}")
            return account_id # Fallback to ID if failed
            
    except Exception as e:
        print(f"Network Error: {e}")
        return account_id

def main():
    if not os.path.exists(INPUT_FILE):
        print(f"❌ Error: {INPUT_FILE} not found.")
        return

    if "PASTE_THE_WHOLE_COOKIE" in YOUR_COOKIE_STRING:
         print("⚠️ Stop! You forgot to paste your Cookie string.")
         return

    # 1. Load Data
    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    print(f"Loaded {len(data)} cups.")
    
    # 2. Scan for Authors
    print("Scanning for Map Authors...")
    
    unique_ids_found = set()
    total_maps = 0
    
    for cup in data:
        maps = cup.get('maps', [])
        for map_obj in maps:
            total_maps += 1
            author = map_obj.get('author', '')
            # Check if author looks like a UUID (length > 30 contains dashes)
            if len(author) > 30 and '-' in author:
                unique_ids_found.add(author)

    print(f"Found {total_maps} total maps.")
    print(f"Found {len(unique_ids_found)} unique Author IDs to resolve.")
    
    if len(unique_ids_found) == 0:
        print("✅ All authors seem to be names already! No work needed.")
        return

    # 3. Resolve Names
    print("\n--- Resolving Names ---")
    
    updated_count = 0
    
    # Loop through data and update *in place*
    for cup in data:
        maps = cup.get('maps', [])
        for map_obj in maps:
            author_id = map_obj.get('author', '')
            
            # Only resolve if it looks like an ID
            if len(author_id) > 30 and '-' in author_id:
                real_name = get_player_name(author_id)
                if real_name != author_id:
                    map_obj['author'] = real_name
                    updated_count += 1

    # 4. Save
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4)

    print(f"\n✅ Success! Updated {updated_count} map authors in '{OUTPUT_FILE}'.")

if __name__ == "__main__":
    main()