import os, glob, re
paths = glob.glob('d:/NEXUS-ERP/src/app/(authenticated)/**/*.tsx', recursive=True)
for p in paths:
    with open(p, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if 'lg:flex-row' in content and 'items-start' in content:
        print(f'{p} needs fix')
        content = content.replace('flex flex-col lg:flex-row items-start gap-4', 'flex flex-col xl:flex-row items-start gap-4')
        content = re.sub(r'w-full lg:w-\[30%\] shrink-0 space-y-6', 'w-full xl:w-[25%] shrink-0 sticky top-[96px] space-y-6 max-h-[calc(100vh-120px)] overflow-y-auto custom-scrollbar pb-10', content)
        content = re.sub(r'w-full lg:w-\[25%\] shrink-0 space-y-6', 'w-full xl:w-[25%] shrink-0 sticky top-[96px] space-y-6 max-h-[calc(100vh-120px)] overflow-y-auto custom-scrollbar pb-10', content)
        content = re.sub(r'{/\* Right Sidebar Status \*/}\s*<div className=\"space-y-3\">', '{/* Right Sidebar Status */}\n        <div className=\"w-full xl:w-[25%] shrink-0 sticky top-[96px] space-y-3 max-h-[calc(100vh-120px)] overflow-y-auto custom-scrollbar pb-10\">', content)
        with open(p, 'w', encoding='utf-8') as f:
            f.write(content)
