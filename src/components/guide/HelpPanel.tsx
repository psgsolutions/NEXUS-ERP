"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { AlertTriangle, ArrowRight, HelpCircle, X } from "lucide-react";
import { guideFor } from "@/lib/help/guides";
import { pageLabel } from "@/lib/page-labels";
import { canAccessRoute } from "@/lib/permissions";
import { useAuth } from "@/context/AuthContext";
import { useOnboarding } from "@/components/guide/Onboarding";
import { useRouter } from "next/navigation";

/**
 * ปุ่ม ? มุมขวาบน + แผง "วิธีใช้หน้านี้" (เนื้อหาจาก src/lib/help/guides.ts)
 * เปิดจากที่อื่นได้ด้วย window.dispatchEvent(new Event("nexus:help"))
 */
export function HelpButton() {
  const pathname = usePathname();
  const { roles } = useAuth();
  const [open, setOpen] = useState(false);
  const guide = guideFor(pathname);
  const router = useRouter();
  const { state: onboarding, setDismissed } = useOnboarding();
  useEffect(() => { if (open) window.dispatchEvent(new Event("nexus:help-opened")); }, [open]);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("nexus:help", show);
    return () => window.removeEventListener("nexus:help", show);
  }, []);
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);

  const links = (guide?.next || []).filter((l) => canAccessRoute(roles, l.href.split("?")[0]));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="วิธีใช้หน้านี้"
        aria-label="วิธีใช้หน้านี้"
        className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-nexus-teal hover:bg-white/10 transition-all"
      >
        <HelpCircle size={18} />
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-[300] flex justify-end" role="dialog" aria-modal="true" aria-label="วิธีใช้หน้านี้">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="relative w-full max-w-md h-full bg-surface-2 border-l border-white/10 shadow-2xl flex flex-col animate-in slide-in-from-right-10 duration-200">
            <div className="flex items-start justify-between gap-3 p-5 border-b border-white/5">
              <div>
                <p className="text-[12px] font-semibold text-nexus-teal">วิธีใช้หน้านี้</p>
                <h3 className="text-lg font-bold text-white mt-0.5">{guide?.title || pageLabel(pathname) || "หน้านี้"}</h3>
              </div>
              <button onClick={() => setOpen(false)} aria-label="ปิด" className="p-2 rounded-full text-white/50 hover:text-white hover:bg-white/5"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-5 text-[14px] leading-relaxed">
              {guide ? (
                <>
                  <p className="text-white/80">{guide.summary}</p>
                  <section>
                    <h4 className="text-[13px] font-bold text-white mb-2">ทำอย่างไร</h4>
                    <ol className="space-y-2">
                      {guide.steps.map((s, i) => (
                        <li key={i} className="flex gap-3">
                          <span className="shrink-0 w-6 h-6 rounded-full bg-nexus-teal/15 text-nexus-teal text-[12px] font-bold flex items-center justify-center">{i + 1}</span>
                          <span className="text-white/75">{s}</span>
                        </li>
                      ))}
                    </ol>
                  </section>
                  {guide.cautions && guide.cautions.length > 0 && (
                    <section className="rounded-xl border border-warning/25 bg-warning/[0.07] p-3 space-y-1.5">
                      <h4 className="flex items-center gap-1.5 text-[13px] font-bold text-warning"><AlertTriangle size={14} /> ข้อควรระวัง</h4>
                      {guide.cautions.map((c, i) => <p key={i} className="text-[13px] text-white/75">{c}</p>)}
                    </section>
                  )}
                  {links.length > 0 && (
                    <section>
                      <h4 className="text-[13px] font-bold text-white mb-2">ขั้นถัดไป / หน้าที่เกี่ยวข้อง</h4>
                      <div className="space-y-1.5">
                        {links.map((l) => (
                          <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-white/10 bg-white/[0.03] text-white/80 hover:text-nexus-teal hover:border-nexus-teal/30">
                            {l.label} <ArrowRight size={14} />
                          </Link>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              ) : (
                <p className="text-white/70">ยังไม่มีคู่มือสำหรับหน้านี้ — ดูขั้นตอนของงานได้จากหน้าหลักของเมนู หรือกล่อง &quot;งานรอดำเนินการ&quot; ที่หน้าภาพรวม</p>
              )}
              <p className="text-[12px] text-white/45 border-t border-white/5 pt-4">ไอคอน ⓘ ข้างช่องกรอก = คำอธิบายช่องนั้น · กล่อง &quot;เมื่อกดบันทึก ระบบจะ…&quot; บอกผลของการบันทึกก่อนกด</p>
              {onboarding && onboarding.tasks.some((t) => !t.done) && (
                <button type="button" onClick={() => { setDismissed(false); setOpen(false); router.push("/dashboard"); }} className="text-[13px] font-semibold text-nexus-teal hover:underline">
                  แสดงรายการเริ่มต้นใช้งานของฉัน ({onboarding.tasks.filter((t) => t.done).length}/{onboarding.tasks.length})
                </button>
              )}
            </div>
          </aside>
        </div>,
        document.body
      )}
    </>
  );
}
