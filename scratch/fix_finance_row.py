import sys

file_path = r'd:\NEXUS-ERP\src\app\(authenticated)\finance\page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix header
content = content.replace('"รหัสสินทรัพย์", "หมวดหมู่"', '"รหัสสินทรัพย์", "ชื่อสินทรัพย์", "หมวดหมู่"')

# Fix AssetRow
old_row = """function AssetRow({ id, name, cat, purchase, bookValue, status }: { id: string, name: string, cat: string, purchase: 
string, bookValue: string, status: any }) {
    return (
      <NexusTableRow>
        <NexusTableCell className="w-[1%] whitespace-nowrap align-middle text-center">
           <p className="font-mono text-xs text-warning font-medium tracking-tighter text-center w-full">{id}</p>
        </NexusTableCell>
        <NexusTableCell className="w-full font-bold text-white/80">{name}"""

new_row = """function AssetRow({ id, name, cat, purchase, bookValue, status }: { id: string, name: string, cat: string, purchase: string, bookValue: string, status: any }) {
    return (
      <NexusTableRow>
        <NexusTableCell className="w-[1%] whitespace-nowrap text-center align-middle">
             <span className="font-mono text-[13px] text-warning font-medium tracking-tighter">{id}</span>
        </NexusTableCell>
        <NexusTableCell className="w-full">
             <span className="font-bold text-white/80 group-hover:text-white transition-colors">{name}</span>
        </NexusTableCell>"""

content = content.replace(old_row, new_row)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Success')
