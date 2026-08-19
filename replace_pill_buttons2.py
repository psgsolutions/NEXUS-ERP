import os
import re

base_dir = r'd:\NEXUS-ERP\src\app\(authenticated)'
modified_files = 0
for root, _, files in os.walk(base_dir):
    for file in files:
        if file.endswith('.tsx'):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            new_content = content
            
            # Find PillButtons that have shadow-neon classes and lack variant="glass"
            # Since JSX can have > inside the props (e.g. arrow functions), we use a non-greedy match.
            def replace_pill_button(match):
                full_tag = match.group(0)
                if 'shadow-neon' in full_tag and 'variant="glass"' not in full_tag:
                    full_tag = re.sub(r'\s*shadow-neon-[a-z]+', '', full_tag)
                    full_tag = full_tag.replace('<PillButton', '<PillButton variant="glass"')
                return full_tag

            # This regex looks for <PillButton followed by any characters until the first > that is preceded by a quote, 
            # but that's complex. Let's just do a simpler search/replace for className="... shadow-neon-..."
            
            lines = new_content.split('\n')
            for i, line in enumerate(lines):
                if '<PillButton' in line and 'shadow-neon' in line and 'variant="glass"' not in line:
                    line = re.sub(r'\s*shadow-neon-[a-z]+', '', line)
                    line = line.replace('<PillButton', '<PillButton variant="glass"')
                    lines[i] = line
                    
            new_content = '\n'.join(lines)
            
            if new_content != content:
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                modified_files += 1
                print(f'Modified: {path}')

print(f'Done. Modified {modified_files} files.')
