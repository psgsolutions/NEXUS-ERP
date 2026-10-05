import json

transcript = r'C:\Users\nanon\.gemini\antigravity-ide\brain\bf73291d-d1d2-466a-8c04-11e600c6e68b\.system_generated\logs\transcript_full.jsonl'
output_file = 'd:/NEXUS-ERP/recovered_from_metadata.tsx'

found_content = ""
max_lines = 0

with open(transcript, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            data = json.loads(line)
        except:
            continue
        
        if data.get('type') == 'USER_INPUT':
            content = data.get('content', '')
            if 'Active Document: d:\\NEXUS-ERP\\src\\app\\(authenticated)\\inventory\\products\\new\\page.tsx' in content:
                # Extract the file content from the metadata block
                # The format is usually:
                # Active Document: ... (LANGUAGE_TYPESCRIPT)
                # ```typescript
                # [content]
                # ```
                start_str = '```typescript\n'
                end_str = '\n```\n'
                
                parts = content.split(start_str)
                if len(parts) > 1:
                    for i in range(1, len(parts)):
                        file_body = parts[i].split(end_str)[0]
                        lines = file_body.split('\n')
                        if len(lines) > max_lines:
                            max_lines = len(lines)
                            found_content = file_body

if max_lines > 0:
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(found_content)
    print(f"Found and extracted {max_lines} lines!")
else:
    print("No active document content found.")
