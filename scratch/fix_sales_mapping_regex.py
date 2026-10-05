import sys
import re

file_path = r'd:\NEXUS-ERP\src\app\(authenticated)\sales\page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Quotes
content = re.sub(
    r'id:\s*doc\.id,\s*customerNameRaw:\s*d\.customerId\s*\|\|\s*d\.customer\s*\|\|\s*"Hospital A"',
    r'id: d.documentNo || d.quoteNo || d.quotationNo || doc.id,\n            customerNameRaw: d.customerId || d.customer || "Hospital A"',
    content
)

# Orders
content = re.sub(
    r'id:\s*doc\.id,\s*customerNameRaw:\s*d\.customer\s*\|\|\s*d\.customerId\s*\|\|\s*"PSG Solutions"',
    r'id: d.documentNo || d.soNo || d.orderNo || doc.id,\n            customerNameRaw: d.customer || d.customerId || "PSG Solutions"',
    content
)

# Invoices
content = re.sub(
    r'(setInvoicesList.*?|)id:\s*doc\.id,\s*customerNameRaw:\s*d\.customer\s*\|\|\s*d\.customerId\s*\|\|\s*"Unknown",\s*date:\s*d\.issuedAt',
    r'\1id: d.documentNo || d.invoiceNo || d.invNo || doc.id,\n            customerNameRaw: d.customer || d.customerId || "Unknown",\n            date: d.issuedAt',
    content
)

# Receipts
content = re.sub(
    r'(setReceiptsList.*?|)id:\s*doc\.id,\s*customerNameRaw:\s*d\.customer\s*\|\|\s*d\.customerId\s*\|\|\s*"Unknown",\s*date:\s*d\.paymentDate',
    r'\1id: d.documentNo || d.receiptNo || doc.id,\n            customerNameRaw: d.customer || d.customerId || "Unknown",\n            date: d.paymentDate',
    content
)

# Billing
content = re.sub(
    r'(setBillingList.*?|)id:\s*doc\.id,\s*customerNameRaw:\s*d\.customer\s*\|\|\s*d\.customerId\s*\|\|\s*"Unknown",\s*date:\s*d\.issueDate\s*\?\s*new Date\(d\.issueDate\.seconds \* 1000\)\.toISOString\(\)\.split\(\'T\'\)\[0\] : new \nDate\(\)\.toISOString\(\)\.split\(\'T\'\)\[0\],\n\s*dueDate',
    r'\1id: d.documentNo || d.billingNo || doc.id,\n            customerNameRaw: d.customer || d.customerId || "Unknown",\n            date: d.issueDate ? new Date(d.issueDate.seconds * 1000).toISOString().split(\'T\')[0] : new \nDate().toISOString().split(\'T\')[0],\n            dueDate',
    content
)

# CNDN
content = re.sub(
    r'(setCndnList.*?|)id:\s*doc\.id,\s*customerNameRaw:\s*d\.customer\s*\|\|\s*d\.customerId\s*\|\|\s*"Unknown",\s*date:\s*d\.issueDate\s*\?\s*new Date\(d\.issueDate\.seconds \* 1000\)\.toISOString\(\)\.split\(\'T\'\)\[0\] : new \nDate\(\)\.toISOString\(\)\.split\(\'T\'\)\[0\],\n\s*total',
    r'\1id: d.documentNo || d.cndnNo || doc.id,\n            customerNameRaw: d.customer || d.customerId || "Unknown",\n            date: d.issueDate ? new Date(d.issueDate.seconds * 1000).toISOString().split(\'T\')[0] : new \nDate().toISOString().split(\'T\')[0],\n            total',
    content
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Success')
