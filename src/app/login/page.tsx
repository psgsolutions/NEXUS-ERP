"use client";
import React, { useState, useEffect } from "react";
import { PillButton, PillInput, GlassCard, PillCheckbox, PillSelect } from "@/components/ui/Base";
import { Cpu, Lock, Mail, ArrowRight, Loader2, Building, Building2, Warehouse, Eye, EyeOff } from "lucide-react";
import { auth } from "@/lib/firebase-client";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const router = useRouter();

  // Step Management
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1: Credentials
  const [companyId, setCompanyId] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Step 2: Access Delegation
  const [branch, setBranch] = useState("");
  const [department, setDepartment] = useState("");

  // Status
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Mock Registered Companies
  const mockCompanies = [
    { id: "COM-NEXUS-01", name: "NEXUS Core System (ฐานข้อมูลหลัก)" },
    { id: "COMP-PREVIEW-01", name: "NEXUS Demo (ข้อมูลตัวอย่างดั้งเดิม)" },
    { id: "NEXUS-001", name: "บริษัท เน็กซัส เอ็นเตอร์ไพรส์ จำกัด" },
    { id: "NEXUS-002", name: "บจก. คอนสตรัคชั่น แพลนเน็ต" },
    { id: "NEXUS-003", name: "หจก. เทคอินโนเวชั่น" },
    { id: "NEXUS-004", name: "บริษัท โกลบอลเทรดดิ้ง กรุ๊ป" },
  ];

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Simple Validation Constraint
    if (!companyId) {
      setError("กรุณาเลือกรหัสบริษัท");
      return;
    }
    if (username.length < 3) {
      setError("ชื่อผู้ใช้งาน/อีเมล ต้องมีอย่างน้อย 3 ตัวอักษร");
      return;
    }

    // Save company ID to localStorage so AuthContext can use it globally
    localStorage.setItem("selectedCompanyId", companyId);

    setLoading(true);
    try {
      // --- MOCK STATUS CHECK ---
      if (username.toLowerCase() === "pending") {
        setError("บัญชีของคุณอยู่ระหว่างรอการอนุมัติจาก Super Admin (หากเกิน 24 ชม. จะถูกระงับ)");
        setLoading(false);
        return;
      }
      if (username.toLowerCase() === "expired") {
        setError("บัญชีถูกระงับการใช้งานชั่วคราว เนื่องจากไม่ได้รับการอนุมัติภายใน 24 ชั่วโมง");
        setLoading(false);
        return;
      }
      // --------------------------------

      let actualRole = "admin"; // Default assumption

      // Real Firebase Authentication
      if (username.includes("@")) {
        const userCredential = await signInWithEmailAndPassword(auth, username, password);
        const user = userCredential.user;
        
        // Super Admin Check
        if (user.uid === "fgIglIug2dh4aNMMeachaugIyFM2" || user.email === "sadmin@admin.com") {
          actualRole = "superadmin";
        }
      } else {
        await new Promise(resolve => setTimeout(resolve, 800));
        actualRole = username.toLowerCase() === "tech" ? "technician" 
                   : username.toLowerCase() === "customer" ? "customer" 
                   : "admin";
      }
      
      console.log(`User logged in with role: ${actualRole}`);
      
      // If superadmin, redirect directly to approvals dashboard or main
      if (actualRole === "superadmin") {
        router.push("/settings/approvals");
        router.refresh();
      } 
      // Customers/Techs go straight to their dashboard
      else if (actualRole === "customer" || actualRole === "technician") {
        router.push("/");
        router.refresh();
      } 
      // Normal Admins/Users need to select branch (Delegation)
      else {
        setStep(2); 
      }
    } catch (err: any) {
      console.error("Login Error:", err.code);
      setError(`ไม่สามารถเข้าสู่ระบบได้: ${err.code === 'auth/invalid-credential' ? 'รหัสประจำตัวหรือรหัสผ่านไม่ถูกต้อง' : 'เกิดข้อผิดพลาดในการเชื่อมต่อ'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branch || !department) {
      setError("กรุณาเลือกสาขาและแผนก/คลัง");
      return;
    }

    setLoading(true);
    // Mock save preferences/delegation
    await new Promise(resolve => setTimeout(resolve, 500));
    router.push("/");
    router.refresh();
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
              Welcome to the Next Generation of Enterprise Resource Planning.
            </h2>
            <p className="text-white/50 leading-relaxed font-light text-sm">
              Securely access your workspace. Our Multi-Tenant architecture ensures isolated, high-performance environments for your specific business units and branches.
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
            
            {/* Step 1: Main Credentials */}
            {step === 1 && (
              <form onSubmit={handleStep1Submit} className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-white tracking-wide">เข้าสู่ระบบ</h2>
                  <p className="text-white/40 text-sm mt-2">ระบุรหัสประจำตัวเพื่อเข้าถึงพื้นที่ทำงาน</p>
                </div>

                {error && (
                  <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-danger text-xs font-bold text-center animate-in shake">
                    {error}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-white/40 uppercase tracking-[0.1em] ml-4">รหัสบริษัท</label>
                  <PillSelect
                    value={companyId}
                    onChange={(e) => setCompanyId(e.target.value)}
                    className="h-9 px-6 bg-white/[0.03] border-white/10 font-sans text-[14px]"
                    required
                  >
                    <option value="" className="bg-surface-0 text-white/50">-- เลือกบริษัทที่เคยลงทะเบียน --</option>
                    {mockCompanies.map((c) => (
                      <option key={c.id} value={c.id} className="bg-surface-0 font-medium text-white">
                        {c.id} - {c.name}
                      </option>
                    ))}
                  </PillSelect>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-white/40 uppercase tracking-[0.1em] ml-4">ชื่อผู้ใช้งาน</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
                    <input 
                      type="text" 
                      placeholder="admin" 
                      className="w-full pl-12 h-9 px-6 rounded-full bg-white/[0.03] border border-white/10 text-white text-[14px] font-medium focus:outline-none focus:border-nexus-teal/40 focus:bg-white/[0.06] transition-all placeholder:text-white/10"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
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
                      placeholder="••••••••" 
                      className="w-full pl-12 pr-12 h-9 px-6 rounded-full bg-white/[0.03] border border-white/10 text-nexus-teal font-mono text-[14px] font-medium focus:outline-none focus:border-nexus-teal/40 focus:bg-white/[0.06] transition-all placeholder:text-white/10"
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
                  <button type="button" className="text-[11px] font-bold text-nexus-teal hover:text-white transition-colors">
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
                      ดำเนินการต่อ
                      <ArrowRight size={16} />
                    </>
                  )}
                </PillButton>
              </form>
            )}

            {/* Step 2: Access Delegation Modal */}
            {step === 2 && (
              <form onSubmit={handleStep2Submit} className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
                <div className="mb-8 flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-nexus-teal/10 border border-nexus-teal/20 flex items-center justify-center mb-4 text-nexus-teal shadow-[0_0_20px_rgba(0,255,209,0.2)]">
                    <Building2 size={24} />
                  </div>
                  <h2 className="text-xl font-bold text-white tracking-wide">สิทธิ์การเข้าถึงพื้นที่</h2>
                  <p className="text-white/40 text-xs mt-2">กรุณาเลือกสาขาและแผนกที่คุณต้องการเข้าทำงาน</p>
                </div>

                {error && (
                  <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-danger text-xs font-bold text-center animate-in shake">
                    {error}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-white/40 uppercase tracking-[0.1em] ml-4">เลือกสาขา</label>
                  <PillSelect
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="h-9 px-6 bg-white/[0.03] border-white/10 font-sans"
                    required
                  >
                    <option value="" className="bg-surface-0 text-white/50">-- กรุณาเลือกสาขา --</option>
                    <option value="HQ" className="bg-surface-0">สำนักงานใหญ่</option>
                    <option value="BKK" className="bg-surface-0">สาขากรุงเทพฯ</option>
                    <option value="CNX" className="bg-surface-0">สาขาเชียงใหม่</option>
                  </PillSelect>
                </div>

                <div className="space-y-1.5 mt-4">
                  <label className="text-[11px] font-medium text-white/40 uppercase tracking-[0.1em] ml-4">เลือกแผนก/คลัง</label>
                  <PillSelect
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="h-9 px-6 bg-white/[0.03] border-white/10 font-sans"
                    required
                  >
                    <option value="" className="bg-surface-0 text-white/50">-- กรุณาเลือกแผนก --</option>
                    <option value="WH01" className="bg-surface-0">คลังสินค้าหลัก</option>
                    <option value="SALES" className="bg-surface-0">แผนกขาย</option>
                    <option value="ADMIN" className="bg-surface-0">ส่วนกลาง</option>
                  </PillSelect>
                </div>

                <div className="pt-6 flex gap-3">
                  <PillButton 
                    type="button" 
                    variant="ghost"
                    onClick={() => setStep(1)}
                    className="w-full h-9 text-[13px] text-white/60 hover:text-white"
                  >
                    ย้อนกลับ
                  </PillButton>
                  <PillButton 
                    type="submit" 
                    variant="primary"
                    disabled={loading}
                    className="w-full h-9 text-[13px] shadow-neon-teal"
                  >
                    {loading ? <Loader2 className="animate-spin" size={16} /> : "เข้าสู่ระบบ"}
                  </PillButton>
                </div>
              </form>
            )}

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
