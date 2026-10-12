"use client";

import React, { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { GlassCard, PillButton, PillInput, PillSelect, cn } from "@/components/ui/Base";
import { SmartSelect } from "@/components/ui/SmartComponents";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { useAuth } from "@/context/AuthContext";
import { useSystemDialog } from "@/context/DialogContext";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { apiFetch } from "@/lib/api-client";
import { can } from "@/lib/permissions";
import { CNDN_REASONS, CNDN_TYPE_TH, cndnAmounts, type CnDnType } from "@/lib/cndn";

const baht = (n: any) => (Number(n) || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const thDate = (d?: string) => (d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" }) : "-");

function CnDnForm() {
  const router = useRouter();
  const qs = useSearchParams();
  const { companyId, role } = useAuth();
  const { showConfirm } = useSystemDialog();
  const canSave = can(role, "sales:edit") || can(role, "finance:edit");
  const { data: invoices } = useRealtimeCollection<any>(companyId ? `companies/${companyId}/invoices` : "");

  const [type, setType] = useState<CnDnType>(qs?.get("type") === "DN" ? "DN" : "CN");
  const [invoiceDocId, setInvoiceDocId] = useState(qs?.get("invoice") || "");
  const [issueDate, setIssueDate] = useState(today);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [reasonDetail, setReasonDetail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // ใบกำกับที่อ้างอิงได้: ออกแล้ว ไม่ใช่ตัวอย่าง ไม่ถูกยกเลิก
  const eligible = useMemo(() => invoices
    .filter((i: any) => !i.isSample && i.isDeleted !== true && String(i.status || "").toLowerCase() !== "cancelled" && (Number(i.grandTotal) || 0) > 0)
    .sort((a: any, b: any) => String(b.issueDate || "").localeCompare(String(a.issueDate || ""))), [invoices]);
  const options = eligible.map((i: any) => ({
    value: i.id,
    label: `${i.invoiceNo || i.documentNo || i.id} · ${i.customerName || "-"}`,
    description: `฿${baht(i.grandTotal)} · ${thDate(i.issueDate)}`,
  }));
  const inv = eligible.find((i: any) => i.id === invoiceDocId);

  const valueBefore = inv ? (Number(inv.subTotal) || 0) - (Number(inv.creditNoteTotal) || 0) + (Number(inv.debitNoteTotal) || 0) : 0;
  const balanceBefore = inv ? (inv.balance !== undefined ? Number(inv.balance) : (Number(inv.grandTotal) || 0) - (Number(inv.paidAmount) || 0)) : 0;
  const calc = cndnAmounts(Number(amount) || 0, inv || {});
  const valueAfter = type === "CN" ? valueBefore - calc.amount : valueBefore + calc.amount;
  const balanceAfter = type === "CN" ? balanceBefore - calc.totalAmount : balanceBefore + calc.totalAmount;

  const problems = [
    !inv && "เลือกใบกำกับภาษีที่อ้างอิง",
    !(calc.amount > 0) && "ระบุจำนวนเงิน",
    type === "CN" && inv && calc.amount > valueBefore + 0.009 && "ลดเกินมูลค่าคงเหลือของใบกำกับ",
    type === "CN" && inv && calc.totalAmount > balanceBefore + 0.009 && "ยอดลดหนี้เกินยอดค้างชำระ (ลูกค้าชำระแล้วต้องคืนเงิน)",
    !reason && "เลือกเหตุผล",
    reason === "อื่น ๆ" && !reasonDetail.trim() && "ระบุรายละเอียดเหตุผล",
    inv && issueDate < String(inv.issueDate || "").slice(0, 10) && "วันที่ต้องไม่ก่อนวันที่ใบกำกับ",
  ].filter(Boolean) as string[];

  const save = async () => {
    if (problems.length || !canSave) return;
    if (!(await showConfirm(`ยืนยันออก${CNDN_TYPE_TH[type]} ฿${baht(calc.totalAmount)} อ้างอิง ${inv.invoiceNo || inv.id}? ระบบจะปรับยอดค้างและบันทึกบัญชีทันที`))) return;
    setSaving(true);
    setError("");
    try {
      const res = await apiFetch("/api/sales/cndn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, type, invoiceDocId, amount: calc.amount, reason, reasonDetail, issueDate }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "ออกเอกสารไม่สำเร็จ");
      router.push("/sales?tab=cndn");
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  };

  const header = (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-5 rounded-3xl backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <PillButton variant="glass" onClick={() => router.back()} className="w-10 h-10 p-0 flex items-center justify-center"><ArrowLeft size={20} /></PillButton>
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">ออกใบลดหนี้ / ใบเพิ่มหนี้</h1>
          <p className="text-sm text-white/60 mt-1">ปรับมูลค่าใบกำกับภาษีเดิม ได้เลขที่เมื่อบันทึก และบันทึกบัญชีภาษีขายของเดือนที่ออกเอกสาร</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <PillButton variant="glass" onClick={() => router.back()} className="h-9 px-4 text-xs font-bold text-white/60">ยกเลิก</PillButton>
        <PillButton variant="confirm" onClick={save} disabled={saving || problems.length > 0 || !canSave} className="h-9 px-5 text-xs font-bold">
          {saving ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <ShieldCheck size={14} className="mr-1.5" />} ออก{CNDN_TYPE_TH[type]}
        </PillButton>
      </div>
    </div>
  );

  const label = (t: string, req?: boolean) => <label className="text-[12px] font-bold text-white/70 ml-1">{t}{req && <span className="text-danger ml-1">*</span>}</label>;
  const row = (k: string, v: React.ReactNode, strong = false) => (
    <div className="flex items-center justify-between gap-3 py-1.5 text-[13px]">
      <span className="text-white/60">{k}</span>
      <span className={cn("font-mono text-right", strong ? "font-bold text-white" : "text-white/85")}>{v}</span>
    </div>
  );

  const left = (
    <div className="space-y-4 pb-10">
      {!canSave && <div className="p-3 rounded-xl text-xs font-bold border bg-warning/10 border-warning/20 text-warning">บัญชีของคุณไม่มีสิทธิ์ออกเอกสารนี้</div>}
      {error && <div className="p-3 rounded-xl text-xs font-bold border bg-danger/10 border-danger/20 text-danger">{error}</div>}

      <GlassCard className="p-5 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-[auto_150px] gap-3 items-end">
          <div className="space-y-1">
            {label("ประเภทเอกสาร", true)}
            <div className="flex rounded-full border border-white/10 p-0.5 w-fit">
              {(["CN", "DN"] as CnDnType[]).map((t) => (
                <button key={t} onClick={() => { setType(t); setReason(""); }} className={cn("h-8 px-4 rounded-full text-xs font-bold", type === t ? "bg-nexus-teal/15 text-nexus-teal" : "text-white/50 hover:text-white")}>
                  {CNDN_TYPE_TH[t]}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            {label("วันที่ออกเอกสาร", true)}
            <PillInput type="date" value={issueDate} max={today()} onChange={(e) => setIssueDate(e.target.value)} className="w-full h-9 text-sm font-mono" />
          </div>
        </div>
        <div className="space-y-1">
          {label("ใบกำกับภาษีที่อ้างอิง", true)}
          <SmartSelect options={options} value={invoiceDocId} onChange={setInvoiceDocId} allowCustom={false} placeholder="ค้นหาเลขที่ใบกำกับ / ชื่อลูกค้า" />
        </div>
        {inv && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            {[
              ["วันที่ใบกำกับ", thDate(inv.issueDate)],
              ["มูลค่าเดิม (ก่อน VAT)", baht(inv.subTotal)],
              ["มูลค่าปัจจุบัน (ก่อน VAT)", baht(valueBefore)],
              ["ยอดค้างชำระ", baht(balanceBefore)],
            ].map(([k, v]) => (
              <div key={k} className="min-w-0"><p className="text-[12px] text-white/50 truncate">{k}</p><p className="text-[14px] font-bold font-mono text-white whitespace-nowrap">{v}</p></div>
            ))}
          </div>
        )}
      </GlassCard>

      <GlassCard className="p-5 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            {label(type === "CN" ? "มูลค่าที่ลด (ก่อน VAT)" : "มูลค่าที่เพิ่ม (ก่อน VAT)", true)}
            <PillInput inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1"))} placeholder="0.00" className="w-full h-9 text-sm text-right font-mono" />
          </div>
          <div className="space-y-1">
            {label("เหตุผล", true)}
            <PillSelect value={reason || "NONE"} onChange={(e) => setReason(e.target.value === "NONE" ? "" : e.target.value)} className="w-full h-9 text-sm">
              <option value="NONE">เลือกเหตุผล</option>
              {CNDN_REASONS[type].map((r) => <option key={r} value={r}>{r}</option>)}
            </PillSelect>
          </div>
        </div>
        <div className="space-y-1">
          {label("รายละเอียดเพิ่มเติม", reason === "อื่น ๆ")}
          <PillInput value={reasonDetail} onChange={(e) => setReasonDetail(e.target.value)} placeholder="เช่น รับคืนสินค้า 2 ชิ้น ตามใบรับคืนเลขที่..." className="w-full h-9 text-sm" />
        </div>
      </GlassCard>
    </div>
  );

  const right = (
    <div className="p-4 space-y-4">
      <GlassCard className="p-4">
        <h4 className="text-sm font-bold text-white mb-1">สรุป{CNDN_TYPE_TH[type]}</h4>
        {row("มูลค่าตามใบกำกับเดิม", baht(valueBefore))}
        {row("มูลค่าที่ถูกต้อง", baht(valueAfter))}
        {row(type === "CN" ? "ผลต่าง (ลดลง)" : "ผลต่าง (เพิ่มขึ้น)", baht(calc.amount))}
        {row(`ภาษีมูลค่าเพิ่ม ${calc.vatRate}%`, baht(calc.vatAmount))}
        <div className="border-t border-white/10 mt-1 pt-1">{row("รวมทั้งสิ้น", baht(calc.totalAmount), true)}</div>
        {inv && row("ยอดค้างชำระหลังออกเอกสาร", baht(Math.max(0, balanceAfter)))}
      </GlassCard>
      <GlassCard className="p-4">
        <h4 className="text-sm font-bold text-white mb-2">รายการบัญชี (รออนุมัติ)</h4>
        <div className="space-y-1 text-[12px]">
          {(type === "CN"
            ? [["Dr", "4113-00 รับคืนและส่วนลดจ่าย", calc.amount], ["Dr", "2121-00 ภาษีขาย", calc.vatAmount], ["Cr", "1131-00 ลูกหนี้การค้า", calc.totalAmount]]
            : [["Dr", "1131-00 ลูกหนี้การค้า", calc.totalAmount], ["Cr", "4111-00 รายได้จากการขาย", calc.amount], ["Cr", "2121-00 ภาษีขาย", calc.vatAmount]]
          ).filter(([, , v]) => Number(v) > 0 || !calc.amount).map(([side, acct, v]) => (
            <div key={String(acct)} className={cn("flex justify-between gap-2", side === "Cr" && "pl-4")}>
              <span className="text-white/70 truncate">{side} {acct}</span><span className="font-mono text-white">{baht(v)}</span>
            </div>
          ))}
        </div>
      </GlassCard>
      {problems.length > 0 && (
        <GlassCard className="p-4">
          <h4 className="text-[12px] font-bold text-white/70 mb-1.5">ก่อนบันทึก</h4>
          <ul className="space-y-1 text-[12px] text-white/50 list-disc pl-4">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
        </GlassCard>
      )}
    </div>
  );

  return <NexusPageLayout header={header} leftContent={left} rightSidebar={right} />;
}

export default function CnDnPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-white/50 text-sm">กำลังโหลด...</div>}>
      <CnDnForm />
    </Suspense>
  );
}
