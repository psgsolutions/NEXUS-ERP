import sys
import re

file_path = r'd:\NEXUS-ERP\src\app\(authenticated)\hr\page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

replacements = {
    'className="w-[300px]"': 'className="w-[1%] whitespace-nowrap text-center"',
    '<p className="font-mono text-[12px] text-nexus-blue font-medium tracking-tighter"': '<p className="font-mono text-[12px] text-nexus-blue font-medium tracking-tighter w-full text-center"',
    'className="w-[180px] text-[12px] font-medium text-white/40 uppercase tracking-widest"': 'className="w-[1%] whitespace-nowrap text-center text-[12px] font-medium text-white/40 uppercase tracking-widest"',
    'className="w-[150px] text-[12px] font-medium text-white/40 uppercase tracking-widest"': 'className="w-[1%] whitespace-nowrap text-center text-[12px] font-medium text-white/40 uppercase tracking-widest"',
    '<NexusTableCell>\n           <div className="flex items-center gap-2">': '<NexusTableCell className="w-[1%] whitespace-nowrap text-center">\n           <div className="flex items-center gap-2">',
    'className="text-center w-[180px]"': 'className="w-[1%] whitespace-nowrap text-center"',
    'className="w-[80px]"': 'className="w-[1%] whitespace-nowrap text-center"',
    'className="font-bold text-white"': 'className="w-full font-bold text-white"',
    'className="w-[150px] text-[12px] font-medium text-nexus-blue uppercase tracking-widest"': 'className="w-[1%] whitespace-nowrap text-center text-[12px] font-medium text-nexus-blue uppercase tracking-widest"',
    'className="w-[150px] text-[12px] font-medium text-nexus-teal uppercase tracking-widest"': 'className="w-[1%] whitespace-nowrap text-center text-[12px] font-medium text-nexus-teal uppercase tracking-widest"',
    'className="w-[180px] text-right font-bold text-nexus-teal mono-numbers"': 'className="w-[1%] whitespace-nowrap text-right font-bold text-nexus-teal mono-numbers"',
    'className="w-[120px]"': 'className="w-[1%] whitespace-nowrap text-center"',
    'className="w-[120px] font-mono text-[11px] text-white/50"': 'className="w-[1%] whitespace-nowrap text-center font-mono text-[11px] text-white/50"',
    'className="text-[12px] text-white/70"': 'className="w-[1%] whitespace-nowrap text-[12px] text-white/70"',
    'className="w-[150px] text-right font-bold text-warning mono-numbers"': 'className="w-[1%] whitespace-nowrap text-right font-bold text-warning mono-numbers"',
    'className="w-[150px]"': 'className="w-[1%] whitespace-nowrap text-center"',
}

for old_str, new_str in replacements.items():
    content = content.replace(old_str, new_str)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Success')
