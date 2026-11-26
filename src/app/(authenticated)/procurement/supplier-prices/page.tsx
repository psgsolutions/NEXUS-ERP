"use client";

/**
 * นำเข้าราคาผู้ขาย (Supplier Matrix) จาก Excel — 1 แถว = ผู้ขาย × สินค้า (SKU) × ราคา ณ วันที่
 *  - จับคู่ผู้ขายจากชื่อ (ไม่ตรง = เลือกเองครั้งเดียวต่อชื่อ) · สินค้าจาก SKU
 *  - ราคา List (ก่อนส่วนลด) เก็บแยกจากราคาที่ได้จริง (ใบเสนอราคา/ไฟล์ต้นทุน) — ราคา List ไม่ใช่ต้นทุน
 *  - นำเข้าซ้ำได้ (ราคาที่ใหม่กว่าไม่ถูกทับ) · ส่งทีละ 300 แถว
 */

import React, { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { GlassCard, NexusTable, NexusTableCell, NexusTableRow, PillBackButton, PillButton, PillSelect, cn } from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { useSystemDialog } from "@/context/DialogContext";
import { useProducts } from "@/hooks/useProducts";
import { useSuppliers } from "@/hooks/useCustomers";
import { apiFetch } from "@/lib/api-client";
import { can } from "@/lib/permissions";
import { matchSupplierId, parseSupplierPriceSheet, type SupplierPriceRow } from "@/lib/supplier-prices";

type Status = "ready" | "noSupplier" | "noProduct" | "invalid";
const STATUS: Record<Status, [string, string]> = {
  ready: ["พร้อม", "text-nexus-teal"], noSupplier: ["ไม่พบผู้ขาย", "text-warning"], noProduct: ["ไม่พบ SKU", "text-warning"], invalid: ["ข้อมูลไม่ครบ", "text-danger"],
};
const money = (n: number) => Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const normSku = (v: unknown) => String(v ?? "").trim().toUpperCase();

export default function SupplierPricesImportPage() {
  const router = useRouter();
  const { companyId, roles } = useAuth();
  const { showAlert, showConfirm } = useSystemDialog();
  const canEdit = can(roles, "procurement:edit") || can(roles, "inventory:edit");
  const { data: products = [] } = useProducts<any>();
  const { data: suppliers = [] } = useSuppliers<any>();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<SupplierPriceRow[]>([]);
  const [missing, setMissing] = useState<string[]>([]);
  const [map, setMap] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"all" | "attention" | Status>("attention");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<{ applied: number; products: number; skipped: number } | null>(null);

  const bySku = useMemo(() => new Map(products.filter((p: any) => !p.isDeleted && p.sku).map((p: any) => [normSku(p.sku), p])), [products]);
  const supplierOf = (name: string) => map[name] ?? matchSupplierId(name, suppliers);
  const view = useMemo(() => rows.map((r) => {
    const supplierId = r.supplierName ? supplierOf(r.supplierName) : "";
    const product = bySku.get(normSku(r.sku));
    const status: Status = r.errors.length ? "invalid" : !supplierId ? "noSupplier" : !product ? "noProduct" : "ready";
    return { ...r, supplierId, product, status };
  }), [rows, map, suppliers, bySku]); // eslint-disable-line react-hooks/exhaustive-deps
  const count = (s: Status) => view.filter((v) => v.status === s).length;
  const unmatchedNames = useMemo(() => Array.from(new Set(rows.filter((r) => r.supplierName && !matchSupplierId(r.supplierName, suppliers)).map((r) => r.supplierName))), [rows, suppliers]);
  const shown = view.filter((v) => filter === "all" || (filter === "attention" ? v.status !== "ready" : v.status === filter)).slice(0, 300);

  const pick = async (f?: File) => {
    if (!f) return;
    setResult(null); setMap({});
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await f.arrayBuffer());
      // ชีตที่มีหัวตาราง "ผู้ขาย" + "SKU" ก่อน ไม่พบใช้ชีตแรก
      const sheets = wb.SheetNames.map((n) => XLSX.utils.sheet_to_json<any[]>(wb.Sheets[n], { header: 1, defval: "" }));
      const aoa = sheets.find((s) => parseSupplierPriceSheet(s.slice(0, 1)).missing.length === 0) || sheets[0] || [];
      const p = parseSupplierPriceSheet(aoa);
      setFileName(f.name); setRows(p.rows); setMissing(p.missing);
      setFilter("attention");
    } catch (e: any) { showAlert(e.message || "อ่านไฟล์ไม่ได้", "อ่านไฟล์ไม่สำเร็จ", "error"); }
    if (fileRef.current) fileRef.current.value = "";
  };

  const run = async () => {
    const ready = view.filter((v) => v.status === "ready");
    if (!ready.length) return;
    const list = ready.filter((v) => v.kind === "LIST").length;
    if (!(await showConfirm(`นำเข้าราคาผู้ขาย ${ready.length.toLocaleString("th-TH")} แถว (สินค้า ${new Set(ready.map((v) => v.product.id)).size.toLocaleString("th-TH")} รายการ)\n· ราคา List ${list} แถว (เก็บแยก ไม่ใช่ต้นทุน)\n· ราคาเสนอ/ต้นทุนงาน ${ready.length - list} แถว\nแถวที่ยังต้องแก้ ${view.length - ready.length} แถว จะไม่ถูกนำเข้า`, "ยืนยันนำเข้าราคาผู้ขาย"))) return;
    setBusy(true);
    let applied = 0, skipped = 0;
    const prods = new Set<string>();
    try {
      for (let i = 0; i < ready.length; i += 300) {
        setProgress(`กำลังบันทึก ${Math.min(i + 300, ready.length).toLocaleString("th-TH")} / ${ready.length.toLocaleString("th-TH")}`);
        const chunk = ready.slice(i, i + 300).map((v) => ({ productId: v.product.id, supplierId: v.supplierId, supplierSku: v.supplierSku, kind: v.kind, price: v.price, priceDate: v.priceDate, ref: v.ref, note: v.note, project: v.project }));
        // ชื่อที่จับคู่เอง ส่งไปกับชุดแรก → ครั้งหน้าระบบจับคู่ให้เอง
        const aliases = i === 0 ? Object.entries(map).filter(([, sid]) => sid).map(([name, supplierId]) => ({ name, supplierId })) : [];
        const r = await apiFetch("/api/procurement/supplier-prices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "apply", items: chunk, aliases }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d.success) throw new Error(`${d.error || "บันทึกไม่สำเร็จ"} (บันทึกแล้ว ${applied} แถว)`);
        applied += d.applied; skipped += d.skipped.length; chunk.forEach((c) => prods.add(c.productId));
      }
      setResult({ applied, products: prods.size, skipped });
    } catch (e: any) { showAlert(e.message, "นำเข้าไม่สำเร็จ", "error"); } finally { setBusy(false); setProgress(""); }
  };

  if (!canEdit) return <div className="p-6 text-white/60 text-sm">ต้องมีสิทธิ์แก้ไขจัดซื้อหรือคลังสินค้า</div>;
  return (
    <div className="p-4 xl:p-6 space-y-4" data-supplier-prices>
      <div className="flex flex-wrap items-center gap-3">
        <PillBackButton onClick={() => router.back()} />
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-white leading-none">นำเข้าราคาผู้ขาย</h1>
          <p className="text-xs text-white/55 mt-1">ตารางราคาซื้อแยกผู้ขาย (1 แถว = ผู้ขาย × SKU × ราคา) · ราคา List เก็บแยกจากราคาที่ได้จริง · นำเข้าซ้ำได้ ราคาที่ใหม่กว่าไม่ถูกทับ</p>
        </div>
        <span className="flex-1" />
        <PillButton variant="confirm" className="h-9 px-4 text-xs font-bold" onClick={() => fileRef.current?.click()} disabled={busy} data-sp-pick><FileSpreadsheet size={13} /> เลือกไฟล์ Excel</PillButton>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => pick(e.target.files?.[0])} data-sp-file />
      </div>

      {!rows.length && !missing.length && (
        <GlassCard className="p-4 text-[12px] text-white/60 space-y-1">
          <p>หัวตารางที่อ่าน: <b className="text-white/80">ผู้ขาย (ชื่อใน NEXUS)</b> · <b className="text-white/80">รหัสสินค้า NEXUS (SKU)</b> · <b className="text-white/80">ต้นทุน/หน่วย (ก่อน VAT)</b> (จำเป็น) · รหัสสินค้าของผู้ขาย · ประเภทราคา · วันที่ราคา · งาน/โครงการ · ไฟล์/หน้าอ้างอิง · หมายเหตุ</p>
          <p>ประเภทราคามีคำว่า &quot;List&quot; หรือ &quot;ก่อนส่วนลด&quot; = ราคา List (ไม่ใช่ต้นทุน) · อื่น ๆ = ราคาที่ได้จริง ใช้เป็นต้นทุนล่าสุดเมื่อยังไม่เคยรับสินค้าจากผู้ขายรายนั้น</p>
          <p>นำเข้าสินค้าและผู้ขายในระบบก่อน แล้วจึงนำเข้าราคา</p>
        </GlassCard>
      )}
      {missing.length > 0 && <p className="text-[12px] text-danger">ไฟล์ {fileName} ไม่มีหัวตาราง: {missing.join(", ")}</p>}

      {rows.length > 0 && (
        <>
          <GlassCard className="p-4 space-y-3" data-sp-summary>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-white/70">
              <span className="font-bold text-white">{fileName}</span>
              <span>ทั้งหมด <b className="font-mono text-white">{rows.length.toLocaleString("th-TH")}</b> แถว</span>
              {(Object.keys(STATUS) as Status[]).map((s) => <span key={s} className={STATUS[s][1]}>{STATUS[s][0]} <b className="font-mono">{count(s).toLocaleString("th-TH")}</b></span>)}
              <span className="flex-1" />
              {progress && <span className="text-nexus-teal flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> {progress}</span>}
              <PillButton variant="confirm" className="h-9 px-5 text-xs font-bold" onClick={run} disabled={busy || !count("ready")} data-sp-run><Upload size={13} /> นำเข้า {count("ready").toLocaleString("th-TH")} แถวที่พร้อม</PillButton>
            </div>
            {result && <p className="text-[12px] text-nexus-teal flex items-center gap-1" data-sp-result><CheckCircle2 size={13} /> บันทึกราคาแล้ว {result.applied.toLocaleString("th-TH")} แถว · สินค้า {result.products.toLocaleString("th-TH")} รายการ{result.skipped ? ` · ข้าม ${result.skipped} แถว (สินค้า/ผู้ขายไม่อยู่ในบริษัท)` : ""}</p>}
            {unmatchedNames.length > 0 && (
              <div className="space-y-2 rounded-xl border border-warning/30 bg-warning/5 p-3" data-sp-map>
                <p className="text-[12px] text-warning">ชื่อผู้ขายในไฟล์ที่ไม่ตรงกับในระบบ — เลือกผู้ขายที่ใช่ (ครั้งเดียวต่อชื่อ ระบบจำไว้ ครั้งหน้าจับคู่ให้เอง) หรือเพิ่มผู้ขายในระบบก่อน</p>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                  {unmatchedNames.map((n) => (
                    <label key={n} className="flex items-center gap-2 text-[12px] text-white/80">
                      <span className="w-[130px] truncate shrink-0" title={n}>{n} <span className="text-white/40">({rows.filter((r) => r.supplierName === n).length})</span></span>
                      <PillSelect value={map[n] || ""} onChange={(e) => setMap((m) => ({ ...m, [n]: e.target.value }))} className="h-8 w-full text-[12px]" aria-label={`ผู้ขายของ ${n}`}>
                        <option value="">— ยังไม่เลือก (ไม่นำเข้า) —</option>
                        {suppliers.filter((s: any) => !s.isDeleted).map((s: any) => <option key={s.id} value={s.id}>{s.name || s.supplierName}</option>)}
                      </PillSelect>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </GlassCard>

          <GlassCard className="p-4 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-[220px]">
                <PillSelect value={filter} onChange={(e) => setFilter(e.target.value as any)} className="h-8 w-full text-[12px]" aria-label="แสดงแถว">
                  <option value="attention">แถวที่ต้องแก้ ({(view.length - count("ready")).toLocaleString("th-TH")})</option>
                  <option value="all">ทั้งหมด</option>
                  {(Object.keys(STATUS) as Status[]).map((s) => <option key={s} value={s}>{STATUS[s][0]} ({count(s)})</option>)}
                </PillSelect>
              </div>
              <span className="text-[12px] text-white/45">แสดงสูงสุด 300 แถว · แก้ในไฟล์แล้วเลือกไฟล์ใหม่ได้</span>
            </div>
            <NexusTable headers={["แถว", "ผู้ขาย", "SKU", "สินค้าในระบบ", "ชนิดราคา", "ราคา/หน่วย", "วันที่ราคา", "สถานะ"]}>
              {shown.map((v) => (
                <NexusTableRow key={v.rowNo}>
                  <NexusTableCell mono>{v.rowNo}</NexusTableCell>
                  <NexusTableCell title={v.supplierName}>{v.supplierName || "-"}</NexusTableCell>
                  <NexusTableCell mono>{v.sku || "-"}</NexusTableCell>
                  <NexusTableCell title={v.product?.name || v.name}><span className={cn(!v.product && "text-white/40")}>{v.product?.name || v.name || "-"}</span></NexusTableCell>
                  <NexusTableCell><span className={v.kind === "LIST" ? "text-white/60" : "text-nexus-teal"}>{v.kind === "LIST" ? "ราคา List" : "ราคาที่ได้จริง"}</span></NexusTableCell>
                  <NexusTableCell align="right" mono>{money(v.price)}</NexusTableCell>
                  <NexusTableCell mono>{v.priceDate || "-"}</NexusTableCell>
                  <NexusTableCell title={v.errors.join(" · ")}><span className={cn("text-[12px] font-bold", STATUS[v.status][1])}>{STATUS[v.status][0]}{v.errors.length ? `: ${v.errors.join(", ")}` : ""}</span></NexusTableCell>
                </NexusTableRow>
              ))}
            </NexusTable>
          </GlassCard>
        </>
      )}
    </div>
  );
}
