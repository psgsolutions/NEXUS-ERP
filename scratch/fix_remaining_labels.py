import re

def process_file(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()

    # Remove English brackets from labels
    content = content.replace('ที่อยู่ (Address)', 'ที่อยู่')
    content = content.replace('เลขประจำตัวผู้เสียภาษี (Tax ID)', 'เลขประจำตัวผู้เสียภาษี')
    content = content.replace('เงื่อนไขการส่ง (IncoTerms)', 'เงื่อนไขการส่ง')
    content = content.replace('เวลาจัดส่ง (Delivery Days)', 'เวลาจัดส่ง')
    content = content.replace('สถานที่จัดส่ง (Shipping Address)', 'สถานที่จัดส่ง')
    content = content.replace('เงื่อนไขการชำระเงิน (Payment Terms)', 'เงื่อนไขการชำระเงิน')
    content = content.replace('อ้างอิงเอกสาร (Reference)', 'อ้างอิงเอกสาร')
    
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(content)

process_file('src/app/(authenticated)/sales/quotations/new/page.tsx')
print("Fixed remaining English brackets in labels")
