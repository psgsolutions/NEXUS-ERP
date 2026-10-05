import sys

file_path = r'd:\NEXUS-ERP\src\app\(authenticated)\sales\page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace all occurrences of id: doc.id in the mapping with more robust fallbacks
content = content.replace(
    'id: doc.id, \n            customerNameRaw: d.customerId || d.customer || "Hospital A",',
    'id: d.documentNo || d.quoteNo || d.quotationNo || doc.id, \n            customerNameRaw: d.customerId || d.customer || "Hospital A",'
)

content = content.replace(
    'id: doc.id, \n            customerNameRaw: d.customer || d.customerId || "PSG Solutions",',
    'id: d.documentNo || d.soNo || d.orderNo || doc.id, \n            customerNameRaw: d.customer || d.customerId || "PSG Solutions",'
)

content = content.replace(
    'id: doc.id, \n            customerNameRaw: d.customer || d.customerId || "Unknown",',
    'id: d.documentNo || d.invoiceNo || d.receiptNo || d.billingNo || d.cndnNo || doc.id, \n            customerNameRaw: d.customer || d.customerId || "Unknown",'
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Success')
