import re

files = [
    r"d:\NEXUS-ERP\src\app\(authenticated)\sales\customers\new\page.tsx",
    r"d:\NEXUS-ERP\src\app\(authenticated)\sales\customers\[id]\page.tsx"
]

for file_path in files:
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Change "ใบเสนอราคา (Quotation)" to "ข้อมูลลูกค้า (Customer Profile)"
    content = content.replace("ใบเสนอราคา (Quotation)", "ข้อมูลลูกค้า (Customer Profile)")
    content = content.replace("NewQuotationPage", "CustomerPage")

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)

print("Patched customers")
