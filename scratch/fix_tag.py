import sys

file_path = r'd:\NEXUS-ERP\src\app\(authenticated)\projects\page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if '      </header>' in line and i > 500 and i < 550:
        lines[i] = line.replace('</header>', '</div>')

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print('Done')
