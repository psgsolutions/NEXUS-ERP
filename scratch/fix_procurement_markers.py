import os

file_path = 'src/app/(authenticated)/procurement/requests/new/page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if '"0105559012345"' in line:
        lines[i] = '      setVendorData({ address: "123 ถ.สุขุมวิท กรุงเทพฯ", taxId: "0105559012345", creditTerms: "30 Days", contact: "คุณสมชาย" });\n'
    elif '"0103550012346"' in line:
        lines[i] = '      setVendorData({ address: "456 ถ.รัชดาฯ กรุงเทพฯ", taxId: "0103550012346", creditTerms: "15 Days", contact: "คุณวิเชียร" });\n'
    elif 'id: "header"' in line:
        lines[i] = '    { id: "header", label: "ข้อมูลพื้นฐานการขอซื้อ" },\n'
    elif 'id: "items"' in line:
        lines[i] = '    { id: "items", label: "รายการพัสดุและบริการ" }\n'
    elif 'isDirty' in line and 'showConfirm' in lines[i+1] if i+1 < len(lines) else False:
        pass # Wait, let's just do it directly.

# Now let's handle the rest using regex or line keywords
for i, line in enumerate(lines):
    if 'showConfirm' in line and '?' in line:
        lines[i] = '      if (await showConfirm("คุณมีการกรอกข้อมูลค้างไว้ ต้องการย้อนกลับโดยไม่บันทึกใช่หรือไม่?")) {\n'
    elif 'items.length === 0' in line:
        lines[i] = '    if (items.length === 0) return void showAlert("กรุณาเพิ่มรายการที่ต้องการขอซื้อ");\n'
    elif 'showAlert(' in line and 'router.push' in lines[i+1] if i+1 < len(lines) else False:
        lines[i] = '    showAlert("ส่งขออนุมัติซื้อเรียบร้อยแล้ว");\n'
    elif 'PillButton' in line and 'variant="outline"' in line and 'onClick={handleBack}' in line:
        lines[i] = '            <PillButton variant="outline" onClick={handleBack} icon={ArrowLeft}>ยกเลิก</PillButton>\n'
    elif 'PillButton' in line and 'variant="primary"' in line and 'onClick={handleSave}' in line:
        lines[i] = '            <PillButton variant="primary" onClick={handleSave} icon={CheckCircle2}>ส่งขออนุมัติซื้อ</PillButton>\n'
    elif '<h1' in line and 'text-2xl font-bold' in line:
        lines[i] = '          <h1 className="text-2xl font-bold text-white tracking-tight">บันทึกใบขอซื้อ (New Purchase Request)</h1>\n'
    elif 'NexusDataField label=' in line and 'value={header.requester}' in line:
        lines[i] = '            <NexusDataField label="ผู้ยื่นคำขอซื้อ" value={header.requester} />\n'
    elif 'NexusDataField label=' in line and 'value={header.department}' in line:
        lines[i] = '            <NexusDataField label="หน่วยงาน / แผนก" value={header.department} />\n'
    elif 'NexusDatePicker label=' in line and 'value={header.requestDate}' in line:
        lines[i] = '            <NexusDatePicker label="วันที่ยื่นคำขอ" value={header.requestDate} onChange={(v) => setHeader({...header, requestDate: v})} />\n'
    elif 'SmartSelect label=' in line and 'value={header.priority}' in line:
        lines[i] = '            <SmartSelect label="ลำดับความสำคัญ" value={header.priority} onChange={(v) => setHeader({...header, priority: v})} options={[{value: "low", label: "LOW (ทั่วไป)"}, {value: "medium", label: "MEDIUM (ปกติ)"}, {value: "high", label: "HIGH (ด่วน)"}, {value: "urgent", label: "URGENT (ด่วนที่สุด)"}]} />\n'
    elif 'GlassCard title=' in line and 'icon={ShieldCheck}' in line:
        lines[i] = '        <GlassCard title="แนะนำผู้จำหน่าย (Suggested Vendor)" icon={ShieldCheck}>\n'
    elif 'SmartSelect label=' in line and 'value={vendorId}' in line:
        lines[i] = '            <SmartSelect label="ชื่อผู้จำหน่าย / คู่ค้า" value={vendorId} onChange={setVendorId} options={vendorOptions} placeholder="ค้นหาผู้จำหน่าย..." searchable />\n'
    elif 'NexusDataField label=' in line and 'value={vendorData.taxId}' in line:
        lines[i] = '                <NexusDataField label="เลขประจำตัวผู้เสียภาษี" value={vendorData.taxId} />\n'
    elif 'NexusDataField label=' in line and 'value={vendorData.creditTerms}' in line:
        lines[i] = '                <NexusDataField label="เครดิตเทอม" value={vendorData.creditTerms} />\n'
    elif 'NexusDataField label=' in line and 'value={vendorData.address}' in line:
        lines[i] = '                <NexusDataField label="ที่อยู่ / ข้อมูลติดต่อ" value={`${vendorData.address} (ติดต่อ: ${vendorData.contact})`} className="col-span-1 md:col-span-2" />\n'
    elif 'PillInput label=' in line and 'value={header.projectRef}' in line:
        lines[i] = '            <PillInput label="โครงการที่อ้างอิง" value={header.projectRef} onChange={(e) => setHeader({...header, projectRef: e.target.value})} placeholder="เช่น PRJ-26-001 (ถ้ามี)..." />\n'
    elif 'textarea' in line and 'value={header.reason}' in line:
        # We need to replace the placeholder inside the textarea
        pass
    elif 'GlassCard title=' in line and 'icon={FileUp}' in line:
        lines[i] = '        <GlassCard title="คลังเอกสารแนบอ้างอิง (Attachments)" icon={FileUp}>\n'
    elif 'text-white/40' in line and 'UploadCloud' in lines[i-1] if i-1 > 0 else False:
        lines[i] = '            <p className="text-sm font-medium text-white/40">ลากไฟล์วางที่นี่ หรือคลิกเพื่ออัปโหลด</p>\n'
    elif 'GlassCard title=' in line and 'icon={FileText}' in line:
        lines[i] = '            <GlassCard title="สรุปรายการคำขอซื้อ" icon={FileText}>\n'
    elif 'div className="text-sm text-white/40"' in line and 'PR-DRAFT' in lines[i+1] if i+1 < len(lines) else False:
        lines[i] = '                  <div className="text-sm text-white/40">เลขที่ PR</div>\n'
    elif 'text-white/40 text-xs' in line and 'Jane Smith' in lines[i+1] if i+1 < len(lines) else False:
        lines[i] = '                  <div className="text-white/40 text-xs uppercase tracking-wider mb-1">ผู้อนุมัติลำดับที่ 1</div>\n'
    elif 'value="exclude"' in line and 'label=' in line and 'vatMode' in line:
        lines[i] = '                  <SmartSelect label="VAT Mode" value={vatMode} onChange={(v: any) => setVatMode(v)} options={[{value:"none", label:"ไม่มี VAT"}, {value:"exclude", label:"ก่อน VAT"}, {value:"include", label:"รวม VAT"}]} />\n'
    elif 'value="0"' in line and 'label=' in line and 'whtRate' in line:
        lines[i] = '                  <SmartSelect label="WHT Rate" value={whtRate.toString()} onChange={(v: any) => setWhtRate(Number(v))} options={[{value:"0", label:"ไม่หัก WHT"}, {value:"1", label:"1%"}, {value:"3", label:"3%"}, {value:"5", label:"5%"}]} />\n'
    elif 'text-white/60 text-sm' in line and 'subtotal' in line.lower() if i < len(lines) else False:
        if 'มูลค่ารวม' not in line:
            lines[i] = lines[i].replace(lines[i].split('>')[1].split('<')[0], 'มูลค่ารวม (Subtotal)')
    elif 'text-white/60 text-sm' in line and 'vat' in line.lower() and '7%' in line:
        if 'ภาษีมูลค่าเพิ่ม' not in line:
            lines[i] = lines[i].replace(lines[i].split('>')[1].split('<')[0], 'ภาษีมูลค่าเพิ่ม (VAT 7%)')
    elif 'text-white/60 text-sm' in line and 'wht' in line.lower() and 'rate' in line.lower():
        if 'หัก ณ ที่จ่าย' not in line:
            lines[i] = '                    <div className="text-white/60 text-sm">หัก ณ ที่จ่าย (WHT {whtRate}%)</div>\n'
    elif 'text-cyan-400 font-bold' in line:
        lines[i] = '                    <div className="text-cyan-400 font-bold">ยอดสุทธิ (Grand Total)</div>\n'
    elif 'text-xs text-white/40 flex' in line and 'AlertTriangle' in lines[i-1] if i-1 > 0 else False:
        lines[i] = '                  <p className="text-xs text-white/40 flex-1 leading-relaxed">ใบขอซื้อนี้ต้องได้รับการอนุมัติจากหัวหน้าแผนกก่อนเข้าสู่กระบวนการจัดซื้อ</p>\n'
    elif 'textarea' in line and 'value={header.reason}' in line:
        lines[i] = '              <textarea className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 min-h-[100px] resize-none" placeholder="ระบุเหตุผลความจำเป็นในการจัดซื้อครั้งนี้..." value={header.reason} onChange={(e) => setHeader({...header, reason: e.target.value})} />\n'
    elif 'useRealtimeCollection(\'suppliers\')' in line:
        lines[i] = '    // ใช้อ้างอิงแทนการต่อ useRealtimeCollection(\'suppliers\')\n'
    elif 'ยังไม่มี' in line or 'เธขเธฑเธ‡เน„เธกเนˆเธกเธตเน„เธŸเธฅเนŒเน เธ™เธš' in line:
        lines[i] = '            <div className="text-center py-8 text-white/30 text-sm">ยังไม่มีไฟล์แนบ</div>\n'

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("DONE")
