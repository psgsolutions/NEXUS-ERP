"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { KeyRound, Loader2 } from "lucide-react";
import { PillButton, PillInput } from "@/components/ui/Base";
import { apiFetch } from "@/lib/api-client";

/**
 * บังคับตั้งรหัสผ่านใหม่ เมื่อเข้าระบบครั้งแรกด้วยรหัสชั่วคราวที่ผู้ดูแลระบบ/HR ออกให้ (users/{uid}.mustChangePassword)
 * ปิดไม่ได้จนกว่าจะตั้งรหัสสำเร็จ — ตั้งเสร็จแล้วโหลดหน้าใหม่ให้โปรไฟล์อัปเดต
 */
export function ForcePasswordChange({ name }: { name?: string }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const problem = !pw ? "" : pw.length < 8 ? "อย่างน้อย 8 ตัวอักษร" : !/[A-Za-z]/.test(pw) || !/\d/.test(pw) ? "ต้องมีทั้งตัวอักษรและตัวเลข" : pw2 && pw !== pw2 ? "รหัสผ่านสองช่องไม่ตรงกัน" : "";
  const ready = pw.length >= 8 && !problem && pw === pw2;

  const save = async () => {
    if (!ready) return;
    setBusy(true);
    setError("");
    try {
      const res = await apiFetch("/api/account/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ newPassword: pw }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.success) throw new Error(d.error || "ตั้งรหัสผ่านไม่สำเร็จ");
      window.location.reload();
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  };

  if (!mounted) return null;
  // วาดที่ body: อยู่เหนือทุกหน้าต่าง (รวมหน้าต้อนรับ) ไม่ติดลำดับชั้นของกรอบเนื้อหา
  return createPortal(
    <div className="fixed inset-0 z-[100001] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
      <div className="w-full max-w-[420px] bg-surface-0 border border-white/10 rounded-2xl shadow-2xl p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-nexus-teal/10 border border-nexus-teal/20 text-nexus-teal flex items-center justify-center flex-shrink-0">
            <KeyRound size={20} />
          </div>
          <div>
            <h3 className="text-[16px] font-semibold text-white leading-normal">ตั้งรหัสผ่านใหม่</h3>
            <p className="text-[12px] text-white/60 leading-normal">{name ? `ยินดีต้อนรับ ${name} — ` : ""}เข้าระบบครั้งแรกด้วยรหัสชั่วคราว กรุณาตั้งรหัสผ่านของคุณเองก่อนใช้งาน</p>
          </div>
        </div>
        <label className="block space-y-1.5">
          <span className="block text-[12px] font-bold text-white/60">รหัสผ่านใหม่</span>
          <PillInput type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} className="h-9" placeholder="อย่างน้อย 8 ตัว มีตัวอักษรและตัวเลข" />
        </label>
        <label className="block space-y-1.5">
          <span className="block text-[12px] font-bold text-white/60">ยืนยันรหัสผ่านใหม่</span>
          <PillInput type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") save(); }} className="h-9" />
        </label>
        {(problem || error) && <p className="text-[12px] text-danger">{error || problem}</p>}
        <PillButton variant="confirm" onClick={save} disabled={!ready || busy} className="w-full h-9">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />} บันทึกรหัสผ่าน
        </PillButton>
      </div>
    </div>,
    document.body
  );
}
