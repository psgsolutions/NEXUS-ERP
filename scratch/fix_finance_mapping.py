import sys
import re

file_path = r'd:\NEXUS-ERP\src\app\(authenticated)\finance\page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix mapping in finance page
content = content.replace(
    'id: f.id || f.journalId || "JV-UNKNOWN",',
    'id: f.journalNo || f.documentNo || f.journalId || f.id || "JV-UNKNOWN",'
)
content = content.replace(
    'inv: ar.invoiceId || ar.id || "-",',
    'inv: ar.invoiceNo || ar.documentNo || ar.invoiceId || ar.id || "-",'
)
content = content.replace(
    'po: ap.poId || ap.id || "-",',
    'po: ap.poNo || ap.documentNo || ap.poId || ap.id || "-",'
)
content = content.replace(
    'id: a.id || "AST-UNKNOWN",',
    'id: a.assetCode || a.assetNo || a.code || a.id || "AST-UNKNOWN",'
)
content = content.replace(
    'id: b.id || "BNK-UNKNOWN",',
    'id: b.bankCode || b.bankId || b.code || b.id || "BNK-UNKNOWN",'
)
content = content.replace(
    'id: c.id || "CHQ-UNKNOWN",',
    'id: c.chequeCode || c.code || c.id || "CHQ-UNKNOWN",'
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Success')
