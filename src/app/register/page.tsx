"use client";
import React from "react";
import { GlassCard } from "@/components/ui/Base";
import { Cpu, Building2, UserPlus, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPortalPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex bg-surface-0 text-white overflow-hidden">
      {/* Left Side: Brand & Illustration */}
      <div className="hidden lg:flex w-1/2 relative items-center justify-center border-r border-white/5 bg-surface-0 p-12 overflow-hidden">
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
              Join the Ecosystem.
            </h2>
            <p className="text-white/50 leading-relaxed font-light text-sm">
              Register your organization to set up a new Multi-Tenant workspace, or create an account to access an existing workspace as a customer or technician.
            </p>
          </div>
        </div>
      </div>

      {/* Right Side: Selection Container */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-6 lg:p-12 relative">
        <div className="w-full max-w-md z-10 animate-in fade-in zoom-in duration-700">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white tracking-wide">เลือกลักษณะการสมัคร</h2>
            <p className="text-white/40 text-sm mt-2">โปรดระบุว่าคุณต้องการลงทะเบียนในรูปแบบใด</p>
          </div>

          <div className="space-y-4">
            {/* Business Card */}
            <GlassCard 
              className="p-6 cursor-pointer hover:bg-nexus-teal/5 transition-all group"
            >
              <div 
                className="flex items-start gap-4"
                onClick={() => router.push("/register/business")}
              >
                <div className="w-12 h-12 rounded-full bg-nexus-teal/10 flex items-center justify-center text-nexus-teal shadow-[0_0_15px_rgba(0,255,209,0.2)] group-hover:scale-110 transition-transform">
                  <Building2 size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white group-hover:text-nexus-teal transition-colors">สมัครแบบเพิ่มกิจการ</h3>
                  <p className="text-white/50 text-xs mt-1 leading-relaxed">
                    สร้างฐานข้อมูลสำหรับองค์กรของคุณ ตั้งค่าสาขา และบริหารจัดการสิทธิ์พนักงาน
                  </p>
                </div>
                <ArrowRight className="text-white/20 group-hover:text-nexus-teal group-hover:translate-x-1 transition-all mt-2" size={20} />
              </div>
            </GlassCard>

            {/* User Card */}
            <GlassCard 
              className="p-6 cursor-pointer hover:bg-nexus-blue/5 transition-all group"
            >
              <div 
                className="flex items-start gap-4"
                onClick={() => router.push("/register/user")}
              >
                <div className="w-12 h-12 rounded-full bg-nexus-blue/10 flex items-center justify-center text-nexus-blue shadow-[0_0_15px_rgba(0,102,255,0.2)] group-hover:scale-110 transition-transform">
                  <UserPlus size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white group-hover:text-nexus-blue transition-colors">สมัครเป็นลูกค้า / ช่างเทคนิค</h3>
                  <p className="text-white/50 text-xs mt-1 leading-relaxed">
                    สร้างบัญชีผู้ใช้งานภายใต้กิจการที่มีอยู่แล้ว เพื่อใช้สำหรับแจ้งซ่อม, ตรวจสอบโครงการ หรือสำหรับช่างเทคนิค
                  </p>
                </div>
                <ArrowRight className="text-white/20 group-hover:text-nexus-blue group-hover:translate-x-1 transition-all mt-2" size={20} />
              </div>
            </GlassCard>
          </div>

          <div className="mt-8 text-center">
            <Link href="/login" className="text-xs text-white/40 hover:text-white transition-colors uppercase tracking-widest font-bold">
              &larr; กลับหน้าเข้าสู่ระบบ
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
