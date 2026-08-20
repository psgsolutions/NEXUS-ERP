const fs = require('fs');

let content = fs.readFileSync('src/app/(authenticated)/procurement/requests/new/page.tsx', 'utf-8');
let lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];

  if (line.includes('value: "VD-001"')) {
    lines[i] = '  { value: "VD-001", label: "บริษัท อุปกรณ์ไอที จำกัด (มหาชน)", description: "Tax: 0105559012345" },';
  } else if (line.includes('value: "VD-002"')) {
    lines[i] = '  { value: "VD-002", label: "หจก. รับเหมาเครือข่ายไทย", description: "Tax: 0103550012346" }';
  } else if (line.includes("if (vendorId === \"VD-001\") {")) {
    // we need to fix the next line too
    lines[i+1] = '      setVendorData({ address: "123 ถ.สุขุมวิท กรุงเทพฯ", taxId: "0105559012345", creditTerms: "30 Days", contact: "คุณสมชาย" });';
  } else if (line.includes("else if (vendorId === \"VD-002\") {")) {
    lines[i+1] = '      setVendorData({ address: "456 ถ.รัชดาฯ กรุงเทพฯ", taxId: "0103550012346", creditTerms: "15 Days", contact: "คุณวิเชียร" });';
  } else if (line.includes('id: "header"')) {
    lines[i] = '    { id: "header", label: "ข้อมูลพื้นฐานการขอซื้อ" },';
  } else if (line.includes('id: "items"')) {
    lines[i] = '    { id: "items", label: "รายการพัสดุและบริการ" }';
  } else if (line.includes('if (await showConfirm(')) {
    lines[i] = '      if (await showConfirm("คุณมีการกรอกข้อมูลค้างไว้ ต้องการย้อนกลับโดยไม่บันทึกใช่หรือไม่?")) {';
  } else if (line.includes('if (items.length === 0) return void showAlert(')) {
    lines[i] = '    if (items.length === 0) return void showAlert("กรุณาเพิ่มรายการที่ต้องการขอซื้อ");';
  } else if (line.includes('showAlert(') && line.includes(');') && !line.includes('items.length')) {
    lines[i] = '    showAlert("ส่งขออนุมัติซื้อเรียบร้อยแล้ว");';
  } else if (line.includes('<h1 className="text-xl font-black uppercase tracking-tight text-white">')) {
    lines[i] = '            <h1 className="text-xl font-black uppercase tracking-tight text-white">บันทึกใบขอซื้อ (New Purchase Request)</h1>';
  } else if (line.includes('variant="ghost" className="h-9 px-6 rounded-full text-white/50 hover:text-white" onClick={handleBack}')) {
    lines[i+1] = '          ยกเลิก';
  } else if (line.includes('<ShieldCheck size={14} className="mr-2" />')) {
    lines[i] = '          <ShieldCheck size={14} className="mr-2" /> ส่งขออนุมัติซื้อ';
  } else if (line.includes('<Field label=') && line.includes('<PillInput value={header.requester}')) {
    lines[i-1] = '                <Field label="ผู้ยื่นคำขอซื้อ">';
  } else if (line.includes('<Field label=') && line.includes('<PillSelect') && line.includes('value={header.department}')) {
    lines[i-2] = '                <Field label="หน่วยงาน / แผนก">';
  } else if (line.includes('<Field label=') && line.includes('<NexusDatePicker value={header.requestDate}')) {
    lines[i-1] = '                <Field label="วันที่ยื่นคำขอ">';
  } else if (line.includes('<Field label={<>') && line.includes('className="text-danger font-bold">')) {
    lines[i-1] = '                <Field label={<>วันที่ต้องการใช้งาน <span className="text-danger font-bold">*</span></>}>';
  } else if (line.includes('<Field label=') && line.includes('<PillSelect') && line.includes('value={header.priority}')) {
    lines[i-2] = '                <Field label="ลำดับความสำคัญ">';
  } else if (line.includes('<option value="low">')) {
    lines[i] = '                    <option value="low">LOW (ทั่วไป)</option>';
  } else if (line.includes('<option value="medium">')) {
    lines[i] = '                    <option value="medium">MEDIUM (ปกติ)</option>';
  } else if (line.includes('<option value="high">')) {
    lines[i] = '                    <option value="high">HIGH (ด่วน)</option>';
  } else if (line.includes('<option value="urgent">')) {
    lines[i] = '                    <option value="urgent">URGENT (ด่วนที่สุด)</option>';
  } else if (line.includes('<Field label=') && line.includes('<SmartSelect') && line.includes('value={vendorId}')) {
    lines[i-2] = '                <Field label="ชื่อผู้จำหน่าย / คู่ค้า">';
  } else if (line.includes('placeholder=') && line.includes('className="h-11 rounded-full text-[13px] font-bold px-4"')) {
    lines[i] = '                    placeholder="ค้นหาผู้จำหน่าย..."';
  } else if (line.includes('<Field label=') && line.includes('<PillInput value={vendorData.taxId}')) {
    lines[i-1] = '                  <Field label="เลขประจำตัวผู้เสียภาษี">';
  } else if (line.includes('<Field label=') && line.includes('<PillInput value={vendorData.creditTerms}')) {
    lines[i-1] = '                  <Field label="เครดิตเทอม">';
  } else if (line.includes('<Field label=') && line.includes('<PillInput value={`$') && line.includes('vendorData.contact')) {
    lines[i-1] = '                  <Field label="ที่อยู่ / ข้อมูลติดต่อ">';
    lines[i] = '                  <PillInput value={`${vendorData.address} (ติดต่อ: ${vendorData.contact})`} readOnly className="h-11 rounded-full bg-white/5 border-white/10 text-white/50" />';
  } else if (line.includes('<Field label=') && line.includes('<PillInput') && line.includes('value={header.projectRef}')) {
    lines[i-2] = '                <Field label="โครงการที่อ้างอิง">';
  } else if (line.includes('placeholder=') && lines[i+1].includes('/>') && lines[i+2].includes('</Field>') && !line.includes('className')) {
    if (lines[i-3].includes('projectRef')) {
      lines[i] = '                    placeholder="เช่น PRJ-26-001 (ถ้ามี)..."';
    }
  } else if (line.includes('placeholder=') && line.includes('value={header.reason}')) {
    lines[i] = '                  placeholder="ระบุเหตุผลความจำเป็นในการจัดซื้อครั้งนี้..."';
  } else if (line.includes('text-sm text-white/40') && lines[i+1].includes('PR-DRAFT')) {
    lines[i] = '                  <div className="text-sm text-white/40">เลขที่ PR</div>';
  } else if (line.includes('text-white/40 text-xs uppercase tracking-wider mb-1') && lines[i+1].includes('Jane Smith')) {
    lines[i] = '                  <div className="text-white/40 text-xs uppercase tracking-wider mb-1">ผู้อนุมัติลำดับที่ 1</div>';
  } else if (line.includes('text-white/60 text-sm') && lines[i+1].includes('subtotal.toLocaleString')) {
    lines[i] = '                    <div className="text-white/60 text-sm">มูลค่ารวม (Subtotal)</div>';
  } else if (line.includes('text-white/60 text-sm') && lines[i+1].includes('vatAmount.toLocaleString')) {
    lines[i] = '                    <div className="text-white/60 text-sm">ภาษีมูลค่าเพิ่ม (VAT 7%)</div>';
  } else if (line.includes('text-white/60 text-sm') && lines[i+1].includes('whtAmount.toLocaleString')) {
    lines[i] = '                    <div className="text-white/60 text-sm">หัก ณ ที่จ่าย (WHT {whtRate}%)</div>';
  } else if (line.includes('text-cyan-400 font-bold') && lines[i+1].includes('grandTotal.toLocaleString')) {
    lines[i] = '                    <div className="text-cyan-400 font-bold">ยอดสุทธิ (Grand Total)</div>';
  } else if (line.includes('<p className="text-xs text-white/40 flex-1 leading-relaxed">')) {
    lines[i] = '                  <p className="text-xs text-white/40 flex-1 leading-relaxed">ใบขอซื้อนี้ต้องได้รับการอนุมัติจากหัวหน้าแผนกก่อนเข้าสู่กระบวนการจัดซื้อ</p>';
  } else if (line.includes('<h2 className="text-lg font-black text-white uppercase tracking-tight">') && lines[i+1].includes('options={vendorOptions}')) {
    lines[i] = '            <h2 className="text-lg font-black text-white uppercase tracking-tight">แนะนำผู้จำหน่าย (Suggested Vendor)</h2>';
  } else if (line.includes('<h2 className="text-lg font-black text-white uppercase tracking-tight">') && lines[i+1].includes('min-h-[120px]')) {
    lines[i] = '            <h2 className="text-lg font-black text-white uppercase tracking-tight">คลังเอกสารแนบอ้างอิง (Attachments)</h2>';
  } else if (line.includes('<p className="text-sm font-medium text-white/40">') && lines[i-1].includes('FileUp')) {
    lines[i] = '                  <p className="text-sm font-medium text-white/40">ลากไฟล์วางที่นี่ หรือคลิกเพื่ออัปโหลด</p>';
  } else if (line.includes('<h2 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">') && lines[i-1].includes('p-5')) {
    lines[i] = '        <h2 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">สรุปรายการคำขอซื้อ</h2>';
  } else if (line.includes('options={[{value:"none"')) {
    lines[i] = '                    options={[{value:"none", label:"ไม่มี VAT"}, {value:"exclude", label:"ก่อน VAT"}, {value:"include", label:"รวม VAT"}]}';
  } else if (line.includes('options={[{value:"0"')) {
    lines[i] = '                    options={[{value:"0", label:"ไม่หัก WHT"}, {value:"1", label:"1%"}, {value:"3", label:"3%"}, {value:"5", label:"5%"}]}';
  } else if (line.includes("useRealtimeCollection('suppliers')")) {
    lines[i] = "    // ใช้อ้างอิงแทนการต่อ useRealtimeCollection('suppliers')";
  }
}

fs.writeFileSync('src/app/(authenticated)/procurement/requests/new/page.tsx', lines.join('\n'), 'utf-8');
console.log('DONE');
