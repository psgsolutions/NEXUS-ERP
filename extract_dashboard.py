import json
import os

brain_dir = r"C:\Users\nanon\.gemini\antigravity-ide\brain"
transcripts = []
for root, dirs, files in os.walk(brain_dir):
    for f in files:
        if f == "transcript_full.jsonl":
            transcripts.append(os.path.join(root, f))

files_to_recover = [
    r"d:\NEXUS-ERP\src\app\(authenticated)\dashboard\page.tsx".lower()
]

latest_content = {}

for t in sorted(transcripts):
    try:
        with open(t, 'r', encoding='utf-8') as f:
            for line in f:
                try:
                    obj = json.loads(line)
                except:
                    continue
                
                tool_calls = obj.get('tool_calls', [])
                for tc in tool_calls:
                    name = tc.get('name')
                    if name == 'write_to_file':
                        args = tc.get('args', {})
                        fp = args.get('TargetFile', '').lower()
                        if fp in files_to_recover:
                            if 'CodeContent' in args:
                                latest_content[fp] = args['CodeContent']
                    elif name == 'replace_file_content':
                        # wait, what if I didn't write it to file, but I have the original code in TargetContent?
                        pass
    except Exception as e:
        pass

for fp, content in latest_content.items():
    print(f"Recovered {fp} ({len(content)} bytes)")
    with open(fp, 'w', encoding='utf-8') as f:
        f.write(content)
        
print("Recovery complete.")
