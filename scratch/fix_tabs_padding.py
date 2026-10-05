import os
import re

files_replacements = {
    r"d:\NEXUS-ERP\src\app\(authenticated)\finance\page.tsx": [
        ('className="flex overflow-x-auto custom-scrollbar gap-2 pb-2 pt-6 px-6"', 
         'className="flex overflow-x-auto custom-scrollbar gap-2 px-6 py-4 border-b border-white/5 bg-black/10 shrink-0"')
    ],
    r"d:\NEXUS-ERP\src\app\(authenticated)\procurement\page.tsx": [
        ('className="flex overflow-x-auto custom-scrollbar gap-2 pb-2 pt-6 px-6"', 
         'className="flex overflow-x-auto custom-scrollbar gap-2 px-6 py-4 border-b border-white/5 bg-black/10 shrink-0"')
    ],
    r"d:\NEXUS-ERP\src\app\(authenticated)\hr\page.tsx": [
        ('className="flex items-center gap-2 overflow-x-auto custom-scrollbar p-6 pb-2"', 
         'className="flex items-center gap-2 overflow-x-auto custom-scrollbar px-6 py-4 border-b border-white/5 bg-black/10 shrink-0"')
    ],
    r"d:\NEXUS-ERP\src\app\(authenticated)\sales\page.tsx": [
        ('className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-4 mt-6"', 
         'className="flex items-center gap-2 overflow-x-auto custom-scrollbar px-6 py-4 border-b border-white/5 bg-black/10 shrink-0"')
    ]
}

for filepath, replacements in files_replacements.items():
    if not os.path.exists(filepath):
        continue
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    for old_str, new_str in replacements:
        content = content.replace(old_str, new_str)
        
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

print("Standardized tab container padding successfully.")
