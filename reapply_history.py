import json
import os
import re

transcript_path = r'C:\Users\nanon\.gemini\antigravity-ide\brain\dde7b8f2-8eb4-41cb-aa07-3333297c5815\.system_generated\logs\transcript_full.jsonl'

# Read all tool calls from transcript in order
actions = []
with open(transcript_path, 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        try:
            obj = json.loads(line)
        except Exception:
            continue
        
        step_index = obj.get('step_index', 0)
        # We only care about steps in the previous sessions (between 1200 and 2090)
        if 1200 <= step_index < 2090:
            tool_calls = obj.get('tool_calls', [])
            for tc in tool_calls:
                name = tc.get('name')
                if name in ['replace_file_content', 'multi_replace_file_content']:
                    args = tc.get('args', {})
                    actions.append({
                        'step': step_index,
                        'name': name,
                        'file': args.get('TargetFile'),
                        'args': args
                    })

print(f"Found {len(actions)} actions to re-apply.")

with open('reapply.log', 'w', encoding='utf-8') as log_file:
    def log(msg):
        print(msg)
        log_file.write(msg + '\n')

    def apply_replace(filepath, target, replacement):
        if not os.path.exists(filepath):
            log(f"File not found: {filepath}")
            return False
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Check direct match
        if target in content:
            content = content.replace(target, replacement)
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            return True

        # Try normalizing whitespace/newlines
        def normalize(s):
            # Normalize newlines
            s = s.replace('\r\n', '\n').strip()
            # Normalize multiple spaces/newlines
            s = re.sub(r'\s+', ' ', s)
            return s

        target_norm = normalize(target)
        # We can do a regex search or token replacement if needed, but let's try newline normalization first
        content_nl = content.replace('\r\n', '\n')
        target_nl = target.replace('\r\n', '\n')
        if target_nl in content_nl:
            content_nl = content_nl.replace(target_nl, replacement.replace('\r\n', '\n'))
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content_nl)
            return True
            
        log(f"Target content not found in {filepath}!")
        log(f"Target: {repr(target[:200])}")
        return False

    for act in actions:
        filepath = act['file']
        name = act['name']
        args = act['args']
        log(f"Applying Step {act['step']}: {name} on {os.path.basename(filepath)}...")
        
        if name == 'replace_file_content':
            target = args.get('TargetContent')
            replacement = args.get('ReplacementContent')
            success = apply_replace(filepath, target, replacement)
            if not success:
                log("Failed to apply replace_file_content!")
                
        elif name == 'multi_replace_file_content':
            chunks = args.get('ReplacementChunks', [])
            for chunk in chunks:
                target = chunk.get('TargetContent')
                replacement = chunk.get('ReplacementContent')
                success = apply_replace(filepath, target, replacement)
                if not success:
                    log(f"Failed to apply chunk in multi_replace_file_content!")


print("Re-application complete.")
