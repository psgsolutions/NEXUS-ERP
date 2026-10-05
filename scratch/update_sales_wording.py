import os

filepath = r"d:\NEXUS-ERP\src\app\(authenticated)\sales\page.tsx"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

replacements = [
    # Top header
    ('ทะเบียนลูกค้าและการขาย', 'ระบบบริหารงานขายและลูกค้าสัมพันธ์'),
    
    # Tabs mapping (used in both tabs and salesFlowSteps arrays, so this will catch both)
    ('{ id: "quotations", label: "ใบเสนอราคา"', '{ id: "quotations", label: "ใบเสนอราคา (Quotations)"'),
    ('{ id: "orders", label: "ใบสั่งขาย"', '{ id: "orders", label: "ใบสั่งขาย (Sales Orders)"'),
    ('{ id: "invoices", label: "ใบแจ้งหนี้"', '{ id: "invoices", label: "ใบแจ้งหนี้ (Invoices)"'),
    ('{ id: "billing", label: "ใบวางบิล"', '{ id: "billing", label: "ใบวางบิล (Billing Notes)"'),
    ('{ id: "receipts", label: "ใบเสร็จรับเงิน"', '{ id: "receipts", label: "ใบเสร็จรับเงิน (Receipts)"'),
    ('{ id: "cndn", label: "ใบลดหนี้/เพิ่มหนี้"', '{ id: "cndn", label: "ใบลดหนี้ / เพิ่มหนี้ (CN/DN)"'),
    ('{ id: "crm", label: "ข้อมูลลูกค้า"', '{ id: "crm", label: "ฐานข้อมูลลูกค้า (Customer CRM)"'),
    ('{ id: "opportunities", label: "โอกาสการขาย"', '{ id: "opportunities", label: "ติดตามงานขาย (Sales Pipeline)"'),
    
    # activeTab logic names
    ('{activeTab === "crm" && "ข้อมูลลูกค้า"}', '{activeTab === "crm" && "ฐานข้อมูลลูกค้า (Customer CRM)"}'),
    ('{activeTab === "opportunities" && "โอกาสการขาย"}', '{activeTab === "opportunities" && "ติดตามงานขาย (Sales Pipeline)"}')
]

for old, new in replacements:
    content = content.replace(old, new)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
print("Updated sales page text successfully.")
