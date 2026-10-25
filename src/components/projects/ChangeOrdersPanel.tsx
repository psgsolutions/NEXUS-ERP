"use client";

/** การเปลี่ยนแปลงระหว่างดำเนินโครงการ: ยื่นคำขอ / อนุมัติ / ประวัติ (หน้ารายละเอียดโครงการ) */

import React, { useMemo, useState } from "react";
import { Check, GitPullRequest, Plus, Trash2, X } from "lucide-react";
import { GlassCard, NexusTable, NexusTableCell, NexusTableRow, PillButton, PillInput, PillSelect, StatusBadge, cn } from "@/components/ui/Base";
import { Field, FIELD_W, NumCell } from "@/components/projects/ProjectPlanEditors";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { apiFetch } from "@/lib/api-client";
import { CHANGEABLE_STATUSES, CHANGE_ORDER_STATUS_TH, CHANGE_ORDER_TYPES, type ChangeOrderStatus, type ChangeOrderType } from "@/lib/change-orders";

const STATUS_BADGE: Record<ChangeOrderStatus, "pending" | "active" | "danger"> = { PENDING: "pending", APPROVED: "active", REJECTED: "danger" };
const baht = (n: number) => `฿${(Number(n) || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const tsText = (t: any) => (t?.toDate ? t.toDate().toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" }) : "-");
const DAY = 86400e3;
const textareaCls = "w-full bg-black/20 border border-white/10 focus:border-nexus-teal/50 rounded-xl p-3 text-[13px] text-white focus:outline-none resize-y leading-relaxed";

export function ChangeOrdersPanel({ companyId, docId, project, status, canRequest, canApprove, canQuote = false, onMessage }: {
  companyId: string;
  docId: string;
  project: any;
  status: string;
  canRequest: boolean;
  canApprove: boolean;
  /** ฝ่ายขาย: ปรับใบเสนอราคาตามคำขอที่อนุมัติแล้ว */
  canQuote?: boolean;
  onMessage: (text: string, error?: boolean) => void;
}) {
  const { data: rows } = useRealtimeCollection<any>(companyId && docId ? `companies/${companyId}/projects/${docId}/change_orders` : "");
  const list = useMemo(() => [...rows].sort((a, b) => (b.seq || 0) - (a.seq || 0)), [rows]);
  const changeable = CHANGEABLE_STATUSES.includes(status);

  const items: any[] = (Array.isArray(project.items) ? project.items : []).filter((l: any) => l.kind !== "GROUP");
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ChangeOrderType>("EQUIPMENT");
  const [reason, setReason] = useState("");
  const [lineId, setLineId] = useState("");
  const [eq, setEq] = useState({ name: "", details: "", qty: 0, unitPrice: 0, unitCost: 0 });
  const [members, setMembers] = useState<any[]>([]);
  const [budgetAmount, setBudgetAmount] = useState(0);
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState<{ id: string; note: string } | null>(null);

  const currentBudget = Number(project.governmentDetails?.budgetAmount) || Number(project.budgetSummary?.grandTotalWithVat) || 0;
  const startForm = () => {
    setOpen(true); setReason(""); setDescription("");
    const first = items[0];
    pickLine(first?.lineId || "");
    setMembers((project.followers || []).map((f: any) => ({ ...f })));
    setBudgetAmount(currentBudget);
    setEndDate(project.endDate || "");
  };
  const pickLine = (id: string) => {
    setLineId(id);
    const l = items.find((x) => x.lineId === id);
    if (l) setEq({ name: l.name || "", details: l.details || "", qty: Number(l.qty) || 0, unitPrice: Number(l.unitPrice) || 0, unitCost: Number(l.unitCost) || 0 });
  };
  const selectedLine = items.find((x) => x.lineId === lineId);
  const extendDays = project.endDate && endDate ? Math.round((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${project.endDate}T00:00:00Z`)) / DAY) : 0;

  const post = async (body: any) => {
    const res = await apiFetch("/api/projects/change-orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, projectDocId: docId, ...body }) });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || "ไม่สำเร็จ");
    return data;
  };

  const submit = async () => {
    const payload =
      type === "EQUIPMENT" ? { lineId, ...eq }
      : type === "COMMITTEE" ? { members }
      : type === "BUDGET" ? { budgetAmount }
      : type === "SCHEDULE" ? { endDate }
      : { description };
    try {
      setBusy(true);
      const r = await post({ action: "create", type, reason, payload });
      onMessage(`ยื่นคำขอเปลี่ยนแปลง ${r.coNo} แล้ว รอผู้ดูแลระบบอนุมัติ`);
      setOpen(false);
    } catch (e: any) {
      onMessage(e.message, true);
    } finally {
      setBusy(false);
    }
  };

  const reviseQuotation = async (coId: string) => {
    try {
      setBusy(true);
      const r = await post({ action: "reviseQuotation", coId });
      onMessage(r.mode === "revision" ? `ออกใบเสนอราคาฉบับแก้ไข ${r.docNo} (ฉบับร่าง) ตาม ${r.coNo} แล้ว ตรวจและส่งลูกค้าได้ที่หน้าใบเสนอราคา` : `ปรับรายการในใบเสนอราคา ${r.docNo} ตาม ${r.coNo} แล้ว`);
    } catch (e: any) {
      onMessage(e.message, true);
    } finally {
      setBusy(false);
    }
  };

  const decide = async (coId: string, action: "approve" | "reject", note = "") => {
    try {
      setBusy(true);
      const r = await post({ action, coId, note });
      onMessage(action === "approve" ? `อนุมัติ ${r.coNo} และปรับข้อมูลโครงการแล้ว` : `ไม่อนุมัติ ${r.coNo}`);
      setRejecting(null);
    } catch (e: any) {
      onMessage(e.message, true);
    } finally {
      setBusy(false);
    }
  };

  const segBtn = (on: boolean) => cn("h-9 px-4 rounded-full text-[13px] font-bold border whitespace-nowrap",
    on ? "bg-nexus-teal/15 border-nexus-teal/40 text-nexus-teal" : "bg-white/[0.02] border-white/10 text-white/50 hover:text-white");

  return (
    <div className="space-y-4">
      <GlassCard className="p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-white flex items-center gap-2"><GitPullRequest size={16} className="text-nexus-teal" /> การเปลี่ยนแปลงระหว่างดำเนินโครงการ ({list.length})</h3>
          {canRequest && changeable && !open && (
            <PillButton variant="glass" onClick={startForm} className="h-8 px-3 text-xs font-bold text-nexus-teal border-nexus-teal/30"><Plus size={13} className="mr-1" /> ขอเปลี่ยนแปลง</PillButton>
          )}
        </div>
        {!changeable && <p className="text-[12px] text-white/45">ขอเปลี่ยนแปลงได้เมื่อโครงการอนุมัติแล้วหรือกำลังดำเนินการ (ฉบับร่าง/ถูกตีกลับ แก้ไขโครงการได้โดยตรง)</p>}

        {open && (
          <div className="p-4 rounded-2xl border border-nexus-teal/20 bg-nexus-teal/[0.03] space-y-3">
            <div className="flex flex-wrap gap-2">
              {CHANGE_ORDER_TYPES.map((t) => <button key={t.code} type="button" onClick={() => setType(t.code)} className={segBtn(type === t.code)} title={t.hint}>{t.label}</button>)}
            </div>

            {type === "EQUIPMENT" && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-3">
                  <Field label="รายการที่เปลี่ยน" w={280} grow>
                    <PillSelect value={lineId} onChange={(e) => pickLine(e.target.value)} className="w-full h-9 text-sm">
                      {items.map((l) => <option key={l.lineId} value={l.lineId}>{l.name}</option>)}
                    </PillSelect>
                  </Field>
                  <Field label="ชื่อ/รุ่นใหม่" w={260} grow>
                    <PillInput value={eq.name} onChange={(e) => setEq({ ...eq, name: e.target.value })} className="h-9 text-sm" />
                  </Field>
                </div>
                <div className="flex flex-wrap gap-3 items-end">
                  <Field label="จำนวน" w={FIELD_W.days}><NumCell value={eq.qty} onChange={(v) => setEq({ ...eq, qty: v })} /></Field>
                  <Field label="ราคาขาย/หน่วย (บาท)" w={FIELD_W.money}><NumCell kind="money" value={eq.unitPrice} onChange={(v) => setEq({ ...eq, unitPrice: v })} /></Field>
                  <Field label="ต้นทุน/หน่วย (บาท)" w={FIELD_W.money}><NumCell kind="money" value={eq.unitCost} onChange={(v) => setEq({ ...eq, unitCost: v })} /></Field>
                  {selectedLine && (
                    <p className="text-[12px] text-white/50 pb-2">
                      มูลค่ารายการ {baht(Number(selectedLine.qty) * Number(selectedLine.unitPrice))} → <b className="text-white">{baht(eq.qty * eq.unitPrice)}</b>
                    </p>
                  )}
                </div>
                <textarea value={eq.details} onChange={(e) => setEq({ ...eq, details: e.target.value })} rows={3} placeholder="รายละเอียด/สเปกของรุ่นใหม่" className={textareaCls} />
              </div>
            )}

            {type === "COMMITTEE" && (
              <div className="space-y-2">
                {members.map((m, i) => (
                  <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_148px_24px] gap-2 items-center">
                    <PillInput value={m.name} onChange={(e) => setMembers(members.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="ชื่อ-นามสกุล" className="h-9 text-sm" />
                    <PillInput value={m.role} onChange={(e) => setMembers(members.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)))} placeholder="ตำแหน่ง/บทบาท" className="h-9 text-sm" />
                    <PillInput value={m.phone || ""} onChange={(e) => setMembers(members.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)))} placeholder="เบอร์โทร" className="h-9 text-sm font-mono" />
                    <button type="button" onClick={() => setMembers(members.filter((_, j) => j !== i))} className="p-1 text-white/40 hover:text-danger" title="นำออก"><Trash2 size={15} /></button>
                  </div>
                ))}
                <PillButton variant="glass" onClick={() => setMembers([...members, { name: "", role: "กรรมการตรวจรับพัสดุ", phone: "" }])} className="h-8 px-3 text-xs font-bold text-nexus-teal border-nexus-teal/30">+ เพิ่มรายชื่อ</PillButton>
              </div>
            )}

            {type === "BUDGET" && (
              <div className="flex flex-wrap gap-3 items-end">
                <Field label="วงเงินใหม่ (บาท)" w={FIELD_W.money}><NumCell kind="money" value={budgetAmount} onChange={setBudgetAmount} /></Field>
                <p className="text-[12px] text-white/50 pb-2">วงเงินเดิม {baht(currentBudget)} · ส่วนต่าง <b className={budgetAmount >= currentBudget ? "text-nexus-teal" : "text-warning"}>{baht(budgetAmount - currentBudget)}</b></p>
              </div>
            )}

            {type === "SCHEDULE" && (
              <div className="flex flex-wrap gap-3 items-end">
                <Field label="วันส่งมอบใหม่" w={FIELD_W.date}>
                  <PillInput type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full h-9 text-sm font-mono px-4" />
                </Field>
                <p className="text-[12px] text-white/50 pb-2">วันส่งมอบเดิม {project.endDate || "-"} · {extendDays >= 0 ? `ขยาย ${extendDays} วัน` : `เร็วขึ้น ${-extendDays} วัน`}</p>
              </div>
            )}

            {type === "OTHER" && (
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="รายละเอียดการเปลี่ยนแปลง" className={textareaCls} />
            )}

            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="เหตุผลการเปลี่ยนแปลง (จำเป็น) เช่น รุ่นเดิมเลิกผลิต / หน่วยงานแต่งตั้งกรรมการใหม่ / ได้รับงบประมาณเพิ่มเติม" className={textareaCls} />
            <div className="flex justify-end gap-2">
              <PillButton variant="glass" onClick={() => setOpen(false)} className="h-9 px-4 text-xs font-bold text-white/60">ยกเลิก</PillButton>
              <PillButton variant="confirm" disabled={busy} onClick={submit} className="h-9 px-5 text-xs font-bold">{busy ? "กำลังบันทึก..." : "ยื่นคำขอเปลี่ยนแปลง"}</PillButton>
            </div>
          </div>
        )}
      </GlassCard>

      <GlassCard className="p-0 overflow-hidden">
        {list.length === 0 ? (
          <p className="p-6 text-center text-[13px] text-white/40">ยังไม่มีการเปลี่ยนแปลง</p>
        ) : (
          <>
          {rejecting && (
            <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-white/10 bg-danger/[0.04]">
              <span className="text-[13px] text-white/70">ไม่อนุมัติ {list.find((c) => c.id === rejecting.id)?.coNo}</span>
              <input autoFocus value={rejecting.note} onChange={(e) => setRejecting({ id: rejecting.id, note: e.target.value })} placeholder="เหตุผลที่ไม่อนุมัติ" className="h-8 flex-1 min-w-[200px] px-3 rounded-full bg-white/[0.03] border border-white/10 text-[13px] text-white focus:outline-none" />
              <button type="button" disabled={busy} onClick={() => decide(rejecting.id, "reject", rejecting.note)} className="h-8 px-3 rounded-full border border-danger/40 text-danger text-[12px] font-bold">ยืนยันไม่อนุมัติ</button>
              <button type="button" onClick={() => setRejecting(null)} className="p-1 text-white/40" title="ปิด"><X size={14} /></button>
            </div>
          )}
          <NexusTable headers={["เลขที่", "ประเภท", "รายละเอียด", "สถานะ", "ขอโดย", ""]}>
            {list.map((co) => (
              <NexusTableRow key={co.id}>
                <NexusTableCell mono>{co.coNo}</NexusTableCell>
                <NexusTableCell>{CHANGE_ORDER_TYPES.find((t) => t.code === co.type)?.short || co.type}</NexusTableCell>
                <NexusTableCell className="max-w-[420px]">
                  <span title={[co.summary, `เหตุผล: ${co.reason}`, co.decidedByName ? `พิจารณาโดย ${String(co.decidedByName).split("@")[0]} ${tsText(co.decidedAt)}` : "", co.decisionNote ? `หมายเหตุ: ${co.decisionNote}` : ""].filter(Boolean).join("\n")}>{co.summary}</span>
                </NexusTableCell>
                <NexusTableCell><StatusBadge status={STATUS_BADGE[co.status as ChangeOrderStatus] || "inactive"} label={CHANGE_ORDER_STATUS_TH[co.status as ChangeOrderStatus] || co.status} /></NexusTableCell>
                <NexusTableCell>{String(co.requestedByName || "-").split("@")[0]} · {tsText(co.requestedAt)}</NexusTableCell>
                <NexusTableCell>
                  {co.status === "PENDING" && canApprove ? (
                    <span className="inline-flex items-center gap-1.5" style={{ justifyContent: "flex-end", width: 72 }}>
                      <button type="button" disabled={busy} onClick={() => decide(co.id, "approve")} className="w-8 h-8 rounded-full border border-nexus-teal/40 text-nexus-teal flex items-center justify-center" title={`อนุมัติ ${co.coNo}`}><Check size={14} /></button>
                      <button type="button" disabled={busy} onClick={() => setRejecting({ id: co.id, note: "" })} className="w-8 h-8 rounded-full border border-white/10 text-white/60 hover:text-danger flex items-center justify-center" title={`ไม่อนุมัติ ${co.coNo}`}><X size={14} /></button>
                    </span>
                  ) : co.quotationUpdate ? (
                    <a href={`/sales/quotations/${encodeURIComponent(co.quotationUpdate.quotationId)}`} className="text-[12px] font-bold text-nexus-teal hover:underline whitespace-nowrap" title={co.quotationUpdate.mode === "revision" ? "ฉบับแก้ไขที่ออกตามคำขอนี้" : "ใบเสนอราคาที่ปรับรายการตามคำขอนี้"}>{co.quotationUpdate.docNo}</a>
                  ) : co.status === "APPROVED" && co.type === "EQUIPMENT" && canQuote && project.quotationDocId ? (
                    <button type="button" disabled={busy} onClick={() => reviseQuotation(co.id)} className="h-8 px-3 rounded-full border border-nexus-teal/30 text-nexus-teal text-[12px] font-bold hover:bg-nexus-teal/10 whitespace-nowrap" title="ออกใบเสนอราคาฉบับแก้ไขตามรายการโครงการล่าสุด">ปรับใบเสนอราคา</button>
                  ) : null}
                </NexusTableCell>
              </NexusTableRow>
            ))}
          </NexusTable>
          </>
        )}
      </GlassCard>
    </div>
  );
}
