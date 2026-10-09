"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { GlassCard, PillButton, PillInput, cn } from "@/components/ui/Base";
import { SmartSelect } from "@/components/ui/SmartComponents";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { useAuth } from "@/context/AuthContext";
import { useSystemDialog } from "@/context/DialogContext";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { apiFetch } from "@/lib/api-client";
import { normalizeProjectStatus, PROJECT_STATUS_TH } from "@/lib/project-status";
import { MILESTONE_STATUS_TH, milestoneStatus, weightedProgress } from "@/lib/project-milestones";

interface Row { key: number; id?: string; name: string; startDate: string; endDate: string; weight: string; amount: string; progress: string; note?: string }

let seq = 0;
const baht = (n: number) => (Number(n) || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (s: string) => Number(String(s).replace(/,/g, "")) || 0;
const clean = (s: string) => s.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
const blank = (start = "", end = ""): Row => ({ key: ++seq, name: "", startDate: start, endDate: end, weight: "", amount: "", progress: "0" });
const STATUS_TONE: Record<string, string> = { completed: "text-nexus-teal", "in-progress": "text-nexus-blue", overdue: "text-danger", pending: "text-white/50" };

function MilestoneEditor() {
  const router = useRouter();
  const preset = useSearchParams()?.get("project") || "";
  const { companyId } = useAuth();
  const { showConfirm } = useSystemDialog();
  const { data: projects } = useRealtimeCollection<any>(companyId ? `companies/${companyId}/projects` : "");

  const options = useMemo(() => projects
    .filter((p: any) => p.isDeleted !== true && !p.isSample && normalizeProjectStatus(p.status) !== "Cancelled")
    .map((p: any) => ({ value: p.id, label: `${p.projectId || p.id} ${p.projectName || p.title || p.name || ""}`, description: PROJECT_STATUS_TH[normalizeProjectStatus(p.status)] })), [projects]);

  const [projectDocId, setProjectDocId] = useState(preset);
  const project = projects.find((p: any) => p.id === projectDocId);
  const [rows, setRows] = useState<Row[]>([]);
  const [loadedFor, setLoadedFor] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [dirty, setDirty] = useState(false);

  // โหลดงวดงานเดิมของโครงการที่เลือก (ครั้งเดียวต่อโครงการ ไม่ทับสิ่งที่กำลังแก้)
  useEffect(() => {
    if (!project || loadedFor === project.id) return;
    const ms: any[] = Array.isArray(project.milestones) ? project.milestones : [];
    setRows(ms.length
      ? ms.map((m) => ({ key: ++seq, id: m.id, name: m.name, startDate: m.startDate, endDate: m.endDate, weight: String(m.weight ?? ""), amount: m.amount ? String(m.amount) : "", progress: String(m.progress ?? 0), note: m.note }))
      : [blank(project.startDate || "", project.endDate || "")]);
    setLoadedFor(project.id);
    setDirty(false);
  }, [project, loadedFor]);

  const update = (key: number, patch: Partial<Row>) => { setDirty(true); setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r))); };
  const totals = useMemo(() => {
    const weight = Math.round(rows.reduce((s, r) => s + num(r.weight), 0) * 100) / 100;
    const amount = rows.reduce((s, r) => s + num(r.amount), 0);
    const progress = weightedProgress(rows.map((r) => ({ weight: num(r.weight), progress: num(r.progress) })));
    return { weight, amount, progress };
  }, [rows]);
  const contract = Number(project?.budget) || 0;
  const problems = [
    !project && "เลือกโครงการ",
    rows.some((r) => !r.name.trim()) && "ระบุชื่องวดงานให้ครบ",
    rows.some((r) => !r.startDate || !r.endDate) && "ระบุวันที่เริ่มและสิ้นสุดให้ครบ",
    rows.some((r) => r.startDate && r.endDate && r.endDate < r.startDate) && "วันที่สิ้นสุดต้องไม่อยู่ก่อนวันที่เริ่ม",
    totals.weight > 100 && "น้ำหนักรวมต้องไม่เกิน 100%",
    rows.some((r) => num(r.progress) > 100) && "ความคืบหน้าต้องไม่เกิน 100%",
  ].filter(Boolean) as string[];

  const back = async () => {
    if (!dirty || (await showConfirm("มีข้อมูลที่ยังไม่บันทึก ต้องการออกจากหน้านี้ใช่หรือไม่?"))) router.back();
  };

  const save = async () => {
    if (problems.length) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await apiFetch("/api/projects/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId, projectDocId,
          milestones: rows.map((r) => ({ id: r.id, name: r.name, startDate: r.startDate, endDate: r.endDate, weight: num(r.weight), amount: num(r.amount), progress: num(r.progress), note: r.note })),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "บันทึกไม่สำเร็จ");
      setDirty(false);
      setLoadedFor("");
      setMessage({ text: `บันทึกงวดงาน ${json.count} งวดแล้ว${json.progress !== null ? ` ความคืบหน้าโครงการ ${json.progress}%` : ""}` });
    } catch (err: any) {
      setMessage({ text: err.message, error: true });
    } finally {
      setSaving(false);
    }
  };

  const header = (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-5 rounded-3xl backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <PillButton variant="glass" onClick={back} className="w-10 h-10 p-0 flex items-center justify-center"><ArrowLeft size={20} /></PillButton>
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">งวดงานโครงการ</h1>
          <p className="text-sm text-white/60 mt-1">แบ่งงานเป็นงวด กำหนดน้ำหนักและงวดเงิน ความคืบหน้าโครงการคำนวณจากงวดงาน</p>
        </div>
      </div>
      <PillButton variant="confirm" onClick={save} disabled={saving || problems.length > 0} className="h-9 px-5 text-xs font-bold">
        {saving ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Save size={14} className="mr-1.5" />} บันทึกงวดงาน
      </PillButton>
    </div>
  );

  const left = (
    <div className="space-y-4 pb-10">
      {message && <div className={cn("p-3 rounded-xl text-xs font-bold border", message.error ? "bg-danger/10 border-danger/20 text-danger" : "bg-nexus-teal/10 border-nexus-teal/20 text-nexus-teal")}>{message.text}</div>}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
        <GlassCard className="p-5 space-y-1">
          <label className="text-[12px] font-bold text-white/70 ml-1">โครงการ <span className="text-danger">*</span></label>
          <SmartSelect options={options} value={projectDocId} onChange={(v) => { setProjectDocId(v); setLoadedFor(""); }} allowCustom={false} placeholder="ค้นหาเลขที่ / ชื่อโครงการ" />
          {project && <p className="text-[12px] text-white/50 pt-1">ระยะเวลา {project.startDate || "-"} ถึง {project.endDate || "-"} · มูลค่าสัญญา ฿{baht(contract)}</p>}
          {problems.length > 0 && <p className="text-[12px] text-warning pt-1">ก่อนบันทึก: {problems.join(" · ")}</p>}
        </GlassCard>
        <GlassCard className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-3 content-center">
          {[
            ["จำนวนงวด", String(rows.length), ""],
            ["น้ำหนักรวม", `${totals.weight}%`, totals.weight > 100 ? "text-danger" : ""],
            ["งวดเงินรวม", baht(totals.amount), contract > 0 && Math.abs(totals.amount - contract) > 0.5 ? "text-warning" : ""],
            ["ความคืบหน้า", totals.progress === null ? "-" : `${totals.progress}%`, ""],
          ].map(([k, v, tone]) => (
            <div key={k} className="min-w-0">
              <p className="text-[12px] text-white/50">{k}</p>
              <p className={cn("text-[15px] font-bold font-mono text-white whitespace-nowrap", tone)} title={k === "งวดเงินรวม" && contract > 0 ? `${Math.round((totals.amount / contract) * 100)}% ของมูลค่าสัญญา` : undefined}>{v}</p>
            </div>
          ))}
        </GlassCard>
      </div>

      {project && (
        <GlassCard className="p-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-white">งวดงาน</h3>
            <PillButton variant="glass" onClick={() => { setDirty(true); setRows((rs) => [...rs, blank(rs[rs.length - 1]?.endDate || project.startDate || "", project.endDate || "")]); }} className="h-8 px-4 text-xs font-bold">
              <Plus size={14} className="mr-1" /> เพิ่มงวด
            </PillButton>
          </div>
          <div className="nexus-table-wrap">
            <table className="w-full table-fixed text-[13px]">
              <colgroup><col className="w-7" /><col /><col className="w-[132px]" /><col className="w-[132px]" /><col className="w-[72px]" /><col className="w-[112px]" /><col className="w-[72px]" /><col className="w-[78px]" /><col className="w-8" /></colgroup>
              <thead>
                <tr className="text-[11px] font-bold text-white/50 border-b border-white/10">
                  <th className="py-2 text-center">#</th>
                  <th className="py-2 px-1 text-left">ชื่องวดงาน</th>
                  <th className="py-2 px-1 text-center">เริ่ม</th>
                  <th className="py-2 px-1 text-center">สิ้นสุด</th>
                  <th className="py-2 px-1 text-right">น้ำหนัก %</th>
                  <th className="py-2 px-1 text-right">งวดเงิน</th>
                  <th className="py-2 px-1 text-right">คืบหน้า %</th>
                  <th className="py-2 px-1 text-center">สถานะ</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const st = milestoneStatus({ progress: num(r.progress), endDate: r.endDate });
                  return (
                    <tr key={r.key} className="border-b border-white/5 last:border-0">
                      <td className="py-1.5 text-center text-white/40 font-mono">{i + 1}</td>
                      <td className="py-1.5 px-1"><PillInput value={r.name} onChange={(e) => update(r.key, { name: e.target.value })} placeholder="เช่น ติดตั้งโครงสร้าง" className="w-full h-9 text-sm" /></td>
                      <td className="py-1.5 px-1"><PillInput type="date" value={r.startDate} onChange={(e) => update(r.key, { startDate: e.target.value })} className="w-full h-9 text-[12px] font-mono px-2.5" /></td>
                      <td className="py-1.5 px-1"><PillInput type="date" value={r.endDate} onChange={(e) => update(r.key, { endDate: e.target.value })} className="w-full h-9 text-[12px] font-mono px-2.5" /></td>
                      <td className="py-1.5 px-1"><PillInput inputMode="decimal" value={r.weight} onChange={(e) => update(r.key, { weight: clean(e.target.value) })} placeholder="0" className="w-full h-9 text-sm text-right font-mono px-2.5" /></td>
                      <td className="py-1.5 px-1"><PillInput inputMode="decimal" value={r.amount} onChange={(e) => update(r.key, { amount: clean(e.target.value) })} placeholder="0.00" className="w-full h-9 text-sm text-right font-mono px-2.5" /></td>
                      <td className="py-1.5 px-1"><PillInput inputMode="numeric" value={r.progress} onChange={(e) => update(r.key, { progress: e.target.value.replace(/\D/g, "").slice(0, 3) })} className="w-full h-9 text-sm text-right font-mono px-2.5" /></td>
                      <td className={cn("py-1.5 px-1 text-center text-[12px] font-bold whitespace-nowrap", STATUS_TONE[st])}>{MILESTONE_STATUS_TH[st]}</td>
                      <td className="py-1.5 text-center">
                        <button type="button" onClick={() => { setDirty(true); setRows((rs) => rs.filter((x) => x.key !== r.key)); }} className="p-1 text-white/30 hover:text-danger transition-colors" title="ลบงวด"><Trash2 size={15} /></button>
                      </td>
                    </tr>
                  );
                })}
                {!rows.length && <tr><td colSpan={9} className="py-6 text-center text-white/40">ยังไม่มีงวดงาน</td></tr>}
              </tbody>
              <tfoot>
                <tr className="border-t border-white/10 font-mono font-bold">
                  <td colSpan={4} className="py-2 px-1 text-right font-sans text-[12px] text-white/60">รวม</td>
                  <td className={cn("py-2 px-1 text-right", totals.weight > 100 ? "text-danger" : "text-white")}>{totals.weight}</td>
                  <td className="py-2 px-1 text-right text-white whitespace-nowrap">{baht(totals.amount)}</td>
                  <td className="py-2 px-1 text-right text-white">{totals.progress ?? "-"}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-[11px] text-white/40">น้ำหนักใช้ถ่วงความคืบหน้าของโครงการ ถ้าไม่ระบุจะเฉลี่ยทุกงวดเท่ากัน · งวดเงินใช้วางแผนเรียกเก็บเงินตามงวด</p>
        </GlassCard>
      )}
    </div>
  );

  return <NexusPageLayout header={header} leftContent={left} />;
}

export default function ProjectMilestonesPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-white/50 text-sm">กำลังโหลด...</div>}>
      <MilestoneEditor />
    </Suspense>
  );
}
