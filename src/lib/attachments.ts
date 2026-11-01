/**
 * ไฟล์แนบ (ใช้ทั้ง client และ server) — รูปถ่ายใบเสร็จ/บิล ย่อในเบราว์เซอร์ก่อนอัปโหลด (ด้านยาว 1600px JPEG)
 * ขนาดสูงสุดต่อไฟล์หลังย่อ ~550 KB (เก็บเป็น data URL ในฐานข้อมูล ไม่เกินขนาดเอกสาร)
 */
export const ATTACHMENT_MAX = 760_000; // ความยาว data URL (base64)
export const ATTACHMENT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
/** รายการที่แนบไฟล์ได้: ค่าใช้จ่าย/ใบเบิก · รูปในกล่องรอยืนยัน · เงินทดรอง · ใบกำกับภาษีซื้อ · สินค้า (datasheet คู่มือ ใบรับรอง) */
export const ATTACHMENT_OWNERS = ["expense", "photo_inbox", "cash_advance", "purchase_tax", "product"] as const;
/** รูปสินค้าย่อ (เก็บในข้อมูลสินค้าโดยตรง ให้รายการสินค้าโหลดเร็ว) */
export const PRODUCT_THUMB_MAX = 60_000;
export type AttachmentOwner = (typeof ATTACHMENT_OWNERS)[number];
/** ไฟล์ของสินค้า: ทุกคนที่ดูสินค้าได้เปิดดูได้ (ไม่ใช่เอกสารการเงินส่วนตัว) */
export const SHARED_ATTACHMENT_OWNERS: readonly AttachmentOwner[] = ["product"];

export interface PendingFile { name: string; mime: string; data: string; size: number }

const readAsDataUrl = (f: Blob) => new Promise<string>((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = bad; r.readAsDataURL(f); });

/** เตรียมไฟล์สำหรับอัปโหลด: รูปย่อเป็น JPEG (ลดคุณภาพทีละขั้นจนพอดี) · PDF ใช้ตามเดิมถ้าไม่ใหญ่เกิน */
export async function prepareAttachment(file: File): Promise<PendingFile> {
  if (file.type === "application/pdf") {
    const data = await readAsDataUrl(file);
    if (data.length > ATTACHMENT_MAX) throw new Error(`${file.name}: PDF ใหญ่เกิน ${Math.round(ATTACHMENT_MAX / 1370)} KB`);
    return { name: file.name, mime: "application/pdf", data, size: file.size };
  }
  if (!file.type.startsWith("image/")) throw new Error(`${file.name}: รองรับเฉพาะรูปภาพและ PDF`);
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    for (const [max, q] of [[1600, 0.8], [1400, 0.72], [1200, 0.65], [1000, 0.6], [800, 0.55]] as const) {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      const g = c.getContext("2d")!;
      g.fillStyle = "#ffffff"; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0, c.width, c.height);
      const data = c.toDataURL("image/jpeg", q);
      if (data.length <= ATTACHMENT_MAX) return { name: file.name.replace(/\.[^.]+$/, "") + ".jpg", mime: "image/jpeg", data, size: Math.round(data.length * 0.74) };
    }
    throw new Error(`${file.name}: รูปใหญ่เกินไป`);
  } finally { URL.revokeObjectURL(url); }
}

/** รูปย่อสี่เหลี่ยมจัตุรัส (ตัดกลาง) เป็น JPEG data URL ไม่เกิน PRODUCT_THUMB_MAX — ใช้เป็นรูปสินค้า */
export async function makeThumbnail(file: File, size = 320): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("รองรับเฉพาะไฟล์รูปภาพ");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - side) / 2, sy = (img.naturalHeight - side) / 2;
    for (const [px, q] of [[size, 0.78], [size, 0.65], [256, 0.6], [200, 0.55]] as const) {
      const c = document.createElement("canvas");
      c.width = c.height = Math.min(px, side);
      const g = c.getContext("2d")!;
      g.fillStyle = "#ffffff"; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, sx, sy, side, side, 0, 0, c.width, c.height);
      const data = c.toDataURL("image/jpeg", q);
      if (data.length <= PRODUCT_THUMB_MAX) return data;
    }
    throw new Error("รูปใหญ่เกินไป");
  } finally { URL.revokeObjectURL(url); }
}
