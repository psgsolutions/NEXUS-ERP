"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Users, ShieldCheck, UserCheck, Link2, Loader2, RefreshCw } from "lucide-react";
import { GlassCard, PillButton, PillSelect, StatusBadge, cn, NexusSearchInput, NexusTable, NexusTableRow, NexusTableCell } from "@/components/ui/Base";
import { SecurityGuard } from "@/components/shared/SecurityGuard";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api-client";
import { getPermissions, type Permission } from "@/lib/permissions";

interface ManagedUser {
  uid: string;
  name: string;
  email: string;
  role: string;
  status: "ACTIVE" | "PENDING" | "SUSPENDED" | "REJECTED";
  expired: boolean;
  companyId: string | null;
  requestedCompanyId: string | null;
  requestedCompanyName: string | null;
  registrationId: string | null;
  createdAt: string | null;
}

interface Registration {
  id: string;
  companyName: string;
  taxId: string;
  branchCode?: string;
  businessType?: string;
  ownerUid: string;
}

const ROLE_OPTIONS = [
  { value: "ADMIN", label: "ผู้ดูแลระบบ" },
  { value: "ENGINEER", label: "วิศวกร" },
  { value: "ACCOUNTANT", label: "บัญชี" },
  { value: "SALES", label: "ฝ่ายขาย" },
  { value: "TECHNICIAN", label: "ช่างเทคนิค" },
  { value: "CUSTOMER", label: "ลูกค้า" },
];
const roleLabel = (r: string) => (r === "SUPERADMIN" ? "ผู้ดูแลสูงสุด" : ROLE_OPTIONS.find((o) => o.value === r)?.label || r);

const PERMISSION_LABELS: { key: Permission; label: string }[] = [
  { key: "sales:view", label: "ดูงานขาย" },
  { key: "sales:edit", label: "แก้ไขงานขาย" },
  { key: "inventory:view", label: "ดูคลังสินค้า" },
  { key: "inventory:edit", label: "แก้ไขคลังสินค้า" },
  { key: "projects:view", label: "ดูโครงการ" },
  { key: "projects:edit", label: "แก้ไขโครงการ" },
  { key: "finance:view", label: "ดูการเงิน" },
  { key: "finance:edit", label: "แก้ไขการเงิน" },
  { key: "users:manage", label: "จัดการผู้ใช้" },
  { key: "settings:manage", label: "ตั้งค่าระบบ" },
];

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }) : "-";

export default function UsersPage() {
  const { user, role, companyId, checkPermission } = useAuth();
  const isSuper = role === "SUPERADMIN";
  const canManage = checkPermission("users:manage");

  const [tab, setTab] = useState<"users" | "pending" | "roles">("users");
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    if (!canManage) return;
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/api/admin/users");
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || "โหลดข้อมูลไม่สำเร็จ");
      setUsers(result.users || []);
      setRegistrations(result.registrations || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const runAction = async (uid: string, action: string, newRole?: string) => {
    setBusyUid(uid);
    setError("");
    setNotice("");
    try {
      const res = await apiFetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, action, role: newRole }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || "ดำเนินการไม่สำเร็จ");
      if (action === "approve" && result.companyId) setNotice(`อนุมัติแล้ว ผูกกับบริษัท ${result.companyId}`);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusyUid(null);
    }
  };

  const copyRegisterLink = async () => {
    const link = `${window.location.origin}/register/user`;
    try {
      await navigator.clipboard.writeText(link);
      setNotice(`คัดลอกลิงก์สมัครแล้ว: ${link} (แจ้งผู้สมัครให้ใช้รหัสบริษัท ${companyId})`);
    } catch {
      setNotice(`ลิงก์สมัคร: ${link} (รหัสบริษัท ${companyId})`);
    }
  };

  const regByUid = useMemo(() => new Map(registrations.map((r) => [r.ownerUid, r])), [registrations]);
  const pending = users.filter((u) => u.status === "PENDING");
  const members = users.filter((u) => u.status === "ACTIVE" || u.status === "SUSPENDED");
  const q = search.trim().toLowerCase();
  const matches = (u: ManagedUser) =>
    !q || [u.name, u.email, u.role, u.companyId, u.requestedCompanyName].some((v) => String(v || "").toLowerCase().includes(q));

  const headerContent = (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-6 rounded-3xl backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-nexus-teal/15 flex items-center justify-center text-nexus-teal border border-nexus-teal/30">
          <Users size={20} />
        </div>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-white uppercase tracking-tight">จัดการผู้ใช้งานและสิทธิ์</h1>
            <span className="px-3 py-1 rounded-full bg-nexus-teal/10 border border-nexus-teal/30 text-nexus-teal text-sm font-mono font-bold select-none cursor-default pointer-events-none">
              USERS-ROLES
            </span>
          </div>
          <p className="text-sm text-white/60 font-medium mt-1">
            {isSuper ? "ผู้ใช้ทุกบริษัทและคำขอเปิดบริษัทใหม่" : "อนุมัติผู้สมัคร กำหนดสิทธิ์ และระงับบัญชีผู้ใช้ของบริษัท"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
        <PillButton variant="glass" onClick={load} disabled={loading} className="h-8 px-4 text-xs">
          <RefreshCw size={14} className={cn("mr-1.5", loading && "animate-spin")} />
          รีเฟรช
        </PillButton>
        {!isSuper && (
          <PillButton variant="confirm" onClick={copyRegisterLink} className="h-8 px-5 font-bold text-xs">
            <Link2 size={14} className="mr-1.5" />
            คัดลอกลิงก์สมัครผู้ใช้
          </PillButton>
        )}
      </div>
    </div>
  );

  const tabButton = (id: typeof tab, icon: React.ReactNode, label: string, count?: number) => (
    <button
      onClick={() => setTab(id)}
      className={cn(
        "flex items-center gap-2 px-6 h-full rounded-full text-sm font-medium transition-all",
        tab === id ? "bg-nexus-teal/20 text-nexus-teal border border-nexus-teal/40 backdrop-blur-md shadow-neon-teal" : "text-white/40 hover:text-white hover:bg-white/5"
      )}
    >
      {icon} {label}
      {!!count && <span className="ml-1 px-2 rounded-full bg-warning/20 text-warning text-[11px] font-mono font-bold">{count}</span>}
    </button>
  );

  const actionsFor = (u: ManagedUser) => {
    if (u.uid === user?.uid) return <span className="text-[11px] text-white/30">บัญชีของคุณ</span>;
    const busy = busyUid === u.uid;
    if (busy) return <Loader2 size={16} className="animate-spin text-white/40 mx-auto" />;
    if (u.status === "PENDING") {
      const needsSuper = !!u.registrationId && !isSuper;
      return (
        <div className="flex gap-2 justify-end">
          <PillButton variant="confirm" disabled={needsSuper} onClick={() => runAction(u.uid, "approve")} className="h-8 px-4 text-xs">
            อนุมัติ
          </PillButton>
          <SecurityGuard onConfirm={() => runAction(u.uid, "reject")} actionLabel="ปฏิเสธคำขอ" message={`ปฏิเสธคำขอของ ${u.email}? บัญชีนี้จะถูกปิดการใช้งาน`}>
            <PillButton variant="ghost" className="h-8 px-4 text-xs text-danger">ปฏิเสธ</PillButton>
          </SecurityGuard>
        </div>
      );
    }
    if (u.status === "ACTIVE") {
      return (
        <SecurityGuard onConfirm={() => runAction(u.uid, "suspend")} actionLabel="ระงับบัญชี" message={`ระงับบัญชี ${u.email}? ผู้ใช้จะถูกออกจากระบบและเข้าใช้งานไม่ได้จนกว่าจะเปิดใช้งานอีกครั้ง`}>
          <PillButton variant="ghost" className="h-8 px-4 text-xs text-danger">ระงับ</PillButton>
        </SecurityGuard>
      );
    }
    return (
      <PillButton variant="glass" onClick={() => runAction(u.uid, "reactivate")} className="h-8 px-4 text-xs">
        เปิดใช้งาน
      </PillButton>
    );
  };

  const statusBadge = (u: ManagedUser) => {
    if (u.status === "ACTIVE") return <StatusBadge status="active" label="ใช้งาน" />;
    if (u.status === "SUSPENDED") return <StatusBadge status="danger" label="ระงับ" />;
    if (u.status === "REJECTED") return <StatusBadge status="inactive" label="ปฏิเสธ" />;
    return u.expired ? <StatusBadge status="warning" label="คำขอหมดอายุ" /> : <StatusBadge status="pending" label="รออนุมัติ" />;
  };

  const userTable = (rows: ManagedUser[], mode: "users" | "pending") => (
    <GlassCard accentColor="teal" className="p-0 overflow-hidden">
      <NexusTable
        headers={
          mode === "pending"
            ? ["ผู้สมัคร", "คำขอ", "สิทธิ์ที่ขอ", "วันที่สมัคร", "สถานะ", ""]
            : ["ผู้ใช้งาน", ...(isSuper ? ["บริษัท"] : []), "บทบาท", "สถานะ", ""]
        }
        minWidth="min-w-[900px]"
        itemCount={rows.length}
      >
        {rows.length === 0 && (
          <NexusTableRow>
            <NexusTableCell className="text-center text-sm text-white/40 py-10" colSpan={6}>
              {loading ? "กำลังโหลด..." : mode === "pending" ? "ไม่มีคำขอรออนุมัติ" : "ไม่พบผู้ใช้งาน"}
            </NexusTableCell>
          </NexusTableRow>
        )}
        {rows.map((u) => {
          const reg = regByUid.get(u.uid);
          return (
            <NexusTableRow key={u.uid}>
              <NexusTableCell>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center text-sm font-bold text-white/50">
                    {(u.name || u.email || "?")[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">{u.name || "-"}</p>
                    <p className="text-[12px] text-white/40 font-mono truncate">{u.email}</p>
                  </div>
                </div>
              </NexusTableCell>
              {mode === "pending" ? (
                <>
                  <NexusTableCell className="text-[13px] text-white/70">
                    {u.registrationId ? (
                      <div>
                        <p className="font-bold text-warning">ขอเปิดบริษัทใหม่</p>
                        <p>{reg?.companyName || u.requestedCompanyName}</p>
                        {reg && <p className="text-[11px] text-white/40 font-mono">เลขภาษี {reg.taxId} · สาขา {reg.branchCode || "00000"}</p>}
                      </div>
                    ) : (
                      <div>
                        <p>เข้าร่วม {u.requestedCompanyName}</p>
                        <p className="text-[11px] text-white/40 font-mono">{u.requestedCompanyId}</p>
                      </div>
                    )}
                  </NexusTableCell>
                  <NexusTableCell className="text-[13px] text-white/70">{roleLabel(u.role)}</NexusTableCell>
                  <NexusTableCell className="text-[12px] text-white/50 font-mono">{formatDate(u.createdAt)}</NexusTableCell>
                </>
              ) : (
                <>
                  {isSuper && <NexusTableCell className="text-[12px] text-white/60 font-mono">{u.companyId || "-"}</NexusTableCell>}
                  <NexusTableCell>
                    {u.uid === user?.uid || u.role === "SUPERADMIN" || u.status !== "ACTIVE" ? (
                      <span className="text-[13px] text-white/70">{roleLabel(u.role)}</span>
                    ) : (
                      <PillSelect
                        value={u.role}
                        onChange={(e) => runAction(u.uid, "setRole", e.target.value)}
                        className="h-9 px-4 w-44 bg-white/[0.03] border-white/10 text-[13px]"
                      >
                        {!ROLE_OPTIONS.some((o) => o.value === u.role) && <option value={u.role}>{u.role}</option>}
                        {ROLE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </PillSelect>
                    )}
                  </NexusTableCell>
                </>
              )}
              <NexusTableCell>{statusBadge(u)}</NexusTableCell>
              <NexusTableCell className="text-right">{actionsFor(u)}</NexusTableCell>
            </NexusTableRow>
          );
        })}
      </NexusTable>
    </GlassCard>
  );

  const rolesTable = (
    <GlassCard accentColor="teal" className="p-0 overflow-hidden">
      <NexusTable headers={["สิทธิ์", ...ROLE_OPTIONS.slice(0, 4).map((r) => r.label)]} minWidth="min-w-[700px]">
        {PERMISSION_LABELS.map((p) => (
          <NexusTableRow key={p.key}>
            <NexusTableCell className="text-[13px] text-white/80">{p.label}</NexusTableCell>
            {ROLE_OPTIONS.slice(0, 4).map((r) => (
              <NexusTableCell key={r.value} className="text-center">
                {getPermissions(r.value).includes(p.key) ? (
                  <span className="text-nexus-teal font-bold">✓</span>
                ) : (
                  <span className="text-white/15">—</span>
                )}
              </NexusTableCell>
            ))}
          </NexusTableRow>
        ))}
      </NexusTable>
    </GlassCard>
  );

  const leftContent = !canManage ? (
    <GlassCard className="p-10 text-center text-sm text-white/50">หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</GlassCard>
  ) : (
    <div className="space-y-6 pb-10">
      <div className="flex gap-2 p-1 bg-white/5 rounded-full w-fit border border-white/5 shadow-inner h-11">
        {tabButton("users", <Users size={16} />, "ผู้ใช้งาน")}
        {tabButton("pending", <UserCheck size={16} />, "รออนุมัติ", pending.length)}
        {tabButton("roles", <ShieldCheck size={16} />, "บทบาทและสิทธิ์")}
      </div>

      {error && (
        <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-danger text-xs font-bold">{error}</div>
      )}
      {notice && (
        <div className="p-3 bg-nexus-teal/10 border border-nexus-teal/20 rounded-xl text-nexus-teal text-xs font-bold break-all">{notice}</div>
      )}

      {tab !== "roles" && (
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white/[0.01] p-1.5 rounded-full border border-white/5 backdrop-blur-md">
          <div className="pl-6">
            <h3 className="tactical-label !mb-0">{tab === "pending" ? "คำขอสมัครใช้งาน" : "บัญชีผู้ใช้"}</h3>
          </div>
          <NexusSearchInput
            placeholder="ค้นหาชื่อ อีเมล บทบาท..."
            className="w-full md:w-80"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      <div className="animate-in slide-in-from-bottom duration-500">
        {tab === "users" && userTable(members.filter(matches), "users")}
        {tab === "pending" && userTable(pending.filter(matches), "pending")}
        {tab === "roles" && rolesTable}
      </div>
    </div>
  );

  const rightSidebar = (
    <GlassCard accentColor="blue" className="p-6 space-y-6 sticky top-0 relative overflow-hidden">
      <div className="space-y-1 relative z-10 border-b border-white/5 pb-4">
        <p className="text-[12px] font-semibold text-white/20 uppercase tracking-[0.2em]">ภาพรวมบัญชี</p>
        <h5 className="text-sm font-semibold text-white tracking-tight">{isSuper ? "ทุกบริษัท" : companyId}</h5>
      </div>

      <div className="space-y-4 relative z-10">
        <div className="flex justify-between items-center pb-4 border-b border-white/5">
          <span className="text-[12px] text-white/60 font-bold">ใช้งานอยู่</span>
          <span className="text-[14px] font-mono font-bold text-nexus-teal">{users.filter((u) => u.status === "ACTIVE").length}</span>
        </div>
        <div className="flex justify-between items-center pb-4 border-b border-white/5">
          <span className="text-[12px] text-white/60 font-bold">รออนุมัติ</span>
          <span className="text-[14px] font-mono font-bold text-warning">{pending.length}</span>
        </div>
        <div className="flex justify-between items-center pb-4 border-b border-white/5">
          <span className="text-[12px] text-white/60 font-bold">ถูกระงับ</span>
          <span className="text-[14px] font-mono font-bold text-danger">{users.filter((u) => u.status === "SUSPENDED").length}</span>
        </div>
        {isSuper && (
          <div className="flex justify-between items-center pb-4 border-b border-white/5">
            <span className="text-[12px] text-white/60 font-bold">คำขอเปิดบริษัท</span>
            <span className="text-[14px] font-mono font-bold text-warning">{registrations.length}</span>
          </div>
        )}
      </div>
      <div className="absolute bottom-0 right-0 w-48 h-48 bg-nexus-teal/10 blur-[60px] translate-x-1/4 translate-y-1/4 rounded-full pointer-events-none" />
    </GlassCard>
  );

  return <NexusPageLayout header={headerContent} leftContent={leftContent} rightSidebar={rightSidebar} />;
}
