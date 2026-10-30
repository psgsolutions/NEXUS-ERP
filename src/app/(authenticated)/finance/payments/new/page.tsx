"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Banknote, FileText, HandCoins, Landmark, Loader2, Wallet } from "lucide-react";
import {
  GlassCard, NexusTable, NexusTableCell, NexusTableRow, PillButton, PillInput, PillSelect, cn,
} from "@/components/ui/Base";
import { SmartSelect } from "@/components/ui/SmartComponents";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { InfoTip, WhatHappens } from "@/components/guide/Guidance";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { apiFetch } from "@/lib/api-client";
import { can } from "@/lib/permissions";
import { toMillis } from "@/lib/dashboard-metrics";
import { expenseAccountOf, payeeKeyOf } from "@/lib/payables";
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

interface Payable {
  docId: string;
  docNo: string;
  payeeKey: string;
  payeeName: string;
  kind: string;
  total: number;
  subTotal: number;
  balance: number;
  dueMs: number;
  certWhtRate: number | null; // มีหนังสือรับรองหัก ณ ที่จ่ายแล้ว
  certWhtAmount: number;
  debitLabel: string;
  apPosted: boolean; // บันทึกใบกำกับภาษีซื้อแล้ว (ตั้งหนี้เต็มจำนวน)
}

interface LineState { selected: boolean; amount: string; whtRate: number }

function PaymentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { companyId, role, roles } = useAuth();
  const canSave = can(roles, "finance:edit");

  const { data: expenses, loading } = useRealtimeCollection<any>(companyId ? `companies/${companyId}/expenses` : "");

  // รายการค้างจ่าย (ไม่รวมเอกสารตัวอย่าง/ยกเลิก/จ่ายครบแล้ว)
  const payables: Payable[] = useMemo(
    () => expenses
      .filter((e: any) => !e.isSample && e.isDeleted !== true && String(e.status || "").toLowerCase() !== "cancelled" && !String(e.status || "").toLowerCase().startsWith("paid"))
      .map((e: any) => {
        const total = round2(Number(e.totalAmount) || 0);
        const balance = round2(e.balance !== undefined ? Number(e.balance) : total - (Number(e.paidAmount) || 0));
        const subTotal = round2(Number(e.subTotal ?? total) || 0);
        const hasCert = !!e.whtId;
        const isPo = !!e.poRef && e.documentType !== "ExpenseClaim";
        const apPosted = !!e.apPosted;
        const acct = expenseAccountOf(e);
        return {
          docId: e.id,
          docNo: e.expenseId || e.documentNo || e.id,
          payeeKey: payeeKeyOf(e),
          payeeName: e.supplierName || e.vendor || e.employeeName || "-",
          kind: e.documentType === "ExpenseClaim" ? "เบิกค่าใช้จ่าย" : isPo ? `ซื้อตาม ${e.poRef}` : "ค่าใช้จ่าย",
          total,
          subTotal,
          balance,
          dueMs: toMillis(e.dueDate),
          certWhtRate: hasCert ? Number(e.whtRate) || (subTotal > 0 ? Math.round((Number(e.whtAmount) / subTotal) * 100) : 0) : null,
          certWhtAmount: Number(e.whtAmount) || 0,
          debitLabel: isPo || apPosted ? "2111-00 เจ้าหนี้การค้า" : `${acct.code} ${acct.name}`,
          apPosted,
        };
      })
      .filter((p) => p.balance > 0.009),
    [expenses]
  );

  const payeeOptions = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number }>();
    payables.forEach((p) => {
      const cur = map.get(p.payeeKey) || { name: p.payeeName, total: 0, count: 0 };
      cur.total += p.balance;
      cur.count += 1;
      map.set(p.payeeKey, cur);
    });
    return Array.from(map.entries()).map(([key, c]) => ({
      value: key,
      label: c.name,
      description: `${key.startsWith("EMP:") ? "พนักงาน · " : ""}ค้างจ่าย ${c.count} รายการ รวม ฿${baht(c.total)}`,
    }));
  }, [payables]);

  const [payeeKey, setPayeeKey] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10));
  const [method, setMethod] = useState<Method>("TRANSFER");
  const [bank, setBank] = useState(emptyBank);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Record<string, LineState>>({});
  const [saving, setSaving] = useState(false);
  // รหัสคำขอของการบันทึกครั้งนี้ — เน็ตหลุดแล้วกดบันทึกซ้ำ เซิร์ฟเวอร์คืนเอกสารเดิม ไม่บันทึกเงินซ้ำ (ล้างเมื่อบันทึกสำเร็จ)
  const requestKey = useRef("");
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  // ?expense=<docId> : เลือกผู้รับเงินและรายการให้อัตโนมัติ
  const preset = searchParams?.get("expense") || "";
  useEffect(() => {
    if (!preset || payeeKey) return;
    const p = payables.find((x) => x.docId === preset);
    if (p) {
      setPayeeKey(p.payeeKey);
      setLines({ [p.docId]: { selected: true, amount: String(p.balance), whtRate: 0 } });
    }
  }, [preset, payables, payeeKey]);

  const items = useMemo(
    () => payables.filter((p) => p.payeeKey === payeeKey).sort((a, b) => (a.dueMs || 0) - (b.dueMs || 0)),
    [payables, payeeKey]
  );
  const lineOf = (p: Payable): LineState => lines[p.docId] || { selected: false, amount: String(p.balance), whtRate: 0 };
  const setLine = (p: Payable, patch: Partial<LineState>) => setLines((prev) => ({ ...prev, [p.docId]: { ...lineOf(p), ...patch } }));

  const computed = useMemo(() => items.map((p) => {
    const l = lineOf(p);
    const amount = round2(Math.max(0, Number(l.amount) || 0));
    const fraction = p.total > 0 ? amount / p.total : 1;
    const preVat = round2(p.subTotal * fraction);
    const whtAmount = p.certWhtRate !== null ? round2(p.certWhtAmount * fraction) : round2(preVat * (l.whtRate / 100));
    // บันทึกใบกำกับแล้ว: ภาษีซื้อลงไปแล้ว ตอนจ่ายล้างเจ้าหนี้เต็มจำนวน
    const vat = p.apPosted ? 0 : round2(amount - preVat);
    const debitAmount = p.apPosted ? amount : preVat;
    return { p, l, amount, preVat, vat, debitAmount, whtAmount, net: round2(amount - whtAmount), over: amount > p.balance + 0.009 };
  }), [items, lines]); // eslint-disable-line react-hooks/exhaustive-deps

  const chosen = computed.filter((c) => c.l.selected);
  const totalAmount = round2(chosen.reduce((s, c) => s + c.amount, 0));
  const totalWht = round2(chosen.reduce((s, c) => s + c.whtAmount, 0));
  const totalVat = round2(chosen.reduce((s, c) => s + c.vat, 0));
  const netPaid = round2(totalAmount - totalWht);
  const hasError = chosen.some((c) => c.over || c.amount <= 0);
  const methodDef = METHODS.find((m) => m.id === method)!;

  // รายการบัญชีตัวอย่าง (รวมตามบัญชีเดบิต)
  const debitPreview = useMemo(() => {
    const m = new Map<string, number>();
    chosen.forEach((c) => m.set(c.p.debitLabel, round2((m.get(c.p.debitLabel) || 0) + c.debitAmount)));
    return Array.from(m.entries());
  }, [chosen]);

  const save = async () => {
    setMessage(null);
    if (!payeeKey) return setMessage({ text: "กรุณาเลือกผู้รับเงิน", error: true });
    if (chosen.length === 0) return setMessage({ text: "กรุณาเลือกรายการที่จ่ายชำระ", error: true });
    if (hasError) return setMessage({ text: "ยอดจ่ายต้องมากกว่า 0 และไม่เกินยอดค้าง", error: true });
    const bankMsg = bankError(method, bank, "จ่ายเงิน");
    if (bankMsg) return setMessage({ text: bankMsg, error: true });
    setSaving(true);
    try {
      if (!requestKey.current) requestKey.current = crypto.randomUUID();
      const res = await apiFetch("/api/finance/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId, requestKey: requestKey.current, payeeKey, paymentDate, paymentMethod: method, ...bankPayload(method, bank), reference, note,
          lines: chosen.map((c) => ({ expenseDocId: c.p.docId, amount: c.amount, whtRate: c.l.whtRate })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      requestKey.current = "";
      const certs = (data.whtCertificates || []).length ? ` · ออกหนังสือรับรองหัก ณ ที่จ่าย ${data.whtCertificates.join(", ")}` : "";
      setMessage({ text: `บันทึกใบสำคัญจ่าย ${data.paymentNo} แล้ว จ่ายจริง ฿${baht(data.netPaid)}${certs}` });
      setLines({});
      setPayeeKey("");
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
          <h1 className="text-2xl font-semibold text-white tracking-tight flex items-center gap-2"><HandCoins size={22} className="text-nexus-teal" /> จ่ายชำระเจ้าหนี้</h1>
          <p className="text-sm text-white/60 mt-1">เลือกรายการค้างจ่าย ระบบออกใบสำคัญจ่าย ตัดยอดเจ้าหนี้ ออกหนังสือรับรองหัก ณ ที่จ่าย และบันทึกบัญชีให้</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <PillButton variant="glass" onClick={() => router.back()} className="h-9 px-4 text-xs font-bold text-white/60">ยกเลิก</PillButton>
        <PillButton variant="confirm" onClick={save} disabled={saving || !canSave || chosen.length === 0} className="h-9 px-5 text-xs font-bold">
          {saving ? <><Loader2 size={14} className="animate-spin mr-1.5" /> กำลังบันทึก...</> : "บันทึกจ่ายชำระ"}
        </PillButton>
      </div>
    </div>
  );

  const left = (
    <div className="space-y-4 pb-10">
      {message && (
        <div className={cn("p-3 rounded-xl text-xs font-bold border", message.error ? "bg-danger/10 border-danger/20 text-danger" : "bg-nexus-teal/10 border-nexus-teal/20 text-nexus-teal")}>{message.text}</div>
      )}
      {!canSave && <div className="p-3 rounded-xl text-xs font-bold border bg-warning/10 border-warning/20 text-warning">บัญชีของคุณไม่มีสิทธิ์บันทึกการจ่ายเงิน (ต้องเป็นฝ่ายบัญชีหรือผู้ดูแลระบบ)</div>}

      <GlassCard className="p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
          <div className="space-y-1 md:col-span-2">
            <label className="text-[12px] font-bold text-white/70 ml-1">ผู้รับเงิน <span className="text-danger">*</span></label>
            <SmartSelect
              options={payeeOptions}
              value={payeeKey}
              onChange={(v) => { setPayeeKey(v); setLines({}); }}
              placeholder={loading ? "กำลังโหลด..." : payeeOptions.length ? "เลือกผู้จำหน่าย / พนักงานที่มียอดค้างจ่าย..." : "ไม่มีรายการค้างจ่าย"}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[12px] font-bold text-white/70 ml-1">วันที่จ่าย <span className="text-danger">*</span></label>
            <PillInput type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="w-full h-9 text-sm font-mono" />
          </div>
          <div className="space-y-1">
            <label className="text-[12px] font-bold text-white/70 ml-1">เลขอ้างอิง (เช่น เลขที่โอนเงิน)</label>
            <PillInput value={reference} onChange={(e) => setReference(e.target.value)} placeholder="ถ้ามี" className="w-full h-9 text-sm" />
          </div>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5">
          <div className="space-y-1">
            <label className="text-[12px] font-bold text-white/70 ml-1">วิธีจ่ายเงิน</label>
            <div className="flex gap-2 flex-wrap">
              {METHODS.map((m) => (
                <button key={m.id} type="button" onClick={() => setMethod(m.id)}
                  className={cn("h-9 px-4 rounded-full text-[13px] font-bold border flex items-center gap-1.5", method === m.id ? "bg-nexus-teal/15 border-nexus-teal/40 text-nexus-teal" : "bg-white/[0.02] border-white/10 text-white/50 hover:text-white")}>
                  {m.icon} {m.label}
                </button>
              ))}
            </div>
          </div>
          <BankPaymentFields method={method} value={bank} onChange={setBank} purpose="จ่ายเงิน" />
        </div>
        <div className="space-y-1">
          <label className="text-[12px] font-bold text-white/70 ml-1">หมายเหตุ</label>
          <PillInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="ถ้ามี" className="w-full h-9 text-sm" />
        </div>
      </GlassCard>

      <GlassCard className="p-0 overflow-hidden">
        <NexusTable headers={["", "เลขที่เอกสาร", "วันครบกำหนด", "ยอดค้างจ่าย", "ยอดจ่าย", "อัตราหัก ณ ที่จ่าย", "ยอดจ่ายสุทธิ"]}>
          {!payeeKey && (
            <NexusTableRow><NexusTableCell colSpan={7} className="text-center py-10 text-white/40">เลือกผู้รับเงินเพื่อแสดงรายการค้างจ่าย</NexusTableCell></NexusTableRow>
          )}
          {payeeKey && computed.length === 0 && (
            <NexusTableRow><NexusTableCell colSpan={7} className="text-center py-10 text-white/40">ไม่มีรายการค้างจ่าย</NexusTableCell></NexusTableRow>
          )}
          {computed.map(({ p, l, whtAmount, net, over }) => {
            const overdue = p.dueMs > 0 && p.dueMs < Date.now();
            return (
              <NexusTableRow key={p.docId} className={l.selected ? "bg-nexus-teal/[0.04]" : ""}>
                <NexusTableCell>
                  <input type="checkbox" checked={l.selected} onChange={(e) => setLine(p, { selected: e.target.checked })} className="w-4 h-4 accent-nexus-teal cursor-pointer" />
                </NexusTableCell>
                <NexusTableCell variant="code" title={`${p.kind} · ยอดเต็ม ${baht(p.total)} · ลงบัญชี ${p.debitLabel}${p.apPosted ? " · บันทึกใบกำกับภาษีซื้อแล้ว" : ""}`}>{p.docNo}</NexusTableCell>
                <NexusTableCell className={overdue ? "text-danger font-bold" : ""} title={overdue ? "เกินกำหนดชำระ" : undefined}>{thDate(p.dueMs)}</NexusTableCell>
                <NexusTableCell variant="numeric">{baht(p.balance)}</NexusTableCell>
                <NexusTableCell>
                  <PillInput type="number" value={l.amount} disabled={!l.selected} onChange={(e) => setLine(p, { amount: e.target.value })}
                    className={cn("h-9 w-28 text-right font-mono text-sm", over && "border-danger/60 text-danger")} title={over ? "เกินยอดค้างจ่าย" : undefined} />
                </NexusTableCell>
                <NexusTableCell title={l.selected && whtAmount > 0 ? `ภาษีหัก ณ ที่จ่าย ${baht(whtAmount)} บาท` : undefined}>
                  {p.certWhtRate !== null ? (
                    <span className="text-[12px] text-white/70" title="ใช้อัตราตามหนังสือรับรองที่ออกไว้แล้ว">{p.certWhtRate}% (50 ทวิ)</span>
                  ) : (
                    <PillSelect value={String(l.whtRate)} onChange={(e) => setLine(p, { whtRate: Number(e.target.value) })} className="h-9 w-[92px] pl-4 pr-8 text-sm" disabled={!l.selected}>
                      {WHT_RATES.map((r) => <option key={r} value={String(r)}>{r}%</option>)}
                    </PillSelect>
                  )}
                </NexusTableCell>
                <NexusTableCell variant="numeric" className="text-nexus-teal font-bold">{l.selected ? baht(net) : "-"}</NexusTableCell>
              </NexusTableRow>
            );
          })}
        </NexusTable>
      </GlassCard>
      <p className="text-[12px] text-white/40">ภาษีหัก ณ ที่จ่ายคิดจากยอดก่อน VAT · รายการที่ออกหนังสือรับรอง (50 ทวิ) ไว้แล้วใช้อัตราตามหนังสือ · จ่ายบางส่วนได้</p>
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
        "ออกใบสำคัญจ่าย เลขที่ออกอัตโนมัติ",
        `ตัดยอดค้างจ่าย${chosen.length ? ` ${chosen.length} รายการ` : "ที่เลือก"} — จ่ายไม่ครบ ยอดที่เหลือยังค้างอยู่`,
        totalWht > 0 && `ออกหนังสือรับรองหัก ณ ที่จ่าย (50 ทวิ) ให้ผู้รับเงินอัตโนมัติ ยอด ฿${baht(totalWht)} ต้องนำส่งสรรพากรเดือนถัดไป`,
        method !== "CASH" && `บันทึกในสมุดบัญชีธนาคาร${method === "CHEQUE" ? " และทะเบียนเช็คจ่าย" : ""}`,
        "ส่งรายการบัญชีให้ฝ่ายบัญชีอนุมัติ (ยอดเข้างบหลังอนุมัติ)",
      ]} />
      <GlassCard className="p-4">
        <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2"><Wallet size={16} className="text-nexus-teal" /> สรุปการจ่าย</h4>
        {sideRow("จำนวนรายการ", `${chosen.length} รายการ`)}
        {sideRow("ยอดตัดหนี้", `฿${baht(totalAmount)}`)}
        {sideRow(<>ภาษีหัก ณ ที่จ่าย<InfoTip text="เมื่อจ่ายค่าบริการ/ค่าจ้าง ค่าขนส่ง ค่าเช่า ค่าโฆษณา ให้ผู้รับเงิน ต้องหักภาษีไว้ (3% / 1% / 5% / 2%) จากยอดก่อน VAT · ซื้อสินค้าอย่างเดียวไม่ต้องหัก · ยอดที่หักต้องนำส่งสรรพากร (ภ.ง.ด.3 บุคคล / ภ.ง.ด.53 นิติบุคคล) ภายในวันที่ 7 ของเดือนถัดไป หรือวันที่ 15 ถ้ายื่นออนไลน์" /></>, `฿${baht(totalWht)}`)}
        {sideRow("เงินที่จ่ายจริง", `฿${baht(netPaid)}`, "text-nexus-teal")}
      </GlassCard>

      <GlassCard className="p-4">
        <h4 className="text-sm font-bold text-white mb-2">รายการบัญชีที่จะบันทึก</h4>
        <div className="space-y-1.5 text-[12px]">
          {debitPreview.map(([label, amt]) => (
            <div key={label} className="flex justify-between gap-2"><span className="text-white/70">Dr {label}</span><span className="font-mono text-white">{baht(amt)}</span></div>
          ))}
          {totalVat > 0 && <div className="flex justify-between gap-2"><span className="text-white/70">Dr 1151-00 ภาษีซื้อ</span><span className="font-mono text-white">{baht(totalVat)}</span></div>}
          {totalWht > 0 && <div className="flex justify-between gap-2 pl-4"><span className="text-white/70">Cr 2132-00 ภาษีหัก ณ ที่จ่ายค้างจ่าย</span><span className="font-mono text-white">{baht(totalWht)}</span></div>}
          <div className="flex justify-between gap-2 pl-4"><span className="text-white/70">Cr {methodDef.account}</span><span className="font-mono text-white">{baht(netPaid)}</span></div>
        </div>
        <p className="text-[11px] text-white/40 mt-2">บันทึกเป็นรายการรออนุมัติลงบัญชี</p>
      </GlassCard>
    </div>
  );

  return <NexusPageLayout header={header} leftContent={left} rightSidebar={right} />;
}

export default function NewPaymentPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-white/50 text-sm">กำลังโหลด...</div>}>
      <PaymentForm />
    </Suspense>
  );
}
