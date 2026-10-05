import re

def process_file(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()

    # The inputs in page.tsx currently have things like "transition-all text-left px-4"
    # Or "focus:shadow-[0_0_15px_rgba(20,184,166,0.15)]"
    # We can add placeholder:text-white/30 focus:placeholder-transparent
    
    content = content.replace('transition-all text-left px-4"', 'placeholder:text-white/30 focus:placeholder-transparent transition-all text-left px-4"')
    content = content.replace('transition-all text-center"', 'placeholder:text-white/30 focus:placeholder-transparent transition-all text-center"')
    
    # Customer search input:
    content = content.replace('shadow-[0_0_15px_rgba(20,184,166,0.15)] transition-all"', 'shadow-[0_0_15px_rgba(20,184,166,0.15)] placeholder:text-white/30 focus:placeholder-transparent transition-all"')
    
    # Internal notes (textarea):
    content = content.replace('placeholder:text-warning/30"', 'placeholder:text-warning/30 focus:placeholder-transparent"')
    
    # DocumentItemsTable.tsx inputs:
    content = content.replace('transition-colors not-italic"', 'placeholder:text-white/30 focus:placeholder-transparent transition-colors not-italic"')
    content = content.replace('transition-colors cursor-text"', 'placeholder:text-white/30 focus:placeholder-transparent transition-colors cursor-text"')

    with open(filename, 'w', encoding='utf-8') as f:
        f.write(content)

process_file('src/app/(authenticated)/sales/quotations/new/page.tsx')
process_file('src/components/commerce/DocumentItemsTable.tsx')
print("Added placeholder classes")
