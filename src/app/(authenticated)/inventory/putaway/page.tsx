"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ScanLine, MapPin, Package, Trash2, CheckCircle2, AlertTriangle, Printer, Minus, Plus } from "lucide-react";
import { PillButton, PillInput, PillSelect, GlassCard, cn } from "@/components/ui/Base";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { apiFetch } from "@/lib/api-client";
import {
  listLocations, findLocation, findProductByScan, receivingLocation, warehouseCode, UNASSIGNED, LocationOption,
} from "@/lib/warehouse-location";

type Line = { productId: string; name: string; sku: string; qty: number };
type Feedback = { type: "ok" | "error" | "info"; text: string } | null;

export default function PutawayPage() {
  const router = useRouter();
  const { companyId } = useAuth();

  const { data: warehouses, loading: whLoading } = useRealtimeCollection<any>("warehouses");
  const { data: products } = useRealtimeCollection<any>("products");
  const { data: balances } = useRealtimeCollection<any>(`companies/${companyId}/inventory_balance`);

  const locations = useMemo(() => listLocations(warehouses), [warehouses]);
  const rackLocations = locations.filter((l) => !l.isReceiving);

  const [source, setSource] = useState<string>("");
  const [target, setTarget] = useState<LocationOption | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [scan, setScan] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [saving, setSaving] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);

  // ค่าเริ่มต้นต้นทาง = พื้นที่รับสินค้าของคลังแรก
  useEffect(() => {
    if (!source && warehouses.length > 0) setSource(receivingLocation(warehouseCode(warehouses[0])));
  }, [warehouses, source]);

  const focusScan = () => { setTimeout(() => scanRef.current?.focus(), 0); };
  useEffect(() => { focusScan(); }, []);

  // จำนวนที่ย้ายได้จากต้นทาง ต่อสินค้า
  const availableAtSource = useMemo(() => {
    const map = new Map<string, number>();
    if (source === UNASSIGNED) {
      const located = new Map<string, number>();
      balances.forEach((b: any) => located.set(b.productId, (located.get(b.productId) || 0) + (Number(b.quantity) || 0)));
      products.forEach((p: any) => {
        const free = (Number(p.stockStatus?.onHand) || 0) - (located.get(p.id) || 0);
        if (free > 0) map.set(p.id, free);
      });
    } else {
      balances.filter((b: any) => b.location === source && Number(b.quantity) > 0)
        .forEach((b: any) => map.set(b.productId, Number(b.quantity)));
    }
    return map;
  }, [source, balances, products]);

  const productById = useMemo(() => new Map(products.map((p: any) => [p.id, p])), [products]);
  const sourceItems = Array.from(availableAtSource.entries())
    .map(([productId, qty]) => ({ productId, qty, product: productById.get(productId) }))
    .filter((x) => x.product)
    .sort((a, b) => String(a.product.name).localeCompare(String(b.product.name), "th"));

  const addProduct = (product: any, qty = 1) => {
    const available = availableAtSource.get(product.id) || 0;
    const current = lines.find((l) => l.productId === product.id)?.qty || 0;
    if (current + qty > available) {
      setFeedback({ type: "error", text: `${product.name}: ที่ต้นทางมี ${available} ชิ้น (สแกนไปแล้ว ${current})` });
      return;
    }
    setLines((prev) => {
      const exists = prev.find((l) => l.productId === product.id);
      if (exists) return prev.map((l) => l.productId === product.id ? { ...l, qty: l.qty + qty } : l);
      return [...prev, { productId: product.id, name: product.name || product.id, sku: product.sku || "", qty }];
    });
    setFeedback({ type: "ok", text: `+${qty} ${product.name}` });
  };

  // ช่องยิง/คีย์: บาร์โค้ดชั้นวาง → ตั้งปลายทาง, บาร์โค้ดสินค้า → +1
  const handleScan = (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    const location = findLocation(locations, value);
    if (location) {
      if (location.code === source) {
        setFeedback({ type: "error", text: "ตำแหน่งนี้เป็นต้นทาง กรุณายิงชั้นวางปลายทาง" });
      } else {
        setTarget(location);
        setFeedback({ type: "info", text: `ปลายทาง: ${location.code} — ยิงสินค้าที่นำไปวางได้เลย` });
      }
      return;
    }
    const product = findProductByScan(products, value);
    if (product) {
      if (!target) {
        setFeedback({ type: "error", text: "ยิงบาร์โค้ดชั้นวางก่อน แล้วค่อยยิงสินค้า" });
        return;
      }
      addProduct(product);
      return;
    }
    setFeedback({ type: "error", text: `ไม่พบตำแหน่งหรือสินค้า "${value}"` });
  };

  const setLineQty = (productId: string, qty: number) => {
    const available = availableAtSource.get(productId) || 0;
    const safe = Math.max(0, Math.min(available, Math.floor(qty) || 0));
    setLines((prev) => safe === 0 ? prev.filter((l) => l.productId !== productId) : prev.map((l) => l.productId === productId ? { ...l, qty: safe } : l));
  };

  const confirm = async () => {
    if (!companyId || !target || lines.length === 0) return;
    setSaving(true);
    try {
      const res = await apiFetch("/api/inventory/putaway", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, fromLocation: source, toLocation: target.code, lines: lines.map((l) => ({ productId: l.productId, qty: l.qty })) }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "จัดเก็บไม่สำเร็จ");
      const total = lines.reduce((s, l) => s + l.qty, 0);
      setFeedback({ type: "ok", text: `จัดเก็บ ${total} ชิ้น (${lines.length} รายการ) เข้า ${target.code} เรียบร้อย` });
      setLines([]);
      setTarget(null);
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message });
    } finally {
      setSaving(false);
      focusScan();
    }
  };

  const totalQty = lines.reduce((s, l) => s + l.qty, 0);
  const sourceOptions = [
    ...locations.map((l) => ({ value: l.code, label: l.isReceiving ? `${l.label} (${l.code})` : `${l.code}` })),
    { value: UNASSIGNED, label: "สต็อกเดิมที่ยังไม่ระบุตำแหน่ง" },
  ];

  const header = (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-6 rounded-3xl backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <PillButton variant="glass" onClick={() => router.push("/inventory")} className="w-10 h-10 p-0 flex items-center justify-center">
          <ArrowLeft size={20} />
        </PillButton>
        <div>
          <h1 className="text-2xl font-semibold text-white uppercase tracking-tight">จัดเก็บเข้าชั้นวาง (Put-away)</h1>
          <p className="text-sm text-white/60 font-medium mt-1">ยิงบาร์โค้ดชั้นวาง แล้วยิงสินค้าที่นำไปวาง (ยิงซ้ำ = +1) — โอนย้ายภายใน ไม่กระทบบัญชีและต้นทุน</p>
        </div>
      </div>
      <PillButton variant="glass" className="h-8 px-4 text-xs font-bold" onClick={() => router.push("/inventory/locations/labels")}>
        <Printer size={14} className="mr-1.5" /> พิมพ์ฉลากชั้นวาง
      </PillButton>
    </div>
  );

  if (!whLoading && warehouses.length === 0) {
    return <NexusPageLayout header={header} leftContent={<p className="p-6 text-white/50 text-sm">ยังไม่มีคลังสินค้า กรุณาสร้างคลังและวาดผังชั้นวางที่หน้าคลังสินค้าก่อน</p>} />;
  }

  const left = (
    <div className="space-y-4 pb-10">
      <GlassCard className="p-5 space-y-4 border-white/10 rounded-3xl">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[12px] font-bold text-white/70">ต้นทาง</label>
            <PillSelect value={source} onChange={(e) => { setSource(e.target.value); setLines([]); setTarget(null); focusScan(); }} className="w-full h-9 rounded-full px-5 text-[13px] font-bold">
              {sourceOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </PillSelect>
          </div>
          <div className="space-y-2">
            <label className="text-[12px] font-bold text-white/70">ปลายทาง (ยิงบาร์โค้ดชั้นวาง หรือเลือก)</label>
            <PillSelect value={target?.code || ""} onChange={(e) => { setTarget(rackLocations.find((l) => l.code === e.target.value) || null); focusScan(); }} className={cn("w-full h-9 rounded-full px-5 text-[13px] font-bold", target ? "text-nexus-teal" : "")}>
              <option value="">{rackLocations.length === 0 ? "ยังไม่มีชั้นวางในผังคลัง" : "-- ยิงหรือเลือกชั้นวาง --"}</option>
              {rackLocations.filter((l) => l.code !== source).map((l) => <option key={l.code} value={l.code}>{l.code} • {l.label}</option>)}
            </PillSelect>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[12px] font-bold text-white/70 flex items-center gap-2"><ScanLine size={14} className="text-nexus-teal" /> ช่องยิงบาร์โค้ด / คีย์รหัส แล้วกด Enter</label>
          <PillInput
            ref={scanRef as any}
            value={scan}
            onChange={(e) => setScan(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleScan(scan); setScan(""); } }}
            placeholder={target ? "ยิงสินค้า (บาร์โค้ด / SKU)" : "ยิงบาร์โค้ดชั้นวาง เช่น WH-01-A1-L2"}
            className="w-full h-12 rounded-2xl px-5 text-[16px] font-mono"
            autoComplete="off"
          />
          {feedback && (
            <div className={cn("p-3 rounded-xl text-[13px] font-bold flex items-center gap-2",
              feedback.type === "ok" && "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400",
              feedback.type === "error" && "bg-red-500/10 border border-red-500/30 text-red-400",
              feedback.type === "info" && "bg-cyan-500/10 border border-cyan-500/30 text-cyan-300")}>
              {feedback.type === "error" ? <AlertTriangle size={16} /> : feedback.type === "ok" ? <CheckCircle2 size={16} /> : <MapPin size={16} />}
              {feedback.text}
            </div>
          )}
        </div>
      </GlassCard>

      <GlassCard className="p-5 space-y-3 border-white/10 rounded-3xl">
        <h3 className="text-[13px] font-semibold uppercase tracking-widest text-white/80 flex items-center gap-2">
          <Package size={16} className="text-nexus-teal" /> รายการที่จะวางเข้า {target ? <span className="text-nexus-teal font-mono">{target.code}</span> : "-"}
        </h3>
        {lines.length === 0 ? (
          <p className="text-[12px] text-white/40">ยังไม่มีรายการ ยิงสินค้าหรือกด + จากรายการที่ต้นทางด้านขวา</p>
        ) : lines.map((l) => (
          <div key={l.productId} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-white truncate">{l.name}</p>
              <p className="text-[11px] text-white/40 font-mono">{l.sku} • ที่ต้นทาง {availableAtSource.get(l.productId) || 0}</p>
            </div>
            <button onClick={() => setLineQty(l.productId, l.qty - 1)} className="w-8 h-8 rounded-full bg-white/5 text-white flex items-center justify-center"><Minus size={14} /></button>
            <input type="number" value={l.qty} onChange={(e) => setLineQty(l.productId, Number(e.target.value))} className="w-16 h-8 text-center rounded-lg bg-black/40 border border-white/10 text-white font-mono" />
            <button onClick={() => setLineQty(l.productId, l.qty + 1)} className="w-8 h-8 rounded-full bg-white/5 text-white flex items-center justify-center"><Plus size={14} /></button>
            <button onClick={() => setLineQty(l.productId, 0)} className="w-8 h-8 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center"><Trash2 size={14} /></button>
          </div>
        ))}
        <div className="flex items-center justify-between pt-3 border-t border-white/5">
          <span className="text-[12px] text-white/60 font-bold">รวม {totalQty} ชิ้น • {lines.length} รายการ</span>
          <PillButton variant="confirm" className="h-9 px-6 font-bold text-xs" disabled={saving || !target || lines.length === 0} onClick={confirm}>
            <CheckCircle2 size={14} className="mr-1.5" /> {saving ? "กำลังบันทึก..." : "ยืนยันจัดเก็บ"}
          </PillButton>
        </div>
      </GlassCard>
    </div>
  );

  const right = (
    <GlassCard className="p-5 border-white/10 rounded-3xl space-y-3 h-fit">
      <h3 className="text-[12px] font-semibold uppercase tracking-widest text-white/60">สินค้าที่ต้นทาง ({sourceItems.length})</h3>
      {sourceItems.length === 0 && <p className="text-[12px] text-white/40">ไม่มีสินค้ารอจัดเก็บที่ต้นทางนี้</p>}
      <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
        {sourceItems.map(({ productId, qty, product }) => (
          <div key={productId} className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/5">
            <div className="flex-1 min-w-0">
              <p className="text-[12px] text-white truncate">{product.name}</p>
              <p className="text-[10px] text-white/40 font-mono">{product.sku || productId} • {qty.toLocaleString()} {product.unit || ""}</p>
            </div>
            <button
              disabled={!target}
              onClick={() => { addProduct(product); focusScan(); }}
              className="w-7 h-7 rounded-full bg-nexus-teal/15 text-nexus-teal disabled:opacity-30 flex items-center justify-center"
              title={target ? "เพิ่ม 1" : "เลือกปลายทางก่อน"}
            >
              <Plus size={13} />
            </button>
          </div>
        ))}
      </div>
    </GlassCard>
  );

  return <NexusPageLayout header={header} leftContent={left} rightSidebar={right} />;
}
