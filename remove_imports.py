import re

with open(r"d:\NEXUS-ERP\src\app\(authenticated)\sales\page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

content = re.sub(r'import\s+\{[^}]*?(CustomerModal|QuotationModal|SalesOrderModal|BillingNoteModal|CNDNModal)[^}]*?\}\s+from\s+[\'"].*?[\'"];?\n?', '', content)

with open(r"d:\NEXUS-ERP\src\app\(authenticated)\sales\page.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("Removed imports")
