"use client";

import React, { useMemo, useRef, useState } from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { GlassCard, NexusTable, NexusTableCell, NexusTableRow, PillButton, PillCheckbox, PillTabs, cn } from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api-client";
import { can } from "@/lib/permissions";
import { IMPORT_TEMPLATES, mapHeaders, parseRows, toCreateRequest, type ImportEntity, type ParsedRow } from "@/lib/import/templates";

/**
 * นำเข้าข้อมูลหลักจาก Excel (ลูกค้า ผู้ขาย สินค้า+ยอดยกมา) สำหรับเริ่มใช้ระบบ
 * อ่านไฟล์ในเบราว์เซอร์ ตรวจทุกแถวก่อน แล้วส่งทีละแถวผ่าน /api/master-data (ตรวจซ้ำในระบบ/สิทธิ์ที่ server)
 */

type RowState = ParsedRow & { status: "ready" | "invalid" | "saving" | "done" | "failed"; message?: string };

const PREVIEW: Record<ImportEntity, string[]> = {
  customers: ["name", "taxId", "phone", "creditTermDays"],
  suppliers: ["name", "taxId", "phone", "creditTermDays"],
  products: ["sku", "name", "unit", "price", "openingQty"],
};
const STATUS: Record<RowState["status"], [string, string]> = {
  ready: ["พร้อม", "text-nexus-teal"], invalid: ["ไม่ผ่าน", "text-danger"], saving: ["กำลังบันทึก", "text-nexus-blue"],
  done: ["นำเข้าแล้ว", "text-nexus-teal"], failed: ["ไม่สำเร็จ", "text-danger"],
};

const loadXlsx = () => import("xlsx");

export default function DataImportPage() {
  const { companyId, roles } = useAuth();
  const allowed = (Object.keys(IMPORT_TEMPLATES) as ImportEntity[]).filter((e) => can(roles, IMPORT_TEMPLATES[e].permission));
  const [entity, setEntity] = useState<ImportEntity>(allowed[0] || "customers");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<RowState[]>([]);
  const [notes, setNotes] = useState<{ missing: string[]; unknown: string[] }>({ missing: [], unknown: [] });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [postJournal, setPostJournal] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const template = IMPORT_TEMPLATES[entity];

  const reset = () => { setRows([]); setFileName(""); setNotes({ missing: [], unknown: [] }); setError(""); };
  const switchEntity = (id: string) => { if (busy) return; setEntity(id as ImportEntity); reset(); };

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

  const createOne = async (ent: string, body: Record<string, any>) => {
    const res = await apiFetch("/api/master-data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "create", entity: ent, ...body }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || !d.success) throw new Error(d.error || `บันทึกไม่สำเร็จ (${res.status})`);
    return d.id as string;
  };

  const runImport = async () => {
    if (!companyId || busy) return;
    setBusy(true);
    setError("");
    const update = (rowNo: number, patch: Partial<RowState>) => setRows((cur) => cur.map((r) => (r.rowNo === rowNo ? { ...r, ...patch } : r)));
    for (const row of rows.filter((r) => r.status === "ready" || r.status === "failed")) {
      update(row.rowNo, { status: "saving", message: "" });
      try {
        const req = toCreateRequest(entity, row.values, { postOpeningJournal: postJournal });
        if (entity === "products") {
          await createOne("products", { id: `PROD-${Date.now()}-${row.rowNo}`, ...req });
        } else if (entity === "suppliers") {
          // ผู้ขายและผู้รับเหมาใช้รหัสเดียวกัน (เหมือนฟอร์มเพิ่มผู้ขาย)
          const id = await createOne("suppliers", req);
          await createOne("contractors", { id, ...req }).catch((err) => { throw new Error(`สร้างผู้ขายแล้ว (${id}) แต่สร้างผู้รับเหมาไม่สำเร็จ: ${err.message}`); });
        } else {
          await createOne("customers", req);
        }
        update(row.rowNo, { status: "done" });
      } catch (err: any) {
        update(row.rowNo, { status: "failed", message: err.message });
      }
    }
    setBusy(false);
  };

  const count = useMemo(() => {
    const c = { ready: 0, invalid: 0, saving: 0, done: 0, failed: 0 };
    rows.forEach((r) => c[r.status]++);
    return c;
  }, [rows]);
  const previewCols = PREVIEW[entity].map((k) => template.columns.find((c) => c.key === k)!);
  const hasOpening = entity === "products" && rows.some((r) => r.values.openingQty > 0);
  const pending = count.ready + count.failed;

  if (!allowed.length) {
    return <div className="p-10 text-white/60">ไม่มีสิทธิ์นำเข้าข้อมูล (ต้องมีสิทธิ์แก้ไขลูกค้า ผู้ขาย หรือสินค้า)</div>;
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent">
      <header className="px-6 py-2.5 min-h-[60px] border-b border-white/5 flex items-center gap-3 bg-black/20 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/10"><FileSpreadsheet size={20} /></div>
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight leading-none">นำเข้าข้อมูลจาก Excel</h1>
          <p className="text-xs font-semibold text-white/60 mt-1 leading-none">ย้ายรายชื่อลูกค้า ผู้ขาย และสินค้าพร้อมยอดยกมาจากระบบเดิม</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-5 max-w-[1800px] mx-auto space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <PillTabs className="flex-1 min-w-[240px]" tabs={allowed.map((e) => ({ id: e, label: IMPORT_TEMPLATES[e].label }))} activeTab={entity} onTabChange={switchEntity} />
            <div className="flex items-center gap-2">
              <PillButton variant="glass" onClick={downloadTemplate} className="h-9 px-4 text-xs"><Download size={14} className="mr-1.5" /> ดาวน์โหลดแม่แบบ</PillButton>
              <PillButton variant="glass" onClick={() => fileRef.current?.click()} disabled={busy} className="h-9 px-4 text-xs"><Upload size={14} className="mr-1.5" /> เลือกไฟล์ Excel</PillButton>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) readFile(f); }} />
            </div>
          </div>

          <p className="text-[13px] text-white/50 px-1 leading-relaxed">
            1. ดาวน์โหลดแม่แบบ{template.label} แล้วกรอกในชีต &quot;ข้อมูล&quot; (คัดลอกคอลัมน์จากไฟล์เดิมมาวางได้) · 2. เลือกไฟล์ ระบบตรวจทุกแถวก่อน · 3. กดนำเข้า — แถวที่ซ้ำกับข้อมูลในระบบจะถูกข้ามและแจ้งเหตุผล
          </p>

          {error && <div className="p-3 rounded-xl text-xs font-bold border bg-danger/10 border-danger/20 text-danger">{error}</div>}
          {notes.missing.length > 0 && <div className="p-3 rounded-xl text-xs font-bold border bg-danger/10 border-danger/20 text-danger">ไฟล์ไม่มีคอลัมน์ที่ต้องกรอก: {notes.missing.join(", ")} — ใช้หัวตารางตามแม่แบบ</div>}
          {notes.unknown.length > 0 && <p className="text-[12px] text-white/40 px-1">ข้ามคอลัมน์ที่ไม่รู้จัก: {notes.unknown.join(", ")}</p>}

          {rows.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-white/60 px-1">
              <span className="text-white/80">{fileName}</span>
              <span>ทั้งหมด <span className="font-mono font-bold text-white">{rows.length}</span></span>
              <span>พร้อมนำเข้า <span className="font-mono font-bold text-nexus-teal">{count.ready}</span></span>
              {count.invalid > 0 && <span>ไม่ผ่าน <span className="font-mono font-bold text-danger">{count.invalid}</span></span>}
              {count.done > 0 && <span>นำเข้าแล้ว <span className="font-mono font-bold text-nexus-teal">{count.done}</span></span>}
              {count.failed > 0 && <span>ไม่สำเร็จ <span className="font-mono font-bold text-danger">{count.failed}</span></span>}
              {hasOpening && (
                <span className="flex items-center gap-2" title="ไม่ต้องเลือก ถ้ายอดสินค้าคงเหลือรวมอยู่ในงบทดลองยกมาแล้ว (จะได้ไม่บันทึกซ้ำ)">
                  <PillCheckbox label="ลงบัญชียอดยกมาสินค้า" checked={postJournal} onChange={(e) => setPostJournal(e.target.checked)} disabled={busy} />
                  <span className="text-[12px] text-white/40">ไม่ต้องเลือกถ้ารวมในงบทดลองยกมาแล้ว</span>
                </span>
              )}
              <PillButton variant="primary" onClick={runImport} disabled={busy || pending === 0} className="h-9 px-5 text-xs ml-auto">
                {busy ? `กำลังนำเข้า ${count.done + count.failed}/${count.done + count.failed + count.ready + count.saving}` : pending === 0 && count.done > 0 ? "นำเข้าเสร็จแล้ว" : `นำเข้า ${pending} รายการ`}
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
                        {r.values[c.key] === undefined ? "-" : typeof r.values[c.key] === "number" ? r.values[c.key].toLocaleString("th-TH") : String(r.values[c.key])}
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
