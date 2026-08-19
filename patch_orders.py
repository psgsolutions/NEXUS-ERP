import re

files = [
    r"d:\NEXUS-ERP\src\app\(authenticated)\sales\orders\new\page.tsx",
    r"d:\NEXUS-ERP\src\app\(authenticated)\sales\orders\[id]\page.tsx"
]

for file_path in files:
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Change "ใบเสนอราคา (Quotation)" to "ใบสั่งขาย (Sales Order)"
    content = content.replace("ใบเสนอราคา (Quotation)", "ใบสั่งขาย (Sales Order)")
    content = content.replace("NewQuotationPage", "SalesOrderPage")

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)

print("Patched orders")
