"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { PillButton, PillSelect, cn } from "@/components/ui/Base";
import { QrCode } from "@/components/ui/QrCode";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api-client";
import type { LocationOption } from "@/lib/warehouse-location";

/**
 * ฉลาก QR ตำแหน่งจัดเก็บ — เนื้อหา QR = รหัสตำแหน่ง (เช่น WH-01-A-R01-L2-B03) สแกนในหน้าจัดเก็บ/เบิกได้ทันที
 * ขนาด: สติกเกอร์ (พิมพ์ทีละดวงตามม้วน) หรือ A4 หลายดวงต่อแผ่น
 */
const SIZES = {
  "s50x30": { label: "สติกเกอร์ 50 × 30 มม.", w: 50, h: 30, sheet: false, qr: 24 },
  "s70x40": { label: "สติกเกอร์ 70 × 40 มม.", w: 70, h: 40, sheet: false, qr: 32 },
  "s100x50": { label: "สติกเกอร์ 100 × 50 มม.", w: 100, h: 50, sheet: false, qr: 42 },
  "a4-24": { label: "A4 · 24 ดวง (70 × 37 มม.)", w: 70, h: 37, sheet: true, qr: 28, cols: 3 },
  "a4-10": { label: "A4 · 10 ดวง (105 × 57 มม.)", w: 105, h: 57, sheet: true, qr: 44, cols: 2 },
} as const;
type SizeKey = keyof typeof SIZES;

function Label({ loc, size, ownerName }: { loc: LocationOption; size: (typeof SIZES)[SizeKey]; ownerName?: string }) {
  const parts = [loc.zoneCode && `โซน ${loc.zoneCode}`, loc.rackId && `ชั้นวาง ${loc.rackId}`, loc.level && `ชั้น ${loc.level}`, loc.bin && `ช่อง ${loc.bin}`].filter(Boolean).join(" · ");
  const big = size.h >= 40;
  return (
    <div className="label-item bg-white text-black flex items-center gap-[2mm] overflow-hidden" style={{ width: `${size.w}mm`, height: `${size.h}mm`, padding: "2mm" }}>
      <QrCode value={loc.code} size={`${size.qr}mm`} />
      <div className="min-w-0 flex-1 flex flex-col justify-center gap-[1mm]">
        <p className="font-mono font-black leading-none break-all" style={{ fontSize: big ? "13pt" : "9pt" }}>{loc.code}</p>
        <p className="leading-tight" style={{ fontSize: big ? "8pt" : "6.5pt" }}>{loc.isReceiving ? "พื้นที่รับสินค้า" : parts}</p>
        {ownerName && <p className="leading-tight font-bold truncate" style={{ fontSize: big ? "8pt" : "6.5pt" }}>{ownerName}</p>}
        {big && <p className="leading-tight text-black/60" style={{ fontSize: "7pt" }}>สแกนเพื่อรับเข้า/เบิกจากตำแหน่งนี้</p>}
      </div>
    </div>
  );
}

function LabelsPage() {
  const router = useRouter();
  const search = useSearchParams();
  const { companyId } = useAuth();
  const [data, setData] = useState<any>(null);
  const [wh, setWh] = useState(search?.get("wh") || "");
  const [zone, setZone] = useState(search?.get("zone") || "ALL");
  const [rack, setRack] = useState(search?.get("rack") || "ALL");
  const [size, setSize] = useState<SizeKey>("a4-24");
  const [withRecv, setWithRecv] = useState(false);
  // คลังที่ใช้ร่วมในเครือ: ค่าเริ่มต้นพิมพ์เฉพาะช่องของบริษัทนี้ และพิมพ์ชื่อบริษัทเจ้าของบนฉลาก
  const [onlyMine, setOnlyMine] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    apiFetch("/api/inventory/warehouses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "list" }) })
      .then((r) => r.json()).then((d) => { if (d.success) { setData(d); setWh((x) => x || d.warehouses[0]?.id || ""); } });
  }, [companyId]);

  const whDoc = data?.warehouses.find((w: any) => w.id === wh);
  const whCode = whDoc?.code || "";
  const zones: any[] = whDoc?.zones || [];
  const racks: any[] = zone === "ALL" ? [] : zones.find((z) => z.code === zone)?.racks || [];
  const shown: LocationOption[] = useMemo(() => (data?.locations || []).filter((l: LocationOption) =>
    l.warehouseCode === whCode && (l.isReceiving ? withRecv || zone === "RECV" : zone === "ALL" || (l.zoneCode === zone && (rack === "ALL" || l.rackId === rack)))
    && (!data?.multiCompany || !onlyMine || !l.owner || l.owner === companyId)
  ), [data, whCode, zone, rack, withRecv, onlyMine, companyId]);
  const ownerName = (id: string) => (data?.multiCompany && id ? data.companies.find((c: any) => c.id === id)?.shortName || id : "");
  const s = SIZES[size];

  return (
    <div className="p-6 space-y-4">
      <style>{s.sheet
        ? `@media print { @page { size: A4; margin: 8mm; } }`
        : `@media print { @page { size: ${s.w}mm ${s.h}mm; margin: 0; } .label-item { page-break-after: always; break-after: page; } }`}
      {`@media print {
          body * { visibility: hidden; }
          .labels-print, .labels-print * { visibility: visible; }
          .labels-print { position: absolute; left: 0; top: 0; background: white; }
        }`}</style>

      <div className="flex flex-wrap items-center justify-between gap-3 bg-white/[0.02] border border-white/5 p-4 rounded-3xl print:hidden">
        <div className="flex items-center gap-3">
          <PillButton variant="glass" onClick={() => router.push("/inventory/locations")} className="w-10 h-10 p-0 flex items-center justify-center"><ArrowLeft size={20} /></PillButton>
          <div>
            <h1 className="text-xl font-semibold text-white">พิมพ์ฉลาก QR ตำแหน่งจัดเก็บ</h1>
            <p className="text-[13px] text-white/50">ติดฉลากที่ช่องของชั้นวาง แล้วสแกนในหน้าจัดเก็บสินค้าเพื่อรับเข้าชั้น</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <PillSelect value={wh} onChange={(e) => { setWh(e.target.value); setZone("ALL"); setRack("ALL"); }} className="h-9 px-4 w-[200px] text-sm">
            {(data?.warehouses || []).map((w: any) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}
          </PillSelect>
          <PillSelect value={zone} onChange={(e) => { setZone(e.target.value); setRack("ALL"); }} className="h-9 px-4 w-[170px] text-sm">
            <option value="ALL">ทุกโซน</option>
            <option value="RECV">พื้นที่รับสินค้า</option>
            {zones.map((z) => <option key={z.code} value={z.code}>โซน {z.code}{z.name ? ` · ${z.name}` : ""}</option>)}
          </PillSelect>
          {zone !== "ALL" && zone !== "RECV" && (
            <PillSelect value={rack} onChange={(e) => setRack(e.target.value)} className="h-9 px-4 w-[160px] text-sm">
              <option value="ALL">ทุกชั้นวาง</option>
              {racks.map((r) => <option key={r.code} value={r.code}>{r.code}{r.name ? ` · ${r.name}` : ""}</option>)}
            </PillSelect>
          )}
          <PillSelect value={size} onChange={(e) => setSize(e.target.value as SizeKey)} className="h-9 px-4 w-[230px] text-sm">
            {Object.entries(SIZES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </PillSelect>
          {zone === "ALL" && (
            <label className="flex items-center gap-1.5 text-[13px] text-white/70"><input type="checkbox" checked={withRecv} onChange={(e) => setWithRecv(e.target.checked)} /> รวมพื้นที่รับสินค้า</label>
          )}
          {data?.multiCompany && (
            <label className="flex items-center gap-1.5 text-[13px] text-white/70"><input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} /> เฉพาะช่องของบริษัทนี้</label>
          )}
          <PillButton variant="primary" className="h-9 px-5 text-xs font-bold" onClick={() => window.print()} disabled={shown.length === 0}><Printer size={14} className="mr-1.5" /> พิมพ์ {shown.length} ดวง</PillButton>
        </div>
      </div>

      {!data ? <p className="text-white/40 text-sm">กำลังโหลด…</p> : shown.length === 0 ? (
        <p className="text-white/40 text-sm">ยังไม่มีตำแหน่งจัดเก็บในตัวเลือกนี้ สร้างผังชั้นวางที่หน้า &quot;ผังคลังและชั้นวาง&quot; ก่อน</p>
      ) : (
        <div className="labels-print">
          <div className={cn(s.sheet ? "grid gap-0" : "flex flex-wrap gap-3 print:block")} style={s.sheet ? { gridTemplateColumns: `repeat(${(s as any).cols}, ${s.w}mm)` } : undefined}>
            {shown.map((l) => (
              <div key={l.code} className={cn(!s.sheet && "print:m-0", s.sheet && "outline outline-1 outline-black/10 print:outline-0")}>
                <Label loc={l} size={s} ownerName={ownerName(l.owner)} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function LocationLabelsPage() {
  return <Suspense fallback={<div className="p-6 text-white/40 text-sm">กำลังโหลด…</div>}><LabelsPage /></Suspense>;
}
