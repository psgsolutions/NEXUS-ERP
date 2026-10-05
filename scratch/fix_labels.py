import re

def process_file(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Left align inputs (remove text-center from text inputs)
    content = content.replace('transition-all text-center"', 'transition-all text-left px-4"')

    # 2. Remove English from labels
    content = content.replace('วันที่ออกเอกสาร (Issue Date)', 'วันที่ออกเอกสาร')
    content = content.replace('เงื่อนไขการชำระเงิน (Payment Terms)', 'เงื่อนไขการชำระเงิน')
    content = content.replace('วันครบกำหนด (Due Date)', 'วันครบกำหนด')
    content = content.replace('อ้างอิงเอกสาร (Reference)', 'อ้างอิงเอกสาร')
    
    content = content.replace('โอกาสการขาย (Probability %)', 'โอกาสการขาย')
    content = content.replace('คาดว่าปิดจบ (Expected Close)', 'คาดว่าปิดจบ')
    content = content.replace('ชื่อโปรเจกต์ (Project Name)', 'ชื่อโปรเจกต์')
    content = content.replace('แหล่งที่มา (Lead Source)', 'แหล่งที่มา')
    
    content = content.replace('เงื่อนไขการจัดส่ง (Delivery Terms)', 'เงื่อนไขการจัดส่ง')
    content = content.replace('สถานที่จัดส่ง (Shipping Location)', 'สถานที่จัดส่ง')
    
    content = content.replace('รายละเอียดเอกสาร (Document Details)', 'รายละเอียดเอกสาร')
    content = content.replace('รายละเอียดการขาย (CRM & Logistics)', 'รายละเอียดการขาย')
    content = content.replace('หมายเหตุภายใน (Internal Notes)', 'หมายเหตุภายใน')
    content = content.replace('เงื่อนไขท้ายเอกสาร (Remarks)', 'เงื่อนไขท้ายเอกสาร')
    
    content = content.replace('รูปแบบภาษี (Tax Display Mode)', 'รูปแบบภาษี')
    content = content.replace('หัก ณ ที่จ่าย (WHT)', 'หัก ณ ที่จ่าย')
    
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(content)

process_file('src/app/(authenticated)/sales/quotations/new/page.tsx')
print("Fixed labels and alignment")
