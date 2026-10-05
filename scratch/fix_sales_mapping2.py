import sys
import re

file_path = r'd:\NEXUS-ERP\src\app\(authenticated)\sales\page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Billing
content = re.sub(
    r'(setBillingList\([\s\S]*?|)id:\s*doc\.id,\s*customerNameRaw:\s*d\.customer\s*\|\|\s*d\.customerId\s*\|\|\s*"Unknown",\s*date:\s*d\.issueDate\s*\?\s*new\s+Date\(d\.issueDate\.seconds\s*\*\s*1000\)\.toISOString\(\)\.split\(\'T\'\)\[0\]\s*:\s*new\s*Date\(\)\.toISOString\(\)\.split\(\'T\'\)\[0\],\s*dueDate:',
    r'\1id: d.documentNo || d.billingNo || doc.id,\n            customerNameRaw: d.customer || d.customerId || "Unknown",\n            date: d.issueDate ? new Date(d.issueDate.seconds * 1000).toISOString().split(\'T\')[0] : new \nDate().toISOString().split(\'T\')[0],\n            dueDate:',
    content
)

# CNDN
content = re.sub(
    r'(setCndnList\([\s\S]*?|)id:\s*doc\.id,\s*customerNameRaw:\s*d\.customer\s*\|\|\s*d\.customerId\s*\|\|\s*"Unknown",\s*date:\s*d\.issueDate\s*\?\s*new\s+Date\(d\.issueDate\.seconds\s*\*\s*1000\)\.toISOString\(\)\.split\(\'T\'\)\[0\]\s*:\s*new\s*Date\(\)\.toISOString\(\)\.split\(\'T\'\)\[0\],\s*total:',
    r'\1id: d.documentNo || d.cndnNo || doc.id,\n            customerNameRaw: d.customer || d.customerId || "Unknown",\n            date: d.issueDate ? new Date(d.issueDate.seconds * 1000).toISOString().split(\'T\')[0] : new \nDate().toISOString().split(\'T\')[0],\n            total:',
    content
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Success')
