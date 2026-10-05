import sys
import re

file_path = r'd:\NEXUS-ERP\src\app\(authenticated)\procurement\page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

replacements = {
    'className="w-[140px]"': 'className="w-[1%] whitespace-nowrap text-center"',
    'className="w-[120px]"': 'className="w-[1%] whitespace-nowrap text-center"',
    'className="w-[180px]"': 'className="w-[1%] whitespace-nowrap text-center"',
    'className="w-[140px] text-right"': 'className="w-[1%] whitespace-nowrap text-center"',
    'className="w-[100px] text-right"': 'className="w-[1%] whitespace-nowrap text-center"',
    'className="text-center w-[120px]"': 'className="w-[1%] whitespace-nowrap text-center"',

    'className="font-bold text-white/80 group-hover:text-white transition-colors"': 'className="w-full font-bold text-white/80 group-hover:text-white transition-colors"',
    'className="font-bold text-white/80"': 'className="w-full font-bold text-white/80"',
    
    'className="w-[150px] text-sm font-medium text-white/60 uppercase tracking-[0.1em]"': 'className="w-[1%] whitespace-nowrap text-center text-sm font-medium text-white/60 uppercase tracking-[0.1em]"',
    'className="w-[150px] font-mono text-[12px] text-white/60"': 'className="w-[1%] whitespace-nowrap text-center font-mono text-[12px] text-white/60"',
    'className="w-[150px] font-mono text-[10px] text-white/60 uppercase tracking-widest"': 'className="w-[1%] whitespace-nowrap text-center font-mono text-[10px] text-white/60 uppercase tracking-widest"',
    'className="w-[120px] text-white/60 font-bold"': 'className="w-[1%] whitespace-nowrap text-center text-white/60 font-bold"',
    'className="w-[120px] text-sm font-medium text-white/40 uppercase"': 'className="w-[1%] whitespace-nowrap text-center text-sm font-medium text-white/40 uppercase"',
    'className="w-[150px] text-white/60 font-bold"': 'className="w-[1%] whitespace-nowrap text-center text-white/60 font-bold"',
    'className="w-[150px] text-right font-bold text-white mono-numbers"': 'className="w-[1%] whitespace-nowrap text-right font-bold text-white mono-numbers"',
    'className="w-[140px] font-mono text-[11px] text-white/40"': 'className="w-[1%] whitespace-nowrap text-center font-mono text-[11px] text-white/40"',
    'className="w-[150px] text-right font-bold text-white/60 mono-numbers"': 'className="w-[1%] whitespace-nowrap text-right font-bold text-white/60 mono-numbers"',
    'className="w-[150px] text-right font-bold text-warning mono-numbers"': 'className="w-[1%] whitespace-nowrap text-right font-bold text-warning mono-numbers"',
    
    # ID Texts
    '<p className="font-mono text-sm text-nexus-blue font-medium tracking-tighter"': '<p className="font-mono text-sm text-nexus-blue font-medium tracking-tighter text-center w-full"',
    '<p className="font-mono text-sm text-nexus-teal font-medium tracking-tighter"': '<p className="font-mono text-sm text-nexus-teal font-medium tracking-tighter text-center w-full"',
    '<p className="font-mono text-sm text-nexus-purple font-medium tracking-tighter"': '<p className="font-mono text-sm text-nexus-purple font-medium tracking-tighter text-center w-full"',
    '<p className="font-mono text-[12px] text-purple-400 font-medium tracking-tighter"': '<p className="font-mono text-[12px] text-purple-400 font-medium tracking-tighter text-center w-full"',
    '<p className="font-mono text-[12px] text-nexus-teal font-medium tracking-tighter"': '<p className="font-mono text-[12px] text-nexus-teal font-medium tracking-tighter text-center w-full"',
    '<p className="font-mono text-[12px] text-amber-500 font-medium tracking-tighter"': '<p className="font-mono text-[12px] text-amber-500 font-medium tracking-tighter text-center w-full"',
}

for old_str, new_str in replacements.items():
    content = content.replace(old_str, new_str)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Success')
