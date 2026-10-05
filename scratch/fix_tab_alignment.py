import os, glob

paths = glob.glob(r'd:\NEXUS-ERP\src\app\(authenticated)\**\page.tsx', recursive=True)

old_class = "px-6 py-3 bg-black/10 border-b border-white/5 flex flex-col xl:flex-row xl:items-center justify-between gap-4 shrink-0 min-h-[64px]"
new_class = "px-6 py-3 bg-black/10 border-b border-white/5 flex flex-wrap items-center justify-between gap-4 shrink-0 min-h-[64px]"

for p in paths:
    with open(p, "r", encoding="utf-8") as f:
        content = f.read()

    if old_class in content:
        content = content.replace(old_class, new_class)
        with open(p, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Updated {p}")
