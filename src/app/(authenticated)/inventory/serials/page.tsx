"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Barcode } from "lucide-react";
import { GlassCard, NexusSearchInput, NexusTable, NexusTableCell, NexusTableRow, PillSelect, StatusBadge } from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { SERIAL_STATUS, toMs, warrantyState } from "@/lib/serials";

const thDate = (v: any) => { const t = toMs(v); return t ? new Date(t).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" }) : "-"; };

export default function SerialListPage() {
  const router = useRouter();
  const { companyId } = useAuth();
  const { data: serials, loading } = useRealtimeCollection<any>(companyId ? `companies/${companyId}/serial_numbers` : "", [], false);
  const { data: products } = useRealtimeCollection<any>("products");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");

  const productName = useMemo(() => new Map(products.map((p: any) => [p.id, p.name || p.productName || p.sku || p.id])), [products]);
  const term = q.trim().toLowerCase();
  const rows = serials
    .filter((s: any) => status === "ALL" || (s.status || "available") === status)
    .filter((s: any) => !term || [s.id, s.sn, productName.get(s.productId), s.lastReference, s.lastLocation].some((v) => String(v || "").toLowerCase().includes(term)))
    .sort((a: any, b: any) => toMs(b.updatedAt) - toMs(a.updatedAt));

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent">
      <header className="px-6 py-2.5 min-h-[60px] border-b border-white/5 flex items-center gap-3 bg-black/20 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/10"><Barcode size={20} /></div>
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight leading-none">หมายเลขเครื่อง (Serial)</h1>
          <p className="text-xs font-semibold text-white/60 mt-1 leading-none">ติดตามสถานะและประวัติการเคลื่อนไหวของสินค้ารายเครื่อง</p>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-5 max-w-[1800px] mx-auto space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <NexusSearchInput placeholder="ค้นหาหมายเลขเครื่อง สินค้า หรือเอกสารอ้างอิง..." value={q} onChange={(e) => setQ(e.target.value)} kbd="F" className="flex-1 min-w-[240px]" />
            <PillSelect value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 w-[190px] text-sm">
              <option value="ALL">ทุกสถานะ</option>
              {Object.entries(SERIAL_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </PillSelect>
          </div>
          <GlassCard accentColor="teal" className="p-2 min-h-[560px]">
            <NexusTable headers={["หมายเลขเครื่อง", "สินค้า", "ตำแหน่งล่าสุด", "เอกสารอ้างอิง", "การรับประกัน", "อัปเดตล่าสุด", "สถานะ"]}>
              {loading && <NexusTableRow><NexusTableCell colSpan={7} className="text-center py-10 text-white/40">กำลังโหลด...</NexusTableCell></NexusTableRow>}
              {!loading && !rows.length && <NexusTableRow><NexusTableCell colSpan={7} className="text-center py-10 text-white/40">ยังไม่มีหมายเลขเครื่อง (ระบบบันทึกให้อัตโนมัติเมื่อรับหรือเบิกสินค้าที่ระบุหมายเลขเครื่อง)</NexusTableCell></NexusTableRow>}
              {rows.map((s: any) => {
                const st = SERIAL_STATUS[s.status || "available"] || SERIAL_STATUS.available;
                const w = warrantyState(s);
                return (
                  <NexusTableRow key={s.id} onClick={() => router.push(`/inventory/serials/${encodeURIComponent(s.id)}`)}>
                    <NexusTableCell className="font-mono text-[13px] text-nexus-blue">{s.sn || s.id}</NexusTableCell>
                    <NexusTableCell className="font-bold text-white/80">{productName.get(s.productId) || s.productId || "-"}</NexusTableCell>
                    <NexusTableCell className="text-white/60">{s.lastLocation || s.location || "-"}</NexusTableCell>
                    <NexusTableCell className="font-mono text-[13px] text-white/60">{s.lastReference || "-"}</NexusTableCell>
                    <NexusTableCell><span className={`text-[12px] font-bold ${w.tone}`}>{w.label}</span></NexusTableCell>
                    <NexusTableCell className="text-white/60">{thDate(s.updatedAt)}</NexusTableCell>
                    <NexusTableCell><StatusBadge status={st.badge} label={st.label} /></NexusTableCell>
                  </NexusTableRow>
                );
              })}
            </NexusTable>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
