"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FileSignature, Plus, Save, ShieldCheck, Stamp, Trash2 } from "lucide-react";
import { GlassCard, PillButton, PillCheckbox, PillInput, PillSelect, cn } from "@/components/ui/Base";
import { InfoTip, WhatHappens } from "@/components/guide/Guidance";
import { apiFetch } from "@/lib/api-client";
import { LetterBuilder } from "./LetterBuilder";
import {
  DEFAULT_GUARANTEE_PERCENT, EBIDDING_THRESHOLD, GUARANTEE_FORM_LABELS, GUARANTEE_LABELS, METHOD_LABELS, STAMP_LABELS,
  guaranteeAmount, normalizeContract, penaltyAccrued, stampDuty, suggestMethod, warrantyEnd,
  type Guarantee, type GuaranteeForm, type GuaranteeType, type ProcurementMethod, type ProjectContract, type StampMethod,
} from "@/lib/gov-contract";

/**
 * แท็บ "สัญญา & หลักประกัน" ของโครงการ: วิธีจัดซื้อ เลขที่สัญญา/ใบสั่ง กำหนดส่งมอบ ค่าปรับ ระยะรับประกัน อากรแสตมป์ หลักประกัน
 * ระบบแจ้งเตือนเอง: ใกล้ครบกำหนดส่งมอบ / ส่งช้า (ค่าปรับ) / หลักประกันใกล้หมดอายุ / ถึงเวลาขอคืนหลักประกัน
 */

const money = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const todayBkk = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

const Field = ({ label, tip, children, className }: { label: string; tip?: string; children: React.ReactNode; className?: string }) => (
  <div className={cn("space-y-1", className)}>
    <label className="text-[12px] font-bold text-white/70 ml-1 flex items-center">{label}{tip && <InfoTip text={tip} />}</label>
    {children}
  </div>
);

export function ContractPanel({ companyId, docId, project, canEdit }: { companyId: string; docId: string; project: any; canEdit: boolean }) {
  const defaultValue = Number(project?.governmentDetails?.budgetAmount) || Number(project?.budgetSummary?.grandTotalWithVat) || 0;
  const fallback = useMemo(() => ({ sector: project?.sectorType, value: defaultValue, warrantyMonths: project?.warrantyMonths }), [project?.sectorType, defaultValue, project?.warrantyMonths]);
  const [c, setC] = useState<ProjectContract>(() => normalizeContract(project?.contract, fallback));
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setC(normalizeContract(project?.contract, fallback)); }, [project?.contract, fallback]);

  const set = (patch: Partial<ProjectContract>) => setC((x) => ({ ...x, ...patch }));
  const setG = (i: number, patch: Partial<Guarantee>) => setC((x) => ({ ...x, guarantees: x.guarantees.map((g, k) => (k === i ? { ...g, ...patch } : g)) }));
  const addG = (type: GuaranteeType) => setC((x) => ({ ...x, guarantees: [...x.guarantees, { id: `${type}-${Date.now().toString(36)}`, type, form: "BANK_GUARANTEE", percent: DEFAULT_GUARANTEE_PERCENT[type], amount: guaranteeAmount(DEFAULT_GUARANTEE_PERCENT[type], x.contractValue) }] }));

  const suggested = suggestMethod(project?.sectorType || "", c.contractValue);
  const today = todayBkk();
  const penalty = penaltyAccrued(c, today);
  const wEnd = warrantyEnd(c);
  const duty = stampDuty(c.stamp?.base ?? c.contractValue);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await apiFetch("/api/projects/contract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, projectDocId: docId, contract: c }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.success) throw new Error(d.error || "บันทึกไม่สำเร็จ");
      setMsg({ text: "บันทึกข้อมูลสัญญาแล้ว — ระบบจะแจ้งเตือนกำหนดส่งมอบและหลักประกันให้" });
    } catch (e: any) {
      setMsg({ text: e.message, error: true });
    } finally {
      setSaving(false);
    }
  };

  const dateInput = (value: string | undefined, onChange: (v: string | undefined) => void) => (
    <PillInput type="date" value={value || ""} onChange={(e) => onChange(e.target.value || undefined)} className="w-full h-9 text-sm font-mono" />
  );

  return (
    <div className="space-y-4">
      {msg && <div className={cn("p-3 rounded-xl text-xs font-bold border", msg.error ? "bg-danger/10 border-danger/20 text-danger" : "bg-nexus-teal/10 border-nexus-teal/20 text-nexus-teal")}>{msg.text}</div>}

      <WhatHappens title="ระบบช่วยติดตามให้" items={[
        "แจ้งเตือนก่อนครบกำหนดส่งมอบ 7 วัน และเมื่อส่งช้า (บอกค่าปรับต่อวัน/สะสม)",
        "แจ้งเตือนหลักประกันที่จะหมดอายุภายใน 30 วัน",
        "พ้นระยะรับประกันแล้ว แจ้งให้ทำหนังสือขอคืนหลักประกันสัญญา",
      ]} />

      <fieldset disabled={!canEdit} className="space-y-4">
        <GlassCard className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-[15px] font-bold text-white"><FileSignature size={17} className="text-nexus-teal" /> สัญญา / ใบสั่ง</h3>
            {canEdit && <PillButton variant="save" onClick={save} disabled={saving} className="h-9 px-5 text-xs"><Save size={14} className="mr-1.5" /> {saving ? "กำลังบันทึก..." : "บันทึกข้อมูลสัญญา"}</PillButton>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
            <Field label="วิธีจัดซื้อจัดจ้าง" tip={`งานราชการ: วงเงินเกิน ${EBIDDING_THRESHOLD.toLocaleString("th-TH")} บาท (รวม VAT) ใช้ e-bidding · ไม่เกินใช้วิธีเฉพาะเจาะจง — ยึดตามประกาศของหน่วยงาน`}>
              <PillSelect value={c.method} onChange={(e) => set({ method: e.target.value as ProcurementMethod })} className="w-full h-9 text-sm">
                {(Object.keys(METHOD_LABELS) as ProcurementMethod[]).map((m) => <option key={m} value={m}>{METHOD_LABELS[m]}{m === suggested ? " (แนะนำ)" : ""}</option>)}
              </PillSelect>
            </Field>
            <Field label="มูลค่าตามสัญญา (รวม VAT)"><PillInput inputMode="decimal" value={c.contractValue || ""} onChange={(e) => set({ contractValue: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })} className="w-full h-9 text-sm text-right font-mono" /></Field>
            <Field label="เลขที่สัญญา"><PillInput value={c.contractNo || ""} onChange={(e) => set({ contractNo: e.target.value })} className="w-full h-9 text-sm" /></Field>
            <Field label="เลขที่ใบสั่งซื้อ/ใบสั่งจ้าง"><PillInput value={c.orderNo || ""} onChange={(e) => set({ orderNo: e.target.value })} className="w-full h-9 text-sm" /></Field>
            <Field label="วันลงนามสัญญา">{dateInput(c.signDate, (v) => set({ signDate: v }))}</Field>
            <Field label="วันเริ่มงาน">{dateInput(c.startDate, (v) => set({ startDate: v }))}</Field>
            <Field label="ครบกำหนดส่งมอบ">{dateInput(c.dueDate, (v) => set({ dueDate: v }))}</Field>
            <Field label="วันส่งมอบงานจริง" tip="เริ่มนับระยะรับประกัน และหยุดนับค่าปรับ">{dateInput(c.handoverDate, (v) => set({ handoverDate: v }))}</Field>
            <Field label="ค่าปรับ (% ของค่าจ้าง ต่อวัน)" tip="ตามสัญญา เช่น งานจ้างมัก 0.01–0.10% ต่อวัน"><PillInput inputMode="decimal" value={c.penaltyRatePct ?? ""} onChange={(e) => set({ penaltyRatePct: e.target.value === "" ? undefined : Number(e.target.value.replace(/[^\d.]/g, "")) })} className="w-full h-9 text-sm text-right font-mono" /></Field>
            <Field label="ค่าปรับขั้นต่ำ (บาท/วัน)"><PillInput inputMode="decimal" value={c.penaltyMinPerDay ?? ""} onChange={(e) => set({ penaltyMinPerDay: e.target.value === "" ? undefined : Number(e.target.value.replace(/[^\d.]/g, "")) })} className="w-full h-9 text-sm text-right font-mono" /></Field>
            <Field label="ระยะรับประกัน (เดือน)"><PillInput inputMode="numeric" value={c.warrantyMonths ?? ""} onChange={(e) => set({ warrantyMonths: e.target.value === "" ? undefined : Number(e.target.value.replace(/\D/g, "")) })} className="w-full h-9 text-sm text-right font-mono" /></Field>
            <div className="space-y-1 text-[13px] text-white/70 self-end pb-1">
              {penalty.daysLate > 0 && <p className="text-warning font-bold">ส่งช้า {penalty.daysLate} วัน · ค่าปรับสะสม {money(penalty.total)} บาท</p>}
              {wEnd && <p>สิ้นสุดรับประกัน {wEnd}</p>}
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-5 space-y-4">
          <h3 className="flex items-center gap-2 text-[15px] font-bold text-white"><Stamp size={17} className="text-nexus-blue" /> อากรแสตมป์ (สัญญาจ้างทำของ)<InfoTip text="1 บาท ต่อทุก 1,000 บาทของค่าจ้าง (เศษคิดเป็น 1,000) · วิธีชำระ ปิดแสตมป์ / ชำระเป็นตัวเงิน / e-Stamp ให้เลือกตามที่หน่วยงานหรือสรรพากรกำหนด" /></h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
            <Field label="ฐานคำนวณ (ค่าจ้างตามสัญญา)"><PillInput inputMode="decimal" value={c.stamp?.base ?? c.contractValue ?? ""} onChange={(e) => set({ stamp: { ...(c.stamp || { base: 0 }), base: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 } })} className="w-full h-9 text-sm text-right font-mono" /></Field>
            <Field label="ค่าอากร (บาท)"><div className="h-9 px-4 rounded-full border border-white/10 bg-white/[0.03] flex items-center justify-end font-mono text-white">{duty.toLocaleString("th-TH")}</div></Field>
            <Field label="วิธีชำระ">
              <PillSelect value={c.stamp?.method || ""} onChange={(e) => set({ stamp: { ...(c.stamp || { base: c.contractValue }), method: (e.target.value || undefined) as StampMethod } })} className="w-full h-9 text-sm">
                <option value="">ยังไม่ระบุ</option>
                {(Object.keys(STAMP_LABELS) as StampMethod[]).map((m) => <option key={m} value={m}>{STAMP_LABELS[m]}</option>)}
              </PillSelect>
            </Field>
            <Field label="เลขที่ใบเสร็จ/อ้างอิง"><PillInput value={c.stamp?.ref || ""} onChange={(e) => set({ stamp: { ...(c.stamp || { base: c.contractValue }), ref: e.target.value } })} className="w-full h-9 text-sm" /></Field>
          </div>
          <PillCheckbox label="ชำระอากรแล้ว" checked={!!c.stamp?.paid} onChange={(e) => set({ stamp: { ...(c.stamp || { base: c.contractValue }), paid: e.target.checked } })} />
        </GlassCard>

        <GlassCard className="p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-[15px] font-bold text-white"><ShieldCheck size={17} className="text-nexus-teal" /> หลักประกัน<InfoTip text="ค่าตั้งต้น 5% ของวงเงิน (หลักประกันซอง/สัญญา) — แก้ตามเอกสารประกวดราคา/สัญญาของหน่วยงาน" /></h3>
            {canEdit && (
              <div className="flex flex-wrap gap-2">
                {(["BID", "PERFORMANCE", "ADVANCE", "WARRANTY"] as GuaranteeType[]).map((t) => (
                  <PillButton key={t} variant="glass" className="h-8 px-3 text-xs" onClick={() => addG(t)}><Plus size={13} className="mr-1" /> {GUARANTEE_LABELS[t]}</PillButton>
                ))}
              </div>
            )}
          </div>
          {!c.guarantees.length && <p className="text-[13px] text-white/50">ยังไม่มีหลักประกัน — งานราชการที่ประกวดราคามักต้องวางหลักประกันซองตอนยื่น และหลักประกันสัญญาตอนทำสัญญา</p>}
          {c.guarantees.map((g, i) => (
            <div key={g.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[14px] font-bold text-white">{GUARANTEE_LABELS[g.type]}</p>
                {canEdit && <button type="button" aria-label="ลบหลักประกัน" onClick={() => setC((x) => ({ ...x, guarantees: x.guarantees.filter((_, k) => k !== i) }))} className="p-1.5 rounded-full text-white/40 hover:text-danger"><Trash2 size={15} /></button>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3">
                <Field label="รูปแบบ">
                  <PillSelect value={g.form} onChange={(e) => setG(i, { form: e.target.value as GuaranteeForm })} className="w-full h-9 text-sm">
                    {(Object.keys(GUARANTEE_FORM_LABELS) as GuaranteeForm[]).map((f) => <option key={f} value={f}>{GUARANTEE_FORM_LABELS[f]}</option>)}
                  </PillSelect>
                </Field>
                <Field label="%"><PillInput inputMode="decimal" value={g.percent} onChange={(e) => { const p = Number(e.target.value.replace(/[^\d.]/g, "")) || 0; setG(i, { percent: p, amount: guaranteeAmount(p, c.contractValue) }); }} className="w-full h-9 text-sm text-right font-mono" /></Field>
                <Field label="จำนวนเงิน"><PillInput inputMode="decimal" value={g.amount} onChange={(e) => setG(i, { amount: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })} className="w-full h-9 text-sm text-right font-mono" /></Field>
                <Field label="เลขที่ / ธนาคาร"><PillInput value={[g.number, g.issuer].filter(Boolean).join(" / ")} onChange={(e) => { const [number, ...rest] = e.target.value.split("/"); setG(i, { number: number.trim(), issuer: rest.join("/").trim() }); }} placeholder="LG-001 / กสิกรไทย" className="w-full h-9 text-sm" /></Field>
                <Field label="วันออก">{dateInput(g.issueDate, (v) => setG(i, { issueDate: v }))}</Field>
                <Field label="วันหมดอายุ">{dateInput(g.expiryDate, (v) => setG(i, { expiryDate: v }))}</Field>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <PillCheckbox label="ได้รับคืนแล้ว" checked={!!g.returned} onChange={(e) => setG(i, { returned: e.target.checked, returnDate: e.target.checked ? g.returnDate || today : undefined })} />
                {g.returned && <div className="w-[170px]">{dateInput(g.returnDate, (v) => setG(i, { returnDate: v }))}</div>}
              </div>
            </div>
          ))}
        </GlassCard>
      </fieldset>

      <LetterBuilder companyId={companyId} project={project} contract={c} />
    </div>
  );
}
