import sys
import re

file_path = r'd:\NEXUS-ERP\src\app\(authenticated)\projects\page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

replacements = {
    'className="w-48"': 'className="w-[1%] whitespace-nowrap text-center align-middle"',
    'className="text-sm font-medium text-white/60 uppercase"': 'className="w-[1%] whitespace-nowrap text-center text-sm font-medium text-white/60 uppercase"',
    '<NexusTableCell>\n          <StatusBadge': '<NexusTableCell className="w-[1%] whitespace-nowrap text-center">\n          <StatusBadge',
    'className="font-bold text-white/80"': 'className="w-full font-bold text-white/80"',
    'className="w-[140px] font-mono text-sm text-nexus-blue font-medium tracking-tighter"': 'className="w-[1%] whitespace-nowrap text-center font-mono text-sm text-nexus-blue font-medium tracking-tighter"',
    'className="w-[180px] text-sm font-medium text-white/60 uppercase tracking-widest"': 'className="w-[1%] whitespace-nowrap text-center text-sm font-medium text-white/60 uppercase tracking-widest"',
    'className="w-[120px] text-sm font-medium text-nexus-teal uppercase tracking-widest"': 'className="w-[1%] whitespace-nowrap text-center text-sm font-medium text-nexus-teal uppercase tracking-widest"',
    'className="w-[180px]"': 'className="w-[1%] whitespace-nowrap text-center"',
    'className="w-[140px] font-mono text-sm text-nexus-teal font-medium tracking-tighter"': 'className="w-[1%] whitespace-nowrap text-center font-mono text-sm text-nexus-teal font-medium tracking-tighter"',
    'className="w-[150px] text-right font-bold text-white/60 mono-numbers"': 'className="w-[1%] whitespace-nowrap text-right font-bold text-white/60 mono-numbers"',
    'className="w-[150px] text-right font-bold text-danger mono-numbers"': 'className="w-[1%] whitespace-nowrap text-right font-bold text-danger mono-numbers"',
    'className="w-[150px] text-right font-bold text-nexus-teal mono-numbers"': 'className="w-[1%] whitespace-nowrap text-right font-bold text-nexus-teal mono-numbers"',
    'className="w-[120px] text-right"': 'className="w-[1%] whitespace-nowrap text-center"',
    '<NexusTableCell>\n          <Link href={': '<NexusTableCell className="w-[1%] whitespace-nowrap align-middle text-center">\n          <Link href={',
    '<p className="font-mono text-xs text-nexus-blue font-medium tracking-tighter"': '<p className="font-mono text-xs text-nexus-blue font-medium tracking-tighter w-full text-center"',
}

for old_str, new_str in replacements.items():
    content = content.replace(old_str, new_str)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Success')
