"use client";

import React, { useState } from "react";
import { 
  X, 
  Save, 
  Eye, 
  Layout, 
  Type, 
  Image as ImageIcon,
  CheckCircle2,
  Columns,
  Type as FontIcon,
  AlignLeft
} from "lucide-react";
import { 
  PillButton, 
  PillInput, 
  Modal, 
  cn, 
  GlassCard,
  PillTabs,
  NexusDataField
} from "@/components/ui/Base";

interface TemplateArchitectModalProps {
  isOpen: boolean;
  onClose: () => void;
  templateName: string;
}

export function TemplateArchitectModal({ isOpen, onClose, templateName }: TemplateArchitectModalProps) {
  const [activeTab, setActiveTab] = useState("layout");
  const [config, setConfig] = useState({
    showLogo: true,
    logoAlign: "left",
    headerFontSize: 24,
    showTaxId: true,
    showBankInfo: true,
    columns: ["ITEM", "QTY", "UNIT", "PRICE", "TOTAL"],
    footerNote: "ขอบคุณที่ไว้วางใจในบริการของเรา",
    signatureCount: 2
  });

  const tabs = [
    { id: "layout", label: "โครงสร้าง", icon: <Layout size={14} /> },
    { id: "content", label: "เนื้อหา", icon: <Type size={14} /> },
    { id: "preview", label: "ตัวอย่าง", icon: <Eye size={14} /> },
  ];

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={`ออกแบบต้นแบบ: ${templateName}`}
      maxWidth="max-w-[1600px]"
    >
      <div className="flex h-[80vh] divide-x divide-white/5 bg-surface-0">
        {/* Left: Control Panel */}
        <div className="w-[450px] flex flex-col p-8 bg-surface-1 flex-shrink-0">
           <div className="flex-1 space-y-10 overflow-y-auto custom-scrollbar pr-4">
              <div className="space-y-1">
                 <p className="text-[10px] font-semibold text-nexus-teal uppercase tracking-[0.2em]">Neural Template Engine</p>
                 <h4 className="text-xl font-semibold text-white uppercase tracking-tight">แผงควบคุมสถาปนิก</h4>
              </div>

              <PillTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

              {activeTab === "layout" && (
                <div className="space-y-8 animate-in fade-in duration-500">
                   <div className="space-y-4">
                      <div className="flex items-center gap-3 text-white/40"><ImageIcon size={16} /><span className="text-[11px] font-semibold uppercase tracking-widest">ส่วนหัวเอกสาร</span></div>
                      <div className="grid grid-cols-2 gap-3">
                         <ConfigToggle label="แสดงโลโก้บริษัท" active={config.showLogo} onClick={() => setConfig({...config, showLogo: !config.showLogo})} />
                         <ConfigToggle label="แสดงเลขผู้เสียภาษี" active={config.showTaxId} onClick={() => setConfig({...config, showTaxId: !config.showTaxId})} />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-semibold text-white/20 uppercase tracking-widest ml-1">การวางตำแหน่งโลโก้</label>
                         <div className="flex gap-2">
                            {["left", "center", "right"].map(pos => (
                               <button 
                                 key={pos}
                                 onClick={() => setConfig({...config, logoAlign: pos})}
                                 className={cn(
                                   "flex-1 py-2 rounded-lg border text-[10px] font-black uppercase transition-all",
                                   config.logoAlign === pos ? "bg-nexus-teal/20 border-nexus-teal/40 text-nexus-teal" : "bg-white/5 border-white/5 text-white/20 hover:text-white"
                                 )}
                               >
                                 {pos}
                               </button>
                            ))}
                         </div>
                      </div>
                   </div>

                   <div className="space-y-4">
                      <div className="flex items-center gap-3 text-white/40"><Columns size={16} /><span className="text-[11px] font-semibold uppercase tracking-widest">ตารางข้อมูล</span></div>
                      <div className="grid grid-cols-2 gap-3">
                         {["ITEM", "QTY", "UNIT", "PRICE", "DISCOUNT", "TAX", "TOTAL"].map(col => (
                           <ConfigToggle 
                             key={col} 
                             label={col} 
                             active={config.columns.includes(col)} 
                             onClick={() => {
                               const newCols = config.columns.includes(col) 
                                 ? config.columns.filter(c => c !== col) 
                                 : [...config.columns, col];
                               setConfig({...config, columns: newCols});
                             }} 
                           />
                         ))}
                      </div>
                   </div>
                </div>
              )}

              {activeTab === "content" && (
                <div className="space-y-8 animate-in fade-in duration-500">
                   <div className="space-y-4">
                      <div className="flex items-center gap-3 text-white/40"><AlignLeft size={16} /><span className="text-[11px] font-semibold uppercase tracking-widest">หมายเหตุท้ายเอกสาร</span></div>
                      <textarea 
                        className="w-full h-32 rounded-xl bg-white/[0.03] border border-white/10 text-white text-sm p-4 focus:outline-none focus:border-nexus-teal/40 transition-all"
                        value={config.footerNote}
                        onChange={(e) => setConfig({...config, footerNote: e.target.value})}
                      />
                   </div>
                   <div className="space-y-4">
                      <div className="flex items-center gap-3 text-white/40"><CheckCircle2 size={16} /><span className="text-[11px] font-semibold uppercase tracking-widest">การเซ็นอนุมัติ</span></div>
                      <div className="flex items-center justify-between">
                         <span className="text-[11px] font-semibold text-white/30 uppercase">จำนวนช่องลงนาม</span>
                         <div className="flex gap-2">
                            {[1, 2, 3].map(n => (
                               <button 
                                 key={n}
                                 onClick={() => setConfig({...config, signatureCount: n})}
                                 className={cn(
                                   "w-8 h-8 rounded-lg border flex items-center justify-center text-xs font-black transition-all",
                                   config.signatureCount === n ? "bg-nexus-blue/20 border-nexus-blue/40 text-nexus-blue" : "bg-white/5 border-white/5 text-white/20"
                                 )}
                               >
                                 {n}
                               </button>
                            ))}
                         </div>
                      </div>
                   </div>
                </div>
              )}
           </div>

           <div className="pt-8 border-t border-white/5 space-y-4">
              <PillButton className="w-full shadow-neon-teal" onClick={() => { onClose(); }}>
                 <Save size={18} /> บันทึกและนำไปใช้
              </PillButton>
              <PillButton variant="ghost" className="w-full hover:" onClick={onClose}>
                 ยกเลิก
              </PillButton>
           </div>
        </div>

        {/* Right: Live Preview */}
        <div className="flex-1 bg-surface-1 p-12 overflow-y-auto custom-scrollbar flex items-start justify-center">
           <div className="w-[800px] bg-white text-black min-h-[1100px] shadow-2xl p-16 origin-top transform transition-transform duration-500 scale-95 hover:scale-100">
              {/* Document Header */}
              <div className={cn("flex flex-col gap-6", config.logoAlign === "center" ? "items-center text-center" : config.logoAlign === "right" ? "items-end text-right" : "items-start text-left")}>
                 {config.showLogo && (
                   <div className="w-32 h-16 bg-gray-200 rounded flex items-center justify-center text-[10px] font-bold text-gray-400 uppercase border-2 border-dashed border-gray-300">
                      LOGO PLACEHOLDER
                   </div>
                 )}
                 <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight">PSG SOLUTIONS CO., LTD.</h1>
                    <p className="text-xs text-gray-500">1/1 Vibhavadi Rangsit Rd, Chatuchak, Bangkok 10900</p>
                    {config.showTaxId && <p className="text-xs text-gray-800 font-bold">TAX ID: 0105564000000</p>}
                 </div>
              </div>

              <div className="mt-12 flex justify-between items-end border-b-2 border-black pb-4">
                 <h2 className="text-2xl font-semibold uppercase tracking-tighter">{templateName.split(" (")[0]}</h2>
                 <div className="text-right">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Document No.</p>
                    <p className="text-sm font-bold">QT-2026-XXXX</p>
                 </div>
              </div>

              {/* Table Preview */}
              <table className="w-full mt-10 border-collapse">
                 <thead>
                    <tr className="bg-gray-100 border-y border-gray-200">
                       {config.columns.map(col => (
                         <th key={col} className="p-3 text-[10px] font-semibold text-gray-600 text-left uppercase tracking-widest">{col}</th>
                       ))}
                    </tr>
                 </thead>
                 <tbody>
                    <tr className="border-b border-gray-100">
                       {config.columns.map(col => (
                         <td key={col} className="p-4 text-xs text-gray-400 italic">Example {col} Data...</td>
                       ))}
                    </tr>
                    <tr className="border-b border-gray-100">
                       {config.columns.map(col => (
                         <td key={col} className="p-4 text-xs text-gray-400 italic">Example {col} Data...</td>
                       ))}
                    </tr>
                 </tbody>
              </table>

              {/* Footer Preview */}
              <div className="mt-20 grid grid-cols-2 gap-20">
                 <div className="space-y-4">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase">Terms & Notes</p>
                    <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{config.footerNote}</p>
                 </div>
                 <div className="flex flex-col gap-10">
                    {Array.from({length: config.signatureCount}).map((_, i) => (
                      <div key={i} className="border-b border-black pb-2 text-center">
                         <p className="text-[10px] font-bold text-gray-400 uppercase mt-10">Authorized Signature {i + 1}</p>
                      </div>
                    ))}
                 </div>
              </div>

              <div className="mt-auto pt-20 flex justify-center opacity-20 grayscale">
                 <p className="text-[8px] font-mono">POWERED BY NEXUS ERP INTELLIGENCE OS • MASTER_PROT_V3.1</p>
              </div>
           </div>
        </div>
      </div>
    </Modal>
  );
}

function ConfigToggle({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "p-3 rounded-xl border flex items-center justify-between transition-all",
        active ? "bg-nexus-teal/10 border-nexus-teal/30 text-white" : "bg-white/[0.02] border-white/5 text-white/20 hover:text-white/40"
      )}
    >
      <span className="text-[10px] font-semibold uppercase tracking-widest">{label}</span>
      <div className={cn(
        "w-4 h-4 rounded-full border flex items-center justify-center transition-all",
        active ? "bg-nexus-teal border-nexus-teal" : "bg-transparent border-white/10"
      )}>
        {active && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
      </div>
    </button>
  );
}
