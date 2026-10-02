"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import JsBarcode from "jsbarcode";
import { ArrowLeft, Printer } from "lucide-react";
import { PillButton, PillSelect } from "@/components/ui/Base";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { listLocations, LocationOption } from "@/lib/warehouse-location";

/** ฉลากบาร์โค้ด Code128 ของตำแหน่งจัดเก็บ (เนื้อหาบาร์โค้ด = รหัสตำแหน่ง เช่น WH-01-A1-L2) */
function LocationLabel({ location }: { location: LocationOption }) {
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (svgRef.current) {
      JsBarcode(svgRef.current, location.code, { format: "CODE128", width: 2, height: 56, displayValue: false, margin: 0 });
    }
  }, [location.code]);

  return (
    <div className="label-card break-inside-avoid rounded-xl border border-black/20 bg-white text-black p-3 flex flex-col items-center gap-1">
      <svg ref={svgRef} className="max-w-full" />
      <p className="font-mono font-black text-[18px] tracking-wider">{location.code}</p>
      <p className="text-[11px] text-black/60">{location.label}</p>
    </div>
  );
}

export default function LocationLabelsPage() {
  const router = useRouter();
  const { data: warehouses, loading } = useRealtimeCollection<any>("warehouses");
  const locations = useMemo(() => listLocations(warehouses), [warehouses]);
  const racks = Array.from(new Set(locations.filter((l) => l.rackId).map((l) => l.rackId as string)));
  const [rackFilter, setRackFilter] = useState("ALL");

  const shown = locations.filter((l) =>
    rackFilter === "ALL" ? true : rackFilter === "RECV" ? l.isReceiving : l.rackId === rackFilter
  );

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .labels-print, .labels-print * { visibility: visible; }
          .labels-print { position: absolute; inset: 0; padding: 8mm; background: white; }
          .label-card { border: 1px solid #000; }
        }
      `}</style>

      <div className="flex flex-wrap items-center justify-between gap-3 bg-white/[0.02] border border-white/5 p-4 rounded-3xl print:hidden">
        <div className="flex items-center gap-3">
          <PillButton variant="glass" onClick={() => router.back()} className="w-10 h-10 p-0 flex items-center justify-center">
            <ArrowLeft size={20} />
          </PillButton>
          <div>
            <h1 className="text-xl font-semibold text-white">ฉลากบาร์โค้ดตำแหน่งจัดเก็บ</h1>
            <p className="text-[12px] text-white/50">ติดที่ชั้นวางแต่ละชั้น ใช้ยิงในหน้าจัดเก็บเข้าชั้น ({shown.length} ฉลาก)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PillSelect value={rackFilter} onChange={(e) => setRackFilter(e.target.value)} className="h-9 rounded-full px-5 text-[13px] font-bold">
            <option value="ALL">ทุกตำแหน่ง</option>
            <option value="RECV">พื้นที่รับสินค้า</option>
            {racks.map((r) => <option key={r} value={r}>ชั้นวาง {r}</option>)}
          </PillSelect>
          <PillButton variant="confirm" className="h-9 px-5 text-xs font-bold" onClick={() => window.print()} disabled={shown.length === 0}>
            <Printer size={14} className="mr-1.5" /> พิมพ์
          </PillButton>
        </div>
      </div>

      {loading ? (
        <p className="text-white/40 text-sm">กำลังโหลด...</p>
      ) : shown.length === 0 ? (
        <p className="text-white/50 text-sm">ยังไม่มีตำแหน่ง: สร้างชั้นวางในผังคลัง (หน้าคลังสินค้า → ผังคลัง 3D → โหมดแก้ไข) ก่อน</p>
      ) : (
        <div className="labels-print grid grid-cols-2 md:grid-cols-3 gap-3">
          {shown.map((l) => <LocationLabel key={l.code} location={l} />)}
        </div>
      )}
    </div>
  );
}
