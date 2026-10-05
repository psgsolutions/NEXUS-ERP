import re

def process_file(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()

    # Make sure all main cards have bg-[#111111] instead of bg-white/[0.02] or bg-black/40
    content = content.replace('className="bg-white/[0.02] border border-white/5 rounded-3xl p-4 shadow-2xl space-y-4"', 
                              'className="bg-[#111111] border border-white/5 rounded-3xl p-4 shadow-2xl space-y-4"')
    content = content.replace('className="bg-black/40 border border-warning/20 rounded-3xl p-4 shadow-[0_0_15px_rgba(234,179,8,0.05)] space-y-4"',
                              'className="bg-[#111111] border border-warning/20 rounded-3xl p-4 shadow-[0_0_15px_rgba(234,179,8,0.05)] space-y-4"')

    # Adjust the h3 headers of the bottom cards to match the standard
    # Conditions, Remarks, Internal Notes have this:
    # <h3 className="text-[12px] font-black uppercase tracking-widest text-white/40 flex items-center gap-2">
    content = content.replace('text-[12px] font-black uppercase tracking-widest text-white/40 flex items-center gap-2', 
                              'text-base font-black uppercase tracking-widest text-white/80 flex items-center gap-2 border-b border-white/5 pb-2')

    # Internal Notes header has text-warning/70:
    # <h3 className="text-[12px] font-black uppercase tracking-widest text-warning/70 flex items-center gap-2">
    content = content.replace('text-[12px] font-black uppercase tracking-widest text-warning/70 flex items-center gap-2', 
                              'text-base font-black uppercase tracking-widest text-warning flex items-center gap-2 border-b border-warning/20 pb-2')
                              
    # Line Items Table header currently has:
    # <div className="flex items-center justify-between border-b border-white/5 pb-4 h-[36px]">
    # <h3 className="text-base font-black uppercase tracking-widest text-white/80 flex items-center gap-2">
    # Wait, it's already text-base! But it doesn't have border-b on the h3 because the wrapper has it. That's fine.

    # 2. Remove any remaining English brackets in headers:
    content = content.replace(' (Terms & Conditions)', '')
    content = content.replace(' (Remark)', '')
    content = content.replace(' (Internal Notes)', '')
    content = content.replace(' (CRM & Logistics)', '')
    content = content.replace(' (Document Details)', '')
    content = content.replace(' (Tax Display Mode)', '')
    content = content.replace(' (WHT)', '')
    content = content.replace(' (Reference)', '')
    content = content.replace(' (Project Name)', '')
    content = content.replace(' (Probability %)', '')
    content = content.replace(' (Expected Close)', '')
    content = content.replace(' (Lead Source)', '')
    content = content.replace(' (Delivery Terms)', '')
    content = content.replace(' (Shipping Location)', '')
    content = content.replace(' (Issue Date)', '')
    content = content.replace(' (Payment Terms)', '')
    content = content.replace(' (Due Date)', '')
    
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(content)

process_file('src/app/(authenticated)/sales/quotations/new/page.tsx')
print("Fixed cards and removed English brackets")
