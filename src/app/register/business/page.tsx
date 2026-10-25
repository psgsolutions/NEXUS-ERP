"use client";
import React, { useState } from "react";
import { PillButton, GlassCard, PillSelect } from "@/components/ui/Base";
import { Building2, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function RegisterBusinessPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);

  // Step 1 Data
  const [personType, setPersonType] = useState("juristic");
  const [taxId, setTaxId] = useState("");
  const [branchType, setBranchType] = useState("hq");
  const [branchCode, setBranchCode] = useState("");
  const [juristicType, setJuristicType] = useState("บริษัทจำกัด");
  const [companyName, setCompanyName] = useState("");
  const [vatReg, setVatReg] = useState("yes");

  // Step 2 Data
  const [businessType, setBusinessType] = useState("");
  const [customerType, setCustomerType] = useState<string[]>([]);
  const [employeeCount, setEmployeeCount] = useState("");

  // Step 2: บัญชีผู้ดูแลกิจการ (เจ้าของ)
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [registrationId, setRegistrationId] = useState("");

  const handleNextStep = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (step === 1) {
      if (taxId.length < 13) {
        setError("กรุณากรอกเลขทะเบียน 13 หลักให้ครบถ้วน");
        return;
      }
      if (branchType === "branch" && !branchCode.trim()) {
        setError("กรุณาระบุรหัสสาขา");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!businessType) {
        setError("กรุณาเลือกประเภทธุรกิจ");
        return;
      }
      if (!ownerName.trim() || !email.trim() || password.length < 8) {
        setError("กรุณากรอกชื่อ อีเมล และรหัสผ่าน (อย่างน้อย 8 ตัวอักษร) ของผู้ดูแลกิจการ");
        return;
      }
      setLoading(true);
      try {
        // สร้างคำขอเปิดกิจการ + บัญชีผู้ดูแล (รอ SUPERADMIN อนุมัติจึงสร้างบริษัทจริง)
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "business",
            personType,
            taxId,
            branchType,
            branchCode,
            juristicType: personType === "juristic" ? juristicType : "",
            companyName,
            vatRegistered: vatReg === "yes",
            businessType,
            customerTypes: customerType,
            employeeCount,
            ownerName,
            email,
            password,
          }),
        });
        const result = await res.json();
        if (!res.ok || !result.success) {
          setError(result.error || "ส่งคำขอไม่สำเร็จ กรุณาลองใหม่");
          return;
        }
        setRegistrationId(result.registrationId);
        setStep(3);
      } catch {
        setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่");
      } finally {
        setLoading(false);
      }
    }
  };

  const errorBox = error ? (
    <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-danger text-xs font-bold text-center">
      {error}
    </div>
  ) : null;

  const toggleCustomerType = (type: string) => {
    if (customerType.includes(type)) {
      setCustomerType(customerType.filter(t => t !== type));
    } else {
      setCustomerType([...customerType, type]);
    }
  };

  return (
    <div className="min-h-screen flex bg-surface-0 text-white overflow-hidden items-center justify-center p-6">
      
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] bg-nexus-teal/5 blur-[150px] rounded-full pointer-events-none mix-blend-screen" />
      
      <div className="w-full max-w-2xl z-10 animate-in fade-in zoom-in-95 duration-700">
        
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal shadow-neon-teal">
              <Building2 size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-wide">สร้างกิจการ</h2>
              <p className="text-white/40 text-xs mt-0.5">ระบุข้อมูลบริษัทเพื่อเปิดใช้งานระบบ Multi-Tenant</p>
            </div>
          </div>
          <Link href="/register" className="text-[11px] font-bold text-white/30 hover:text-white uppercase tracking-widest transition-colors">
            ยกเลิก
          </Link>
        </div>

        <GlassCard className="p-8 border-white/10 bg-zinc-900/60 shadow-2xl relative">
          
          {/* Progress Bar */}
          {step < 3 && (
            <div className="w-full h-1 bg-white/5 rounded-full mb-8 overflow-hidden flex">
              <div className="h-full bg-nexus-teal transition-all duration-500 opacity-50" style={{ width: step === 1 ? '50%' : '100%' }} />
            </div>
          )}

          {/* STEP 1: Basic Information */}
          {step === 1 && (
            <form onSubmit={handleNextStep} className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              {errorBox}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-medium text-white/40 uppercase tracking-[0.1em] ml-2">รูปแบบกิจการ</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setPersonType('juristic')} className={cn("flex-1 h-9 rounded-full text-[13px] font-bold transition-all border", personType === 'juristic' ? "bg-nexus-teal/20 text-nexus-teal border-nexus-teal/40" : "bg-white/[0.03] text-white/40 border-white/10 hover:bg-white/10")}>นิติบุคคล</button>
                    <button type="button" onClick={() => setPersonType('natural')} className={cn("flex-1 h-9 rounded-full text-[13px] font-bold transition-all border", personType === 'natural' ? "bg-nexus-teal/20 text-nexus-teal border-nexus-teal/40" : "bg-white/[0.03] text-white/40 border-white/10 hover:bg-white/10")}>บุคคลธรรมดา</button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-medium text-white/40 uppercase tracking-[0.1em] ml-2">เลขทะเบียน 13 หลัก</label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="เลขประจำตัวผู้เสียภาษี 13 หลัก"
                    className="flex-1 h-9 px-6 rounded-full bg-white/[0.03] border border-white/10 text-white font-mono text-[14px] font-medium focus:outline-none focus:border-nexus-teal/40 transition-all"
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value.replace(/\D/g, '').substring(0, 13))}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-medium text-white/40 uppercase tracking-[0.1em] ml-2">สาขา</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setBranchType('hq')} className={cn("flex-1 h-9 rounded-full text-[13px] font-bold transition-all border", branchType === 'hq' ? "bg-nexus-teal/20 text-nexus-teal border-nexus-teal/40" : "bg-white/[0.03] text-white/40 border-white/10 hover:bg-white/10")}>สนง.ใหญ่</button>
                    <button type="button" onClick={() => setBranchType('branch')} className={cn("flex-1 h-9 rounded-full text-[13px] font-bold transition-all border", branchType === 'branch' ? "bg-nexus-teal/20 text-nexus-teal border-nexus-teal/40" : "bg-white/[0.03] text-white/40 border-white/10 hover:bg-white/10")}>สาขา</button>
                  </div>
                </div>
                {branchType === 'branch' && (
                  <div className="space-y-2">
                    <label className="text-[11px] font-medium text-white/40 uppercase tracking-[0.1em] ml-2">รหัสสาขา</label>
                    <input type="text" placeholder="00000" className="w-full h-9 px-4 rounded-full bg-white/[0.03] border border-white/10 text-white font-mono focus:border-nexus-teal/40" value={branchCode} onChange={e => setBranchCode(e.target.value)} />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className={cn("col-span-1 space-y-2", personType !== "juristic" && "hidden")}>
                  <label className="text-[11px] font-medium text-white/40 uppercase tracking-[0.1em] ml-2">ประเภทนิติบุคคล</label>
                  <PillSelect value={juristicType} onChange={(e) => setJuristicType(e.target.value)} className="h-9 px-4 bg-white/[0.03] border-white/10 font-sans text-nexus-teal">
                    <option value="บริษัทจำกัด" className="bg-surface-0">บริษัทจำกัด</option>
                    <option value="หจก" className="bg-surface-0">ห้างหุ้นส่วนจำกัด</option>
                  </PillSelect>
                </div>
                <div className={cn("space-y-2", personType === "juristic" ? "col-span-2" : "col-span-3")}>
                  <label className="text-[11px] font-medium text-white/40 uppercase tracking-[0.1em] ml-2">ชื่อกิจการ</label>
                  <input type="text" placeholder="ระบุชื่อกิจการ..." className="w-full h-9 px-6 rounded-full bg-white/[0.03] border border-white/10 text-white font-medium focus:outline-none focus:border-nexus-teal/40 transition-all" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-medium text-white/40 uppercase tracking-[0.1em] ml-2">จดทะเบียนภาษีมูลค่าเพิ่ม</label>
                <div className="flex gap-2 w-[250px]">
                  <button type="button" onClick={() => setVatReg('yes')} className={cn("flex-1 h-9 rounded-full text-[13px] font-bold transition-all border", vatReg === 'yes' ? "bg-nexus-teal/20 text-nexus-teal border-nexus-teal/40" : "bg-white/[0.03] text-white/40 border-white/10 hover:bg-white/10")}>จดทะเบียน</button>
                  <button type="button" onClick={() => setVatReg('no')} className={cn("flex-1 h-9 rounded-full text-[13px] font-bold transition-all border", vatReg === 'no' ? "bg-nexus-teal/20 text-nexus-teal border-nexus-teal/40" : "bg-white/[0.03] text-white/40 border-white/10 hover:bg-white/10")}>ไม่จดทะเบียน</button>
                </div>
              </div>

              <div className="pt-4">
                <PillButton type="submit" variant="primary" className="w-full h-9 shadow-neon-teal text-[13px]">
                  ถัดไป <ArrowRight size={16} />
                </PillButton>
              </div>
            </form>
          )}

          {/* STEP 2: Business Profile */}
          {step === 2 && (
            <form onSubmit={handleNextStep} className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="mb-4">
                <h3 className="text-lg font-bold text-nexus-teal mb-1">ข้อมูลเกี่ยวกับกิจการของคุณ</h3>
                <p className="text-white/40 text-xs">บอกเราเพื่อให้เราแนะนำฟีเจอร์ที่ตอบโจทย์กิจการของคุณที่สุด</p>
              </div>
              {errorBox}

              <div className="space-y-3">
                <label className="text-[11px] font-bold text-white/60 uppercase tracking-[0.1em] ml-2">เลือกประเภทธุรกิจของคุณ</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { id: "trading", title: "ซื้อมาขายไป", desc: "ขายของออนไลน์, ขายปลีก" },
                    { id: "service", title: "ให้บริการ", desc: "ให้คำปรึกษา, รับออกแบบ" },
                    { id: "realestate", title: "อสังหาริมทรัพย์", desc: "รับเหมาก่อสร้าง, บ้านจัดสรร" },
                    { id: "manufacturing", title: "ผลิต", desc: "ผลิตอาหาร, ผลิตเครื่องจักร" },
                    { id: "accounting", title: "สำนักงานบัญชี", desc: "รับทำบัญชี, สอบบัญชี" },
                    { id: "other", title: "ธุรกิจอื่นๆ", desc: "" },
                  ].map((biz) => (
                    <div 
                      key={biz.id}
                      onClick={() => setBusinessType(biz.id)}
                      className={cn(
                        "p-3 rounded-xl border cursor-pointer transition-all",
                        businessType === biz.id ? "border-nexus-teal bg-nexus-teal/10 shadow-[0_0_10px_rgba(0,255,209,0.1)]" : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"
                      )}
                    >
                      <h4 className={cn("text-[13px] font-bold", businessType === biz.id ? "text-nexus-teal" : "text-white/80")}>{biz.title}</h4>
                      {biz.desc && <p className="text-[10px] text-white/40 mt-1">{biz.desc}</p>}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <label className="text-[11px] font-bold text-white/60 uppercase tracking-[0.1em] ml-2">ใครเป็นลูกค้าของคุณ (เลือกได้มากกว่า 1)</label>
                <div className="flex flex-wrap gap-2">
                  {["บุคคลทั่วไป", "นิติบุคคล", "รัฐบาล รัฐวิสาหกิจ", "ลูกค้าต่างชาติ"].map((cust) => (
                    <button
                      key={cust}
                      type="button"
                      onClick={() => toggleCustomerType(cust)}
                      className={cn(
                        "h-8 px-4 rounded-full text-[12px] font-bold transition-all border flex items-center gap-2",
                        customerType.includes(cust) ? "bg-nexus-teal/20 text-nexus-teal border-nexus-teal/40" : "bg-white/[0.03] text-white/40 border-white/10 hover:bg-white/10"
                      )}
                    >
                      {customerType.includes(cust) && <div className="w-1.5 h-1.5 rounded-full bg-nexus-teal shadow-neon-teal" />}
                      {cust}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <label className="text-[11px] font-medium text-white/40 uppercase tracking-[0.1em] ml-2">จำนวนพนักงานในกิจการ</label>
                <PillSelect value={employeeCount} onChange={(e) => setEmployeeCount(e.target.value)} className="h-9 px-4 bg-white/[0.03] border-white/10 font-sans max-w-[200px]">
                  <option value="" className="bg-surface-0">ระบุจำนวน...</option>
                  <option value="1-5" className="bg-surface-0">1 - 5 คน</option>
                  <option value="6-20" className="bg-surface-0">6 - 20 คน</option>
                  <option value="21-50" className="bg-surface-0">21 - 50 คน</option>
                  <option value="51+" className="bg-surface-0">51 คนขึ้นไป</option>
                </PillSelect>
              </div>

              <div className="space-y-3 pt-2 border-t border-white/5">
                <label className="text-[11px] font-bold text-white/60 uppercase tracking-[0.1em] ml-2 block pt-4">บัญชีผู้ดูแลกิจการ (ใช้เข้าสู่ระบบ)</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input type="text" placeholder="ชื่อ-นามสกุล" autoComplete="name" className="w-full h-9 px-4 rounded-full bg-white/[0.03] border border-white/10 text-white text-[14px] font-medium focus:outline-none focus:border-nexus-teal/40 transition-all" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} required />
                  <input type="email" placeholder="อีเมล" autoComplete="email" className="w-full h-9 px-4 rounded-full bg-white/[0.03] border border-white/10 text-white text-[14px] font-medium focus:outline-none focus:border-nexus-teal/40 transition-all" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  <input type="password" placeholder="รหัสผ่าน (8 ตัวขึ้นไป)" autoComplete="new-password" minLength={8} className="w-full h-9 px-4 rounded-full bg-white/[0.03] border border-white/10 text-white font-mono text-[14px] font-medium focus:outline-none focus:border-nexus-teal/40 transition-all" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <PillButton type="button" variant="ghost" onClick={() => setStep(1)} className="px-6 text-white/60">
                  ย้อนกลับ
                </PillButton>
                <PillButton type="submit" variant="primary" disabled={loading} className="flex-1 h-9 shadow-neon-teal text-[13px]">
                  {loading ? <Loader2 className="animate-spin" size={16} /> : "ยืนยันการสร้างกิจการ"}
                </PillButton>
              </div>
            </form>
          )}

          {/* STEP 3: Success */}
          {step === 3 && (
            <div className="py-12 flex flex-col items-center text-center animate-in fade-in zoom-in duration-500">
              <div className="w-20 h-20 bg-warning/20 rounded-full flex items-center justify-center text-warning shadow-[0_0_30px_rgba(255,197,61,0.3)] mb-6">
                <CheckCircle2 size={40} />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">ส่งคำขอสร้างกิจการสำเร็จ!</h2>
              <p className="text-white/50 text-sm mb-4 max-w-sm leading-relaxed">
                บันทึกคำขอของ <span className="text-white font-bold">{companyName}</span> แล้ว <strong className="text-warning">กำลังรอผู้ดูแลระบบ (SUPERADMIN) อนุมัติ</strong> เมื่ออนุมัติแล้วจะเข้าสู่ระบบด้วย {email} ได้ทันที
              </p>
              <div className="bg-warning/10 border border-warning/20 p-3 rounded-xl mb-8 max-w-sm">
                <p className="text-[11px] text-warning font-medium leading-relaxed">
                  * หากไม่ได้รับการอนุมัติภายใน 24 ชั่วโมง คำขอจะหมดอายุ กรุณาติดต่อผู้ดูแลระบบ
                </p>
              </div>
              <p className="text-white/50 text-sm mb-8">
                เลขที่คำขอ: <span className="text-nexus-teal font-mono bg-nexus-teal/10 px-2 py-0.5 rounded">{registrationId}</span>
              </p>
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
