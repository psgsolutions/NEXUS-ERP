import os
import re

file_path = r"d:\NEXUS-ERP\src\components\commerce\DocumentItemsTable.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace h-9 with h-8 for the inline row inputs.
content = content.replace("h-9", "h-8")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Updated h-9 to h-8")
