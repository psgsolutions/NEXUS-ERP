import sys

file_path = r'd:\NEXUS-ERP\src\app\(authenticated)\sales\page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(r"split(\'T\')", "split('T')")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Success')
