import json

transcript = r'C:\Users\nanon\.gemini\antigravity-ide\brain\bf73291d-d1d2-466a-8c04-11e600c6e68b\.system_generated\logs\transcript_full.jsonl'

with open(transcript, 'r', encoding='utf-8') as f:
    count = 0
    for line in f:
        try:
            data = json.loads(line)
        except:
            continue
        
        if data.get('type') == 'USER_INPUT':
            content = data.get('content', '')
            print("---")
            print(content[:500])
            count += 1
            if count > 3:
                break
