"use client";

import React, { useState } from "react";
import { 
  Users, 
  UserPlus, 
  Search, 
  ShieldCheck, 
  MoreVertical,
  Mail,
  Building2,
  Trash2,
  Filter
} from "lucide-react";
import { GlassCard, PillButton, PillInput, MasterMetricCard, cn, NexusSearchInput, NexusTable, NexusTableRow, NexusTableCell } from "@/components/ui/Base";
import { SecurityGuard } from "@/components/shared/SecurityGuard";

export default function UsersPage() {
  return (
    <div className="p-5 space-y-3 animate-in fade-in duration-700 max-w-[1600px] mx-auto">
      
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="tactical-label !text-nexus-teal drop-shadow-neon">Team & Security Access</p>
          <h1 className="text-3xl font-bold text-white tracking-tight">จัดการผู้ใช้งานและสิทธิ์</h1>
        </div>
        <PillButton className="px-6 shadow-neon-teal">
          <UserPlus size={18} />
          เพิ่มผู้ใช้งานใหม่
        </PillButton>
      </div>

      {/* Internal Navigation Tabs (Settings context) */}
      <div className="flex gap-2 p-1 bg-white/5 rounded-full w-fit border border-white/5 shadow-inner h-11">
         <button className="flex items-center gap-2 px-6 h-full rounded-full text-sm font-medium uppercase bg-nexus-teal text-black shadow-neon-teal">
            <Users size={16} /> ผู้ใช้งานทั้งหมด
         </button>
         <button className="flex items-center gap-2 px-6 h-full rounded-full text-sm font-medium uppercase text-white/40 hover:text-white hover:bg-white/5">
            <ShieldCheck size={16} /> บทบาทและสิทธิ์
         </button>
      </div>

      <div className="space-y-3 animate-in slide-in-from-bottom duration-500">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white/[0.01] p-1.5 rounded-full border border-white/5 backdrop-blur-md">
           <div className="pl-6">
              <h3 className="tactical-label !mb-0">Active Intelligence Profiles</h3>
           </div>
           <div className="flex items-center gap-2 flex-1 md:flex-none">
              <NexusSearchInput 
                placeholder="พิมพ์เพื่อค้นหา..." 
                className="w-full md:w-80" 
                kbd="F"
              />
              <div className="pr-1.5">
                <PillButton variant="glass" className="h-11 w-11 p-0 rounded-full border-white/5">
                  <Filter size={18} className="text-white/40" />
                </PillButton>
              </div>
           </div>
        </div>
        
        <NexusTable 
          headers={["ผู้ใช้งาน", "อีเมล", "บทบาท", "แผนก", "สถานะ", ""]}
          minWidth="min-w-[900px]"
        >
           <UserRow 
              name="Admin Nexus" 
              email="admin@nexus.os" 
              role="ADMIN" 
              dept="Management" 
              status="Active" 
           />
           <UserRow 
              name="Nanon S." 
              email="nanon@nexus.os" 
              role="SUPERADMIN" 
              dept="Intelligence" 
              status="Active" 
           />
           <UserRow 
              name="Engineer Smith" 
              email="smith@nexus.os" 
              role="ENGINEER" 
              dept="Infrastructure" 
              status="Active" 
           />
           <UserRow 
              name="Sales Jane" 
              email="jane@nexus.os" 
              role="SALES" 
              dept="Business" 
              status="Suspended" 
           />
        </NexusTable>
      </div>
    </div>
  );
}

function UserRow({ name, email, role, dept, status }: { name: string, email: string, role: string, dept: string, status: string }) {
  const roleColors: any = {
    "SUPERADMIN": "text-nexus-teal border-nexus-teal/30 bg-nexus-teal/5",
    "ADMIN": "text-nexus-blue border-nexus-blue/30 bg-nexus-blue/5",
    "ENGINEER": "text-white/60 border-white/10 bg-white/5",
    "SALES": "text-warning border-warning/30 bg-warning/5",
  };

  return (
    <NexusTableRow>
       <NexusTableCell>
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center text-sm font-bold text-white/40 animate-pulse">
                {name[0]}
             </div>
             <span className="text-sm font-bold text-white group-hover:text-nexus-teal transition-colors">{name}</span>
          </div>
       </NexusTableCell>
       <NexusTableCell className="text-sm text-white/40 font-mono italic">{email}</NexusTableCell>
       <NexusTableCell>
          <span className={cn("px-3 py-1 rounded-full text-[11px] font-medium uppercase border drop-shadow-neon", roleColors[role])}>
             {role}
          </span>
       </NexusTableCell>
       <NexusTableCell className="text-xs font-bold text-white/30 uppercase tracking-widest">{dept}</NexusTableCell>
       <NexusTableCell className="text-center">
          <div className="flex justify-center items-center">
            <span className={cn(
               "w-2 h-2 rounded-full inline-block animate-pulse shadow-[0_0_10px_currentColor]",
               status === "Active" ? "bg-nexus-teal" : "bg-danger"
            )} />
          </div>
       </NexusTableCell>
       <NexusTableCell className="text-center w-10">
          <SecurityGuard onConfirm={() => console.log("Delete user")} actionLabel="ลบผู้ใช้งาน">
             <button className="p-2 text-white/10 hover:text-danger transition-colors mx-auto">
                <Trash2 size={16} />
             </button>
          </SecurityGuard>
       </NexusTableCell>
    </NexusTableRow>
  );
}
