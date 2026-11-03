"use client";

import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { PillButton, PillInput, cn } from "@/components/ui/Base";
import { formatCurrency } from "@/lib/erp-logic";

/** งวดชำระของใบเสนอราคา (สัดส่วน % ของยอดรวม) */
export interface PaymentSchedule { id: string; name: string; percent: number; amount: number }

export const DEFAULT_PAYMENT_SCHEDULES: PaymentSchedule[] = [
  { id: "1", name: "งวดที่ 1 (มัดจำ)", percent: 50, amount: 0 },
  { id: "2", name: "งวดที่ 2 (ส่งมอบงาน)", percent: 50, amount: 0 },
];

/**
 * งวดชำระ + ข้อกำหนดและการรับประกัน (ใช้ทั้งหน้าสร้างและหน้าแก้ไขใบเสนอราคา)
 * รวมสัดส่วนงวดต้องได้ 100% (หน้าจอตรวจตอนบันทึก)
 */
export function QuotationTermsCards({
  grandTotal, schedules, onSchedules, warrantyTerms, onWarranty, scopeOfWork, onScope, exclusions, onExclusions, readOnly = false,
}: {
  grandTotal: number;
  schedules: PaymentSchedule[];
  onSchedules: (next: PaymentSchedule[]) => void;
  warrantyTerms: string; onWarranty: (v: string) => void;
  scopeOfWork: string; onScope: (v: string) => void;
  exclusions: string; onExclusions: (v: string) => void;
  readOnly?: boolean;
}) {
  const total = schedules.reduce((s, p) => s + (Number(p.percent) || 0), 0);
  const set = (id: string, patch: Partial<PaymentSchedule>) => onSchedules(schedules.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const field = (label: string, value: string, onChange: (v: string) => void, placeholder: string) => (
    <div className="space-y-1">
      <label className="text-[11px] font-bold text-white/70">{label}</label>
      <PillInput value={value} disabled={readOnly} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full h-8 text-[12px]" />
    </div>
  );
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-surface-1 border border-white/10 rounded-3xl p-4 shadow-2xl space-y-3">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <h3 className="text-base font-semibold uppercase tracking-widest text-white/80">เงื่อนไขการชำระเงิน (งวดชำระ)</h3>
          {!readOnly && (
            <PillButton variant="ghost" onClick={() => onSchedules([...schedules, { id: Date.now().toString(), name: `งวดที่ ${schedules.length + 1}`, percent: 0, amount: 0 }])} className="h-8 px-3 text-[11px] text-nexus-teal normal-case tracking-normal">
              <Plus size={12} /> เพิ่มงวดชำระ
            </PillButton>
          )}
        </div>
        <div className="space-y-2">
          {schedules.map((sch) => (
            <div key={sch.id} className="grid grid-cols-12 gap-2 items-center bg-black/20 p-2 rounded-xl border border-white/5">
              <PillInput value={sch.name} disabled={readOnly} onChange={(e) => set(sch.id, { name: e.target.value })} placeholder="ชื่องวด..." className="col-span-5 h-8 text-[12px] font-bold" />
              <div className="col-span-3 flex items-center gap-1">
                <PillInput inputMode="decimal" value={sch.percent ? String(sch.percent) : ""} disabled={readOnly} onChange={(e) => set(sch.id, { percent: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })} placeholder="0" className="h-8 text-[12px] text-right font-mono" />
                <span className="text-[11px] text-white/50 font-bold">%</span>
              </div>
              <div className="col-span-3 text-right font-mono text-[12px] font-bold text-nexus-teal">{formatCurrency(grandTotal * ((Number(sch.percent) || 0) / 100))}</div>
              <div className="col-span-1 text-center">
                {!readOnly && (
                  <PillButton variant="ghost" onClick={() => onSchedules(schedules.filter((p) => p.id !== sch.id))} className="h-8 w-8 px-0 text-danger/70" title="ลบงวดชำระ" aria-label="ลบงวดชำระ">
                    <Trash2 size={13} />
                  </PillButton>
                )}
              </div>
            </div>
          ))}
          <div className="flex justify-between items-center text-[11px] font-bold px-2 pt-1">
            <span className="text-white/60">รวมสัดส่วนงวดชำระ:</span>
            <span className={cn("font-mono font-black", Math.abs(total - 100) < 0.01 || !schedules.length ? "text-nexus-teal" : "text-danger")}>{total}%</span>
          </div>
        </div>
      </div>

      <div className="bg-surface-1 border border-white/10 rounded-3xl p-4 shadow-2xl space-y-3">
        <h3 className="text-base font-semibold uppercase tracking-widest text-white/80 border-b border-white/10 pb-2">ข้อกำหนดและการรับประกัน</h3>
        <div className="space-y-2">
          {field("การรับประกัน", warrantyTerms, onWarranty, "การรับประกันสินค้า 1 ปี...")}
          {field("ขอบเขตงาน", scopeOfWork, onScope, "ขอบเขตการติดตั้งและทดสอบ...")}
          {field("ข้อยกเว้น", exclusions, onExclusions, "ไม่รวมงานเดินสายระบบไฟฟ้าหลัก...")}
        </div>
      </div>
    </div>
  );
}
