"use client";

import React, { useState } from "react";
import { PillButton, PillInput, GlassCard } from "@/components/ui/Base";
import { 
  Package, 
  Search, 
  Plus, 
  Filter, 
  MoreHorizontal,
  LayoutGrid,
  List,
  Cpu,
  Loader2
} from "lucide-react";
import { cn } from "@/components/ui/Base";
import { AddProductSheet } from "@/components/inventory/AddProductSheet";
import { useInventory } from "@/hooks/useInventory";

export default function InventoryPage() {
  const { products, loading } = useInventory();
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent">
      <AddProductSheet 
        isOpen={isAddSheetOpen} 
        onClose={() => setIsAddSheetOpen(false)} 
      />
      
      {/* Module Header */}
      <header className="p-6 border-b border-white/5 flex items-center justify-between bg-black/20">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-nexus-blue/10 flex items-center justify-center text-nexus-blue">
            <Package size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">คลังสินค้าและพัสดุ</h1>
            <p className="text-xs text-white/40">จัดการรายการพัสดุ สต็อก และจุดสั่งซื้ออัจฉริยะ</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex p-1 bg-white/5 rounded-full border border-white/10">
            <button 
              onClick={() => setViewMode('table')}
              className={cn("p-1.5 rounded-full transition-all", viewMode === 'table' ? "bg-nexus-blue text-black" : "text-white/40 hover:text-white")}
            >
              <List size={16} />
            </button>
            <button 
              onClick={() => setViewMode('grid')}
              className={cn("p-1.5 rounded-full transition-all", viewMode === 'grid' ? "bg-nexus-blue text-black" : "text-white/40 hover:text-white")}
            >
              <LayoutGrid size={16} />
            </button>
          </div>
          <PillButton 
            className="gap-2 shadow-nexus-glow"
            onClick={() => setIsAddSheetOpen(true)}
          >
            <Plus size={18} />
            เพิ่มพัสดุใหม่
          </PillButton>
        </div>
      </header>

      {/* Toolbar */}
      <section className="p-4 border-b border-white/5 bg-black/10 flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative w-72">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={16} />
            <PillInput placeholder="ค้นหา SKU หรือชื่อพัสดุ..." className="w-full pl-11 h-9" />
          </div>
          <PillButton variant="glass" className="gap-2 h-9">
            <Filter size={16} />
            ตัวกรอง
          </PillButton>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs text-white/30 text-nowrap">แสดงผล 1-5 จาก 852 รายการ</span>
          <div className="flex gap-1">
            <PillButton variant="ghost" className="w-8 h-8 px-0 rounded-lg">{"<"}</PillButton>
            <PillButton variant="ghost" className="w-8 h-8 px-0 rounded-lg text-nexus-blue">1</PillButton>
            <PillButton variant="ghost" className="w-8 h-8 px-0 rounded-lg">{">"}</PillButton>
          </div>
        </div>
      </section>

      {/* Content Area */}
      <main className="flex-1 overflow-auto p-6 relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(20,163,204,0.05)_0%,transparent_50%)] pointer-events-none" />
        
        <GlassCard className="p-0 overflow-hidden border-white/5 relative z-10 animate-in fade-in zoom-in-95 duration-500">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-zinc-900/90 backdrop-blur-md z-20 border-b border-white/10">
              <tr>
                <th className="p-4 text-[10px] font-black text-white/30 uppercase tracking-[0.2em] w-40">SKU IDENTIFIER</th>
                <th className="p-4 text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">RESOURCE NAME</th>
                <th className="p-4 text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">CATEGORY</th>
                <th className="p-4 text-[10px] font-black text-white/30 uppercase tracking-[0.2em] text-right">QUANTITY</th>
                <th className="p-4 text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">UNIT</th>
                <th className="p-4 text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">AVAILABILITY</th>
                <th className="p-4 text-[10px] font-black text-white/30 uppercase tracking-[0.2em] text-right">AVG COST (WAC)</th>
                <th className="p-4 text-[10px] font-black text-white/30 uppercase tracking-[0.2em] w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-20 text-center text-white/20">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
                    กำลังดึงข้อมูลพัสดุ...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-20 text-center text-white/20">
                    ไม่พบรายการพัสดุในระบบ
                  </td>
                </tr>
              ) : (
                products.map((item, idx) => (
                  <tr 
                    key={item.id} 
                    style={{ animationDelay: `${idx * 50}ms` }}
                    className="hover:bg-white/[0.03] transition-all group cursor-pointer animate-in fade-in slide-in-from-left-4 duration-500 fill-mode-both"
                  >
                    <td className="p-4 font-mono text-sm text-nexus-blue tracking-tighter group-hover:drop-shadow-[0_0_8px_rgba(20,163,204,0.4)] transition-all">
                      {item.sku}
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-white group-hover:text-nexus-blue transition-colors">{item.name}</div>
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-1 rounded-md bg-white/5 text-[10px] text-white/50 border border-white/10 uppercase">
                        {item.category_id}
                      </span>
                    </td>
                    <td className="p-4 text-right font-bold mono-numbers text-white">{item.currentQty}</td>
                    <td className="p-4 text-white/40 text-sm">{item.unit}</td>
                    <td className="p-4">
                      <div className={cn(
                        "flex items-center gap-1.5 text-[10px] font-bold uppercase",
                        item.currentQty > 0 ? "text-nexus-teal" : "text-danger"
                      )}>
                        <div className={cn("w-1.5 h-1.5 rounded-full", 
                          item.currentQty > 0 ? "bg-nexus-teal shadow-[0_0_8px_rgba(16,187,168,0.5)]" : "bg-danger shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                        )} />
                        {item.currentQty > 0 ? 'In Stock' : 'Out of Stock'}
                      </div>
                    </td>
                    <td className="p-4 text-right mono-numbers text-white/70">
                      {item.pricing?.avg_cost?.toLocaleString() ?? 0}
                    </td>
                    <td className="p-4">
                      <button className="text-white/20 hover:text-white transition-colors">
                        <MoreHorizontal size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </GlassCard>

        {/* AI Insight Card for Inventory */}
        <div className="mt-8">
          <GlassCard className="bg-nexus-blue/5 border-nexus-blue/10 flex items-center justify-between p-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-nexus-blue/20 flex items-center justify-center text-nexus-blue">
                <Cpu size={20} className="animate-pulse" />
              </div>
              <div>
                <p className="text-nexus-blue font-bold text-sm">NEXUS Brain: วิเคราะห์สต็อก</p>
                <p className="text-xs text-white/60">พบ 3 รายการที่ควรสั่งซื้อเพิ่มเพื่อรองรับโปรเจกต์ในเดือนหน้า</p>
              </div>
            </div>
            <PillButton variant="glass" className="h-8 text-xs border-nexus-blue/30 text-nexus-blue">
              ดูรายละเอียดการวิเคราะห์
            </PillButton>
          </GlassCard>
        </div>
      </main>
    </div>
  );
}
