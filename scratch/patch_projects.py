import os
path = r'd:\NEXUS-ERP\src\app\(authenticated)\projects\page.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('<div className="space-y-1.5">', '<div className="space-y-1.5 w-32 mx-auto">')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Updated')
