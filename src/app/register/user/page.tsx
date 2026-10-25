"use client";
import React, { useState } from "react";
import { PillButton, GlassCard } from "@/components/ui/Base";
import { UserPlus, Building, Lock, Mail, User, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function RegisterUserPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Form Data
  const [role, setRole] = useState("customer");
  const [companyId, setCompanyId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!companyId || !firstName || !email || !password) {
      setError("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }
    if (password.length < 8) {
      setError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
      return;
    }
    setLoading(true);
    try {
      // สร้างบัญชีสถานะรออนุมัติ (ฝั่ง server ตรวจว่ารหัสบริษัทมีอยู่จริง)
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "user", accountType: role, companyId, firstName, lastName, email, password }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        setError(result.error || "สมัครใช้งานไม่สำเร็จ กรุณาลองใหม่");
        return;
      }
      setSuccess(true);
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-surface-0 text-white overflow-hidden items-center justify-center p-6">
      
      {/* Background glow */}
      <div className={cn(
        "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] blur-[150px] rounded-full pointer-events-none mix-blend-screen transition-colors duration-1000",
        role === 'customer' ? "bg-nexus-blue/10" : "bg-warning/10"
      )} />
      
      <div className="w-full max-w-md z-10 animate-in fade-in zoom-in-95 duration-700">
        
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center shadow-neon-teal transition-colors duration-500",
              role === 'customer' ? "bg-nexus-blue/10 text-nexus-blue shadow-[0_0_15px_rgba(0,102,255,0.2)]" : "bg-warning/10 text-warning shadow-[0_0_15px_rgba(255,197,61,0.2)]"
            )}>
              <UserPlus size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-wide">สมัครใช้งานระบบ</h2>
              <p className="text-white/40 text-[11px] mt-0.5 uppercase tracking-widest">User Registration</p>
            </div>
          </div>
          <Link href="/register" className="text-[11px] font-bold text-white/30 hover:text-white uppercase tracking-widest transition-colors">
            ยกเลิก
          </Link>
        </div>

        <GlassCard className="p-8 border-white/10 bg-zinc-900/60 shadow-2xl relative">
          
          {!success ? (
            <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              {error && (
                <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-danger text-xs font-bold text-center">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[11px] font-medium text-white/40 uppercase tracking-[0.1em] ml-2">ประเภทบัญชีผู้ใช้</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setRole('customer')} className={cn("flex-1 h-9 rounded-full text-[13px] font-bold transition-all border", role === 'customer' ? "bg-nexus-blue/20 text-nexus-blue border-nexus-blue/40" : "bg-white/[0.03] text-white/40 border-white/10 hover:bg-white/10")}>
                    ลูกค้า
                  </button>
                  <button type="button" onClick={() => setRole('technician')} className={cn("flex-1 h-9 rounded-full text-[13px] font-bold transition-all border", role === 'technician' ? "bg-warning/20 text-warning border-warning/40" : "bg-white/[0.03] text-white/40 border-white/10 hover:bg-white/10")}>
                    ช่างเทคนิค
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-white/40 uppercase tracking-[0.1em] ml-4">รหัสบริษัทอ้างอิง</label>
                <div className="relative">
                  <Building className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
                  <input 
                    type="text" 
                    placeholder="ขอรหัสจากผู้ดูแลบริษัท" 
                    className="w-full pl-12 h-9 px-6 rounded-full bg-white/[0.03] border border-white/10 text-white font-mono text-[14px] font-medium focus:outline-none focus:border-white/30 focus:bg-white/[0.06] transition-all"
                    value={companyId}
                    onChange={(e) => setCompanyId(e.target.value.toUpperCase())}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-white/40 uppercase tracking-[0.1em] ml-4">ชื่อ</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
                    <input 
                      type="text" 
                      placeholder="สมชาย" 
                      className="w-full pl-10 h-9 px-4 rounded-full bg-white/[0.03] border border-white/10 text-white text-[14px] font-medium focus:outline-none focus:border-white/30 focus:bg-white/[0.06] transition-all"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-white/40 uppercase tracking-[0.1em] ml-4">นามสกุล</label>
                  <input 
                    type="text" 
                    placeholder="ใจดี" 
                    className="w-full h-9 px-4 rounded-full bg-white/[0.03] border border-white/10 text-white text-[14px] font-medium focus:outline-none focus:border-white/30 focus:bg-white/[0.06] transition-all"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-white/40 uppercase tracking-[0.1em] ml-4">อีเมล (ใช้สำหรับเข้าสู่ระบบ)</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
                  <input 
                    type="email" 
                    placeholder="user@example.com" 
                    className="w-full pl-12 h-9 px-6 rounded-full bg-white/[0.03] border border-white/10 text-white text-[14px] font-medium focus:outline-none focus:border-white/30 focus:bg-white/[0.06] transition-all"
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
                    type="password" 
                    placeholder="••••••••" 
                    className="w-full pl-12 h-9 px-6 rounded-full bg-white/[0.03] border border-white/10 text-white font-mono text-[14px] font-medium focus:outline-none focus:border-white/30 focus:bg-white/[0.06] transition-all"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="pt-4">
                <PillButton 
                  type="submit" 
                  disabled={loading}
                  className={cn(
                    "w-full h-9 text-[13px] gap-2 font-black",
                    role === 'customer' 
                      ? "bg-nexus-blue text-white shadow-[0_0_15px_rgba(0,102,255,0.4)]" 
                      : "bg-warning text-black shadow-[0_0_15px_rgba(255,197,61,0.4)]"
                  )}
                >
                  {loading ? <Loader2 className="animate-spin" size={16} /> : (
                    <>
                      สมัครใช้งาน
                      <ArrowRight size={16} />
                    </>
                  )}
                </PillButton>
              </div>
            </form>
          ) : (
          /* STEP 3: Success */
            <div className="py-12 flex flex-col items-center text-center animate-in fade-in zoom-in duration-500">
              <div className="w-20 h-20 bg-warning/20 rounded-full flex items-center justify-center text-warning shadow-[0_0_30px_rgba(255,197,61,0.3)] mb-6">
                <CheckCircle2 size={40} />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">ส่งคำขอลงทะเบียนสำเร็จ!</h2>
              <p className="text-white/50 text-sm mb-4 max-w-sm leading-relaxed">
                บัญชีของคุณถูกส่งไปผูกกับรหัสบริษัท <span className="font-mono text-white bg-white/10 px-1 py-0.5 rounded">{companyId}</span> แล้ว ขณะนี้<strong className="text-warning">กำลังรอผู้ดูแลระบบของบริษัทอนุมัติ</strong>
              </p>
              <div className="bg-warning/10 border border-warning/20 p-3 rounded-xl mb-8 max-w-sm">
                <p className="text-[11px] text-warning font-medium leading-relaxed">
                  * หากไม่ได้รับการอนุมัติภายใน 24 ชั่วโมง คำขอจะหมดอายุ กรุณาติดต่อผู้ดูแลระบบ
                </p>
              </div>
              <PillButton onClick={() => router.push("/login")} variant="primary" className="h-9 px-8 shadow-neon-teal">
                กลับสู่หน้าเข้าสู่ระบบ
              </PillButton>
            </div>
          )}

        </GlassCard>
      </div>
    </div>
  );
}
