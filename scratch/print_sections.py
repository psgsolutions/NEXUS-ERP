import os, glob, re

paths = glob.glob(r'd:\NEXUS-ERP\src\app\(authenticated)\**\page.tsx', recursive=True)
for p in paths:
    with open(p, encoding='utf-8') as f:
        content = f.read()
    if '<PillTabs' in content:
        match = re.search(r'<section className=(.+?)>\s*<PillTabs', content, re.DOTALL)
        if match:
            print(f"{os.path.basename(os.path.dirname(p))}: {match.group(1)}")
