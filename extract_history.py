import json
import os

transcript_path = r'C:\Users\nanon\.gemini\antigravity-ide\brain\dde7b8f2-8eb4-41cb-aa07-3333297c5815\.system_generated\logs\transcript_full.jsonl'
if not os.path.exists(transcript_path):
    print('Transcript not found!')
    exit(1)

edits = []
with open(transcript_path, 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        try:
            obj = json.loads(line)
        except Exception as e:
            continue
        
        # We check all steps in history
        tool_calls = obj.get('tool_calls', [])
        if True:
            for tc in tool_calls:
                name = tc.get('name')
                if name in ['replace_file_content', 'multi_replace_file_content', 'write_to_file']:
                    args = tc.get('args', {})
                    target = args.get('TargetFile', '')
                    desc = args.get('Description', args.get('Instruction', ''))
                    edits.append({
                        'index': i,
                        'step': obj.get('step_index'),
                        'tool': name,
                        'file': target,
                        'desc': desc,
                        'args': args
                    })

with open('history_output.txt', 'w', encoding='utf-8') as out:
    out.write(f'Found {len(edits)} file modifications in history:\n')
    for edit in edits:
        out.write(f"Index {edit['index']} Step {edit['step']}: {edit['tool']} -> {edit['file']} ({edit['desc'][:50]})\n")

