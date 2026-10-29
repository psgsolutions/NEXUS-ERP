"use client";
import React, { useState } from "react";
import { PillButton, GlassCard, PillCheckbox } from "@/components/ui/Base";
import { Cpu, Lock, Mail, ArrowRight, Loader2, Eye, EyeOff } from "lucide-react";
import { auth, db } from "@/lib/firebase-client";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { inactiveReason, isSuperAdminAccount } from "@/lib/user-status";
import { resolveRoles } from "@/lib/permissions";

const authErrorText = (code?: string) => {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
    case "auth/invalid-email":
      return "รูปแบบอีเมลไม่ถูกต้อง";
    case "auth/user-disabled":
      return "บัญชีนี้ถูกปิดการใช้งาน กรุณาติดต่อผู้ดูแลระบบ";
    case "auth/too-many-requests":
      return "พยายามเข้าสู่ระบบหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่";
    case "auth/network-request-failed":
      return "เชื่อมต่อเครือข่ายไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ต";
    default:
      return "เกิดข้อผิดพลาดในการเชื่อมต่อ";
  }
};

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // Status
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");

    setLoading(true);
    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      const { user } = await signInWithEmailAndPassword(auth, email.trim(), password);

      if (isSuperAdminAccount(user.uid, user.email, (await user.getIdTokenResult()).claims)) {
        router.push("/settings/users");
        router.refresh();
        return;
      }

      // บริษัท/สิทธิ์/สถานะ มาจากโปรไฟล์ผู้ใช้ในฐานข้อมูล (users/{uid})
      const snap = await getDoc(doc(db, "users", user.uid));
      const profile = snap.exists() ? snap.data() : null;
      const reason = !profile
        ? "ไม่พบข้อมูลผู้ใช้ในระบบ กรุณาติดต่อผู้ดูแลระบบ"
        : inactiveReason(profile) || (!profile.companyId ? "บัญชียังไม่ได้ผูกกับบริษัท กรุณาติดต่อผู้ดูแลระบบ" : null);
      if (reason || !profile) {
        await signOut(auth);
        setError(reason || "");
        return;
      }

      localStorage.setItem("selectedCompanyId", profile.companyId);
      const roles = resolveRoles(profile);
      router.push(roles.length === 1 && roles[0] === "TECHNICIAN" ? "/mobile/technician" : "/");
      router.refresh();
    } catch (err: any) {
      console.error("Login Error:", err?.code || err);
      setError(`ไม่สามารถเข้าสู่ระบบได้: ${authErrorText(err?.code)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError("");
    setNotice("");
    const target = email.trim();
    if (!target.includes("@")) {
      setError("กรอกอีเมลก่อน แล้วกด ลืมรหัสผ่าน? อีกครั้ง");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, target);
      setNotice(`ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่ ${target} แล้ว (หากอีเมลนี้มีบัญชีอยู่)`);
    } catch (err: any) {
      setError(authErrorText(err?.code));
    }
  };

  return (
    <div className="min-h-screen flex bg-surface-0 text-white overflow-hidden">

      {/* Left Side: Brand & Illustration (Split Screen) */}
      <div className="hidden lg:flex w-1/2 relative items-center justify-center border-r border-white/5 bg-surface-0 p-12 overflow-hidden">
        {/* Abstract Glow Effects */}
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-nexus-blue/10 blur-[150px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-nexus-teal/10 blur-[150px] rounded-full mix-blend-screen" />

        <div className="relative z-10 w-full max-w-lg flex flex-col gap-8 animate-in fade-in slide-in-from-left-10 duration-1000">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-nexus-teal rounded-2xl flex items-center justify-center shadow-neon-teal">
              <Cpu className="w-8 h-8 text-black" />
            </div>
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-white leading-tight">
                NEXUS <span className="text-nexus-teal">ERP</span>
              </h1>
              <p className="text-white/40 text-[12px] font-medium tracking-[0.3em] uppercase mt-1">Intelligence OS v3.1</p>
            </div>
          </div>

          <div className="space-y-6 mt-10">
            <h2 className="text-2xl font-medium text-white/90">
              ระบบบริหารจัดการองค์กรครบวงจร
            </h2>
            <p className="text-white/50 leading-relaxed font-light text-sm">
              ข้อมูลของแต่ละบริษัทถูกแยกจากกันอย่างปลอดภัย ผู้ใช้จะเห็นเฉพาะข้อมูลของบริษัทที่ตนสังกัดตามสิทธิ์ที่ได้รับ
            </p>
          </div>

          {/* Decorative Grid / Lines */}
          <div className="w-full h-[1px] bg-gradient-to-r from-nexus-teal/40 to-transparent mt-10" />
          <div className="flex gap-4 mt-6">
            <div className="w-2 h-2 rounded-full bg-nexus-teal shadow-neon-teal animate-pulse" />
            <div className="w-2 h-2 rounded-full bg-white/10" />
            <div className="w-2 h-2 rounded-full bg-white/10" />
          </div>
        </div>
      </div>

      {/* Right Side: Form Container */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12 relative">
        {/* Mobile Background Elements */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-nexus-blue/10 blur-[120px] rounded-full lg:hidden" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-nexus-teal/10 blur-[120px] rounded-full lg:hidden" />

        <div className="w-full max-w-md z-10 animate-in fade-in zoom-in duration-700">

          <div className="lg:hidden flex flex-col items-center mb-10">
            <div className="w-16 h-16 bg-nexus-teal rounded-3xl flex items-center justify-center shadow-neon-teal mb-6 rotate-12">
              <Cpu className="w-10 h-10 text-black" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white mb-2">NEXUS <span className="text-nexus-teal">ERP</span></h1>
          </div>

          <GlassCard className="p-10 border-white/10 bg-zinc-900/40 relative shadow-2xl">
            <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-white tracking-wide">เข้าสู่ระบบ</h2>
                <p className="text-white/40 text-sm mt-2">ใช้อีเมลและรหัสผ่านที่สมัครไว้ ระบบจะพาเข้าบริษัทที่คุณสังกัดโดยอัตโนมัติ</p>
              </div>

              {error && (
                <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-danger text-xs font-bold text-center animate-in shake">
                  {error}
                </div>
              )}
              {notice && (
                <div className="p-3 bg-nexus-teal/10 border border-nexus-teal/20 rounded-xl text-nexus-teal text-xs font-bold text-center">
                  {notice}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-white/40 uppercase tracking-[0.1em] ml-4">อีเมล</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
                  <input
                    type="email"
                    autoComplete="username"
                    placeholder="name@company.com"
                    className="w-full pl-12 h-9 px-6 rounded-full bg-white/[0.03] border border-white/10 text-white text-[14px] font-medium focus:outline-none focus:border-nexus-teal/40 focus:bg-white/[0.06] transition-all"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-white/40 uppercase tracking-[0.1em] ml-4">รหัสผ่าน</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="w-full pl-12 pr-12 h-9 px-6 rounded-full bg-white/[0.03] border border-white/10 text-nexus-teal font-mono text-[14px] font-medium focus:outline-none focus:border-nexus-teal/40 focus:bg-white/[0.06] transition-all"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/60 transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between px-2 pt-2">
                <PillCheckbox
                  label="จดจำฉันไว้"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <button type="button" onClick={handleForgotPassword} className="text-[11px] font-bold text-nexus-teal hover:text-white transition-colors">
                  ลืมรหัสผ่าน?
                </button>
              </div>

              <PillButton
                type="submit"
                variant="primary"
                disabled={loading}
                className="w-full h-9 text-[13px] gap-2 shadow-neon-teal mt-6"
              >
                {loading ? <Loader2 className="animate-spin" size={16} /> : (
                  <>
                    เข้าสู่ระบบ
                    <ArrowRight size={16} />
                  </>
                )}
              </PillButton>
            </form>
          </GlassCard>

          {/* Registration Link & Footer inside form container */}
          <div className="mt-8 text-center space-y-4">
            <div className="text-[12px] text-white/50">
              ยังไม่มีบัญชีการใช้งานใช่หรือไม่?{" "}
              <Link href="/register" className="text-nexus-teal font-bold hover:underline underline-offset-2">
                สมัครสมาชิกใหม่
              </Link>
            </div>
            <div className="text-[10px] text-white/20 font-medium tracking-widest uppercase">
              &copy; 2026 NEXUS ENTERPRISE ERP. ALL RIGHTS RESERVED.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
