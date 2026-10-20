"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Banknote, FileText, Landmark, Loader2, ReceiptText, Wallet } from "lucide-react";
import {
  GlassCard, NexusTable, NexusTableCell, NexusTableRow, PillButton, PillInput, PillSelect, cn,
} from "@/components/ui/Base";
import { SmartSelect } from "@/components/ui/SmartComponents";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { InfoTip, WhatHappens } from "@/components/guide/Guidance";
import { useAuth } from "@/context/AuthContext";
import { useCustomers } from "@/hooks/useCustomers";
import { effectiveDocProfile } from "@/lib/customer-doc-profile";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { apiFetch } from "@/lib/api-client";
import { can } from "@/lib/permissions";
import { toMillis } from "@/lib/dashboard-metrics";
import { BankPaymentFields, bankError, bankPayload, emptyBank } from "@/components/finance/BankPaymentFields";

type Method = "CASH" | "TRANSFER" | "CHEQUE";
const METHODS: { id: Method; label: string; icon: React.ReactNode; account: string }[] = [
  { id: "TRANSFER", label: "โอนเงิน", icon: <Landmark size={14} />, account: "1112-00 เงินฝากธนาคาร" },
  { id: "CHEQUE", label: "เช็ค", icon: <FileText size={14} />, account: "1112-00 เงินฝากธนาคาร" },
  { id: "CASH", label: "เงินสด", icon: <Banknote size={14} />, account: "1111-00 เงินสด" },
];
const WHT_RATES = [0, 1, 2, 3, 5];

const round2 = (n: number) => Math.round(n * 100) / 100;
const baht = (n: number) => (Number(n) || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const thDate = (v: any) => {
  const ms = toMillis(v);
  return ms ? new Date(ms).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" }) : "-";
};

interface Outstanding {
  docId: string;
  invoiceNo: string;
  customerId: string;
  customerName: string;
  grandTotal: number;
  subTotal: number;
  balance: number;
  dueMs: number;
  issueMs: number;
  defaultWht: number;
  /** งานบริการ VAT เกิดตอนรับเงิน (ม.78/1): ใบเสร็จนี้เป็นใบกำกับภาษีด้วย */
  serviceVat: boolean;
}

interface LineState { selected: boolean; amount: string; whtRate: number }

function ReceiptForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { companyId, role, roles } = useAuth();
  const canSave = can(roles, "finance:edit") || can(roles, "sales:billing");

  const { data: invoices, loading } = useRealtimeCollection<any>(companyId ? `companies/${companyId}/invoices` : "");
  // อัตราหัก ณ ที่จ่ายที่ลูกค้ามักหัก (โปรไฟล์เอกสารลูกค้า) เป็นค่าเริ่มต้น เมื่อใบแจ้งหนี้ไม่ได้กำหนดไว้
  const { data: customers } = useCustomers();
  const customerWht = useMemo(() => new Map((customers as any[]).map((c) => [String(c.id), Number(effectiveDocProfile(c).whtRate) || 0])), [customers]);

  // ใบแจ้งหนี้ที่ยังมียอดค้าง (ไม่รวมเอกสารตัวอย่าง/ยกเลิก)
  const outstanding: Outstanding[] = useMemo(
    () => invoices
      .filter((inv: any) => !inv.isSample && inv.isDeleted !== true && String(inv.status || "").toLowerCase() !== "cancelled" && String(inv.paymentStatus || "").toLowerCase() !== "paid")
      .map((inv: any) => {
        const grandTotal = round2(Number(inv.grandTotal) || 0);
        const balance = round2(inv.balance !== undefined ? Number(inv.balance) : grandTotal - (Number(inv.paidAmount) || 0));
        return {
          docId: inv.id,
          invoiceNo: inv.invoiceNo || inv.documentNo || inv.id,
          customerId: inv.customerId || "",
          customerName: inv.customerName || inv.customerSnapshot?.name || inv.customerId || "-",
          grandTotal,
          subTotal: Number(inv.subTotal) || grandTotal,
          balance,
          dueMs: toMillis(inv.dueDate),
          issueMs: toMillis(inv.issueDate) || toMillis(inv.createdAt),
          // ใบแจ้งหนี้งวดงาน: อัตราหัก ณ ที่จ่ายที่ตั้งไว้ในโครงการเป็นค่าเริ่มต้น
          defaultWht: [1, 2, 3, 5].includes(Number(inv.expectedWhtRate)) ? Number(inv.expectedWhtRate) : customerWht.get(String(inv.customerId)) || 0,
          serviceVat: inv.vatTiming === "receipt",
        };
      })
      .filter((o) => o.balance > 0.009 && o.customerId),
    [invoices, customerWht]
  );

  const customerOptions = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number }>();
    outstanding.forEach((o) => {
      const cur = map.get(o.customerId) || { name: o.customerName, total: 0, count: 0 };
      cur.total += o.balance;
      cur.count += 1;
      map.set(o.customerId, cur);
    });
    return Array.from(map.entries()).map(([id, c]) => ({
      value: id,
      label: c.name,
      description: `ค้างชำระ ${c.count} ใบ รวม ฿${baht(c.total)}`,
    }));
  }, [outstanding]);

  const [customerId, setCustomerId] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10));
  const [method, setMethod] = useState<Method>("TRANSFER");
  const [bank, setBank] = useState(emptyBank);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Record<string, LineState>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  // ?invoice=<docId> : เลือกลูกค้าและใบแจ้งหนี้ให้อัตโนมัติ
  const presetInvoice = searchParams?.get("invoice") || "";
  useEffect(() => {
    if (!presetInvoice || customerId) return;
    const inv = outstanding.find((o) => o.docId === presetInvoice);
    if (inv) {
      setCustomerId(inv.customerId);
      setLines({ [inv.docId]: { selected: true, amount: String(inv.balance), whtRate: inv.defaultWht } });
    }
  }, [presetInvoice, outstanding, customerId]);

  const customerInvoices = useMemo(
    () => outstanding.filter((o) => o.customerId === customerId).sort((a, b) => (a.dueMs || 0) - (b.dueMs || 0)),
    [outstanding, customerId]
  );

  const lineOf = (o: Outstanding): LineState => lines[o.docId] || { selected: false, amount: String(o.balance), whtRate: o.defaultWht };
  const setLine = (o: Outstanding, patch: Partial<LineState>) => setLines((prev) => ({ ...prev, [o.docId]: { ...lineOf(o), ...patch } }));

  const computed = useMemo(() => customerInvoices.map((o) => {
    const l = lineOf(o);
    const amount = round2(Math.max(0, Number(l.amount) || 0));
    const whtBase = o.grandTotal > 0 ? round2(amount * (o.subTotal / o.grandTotal)) : amount;
    const whtAmount = round2(whtBase * (l.whtRate / 100));
    return { o, l, amount, whtAmount, net: round2(amount - whtAmount), over: amount > o.balance + 0.009 };
  }), [customerInvoices, lines]); // eslint-disable-line react-hooks/exhaustive-deps

  const chosen = computed.filter((c) => c.l.selected);
  const totalApplied = round2(chosen.reduce((s, c) => s + c.amount, 0));
  const totalWht = round2(chosen.reduce((s, c) => s + c.whtAmount, 0));
  const cashReceived = round2(totalApplied - totalWht);
  const hasError = chosen.some((c) => c.over || c.amount <= 0);
  const methodDef = METHODS.find((m) => m.id === method)!;

  const save = async () => {
    setMessage(null);
    if (!customerId) return setMessage({ text: "กรุณาเลือกลูกค้า", error: true });
    if (chosen.length === 0) return setMessage({ text: "กรุณาเลือกใบแจ้งหนี้ที่รับชำระ", error: true });
    if (hasError) return setMessage({ text: "ยอดรับชำระต้องมากกว่า 0 และไม่เกินยอดค้าง", error: true });
    const bankMsg = bankError(method, bank, "รับเงิน");
    if (bankMsg) return setMessage({ text: bankMsg, error: true });
    setSaving(true);
    try {
      const res = await apiFetch("/api/finance/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          customerId,
          paymentDate,
          paymentMethod: method,
          ...bankPayload(method, bank),
          reference,
          note,
          lines: chosen.map((c) => ({ invoiceDocId: c.o.docId, amount: c.amount, whtRate: c.l.whtRate })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      setMessage({ text: `บันทึกใบเสร็จ ${data.receiptNo} แล้ว รับเงิน ฿${baht(data.cashReceived)}` });
      setLines({});
      setCustomerId("");
      setReference("");
      setNote("");
    } catch (e: any) {
      setMessage({ text: e.message, error: true });
    } finally {
      setSaving(false);
    }
  };

  const header = (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-5 rounded-3xl backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <PillButton variant="glass" onClick={() => router.back()} className="w-10 h-10 p-0 flex items-center justify-center"><ArrowLeft size={20} /></PillButton>
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight flex items-center gap-2"><ReceiptText size={22} className="text-nexus-teal" /> รับชำระเงินจากลูกค้า</h1>
          <p className="text-sm text-white/60 mt-1">เลือกใบแจ้งหนี้ที่ค้างชำระ ระบบออกใบเสร็จ ตัดยอดลูกหนี้ และบันทึกบัญชีให้</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <PillButton variant="glass" onClick={() => router.back()} className="h-9 px-4 text-xs font-bold text-white/60">ยกเลิก</PillButton>
        <PillButton variant="confirm" onClick={save} disabled={saving || !canSave || chosen.length === 0} className="h-9 px-5 text-xs font-bold">
          {saving ? <><Loader2 size={14} className="animate-spin mr-1.5" /> กำลังบันทึก...</> : "บันทึกรับชำระ"}
        </PillButton>
      </div>
    </div>
  );

  const left = (
    <div className="space-y-4 pb-10">
      {message && (
        <div className={cn("p-3 rounded-xl text-xs font-bold border", message.error ? "bg-danger/10 border-danger/20 text-danger" : "bg-nexus-teal/10 border-nexus-teal/20 text-nexus-teal")}>{message.text}</div>
      )}

      <GlassCard className="p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
          <div className="space-y-1 md:col-span-2">
            <label className="text-[12px] font-bold text-white/70 ml-1">ลูกค้า <span className="text-danger">*</span></label>
            <SmartSelect
              options={customerOptions}
              value={customerId}
              onChange={(v) => { setCustomerId(v); setLines({}); }}
              placeholder={loading ? "กำลังโหลด..." : customerOptions.length ? "เลือกลูกค้าที่มียอดค้างชำระ..." : "ไม่มีใบแจ้งหนี้ค้างชำระ"}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[12px] font-bold text-white/70 ml-1">วันที่รับชำระ <span className="text-danger">*</span></label>
            <PillInput type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="w-full h-9 text-sm font-mono" />
          </div>
          <div className="space-y-1">
            <label className="text-[12px] font-bold text-white/70 ml-1">เลขอ้างอิง (เช่น เลขที่โอนเงิน)</label>
            <PillInput value={reference} onChange={(e) => setReference(e.target.value)} placeholder="ถ้ามี" className="w-full h-9 text-sm" />
          </div>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5">
          <div className="space-y-1">
            <label className="text-[12px] font-bold text-white/70 ml-1">วิธีรับชำระ<InfoTip text="เงินสด = เข้าบัญชีเงินสด · โอน/เช็ค = เข้าบัญชีธนาคารที่เลือก และใช้กระทบยอดกับรายการเดินบัญชีธนาคารภายหลัง" /></label>
            <div className="flex gap-2 flex-wrap">
              {METHODS.map((m) => (
                <button key={m.id} type="button" onClick={() => setMethod(m.id)}
                  className={cn("h-9 px-4 rounded-full text-[13px] font-bold border flex items-center gap-1.5", method === m.id ? "bg-nexus-teal/15 border-nexus-teal/40 text-nexus-teal" : "bg-white/[0.02] border-white/10 text-white/50 hover:text-white")}>
                  {m.icon} {m.label}
                </button>
              ))}
            </div>
          </div>
          <BankPaymentFields method={method} value={bank} onChange={setBank} purpose="รับเงิน" chequeIncoming />
        </div>
        <div className="space-y-1">
          <label className="text-[12px] font-bold text-white/70 ml-1">หมายเหตุ</label>
          <PillInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="ถ้ามี" className="w-full h-9 text-sm" />
        </div>
      </GlassCard>

      <GlassCard className="p-0 overflow-hidden">
        <NexusTable headers={["", "เลขที่ใบแจ้งหนี้", "วันครบกำหนด", "ยอดค้างชำระ", "ยอดรับชำระ", "อัตราหัก ณ ที่จ่าย", "ยอดรับสุทธิ"]}>
          {!customerId && (
            <NexusTableRow><NexusTableCell colSpan={7} className="text-center py-10 text-white/40">เลือกลูกค้าเพื่อแสดงใบแจ้งหนี้ที่ค้างชำระ</NexusTableCell></NexusTableRow>
          )}
          {customerId && computed.length === 0 && (
            <NexusTableRow><NexusTableCell colSpan={7} className="text-center py-10 text-white/40">ลูกค้านี้ไม่มีใบแจ้งหนี้ค้างชำระ</NexusTableCell></NexusTableRow>
          )}
          {computed.map(({ o, l, whtAmount, net, over }) => {
            const overdue = o.dueMs > 0 && o.dueMs < Date.now();
            return (
              <NexusTableRow key={o.docId} className={l.selected ? "bg-nexus-teal/[0.04]" : ""}>
                <NexusTableCell>
                  <input type="checkbox" checked={l.selected} onChange={(e) => setLine(o, { selected: e.target.checked })} className="w-4 h-4 accent-nexus-teal cursor-pointer" />
                </NexusTableCell>
                <NexusTableCell variant="code" title={`ออกเมื่อ ${thDate(o.issueMs)} · ยอดเต็ม ${baht(o.grandTotal)}`}>{o.invoiceNo}</NexusTableCell>
                <NexusTableCell className={overdue ? "text-danger font-bold" : ""} title={overdue ? "เกินกำหนดชำระ" : undefined}>{thDate(o.dueMs)}</NexusTableCell>
                <NexusTableCell variant="numeric">{baht(o.balance)}</NexusTableCell>
                <NexusTableCell>
                  <PillInput
                    type="number"
                    value={l.amount}
                    disabled={!l.selected}
                    onChange={(e) => setLine(o, { amount: e.target.value })}
                    className={cn("h-9 w-28 text-right font-mono text-sm", over && "border-danger/60 text-danger")}
                    title={over ? "เกินยอดค้างชำระ" : undefined}
                  />
                </NexusTableCell>
                <NexusTableCell title={l.selected && whtAmount > 0 ? `ภาษีถูกหัก ${baht(whtAmount)} บาท` : undefined}>
                  <PillSelect value={String(l.whtRate)} onChange={(e) => setLine(o, { whtRate: Number(e.target.value) })} className="h-9 w-[92px] pl-4 pr-8 text-sm" disabled={!l.selected}>
                    {WHT_RATES.map((r) => <option key={r} value={String(r)}>{r}%</option>)}
                  </PillSelect>
                </NexusTableCell>
                <NexusTableCell variant="numeric" className="text-nexus-teal font-bold">{l.selected ? baht(net) : "-"}</NexusTableCell>
              </NexusTableRow>
            );
          })}
        </NexusTable>
      </GlassCard>
      <p className="text-[12px] text-white/40">ภาษีหัก ณ ที่จ่ายคิดจากยอดก่อนภาษีมูลค่าเพิ่ม ตามสัดส่วนที่รับชำระ · รับชำระบางส่วนได้ ยอดที่เหลือยังค้างอยู่ในใบแจ้งหนี้</p>
    </div>
  );

  const sideRow = (k: React.ReactNode, v: string, cls = "text-white") => (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-white/5 last:border-0">
      <span className="text-[13px] text-white/60">{k}</span>
      <span className={cn("text-[14px] font-mono font-bold", cls)}>{v}</span>
    </div>
  );

  const right = (
    <div className="p-4 space-y-4">
      <WhatHappens items={[
        chosen.some((c) => c.o.serviceVat)
          ? "ออกใบเสร็จรับเงิน/ใบกำกับภาษี (งานบริการ ภาษีขายเกิดเมื่อรับเงิน) เลขที่ออกอัตโนมัติ พิมพ์หรือส่งลิงก์ให้ลูกค้าได้ทันที"
          : "ออกใบเสร็จรับเงิน เลขที่ออกอัตโนมัติ พิมพ์หรือส่งลิงก์ให้ลูกค้าได้ทันที",
        `ตัดยอดค้างของใบแจ้งหนี้${chosen.length ? ` ${chosen.length} ใบ` : "ที่เลือก"} — รับไม่ครบ ยอดที่เหลือยังค้างอยู่ในใบแจ้งหนี้`,
        totalWht > 0 && `บันทึกภาษีที่ลูกค้าหักไว้ ฿${baht(totalWht)} — ขอหนังสือรับรอง (50 ทวิ) จากลูกค้า`,
        method !== "CASH" && `บันทึกเข้าสมุดบัญชีธนาคาร${method === "CHEQUE" ? " และทะเบียนเช็ครับ" : ""}`,
        "ส่งรายการบัญชีให้ฝ่ายบัญชีอนุมัติ (ยอดเข้างบหลังอนุมัติ)",
      ]} />
      <GlassCard className="p-4">
        <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2"><Wallet size={16} className="text-nexus-teal" /> สรุปการรับชำระ</h4>
        {sideRow("จำนวนใบแจ้งหนี้", `${chosen.length} ใบ`)}
        {sideRow("ยอดตัดลูกหนี้", `฿${baht(totalApplied)}`)}
        {sideRow(<>ภาษีถูกหัก ณ ที่จ่าย<InfoTip text="ลูกค้านิติบุคคลที่จ่ายค่าบริการจะหักภาษีไว้ตามประเภทเงินได้ เช่น ค่าบริการ/ค่าจ้าง 3% ค่าขนส่ง 1% ค่าโฆษณา 2% ค่าเช่า 5% — ขายสินค้าอย่างเดียวไม่ต้องหัก · คิดจากยอดก่อน VAT · ขอหนังสือรับรอง (50 ทวิ) จากลูกค้าเก็บไว้ใช้ยื่นภาษี" /></>, `฿${baht(totalWht)}`)}
        {sideRow("เงินที่ได้รับจริง", `฿${baht(cashReceived)}`, "text-nexus-teal")}
      </GlassCard>

      <GlassCard className="p-4">
        <h4 className="text-sm font-bold text-white mb-2">รายการบัญชีที่จะบันทึก</h4>
        <div className="space-y-1.5 text-[12px]">
          <div className="flex justify-between gap-2"><span className="text-white/70">Dr {methodDef.account}</span><span className="font-mono text-white">{baht(cashReceived)}</span></div>
          {totalWht > 0 && <div className="flex justify-between gap-2"><span className="text-white/70">Dr 1154-00 ภาษีเงินได้ถูกหัก ณ ที่จ่าย</span><span className="font-mono text-white">{baht(totalWht)}</span></div>}
          <div className="flex justify-between gap-2 pl-4"><span className="text-white/70">Cr 1131-00 ลูกหนี้การค้า</span><span className="font-mono text-white">{baht(totalApplied)}</span></div>
        </div>
        <p className="text-[11px] text-white/40 mt-2">บันทึกเป็นรายการรออนุมัติลงบัญชี</p>
      </GlassCard>
    </div>
  );

  return <NexusPageLayout header={header} leftContent={left} rightSidebar={right} />;
}

export default function NewReceiptPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-white/50 text-sm">กำลังโหลด...</div>}>
      <ReceiptForm />
    </Suspense>
  );
}
