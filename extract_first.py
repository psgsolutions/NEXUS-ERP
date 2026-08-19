import json
import os

transcript_path = r"C:\Users\nanon\.gemini\antigravity-ide\brain\775ed89b-fa0d-44cb-822b-df9bcd8b344d\.system_generated\logs\transcript_full.jsonl"
files = [
    r"d:\NEXUS-ERP\src\app\(authenticated)\sales\quotations\new\page.tsx",
    r"d:\NEXUS-ERP\src\app\(authenticated)\sales\orders\new\page.tsx",
    r"d:\NEXUS-ERP\src\app\(authenticated)\finance\invoices\new\page.tsx",
    r"d:\NEXUS-ERP\src\app\(authenticated)\customers\new\page.tsx",
    r"d:\NEXUS-ERP\src\app\(authenticated)\sales\customers\new\page.tsx"
]

first_edits = {}

with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            obj = json.loads(line)
        except:
            continue
        
        tool_calls = obj.get('tool_calls', [])
        for tc in tool_calls:
            name = tc.get('name')
            if name in ['replace_file_content', 'multi_replace_file_content']:
                args = tc.get('args', {})
                fp = args.get('TargetFile')
                if fp and fp.lower() in [x.lower() for x in files]:
                    if fp.lower() not in first_edits:
                        first_edits[fp.lower()] = args

for fp, args in first_edits.items():
    print(f"File: {fp}")
    if 'ReplacementChunks' in args:
        for chunk in args['ReplacementChunks']:
            target = chunk.get('TargetContent', '')
            print(f"TargetContent length: {len(target)}")
    else:
        target = args.get('TargetContent', '')
        print(f"TargetContent length: {len(target)}")
