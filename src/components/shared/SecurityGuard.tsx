"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { PillButton, GlassCard } from "@/components/ui/Base";
import { ShieldAlert, AlertCircle, X } from "lucide-react";

interface SecurityGuardProps {
  children: React.ReactNode;
  onConfirm: () => void;
  actionLabel?: string;
  requiredRole?: string[];
  message?: string;
}

/**
 * [SECURITY-PROTOCOL-V3.0]
 * Component to wrap sensitive actions (Delete, Purge, Reset).
 * Enforces Role-Based Access and shows a Sci-Fi styled confirmation.
 */
export function SecurityGuard({ 
  children, 
  onConfirm, 
  actionLabel = "ดำเนินการลบ",
  requiredRole = ["ADMIN", "SUPERADMIN"],
  message = "คุณแน่ใจหรือไม่ว่าต้องการดำเนินการนี้? ข้อมูลจะถูกลบออกถาวร"
}: SecurityGuardProps) {
  const { role } = useAuth();
  const [showConfirm, setShowConfirm] = useState(false);

  // Check if user has required role
  const hasAccess = role && requiredRole.includes(role.toUpperCase());

  if (!hasAccess) {
    return (
      <div className="relative group cursor-not-allowed">
        <div className="opacity-40 grayscale pointer-events-none">
          {children}
        </div>
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-950/90 backdrop-blur-md border border-cyan-500/40 text-cyan-100 font-mono tracking-wider text-[10px] px-2 py-1 rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.15)] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-[9999]">
          <span className="font-bold text-danger">RESTRICTED:</span> {actionLabel}
        </div>
      </div>
    );
  }

  return (
    <>
      <div onClick={() => setShowConfirm(true)}>
        {children}
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-[1000000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
          <GlassCard className="w-full max-w-md border-danger/30 shadow-[0_0_100px_rgba(239,68,68,0.2)] animate-in zoom-in-95 duration-300 ease-out">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 text-danger">
                <div className="p-2 rounded-lg bg-danger/10 border border-danger/20">
                  <AlertCircle size={24} />
                </div>
                <h3 className="text-xl font-semibold uppercase tracking-widest">Security Alert</h3>
              </div>
              
              <p className="text-white/60 text-sm leading-relaxed">
                {message}
              </p>

              <div className="flex gap-3 pt-4 border-t border-white/5">
                <PillButton 
                  variant="ghost" 
                  className="flex-1 hover:"
                  onClick={() => setShowConfirm(false)}
                >
                  ยกเลิก
                </PillButton>
                <PillButton 
                  variant="danger" 
                  className="flex-1"
                  onClick={() => {
                    onConfirm();
                    setShowConfirm(false);
                  }}
                >
                  {actionLabel}
                </PillButton>
              </div>
            </div>
          </GlassCard>
        </div>
      )}
    </>
  );
}
