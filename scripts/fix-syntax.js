const fs = require('fs');

let filePath = 'd:/NEXUS-ERP/src/app/(authenticated)/sales/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// I know that the previous script messed up the PillButton. Let's fix the entire block.
// Let's find the exact block around line 547
let anchor = `<span className="font-mono text-[14px] text-white">ยอดสุทธิ: {selectedItem.value || "0.00"}</span>
                   </div>`;

let correctBlock = `<span className="font-mono text-[14px] text-white">ยอดสุทธิ: {selectedItem.value || "0.00"}</span>
                   </div>
                </div>

                <div className="mt-6 pt-6 border-t border-white/10 flex flex-col gap-3">
                   <PillButton size="sm" variant="glass" onClick={() => setActiveModal("quotation")} className="w-full border-white/20 hover:border-nexus-teal shadow-none">
                     <FileText size={14} className="mr-2" />
                     ดู / แก้ไขใบเสนอราคา
                   </PillButton>
                   <PillButton size="sm" variant="glass" onClick={() => setSelectedItem(null)} className="w-full border-white/20 text-white/40 shadow-none">
                     ปิดหน้าต่าง
                   </PillButton>
                </div>
             </GlassCard>
           ) : activeTab === "orders" && selectedItem ? (`;

// We just replace everything between the anchor and activeTab === "orders" with the correctBlock
let startIndex = content.indexOf(anchor);
if(startIndex !== -1) {
    let endIndex = content.indexOf(') : activeTab === "orders" && selectedItem ? (', startIndex);
    if(endIndex !== -1) {
        let before = content.slice(0, startIndex);
        let after = content.slice(endIndex);
        fs.writeFileSync(filePath, before + correctBlock + after, 'utf8');
        console.log("Restored successfully!");
    } else {
        console.log("Could not find endIndex");
    }
} else {
    console.log("Could not find anchor");
}
