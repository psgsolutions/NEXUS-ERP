import os
import re

directory = r"d:\NEXUS-ERP\src\app\(authenticated)"

files_to_check = []
for root, _, files in os.walk(directory):
    for f in files:
        if f.endswith("page.tsx"):
            files_to_check.append(os.path.join(root, f))

for file_path in files_to_check:
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    original_content = content

    # 1. Add h-[36px] to any div that has border-b border-white/5 pb-4 and wraps an h3
    # We look for <div className="... pb-4"> followed by <h3 ...>
    content = re.sub(
        r'(<div\s+className="[^"]*flex[^"]*items-center[^"]*border-b[^"]*border-white/5[^"]*pb-4)(">)(\s*<h3)',
        r'\1 h-[36px]\2\3',
        content
    )

    # 2. Fix the Profit Rainbow Indicator padding if it exists
    content = content.replace(
        '"px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest flex items-center gap-2"',
        '"px-2 py-0 rounded-full border text-[10px] font-black uppercase tracking-widest flex items-center gap-1"'
    )

    # 3. Fix Button Colors
    content = re.sub(
        r'bg-nexus-teal(?!\/)\s+text-white',
        r'bg-nexus-teal/10 text-nexus-teal border border-nexus-teal/20 hover:bg-nexus-teal/20',
        content
    )
    content = re.sub(
        r'bg-warning(?!\/)\s+text-white',
        r'bg-warning/10 text-warning border border-warning/20 hover:bg-warning/20',
        content
    )

    if content != original_content:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Updated {file_path}")

print("Done.")
