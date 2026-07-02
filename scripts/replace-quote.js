const fs = require('fs');

let filePath = 'd:/NEXUS-ERP/src/app/(authenticated)/sales/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

let replaceWith = `<div className="space-y-4 text-xs font-medium text-white/70">
                   <div className="flex items-center gap-3">
                     <Building2 size={16} className="text-nexus-teal shrink-0" />
                     <span>ลูกค้า: <span className="text-white">{selectedItem.customer || selectedItem.customerNameRaw || selectedItem.customerId || "-"}</span></span>
                   </div>
                   <div className="flex items-center gap-3">
                     <User size={16} className="text-nexus-blue shrink-0" />
                     <span>พนักงานขาย: {selectedItem.salesPerson || "-"}</span>
                   </div>
                   <div className="flex items-center gap-3">
                     <CalendarDays size={16} className="text-white/40 shrink-0" />
                     <span>วันที่เอกสาร: {selectedItem.date || selectedItem.issueDate || "-"}</span>
                   </div>
                   <div className="flex items-center gap-3">
                     <ShieldCheck size={16} className="text-warning shrink-0" />
                     <span>ยืนราคาถึง: {selectedItem.validUntil || selectedItem.expiryDate || "-"}</span>
                   </div>
                   <div className="flex items-center gap-3">
                     <RefreshCw size={16} className="text-nexus-purple shrink-0" />
                     <span>เครดิตเทอม: {selectedItem.paymentTerms || selectedItem.credit_term || "-"}</span>
                   </div>
                   <div className="flex items-center gap-3">
                     <Percent size={16} className="text-white/40 shrink-0" />
                     <span>รูปแบบภาษี: {selectedItem.taxMode || selectedItem.vat_type || "-"}</span>
                   </div>
                   <div className="flex items-center gap-3">
                     <ClipboardList size={16} className="text-nexus-teal shrink-0" />
                     <span>จำนวนรายการ: {selectedItem.items?.length || 0} รายการ</span>
                   </div>
                   <div className="flex items-center gap-3 pt-3 border-t border-white/5">
                     <CreditCard size={16} className="text-nexus-blue shrink-0" />
                     <span className="font-mono text-[14px] text-white">ยอดสุทธิ: {selectedItem.value || "0.00"}</span>
                   </div>
                </div>`;

let startIdx = content.indexOf('<div className="space-y-4 text-xs font-medium text-white/70">', content.indexOf('activeTab === "quotations" && selectedItem'));
let endIdx = content.indexOf('</div>', content.indexOf('<span>ผู้สร้าง: {selectedItem.salesPerson || "-"}</span>', startIdx)) + 6;

if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
    let before = content.slice(0, startIdx);
    let after = content.slice(endIdx);
    fs.writeFileSync(filePath, before + replaceWith + after, 'utf8');
    console.log("Successfully replaced using index slicing!");
} else {
    console.log("Indices not found", startIdx, endIdx);
}
