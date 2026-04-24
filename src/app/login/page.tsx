"use client";
import React, { useState, useEffect } from "react";
import { PillButton, PillInput, GlassCard } from "@/components/ui/Base";
import { Cpu, Lock, Mail, ArrowRight, Loader2, ShieldAlert } from "lucide-react";
import { auth } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [configStatus, setConfigStatus] = useState<"checking" | "ok" | "fail">("checking");
  const router = useRouter();

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!apiKey) setConfigStatus("fail");
    else setConfigStatus("ok");
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (configStatus === "fail") return;
    setLoading(true);
    setError("");

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // [REDIRECT] Go to root Dashboard after success
      router.push("/"); 
      router.refresh();
    } catch (err: any) {
      console.error("Login Error:", err.code);
      setError(`Login Failed: ${err.code || "Unknown Error"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-[#020203]">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-nexus-blue/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-nexus-teal/10 blur-[120px] rounded-full" />

      <div className="w-full max-w-md z-10 animate-in fade-in zoom-in duration-700">
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 bg-nexus-blue rounded-3xl flex items-center justify-center shadow-nexus-glow mb-6 rotate-12 transition-transform hover:rotate-0 duration-500 animate-pulse-glow">
            <Cpu className="w-10 h-10 text-black" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">NEXUS <span className="text-nexus-blue">ERP</span></h1>
          <p className="text-white/40 text-[10px] font-black tracking-[0.3em] uppercase">Intelligence OS</p>
        </div>

        <GlassCard className="p-8 border-white/10 bg-zinc-900/40 relative">
          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="p-3 bg-danger/10 border border-danger/20 rounded-2xl text-danger text-[10px] font-bold text-center animate-in shake">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] ml-4">Identifier</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                <PillInput 
                  type="email" 
                  placeholder="admin@nexus-erp.com" 
                  className="w-full pl-12 h-12 bg-white/[0.03]"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] ml-4">Security Code</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                <PillInput 
                  type="password" 
                  placeholder="••••••••" 
                  className="w-full pl-12 h-12 bg-white/[0.03]"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="flex justify-end pr-4 pt-1">
                <button type="button" className="text-[10px] font-bold text-nexus-blue uppercase tracking-widest hover:text-white transition-colors">
                  Forgot Password?
                </button>
              </div>
            </div>

            <PillButton 
              type="submit" 
              disabled={loading}
              className="w-full h-12 text-sm gap-3 shadow-nexus-glow mt-4"
            >
              {loading ? <Loader2 className="animate-spin" /> : (
                <>
                  AUTHENTICATE ACCESS
                  <ArrowRight size={18} />
                </>
              )}
            </PillButton>
          </form>
        </GlassCard>
      </div>
    </div>
  );
}
