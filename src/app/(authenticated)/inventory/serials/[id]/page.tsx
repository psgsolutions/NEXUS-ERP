"use client";

import React, { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { where } from "firebase/firestore";
import { ArrowLeft } from "lucide-react";
import { GlassCard, NexusTable, NexusTableCell, NexusTableRow, PillButton, StatusBadge, cn } from "@/components/ui/Base";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { useRealtimeDocument } from "@/hooks/useRealtimeDocument";
import { SERIAL_STATUS, toMs, warrantyState } from "@/lib/serials";

const thDate = (v: any, time = false) => {
  const t = toMs(v);
  return t ? new Date(t).toLocaleString("th-TH", time ? { day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short", year: "numeric" }) : "-";
};
const MOVE_TH: Record<string, { label: string; tone: string }> = {
  IN: { label: "รับเข้า", tone: "text-nexus-teal" },
  OUT: { label: "เบิกออก", tone: "text-warning" },
  TRANSFER: { label: "โอนย้าย", tone: "text-nexus-blue" },
};

export default function SerialDetailPage() {
  const router = useRouter();
  const sn = decodeURIComponent(String(useParams()?.id || ""));
  const { companyId } = useAuth();
  const { data: s, loading } = useRealtimeDocument<any>(companyId && sn ? `companies/${companyId}/serial_numbers/${sn}` : null);
  const { data: product } = useRealtimeDocument<any>(s?.productId ? `products/${s.productId}` : null);
  const filter = useMemo(() => [where("snList", "array-contains", sn)], [sn]);
  const { data: moves } = useRealtimeCollection<any>(companyId ? `companies/${companyId}/stock_movements` : "", filter, false);
  const history = [...moves].sort((a: any, b: any) => toMs(b.createdAt) - toMs(a.createdAt));

  if (!loading && !s) {
    return (
      <div className="p-10 flex flex-col items-center gap-4">
        <p className="text-white/60 text-sm">ไม่พบหมายเลขเครื่อง {sn}</p>
        <PillButton variant="glass" onClick={() => router.push("/inventory/serials")}>ไปหน้ารายการหมายเลขเครื่อง</PillButton>
      </div>
    );
  }
  const st = SERIAL_STATUS[s?.status || "available"] || SERIAL_STATUS.available;
  const w = warrantyState(s);

  const header = (
    <div className="flex items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-5 rounded-3xl backdrop-blur-xl">
      <PillButton variant="glass" onClick={() => router.back()} className="w-10 h-10 p-0 flex items-center justify-center"><ArrowLeft size={20} /></PillButton>
      <div className="min-w-0">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-semibold text-white tracking-tight truncate">{product?.name || product?.productName || s?.productId || "-"}</h1>
          <span className="px-3 py-1 rounded-full bg-nexus-teal/10 border border-nexus-teal/30 text-nexus-teal text-sm font-mono font-bold">{sn}</span>
          {s && <StatusBadge status={st.badge} label={st.label} />}
        </div>
        <p className="text-sm text-white/60 mt-1 font-mono">{product?.sku || ""}</p>
      </div>
    </div>
  );

  const row = (k: string, v: React.ReactNode) => (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-white/5 last:border-0">
      <span className="text-[13px] text-white/60 shrink-0">{k}</span>
      <span className="text-[13px] text-white text-right truncate">{v || "-"}</span>
    </div>
  );

  const left = (
    <div className="space-y-4 pb-10">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlassCard className="p-5">
          <h3 className="text-sm font-bold text-white mb-2">ตำแหน่งปัจจุบัน</h3>
          {row("สถานะ", st.label)}
          {row("ตำแหน่งล่าสุด", s?.lastLocation || s?.location)}
          {row("เอกสารอ้างอิงล่าสุด", <span className="font-mono">{s?.lastReference || "-"}</span>)}
          {row("โครงการ", s?.currentProjectId)}
          {row("อัปเดตล่าสุด", thDate(s?.updatedAt, true))}
        </GlassCard>
        <GlassCard className="p-5">
          <h3 className="text-sm font-bold text-white mb-2">การรับประกันและบำรุงรักษา</h3>
          {row("สถานะประกัน", <span className={cn("font-bold", w.tone)}>{w.label}</span>)}
          {row("เริ่มประกัน", thDate(s?.warrantyStartDate))}
          {row("สิ้นสุดประกัน", thDate(s?.warrantyEndDate))}
          {row("รอบบำรุงรักษา", s?.pmFrequency ? `ทุก ${s.pmFrequency} วัน` : "-")}
          {row("บำรุงรักษาล่าสุด", thDate(s?.lastMaintenanceDate))}
        </GlassCard>
      </div>
      <GlassCard className="p-2">
        <h3 className="text-sm font-bold text-white px-3 pt-2 pb-1">ประวัติการเคลื่อนไหว</h3>
        <NexusTable headers={["วันเวลา", "ประเภท", "จาก", "ไป", "เอกสารอ้างอิง"]}>
          {!history.length && <NexusTableRow><NexusTableCell colSpan={5} className="text-center py-8 text-white/40">ยังไม่มีประวัติ</NexusTableCell></NexusTableRow>}
          {history.map((m: any) => {
            const t = MOVE_TH[m.type] || { label: m.type || "-", tone: "text-white/60" };
            return (
              <NexusTableRow key={m.id}>
                <NexusTableCell className="text-white/70">{thDate(m.createdAt, true)}</NexusTableCell>
                <NexusTableCell><span className={cn("text-[12px] font-bold", t.tone)}>{t.label}</span></NexusTableCell>
                <NexusTableCell className="text-white/60">{m.fromLocation || "-"}</NexusTableCell>
                <NexusTableCell className="text-white/60">{m.toLocation || "-"}</NexusTableCell>
                <NexusTableCell className="font-mono text-[13px] text-white/70">{m.referenceId || m.transactionId || "-"}</NexusTableCell>
              </NexusTableRow>
            );
          })}
        </NexusTable>
      </GlassCard>
    </div>
  );

  return <NexusPageLayout header={header} leftContent={left} />;
}
