"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckCircle2, Circle, HelpCircle, ListChecks, Sparkles, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api-client";
import { GlassCard, PillButton, cn } from "@/components/ui/Base";

/**
 * การเริ่มใช้งานของผู้ใช้ใหม่
 *  - OnboardingHost (ใน layout): popup ต้อนรับครั้งแรกตามตำแหน่ง + บันทึกการเปิดหน้า/เปิดวิธีใช้
 *  - OnboardingChecklist (หน้าภาพรวม): รายการเริ่มต้นใช้งาน ติ๊กเองเมื่อทำจริง ซ่อนได้ เปิดใหม่ได้จากแผงวิธีใช้
 */

interface Task { id: string; label: string; href: string; kind: string; path?: string; done: boolean }
interface Intro { role: string; duties: string; daily: string[] }
interface State { welcomed: boolean; dismissed: boolean; advanced: boolean; intros: Intro[]; tasks: Task[] }
interface Ctx { state: State | null; reload: () => void; setDismissed: (v: boolean) => void; advanced: boolean; setAdvanced: (v: boolean) => void }

const OnboardingContext = createContext<Ctx>({ state: null, reload: () => {}, setDismissed: () => {}, advanced: false, setAdvanced: () => {} });
export const useOnboarding = () => useContext(OnboardingContext);

export function OnboardingHost({ children }: { children: React.ReactNode }) {
  const { companyId, displayName, user } = useAuth();
  const pathname = usePathname();
  const [state, setState] = useState<State | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  // ผู้ใช้กดสลับเองแล้วใช้ค่านั้นทันที (ไม่ต้องรอโหลดสถานะ) — ยังไม่กดใช้ค่าที่บันทึกไว้
  const [advancedChoice, setAdvancedChoice] = useState<boolean | null>(null);
  const advanced = advancedChoice ?? !!state?.advanced;
  const sent = useRef(new Set<string>());

  const mark = useCallback((patch: Record<string, any>) => {
    if (!companyId) return;
    apiFetch("/api/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "mark", ...patch }) }).catch(() => {});
  }, [companyId]);

  const reload = useCallback(async () => {
    if (!companyId || !user) return;
    try {
      const res = await apiFetch("/api/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "status" }) });
      const d = await res.json();
      if (!res.ok || !d.success) return;
      // สิ่งที่ทำไปแล้วระหว่างรอโหลด (เปิดวิธีใช้/เปิดหน้า) ให้นับด้วย
      setState({ ...d, tasks: d.tasks.map((t: Task) => (sent.current.has(t.id === "help" ? "help" : t.path || "") ? { ...t, done: true } : t)) });
      if (!d.welcomed && d.intros.length) setShowWelcome(true);
    } catch { /* ไม่มีรายการเริ่มต้นก็ใช้งานได้ปกติ */ }
  }, [companyId, user]);
  useEffect(() => { reload(); }, [reload]);

  // เปิดหน้าที่เป็นงานแบบ "เปิดดู" -> ติ๊กเสร็จ
  useEffect(() => {
    if (!state || !pathname) return;
    const hit = state.tasks.find((t) => !t.done && t.kind === "visit" && t.path && (pathname === t.path || pathname.startsWith(t.path + "/")));
    if (!hit || sent.current.has(hit.path!)) return;
    sent.current.add(hit.path!);
    mark({ visit: hit.path });
    setState((s) => s && { ...s, tasks: s.tasks.map((t) => (t.id === hit.id ? { ...t, done: true } : t)) });
  }, [pathname, state, mark]);

  // เปิดแผงวิธีใช้ -> ติ๊กงาน "help"
  useEffect(() => {
    const onHelp = () => {
      // บันทึกครั้งเดียวต่อการเปิดแอป (ไม่ต้องรอโหลดสถานะ)
      if (!sent.current.has("help")) { sent.current.add("help"); mark({ helpOpened: true }); }
      setState((s) => s && { ...s, tasks: s.tasks.map((t) => (t.id === "help" ? { ...t, done: true } : t)) });
    };
    window.addEventListener("nexus:help-opened", onHelp);
    return () => window.removeEventListener("nexus:help-opened", onHelp);
  }, [mark]);

  const closeWelcome = () => {
    setShowWelcome(false);
    setState((s) => s && { ...s, welcomed: true });
    mark({ welcomed: true });
  };
  const setDismissed = (v: boolean) => {
    setState((s) => s && { ...s, dismissed: v });
    mark({ dismissed: v });
  };
  const setAdvanced = (v: boolean) => {
    setAdvancedChoice(v);
    mark({ advanced: v });
  };

  return (
    <OnboardingContext.Provider value={{ state, reload, setDismissed, advanced, setAdvanced }}>
      {children}
      {showWelcome && state && (
        <div className="fixed inset-0 z-[310] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="ยินดีต้อนรับ">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto custom-scrollbar rounded-3xl border border-white/10 bg-surface-2 shadow-2xl p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-1.5 text-[13px] font-semibold text-nexus-teal"><Sparkles size={15} /> เริ่มใช้งาน</p>
                <h2 className="text-xl font-bold text-white mt-1">ยินดีต้อนรับ{displayName ? ` คุณ${displayName}` : ""}</h2>
              </div>
              <button onClick={closeWelcome} aria-label="ปิด" className="p-2 rounded-full text-white/50 hover:text-white hover:bg-white/5"><X size={18} /></button>
            </div>
            {state.intros.map((r) => (
              <section key={r.role} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-2">
                <p className="text-[13px] text-white/55">ตำแหน่ง <span className="font-bold text-white">{r.role}</span></p>
                <p className="text-[14px] text-white/85 leading-relaxed">{r.duties}</p>
                <ul className="list-disc pl-5 space-y-0.5 text-[13px] text-white/65">{r.daily.map((d) => <li key={d}>{d}</li>)}</ul>
              </section>
            ))}
            <section className="space-y-2 text-[14px] text-white/75 leading-relaxed">
              <p className="font-bold text-white text-[14px]">ตัวช่วยในระบบ</p>
              <p>• เมนูด้านซ้ายมีเฉพาะงานของตำแหน่งคุณ</p>
              <p>• หน้า <span className="text-white">ภาพรวม</span> มีกล่อง &quot;งานรอดำเนินการ&quot; และรายการเริ่มต้นใช้งานของคุณ</p>
              <p>• ปุ่ม <HelpCircle size={14} className="inline -mt-0.5 text-nexus-teal" /> มุมขวาบน = วิธีใช้หน้านั้น ทีละขั้น</p>
              <p>• ก่อนบันทึกเอกสารสำคัญ กล่อง <ListChecks size={14} className="inline -mt-0.5 text-nexus-blue" /> บอกว่าระบบจะทำอะไรบ้าง · ไอคอน ⓘ อธิบายช่องที่ต้องกรอก</p>
            </section>
            <div className="flex justify-end">
              <PillButton variant="primary" onClick={closeWelcome} className="h-10 px-6 text-sm">เริ่มใช้งาน</PillButton>
            </div>
          </div>
        </div>
      )}
    </OnboardingContext.Provider>
  );
}

const ADVANCED_TOGGLE = "__advanced";

/**
 * โหมดพื้นฐาน: ซ่อนแท็บเครื่องมือขั้นสูงไว้หลังปุ่ม "+ เครื่องมือขั้นสูง" (ผู้ใช้เปิดเองได้ ระบบจำค่าไว้)
 * แท็บที่กำลังเปิดอยู่ (เช่น มาจากลิงก์) ไม่ถูกซ่อน
 */
export function useAdvancedTabs<T extends { id: string; label: string }>(tabs: T[], advancedIds: string[], activeTab: string) {
  const { advanced, setAdvanced } = useOnboarding();
  const optional = tabs.filter((t) => advancedIds.includes(t.id) && t.id !== activeTab);
  const visible = advanced ? tabs : tabs.filter((t) => !optional.includes(t));
  const toggle = optional.length ? { id: ADVANCED_TOGGLE, label: advanced ? "ซ่อนเครื่องมือขั้นสูง" : `+ เครื่องมือขั้นสูง ${optional.length} รายการ` } : null;
  return {
    tabs: (toggle ? [...visible, toggle] : visible) as (T | { id: string; label: string })[],
    /** true = เป็นปุ่มสลับโหมด (ไม่ต้องเปลี่ยนแท็บ) */
    handleToggle: (id: string) => { if (id !== ADVANCED_TOGGLE) return false; setAdvanced(!advanced); return true; },
  };
}

export function OnboardingChecklist() {
  const { state, setDismissed } = useOnboarding();
  if (!state || state.dismissed || !state.tasks.length) return null;
  const done = state.tasks.filter((t) => t.done).length;
  if (done === state.tasks.length) return null;
  return (
    <GlassCard accentColor="teal" className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-[15px] font-bold text-white"><ListChecks size={18} className="text-nexus-teal" /> เริ่มต้นใช้งาน</h3>
          <p className="text-[13px] text-white/55 mt-0.5">ทำครบแล้วรายการนี้จะหายไปเอง · ทำแล้ว {done}/{state.tasks.length}</p>
        </div>
        <button onClick={() => setDismissed(true)} className="text-[12px] text-white/45 hover:text-white">ซ่อน</button>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 mt-3 overflow-hidden"><div className="h-full bg-nexus-teal rounded-full transition-all" style={{ width: `${(done / state.tasks.length) * 100}%` }} /></div>
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
        {state.tasks.map((t) => (
          <Link key={t.id} href={t.href} onClick={(e) => { if (t.id === "help") { e.preventDefault(); window.dispatchEvent(new Event("nexus:help")); } }}
            className={cn("flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-[14px] transition-colors",
              t.done ? "border-white/5 text-white/40" : "border-white/10 bg-white/[0.03] text-white/85 hover:border-nexus-teal/40 hover:text-nexus-teal")}>
            {t.done ? <CheckCircle2 size={17} className="text-nexus-teal shrink-0" /> : <Circle size={17} className="text-white/35 shrink-0" />}
            <span className={cn(t.done && "line-through")}>{t.label}</span>
          </Link>
        ))}
      </div>
    </GlassCard>
  );
}
