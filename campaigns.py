import re

filename = "campaigns.html"
output_file = "campaign_ids.txt"

try:
    with open(filename, "r", encoding="utf-8") as f:
        content = f.read()

    # Regex explanation:
    # 1. Find "RHQ BONK CUP " followed by digits (\d+) -> Capture Group 1 (Edition)
    # 2. Look for any characters until...
    # 3. "href="#/campaigns/26830/" followed by digits (\d+) -> Capture Group 2 (ID)
    pattern = r'RHQ BONK CUP\s+(\d+).*?href="#/campaigns/26830/(\d+)"'
    
    # findall returns a list of tuples: [('213', '114412'), ('212', '113634'), ...]
    matches = re.findall(pattern, content, re.DOTALL)

    # Convert the edition number to an integer so we can sort correctly
    # (Otherwise '2' comes after '100' in text sorting)
    # Structure: {'edition': 213, 'id': '114412'}
    clean_data = []
    for edition, c_id in matches:
        clean_data.append({'edition': int(edition), 'id': c_id})

    # Sort the list by edition number (Descending: 213 -> 212 -> 211)
    clean_data.sort(key=lambda x: x['edition'], reverse=True)

    print(f"Found {len(clean_data)} campaigns. Sorting them by Cup Number...")

    # Write to file
    with open(output_file, "w", encoding="utf-8") as f:
        for item in clean_data:
            # We just write the ID, but now they are in the perfect order.
            # You can check the file manually to see if it matches your expectations.
            f.write(f"{item['id']}\n")

    print(f"✅ Success! Sorted IDs saved to '{output_file}'.")
    print(f"   - Top entry: Cup #{clean_data[0]['edition']} (ID: {clean_data[0]['id']})")
    print(f"   - Bottom entry: Cup #{clean_data[-1]['edition']} (ID: {clean_data[-1]['id']})")

except FileNotFoundError:
    print(f"❌ Error: Could not find '{filename}'. Please make sure it's in the folder.")