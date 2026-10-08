"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSystemDialog } from "@/context/DialogContext";
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { GlassCard, PillButton, PillInput, PillSelect, cn } from "@/components/ui/Base";
import { SmartSelect } from "@/components/ui/SmartComponents";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api-client";
import { can } from "@/lib/permissions";
import { ACCOUNT_TYPE_TH, BOOK_TYPES, CHART_OF_ACCOUNTS } from "@/lib/chart-of-accounts";

interface Line { id: number; accountCode: string; description: string; debit: string; credit: string }

const baht = (n: number) => (Number(n) || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (s: string) => Math.round((Number(String(s).replace(/,/g, "")) || 0) * 100) / 100;
const cleanAmount = (s: string) => s.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1").replace(/^(\d*\.\d{0,2}).*$/, "$1");
const today = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
let seq = 0;
const blankLine = (): Line => ({ id: ++seq, accountCode: "", description: "", debit: "", credit: "" });

const ACCOUNT_OPTIONS = CHART_OF_ACCOUNTS.map((a) => ({ value: a.code, label: `${a.code} ${a.name}`, description: ACCOUNT_TYPE_TH[a.type] }));

export default function NewJournalEntryPage() {
  const router = useRouter();
  const { showConfirm } = useSystemDialog();
  const { companyId, role } = useAuth();
  const canSave = can(role, "finance:edit");

  const [date, setDate] = useState(today);
  const [bookType, setBookType] = useState("JV");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [lines, setLines] = useState<Line[]>(() => [blankLine(), blankLine()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const totals = useMemo(() => {
    const dr = Math.round(lines.reduce((s, l) => s + num(l.debit), 0) * 100) / 100;
    const cr = Math.round(lines.reduce((s, l) => s + num(l.credit), 0) * 100) / 100;
    return { dr, cr, diff: Math.round((dr - cr) * 100) / 100 };
  }, [lines]);
  const used = lines.filter((l) => l.accountCode || num(l.debit) || num(l.credit));
  const problems = [
    !description.trim() && "ระบุคำอธิบายรายการ",
    used.length < 2 && "มีรายการบัญชีอย่างน้อย 2 บรรทัด",
    used.some((l) => !l.accountCode) && "เลือกบัญชีให้ครบทุกบรรทัด",
    used.some((l) => (num(l.debit) > 0) === (num(l.credit) > 0)) && "แต่ละบรรทัดระบุเดบิตหรือเครดิตอย่างใดอย่างหนึ่ง",
    totals.dr <= 0 && "ยอดรวมต้องมากกว่า 0",
    totals.diff !== 0 && "ยอดเดบิตต้องเท่ากับเครดิต",
  ].filter(Boolean) as string[];
  const ready = problems.length === 0 && canSave;
  const isDirty = used.length > 0 || !!description.trim();

  const update = (id: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => {
    if (l.id !== id) return l;
    const next = { ...l, ...patch };
    if (patch.debit && num(patch.debit) > 0) next.credit = "";
    if (patch.credit && num(patch.credit) > 0) next.debit = "";
    return next;
  }));
  const remove = (id: number) => setLines((ls) => (ls.length > 2 ? ls.filter((l) => l.id !== id) : ls.map((l) => (l.id === id ? { ...blankLine(), id } : l))));
  /** เติมยอดที่ขาดลงบรรทัดนี้ให้สมดุล */
  const balanceInto = (id: number) => {
    const l = lines.find((x) => x.id === id);
    if (!l || totals.diff === 0) return;
    const own = num(l.debit) - num(l.credit);
    const need = Math.round((own - totals.diff) * 100) / 100;
    update(id, need >= 0 ? { debit: need ? String(need) : "", credit: "" } : { debit: "", credit: String(-need) });
  };

  const back = async () => {
    if (!isDirty || (await showConfirm("มีข้อมูลที่ยังไม่บันทึก ต้องการออกจากหน้านี้ใช่หรือไม่?"))) router.back();
  };

  const save = async () => {
    if (!ready) return;
    setError("");
    setSaving(true);
    try {
      const res = await apiFetch("/api/finance/journal-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId, date, bookType, description, reference,
          lines: used.map((l) => ({ accountCode: l.accountCode, description: l.description, debit: num(l.debit), credit: num(l.credit) })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      router.push(`/finance/journal/${encodeURIComponent(data.path)}`);
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  };

  const header = (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-5 rounded-3xl backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <PillButton variant="glass" onClick={back} className="w-10 h-10 p-0 flex items-center justify-center"><ArrowLeft size={20} /></PillButton>
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">บันทึกบัญชีด้วยมือ</h1>
          <p className="text-sm text-white/60 mt-1">ลงรายการเดบิต / เครดิตตามผังบัญชี บันทึกเป็นรายการรออนุมัติก่อนลงบัญชี</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <PillButton variant="glass" onClick={back} className="h-9 px-4 text-xs font-bold text-white/60">ยกเลิก</PillButton>
        <PillButton variant="confirm" onClick={save} disabled={!ready || saving} className="h-9 px-5 text-xs font-bold">
          {saving ? <><Loader2 size={14} className="animate-spin mr-1.5" /> กำลังบันทึก...</> : <><ShieldCheck size={14} className="mr-1.5" /> บันทึกรายการ</>}
        </PillButton>
      </div>
    </div>
  );

  const label = (t: string, req?: boolean) => (
    <label className="text-[12px] font-bold text-white/70 ml-1">{t}{req && <span className="text-danger ml-1">*</span>}</label>
  );

  const left = (
    <div className="space-y-4 pb-10">
      {!canSave && <div className="p-3 rounded-xl text-xs font-bold border bg-warning/10 border-warning/20 text-warning">บัญชีผู้ใช้ของคุณไม่มีสิทธิ์บันทึกบัญชี</div>}
      {error && <div className="p-3 rounded-xl text-xs font-bold border bg-danger/10 border-danger/20 text-danger">{error}</div>}

      <GlassCard className="p-5 space-y-3">
        <h3 className="text-sm font-bold text-white">ข้อมูลรายการ</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            {label("วันที่", true)}
            <PillInput type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full h-9 text-sm font-mono" />
          </div>
          <div className="space-y-1">
            {label("สมุดรายวัน")}
            <PillSelect value={bookType} onChange={(e) => setBookType(e.target.value)} className="w-full h-9 text-sm">
              {BOOK_TYPES.map((b) => <option key={b.code} value={b.code}>{b.code} · {b.name}</option>)}
            </PillSelect>
          </div>
          <div className="space-y-1">
            {label("เอกสารอ้างอิง")}
            <PillInput value={reference} onChange={(e) => setReference(e.target.value)} placeholder="เช่น เลขที่สัญญา, ใบแจ้งหนี้" className="w-full h-9 text-sm" />
          </div>
        </div>
        <div className="space-y-1">
          {label("คำอธิบายรายการ", true)}
          <PillInput value={description} onChange={(e) => setDescription(e.target.value)} placeholder="เช่น บันทึกค่าเสื่อมราคาประจำเดือน, ปรับปรุงค่าใช้จ่ายค้างจ่าย" className="w-full h-9 text-sm" />
        </div>
      </GlassCard>

      <GlassCard className="p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-white">รายการบัญชี</h3>
          <PillButton variant="glass" onClick={() => setLines((ls) => [...ls, blankLine()])} className="h-8 px-4 text-xs font-bold">
            <Plus size={14} className="mr-1" /> เพิ่มบรรทัด
          </PillButton>
        </div>
        <div className="nexus-table-wrap">
          <table className="w-full table-fixed text-[13px]">
            <colgroup>
              <col className="w-8" />
              <col />
              <col className="w-[24%]" />
              <col className="w-[104px]" />
              <col className="w-[104px]" />
              <col className="w-9" />
            </colgroup>
            <thead>
              <tr className="text-[11px] font-bold text-white/50 border-b border-white/10">
                <th className="py-2 text-center font-bold">#</th>
                <th className="py-2 px-1.5 text-left font-bold">บัญชี</th>
                <th className="py-2 px-1.5 text-left font-bold">คำอธิบายบรรทัด</th>
                <th className="py-2 px-1.5 text-right font-bold">เดบิต</th>
                <th className="py-2 px-1.5 text-right font-bold">เครดิต</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={l.id} className="border-b border-white/5 last:border-0">
                  <td className="py-1.5 text-center text-white/40 font-mono">{i + 1}</td>
                  <td className="py-1.5 px-1.5">
                    <SmartSelect options={ACCOUNT_OPTIONS} value={l.accountCode} onChange={(v) => update(l.id, { accountCode: v })} allowCustom={false} placeholder="รหัส / ชื่อบัญชี" className="min-w-0" />
                  </td>
                  <td className="py-1.5 px-1.5">
                    <PillInput value={l.description} onChange={(e) => update(l.id, { description: e.target.value })} placeholder="(ถ้ามี)" className="w-full h-9 text-sm" />
                  </td>
                  <td className="py-1.5 px-1.5">
                    <PillInput inputMode="decimal" value={l.debit} onChange={(e) => update(l.id, { debit: cleanAmount(e.target.value) })} onDoubleClick={() => balanceInto(l.id)} placeholder="0.00" title="ดับเบิลคลิกเพื่อเติมยอดให้สมดุล" className="w-full h-9 text-sm text-right font-mono px-3" />
                  </td>
                  <td className="py-1.5 px-1.5">
                    <PillInput inputMode="decimal" value={l.credit} onChange={(e) => update(l.id, { credit: cleanAmount(e.target.value) })} onDoubleClick={() => balanceInto(l.id)} placeholder="0.00" title="ดับเบิลคลิกเพื่อเติมยอดให้สมดุล" className="w-full h-9 text-sm text-right font-mono px-3" />
                  </td>
                  <td className="py-1.5 text-center">
                    <button type="button" onClick={() => remove(l.id)} className="p-1.5 text-white/30 hover:text-danger transition-colors" title="ลบบรรทัด"><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-white/10 font-mono text-white">
                <td colSpan={3} className="py-2 px-1.5 text-right text-[12px] font-bold text-white/60 font-sans">รวม</td>
                <td className="py-2 px-1.5 text-right font-bold whitespace-nowrap">{baht(totals.dr)}</td>
                <td className="py-2 px-1.5 text-right font-bold whitespace-nowrap">{baht(totals.cr)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="text-[11px] text-white/40">ดับเบิลคลิกช่องเดบิตหรือเครดิตเพื่อเติมยอดที่ขาดให้สมดุลอัตโนมัติ</p>
      </GlassCard>
    </div>
  );

  const balanced = totals.diff === 0 && totals.dr > 0;
  const right = (
    <div className="p-4 space-y-4">
      <GlassCard className="p-4 space-y-2">
        <h4 className="text-sm font-bold text-white mb-1">ตรวจสอบความสมดุล</h4>
        {[["รวมเดบิต", totals.dr], ["รวมเครดิต", totals.cr]].map(([k, v]) => (
          <div key={k as string} className="flex justify-between text-[13px]"><span className="text-white/60">{k}</span><span className="font-mono text-white">{baht(v as number)}</span></div>
        ))}
        <div className="flex justify-between text-[13px] pt-2 border-t border-white/5">
          <span className="text-white/60">ผลต่าง</span>
          <span className={cn("font-mono font-bold", totals.diff === 0 ? "text-white" : "text-danger")}>{baht(Math.abs(totals.diff))}</span>
        </div>
        <div className={cn("flex items-center gap-2 p-2.5 rounded-xl text-[12px] font-bold border", balanced ? "bg-nexus-teal/10 border-nexus-teal/20 text-nexus-teal" : "bg-white/[0.03] border-white/10 text-white/60")}>
          {balanced ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          {balanced ? "สมดุล" : totals.diff > 0 ? `เครดิตขาด ${baht(totals.diff)}` : totals.diff < 0 ? `เดบิตขาด ${baht(-totals.diff)}` : "ยังไม่มียอด"}
        </div>
      </GlassCard>
      {problems.length > 0 && (
        <GlassCard className="p-4">
          <h4 className="text-[12px] font-bold text-white/70 mb-1.5">ก่อนบันทึก</h4>
          <ul className="space-y-1 text-[12px] text-white/50 list-disc pl-4">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
        </GlassCard>
      )}
      <p className="text-[11px] text-white/40 px-1">ได้รับเลขที่ใบสำคัญเมื่อบันทึก และต้องได้รับอนุมัติจากผู้ดูแลหรือนักบัญชีก่อนจึงจะลงบัญชี งวดที่ปิดแล้วบันทึกไม่ได้</p>
    </div>
  );

  return <NexusPageLayout header={header} leftContent={left} rightSidebar={right} />;
}
