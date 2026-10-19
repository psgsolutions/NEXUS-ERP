"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, FileSpreadsheet, RefreshCw, Trash2, Upload } from "lucide-react";
import { GlassCard, NexusDatePicker, NexusTable, NexusTableCell, NexusTableRow, PillButton, PillCheckbox, PillTabs, cn } from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { useSystemDialog } from "@/context/DialogContext";
import { apiFetch } from "@/lib/api-client";
import { can } from "@/lib/permissions";
import { CHART_OF_ACCOUNTS } from "@/lib/chart-of-accounts";
import { IMPORT_TEMPLATES, mapHeaders, parseRows, toCreateRequest, type ImportEntity, type ImportTemplate, type ParsedRow } from "@/lib/import/templates";
import { OPENING_TB_REF, OPENING_TEMPLATES, tbLines, type OpeningKind } from "@/lib/import/opening";

/**
 * นำเข้าข้อมูลจาก Excel สำหรับเริ่มใช้ระบบ
 *  - ข้อมูลหลัก: ลูกค้า ผู้ขาย สินค้า (+จำนวนยกมา) ส่งทีละแถวผ่าน /api/master-data
 *  - ยอดยกมาทางบัญชี (ฝ่ายบัญชี): งบทดลองยกมา -> ใบสำคัญ JV ร่าง (/api/finance/journal-entries),
 *    ลูกหนี้/เจ้าหนี้คงค้างรายใบ (/api/finance/opening-balances) + กระทบยอดกับบัญชีคุม
 * อ่านไฟล์ในเบราว์เซอร์ ตรวจทุกแถวก่อน (server ตรวจซ้ำอีกชั้น)
 */

type TabId = ImportEntity | OpeningKind;
type RowState = ParsedRow & { status: "ready" | "invalid" | "saving" | "done" | "failed"; message?: string };
interface Status {
  tb: { id: string; journalNo: string; date: string; status: string; total: number }[];
  ar: { count: number; total: number; outstanding: number };
  ap: { count: number; total: number; outstanding: number };
  reconcile: { label: string; account: string; gl: number; glWithDraft: number; sub: number; diff: number }[];
}

const TEMPLATES: Record<TabId, ImportTemplate> = { ...IMPORT_TEMPLATES, ...OPENING_TEMPLATES };
const TAB_ORDER: TabId[] = ["customers", "suppliers", "products", "tb", "ar", "ap"];
const isOpening = (t: TabId): t is OpeningKind => t === "tb" || t === "ar" || t === "ap";
const PREVIEW: Record<TabId, string[]> = {
  customers: ["name", "taxId", "phone", "creditTermDays"],
  suppliers: ["name", "taxId", "phone", "creditTermDays"],
  products: ["sku", "name", "unit", "price", "openingQty"],
  tb: ["accountCode", "accountName", "debit", "credit"],
  ar: ["docNo", "date", "partyName", "amount"],
  ap: ["docNo", "date", "partyName", "amount"],
};
const STATUS: Record<RowState["status"], [string, string]> = {
  ready: ["พร้อม", "text-nexus-teal"], invalid: ["ไม่ผ่าน", "text-danger"], saving: ["กำลังบันทึก", "text-nexus-blue"],
  done: ["นำเข้าแล้ว", "text-nexus-teal"], failed: ["ไม่สำเร็จ", "text-danger"],
};
const STEPS: Record<TabId, string> = {
  customers: "แถวที่ซ้ำกับข้อมูลในระบบจะถูกข้ามและแจ้งเหตุผล",
  suppliers: "ระบบสร้างผู้รับเหมารหัสเดียวกันให้ด้วย",
  products: "ใส่จำนวนคงเหลือยกมาได้ (รับเข้าคลังเป็นยอดยกมา)",
  tb: "ยอดคงเหลือทุกบัญชี ณ วันก่อนเริ่มใช้ระบบ เดบิตต้องเท่ากับเครดิต — ได้ใบสำคัญร่างรออนุมัติลงบัญชี",
  ar: "ใบแจ้งหนี้ที่ลูกค้ายังค้างชำระ — ไม่บันทึกบัญชีซ้ำ (ยอดรวมอยู่ในงบทดลองแล้ว) รับชำระต่อในระบบได้",
  ap: "ใบแจ้งหนี้ผู้ขายที่ยังค้างจ่าย — ไม่บันทึกบัญชีซ้ำ จ่ายชำระต่อในระบบได้ (ล้างเจ้าหนี้ 2111)",
};

const money = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const loadXlsx = () => import("xlsx");
const bkkToday = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const firstOfMonth = () => `${bkkToday().slice(0, 7)}-01`;

export default function DataImportPage() {
  const { companyId, roles } = useAuth();
  const { showConfirm } = useSystemDialog();
  const allowed = TAB_ORDER.filter((t) => can(roles, TEMPLATES[t].permission));
  const [tab, setTab] = useState<TabId>(allowed[0] || "customers");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<RowState[]>([]);
  const [notes, setNotes] = useState<{ missing: string[]; unknown: string[] }>({ missing: [], unknown: [] });
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [postJournal, setPostJournal] = useState(true);
  const [tbDate, setTbDate] = useState(firstOfMonth());
  const [status, setStatus] = useState<Status | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const template = TEMPLATES[tab];
  const canFinance = can(roles, "finance:edit");

  const loadStatus = useCallback(async () => {
    if (!companyId || !canFinance) return;
    try {
      const res = await apiFetch("/api/finance/opening-balances", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "status" }) });
      const d = await res.json();
      if (res.ok && d.success) setStatus(d);
    } catch { /* แสดงเฉพาะเมื่อโหลดได้ */ }
  }, [companyId, canFinance]);
  useEffect(() => { if (isOpening(tab)) loadStatus(); }, [tab, loadStatus]);

  const reset = () => { setRows([]); setFileName(""); setNotes({ missing: [], unknown: [] }); setError(""); setInfo(""); };
  const switchTab = (id: string) => { if (busy) return; setTab(id as TabId); reset(); };

  const downloadTemplate = async () => {
    const XLSX = await loadXlsx();
    const wb = XLSX.utils.book_new();
    const data = XLSX.utils.aoa_to_sheet([template.columns.map((c) => (c.required ? `${c.header}*` : c.header))]);
    data["!cols"] = template.columns.map((c) => ({ wch: Math.max(14, c.header.length + 4) }));
    XLSX.utils.book_append_sheet(wb, data, "ข้อมูล");
    const guide = XLSX.utils.aoa_to_sheet([
      ["คอลัมน์", "จำเป็น", "ตัวอย่าง", "คำอธิบาย"],
      ...template.columns.map((c) => [c.header, c.required ? "ต้องกรอก" : "", c.example, c.note || ""]),
      [],
      ["กรอกข้อมูลในชีต \"ข้อมูล\" หนึ่งแถวต่อหนึ่งรายการ ลำดับคอลัมน์สลับได้ คอลัมน์ที่ไม่ใช้ลบออกได้ (ยกเว้นคอลัมน์ที่มี *)"],
      ["เลขผู้เสียภาษี/เบอร์โทร: ตั้งรูปแบบเซลล์เป็นข้อความ หรือพิมพ์ตามปกติก็ได้ ระบบเติมเลข 0 นำหน้าให้"],
    ]);
    guide["!cols"] = [{ wch: 30 }, { wch: 10 }, { wch: 24 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, guide, "คำอธิบาย");
    if (tab === "tb") {
      const chart = XLSX.utils.aoa_to_sheet([["รหัสบัญชี", "ชื่อบัญชี"], ...CHART_OF_ACCOUNTS.map((a) => [a.code, a.name])]);
      chart["!cols"] = [{ wch: 12 }, { wch: 40 }];
      XLSX.utils.book_append_sheet(wb, chart, "ผังบัญชี");
    }
    XLSX.writeFile(wb, `แม่แบบนำเข้า-${template.label.replace(/\//g, "-")}.xlsx`);
  };

  const readFile = async (file: File) => {
    reset();
    setFileName(file.name);
    try {
      const XLSX = await loadXlsx();
      const wb = XLSX.read(await file.arrayBuffer());
      const ws = wb.Sheets["ข้อมูล"] || wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: true, defval: "", blankrows: false });
      if (!aoa.length) throw new Error("ไฟล์ไม่มีข้อมูล");
      const { index, missing, unknown } = mapHeaders(template, aoa[0]);
      setNotes({ missing, unknown });
      if (missing.length) return;
      const parsed = parseRows(template, aoa.slice(1), index);
      if (!parsed.length) throw new Error("ไม่พบแถวข้อมูลใต้หัวตาราง");
      if (parsed.length > 2000) throw new Error(`ไฟล์มี ${parsed.length} แถว — แบ่งไฟล์ละไม่เกิน 2,000 แถว`);
      setRows(parsed.map((r) => ({ ...r, status: r.errors.length ? "invalid" : "ready" })));
    } catch (err: any) {
      setError(err.message || "อ่านไฟล์ไม่สำเร็จ");
    }
  };

  const post = async (url: string, body: Record<string, any>) => {
    const res = await apiFetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, ...body }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || !d.success) throw new Error(d.error || `บันทึกไม่สำเร็จ (${res.status})`);
    return d;
  };
  const update = (rowNos: number[], patch: Partial<RowState>) => setRows((cur) => cur.map((r) => (rowNos.includes(r.rowNo) ? { ...r, ...patch } : r)));

  const importMaster = async (todo: RowState[]) => {
    const entity = tab as ImportEntity;
    for (const row of todo) {
      update([row.rowNo], { status: "saving", message: "" });
      try {
        const req = toCreateRequest(entity, row.values, { postOpeningJournal: postJournal });
        if (entity === "products") {
          await post("/api/master-data", { action: "create", entity, id: `PROD-${Date.now()}-${row.rowNo}`, ...req });
        } else if (entity === "suppliers") {
          // ผู้ขายและผู้รับเหมาใช้รหัสเดียวกัน (เหมือนฟอร์มเพิ่มผู้ขาย)
          const { id } = await post("/api/master-data", { action: "create", entity: "suppliers", ...req });
          await post("/api/master-data", { action: "create", entity: "contractors", id, ...req }).catch((err) => { throw new Error(`สร้างผู้ขายแล้ว (${id}) แต่สร้างผู้รับเหมาไม่สำเร็จ: ${err.message}`); });
        } else {
          await post("/api/master-data", { action: "create", entity, ...req });
        }
        update([row.rowNo], { status: "done" });
      } catch (err: any) {
        update([row.rowNo], { status: "failed", message: err.message });
      }
    }
  };

  const importTb = async (todo: RowState[]) => {
    const nos = todo.map((r) => r.rowNo);
    update(nos, { status: "saving", message: "" });
    try {
      const { lines } = tbLines(todo.map((r) => r.values as any));
      const d = await post("/api/finance/journal-entries", { date: tbDate, bookType: "JV", description: `ยอดยกมา ณ วันที่ ${tbDate} (งบทดลองจากระบบเดิม)`, reference: OPENING_TB_REF, lines });
      update(nos, { status: "done" });
      setInfo(`สร้างใบสำคัญ ${d.journalNo} (ร่าง) แล้ว — อนุมัติลงบัญชีที่เมนูสมุดรายวันเพื่อให้ยอดเข้างบ`);
    } catch (err: any) {
      update(nos, { status: "failed", message: err.message });
    }
  };

  const importOpenItems = async (todo: RowState[]) => {
    for (let i = 0; i < todo.length; i += 200) {
      const chunk = todo.slice(i, i + 200);
      update(chunk.map((r) => r.rowNo), { status: "saving", message: "" });
      try {
        const d = await post("/api/finance/opening-balances", { action: tab, items: chunk.map((r) => r.values) });
        setRows((cur) => cur.map((r) => {
          const at = chunk.findIndex((c) => c.rowNo === r.rowNo);
          if (at < 0) return r;
          const res = d.results.find((x: any) => x.index === at);
          return res?.ok ? { ...r, status: "done" } : { ...r, status: "failed", message: res?.error || "ไม่สำเร็จ" };
        }));
      } catch (err: any) {
        update(chunk.map((r) => r.rowNo), { status: "failed", message: err.message });
      }
    }
  };

  const runImport = async () => {
    if (!companyId || busy) return;
    setBusy(true);
    setError("");
    setInfo("");
    const todo = rows.filter((r) => r.status === "ready" || r.status === "failed");
    if (tab === "tb") await importTb(todo);
    else if (tab === "ar" || tab === "ap") await importOpenItems(todo);
    else await importMaster(todo);
    setBusy(false);
    if (isOpening(tab)) loadStatus();
  };

  const clearOpening = async () => {
    if (!(tab === "ar" || tab === "ap") || busy) return;
    if (!(await showConfirm(`ลบ${template.label}ที่นำเข้าไว้ทั้งหมด (เฉพาะรายการที่ยังไม่มีการรับ/จ่ายชำระ)?`))) return;
    setBusy(true);
    try {
      const d = await post("/api/finance/opening-balances", { action: "clear", kind: tab });
      setInfo(`ลบแล้ว ${d.removed} รายการ${d.kept ? ` · คงไว้ ${d.kept} รายการที่มีการชำระแล้ว` : ""}`);
      await loadStatus();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const count = useMemo(() => {
    const c = { ready: 0, invalid: 0, saving: 0, done: 0, failed: 0 };
    rows.forEach((r) => c[r.status]++);
    return c;
  }, [rows]);
  const tb = useMemo(() => (tab === "tb" ? tbLines(rows.filter((r) => r.status !== "invalid").map((r) => r.values as any)) : null), [tab, rows]);
  const previewCols = PREVIEW[tab].map((k) => template.columns.find((c) => c.key === k)!);
  const hasOpeningStock = tab === "products" && rows.some((r) => r.values.openingQty > 0);
  const pending = count.ready + count.failed;
  // งบทดลองต้องนำเข้าทั้งชุด: ทุกแถวผ่าน และเดบิต = เครดิต
  const tbBlocked = tab === "tb" && (count.invalid > 0 || !tb?.balanced);
  const existingTb = tab === "tb" ? status?.tb || [] : [];

  if (!allowed.length) {
    return <div className="p-10 text-white/60">ไม่มีสิทธิ์นำเข้าข้อมูล (ต้องมีสิทธิ์แก้ไขลูกค้า ผู้ขาย สินค้า หรือบัญชี)</div>;
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent">
      <header className="px-6 py-2.5 min-h-[60px] border-b border-white/5 flex items-center gap-3 bg-black/20 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/10"><FileSpreadsheet size={20} /></div>
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight leading-none">นำเข้าข้อมูลจาก Excel</h1>
          <p className="text-xs font-semibold text-white/60 mt-1 leading-none">ย้ายข้อมูลหลักและยอดยกมาจากระบบเดิม</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-5 max-w-[1800px] mx-auto space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <PillTabs className="flex-1 min-w-[240px]" tabs={allowed.map((t) => ({ id: t, label: TEMPLATES[t].label }))} activeTab={tab} onTabChange={switchTab} />
            <div className="flex items-center gap-2">
              <PillButton variant="glass" onClick={downloadTemplate} className="h-9 px-4 text-xs"><Download size={14} className="mr-1.5" /> ดาวน์โหลดแม่แบบ</PillButton>
              <PillButton variant="glass" onClick={() => fileRef.current?.click()} disabled={busy} className="h-9 px-4 text-xs"><Upload size={14} className="mr-1.5" /> เลือกไฟล์ Excel</PillButton>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) readFile(f); }} />
            </div>
          </div>

          <p className="text-[13px] text-white/50 px-1 leading-relaxed">
            1. ดาวน์โหลดแม่แบบ{template.label} แล้วกรอกในชีต &quot;ข้อมูล&quot; (คัดลอกคอลัมน์จากไฟล์เดิมมาวางได้) · 2. เลือกไฟล์ ระบบตรวจทุกแถวก่อน · 3. กดนำเข้า — {STEPS[tab]}
          </p>

          {isOpening(tab) && status && (
            <GlassCard accentColor="blue" className="p-2">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-3 pt-2 pb-1 text-[13px] text-white/60">
                <span className="font-bold text-white/80">กระทบยอดบัญชีคุมกับยอดรายตัว</span>
                <span>งบทดลองยกมา {status.tb.length ? status.tb.map((t) => `${t.journalNo} (${t.status === "draft" ? "ร่าง" : "ลงบัญชีแล้ว"})`).join(", ") : "ยังไม่มี"}</span>
                <span>ลูกหนี้ยกมา <span className="font-mono text-white">{status.ar.count}</span> ใบ</span>
                <span>เจ้าหนี้ยกมา <span className="font-mono text-white">{status.ap.count}</span> ใบ</span>
                <span className="ml-auto flex items-center gap-2">
                  {(tab === "ar" || tab === "ap") && status[tab].count > 0 && <PillButton variant="ghost" onClick={clearOpening} disabled={busy} className="h-8 px-3 text-xs"><Trash2 size={13} className="mr-1.5" /> ลบ{template.label}ที่นำเข้า</PillButton>}
                  <PillButton variant="ghost" onClick={loadStatus} disabled={busy} className="h-8 px-3 text-xs"><RefreshCw size={13} className="mr-1.5" /> โหลดใหม่</PillButton>
                </span>
              </div>
              <NexusTable headers={["บัญชี", "รหัส", "ยอดบัญชีที่ลงแล้ว", "ยอดรวมรายการร่าง", "ยอดรายตัว", "ยอดต่าง"]}>
                {status.reconcile.map((r) => (
                  <NexusTableRow key={r.account}>
                    <NexusTableCell className="text-white/80">{r.label}</NexusTableCell>
                    <NexusTableCell className="font-mono text-white/60">{r.account}</NexusTableCell>
                    <NexusTableCell className="font-mono text-white/80">{money(r.gl)}</NexusTableCell>
                    <NexusTableCell className="font-mono text-white/60">{money(r.glWithDraft)}</NexusTableCell>
                    <NexusTableCell className="font-mono text-white/80">{money(r.sub)}</NexusTableCell>
                    <NexusTableCell className={cn("font-mono font-bold", Math.abs(r.glWithDraft - r.sub) < 0.01 ? "text-nexus-teal" : "text-warning")}>{money(r.glWithDraft - r.sub)}</NexusTableCell>
                  </NexusTableRow>
                ))}
              </NexusTable>
              <p className="text-[12px] text-white/40 px-3 py-2">ผลต่างคิดจากยอดรวมรายการร่าง (ก่อนอนุมัติ) − ยอดรายตัว · ยอดรายตัว = ใบแจ้งหนี้ค้างรับ / รายการค้างจ่าย / จำนวนคงเหลือ × ต้นทุนเฉลี่ย</p>
            </GlassCard>
          )}

          {error && <div className="p-3 rounded-xl text-xs font-bold border bg-danger/10 border-danger/20 text-danger">{error}</div>}
          {info && <div className="p-3 rounded-xl text-xs font-bold border bg-nexus-teal/10 border-nexus-teal/20 text-nexus-teal">{info}</div>}
          {notes.missing.length > 0 && <div className="p-3 rounded-xl text-xs font-bold border bg-danger/10 border-danger/20 text-danger">ไฟล์ไม่มีคอลัมน์ที่ต้องกรอก: {notes.missing.join(", ")} — ใช้หัวตารางตามแม่แบบ</div>}
          {notes.unknown.length > 0 && <p className="text-[12px] text-white/40 px-1">ข้ามคอลัมน์ที่ไม่รู้จัก: {notes.unknown.join(", ")}</p>}
          {existingTb.length > 0 && rows.length > 0 && count.done === 0 &&<div className="p-3 rounded-xl text-xs font-bold border bg-warning/10 border-warning/20 text-warning">มีใบสำคัญงบทดลองยกมาแล้ว ({existingTb.map((t) => t.journalNo).join(", ")}) — ถ้านำเข้าซ้ำ ให้ยกเลิกใบเดิมก่อน ยอดจะได้ไม่เบิ้ล</div>}

          {rows.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-white/60 px-1">
              <span className="text-white/80">{fileName}</span>
              <span>ทั้งหมด <span className="font-mono font-bold text-white">{rows.length}</span></span>
              <span>พร้อมนำเข้า <span className="font-mono font-bold text-nexus-teal">{count.ready}</span></span>
              {count.invalid > 0 && <span>ไม่ผ่าน <span className="font-mono font-bold text-danger">{count.invalid}</span></span>}
              {count.done > 0 && <span>นำเข้าแล้ว <span className="font-mono font-bold text-nexus-teal">{count.done}</span></span>}
              {count.failed > 0 && <span>ไม่สำเร็จ <span className="font-mono font-bold text-danger">{count.failed}</span></span>}
              {tb && (
                <>
                  <span>เดบิต <span className="font-mono font-bold text-white">{money(tb.debit)}</span></span>
                  <span>เครดิต <span className="font-mono font-bold text-white">{money(tb.credit)}</span></span>
                  {!tb.balanced && <span className="font-bold text-danger">ไม่สมดุล ต่างกัน {money(Math.abs(tb.debit - tb.credit))}</span>}
                  <span className="flex items-center gap-2">วันที่ยกมา <NexusDatePicker value={tbDate} onChange={(e) => setTbDate(e.target.value)} disabled={busy} className="w-[160px]" /></span>
                </>
              )}
              {hasOpeningStock && (
                <span className="flex items-center gap-2" title="ไม่ต้องเลือก ถ้ายอดสินค้าคงเหลือรวมอยู่ในงบทดลองยกมาแล้ว (จะได้ไม่บันทึกซ้ำ)">
                  <PillCheckbox label="ลงบัญชียอดยกมาสินค้า" checked={postJournal} onChange={(e) => setPostJournal(e.target.checked)} disabled={busy} />
                  <span className="text-[12px] text-white/40">ไม่ต้องเลือกถ้ารวมในงบทดลองยกมาแล้ว</span>
                </span>
              )}
              <PillButton variant="primary" onClick={runImport} disabled={busy || pending === 0 || tbBlocked} className="h-9 px-5 text-xs ml-auto">
                {busy ? `กำลังนำเข้า ${count.done + count.failed}/${count.done + count.failed + count.ready + count.saving}` : pending === 0 && count.done > 0 ? "นำเข้าเสร็จแล้ว" : tab === "tb" ? `สร้างใบสำคัญยกมา (${pending} บัญชี)` : `นำเข้า ${pending} รายการ`}
              </PillButton>
            </div>
          )}

          {rows.length > 0 && (
            <GlassCard accentColor="teal" className="p-2">
              <NexusTable headers={["ลำดับ", ...previewCols.map((c) => c.header), "สถานะ", "หมายเหตุ"]}>
                {rows.map((r) => (
                  <NexusTableRow key={r.rowNo}>
                    <NexusTableCell className="font-mono text-white/50">{r.rowNo}</NexusTableCell>
                    {previewCols.map((c) => (
                      <NexusTableCell key={c.key} className={cn(c.type === "number" || c.type === "int" ? "font-mono" : "", "text-white/80")}>
                        {r.values[c.key] === undefined ? "-" : c.type === "number" ? money(r.values[c.key]) : typeof r.values[c.key] === "number" ? r.values[c.key].toLocaleString("th-TH") : String(r.values[c.key])}
                      </NexusTableCell>
                    ))}
                    <NexusTableCell><span className={cn("text-[12px] font-bold", STATUS[r.status][1])}>{STATUS[r.status][0]}</span></NexusTableCell>
                    <NexusTableCell className="text-[12px] text-white/60" title={[...r.errors, r.message].filter(Boolean).join(" · ")}>{[...r.errors, r.message].filter(Boolean).join(" · ") || "-"}</NexusTableCell>
                  </NexusTableRow>
                ))}
              </NexusTable>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  );
}
