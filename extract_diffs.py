import json
import os

transcript_path = r'C:\Users\nanon\.gemini\antigravity-ide\brain\dde7b8f2-8eb4-41cb-aa07-3333297c5815\.system_generated\logs\transcript_full.jsonl'
with open(transcript_path, 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        try:
            obj = json.loads(line)
        except Exception as e:
            continue
        
        tool_calls = obj.get('tool_calls', [])
        for tc in tool_calls:
            name = tc.get('name')
            if name in ['replace_file_content', 'multi_replace_file_content', 'write_to_file']:
                args = tc.get('args', {})
                target = args.get('TargetFile', '')
                if any(x in target for x in ['AuthenticatedLayout', 'Base.tsx', 'finance/page.tsx', 'procurement/page.tsx', 'sales/page.tsx']):
                    print(f"--- Index {i} Step {obj.get('step_index')}: {name} to {os.path.basename(target)} ---")
                    if name == 'replace_file_content':
                        print(f"Target: {args.get('TargetContent')}\nReplacement: {args.get('ReplacementContent')}")
                    elif name == 'multi_replace_file_content':
                        for chunk in args.get('ReplacementChunks', []):
                            print(f"Chunk Target: {chunk.get('TargetContent')}\nChunk Replacement: {chunk.get('ReplacementContent')}")
                    elif name == 'write_to_file':
                        print(f"Content length: {len(args.get('CodeContent', ''))}")
                    print("\n" + "="*50 + "\n")
