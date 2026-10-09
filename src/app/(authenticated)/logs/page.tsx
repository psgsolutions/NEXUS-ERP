"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { History, RefreshCw } from "lucide-react";
import { GlassCard, NexusSearchInput, NexusTable, NexusTableCell, NexusTableRow, PillButton, PillSelect, cn } from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api-client";
import { ACTION_TH, moduleLabel } from "@/lib/log-labels";

interface LogRow { id: string; action: string; module: string; targetId: string; actor: string; createdAt: string | null }

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("th-TH", { day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-");
const ACTION_TONE: Record<string, string> = { CREATE: "text-nexus-teal", UPDATE: "text-nexus-blue", DELETE: "text-danger" };

export default function LogsPage() {
  const router = useRouter();
  const { companyId } = useAuth();
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [indexed, setIndexed] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [action, setAction] = useState("ALL");
  const [module, setModule] = useState("ALL");

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`/api/logs?companyId=${encodeURIComponent(companyId)}&limit=300`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "อ่านบันทึกไม่สำเร็จ");
      setLogs(json.logs);
      setIndexed(json.indexed);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [companyId]);
  useEffect(() => { load(); }, [load]);

  const modules = useMemo(() => Array.from(new Set(logs.map((l) => moduleLabel(l.module)))).sort((a, b) => a.localeCompare(b, "th")), [logs]);
  const term = q.trim().toLowerCase();
  const rows = logs.filter((l) =>
    (action === "ALL" || l.action === action) &&
    (module === "ALL" || moduleLabel(l.module) === module) &&
    (!term || [l.targetId, l.actor, moduleLabel(l.module), l.module].some((v) => String(v || "").toLowerCase().includes(term))));

  const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  const todayCount = logs.filter((l) => l.createdAt && new Date(new Date(l.createdAt).getTime() + 7 * 3600e3).toISOString().slice(0, 10) === today).length;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent">
      <header className="px-6 py-2.5 min-h-[60px] border-b border-white/5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-black/20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/10"><History size={20} /></div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight leading-none">บันทึกการใช้งาน</h1>
            <p className="text-xs font-semibold text-white/60 mt-1 leading-none">ประวัติการสร้าง แก้ไข และลบข้อมูลในระบบ</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-[13px] text-white/60">
          <span>ทั้งหมด <span className="font-mono font-bold text-white">{logs.length}</span></span>
          <span>วันนี้ <span className="font-mono font-bold text-nexus-teal">{todayCount}</span></span>
          <PillButton variant="glass" onClick={load} disabled={loading} className="h-8 px-3 text-xs"><RefreshCw size={13} className={cn("mr-1.5", loading && "animate-spin")} /> โหลดใหม่</PillButton>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-5 max-w-[1800px] mx-auto space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <NexusSearchInput placeholder="ค้นหาเลขที่เอกสาร ผู้ดำเนินการ หรือโมดูล..." value={q} onChange={(e) => setQ(e.target.value)} kbd="F" className="flex-1 min-w-[240px]" />
            <PillSelect value={action} onChange={(e) => setAction(e.target.value)} className="h-9 w-[140px] text-sm">
              <option value="ALL">ทุกการกระทำ</option>
              {Object.entries(ACTION_TH).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </PillSelect>
            <PillSelect value={module} onChange={(e) => setModule(e.target.value)} className="h-9 w-[180px] text-sm">
              <option value="ALL">ทุกโมดูล</option>
              {modules.map((m) => <option key={m} value={m}>{m}</option>)}
            </PillSelect>
          </div>
          {error && <div className="p-3 rounded-xl text-xs font-bold border bg-danger/10 border-danger/20 text-danger">{error}</div>}
          {!indexed && <p className="text-[12px] text-white/40 px-1">ยังไม่ได้สร้างดัชนีฐานข้อมูลสำหรับบันทึก ระบบเรียงข้อมูลแทนชั่วคราว (ช้าลงเมื่อข้อมูลมาก)</p>}

          <GlassCard accentColor="teal" className="p-2 min-h-[560px]">
            <NexusTable headers={["วันเวลา", "ผู้ดำเนินการ", "การกระทำ", "โมดูล", "เลขที่เอกสาร"]}>
              {loading && !logs.length && <NexusTableRow><NexusTableCell colSpan={5} className="text-center py-10 text-white/40">กำลังโหลด...</NexusTableCell></NexusTableRow>}
              {!loading && !rows.length && <NexusTableRow><NexusTableCell colSpan={5} className="text-center py-10 text-white/40">ไม่พบบันทึก</NexusTableCell></NexusTableRow>}
              {rows.map((l) => (
                <NexusTableRow key={l.id} onClick={() => router.push(`/logs/${encodeURIComponent(l.id)}`)}>
                  <NexusTableCell className="text-white/70">{fmt(l.createdAt)}</NexusTableCell>
                  <NexusTableCell className="text-white/80">{l.actor}</NexusTableCell>
                  <NexusTableCell><span className={cn("text-[12px] font-bold", ACTION_TONE[l.action] || "text-white/60")}>{ACTION_TH[l.action] || l.action}</span></NexusTableCell>
                  <NexusTableCell className="text-white/80">{moduleLabel(l.module)}</NexusTableCell>
                  <NexusTableCell className="font-mono text-[13px] text-nexus-blue">{l.targetId || "-"}</NexusTableCell>
                </NexusTableRow>
              ))}
            </NexusTable>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
