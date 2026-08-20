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
  } else if (line.includes('<ShieldCheck size={14} className="mr-2" />') && !lines[i-1].includes('onClick={handleSave}')) {
    lines[i] = '          <ShieldCheck size={14} className="mr-2" /> ส่งขออนุมัติซื้อ';
  } else if (line.includes('<ShieldCheck size={18} className="mr-2" />')) {
    lines[i+1] = '          ส่งขออนุมัติซื้อ';
  } else if (line.includes('<Field label=') && line.includes('<PillInput value={header.requester}')) {
    lines[i-1] = '            <Field label="ผู้ยื่นคำขอซื้อ">';
  } else if (line.includes('<Field label=') && line.includes('<PillSelect') && line.includes('value={header.department}')) {
    lines[i-2] = '            <Field label="หน่วยงาน / แผนก">';
  } else if (line.includes('<Field label=') && line.includes('<NexusDatePicker value={header.requestDate}')) {
    lines[i-1] = '            <Field label="วันที่ยื่นคำขอ">';
  } else if (line.includes('<Field label={<>') && line.includes('className="text-danger font-bold">')) {
    lines[i] = '            <Field label={<>วันที่ต้องการใช้งาน <span className="text-danger font-bold">*</span></>}>';
  } else if (line.includes('<Field label=') && line.includes('<PillSelect') && line.includes('value={header.priority}')) {
    lines[i-2] = '            <Field label="ลำดับความสำคัญ">';
  } else if (line.includes('<option value="low">')) {
    lines[i] = '                    <option value="low">LOW (ทั่วไป)</option>';
  } else if (line.includes('<option value="medium">')) {
    lines[i] = '                    <option value="medium">MEDIUM (ปกติ)</option>';
  } else if (line.includes('<option value="high">')) {
    lines[i] = '                    <option value="high">HIGH (ด่วน)</option>';
  } else if (line.includes('<option value="urgent">')) {
    lines[i] = '                    <option value="urgent">URGENT (ด่วนที่สุด)</option>';
  } else if (line.includes('<Field label=') && line.includes('<SmartSelect') && line.includes('value={vendorId}')) {
    lines[i-2] = '              <Field label="ชื่อผู้จำหน่าย / คู่ค้า">';
  } else if (line.includes('placeholder=') && line.includes('className="h-11 rounded-full text-[13px] font-bold px-4"')) {
    lines[i] = '                  placeholder="ค้นหาผู้จำหน่าย..."';
  } else if (line.includes('<Field label=') && line.includes('<PillInput value={vendorData.taxId}')) {
    lines[i-1] = '                  <Field label="เลขประจำตัวผู้เสียภาษี">';
  } else if (line.includes('<Field label=') && line.includes('<PillInput value={vendorData.creditTerms}')) {
    lines[i-1] = '                  <Field label="เครดิตเทอม">';
  } else if (line.includes('<Field label=') && line.includes('<PillInput value={`$') && line.includes('vendorData.contact')) {
    lines[i-1] = '                <Field label="ที่อยู่ / ข้อมูลติดต่อ">';
    lines[i] = '                  <PillInput value={`${vendorData.address} (ติดต่อ: ${vendorData.contact})`} disabled className="w-full bg-white/[0.02] h-11 rounded-full px-6 text-[13px] font-bold text-white/60" />';
  } else if (line.includes('<Field label=') && line.includes('<PillInput') && line.includes('value={header.projectRef}')) {
    lines[i-2] = '            <Field label="โครงการที่อ้างอิง">';
  } else if (line.includes('placeholder=') && lines[i+1].includes('className="w-full h-11') && lines[i+2].includes('/>')) {
    lines[i] = '                placeholder="เช่น PRJ-26-001 (ถ้ามี)..."';
  } else if (line.includes('<Field label=') && lines[i+1].includes('<textarea')) {
    lines[i] = '            <Field label="วัตถุประสงค์ / ความจำเป็น *" required>';
  } else if (line.includes('placeholder=') && line.includes('value={header.reason}')) {
    lines[i] = '                  placeholder="ระบุเหตุผลความจำเป็นในการจัดซื้อครั้งนี้..."';
  } else if (line.includes('text-sm text-white/40') && lines[i+1].includes('PR-DRAFT')) {
    lines[i] = '                  <div className="text-sm text-white/40">เลขที่ PR</div>';
  } else if (line.includes('text-white/40 text-xs uppercase tracking-wider mb-1') && lines[i+1].includes('Jane Smith')) {
    lines[i] = '                  <div className="text-white/40 text-xs uppercase tracking-wider mb-1">ผู้อนุมัติลำดับที่ 1</div>';
  } else if (line.includes('<span className="text-[11px] text-white/40 font-bold uppercase tracking-widest">')) {
    lines[i] = '                <span className="text-[11px] text-white/40 font-bold uppercase tracking-widest">ลากไฟล์วางที่นี่ หรือคลิกเพื่ออัปโหลด</span>';
  } else if (line.includes('<div className="h-full flex items-center justify-center text-[11px] text-white/20 font-bold uppercase tracking-widest">')) {
    lines[i] = '                  <div className="h-full flex items-center justify-center text-[11px] text-white/20 font-bold uppercase tracking-widest">ยังไม่มีไฟล์แนบ</div>';
  } else if (line.includes('<h5 className="text-[13px] font-black text-white/80 uppercase tracking-widest flex items-center gap-2">') && lines[i-2].includes('p-5')) {
    lines[i+1] = '          สรุปรายการคำขอซื้อ';
  } else if (line.includes('{ id: "none", label:')) {
    lines[i] = '            { id: "none", label: "ไม่มี VAT" },';
    lines[i+1] = '            { id: "exclude", label: "ก่อน VAT" },';
    lines[i+2] = '            { id: "include", label: "รวม VAT" }';
  } else if (line.includes('options={[{value:"0"')) {
    lines[i] = '                    options={[{value:"0", label:"ไม่หัก WHT"}, {value:"1", label:"1%"}, {value:"3", label:"3%"}, {value:"5", label:"5%"}]}';
  } else if (line.includes("useRealtimeCollection('suppliers')")) {
    lines[i] = "    // ใช้อ้างอิงแทนการต่อ useRealtimeCollection('suppliers')";
  } else if (line.includes('rate === 0 ?')) {
    lines[i] = '              {rate === 0 ? "ไม่หัก WHT" : `WHT ${rate}%`}';
  } else if (line.includes('<span>') && lines[i+1].includes('subtotal.toLocaleString')) {
    lines[i] = '          <span>มูลค่ารวม (Subtotal)</span>';
    lines[i+1] = '          <span className="font-mono text-[12px]">฿{subtotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>';
  } else if (line.includes('<span>') && lines[i+1].includes('vatAmount.toLocaleString')) {
    lines[i] = '            <span>ภาษีมูลค่าเพิ่ม (VAT 7%)</span>';
    lines[i+1] = '            <span className="font-mono text-[12px]">฿{vatAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>';
  } else if (line.includes('<span>') && lines[i+1].includes('whtAmount.toLocaleString')) {
    lines[i] = '            <span>หัก ณ ที่จ่าย (WHT {whtRate}%)</span>';
    lines[i+1] = '            <span className="font-mono text-[12px]">- ฿{whtAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>';
  } else if (line.includes('<span className="text-[12px] font-black text-white uppercase tracking-widest">')) {
    lines[i] = '          <span className="text-[12px] font-black text-white uppercase tracking-widest">ยอดสุทธิ (Grand Total)</span>';
    lines[i+1] = '          <span className="text-xl font-black text-cyan-400 font-mono">฿{grandTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>';
  } else if (line.includes('<p className="text-[10px] text-warning/80 font-bold uppercase leading-relaxed tracking-widest">')) {
    lines[i+1] = '          ใบขอซื้อนี้ต้องได้รับการอนุมัติจากหัวหน้าแผนกก่อนเข้าสู่กระบวนการจัดซื้อ';
  } else if (line.includes('<FileUp size={16} />')) {
    lines[i] = '              <FileUp size={16} /> คลังเอกสารแนบอ้างอิง (Attachments)';
  } else if (line.includes('<UploadCloud size={16} />')) {
    lines[i] = '              <UploadCloud size={16} /> แนะนำผู้จำหน่าย (Suggested Vendor)';
  } else if (line.includes('<textarea')) {
    lines[i+4] = '                placeholder="ระบุเหตุผลความจำเป็นในการจัดซื้อครั้งนี้..."';
  }
}

fs.writeFileSync('src/app/(authenticated)/procurement/requests/new/page.tsx', lines.join('\n'), 'utf-8');
console.log('DONE');
