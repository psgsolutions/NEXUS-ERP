import re

def process_file(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()

    # Change parent grid to 6 columns
    content = content.replace(
        '<div className="grid grid-cols-2 gap-x-4 gap-y-3">',
        '<div className="grid grid-cols-6 gap-x-4 gap-y-3">'
    )

    # Make the 3 items col-span-2
    # โอกาสการขาย
    content = content.replace(
        '<div className="space-y-1">\n              <label className="text-[12px] font-black uppercase tracking-widest text-white/40">โอกาสการขาย</label>',
        '<div className="space-y-1 col-span-2 xl:col-span-2">\n              <label className="text-[12px] font-black uppercase tracking-widest text-white/40">โอกาสการขาย</label>'
    )
    # เวลาจัดส่ง
    content = content.replace(
        '<div className="space-y-1">\n              <label className="text-[12px] font-black uppercase tracking-widest text-white/40">เวลาจัดส่ง</label>',
        '<div className="space-y-1 col-span-2 xl:col-span-2">\n              <label className="text-[12px] font-black uppercase tracking-widest text-white/40">เวลาจัดส่ง</label>'
    )
    # คาดว่าปิดจบ
    content = content.replace(
        '<div className="space-y-1">\n              <label className="text-[12px] font-black uppercase tracking-widest text-white/40">คาดว่าปิดจบ</label>',
        '<div className="space-y-1 col-span-2 xl:col-span-2">\n              <label className="text-[12px] font-black uppercase tracking-widest text-white/40">คาดว่าปิดจบ</label>'
    )
    
    # Make the 2 items col-span-3
    # ชื่อโปรเจกต์
    content = content.replace(
        '<div className="space-y-1">\n              <label className="text-[12px] font-black uppercase tracking-widest text-white/40">ชื่อโปรเจกต์</label>',
        '<div className="space-y-1 col-span-3">\n              <label className="text-[12px] font-black uppercase tracking-widest text-white/40">ชื่อโปรเจกต์</label>'
    )
    # แหล่งที่มา
    content = content.replace(
        '<div className="space-y-1">\n              <label className="text-[12px] font-black uppercase tracking-widest text-white/40">แหล่งที่มา</label>',
        '<div className="space-y-1 col-span-3">\n              <label className="text-[12px] font-black uppercase tracking-widest text-white/40">แหล่งที่มา</label>'
    )
    
    # Make IncoTerms and Shipping Address col-span-6
    # เงื่อนไขการส่ง
    content = content.replace(
        '<div className="space-y-1">\n              <label className="text-[12px] font-black uppercase tracking-widest text-white/40">เงื่อนไขการส่ง</label>',
        '<div className="space-y-1 col-span-6">\n              <label className="text-[12px] font-black uppercase tracking-widest text-white/40">เงื่อนไขการส่ง</label>'
    )
    
    # สถานที่จัดส่ง
    # It currently has <div className="space-y-1 col-span-2">
    content = content.replace(
        '<div className="space-y-1 col-span-2">\n              <label className="text-[12px] font-black uppercase tracking-widest text-white/40">สถานที่จัดส่ง</label>',
        '<div className="space-y-1 col-span-6">\n              <label className="text-[12px] font-black uppercase tracking-widest text-white/40">สถานที่จัดส่ง</label>'
    )

    with open(filename, 'w', encoding='utf-8') as f:
        f.write(content)

process_file('src/app/(authenticated)/sales/quotations/new/page.tsx')
print("Updated grid layout")
