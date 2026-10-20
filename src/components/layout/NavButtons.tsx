"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CornerLeftUp } from "lucide-react";
import { cn } from "@/components/ui/Base";
import { pageLabel, parentPage } from "@/lib/page-labels";

/**
 * ปุ่มนำทางทุกหน้า: ย้อนกลับ / ไปข้างหน้า (ตามประวัติการเปิดหน้า) และ ขึ้นไปหน้ารายการของเมนู
 */
const btn = "w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-nexus-teal hover:bg-white/10 transition-all disabled:opacity-30 disabled:pointer-events-none";

export function NavButtons() {
  const router = useRouter();
  const pathname = usePathname();
  const up = parentPage(pathname);
  const upLabel = up ? pageLabel(up) || "หน้ารายการ" : "";
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" className={btn} onClick={() => router.back()} title="ย้อนกลับ (หน้าที่เพิ่งเปิด)" aria-label="ย้อนกลับ"><ArrowLeft size={16} /></button>
      <button type="button" className={btn} onClick={() => router.forward()} title="ไปข้างหน้า" aria-label="ไปข้างหน้า"><ArrowRight size={16} /></button>
      <button type="button" className={cn(btn, "hidden sm:flex")} disabled={!up} onClick={() => up && router.push(up)} title={up ? `ขึ้นไปหน้ารายการ: ${upLabel}` : "อยู่ที่หน้าหลักของเมนูแล้ว"} aria-label="ขึ้นไปหน้ารายการ"><CornerLeftUp size={16} /></button>
    </div>
  );
}
