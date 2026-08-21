import sys

file_path = r'd:\NEXUS-ERP\src\app\(authenticated)\projects\page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

target = '      <div className="p-6 border-b border-white/5 flex flex-col xl:flex-row xl:items-center justify-between gap-5 bg-black/20 shrink-0">'
replacement = '      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5 shrink-0 w-full">'

content = content.replace(target, replacement)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Done')
