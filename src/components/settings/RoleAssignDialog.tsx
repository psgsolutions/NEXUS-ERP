"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ShieldCheck, X } from "lucide-react";
import { PillButton, cn } from "@/components/ui/Base";
import { ASSIGNABLE_ROLES } from "@/lib/permissions";

/**
 * เลือกตำแหน่งของผู้ใช้ (ได้หลายตำแหน่ง) — ใช้ตอนอนุมัติบัญชีและแก้ไขตำแหน่ง (เฉพาะ SUPERADMIN)
 */
export function RoleAssignDialog({
  open,
  title,
  subtitle,
  initialRoles,
  confirmLabel,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  initialRoles: string[];
  confirmLabel: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (roles: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>(initialRoles);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (open) setSelected(initialRoles.filter((r) => ASSIGNABLE_ROLES.some((o) => o.value === r)));
  }, [open, initialRoles]);

  if (!open || !mounted) return null;
  const toggle = (r: string) => setSelected((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));

  return createPortal(
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => !busy && onClose()} />
      <div className="relative w-full max-w-[760px] max-h-[90vh] flex flex-col bg-surface-0 border border-white/10 rounded-2xl shadow-2xl">
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-white/10">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-nexus-teal/10 border border-nexus-teal/20 text-nexus-teal flex items-center justify-center flex-shrink-0">
              <ShieldCheck size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="text-[16px] font-semibold text-white leading-normal">{title}</h3>
              {subtitle && <p className="text-[13px] text-white/50 truncate leading-normal">{subtitle}</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="text-white/40 hover:text-white p-1" aria-label="ปิด">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto">
          <p className="text-[12px] text-white/50 pb-3">เลือกได้หลายตำแหน่ง สิทธิ์จะรวมกันตามทุกตำแหน่งที่เลือก</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ASSIGNABLE_ROLES.map((r) => {
            const on = selected.includes(r.value);
            return (
              <button
                key={r.value}
                type="button"
                onClick={() => toggle(r.value)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border text-left transition-colors",
                  on ? "bg-nexus-teal/10 border-nexus-teal/40" : "bg-white/[0.02] border-white/10 hover:bg-white/5"
                )}
              >
                <span className={cn("w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0", on ? "bg-nexus-teal border-nexus-teal text-surface-0" : "border-white/30")}>
                  {on && <Check size={14} strokeWidth={3} />}
                </span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold text-white leading-normal">{r.label}</span>
                  <span className="block text-[12px] text-white/50 leading-normal truncate">{r.description}</span>
                </span>
              </button>
            );
          })}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-white/10">
          <PillButton variant="ghost" className="h-9 px-5 text-xs" onClick={onClose} disabled={busy}>ยกเลิก</PillButton>
          <PillButton variant="confirm" className="h-9 px-5 text-xs font-bold" disabled={busy || selected.length === 0} onClick={() => onConfirm(selected)}>
            {confirmLabel}
          </PillButton>
        </div>
      </div>
    </div>,
    document.body
  );
}
