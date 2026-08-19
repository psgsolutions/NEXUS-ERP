filepath = r"d:\NEXUS-ERP\src\app\(authenticated)\inventory\[id]\page.tsx"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("</main>", "</div>")

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
