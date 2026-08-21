import sys

file_path = r'd:\NEXUS-ERP\src\app\(authenticated)\finance\receipts\new\page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

replacements = {
    52: '    if (!header.customer) return void showAlert("กรุณาเลือกลูกค้า");\n',
    78: '      if (await showConfirm("คุณมีการกรอกข้อมูลค้างไว้ ต้องการย้อนกลับโดยไม่บันทึกใช่หรือไม่?")) {\n',
    87: '    if (invoices.length === 0) return void showAlert("กรุณาเลือกอินวอยซ์ที่ต้องการรับชำระ", "System Notification", "warning");\n',
    88: '    showAlert("บันทึกรับชำระเงินเรียบร้อยแล้ว");\n',
    101: '            <h1 className="text-xl font-black uppercase tracking-tight text-white">บันทึกรับเงิน (Receipt)</h1>\n',
    109: '          ยกเลิก\n',
    112: '          <ShieldCheck size={14} className="mr-2" /> บันทึกรับเงิน\n',
    123: '          <Field label="ลูกค้า (Customer) *">\n',
    130: '                   <option value="">ค้นหาลูกค้า...</option>\n',
    136: '                  <Search size={16} className="mr-2" /> ดึงยอดค้าง\n',
    140: '          <Field label="วันที่รับชำระ (Date) *">\n',
    150: '          <Field label="เข้าบัญชี (Bank Account) *">\n',
    158: '               <option>เงินสด</option>\n',
    161: '          <Field label="ช่องทางชำระเงิน (Payment Method)">\n',
    167: '               <option value="transfer">โอนเงิน (Transfer)</option>\n',
    168: '               <option value="cash">เงินสด (Cash)</option>\n',
    169: '               <option value="cheque">เช็ค (Cheque)</option>\n',
    170: '               <option value="credit_card">บัตรเครดิต (Credit Card)</option>\n',
    175: '        <Field label="อ้างอิง / บันทึกเพิ่มเติม (Reference)">\n',
    179: '            placeholder="เช่น เลขที่เช็ค, สลิปโอนเงิน..." \n',
    188: '              <h4 className="text-[13px] font-black text-white/60 uppercase tracking-widest">รายการอินวอยซ์ที่รับชำระ (Invoices)</h4>\n',
    190: '            <span className="text-[11px] font-black text-cyan-400 uppercase tracking-widest">ตรวจสอบยอดค้างชำระและหัก ณ ที่จ่าย</span>\n',
    197: '                <div className="col-span-3 text-[11px] font-black text-white/40 uppercase tracking-widest">เลขที่ INV</div>\n',
    198: '                <div className="col-span-2 text-right text-[11px] font-black text-white/40 uppercase tracking-widest">ยอดค้างชำระ</div>\n',
    199: '                <div className="col-span-3 text-right text-[11px] font-black text-white/40 uppercase tracking-widest">รับชำระครั้งนี้</div>\n',
    201: '                <div className="col-span-1 text-right text-[11px] font-black text-white/40 uppercase tracking-widest">ยอดหัก</div>\n',
    202: '                <div className="col-span-1 text-center text-[11px] font-black text-white/40 uppercase tracking-widest">ลบ</div>\n',
    210: '                      <p className="text-[12px] text-white/30 font-black uppercase tracking-widest">ยังไม่มีรายการอินวอยซ์<br/><span className="text-[10px]">กรุณาเลือกลูกค้าและดึงยอดค้าง</span></p>\n',
    255: '          <Field label="หมายเหตุภายใน (Internal Note)">\n',
    260: '              placeholder="บันทึกย่อ..."\n',
    277: '          <span className="text-[11px] text-white/60 font-black uppercase tracking-widest">ยอดรับชำระรวม</span>\n',
    281: '          <span className="text-[11px] text-danger/60 font-black uppercase tracking-widest">หัก ณ ที่จ่ายรวม (WHT)</span>\n',
    285: '          <span className="text-[12px] text-white/80 font-black uppercase tracking-widest">ยอดรับสุทธิ</span>\n',
    293: '          บันทึกรับเงิน\n'
}

for line_num, new_text in replacements.items():
    idx = line_num - 1
    lines[idx] = new_text

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print('Done!')
