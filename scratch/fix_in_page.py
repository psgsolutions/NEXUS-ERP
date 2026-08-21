import sys

file_path = r'd:\NEXUS-ERP\src\app\(authenticated)\inventory\in\new\page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

replacements = {
    50: '      if (await showConfirm("คุณมีการกรอกข้อมูลค้างไว้ ต้องการย้อนกลับโดยไม่บันทึกใช่หรือไม่?")) {\n',
    59: '    if (items.length === 0) return void showAlert("กรุณาเพิ่มรายการสินค้าที่ต้องการรับเข้า");\n',
    61: '    showAlert("บันทึกรับสินค้าเข้าคลังเรียบร้อยแล้ว");\n',
    66: '    if (!header.poRef) return void showAlert("กรุณาระบุเลขที่ใบสั่งซื้อ");\n',
    69: '      { id: "ITEM-001", productId: "PROD-004", name: "กล้องวงจรปิด AI", qty: 10, unit: "ตัว", price: 5000, cost: 2500 },\n',
    70: '      { id: "ITEM-002", productId: "PROD-005", name: "เครื่องสแกนลายนิ้วมือ", qty: 5, unit: "เครื่อง", price: 3000, cost: 1500 }\n',
    86: '            <h1 className="text-xl font-black uppercase tracking-tight text-white">รับสินค้าเข้าคลัง (Goods Receipt)</h1>\n',
    95: '            { id: "manual", label: "รับเข้าด้วยตนเอง", icon: <Package size={14} /> },\n',
    96: '            { id: "po", label: "รับจากใบสั่งซื้อ (PO)", icon: <FileText size={14} /> }\n',
    108: '          ยกเลิก\n',
    111: '          <ShieldCheck size={14} className="mr-2" /> บันทึกรับเข้าคลัง\n',
    123: '            <Field label="วันที่ทำรายการ (Date) *">\n',
    129: '            <Field label="คลังสินค้า (Warehouse)">\n',
    135: '                <option value="WH-01">WH-01 : Main Warehouse (สำนักงานใหญ่)</option>\n',
    136: '                <option value="WH-02">WH-02 : Branch 1 (สาขา 1)</option>\n',
    137: '                <option value="WH-03">WH-03 : Project Store (หน่วยงานโครงการ)</option>\n',
    144: '              <Field label="อ้างอิงใบสั่งซื้อ (PO Reference) *">\n',
    149: '                    placeholder="เช่น PO-2604-0012" \n',
    153: '                    <Search size={16} className="mr-2" /> ดึงข้อมูล\n',
    157: '              <Field label="ผู้จัดจำหน่าย (Supplier)">\n',
    164: '                  <option value="">-- อ้างอิงจาก PO --</option>\n',
    171: '              <Field label="ผู้จัดจำหน่าย (Supplier) *">\n',
    177: '                  <option value="">เลือกคู่ค้า...</option>\n',
    182: '              <Field label="เอกสารอ้างอิง (Ref. No.)">\n',
    186: '                  placeholder="เช่น INV-0012" \n',
    197: '            <h4 className="text-[13px] font-black text-white/60 uppercase tracking-widest">รายการสินค้า (Items)</h4>\n',
    206: '          <Field label="หมายเหตุ (Remarks)">\n',
    211: '              placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)..."\n',
    223: '        <p className="text-[12px] font-black text-white/20 uppercase tracking-[0.2em]">สรุปการรับเข้า</p>\n',
    229: '          <span className="text-[11px] text-white/60 font-black uppercase tracking-widest">จำนวนรายการ</span>\n',
    230: '          <span className="text-[14px] font-mono font-bold text-white">{items.length} รายการ</span>\n',
    233: '          <span className="text-[11px] text-white/60 font-black uppercase tracking-widest">จำนวนชิ้นรวม</span>\n',
    234: '          <span className="text-[14px] font-mono font-bold text-white">{items.reduce((acc, i) => acc + (i.qty || 0), 0)} ชิ้น</span>\n',
    237: '          <span className="text-[12px] text-white/80 font-black uppercase tracking-widest">มูลค่าต้นทุนรวม</span>\n',
    245: '          บันทึกรับเข้าคลัง\n'
}

for line_num, new_text in replacements.items():
    idx = line_num - 1
    lines[idx] = new_text

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print('Done!')
