"use client";

import React from "react";
import Link from "next/link";
import { Star, Truck } from "lucide-react";
import { GlassCard } from "@/components/ui/Base";
import { useSuppliers } from "@/hooks/useCustomers";

/** ผู้ขายของสินค้า (supplierConfig ของบริษัท) — เพิ่ม/แก้ที่หน้าผู้ขาย › สินค้าที่ขาย */
export function ProductSuppliersBox({ config }: { config?: any[] }) {
  const { data: suppliers } = useSuppliers<any>({ includeGroupOnly: true });
  const list = (Array.isArray(config) ? config : []).filter((c) => c?.supplierId);
  const nameOf = (id: string) => {
    const s = suppliers.find((x: any) => x.id === id);
    return s ? String(s.name || s.supplierName || id) : id;
  };
  return (
    <GlassCard className="p-4 border-white/5 space-y-3">
      <div className="flex items-center gap-2">
        <Truck size={14} className="text-nexus-teal" />
        <h4 className="text-[12px] font-bold text-white/80 uppercase tracking-widest">ผู้ขายสินค้านี้ ({list.length})</h4>
      </div>
      {list.length ? (
        <div className="space-y-1.5">
          {list.map((c) => (
            <Link key={c.supplierId} href={`/procurement/suppliers/${encodeURIComponent(c.supplierId)}`} className="flex items-center gap-2 text-[12px] rounded-lg px-2 py-1.5 hover:bg-white/5">
              {c.isPrimary ? <Star size={12} className="text-amber-300 shrink-0" /> : <span className="w-3 shrink-0" />}
              <span className="truncate flex-1 text-white/85">{nameOf(c.supplierId)}</span>
              <span className="font-mono text-white/60 shrink-0">{Number(c.latestCost || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-[12px] text-white/50">ยังไม่ได้ระบุผู้ขาย — เชื่อมได้ที่หน้าผู้ขาย › สินค้าที่ขาย</p>
      )}
    </GlassCard>
  );
}
