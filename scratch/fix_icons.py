import os
import re

files_to_fix = [
    ('src/app/(authenticated)/hr/employees/[employeeId]/page.tsx', 'ArrowLeft'),
    ('src/app/(authenticated)/inventory/[id]/page.tsx', 'ArrowLeft'),
    ('src/app/(authenticated)/inventory/serials/[id]/page.tsx', 'ArrowLeft'),
    ('src/app/(authenticated)/logs/[id]/page.tsx', 'ArrowLeft'),
    ('src/app/(authenticated)/sales/quotations/new/page.tsx', 'Share2'),
    ('src/app/(authenticated)/service/work-orders/new/page.tsx', 'ArrowLeft'),
]

for filepath, icon in files_to_fix:
    with open(filepath, 'r', encoding='utf-8') as f:
        c = f.read()
    
    # find lucide-react import
    m = re.search(r'import\s*\{([\s\S]*?)\}\s*from\s*[\'"]lucide-react[\'"]', c)
    if m:
        imported_icons = m.group(1)
        if icon not in imported_icons:
            new_imported_icons = f"\n  {icon}," + imported_icons
            c = c.replace(m.group(0), f"import {{{new_imported_icons}}} from 'lucide-react'", 1)
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(c)
            print(f"Added {icon} to {filepath}")
        else:
            print(f"{icon} already present in {filepath}")
    else:
        print(f"lucide-react import not found in {filepath}")

print("All icon fixes completed.")
