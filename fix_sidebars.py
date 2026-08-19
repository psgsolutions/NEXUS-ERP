import os, re
for f in ['hr', 'inventory', 'procurement', 'finance']:
    p = f'd:/NEXUS-ERP/src/app/(authenticated)/{f}/page.tsx'
    if not os.path.exists(p): continue
    with open(p, 'r', encoding='utf-8') as file:
        content = file.read()
    
    if f in ['hr', 'procurement', 'finance']:
        content = content.replace('{/* Right Sidebar Status */}\n        <div className="space-y-3">', '{/* Right Sidebar Status */}\n        <div className="w-full xl:w-[25%] shrink-0 sticky top-[96px] space-y-3 max-h-[calc(100vh-120px)] overflow-y-auto custom-scrollbar pb-10">')
    elif f == 'inventory':
        content = content.replace('<div className="w-full lg:w-[280px] shrink-0 space-y-3">', '<div className="w-full xl:w-[25%] shrink-0 sticky top-[96px] space-y-3 max-h-[calc(100vh-120px)] overflow-y-auto custom-scrollbar pb-10">')
    
    with open(p, 'w', encoding='utf-8') as file:
        file.write(content)
