"use client";

import React, { useState } from "react";
import { PillButton, PillInput, GlassCard } from "@/components/ui/Base";
import { Cpu, Lock, Mail, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Logic for Firebase Auth will go here
    console.log("Logging in with:", email, password);
    // Temporary redirect simulation
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-nexus-blue/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-nexus-teal/10 blur-[120px] rounded-full" />

      <div className="w-full max-w-md z-10">
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 bg-nexus-blue rounded-3xl flex items-center justify-center shadow-nexus-glow mb-6 rotate-12">
            <Cpu className="w-10 h-10 text-black -rotate-12" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">NEXUS <span className="text-nexus-blue">ERP</span></h1>
          <p className="text-white/40 text-sm">Intelligence OS for Modern Business</p>
        </div>

        <GlassCard className="p-8 border-white/10 bg-zinc-900/40">
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/40 uppercase tracking-widest ml-4">อีเมลผู้ใช้งาน</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                <PillInput 
                  type="email" 
                  placeholder="name@company.com" 
                  className="w-full pl-12 h-12"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-white/40 uppercase tracking-widest ml-4">รหัสผ่าน</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                <PillInput 
                  type="password" 
                  placeholder="••••••••" 
                  className="w-full pl-12 h-12"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-between px-2">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="w-4 h-4 rounded-full border border-white/20 flex items-center justify-center group-hover:border-nexus-blue transition-colors">
                  <div className="w-2 h-2 rounded-full bg-nexus-blue scale-0 group-hover:scale-100 transition-transform" />
                </div>
                <span className="text-xs text-white/40 group-hover:text-white/60 transition-colors">จดจำการเข้าระบบ</span>
              </label>
              <Link href="#" className="text-xs text-nexus-blue hover:underline">ลืมรหัสผ่าน?</Link>
            </div>

            <PillButton type="submit" className="w-full h-12 text-lg gap-2 shadow-nexus-glow mt-4">
              เข้าสู่ระบบอัจฉริยะ
              <ArrowRight size={20} />
            </PillButton>
          </form>
        </GlassCard>

        <p className="text-center mt-8 text-xs text-white/20">
          &copy; 2026 NEXUS ERP Enterprise. All rights reserved.
          <br />
          Security Level: Grade-A Encrypted
        </p>
      </div>
    </div>
  );
}
