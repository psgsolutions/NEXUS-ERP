"use client";

/**
 * แบ่งบรรจุ (แบ่งขาย) — แกะสินค้าหน่วยใหญ่ (สกรู 1 กล่อง = 1,000 ตัว) แบ่งเป็นห่อเล็ก (ถุงละ N ตัว) เข้าคลัง แล้วพิมพ์ฉลากพร้อมบาร์โค้ด
 *  - ห่อเล็กเป็นสินค้าแยกรหัส (มีบาร์โค้ด/ราคาขายของตัวเอง) ผูกกับสินค้าต้นทางและขนาดห่อ · ยังไม่มี = สร้างให้ตอนบันทึก
 *  - ต้นทุนห่อ = ต้นทุนจริงของที่แกะ ÷ จำนวนห่อ (มูลค่าคลังรวมเท่าเดิม) · เศษไม่ครบห่อ: เก็บเป็นสินค้าแยกชิ้น หรือตัดเป็นเศษ
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import JsBarcode from "jsbarcode";
import { History, Loader2, PackageOpen, Printer, Tag } from "lucide-react";
import { GlassCard, NexusTable, NexusTableCell, NexusTableRow, PillBackButton, PillButton, PillCheckbox, PillInput, PillSelect, cn } from "@/components/ui/Base";
import { SmartSelect } from "@/components/ui/SmartComponents";
import { useAuth } from "@/context/AuthContext";
import { useSystemDialog } from "@/context/DialogContext";
import { useProducts } from "@/hooks/useProducts";
import { apiFetch } from "@/lib/api-client";
import { can, canViewCost } from "@/lib/permissions";
import { findPackProduct, packProductName, planRepack, repackCosts, type RemainderMode } from "@/lib/repack";

const money = (n: number) => Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qtyText = (n: number) => Number(n || 0).toLocaleString("th-TH", { maximumFractionDigits: 4 });
const numIn = (v: string) => Number(String(v).replace(/[^\d.]/g, "")) || 0;
const costOf = (p: any) => Number(p?.pricing?.costWAC ?? p?.costPrice ?? 0) || 0;
const priceOf = (p: any) => Number(p?.pricing?.pricePOS ?? p?.unitPrice ?? p?.sellingPrice ?? 0) || 0;
const labelCode = (p: any) => String(p?.barcode || p?.sku || p?.id || "");

/** ขนาดฉลาก (มม.) */
const SIZES: Record<string, { w: number; h: number; label: string }> = {
  s: { w: 40, h: 25, label: "40 × 25 มม." },
  m: { w: 50, h: 30, label: "50 × 30 มม." },
  l: { w: 70, h: 40, label: "70 × 40 มม." },
};

interface LabelData { key: string; name: string; code: string; content: string; lotNo: string; date: string; price: number }

function PackLabel({ d, size, showPrice }: { d: LabelData; size: { w: number; h: number }; showPrice: boolean }) {
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (svgRef.current && d.code) JsBarcode(svgRef.current, d.code, { format: "CODE128", width: size.w >= 50 ? 1.4 : 1.1, height: size.h >= 30 ? 34 : 24, displayValue: false, margin: 0 });
  }, [d.code, size.w, size.h]);
  return (
    <div className="label-card break-inside-avoid bg-white text-black border border-black/30 rounded-sm flex flex-col items-center justify-between overflow-hidden"
      style={{ width: `${size.w}mm`, height: `${size.h}mm`, padding: "1.5mm" }}>
      <p className="text-[11px] font-bold text-center leading-tight line-clamp-2 w-full">{d.name}</p>
      <p className="text-[11px] leading-tight">{d.content}{showPrice && d.price > 0 ? ` · ${money(d.price)} บาท` : ""}</p>
      <svg ref={svgRef} className="max-w-full" />
      <p className="font-mono text-[11px] leading-tight">{d.code}{d.lotNo ? ` · ${d.lotNo}` : ""}</p>
    </div>
  );
}

export default function RepackPage() {
  const router = useRouter();
  const { companyId, roles } = useAuth();
  const { showAlert, showConfirm } = useSystemDialog();
  const canEdit = can(roles, "inventory:edit");
  const seeCost = canViewCost(roles);
  const { data: products = [] } = useProducts<any>();

  const [sourceId, setSourceId] = useState("");
  const source = products.find((p: any) => p.id === sourceId);
  const [perSource, setPerSource] = useState("");
  const [pieceUnit, setPieceUnit] = useState("ตัว");
  const [sourceQty, setSourceQty] = useState("1");
  const [packSize, setPackSize] = useState("");
  const [packUnit, setPackUnit] = useState("ถุง");
  const [packs, setPacks] = useState("");
  const [mode, setMode] = useState<RemainderMode>("waste");
  const [packName, setPackName] = useState("");
  const [looseName, setLooseName] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [history, setHistory] = useState<any[] | null>(null);
  // ฉลาก
  const [labels, setLabels] = useState<LabelData[]>([]);
  const [copies, setCopies] = useState("0");
  const [size, setSize] = useState("m");
  const [showPrice, setShowPrice] = useState(true);

  // เลือกสินค้าต้นทาง → เติมจำนวนชิ้นต่อหน่วยที่เคยใช้
  useEffect(() => {
    if (!source) return;
    setPerSource(source.repackPieces ? String(source.repackPieces) : "");
    setPieceUnit(source.pieceUnit || "ตัว");
    setPacks("");
  }, [sourceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const sourceOptions = useMemo(() => products
    .filter((p: any) => !p.isDeleted && (p.itemType || p.productType || "PRODUCT") !== "SERVICE" && !p.packOf && Number(p.stockStatus?.onHand) > 0)
    .map((p: any) => ({ value: p.id, label: `${p.sku ? `${p.sku} ` : ""}${p.name}`, description: `คงเหลือ ${qtyText(p.stockStatus?.onHand)} ${p.unit || ""}` })), [products]);

  const plan = planRepack({ sourceQty: numIn(sourceQty), piecesPerSource: numIn(perSource), packSize: numIn(packSize), packs: packs === "" ? undefined : numIn(packs), remainderMode: mode });
  const onHand = Number(source?.stockStatus?.onHand) || 0;
  const overStock = !!source && numIn(sourceQty) > onHand;
  const packProduct = source && numIn(packSize) > 0 ? findPackProduct(products, source.id, numIn(packSize)) : undefined;
  const needLoose = plan.remainder > 0 && plan.remainderMode === "loose";
  const looseProduct = source && needLoose ? findPackProduct(products, source.id, 1) : undefined;
  const defaultPackName = source && numIn(packSize) > 0 ? packProductName(source.name, numIn(packSize), pieceUnit, packUnit) : "";
  const defaultLooseName = source ? packProductName(source.name, 1, pieceUnit, packUnit) : "";
  const estCost = source ? costOf(source) * numIn(sourceQty) : 0;
  const est = repackCosts(estCost, plan);
  const errors = [...(source ? [] : ["เลือกสินค้าต้นทาง"]), ...plan.errors, ...(overStock ? [`สต็อกไม่พอ (คงเหลือ ${qtyText(onHand)} ${source?.unit || ""})`] : [])];

  const post = async (url: string, body: any) => {
    const r = await apiFetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, ...body }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.success === false) throw new Error(d.error || "ดำเนินการไม่สำเร็จ");
    return d;
  };
  /** สร้างสินค้าห่อเล็ก/แยกชิ้น (รหัสออกให้อัตโนมัติ) — คุณสมบัติหลักตามสินค้าต้นทาง */
  const createPack = async (name: string, unit: string, pieces: number) => {
    const d = await post("/api/master-data", { action: "create", entity: "products", autoSku: true, data: {
      name, productName: name, unit, baseUnit: unit, itemType: "PRODUCT", productType: "PRODUCT", type: "PRODUCT",
      category: source.category || "", subCategory: source.subCategory || "", brand: source.brand || "", taxType: source.taxType || "VAT_7", vatType: source.vatType || source.taxType || "VAT_7",
      lifecycleStatus: "ACTIVE", isActive: true, description: `แบ่งบรรจุจาก ${source.sku || ""} ${source.name}`.trim(),
      packOf: { productId: source.id, pieces, pieceUnit },
    } });
    return { id: d.id as string, sku: d.sku as string, name };
  };

  const run = async () => {
    if (errors.length || !source) return;
    const pName = packProduct ? packProduct.name : (packName.trim() || defaultPackName);
    const lName = needLoose ? (looseProduct ? looseProduct.name : (looseName.trim() || defaultLooseName)) : "";
    const msg = `แกะ ${source.name} ${qtyText(numIn(sourceQty))} ${source.unit || ""} (${qtyText(plan.totalPieces)} ${pieceUnit})\n→ ${pName} ${plan.packs} ${packUnit}`
      + (plan.remainder > 0 ? `\n→ เศษ ${qtyText(plan.remainder)} ${pieceUnit}: ${needLoose ? `เก็บเป็น ${lName}` : "ตัดเป็นเศษ (ต้นทุนรวมในห่อ)"}` : "")
      + (!packProduct || (needLoose && !looseProduct) ? "\n\nระบบจะสร้างสินค้าใหม่ที่ยังไม่มีให้ (รหัสอัตโนมัติ)" : "");
    if (!(await showConfirm(msg, "ยืนยันแบ่งบรรจุ"))) return;
    setBusy(true);
    try {
      const pack = packProduct ? { id: packProduct.id } : await createPack(pName, packUnit, numIn(packSize));
      const loose = needLoose ? (looseProduct ? { id: looseProduct.id } : await createPack(lName, pieceUnit, 1)) : null;
      const d = await post("/api/inventory/repack", {
        action: "run", sourceId: source.id, sourceQty: numIn(sourceQty), piecesPerSource: numIn(perSource), pieceUnit,
        packProductId: pack.id, packSize: numIn(packSize), packs: plan.packs, remainderMode: mode, ...(loose ? { looseProductId: loose.id } : {}),
      });
      setResult(d.repack);
      openLabels(d.repack);
      setHistory(null);
    } catch (e: any) { showAlert(e.message, "แบ่งบรรจุไม่สำเร็จ", "error"); } finally { setBusy(false); }
  };

  /** ฉลากของห่อในใบแบ่งบรรจุ (จำนวนเริ่มต้น = จำนวนห่อ) */
  const openLabels = (rp: any) => {
    if (!rp?.pack) return;
    const p = products.find((x: any) => x.id === rp.pack.productId);
    setLabels([{
      key: rp.rpNo, name: p?.name || rp.pack.name, code: labelCode(p || { sku: rp.pack.sku, id: rp.pack.productId }),
      content: `บรรจุ ${qtyText(rp.pack.packSize)} ${rp.pieceUnit || "ชิ้น"}`, lotNo: rp.pack.lotNo || "", date: rp.date || "", price: priceOf(p),
    }]);
    setCopies(String(rp.pack.qty || 0));
    setTimeout(() => document.querySelector("[data-repack-labels]")?.scrollIntoView({ behavior: "smooth" }), 50);
  };
  const loadHistory = async () => {
    try { const d = await post("/api/inventory/repack", { action: "list" }); setHistory(d.items || []); }
    catch (e: any) { showAlert(e.message, "โหลดประวัติไม่สำเร็จ", "error"); }
  };

  const sz = SIZES[size] || SIZES.m;
  const toPrint = labels.flatMap((l) => Array.from({ length: Math.max(0, Math.min(1000, Math.floor(numIn(copies)))) }, (_, i) => ({ ...l, key: `${l.key}-${i}` })));

  if (!canEdit) return <div className="p-6 text-white/60 text-sm">ต้องมีสิทธิ์แก้ไขคลังสินค้า</div>;

  return (
    <div className="p-4 xl:p-6 space-y-4" data-repack>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .labels-print, .labels-print * { visibility: visible; }
          .labels-print { position: absolute; inset: 0; padding: 4mm; background: white; display: flex; flex-wrap: wrap; gap: 2mm; align-content: flex-start; }
        }
      `}</style>
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <PillBackButton onClick={() => router.back()} />
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-white leading-none">แบ่งบรรจุ (แบ่งขาย)</h1>
          <p className="text-xs text-white/55 mt-1">แกะสินค้าหน่วยใหญ่แบ่งเป็นห่อเล็กเข้าคลัง เช่น สกรู 1 กล่อง 1,000 ตัว → ถุงละ 50 ตัว 20 ถุง · ห่อเล็กมีรหัส/บาร์โค้ด/ราคาขายของตัวเอง · มูลค่าคลังรวมเท่าเดิม</p>
        </div>
        <span className="flex-1" />
        <PillButton variant="glass" className="h-9 px-4 text-xs" onClick={loadHistory} data-repack-history-btn><History size={13} /> ประวัติแบ่งบรรจุ</PillButton>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 print:hidden">
        <GlassCard accentColor="teal" className="p-4 space-y-3">
          <h3 className="text-[14px] font-bold text-white flex items-center gap-2"><PackageOpen size={15} className="text-nexus-teal" /> 1. สินค้าที่แกะ</h3>
          <div className="space-y-1">
            <label className="text-[12px] text-white/60">สินค้าต้นทาง (มีสต็อก)</label>
            <SmartSelect options={sourceOptions} value={sourceId} onChange={setSourceId} allowCustom={false} placeholder="ค้นหารหัส / ชื่อสินค้า…" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <label className="space-y-1 block"><span className="text-[12px] text-white/60">จำนวนที่แกะ ({source?.unit || "หน่วย"})</span>
              <PillInput inputMode="decimal" value={sourceQty} onChange={(e) => setSourceQty(e.target.value)} className={cn("h-9 text-right font-mono", overStock && "border-danger/60")} data-repack-qty /></label>
            <label className="space-y-1 block"><span className="text-[12px] text-white/60">ชิ้นต่อ 1 {source?.unit || "หน่วย"}</span>
              <PillInput inputMode="decimal" value={perSource} onChange={(e) => setPerSource(e.target.value)} placeholder="เช่น 1000" className="h-9 text-right font-mono" data-repack-per /></label>
            <label className="space-y-1 block"><span className="text-[12px] text-white/60">หน่วยชิ้น</span>
              <PillInput value={pieceUnit} onChange={(e) => setPieceUnit(e.target.value)} className="h-9" /></label>
          </div>
          {source && <p className="text-[12px] text-white/55">คงเหลือ {qtyText(onHand)} {source.unit || ""}{seeCost ? ` · ต้นทุนเฉลี่ย ${money(costOf(source))}/${source.unit || "หน่วย"}` : ""} · รวมทั้งหมด <b className="text-white">{qtyText(plan.totalPieces)} {pieceUnit}</b></p>}
        </GlassCard>

        <GlassCard accentColor="blue" className="p-4 space-y-3">
          <h3 className="text-[14px] font-bold text-white flex items-center gap-2"><Tag size={15} className="text-nexus-blue" /> 2. แบ่งเป็นห่อ</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <label className="space-y-1 block"><span className="text-[12px] text-white/60">{pieceUnit} ต่อ 1 ห่อ</span>
              <PillInput inputMode="decimal" value={packSize} onChange={(e) => { setPackSize(e.target.value); setPacks(""); }} placeholder="เช่น 50" className="h-9 text-right font-mono" data-repack-size /></label>
            <label className="space-y-1 block"><span className="text-[12px] text-white/60">หน่วยห่อ</span>
              <PillInput value={packUnit} onChange={(e) => setPackUnit(e.target.value)} className="h-9" /></label>
            <label className="space-y-1 block"><span className="text-[12px] text-white/60">จำนวนห่อ (ได้สูงสุด {plan.maxPacks})</span>
              <PillInput inputMode="numeric" value={packs === "" ? (plan.maxPacks ? String(plan.maxPacks) : "") : packs} onChange={(e) => setPacks(e.target.value)} className="h-9 text-right font-mono" data-repack-packs /></label>
          </div>
          <div className="space-y-1">
            <label className="text-[12px] text-white/60">สินค้าห่อเล็ก</label>
            {packProduct
              ? <p className="text-[12px] text-nexus-teal" data-repack-pack-existing>ใช้สินค้าเดิม: <b>{packProduct.sku}</b> {packProduct.name}</p>
              : <PillInput value={packName || defaultPackName} onChange={(e) => setPackName(e.target.value)} placeholder="ชื่อสินค้าห่อเล็ก (สร้างใหม่ตอนบันทึก)" className="h-9" data-repack-pack-name />}
          </div>
          {plan.remainder > 0 && (
            <div className="space-y-2 rounded-xl border border-warning/30 bg-warning/5 p-3">
              <p className="text-[12px] text-warning">เศษไม่ครบห่อ {qtyText(plan.remainder)} {pieceUnit}</p>
              <PillSelect value={mode} onChange={(e) => setMode(e.target.value as RemainderMode)} className="h-9 w-full text-[12px]" aria-label="จัดการเศษ">
                <option value="loose">เก็บเป็นสินค้าแยก{pieceUnit} (ขายปลีกได้ ต้นทุนตามสัดส่วน)</option>
                <option value="waste">ตัดเป็นเศษสูญเสีย (ต้นทุนรวมเข้าห่อ)</option>
              </PillSelect>
              {needLoose && (looseProduct
                ? <p className="text-[12px] text-nexus-teal">เก็บเข้า: <b>{looseProduct.sku}</b> {looseProduct.name}</p>
                : <PillInput value={looseName || defaultLooseName} onChange={(e) => setLooseName(e.target.value)} className="h-9" placeholder="ชื่อสินค้าแยกชิ้น (สร้างใหม่ตอนบันทึก)" />)}
            </div>
          )}
        </GlassCard>
      </div>

      <GlassCard className="p-4 space-y-3 print:hidden" data-repack-summary>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-white/70">
          <span>ทั้งหมด <b className="font-mono text-white">{qtyText(plan.totalPieces)}</b> {pieceUnit}</span>
          <span>บรรจุ <b className="font-mono text-white">{plan.packs}</b> {packUnit} × {qtyText(numIn(packSize))} = <b className="font-mono text-white">{qtyText(plan.packedPieces)}</b></span>
          <span>เศษ <b className="font-mono text-white">{qtyText(plan.remainder)}</b> {pieceUnit}</span>
          {seeCost && source && <span>ต้นทุนประมาณ/{packUnit} <b className="font-mono text-white">{money(est.packUnitCost)}</b> <span className="text-white/40">(ต้นทุนจริงตามล็อตที่ตัด)</span></span>}
          <span className="flex-1" />
          <PillButton variant="confirm" className="h-9 px-5 text-xs font-bold" onClick={run} disabled={busy || errors.length > 0} data-repack-run>
            {busy ? <Loader2 size={13} className="animate-spin" /> : <PackageOpen size={13} />} แบ่งบรรจุเข้าคลัง
          </PillButton>
        </div>
        {errors.length > 0 && source && <p className="text-[12px] text-danger">{errors.join(" · ")}</p>}
        {result && (
          <p className="text-[12px] text-nexus-teal" data-repack-result>
            บันทึก {result.rpNo} แล้ว — รับ {result.pack?.name} {result.pack?.qty} {packUnit} (ล็อต {result.pack?.lotNo}{seeCost ? ` · ต้นทุน ${money(result.pack?.unitCost)}/${packUnit}` : ""})
            {result.loose ? ` · ${result.loose.name} ${qtyText(result.loose.qty)} ${pieceUnit}` : ""}
          </p>
        )}
      </GlassCard>

      {history && (
        <GlassCard className="p-4 space-y-2 print:hidden" data-repack-history>
          <h3 className="text-[14px] font-bold text-white">ประวัติแบ่งบรรจุ (ล่าสุด 50 ใบ)</h3>
          {history.length === 0 ? <p className="text-[12px] text-white/50">ยังไม่มีการแบ่งบรรจุ</p> : (
            <NexusTable headers={["เลขที่", "วันที่", "สินค้าที่แกะ", "จำนวน", "ห่อเล็ก", "ห่อ", "เศษ", ""]}>
              {history.map((h) => (
                <NexusTableRow key={h.rpNo}>
                  <NexusTableCell mono>{h.rpNo}</NexusTableCell>
                  <NexusTableCell mono>{h.date}</NexusTableCell>
                  <NexusTableCell title={h.source?.name}>{h.source?.name}</NexusTableCell>
                  <NexusTableCell align="right" mono>{qtyText(h.source?.qty)} {h.source?.unit}</NexusTableCell>
                  <NexusTableCell title={h.pack?.name}>{h.pack?.name || "-"}</NexusTableCell>
                  <NexusTableCell align="right" mono>{h.pack?.qty || 0}</NexusTableCell>
                  <NexusTableCell align="right" mono>{qtyText(h.remainder)}{h.remainder ? (h.remainderMode === "loose" ? " (แยกชิ้น)" : " (เศษ)") : ""}</NexusTableCell>
                  <NexusTableCell align="right">{h.pack && <PillButton variant="ghost" className="h-8 px-3 text-xs" onClick={() => openLabels(h)}><Printer size={12} /> ฉลาก</PillButton>}</NexusTableCell>
                </NexusTableRow>
              ))}
            </NexusTable>
          )}
        </GlassCard>
      )}

      {labels.length > 0 && (
        <GlassCard accentColor="purple" className="p-4 space-y-3" data-repack-labels>
          <div className="flex flex-wrap items-center gap-3 print:hidden">
            <h3 className="text-[14px] font-bold text-white flex items-center gap-2"><Printer size={15} /> ฉลากสินค้า</h3>
            <label className="flex items-center gap-2 text-[12px] text-white/70">จำนวนฉลาก
              <PillInput inputMode="numeric" value={copies} onChange={(e) => setCopies(e.target.value)} className="h-8 w-[90px] text-right font-mono" data-label-copies /></label>
            <div className="w-[150px]"><PillSelect value={size} onChange={(e) => setSize(e.target.value)} className="h-8 w-full text-[12px]" aria-label="ขนาดฉลาก">{Object.entries(SIZES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</PillSelect></div>
            <PillCheckbox label="แสดงราคาขาย" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} />
            <span className="flex-1" />
            <PillButton variant="primary" className="h-9 px-4 text-xs" onClick={() => window.print()} disabled={!toPrint.length}><Printer size={13} /> พิมพ์ {toPrint.length} ดวง</PillButton>
          </div>
          {!labels[0].code && <p className="text-[12px] text-warning print:hidden">สินค้าห่อเล็กยังไม่มีรหัส/บาร์โค้ด</p>}
          <div className="labels-print flex flex-wrap gap-2 rounded-xl bg-white/90 p-3 max-h-[480px] overflow-auto print:max-h-none print:overflow-visible">
            {toPrint.map((l) => <PackLabel key={l.key} d={l} size={sz} showPrice={showPrice} />)}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
