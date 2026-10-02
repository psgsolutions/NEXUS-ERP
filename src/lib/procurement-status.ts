/** สถานะใบสั่งซื้อจากหลายแหล่ง → PENDING_APPROVAL / APPROVED / PARTIAL_RECEIVED / RECEIVED / CANCELLED */
export function normalizePoStatus(status: string) {
  const st = String(status || "").toUpperCase();
  if (["APPROVED"].includes(st)) return "APPROVED";
  if (["PARTIAL_RECEIVED", "PARTIAL"].includes(st)) return "PARTIAL_RECEIVED";
  if (["RECEIVED", "CLOSED"].includes(st)) return "RECEIVED";
  if (["CANCELLED"].includes(st)) return "CANCELLED";
  return "PENDING_APPROVAL"; // PENDING / DRAFT / PENDING_APPROVAL
}
