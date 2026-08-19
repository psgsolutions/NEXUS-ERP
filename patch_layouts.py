import os
import glob

base_dir = 'src/app/(authenticated)'
pages = glob.glob(os.path.join(base_dir, '*', 'page.tsx'))
modified = 0

for page in pages:
    with open(page, 'r', encoding='utf-8') as f:
        content = f.read()
    
    orig = content

    content = content.replace(
        'className="flex flex-col lg:flex-row items-start gap-4"',
        'className="flex flex-col xl:flex-row items-start gap-4"'
    )

    if 'customers' in page:
        content = content.replace('</div>\n        <div className="space-y-3">\n           {activeTab === "list"', '</div>\n        <div className="xl:w-[25%] shrink-0 sticky top-[96px] space-y-3">\n           {activeTab === "list"')
    elif 'finance' in page:
        content = content.replace('{/* Right Sidebar Status */}\n        <div className="space-y-3">', '{/* Right Sidebar Status */}\n        <div className="xl:w-[25%] shrink-0 sticky top-[96px] space-y-3">')
    elif 'hr' in page:
        content = content.replace('{/* Right Sidebar */}\n        <div className="space-y-4">', '{/* Right Sidebar */}\n        <div className="xl:w-[25%] shrink-0 sticky top-[96px] space-y-4">')
    elif 'procurement' in page:
        content = content.replace('</div>\n        <div className="space-y-3">\n           {activeTab === "vendors"', '</div>\n        <div className="xl:w-[25%] shrink-0 sticky top-[96px] space-y-3">\n           {activeTab === "vendors"')
    elif 'products' in page:
        content = content.replace('</div>\n        <div className="space-y-3">\n           {activeTab === "list"', '</div>\n        <div className="xl:w-[25%] shrink-0 sticky top-[96px] space-y-3">\n           {activeTab === "list"')
    elif 'projects' in page:
        content = content.replace('</div>\n        <div className="space-y-3">\n           <GlassCard', '</div>\n        <div className="xl:w-[25%] shrink-0 sticky top-[96px] space-y-3">\n           <GlassCard')
    elif 'support' in page:
        content = content.replace('</div>\n          <div className="space-y-4">', '</div>\n          <div className="xl:w-[25%] shrink-0 sticky top-[96px] space-y-4">')
    elif 'inventory' in page:
        content = content.replace('<div className="w-full lg:w-[65%] flex flex-col', '<div className="flex-1 flex flex-col')
        content = content.replace('<div className="w-full lg:w-[35%] flex flex-col', '<div className="xl:w-[25%] shrink-0 sticky top-[96px] flex flex-col')

    if content != orig:
        with open(page, 'w', encoding='utf-8') as f:
            f.write(content)
        modified += 1
        print(f"Updated {page}")

print(f"Modified {modified} files.")
