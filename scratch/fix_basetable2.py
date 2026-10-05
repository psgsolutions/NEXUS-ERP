import sys
import re

file_path = r'd:\NEXUS-ERP\src\components\ui\Base.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove terms from isRightAligned
content = re.sub(
    r'(\s*header\.includes\("รวม"\))\s*\|\|\s*header\.includes\("รหัส"\)\s*\|\|\s*lowerHeader\.includes\("sku"\)\s*\|\|\s*lowerHeader\.includes\("code"\);',
    r'\1;',
    content
)

# 2. Add terms to isCenterAligned
content = re.sub(
    r'(lowerHeader\.includes\("action"\))\s*\);',
    r'\1 ||\n                  header.includes("รหัส") ||\n                  header.includes("เลขที่") ||\n                  header.includes("ไอดี") ||\n                  lowerHeader.includes("sku") ||\n                  lowerHeader.includes("code")\n                  );',
    content
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Success")
