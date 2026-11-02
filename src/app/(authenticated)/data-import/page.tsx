"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCheck, Download, FileDown, FileSpreadsheet, Files, Pencil, RefreshCw, RotateCcw, SpellCheck, Trash2, Undo2, Upload, X } from "lucide-react";
import { GlassCard, NexusDatePicker, NexusTable, NexusTableCell, NexusTableRow, PillButton, PillCheckbox, PillSelect, PillTabs, cn } from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { useSystemDialog } from "@/context/DialogContext";
import { apiFetch } from "@/lib/api-client";
import { can } from "@/lib/permissions";
import { CHART_OF_ACCOUNTS } from "@/lib/chart-of-accounts";
import { IMPORT_TEMPLATES, mapHeaders, parseDate, parseRows, toCreateRequest, toTemplateRow, type ImportEntity, type ImportTemplate, type ParsedRow } from "@/lib/import/templates";
import { OPENING_TB_REF, OPENING_TEMPLATES, tbLines, type OpeningKind } from "@/lib/import/opening";
import { detectEntity, sheetName } from "@/lib/import/detect";
import { checkRowSpelling, type FieldFix } from "@/lib/import/row-check";
import { buildAddressIndex, type AddressIndex } from "@/lib/spellcheck";
import { isDupWarning, markPartyDuplicates } from "@/lib/import/party-dups";
import { useCustomers, useSuppliers } from "@/hooks/useCustomers";
import { ImportRowEditor } from "@/components/import/ImportRowEditor";
import { ImportedRecordsManager } from "@/components/import/ImportedRecordsManager";

/**
 * นำเข้า/ส่งออกข้อมูลด้วย Excel
 *  - ข้อมูลหลัก: ลูกค้า ผู้ขาย สินค้า (+จำนวนยกมา) ส่งทีละแถวผ่าน /api/master-data · พนักงานผ่าน /api/hr/employees
 *  - ส่งออก (/api/data-export) ได้ไฟล์หัวตารางเดียวกับแม่แบบ + "รหัสในระบบ" → แก้ใน Excel แล้วนำเข้ากลับ = แก้รายการเดิม
 *  - ยอดยกมาทางบัญชี (ฝ่ายบัญชี): งบทดลองยกมา -> ใบสำคัญ JV ร่าง (/api/finance/journal-entries),
 *    ลูกหนี้/เจ้าหนี้คงค้างรายใบ (/api/finance/opening-balances) + กระทบยอดกับบัญชีคุม
 *  - หลายไฟล์/หลายชีตพร้อมกัน: แต่ละชีตระบุชนิดข้อมูลจากหัวตาราง (+ชื่อไฟล์/ชีต) เปลี่ยนเองได้
 *    นำเข้าทั้งหมดตามลำดับ ลูกค้า → ผู้ขาย → สินค้า → พนักงาน → งบทดลอง → ลูกหนี้ → เจ้าหนี้
 * อ่านไฟล์ในเบราว์เซอร์ ตรวจทุกแถวก่อน (server ตรวจซ้ำอีกชั้น)
 *  - แถวที่ไม่ผ่าน/นำเข้าไม่สำเร็จ แก้ในหน้านี้ได้ (ไม่ต้องแก้ไฟล์แล้วเลือกใหม่) ตรวจใหม่ทันที
 *  - ตรวจคำผิด: ปรับรูปแบบที่ปลอดภัยให้เอง + เตือนคำที่อาจพิมพ์ผิด/ที่อยู่ไม่ตรงฐานข้อมูล พร้อมคำแนะนำ (ไม่บล็อกการนำเข้า) · ปล่อยผ่านคำเตือนได้
 *  - ลบแถวที่ไม่ต้องการก่อนนำเข้า (ข้าม · คืนได้) และลบรายการที่นำเข้าไปแล้ว (เฉพาะที่ยังไม่ถูกใช้ในเอกสาร — คืนเลขผู้เสียภาษี/รหัสให้นำเข้าใหม่ได้)
 */

type TabId = ImportEntity | OpeningKind;
type RowState = ParsedRow & { status: "ready" | "invalid" | "saving" | "done" | "failed" | "skipped" | "removed"; message?: string; fixes?: FieldFix[]; createdId?: string };
/** ชุดข้อมูลหนึ่งชีตของไฟล์ที่เลือก */
interface Batch {
  id: string; fileName: string; sheet: string; sheets: number;
  entity: TabId | null; ambiguous: boolean;
  aoa: any[][]; rows: RowState[];
  notes: { missing: string[]; unknown: string[]; normalized?: number }; error: string;
  /** คำเตือนคำผิดที่ผู้ใช้ปล่อยผ่าน: "แถว|ช่อง|ค่าที่แนะนำ" */
  dismissed?: string[];
}
interface Status {
  tb: { id: string; journalNo: string; date: string; status: string; total: number }[];
  ar: { count: number; total: number; outstanding: number };
  ap: { count: number; total: number; outstanding: number };
  reconcile: { label: string; account: string; gl: number; glWithDraft: number; sub: number; diff: number }[];
}

const TEMPLATES: Record<TabId, ImportTemplate> = { ...IMPORT_TEMPLATES, ...OPENING_TEMPLATES };
const TAB_ORDER: TabId[] = ["customers", "suppliers", "products", "employees", "tb", "ar", "ap"];
const isOpening = (t: TabId | null): t is OpeningKind => t === "tb" || t === "ar" || t === "ap";
const PREVIEW: Record<TabId, string[]> = {
  customers: ["name", "taxId", "phone", "creditTermDays"],
  suppliers: ["name", "taxId", "phone", "creditTermDays"],
  products: ["sku", "name", "unit", "price", "openingQty"],
  employees: ["firstName", "lastName", "position", "department", "employmentType"],
  tb: ["accountCode", "accountName", "debit", "credit"],
  ar: ["docNo", "date", "partyName", "amount"],
  ap: ["docNo", "date", "partyName", "amount"],
};
const STATUS: Record<RowState["status"], [string, string]> = {
  ready: ["พร้อม", "text-nexus-teal"], invalid: ["ไม่ผ่าน", "text-danger"], saving: ["กำลังบันทึก", "text-nexus-blue"],
  done: ["นำเข้าแล้ว", "text-nexus-teal"], failed: ["ไม่สำเร็จ", "text-danger"],
  skipped: ["ข้าม", "text-white/40"], removed: ["ลบแล้ว", "text-white/40"],
};
const STEPS: Record<TabId, string> = {
  customers: "แถวที่ซ้ำกับข้อมูลในระบบจะถูกข้ามและแจ้งเหตุผล",
  suppliers: "ระบบสร้างผู้รับเหมารหัสเดียวกันให้ด้วย",
  products: "เว้นรหัสสินค้าว่างไว้ ระบบออกรหัสให้ตอนนำเข้า · ใส่จำนวนคงเหลือยกมาได้ (รับเข้าคลังเป็นยอดยกมา)",
  employees: "ระบบออกรหัสพนักงานให้ — เลขบัตรประชาชนซ้ำกับคนเดิมจะไม่ถูกเพิ่ม",
  tb: "ยอดคงเหลือทุกบัญชี ณ วันก่อนเริ่มใช้ระบบ เดบิตต้องเท่ากับเครดิต — ได้ใบสำคัญร่างรออนุมัติลงบัญชี",
  ar: "ใบแจ้งหนี้ที่ลูกค้ายังค้างชำระ — ไม่บันทึกบัญชีซ้ำ (ยอดรวมอยู่ในงบทดลองแล้ว) รับชำระต่อในระบบได้",
  ap: "ใบแจ้งหนี้ผู้ขายที่ยังค้างจ่าย — ไม่บันทึกบัญชีซ้ำ จ่ายชำระต่อในระบบได้ (ล้างเจ้าหนี้ 2111)",
};
/** ชีตประกอบในไฟล์แม่แบบ (ไม่ใช่ข้อมูล) */
const AUX_SHEETS = ["คำอธิบาย", "ผังบัญชี"];
const MAX_ROWS = 2000;

const money = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const loadXlsx = () => import("xlsx");
const bkkToday = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const firstOfMonth = () => `${bkkToday().slice(0, 7)}-01`;
const headerRow = (t: ImportTemplate) => t.columns.map((c) => (c.required ? `${c.header}*` : c.header));
const colWidths = (t: ImportTemplate) => t.columns.map((c) => ({ wch: Math.max(14, c.header.length + 4) }));
const countOf = (rows: RowState[]) => {
  const c = { ready: 0, review: 0, invalid: 0, saving: 0, done: 0, failed: 0, skipped: 0, removed: 0 };
  rows.forEach((r) => (isReview(r) ? c.review++ : c[r.status]++));
  return c;
};

/** ฐานข้อมูลที่อยู่ไทย (โหลดครั้งเดียวเมื่อมีข้อมูลลูกค้า/ผู้ขาย) — ใช้ตรวจจังหวัด อำเภอ ตำบล รหัสไปรษณีย์ */
let ADDRESS_INDEX: AddressIndex | null = null;

/** ลูกค้า/ผู้ขายที่มีอยู่ในระบบ (โหลดเมื่อมีชุดข้อมูลชนิดนั้น) — ใช้ตรวจซ้ำก่อนนำเข้า */
const EXISTING: Partial<Record<TabId, any[]>> = {};

/** ยังไม่ผ่านการตรวจทาน: รูปแบบถูกแล้ว แต่มีคำเตือน (คำผิด/เลขผู้เสียภาษีซ้ำ) — แก้หรือปล่อยผ่านก่อนจึงนำเข้า */
const isReview = (r: RowState) => r.status === "ready" && !!r.fixes?.length;

/** แถวที่ต้องดู: ไม่ผ่าน · นำเข้าไม่สำเร็จ · มีคำเตือน (ยังไม่นำเข้า) */
const needsAttention = (r: RowState) => r.status === "invalid" || r.status === "failed" || isReview(r);

const fixKey = (rowNo: number, f: FieldFix) => `${rowNo}|${f.key}|${f.to || f.from}`;
/** ตัดคำเตือนที่ปล่อยผ่านแล้วออก */
const withoutDismissed = (rows: RowState[], dismissed: string[] = []) =>
  dismissed.length ? rows.map((r) => (r.fixes?.length ? { ...r, fixes: r.fixes.filter((f) => !dismissed.includes(fixKey(r.rowNo, f))) } : r)) : rows;

/** ตรวจใหม่หลังแก้ข้อมูล: แถวที่นำเข้าแล้ว/กำลังบันทึก/ข้าม/ลบแล้ว คงสถานะเดิม · คำเตือนที่ปล่อยผ่านไม่กลับมา */
function reparse(b: Batch, aoa: any[][]): Batch {
  // แถวที่ลบ/ข้ามแล้ว ไม่นับเป็นข้อมูลซ้ำกับแถวอื่น
  const next = parseBatch(aoa, b.entity, new Set(b.rows.filter((r) => r.status === "skipped" || r.status === "removed").map((r) => r.rowNo)));
  const keep = new Map(b.rows.filter((r) => ["done", "saving", "skipped", "removed"].includes(r.status)).map((r) => [r.rowNo, r]));
  return { ...b, aoa, ...next, rows: withoutDismissed(next.rows.map((r) => keep.get(r.rowNo) || r), b.dismissed) };
}

/**
 * ค่าของเซลล์ในรูปที่คนอ่าน/แก้ได้ — ตรงกับที่ระบบอ่านจากไฟล์:
 * Excel เก็บเลขผู้เสียภาษี/เบอร์โทรเป็นตัวเลข (เลข 0 นำหน้าหาย) และวันที่เป็นเลขลำดับวัน
 */
function cellText(c: ImportTemplate["columns"][number], v: any): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "number") {
    if (c.type === "taxId") return String(v).padStart(13, "0");
    if (c.leadingZero) return "0" + String(v);
    if (c.type === "date") { const d = parseDate(v); if (d) return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`; }
  }
  return String(v);
}

/** ค่าตามไฟล์ของแต่ละช่องในแถว (ใช้ในหน้าต่างแก้ไข) */
function cellsOf(b: Batch, rowNo: number): Record<string, string> {
  if (!b.entity) return {};
  const t = TEMPLATES[b.entity];
  const { index } = mapHeaders(t, b.aoa[0] || []);
  const raw = b.aoa[rowNo - 1] || [];
  return Object.fromEntries(t.columns.map((c) => [c.key, index[c.key] === undefined ? "" : cellText(c, raw[index[c.key]])]));
}

/** เขียนค่าที่แก้กลับลงตารางของชีต เฉพาะช่องที่เปลี่ยน (ช่องอื่นคงค่าดิบตามไฟล์) · เพิ่มคอลัมน์ให้ถ้าไฟล์ไม่มีช่องนั้น */
function writeCells(b: Batch, rowNo: number, cells: Record<string, string>): any[][] {
  const t = TEMPLATES[b.entity!];
  const before = cellsOf(b, rowNo);
  const aoa = b.aoa.map((r) => [...(r || [])]);
  const header = aoa[0] || (aoa[0] = []);
  const { index } = mapHeaders(t, header);
  const row = aoa[rowNo - 1] || (aoa[rowNo - 1] = []);
  for (const c of t.columns) {
    if (!(c.key in cells) || cells[c.key] === before[c.key]) continue;
    let at = index[c.key];
    if (at === undefined) {
      if (!cells[c.key]) continue;
      at = header.length; header.push(c.required ? `${c.header}*` : c.header);
    }
    row[at] = cells[c.key];
  }
  return aoa;
}

/** แปลงตารางของชีตเป็นแถวที่ตรวจแล้ว ตามชนิดข้อมูล */
function parseBatch(aoa: any[][], entity: TabId | null, ignoreDup?: Set<number>): Pick<Batch, "rows" | "notes" | "error"> {
  const empty = { rows: [], notes: { missing: [], unknown: [] } };
  if (!entity) return { ...empty, error: "ไม่รู้ว่าเป็นข้อมูลชนิดใด (หัวตารางไม่ตรงแม่แบบ) — เลือกชนิดข้อมูลเอง" };
  if (!aoa.length) return { ...empty, error: "ไม่มีข้อมูล" };
  const template = TEMPLATES[entity];
  const { index, missing, unknown } = mapHeaders(template, aoa[0]);
  if (missing.length) return { rows: [], notes: { missing, unknown }, error: "" };
  const parsed = parseRows(template, aoa.slice(1), index, ignoreDup);
  if (!parsed.length) return { rows: [], notes: { missing, unknown }, error: "ไม่พบแถวข้อมูลใต้หัวตาราง" };
  if (parsed.length > MAX_ROWS) return { rows: [], notes: { missing, unknown }, error: `มี ${parsed.length} แถว — แบ่งไฟล์ละไม่เกิน ${MAX_ROWS.toLocaleString("th-TH")} แถว` };
  let normalized = 0;
  const rows: RowState[] = parsed.map((r) => {
    const chk = checkRowSpelling(template, r.values, ADDRESS_INDEX);
    normalized += chk.normalized;
    return { ...r, values: chk.values, fixes: chk.fixes, status: r.errors.length ? "invalid" : "ready" };
  });
  if (entity === "customers" || entity === "suppliers") markPartyDuplicates(template, rows, EXISTING[entity] || []);
  return { rows, notes: { missing, unknown, normalized }, error: "" };
}

export default function DataImportPage() {
  const { companyId, roles } = useAuth();
  const { showConfirm } = useSystemDialog();
  const allowed = TAB_ORDER.filter((t) => can(roles, TEMPLATES[t].permission));
  const [tab, setTab] = useState<TabId>(allowed[0] || "customers");
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [postJournal, setPostJournal] = useState(true);
  const [tbDate, setTbDate] = useState(firstOfMonth());
  const [status, setStatus] = useState<Status | null>(null);
  const [showImported, setShowImported] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const template = TEMPLATES[tab];
  const canFinance = can(roles, "finance:edit");
  const batch = batches.find((b) => b.id === selected) || batches[0] || null;

  const loadStatus = useCallback(async () => {
    if (!companyId || !canFinance) return;
    try {
      const res = await apiFetch("/api/finance/opening-balances", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "status" }) });
      const d = await res.json();
      if (res.ok && d.success) setStatus(d);
    } catch { /* แสดงเฉพาะเมื่อโหลดได้ */ }
  }, [companyId, canFinance]);
  const wantsStatus = isOpening(tab) || batches.some((b) => isOpening(b.entity));
  useEffect(() => { if (wantsStatus) loadStatus(); }, [wantsStatus, loadStatus]);

  const switchTab = (id: string) => { if (!busy) setTab(id as TabId); };
  const clearAll = () => { if (busy) return; setBatches([]); setSelected(""); setError(""); setInfo(""); };
  const removeBatch = (id: string) => { if (busy) return; setBatches((cur) => cur.filter((b) => b.id !== id)); };

  /** สมุดแม่แบบ: หนึ่งชีตต่อชนิดข้อมูล + คำอธิบาย (+ผังบัญชีถ้ามีงบทดลอง) */
  const downloadTemplates = async (types: TabId[]) => {
    const XLSX = await loadXlsx();
    const wb = XLSX.utils.book_new();
    const single = types.length === 1;
    for (const t of types) {
      const tp = TEMPLATES[t];
      const data = XLSX.utils.aoa_to_sheet([headerRow(tp)]);
      data["!cols"] = colWidths(tp);
      XLSX.utils.book_append_sheet(wb, data, single ? "ข้อมูล" : sheetName(tp.label));
    }
    const guide = XLSX.utils.aoa_to_sheet([
      [...(single ? [] : ["ชีต"]), "คอลัมน์", "จำเป็น", "ตัวอย่าง", "คำอธิบาย"],
      ...types.flatMap((t) => TEMPLATES[t].columns.map((c) => [...(single ? [] : [sheetName(TEMPLATES[t].label)]), c.header, c.required ? "ต้องกรอก" : "", c.example, c.note || ""])),
      [],
      [single ? "กรอกข้อมูลในชีต \"ข้อมูล\" หนึ่งแถวต่อหนึ่งรายการ ลำดับคอลัมน์สลับได้ คอลัมน์ที่ไม่ใช้ลบออกได้ (ยกเว้นคอลัมน์ที่มี *)" : "กรอกแต่ละชีตตามชนิดข้อมูล ชีตที่ไม่ใช้ปล่อยว่างหรือลบได้ · นำเข้าไฟล์นี้ไฟล์เดียว ระบบแยกชีตให้เอง"],
      ["เลขผู้เสียภาษี/เบอร์โทร: ตั้งรูปแบบเซลล์เป็นข้อความ หรือพิมพ์ตามปกติก็ได้ ระบบเติมเลข 0 นำหน้าให้"],
    ]);
    guide["!cols"] = [...(single ? [] : [{ wch: 16 }]), { wch: 30 }, { wch: 10 }, { wch: 24 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, guide, "คำอธิบาย");
    if (types.includes("tb")) {
      const chart = XLSX.utils.aoa_to_sheet([["รหัสบัญชี", "ชื่อบัญชี"], ...CHART_OF_ACCOUNTS.map((a) => [a.code, a.name])]);
      chart["!cols"] = [{ wch: 12 }, { wch: 40 }];
      XLSX.utils.book_append_sheet(wb, chart, "ผังบัญชี");
    }
    XLSX.writeFile(wb, single ? `แม่แบบนำเข้า-${template.label.replace(/\//g, "-")}.xlsx` : `แม่แบบนำเข้า-ทั้งหมด-${bkkToday()}.xlsx`);
  };

  /** ส่งออกข้อมูลในระบบ — หัวตารางเดียวกับแม่แบบ แก้แล้วนำเข้ากลับได้ · หลายชนิด = หนึ่งชีตต่อชนิด */
  const exportData = async (types: ImportEntity[]) => {
    if (!companyId || !types.length) return;
    setBusy(true); setError(""); setInfo("");
    try {
      const XLSX = await loadXlsx();
      const wb = XLSX.utils.book_new();
      const counts: string[] = [];
      for (const t of types) {
        const d = await post("/api/data-export", { entity: t });
        const tp = TEMPLATES[t];
        const sheet = XLSX.utils.aoa_to_sheet([headerRow(tp), ...d.records.map((r: any) => toTemplateRow(t, r))]);
        sheet["!cols"] = colWidths(tp);
        XLSX.utils.book_append_sheet(wb, sheet, types.length === 1 ? "ข้อมูล" : sheetName(tp.label));
        counts.push(`${tp.label} ${d.records.length}`);
      }
      XLSX.writeFile(wb, `${types.length === 1 ? TEMPLATES[types[0]].label.replace(/\//g, "-") : "ข้อมูลหลัก"}-${bkkToday()}.xlsx`);
      setInfo(`ส่งออกแล้ว (${counts.join(" · ")} รายการ) — แก้ในไฟล์แล้วนำเข้ากลับ: แถวที่มี "รหัสในระบบ" = แก้รายการเดิม · แถวที่ไม่มี = เพิ่มใหม่`);
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  };

  /** อ่านหลายไฟล์: ทุกชีตที่หัวตารางตรงแม่แบบเป็นหนึ่งชุด · ไฟล์ที่ไม่มีชีตตรงเลย = หนึ่งชุดให้เลือกชนิดเอง */
  const readFiles = async (files: File[]) => {
    if (busy || !files.length) return;
    setError(""); setInfo("");
    const XLSX = await loadXlsx();
    const added: Batch[] = [];
    const candidates = allowed.map((t) => TEMPLATES[t]);
    for (const file of files) {
      try {
        const wb = XLSX.read(await file.arrayBuffer());
        const sheets = wb.SheetNames.filter((n) => !AUX_SHEETS.includes(n));
        const found: Batch[] = [];
        let firstAoa: any[][] = [];
        for (const name of sheets) {
          const aoa = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[name], { header: 1, raw: true, defval: "", blankrows: false });
          if (!aoa.length) continue;
          if (!firstAoa.length) firstAoa = aoa;
          const det = detectEntity(aoa[0], [file.name, name], candidates, tab);
          if (!det.entity) continue;
          const entity = det.entity as TabId;
          // แม่แบบรวม: ชีตที่มีแค่หัวตาราง (ไม่ได้กรอก) ข้ามไป
          if (sheets.length > 1 && aoa.length < 2) continue;
          found.push({ id: `${file.name}:${name}:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`, fileName: file.name, sheet: name, sheets: sheets.length, entity, ambiguous: det.ambiguous, aoa, ...parseBatch(aoa, entity) });
        }
        if (!found.length) {
          found.push({ id: `${file.name}:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`, fileName: file.name, sheet: sheets[0] || "", sheets: sheets.length, entity: null, ambiguous: false, aoa: firstAoa, ...parseBatch(firstAoa, null), ...(firstAoa.length ? {} : { error: "ไฟล์ไม่มีข้อมูล" }) });
        }
        added.push(...found);
      } catch (err: any) {
        added.push({ id: `${file.name}:${Date.now()}`, fileName: file.name, sheet: "", sheets: 0, entity: null, ambiguous: false, aoa: [], rows: [], notes: { missing: [], unknown: [] }, error: `อ่านไฟล์ไม่สำเร็จ: ${err.message || err}` });
      }
    }
    setBatches((cur) => [...cur, ...added]);
    if (added[0]) setSelected(added[0].id);
  };
  const setBatchEntity = (id: string, entity: TabId | null) => setBatches((cur) => cur.map((b) => (b.id === id ? { ...b, entity, ambiguous: false, ...parseBatch(b.aoa, entity) } : b)));

  // ตรวจที่อยู่: โหลดฐานข้อมูลที่อยู่ไทยเมื่อมีข้อมูลลูกค้า/ผู้ขาย แล้วตรวจทุกชุดใหม่
  const needsAddress = batches.some((b) => b.entity === "customers" || b.entity === "suppliers");
  const hasCustomers = batches.some((b) => b.entity === "customers"), hasSuppliers = batches.some((b) => b.entity === "suppliers");
  // ข้อมูลในระบบโหลดเสร็จ/เปลี่ยน → ตรวจซ้ำชุดชนิดนั้นใหม่ (แถวที่นำเข้าแล้ว/ข้าม/ลบ คงสถานะ)
  const onExistingLoaded = useCallback((entity: TabId) => setBatches((cur) => cur.map((b) => (b.entity === entity ? reparse(b, b.aoa) : b))), []);
  useEffect(() => {
    if (!needsAddress || ADDRESS_INDEX) return;
    let cancelled = false;
    fetch("/data/thailand_addresses.json").then((r) => r.json()).then((rows) => {
      if (cancelled) return;
      ADDRESS_INDEX = buildAddressIndex(rows);
      setBatches((cur) => cur.map((b) => (b.entity ? reparse(b, b.aoa) : b)));
    }).catch(() => { /* ตรวจคำผิดทั่วไปได้ตามเดิม แค่ไม่ตรวจที่อยู่ */ });
    return () => { cancelled = true; };
  }, [needsAddress]);

  // แก้แถวในหน้าจอ
  const [editing, setEditing] = useState<{ batchId: string; rowNo: number } | null>(null);
  const editBatch = editing ? batches.find((b) => b.id === editing.batchId) || null : null;
  const editRow = editBatch?.rows.find((r) => r.rowNo === editing?.rowNo) || null;
  const editCells = useMemo(() => (editBatch && editing ? cellsOf(editBatch, editing.rowNo) : {}), [editBatch?.aoa, editing?.rowNo]); // eslint-disable-line react-hooks/exhaustive-deps
  const nextAttention = (b: Batch, after: number) => b.rows.find((r) => r.rowNo > after && needsAttention(r)) || b.rows.find((r) => r.rowNo < after && needsAttention(r)) || null;
  const saveEdit = (cells: Record<string, string>, goNext: boolean) => {
    if (!editBatch || !editing) return;
    const updated = reparse(editBatch, writeCells(editBatch, editing.rowNo, cells));
    setBatches((cur) => cur.map((b) => (b.id === updated.id ? updated : b)));
    const nxt = goNext ? nextAttention(updated, editing.rowNo) : null;
    setEditing(nxt && nxt.rowNo !== editing.rowNo ? { batchId: updated.id, rowNo: nxt.rowNo } : null);
  };
  // แก้คำผิดตามคำแนะนำทั้งชุด (เฉพาะแถวที่ยังไม่นำเข้า และคำแนะนำที่มีคำที่ถูก)
  const applyAllFixes = (b: Batch) => {
    let aoa = b.aoa;
    for (const r of b.rows) {
      if (r.status === "done" || r.status === "saving" || !r.fixes?.some((x) => x.to)) continue;
      aoa = writeCells({ ...b, aoa }, r.rowNo, Object.fromEntries(r.fixes.filter((x) => x.to).map((x) => [x.key, x.to])));
    }
    setBatches((cur) => cur.map((x) => (x.id === b.id ? reparse(x, aoa) : x)));
  };

  const post = async (url: string, body: Record<string, any>) => {
    const res = await apiFetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, ...body }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || !d.success) throw new Error(d.error || `บันทึกไม่สำเร็จ (${res.status})`);
    return d;
  };
  const update = (batchId: string, rowNos: number[], patch: Partial<RowState>) =>
    setBatches((cur) => cur.map((b) => (b.id !== batchId ? b : { ...b, rows: b.rows.map((r) => (rowNos.includes(r.rowNo) ? { ...r, ...patch } : r)) })));

  const importMaster = async (b: Batch, todo: RowState[]) => {
    const entity = b.entity as ImportEntity;
    for (const row of todo) {
      update(b.id, [row.rowNo], { status: "saving", message: "" });
      try {
        const req = toCreateRequest(entity, row.values, { postOpeningJournal: postJournal });
        const id = String(row.values._id || "").trim();
        if (entity === "employees") {
          const d = await post("/api/hr/employees", { ...req.data, ...(id ? { employeeDocId: id } : {}) });
          update(b.id, [row.rowNo], { status: "done", message: id ? "แก้ไขแล้ว" : `รหัส ${d.employeeId || d.docId || ""}`, createdId: id ? undefined : d.docId });
          continue;
        }
        if (id) {
          // แก้รายการเดิม: ค่ากลางของเครือ (ถ้ามีสิทธิ์) ไม่เช่นนั้นเป็นค่าของบริษัท · จำนวนยกมาไม่ใช้ตอนแก้
          const adopt = !!row.values._adopt;
          const changes = { ...req.data };
          if (adopt) {
            // รายการกลางที่บริษัทนี้ไม่ได้ใช้: นำกลับมาใช้ (รหัสเดิม) แล้วอัปเดตตามไฟล์ — ยังจัดการ/ลบได้แบบข้อมูลนำเข้า
            await post("/api/master-data", { action: "adopt", entity, id, data: { importedFrom: "excel" } });
            if (entity === "suppliers") await post("/api/master-data", { action: "adopt", entity: "contractors", id, data: { importedFrom: "excel" } }).catch(() => undefined);
          }
          delete changes.importedFrom;
          const save = (e: string, scope: "group" | "company") => post("/api/master-data", { action: "update", entity: e, id, changes, scope });
          await save(entity, "group").catch((err) => (/สิทธิ์|403/.test(err.message) ? save(entity, "company") : Promise.reject(err)));
          if (entity === "suppliers") await save("contractors", "group").catch(() => save("contractors", "company")).catch(() => undefined);
          update(b.id, [row.rowNo], { status: "done", message: adopt ? `นำกลับมาใช้ รหัส ${id}` : "แก้ไขแล้ว", ...(adopt ? { createdId: id } : {}) });
          continue;
        }
        if (entity === "products") {
          // รหัสสินค้าว่าง = ให้ server ออกรหัสให้ตอนบันทึก (ไม่ซ้ำในเครือ)
          const res = await post("/api/master-data", { action: "create", entity, id: `PROD-${Date.now()}-${row.rowNo}`, autoSku: !row.values.sku, ...req });
          update(b.id, [row.rowNo], { status: "done", message: `รหัส ${res.sku}`, createdId: res.id });
          continue;
        } else if (entity === "suppliers") {
          // ผู้ขายและผู้รับเหมาใช้รหัสเดียวกัน (เหมือนฟอร์มเพิ่มผู้ขาย)
          const { id } = await post("/api/master-data", { action: "create", entity: "suppliers", ...req });
          await post("/api/master-data", { action: "create", entity: "contractors", id, ...req }).catch((err) => { throw new Error(`สร้างผู้ขายแล้ว (${id}) แต่สร้างผู้รับเหมาไม่สำเร็จ: ${err.message}`); });
          update(b.id, [row.rowNo], { status: "done", message: `รหัส ${id}`, createdId: id });
          continue;
        } else {
          const d = await post("/api/master-data", { action: "create", entity, ...req });
          update(b.id, [row.rowNo], { status: "done", message: d.code ? `รหัส ${d.code}` : "", createdId: d.id });
          continue;
        }
        update(b.id, [row.rowNo], { status: "done" });
      } catch (err: any) {
        update(b.id, [row.rowNo], { status: "failed", message: err.message });
      }
    }
  };

  const importTb = async (b: Batch, todo: RowState[]) => {
    const nos = todo.map((r) => r.rowNo);
    update(b.id, nos, { status: "saving", message: "" });
    try {
      const { lines } = tbLines(todo.map((r) => r.values as any));
      const d = await post("/api/finance/journal-entries", { date: tbDate, bookType: "JV", description: `ยอดยกมา ณ วันที่ ${tbDate} (งบทดลองจากระบบเดิม)`, reference: OPENING_TB_REF, lines });
      update(b.id, nos, { status: "done" });
      setInfo(`สร้างใบสำคัญ ${d.journalNo} (ร่าง) แล้ว — อนุมัติลงบัญชีที่เมนูสมุดรายวันเพื่อให้ยอดเข้างบ`);
    } catch (err: any) {
      update(b.id, nos, { status: "failed", message: err.message });
    }
  };

  const importOpenItems = async (b: Batch, todo: RowState[]) => {
    for (let i = 0; i < todo.length; i += 200) {
      const chunk = todo.slice(i, i + 200);
      update(b.id, chunk.map((r) => r.rowNo), { status: "saving", message: "" });
      try {
        const d = await post("/api/finance/opening-balances", { action: b.entity, items: chunk.map((r) => r.values) });
        setBatches((cur) => cur.map((x) => (x.id !== b.id ? x : {
          ...x,
          rows: x.rows.map((r) => {
            const at = chunk.findIndex((c) => c.rowNo === r.rowNo);
            if (at < 0) return r;
            const res = d.results.find((y: any) => y.index === at);
            return res?.ok ? { ...r, status: "done" as const } : { ...r, status: "failed" as const, message: res?.error || "ไม่สำเร็จ" };
          }),
        })));
      } catch (err: any) {
        update(b.id, chunk.map((r) => r.rowNo), { status: "failed", message: err.message });
      }
    }
  };

  /** งบทดลองต้องนำเข้าทั้งชุด: ทุกแถวผ่าน และเดบิต = เครดิต */
  const tbOf = (b: Batch) => (b.entity === "tb" ? tbLines(b.rows.filter((r) => r.status !== "invalid" && r.status !== "skipped").map((r) => r.values as any)) : null);
  const pendingOf = (b: Batch) => (b.entity && !b.error ? b.rows.filter((r) => (r.status === "ready" && !isReview(r)) || r.status === "failed") : []);
  const blockedOf = (b: Batch) => !b.entity || !!b.error || b.notes.missing.length > 0 || (b.entity === "tb" && (countOf(b.rows).invalid > 0 || !tbOf(b)?.balanced));

  // ---------- ลบ / ข้าม / ปล่อยผ่าน ----------
  /** ข้ามแถว (ไม่นำเข้า) หรือคืนแถวที่ข้ามไว้ */
  /** ลบ/คืนแถว แล้วตรวจทั้งชุดใหม่ (แถวที่ซ้ำกับแถวที่ลบไป จะผ่านทันที) */
  const setSkipped = (b: Batch, rowNos: number[], skip: boolean) =>
    setBatches((cur) => cur.map((x) => (x.id !== b.id ? x : reparse({ ...x, rows: x.rows.map((y) => (!rowNos.includes(y.rowNo) ? y : skip ? { ...y, status: "skipped", message: "" } : { ...y, status: "invalid", message: "" })) }, x.aoa))));
  const toggleSkip = (b: Batch, r: RowState) => setSkipped(b, [r.rowNo], r.status !== "skipped");
  /** ลบรายการที่นำเข้าไปแล้ว (เฉพาะที่สร้างใหม่ และยังไม่ถูกใช้ในเอกสาร) */
  const removeImported = async (b: Batch, rows: RowState[]) => {
    const list = rows.filter((r) => r.status === "done" && r.createdId);
    if (!list.length || busy) return;
    if (!(await showConfirm(`ลบ${TEMPLATES[b.entity!].label}ที่นำเข้าแล้ว ${list.length} รายการ? — ลบได้เฉพาะรายการที่ยังไม่ถูกใช้ในเอกสาร และเลขผู้เสียภาษี/รหัสจะนำเข้าใหม่ได้`))) return;
    setBusy(true); setError(""); setInfo("");
    let ok = 0;
    for (const r of list) {
      try {
        if (b.entity === "employees") await post("/api/hr/employees", { action: "delete", employeeDocId: r.createdId });
        else {
          await post("/api/master-data", { action: "remove", entity: b.entity, id: r.createdId });
          if (b.entity === "suppliers") await post("/api/master-data", { action: "remove", entity: "contractors", id: r.createdId }).catch(() => undefined);
        }
        update(b.id, [r.rowNo], { status: "removed", message: "ลบรายการที่นำเข้าแล้ว" });
        ok++;
      } catch (err: any) {
        update(b.id, [r.rowNo], { message: err.message });
      }
    }
    setInfo(`ลบแล้ว ${ok} จาก ${list.length} รายการ${ok < list.length ? " — ที่เหลือถูกใช้ในเอกสารแล้ว (ดูหมายเหตุ)" : ""}`);
    setBusy(false);
  };
  /** ปล่อยผ่านคำเตือนคำผิด (คงค่าตามไฟล์) */
  const dismissFixes = (b: Batch, pairs: { rowNo: number; fix: FieldFix }[]) => {
    const keys = pairs.map((p) => fixKey(p.rowNo, p.fix));
    setBatches((cur) => cur.map((x) => {
      if (x.id !== b.id) return x;
      const dismissed = Array.from(new Set([...(x.dismissed || []), ...keys]));
      return { ...x, dismissed, rows: withoutDismissed(x.rows, dismissed) };
    }));
  };

  const runBatch = async (b: Batch) => {
    const todo = pendingOf(b);
    if (!todo.length || blockedOf(b)) return;
    if (b.entity === "tb") await importTb(b, todo);
    else if (b.entity === "ar" || b.entity === "ap") await importOpenItems(b, todo);
    else await importMaster(b, todo);
  };
  const runImport = async (only?: Batch) => {
    if (!companyId || busy) return;
    setBusy(true); setError(""); setInfo("");
    // ข้อมูลหลักก่อนยอดยกมา (ลูกหนี้/เจ้าหนี้อ้างชื่อลูกค้า/ผู้ขาย)
    const list = only ? [only] : [...batches].sort((a, b) => TAB_ORDER.indexOf(a.entity!) - TAB_ORDER.indexOf(b.entity!));
    for (const b of list) { setSelected(b.id); await runBatch(b); }
    setBusy(false);
    if (list.some((b) => isOpening(b.entity))) loadStatus();
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

  const count = useMemo(() => countOf(batch?.rows || []), [batch]);
  const total = useMemo(() => {
    const all = batches.flatMap((b) => (blockedOf(b) ? [] : pendingOf(b)));
    return { pending: all.length, files: batches.filter((b) => !blockedOf(b) && pendingOf(b).length).length };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- คำนวณจากชุดข้อมูลทั้งหมด
  }, [batches]);
  const tb = batch ? tbOf(batch) : null;
  const bTemplate = batch?.entity ? TEMPLATES[batch.entity] : null;
  const previewCols = batch?.entity ? PREVIEW[batch.entity].map((k) => TEMPLATES[batch.entity!].columns.find((c) => c.key === k)!) : [];
  const hasOpeningStock = batches.some((b) => b.entity === "products" && b.rows.some((r) => r.values.openingQty > 0));
  const hasTb = batches.some((b) => b.entity === "tb");
  const pending = batch ? pendingOf(batch).length : 0;
  const attention = batch ? batch.rows.filter(needsAttention) : [];
  const typoRows = batch ? batch.rows.filter((r) => r.status !== "done" && r.fixes?.length).length : 0;
  const typoFixable = batch ? batch.rows.filter((r) => r.status !== "done" && r.status !== "saving" && r.fixes?.some((x) => x.to)).length : 0;
  const existingTb = hasTb ? status?.tb || [] : [];
  const exportable = allowed.filter((t): t is ImportEntity => !isOpening(t));

  if (!allowed.length) {
    return <div className="p-10 text-white/60">ไม่มีสิทธิ์นำเข้าข้อมูล (ต้องมีสิทธิ์แก้ไขลูกค้า ผู้ขาย สินค้า พนักงาน หรือบัญชี)</div>;
  }

  return (
    <div
      className="flex-1 flex flex-col h-full overflow-hidden bg-transparent relative"
      onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDragging(true); } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }}
      onDrop={(e) => { e.preventDefault(); setDragging(false); readFiles(Array.from(e.dataTransfer.files)); }}
    >
      {dragging && (
        <div className="absolute inset-3 z-50 rounded-2xl border-2 border-dashed border-nexus-teal/60 bg-black/70 flex items-center justify-center pointer-events-none">
          <p className="text-[16px] font-bold text-nexus-teal flex items-center gap-2"><Files size={20} /> วางไฟล์ Excel ที่นี่ (หลายไฟล์ได้)</p>
        </div>
      )}
      <header className="px-6 py-2.5 min-h-[60px] border-b border-white/5 flex items-center gap-3 bg-black/20 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/10"><FileSpreadsheet size={20} /></div>
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight leading-none">นำเข้า/ส่งออกข้อมูล Excel</h1>
          <p className="text-xs font-semibold text-white/60 mt-1 leading-none">ย้ายข้อมูลหลักและยอดยกมาจากระบบเดิม · ส่งออกไปแก้แล้วนำเข้ากลับ · เลือกได้ทีละหลายไฟล์</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-5 max-w-[1800px] mx-auto space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <PillTabs className="flex-1 min-w-[240px]" tabs={allowed.map((t) => ({ id: t, label: TEMPLATES[t].label }))} activeTab={tab} onTabChange={switchTab} />
            <div className="flex flex-wrap items-center gap-2">
              <PillButton variant="glass" onClick={() => downloadTemplates([tab])} className="h-9 px-4 text-xs"><Download size={14} className="mr-1.5" /> แม่แบบ{template.label}</PillButton>
              {allowed.length > 1 && <PillButton variant="glass" onClick={() => downloadTemplates(allowed)} className="h-9 px-4 text-xs" title="ไฟล์เดียว หนึ่งชีตต่อชนิดข้อมูล — กรอกแล้วนำเข้าไฟล์นี้ไฟล์เดียว"><Files size={14} className="mr-1.5" /> แม่แบบทุกชนิด (ไฟล์เดียว)</PillButton>}
              {!isOpening(tab) && <PillButton variant="glass" onClick={() => exportData([tab as ImportEntity])} disabled={busy} className="h-9 px-4 text-xs" title="ส่งออกข้อมูลในระบบเป็น Excel (แก้แล้วนำเข้ากลับได้)"><FileDown size={14} className="mr-1.5" /> ส่งออก{template.label}</PillButton>}
              {exportable.length > 1 && <PillButton variant="glass" onClick={() => exportData(exportable)} disabled={busy} className="h-9 px-4 text-xs" title="ข้อมูลหลักทุกชนิดในไฟล์เดียว หนึ่งชีตต่อชนิด"><FileDown size={14} className="mr-1.5" /> ส่งออกทั้งหมด</PillButton>}
              <PillButton variant="primary" onClick={() => fileRef.current?.click()} disabled={busy} className="h-9 px-4 text-xs"><Upload size={14} className="mr-1.5" /> เลือกไฟล์ Excel</PillButton>
              <input ref={fileRef} type="file" multiple accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = Array.from(e.target.files || []); e.target.value = ""; readFiles(f); }} />
            </div>
          </div>

          <p className="text-[12px] text-white/50 px-1 leading-relaxed">
            1. ดาวน์โหลดแม่แบบ (ทีละชนิด หรือทุกชนิดในไฟล์เดียว) แล้วกรอกข้อมูล{!isOpening(tab) && <> หรือส่งออกเพื่อแก้ข้อมูลเดิม</>} · 2. เลือกไฟล์หรือลากมาวาง ได้ทีละหลายไฟล์ ระบบแยกชนิดข้อมูลจากหัวตารางให้และตรวจทุกแถว · 3. กดนำเข้า — {STEPS[tab]}
          </p>

          {wantsStatus && status && (
            <GlassCard accentColor="blue" className="p-2">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-3 pt-2 pb-1 text-[12px] text-white/60">
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

          {!batches.length ? (
            <div className="w-full rounded-2xl border-2 border-dashed border-white/15 py-10 flex flex-col items-center gap-2 text-white/55">
              <Files size={28} className="text-nexus-teal/80" />
              <span className="text-[14px] font-bold text-white/80">ลากไฟล์ Excel มาวางที่นี่</span>
              <span className="text-[12px]">เลือกได้ทีละหลายไฟล์ · ไฟล์ที่มีหลายชีตแยกเป็นชุดให้เอง · ไม่เกิน {MAX_ROWS.toLocaleString("th-TH")} แถวต่อชีต</span>
              <PillButton variant="glass" onClick={() => fileRef.current?.click()} disabled={busy} className="h-9 px-4 text-xs mt-1"><Upload size={14} className="mr-1.5" /> หรือเลือกไฟล์</PillButton>
            </div>
          ) : (
            <GlassCard accentColor="blue" className="p-2">
              <div className="flex flex-wrap items-center gap-2 px-3 pt-2 pb-1 text-[12px] text-white/60">
                <span className="font-bold text-white/80">เลือกไว้ {new Set(batches.map((b) => b.fileName)).size} ไฟล์ · {batches.length} ชุดข้อมูล</span>
                {hasTb && <span className="flex items-center gap-2">วันที่ยกมา (งบทดลอง) <NexusDatePicker value={tbDate} onChange={(e) => setTbDate(e.target.value)} disabled={busy} className="w-[160px]" /></span>}
                {hasOpeningStock && (
                  <span className="flex items-center gap-2" title="ไม่ต้องเลือก ถ้ายอดสินค้าคงเหลือรวมอยู่ในงบทดลองยกมาแล้ว (จะได้ไม่บันทึกซ้ำ)">
                    <PillCheckbox label="ลงบัญชียอดยกมาสินค้า" checked={postJournal} onChange={(e) => setPostJournal(e.target.checked)} disabled={busy} />
                  </span>
                )}
                <span className="ml-auto flex items-center gap-2">
                  <PillButton variant="ghost" onClick={() => fileRef.current?.click()} disabled={busy} className="h-8 px-3 text-xs"><Upload size={13} className="mr-1.5" /> เพิ่มไฟล์</PillButton>
                  <PillButton variant="ghost" onClick={clearAll} disabled={busy} className="h-8 px-3 text-xs"><X size={13} className="mr-1.5" /> ล้างรายการ</PillButton>
                  <PillButton variant="primary" onClick={() => runImport()} disabled={busy || total.pending === 0} className="h-8 px-4 text-xs">
                    {busy ? "กำลังนำเข้า…" : total.pending ? `นำเข้าทั้งหมด ${total.pending.toLocaleString("th-TH")} รายการ (${total.files} ชุด)` : "ไม่มีรายการรอนำเข้า"}
                  </PillButton>
                </span>
              </div>
              <NexusTable headers={["ไฟล์", "ชีต", "ชนิดข้อมูล", "แถว", "พร้อม", "ไม่ผ่าน", "นำเข้าแล้ว", "สถานะ", ""]}>
                {batches.map((b) => {
                  const c = countOf(b.rows), blocked = blockedOf(b);
                  const state = b.error || (b.notes.missing.length ? `ขาดคอลัมน์ ${b.notes.missing.join(", ")}` : b.entity === "tb" && blocked ? "งบทดลองไม่สมดุล/มีแถวไม่ผ่าน" : c.saving ? "กำลังนำเข้า" : !pendingOf(b).length && c.done ? "นำเข้าเสร็จแล้ว" : b.ambiguous ? "ตรวจชนิดข้อมูล" : "พร้อมนำเข้า");
                  const tone = b.error || b.notes.missing.length || (b.entity === "tb" && blocked) ? "text-danger" : b.ambiguous ? "text-warning" : "text-nexus-teal";
                  return (
                    <NexusTableRow key={b.id} onClick={() => setSelected(b.id)} className={cn("cursor-pointer", batch?.id === b.id && "bg-nexus-teal/10")}>
                      <NexusTableCell className="text-white/85 max-w-[280px] truncate" title={b.fileName}>{b.fileName}</NexusTableCell>
                      <NexusTableCell className="text-white/55">{b.sheets > 1 ? b.sheet : "-"}</NexusTableCell>
                      <NexusTableCell>
                        <div className="w-[170px]" onClick={(e) => e.stopPropagation()}>
                          <PillSelect value={b.entity || ""} disabled={busy} onChange={(e) => setBatchEntity(b.id, (String(e.target.value) || null) as TabId | null)} className={cn("h-8 w-full text-[12px]", b.ambiguous && "border-warning/60")}>
                            <option value="">เลือกชนิดข้อมูล…</option>
                            {allowed.map((t) => <option key={t} value={t}>{TEMPLATES[t].label}</option>)}
                          </PillSelect>
                        </div>
                      </NexusTableCell>
                      <NexusTableCell className="font-mono text-right text-white/80">{b.rows.length.toLocaleString("th-TH")}</NexusTableCell>
                      <NexusTableCell className="font-mono text-right text-nexus-teal">{c.ready.toLocaleString("th-TH")}</NexusTableCell>
                      <NexusTableCell className={cn("font-mono text-right", c.invalid ? "text-danger" : "text-white/40")}>{c.invalid.toLocaleString("th-TH")}</NexusTableCell>
                      <NexusTableCell className={cn("font-mono text-right", c.done ? "text-nexus-teal" : "text-white/40")}>{c.done.toLocaleString("th-TH")}{c.failed ? <span className="text-danger"> · ไม่สำเร็จ {c.failed}</span> : null}</NexusTableCell>
                      <NexusTableCell className={cn("text-[12px] font-bold max-w-[260px] truncate", tone)} title={state}>{state}</NexusTableCell>
                      <NexusTableCell>
                        <PillButton variant="ghost" aria-label="เอาออกจากรายการ" title="เอาออกจากรายการ (ไม่ลบข้อมูลที่นำเข้าแล้ว)" disabled={busy} onClick={(e) => { e.stopPropagation(); removeBatch(b.id); }} className="h-8 w-8 p-0 text-white/40 hover:text-danger"><X size={14} /></PillButton>
                      </NexusTableCell>
                    </NexusTableRow>
                  );
                })}
              </NexusTable>
            </GlassCard>
          )}

          {batch && (
            <>
              {batch.notes.missing.length > 0 && <div className="p-3 rounded-xl text-xs font-bold border bg-danger/10 border-danger/20 text-danger">{batch.fileName}: ไม่มีคอลัมน์ที่ต้องกรอก {batch.notes.missing.join(", ")} — ใช้หัวตารางตามแม่แบบ{bTemplate?.label} หรือเปลี่ยนชนิดข้อมูล</div>}
              {batch.notes.unknown.length > 0 && <p className="text-[12px] text-white/40 px-1">ข้ามคอลัมน์ที่ไม่รู้จัก: {batch.notes.unknown.join(", ")}</p>}
              {batch.entity === "tb" && existingTb.length > 0 && count.done === 0 && <div className="p-3 rounded-xl text-xs font-bold border bg-warning/10 border-warning/20 text-warning">มีใบสำคัญงบทดลองยกมาแล้ว ({existingTb.map((t) => t.journalNo).join(", ")}) — ถ้านำเข้าซ้ำ ให้ยกเลิกใบเดิมก่อน ยอดจะได้ไม่เบิ้ล</div>}
            </>
          )}

          {hasCustomers && <CustomersLoader onLoad={onExistingLoaded} />}
          {hasSuppliers && <SuppliersLoader onLoad={onExistingLoaded} />}
          <ImportRowEditor
            open={!!editRow}
            template={editBatch?.entity ? TEMPLATES[editBatch.entity] : null}
            rowNo={editRow?.rowNo || 0}
            cells={editCells}
            errors={editRow?.errors || []}
            message={editRow?.status === "failed" ? editRow.message : undefined}
            fixes={editRow?.fixes || []}
            hasNext={!!(editBatch && editRow && nextAttention(editBatch, editRow.rowNo) && nextAttention(editBatch, editRow.rowNo)!.rowNo !== editRow.rowNo)}
            onClose={() => setEditing(null)}
            onSave={saveEdit}
            onDismiss={(fx) => editBatch && editRow && dismissFixes(editBatch, fx.map((fix) => ({ rowNo: editRow.rowNo, fix })))}
            onSkip={() => { if (editBatch && editRow) { toggleSkip(editBatch, editRow); setEditing(null); } }}
          />

          {batch && batch.rows.length > 0 && bTemplate && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-white/60 px-1">
              <span className="text-white/80 font-bold">{batch.fileName}{batch.sheets > 1 ? ` · ${batch.sheet}` : ""} — {bTemplate.label}</span>
              <span>ทั้งหมด <span className="font-mono font-bold text-white">{batch.rows.length}</span></span>
              <span>พร้อมนำเข้า <span className="font-mono font-bold text-nexus-teal">{count.ready}</span></span>
              {count.review > 0 && <span>ต้องตรวจสอบ <span className="font-mono font-bold text-amber-300">{count.review}</span></span>}
              {count.invalid > 0 && <span>ไม่ผ่าน <span className="font-mono font-bold text-danger">{count.invalid}</span></span>}
              {count.done > 0 && <span>นำเข้าแล้ว <span className="font-mono font-bold text-nexus-teal">{count.done}</span></span>}
              {count.failed > 0 && <span>ไม่สำเร็จ <span className="font-mono font-bold text-danger">{count.failed}</span></span>}
              {typoRows > 0 && <span>อาจพิมพ์ผิด <span className="font-mono font-bold text-amber-300">{typoRows}</span></span>}
              {(batch.notes.normalized || 0) > 0 && <span title="นิคหิต+สระอา → สระอำ, ช่องว่างซ้ำ, อักขระล่องหน">ปรับรูปแบบให้แล้ว <span className="font-mono text-white/80">{batch.notes.normalized}</span> จุด</span>}
              {attention.length > 0 && <PillButton variant="glass" onClick={() => setEditing({ batchId: batch.id, rowNo: attention[0].rowNo })} className="h-9 px-4 text-xs"><Pencil size={13} /> แก้แถวที่ต้องดู ({attention.length})</PillButton>}
              {typoFixable > 0 && <PillButton variant="warning" onClick={() => applyAllFixes(batch)} disabled={busy} className="h-9 px-4 text-xs"><SpellCheck size={13} /> แก้คำผิดตามคำแนะนำ ({typoFixable} แถว)</PillButton>}
              {typoRows > 0 && <PillButton variant="ghost" onClick={() => dismissFixes(batch, batch.rows.filter((r) => r.status !== "done").flatMap((r) => (r.fixes || []).map((fix) => ({ rowNo: r.rowNo, fix }))))} disabled={busy} className="h-9 px-4 text-xs" title="คงค่าตามไฟล์ ไม่ต้องแก้"><CheckCheck size={13} /> ปล่อยผ่านคำเตือนทั้งหมด</PillButton>}
              {count.invalid > 0 && <PillButton variant="ghost" onClick={() => setSkipped(batch, batch.rows.filter((r) => r.status === "invalid").map((r) => r.rowNo), true)} disabled={busy} className="h-9 px-4 text-xs" title="ไม่นำเข้าแถวที่ไม่ผ่าน (คืนได้ทีละแถว)"><X size={13} /> ข้ามแถวที่ไม่ผ่าน ({count.invalid})</PillButton>}
              {!isOpening(batch.entity) && batch.rows.some((r) => r.status === "done" && r.createdId) && <PillButton variant="danger" onClick={() => removeImported(batch, batch.rows)} disabled={busy} className="h-9 px-4 text-xs" title="ลบรายการที่ชุดนี้สร้างใหม่ (ที่ยังไม่ถูกใช้ในเอกสาร)"><Undo2 size={13} /> ยกเลิกการนำเข้าชุดนี้</PillButton>}
              {tb && (
                <>
                  <span>เดบิต <span className="font-mono font-bold text-white">{money(tb.debit)}</span></span>
                  <span>เครดิต <span className="font-mono font-bold text-white">{money(tb.credit)}</span></span>
                  {!tb.balanced && <span className="font-bold text-danger">ไม่สมดุล ต่างกัน {money(Math.abs(tb.debit - tb.credit))}</span>}
                </>
              )}
              <PillButton variant="glass" onClick={() => runImport(batch)} disabled={busy || pending === 0 || blockedOf(batch)} className="h-9 px-5 text-xs ml-auto">
                {pending === 0 && count.done > 0 ? "ชุดนี้นำเข้าเสร็จแล้ว" : batch.entity === "tb" ? `สร้างใบสำคัญยกมา (${pending} บัญชี)` : `นำเข้าเฉพาะชุดนี้ ${pending} รายการ`}
              </PillButton>
            </div>
          )}

          {batch && batch.rows.length > 0 && (
            <GlassCard accentColor="teal" className="p-2">
              <NexusTable headers={["ลำดับ", ...(isOpening(batch.entity) ? [] : ["การทำงาน"]), ...previewCols.map((c) => c.header), "สถานะ", "หมายเหตุ", ""]}>
                {batch.rows.map((r) => (
                  <NexusTableRow key={r.rowNo}>
                    <NexusTableCell className="font-mono text-white/50">{r.rowNo}</NexusTableCell>
                    {!isOpening(batch.entity) && <NexusTableCell className={cn("text-[12px] font-bold", r.values._adopt ? "text-nexus-teal" : r.values._id ? "text-warning" : "text-white/60")}>{r.values._adopt ? "นำกลับมาใช้" : r.values._id ? "แก้ไข" : "เพิ่มใหม่"}</NexusTableCell>}
                    {previewCols.map((c) => (
                      <NexusTableCell key={c.key} className={cn(c.type === "number" || c.type === "int" ? "font-mono" : "", "text-white/80")}>
                        {r.values[c.key] === undefined ? "-" : c.type === "number" ? money(r.values[c.key]) : typeof r.values[c.key] === "number" ? r.values[c.key].toLocaleString("th-TH") : String(r.values[c.key])}
                      </NexusTableCell>
                    ))}
                    <NexusTableCell><span className={cn("text-[12px] font-bold", isReview(r) ? "text-amber-300" : STATUS[r.status][1])}>{isReview(r) ? "ตรวจสอบ" : STATUS[r.status][0]}</span></NexusTableCell>
                    <NexusTableCell className="text-[12px]" title={[...r.errors, r.message, ...(r.fixes || []).map((x) => x.message)].filter(Boolean).join(" · ")}>
                      {r.status === "removed"
                        ? <span className="text-white/60">{r.message}</span>
                        : [...r.errors, r.message].filter(Boolean).length > 0
                        ? <span className="text-danger">{[...r.errors, r.message].filter(Boolean).join(" · ")}</span>
                        : r.fixes?.length && !["done", "skipped", "removed"].includes(r.status)
                          ? <span className="text-amber-300 flex items-center gap-1">{r.fixes.some(isDupWarning) ? <AlertTriangle size={12} className="shrink-0" /> : <SpellCheck size={12} className="shrink-0" />} {r.fixes.map((x) => x.message).join(" · ")}</span>
                          : <span className="text-white/60">{r.status === "done" && r.message ? r.message : "-"}</span>}
                    </NexusTableCell>
                    <NexusTableCell className="text-right">
                      <span className="inline-flex items-center gap-1 justify-end">
                        {["ready", "invalid", "failed"].includes(r.status) && (
                          <PillButton variant={needsAttention(r) ? "glass" : "ghost"} onClick={() => setEditing({ batchId: batch.id, rowNo: r.rowNo })} disabled={busy} className="h-8 px-3 text-xs normal-case tracking-normal"><Pencil size={12} /> แก้ไข</PillButton>
                        )}
                        {r.status === "ready" && !!r.fixes?.length && (
                          <PillButton variant="ghost" onClick={() => dismissFixes(batch, r.fixes!.map((fix) => ({ rowNo: r.rowNo, fix })))} disabled={busy} className="h-8 px-3 text-xs normal-case tracking-normal" title="คงค่าตามไฟล์"><CheckCheck size={12} /> ปล่อยผ่าน</PillButton>
                        )}
                        {["ready", "invalid", "failed", "skipped"].includes(r.status) && (
                          <PillButton variant="ghost" onClick={() => toggleSkip(batch, r)} disabled={busy} className="h-8 px-3 text-xs normal-case tracking-normal" title={r.status === "skipped" ? "นำแถวนี้กลับมานำเข้า" : "ไม่นำเข้าแถวนี้"}>
                            {r.status === "skipped" ? <><RotateCcw size={12} /> คืนแถว</> : <><Trash2 size={12} /> ลบแถว</>}
                          </PillButton>
                        )}
                        {r.status === "done" && r.createdId && !isOpening(batch.entity) && (
                          <PillButton variant="ghost" onClick={() => removeImported(batch, [r])} disabled={busy} className="h-8 px-3 text-xs normal-case tracking-normal text-danger" title="ลบรายการที่นำเข้า (ถ้ายังไม่ถูกใช้ในเอกสาร)"><Trash2 size={12} /> ลบที่นำเข้า</PillButton>
                        )}
                      </span>
                    </NexusTableCell>
                  </NexusTableRow>
                ))}
              </NexusTable>
            </GlassCard>
          )}

          {/* ข้อมูลที่นำเข้าแล้ว (จากฐานข้อมูล — จัดการได้แม้ปิดหน้า/โหลดใหม่) · เปิดเมื่อกดเท่านั้น จะได้ไม่อ่านข้อมูลโดยไม่จำเป็น */}
          <GlassCard accentColor="blue" className="p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[240px]">
                <h3 className="text-[14px] font-semibold text-white leading-normal">ข้อมูลที่นำเข้าแล้ว</h3>
                <p className="text-[12px] text-white/55 leading-normal">เลือกรายการที่นำเข้าจาก Excel เพื่อลบ ระงับใช้งาน หรือเปิดแก้ไข — ลบได้เมื่อยังไม่ถูกใช้ในเอกสาร</p>
              </div>
              <PillButton variant="glass" onClick={() => setShowImported((v) => !v)} className="h-9 px-4 text-xs">{showImported ? "ซ่อน" : "จัดการข้อมูลที่นำเข้าแล้ว"}</PillButton>
            </div>
            {showImported && <ImportedRecordsManager />}
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

/** โหลดลูกค้า/ผู้ขายในระบบ (เฉพาะเมื่อมีชุดข้อมูลชนิดนั้น) แล้วให้หน้าตรวจซ้ำใหม่ */
function CustomersLoader({ onLoad }: { onLoad: (entity: TabId) => void }) {
  const { data, loading } = useCustomers<any>({ includeGroupOnly: true });
  useEffect(() => { if (!loading) { EXISTING.customers = data || []; onLoad("customers"); } }, [data, loading, onLoad]);
  return null;
}
function SuppliersLoader({ onLoad }: { onLoad: (entity: TabId) => void }) {
  const { data, loading } = useSuppliers<any>({ includeGroupOnly: true });
  useEffect(() => { if (!loading) { EXISTING.suppliers = data || []; onLoad("suppliers"); } }, [data, loading, onLoad]);
  return null;
}
