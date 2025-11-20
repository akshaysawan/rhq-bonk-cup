import requests
import pandas as pd
import json
import os

# --- CONFIGURATION ---
SHEET_ID = "1wQoBB5cEk1UhhQekHLgI0AAq-4NFTdU516WgGVUTOww"
GID = "944629031"
CSV_URL = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={GID}"
OUTPUT_FILE = "bonk_cup_data.json"

def get_winners_and_dates():
    print("Fetching Data from Google Sheet...")
    try:
        # Read CSV
        df = pd.read_csv(CSV_URL)
        
        # Clean column names (remove accidental spaces)
        df.columns = df.columns.str.strip()
        
        # debug: print columns found
        print(f"Columns found: {list(df.columns)}")

        # Normalize Column Names
        # We want 'Edition', 'Winner', and 'Date'
        if 'Edition #' in df.columns:
            df.rename(columns={'Edition #': 'Edition'}, inplace=True)
        
        # Ensure we have the columns we need
        if 'Edition' not in df.columns:
            print("❌ Error: Could not find 'Edition' column.")
            return pd.DataFrame()
            
        # Convert Edition to string for matching
        df['Edition'] = df['Edition'].astype(str)
        
        return df
    except Exception as e:
        print(f"❌ Error fetching Google Sheet: {e}")
        return pd.DataFrame()

def main():
    if not os.path.exists(OUTPUT_FILE):
        print(f"❌ Error: {OUTPUT_FILE} not found.")
        return

    # 1. Load your existing JSON file
    with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    print(f"Loaded {len(data)} cups from JSON.")

    # 2. Get the Sheet Data
    sheet_df = get_winners_and_dates()
    
    if sheet_df.empty:
        print("Stopping because Sheet data is empty.")
        return

    updates_count = 0

    # 3. Update every entry in the JSON
    for entry in data:
        edition = str(entry.get('edition'))
        
        # Find the row in the Google Sheet
        row = sheet_df[sheet_df['Edition'] == edition]
        
        if not row.empty:
            # Get Winner
            if 'Winner' in row.columns:
                winner = row.iloc[0]['Winner']
                # Only update if it's not empty/NaN
                if pd.notna(winner) and str(winner).strip() != "":
                    entry['winner'] = str(winner)

            # Get Date
            if 'Date' in row.columns:
                date_val = row.iloc[0]['Date']
                if pd.notna(date_val) and str(date_val).strip() != "":
                    # The sheet has dates like "9.5.2021". 
                    # We save it as a new field "display_date"
                    entry['display_date'] = str(date_val)
                    updates_count += 1
        else:
            # Optional: Print which ones are missing from the sheet
            # print(f"Warning: Cup #{edition} not found in Google Sheet.")
            pass

    # 4. Save back to JSON
    # Re-sort just in case
    data.sort(key=lambda x: x['edition'], reverse=True)

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4)

    print(f"✅ Success! Updated {updates_count} cups with dates/winners from the sheet.")

if __name__ == "__main__":
    main()