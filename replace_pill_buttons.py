import os
import re

base_dir = r'd:\NEXUS-ERP\src\app\(authenticated)'
modified_files = 0
for root, _, files in os.walk(base_dir):
    for file in files:
        if file.endswith('page.tsx'):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            new_content = content
            
            def replace_pill_button(match):
                full_tag = match.group(0)
                if 'shadow-neon' in full_tag and 'variant="glass"' not in full_tag:
                    full_tag = re.sub(r'\s*shadow-neon-[a-z]+', '', full_tag)
                    full_tag = full_tag.replace('<PillButton', '<PillButton variant="glass"')
                return full_tag

            new_content = re.sub(r'<PillButton[^>]+>', replace_pill_button, new_content)
            
            if new_content != content:
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                modified_files += 1
                print(f'Modified: {path}')

print(f'Done. Modified {modified_files} files.')
