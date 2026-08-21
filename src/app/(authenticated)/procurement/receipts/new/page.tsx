"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSystemDialog } from "@/context/DialogContext";
import { 
  Truck, 
  Plus, 
  Trash2, 
  ShieldCheck, 
  Package, 
  Search,
  FileText,
  Warehouse,
  Barcode,
  CheckCircle2,
  X,
  ArrowLeft
} from "lucide-react";
import { 
  PillButton, 
  PillInput, 
  PillSelect, 
  PillTabs, 
  NexusDataField, 
  cn, 
  NexusDatePicker,
  GlassCard
} from "@/components/ui/Base";
import { auditService } from "@/services/audit.service";
import { db } from "@/lib/firebase-client";
import { doc, collection, setDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { DocumentStepper } from "@/components/ui/DocumentStepper";

export default function NewGoodsReceiptPage() {
  const router = useRouter();
  const { user, companyId: currentCompanyId } = useAuth();

  const { showAlert, showConfirm } = useSystemDialog();

  const [activeTab, setActiveTab] = useState("header");
  const [items, setItems] = useState<any[]>([]);
  const [header, setHeader] = useState({
    poRef: "",
    supplier: "",
    receiptDate: new Date().toISOString().split('T')[0],
    deliveryNote: "",
    receivedBy: "Kriangkrai M.",
    warehouse: "Main Warehouse (Bangkok)"
  });

  const tabs = [
    { id: "header", label: "เธเนเธญเธกเธนเธฅเธเธฒเธฃเธฃเธฑเธเธชเธดเธเธเนเธฒ (Header)" },
    { id: "items", label: "เธฃเธฒเธขเธเธฒเธฃเธเธฑเธชเธ”เธธเนเธฅเธฐ Serial" }
  ];

  const isDirty = items.length > 0 || header.poRef !== "" || header.deliveryNote !== "";

  const handleBack = async () => {
    if (isDirty) {
      if (await showConfirm("เธเธธณมีเธเธฒเธฃเธเธฃเธญเธเธเนเธญเธกเธนเธฅเธเนเธฒเธเนเธงเน เธ•เนเธญเธเธเธฒเธฃเธขเธเน€เธฅเธดเธเนเธฅเธฐเธขเนเธญเธเธเธฅเธฑเธเนเธ”เธขเนเธกเนเธเธฑเธเธ—เธถเธหรือเนเธกเน?")) {
        router.back();
      }
    } else {
      router.back();
    }
  };

  // Mock loading items from PO
  const loadPOItems = () => {
    if (!header.poRef) return void showAlert("เธเธฃเธธณเธฒเธฃเธฐเธเธธเน€เธฅเธเธ—เธตเนเนเธเธชเธฑเนเธเธเธทเนอ");
    setItems([
      { id: 1, name: "Aruba AP-505", qtyOrdered: 10, qtyReceived: 10, unit: "Unit", warehouse: "Main", serials: "" },
      { id: 2, name: "CAT6 Cable 305m", qtyOrdered: 5, qtyReceived: 5, unit: "Roll", warehouse: "Main", serials: "" }
    ]);
    setHeader({...header, supplier: "Aruba Global (Thailand)"});
    showAlert("เธ”เธถเธเธเนเธญเธกเธนเธฅเธเธฒเธ PO เธชเธณเน€เธฃเนเธ", "System Notification", "info");
  };

  const updateItem = (id: number, field: string, value: any) => {
    setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const handleSave = async () => {
    if (items.length === 0) return void showAlert("เธเธฃเธธณเธฒเธฃเธฐเธเธธเน€เธฅเธเธ—เธตเนเนเธเธชเธฑเนเธเธเธทเนเธญเนเธฅเธฐเธ•เธฃเธงเธเธชเธญเธเธฃเธฒเธขเธเธฒเธฃเธเธฑเธชเธ”เธธเธเนเธญเธเธเธฑเธเธ—เธถเธ");
    if (!user || !currentCompanyId) return;
    
    try {
      const data = { header, items };
      const grRef = doc(collection(db, "goodsReceipts"));
      await setDoc(grRef, {
        ...data,
        companyId: currentCompanyId,
        status: "received",
        createdAt: serverTimestamp()
      });
      await auditService.logCreate(user.uid, currentCompanyId, "PROCURE_GR", "NEW", data);
      
      showAlert(`เธเธฑเธเธ—เธถเธเธเธฒเธฃเธฃเธฑเธเธชเธดเธเธเนเธฒเน€เธฃเธตเธขเธเธฃเนเธญเธขเนเธฅเนว`, "System Notification", "info");
      router.push("/procurement");
    } catch (err: any) {
      console.error(err);
      showAlert(`เธเธดเธเธเนเธเนเธญเธกเธนเธฅเธฅเนมเหลว: ${err.message}`, "System Notification", "error");
    }
  };

  const headerContent = (
    <>
      <div className="flex items-center gap-4">
        <button onClick={handleBack} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] text-white/50 hover:text-white transition-all backdrop-blur-sm">
          <ArrowLeft size={18} />
        </button>
        <div>
          <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-0.5">GR_PROT_V3.0</p>
          <div className="flex items-center">
            <h1 className="text-xl font-black uppercase tracking-tight text-white">เธเธฑเธเธ—เธถเธเธฃเธฑเธเธชเธดเธเธเนเธฒ (Goods Receipt)</h1>
            <DocumentStepper steps={["Draft", "Pending", "Received"]} currentStep={0} />
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <PillTabs 
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
        <PillButton variant="ghost" className="h-9 px-6 rounded-full text-white/50 hover:text-white" onClick={handleBack}>
          เธขเธเน€เธฅเธดเธ
        </PillButton>
        <PillButton className="h-9 px-6 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 shadow-[0_0_12px_rgba(6,182,212,0.15)]" onClick={handleSave}>
          <ShieldCheck size={14} className="mr-2" /> เธขเธทเธเธขเธฑเธเธฃเธฑเธเธชเธดเธเธเนา
        </PillButton>
      </div>
    </>
  );

  const leftContent = (
    <div className="space-y-6">
      {activeTab === "header" && (
        <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 shadow-2xl space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Field label="เน€เธฅเธเธ—เธตเนเนเธเธชเธฑเนเธเธเธทเนเธญเธญเนเธฒเธเธญเธดเธ * (PO Reference)" required>
              <div className="flex gap-2 w-full">
                <div className="relative flex-1">
                   <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-white/10" size={16} />
                   <PillInput 
                     value={header.poRef}
                     onChange={(e) => setHeader({...header, poRef: e.target.value})}
                     placeholder="เน€เธเนเธ PO-2604-001" 
                     className="w-full pl-10 h-11 px-6 rounded-full font-mono text-white/90 bg-white/[0.02]" 
                   />
                </div>
                <PillButton onClick={loadPOItems} className="px-6 h-11 rounded-full shadow-[0_0_12px_rgba(6,182,212,0.15)] bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                   <Search size={16} className="mr-2" />
                   เธ”เธถเธเธเนอมูล
                </PillButton>
              </div>
            </Field>
            <Field label="เธเธทเนเธญเธเธนเนเธเธณเธซเธเนเธฒเธข (Supplier)">
               <PillInput value={header.supplier} disabled className="w-full h-11 px-6 rounded-full bg-white/[0.01] text-white/40 font-bold border-white/5 cursor-not-allowed" />
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Field label="เธงเธฑเธเธ—เธตเนเธฃเธฑเธเธชเธดเธเธเนเธฒ (Receipt Date)">
               <NexusDatePicker 
                value={header.receiptDate}
                onChange={(e) => setHeader({...header, receiptDate: e.target.value})}
                className="w-full h-11 font-bold text-[13px]" 
              />
            </Field>
            <Field label="เน€เธฅเธเธ—เธตเนเนเธเธชเนเธเธเธญเธ (Delivery Note)">
               <PillInput 
                value={header.deliveryNote}
                onChange={(e) => setHeader({...header, deliveryNote: e.target.value})}
                placeholder="เธฃเธฐเธเธธเน€เธฅเธเธ—เธตเนเธเธฒเธเน€เธญเธเธชเธฒเธฃเธเธนเนเธเนา..." 
                className="w-full h-11 px-6 rounded-full text-cyan-400 font-bold font-mono bg-white/[0.02]" 
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Field label="เธเธฅเธฑเธเธชเธดเธเธเนเธฒเธเธฅเธฒเธขเธ—เธฒเธ (Destination Warehouse)">
               <PillSelect 
                value={header.warehouse}
                onChange={(e) => setHeader({...header, warehouse: e.target.value})}
                className="w-full px-6 h-11 rounded-full font-bold text-[13px]"
              >
                 <option>Main Warehouse (Bangkok)</option>
                 <option>Branch A (Rayong)</option>
                 <option>Service Center (Nonthaburi)</option>
              </PillSelect>
            </Field>
            <Field label="เธเธเธฑเธเธเธฒเธเธเธนเนเธฃเธฑเธเธชเธดเธเธเนเธฒ (Received By)">
               <PillInput value={header.receivedBy} disabled className="w-full h-11 px-6 rounded-full bg-white/[0.01] text-white/40 font-bold border-white/5 cursor-not-allowed" />
            </Field>
          </div>
        </div>
      )}

      {activeTab === "items" && (
        <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 shadow-2xl space-y-6">
          <div className="flex justify-between items-center border-b border-white/5 pb-4">
            <h4 className="text-[14px] font-black text-white/80 uppercase tracking-widest flex items-center gap-2">
              <Package size={18} className="text-cyan-400" />
              เธฃเธฒเธขเธเธฒเธฃเธเธฑเธชเธ”เธธเธ—เธตเนเธฃเธฑเธเน€เธเนา
            </h4>
            <span className="text-[12px] font-black text-cyan-400 uppercase tracking-widest">เธ•เธฃเธงเธเธเธฑเธเนเธฅเธฐเธฃเธฐเธเธธ Serial Number</span>
          </div>

          <div className="space-y-4">
            {items.length === 0 ? (
                <div className="p-20 border border-dashed border-white/10 rounded-3xl flex flex-col items-center justify-center text-center space-y-4 bg-white/[0.01]">
                  <Package size={64} className="text-white/5" />
                  <p className="text-[13px] text-white/40 font-black uppercase tracking-widest">เธขเธฑเธเนเธกเนมีเธฃเธฒเธขเธเธฒเธฃเธเธฑเธชเธ”เธธ (เธเธฃเธธณเธฒเธ”เธถเธเธเนเธญเธกเธนเธฅเธเธฒเธ PO)</p>
               </div>
            ) : (
              items.map((item) => (
                <div key={item.id} className="bg-white/[0.02] border border-white/5 p-8 rounded-3xl space-y-8">
                  <div className="flex justify-between items-start">
                     <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-white/[0.03] border border-white/10 flex items-center justify-center text-white/20">
                           <Package size={24} />
                        </div>
                        <div>
                           <p className="text-[15px] font-black text-white uppercase">{item.name}</p>
                           <p className="text-[11px] text-white/40 font-black uppercase tracking-widest mt-1">เธชเธฑเนเธเธเธทเนอ: {item.qtyOrdered} {item.unit}</p>
                        </div>
                     </div>
                     <div className="flex items-center gap-6">
                        <div className="text-right">
                           <label className="block text-[11px] font-black text-white/40 uppercase tracking-widest mb-2">เธเธณเธเธงเธเธ—เธตเนเธฃเธฑเธเธเธฃเธดเธ</label>
                           <PillInput 
                              type="number" 
                              value={item.qtyReceived}
                              onChange={(e) => updateItem(item.id, "qtyReceived", parseFloat(e.target.value) || 0)}
                              className="w-32 h-12 text-center font-mono font-black text-cyan-400 text-[16px] bg-white/[0.02]" 
                           />
                        </div>
                     </div>
                  </div>
                  <div className="space-y-3 pt-4 border-t border-white/5">
                     <div className="flex items-center gap-2 text-white/40 ml-1">
                        <Barcode size={14} />
                        <label className="text-[11px] font-black uppercase tracking-widest">Serial Numbers (เธฃเธฐเธเธธเนเธขเธเธ”เนเธงเธข Enter)</label>
                     </div>
                      <textarea 
                        className="w-full h-40 rounded-3xl bg-black/40 border border-white/10 text-white text-[13px] font-mono p-6 focus:outline-none focus:border-cyan-400/40 transition-all placeholder:text-white/10 custom-scrollbar"
                        placeholder="SN-XXXXXXX-001&#10;SN-XXXXXXX-002"
                        value={item.serials}
                        onChange={(e) => updateItem(item.id, "serials", e.target.value)}
                      />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );

  const rightSidebar = (
    <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-5 shadow-2xl space-y-6 sticky top-0">
      <div className="space-y-1 border-b border-white/5 pb-4">
        <h5 className="text-[13px] font-black text-white/80 uppercase tracking-widest flex items-center gap-2">
          เธชเธฃเธธเธเธเธฒเธฃเธฃเธฑเธเธัสดุ
        </h5>
      </div>

       <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-6">
        <div className="space-y-5">
          <NexusDataField label="เธชเธ–เธฒเธเธฐเธเธฒเธฃเธฃเธฑเธ" value={items.some(i => i.qtyReceived < i.qtyOrdered) ? "PARTIAL" : (items.length > 0 ? "COMPLETE" : "WAITING")} highlight />
          <NexusDataField label="เธเธณเธเธงเธเธฃเธฒเธขเธาร" value={`${items.length} เธฃเธฒเธขเธาร`} />
          <NexusDataField label="เธเธฅเธฑเธเธเธฅเธฒเธขเธ—เธฒเธ" value={header.warehouse.split(' ')[0]} />
        </div>
      </div>

       <div className="p-5 rounded-3xl bg-cyan-500/5 border border-cyan-500/10 flex items-start gap-3">
         <CheckCircle2 className="text-cyan-400 flex-shrink-0 mt-0.5" size={16} />
         <p className="text-[11px] text-cyan-400/80 font-bold uppercase leading-relaxed tracking-widest">
            เธเธฒเธฃเธฃเธฑเธเธชเธดเธเธเนเธฒเธเธฐเธ—เธณเธเธฒเธฃเน€เธเธดเนเธกเธชเธ•เนเธญเธเนเธเธเธฅเธฑเธ {header.warehouse.split(' ')[0]} เธญเธฑเธ•เนเธเธกเธฑเธ•เธดเนเธฅเธฐเธญเธฑเธเน€เธ”เธ•เธชเธ–เธฒเธเธฐเนเธเธชเธฑเนเธเธเธทเนเธญ (PO) เน€เธเนเธเธฃเธฑเธเนเธฅเนว
         </p>
      </div>

      <div className="space-y-4 pt-2">
        <PillButton className="w-full h-11 rounded-full font-black uppercase tracking-widest shadow-[0_0_12px_rgba(6,182,212,0.15)] bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[12px]" onClick={handleSave}>
          <ShieldCheck size={16} className="mr-2" />
          เธขเธทเธเธขเธฑเธเธเธฒเธฃเธฃเธฑเธเธชเธดเธเธเนา
        </PillButton>
      </div>
    </div>
  );

  return (
    <NexusPageLayout
      header={headerContent}
      leftContent={leftContent}
      rightSidebar={rightSidebar}
    />
  );
}

function Field({ label, children, required }: { label: string, children: React.ReactNode, required?: boolean }) {
  const cleanLabel = label.replace('*', '').trim();
  const hasAsterisk = required || label.includes('*');
  const parts = cleanLabel.split(' (');
  const thaiText = parts[0];
  const engText = parts.length > 1 ? '(' + parts[1] : '';

  return (
    <div className="space-y-2 w-full flex flex-col items-start justify-center">
      <label className="text-[12px] font-bold text-white/70 flex flex-wrap items-center gap-1 ml-1">
        <span className="flex items-center">
          {thaiText}
          {hasAsterisk && <span className="text-danger ml-1 font-bold">*</span>}
        </span>
        {engText && <span className="text-white/40 font-normal uppercase tracking-widest text-[10px]">{engText}</span>}
      </label>
      {children}
    </div>
  );
}

