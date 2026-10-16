"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, BookOpen, CheckCircle2, Download, FileSpreadsheet, Loader2, Percent, Scale, TrendingUp, Wallet } from "lucide-react";
import { GlassCard, NexusTable, NexusTableCell, NexusTableRow, PillButton, PillInput, PillSelect, PillTabs, cn } from "@/components/ui/Base";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api-client";

type ReportId = "tb" | "gl" | "pl" | "bs" | "vat-out" | "vat-in" | "pnd3" | "pnd53";
const TABS: { id: ReportId; label: string; icon: React.ReactNode }[] = [
  { id: "tb", label: "งบทดลอง", icon: <Scale size={14} /> },
  { id: "gl", label: "บัญชีแยกประเภท", icon: <BookOpen size={14} /> },
  { id: "pl", label: "กำไรขาดทุน", icon: <TrendingUp size={14} /> },
  { id: "bs", label: "ฐานะการเงิน", icon: <Wallet size={14} /> },
  { id: "vat-out", label: "ภาษีขาย", icon: <Percent size={14} /> },
  { id: "vat-in", label: "ภาษีซื้อ", icon: <Percent size={14} /> },
  { id: "pnd3", label: "ภ.ง.ด.3", icon: <FileSpreadsheet size={14} /> },
  { id: "pnd53", label: "ภ.ง.ด.53", icon: <FileSpreadsheet size={14} /> },
];
const TITLE: Record<ReportId, string> = {
  tb: "งบทดลอง", gl: "บัญชีแยกประเภท", pl: "งบกำไรขาดทุน", bs: "งบแสดงฐานะการเงิน",
  "vat-out": "รายงานภาษีขาย", "vat-in": "รายงานภาษีซื้อ", pnd3: "รายงานภาษีหัก ณ ที่จ่าย ภ.ง.ด.3", pnd53: "รายงานภาษีหัก ณ ที่จ่าย ภ.ง.ด.53",
};
// รายงานที่ใช้ช่วงเดือน (อื่น ๆ ใช้เดือนเดียว / ณ สิ้นเดือน)
const RANGE: ReportId[] = ["tb", "gl", "pl"];
const TH_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const monthLabel = (ym: string) => { const [y, m] = ym.split("-").map(Number); return `${TH_MONTHS[m - 1]} ${y + 543}`; };
const dateTh = (d: string) => { const [y, m, dd] = d.split("-").map(Number); return `${String(dd).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y + 543}`; };
const money = (n: number) => (n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const moneyOrDash = (n: number) => (n ? money(n) : "-");
const thisMonth = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 7);

/** CSV สำหรับเปิดใน Excel (UTF-8 BOM ให้ภาษาไทยแสดงถูก) */
function downloadCsv(filename: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = "﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function FinancialReportsPage() {
  const router = useRouter();
  const { companyId } = useAuth();
  const [tab, setTab] = useState<ReportId>("tb");
  const [from, setFrom] = useState(() => `${thisMonth().slice(0, 4)}-01`);
  const [to, setTo] = useState(thisMonth);
  const [account, setAccount] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const isRange = RANGE.includes(tab);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/api/reports/financial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, report: tab, from: isRange ? from : to, to, account: tab === "gl" ? account : undefined }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || "สร้างรายงานไม่สำเร็จ");
      setData(result);
      if (tab === "gl" && !account && result.accounts?.length) setAccount(result.accounts[0].code);
    } catch (e: any) {
      setError(e.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, tab, from, to, account, isRange]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setData(null); }, [tab]);

  const periodText = isRange ? (from === to ? monthLabel(to) : `${monthLabel(from)} – ${monthLabel(to)}`) : tab === "bs" ? `ณ สิ้นเดือน${monthLabel(to)}` : `เดือนภาษี ${monthLabel(to)}`;
  const ready = data && data.report === tab;

  const exportCsv = () => {
    if (!ready) return;
    const head = [[TITLE[tab]], [periodText], []];
    let body: (string | number)[][] = [];
    if (tab === "tb") {
      body = [["รหัสบัญชี", "ชื่อบัญชี", "ยกมา เดบิต", "ยกมา เครดิต", "ระหว่างงวด เดบิต", "ระหว่างงวด เครดิต", "คงเหลือ เดบิต", "คงเหลือ เครดิต"],
        ...data.rows.map((r: any) => [r.code, r.name, r.openingDebit, r.openingCredit, r.periodDebit, r.periodCredit, r.closingDebit, r.closingCredit]),
        ["", "รวม", data.totals.openingDebit, data.totals.openingCredit, data.totals.periodDebit, data.totals.periodCredit, data.totals.closingDebit, data.totals.closingCredit]];
    } else if (tab === "gl" && data.ledger) {
      const l = data.ledger;
      body = [[`${l.code} ${l.name}`], ["วันที่", "เลขที่เอกสาร", "คำอธิบาย", "เดบิต", "เครดิต", "คงเหลือ"], ["", "", "ยอดยกมา", "", "", l.opening],
        ...l.entries.map((e: any) => [dateTh(e.date), e.docNo, e.description, e.debit, e.credit, e.balance]), ["", "", "รวม", l.totalDebit, l.totalCredit, l.closing]];
    } else if (tab === "pl" || tab === "bs") {
      body = statementSections(tab, data).flatMap((s) => [[s.title], ...s.lines.map((x) => [x.code, x.name, x.amount]), ...(s.total !== undefined ? [["", s.totalLabel || `รวม${s.title}`, s.total]] : [])]);
    } else if (tab === "vat-out" || tab === "vat-in") {
      body = [["ลำดับ", "วันที่", "เลขที่ใบกำกับ", "อ้างอิง", tab === "vat-out" ? "ชื่อผู้ซื้อ" : "ชื่อผู้ขาย", "เลขประจำตัวผู้เสียภาษี", "สาขา", "มูลค่าสินค้า/บริการ", "ภาษีมูลค่าเพิ่ม", "ประเภท"],
        ...data.rows.map((r: any, i: number) => [i + 1, dateTh(r.date), r.docNo, r.refNo, r.name, r.taxId, r.branch, r.base, r.vat, r.kind]),
        ["", "", "", "", "รวม", "", "", data.totals.base, data.totals.vat]];
    } else {
      body = [["ลำดับ", "วันที่จ่าย", "เลขที่หนังสือรับรอง", "ชื่อผู้มีเงินได้", "เลขประจำตัวผู้เสียภาษี", "ประเภทเงินได้", "จำนวนเงินที่จ่าย", "อัตราภาษี (%)", "ภาษีที่หัก"],
        ...data.rows.map((r: any, i: number) => [i + 1, dateTh(r.date), r.docNo, r.vendorName, r.taxId, r.incomeType, r.baseAmount, r.whtRate, r.whtAmount]),
        ["", "", "", "รวม", "", "", data.totals.base, "", data.totals.wht]];
    }
    downloadCsv(`${tab}_${isRange ? `${from}_${to}` : to}.csv`, [...head, ...body]);
  };

  const header = (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-6 rounded-3xl backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <PillButton variant="glass" onClick={() => router.push("/finance")} className="w-10 h-10 p-0 flex items-center justify-center">
          <ArrowLeft size={20} />
        </PillButton>
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">รายงานบัญชีและภาษี</h1>
          <p className="text-sm text-white/60 font-medium mt-1">คำนวณที่ server จากรายการบัญชีที่ลงบัญชีแล้วและเอกสารภาษีจริงของบริษัท</p>
        </div>
      </div>
    </div>
  );

  const left = (
    <div className="space-y-4 pb-10">
      {/* แถบรายงาน + ตัวเลือกช่วงเวลา (มุมขวาของแถบ) */}
      <div className="flex flex-wrap items-center gap-3">
        <PillTabs className="flex-1 min-w-[min(100%,520px)]" tabs={TABS} activeTab={tab} onTabChange={(id) => setTab(id as ReportId)} />
        <div className="flex items-center gap-2 flex-wrap">
          {isRange && (
            <>
              <PillInput type="month" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} className="h-9 w-[160px] px-4 text-sm font-mono" aria-label="ตั้งแต่เดือน" />
              <span className="text-white/40 text-sm">ถึง</span>
            </>
          )}
          <PillInput type="month" value={to} onChange={(e) => e.target.value && setTo(e.target.value)} className="h-9 w-[160px] px-4 text-sm font-mono" aria-label={isRange ? "ถึงเดือน" : "เดือน"} />
          <PillButton variant="glass" className="h-9 px-4 text-xs font-bold" onClick={exportCsv} disabled={!ready || loading}>
            <Download size={14} className="mr-1.5" /> ส่งออก Excel
          </PillButton>
        </div>
      </div>

      {tab === "gl" && data?.accounts && (
        <div className="flex items-center gap-3">
          <span className="text-[13px] text-white/60 whitespace-nowrap">บัญชี</span>
          <PillSelect value={account} onChange={(e) => setAccount(e.target.value)} className="h-9 px-4 w-[360px] max-w-full text-sm">
            {data.accounts.length === 0 && <option value="">ไม่มีรายการบัญชีในระบบ</option>}
            {data.accounts.map((a: any) => <option key={a.code} value={a.code}>{a.code} {a.name}</option>)}
          </PillSelect>
        </div>
      )}

      {error && <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-danger text-xs font-bold">{error}</div>}

      <GlassCard accentColor="teal" className="p-0 overflow-hidden">
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-white/5 flex-wrap">
          <div>
            <h3 className="text-[16px] font-semibold text-white leading-normal">{TITLE[tab]}</h3>
            <p className="text-[13px] text-white/50 leading-normal">{periodText}</p>
          </div>
          {ready && <ReportNotices tab={tab} data={data} />}
        </div>
        {loading && !ready ? (
          <div className="py-16 flex items-center justify-center gap-2 text-[13px] text-white/40"><Loader2 size={16} className="animate-spin" /> กำลังสร้างรายงาน…</div>
        ) : !ready ? (
          <div className="py-16 text-center text-[13px] text-white/40">ไม่มีข้อมูล</div>
        ) : (
          <ReportBody tab={tab} data={data} />
        )}
      </GlassCard>
    </div>
  );

  return <NexusPageLayout header={header} leftContent={left} />;
}

function ReportNotices({ tab, data }: { tab: ReportId; data: any }) {
  const items: { ok: boolean; text: string }[] = [];
  if (["tb", "gl", "pl", "bs"].includes(tab) && data.draftCount > 0) items.push({ ok: false, text: `มีรายการรอลงบัญชี ${data.draftCount} รายการ (ไม่รวมในรายงาน)` });
  if (tab === "tb") items.push(data.balanced ? { ok: true, text: "เดบิตเท่ากับเครดิต" } : { ok: false, text: "เดบิตไม่เท่ากับเครดิต กรุณาตรวจรายการบัญชี" });
  if (tab === "bs") items.push(data.balanced ? { ok: true, text: "สินทรัพย์ = หนี้สิน + ส่วนของเจ้าของ" } : { ok: false, text: "งบไม่สมดุล กรุณาตรวจรายการบัญชี" });
  if ((tab === "vat-out" || tab === "vat-in") && data.rows.length + Math.abs(data.ledgerVat) > 0) {
    items.push(Math.abs(data.difference) < 0.01
      ? { ok: true, text: "ตรงกับยอดภาษีในสมุดรายวัน" }
      : { ok: false, text: `ต่างจากยอดในสมุดรายวัน ${money(data.difference)} บาท (สมุดรายวัน ${money(data.ledgerVat)})` });
  }
  if (!items.length) return null;
  return (
    <div className="flex flex-col items-end gap-1">
      {items.map((x, i) => (
        <span key={i} className={cn("flex items-center gap-1.5 text-[12px] font-medium", x.ok ? "text-nexus-teal" : "text-warning")}>
          {x.ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}{x.text}
        </span>
      ))}
    </div>
  );
}

const TotalRow = ({ cells }: { cells: React.ReactNode[] }) => (
  <NexusTableRow className="bg-white/[0.03] cursor-default">
    {cells.map((c, i) => <NexusTableCell key={i} className="font-bold text-white">{c}</NexusTableCell>)}
  </NexusTableRow>
);
const Empty = ({ cols, text }: { cols: number; text: string }) => (
  <NexusTableRow className="cursor-default"><NexusTableCell colSpan={cols} className="text-center text-[13px] text-white/40 py-10">{text}</NexusTableCell></NexusTableRow>
);

interface Section { title: string; lines: { code: string; name: string; amount: number }[]; total?: number; totalLabel?: string; emphasis?: boolean }
function statementSections(tab: "pl" | "bs", d: any): Section[] {
  if (tab === "pl") return [
    { title: "รายได้", lines: d.revenue, total: d.totalRevenue },
    { title: "ต้นทุนขายและบริการ", lines: d.costOfSales, total: d.totalCost },
    { title: "กำไรขั้นต้น", lines: [], total: d.grossProfit, totalLabel: "กำไรขั้นต้น", emphasis: true },
    { title: "ค่าใช้จ่ายในการขายและบริหาร", lines: d.expenses, total: d.totalExpense },
    { title: "กำไร (ขาดทุน) สุทธิ", lines: [], total: d.netProfit, totalLabel: "กำไร (ขาดทุน) สุทธิ", emphasis: true },
  ];
  return [
    { title: "สินทรัพย์หมุนเวียน", lines: d.currentAssets, total: d.totalCurrentAssets },
    { title: "สินทรัพย์ไม่หมุนเวียน", lines: d.nonCurrentAssets, total: d.totalNonCurrentAssets },
    { title: "รวมสินทรัพย์", lines: [], total: d.totalAssets, totalLabel: "รวมสินทรัพย์", emphasis: true },
    { title: "หนี้สินหมุนเวียน", lines: d.currentLiabilities, total: d.totalCurrentLiabilities },
    { title: "หนี้สินไม่หมุนเวียน", lines: d.nonCurrentLiabilities, total: d.totalNonCurrentLiabilities },
    { title: "ส่วนของเจ้าของ", lines: d.equity, total: d.totalEquity },
    { title: "รวมหนี้สินและส่วนของเจ้าของ", lines: [], total: Math.round((d.totalLiabilities + d.totalEquity) * 100) / 100, totalLabel: "รวมหนี้สินและส่วนของเจ้าของ", emphasis: true },
  ];
}

function ReportBody({ tab, data }: { tab: ReportId; data: any }) {
  if (tab === "tb") {
    return (
      <NexusTable headers={["รหัสบัญชี", "ชื่อบัญชี", "ยกมา เดบิต", "ยกมา เครดิต", "ระหว่างงวด เดบิต", "ระหว่างงวด เครดิต", "คงเหลือ เดบิต", "คงเหลือ เครดิต"]} itemCount={data.rows.length}>
        {data.rows.length === 0 && <Empty cols={8} text="ไม่มีรายการที่ลงบัญชีในช่วงนี้" />}
        {data.rows.map((r: any) => (
          <NexusTableRow key={r.code} className="cursor-default">
            <NexusTableCell mono>{r.code}</NexusTableCell>
            <NexusTableCell>{r.name}</NexusTableCell>
            <NexusTableCell mono>{moneyOrDash(r.openingDebit)}</NexusTableCell>
            <NexusTableCell mono>{moneyOrDash(r.openingCredit)}</NexusTableCell>
            <NexusTableCell mono>{moneyOrDash(r.periodDebit)}</NexusTableCell>
            <NexusTableCell mono>{moneyOrDash(r.periodCredit)}</NexusTableCell>
            <NexusTableCell mono>{moneyOrDash(r.closingDebit)}</NexusTableCell>
            <NexusTableCell mono>{moneyOrDash(r.closingCredit)}</NexusTableCell>
          </NexusTableRow>
        ))}
        {data.rows.length > 0 && <TotalRow cells={["", "รวม", money(data.totals.openingDebit), money(data.totals.openingCredit), money(data.totals.periodDebit), money(data.totals.periodCredit), money(data.totals.closingDebit), money(data.totals.closingCredit)]} />}
      </NexusTable>
    );
  }
  if (tab === "gl") {
    const l = data.ledger;
    if (!l) return <div className="py-16 text-center text-[13px] text-white/40">เลือกบัญชีที่ต้องการดู</div>;
    return (
      <NexusTable headers={["วันที่", "เลขที่เอกสาร", "คำอธิบาย", "เดบิต", "เครดิต", "คงเหลือ"]} itemCount={l.entries.length}>
        <TotalRow cells={["", "", `ยอดยกมา (ด้าน${l.normalSide === "debit" ? "เดบิต" : "เครดิต"})`, "", "", money(l.opening)]} />
        {l.entries.length === 0 && <Empty cols={6} text="ไม่มีรายการในช่วงนี้" />}
        {l.entries.map((e: any, i: number) => (
          <NexusTableRow key={`${e.journalId}-${i}`} className="cursor-default">
            <NexusTableCell mono>{dateTh(e.date)}</NexusTableCell>
            <NexusTableCell mono>{e.docNo || "-"}</NexusTableCell>
            <NexusTableCell title={e.description}>{e.description || "-"}</NexusTableCell>
            <NexusTableCell mono>{moneyOrDash(e.debit)}</NexusTableCell>
            <NexusTableCell mono>{moneyOrDash(e.credit)}</NexusTableCell>
            <NexusTableCell mono className={e.balance < 0 ? "text-danger" : ""}>{money(e.balance)}</NexusTableCell>
          </NexusTableRow>
        ))}
        <TotalRow cells={["", "", "รวม / ยอดคงเหลือ", money(l.totalDebit), money(l.totalCredit), money(l.closing)]} />
      </NexusTable>
    );
  }
  if (tab === "pl" || tab === "bs") {
    const sections = statementSections(tab, data);
    return (
      <NexusTable headers={["รหัสบัญชี", "รายการ", "จำนวนเงิน"]}>
        {sections.map((s) => (
          <React.Fragment key={s.title}>
            {!s.emphasis && (
              <NexusTableRow className="cursor-default">
                <NexusTableCell colSpan={3} className="text-[13px] font-semibold text-nexus-teal pt-5">{s.title}</NexusTableCell>
              </NexusTableRow>
            )}
            {s.lines.map((x) => (
              <NexusTableRow key={`${s.title}-${x.code}-${x.name}`} className="cursor-default">
                <NexusTableCell mono>{x.code || "-"}</NexusTableCell>
                <NexusTableCell>{x.name}</NexusTableCell>
                <NexusTableCell mono className={x.amount < 0 ? "text-danger" : ""}>{money(x.amount)}</NexusTableCell>
              </NexusTableRow>
            ))}
            {s.total !== undefined && (
              <NexusTableRow className={cn("cursor-default", s.emphasis ? "bg-nexus-teal/[0.06]" : "bg-white/[0.03]")}>
                <NexusTableCell>{""}</NexusTableCell>
                <NexusTableCell className="font-bold text-white">{s.totalLabel || `รวม${s.title}`}</NexusTableCell>
                <NexusTableCell mono className={cn("font-bold", (s.total || 0) < 0 ? "text-danger" : "text-white")}>{money(s.total || 0)}</NexusTableCell>
              </NexusTableRow>
            )}
          </React.Fragment>
        ))}
      </NexusTable>
    );
  }
  if (tab === "vat-out" || tab === "vat-in") {
    return (
      <NexusTable headers={["ลำดับ", "วันที่", "เลขที่ใบกำกับ", tab === "vat-out" ? "ชื่อผู้ซื้อ" : "ชื่อผู้ขาย", "เลขประจำตัวผู้เสียภาษี", "สาขา", "มูลค่าสินค้า/บริการ", "ภาษีมูลค่าเพิ่ม", "ประเภทเอกสาร"]} itemCount={data.rows.length}>
        {data.rows.length === 0 && <Empty cols={9} text="ไม่มีเอกสารภาษีในเดือนนี้" />}
        {data.rows.map((r: any, i: number) => (
          <NexusTableRow key={`${r.docNo}-${i}`} className="cursor-default">
            <NexusTableCell mono>{i + 1}</NexusTableCell>
            <NexusTableCell mono>{dateTh(r.date)}</NexusTableCell>
            <NexusTableCell mono title={r.refNo ? `อ้างอิง ${r.refNo}` : undefined}>{r.docNo}</NexusTableCell>
            <NexusTableCell title={r.name}>{r.name}</NexusTableCell>
            <NexusTableCell mono>{r.taxId || "-"}</NexusTableCell>
            <NexusTableCell>{r.branch}</NexusTableCell>
            <NexusTableCell mono className={r.base < 0 ? "text-danger" : ""}>{money(r.base)}</NexusTableCell>
            <NexusTableCell mono className={r.vat < 0 ? "text-danger" : ""}>{money(r.vat)}</NexusTableCell>
            <NexusTableCell>{r.kind}</NexusTableCell>
          </NexusTableRow>
        ))}
        {data.rows.length > 0 && <TotalRow cells={["", "", "", "รวม", "", "", money(data.totals.base), money(data.totals.vat), ""]} />}
      </NexusTable>
    );
  }
  return (
    <NexusTable headers={["ลำดับ", "วันที่จ่าย", "เลขที่หนังสือรับรอง", "ชื่อผู้มีเงินได้", "เลขประจำตัวผู้เสียภาษี", "ประเภทเงินได้", "จำนวนเงินที่จ่าย", "อัตราภาษี", "ภาษีที่หัก"]} itemCount={data.rows.length}>
      {data.rows.length === 0 && <Empty cols={9} text="ไม่มีหนังสือรับรองหัก ณ ที่จ่ายในเดือนนี้" />}
      {data.rows.map((r: any, i: number) => (
        <NexusTableRow key={r.id} className="cursor-default">
          <NexusTableCell mono>{i + 1}</NexusTableCell>
          <NexusTableCell mono>{dateTh(r.date)}</NexusTableCell>
          <NexusTableCell mono>{r.docNo}</NexusTableCell>
          <NexusTableCell title={r.vendorName}>{r.vendorName}</NexusTableCell>
          <NexusTableCell mono>{r.taxId}</NexusTableCell>
          <NexusTableCell>{r.incomeType}</NexusTableCell>
          <NexusTableCell mono>{money(r.baseAmount)}</NexusTableCell>
          <NexusTableCell mono>{`${r.whtRate}%`}</NexusTableCell>
          <NexusTableCell mono>{money(r.whtAmount)}</NexusTableCell>
        </NexusTableRow>
      ))}
      {data.rows.length > 0 && <TotalRow cells={["", "", "", "รวม", "", "", money(data.totals.base), "", money(data.totals.wht)]} />}
    </NexusTable>
  );
}
