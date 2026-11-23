"use client";

import React, { useMemo } from "react";
import { Layers, Plus, Trash2 } from "lucide-react";
import { PillButton, PillInput, PillTextarea, cn } from "@/components/ui/Base";
import { formatCurrency } from "@/lib/erp-logic";
import { FieldHistory } from "@/components/ui/FieldHistory";
import { useBom } from "@/hooks/useBom";
import { useSystemDialog } from "@/context/DialogContext";
import { sowForLines } from "@/lib/bom-kinds";

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
  grandTotal, schedules, onSchedules, warrantyTerms, onWarranty, scopeOfWork, onScope, exclusions, onExclusions, readOnly = false, items,
}: {
  grandTotal: number;
  schedules: PaymentSchedule[];
  onSchedules: (next: PaymentSchedule[]) => void;
  warrantyTerms: string; onWarranty: (v: string) => void;
  scopeOfWork: string; onScope: (v: string) => void;
  exclusions: string; onExclusions: (v: string) => void;
  readOnly?: boolean;
  /** บรรทัดในใบเสนอราคา — มีงานบริการแบบ BOM = เติมขอบเขตงาน/ข้อยกเว้นตามหมวดและรูปแบบที่ใช้ได้ */
  items?: any[];
}) {
  const { settings } = useBom();
  const { showConfirm } = useSystemDialog();
  const sow = useMemo(() => sowForLines((items || []).map((i) => i?.recipe?.bom || {}), settings), [items, settings]);
  const fillSow = async () => {
    if ((scopeOfWork.trim() || exclusions.trim()) && !(await showConfirm(`แทนที่ขอบเขตงานและข้อยกเว้นเดิมด้วยข้อความมาตรฐานของงาน${sow.kinds.join(", ")}?`, "เติมขอบเขตงานจาก BOM"))) return;
    onScope(sow.scope);
    onExclusions(sow.exclusions);
  };
  const total = schedules.reduce((s, p) => s + (Number(p.percent) || 0), 0);
  const set = (id: string, patch: Partial<PaymentSchedule>) => onSchedules(schedules.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const HK: Record<string, string> = { "การรับประกัน": "quotation.warranty", "ขอบเขตงาน": "quotation.scope", "ข้อยกเว้น": "quotation.exclusions" };
  const field = (label: string, value: string, onChange: (v: string) => void, placeholder: string, multi = false) => (
    <div className="space-y-1">
      <label className="text-[11px] font-bold text-white/70">{label}</label>
      <FieldHistory k={HK[label] || "quotation.term"} value={value} onPick={readOnly ? () => undefined : onChange}>
        {multi ? (
          // หลายบรรทัด (ขอบเขตงานจาก BOM เป็นรายข้อ) — พิมพ์ลงใบเสนอราคาตามบรรทัด
          <PillTextarea value={value} disabled={readOnly} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={Math.min(12, Math.max(2, value.split(/\r?\n/).length + (value ? 1 : 0)))}
            className="bg-black/20" />
        ) : (
          <PillInput value={value} disabled={readOnly} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full h-8 text-[12px]" />
        )}
      </FieldHistory>
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
        <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
          <h3 className="text-base font-semibold uppercase tracking-widest text-white/80">ข้อกำหนดและการรับประกัน</h3>
          {!readOnly && sow.kinds.length > 0 && (
            <PillButton variant="ghost" onClick={fillSow} className="h-8 px-3 text-[11px] text-nexus-teal normal-case tracking-normal" data-fill-sow title={`ขอบเขตงานมาตรฐานของงาน${sow.kinds.join(", ")} ตามรูปแบบที่ใช้ในใบนี้`}>
              <Layers size={12} /> เติมขอบเขตงานจาก BOM
            </PillButton>
          )}
        </div>
        <div className="space-y-2">
          {field("การรับประกัน", warrantyTerms, onWarranty, "การรับประกันสินค้า 1 ปี...")}
          {field("ขอบเขตงาน", scopeOfWork, onScope, "ขอบเขตการติดตั้งและทดสอบ...", true)}
          {field("ข้อยกเว้น", exclusions, onExclusions, "ไม่รวมงานเดินสายระบบไฟฟ้าหลัก...", true)}
        </div>
      </div>
    </div>
  );
}
