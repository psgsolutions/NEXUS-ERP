"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { GlassCard, PillButton, PillInput, PillSelect, cn } from "@/components/ui/Base";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { useAuth } from "@/context/AuthContext";
import { useSystemDialog } from "@/context/DialogContext";
import { useRealtimeDocument } from "@/hooks/useRealtimeDocument";
import { apiFetch } from "@/lib/api-client";
import { can } from "@/lib/permissions";
import { BANKS, DEPARTMENTS, EMPLOYEE_STATUS, EMPLOYMENT_TYPES, PREFIXES } from "@/lib/hr";

const today = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const EMPTY = {
  prefix: "Mr.", firstName: "", lastName: "", nickname: "", citizenId: "", phone: "", email: "",
  position: "", department: DEPARTMENTS[0], employmentType: "permanent", joinDate: today(), workLocation: "", status: "active",
  salary: "", socialSecurity: true, bankName: BANKS[0], bankAccount: "",
};
type Form = typeof EMPTY;

function EmployeeForm() {
  const router = useRouter();
  const editId = useSearchParams()?.get("edit") || "";
  const { companyId, role } = useAuth();
  const { showConfirm } = useSystemDialog();
  const canEdit = can(role, "hr:edit");
  const { data: existing } = useRealtimeDocument<any>(editId ? `employees/${editId}` : null);

  const [form, setForm] = useState<Form>(EMPTY);
  const [loaded, setLoaded] = useState(!editId);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!editId || loaded || !existing) return;
    // ข้อมูลรุ่นเก่ามีแค่ name: แยกชื่อ/นามสกุลจากช่องว่างแรก
    const [fn, ...ln] = String(existing.name || "").split(" ");
    setForm({
      ...EMPTY,
      ...Object.fromEntries(Object.keys(EMPTY).filter((k) => existing[k] !== undefined && existing[k] !== null).map((k) => [k, existing[k]])),
      firstName: existing.firstName || fn || "",
      lastName: existing.lastName || ln.join(" "),
      salary: existing.salary ? String(existing.salary) : "",
      department: existing.department || EMPTY.department,
    } as Form);
    setLoaded(true);
  }, [editId, existing, loaded]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => { setDirty(true); setForm((f) => ({ ...f, [k]: v })); };
  const problems = [
    !form.firstName.trim() && "ชื่อ",
    !form.lastName.trim() && "นามสกุล",
    !form.position.trim() && "ตำแหน่ง",
    form.citizenId && form.citizenId.length !== 13 && "เลขบัตรประชาชน 13 หลัก",
  ].filter(Boolean) as string[];

  const back = async () => {
    if (!dirty || (await showConfirm("มีข้อมูลที่ยังไม่บันทึก ต้องการออกจากหน้านี้ใช่หรือไม่?"))) router.back();
  };

  const save = async () => {
    if (problems.length || !canEdit) return;
    setSaving(true);
    setError("");
    try {
      const res = await apiFetch("/api/hr/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, employeeDocId: editId || undefined, ...form, salary: Number(form.salary) || 0 }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "บันทึกไม่สำเร็จ");
      router.push(`/hr/employees/${encodeURIComponent(json.docId)}`);
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  };

  const field = (label: string, input: React.ReactNode, req = false, span = "") => (
    <div className={cn("space-y-1 min-w-0", span)}>
      <label className="text-[12px] font-bold text-white/70 ml-1">{label}{req && <span className="text-danger ml-1">*</span>}</label>
      {input}
    </div>
  );
  const text = (k: keyof Form, placeholder = "", extra = "") => (
    <PillInput value={String(form[k])} onChange={(e) => set(k, e.target.value as any)} placeholder={placeholder} className={cn("w-full h-9 text-sm", extra)} />
  );

  const header = (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-5 rounded-3xl backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <PillButton variant="glass" onClick={back} className="w-10 h-10 p-0 flex items-center justify-center"><ArrowLeft size={20} /></PillButton>
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">{editId ? "แก้ไขข้อมูลพนักงาน" : "ลงทะเบียนพนักงานใหม่"}</h1>
          <p className="text-sm text-white/60 mt-1">{editId ? existing?.employeeId || editId : "ได้รหัสพนักงานอัตโนมัติเมื่อบันทึก"}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <PillButton variant="glass" onClick={back} className="h-9 px-4 text-xs font-bold text-white/60">ยกเลิก</PillButton>
        <PillButton variant="confirm" onClick={save} disabled={saving || problems.length > 0 || !canEdit || !loaded} className="h-9 px-5 text-xs font-bold">
          {saving ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <ShieldCheck size={14} className="mr-1.5" />} บันทึกข้อมูลพนักงาน
        </PillButton>
      </div>
    </div>
  );

  const left = (
    <div className="space-y-4 pb-10">
      {!canEdit && <div className="p-3 rounded-xl text-xs font-bold border bg-warning/10 border-warning/20 text-warning">บัญชีของคุณไม่มีสิทธิ์แก้ไขข้อมูลบุคคล</div>}
      {error && <div className="p-3 rounded-xl text-xs font-bold border bg-danger/10 border-danger/20 text-danger">{error}</div>}
      {problems.length > 0 && <p className="text-[12px] text-warning px-1">กรอกให้ครบ: {problems.join(" · ")}</p>}

      <GlassCard className="p-5 space-y-3">
        <h3 className="text-sm font-bold text-white">ข้อมูลส่วนตัว</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {field("คำนำหน้า", <PillSelect value={form.prefix} onChange={(e) => set("prefix", e.target.value)} className="w-full h-9 text-sm">{PREFIXES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</PillSelect>)}
          {field("ชื่อ", text("firstName"), true)}
          {field("นามสกุล", text("lastName"), true)}
          {field("ชื่อเล่น", text("nickname"))}
          {field("เลขบัตรประชาชน", <PillInput value={form.citizenId} onChange={(e) => set("citizenId", e.target.value.replace(/\D/g, "").slice(0, 13))} placeholder="13 หลัก" className="w-full h-9 text-sm font-mono" />)}
          {field("โทรศัพท์", text("phone", "", "font-mono"))}
          {field("อีเมล", text("email", "ใช้ผูกกับบัญชีผู้ใช้เพื่อลงเวลาเอง"), false, "col-span-2")}
        </div>
      </GlassCard>

      <GlassCard className="p-5 space-y-3">
        <h3 className="text-sm font-bold text-white">การจ้างงาน</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {field("ตำแหน่ง", text("position"), true)}
          {field("แผนก", <PillSelect value={form.department} onChange={(e) => set("department", e.target.value)} className="w-full h-9 text-sm">{Array.from(new Set([...DEPARTMENTS, form.department].filter(Boolean))).map((d) => <option key={d} value={d}>{d}</option>)}</PillSelect>)}
          {field("ประเภทการจ้าง", <PillSelect value={form.employmentType} onChange={(e) => set("employmentType", e.target.value)} className="w-full h-9 text-sm">{Object.entries(EMPLOYMENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</PillSelect>)}
          {field("สถานะ", <PillSelect value={form.status} onChange={(e) => set("status", e.target.value)} className="w-full h-9 text-sm">{Object.entries(EMPLOYEE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</PillSelect>)}
          {field("วันที่เริ่มงาน", <PillInput type="date" value={form.joinDate} onChange={(e) => set("joinDate", e.target.value)} className="w-full h-9 text-sm font-mono" />)}
          {field("สถานที่ทำงานหลัก", text("workLocation", "เช่น สำนักงานใหญ่"), false, "col-span-2 lg:col-span-3")}
        </div>
      </GlassCard>

      <GlassCard className="p-5 space-y-3">
        <h3 className="text-sm font-bold text-white">เงินเดือนและบัญชีรับเงิน</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {field(form.employmentType === "daily" ? "ค่าจ้างต่อวัน" : "เงินเดือน", <PillInput inputMode="decimal" value={form.salary} onChange={(e) => set("salary", e.target.value.replace(/[^\d.]/g, ""))} placeholder="0.00" className="w-full h-9 text-sm text-right font-mono" />)}
          {field("ประกันสังคม", <PillSelect value={form.socialSecurity ? "yes" : "no"} onChange={(e) => set("socialSecurity", e.target.value === "yes")} className="w-full h-9 text-sm"><option value="yes">หักประกันสังคม</option><option value="no">ไม่หัก</option></PillSelect>)}
          {field("ธนาคาร", <PillSelect value={form.bankName} onChange={(e) => set("bankName", e.target.value)} className="w-full h-9 text-sm">{Array.from(new Set([...BANKS, form.bankName].filter(Boolean))).map((b) => <option key={b} value={b}>{b}</option>)}</PillSelect>)}
          {field("เลขที่บัญชี", <PillInput value={form.bankAccount} onChange={(e) => set("bankAccount", e.target.value.replace(/[^\d-]/g, ""))} className="w-full h-9 text-sm font-mono" />)}
        </div>
        <p className="text-[11px] text-white/40">ข้อมูลเงินเดือนและบัญชีใช้ในการคำนวณเงินเดือนประจำงวด</p>
      </GlassCard>
    </div>
  );

  return <NexusPageLayout header={header} leftContent={left} />;
}

export default function NewEmployeePage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-white/50 text-sm">กำลังโหลด...</div>}>
      <EmployeeForm />
    </Suspense>
  );
}
