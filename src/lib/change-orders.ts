/**
 * การเปลี่ยนแปลงระหว่างดำเนินโครงการ (Change Order) — ใช้ร่วมกันทั้งหน้าจอและ server
 *
 * เก็บที่ companies/{c}/projects/{id}/change_orders/{coId}
 * ขอเปลี่ยนแปลง -> รออนุมัติ -> อนุมัติ (ปรับข้อมูลโครงการทันที) / ไม่อนุมัติ
 * ทุกคำขอเก็บค่าเดิม (before) และค่าใหม่ (after) เป็นประวัติ
 */

import { computeProjectBudget, type ProjectLine } from "./project-budget";
import { normalizeExpenses } from "./project-templates";
import { milestoneStatus } from "./project-milestones";

export type ChangeOrderType = "EQUIPMENT" | "COMMITTEE" | "BUDGET" | "SCHEDULE" | "OTHER";
export type ChangeOrderStatus = "PENDING" | "APPROVED" | "REJECTED";

export const CHANGE_ORDER_TYPES: { code: ChangeOrderType; label: string; short: string; hint: string }[] = [
  { code: "EQUIPMENT", label: "เปลี่ยนรุ่น/รายการอุปกรณ์", short: "อุปกรณ์", hint: "เปลี่ยนชื่อรุ่น รายละเอียด จำนวน หรือราคาของรายการ" },
  { code: "COMMITTEE", label: "เปลี่ยนกรรมการ/ผู้ประสานงาน", short: "กรรมการ", hint: "ปรับรายชื่อกรรมการตรวจรับหรือผู้ประสานงานหน้างาน" },
  { code: "BUDGET", label: "เปลี่ยนวงเงินงบประมาณ", short: "วงเงิน", hint: "ปรับวงเงินงบประมาณ/วงเงินตามสัญญา" },
  { code: "SCHEDULE", label: "ขยาย/ปรับระยะเวลา", short: "ระยะเวลา", hint: "เปลี่ยนวันส่งมอบงาน" },
  { code: "OTHER", label: "อื่น ๆ", short: "อื่น ๆ", hint: "บันทึกการเปลี่ยนแปลงอื่น (ไม่ปรับข้อมูลอัตโนมัติ)" },
];

export const CHANGE_ORDER_STATUS_TH: Record<ChangeOrderStatus, string> = {
  PENDING: "รออนุมัติ",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ไม่อนุมัติ",
};

/** โครงการที่ขอเปลี่ยนแปลงได้ (ฉบับร่าง/ถูกตีกลับแก้ไขได้โดยตรง) */
export const CHANGEABLE_STATUSES = ["Approved", "In Progress"];

const str = (v: any, max = 300) => String(v ?? "").trim().slice(0, max);
const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const r2 = (n: number) => Math.round(n * 100) / 100;
const isDate = (v: any) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));

export interface ChangeOrderInput {
  type: ChangeOrderType;
  reason: string;
  payload: Record<string, any>;
}

/** ตรวจและทำความสะอาดคำขอ; คืนข้อความผิดพลาดหรือข้อมูลที่ใช้ได้ */
export function normalizeChangeOrder(raw: any, project: any): { error: string } | { value: ChangeOrderInput; before: any; summary: string } {
  const type = CHANGE_ORDER_TYPES.some((t) => t.code === raw?.type) ? (raw.type as ChangeOrderType) : null;
  if (!type) return { error: "กรุณาเลือกประเภทการเปลี่ยนแปลง" };
  const reason = str(raw?.reason, 1000);
  if (reason.length < 5) return { error: "กรุณาระบุเหตุผลการเปลี่ยนแปลง (อย่างน้อย 5 ตัวอักษร)" };
  const p = raw?.payload || {};

  switch (type) {
    case "EQUIPMENT": {
      const items: any[] = Array.isArray(project.items) ? project.items : [];
      const line = items.find((l) => l.lineId === str(p.lineId, 60));
      if (!line) return { error: "ไม่พบรายการที่ต้องการเปลี่ยน" };
      const after = {
        lineId: line.lineId,
        name: str(p.name, 300) || line.name,
        details: str(p.details ?? line.details, 2000),
        qty: Math.max(0, num(p.qty ?? line.qty)),
        unitPrice: Math.max(0, num(p.unitPrice ?? line.unitPrice)),
        unitCost: Math.max(0, num(p.unitCost ?? line.unitCost)),
      };
      const before = { lineId: line.lineId, name: line.name, details: line.details || "", qty: line.qty, unitPrice: line.unitPrice, unitCost: line.unitCost };
      if (JSON.stringify(before) === JSON.stringify(after)) return { error: "ข้อมูลใหม่เหมือนเดิม" };
      return { value: { type, reason, payload: after }, before, summary: `${before.name} → ${after.name} (${after.qty} × ${after.unitPrice.toLocaleString("th-TH")})` };
    }
    case "COMMITTEE": {
      const members = (Array.isArray(p.members) ? p.members : []).slice(0, 30)
        .map((m: any) => ({ name: str(m?.name, 120), role: str(m?.role, 120), phone: str(m?.phone, 40), note: str(m?.note, 300) }))
        .filter((m: any) => m.name);
      if (!members.length) return { error: "กรุณาระบุรายชื่ออย่างน้อย 1 คน" };
      return { value: { type, reason, payload: { members } }, before: { members: project.followers || [] }, summary: `${members.length} รายชื่อ: ${members.map((m: any) => m.name).join(", ")}` };
    }
    case "BUDGET": {
      const amount = r2(Math.max(0, num(p.budgetAmount)));
      if (!(amount > 0)) return { error: "กรุณาระบุวงเงินใหม่" };
      const old = num(project.governmentDetails?.budgetAmount) || num(project.budgetSummary?.grandTotalWithVat);
      if (Math.abs(old - amount) < 0.005) return { error: "วงเงินใหม่เท่ากับวงเงินเดิม" };
      return { value: { type, reason, payload: { budgetAmount: amount } }, before: { budgetAmount: old }, summary: `วงเงิน ${old.toLocaleString("th-TH")} → ${amount.toLocaleString("th-TH")} บาท` };
    }
    case "SCHEDULE": {
      const endDate = String(p.endDate || "");
      if (!isDate(endDate)) return { error: "กรุณาระบุวันส่งมอบใหม่" };
      if (project.startDate && endDate < project.startDate) return { error: "วันส่งมอบต้องไม่อยู่ก่อนวันเริ่มโครงการ" };
      if (endDate === project.endDate) return { error: "วันส่งมอบใหม่เหมือนเดิม" };
      return { value: { type, reason, payload: { endDate } }, before: { endDate: project.endDate || "" }, summary: `ส่งมอบ ${project.endDate || "-"} → ${endDate}` };
    }
    default: {
      const description = str(p.description, 2000);
      if (!description) return { error: "กรุณาระบุรายละเอียดการเปลี่ยนแปลง" };
      return { value: { type, reason, payload: { description } }, before: null, summary: description.slice(0, 120) };
    }
  }
}

const lineAmount = (l: any) => {
  const gross = num(l.qty) * num(l.unitPrice);
  const disc = l.discountType === "AMOUNT" ? num(l.discountValue) : gross * (num(l.discountValue) / 100);
  return r2(Math.max(0, gross - disc));
};

/** งบประมาณ + งวดเงินใหม่จากรายการ (ใช้ค่าใช้จ่ายดำเนินงานเดิมของโครงการ) */
function rebudget(project: any, items: ProjectLine[]) {
  const expenses = Array.isArray(project.expenses) && project.expenses.length ? normalizeExpenses(project.expenses) : undefined;
  const budget = computeProjectBudget(items, { startDate: project.startDate, endDate: project.endDate, expenses });
  const milestones = (Array.isArray(project.milestones) ? project.milestones : []).map((m: any) => ({
    ...m, amount: r2((budget.grandTotalWithVat * num(m.weight)) / 100),
  }));
  return {
    items,
    budget: budget.totalRev, allocatedCost: budget.totalCost, grossProfit: budget.grossProfit, gpPercent: budget.gpPercent,
    budgetSummary: budget,
    ...(milestones.length ? { milestones } : {}),
  };
}

/**
 * ข้อมูลโครงการที่ต้องปรับเมื่ออนุมัติคำขอ
 * ตรวจว่าค่าเดิม (before) ยังตรงกับปัจจุบัน — ถ้าโครงการถูกแก้ไปแล้วต้องขอใหม่
 */
export function changeOrderPatch(project: any, co: { type: ChangeOrderType; payload: any; before: any }): { error: string } | { patch: Record<string, any> } {
  switch (co.type) {
    case "EQUIPMENT": {
      const items: any[] = Array.isArray(project.items) ? project.items : [];
      const idx = items.findIndex((l) => l.lineId === co.payload.lineId);
      if (idx < 0) return { error: "ไม่พบรายการในโครงการแล้ว" };
      const cur = items[idx];
      if (cur.name !== co.before?.name || num(cur.qty) !== num(co.before?.qty) || num(cur.unitPrice) !== num(co.before?.unitPrice)) {
        return { error: "รายการนี้ถูกเปลี่ยนไปแล้วหลังยื่นคำขอ กรุณายื่นคำขอใหม่" };
      }
      const next = { ...cur, name: co.payload.name, details: co.payload.details, qty: co.payload.qty, unitPrice: co.payload.unitPrice, unitCost: co.payload.unitCost };
      next.amount = lineAmount(next);
      next.costAmount = r2(num(next.qty) * num(next.unitCost));
      const nextItems = items.map((l, i) => (i === idx ? next : l));
      return { patch: rebudget(project, nextItems) };
    }
    case "COMMITTEE":
      return { patch: { followers: co.payload.members } };
    case "BUDGET":
      return { patch: { "governmentDetails.budgetAmount": co.payload.budgetAmount } };
    case "SCHEDULE": {
      const endDate = co.payload.endDate;
      if ((project.endDate || "") !== (co.before?.endDate || "")) return { error: "วันส่งมอบถูกเปลี่ยนไปแล้วหลังยื่นคำขอ กรุณายื่นคำขอใหม่" };
      const ms: any[] = Array.isArray(project.milestones) ? project.milestones : [];
      // งวดสุดท้ายที่จบตรงวันส่งมอบเดิม (หรือเลยวันใหม่) ให้จบตามวันส่งมอบใหม่
      const milestones = ms.map((m, i) => {
        const last = i === ms.length - 1;
        const end = last && (m.endDate === project.endDate || m.endDate > endDate) ? (endDate < m.startDate ? m.startDate : endDate) : m.endDate;
        const nm = { ...m, endDate: end };
        return { ...nm, status: milestoneStatus(nm) };
      });
      return { patch: { endDate, ...(ms.length ? { milestones } : {}) } };
    }
    default:
      return { patch: {} };
  }
}
