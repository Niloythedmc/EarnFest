import re
import os

log_path = r"C:\Users\hp\.gemini\antigravity\brain\84eb9506-0134-4c06-a45f-7febf0ea4a61\.system_generated\logs\overview.txt"

if os.path.exists(log_path):
    with open(log_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    matches = [m.start() for m in re.finditer(r"3390:", content)]
    print(f"Found {len(matches)} matches.")
    for idx in matches[:5]:
        print(content[idx-100:idx+600])
else:
    print("Log file not found.")
