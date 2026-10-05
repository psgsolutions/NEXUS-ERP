import os, glob

paths = glob.glob(r'd:\NEXUS-ERP\src\app\(authenticated)\**\page.tsx', recursive=True)

old_class = "px-6 py-3 bg-black/10 border-b border-white/5 flex flex-wrap items-center justify-between gap-4 shrink-0 min-h-[64px]"
new_class = "px-6 h-[52px] bg-black/10 border-b border-white/5 flex items-center justify-center shrink-0 relative"
# Wait, if we use justify-center, the right side buttons will also be centered!
# Let's use justify-between, but make PillTabs center.
# Actually, if we want it centered, let's change the section class to:
# "px-6 h-[56px] bg-black/10 border-b border-white/5 flex items-center justify-between shrink-0"

new_class = "px-6 h-[56px] bg-black/10 border-b border-white/5 flex items-center justify-between shrink-0"

for p in paths:
    with open(p, "r", encoding="utf-8") as f:
        content = f.read()

    if old_class in content:
        content = content.replace(old_class, new_class)
        with open(p, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Updated {p}")
