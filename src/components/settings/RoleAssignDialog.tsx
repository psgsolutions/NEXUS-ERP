"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ShieldCheck, X } from "lucide-react";
import { PillButton, PillInput, cn } from "@/components/ui/Base";
import { ASSIGNABLE_ROLES } from "@/lib/permissions";

/**
 * เลือกตำแหน่งของผู้ใช้ (ได้หลายตำแหน่ง) — ตอนอนุมัติบัญชี แก้ไขตำแหน่ง และสร้างบัญชีพนักงาน
 * - excludeRoles: ตำแหน่งที่ผู้กำหนดให้ไม่ได้ (ผู้ดูแลระบบ/HR ของบริษัทให้ตำแหน่งผู้ดูแลระบบไม่ได้)
 * - account: แสดงช่องชื่อและอีเมล (สร้างบัญชีใหม่)
 */
/** ชุดตำแหน่งสำหรับบริษัทขนาดเล็ก (คนหนึ่งทำหลายหน้าที่) — คลิกแล้วติ๊ก/เอาออกต่อเองได้ */
const ROLE_PRESETS: { label: string; hint: string; roles: string[] }[] = [
  { label: "ผู้บริหาร / เจ้าของ", hint: "ทำได้ทุกอย่างยกเว้นบัญชี อนุมัติและลงนามทุกเอกสาร", roles: ["EXECUTIVE"] },
  { label: "วิศวกร ทำทุกงานยกเว้นบัญชี", hint: "ขาย โครงการ จัดซื้อ คลัง งานช่าง", roles: ["ENGINEER", "SALES", "PURCHASING", "WAREHOUSE", "TECHNICIAN"] },
  { label: "บัญชี + ธุรการ", hint: "บัญชี ขาย/วางบิล จัดซื้อ คลัง บุคคล", roles: ["ACCOUNTANT", "SALES", "PURCHASING", "WAREHOUSE", "HR"] },
  { label: "ขาย + จัดซื้อ", hint: "ลูกค้า ใบเสนอราคา ออกใบกำกับ ใบสั่งซื้อ", roles: ["SALES", "PURCHASING"] },
  { label: "คลัง + ช่าง", hint: "รับ-เบิกของ ตรวจนับ งานหน้างาน", roles: ["WAREHOUSE", "TECHNICIAN"] },
];

export function RoleAssignDialog({
  open,
  title,
  subtitle,
  initialRoles,
  confirmLabel,
  busy,
  onClose,
  onConfirm,
  excludeRoles = [],
  account,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  initialRoles: string[];
  confirmLabel: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (roles: string[]) => void;
  excludeRoles?: string[];
  account?: { name: string; email: string; onChange: (v: { name: string; email: string }) => void };
}) {
  const options = ASSIGNABLE_ROLES.filter((r) => !excludeRoles.includes(r.value));
  const [selected, setSelected] = useState<string[]>(initialRoles);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (open) setSelected(initialRoles.filter((r) => ASSIGNABLE_ROLES.some((o) => o.value === r)));
  }, [open, initialRoles]);
  // ตำแหน่งที่ผู้กำหนดให้ไม่ได้แต่ผู้ใช้มีอยู่แล้ว: คงไว้ตามเดิม (ส่งกลับไปพร้อมตำแหน่งที่เลือก)
  const kept = selected.filter((r) => excludeRoles.includes(r));
  const accountOk = !account || (account.name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.email.trim()));

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
              {subtitle && <p className="text-[12px] text-white/50 truncate leading-normal">{subtitle}</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="text-white/40 hover:text-white p-1" aria-label="ปิด">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto">
          {account && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-4 mb-4 border-b border-white/10">
              <label className="space-y-1.5">
                <span className="block text-[12px] font-bold text-white/60">ชื่อ-นามสกุล</span>
                <PillInput value={account.name} onChange={(e) => account.onChange({ ...account, name: e.target.value })} placeholder="ชื่อพนักงาน" className="h-9" />
              </label>
              <label className="space-y-1.5">
                <span className="block text-[12px] font-bold text-white/60">อีเมล (ใช้เข้าระบบ)</span>
                <PillInput type="email" value={account.email} onChange={(e) => account.onChange({ ...account, email: e.target.value })} placeholder="name@company.com" className="h-9 font-mono" />
              </label>
            </div>
          )}
          <p className="text-[12px] text-white/50 pb-2">เลือกได้หลายตำแหน่ง สิทธิ์จะรวมกันตามทุกตำแหน่งที่เลือก · หรือเลือกชุดสำเร็จรูปสำหรับคนที่ทำหลายหน้าที่</p>
          <div className="flex flex-wrap gap-1.5 pb-3" data-role-presets>
            {ROLE_PRESETS.map((p) => {
              const roles = p.roles.filter((r) => options.some((o) => o.value === r));
              const on = roles.length > 0 && roles.length === selected.filter((r) => !excludeRoles.includes(r)).length && roles.every((r) => selected.includes(r));
              return (
                <PillButton key={p.label} variant="ghost" title={p.hint} disabled={!roles.length}
                  onClick={() => setSelected([...kept, ...roles])}
                  className={cn("h-8 px-3 text-[12px] normal-case tracking-normal font-semibold", on ? "bg-nexus-teal/15 text-nexus-teal border border-nexus-teal/40" : "border border-white/10 text-white/75")}>
                  {p.label}
                </PillButton>
              );
            })}
          </div>
          {kept.length > 0 && <p className="text-[12px] text-warning pb-3">ผู้ใช้นี้เป็นผู้ดูแลระบบของบริษัทอยู่แล้ว ตำแหน่งนี้คงไว้ตามเดิม</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {options.map((r) => {
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
          <PillButton variant="confirm" className="h-9 px-5 text-xs font-bold" disabled={busy || selected.length === 0 || !accountOk} onClick={() => onConfirm(selected)}>
            {confirmLabel}
          </PillButton>
        </div>
      </div>
    </div>,
    document.body
  );
}
