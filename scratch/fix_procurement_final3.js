const fs = require('fs');

let content = fs.readFileSync('src/app/(authenticated)/procurement/requests/new/page.tsx', 'utf-8');

// The file still has mojibake. We use regex to replace entire blocks by matching surrounding code.

content = content.replace(
  /const vendorOptions = \[\s*\{ value: "VD-001", label: ".*?", description: "Tax: 0105559012345" \},\s*\{ value: "VD-002", label: ".*?", description: "Tax: 0103550012346" \}\s*\];/s,
  `const vendorOptions = [
  { value: "VD-001", label: "บริษัท อุปกรณ์ไอที จำกัด (มหาชน)", description: "Tax: 0105559012345" },
  { value: "VD-002", label: "หจก. รับเหมาเครือข่ายไทย", description: "Tax: 0103550012346" }
];`
);

content = content.replace(
  /if \(vendorId === "VD-001"\) \{\s*setVendorData\(\{ address: "123 .*?", taxId: "0105559012345", creditTerms: "30 Days", contact: ".*?" \}\);\s*\} else if \(vendorId === "VD-002"\) \{\s*setVendorData\(\{ address: "456 .*?", taxId: "0103550012346", creditTerms: "15 Days", contact: ".*?" \}\);/s,
  `if (vendorId === "VD-001") {
      setVendorData({ address: "123 ถ.สุขุมวิท กรุงเทพฯ", taxId: "0105559012345", creditTerms: "30 Days", contact: "คุณสมชาย" });
    } else if (vendorId === "VD-002") {
      setVendorData({ address: "456 ถ.รัชดาฯ กรุงเทพฯ", taxId: "0103550012346", creditTerms: "15 Days", contact: "คุณวิเชียร" });`
);

content = content.replace(
  /const tabs = \[\s*\{ id: "header", label: ".*?" \},\s*\{ id: "items", label: ".*?" \}\s*\];/s,
  `const tabs = [
    { id: "header", label: "ข้อมูลพื้นฐานการขอซื้อ" },
    { id: "items", label: "รายการพัสดุและบริการ" }
  ];`
);

content = content.replace(
  /if \(await showConfirm\(".*?"\)\) \{/s,
  `if (await showConfirm("คุณมีการกรอกข้อมูลค้างไว้ ต้องการย้อนกลับโดยไม่บันทึกใช่หรือไม่?")) {`
);

content = content.replace(
  /if \(items\.length === 0\) return void showAlert\(".*?"\);/s,
  `if (items.length === 0) return void showAlert("กรุณาเพิ่มรายการที่ต้องการขอซื้อ");`
);

content = content.replace(
  /showAlert\(".*?"\);\s*router\.push\("\/procurement"\);/s,
  `showAlert("ส่งขออนุมัติซื้อเรียบร้อยแล้ว");
    router.push("/procurement");`
);

content = content.replace(
  /<Field label=".*?">(\s*<SmartSelect\s*value=\{vendorId\})/s,
  '<Field label="ชื่อผู้จำหน่าย / คู่ค้า">$1'
);

content = content.replace(
  /placeholder=".*?"(\s*className="h-11 rounded-full text-\[13px\] font-bold px-4"\s*\/>\s*<\/Field>)/s,
  'placeholder="ค้นหาผู้จำหน่าย..."$1'
);

content = content.replace(
  /<Field label=".*?">(\s*<PillInput value=\{vendorData\.taxId\})/s,
  '<Field label="เลขประจำตัวผู้เสียภาษี">$1'
);

content = content.replace(
  /<Field label=".*?">(\s*<PillInput value=\{vendorData\.creditTerms\})/s,
  '<Field label="เครดิตเทอม">$1'
);

content = content.replace(
  /<Field label=".*?">(\s*<PillInput value=\{\`\$\{vendorData\.address\} \(.*?: \$\{vendorData\.contact\}\)\`\})/s,
  '<Field label="ที่อยู่ / ข้อมูลติดต่อ">\n                  <PillInput value={`${vendorData.address} (ติดต่อ: ${vendorData.contact})`}'
);

content = content.replace(
  /<Field label=".*?">(\s*<PillInput\s*value=\{header\.projectRef\})/s,
  '<Field label="โครงการที่อ้างอิง">$1'
);

content = content.replace(
  /placeholder=".*?"(\s*\/>\s*<\/Field>)/s,
  'placeholder="เช่น PRJ-26-001 (ถ้ามี)..."$1'
);

content = content.replace(
  /placeholder=".*?"(\s*value=\{header\.reason\})/s,
  'placeholder="ระบุเหตุผลความจำเป็นในการจัดซื้อครั้งนี้..."$1'
);

content = content.replace(
  /<div className="text-sm text-white\/40">.*?<\/div>\s*<div className="font-mono text-xl font-bold text-white uppercase tracking-wider">PR-DRAFT<\/div>/s,
  `<div className="text-sm text-white/40">เลขที่ PR</div>
                  <div className="font-mono text-xl font-bold text-white uppercase tracking-wider">PR-DRAFT</div>`
);

content = content.replace(
  /<div className="text-white\/40 text-xs uppercase tracking-wider mb-1">.*?<\/div>\s*<div className="text-sm font-bold text-white">Jane Smith<\/div>/s,
  `<div className="text-white/40 text-xs uppercase tracking-wider mb-1">ผู้อนุมัติลำดับที่ 1</div>
                  <div className="text-sm font-bold text-white">Jane Smith</div>`
);

content = content.replace(
  /<SmartSelect\s*value=\{vatMode\}\s*onChange=\{\(v: any\) => setVatMode\(v\)\}\s*options=\{\[\{value:"none", label:".*?"\}, \{value:"exclude", label:".*?"\}, \{value:"include", label:".*?"\}\]\}/s,
  `<SmartSelect 
                    value={vatMode} 
                    onChange={(v: any) => setVatMode(v)} 
                    options={[{value:"none", label:"ไม่มี VAT"}, {value:"exclude", label:"ก่อน VAT"}, {value:"include", label:"รวม VAT"}]}`
);

content = content.replace(
  /<SmartSelect\s*value=\{whtRate\.toString\(\)\}\s*onChange=\{\(v: any\) => setWhtRate\(Number\(v\)\)\}\s*options=\{\[\{value:"0", label:".*?"\}, \{value:"1", label:"1%"}, \{value:"3", label:"3%"}, \{value:"5", label:"5%"\}\]\}/s,
  `<SmartSelect 
                    value={whtRate.toString()} 
                    onChange={(v: any) => setWhtRate(Number(v))} 
                    options={[{value:"0", label:"ไม่หัก WHT"}, {value:"1", label:"1%"}, {value:"3", label:"3%"}, {value:"5", label:"5%"}]}`
);

content = content.replace(
  /<div className="text-white\/60 text-sm">.*?<\/div>\s*<div className="font-mono text-white text-base">฿ \{subtotal\.toLocaleString\(\)\}<\/div>/s,
  `<div className="text-white/60 text-sm">มูลค่ารวม (Subtotal)</div>
                    <div className="font-mono text-white text-base">฿ {subtotal.toLocaleString()}</div>`
);

content = content.replace(
  /<div className="text-white\/60 text-sm">.*?<\/div>\s*<div className="font-mono text-white text-base">฿ \{vatAmount\.toLocaleString\(\)\}<\/div>/s,
  `<div className="text-white/60 text-sm">ภาษีมูลค่าเพิ่ม (VAT 7%)</div>
                    <div className="font-mono text-white text-base">฿ {vatAmount.toLocaleString()}</div>`
);

content = content.replace(
  /<div className="text-white\/60 text-sm">.*?<\/div>\s*<div className="font-mono text-white text-base text-danger">- ฿ \{whtAmount\.toLocaleString\(\)\}<\/div>/s,
  `<div className="text-white/60 text-sm">หัก ณ ที่จ่าย (WHT {whtRate}%)</div>
                    <div className="font-mono text-white text-base text-danger">- ฿ {whtAmount.toLocaleString()}</div>`
);

content = content.replace(
  /<div className="text-cyan-400 font-bold">.*?<\/div>\s*<div className="font-mono text-cyan-400 text-2xl font-black">฿ \{grandTotal\.toLocaleString\(\)\}<\/div>/s,
  `<div className="text-cyan-400 font-bold">ยอดสุทธิ (Grand Total)</div>
                    <div className="font-mono text-cyan-400 text-2xl font-black">฿ {grandTotal.toLocaleString()}</div>`
);

content = content.replace(
  /<p className="text-xs text-white\/40 flex-1 leading-relaxed">.*?<\/p>/s,
  '<p className="text-xs text-white/40 flex-1 leading-relaxed">ใบขอซื้อนี้ต้องได้รับการอนุมัติจากหัวหน้าแผนกก่อนเข้าสู่กระบวนการจัดซื้อ</p>'
);

content = content.replace(
  /<h2 className="text-lg font-black text-white uppercase tracking-tight">.*?<\/h2>/s,
  '<h2 className="text-lg font-black text-white uppercase tracking-tight">แนะนำผู้จำหน่าย (Suggested Vendor)</h2>'
);

content = content.replace(
  /<h2 className="text-lg font-black text-white uppercase tracking-tight">.*?<\/h2>\s*(<div className="p-4 bg-white\/\[0\.02\] rounded-2xl border border-white\/5 flex items-center justify-center min-h-\[120px\]">)/s,
  '<h2 className="text-lg font-black text-white uppercase tracking-tight">คลังเอกสารแนบอ้างอิง (Attachments)</h2>\n            $1'
);

content = content.replace(
  /<p className="text-sm font-medium text-white\/40">.*?<\/p>\s*<\/div>\s*<\/div>\s*<\/div>/s,
  '<p className="text-sm font-medium text-white/40">ลากไฟล์วางที่นี่ หรือคลิกเพื่ออัปโหลด</p>\n                </div>\n              </div>\n            </div>'
);

content = content.replace(
  /<h2 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">.*?<\/h2>/s,
  '<h2 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">สรุปรายการคำขอซื้อ</h2>'
);

content = content.replace(
  /\/\/ .*? useRealtimeCollection\('suppliers'\)/s,
  `// ใช้อ้างอิงแทนการต่อ useRealtimeCollection('suppliers')`
);

fs.writeFileSync('src/app/(authenticated)/procurement/requests/new/page.tsx', content, 'utf-8');
console.log("DONE");
