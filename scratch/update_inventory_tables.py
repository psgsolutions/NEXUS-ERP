import sys
import re

file_path = r'd:\NEXUS-ERP\src\app\(authenticated)\inventory\page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Update cells to make them fit content or expand
replacements = {
    'className="text-nexus-blue text-xs font-bold tracking-tighter" mono': 'className="w-[1%] whitespace-nowrap align-middle text-center text-nexus-blue text-xs font-bold tracking-tighter" mono',
    'className="text-nexus-teal text-xs font-bold tracking-tighter" mono': 'className="w-[1%] whitespace-nowrap align-middle text-center text-nexus-teal text-xs font-bold tracking-tighter" mono',
    
    'className="font-bold text-white group-hover:text-nexus-teal transition-colors text-sm"': 'className="w-full font-bold text-white group-hover:text-nexus-teal transition-colors text-sm"',
    'className="font-bold text-white group-hover:text-nexus-blue transition-colors text-sm"': 'className="w-full font-bold text-white group-hover:text-nexus-blue transition-colors text-sm"',
    'className="font-bold text-white text-sm"': 'className="w-full font-bold text-white text-sm"',
    
    'className="text-right font-bold text-white" mono': 'className="w-[1%] whitespace-nowrap text-right font-bold text-white" mono',
    'className="text-right text-white/60 font-bold" mono': 'className="w-[1%] whitespace-nowrap text-right text-white/60 font-bold" mono',
    'className="text-right font-bold text-white/80" mono': 'className="w-[1%] whitespace-nowrap text-right font-bold text-white/80" mono',
    'className="text-right text-nexus-teal font-bold" mono': 'className="w-[1%] whitespace-nowrap text-right text-nexus-teal font-bold" mono',
    'className="text-right text-nexus-blue font-bold" mono': 'className="w-[1%] whitespace-nowrap text-right text-nexus-blue font-bold" mono',

    'className="text-center"': 'className="w-[1%] whitespace-nowrap text-center"',
    
    'className="text-xs font-bold text-white/40 uppercase"': 'className="w-[1%] whitespace-nowrap text-center text-xs font-bold text-white/40 uppercase"',
    'className="text-xs font-bold text-white/60"': 'className="w-[1%] whitespace-nowrap text-center text-xs font-bold text-white/60"',
    'className="text-xs text-white/40" mono': 'className="w-[1%] whitespace-nowrap text-center text-xs text-white/40" mono',
    'className="text-xs font-bold text-white/50" mono': 'className="w-[1%] whitespace-nowrap text-center text-xs font-bold text-white/50" mono',
    'className="text-xs text-white/40 uppercase" mono': 'className="w-[1%] whitespace-nowrap text-center text-xs text-white/40 uppercase" mono',
    'className="text-xs font-bold text-white/50 whitespace-nowrap"': 'className="w-[1%] whitespace-nowrap text-center text-xs font-bold text-white/50"',
    
    # <NexusTableCell> without className that has StatusBadge or span
    '<NexusTableCell>\n                                  <StatusBadge': '<NexusTableCell className="w-[1%] whitespace-nowrap text-center">\n                                  <StatusBadge',
    '<NexusTableCell>\n                                  <span': '<NexusTableCell className="w-[1%] whitespace-nowrap text-center">\n                                  <span'
}

for old_str, new_str in replacements.items():
    content = content.replace(old_str, new_str)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Success')
