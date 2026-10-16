"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import { AlertTriangle, ArrowLeft, Banknote, BookOpenCheck, Box, CheckCircle2, CreditCard, Download, FileUp, HandCoins, Landmark, Loader2, Package, Plus, ReceiptText, Scale, X } from "lucide-react";
import { GlassCard, NexusTable, NexusTableCell, NexusTableRow, PillButton, PillInput, PillSelect, PillTabs, StatusBadge, cn } from "@/components/ui/Base";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { useAuth } from "@/context/AuthContext";
import { useSystemDialog } from "@/context/DialogContext";
import { apiFetch } from "@/lib/api-client";
import { can } from "@/lib/permissions";
import { parseStatementCsv, type StatementRow } from "@/lib/subledgers";

type TabId = "ar-aging" | "ar-statement" | "ap-aging" | "ap-statement" | "bank" | "cheques" | "reconcile" | "assets" | "valuation";
const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "ar-aging", label: "อายุลูกหนี้", icon: <HandCoins size={14} /> },
  { id: "ar-statement", label: "ใบแจ้งยอดลูกค้า", icon: <ReceiptText size={14} /> },
  { id: "ap-aging", label: "อายุเจ้าหนี้", icon: <Banknote size={14} /> },
  { id: "ap-statement", label: "ใบแจ้งยอดผู้ขาย", icon: <ReceiptText size={14} /> },
  { id: "bank", label: "สมุดเงินฝาก", icon: <Landmark size={14} /> },
  { id: "cheques", label: "ทะเบียนเช็ค", icon: <CreditCard size={14} /> },
  { id: "reconcile", label: "กระทบยอดธนาคาร", icon: <Scale size={14} /> },
  { id: "assets", label: "ทะเบียนสินทรัพย์", icon: <Box size={14} /> },
  { id: "valuation", label: "มูลค่าสินค้าคงเหลือ", icon: <Package size={14} /> },
];
const REPORT: Record<TabId, string> = { "ar-aging": "ar-aging", "ar-statement": "ar-statement", "ap-aging": "ap-aging", "ap-statement": "ap-statement", bank: "bank-book", cheques: "cheques", reconcile: "", assets: "assets", valuation: "valuation" };
const RANGE: TabId[] = ["ar-statement", "ap-statement", "bank"];

const money = (n: number) => (n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dash = (n: number) => (n ? money(n) : "-");
const dateTh = (d: string) => { if (!d) return "-"; const [y, m, dd] = d.split("-").map(Number); return `${String(dd).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y + 543}`; };
const thisMonth = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 7);
const TH_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const monthLabel = (ym: string) => { const [y, m] = ym.split("-").map(Number); return `${TH_MONTHS[m - 1]} ${y + 543}`; };

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const url = URL.createObjectURL(new Blob(["﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

const CHEQUE_STATUS: Record<string, { label: string; badge: "active" | "inactive" | "pending" | "warning" | "danger" }> = {
  PENDING: { label: "รอดำเนินการ", badge: "pending" },
  DEPOSITED: { label: "นำฝากแล้ว", badge: "warning" },
  CLEARED: { label: "เรียกเก็บ/ขึ้นเงินแล้ว", badge: "active" },
  BOUNCED: { label: "เช็คคืน", badge: "danger" },
  CANCELLED: { label: "ยกเลิก", badge: "inactive" },
};

export default function SubledgersPageWrapper() {
  return <Suspense fallback={<div className="p-10 text-white/40 text-sm">กำลังโหลด…</div>}><SubledgersPage /></Suspense>;
}

function SubledgersPage() {
  const router = useRouter();
  const search = useSearchParams();
  const { companyId, roles } = useAuth();
  const { showAlert, showConfirm } = useSystemDialog();
  const canEdit = can(roles, "finance:edit");
  const [tab, setTab] = useState<TabId>(() => (TABS.some((t) => t.id === search?.get("tab")) ? (search!.get("tab") as TabId) : "ar-aging"));
  const [from, setFrom] = useState(() => `${thisMonth().slice(0, 4)}-01`);
  const [to, setTo] = useState(thisMonth);
  const [party, setParty] = useState("");
  const [bookId, setBookId] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [bankDialog, setBankDialog] = useState<any>(null);
  const isRange = RANGE.includes(tab);

  const load = useCallback(async () => {
    if (!companyId || !REPORT[tab]) { setData(null); return; }
    setLoading(true); setError("");
    try {
      const res = await apiFetch("/api/reports/subledger", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, report: REPORT[tab], from: isRange ? from : to, to, customerId: tab === "ar-statement" ? party : undefined, payeeKey: tab === "ap-statement" ? party : undefined, bookId: tab === "bank" ? bookId : undefined }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || "โหลดข้อมูลไม่สำเร็จ");
      setData({ ...result, tab });
      if ((tab === "ar-statement" || tab === "ap-statement") && !party) setParty(result.customerId || result.payeeKey || "");
      if (tab === "bank" && !bookId) setBookId(result.bookId || "");
    } catch (e: any) { setError(e.message); setData(null); }
    finally { setLoading(false); }
  }, [companyId, tab, from, to, party, bookId, isRange, reload]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);
  const changeTab = (id: TabId) => { setTab(id); setData(null); setParty(""); router.replace(`/finance/subledgers?tab=${id}`); };
  const ready = data && data.tab === tab;

  const chequeAction = async (id: string, action: string, label: string) => {
    if (!(await showConfirm(`ยืนยัน${label}?`))) return;
    const res = await apiFetch("/api/finance/cheques", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, id, action }) });
    const r = await res.json();
    if (!res.ok || !r.success) return void showAlert(r.error || "ดำเนินการไม่สำเร็จ");
    if (action === "bounce") await showAlert("บันทึกเช็คคืนแล้ว กรุณายกเลิกใบเสร็จที่ผูกกับเช็คนี้ เพื่อคืนยอดลูกหนี้และกลับรายการบัญชี");
    setReload((n) => n + 1);
  };

  const exportCsv = () => {
    if (!ready) return;
    const t = TABS.find((x) => x.id === tab)!.label;
    let rows: (string | number)[][] = [];
    if (tab === "ar-aging" || tab === "ap-aging") rows = [["ชื่อ", "ยอดค้าง", "เกินกำหนด", "ค้างนานสุด (วัน)"], ...data.top.map((x: any) => [x.name, x.amount, x.overdue, x.oldestDays])];
    else if ((tab === "ar-statement" || tab === "ap-statement") && data.statement) rows = [[data.party?.name || ""], ["วันที่", "เลขที่เอกสาร", "ประเภท", "อ้างอิง", "เดบิต", "เครดิต", "คงเหลือ"], ["", "", "ยอดยกมา", "", "", "", data.statement.opening], ...data.statement.entries.map((e: any) => [dateTh(e.date), e.docNo, e.kind, e.ref, e.debit, e.credit, e.balance])];
    else if (tab === "bank") rows = [["วันที่", "เลขที่เอกสาร", "รายการ", "ผู้รับ/ผู้จ่าย", "วิธี", "รับ", "จ่าย", "คงเหลือ"], ["", "", "ยอดยกมา", "", "", "", "", data.book.opening], ...data.book.entries.map((e: any) => [dateTh(e.date), e.docNo, e.kind, e.party, e.method, e.inAmount, e.outAmount, e.balance])];
    else if (tab === "cheques") rows = [["ประเภท", "เลขที่เช็ค", "วันที่หน้าเช็ค", "ธนาคาร", "คู่ค้า", "เอกสาร", "จำนวนเงิน", "สถานะ"], ...data.rows.map((c: any) => [c.direction === "IN" ? "เช็ครับ" : "เช็คจ่าย", c.chequeNo, dateTh(c.chequeDate), c.chequeBank || c.bankAccount, c.party, c.docNo, c.amount, CHEQUE_STATUS[c.status]?.label || c.status])];
    else if (tab === "assets") rows = [["รหัส", "ชื่อสินทรัพย์", "หมวด", "วันที่ได้มา", "ราคาทุน", "ค่าเสื่อมต่อเดือน", "ค่าเสื่อมสะสม", "มูลค่าตามบัญชี"], ...data.rows.map((a: any) => [a.code, a.name, a.category, dateTh(a.purchaseDate), a.cost, a.monthly, a.accumulated, a.bookValue])];
    else if (tab === "valuation") rows = [["รหัสสินค้า", "ชื่อสินค้า", "หมวด", "คงเหลือ", "หน่วย", "ต้นทุนเฉลี่ย", "มูลค่า"], ...data.rows.map((p: any) => [p.sku, p.name, p.category, p.onHand, p.unit, p.wac, p.value])];
    downloadCsv(`${tab}_${to}.csv`, [[t], [], ...rows]);
  };

  const header = (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-6 rounded-3xl backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <PillButton variant="glass" onClick={() => router.push("/finance")} className="w-10 h-10 p-0 flex items-center justify-center"><ArrowLeft size={20} /></PillButton>
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">บัญชีย่อยและทะเบียน</h1>
          <p className="text-sm text-white/60 font-medium mt-1">ลูกหนี้ เจ้าหนี้ เงินฝากธนาคาร เช็ค สินทรัพย์ และสินค้าคงเหลือ จากเอกสารจริงของบริษัท</p>
        </div>
      </div>
    </div>
  );

  const left = (
    <div className="space-y-4 pb-10">
      <div className="flex flex-wrap items-center gap-3">
        <PillTabs className="flex-1 min-w-[min(100%,520px)]" tabs={TABS} activeTab={tab} onTabChange={(id) => changeTab(id as TabId)} />
        <div className="flex items-center gap-2 flex-wrap">
          {isRange && (
            <>
              <PillInput type="month" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} className="h-9 w-[160px] px-4 text-sm font-mono" aria-label="ตั้งแต่เดือน" />
              <span className="text-white/40 text-sm">ถึง</span>
              <PillInput type="month" value={to} onChange={(e) => e.target.value && setTo(e.target.value)} className="h-9 w-[160px] px-4 text-sm font-mono" aria-label="ถึงเดือน" />
            </>
          )}
          {tab === "bank" && canEdit && (
            <PillButton variant="primary" className="h-9 px-4 text-xs font-bold" onClick={() => setBankDialog({})}><Plus size={14} className="mr-1.5" /> เพิ่มบัญชีธนาคาร</PillButton>
          )}
          {tab !== "reconcile" && (
            <PillButton variant="glass" className="h-9 px-4 text-xs font-bold" onClick={exportCsv} disabled={!ready || loading}><Download size={14} className="mr-1.5" /> ส่งออก Excel</PillButton>
          )}
        </div>
      </div>

      {ready && (tab === "ar-statement" || tab === "ap-statement") && (
        <div className="flex items-center gap-3">
          <span className="text-[13px] text-white/60 whitespace-nowrap">{tab === "ar-statement" ? "ลูกค้า" : "ผู้ขาย/ผู้รับเงิน"}</span>
          <PillSelect value={party} onChange={(e) => setParty(e.target.value)} className="h-9 px-4 w-[380px] max-w-full text-sm">
            {data.parties.length === 0 && <option value="">ยังไม่มีข้อมูล</option>}
            {data.parties.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </PillSelect>
        </div>
      )}
      {ready && tab === "bank" && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[13px] text-white/60 whitespace-nowrap">บัญชี</span>
          <PillSelect value={bookId} onChange={(e) => setBookId(e.target.value)} className="h-9 px-4 w-[380px] max-w-full text-sm">
            {data.books.map((b: any) => <option key={b.id} value={b.id}>{b.name}{b.active ? "" : " (ปิดใช้งาน)"} · {b.count} รายการ</option>)}
          </PillSelect>
          {canEdit && data.books.find((b: any) => b.id === bookId)?.account && (
            <button type="button" className="text-[13px] text-nexus-teal hover:underline" onClick={() => setBankDialog(data.books.find((b: any) => b.id === bookId).account)}>แก้ไขบัญชีนี้</button>
          )}
        </div>
      )}

      {error && <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-danger text-xs font-bold">{error}</div>}

      {tab === "reconcile" ? (
        <ReconcilePanel companyId={companyId || ""} canEdit={canEdit} />
      ) : (
        <GlassCard accentColor="teal" className="p-0 overflow-hidden">
          {loading && !ready ? (
            <div className="py-16 flex items-center justify-center gap-2 text-[13px] text-white/40"><Loader2 size={16} className="animate-spin" /> กำลังโหลด…</div>
          ) : !ready ? (
            <div className="py-16 text-center text-[13px] text-white/40">ไม่มีข้อมูล</div>
          ) : (
            <TabBody tab={tab} data={data} canEdit={canEdit} onCheque={chequeAction} periodText={isRange ? `${monthLabel(from)} – ${monthLabel(to)}` : ""} />
          )}
        </GlassCard>
      )}

      <BankAccountDialog
        value={bankDialog}
        companyId={companyId || ""}
        onClose={() => setBankDialog(null)}
        onSaved={(id) => { setBankDialog(null); if (id) setBookId(id); setReload((n) => n + 1); }}
      />
    </div>
  );

  return <NexusPageLayout header={header} leftContent={left} />;
}

const TotalRow = ({ cells }: { cells: React.ReactNode[] }) => (
  <NexusTableRow className="bg-white/[0.03] cursor-default">{cells.map((c, i) => <NexusTableCell key={i} className="font-bold text-white">{c}</NexusTableCell>)}</NexusTableRow>
);
const Empty = ({ cols, text }: { cols: number; text: string }) => (
  <NexusTableRow className="cursor-default"><NexusTableCell colSpan={cols} className="text-center text-[13px] text-white/40 py-10">{text}</NexusTableCell></NexusTableRow>
);
const CardHead = ({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-white/5 flex-wrap">
    <div><h3 className="text-[16px] font-semibold text-white leading-normal">{title}</h3>{sub && <p className="text-[13px] text-white/50 leading-normal">{sub}</p>}</div>
    {right}
  </div>
);

function TabBody({ tab, data, canEdit, onCheque, periodText }: { tab: TabId; data: any; canEdit: boolean; onCheque: (id: string, action: string, label: string) => void; periodText: string }) {
  if (tab === "ar-aging" || tab === "ap-aging") {
    const isAr = tab === "ar-aging";
    return (
      <>
        <CardHead title={isAr ? "อายุลูกหนี้" : "อายุเจ้าหนี้"} sub={`ณ วันนี้ · รวม ${money(data.total)} บาท · เกินกำหนด ${money(data.overdue)} บาท`} />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 px-6 py-4 border-b border-white/5">
          {data.buckets.map((b: any) => (
            <div key={b.key} className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
              <p className="text-[12px] text-white/50 leading-normal">{b.label}</p>
              <p className={cn("text-[15px] font-bold font-mono", b.key !== "current" && b.amount > 0 ? "text-warning" : "text-white")}>{money(b.amount)}</p>
              <p className="text-[11px] text-white/40">{b.count} รายการ</p>
            </div>
          ))}
        </div>
        <NexusTable headers={[isAr ? "ชื่อลูกค้า" : "ชื่อผู้ขาย/ผู้รับเงิน", "ยอดค้าง", "เกินกำหนด", "ค้างนานสุด"]} itemCount={data.top.length}>
          {data.top.length === 0 && <Empty cols={4} text={isAr ? "ไม่มีลูกหนี้คงค้าง" : "ไม่มีเจ้าหนี้คงค้าง"} />}
          {data.top.map((t: any) => (
            <NexusTableRow key={t.name} className="cursor-default">
              <NexusTableCell title={t.name}>{t.name}</NexusTableCell>
              <NexusTableCell mono>{money(t.amount)}</NexusTableCell>
              <NexusTableCell mono className={t.overdue > 0 ? "text-warning" : ""}>{dash(t.overdue)}</NexusTableCell>
              <NexusTableCell>{t.oldestDays > 0 ? `${t.oldestDays} วัน` : "ยังไม่ถึงกำหนด"}</NexusTableCell>
            </NexusTableRow>
          ))}
          {data.top.length > 0 && <TotalRow cells={["รวม", money(data.total), money(data.overdue), ""]} />}
        </NexusTable>
      </>
    );
  }
  if (tab === "ar-statement" || tab === "ap-statement") {
    const s = data.statement;
    const isAr = tab === "ar-statement";
    const info = data.partyInfo;
    return (
      <>
        <CardHead title={`ใบแจ้งยอด${isAr ? "ลูกค้า" : "ผู้ขาย"}: ${data.party?.name || "-"}`} sub={[periodText, info?.taxId ? `เลขประจำตัวผู้เสียภาษี ${info.taxId}` : ""].filter(Boolean).join(" · ")}
          right={s && <span className="text-[13px] text-white/70">ยอด{isAr ? "ค้างชำระ" : "ค้างจ่าย"} ณ สิ้นงวด <span className="font-mono font-bold text-white">{money(s.closing)}</span></span>} />
        {!s ? <div className="py-16 text-center text-[13px] text-white/40">เลือก{isAr ? "ลูกค้า" : "ผู้ขาย"}</div> : (
          <NexusTable headers={["วันที่", "เลขที่เอกสาร", "ประเภทเอกสาร", "อ้างอิง", isAr ? "เดบิต (เพิ่มหนี้)" : "ตั้งหนี้", isAr ? "เครดิต (ลดหนี้)" : "จ่ายชำระ", "คงเหลือ"]} itemCount={s.entries.length}>
            <TotalRow cells={["", "", "ยอดยกมา", "", "", "", money(s.opening)]} />
            {s.entries.length === 0 && <Empty cols={7} text="ไม่มีรายการในช่วงนี้" />}
            {s.entries.map((e: any, i: number) => (
              <NexusTableRow key={`${e.docNo}-${i}`} className="cursor-default">
                <NexusTableCell mono>{dateTh(e.date)}</NexusTableCell>
                <NexusTableCell mono>{e.docNo}</NexusTableCell>
                <NexusTableCell>{e.kind}</NexusTableCell>
                <NexusTableCell mono title={e.ref}>{e.ref || "-"}</NexusTableCell>
                <NexusTableCell mono>{dash(e.debit)}</NexusTableCell>
                <NexusTableCell mono>{dash(e.credit)}</NexusTableCell>
                <NexusTableCell mono className={e.balance < 0 ? "text-danger" : ""}>{money(e.balance)}</NexusTableCell>
              </NexusTableRow>
            ))}
            <TotalRow cells={["", "", "รวม / คงเหลือ", "", money(s.totalDebit), money(s.totalCredit), money(s.closing)]} />
          </NexusTable>
        )}
      </>
    );
  }
  if (tab === "bank") {
    const b = data.book;
    const book = data.books.find((x: any) => x.id === data.bookId);
    return (
      <>
        <CardHead title={`สมุด${data.bookId === "CASH" ? "เงินสด" : "เงินฝาก"}: ${book?.name || "-"}`} sub={periodText}
          right={<span className="text-[13px] text-white/70">คงเหลือ ณ สิ้นงวด <span className="font-mono font-bold text-white">{money(b.closing)}</span></span>} />
        {data.books.length === 1 && data.bookId === "CASH" && (
          <p className="px-6 py-3 text-[12px] text-white/50 border-b border-white/5">ยังไม่มีทะเบียนบัญชีธนาคาร กด &quot;เพิ่มบัญชีธนาคาร&quot; แล้วใส่ชื่อที่เคยพิมพ์ในใบเสร็จเดิมไว้ในช่อง &quot;ชื่อเดิมที่เคยใช้&quot; ระบบจะจัดเอกสารเดิมเข้าบัญชีให้</p>
        )}
        <NexusTable headers={["วันที่", "เลขที่เอกสาร", "รายการ", "ผู้รับ/ผู้จ่าย", "วิธีชำระ", "รับเงิน", "จ่ายเงิน", "คงเหลือ"]} itemCount={b.entries.length}>
          <TotalRow cells={["", "", "ยอดยกมา", "", "", "", "", money(b.opening)]} />
          {b.entries.length === 0 && <Empty cols={8} text="ไม่มีรายการในช่วงนี้" />}
          {b.entries.map((e: any) => (
            <NexusTableRow key={e.key} className="cursor-default">
              <NexusTableCell mono>{dateTh(e.date)}</NexusTableCell>
              <NexusTableCell mono>{e.docNo}</NexusTableCell>
              <NexusTableCell>{e.kind}</NexusTableCell>
              <NexusTableCell title={e.party}>{e.party || "-"}</NexusTableCell>
              <NexusTableCell>{e.method || "-"}</NexusTableCell>
              <NexusTableCell mono>{dash(e.inAmount)}</NexusTableCell>
              <NexusTableCell mono>{dash(e.outAmount)}</NexusTableCell>
              <NexusTableCell mono className={e.balance < 0 ? "text-danger" : ""}>{money(e.balance)}</NexusTableCell>
            </NexusTableRow>
          ))}
          <TotalRow cells={["", "", "รวม / คงเหลือ", "", "", money(b.totalIn), money(b.totalOut), money(b.closing)]} />
        </NexusTable>
      </>
    );
  }
  if (tab === "cheques") {
    const pending = data.rows.filter((c: any) => ["PENDING", "DEPOSITED"].includes(c.status));
    return (
      <>
        <CardHead title="ทะเบียนเช็ค" sub={`ทั้งหมด ${data.rows.length} ฉบับ · รอดำเนินการ ${pending.length} ฉบับ ${money(pending.reduce((s: number, c: any) => s + (c.direction === "IN" ? c.amount : -c.amount), 0))} บาท (รับ − จ่าย)`} />
        <NexusTable headers={["ประเภท", "เลขที่เช็ค", "วันที่หน้าเช็ค", "ธนาคาร", "คู่ค้า", "เลขที่เอกสาร", "จำนวนเงิน", "สถานะ", "จัดการ"]} itemCount={data.rows.length}>
          {data.rows.length === 0 && <Empty cols={9} text="ยังไม่มีเช็คในระบบ (เช็คจะถูกบันทึกอัตโนมัติเมื่อรับ/จ่ายด้วยเช็ค)" />}
          {data.rows.map((c: any) => {
            const st = CHEQUE_STATUS[c.status] || { label: c.status, badge: "pending" as const };
            const actions: [string, string][] = !canEdit ? [] : c.direction === "IN"
              ? (c.status === "PENDING" ? [["deposit", "นำฝาก"], ["clear", "เรียกเก็บได้"], ["bounce", "เช็คคืน"]] : c.status === "DEPOSITED" ? [["clear", "เรียกเก็บได้"], ["bounce", "เช็คคืน"]] : [])
              : (c.status === "PENDING" ? [["clear", "ขึ้นเงินแล้ว"]] : []);
            return (
              <NexusTableRow key={c.id} className="cursor-default">
                <NexusTableCell>{c.direction === "IN" ? "เช็ครับ" : "เช็คจ่าย"}</NexusTableCell>
                <NexusTableCell mono>{c.chequeNo}</NexusTableCell>
                <NexusTableCell mono>{dateTh(c.chequeDate)}</NexusTableCell>
                <NexusTableCell title={c.chequeBank || c.bankAccount}>{c.chequeBank || c.bankAccount || "-"}</NexusTableCell>
                <NexusTableCell title={c.party}>{c.party || "-"}</NexusTableCell>
                <NexusTableCell mono>{c.docNo}</NexusTableCell>
                <NexusTableCell mono>{money(c.amount)}</NexusTableCell>
                <NexusTableCell><StatusBadge status={st.badge} label={st.label} /></NexusTableCell>
                <NexusTableCell>
                  <div className="flex gap-2 justify-center">
                    {actions.length === 0 ? <span className="text-white/30">-</span> : actions.map(([a, l]) => (
                      <button key={a} type="button" onClick={() => onCheque(c.id, a, `${l} เช็ค ${c.chequeNo}`)} className={cn("text-[12px] hover:underline whitespace-nowrap", a === "bounce" ? "text-danger" : "text-nexus-teal")}>{l}</button>
                    ))}
                  </div>
                </NexusTableCell>
              </NexusTableRow>
            );
          })}
        </NexusTable>
      </>
    );
  }
  if (tab === "assets") {
    return (
      <>
        <CardHead title="ทะเบียนสินทรัพย์ถาวร" sub={`${data.rows.length} รายการ · ค่าเสื่อมราคาต่อเดือนรวม ${money(data.totals.monthly)} บาท`}
          right={data.history?.[0] && <span className="text-[13px] text-white/60">คิดค่าเสื่อมล่าสุดงวด {data.history[0].period}</span>} />
        <NexusTable headers={["รหัสสินทรัพย์", "ชื่อสินทรัพย์", "หมวดหมู่", "วันที่ได้มา", "ราคาทุน", "ค่าเสื่อมต่อเดือน", "ค่าเสื่อมสะสม", "มูลค่าตามบัญชี", "สถานะ"]} itemCount={data.rows.length}>
          {data.rows.length === 0 && <Empty cols={9} text="ยังไม่มีสินทรัพย์ถาวรในทะเบียน" />}
          {data.rows.map((a: any) => (
            <NexusTableRow key={a.id} className="cursor-default">
              <NexusTableCell mono>{a.code}</NexusTableCell>
              <NexusTableCell title={a.name}>{a.name}</NexusTableCell>
              <NexusTableCell>{a.category}</NexusTableCell>
              <NexusTableCell mono>{dateTh(a.purchaseDate)}</NexusTableCell>
              <NexusTableCell mono>{money(a.cost)}</NexusTableCell>
              <NexusTableCell mono>{dash(a.monthly)}</NexusTableCell>
              <NexusTableCell mono>{dash(a.accumulated)}</NexusTableCell>
              <NexusTableCell mono>{money(a.bookValue)}</NexusTableCell>
              <NexusTableCell><StatusBadge status={a.status === "active" ? "active" : "inactive"} label={a.status === "active" ? "ใช้งาน" : "เลิกใช้"} /></NexusTableCell>
            </NexusTableRow>
          ))}
          {data.rows.length > 0 && <TotalRow cells={["", "รวม", "", "", money(data.totals.cost), money(data.totals.monthly), money(data.totals.accumulated), money(data.totals.bookValue), ""]} />}
        </NexusTable>
      </>
    );
  }
  // valuation
  return (
    <>
      <CardHead title="มูลค่าสินค้าคงเหลือ" sub={`ณ ปัจจุบัน · ${data.totalItems} รายการ · ยอดคงเหลือ × ต้นทุนเฉลี่ยถ่วงน้ำหนัก`} right={<span className="text-[13px] text-white/70">มูลค่ารวม <span className="font-mono font-bold text-white">{money(data.totalValue)}</span></span>} />
      <NexusTable headers={["รหัสสินค้า", "ชื่อสินค้า", "หมวดหมู่", "คงเหลือ", "หน่วย", "ต้นทุนเฉลี่ย", "มูลค่า"]} itemCount={data.rows.length}>
        {data.rows.length === 0 && <Empty cols={7} text="ยังไม่มีสินค้า" />}
        {data.rows.map((p: any) => (
          <NexusTableRow key={p.id} className="cursor-default">
            <NexusTableCell mono>{p.sku || "-"}</NexusTableCell>
            <NexusTableCell title={p.name}>{p.name}</NexusTableCell>
            <NexusTableCell>{p.category}</NexusTableCell>
            <NexusTableCell mono>{p.onHand.toLocaleString("th-TH")}</NexusTableCell>
            <NexusTableCell>{p.unit}</NexusTableCell>
            <NexusTableCell mono>{money(p.wac)}</NexusTableCell>
            <NexusTableCell mono>{money(p.value)}</NexusTableCell>
          </NexusTableRow>
        ))}
        {data.rows.length > 0 && <TotalRow cells={["", "รวม", "", "", "", "", money(data.totalValue)]} />}
      </NexusTable>
    </>
  );
}

/** เพิ่ม/แก้ไขบัญชีธนาคาร */
function BankAccountDialog({ value, companyId, onClose, onSaved }: { value: any; companyId: string; onClose: () => void; onSaved: (id?: string) => void }) {
  const [f, setF] = useState<any>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (value) setF({ name: value.name || "", bankName: value.bankName || "", accountNo: value.accountNo || "", branch: value.branch || "", accountType: value.accountType || "SAVINGS", openingBalance: value.openingBalance ?? 0, openingDate: value.openingDate || "", legacy: (value.legacyLabels || []).join(", "), active: value.active !== false });
    setErr("");
  }, [value]);
  if (!value || !mounted) return null;
  const isEdit = !!value.id;
  const save = async () => {
    setBusy(true); setErr("");
    try {
      const res = await apiFetch("/api/finance/bank-accounts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, action: isEdit ? "update" : "create", id: value.id, ...f, legacyLabels: String(f.legacy || "").split(",").map((s: string) => s.trim()).filter(Boolean) }),
      });
      const r = await res.json();
      if (!res.ok || !r.success) throw new Error(r.error || "บันทึกไม่สำเร็จ");
      if (isEdit && f.active !== (value.active !== false)) {
        await apiFetch("/api/finance/bank-accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "setActive", id: value.id, active: f.active }) });
      }
      onSaved(r.id);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const field = (label: string, key: string, props: any = {}) => (
    <div className="space-y-1">
      <label className="text-[12px] font-bold text-white/70 ml-1">{label}</label>
      <PillInput value={f[key] ?? ""} onChange={(e) => setF({ ...f, [key]: e.target.value })} className="w-full h-9 text-sm" {...props} />
    </div>
  );
  return createPortal(
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => !busy && onClose()} />
      <div className="relative w-full max-w-[640px] max-h-[90vh] overflow-y-auto bg-surface-0 border border-white/10 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h3 className="text-[16px] font-semibold text-white">{isEdit ? "แก้ไขบัญชีธนาคาร" : "เพิ่มบัญชีธนาคาร"}</h3>
          <button type="button" onClick={onClose} disabled={busy} className="text-white/40 hover:text-white" aria-label="ปิด"><X size={18} /></button>
        </div>
        <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {field("ชื่อเรียกบัญชี *", "name", { placeholder: "เช่น กสิกร ออมทรัพย์" })}
          {field("เลขที่บัญชี *", "accountNo", { placeholder: "123-4-56789-0", className: "w-full h-9 text-sm font-mono" })}
          {field("ธนาคาร", "bankName", { placeholder: "เช่น ธนาคารกสิกรไทย" })}
          {field("สาขา", "branch")}
          <div className="space-y-1">
            <label className="text-[12px] font-bold text-white/70 ml-1">ประเภทบัญชี</label>
            <PillSelect value={f.accountType} onChange={(e) => setF({ ...f, accountType: e.target.value })} className="w-full h-9 text-sm">
              <option value="SAVINGS">ออมทรัพย์</option><option value="CURRENT">กระแสรายวัน</option><option value="FIXED">ฝากประจำ</option>
            </PillSelect>
          </div>
          {field("ยอดยกมา (บาท)", "openingBalance", { type: "number", className: "w-full h-9 text-sm font-mono" })}
          {field("วันที่ของยอดยกมา", "openingDate", { type: "date" })}
          <div className="sm:col-span-2">{field("ชื่อเดิมที่เคยใช้ในใบเสร็จ/ใบสำคัญจ่าย (คั่นด้วย ,)", "legacy", { placeholder: "เช่น กสิกร, KBANK 123-4" })}</div>
          {isEdit && (
            <label className="flex items-center gap-2 text-[13px] text-white/70 sm:col-span-2">
              <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> ใช้งานบัญชีนี้ (ปิดแล้วเลือกในเอกสารใหม่ไม่ได้ แต่ประวัติยังอยู่)
            </label>
          )}
        </div>
        {err && <p className="px-6 text-[12px] text-danger font-bold">{err}</p>}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-white/10">
          <PillButton variant="ghost" className="h-9 px-5 text-xs" onClick={onClose} disabled={busy}>ยกเลิก</PillButton>
          <PillButton variant="confirm" className="h-9 px-5 text-xs font-bold" onClick={save} disabled={busy}>{busy ? "กำลังบันทึก…" : "บันทึก"}</PillButton>
        </div>
      </div>
    </div>,
    document.body
  );
}

/** กระทบยอดธนาคาร: เลือกบัญชี/เดือน -> นำเข้า CSV -> จับคู่อัตโนมัติ -> ปรับคู่ -> บันทึก */
function ReconcilePanel({ companyId, canEdit }: { companyId: string; canEdit: boolean }) {
  const { showAlert } = useSystemDialog();
  const [books, setBooks] = useState<any[]>([]);
  const [bookId, setBookId] = useState("");
  const [month, setMonth] = useState(thisMonth);
  const [rows, setRows] = useState<StatementRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [result, setResult] = useState<any>(null);
  const [matches, setMatches] = useState<{ bookKey: string; rowIndex: number }[]>([]);
  const [closing, setClosing] = useState("");
  const [saved, setSaved] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!companyId) return;
    apiFetch("/api/reports/subledger", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, report: "bank-book" }) })
      .then((r) => r.json()).then((d) => { if (d.success) { const bs = d.books.filter((b: any) => b.id !== "CASH"); setBooks(bs); setBookId((x) => x || bs[0]?.id || ""); } });
  }, [companyId]);
  useEffect(() => {
    setResult(null); setMatches([]); setSaved(null);
    if (!companyId || !bookId) return;
    apiFetch("/api/finance/bank-reconcile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "get", bookId, month }) })
      .then((r) => r.json()).then((d) => setSaved(d.saved || null));
  }, [companyId, bookId, month]);

  const call = async (action: "match" | "save", extra: any = {}) => {
    const res = await apiFetch("/api/finance/bank-reconcile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action, bookId, month, rows, ...extra }) });
    const d = await res.json();
    if (!res.ok || !d.success) throw new Error(d.error || "ดำเนินการไม่สำเร็จ");
    return d;
  };
  const onFile = async (file?: File) => {
    if (!file) return;
    const { rows: parsed, errors } = parseStatementCsv(await file.text());
    setRows(parsed); setParseErrors(errors); setResult(null); setMatches([]);
    if (!parsed.length) return;
    setBusy(true);
    try { const d = await callWith(parsed); setResult(d); setMatches(d.matches); } catch (e: any) { showAlert(e.message); } finally { setBusy(false); }
  };
  const callWith = async (r: StatementRow[]) => {
    const res = await apiFetch("/api/finance/bank-reconcile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "match", bookId, month, rows: r }) });
    const d = await res.json();
    if (!res.ok || !d.success) throw new Error(d.error || "จับคู่ไม่สำเร็จ");
    return d;
  };
  const matchedKeys = new Set(matches.map((m) => m.bookKey)), matchedRows = new Set(matches.map((m) => m.rowIndex));
  const unmatch = (bookKey: string) => setMatches((m) => m.filter((x) => x.bookKey !== bookKey));
  const [pick, setPick] = useState<string>("");
  const pair = (rowIndex: number) => { if (!pick) return; setMatches((m) => [...m.filter((x) => x.bookKey !== pick && x.rowIndex !== rowIndex), { bookKey: pick, rowIndex }]); setPick(""); };
  const save = async () => {
    setBusy(true);
    try { const d = await call("save", { matches, statementClosing: Number(closing) || 0 }); setSaved(d); showAlert(Math.abs(d.difference) < 0.01 ? "บันทึกการกระทบยอดแล้ว ยอดตรงกับ statement" : `บันทึกแล้ว ยังมีผลต่าง ${money(d.difference)} บาท`); }
    catch (e: any) { showAlert(e.message); } finally { setBusy(false); }
  };
  const book = result?.book;
  const outstanding = book ? book.entries.filter((e: any) => !matchedKeys.has(e.key)) : [];
  const unrecorded = rows.map((r, i) => ({ ...r, i })).filter((r) => !matchedRows.has(r.i));
  const adjusted = book ? Math.round((book.closing - outstanding.reduce((s: number, e: any) => s + e.inAmount - e.outAmount, 0) + unrecorded.reduce((s, r) => s + r.amount, 0)) * 100) / 100 : 0;
  const diff = closing === "" ? null : Math.round(((Number(closing) || 0) - adjusted) * 100) / 100;

  return (
    <div className="space-y-4">
      <GlassCard accentColor="teal" className="p-5 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="block text-[12px] font-bold text-white/70 ml-1">บัญชีธนาคาร</label>
            <PillSelect value={bookId} onChange={(e) => setBookId(e.target.value)} className="h-9 px-4 w-[320px] max-w-full text-sm">
              {books.length === 0 && <option value="">ยังไม่มีทะเบียนบัญชีธนาคาร</option>}
              {books.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </PillSelect>
          </div>
          <div className="space-y-1">
            <label className="block text-[12px] font-bold text-white/70 ml-1">เดือน</label>
            <PillInput type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="h-9 w-[170px] px-4 text-sm font-mono" />
          </div>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
          <PillButton variant="primary" className="h-9 px-4 text-xs font-bold" disabled={!bookId || busy} onClick={() => fileRef.current?.click()}>
            {busy ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <FileUp size={14} className="mr-1.5" />} นำเข้า statement (CSV)
          </PillButton>
        </div>
        <p className="text-[12px] text-white/50">ไฟล์ CSV จากธนาคารต้องมีคอลัมน์ วันที่ และ ถอน/ฝาก (หรือ จำนวนเงิน) · ระบบจับคู่รายการที่ยอดเท่ากันและวันที่ห่างไม่เกิน 3 วันให้อัตโนมัติ คลิกรายการในสมุดแล้วคลิกรายการใน statement เพื่อจับคู่เอง</p>
        {saved && <p className="text-[12px] text-nexus-teal flex items-center gap-1.5"><BookOpenCheck size={14} /> กระทบยอดเดือนนี้ไว้แล้ว: จับคู่ {saved.matches?.length || 0} รายการ · ผลต่าง {money(saved.difference || 0)} บาท</p>}
        {parseErrors.length > 0 && <div className="text-[12px] text-warning space-y-0.5">{parseErrors.slice(0, 5).map((e) => <p key={e}>• {e}</p>)}</div>}
      </GlassCard>

      {book && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {[["ยอดตามสมุด สิ้นเดือน", book.closing], ["รายการในสมุดที่ธนาคารยังไม่ผ่าน", outstanding.reduce((s: number, e: any) => s + e.inAmount - e.outAmount, 0)], ["รายการในธนาคารที่ยังไม่บันทึก", unrecorded.reduce((s, r) => s + r.amount, 0)], ["ยอดตามสมุดหลังปรับ", adjusted]].map(([l, v]) => (
              <div key={String(l)} className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
                <p className="text-[12px] text-white/50 leading-normal">{l}</p>
                <p className="text-[15px] font-bold font-mono text-white">{money(Number(v))}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
            <GlassCard className="p-0 overflow-hidden">
              <CardHead title={`สมุดเงินฝาก (${book.entries.length} รายการ)`} sub={`จับคู่แล้ว ${matches.length} · คลิกรายการที่ยังไม่จับคู่เพื่อเลือก`} />
              <NexusTable headers={["วันที่", "เลขที่เอกสาร", "ผู้รับ/ผู้จ่าย", "จำนวนเงิน", "สถานะ"]} itemCount={book.entries.length}>
                {book.entries.length === 0 && <Empty cols={5} text="ไม่มีรายการในเดือนนี้" />}
                {book.entries.map((e: any) => {
                  const matched = matchedKeys.has(e.key);
                  return (
                    <NexusTableRow key={e.key} onClick={() => !matched && setPick(e.key === pick ? "" : e.key)} className={cn(pick === e.key && "bg-nexus-teal/10")}>
                      <NexusTableCell mono>{dateTh(e.date)}</NexusTableCell>
                      <NexusTableCell mono>{e.docNo}</NexusTableCell>
                      <NexusTableCell title={e.party}>{e.party || e.kind}</NexusTableCell>
                      <NexusTableCell mono className={e.outAmount ? "text-danger" : ""}>{money(e.inAmount - e.outAmount)}</NexusTableCell>
                      <NexusTableCell>
                        {matched ? <button type="button" onClick={(ev) => { ev.stopPropagation(); unmatch(e.key); }} className="text-[12px] text-nexus-teal hover:underline flex items-center gap-1 mx-auto"><CheckCircle2 size={13} /> จับคู่แล้ว</button>
                          : <span className="text-[12px] text-warning flex items-center gap-1 justify-center"><AlertTriangle size={13} /> {pick === e.key ? "เลือกแล้ว" : "ยังไม่จับคู่"}</span>}
                      </NexusTableCell>
                    </NexusTableRow>
                  );
                })}
              </NexusTable>
            </GlassCard>
            <GlassCard className="p-0 overflow-hidden">
              <CardHead title={`Statement ธนาคาร (${rows.length} รายการ)`} sub={pick ? "คลิกรายการที่ตรงกันเพื่อจับคู่" : "รายการที่ยังไม่จับคู่แสดงเป็นสีเหลือง"} />
              <NexusTable headers={["วันที่", "รายละเอียด", "จำนวนเงิน", "สถานะ"]} itemCount={rows.length}>
                {rows.map((r, i) => {
                  const matched = matchedRows.has(i);
                  return (
                    <NexusTableRow key={i} onClick={() => !matched && pair(i)} className={cn(!matched && pick && "hover:bg-nexus-teal/10")}>
                      <NexusTableCell mono>{dateTh(r.date)}</NexusTableCell>
                      <NexusTableCell title={r.description}>{r.description || "-"}</NexusTableCell>
                      <NexusTableCell mono className={r.amount < 0 ? "text-danger" : ""}>{money(r.amount)}</NexusTableCell>
                      <NexusTableCell>{matched ? <span className="text-[12px] text-nexus-teal">จับคู่แล้ว</span> : <span className="text-[12px] text-warning">ยังไม่บันทึกในสมุด</span>}</NexusTableCell>
                    </NexusTableRow>
                  );
                })}
              </NexusTable>
            </GlassCard>
          </div>
          <GlassCard className="p-5 flex flex-wrap items-end gap-4 justify-between">
            <div className="flex items-end gap-3 flex-wrap">
              <div className="space-y-1">
                <label className="text-[12px] font-bold text-white/70 ml-1">ยอดคงเหลือตาม statement สิ้นเดือน</label>
                <PillInput type="number" value={closing} onChange={(e) => setClosing(e.target.value)} className="h-9 w-[200px] px-4 text-sm font-mono" />
              </div>
              {diff !== null && (
                <span className={cn("text-[13px] font-bold flex items-center gap-1.5 pb-2", Math.abs(diff) < 0.01 ? "text-nexus-teal" : "text-warning")}>
                  {Math.abs(diff) < 0.01 ? <><CheckCircle2 size={15} /> ยอดตรงกัน</> : <><AlertTriangle size={15} /> ผลต่าง {money(diff)} บาท</>}
                </span>
              )}
            </div>
            {canEdit && <PillButton variant="confirm" className="h-9 px-5 text-xs font-bold" disabled={busy} onClick={save}>บันทึกการกระทบยอด</PillButton>}
          </GlassCard>
        </>
      )}
    </div>
  );
}
