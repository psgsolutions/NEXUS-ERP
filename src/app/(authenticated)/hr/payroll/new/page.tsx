"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { where } from "firebase/firestore";
import { ArrowLeft, Ban, CheckCircle2, Landmark, Loader2, Printer, Save } from "lucide-react";
import { DocumentPdfModal } from "@/components/documents/DocumentPdfViewer";
import { GlassCard, PillButton, PillInput, StatusBadge, cn } from "@/components/ui/Base";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { useAuth } from "@/context/AuthContext";
import { useSystemDialog } from "@/context/DialogContext";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { useRealtimeDocument } from "@/hooks/useRealtimeDocument";
import { apiFetch } from "@/lib/api-client";
import { can } from "@/lib/permissions";
import { employeeName, employeeStatus } from "@/lib/hr";
import { SSO_MAX_WAGE, computeLine, payrollTotals, periodEnd, periodLabel, type PayrollInput, type PayrollLine } from "@/lib/payroll";

const baht = (n: any) => (Number(n) || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nowBkk = () => new Date(Date.now() + 7 * 3600e3).toISOString();
const STATUS: Record<string, { label: string; badge: "active" | "pending" | "warning" | "inactive" }> = {
  new: { label: "ยังไม่บันทึก", badge: "inactive" },
  draft: { label: "ร่าง", badge: "pending" },
  approved: { label: "อนุมัติแล้ว รอจ่าย", badge: "warning" },
  paid: { label: "จ่ายแล้ว", badge: "active" },
  cancelled: { label: "ยกเลิก", badge: "inactive" },
};
const journalHref = (c: string, id: string) => `/finance/journal/${encodeURIComponent(`companies/${c}/journal_entries/${id}`)}`;

function PayrollEditor() {
  const router = useRouter();
  const preset = useSearchParams()?.get("period") || "";
  const { companyId, role, roles } = useAuth();
  const { showConfirm } = useSystemDialog();
  const canEdit = can(roles, "hr:edit");
  const canPost = can(roles, "finance:edit");

  // ค่าเริ่มต้น: เดือนปัจจุบัน
  const [period, setPeriod] = useState(() => (/^\d{4}-\d{2}$/.test(preset) ? preset : nowBkk().slice(0, 7)));
  const { data: doc, loading } = useRealtimeDocument<any>(companyId ? `companies/${companyId}/payrolls/${period}` : null);
  const { data: employees } = useRealtimeCollection<any>("employees");
  const monthFilter = useMemo(() => [where("month", "==", period), where("type", "==", "IN")], [period]);
  const { data: attendance } = useRealtimeCollection<any>("attendance", monthFilter);

  const status: string = doc?.status || "new";
  const editable = canEdit && (status === "new" || status === "draft" || status === "cancelled");

  const [inputs, setInputs] = useState<Record<string, PayrollInput>>({});
  const [loadedFor, setLoadedFor] = useState("");
  const [dirty, setDirty] = useState(false);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [payDate, setPayDate] = useState(() => nowBkk().slice(0, 10));
  const [bankAccount, setBankAccount] = useState("");
  const [reason, setReason] = useState("");
  const [slip, setSlip] = useState<{ id: string; name: string } | null>(null);

  const end = periodEnd(period);
  const daysWorked = useMemo(() => {
    const m = new Map<string, number>();
    attendance.forEach((a: any) => m.set(a.employeeDocId, (m.get(a.employeeDocId) || 0) + 1));
    return m;
  }, [attendance]);

  // พนักงานในงวด: ยังไม่ลาออก และเริ่มงานไม่เกินวันสิ้นงวด
  const roster = useMemo(() => employees
    .filter((e: any) => employeeStatus(e) !== "resigned" && (!e.joinDate || e.joinDate <= end))
    .sort((a: any, b: any) => String(a.employeeId || a.id).localeCompare(String(b.employeeId || b.id))), [employees, end]);

  // โหลดค่าที่บันทึกไว้ครั้งเดียวต่องวด
  useEffect(() => {
    if (loading || loadedFor === period) return;
    const saved: Record<string, PayrollInput> = {};
    (doc?.lines || []).forEach((l: any) => { saved[l.employeeDocId] = { employeeDocId: l.employeeDocId, workDays: l.workDays, allowance: l.allowance, overtime: l.overtime, otherIncome: l.otherIncome, otherDeduction: l.otherDeduction, whtOverride: l.whtOverride }; });
    setInputs(saved);
    setLoadedFor(period);
    setDirty(false);
    setSelected("");
  }, [doc, loading, loadedFor, period]);

  // งวดที่อนุมัติ/จ่ายแล้วแสดงตามที่บันทึก, ร่าง/ใหม่คำนวณจากข้อมูลพนักงานปัจจุบัน
  const lines: PayrollLine[] = useMemo(() => {
    if (!editable && doc?.lines) return doc.lines;
    return roster.map((e: any) => computeLine(e, inputs[e.id] || { employeeDocId: e.id, workDays: e.employmentType === "daily" ? daysWorked.get(e.id) || 0 : 0 }, employeeName));
  }, [editable, doc, roster, inputs, daysWorked]);
  const totals = payrollTotals(lines);
  const sel = lines.find((l) => l.employeeDocId === selected);
  const selInput = sel ? inputs[sel.employeeDocId] || { employeeDocId: sel.employeeDocId, workDays: sel.workDays } : null;
  const setField = (k: keyof PayrollInput, v: string) => {
    if (!sel) return;
    setDirty(true);
    const cur = inputs[sel.employeeDocId] || { employeeDocId: sel.employeeDocId, workDays: sel.workDays };
    setInputs({ ...inputs, [sel.employeeDocId]: { ...cur, [k]: k === "whtOverride" ? (v === "" ? null : Number(v)) : Number(v) || 0 } });
  };

  const call = async (action: string, extra: any = {}, okText = "") => {
    setBusy(action);
    setMessage(null);
    try {
      const res = await apiFetch("/api/hr/payroll", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, period, action, ...extra }) });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "ดำเนินการไม่สำเร็จ");
      if (action === "save") { setDirty(false); setLoadedFor(""); }
      setMessage({ text: okText });
    } catch (err: any) {
      setMessage({ text: err.message, error: true });
    } finally {
      setBusy("");
    }
  };
  const save = () => call("save", { lines: lines.map((l) => ({ employeeDocId: l.employeeDocId, workDays: l.workDays, allowance: l.allowance, overtime: l.overtime, otherIncome: l.otherIncome, otherDeduction: l.otherDeduction, whtOverride: l.whtOverride })) }, `บันทึกร่างเงินเดือนงวด ${periodLabel(period)} แล้ว`);
  const approve = async () => { if (await showConfirm(`อนุมัติเงินเดือนงวด ${periodLabel(period)} ยอดสุทธิ ฿${baht(totals.net)}? ระบบจะตั้งค่าใช้จ่ายและหนี้สินลงวันที่ ${end}`)) call("approve", {}, "อนุมัติแล้ว สร้างรายการบัญชีตั้งค่าใช้จ่ายเงินเดือน (รออนุมัติลงบัญชี)"); };
  const pay = async () => {
    if (!bankAccount.trim()) return setMessage({ text: "กรุณาระบุบัญชีธนาคารที่จ่าย", error: true });
    if (await showConfirm(`บันทึกจ่ายเงินเดือน ฿${baht(totals.net)} วันที่ ${payDate}?`)) call("pay", { payDate, bankAccount }, "บันทึกการจ่ายเงินเดือนแล้ว");
  };
  const cancel = async () => {
    if (!reason.trim()) return setMessage({ text: "กรุณาระบุเหตุผลการยกเลิก", error: true });
    if (await showConfirm(`ยกเลิกเงินเดือนงวด ${periodLabel(period)}?`)) call("cancel", { reason }, "ยกเลิกงวดเงินเดือนแล้ว");
  };

  const back = async () => { if (!dirty || (await showConfirm("มีข้อมูลที่ยังไม่บันทึก ต้องการออกจากหน้านี้ใช่หรือไม่?"))) router.back(); };
  const st = STATUS[status] || STATUS.draft;

  const header = (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-5 rounded-3xl backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <PillButton variant="glass" onClick={back} className="w-10 h-10 p-0 flex items-center justify-center"><ArrowLeft size={20} /></PillButton>
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold text-white tracking-tight">เงินเดือนงวด {periodLabel(period)}</h1>
            <StatusBadge status={st.badge} label={st.label} />
          </div>
          <p className="text-sm text-white/60 mt-1">คำนวณประกันสังคม (เพดานค่าจ้าง {SSO_MAX_WAGE.toLocaleString("th-TH")}) และภาษีหัก ณ ที่จ่าย ภ.ง.ด.1 อัตโนมัติ</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap justify-end">
        <PillInput type="month" value={period} onChange={(e) => { if (e.target.value) { setPeriod(e.target.value); setLoadedFor(""); } }} className="h-9 w-[150px] text-sm font-mono" />
        {editable && (
          <PillButton variant="glass" onClick={save} disabled={!!busy || !lines.length} className="h-9 px-4 text-xs font-bold">
            {busy === "save" ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Save size={14} className="mr-1.5" />} บันทึกร่าง
          </PillButton>
        )}
        {status === "draft" && canPost && (
          <PillButton variant="confirm" onClick={approve} disabled={!!busy || dirty} title={dirty ? "บันทึกร่างก่อนอนุมัติ" : undefined} className="h-9 px-4 text-xs font-bold">
            {busy === "approve" ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <CheckCircle2 size={14} className="mr-1.5" />} อนุมัติเงินเดือน
          </PillButton>
        )}
      </div>
    </div>
  );

  const left = (
    <div className="space-y-4 pb-10">
      {message && <div className={cn("p-3 rounded-xl text-xs font-bold border", message.error ? "bg-danger/10 border-danger/20 text-danger" : "bg-nexus-teal/10 border-nexus-teal/20 text-nexus-teal")}>{message.text}</div>}
      {dirty && <p className="text-[12px] text-warning px-1">มีการแก้ไขที่ยังไม่บันทึก</p>}
      {editable && lines.some((l) => !l.rate) && (
        <div className="p-3 rounded-xl text-xs border bg-warning/10 border-warning/20 text-warning">
          ยังไม่ได้กำหนดเงินเดือน {lines.filter((l) => !l.rate).length} คน:{" "}
          {lines.filter((l) => !l.rate).map((l, i) => (
            <React.Fragment key={l.employeeDocId}>{i > 0 && ", "}<Link href={`/hr/employees/new?edit=${encodeURIComponent(l.employeeDocId)}`} className="underline">{l.name}</Link></React.Fragment>
          ))}
        </div>
      )}

      <GlassCard className="p-4 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          ["พนักงาน", `${lines.length} คน`],
          ["รวมเงินได้", baht(totals.gross)],
          ["ประกันสังคม (ลูกจ้าง)", baht(totals.sso)],
          ["ประกันสังคม (นายจ้าง)", baht(totals.employerSso)],
          ["ภาษีหัก ณ ที่จ่าย", baht(totals.wht)],
          ["ยอดจ่ายสุทธิ", baht(totals.net)],
        ].map(([k, v]) => (
          <div key={k} className="min-w-0">
            <p className="text-[12px] text-white/50 truncate">{k}</p>
            <p className="text-[15px] font-bold font-mono text-white whitespace-nowrap">{v}</p>
          </div>
        ))}
      </GlassCard>

      <GlassCard className="p-3">
        <div className="nexus-table-wrap">
          <table className="w-full table-fixed text-[13px]">
            <colgroup><col /><col className="w-[11%]" /><col className="w-[11%]" /><col className="w-[12%]" /><col className="w-[10%]" /><col className="w-[10%]" /><col className="w-[9%]" /><col className="w-[12%]" /></colgroup>
            <thead>
              <tr className="text-[11px] font-bold text-white/50 border-b border-white/10">
                <th className="py-2 px-1.5 text-left">พนักงาน</th>
                <th className="py-2 px-1.5 text-right">ค่าจ้างพื้นฐาน</th>
                <th className="py-2 px-1.5 text-right">เงินได้เพิ่ม</th>
                <th className="py-2 px-1.5 text-right">รวมเงินได้</th>
                <th className="py-2 px-1.5 text-right">ประกันสังคม</th>
                <th className="py-2 px-1.5 text-right">ภาษี</th>
                <th className="py-2 px-1.5 text-right">หักอื่น</th>
                <th className="py-2 px-1.5 text-right">สุทธิ</th>
              </tr>
            </thead>
            <tbody>
              {!lines.length && <tr><td colSpan={8} className="py-8 text-center text-white/40">ไม่มีพนักงานในงวดนี้</td></tr>}
              {lines.map((l) => (
                <tr key={l.employeeDocId} onClick={() => setSelected(l.employeeDocId === selected ? "" : l.employeeDocId)} className={cn("border-b border-white/5 last:border-0 cursor-pointer hover:bg-white/[0.03]", selected === l.employeeDocId && "bg-nexus-teal/[0.06]")}>
                  <td className="py-2 px-1.5 min-w-0"><p className="text-white font-bold truncate">{l.name}</p><p className="text-[11px] text-white/40 font-mono truncate">{l.employeeId}{l.employmentType === "daily" ? ` · รายวัน ${l.workDays} วัน` : ""}</p></td>
                  <td className="py-2 px-1.5 text-right font-mono text-white/80 whitespace-nowrap">{baht(l.base)}</td>
                  <td className="py-2 px-1.5 text-right font-mono text-white/80 whitespace-nowrap">{baht(l.allowance + l.overtime + l.otherIncome)}</td>
                  <td className="py-2 px-1.5 text-right font-mono text-white whitespace-nowrap">{baht(l.gross)}</td>
                  <td className="py-2 px-1.5 text-right font-mono text-white/70 whitespace-nowrap">{baht(l.sso)}</td>
                  <td className={cn("py-2 px-1.5 text-right font-mono whitespace-nowrap", l.whtOverride !== null ? "text-warning" : "text-white/70")} title={l.whtOverride !== null ? "กำหนดเอง" : "คำนวณอัตโนมัติ"}>{baht(l.wht)}</td>
                  <td className="py-2 px-1.5 text-right font-mono text-white/70 whitespace-nowrap">{baht(l.otherDeduction)}</td>
                  <td className={cn("py-2 px-1.5 text-right font-mono font-bold whitespace-nowrap", l.net < 0 ? "text-danger" : "text-white")}>{baht(l.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {editable && <p className="text-[11px] text-white/40 px-1.5 pt-2">คลิกแถวเพื่อแก้เบี้ยเลี้ยง ค่าล่วงเวลา รายได้/รายการหักอื่น หรือกำหนดภาษีเอง · ค่าจ้างรายวันนับวันทำงานจากการลงเวลาเข้างาน</p>}
      </GlassCard>

      {sel && selInput && (
        <GlassCard className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-white">{sel.name} <span className="text-white/40 font-normal">· {sel.position || "-"} · {sel.employmentType === "daily" ? `ค่าจ้างวันละ ${baht(sel.rate)}` : `เงินเดือน ${baht(sel.rate)}`}</span></h3>
            <div className="flex items-center gap-3">
              {sel.bankAccount && <span className="text-[12px] text-white/50">{sel.bankName} {sel.bankAccount}</span>}
              {/* สลิปพิมพ์จากงวดที่บันทึกแล้ว (แก้แล้วยังไม่บันทึก = ยังพิมพ์ไม่ได้) */}
              {status !== "new" && !dirty && (doc?.lines || []).some((l: any) => l.employeeDocId === sel.employeeDocId) && (
                <PillButton variant="glass" className="h-8 px-4 text-xs font-bold" onClick={() => setSlip({ id: `${period}~${sel.employeeDocId}`, name: sel.name })}><Printer size={14} className="mr-1.5" /> พิมพ์สลิป</PillButton>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {([
              ...(sel.employmentType === "daily" ? [["workDays", "วันทำงาน", sel.workDays]] : []),
              ["allowance", "เบี้ยเลี้ยง / สวัสดิการ", sel.allowance],
              ["overtime", "ค่าล่วงเวลา", sel.overtime],
              ["otherIncome", "รายได้อื่น", sel.otherIncome],
              ["otherDeduction", "รายการหักอื่น", sel.otherDeduction],
              ["whtOverride", "ภาษี (เว้นว่าง = คำนวณ)", sel.whtOverride ?? ""],
            ] as [keyof PayrollInput, string, any][]).map(([k, label, v]) => (
              <div key={k} className="space-y-1 min-w-0">
                <label className="text-[12px] font-bold text-white/70 ml-1 truncate block">{label}</label>
                <PillInput inputMode="decimal" disabled={!editable} value={String(selInput[k] ?? v ?? "")} onChange={(e) => setField(k, e.target.value.replace(/[^\d.]/g, ""))} placeholder={k === "whtOverride" ? baht(sel.wht) : "0"} className="w-full h-9 text-sm text-right font-mono" />
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      <DocumentPdfModal open={!!slip} onClose={() => setSlip(null)} source={slip ? { type: "payslip", id: slip.id } : undefined} title={`สลิปเงินเดือน ${slip?.name || ""} งวด ${periodLabel(period)}`} />

      {status === "approved" && canPost && (
        <GlassCard className="p-4 space-y-3">
          <h3 className="text-sm font-bold text-white">จ่ายเงินเดือน</h3>
          <div className="grid grid-cols-1 sm:grid-cols-[150px_minmax(0,1fr)_auto] gap-3 items-end">
            <div className="space-y-1"><label className="text-[12px] font-bold text-white/70 ml-1">วันที่จ่าย</label><PillInput type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className="w-full h-9 text-sm font-mono" /></div>
            <div className="space-y-1 min-w-0"><label className="text-[12px] font-bold text-white/70 ml-1">บัญชีธนาคารที่จ่าย <span className="text-danger">*</span></label><PillInput value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} placeholder="เช่น กสิกรไทย 123-4-56789-0" className="w-full h-9 text-sm" /></div>
            <PillButton variant="confirm" onClick={pay} disabled={!!busy} className="h-9 px-5 text-xs font-bold">{busy === "pay" ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Landmark size={14} className="mr-1.5" />} บันทึกจ่าย ฿{baht(totals.net)}</PillButton>
          </div>
        </GlassCard>
      )}

      {(status === "draft" || status === "approved") && canPost && (
        <GlassCard className="p-4 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-3 items-end">
          <div className="space-y-1 min-w-0"><label className="text-[12px] font-bold text-white/70 ml-1">ยกเลิกงวดนี้ (เหตุผล)</label><PillInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="เช่น คำนวณผิด ต้องทำใหม่" className="w-full h-9 text-sm" /></div>
          <PillButton variant="danger" onClick={cancel} disabled={!!busy} className="h-9 px-4 text-xs font-bold"><Ban size={14} className="mr-1.5" /> ยกเลิกงวด</PillButton>
        </GlassCard>
      )}

      {companyId && (doc?.accrualJournalId || doc?.paymentJournalId) && (
        <p className="text-[12px] text-white/50 px-1 flex gap-4 flex-wrap">
          {doc.accrualJournalId && <Link href={journalHref(companyId, doc.accrualJournalId)} className="text-nexus-teal hover:underline">รายการบัญชีตั้งค่าใช้จ่าย</Link>}
          {doc.paymentJournalId && <Link href={journalHref(companyId, doc.paymentJournalId)} className="text-nexus-teal hover:underline">รายการบัญชีจ่ายเงินเดือน</Link>}
          {doc.status === "cancelled" && <span>ยกเลิก: {doc.cancelReason}</span>}
        </p>
      )}
    </div>
  );

  return <NexusPageLayout header={header} leftContent={left} />;
}

export default function PayrollPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-white/50 text-sm">กำลังโหลด...</div>}>
      <PayrollEditor />
    </Suspense>
  );
}
