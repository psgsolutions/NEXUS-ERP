import os
import glob
import re

files = glob.glob('src/app/(authenticated)/**/*.tsx', recursive=True)
for file in files:
    try:
        with open(file, 'r', encoding='utf-8') as f:
            c = f.read()

        changed = False

        if '<header className=\"p-6 ' in c:
            c = c.replace('<header className=\"p-6 ', '<header className=\"px-6 py-3 ')
            changed = True
        
        tab_section_pattern = r'<section className=\"px-6 py-4([^>]*?shrink-0)\">'
        if re.search(tab_section_pattern, c):
            c = re.sub(tab_section_pattern, r'<section className=\"px-6 py-2\1 flex items-center justify-between\">', c)
            changed = True

        match = re.search(r'<div className=\"flex items-center justify-between\">\s*<div className=\"flex items-center gap-4\">', c)
        if match:
            btn_match = re.search(r'(<div className=\"flex gap-3\">.*?</div>)\s*(?=</div>)', c[match.end():], flags=re.DOTALL)
            if btn_match:
                btn_code = btn_match.group(1)
                # Count opening and closing divs to ensure we capture the whole block correctly
                # But since it's simple, let's assume it ends at the first </div> that balances it
                # A robust extraction:
                s = c[match.end():]
                div_start = s.find('<div className=\"flex gap-3\">')
                if div_start != -1:
                    depth = 0
                    div_end = -1
                    i = div_start
                    while i < len(s):
                        if s.startswith('<div', i):
                            depth += 1
                        elif s.startswith('</div', i):
                            depth -= 1
                            if depth == 0:
                                div_end = i + 6
                                break
                        i += 1
                    
                    if div_end != -1:
                        btn_code = s[div_start:div_end]
                        if 'PillButton' in btn_code or '<button' in btn_code or 'PillSelect' in btn_code or 'Searchable' in btn_code or 'Select' in btn_code:
                            c = c[:match.end() + div_start] + c[match.end() + div_end:]
                            pilltabs_match = re.search(r'<PillTabs.*?\/>', c, flags=re.DOTALL)
                            if pilltabs_match:
                                insert_pos = pilltabs_match.end()
                                c = c[:insert_pos] + '\n        ' + btn_code + c[insert_pos:]
                                changed = True

        if changed:
            with open(file, 'w', encoding='utf-8') as f:
                f.write(c)
            print(f'Updated {file}')
    except Exception as e:
        print(f'Error processing {file}: {e}')
