import sys

file_path = r'd:\NEXUS-ERP\src\app\(authenticated)\hr\page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix header
content = content.replace('"รหัสพนักงาน", "ตำแหน่ง"', '"รหัสพนักงาน", "ชื่อ-สกุล", "ตำแหน่ง"')

# Fix EmployeeRow
old_row = """function EmployeeRow({ id, name, role, dept, location, status }: { id: string, name: string, role: string, dept: 
string, location: string, status: "active" | "danger" }) {
    const router = useRouter();
    return (
      <NexusTableRow onClick={() => router.push(`/hr/employees/${id}`)}>
        <NexusTableCell className="w-[1%] whitespace-nowrap text-center">
           <p className="font-bold text-white/80 group-hover:text-white transition-colors">{name}</p>
        </div>
      </NexusTableCell>"""

new_row = """function EmployeeRow({ id, name, role, dept, location, status }: { id: string, name: string, role: string, dept: string, location: string, status: "active" | "danger" }) {
    const router = useRouter();
    return (
      <NexusTableRow onClick={() => router.push(`/hr/employees/${id}`)}>
        <NexusTableCell className="w-[1%] whitespace-nowrap text-center">
             <span className="font-mono text-[13px] text-nexus-blue font-medium tracking-tighter">{id}</span>
        </NexusTableCell>
        <NexusTableCell className="w-full">
             <span className="font-bold text-white/80 group-hover:text-white transition-colors">{name}</span>
        </NexusTableCell>"""

content = content.replace(old_row, new_row)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Success')
