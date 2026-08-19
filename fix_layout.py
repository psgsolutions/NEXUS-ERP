import glob
import re

files = [
    'src/app/(authenticated)/sales/page.tsx',
    'src/app/(authenticated)/finance/page.tsx',
    'src/app/(authenticated)/hr/page.tsx',
    'src/app/(authenticated)/procurement/page.tsx',
    'src/app/(authenticated)/inventory/page.tsx',
    'src/app/(authenticated)/support/page.tsx'
]

for file in files:
    try:
        with open(file, 'r', encoding='utf-8') as f:
            c = f.read()

        changed = False

        if '<header className=\"p-6 ' in c:
            c = c.replace('<header className=\"p-6 ', '<header className=\"px-6 py-3 ')
            changed = True

        tab_section_pattern = r'<section className=\"px-6 py-4 bg-black/10 border-b border-white/5 shrink-0\">'
        if re.search(tab_section_pattern, c):
            c = re.sub(tab_section_pattern, '<section className=\"px-6 bg-black/10 border-b border-white/5 shrink-0 flex items-center justify-between\">', c)
            changed = True

        # Now extract <div className="flex gap-3">
        # Regex to find: <div className="flex items-center justify-between">\s*<div className="flex items-center gap-4">.*?</p>\s*<h2.*?>.*?</h2>\s*</div>\s*<div className="flex gap-3">
        match = re.search(r'(<div className=\"flex items-center justify-between\">\s*<div className=\"flex items-center gap-4\">.*?</p>\s*<h2.*?>.*?</h2>\s*</div>\s*)(<div className=\"flex gap-3\">)', c, flags=re.DOTALL)
        if match:
            start_idx = match.start(2)
            
            # Find the closing </div> of <div className="flex gap-3">
            depth = 0
            end_idx = -1
            i = start_idx
            while i < len(c):
                if c.startswith('<div', i):
                    depth += 1
                elif c.startswith('</div', i):
                    depth -= 1
                    if depth == 0:
                        end_idx = i + 6
                        break
                i += 1
                
            if end_idx != -1:
                btn_code = c[start_idx:end_idx]
                # Remove it from original position
                c = c[:start_idx] + c[end_idx:]
                
                # Insert it after <PillTabs ... />
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
