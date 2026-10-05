import sys
import re

file_path = r'd:\NEXUS-ERP\src\app\(authenticated)\finance\page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

replacements = {
    'className="w-[140px]"': 'className="w-[1%] whitespace-nowrap text-center"',
    'className="w-[180px]"': 'className="w-[1%] whitespace-nowrap text-center"',
    'className="w-[120px]"': 'className="w-[1%] whitespace-nowrap text-center"',

    'className="w-[180px] text-sm font-medium text-white/40 uppercase tracking-widest"': 'className="w-[1%] whitespace-nowrap text-center text-sm font-medium text-white/40 uppercase tracking-widest"',
    'className="w-[150px] text-right font-bold text-white mono-numbers"': 'className="w-[1%] whitespace-nowrap text-right font-bold text-white mono-numbers"',
    'className="w-[150px] text-right font-bold text-warning mono-numbers"': 'className="w-[1%] whitespace-nowrap text-right font-bold text-warning mono-numbers"',
    
    'className="font-bold text-white/80 group-hover:text-white transition-colors whitespace-nowrap"': 'className="w-full font-bold text-white/80 group-hover:text-white transition-colors"',
    'className="font-bold text-white/80 group-hover:text-white transition-colors"': 'className="w-full font-bold text-white/80 group-hover:text-white transition-colors"',
    'className="w-[150px] text-right font-bold text-white/60 font-mono"': 'className="w-[1%] whitespace-nowrap text-right font-bold text-white/60 font-mono"',
    'className="font-bold text-white"': 'className="w-full font-bold text-white"',
    'className="w-[140px] font-mono text-[10px] text-nexus-teal tracking-tighter"': 'className="w-[1%] whitespace-nowrap text-center font-mono text-[10px] text-nexus-teal tracking-tighter"',
    'className="w-[140px] font-mono text-[10px] text-nexus-blue tracking-tighter"': 'className="w-[1%] whitespace-nowrap text-center font-mono text-[10px] text-nexus-blue tracking-tighter"',
    'className="w-[150px] text-right font-bold text-white/20 mono-numbers"': 'className="w-[1%] whitespace-nowrap text-right font-bold text-white/20 mono-numbers"',
    'className="w-[150px] text-right font-bold text-nexus-teal mono-numbers"': 'className="w-[1%] whitespace-nowrap text-right font-bold text-nexus-teal mono-numbers"',
    'className="font-bold text-white/80"': 'className="w-full font-bold text-white/80"',
    'className="w-[180px] font-mono text-[11px] text-white/40 tracking-widest"': 'className="w-[1%] whitespace-nowrap text-center font-mono text-[11px] text-white/40 tracking-widest"',
    'className="w-[150px] font-bold text-[11px] uppercase tracking-widest text-white/40"': 'className="w-[1%] whitespace-nowrap text-center font-bold text-[11px] uppercase tracking-widest text-white/40"',
    'className="w-[120px] text-sm font-medium text-white/40 uppercase tracking-widest"': 'className="w-[1%] whitespace-nowrap text-center text-sm font-medium text-white/40 uppercase tracking-widest"',

    '<p className="font-mono text-xs text-warning font-medium tracking-tighter"': '<p className="font-mono text-xs text-warning font-medium tracking-tighter text-center w-full"',
    '<p className="font-mono text-xs text-nexus-blue font-medium tracking-tighter"': '<p className="font-mono text-xs text-nexus-blue font-medium tracking-tighter text-center w-full"',
}

for old_str, new_str in replacements.items():
    content = content.replace(old_str, new_str)

# Special case for AssetRow which had no className on the first cell
content = content.replace(
    '<NexusTableCell>\n           <p className="font-mono text-xs text-warning font-medium tracking-tighter text-center w-full">{id}</p>\n           <p className="w-full font-bold text-white/80">{name}</p>',
    '<NexusTableCell className="w-[1%] whitespace-nowrap align-middle text-center">\n           <p className="font-mono text-xs text-warning font-medium tracking-tighter text-center w-full">{id}</p>\n        </NexusTableCell>\n        <NexusTableCell className="w-full font-bold text-white/80">{name}'
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Success')
