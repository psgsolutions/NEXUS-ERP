import re

def process_file(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()

    # Remove English brackets from labels in DocumentItemsTable
    content = content.replace('รายละเอียดสินค้าเพิ่มเติม (Specifications)', 'รายละเอียดสินค้าเพิ่มเติม')
    content = content.replace('ลิงก์เอกสารอ้างอิง (Datasheet URL)', 'ลิงก์เอกสารอ้างอิง')
    content = content.replace('ข้อมูลเชิงลึก (Sales Insights)', 'ข้อมูลเชิงลึก')
    
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(content)

process_file('src/components/commerce/DocumentItemsTable.tsx')
print("Fixed remaining English brackets in DocumentItemsTable labels")
