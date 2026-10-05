import re

def process_file(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()

    # Address
    content = content.replace(
        'focus:border-nexus-teal focus:shadow-[0_0_15px_rgba(20,184,166,0.15)]"', 
        'focus:border-nexus-teal focus:shadow-[0_0_15px_rgba(20,184,166,0.15)] placeholder:text-white/30 focus:placeholder-transparent"'
    )
    
    # Remark
    content = content.replace(
        'resize-none leading-relaxed transition-all"',
        'resize-none leading-relaxed placeholder:text-white/30 focus:placeholder-transparent transition-all"'
    )

    with open(filename, 'w', encoding='utf-8') as f:
        f.write(content)

process_file('src/app/(authenticated)/sales/quotations/new/page.tsx')
print("Fixed placeholder classes for Address, Tax ID, and Remark")
