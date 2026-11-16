"use client";

import React, { useState } from "react";
import Link from "next/link";
import { EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { KeyRound, Loader2, PenLine, ShieldCheck, UserCircle2 } from "lucide-react";
import { GlassCard, PillButton, PillInput } from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { auth } from "@/lib/firebase-client";
import { apiFetch } from "@/lib/api-client";
import { authPassword } from "@/lib/initial-password";
import { roleLabel } from "@/lib/permissions";

/**
 * บัญชีของฉัน: ข้อมูลบัญชี ตำแหน่ง และเปลี่ยนรหัสผ่าน (ต้องใส่รหัสเดิมก่อน)
 * ลืมรหัสผ่าน → ผู้ดูแลระบบ/HR กด "รีเซ็ตรหัส" ที่ ตั้งค่า › ผู้ใช้ (กลับเป็น 0000 แล้วตั้งใหม่)
 */
export default function AccountPage() {
  const { user, roles, profile } = useAuth() as any;
  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const problem = !pw ? "" : pw.length < 8 ? "อย่างน้อย 8 ตัวอักษร" : !/[A-Za-z]/.test(pw) || !/\d/.test(pw) ? "ต้องมีทั้งตัวอักษรและตัวเลข" : pw2 && pw !== pw2 ? "รหัสผ่านสองช่องไม่ตรงกัน" : pw === cur ? "รหัสใหม่ต้องไม่ซ้ำรหัสเดิม" : "";
  const ready = !!cur && pw.length >= 8 && !problem && pw === pw2;

  const save = async () => {
    if (!ready || !auth.currentUser?.email) return;
    setBusy(true); setMsg(null);
    try {
      // ยืนยันตัวตนด้วยรหัสเดิมก่อน (กันคนอื่นมาใช้เครื่องที่เปิดค้างไว้)
      await reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(auth.currentUser.email, authPassword(cur)))
        .catch(() => { throw new Error("รหัสผ่านเดิมไม่ถูกต้อง"); });
      const r = await apiFetch("/api/account/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ newPassword: pw }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.success) throw new Error(d.error || "เปลี่ยนรหัสผ่านไม่สำเร็จ");
      setCur(""); setPw(""); setPw2("");
      setMsg({ ok: true, text: "เปลี่ยนรหัสผ่านแล้ว — ครั้งหน้าเข้าระบบด้วยรหัสใหม่" });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally { setBusy(false); }
  };

  return (
    <div className="p-4 xl:p-6 max-w-[900px] mx-auto space-y-4" data-account-page>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-nexus-teal/10 border border-nexus-teal/20 text-nexus-teal flex items-center justify-center"><UserCircle2 size={20} /></div>
        <div>
          <h1 className="text-lg font-bold text-white leading-none">บัญชีของฉัน</h1>
          <p className="text-xs text-white/55 mt-1">ข้อมูลบัญชี ตำแหน่ง และเปลี่ยนรหัสผ่าน</p>
        </div>
      </div>

      <GlassCard className="p-5 space-y-2">
        <div className="flex items-center gap-2 text-[12px] font-bold text-white/70"><ShieldCheck size={14} className="text-nexus-teal" /> ข้อมูลบัญชี</div>
        <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-x-4 gap-y-1.5 text-[14px]">
          <span className="text-white/50">ชื่อ</span><span className="text-white">{profile?.name || user?.displayName || "-"}</span>
          <span className="text-white/50">อีเมล (ใช้เข้าระบบ)</span><span className="text-white font-mono">{user?.email || "-"}</span>
          <span className="text-white/50">ตำแหน่ง</span><span className="text-white">{(roles || []).map(roleLabel).join(" · ") || "-"}</span>
        </div>
        <Link href="/my-signature" className="inline-flex items-center gap-1.5 text-[12px] text-nexus-teal hover:underline pt-1"><PenLine size={12} /> ลายเซ็นของฉัน</Link>
      </GlassCard>

      <GlassCard className="p-5 space-y-3">
        <div className="flex items-center gap-2 text-[12px] font-bold text-white/70"><KeyRound size={14} className="text-nexus-teal" /> เปลี่ยนรหัสผ่าน</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="space-y-1 block"><span className="text-[12px] text-white/60">รหัสผ่านเดิม</span>
            <PillInput type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} className="h-9 w-full" />
          </label>
          <label className="space-y-1 block"><span className="text-[12px] text-white/60">รหัสผ่านใหม่</span>
            <PillInput type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="อย่างน้อย 8 ตัว มีตัวอักษรและตัวเลข" className="h-9 w-full" />
          </label>
          <label className="space-y-1 block"><span className="text-[12px] text-white/60">ยืนยันรหัสผ่านใหม่</span>
            <PillInput type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} className="h-9 w-full" />
          </label>
        </div>
        {problem && <p className="text-[12px] text-warning">{problem}</p>}
        {msg && <p className={msg.ok ? "text-[12px] text-nexus-teal font-bold" : "text-[12px] text-danger font-bold"} data-account-msg>{msg.text}</p>}
        <div className="flex items-center gap-3">
          <PillButton variant="confirm" className="h-9 px-5 text-xs font-bold" disabled={!ready || busy} onClick={save} data-change-password>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />} เปลี่ยนรหัสผ่าน
          </PillButton>
          <span className="text-[12px] text-white/45">ลืมรหัสผ่าน: ให้ผู้ดูแลระบบหรือฝ่ายบุคคลกด &quot;รีเซ็ตรหัส&quot; (กลับเป็น 0000 แล้วตั้งใหม่)</span>
        </div>
      </GlassCard>
    </div>
  );
}
