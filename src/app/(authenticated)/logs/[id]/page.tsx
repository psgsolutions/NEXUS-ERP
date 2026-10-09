"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { GlassCard, PillButton, cn } from "@/components/ui/Base";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api-client";
import { ACTION_TH, moduleLabel } from "@/lib/log-labels";

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "medium" }) : "-");

/** แสดงค่าแบบอ่านง่าย: ออบเจกต์ซ้อนแสดงเป็น JSON ย่อ */
const show = (v: any) => (v === null || v === undefined || v === "" ? "-" : typeof v === "object" ? JSON.stringify(v) : String(v));

export default function LogDetailPage() {
  const router = useRouter();
  const id = decodeURIComponent(String(useParams()?.id || ""));
  const { companyId } = useAuth();
  const [log, setLog] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!companyId || !id) return;
    apiFetch(`/api/logs?companyId=${encodeURIComponent(companyId)}&id=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((j) => (j.success ? setLog(j.log) : setError(j.error || "ไม่พบบันทึก")))
      .catch(() => setError("อ่านบันทึกไม่สำเร็จ"));
  }, [companyId, id]);

  const before = log?.changes?.before || {};
  const after = log?.changes?.after || {};
  const keys = Array.from(new Set([...Object.keys(before || {}), ...Object.keys(after || {})])).sort();

  const header = (
    <div className="flex items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-5 rounded-3xl backdrop-blur-xl">
      <PillButton variant="glass" onClick={() => router.back()} className="w-10 h-10 p-0 flex items-center justify-center"><ArrowLeft size={20} /></PillButton>
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-white tracking-tight">รายละเอียดบันทึก</h1>
        <p className="text-sm text-white/60 mt-1 font-mono truncate">{id}</p>
      </div>
    </div>
  );

  const row = (k: string, v: React.ReactNode) => (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-white/5 last:border-0">
      <span className="text-[13px] text-white/60 shrink-0">{k}</span>
      <span className="text-[13px] text-white text-right truncate">{v}</span>
    </div>
  );

  const left = (
    <div className="space-y-4 pb-10">
      {error && <GlassCard className="p-6 text-sm text-white/60">{error}</GlassCard>}
      {log && (
        <>
          <GlassCard className="p-5 grid grid-cols-1 md:grid-cols-2 gap-x-8">
            <div>
              {row("วันเวลา", fmt(log.createdAt))}
              {row("ผู้ดำเนินการ", log.actor)}
              {row("การกระทำ", ACTION_TH[log.action] || log.action)}
            </div>
            <div>
              {row("โมดูล", moduleLabel(log.module))}
              {row("เลขที่เอกสาร", <span className="font-mono">{log.targetId || "-"}</span>)}
              {row("ที่มา", log.userAgent === "SYSTEM" ? "เซิร์ฟเวอร์" : log.userAgent ? "เบราว์เซอร์" : "-")}
            </div>
          </GlassCard>
          <GlassCard className="p-5">
            <h3 className="text-sm font-bold text-white mb-2">ข้อมูลที่เปลี่ยน</h3>
            {!keys.length ? <p className="text-[13px] text-white/50">ไม่มีรายละเอียดข้อมูล</p> : (
              <div className="nexus-table-wrap">
                <table className="w-full table-fixed text-[13px]">
                  <colgroup><col className="w-[26%]" /><col /><col /></colgroup>
                  <thead>
                    <tr className="text-[11px] font-bold text-white/50 border-b border-white/10">
                      <th className="py-2 px-1.5 text-left">ฟิลด์</th>
                      <th className="py-2 px-1.5 text-left">ก่อน</th>
                      <th className="py-2 px-1.5 text-left">หลัง</th>
                    </tr>
                  </thead>
                  <tbody>
                    {keys.map((k) => {
                      const b = show(before?.[k]);
                      const a = show(after?.[k]);
                      return (
                        <tr key={k} className="border-b border-white/5 last:border-0">
                          <td className="py-2 px-1.5 font-mono text-white/70 truncate" title={k}>{k}</td>
                          <td className="py-2 px-1.5 text-white/50 truncate" title={b}>{b}</td>
                          <td className={cn("py-2 px-1.5 truncate", a !== b ? "text-white" : "text-white/50")} title={a}>{a}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </>
      )}
    </div>
  );

  return <NexusPageLayout header={header} leftContent={left} />;
}
