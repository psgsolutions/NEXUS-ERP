/** งวดงานของโครงการ (เก็บเป็นอาร์เรย์ milestones ในเอกสารโครงการ) */

export interface ProjectMilestone {
  id: string;
  seq?: number;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  weight: number; // % ของทั้งโครงการ
  amount: number; // งวดเงินที่เรียกเก็บได้เมื่อจบงวด
  progress: number; // 0-100
  note?: string;
  status?: MilestoneStatus;
}

export type MilestoneStatus = "completed" | "in-progress" | "overdue" | "pending";

export const MILESTONE_STATUS_TH: Record<MilestoneStatus, string> = {
  completed: "เสร็จแล้ว",
  "in-progress": "กำลังทำ",
  overdue: "เลยกำหนด",
  pending: "ยังไม่เริ่ม",
};

const todayBkk = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

export function milestoneStatus(m: Pick<ProjectMilestone, "progress" | "endDate">, today = todayBkk()): MilestoneStatus {
  const p = Number(m.progress) || 0;
  if (p >= 100) return "completed";
  if (m.endDate && m.endDate < today) return "overdue";
  return p > 0 ? "in-progress" : "pending";
}

/** ความคืบหน้าโครงการ = ค่าเฉลี่ยถ่วงน้ำหนัก (ไม่มีน้ำหนัก = ถัวเท่ากัน), ไม่มีงวดงาน = null */
export function weightedProgress(ms: Pick<ProjectMilestone, "weight" | "progress">[]): number | null {
  if (!ms.length) return null;
  const totalW = ms.reduce((s, m) => s + (Number(m.weight) || 0), 0);
  const value = totalW > 0
    ? ms.reduce((s, m) => s + (Number(m.weight) || 0) * (Number(m.progress) || 0), 0) / totalW
    : ms.reduce((s, m) => s + (Number(m.progress) || 0), 0) / ms.length;
  return Math.round(value);
}
