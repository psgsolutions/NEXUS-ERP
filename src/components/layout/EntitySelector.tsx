"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FloatingLayer } from "@/components/ui/FloatingLayer";
import { Building2, ChevronRight, ShieldCheck } from "lucide-react";
import { cn } from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeDocument } from "@/hooks/useRealtimeDocument";

const TYPE_TH: Record<string, string> = { HEADQUARTERS: "สำนักงานใหญ่", BRANCH: "สาขา" };

/** บริษัทที่ผู้ใช้สังกัด (ข้อมูลจริงจาก companies/{companyId}) พร้อมรายละเอียดเมื่อคลิก */
export function EntitySelector() {
  const { companyId } = useAuth();
  const { data: company } = useRealtimeDocument<any>(companyId ? `companies/${companyId}` : null);
  const [isOpen, setIsOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const floatingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!anchorRef.current?.contains(t) && !floatingRef.current?.contains(t)) setIsOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [isOpen]);

  const name = company?.name || companyId || "-";
  const type = TYPE_TH[String(company?.type || "").toUpperCase()] || "บริษัท";

  return (
    <div className="relative">
      <div
        ref={anchorRef}
        onClick={() => setIsOpen(!isOpen)}
        className="mb-2 p-3 rounded-xl bg-white/[0.03] border border-white/10 relative group cursor-pointer hover:bg-white/[0.06] transition-all overflow-hidden"
      >
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-10 h-10 rounded-xl bg-nexus-teal/10 text-nexus-teal border border-nexus-teal/20 flex items-center justify-center flex-shrink-0">
            <ShieldCheck size={20} />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[11px] font-bold text-white/40 tracking-wider mb-1">{type}</p>
            <p className="text-[14px] font-semibold text-white leading-tight line-clamp-2" title={name}>{name}</p>
          </div>
          <ChevronRight size={14} className={cn("text-white/20 group-hover:text-white transition-transform", isOpen && "rotate-90")} />
        </div>
      </div>

      <FloatingLayer ref={floatingRef} anchorRef={anchorRef} open={isOpen} className="bg-surface-2 border border-white/10 rounded-2xl shadow-2xl p-4 space-y-2 w-[280px]">
        <div className="flex items-start gap-2">
          <Building2 size={16} className="text-nexus-teal mt-0.5 shrink-0" />
          <p className="text-[13px] font-bold text-white">{name}</p>
        </div>
        {company?.taxId && <p className="text-[12px] text-white/60">เลขประจำตัวผู้เสียภาษี <span className="font-mono text-white/80">{company.taxId}</span></p>}
        {company?.address && <p className="text-[12px] text-white/60 leading-relaxed">{company.address}</p>}
        <p className="text-[11px] text-white/40 font-mono">{companyId}</p>
        <Link href="/settings" onClick={() => setIsOpen(false)} className="block text-[12px] text-nexus-teal hover:underline pt-1">ตั้งค่าข้อมูลบริษัท</Link>
      </FloatingLayer>
    </div>
  );
}
