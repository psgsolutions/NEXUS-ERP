"use client";
import React, { useState } from "react";
import { GlassCard, PillButton, StrategicTable, StrategicRow, StrategicCell, StrategicStatus } from "@/components/ui/Base";
import { ShieldAlert, CheckCircle2, XCircle, Search, User, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SuperAdminApprovalsPage() {
  const [tab, setTab] = useState<"business" | "user">("business");

  // Mock pending businesses
  const pendingBusinesses = [
    { id: "NEXUS-089", name: "บริษัท อัลฟ่า เทค จำกัด", type: "Juristic", requestDate: "2026-06-23T08:30:00", status: "pending", timeRemaining: "23 ชั่วโมง" },
    { id: "NEXUS-090", name: "บจก. คลาวด์ เน็ตเวิร์ค", type: "Juristic", requestDate: "2026-06-22T10:00:00", status: "expired", timeRemaining: "หมดเวลา" },
  ];

  // Mock pending users
  const pendingUsers = [
    { id: "USR-012", name: "สมชาย ใจดี", companyId: "NEXUS-001", role: "Customer", requestDate: "2026-06-23T09:15:00", status: "pending", timeRemaining: "23 ชั่วโมง" },
    { id: "USR-013", name: "วิศวะ เทคนิค", companyId: "NEXUS-002", role: "Technician", requestDate: "2026-06-22T08:00:00", status: "expired", timeRemaining: "หมดเวลา" },
  ];

  return (
    <div className="p-5 lg:p-10 space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-danger/10 flex items-center justify-center text-danger shadow-neon-danger/20">
            <ShieldAlert size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-wide">Super Admin Approvals</h1>
            <p className="text-white/40 text-[13px] mt-1">อนุมัติการลงทะเบียนกิจการและผู้ใช้งานใหม่ (ระบบระงับอัตโนมัติภายใน 24 ชม.)</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 border-b border-white/5 pb-4">
        <button 
          onClick={() => setTab("business")}
          className={cn("px-6 py-2 rounded-full text-[13px] font-bold transition-all border flex items-center gap-2", tab === "business" ? "bg-nexus-teal/20 text-nexus-teal border-nexus-teal/40 shadow-neon-teal" : "bg-transparent text-white/40 border-transparent hover:text-white")}
        >
          <Building2 size={16} /> อนุมัติกิจการใหม่
        </button>
        <button 
          onClick={() => setTab("user")}
          className={cn("px-6 py-2 rounded-full text-[13px] font-bold transition-all border flex items-center gap-2", tab === "user" ? "bg-nexus-blue/20 text-nexus-blue border-nexus-blue/40 shadow-[0_0_15px_rgba(0,102,255,0.3)]" : "bg-transparent text-white/40 border-transparent hover:text-white")}
        >
          <User size={16} /> อนุมัติผู้ใช้งาน
        </button>
      </div>

      <GlassCard className="p-4">
        {tab === "business" && (
          <StrategicTable headers={["รหัสบริษัท", "ชื่อกิจการ", "ประเภท", "เวลาที่ร้องขอ", "เวลาที่เหลือ", "สถานะ", "จัดการ"]}>
            {pendingBusinesses.map((biz, idx) => (
              <StrategicRow key={idx}>
                <StrategicCell isId>{biz.id}</StrategicCell>
                <StrategicCell>{biz.name}</StrategicCell>
                <StrategicCell className="text-white/50">{biz.type}</StrategicCell>
                <StrategicCell className="text-white/50">{new Date(biz.requestDate).toLocaleString('th-TH')}</StrategicCell>
                <StrategicCell className={biz.status === "expired" ? "text-danger" : "text-warning"}>{biz.timeRemaining}</StrategicCell>
                <StrategicCell>
                  <StrategicStatus 
                    status={biz.status === "pending" ? "warning" : "danger"} 
                    label={biz.status === "pending" ? "รออนุมัติ" : "ระงับใช้งาน"} 
                  />
                </StrategicCell>
                <StrategicCell>
                  <div className="flex gap-2">
                    <PillButton variant="glass" className="h-8 px-4 text-nexus-teal border-nexus-teal/20 hover:bg-nexus-teal/10">
                      <CheckCircle2 size={14} /> อนุมัติ
                    </PillButton>
                    <PillButton variant="glass" className="h-8 px-4 text-danger border-danger/20 hover:bg-danger/10">
                      <XCircle size={14} /> ปฏิเสธ
                    </PillButton>
                  </div>
                </StrategicCell>
              </StrategicRow>
            ))}
          </StrategicTable>
        )}

        {tab === "user" && (
          <StrategicTable headers={["รหัสผู้ใช้", "ชื่อ-นามสกุล", "อ้างอิงบริษัท", "บทบาท", "เวลาที่เหลือ", "สถานะ", "จัดการ"]}>
            {pendingUsers.map((user, idx) => (
              <StrategicRow key={idx}>
                <StrategicCell isId>{user.id}</StrategicCell>
                <StrategicCell>{user.name}</StrategicCell>
                <StrategicCell className="font-mono text-nexus-blue">{user.companyId}</StrategicCell>
                <StrategicCell>
                  <span className={cn("px-2 py-1 rounded text-[10px] uppercase tracking-widest font-bold", user.role === "Customer" ? "bg-nexus-blue/10 text-nexus-blue" : "bg-warning/10 text-warning")}>
                    {user.role}
                  </span>
                </StrategicCell>
                <StrategicCell className={user.status === "expired" ? "text-danger" : "text-warning"}>{user.timeRemaining}</StrategicCell>
                <StrategicCell>
                  <StrategicStatus 
                    status={user.status === "pending" ? "warning" : "danger"} 
                    label={user.status === "pending" ? "รออนุมัติ" : "ระงับใช้งาน"} 
                  />
                </StrategicCell>
                <StrategicCell>
                  <div className="flex gap-2">
                    <PillButton variant="glass" className="h-8 px-4 text-nexus-teal border-nexus-teal/20 hover:bg-nexus-teal/10">
                      <CheckCircle2 size={14} /> อนุมัติ
                    </PillButton>
                    <PillButton variant="glass" className="h-8 px-4 text-danger border-danger/20 hover:bg-danger/10">
                      <XCircle size={14} /> ปฏิเสธ
                    </PillButton>
                  </div>
                </StrategicCell>
              </StrategicRow>
            ))}
          </StrategicTable>
        )}
      </GlassCard>
    </div>
  );
}
