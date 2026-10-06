"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ScanLine, MapPin, PackageCheck, Trash2, CheckCircle2, AlertTriangle, ClipboardList } from "lucide-react";
import { PillButton, PillInput, GlassCard, cn } from "@/components/ui/Base";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { apiFetch } from "@/lib/api-client";
import { listLocations, findLocation, findProductByScan, UNASSIGNED } from "@/lib/warehouse-location";
import { soPickRemaining } from "@/lib/picking";

type Line = { productId: string; location: string; qty: number };
type Feedback = { type: "ok" | "error" | "info"; text: string } | null;

const BLOCKED = ["DRAFT", "CANCELLED", "COMPLETED", "DELIVERED"];
const soNo = (so: any) => so.documentNo || so.soId || so.id;

function PickingScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const { companyId } = useAuth();

  const { data: orders } = useRealtimeCollection<any>(`companies/${companyId}/sales_orders`);
  const { data: products } = useRealtimeCollection<any>("products");
  const { data: balances } = useRealtimeCollection<any>(`companies/${companyId}/inventory_balance`);
  const { data: warehouses } = useRealtimeCollection<any>("warehouses");
  const locations = useMemo(() => listLocations(warehouses), [warehouses]);
  const productById = useMemo(() => new Map(products.map((p: any) => [p.id, p])), [products]);

  const pickable = orders.filter((so: any) => !BLOCKED.includes(String(so.status || "").toUpperCase()) && soPickRemaining(so).size > 0);
  const soId = params.get("so") || "";
  const so = orders.find((o: any) => o.id === soId);
  const remaining = useMemo(() => (so ? soPickRemaining(so) : new Map<string, number>()), [so]);

  const [location, setLocation] = useState<string>("");
  const [lines, setLines] = useState<Line[]>([]);
  const [scan, setScan] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [saving, setSaving] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);
  const focusScan = () => { setTimeout(() => scanRef.current?.focus(), 0); };
  useEffect(() => { setLines([]); setLocation(""); setFeedback(null); focusScan(); }, [soId]);

  const pickedInLines = (productId: string, loc?: string) =>
    lines.filter((l) => l.productId === productId && (loc === undefined || l.location === loc)).reduce((s, l) => s + l.qty, 0);

  // จำนวนคงเหลือที่ตำแหน่ง (UNASSIGNED = onHand - ผลรวมทุกตำแหน่ง)
  const stockAt = (productId: string, loc: string) => {
    if (loc === UNASSIGNED) {
      const located = balances.filter((b: any) => b.productId === productId).reduce((s: number, b: any) => s + (Number(b.quantity) || 0), 0);
      return Math.max(0, (Number(productById.get(productId)?.stockStatus?.onHand) || 0) - located);
    }
    return Number(balances.find((b: any) => b.productId === productId && b.location === loc)?.quantity) || 0;
  };

  const addPick = (product: any, loc: string) => {
    const left = (remaining.get(product.id) || 0) - pickedInLines(product.id);
    if (left <= 0) return setFeedback({ type: "error", text: `${product.name}: เบิกครบตามใบสั่งขายแล้ว หรือไม่อยู่ในใบสั่งขายนี้` });
    const atLoc = stockAt(product.id, loc) - pickedInLines(product.id, loc);
    if (atLoc <= 0) return setFeedback({ type: "error", text: `${product.name}: ไม่มีสต็อกที่ ${loc === UNASSIGNED ? "สต็อกไม่ระบุตำแหน่ง" : loc}` });
    setLines((prev) => {
      const hit = prev.find((l) => l.productId === product.id && l.location === loc);
      return hit ? prev.map((l) => l === hit ? { ...l, qty: l.qty + 1 } : l) : [...prev, { productId: product.id, location: loc, qty: 1 }];
    });
    setFeedback({ type: "ok", text: `+1 ${product.name} จาก ${loc === UNASSIGNED ? "สต็อกไม่ระบุตำแหน่ง" : loc}` });
  };

  const handleScan = (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    const loc = findLocation(locations, value);
    if (loc) {
      setLocation(loc.code);
      setFeedback({ type: "info", text: `ตำแหน่ง ${loc.code} — ยิงสินค้าที่หยิบจากชั้นนี้` });
      return;
    }
    const product = findProductByScan(products, value);
    if (product) {
      if (!location) return setFeedback({ type: "error", text: "ยิงบาร์โค้ดชั้นวางที่หยิบสินค้าก่อน" });
      addPick(product, location);
      return;
    }
    setFeedback({ type: "error", text: `ไม่พบตำแหน่งหรือสินค้า "${value}"` });
  };

  const confirm = async () => {
    if (!companyId || !so || lines.length === 0) return;
    setSaving(true);
    try {
      const res = await apiFetch("/api/inventory/pick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, soId: so.id, lines }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "เบิกสินค้าไม่สำเร็จ");
      setLines([]);
      if (data.allPicked) {
        setFeedback({ type: "ok", text: "เบิกครบทุกรายการแล้ว ใบสั่งขายเปลี่ยนเป็นส่งมอบแล้ว" });
        router.push(`/sales/orders/${so.id}`);
      } else {
        setFeedback({ type: "ok", text: "บันทึกการเบิกแล้ว ยังมีรายการค้างเบิก" });
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message });
    } finally {
      setSaving(false);
      focusScan();
    }
  };

  const header = (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-6 rounded-3xl backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <PillButton variant="glass" onClick={() => (so ? router.push("/inventory/pick") : router.back())} className="w-10 h-10 p-0 flex items-center justify-center">
          <ArrowLeft size={20} />
        </PillButton>
        <div>
          <h1 className="text-2xl font-semibold text-white uppercase tracking-tight">เบิกสินค้า / จัดของ (Picking)</h1>
          <p className="text-sm text-white/60 font-medium mt-1">
            {so ? `ใบสั่งขาย ${soNo(so)} • ${so.customerName || so.customerSnapshot?.name || "-"}` : "เลือกใบสั่งขายที่จะจัดของ"}
          </p>
        </div>
      </div>
    </div>
  );

  // หน้าเลือกใบสั่งขาย
  if (!so) {
    return (
      <NexusPageLayout header={header} leftContent={
        <GlassCard className="p-5 border-white/10 rounded-3xl space-y-2">
          <h3 className="text-[13px] font-semibold uppercase tracking-widest text-white/80 flex items-center gap-2"><ClipboardList size={16} className="text-nexus-teal" /> ใบสั่งขายที่รอเบิกสินค้า ({pickable.length})</h3>
          {pickable.length === 0 && <p className="text-[12px] text-white/40">ไม่มีใบสั่งขายที่อนุมัติแล้วและรอเบิกสินค้า</p>}
          {pickable.map((o: any) => (
            <button key={o.id} onClick={() => router.push(`/inventory/pick?so=${encodeURIComponent(o.id)}`)} className="w-full text-left p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-nexus-teal/40 transition-all">
              <p className="text-[13px] font-bold text-white font-mono">{soNo(o)}</p>
              <p className="text-[12px] text-white/50">{o.customerName || o.customerSnapshot?.name || "-"} • ค้างเบิก {soPickRemaining(o).size} รายการ</p>
            </button>
          ))}
        </GlassCard>
      } />
    );
  }

  const totalQty = lines.reduce((s, l) => s + l.qty, 0);

  const left = (
    <div className="space-y-4 pb-10">
      <GlassCard className="p-5 space-y-3 border-white/10 rounded-3xl">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <label className="text-[12px] font-bold text-white/70 flex items-center gap-2"><ScanLine size={14} className="text-nexus-teal" /> ยิงชั้นวางที่หยิบ แล้วยิงสินค้า (ยิงซ้ำ = +1)</label>
          <div className="flex items-center gap-2">
            <span className={cn("text-[12px] font-mono font-bold px-3 py-1 rounded-full", location ? "bg-nexus-teal/15 text-nexus-teal" : "bg-white/5 text-white/40")}>
              <MapPin size={12} className="inline mr-1" />{location ? (location === UNASSIGNED ? "สต็อกไม่ระบุตำแหน่ง" : location) : "ยังไม่ระบุตำแหน่ง"}
            </span>
            <button onClick={() => { setLocation(UNASSIGNED); focusScan(); }} className="text-[11px] text-white/50 hover:text-white underline">ใช้สต็อกที่ยังไม่จัดเก็บ</button>
          </div>
        </div>
        <PillInput
          ref={scanRef as any}
          value={scan}
          onChange={(e) => setScan(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleScan(scan); setScan(""); } }}
          placeholder={location ? "ยิงสินค้า (บาร์โค้ด / SKU)" : "ยิงบาร์โค้ดชั้นวาง เช่น WH-01-A1-L2"}
          className="w-full h-9 rounded-full px-5 text-[14px] font-mono"
          autoComplete="off"
        />
        {feedback && (
          <div className={cn("p-3 rounded-xl text-[13px] font-bold flex items-center gap-2",
            feedback.type === "ok" && "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400",
            feedback.type === "error" && "bg-red-500/10 border border-red-500/30 text-red-400",
            feedback.type === "info" && "bg-cyan-500/10 border border-cyan-500/30 text-cyan-300")}>
            {feedback.type === "error" ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />} {feedback.text}
          </div>
        )}
      </GlassCard>

      <GlassCard className="p-5 space-y-3 border-white/10 rounded-3xl">
        <h3 className="text-[13px] font-semibold uppercase tracking-widest text-white/80 flex items-center gap-2"><PackageCheck size={16} className="text-nexus-teal" /> หยิบแล้ว (ยังไม่บันทึก)</h3>
        {lines.length === 0 ? <p className="text-[12px] text-white/40">ยังไม่มีรายการ</p> : lines.map((l) => (
          <div key={`${l.location}|${l.productId}`} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-white truncate">{productById.get(l.productId)?.name || l.productId}</p>
              <p className="text-[11px] text-white/40 font-mono">{l.location === UNASSIGNED ? "สต็อกไม่ระบุตำแหน่ง" : l.location}</p>
            </div>
            <span className="font-mono text-white font-bold w-12 text-right">{l.qty}</span>
            <button onClick={() => setLines((prev) => prev.filter((x) => x !== l))} className="w-8 h-8 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center"><Trash2 size={14} /></button>
          </div>
        ))}
        <div className="flex items-center justify-between pt-3 border-t border-white/5">
          <span className="text-[12px] text-white/60 font-bold">รวม {totalQty} ชิ้น</span>
          <PillButton variant="confirm" className="h-9 px-6 font-bold text-xs" disabled={saving || lines.length === 0} onClick={confirm}>
            <CheckCircle2 size={14} className="mr-1.5" /> {saving ? "กำลังบันทึก..." : "ยืนยันเบิก (ตัดสต็อก + ลงต้นทุนขาย)"}
          </PillButton>
        </div>
      </GlassCard>
    </div>
  );

  const right = (
    <GlassCard className="p-5 border-white/10 rounded-3xl space-y-3 h-fit">
      <h3 className="text-[12px] font-semibold uppercase tracking-widest text-white/60">ค้างเบิกตามใบสั่งขาย</h3>
      {remaining.size === 0 && <p className="text-[12px] text-white/40">เบิกครบแล้ว</p>}
      {Array.from(remaining.entries()).map(([productId, qty]) => {
        const p = productById.get(productId);
        const inLines = pickedInLines(productId);
        const spots = balances.filter((b: any) => b.productId === productId && Number(b.quantity) > 0);
        const free = stockAt(productId, UNASSIGNED);
        return (
          <div key={productId} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
            <div className="flex justify-between gap-2">
              <p className="text-[12px] text-white truncate">{p?.name || productId}</p>
              <p className={cn("text-[12px] font-mono font-bold", inLines >= qty ? "text-emerald-400" : "text-warning")}>{inLines}/{qty}</p>
            </div>
            <p className="text-[10px] text-white/40 font-mono">{p?.sku || productId}{p?.barcode ? ` • ${p.barcode}` : ""}</p>
            <div className="flex flex-wrap gap-1 pt-1">
              {spots.map((b: any) => (
                <span key={b.id} className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-nexus-teal/10 text-nexus-teal">{b.location}: {b.quantity}</span>
              ))}
              {free > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/50">ไม่ระบุตำแหน่ง: {free}</span>}
              {spots.length === 0 && free <= 0 && <span className="text-[10px] text-red-400">ไม่มีสต็อก</span>}
            </div>
          </div>
        );
      })}
    </GlassCard>
  );

  return <NexusPageLayout header={header} leftContent={left} rightSidebar={right} />;
}

export default function PickingPage() {
  return (
    <Suspense fallback={<div className="p-10 text-white/40 text-sm">กำลังโหลด...</div>}>
      <PickingScreen />
    </Suspense>
  );
}
