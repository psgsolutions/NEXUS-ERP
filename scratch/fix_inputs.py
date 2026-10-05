import re

def process_file(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Replace background
    content = content.replace('bg-[#0D0D0D]/90 backdrop-blur-md', 'bg-black/20 focus:bg-[#0D0D0D]/90 focus:backdrop-blur-md')
    
    # 2. Replace border
    content = content.replace('border-nexus-teal/40', 'border-white/10 focus:border-nexus-teal/50')
    
    # 3. Replace text color
    content = content.replace('text-nexus-teal font-bold focus:outline-none', 'text-white font-bold focus:text-nexus-teal focus:outline-none')
    content = content.replace('text-nexus-teal focus:outline-none', 'text-white focus:text-nexus-teal focus:outline-none')
    content = content.replace('text-nexus-teal text-[12px] focus:border', 'text-white focus:text-nexus-teal text-[12px] focus:border')
    content = content.replace('text-nexus-teal font-mono focus:outline-none', 'text-white font-mono focus:text-nexus-teal focus:outline-none')
    
    # 4. Replace shadow to be focus only
    content = content.replace('shadow-[0_0_15px_rgba(20,184,166,0.15)]', 'focus:shadow-[0_0_15px_rgba(20,184,166,0.15)]')

    with open(filename, 'w', encoding='utf-8') as f:
        f.write(content)

process_file('src/components/commerce/DocumentItemsTable.tsx')
process_file('src/app/(authenticated)/sales/quotations/new/page.tsx')
print("Fixed inputs")
