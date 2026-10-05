import os
import re

files = [
    r"d:\NEXUS-ERP\src\app\(authenticated)\sales\page.tsx",
    r"d:\NEXUS-ERP\src\app\(authenticated)\hr\page.tsx",
    r"d:\NEXUS-ERP\src\app\(authenticated)\inventory\page.tsx",
    r"d:\NEXUS-ERP\src\app\(authenticated)\procurement\page.tsx",
    r"d:\NEXUS-ERP\src\app\(authenticated)\finance\page.tsx",
    r"d:\NEXUS-ERP\src\app\(authenticated)\projects\page.tsx",
]

for filepath in files:
    if not os.path.exists(filepath):
        continue
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Standardize the metric chips min-width to min-w-[140px]
    content = re.sub(r'min-w-\[\d+px\]', 'min-w-[140px]', content)
    
    # Fix inventory missing shrink-0
    content = content.replace(
        '<header className="p-6 border-b border-white/5 flex flex-col xl:flex-row xl:items-center justify-between gap-5 bg-black/20">',
        '<header className="p-6 border-b border-white/5 flex flex-col xl:flex-row xl:items-center justify-between gap-5 bg-black/20 shrink-0">'
    )

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

print("Standardized header and metric chips successfully.")
