const fs = require('fs');

let content = fs.readFileSync('src/app/(authenticated)/procurement/requests/new/page.tsx', 'utf-8');

// The file currently has some messed up replacements from the byte script, e.g. "รพสเธฅดพ", "เธšเธฑเธ™ทเธถพเนƒเธšชเธญเธ‹เธทเน‰เธญ"
// So we just replace using regex of the surrounding English code.

content = content.replace(
  /<h1 className="text-xl font-black uppercase tracking-tight text-white">.*?<\/h1>/g,
  '<h1 className="text-xl font-black uppercase tracking-tight text-white">บันทึกใบขอซื้อ (New Purchase Request)</h1>'
);

content = content.replace(
  /<PillButton variant="ghost" className="h-9 px-6 rounded-full text-white\/50 hover:text-white" onClick=\{handleBack\}>\s*.*?\s*<\/PillButton>/g,
  '<PillButton variant="ghost" className="h-9 px-6 rounded-full text-white/50 hover:text-white" onClick={handleBack}>\n          ยกเลิก\n        </PillButton>'
);

content = content.replace(
  /<ShieldCheck size=\{14\} className="mr-2" \/>.*?<\/PillButton>/s,
  '<ShieldCheck size={14} className="mr-2" /> ส่งขออนุมัติซื้อ\n        </PillButton>'
);

content = content.replace(
  /<Field label=".*?">(\s*<PillInput value=\{header\.requester\})/s,
  '<Field label="ผู้ยื่นคำขอซื้อ">$1'
);

content = content.replace(
  /<Field label=".*?">(\s*<PillSelect\s*value=\{header\.department\})/s,
  '<Field label="หน่วยงาน / แผนก">$1'
);

content = content.replace(
  /<Field label=".*?">(\s*<NexusDatePicker value=\{header\.requestDate\})/s,
  '<Field label="วันที่ยื่นคำขอ">$1'
);

content = content.replace(
  /<Field label=\{<>.*? <span className="text-danger font-bold">\*<\/span><\/>\}>(\s*<NexusDatePicker value=\{header\.requiredDate\})/s,
  '<Field label={<>วันที่ต้องการใช้งาน <span className="text-danger font-bold">*</span></>}>$1'
);

content = content.replace(
  /<Field label=".*?">(\s*<PillSelect\s*value=\{header\.priority\})/s,
  '<Field label="ลำดับความสำคัญ">$1'
);

// priority options
content = content.replace(/<option value="low">.*?<\/option>/, '<option value="low">LOW (ทั่วไป)</option>');
content = content.replace(/<option value="medium">.*?<\/option>/, '<option value="medium">MEDIUM (ปกติ)</option>');
content = content.replace(/<option value="high">.*?<\/option>/, '<option value="high">HIGH (ด่วน)</option>');
content = content.replace(/<option value="urgent">.*?<\/option>/, '<option value="urgent">URGENT (ด่วนที่สุด)</option>');


fs.writeFileSync('src/app/(authenticated)/procurement/requests/new/page.tsx', content, 'utf-8');
console.log("DONE");
