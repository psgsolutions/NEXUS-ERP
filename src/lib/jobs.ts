/**
 * งานมอบหมาย (Job) — ใช้ร่วมกันทั้งศูนย์จ่ายงาน หน้างานของฉัน และแอปภายนอก (เรียกผ่าน /api/jobs)
 *
 * โครงสร้าง companies/{companyId}/jobs/{jobNo}
 *  - ประเภทงาน: บริการ/ซ่อม, ติดตั้ง, MA, จัดของ, ขนย้าย, ส่งของ, อื่น ๆ
 *  - สถานะ: OPEN (รอจ่ายงาน) → ASSIGNED (จ่ายแล้วรอรับ) → ACCEPTED (รับงาน+รับอุปกรณ์) → IN_PROGRESS → DONE
 *           ASSIGNED → REJECTED (ช่างปฏิเสธ รอจ่ายใหม่) · ยกเลิกได้ก่อนเสร็จ (CANCELLED)
 *  - อุปกรณ์: MATERIAL (วัสดุ/อะไหล่ ตัดสต็อกตอนรับงาน) · TOOL (เครื่องมือ ยืมแล้วคืนตอนปิดงาน)
 */
import { canAny } from "./permissions";

export type JobType = "SERVICE" | "INSTALL" | "MA" | "PICK_PACK" | "MOVE" | "DELIVERY" | "OTHER";
export type JobStatus = "OPEN" | "ASSIGNED" | "ACCEPTED" | "IN_PROGRESS" | "DONE" | "REJECTED" | "CANCELLED";
export type JobPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export const JOB_TYPES: { value: JobType; label: string; hint: string; checklist: string[]; onSite: boolean }[] = [
  { value: "SERVICE", label: "ซ่อม/บริการ", hint: "ตรวจเช็ก ซ่อมแซม แก้ปัญหาหน้างาน", onSite: true, checklist: ["ตรวจสอบอาการเสีย", "แก้ไข/เปลี่ยนอะไหล่", "ทดสอบการทำงาน", "ถ่ายรูปหลังทำงาน", "ลูกค้าเซ็นรับงาน"] },
  { value: "INSTALL", label: "ติดตั้ง", hint: "ติดตั้งระบบหรืออุปกรณ์ใหม่", onSite: true, checklist: ["ตรวจรับอุปกรณ์ครบ", "ติดตั้งตามแบบ", "ทดสอบระบบ", "อธิบายการใช้งานให้ลูกค้า", "ลูกค้าเซ็นรับงาน"] },
  { value: "MA", label: "บำรุงรักษา (MA)", hint: "ตรวจตามรอบสัญญา MA", onSite: true, checklist: ["ทำความสะอาด", "ตรวจเช็กตามรายการ MA", "บันทึกค่าที่วัดได้", "แจ้งจุดที่ควรซ่อม", "ลูกค้าเซ็นรับงาน"] },
  { value: "PICK_PACK", label: "จัดของ", hint: "หยิบสินค้าตามรายการและแพ็กเตรียมส่ง", onSite: false, checklist: ["หยิบสินค้าครบตามรายการ", "ตรวจจำนวน/สภาพ", "แพ็กและติดป้าย", "วางที่จุดรอส่ง"] },
  { value: "MOVE", label: "ขนย้าย", hint: "ย้ายสินค้าภายในคลังหรือระหว่างคลัง", onSite: false, checklist: ["ตรวจรายการที่ต้องย้าย", "ขนย้ายอย่างปลอดภัย", "จัดเก็บ ณ ตำแหน่งใหม่", "อัปเดตตำแหน่งในระบบ"] },
  { value: "DELIVERY", label: "ส่งของ", hint: "นำส่งสินค้าให้ลูกค้า", onSite: true, checklist: ["ตรวจสินค้าก่อนออกเดินทาง", "ส่งมอบตามที่อยู่", "ลูกค้าเซ็นรับสินค้า", "ถ่ายรูปหลักฐานการส่ง"] },
  { value: "OTHER", label: "งานอื่น ๆ", hint: "งานทั่วไปหลังร้าน", onSite: false, checklist: [] },
];
export const jobTypeLabel = (t: string) => JOB_TYPES.find((x) => x.value === t)?.label || t;

export const JOB_STATUS: Record<JobStatus, { label: string; badge: "active" | "inactive" | "pending" | "warning" | "danger" }> = {
  OPEN: { label: "รอจ่ายงาน", badge: "pending" },
  ASSIGNED: { label: "รอช่างรับงาน", badge: "warning" },
  ACCEPTED: { label: "รับงานแล้ว", badge: "active" },
  IN_PROGRESS: { label: "กำลังทำ", badge: "active" },
  DONE: { label: "เสร็จแล้ว", badge: "inactive" },
  REJECTED: { label: "ช่างปฏิเสธ", badge: "danger" },
  CANCELLED: { label: "ยกเลิก", badge: "inactive" },
};
export const JOB_PRIORITY: Record<JobPriority, string> = { LOW: "ไม่เร่ง", NORMAL: "ปกติ", HIGH: "ด่วน", URGENT: "ด่วนมาก" };
export const OPEN_JOB_STATUSES: JobStatus[] = ["OPEN", "ASSIGNED", "ACCEPTED", "IN_PROGRESS", "REJECTED"];

export interface JobItem {
  kind: "MATERIAL" | "TOOL";
  productId?: string;
  sku?: string;
  name: string;
  qty: number;
  unit?: string;
  /** วัสดุ: จำนวนที่ตัดสต็อกแล้ว · เครื่องมือ: จำนวนที่ยืมออกไป */
  issuedQty?: number;
  /** เครื่องมือ: จำนวนที่คืนแล้ว */
  returnedQty?: number;
}

export interface Job {
  jobNo: string;
  companyId: string;
  type: JobType;
  title: string;
  description?: string;
  priority: JobPriority;
  status: JobStatus;
  site?: { name?: string; address?: string; contact?: string; phone?: string; mapUrl?: string };
  customerId?: string;
  customerName?: string;
  scheduledDate?: string; // YYYY-MM-DD
  scheduledTime?: string; // HH:mm
  dueDate?: string;
  estimatedHours?: number;
  assignees: string[];
  assigneeNames: string[];
  equipment: JobItem[];
  checklist: { text: string; done: boolean; doneBy?: string; doneAt?: string }[];
  links?: { soId?: string; woId?: string; ticketId?: string; projectId?: string; poId?: string };
  warehouseLocation?: string;
  resultNote?: string;
  rejectReason?: string;
  history: { at: string; by: string; byName?: string; action: string; note?: string }[];
}

/** สร้าง/จ่ายงานได้: ฝ่ายโครงการ คลัง ขาย จัดซื้อ และผู้บริหาร */
export const canDispatchJobs = (roles: string[] | string | null | undefined) =>
  canAny(roles as any, ["projects:edit", "inventory:edit", "sales:edit", "procurement:edit", "projects:approve"]);

/** เครื่องมือที่ยังไม่คืน */
export const toolsOut = (job: Pick<Job, "equipment">) =>
  (job.equipment || []).filter((e) => e.kind === "TOOL" && (Number(e.issuedQty) || 0) > (Number(e.returnedQty) || 0));
