import re
filepath = r"d:\NEXUS-ERP\src\app\(authenticated)\dashboard\page.tsx"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Replace JSX comments with JS comments if they are at the top level
# Specifically, we know they look like {/* --- HELPER COMPONENTS --- */}
content = re.sub(r'\{\/\*([^\}]+)\*\/\}', r'/*\1*/', content)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
