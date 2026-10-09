"use client";

import React, { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { where } from "firebase/firestore";
import { ArrowLeft, Edit3 } from "lucide-react";
import { GlassCard, NexusTable, NexusTableCell, NexusTableRow, PillButton, StatusBadge, cn } from "@/components/ui/Base";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { can } from "@/lib/permissions";
import { EMPLOYEE_STATUS, EMPLOYMENT_TYPES, employeeName, employeeStatus } from "@/lib/hr";

const baht = (n: any) => (Number(n) || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const thDate = (d?: string) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" }) : "-");
const mask = (s?: string, keep = 4) => (s ? `${"•".repeat(Math.max(0, s.length - keep))}${s.slice(-keep)}` : "-");

function tenure(join?: string) {
  if (!join) return "-";
  const a = new Date(`${join}T00:00:00`);
  const b = new Date();
  let m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) m--;
  if (m < 0) return "ยังไม่เริ่มงาน";
  return `${Math.floor(m / 12) ? `${Math.floor(m / 12)} ปี ` : ""}${m % 12} เดือน`;
}

export default function EmployeeDetailPage() {
  const router = useRouter();
  const key = decodeURIComponent(String(useParams()?.employeeId || "")).trim();
  const { role } = useAuth();
  const canEdit = can(role, "hr:edit");
  const canSeePay = can(role, "hr:view");
  const { data: employees, loading } = useRealtimeCollection<any>("employees");
  const e = employees.find((x: any) => x.id === key || String(x.employeeId || "").trim() === key) || null;

  // เวลาทำงาน 60 วันล่าสุด
  const since = useMemo(() => new Date(Date.now() + 7 * 3600e3 - 60 * 86400e3).toISOString().slice(0, 10), []);
  const filter = useMemo(() => (e ? [where("employeeDocId", "==", e.id)] : [where("employeeDocId", "==", "__none__")]), [e?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data: recs } = useRealtimeCollection<any>("attendance", filter);
  const days = useMemo(() => {
    const m = new Map<string, { date: string; in?: any; out?: any }>();
    recs.filter((r: any) => r.date >= since).forEach((r: any) => {
      const d: { date: string; in?: any; out?: any } = m.get(r.date) || { date: r.date };
      if (r.type === "IN") d.in = r; else d.out = r;
      m.set(r.date, d);
    });
    return Array.from(m.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [recs, since]);
  const month = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 7);
  const monthDays = days.filter((d) => d.date.startsWith(month));

  if (loading) return <div className="p-10 text-center text-white/50 text-sm">กำลังโหลดข้อมูลพนักงาน...</div>;
  if (!e) {
    return (
      <div className="p-10 flex flex-col items-center gap-4">
        <p className="text-white/60 text-sm">ไม่พบข้อมูลพนักงาน {key}</p>
        <PillButton variant="glass" onClick={() => router.push("/hr")}>กลับหน้าบุคลากร</PillButton>
      </div>
    );
  }
  const st = EMPLOYEE_STATUS[employeeStatus(e)];

  const header = (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-5 rounded-3xl backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <PillButton variant="glass" onClick={() => router.back()} className="w-10 h-10 p-0 flex items-center justify-center"><ArrowLeft size={20} /></PillButton>
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold text-white tracking-tight">{employeeName(e)}{e.nickname ? <span className="text-white/50 text-lg"> ({e.nickname})</span> : null}</h1>
            <span className="px-3 py-1 rounded-full bg-nexus-teal/10 border border-nexus-teal/30 text-nexus-teal text-sm font-mono font-bold">{e.employeeId || e.id}</span>
            <StatusBadge status={st.badge} label={st.label} />
          </div>
          <p className="text-sm text-white/60 mt-1">{e.position || "-"} · {e.department || "-"}</p>
        </div>
      </div>
      {canEdit && (
        <PillButton variant="confirm" onClick={() => router.push(`/hr/employees/new?edit=${encodeURIComponent(e.id)}`)} className="h-9 px-4 text-xs font-bold">
          <Edit3 size={14} className="mr-1.5" /> แก้ไขข้อมูล
        </PillButton>
      )}
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <GlassCard className="p-5">
          <h3 className="text-sm font-bold text-white mb-2">การจ้างงาน</h3>
          {row("ประเภท", EMPLOYMENT_TYPES[e.employmentType] || e.type || "-")}
          {row("วันที่เริ่มงาน", thDate(e.joinDate))}
          {row("อายุงาน", tenure(e.joinDate))}
          {row("สถานที่ทำงาน", e.workLocation || e.location)}
        </GlassCard>
        <GlassCard className="p-5">
          <h3 className="text-sm font-bold text-white mb-2">ติดต่อ</h3>
          {row("โทรศัพท์", <span className="font-mono">{e.phone || "-"}</span>)}
          {row("อีเมล", e.email)}
          {row("เลขบัตรประชาชน", <span className="font-mono">{mask(e.citizenId)}</span>)}
          {row("บัญชีผู้ใช้", e.email ? "ลงเวลาเองได้ด้วยอีเมลนี้" : "ยังไม่ผูกอีเมล")}
        </GlassCard>
        <GlassCard className="p-5">
          <h3 className="text-sm font-bold text-white mb-2">เงินเดือน</h3>
          {canSeePay ? (
            <>
              {row(e.employmentType === "daily" ? "ค่าจ้างต่อวัน" : "เงินเดือน", <span className="font-mono">{e.salary ? baht(e.salary) : "-"}</span>)}
              {row("ประกันสังคม", e.socialSecurity === false ? "ไม่หัก" : "หัก")}
              {row("ธนาคาร", e.bankName)}
              {row("เลขที่บัญชี", <span className="font-mono">{mask(e.bankAccount)}</span>)}
            </>
          ) : <p className="text-[13px] text-white/50">ไม่มีสิทธิ์ดูข้อมูลเงินเดือน</p>}
        </GlassCard>
      </div>

      <GlassCard className="p-2">
        <div className="flex items-center justify-between gap-3 px-3 pt-2 pb-1">
          <h3 className="text-sm font-bold text-white">เวลาทำงาน 60 วันล่าสุด</h3>
          <p className="text-[12px] text-white/50">เดือนนี้มาทำงาน {monthDays.filter((d) => d.in).length} วัน · สาย {monthDays.filter((d) => d.in?.status === "late").length} ครั้ง</p>
        </div>
        <NexusTable headers={["วันที่", "เข้างาน", "ออกงาน", "จำนวนชั่วโมง", "สถานที่", "สถานะ"]}>
          {days.length === 0 && <NexusTableRow><NexusTableCell colSpan={6} className="text-center py-8 text-white/40">ยังไม่มีการลงเวลา</NexusTableCell></NexusTableRow>}
          {days.map((d) => {
            const hrs = d.in && d.out ? (() => { const [h1, m1] = d.in.time.split(":").map(Number); const [h2, m2] = d.out.time.split(":").map(Number); return ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60; })() : null;
            return (
              <NexusTableRow key={d.date}>
                <NexusTableCell className="text-white/80">{thDate(d.date)}</NexusTableCell>
                <NexusTableCell mono className="text-white">{d.in?.time || "-"}</NexusTableCell>
                <NexusTableCell mono className="text-white">{d.out?.time || "-"}</NexusTableCell>
                <NexusTableCell mono className="text-white/70">{hrs === null ? "-" : hrs.toFixed(1)}</NexusTableCell>
                <NexusTableCell className="text-white/60">{d.in?.location || "-"}</NexusTableCell>
                <NexusTableCell>
                  <span className={cn("text-[12px] font-bold", d.in?.status === "late" ? "text-warning" : d.in ? "text-nexus-teal" : "text-white/50")}>
                    {d.in?.status === "late" ? "เข้าสาย" : d.in ? "ตรงเวลา" : "ไม่มีเวลาเข้า"}{d.in?.method === "manual" ? " · ลงแทน" : ""}
                  </span>
                </NexusTableCell>
              </NexusTableRow>
            );
          })}
        </NexusTable>
      </GlassCard>
    </div>
  );

  return <NexusPageLayout header={header} leftContent={left} />;
}
