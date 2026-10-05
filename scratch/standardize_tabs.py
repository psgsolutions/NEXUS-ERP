import os, glob, re

paths = glob.glob(r'd:\NEXUS-ERP\src\app\(authenticated)\**\page.tsx', recursive=True)

standard_class = "px-6 py-3 bg-black/10 border-b border-white/5 flex flex-col xl:flex-row xl:items-center justify-between gap-4 shrink-0 min-h-[64px]"

for p in paths:
    with open(p, "r", encoding="utf-8") as f:
        content = f.read()

    # Find the section that contains PillTabs
    # Usually it looks like: <section className="...">\n  <PillTabs
    
    # We will use regex to find <section className="ANYTHING">\s*(?:{/\*.*?\*/}\s*)?<PillTabs
    # and replace the className with standard_class
    
    def replacer(match):
        return match.group(0).replace(match.group(1), standard_class)

    new_content = re.sub(r'<section className="([^"]+)">\s*(?:{/\*.*?\*/}\s*)?<PillTabs', replacer, content)

    if new_content != content:
        with open(p, "w", encoding="utf-8") as f:
            f.write(new_content)
        print(f"Updated {p}")
