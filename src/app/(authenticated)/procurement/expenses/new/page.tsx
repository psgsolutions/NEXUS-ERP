"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FileText, CheckCircle2, ArrowLeft, RefreshCw, Receipt } from "lucide-react";
import { PillButton, PillInput, CreatableCombobox, GlassCard } from "@/components/ui/Base";
import { useSystemDialog } from "@/context/DialogContext";
import { auditService } from "@/services/audit.service";
import { db } from "@/lib/firebase-client";
import { doc, collection, setDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { DocumentStepper } from "@/components/ui/DocumentStepper";

export default function NewExpensePage() {
  const router = useRouter();
  const { user, companyId: currentCompanyId } = useAuth();

  const { showAlert, showConfirm } = useSystemDialog();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<any>({
    id: "EXP-NEW",
    poId: "",
    amount: 0,
    dueDate: "",
    status: "pending",
    whtRate: 3
  });

  const isDirty = form.poId !== "" || form.amount > 0;

  const handleBack = async () => {
    if (isDirty) {
      if (await showConfirm("เธเธธเธ“เธกเธตเธเธฒเธฃเธเธฃเธญเธเธเนเธญเธกเธนเธฅเธเนเธฒเธเนเธงเน เธ•เนเธญเธเธเธฒเธฃเธขเธเน€เธฅเธดเธเนเธฅเธฐเธขเนเธญเธเธเธฅเธฑเธเนเธ”เธขเนเธกเนเธเธฑเธเธ—เธถเธเธซเธฃเธทเธญเนเธกเน?")) {
        router.back();
      }
    } else {
      router.back();
    }
  };

  const handleCommit = async () => {
    if (!form.poId) return void showAlert("เธเธฃเธธเธ“เธฒเธฃเธฐเธเธธเธญเนเธฒเธเธญเธดเธ PO");
    if (form.amount <= 0) return void showAlert("เธเธณเธเธงเธเน€เธเธดเธเธ•เนเธญเธเธกเธฒเธเธเธงเนเธฒ 0");
    if (!user || !currentCompanyId) return;

    setIsSubmitting(true);
    try {
      const expenseRef = doc(collection(db, "expenses"));
      const expenseData = {
        ...form,
        companyId: currentCompanyId,
        createdAt: serverTimestamp(),
      };
      await setDoc(expenseRef, expenseData);
      await auditService.logCreate(user.uid, currentCompanyId, "PROCURE_EXPENSE", "NEW", expenseData);
      
      showAlert("เธเธฑเธเธ—เธถเธเนเธเธชเธณเธเธฑเธเธเนเธฒเธขเน€เธฃเธตเธขเธเธฃเนเธญเธขเนเธฅเนเธง", "System Notification", "info");
      router.push("/procurement");
    } catch (err: any) {
      console.error(err);
      showAlert(`เน€เธเธดเธ”เธเนเธญเธเธดเธ”เธเธฅเธฒเธ”เนเธเธเธฒเธฃเธเธฑเธเธ—เธถเธ: ${err.message}`, "System Notification", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const headerContent = (
    <>
      <div className="flex items-center gap-4">
        <button onClick={handleBack} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] text-white/50 hover:text-white transition-all backdrop-blur-sm">
          <ArrowLeft size={18} />
        </button>
        <div>
          <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-0.5">Procurement Expenses</p>
          <div className="flex items-center">
            <h1 className="text-xl font-black uppercase tracking-tight text-white">เนเธเธชเธณเธเธฑเธเธเนเธฒเธข (Expense Voucher)</h1>
            <DocumentStepper steps={["Draft", "Pending", "Paid"]} currentStep={0} />
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <PillButton variant="ghost" className="h-9 px-6 rounded-full text-white/50 hover:text-white" onClick={handleBack}>
          เธขเธเน€เธฅเธดเธ
        </PillButton>
        <PillButton 
          className="h-9 px-6 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 shadow-[0_0_12px_rgba(6,182,212,0.15)]" 
          onClick={handleCommit} 
          disabled={isSubmitting}
        >
          {isSubmitting ? <RefreshCw className="animate-spin mr-2" size={14} /> : <CheckCircle2 size={14} className="mr-2" />}
          เธเธฑเธเธ—เธถเธเนเธเธชเธณเธเธฑเธเธเนเธฒเธข
        </PillButton>
      </div>
    </>
  );

  const leftContent = (
    <div className="space-y-4">
      <GlassCard className="p-10 space-y-12 bg-black/20 border-white/5 shadow-2xl rounded-3xl">
        <div className="flex items-center gap-4 border-b border-white/5 pb-8">
          <div className="p-4 bg-cyan-500/10 rounded-2xl text-cyan-400 border border-cyan-500/20">
            <Receipt size={32} />
          </div>
          <div>
            <h2 className="text-xl font-black text-white uppercase">เธเธฑเธเธ—เธถเธเธเนเธฒเธขเธเนเธฒเนเธเนเธเนเธฒเธขเธเธฑเธ”เธเธทเนเธญ</h2>
            <p className="text-[12px] text-white/40 uppercase tracking-widest mt-1">Create Expense Voucher for PO</p>
          </div>
        </div>

        <div className="space-y-8 max-w-3xl">
          <div className="grid grid-cols-2 gap-8">
            <Field label="เน€เธฅเธเธ—เธตเนเนเธเธชเธณเธเธฑเธเธเนเธฒเธข (Voucher Number)">
              <PillInput value={form.id || "-"} disabled className="w-full h-11 px-6 rounded-full font-mono text-cyan-400 border-cyan-500/30 bg-white/[0.02]" />
            </Field>
            <Field label="เธญเนเธฒเธเธญเธดเธ PO * (PO Reference)" required>
              <PillInput 
                value={form.poId} 
                onChange={(e) => setForm({...form, poId: e.target.value})}
                placeholder="เน€เธเนเธ PO-2604-001..."
                className="w-full h-11 px-6 rounded-full font-mono text-white/90 bg-white/[0.02]" 
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-8">
            <Field label="เธเธณเธเธงเธเน€เธเธดเธเธเนเธญเธเธซเธฑเธ เธ“ เธ—เธตเนเธเนเธฒเธข (เธเธฒเธ—) * (Amount Before Tax)" required>
              <PillInput 
                type="number"
                value={form.amount} 
                onChange={(e) => setForm({...form, amount: Number(e.target.value)})}
                className="w-full h-11 px-6 rounded-full font-mono font-bold tracking-tight text-right text-emerald-400 border-emerald-500/30 bg-white/[0.02]" 
              />
            </Field>
            <Field label="เธญเธฑเธ•เธฃเธฒเธซเธฑเธ เธ“ เธ—เธตเนเธเนเธฒเธข (%) (WHT Rate)">
              <CreatableCombobox 
                value={form.whtRate?.toString() || "0"} 
                onChange={(val) => setForm({...form, whtRate: Number(val)})}
                options={[
                  { value: "0", label: "0% (เธขเธเน€เธงเนเธ)" },
                  { value: "1", label: "1% (เธเนเธฒเธเธเธชเนเธ)" },
                  { value: "2", label: "2% (เธเนเธฒเนเธเธฉเธ“เธฒ)" },
                  { value: "3", label: "3% (เธเนเธฒเธเธฃเธดเธเธฒเธฃ)" },
                  { value: "5", label: "5% (เธเนเธฒเน€เธเนเธฒ)" }
                ]}
                allowCustom={true}
                className="h-11"
              />
            </Field>
          </div>
        </div>
      </GlassCard>
    </div>
  );

  const rightSidebar = (
    <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-5 shadow-2xl space-y-6 sticky top-0">
      <div className="space-y-1 border-b border-white/5 pb-4">
        <h5 className="text-[13px] font-black text-white/80 uppercase tracking-widest flex items-center gap-2">
          เธชเธฃเธธเธเธขเธญเธ”เธเธณเธฃเธฐ (Payment Summary)
        </h5>
      </div>

      <div className="p-6 rounded-3xl bg-black/40 border border-white/5 flex flex-col items-center">
        <span className="text-[11px] font-black text-white/40 uppercase tracking-widest mb-4">เธขเธญเธ”เธเธณเธฃเธฐเธชเธธเธ—เธเธด (Net Amount)</span>
        <span className="text-3xl font-black text-white font-mono tracking-tight">
          เธฟ{((form.amount || 0) * (1 - (form.whtRate || 0)/100)).toLocaleString(undefined, {minimumFractionDigits: 2})}
        </span>
        {form.whtRate > 0 && (
          <span className="text-[11px] text-danger mt-4 font-mono font-bold tracking-tight text-center">
            * เธซเธฑเธเธ เธฒเธฉเธต เธ“ เธ—เธตเนเธเนเธฒเธข {form.whtRate}%<br/> = เธฟ{((form.amount || 0) * ((form.whtRate || 0)/100)).toLocaleString(undefined, {minimumFractionDigits: 2})}
          </span>
        )}
      </div>

      <div className="space-y-4 pt-4">
        <PillButton 
          className="w-full h-11 px-6 rounded-full shadow-[0_0_12px_rgba(6,182,212,0.15)] bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-black uppercase tracking-widest text-[12px]" 
          onClick={handleCommit} 
          disabled={isSubmitting}
        >
          {isSubmitting ? <RefreshCw className="animate-spin mr-2" size={16} /> : <CheckCircle2 size={16} className="mr-2" />}
          เธเธฑเธเธ—เธถเธเนเธเธชเธณเธเธฑเธเธเนเธฒเธข
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

