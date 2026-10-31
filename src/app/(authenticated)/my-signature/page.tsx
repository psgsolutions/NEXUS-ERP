"use client";

import React from "react";
import { PenLine } from "lucide-react";
import { SignatureManager } from "@/components/settings/SignatureManager";

/** ลายเซ็นของฉัน (ทุกคน) · ลายเซ็นของพนักงาน (ฝ่ายบุคคล) — ลายเซ็นผูกกับรหัสผู้ใช้เสมอ */
export default function MySignaturePage() {
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent">
      <header className="px-6 py-2.5 min-h-[60px] border-b border-white/5 flex items-center gap-3 bg-black/20 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/10"><PenLine size={20} /></div>
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight leading-none">ลายเซ็นอิเล็กทรอนิกส์</h1>
          <p className="text-xs font-semibold text-white/60 mt-1 leading-none">ลายเซ็นผูกกับบัญชีผู้ใช้ · ตราบริษัทและช่องลงนามตั้งโดยผู้ดูแลบริษัท</p>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto p-6">
        <SignatureManager />
      </div>
    </div>
  );
}
