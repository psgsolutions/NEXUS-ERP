"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { where } from "firebase/firestore";
import { CalendarCheck, Clock, DollarSign, MapPin, Paperclip, Plus, UserX, Users, Wallet } from "lucide-react";
import { AttachmentsDialog } from "@/components/shared/AttachmentPicker";
import { GlassCard, NexusSearchInput, NexusTable, NexusTableCell, NexusTableRow, PillButton, PillTabs, StatusBadge, cn } from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { EMPLOYEE_STATUS, bkkParts, employeeName, employeeStatus } from "@/lib/hr";

type Tab = "profiles" | "attendance" | "payroll" | "expenses";

const baht = (n: any) => (Number(n) || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const toMs = (v: any) => (!v ? 0 : v.seconds ? v.seconds * 1000 : new Date(v).getTime() || 0);
const thDate = (v: any) => { const t = typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? Date.parse(`${v}T00:00:00`) : toMs(v); return t ? new Date(t).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" }) : "-"; };
const PAYROLL_STATUS: Record<string, { label: string; badge: "active" | "pending" | "warning" | "inactive" }> = {
  draft: { label: "ร่าง", badge: "pending" },
  approved: { label: "อนุมัติแล้ว", badge: "warning" },
  paid: { label: "จ่ายแล้ว", badge: "active" },
  cancelled: { label: "ยกเลิก", badge: "inactive" },
};

export default function HRPage() {
  const router = useRouter();
  const { companyId } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("profiles");
  const [searchQuery, setSearchQuery] = useState("");
  const [filesOf, setFilesOf] = useState<{ id: string; no: string } | null>(null);
  const today = bkkParts(Date.now()).date;

  const { data: employees, loading } = useRealtimeCollection<any>("employees");
  const todayFilter = useMemo(() => [where("date", "==", today)], [today]);
  const { data: attendance } = useRealtimeCollection<any>("attendance", todayFilter);
  const { data: payrolls } = useRealtimeCollection<any>(companyId ? `companies/${companyId}/payrolls` : "");
  const { data: expenses } = useRealtimeCollection<any>(companyId ? `companies/${companyId}/expenses` : "");

  const q = searchQuery.trim().toLowerCase();
  const match = (...vals: any[]) => !q || vals.some((v) => String(v || "").toLowerCase().includes(q));

  const staff = useMemo(() => employees
    .map((e: any) => ({ ...e, _name: employeeName(e), _status: employeeStatus(e) }))
    .sort((a: any, b: any) => String(a.employeeId || a.id).localeCompare(String(b.employeeId || b.id))), [employees]);
  const active = staff.filter((e: any) => e._status !== "resigned");

  // เวลาวันนี้ต่อพนักงาน
  const todayBy = useMemo(() => {
    const m = new Map<string, { in?: any; out?: any }>();
    attendance.forEach((r: any) => {
      const d = m.get(r.employeeDocId) || {};
      if (r.type === "IN") d.in = r; else d.out = r;
      m.set(r.employeeDocId, d);
    });
    return m;
  }, [attendance]);
  const present = active.filter((e: any) => todayBy.get(e.id)?.in);
  const late = present.filter((e: any) => todayBy.get(e.id)?.in?.status === "late");

  const claims = expenses
    .filter((x: any) => x.documentType === "ExpenseClaim")
    .filter((x: any) => match(x.expenseId, x.employeeName, x.description))
    .sort((a: any, b: any) => toMs(b.createdAt) - toMs(a.createdAt));

  const tabs = [
    { id: "profiles", label: "บุคลากร", icon: <Users size={14} /> },
    { id: "attendance", label: "ลงเวลาทำงาน", icon: <MapPin size={14} /> },
    { id: "payroll", label: "ระบบเงินเดือน", icon: <DollarSign size={14} /> },
    { id: "expenses", label: "เบิกค่าใช้จ่าย", icon: <Wallet size={14} /> },
  ];
  const action: Record<Tab, { label: string; href: string }> = {
    profiles: { label: "เพิ่มพนักงานใหม่", href: "/hr/employees/new" },
    attendance: { label: "ลงเวลาเข้า / ออก", href: "/hr/attendance/new" },
    payroll: { label: "ประมวลผลเงินเดือน", href: "/hr/payroll/new" },
    expenses: { label: "บันทึกเบิกค่าใช้จ่าย", href: "/finance/expense-claims/new" },
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent">
      <header className="px-6 py-2.5 min-h-[60px] border-b border-white/5 flex flex-col xl:flex-row xl:items-center justify-between gap-3 bg-black/20 shrink-0">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal shadow-lg border border-nexus-teal/10"><Users size={20} /></div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight leading-none">ศูนย์บริหารบุคลากร</h1>
            <p className="text-xs font-semibold text-white/60 mt-1 tracking-wider leading-none">พนักงาน เวลาทำงาน เงินเดือน</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Stat icon={<Users size={16} />} label="พนักงาน" value={`${active.length} คน`} tone="teal" />
          <Stat icon={<CalendarCheck size={16} />} label="มาทำงานวันนี้" value={`${present.length} คน`} tone="teal" />
          <Stat icon={<Clock size={16} />} label="เข้าสายวันนี้" value={`${late.length} คน`} tone={late.length ? "warning" : "white"} />
          <Stat icon={<UserX size={16} />} label="ยังไม่ลงเวลา" value={`${active.length - present.length} คน`} tone="white" />
        </div>
      </header>

      <section className="module-toolbar">
        <PillTabs className="module-tabs flex-1 min-w-[min(100%,520px)]" tabs={tabs} activeTab={activeTab} onTabChange={(id: any) => { setActiveTab(id); setSearchQuery(""); }} />
        <div className="module-toolbar-actions">
          <PillButton variant="primary" onClick={() => router.push(action[activeTab].href)} className="h-8 px-5 shadow-neon-teal">
            <Plus size={14} className="mr-1.5" /> {action[activeTab].label}
          </PillButton>
        </div>
      </section>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-5 max-w-[1800px] mx-auto space-y-3">
          <NexusSearchInput placeholder="พิมพ์เพื่อค้นหา..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} kbd="F" />

          <GlassCard accentColor="teal" className="p-2 min-h-[560px]">
            {activeTab === "profiles" && (
              <NexusTable headers={["รหัสพนักงาน", "ชื่อ-สกุล", "ตำแหน่ง", "แผนก", "วันที่เริ่มงาน", "โทรศัพท์", "สถานะ"]}>
                {loading && <Empty cols={7} text="กำลังโหลดข้อมูล..." />}
                {!loading && staff.filter((e: any) => match(e._name, e.employeeId, e.position, e.department)).length === 0 && <Empty cols={7} text="ไม่พบพนักงาน" />}
                {staff.filter((e: any) => match(e._name, e.employeeId, e.position, e.department)).map((e: any) => {
                  const st = EMPLOYEE_STATUS[e._status];
                  return (
                    <NexusTableRow key={e.id} onClick={() => router.push(`/hr/employees/${encodeURIComponent(e.id)}`)}>
                      <NexusTableCell className="font-mono text-[13px] text-nexus-blue">{e.employeeId || e.id}</NexusTableCell>
                      <NexusTableCell className="font-bold text-white/80">{e._name}{e.nickname ? <span className="text-white/40 font-normal"> ({e.nickname})</span> : null}</NexusTableCell>
                      <NexusTableCell className="text-white/70">{e.position || "-"}</NexusTableCell>
                      <NexusTableCell className="text-white/60">{e.department || "-"}</NexusTableCell>
                      <NexusTableCell className="text-white/60">{thDate(e.joinDate)}</NexusTableCell>
                      <NexusTableCell className="font-mono text-white/60">{e.phone || "-"}</NexusTableCell>
                      <NexusTableCell><StatusBadge status={st.badge} label={st.label} /></NexusTableCell>
                    </NexusTableRow>
                  );
                })}
              </NexusTable>
            )}

            {activeTab === "attendance" && (
              <>
                <p className="px-3 pt-2 pb-1 text-[12px] text-white/50">เวลาทำงานวันที่ {thDate(today)}</p>
                <NexusTable headers={["รหัสพนักงาน", "พนักงาน", "แผนก", "เข้างาน", "ออกงาน", "สถานที่", "สถานะ"]}>
                  {active.filter((e: any) => match(e._name, e.employeeId, e.department)).length === 0 && <Empty cols={7} text="ไม่พบพนักงาน" />}
                  {active.filter((e: any) => match(e._name, e.employeeId, e.department)).map((e: any) => {
                    const t = todayBy.get(e.id) || {};
                    return (
                      <NexusTableRow key={e.id} onClick={() => router.push(`/hr/employees/${encodeURIComponent(e.id)}`)}>
                        <NexusTableCell className="font-mono text-[13px] text-nexus-blue">{e.employeeId || e.id}</NexusTableCell>
                        <NexusTableCell className="font-bold text-white/80">{e._name}</NexusTableCell>
                        <NexusTableCell className="text-white/60">{e.department || "-"}</NexusTableCell>
                        <NexusTableCell mono className="text-white">{t.in?.time || "-"}</NexusTableCell>
                        <NexusTableCell mono className="text-white">{t.out?.time || "-"}</NexusTableCell>
                        <NexusTableCell className="text-white/60">{t.in?.location || "-"}</NexusTableCell>
                        <NexusTableCell>
                          <span className={cn("text-[12px] font-bold", !t.in ? "text-white/40" : t.in.status === "late" ? "text-warning" : "text-nexus-teal")}>
                            {!t.in ? "ยังไม่ลงเวลา" : t.in.status === "late" ? "เข้าสาย" : "ตรงเวลา"}
                          </span>
                        </NexusTableCell>
                      </NexusTableRow>
                    );
                  })}
                </NexusTable>
              </>
            )}

            {activeTab === "payroll" && (
              <NexusTable headers={["งวดเดือน", "จำนวนพนักงาน", "รวมเงินได้", "ยอดจ่ายสุทธิ", "วันที่จ่าย", "สถานะ"]}>
                {payrolls.length === 0 && <Empty cols={6} text="ยังไม่มีการประมวลผลเงินเดือน" />}
                {payrolls
                  .filter((p: any) => match(p.period, p.payrollNo))
                  .sort((a: any, b: any) => String(b.period).localeCompare(String(a.period)))
                  .map((p: any) => {
                    const st = PAYROLL_STATUS[p.status] || PAYROLL_STATUS.draft;
                    return (
                      <NexusTableRow key={p.id} onClick={() => router.push(`/hr/payroll/new?period=${encodeURIComponent(p.period)}`)}>
                        <NexusTableCell className="font-bold text-white">{p.periodLabel || p.period}</NexusTableCell>
                        <NexusTableCell mono className="text-white/70">{p.employeeCount || 0}</NexusTableCell>
                        <NexusTableCell mono className="text-white/70">{baht(p.totalGross)}</NexusTableCell>
                        <NexusTableCell mono className="text-white">{baht(p.totalNet)}</NexusTableCell>
                        <NexusTableCell className="text-white/60">{thDate(p.payDate)}</NexusTableCell>
                        <NexusTableCell><StatusBadge status={st.badge} label={st.label} /></NexusTableCell>
                      </NexusTableRow>
                    );
                  })}
              </NexusTable>
            )}

            {activeTab === "expenses" && (
              <NexusTable headers={["เลขที่", "วันที่", "พนักงาน", "รายละเอียด", "จำนวนเงิน", "สถานะ", "จัดการ"]}>
                {claims.length === 0 && <Empty cols={7} text="ยังไม่มีรายการเบิกค่าใช้จ่าย" />}
                {claims.map((x: any) => {
                  const paid = String(x.status || "").startsWith("Paid");
                  const partial = x.status === "Partially Paid";
                  return (
                    <NexusTableRow key={x.id}>
                      <NexusTableCell className="font-mono text-[13px] text-nexus-teal">{x.expenseId || x.id}</NexusTableCell>
                      <NexusTableCell className="text-white/60">{thDate(x.createdAt)}</NexusTableCell>
                      <NexusTableCell className="font-bold text-white/80">{x.employeeName || "-"}</NexusTableCell>
                      <NexusTableCell className="text-white/70">{x.description || "-"}</NexusTableCell>
                      <NexusTableCell mono className="text-white">{baht(x.totalAmount)}</NexusTableCell>
                      <NexusTableCell><StatusBadge status={paid ? "active" : partial ? "warning" : "pending"} label={paid ? "จ่ายแล้ว" : partial ? "จ่ายบางส่วน" : "รอจ่าย"} /></NexusTableCell>
                      <NexusTableCell className="whitespace-nowrap">
                        <button type="button" onClick={() => setFilesOf({ id: x.id, no: x.expenseId || x.id })} className="h-8 px-3 mr-1.5 rounded-full border border-white/15 text-white/70 text-[12px] font-bold inline-flex items-center gap-1 hover:bg-white/10" title="รูปใบเสร็จ/บิลที่แนบ"><Paperclip size={12} /> ไฟล์แนบ</button>
                        {!paid && !x.isSample ? (
                          <Link href={`/finance/payments/new?expense=${encodeURIComponent(x.id)}`} className="h-8 px-3 rounded-full border border-nexus-teal/30 text-nexus-teal text-[12px] font-bold inline-flex items-center hover:bg-nexus-teal/10">จ่ายชำระ</Link>
                        ) : <span className="text-white/30">-</span>}
                      </NexusTableCell>
                    </NexusTableRow>
                  );
                })}
              </NexusTable>
            )}
            {filesOf && <AttachmentsDialog open onClose={() => setFilesOf(null)} title={`ไฟล์แนบ ${filesOf.no}`} ownerType="expense" ownerId={filesOf.id} />}
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "teal" | "warning" | "white" }) {
  const color = tone === "teal" ? "text-nexus-teal bg-nexus-teal/10 border-nexus-teal/20" : tone === "warning" ? "text-warning bg-warning/10 border-warning/20" : "text-white bg-white/5 border-white/10";
  return (
    <div className="px-4 py-1.5 bg-black/40 border border-white/5 rounded-xl flex items-center gap-2.5 min-w-[130px]">
      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center border shrink-0", color)}>{icon}</div>
      <div className="flex flex-col justify-center">
        <span className="text-xs font-semibold text-white/60 tracking-wider leading-none">{label}</span>
        <span className={cn("text-[17px] font-bold mt-0.5 mono-numbers leading-none whitespace-nowrap", color.split(" ")[0])}>{value}</span>
      </div>
    </div>
  );
}

function Empty({ cols, text }: { cols: number; text: string }) {
  return <NexusTableRow><NexusTableCell colSpan={cols} className="text-center py-10 text-white/40">{text}</NexusTableCell></NexusTableRow>;
}
