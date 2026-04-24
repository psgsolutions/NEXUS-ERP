"use client";

import React, { useState } from "react";
import { PillButton, PillInput, GlassCard } from "@/components/ui/Base";
import { 
  Package, 
  Search, 
  Plus, 
  Filter, 
  ArrowUpDown, 
  MoreHorizontal,
  ChevronRight,
  LayoutGrid,
  List,
  Cpu
} from "lucide-react";
import { cn } from "@/components/ui/Base";

// Mock Data for UI ready state
const MOCK_INVENTORY = [
  { id: "SKU-24-001", name: "Cisco Catalyst 9200L", category: "Network Switch", qty: 15, unit: "Unit", status: "In Stock", cost: 125000 },
  { id: "SKU-24-002", name: "Ubiquiti UniFi 6 Pro", category: "Access Point", qty: 42, unit: "Unit", status: "In Stock", cost: 5800 },
  { id: "SKU-24-003", name: "MikroTik CCR2004", category: "Router", qty: 5, unit: "Unit", status: "Low Stock", cost: 18500 },
  { id: "SKU-24-004", name: "Fiber Optic Patch Cord", category: "Cabling", qty: 120, unit: "Pcs", status: "In Stock", cost: 150 },
  { id: "SKU-24-005", name: "Dell PowerEdge R750", category: "Server", qty: 2, unit: "Unit", status: "Reserved", cost: 450000 },
];

export default function InventoryPage() {
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[#09090b]/40 backdrop-blur-sm">
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
          <PillButton className="gap-2 shadow-nexus-glow">
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
          <span className="text-xs text-white/30">แสดงผล 1-5 จาก 852 รายการ</span>
          <div className="flex gap-1">
            <PillButton variant="ghost" className="w-8 h-8 px-0 rounded-lg">{"<"}</PillButton>
            <PillButton variant="ghost" className="w-8 h-8 px-0 rounded-lg text-nexus-blue">1</PillButton>
            <PillButton variant="ghost" className="w-8 h-8 px-0 rounded-lg">{">"}</PillButton>
          </div>
        </div>
      </section>

      {/* Content Area */}
      <main className="flex-1 overflow-auto p-6">
        <GlassCard className="p-0 overflow-hidden border-white/5">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-zinc-900/90 backdrop-blur-md z-10 border-b border-white/10">
              <tr>
                <th className="p-4 text-xs font-bold text-white/40 uppercase tracking-widest w-40">รหัส SKU</th>
                <th className="p-4 text-xs font-bold text-white/40 uppercase tracking-widest">รายการพัสดุ</th>
                <th className="p-4 text-xs font-bold text-white/40 uppercase tracking-widest">หมวดหมู่</th>
                <th className="p-4 text-xs font-bold text-white/40 uppercase tracking-widest text-right">จำนวน</th>
                <th className="p-4 text-xs font-bold text-white/40 uppercase tracking-widest">หน่วย</th>
                <th className="p-4 text-xs font-bold text-white/40 uppercase tracking-widest">สถานะ</th>
                <th className="p-4 text-xs font-bold text-white/40 uppercase tracking-widest text-right">ต้นทุนเฉลี่ย</th>
                <th className="p-4 text-xs font-bold text-white/40 uppercase tracking-widest w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {MOCK_INVENTORY.map((item) => (
                <tr key={item.id} className="hover:bg-white/[0.02] transition-colors group cursor-pointer">
                  <td className="p-4 font-mono text-sm text-nexus-blue tracking-tighter">{item.id}</td>
                  <td className="p-4">
                    <div className="font-medium text-white group-hover:text-nexus-blue transition-colors">{item.name}</div>
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-1 rounded-md bg-white/5 text-[10px] text-white/50 border border-white/10 uppercase">
                      {item.category}
                    </span>
                  </td>
                  <td className="p-4 text-right font-bold mono-numbers text-white">{item.qty}</td>
                  <td className="p-4 text-white/40 text-sm">{item.unit}</td>
                  <td className="p-4">
                    <div className={cn(
                      "flex items-center gap-1.5 text-[10px] font-bold uppercase",
                      item.status === 'In Stock' ? "text-nexus-teal" : 
                      item.status === 'Low Stock' ? "text-warning" : "text-white/30"
                    )}>
                      <div className={cn("w-1.5 h-1.5 rounded-full", 
                        item.status === 'In Stock' ? "bg-nexus-teal shadow-[0_0_8px_rgba(16,187,168,0.5)]" : 
                        item.status === 'Low Stock' ? "bg-warning" : "bg-white/30"
                      )} />
                      {item.status}
                    </div>
                  </td>
                  <td className="p-4 text-right mono-numbers text-white/70">
                    {item.cost.toLocaleString()}
                  </td>
                  <td className="p-4">
                    <button className="text-white/20 hover:text-white transition-colors">
                      <MoreHorizontal size={16} />
                    </button>
                  </td>
                </tr>
              ))}
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
