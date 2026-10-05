import json
import re
import sys

transcript_path = r'C:\Users\nanon\.gemini\antigravity-ide\brain\58d066b2-02cd-4410-8ef4-0260d66f3fd0\.system_generated\logs\transcript_full.jsonl'

best_content = ""
max_lines = 0

with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            data = json.loads(line)
        except:
            continue
        
        # Check tool responses
        if 'tool_responses' in data:
            for resp in data['tool_responses']:
                if 'output' in resp:
                    output = resp['output']
                    if 'File Path: `file:///d:/NEXUS-ERP/src/app/%28authenticated%29/inventory/products/new/page.tsx`' in output:
                        lines = output.split('\n')
                        file_lines = []
                        is_code = False
                        for l in lines:
                            if l.startswith('The following code has been modified'):
                                is_code = True
                                continue
                            if l.startswith('The above content does NOT show'):
                                is_code = False
                                continue
                            if is_code:
                                match = re.match(r'^\d+:\s(.*)$', l)
                                if match:
                                    file_lines.append(match.group(1))
                                else:
                                    if re.match(r'^\d+:$', l):
                                        file_lines.append("")
                        
                        if len(file_lines) > max_lines:
                            max_lines = len(file_lines)
                            best_content = '\n'.join(file_lines)

print(f"Found {max_lines} lines!")
if max_lines > 0:
    with open('d:/NEXUS-ERP/recovered_page.tsx', 'w', encoding='utf-8') as f:
        f.write(best_content)
