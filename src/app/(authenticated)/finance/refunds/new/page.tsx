"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Banknote } from "lucide-react";
import { GlassCard, NexusPageLayout, PillButton, PillInput, PillSelect, Toast, cn } from "@/components/ui/Base";
import { SmartSelect } from "@/components/ui/SmartComponents";
import { Field, FIELD_W, NumCell } from "@/components/projects/ProjectPlanEditors";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { apiFetch } from "@/lib/api-client";
import { can } from "@/lib/permissions";
import { BankPaymentFields, bankError, bankPayload, emptyBank } from "@/components/finance/BankPaymentFields";

const baht = (n: number) => (Number(n) || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const METHODS = [
  { code: "TRANSFER", label: "โอนเงิน", account: "1112-00 เงินฝากธนาคาร" },
  { code: "CASH", label: "เงินสด", account: "1111-00 เงินสด" },
  { code: "CHEQUE", label: "เช็ค", account: "1112-00 เงินฝากธนาคาร" },
];

/** คืนเงินลูกค้าจากยอดค้างคืน (ใบลดหนี้หลังลูกค้าชำระแล้ว / ยกเลิกใบเพิ่มหนี้ที่ชำระแล้ว) */
export default function NewCustomerRefundPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { companyId, role, roles } = useAuth();
  const { data: invoices } = useRealtimeCollection<any>(companyId ? `companies/${companyId}/invoices` : "");
  const due = useMemo(() => invoices.filter((i: any) => Number(i.refundDue) > 0.009 && !i.isSample), [invoices]);

  const [invoiceDocId, setInvoiceDocId] = useState(searchParams?.get("invoice") || "");
  const inv = due.find((i: any) => i.id === invoiceDocId);
  const [amount, setAmount] = useState(0);
  const [refundDate, setRefundDate] = useState(today);
  const [method, setMethod] = useState("TRANSFER");
  const [bank, setBank] = useState(emptyBank);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ message: "", isVisible: false });

  useEffect(() => { if (inv) setAmount(Number(inv.refundDue) || 0); }, [inv?.id, inv?.refundDue]); // eslint-disable-line react-hooks/exhaustive-deps

  const canSave = can(roles, "finance:edit");
  const problems = [
    !inv && "เลือกใบกำกับภาษีที่มียอดค้างคืน",
    !(amount > 0) && "ระบุจำนวนเงินที่คืน",
    inv && amount > Number(inv.refundDue) + 0.009 && "คืนเกินยอดค้างคืน",
    refundDate > today() && "ลงวันที่ล่วงหน้าไม่ได้",
    bankError(method, bank, "จ่ายคืน"),
  ].filter(Boolean) as string[];

  const save = async () => {
    if (problems.length || !canSave || !companyId) return;
    try {
      setSaving(true);
      const res = await apiFetch("/api/finance/customer-refunds", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, action: "create", invoiceDocId, amount, refundDate, paymentMethod: method, ...bankPayload(method, bank), reference, note }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      setToast({ message: `บันทึกใบคืนเงิน ${data.refundNo} แล้ว`, isVisible: true });
      setTimeout(() => router.push(`/finance/refunds/${encodeURIComponent(data.refundNo)}`), 900);
    } catch (e: any) {
      setToast({ message: e.message, isVisible: true });
    } finally {
      setSaving(false);
    }
  };

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-5 rounded-3xl">
      <div className="flex items-center gap-4 min-w-0">
        <PillButton variant="glass" onClick={() => router.back()} className="w-10 h-10 p-0 flex items-center justify-center shrink-0"><ArrowLeft size={20} /></PillButton>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-white">คืนเงินลูกค้า</h1>
          <p className="text-sm text-white/60">คืนยอดที่ลูกค้าชำระเกิน จากใบลดหนี้หลังชำระ หรือการยกเลิกใบเพิ่มหนี้ · เลขที่ RF ออกเมื่อบันทึก</p>
        </div>
      </div>
      <PillButton variant="confirm" onClick={save} disabled={saving || !!problems.length || !canSave} className="h-9 px-5 text-xs font-bold" title={problems[0] || undefined}>
        <Banknote size={14} className="mr-1.5" /> {saving ? "กำลังบันทึก..." : "บันทึกการคืนเงิน"}
      </PillButton>
    </div>
  );

  const left = (
    <div className="space-y-4">
      <GlassCard className="p-5 space-y-4">
        <div className="flex flex-wrap gap-3">
          <Field label="ใบกำกับภาษีที่มียอดค้างคืน" required w={320} grow>
            <SmartSelect
              options={due.map((i: any) => ({ value: i.id, label: `${i.invoiceNo || i.documentNo || i.id} · ${i.customerName || "-"}`, description: `ค้างคืน ฿${baht(i.refundDue)}` }))}
              value={invoiceDocId}
              onChange={setInvoiceDocId}
              allowCustom={false}
              placeholder={due.length ? "เลือกใบกำกับภาษี..." : "ไม่มีใบกำกับที่ค้างคืนเงิน"}
            />
          </Field>
          <Field label="จำนวนเงินที่คืน (บาท)" required w={FIELD_W.money}>
            <NumCell kind="money" value={amount} onChange={setAmount} warn={!!inv && amount > Number(inv.refundDue) + 0.009} />
          </Field>
          <Field label="วันที่คืนเงิน" required w={FIELD_W.date}>
            <PillInput type="date" value={refundDate} onChange={(e) => e.target.value && setRefundDate(e.target.value)} className="w-full h-9 text-sm font-mono px-4" />
          </Field>
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <label className="text-[12px] font-bold text-white/70 ml-1">วิธีคืนเงิน</label>
            <div className="flex gap-2">
              {METHODS.map((m) => (
                <button key={m.code} type="button" onClick={() => setMethod(m.code)}
                  className={cn("h-9 px-4 rounded-full border text-[13px] font-bold", method === m.code ? "bg-nexus-teal/15 border-nexus-teal/40 text-nexus-teal" : "border-white/10 text-white/50 hover:text-white")}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          {method !== "CASH" && (
            <div className="w-full grid grid-cols-1 xl:grid-cols-2 gap-3">
              <BankPaymentFields method={method} value={bank} onChange={setBank} purpose="จ่ายคืน" />
            </div>
          )}
          <Field label="เลขอ้างอิง" w={FIELD_W.code} grow>
            <PillInput value={reference} onChange={(e) => setReference(e.target.value)} className="w-full h-9 text-sm font-mono" />
          </Field>
        </div>
        <Field label="หมายเหตุ" w={300} grow>
          <PillInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น คืนเงินตามใบลดหนี้ CN-26-0001" className="w-full h-9 text-sm" />
        </Field>
        {problems.length > 0 && <p className="text-[12px] text-white/45">ยังขาด: {problems.join(" · ")}</p>}
      </GlassCard>
    </div>
  );

  const row = (k: string, v: string, strong = false) => (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-white/5 last:border-0">
      <span className="text-[13px] text-white/60">{k}</span>
      <span className={cn("text-[13px] font-mono text-right", strong ? "font-bold text-white" : "text-white/80")}>{v}</span>
    </div>
  );
  const methodDef = METHODS.find((m) => m.code === method)!;
  const right = (
    <div className="p-4 space-y-4">
      <GlassCard className="p-4">
        <h4 className="text-sm font-bold text-white mb-1">ใบกำกับภาษี</h4>
        {inv ? (<>
          {row("เลขที่", inv.invoiceNo || inv.id)}
          {row("ลูกค้า", inv.customerName || "-")}
          {row("ยอดรวม", baht(inv.grandTotal))}
          {row("รับชำระแล้ว", baht(inv.paidAmount))}
          {row("ใบลดหนี้ (ก่อน VAT)", baht(inv.creditNoteTotal))}
          {row("คืนเงินแล้ว", baht(inv.refundedTotal))}
          {row("ยอดค้างคืน", baht(inv.refundDue), true)}
        </>) : <p className="text-[13px] text-white/40">ยังไม่ได้เลือก</p>}
      </GlassCard>
      <GlassCard className="p-4">
        <h4 className="text-sm font-bold text-white mb-2">รายการบัญชี (รออนุมัติ)</h4>
        <div className="space-y-1 text-[12px] font-mono">
          <div className="flex justify-between gap-2"><span className="text-white/70">Dr 1131-00 ลูกหนี้การค้า</span><span>{baht(amount)}</span></div>
          <div className="flex justify-between gap-2 pl-4"><span className="text-white/70">Cr {methodDef.account}</span><span>{baht(amount)}</span></div>
        </div>
      </GlassCard>
      {toast.isVisible && <Toast isVisible message={toast.message} onClose={() => setToast((t) => ({ ...t, isVisible: false }))} />}
    </div>
  );

  return <NexusPageLayout header={header} leftContent={left} rightSidebar={right} />;
}
