/**
 * รายการต้องติดตามประจำวัน (ฟังก์ชันล้วน) — ใช้โดย cron แจ้งเตือน
 *  - ใบแจ้งหนี้ใกล้ครบกำหนด (ภายใน 3 วัน) / เลยกำหนด (แจ้งที่ 1, 7, 30 วัน — ไม่แจ้งทุกวัน)
 *  - งวดงานโครงการที่ถึงกำหนดหรือเสร็จแล้ว แต่ยังไม่ออกใบแจ้งหนี้
 * วันที่เป็น "YYYY-MM-DD" ตามเวลาไทย
 */

export const DUE_SOON_DAYS = 3;
export const OVERDUE_BUCKETS = [1, 7, 30];

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400e3);
const dateOf = (v: any) => {
  if (!v) return "";
  if (typeof v === "string") return v.slice(0, 10);
  const secs = v.seconds ?? v._seconds;
  return secs !== undefined ? new Date(secs * 1000 + 7 * 3600e3).toISOString().slice(0, 10) : "";
};

export interface InvoiceReminder {
  kind: "due_soon" | "overdue";
  /** ใกล้ครบ: วันครบกำหนด / เลยกำหนด: ช่วงวันเลยกำหนด (1, 7, 30) — ใช้เป็น ID กันแจ้งซ้ำ */
  key: string;
  invoiceId: string;
  invoiceNo: string;
  customerName: string;
  dueDate: string;
  daysOverdue: number;
  balance: number;
}

export function invoiceReminders(invoices: { id: string; data: any }[], today: string): InvoiceReminder[] {
  const out: InvoiceReminder[] = [];
  for (const { id, data: d } of invoices) {
    if (d.isDeleted === true || d.isSample || String(d.status || "").toLowerCase() === "cancelled") continue;
    const balance = Number(d.balance ?? (Number(d.grandTotal) || 0) - (Number(d.paidAmount) || 0)) || 0;
    if (!(balance > 0.009) || String(d.paymentStatus || "").toLowerCase() === "paid") continue;
    const due = dateOf(d.dueDate);
    if (!due) continue;
    const diff = daysBetween(today, due); // >0 = ยังไม่ถึง, <0 = เลยกำหนด
    const base = { invoiceId: id, invoiceNo: String(d.invoiceNo || d.documentNo || id), customerName: String(d.customerName || d.customerSnapshot?.name || ""), dueDate: due, balance: Math.round(balance * 100) / 100 };
    if (diff >= 0 && diff <= DUE_SOON_DAYS) {
      out.push({ ...base, kind: "due_soon", key: `due-${due}`, daysOverdue: 0 });
    } else if (diff < 0) {
      const overdue = -diff;
      const bucket = [...OVERDUE_BUCKETS].reverse().find((b) => overdue >= b);
      if (bucket) out.push({ ...base, kind: "overdue", key: `od${bucket}-${due}`, daysOverdue: overdue });
    }
  }
  return out;
}

export interface MilestoneReminder {
  projectId: string;
  projectNo: string;
  projectName: string;
  milestoneId: string;
  milestoneName: string;
  endDate: string;
  amount: number;
  reason: "completed" | "due";
}

const BILLABLE = ["approved", "in progress", "in_progress", "active", "completed", "complete", "closed"];

/** งวดที่ควรเรียกเก็บแล้ว: เสร็จ 100% หรือเลยวันสิ้นสุดงวด และยังไม่มีใบแจ้งหนี้ (ที่ไม่ยกเลิก) */
export function milestoneReminders(projectId: string, project: any, billedMilestoneIds: Set<string>, today: string): MilestoneReminder[] {
  if (project.isDeleted === true || project.isSample || !BILLABLE.includes(String(project.status || "").trim().toLowerCase())) return [];
  const out: MilestoneReminder[] = [];
  for (const m of Array.isArray(project.milestones) ? project.milestones : []) {
    const id = String(m.id || "");
    if (!id || billedMilestoneIds.has(id) || !((Number(m.amount) || 0) > 0)) continue;
    const end = dateOf(m.endDate);
    const completed = (Number(m.progress) || 0) >= 100;
    if (!completed && !(end && end < today)) continue;
    out.push({
      projectId, projectNo: String(project.projectId || projectId), projectName: String(project.projectName || project.title || ""),
      milestoneId: id, milestoneName: String(m.name || ""), endDate: end, amount: Number(m.amount) || 0, reason: completed ? "completed" : "due",
    });
  }
  return out;
}
