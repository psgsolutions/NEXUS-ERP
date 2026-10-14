"use client";

import { EXPENSE_ACCOUNTS } from "@/lib/payables";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSystemDialog } from "@/context/DialogContext";
import {
  FileText,
  ShieldCheck,
  Camera,
  Image as ImageIcon,
  Trash2,
  Receipt,
  ArrowLeft
} from "lucide-react";
import {
  PillButton,
  PillInput,
  PillSelect,
  GlassCard,
  cn
} from "@/components/ui/Base";
import { formatCurrency } from "@/lib/erp-logic";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { DocumentStepper } from "@/components/ui/DocumentStepper";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { nextDocumentNumber } from "@/lib/sequence-client";
import { db } from "@/lib/firebase-client";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

export default function NewExpenseClaimPage() {
  const router = useRouter();
  const { showAlert, showConfirm } = useSystemDialog();

  const [formData, setFormData] = useState({
    claimId: "ออกเลขเมื่อบันทึก",
    employeeId: "",
    expenseAccountCode: EXPENSE_ACCOUNTS[0].code, // ค่าใช้จ่ายเบ็ดเตล็ดทั่วไป
    description: "",
    hasVat: false,
    subtotal: 0,
  });
  const { user, companyId } = useAuth();
  const { data: employees } = useRealtimeCollection<any>("employees");
  const [saving, setSaving] = useState(false);
  const employeeName = (e: any) => e ? (e.name || [e.firstName, e.lastName].filter(Boolean).join(" ") || e.employeeCode || e.id) : "";

  const [vatAmount, setVatAmount] = useState(0);
  const [grandTotal, setGrandTotal] = useState(0);

  useEffect(() => {
    let vat = 0;
    if (formData.hasVat) {
      vat = formData.subtotal * 0.07;
    }
    setVatAmount(vat);
    setGrandTotal(formData.subtotal + vat);
  }, [formData.subtotal, formData.hasVat]);

  const handleBack = async () => {
    if (formData.description !== "" || formData.subtotal > 0) {
      if (await showConfirm("คุณมีการกรอกข้อมูลค้างไว้ ต้องการย้อนกลับโดยไม่บันทึกใช่หรือไม่?")) {
        router.back();
      }
    } else {
      router.back();
    }
  };

  // ใบเบิกบันทึกเป็นใบสำคัญจ่าย (expenses) ผู้รับเงินคือพนักงาน: แสดงในแท็บค่าใช้จ่ายของจัดซื้อและเจ้าหนี้ของการเงิน
  const handleSave = async () => {
    if (!formData.employeeId) return void showAlert("กรุณาเลือกพนักงานผู้เบิก", "System Notification", "warning");
    if (formData.subtotal <= 0) return void showAlert("กรุณาระบุยอดเงินเบิก", "System Notification", "warning");
    if (!formData.description) return void showAlert("กรุณาระบุรายละเอียดการเบิก", "System Notification", "warning");
    if (!companyId || !user) return void showAlert("ไม่พบข้อมูลผู้ใช้หรือรหัสบริษัท", "System Notification", "error");

    setSaving(true);
    try {
      const expId = await nextDocumentNumber("EXP", companyId);
      const employee = employees.find((e: any) => e.id === formData.employeeId);
      const round = (n: number) => Math.round(n * 100) / 100;
      await setDoc(doc(db, `companies/${companyId}/expenses`, expId), {
        id: expId,
        expenseId: expId,
        companyId,
        documentType: "ExpenseClaim",
        employeeId: formData.employeeId,
        employeeName: employeeName(employee),
        supplierName: employeeName(employee),
        vendor: employeeName(employee),
        expenseAccountCode: formData.expenseAccountCode,
        description: formData.description,
        hasVat: formData.hasVat,
        subTotal: round(formData.subtotal),
        vatAmount: round(vatAmount),
        totalAmount: round(grandTotal),
        status: "Awaiting Payment",
        dueDate: new Date().toISOString().split("T")[0],
        createdBy: user.email || user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isDeleted: false,
      });
      showAlert(`ส่งคำขอเบิกเงินเรียบร้อยแล้ว (${expId})`);
      router.push("/finance");
    } catch (err: any) {
      showAlert(`บันทึกไม่สำเร็จ: ${err.message}`, "System Notification", "error");
    } finally {
      setSaving(false);
    }
  };

  const headerContent = (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-6 rounded-3xl backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <PillButton variant="glass" onClick={handleBack} className="w-10 h-10 p-0 flex items-center justify-center">
          <ArrowLeft size={20} />
        </PillButton>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-white uppercase tracking-tight">
              เบิกเงินสดย่อยและค่าใช้จ่าย
            </h1>
            <span className="px-3 py-1 rounded-full bg-nexus-teal/10 border border-nexus-teal/30 text-nexus-teal text-sm font-mono font-bold select-none cursor-default pointer-events-none">
              {formData.claimId || "EXP-CLAIM"}
            </span>
          </div>
          <p className="text-sm text-white/60 font-medium mt-1">
            ยื่นคำขอเบิกเงินสดย่อย ค่าเดินทาง และค่าใช้จ่ายปฏิบัติงานภายในองค์กร
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
        <PillButton variant="glass" className="h-8 px-4 text-xs font-bold text-white/50" onClick={handleBack}>
          ยกเลิก
        </PillButton>
        <PillButton variant="confirm" className="h-8 px-5 font-bold text-xs" onClick={handleSave} disabled={saving}>
          <ShieldCheck size={14} className="mr-1.5" /> ส่งคำขอเบิกเงิน
        </PillButton>
      </div>
    </div>
  );

  const leftContent = (
    <div className="space-y-4">
      <GlassCard className="p-8 space-y-8 animate-in fade-in duration-500 border-white/5 bg-black/20">
        <div className="grid grid-cols-2 gap-6">
          <Field label="เลขที่เอกสาร (CLAIM ID)">
            <PillInput
              value={formData.claimId}
              readOnly
              className="w-full text-white/50 bg-white/5 border-white/5 font-mono cursor-not-allowed"
            />
          </Field>
          <Field label="พนักงานผู้เบิก (EMPLOYEE) *">
            <PillSelect
              value={formData.employeeId}
              onChange={e => setFormData({ ...formData, employeeId: e.target.value })}
              className="w-full"
            >
              <option value="">{employees.length === 0 ? "ยังไม่มีข้อมูลพนักงาน" : "เลือกพนักงาน..."}</option>
              {employees.map((emp: any) => (
                <option key={emp.id} value={emp.id}>{emp.employeeCode || emp.employeeId || emp.id} - {employeeName(emp)}</option>
              ))}
            </PillSelect>
          </Field>
        </div>

        <Field label="รหัสบัญชีค่าใช้จ่าย (EXPENSE ACCOUNT) *">
          <PillSelect
            value={formData.expenseAccountCode}
            onChange={e => setFormData({ ...formData, expenseAccountCode: e.target.value })}
            className="w-full"
          >
            {EXPENSE_ACCOUNTS.map((a) => (
              <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
            ))}
          </PillSelect>
        </Field>

        <Field label="รายละเอียดการเบิก (DESCRIPTION) *">
          <PillInput
            value={formData.description}
            onChange={e => setFormData({ ...formData, description: e.target.value })}
            placeholder="ระบุรายละเอียดค่าใช้จ่ายที่ต้องการเบิก..."
            className="w-full"
          />
        </Field>

        <div className="grid grid-cols-2 gap-6">
          <Field label="ยอดเงินเบิกก่อนภาษี (SUBTOTAL) *">
            <PillInput
              type="number"
              value={formData.subtotal || ''}
              onChange={e => setFormData({ ...formData, subtotal: Number(e.target.value) })}
              className="w-full font-mono"
            />
          </Field>

          <div className="flex flex-col justify-center space-y-2 mt-8">
            <label className="flex items-center gap-2 cursor-pointer text-[12px] font-bold text-white/70 hover:text-white">
              <input
                type="checkbox"
                checked={formData.hasVat}
                onChange={e => setFormData({ ...formData, hasVat: e.target.checked })}
                className="w-4 h-4 rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500/50"
              />
              มีภาษีมูลค่าเพิ่ม 7% (คิดเพิ่มจากยอดก่อนภาษี)
            </label>
          </div>
        </div>

        <div className="pt-4 border-t border-white/5 space-y-2">
          <Field label="แนบรูปถ่ายใบเสร็จ (RECEIPTS)">
            <div />
          </Field>
          <div className="w-full p-6 rounded-2xl border border-dashed border-white/10 flex flex-col items-center justify-center text-white/40 bg-white/[0.02]">
            <ImageIcon size={28} className="mb-2 opacity-50" />
            <p className="text-[12px] font-semibold">ยังไม่รองรับการแนบไฟล์ (รอตั้งค่าพื้นที่เก็บไฟล์ Firebase Storage) เก็บใบเสร็จตัวจริงไว้ประกอบการเบิก</p>
          </div>
        </div>

      </GlassCard>
    </div>
  );

  const rightSidebar = (
    <GlassCard className="p-6 sticky top-[96px] bg-surface-1 border-white/5 shadow-2xl flex flex-col min-h-[400px]">
      <div className="flex items-center gap-2 mb-6 border-b border-white/5 pb-4">
        <Receipt size={16} className="text-cyan-400" />
        <h3 className="text-base font-black text-white/80 uppercase tracking-widest mb-0">Summary</h3>
      </div>

      <div className="space-y-4 flex-1">
        <div className="flex justify-between items-center">
          <span className="text-[12px] font-semibold text-white/40 uppercase tracking-widest">ยอดก่อนภาษี</span>
          <span className="text-[13px] font-mono text-white/80">{formatCurrency(formData.subtotal)}</span>
        </div>

        {formData.hasVat && (
          <div className="flex justify-between items-center">
            <span className="text-[12px] font-semibold text-white/40 uppercase tracking-widest">ภาษีมูลค่าเพิ่ม (7%)</span>
            <span className="text-[13px] font-mono text-cyan-400">{formatCurrency(vatAmount)}</span>
          </div>
        )}
      </div>

      <div className="mt-6 pt-6 border-t border-white/5 space-y-4">
        <div className="flex justify-between items-end">
          <div>
            <span className="block text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-1">ยอดสุทธิที่ขอเบิก</span>
            <span className="block text-2xl font-mono text-cyan-400">
              {formatCurrency(grandTotal)}
            </span>
          </div>
          <span className="text-[12px] font-semibold text-white/40 uppercase tracking-widest pb-1">THB</span>
        </div>
      </div>
    </GlassCard>
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
