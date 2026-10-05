import sys
import re

file_path = r'd:\NEXUS-ERP\src\components\ui\Base.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Normalize line endings to avoid matching issues
content = content.replace('\r\n', '\n')

target = """                  header.includes("ยอด") ||
                  header.includes("รวม") ||
                  header.includes("รหัส") ||
                  lowerHeader.includes("sku") ||
                  lowerHeader.includes("code");"""

replacement = """                  header.includes("ยอด") ||
                  header.includes("รวม");"""

target2 = """                const isCenterAligned = 
                  !isRightAligned && (
                  header.includes("สถานะ") || 
                  header.includes("วันที่") || 
                  header.includes("ประเภท") || 
                  header.includes("การกระทำ") || 
                  header.includes("แอคชั่น") || 
                  lowerHeader.includes("status") || 
                  lowerHeader.includes("date") || 
                  lowerHeader.includes("type") || 
                  lowerHeader.includes("action")
                  );"""

replacement2 = """                const isCenterAligned = 
                  !isRightAligned && (
                  header.includes("สถานะ") || 
                  header.includes("วันที่") || 
                  header.includes("ประเภท") || 
                  header.includes("การกระทำ") || 
                  header.includes("แอคชั่น") || 
                  header.includes("รหัส") || 
                  header.includes("เลขที่") || 
                  header.includes("ไอดี") || 
                  lowerHeader.includes("status") || 
                  lowerHeader.includes("date") || 
                  lowerHeader.includes("type") || 
                  lowerHeader.includes("action") || 
                  lowerHeader.includes("sku") || 
                  lowerHeader.includes("code")
                  );"""

if target in content and target2 in content:
    content = content.replace(target, replacement)
    content = content.replace(target2, replacement2)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Success")
else:
    print("Target not found")
    if target not in content:
        print("Target 1 not found")
    if target2 not in content:
        print("Target 2 not found")
