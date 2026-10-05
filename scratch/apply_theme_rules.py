import re

file_path = r'd:\NEXUS-ERP\src\app\(authenticated)\inventory\products\new\page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Card Headers (h5 -> h3)
content = re.sub(
    r'<div className="flex items-center gap-3 text-cyan-400">\s*<Package size=\{18\} />\s*<h5 className="text-\[13px\] font-black uppercase tracking-widest">ข้อมูลสินค้า</h5>\s*</div>',
    r'<h3 className="text-base font-black text-white/80 uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-4">\n                  <Package size={18} className="text-cyan-400" /> ข้อมูลสินค้า\n                </h3>',
    content
)

content = re.sub(
    r'<div className="flex items-center gap-3 text-white border-b border-white/5 pb-4">\s*<Truck size=\{18\} />\s*<h5 className="text-\[13px\] font-black uppercase tracking-widest">รับเข้า & การเงิน \(Inbound & Financials\)</h5>\s*</div>',
    r'<h3 className="text-base font-black text-white/80 uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-4">\n                <Truck size={18} className="text-cyan-400" /> รับเข้า & การเงิน (Inbound & Financials)\n              </h3>',
    content
)

content = re.sub(
    r'<h6 className="text-\[10px\] font-black uppercase text-cyan-400 tracking-widest">หน่วยและขนาดบรรจุภัณฑ์ \(UOM & Packaging\)</h6>',
    r'<h3 className="text-base font-black text-white/80 uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-4 mt-8">\n                    <Package size={18} className="text-cyan-400" /> หน่วยและขนาดบรรจุภัณฑ์ (UOM & Packaging)\n                  </h3>',
    content
)

content = re.sub(
    r'<h5 className="text-\[11px\] font-black text-white/40 uppercase tracking-widest">รายการที่รอการรับเข้า',
    r'<h3 className="text-base font-black text-white/80 uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-4">รายการที่รอการรับเข้า',
    content
)

content = re.sub(
    r'<h5 className="text-sm font-black text-white uppercase tracking-tight">Stock Integrity</h5>',
    r'<h3 className="text-base font-black text-white/80 uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-4">Stock Integrity</h3>',
    content
)

# 2. Update Field component
content = re.sub(
    r'<label className="text-\[12px\] font-black text-white/50 uppercase tracking-widest flex flex-wrap items-center gap-1\.5 pl-1\.5">',
    r'<label className="text-sm font-black text-white/40 uppercase tracking-widest flex flex-wrap items-center gap-1.5 pl-1.5">',
    content
)
content = re.sub(
    r'\{engText && <span className="text-white/30 font-bold uppercase tracking-widest text-\[10px\]">\{engText\}</span>\}',
    r'{engText && <span className="text-sm text-white/40 font-black uppercase tracking-widest">{engText}</span>}',
    content
)

# 3. Update Inputs & Conversions text
# Replace all text-[9px], text-[10px], text-[11px], text-[12px], text-[13px], text-xs with text-sm
# BE CAREFUL: only inside the main content!
def replace_text_size(match):
    cls = match.group(0)
    # Don't replace if it's the header breadcrumbs or something very specific
    if 'text-[9px] font-black uppercase text-white' in cls: # Image preview 'Change'
        return cls
    if 'text-[9px] font-black uppercase' in cls: # Image preview 'Upload'
        return cls
    
    cls = re.sub(r'text-\[(?:9|10|11|12|13)px\]', 'text-sm', cls)
    cls = re.sub(r'text-xs', 'text-sm', cls)
    return cls

content = re.sub(r'className="[^"]*"', replace_text_size, content)

# Remove the old border-b on the parent div since we moved it to the h3
content = content.replace(
    '<div className="flex items-center justify-between border-b border-white/5 pb-4">',
    '<div className="flex items-center justify-between">'
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated page.tsx with standard theme rules.")
