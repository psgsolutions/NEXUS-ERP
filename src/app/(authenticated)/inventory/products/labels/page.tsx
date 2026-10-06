"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import JsBarcode from "jsbarcode";
import { ArrowLeft, Printer, Search } from "lucide-react";
import { PillButton, PillInput } from "@/components/ui/Base";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";

/** รหัสบนฉลาก: ใช้บาร์โค้ดจากโรงงานถ้ามี ไม่มีใช้ SKU (ระบบยิงจับคู่ได้ทั้งคู่) */
const labelCode = (p: any) => String(p.barcode || p.sku || p.id);

function ProductLabel({ product }: { product: any }) {
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (svgRef.current) {
      JsBarcode(svgRef.current, labelCode(product), { format: "CODE128", width: 1.6, height: 40, displayValue: false, margin: 0 });
    }
  }, [product]);
  return (
    <div className="label-card break-inside-avoid rounded-lg border border-black/20 bg-white text-black p-2 flex flex-col items-center gap-0.5">
      <p className="text-[11px] font-bold text-center leading-tight line-clamp-2">{product.name || product.productName}</p>
      <svg ref={svgRef} className="max-w-full" />
      <p className="font-mono text-[11px] tracking-wider">{labelCode(product)}</p>
    </div>
  );
}

export default function ProductLabelsPage() {
  const router = useRouter();
  const { data: products, loading } = useRealtimeCollection<any>("products");
  const [search, setSearch] = useState("");
  const [copies, setCopies] = useState<Record<string, number>>({});

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter((p: any) => !q || [p.name, p.sku, p.barcode, p.brand].some((v) => String(v || "").toLowerCase().includes(q)))
      .sort((a: any, b: any) => String(a.name).localeCompare(String(b.name), "th"));
  }, [products, search]);

  const toPrint = products.flatMap((p: any) => Array.from({ length: copies[p.id] || 0 }, (_, i) => ({ key: `${p.id}-${i}`, product: p })));
  const setCopy = (id: string, n: number) => setCopies((prev) => ({ ...prev, [id]: Math.max(0, Math.min(500, Math.floor(n) || 0)) }));

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .labels-print, .labels-print * { visibility: visible; }
          .labels-print { position: absolute; inset: 0; padding: 6mm; background: white; }
          .label-card { border: 1px solid #000; }
        }
      `}</style>

      <div className="flex flex-wrap items-center justify-between gap-3 bg-white/[0.02] border border-white/5 p-4 rounded-3xl print:hidden">
        <div className="flex items-center gap-3">
          <PillButton variant="glass" onClick={() => router.back()} className="w-10 h-10 p-0 flex items-center justify-center">
            <ArrowLeft size={20} />
          </PillButton>
          <div>
            <h1 className="text-xl font-semibold text-white">ฉลากบาร์โค้ดสินค้า</h1>
            <p className="text-[12px] text-white/50">ใช้บาร์โค้ดจากโรงงานถ้ามี ไม่มีจะพิมพ์รหัส SKU — ระบุจำนวนดวงต่อสินค้า ({toPrint.length} ดวง)</p>
          </div>
        </div>
        <PillButton variant="confirm" className="h-9 px-5 text-xs font-bold" onClick={() => window.print()} disabled={toPrint.length === 0}>
          <Printer size={14} className="mr-1.5" /> พิมพ์ {toPrint.length} ดวง
        </PillButton>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 print:block">
        <div className="space-y-3 print:hidden">
          <div className="relative">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
            <PillInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาชื่อ / SKU / บาร์โค้ด / ยี่ห้อ" className="w-full h-9 pl-10 rounded-full" />
          </div>
          {loading && <p className="text-white/40 text-sm">กำลังโหลด...</p>}
          <div className="space-y-1.5 max-h-[70vh] overflow-y-auto pr-1">
            {filtered.map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-white truncate">{p.name}</p>
                  <p className="text-[11px] text-white/40 font-mono">{p.sku}{p.barcode ? ` • ${p.barcode}` : " • (ไม่มีบาร์โค้ด ใช้ SKU)"}</p>
                </div>
                <PillInput
                  type="number"
                  min={0}
                  value={copies[p.id] || 0}
                  onChange={(e) => setCopy(p.id, Number(e.target.value))}
                  className="w-20 h-9 rounded-full text-center font-mono"
                  title="จำนวนดวง"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="labels-print grid grid-cols-3 md:grid-cols-4 gap-2 content-start">
          {toPrint.length === 0
            ? <p className="text-white/40 text-sm print:hidden">ใส่จำนวนดวงที่สินค้าด้านซ้ายเพื่อดูตัวอย่าง</p>
            : toPrint.map(({ key, product }) => <ProductLabel key={key} product={product} />)}
        </div>
      </div>
    </div>
  );
}
