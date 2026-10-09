/** หมายเลขเครื่อง (companies/{c}/serial_numbers/{SN}) — อัปเดตอัตโนมัติจากการรับ/เบิกสินค้า */

export const SERIAL_STATUS: Record<string, { label: string; badge: "active" | "pending" | "warning" | "inactive" | "danger" }> = {
  available: { label: "พร้อมใช้ในคลัง", badge: "active" },
  reserved: { label: "จองแล้ว", badge: "pending" },
  deployed: { label: "ติดตั้ง/ส่งมอบแล้ว", badge: "warning" },
  rma: { label: "ส่งซ่อม/เคลม", badge: "danger" },
  lost: { label: "สูญหาย", badge: "inactive" },
};

export const toMs = (v: any) => (!v ? 0 : v.seconds ? v.seconds * 1000 : typeof v.toMillis === "function" ? v.toMillis() : new Date(v).getTime() || 0);

export function warrantyState(s: any, now = Date.now()): { label: string; tone: string; daysLeft: number | null } {
  if (s?.warrantyStatus === "void") return { label: "สิ้นสิทธิ์", tone: "text-danger", daysLeft: null };
  const end = toMs(s?.warrantyEndDate);
  if (!end) return { label: "ไม่มีข้อมูลรับประกัน", tone: "text-white/50", daysLeft: null };
  const days = Math.ceil((end - now) / 86400e3);
  if (days < 0) return { label: "หมดประกันแล้ว", tone: "text-danger", daysLeft: days };
  if (days <= 30) return { label: `ใกล้หมดประกัน (${days} วัน)`, tone: "text-warning", daysLeft: days };
  return { label: `อยู่ในประกัน (${days} วัน)`, tone: "text-nexus-teal", daysLeft: days };
}
