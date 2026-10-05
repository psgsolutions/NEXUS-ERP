import os
import re

directory = r"d:\NEXUS-ERP\src\app\(authenticated)"

files_to_check = []
for root, _, files in os.walk(directory):
    for f in files:
        if f.endswith("page.tsx"):
            files_to_check.append(os.path.join(root, f))

for file_path in files_to_check:
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    original_content = content

    # Standardize the table header
    # We want to find an h3 that contains "รายการสินค้า / บริการ"
    # and wrap it in the standard div if it's not already wrapped.
    # The standard wrapper is: <div className="flex items-center justify-between border-b border-white/5 pb-4 h-[36px]">
    # The standard h3 is: <h3 className="text-[13px] font-black uppercase tracking-widest text-white/80 flex items-center gap-2">

    # Check if the file has an h3 containing "รายการสินค้า / บริการ"
    # If the h3 has border-b inside it, it's the old style.
    # Pattern to match old h3: <h3 className="...border-b border-white/5 pb-4..."> ... </h3>
    
    h3_pattern = re.compile(r'<h3([^>]*)>(.*?)รายการสินค้า\s*/\s*บริการ(.*?)</h3>', re.DOTALL)
    
    def h3_replacer(match):
        classes = match.group(1)
        before_text = match.group(2)
        after_text = match.group(3)
        
        # If the wrapper already exists, we skip if it's the quotation one which we already fixed
        # But we can just clean the h3 classes:
        # Remove border-b border-white/5 pb-4 from h3
        classes = classes.replace("border-b", "").replace("border-white/5", "").replace("pb-4", "")
        # Normalize spaces
        classes = re.sub(r'\s+', ' ', classes).replace('className=" ', 'className="')
        
        return f'<div className="flex items-center justify-between border-b border-white/5 pb-4 h-[36px]">\n            <h3{classes}>{before_text}รายการสินค้า / บริการ{after_text}</h3>\n          </div>'

    # But wait, if it's ALREADY wrapped in our fixed div, doing this will wrap it TWICE!
    # So we only apply it if the h3 has "border-b" in its class, or if it's not inside our wrapper.
    # A safe way:
    if "border-b border-white/5 pb-4 h-[36px]" not in content:
        # It's not yet wrapped properly
        content = h3_pattern.sub(h3_replacer, content)

    # 2. Fix the Profit Rainbow Indicator padding if it exists
    content = content.replace(
        '"px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest flex items-center gap-2"',
        '"px-2 py-0 rounded-full border text-[10px] font-black uppercase tracking-widest flex items-center gap-1"'
    )

    if content != original_content:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Updated {file_path}")

print("Done.")
