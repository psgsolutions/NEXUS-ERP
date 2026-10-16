/**
 * ใบแจ้งซ่อม/งานบริการ (companies/{companyId}/service_tickets/{ticketNo}) — ใช้ร่วมกันหน้างานบริการ ศูนย์จ่ายงาน และแอปภายนอก
 * สถานะ: NEW (รับเรื่อง) → SCHEDULED (ส่งให้ช่างแล้ว) → IN_PROGRESS → RESOLVED (แก้ไขแล้ว) → CLOSED · ยกเลิกได้ (CANCELLED)
 * SLA: กำหนดเวลาแก้ไขตามความเร่งด่วน นับจากเวลารับแจ้ง
 */
export type TicketStatus = "NEW" | "SCHEDULED" | "IN_PROGRESS" | "RESOLVED" | "CLOSED" | "CANCELLED";
export type TicketPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export const TICKET_STATUS: Record<TicketStatus, { label: string; badge: "active" | "inactive" | "pending" | "warning" | "danger" }> = {
  NEW: { label: "รับเรื่องใหม่", badge: "pending" },
  SCHEDULED: { label: "ส่งให้ช่างแล้ว", badge: "warning" },
  IN_PROGRESS: { label: "กำลังแก้ไข", badge: "active" },
  RESOLVED: { label: "แก้ไขแล้ว", badge: "active" },
  CLOSED: { label: "ปิดเรื่อง", badge: "inactive" },
  CANCELLED: { label: "ยกเลิก", badge: "inactive" },
};
export const OPEN_TICKET_STATUSES: TicketStatus[] = ["NEW", "SCHEDULED", "IN_PROGRESS"];

export const TICKET_CATEGORIES = [
  { value: "REPAIR", label: "แจ้งซ่อม" },
  { value: "INSTALL", label: "ขอติดตั้ง" },
  { value: "WARRANTY", label: "เคลม/ประกัน" },
  { value: "MA", label: "บำรุงรักษา (MA)" },
  { value: "INQUIRY", label: "สอบถาม/ปรึกษา" },
] as const;
export const ticketCategoryLabel = (c: string) => TICKET_CATEGORIES.find((x) => x.value === c)?.label || c;

export const TICKET_CHANNELS = [
  { value: "PHONE", label: "โทรศัพท์" },
  { value: "LINE", label: "LINE" },
  { value: "WALK_IN", label: "หน้าร้าน" },
  { value: "EMAIL", label: "อีเมล" },
  { value: "PORTAL", label: "พอร์ทัลลูกค้า" },
] as const;
export const ticketChannelLabel = (c: string) => TICKET_CHANNELS.find((x) => x.value === c)?.label || c;

/** ชั่วโมงที่ต้องแก้ไขเสร็จ ตามความเร่งด่วน */
export const SLA_HOURS: Record<TicketPriority, number> = { URGENT: 4, HIGH: 24, NORMAL: 48, LOW: 72 };
export const TICKET_PRIORITY: Record<TicketPriority, string> = { LOW: "ไม่เร่ง (72 ชม.)", NORMAL: "ปกติ (48 ชม.)", HIGH: "ด่วน (24 ชม.)", URGENT: "ด่วนมาก (4 ชม.)" };

/** งานประเภทใดตามประเภทการแจ้ง */
export const jobTypeForCategory = (c: string) => (c === "INSTALL" ? "INSTALL" : c === "MA" ? "MA" : "SERVICE");

/** สถานะ SLA: เหลือเวลา (ชม.) ติดลบ = เกินกำหนด */
export function slaRemainingHours(dueIso: string | undefined, now = Date.now()): number | null {
  if (!dueIso) return null;
  const t = Date.parse(dueIso);
  return Number.isFinite(t) ? Math.round(((t - now) / 3600000) * 10) / 10 : null;
}
