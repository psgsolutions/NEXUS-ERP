"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { Clock } from "lucide-react";
import { PillButton } from "@/components/ui/Base";
import { auth } from "@/lib/firebase-client";
import { clearTabSession, idleExempt, lastActivity, idleRemaining, IDLE_WARN, LOGOUT_REASON, markActivity } from "@/lib/session-guard";

const EVENTS = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "scroll"] as const;

/**
 * ออกจากระบบอัตโนมัติเมื่อปล่อยหน้าจอทิ้งไว้ 30 นาที (นับรวมทุกแท็บ) · เตือนล่วงหน้า 2 นาที
 * ขยับเมาส์/กดแป้น/แตะจอ = ใช้งานต่อ
 * หน้าขาย POS: ไม่ออกอัตโนมัติ และนับเป็นการใช้งานตลอด (แท็บอื่นในเครื่องเดียวกันจึงไม่ทำให้หลุดด้วย)
 */
export function IdleGuard() {
  const pathname = usePathname();
  const path = useRef(pathname);
  path.current = pathname;
  const [left, setLeft] = useState<number | null>(null);
  const lastWrite = useRef(0);
  const out = useRef(false);

  useEffect(() => {
    const onActive = () => {
      const now = Date.now();
      if (now - lastWrite.current < 10_000) return; // บันทึกอย่างมากทุก 10 วินาที
      lastWrite.current = now;
      markActivity(now);
    };
    const logout = async () => {
      if (out.current) return;
      out.current = true;
      try { sessionStorage.setItem(LOGOUT_REASON, "idle"); } catch { /* ไม่มี storage ก็ออกได้ */ }
      clearTabSession();
      await signOut(auth).catch(() => undefined);
      window.location.href = "/login";
    };
    const check = () => {
      if (idleExempt(path.current)) {
        if (Date.now() - lastActivity() >= 30_000) markActivity();
        return void setLeft(null);
      }
      const r = idleRemaining();
      if (r <= 0) return void logout();
      setLeft(r <= IDLE_WARN ? r : null);
    };
    lastWrite.current = 0; onActive();
    EVENTS.forEach((e) => window.addEventListener(e, onActive, { passive: true, capture: true }));
    document.addEventListener("visibilitychange", check);
    const t = setInterval(check, 1_000);
    check();
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", check); EVENTS.forEach((e) => window.removeEventListener(e, onActive, { capture: true })); };
  }, []);

  if (left === null) return null;
  const sec = Math.ceil(left / 1000);
  return (
    <div className="fixed inset-x-0 top-4 z-[1000020] flex justify-center px-4 pointer-events-none" role="alert" data-idle-warning>
      <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-warning/30 bg-surface-1 px-4 py-3 shadow-2xl">
        <Clock size={18} className="text-warning shrink-0" />
        <span className="text-[14px] text-white">ไม่มีการใช้งานนาน — จะออกจากระบบใน <b className="font-mono text-warning">{Math.floor(sec / 60)}:{String(sec % 60).padStart(2, "0")}</b></span>
        <PillButton variant="confirm" className="h-8 px-4 text-xs font-bold" onClick={() => { lastWrite.current = 0; markActivity(); setLeft(null); }}>ใช้งานต่อ</PillButton>
      </div>
    </div>
  );
}
