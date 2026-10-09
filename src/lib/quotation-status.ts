/**
 * สถานะใบเสนอราคา (ใช้ร่วมกันทุกหน้า) — ข้อมูลจริงมีทั้งตัวพิมพ์ใหญ่/เล็กและหลายชื่อ:
 * DRAFT → PENDING_APPROVAL → SENT (อนุมัติแล้ว ส่งลูกค้า) → Approved (แปลงเป็นใบสั่งขาย)
 * REJECTED = ผู้อนุมัติตีกลับให้แก้, superseded = ถูกแทนด้วยฉบับแก้ไข (Revision)
 * "หมดอายุ" คำนวณจากวันยืนราคา (เฉพาะใบที่ยังไม่ได้งาน)
 */

export type QuotationStage = "draft" | "pending" | "sent" | "won" | "rejected" | "superseded" | "cancelled" | "expired";

export const QUOTATION_STAGE: Record<QuotationStage, { label: string; badge: "active" | "pending" | "warning" | "inactive" | "danger" }> = {
  draft: { label: "ร่าง", badge: "pending" },
  pending: { label: "รออนุมัติ", badge: "warning" },
  sent: { label: "ส่งลูกค้าแล้ว", badge: "active" },
  won: { label: "ได้งาน", badge: "active" },
  rejected: { label: "ตีกลับแก้ไข", badge: "danger" },
  superseded: { label: "ถูกแทนที่", badge: "inactive" },
  cancelled: { label: "ยกเลิก", badge: "inactive" },
  expired: { label: "หมดอายุ", badge: "inactive" },
};


const todayBkk = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

function dateStr(v: any): string {
  if (!v) return "";
  if (typeof v === "string") return v.slice(0, 10);
  const ms = v.seconds ? v.seconds * 1000 : typeof v.toMillis === "function" ? v.toMillis() : new Date(v).getTime();
  return ms ? new Date(ms + 7 * 3600e3).toISOString().slice(0, 10) : "";
}

/** วันยืนราคาของใบเสนอราคา (YYYY-MM-DD หรือ "") */
export function quotationValidUntil(q: any): string {
  return dateStr(q?.validUntil || q?.expiryDate || q?.valid_until);
}

export function quotationStage(q: any, today = todayBkk()): QuotationStage {
  const st = String(q?.status || "DRAFT").toUpperCase();
  let stage: QuotationStage;
  if (["APPROVED", "ACCEPTED", "WON", "CONVERTED"].includes(st) || q?.linkedSo) stage = "won";
  else if (["PENDING_APPROVAL", "PENDING"].includes(st)) stage = "pending";
  else if (st === "SENT") stage = "sent";
  else if (["REJECTED", "LOST"].includes(st)) stage = "rejected";
  else if (st === "SUPERSEDED") stage = "superseded";
  else if (["CANCELLED", "VOID"].includes(st)) stage = "cancelled";
  else stage = "draft";
  const valid = quotationValidUntil(q);
  if (["draft", "pending", "sent"].includes(stage) && valid && valid < today) return "expired";
  return stage;
}

/** ลบได้เฉพาะใบที่ยังไม่เคยส่งออกไปภายนอก (ร่าง / ตีกลับ) แม้จะเลยวันยืนราคาแล้ว */
export function quotationCanDelete(q: any): boolean {
  return ["draft", "rejected"].includes(quotationStage(q, "0000-00-00"));
}
