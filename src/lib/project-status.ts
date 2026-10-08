/**
 * สถานะโครงการและขั้นอนุมัติ — ใช้ร่วมกันทั้งหน้าจอและ server
 *
 * Draft -> Pending Approval (3 ชั้น) -> Approved -> In Progress -> Completed
 *                \-> Rejected (แก้ไขแล้วส่งใหม่ได้)        ทุกขั้นก่อน In Progress -> Cancelled
 */

export type ProjectStatus = "Draft" | "Pending Approval" | "Rejected" | "Approved" | "In Progress" | "Completed" | "Cancelled";

const ALIASES: Record<string, ProjectStatus> = {
  draft: "Draft",
  planning: "Draft",
  "pending approval": "Pending Approval",
  pending: "Pending Approval",
  rejected: "Rejected",
  approved: "Approved",
  active: "In Progress",
  "in progress": "In Progress",
  in_progress: "In Progress",
  completed: "Completed",
  complete: "Completed",
  closed: "Completed",
  cancelled: "Cancelled",
  canceled: "Cancelled",
};

export function normalizeProjectStatus(status: unknown): ProjectStatus {
  return ALIASES[String(status || "").trim().toLowerCase()] || "Draft";
}

export const PROJECT_STATUS_TH: Record<ProjectStatus, string> = {
  Draft: "ฉบับร่าง",
  "Pending Approval": "รออนุมัติ",
  Rejected: "ไม่อนุมัติ",
  Approved: "อนุมัติแล้ว",
  "In Progress": "กำลังดำเนินการ",
  Completed: "ปิดโครงการ",
  Cancelled: "ยกเลิก",
};

export const PROJECT_STATUS_BADGE: Record<ProjectStatus, "active" | "inactive" | "pending" | "warning" | "danger"> = {
  Draft: "inactive",
  "Pending Approval": "pending",
  Rejected: "danger",
  Approved: "active",
  "In Progress": "active",
  Completed: "inactive",
  Cancelled: "danger",
};

/** แก้ไขรายละเอียดได้เฉพาะก่อนส่งอนุมัติ หรือหลังถูกตีกลับ */
export const EDITABLE_STATUSES: ProjectStatus[] = ["Draft", "Rejected"];
export const OPEN_STATUSES: ProjectStatus[] = ["Draft", "Pending Approval", "Rejected", "Approved", "In Progress"];

export interface ApprovalStepDef {
  stepOrder: number;
  title: string;
  description: string;
  roles: string[]; // บทบาทที่อนุมัติขั้นนี้ได้ (SUPERADMIN อนุมัติได้ทุกขั้น)
}

export const APPROVAL_STEPS: ApprovalStepDef[] = [
  { stepOrder: 1, title: "หัวหน้าฝ่าย", description: "ตรวจขอบเขตและเป้าหมายโครงการ", roles: ["ADMIN", "ENGINEER"] },
  { stepOrder: 2, title: "ฝ่ายการเงิน", description: "อนุมัติกรอบวงเงินและกำไรขั้นต้น", roles: ["ADMIN", "ACCOUNTANT"] },
  { stepOrder: 3, title: "ผู้บริหาร", description: "อนุมัติเปิดโครงการ", roles: ["ADMIN"] },
];

export function canApproveStep(role: string | null | undefined, stepOrder: number): boolean {
  const r = String(role || "").toUpperCase();
  if (r === "SUPERADMIN") return true;
  return !!APPROVAL_STEPS.find((s) => s.stepOrder === stepOrder)?.roles.includes(r);
}

export function initialApprovals() {
  return APPROVAL_STEPS.map((s) => ({ stepOrder: s.stepOrder, title: s.title, status: "Pending" as const }));
}

export type ProjectAction = "approve" | "reject" | "start" | "progress" | "complete" | "cancel";
