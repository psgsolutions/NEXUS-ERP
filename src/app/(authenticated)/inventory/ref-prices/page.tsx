"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, FileSpreadsheet, Loader2, Plus, RefreshCw, Save, Search, Wrench } from "lucide-react";
import { GlassCard, NexusTable, NexusTableCell, NexusTableRow, PillBackButton, PillButton, PillInput, PillSelect, cn } from "@/components/ui/Base";
import { NumCell } from "@/components/projects/ProjectPlanEditors";
import { useAuth } from "@/context/AuthContext";
import { useSystemDialog } from "@/context/DialogContext";
import { useProducts } from "@/hooks/useProducts";
import { apiFetch } from "@/lib/api-client";
import { can, canViewCost } from "@/lib/permissions";
import { LAN_VARIANTS, REF_STATUS_TH, isServiceCategory, parseRefRows, sameUnit, type MatchCandidate, type RefPriceRow, type RefStatus } from "@/lib/ref-prices";
import { BOM_SETTING_FIELDS, LAN_CODES, bomToRecipe, defaultInputs, expandBom, lanBomSpec, normalizeBomSettings, resolveCode, type BomSettings } from "@/lib/bom";
import { useBom } from "@/hooks/useBom";

const money = (n: number) => Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const TONE: Record<RefStatus, string> = { "": "text-white", WEB: "text-nexus-blue", Y: "text-danger" };
const unitOf = (u: string) => (/^ม\.?$/.test(u.trim()) ? "เมตร" : u.trim());

type Decision = { kind: "link" | "create" | "skip"; productId?: string; per: number; search?: string };

/**
 * ราคากลาง (BOM): ราคาอ้างอิงที่ใช้คิดต้นทุนงานบริการ/ใบเสนอราคาแบบ BOM
 *  - นำเข้าจาก Excel (ชีต "ราคากลาง") → ระบบเสนอสินค้าเดิมที่น่าจะตรง → คนตรวจ/เลือก/สร้างใหม่ → บันทึก
 *  - สีสถานะ: ดำ = ไฟล์บริษัท · น้ำเงิน = ราคาเว็บ · แดง = ประมาณการ ต้องยืนยัน
 */
export default function RefPricesPage() {
  const router = useRouter();
  const { companyId, roles } = useAuth();
  const { showAlert, showConfirm } = useSystemDialog();
  const canEdit = can(roles, "inventory:edit");
  const seeCost = canViewCost(roles) || canEdit;
  const { data: products = [] } = useProducts<any>();
  const bom = useBom();
  const byId = useMemo(() => new Map(products.map((p: any) => [p.id, p])), [products]);
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState("");
  const [rows, setRows] = useState<RefPriceRow[] | null>(null);
  const [cands, setCands] = useState<Record<string, MatchCandidate[]>>({});
  const [dec, setDec] = useState<Record<string, Decision>>({});
  const [filter, setFilter] = useState<"all" | "check" | "create" | "skip">("all");
  const [progress, setProgress] = useState("");
  const [q, setQ] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const post = useCallback(async (body: any) => {
    const res = await apiFetch("/api/inventory/ref-prices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, ...body }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || !d.success) throw new Error(d.error || "ไม่สำเร็จ");
    return d;
  }, [companyId]);
  // โหลดไม่สำเร็จ = แถบแจ้งในหน้า + ปุ่มลองใหม่ (ไม่เด้ง popup ซ้ำ ๆ และไม่โหลดซ้ำเอง)
  const [loadErr, setLoadErr] = useState("");
  const load = useCallback(async () => {
    if (!companyId || !seeCost) return;
    setBusy("load"); setLoadErr("");
    try { setItems((await post({ action: "list" })).items || []); } catch (e: any) { setLoadErr(e.message || "โหลดราคากลางไม่สำเร็จ"); } finally { setBusy(""); }
  }, [companyId, seeCost, post]);
  useEffect(() => { load(); }, [load]);

  // ---------- นำเข้า ----------
  const pick = async (f?: File) => {
    if (!f) return;
    setBusy("read");
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await f.arrayBuffer());
      const name = wb.SheetNames.find((n) => /ราคากลาง/.test(n)) || wb.SheetNames[0];
      const parsed = parseRefRows(XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "" }) as unknown[][]);
      if (!parsed.length) throw new Error(`ไม่พบรายการในชีต "${name}" (ต้องมีหัวตาราง รหัส · รายการ · หน่วย · ต้นทุน/หน่วย)`);
      const d = await post({ action: "match", rows: parsed });
      const cm: Record<string, MatchCandidate[]> = {}, dm: Record<string, Decision> = {};
      for (const r of d.result) cm[r.code] = r.candidates;
      for (const r of parsed) {
        const top = cm[r.code]?.[0];
        const guessPer = (p?: any) => (p && !sameUnit(r.unit, p.unit) && /สาย|cable/i.test(r.name) && /กล่อง|ม้วน/.test(p.unit) ? 305 : 1);
        dm[r.code] = top && top.score >= 0.6 ? { kind: "link", productId: top.productId, per: guessPer(top) } : { kind: "create", per: 1 };
      }
      setRows(parsed); setCands(cm); setDec(dm); setFilter("all");
    } catch (e: any) { showAlert(e.message, "อ่านไฟล์ไม่สำเร็จ", "error"); } finally { setBusy(""); if (fileRef.current) fileRef.current.value = ""; }
  };
  const setD = (code: string, patch: Partial<Decision>) => setDec((x) => ({ ...x, [code]: { ...x[code], ...patch } }));
  const status = (r: RefPriceRow) => {
    const d = dec[r.code];
    if (!d || d.kind === "skip") return "skip";
    if (d.kind === "create") return "create";
    return cands[r.code]?.[0]?.score === 1 && cands[r.code][0].productId === d.productId ? "ok" : "check";
  };
  const counts = useMemo(() => {
    const c = { all: rows?.length || 0, check: 0, create: 0, skip: 0, ok: 0 };
    (rows || []).forEach((r) => { (c as any)[status(r)]++; });
    return c;
  }, [rows, dec, cands]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = (rows || []).filter((r) => filter === "all" || status(r) === filter);
  const unitMismatch = (r: RefPriceRow) => { const d = dec[r.code]; const p = d?.kind === "link" && d.productId ? byId.get(d.productId) : null; return !!p && !sameUnit(r.unit, p.unit); };

  const apply = async () => {
    if (!rows) return;
    const bad = rows.filter((r) => unitMismatch(r) && !(dec[r.code].per > 0));
    if (bad.length) return void showAlert(`กรุณาระบุจำนวนหน่วยต่อ 1 หน่วยสินค้า: ${bad.slice(0, 3).map((r) => r.code).join(", ")}`);
    if (!(await showConfirm(`บันทึกราคากลาง ${rows.length - counts.skip} รายการ (สร้างสินค้าใหม่ ${counts.create} รายการ)?`))) return;
    setBusy("apply");
    try {
      const out: any[] = [];
      let i = 0;
      for (const r of rows) {
        const d = dec[r.code];
        if (!d || d.kind === "skip") continue;
        let pid = d.productId || "";
        if (d.kind === "create") {
          setProgress(`สร้างสินค้าใหม่ ${++i}/${counts.create}: ${r.name}`);
          const svc = isServiceCategory(r.category);
          const res = await apiFetch("/api/master-data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
            companyId, action: "create", entity: "products", autoSku: true,
            data: { name: r.name, productName: r.name, description: r.nameEn, category: r.category || (svc ? "งานบริการ" : "general"), unit: unitOf(r.unit), baseUnit: unitOf(r.unit),
              itemType: svc ? "SERVICE" : "PRODUCT", productType: svc ? "SERVICE" : "PHYSICAL", lifecycleStatus: "ACTIVE", isActive: true, taxType: "VAT_7", vatType: "VAT_7" },
          }) });
          const c = await res.json().catch(() => ({}));
          if (!res.ok || !c.success) throw new Error(`สร้าง "${r.name}" ไม่สำเร็จ: ${c.error || ""}`);
          pid = c.id;
        }
        out.push({ row: r, productId: pid, per: d.kind === "link" && unitMismatch(r) ? d.per : 1 });
      }
      setProgress("บันทึกราคากลาง…");
      const res = await post({ action: "apply", items: out });
      setRows(null); setProgress("");
      showAlert(`บันทึกราคากลางแล้ว ${res.linked} รายการ`, "บันทึกแล้ว", "info");
      await load();
    } catch (e: any) { showAlert(e.message, "บันทึกไม่สำเร็จ", "error"); setProgress(""); } finally { setBusy(""); }
  };

  // ---------- แม่แบบไฟล์ราคากลาง ----------
  // ชีต "ราคากลาง" หัวตารางตรงกับที่ระบบอ่าน + ราคากลางที่มีอยู่ (แก้แล้วนำเข้ากลับได้ รหัสเดิมจับคู่ให้อัตโนมัติ)
  // + รหัสที่สูตรงาน LAN ใช้แต่ยังไม่มีราคา (ชื่อ/ราคาว่างให้กรอก) · ชีต "วิธีกรอก"
  const downloadTemplate = async () => {
    setBusy("template");
    try {
      const XLSX = await import("xlsx");
      const head = ["รหัส", "รายการ (ไทย)", "Description (EN)", "หมวด", "หน่วย", "ต้นทุน/หน่วย", "ที่มาของราคา", "สถานะราคา"];
      const have = items.filter((x) => !String(x.bomCode).startsWith("SVC-"));
      const rows: (string | number)[][] = have.map((x) => [x.bomCode, x.name, "", x.refCostCategory || "", x.refCostUnit || x.unit || "",
        Math.round((Number(x.refCost) / (Number(x.refCostPer) || 1)) * 100) / 100, x.refCostSource || "", x.refCostStatus || ""]);
      const missing = LAN_CODES.filter((c) => !have.some((x) => x.bomCode === c));
      rows.push(...missing.map((c) => [c, "", "", /^LAB-|^TEST$/.test(c) ? "ค่าแรง" : "", /^(UTP|FLEX-|EMT-|LAB-FLEX|LAB-EMT)/.test(c) ? "ม." : "", "", "", ""]));
      const ws = XLSX.utils.aoa_to_sheet([head, ...rows]);
      ws["!cols"] = [{ wch: 16 }, { wch: 42 }, { wch: 30 }, { wch: 14 }, { wch: 8 }, { wch: 13 }, { wch: 36 }, { wch: 11 }];
      const help = [
        ["วิธีกรอกแม่แบบราคากลาง"],
        [""],
        ["คอลัมน์", "ความหมาย"],
        ["รหัส", "รหัสในสูตร BOM (ห้ามซ้ำ) เช่น UTP-CAT6, EMT-3/4\", LAB-UTP — รหัสที่มีอยู่แล้วจะจับคู่สินค้าเดิมให้อัตโนมัติ"],
        ["รายการ (ไทย)", "ชื่อกลาง ไม่ระบุยี่ห้อ (ใช้ในใบเสนอราคา/TOR) — แถวที่ไม่มีชื่อจะถูกข้าม"],
        ["Description (EN)", "ชื่อภาษาอังกฤษ (ไม่บังคับ)"],
        ["หมวด", "เช่น สาย, ท่อ, อุปกรณ์ · หมวด ค่าแรง / ทดสอบ/ส่งมอบ / บริหารโครงการ = งานบริการ (ไม่นับสต็อก)"],
        ["หน่วย", "หน่วยของราคาในแถวนี้ เช่น ม., ตัว, เส้น, จุด — ต่างจากหน่วยสินค้า (เช่น สินค้าเป็นกล่อง) ระบบให้ระบุ 1 กล่อง = 305 ม. ตอนตรวจ"],
        ["ต้นทุน/หน่วย", "ราคาทุนต่อหน่วยในคอลัมน์หน่วย (ไม่รวม VAT)"],
        ["ที่มาของราคา", "เช่น ใบเสนอราคาผู้ขาย ก.ค. 69, เว็บไซต์…"],
        ["สถานะราคา", "ว่าง = ราคาจากบริษัท/ผู้ขาย · WEB = ราคาเว็บ · Y = ประมาณการ ต้องยืนยัน (ระบบเตือนเมื่อใช้ในใบเสนอราคา)"],
        [""],
        ["ขั้นตอน", "กรอก/แก้ในชีต ราคากลาง → หน้า คลัง › ราคากลาง กด นำเข้าจาก Excel → ตรวจการจับคู่ → บันทึก"],
        ["", `รหัสที่สูตรงาน LAN ใช้แต่ยังไม่มีราคา ${missing.length} รหัส อยู่ท้ายชีต (ชื่อ/ราคาว่าง) — กรอกให้ครบเพื่อคิดต้นทุนได้ทุกขนาดท่อ`],
      ];
      const wh = XLSX.utils.aoa_to_sheet(help);
      wh["!cols"] = [{ wch: 18 }, { wch: 110 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "ราคากลาง");
      XLSX.utils.book_append_sheet(wb, wh, "วิธีกรอก");
      XLSX.writeFile(wb, `แม่แบบราคากลาง_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e: any) { showAlert(e.message || "สร้างไฟล์ไม่สำเร็จ", "ดาวน์โหลดไม่สำเร็จ", "error"); } finally { setBusy(""); }
  };

  // ---------- งานบริการ LAN 3 รูปแบบ ----------
  const codeMap = useMemo(() => new Map(items.map((x) => [x.bomCode, x])), [items]);
  // งานบริการ LAN 3 รูปแบบ: สูตร BOM แบบมีตัวแปร (ระยะสาย/ท่อกรอกต่อบรรทัดในใบเสนอราคา) — มีแล้ว = อัปเดตสูตร
  const seedLan = async () => {
    const needed = Array.from(new Set(LAN_VARIANTS.flatMap((v) => lanBomSpec(v.key).comps.map((c) => resolveCode(c.code, {}, bom.settings)))));
    const missing = needed.filter((c) => !codeMap.has(c));
    if (missing.length) return void showAlert(`ยังไม่มีราคากลางของ: ${missing.join(", ")} — นำเข้าราคากลางก่อน (ขนาดท่อตามตั้งค่า BOM)`);
    const exists = LAN_VARIANTS.filter((v) => codeMap.has(v.bomCode));
    if (!(await showConfirm(exists.length ? `สร้าง/อัปเดตสูตร BOM ของงานบริการ LAN 3 รูปแบบ (มีอยู่แล้ว ${exists.length} งาน จะอัปเดตสูตร ราคาขายเดิมไม่เปลี่ยน)?` : "สร้างงานบริการ LAN 3 รูปแบบ พร้อมสูตร BOM แบบมีตัวแปร?"))) return;
    setBusy("seed");
    try {
      for (const v of LAN_VARIANTS) {
        const spec = lanBomSpec(v.key);
        const inputs = defaultInputs(spec, bom.settings);
        const res = expandBom(spec, inputs, bom.settings, bom.resolve);
        const recipe = { ...bomToRecipe(spec, res.items, "จุด"), bomInputs: inputs };
        const cur = codeMap.get(v.bomCode);
        const body = cur
          ? { companyId, action: "update", entity: "products", id: cur.productId, scope: "company", changes: { serviceRecipe: recipe } }
          : { companyId, action: "create", entity: "products", autoSku: true, data: {
              name: v.name, productName: v.name, description: v.desc, details: v.desc, category: "งานบริการ", unit: "จุด", baseUnit: "จุด", itemType: "SERVICE", productType: "SERVICE", type: "SERVICE",
              lifecycleStatus: "ACTIVE", isActive: true, taxType: "VAT_7", vatType: "VAT_7", whtRate: 3, bomCode: v.bomCode, serviceRecipe: recipe,
            } };
        const r = await apiFetch("/api/master-data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || d.success === false) throw new Error(`${v.name}: ${d.error || "บันทึกไม่สำเร็จ"}`);
      }
      showAlert("งานบริการ LAN 3 รูปแบบพร้อมสูตร BOM แล้ว — เปิดงานแต่ละตัวเพื่อกรอกระยะที่ใช้บ่อยและบันทึกราคาขายตาม markup", "เรียบร้อย", "info");
      await load();
    } catch (e: any) { showAlert(e.message, "สร้างไม่สำเร็จ", "error"); } finally { setBusy(""); }
  };

  // ---------- ตั้งค่า BOM ----------
  const [bset, setBset] = useState<BomSettings | null>(null);
  const editSet = bset || bom.settings;
  const saveSettings = async () => {
    if (!bset) return;
    setBusy("settings");
    try { const d = await post({ action: "saveSettings", settings: bset }); bom.setLocal(normalizeBomSettings(d.settings)); setBset(null); showAlert("บันทึกตั้งค่า BOM แล้ว", "บันทึกแล้ว", "info"); }
    catch (e: any) { showAlert(e.message, "บันทึกไม่สำเร็จ", "error"); } finally { setBusy(""); }
  };

  const setRef = async (productId: string, patch: any) => {
    try { await post({ action: "setRef", productId, ...patch }); setItems((x) => x.map((i) => (i.productId === productId ? { ...i, ...(patch.refCost !== undefined ? { refCost: patch.refCost } : {}), ...(patch.status !== undefined ? { refCostStatus: patch.status } : {}) } : i))); }
    catch (e: any) { showAlert(e.message, "บันทึกไม่สำเร็จ", "error"); }
  };

  if (!seeCost) return <div className="p-6 text-white/60 text-sm">ต้องมีสิทธิ์ดูต้นทุนหรือแก้ไขคลังสินค้า</div>;
  // งานบริการที่สร้างจากสูตร (SVC-…) ไม่ใช่ราคาอ้างอิง — แสดงแยกเป็นลิงก์
  const refItems = items.filter((x) => !x.bomCode.startsWith("SVC-"));
  const svcItems = items.filter((x) => x.bomCode.startsWith("SVC-"));
  const listShown = refItems.filter((x) => !q.trim() || `${x.bomCode} ${x.name} ${x.sku}`.toLowerCase().includes(q.trim().toLowerCase()));
  const red = refItems.filter((x) => x.refCostStatus === "Y").length;

  return (
    <div className="p-4 xl:p-6 space-y-4" data-ref-prices>
      <div className="flex flex-wrap items-center gap-3">
        <PillBackButton onClick={() => router.back()} />
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-white leading-none">ราคากลาง (BOM)</h1>
          <p className="text-xs text-white/55 mt-1">ราคาอ้างอิงที่ใช้คิดต้นทุนงานบริการแบบ BOM · {refItems.length} รายการ · <span className="text-danger">ประมาณการ {red}</span> · สีดำ = ไฟล์บริษัท <span className="text-nexus-blue">น้ำเงิน = ราคาเว็บ</span> <span className="text-danger">แดง = ประมาณการ ต้องยืนยัน</span></p>
        </div>
        <span className="flex-1" />
        <PillButton variant="glass" className="h-9 px-4 text-xs" onClick={downloadTemplate} disabled={!!busy} data-ref-template title="ไฟล์ Excel หัวตารางตรงกับที่ระบบอ่าน พร้อมราคากลางปัจจุบันและรหัสที่ยังขาด แก้แล้วนำเข้ากลับได้">{busy === "template" ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} ดาวน์โหลดแม่แบบ</PillButton>
        {canEdit && <>
          <PillButton variant="glass" className="h-9 px-4 text-xs" onClick={seedLan} disabled={!!busy} data-seed-lan>{busy === "seed" ? <Loader2 size={13} className="animate-spin" /> : <Wrench size={13} />} สร้าง/อัปเดตงานบริการ LAN 3 รูปแบบ</PillButton>
          <PillButton variant="confirm" className="h-9 px-4 text-xs font-bold" onClick={() => fileRef.current?.click()} disabled={!!busy} data-import-ref>{busy === "read" ? <Loader2 size={13} className="animate-spin" /> : <FileSpreadsheet size={13} />} นำเข้าจาก Excel</PillButton>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => pick(e.target.files?.[0])} data-ref-file />
        </>}
      </div>

      {loadErr && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-2.5 text-[12px] text-danger" data-ref-load-error>
          <span className="flex-1 min-w-0">โหลดราคากลางไม่สำเร็จ: {loadErr}</span>
          <PillButton variant="glass" className="h-8 px-3 text-xs" onClick={load} disabled={busy === "load"}><RefreshCw size={12} /> ลองใหม่</PillButton>
        </div>
      )}

      {rows && (
        <GlassCard className="p-4 space-y-3" >
          <div data-ref-review className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[14px] font-bold text-white">ตรวจการจับคู่ก่อนบันทึก ({rows.length} รายการ)</h3>
            <span className="flex-1" />
            {([["all", "ทั้งหมด"], ["check", "ต้องตรวจ"], ["create", "สร้างใหม่"], ["skip", "ข้าม"]] as const).map(([k, l]) => (
              <PillButton key={k} variant={filter === k ? "primary" : "glass"} className="h-8 px-3 text-[12px] normal-case tracking-normal" onClick={() => setFilter(k)}>{l} {(counts as any)[k]}</PillButton>
            ))}
            <PillButton variant="ghost" className="h-8 px-3 text-xs" onClick={() => setRows(null)} disabled={busy === "apply"}>ยกเลิก</PillButton>
            <PillButton variant="confirm" className="h-8 px-4 text-xs font-bold" onClick={apply} disabled={busy === "apply"} data-apply-ref>{busy === "apply" ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} บันทึก</PillButton>
          </div>
          <p className="text-[12px] text-white/50">ระบบเสนอสินค้าเดิมที่ชื่อใกล้เคียง (ต้องตรวจ) · ไม่ตรง → เลือกตัวอื่น ค้นหาเอง หรือ "สร้างสินค้าใหม่" · หน่วยต่างกัน → ระบุจำนวนหน่วยในราคากลางต่อ 1 หน่วยสินค้า (เช่น 1 กล่อง = 305 ม.){counts.ok ? ` · ผูกรหัสไว้แล้ว ${counts.ok} รายการ` : ""}</p>
          {progress && <p className="text-[12px] text-nexus-teal"><Loader2 size={12} className="inline animate-spin mr-1" />{progress}</p>}
          <NexusTable headers={["รหัส", "รายการ", "หน่วย", "ราคากลาง", "สถานะราคา", "จับคู่กับสินค้า", "แปลงหน่วย"]}>
            {shown.map((r) => {
              const d = dec[r.code] || { kind: "create", per: 1 };
              const cs = cands[r.code] || [];
              const st = status(r);
              const val = d.kind === "link" ? `p:${d.productId}` : d.kind;
              const chosen = d.kind === "link" && d.productId ? byId.get(d.productId) : null;
              const extra = chosen && !cs.some((c) => c.productId === chosen.id) ? [chosen] : [];
              const hits = d.search?.trim() ? products.filter((p: any) => `${p.sku} ${p.name}`.toLowerCase().includes(d.search!.trim().toLowerCase())).slice(0, 8) : [];
              return (
                <NexusTableRow key={r.code} className={cn(st === "check" && "bg-warning/[0.04]")}>
                  <NexusTableCell mono>{r.code}</NexusTableCell>
                  <NexusTableCell title={`${r.name} · ${r.nameEn} · ${r.source}`}><span className={TONE[r.status]}>{r.name}</span><span className="ml-1.5 text-[11px] text-white/40">{r.category}</span></NexusTableCell>
                  <NexusTableCell>{r.unit}</NexusTableCell>
                  <NexusTableCell align="right" mono><span className={TONE[r.status]}>{money(r.cost)}</span></NexusTableCell>
                  <NexusTableCell><span className={cn("text-[12px]", TONE[r.status])}>{REF_STATUS_TH[r.status]}</span></NexusTableCell>
                  <NexusTableCell>
                    <div className="space-y-1 min-w-[300px]" data-ref-row={r.code}>
                      <PillSelect value={val} onChange={(e) => { const v = e.target.value; setD(r.code, v.startsWith("p:") ? { kind: "link", productId: v.slice(2) } : { kind: v as any, productId: undefined }); }} className={cn("h-8 w-full text-[12px]", st === "check" && "border-warning/50")} aria-label={`จับคู่ ${r.code}`}>
                        {cs.map((c) => <option key={c.productId} value={`p:${c.productId}`}>{c.score === 1 ? "✓ " : `${Math.round(c.score * 100)}% `}{c.sku} {c.name} [{c.unit}]</option>)}
                        {extra.map((p: any) => <option key={p.id} value={`p:${p.id}`}>{p.sku} {p.name} [{p.unit}]</option>)}
                        <option value="create">+ สร้างสินค้าใหม่ ({isServiceCategory(r.category) ? "งานบริการ" : "สินค้า"} · {unitOf(r.unit)})</option>
                        <option value="skip">ข้าม (ไม่นำเข้า)</option>
                      </PillSelect>
                      <div className="relative">
                        <PillInput value={d.search || ""} onChange={(e) => setD(r.code, { search: e.target.value })} placeholder="ค้นหาสินค้าอื่น…" className="h-8 w-full text-[12px]" aria-label={`ค้นหาสินค้า ${r.code}`} />
                        {hits.length > 0 && (
                          <div className="mt-1 rounded-xl border border-white/10 bg-surface-1 max-h-48 overflow-y-auto">
                            {hits.map((p: any) => (
                              <PillButton key={p.id} variant="ghost" className="h-8 w-full justify-start rounded-none px-3 text-[12px] normal-case tracking-normal font-normal" onClick={() => setD(r.code, { kind: "link", productId: p.id, search: "" })}>
                                <Search size={11} className="shrink-0 text-white/40" /><span className="truncate">{p.sku} {p.name} [{p.unit}]</span>
                              </PillButton>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </NexusTableCell>
                  <NexusTableCell>
                    {unitMismatch(r)
                      ? <div className="flex items-center gap-1.5 text-[12px] text-white/70"><span>1 {chosen?.unit} =</span><div className="w-[90px]"><NumCell value={d.per} onChange={(v) => setD(r.code, { per: v })} warn={!(d.per > 1)} /></div><span>{r.unit}</span></div>
                      : <span className="text-white/30">-</span>}
                  </NexusTableCell>
                </NexusTableRow>
              );
            })}
          </NexusTable>
          </div>
        </GlassCard>
      )}

      <GlassCard className="p-4 space-y-3">
        <details data-bom-settings>
          <summary className="cursor-pointer text-[14px] font-bold text-white">ตั้งค่า BOM <span className="text-[12px] font-normal text-white/50">· markup {Math.round(editSet.markup * 100)}% · เผื่อสาย {Math.round(editSet.cableWaste * 100)}% · ท่อ Flex {editSet.flexSize} · EMT {editSet.emtSize} · Patch Panel {editSet.patchPorts} พอร์ต</span></summary>
          <div className="mt-3 space-y-3">
            {Array.from(new Set(BOM_SETTING_FIELDS.map((f) => f.group))).map((g) => (
              <div key={g} className="space-y-1">
                <p className="text-[12px] font-bold text-white/70">{g}</p>
                <div className="flex flex-wrap gap-3">
                  {BOM_SETTING_FIELDS.filter((f) => f.group === g).map((f) => (
                    <label key={f.key} className="space-y-1 block w-[180px]">
                      <span className="text-[11px] text-white/55">{f.label}</span>
                      {f.options ? (
                        <PillSelect value={String(editSet[f.key])} disabled={!canEdit} onChange={(e) => setBset((cur) => ({ ...(cur || bom.settings), [f.key]: e.target.value }))} className="h-9 w-full text-sm">
                          {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                        </PillSelect>
                      ) : (
                        <NumCell kind="pct" disabled={!canEdit} value={f.pct ? Math.round(Number(editSet[f.key]) * 10000) / 100 : Number(editSet[f.key])}
                          onChange={(v) => setBset((cur) => ({ ...(cur || bom.settings), [f.key]: f.pct ? v / 100 : v }))} suffix={f.unit} />
                      )}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            {canEdit && <PillButton variant="confirm" className="h-9 px-5 text-xs font-bold" disabled={!bset || busy === "settings"} onClick={saveSettings} data-save-bom-settings><Save size={13} /> บันทึกตั้งค่า BOM</PillButton>}
          </div>
        </details>
      </GlassCard>

      <GlassCard className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[14px] font-bold text-white">รายการราคากลาง</h3>
          <span className="flex-1" />
          <div className="w-[260px]"><PillInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหารหัส / ชื่อ" className="h-8 w-full text-[12px]" /></div>
          <PillButton variant="ghost" className="h-8 px-3 text-xs" onClick={load} disabled={!!busy}>{busy === "load" ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}</PillButton>
        </div>
        {svcItems.length > 0 && (
          <p className="text-[12px] text-white/55">งานบริการจากสูตร: {svcItems.map((x, i) => <React.Fragment key={x.productId}>{i ? " · " : ""}<Link href={`/inventory/${x.productId}#service-recipe`} className="text-nexus-teal hover:underline">{x.name}</Link></React.Fragment>)}</p>
        )}
        {!refItems.length && busy !== "load" && <p className="text-[14px] text-white/55">ยังไม่มีราคากลาง — กด "นำเข้าจาก Excel" แล้วเลือกไฟล์ Template_SOW_BOM (ชีต ราคากลาง)</p>}
        {refItems.length > 0 && (
          <NexusTable headers={["รหัส BOM", "สินค้า", "หน่วย", "ราคากลาง/หน่วย", "สถานะราคา", "ต้นทุนจริง (เฉลี่ย)", "ที่มา"]}>
            {listShown.map((x) => (
              <NexusTableRow key={x.productId}>
                <NexusTableCell mono>{x.bomCode}</NexusTableCell>
                <NexusTableCell title={x.name}><Link href={`/inventory/${x.productId}`} className={cn("hover:underline", TONE[x.refCostStatus as RefStatus])}>{x.name}</Link> <span className="text-[11px] text-white/40">{x.sku}</span></NexusTableCell>
                <NexusTableCell>{x.unit}{x.refCostPer > 1 ? <span className="text-[11px] text-white/40"> (={x.refCostPer} {x.refCostUnit})</span> : null}</NexusTableCell>
                <NexusTableCell align="right">
                  <span className={cn("font-mono", TONE[x.refCostStatus as RefStatus])}>{money(x.refCost)}</span>
                </NexusTableCell>
                <NexusTableCell>
                  {canEdit ? (
                    <PillSelect value={x.refCostStatus} onChange={(e) => setRef(x.productId, { status: e.target.value })} className={cn("h-8 w-[170px] text-[12px]", TONE[x.refCostStatus as RefStatus])} aria-label={`สถานะราคา ${x.bomCode}`}>
                      {(Object.keys(REF_STATUS_TH) as RefStatus[]).map((k) => <option key={k} value={k}>{REF_STATUS_TH[k]}</option>)}
                    </PillSelect>
                  ) : <span className={TONE[x.refCostStatus as RefStatus]}>{REF_STATUS_TH[x.refCostStatus as RefStatus]}</span>}
                </NexusTableCell>
                <NexusTableCell align="right" mono>{x.wac ? money(x.wac) : "-"}</NexusTableCell>
                <NexusTableCell title={x.refCostSource}><span className="text-[12px] text-white/50">{x.refCostSource}</span></NexusTableCell>
              </NexusTableRow>
            ))}
          </NexusTable>
        )}
      </GlassCard>
      {canEdit && <p className="text-[12px] text-white/40"><Plus size={11} className="inline" /> แก้ราคากลาง: แก้ในไฟล์แล้วนำเข้าใหม่ (รหัสที่ผูกแล้วจับคู่ให้อัตโนมัติ) · ยืนยันราคาแล้วเปลี่ยนสถานะในตารางนี้ได้</p>}
    </div>
  );
}
