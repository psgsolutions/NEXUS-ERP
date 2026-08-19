import json
import os

transcript_path = r"C:\Users\nanon\.gemini\antigravity-ide\brain\775ed89b-fa0d-44cb-822b-df9bcd8b344d\.system_generated\logs\transcript_full.jsonl"

actions = []
try:
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
                    actions.append((name, tc.get('args', {})))
except Exception as e:
    print("Error reading transcript:", e)
    exit(1)

print(f"Found {len(actions)} edit actions. Reversing them...")

for name, args in reversed(actions):
    filepath = args.get('TargetFile')
    if not filepath or not os.path.exists(filepath):
        print(f"Skipping {filepath} - not found.")
        continue
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        modified = False
        
        if name == 'replace_file_content':
            target = args.get('TargetContent', '')
            replacement = args.get('ReplacementContent', '')
            # Reverse: search for replacement, replace with target
            if replacement in content:
                content = content.replace(replacement, target)
                modified = True
        elif name == 'multi_replace_file_content':
            chunks = args.get('ReplacementChunks', [])
            # Reverse the chunks order as well just in case they overlap
            for chunk in reversed(chunks):
                target = chunk.get('TargetContent', '')
                replacement = chunk.get('ReplacementContent', '')
                if replacement in content:
                    content = content.replace(replacement, target)
                    modified = True
                    
        if modified:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Reverted changes in {filepath}")
        else:
            print(f"Could not revert changes in {filepath} (replacement content not found)")
            
    except Exception as e:
        print(f"Error reverting {filepath}: {e}")

print("Revert complete.")
