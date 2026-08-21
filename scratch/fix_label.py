filepath = 'd:/NEXUS-ERP/src/app/(authenticated)/procurement/requests/new/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Replace it
lines[182] = '            <Field label="วันที่ต้องการใช้งาน *" required>\n'

with open(filepath, 'w', encoding='utf-8') as f:
    f.writelines(lines)
