import * as admin from "firebase-admin";
import { adminDb } from "@/lib/firebase-admin";

/**
 * ใบส่งของ (DN) — ออกอัตโนมัติทุกครั้งที่ส่งมอบสินค้า/บริการตามใบสั่งขาย
 *  - เบิกสินค้าจากคลัง (/api/inventory/pick): ใบละครั้งที่เบิก เฉพาะรายการที่เบิก
 *  - ส่งมอบงานที่ไม่มีสินค้าต้องเบิก (/api/sales/orders/status deliver): ทุกรายการในใบสั่งขาย
 * เลขที่ออกในทรานแซกชันเดียวกับการตัดสต็อก/เปลี่ยนสถานะ (ไม่ข้าม ไม่ซ้ำ)
 */

export interface DeliveryLine {
  productId?: string | null;
  sku: string;
  name: string;
  unit: string;
  qty: number;
  location?: string;
}

const str = (v: any) => String(v ?? "").trim();

/** รายการในใบสั่งขายตามรหัสสินค้า (ชื่อ/หน่วย/รหัสสำหรับพิมพ์) */
export function soItemOf(so: any, productId: string) {
  return (Array.isArray(so.items) ? so.items : []).find((i: any) => i.productId === productId) || {};
}

/** ทุกรายการของใบสั่งขาย (ไม่รวมหัวข้อกลุ่ม) */
export function soAllLines(so: any): DeliveryLine[] {
  return (Array.isArray(so.items) ? so.items : [])
    .filter((i: any) => String(i.itemType || "").toUpperCase() !== "GROUP_HEADER" && (Number(i.qty ?? i.quantity) || 0) > 0)
    .map((i: any) => ({ productId: i.productId || null, sku: str(i.sku), name: str(i.name || i.productName || i.description), unit: str(i.unit || i.uom), qty: Number(i.qty ?? i.quantity) || 0 }));
}

export function writeDeliveryNote(tx: admin.firestore.Transaction, args: {
  companyId: string; dnNo: string; soId: string; so: any; lines: DeliveryLine[]; seller: any; uid: string; source: "pick" | "deliver";
}) {
  const { companyId, dnNo, soId, so } = args;
  const now = admin.firestore.FieldValue.serverTimestamp();
  tx.create(adminDb.doc(`companies/${companyId}/delivery_notes/${dnNo}`), {
    companyId, dnNo, documentNo: dnNo,
    soId, soNo: str(so.documentNo || so.soId || soId),
    customerId: so.customerId || "", customerName: str(so.customerName || so.customerSnapshot?.name),
    customerSnapshot: so.customerSnapshot || null,
    deliveryAddress: str(so.deliveryAddress || so.customerSnapshot?.address),
    customerPoNo: str(so.customerPoNo), projectName: str(so.projectName),
    deliveryDate: new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10),
    lines: args.lines.map((l) => JSON.parse(JSON.stringify(l))),
    source: args.source,
    sellerSnapshot: args.seller,
    status: "issued",
    createdBy: args.uid, createdAt: now, updatedAt: now, isDeleted: false,
  });
  return { deliveryNotes: admin.firestore.FieldValue.arrayUnion(dnNo), lastDeliveryNoteNo: dnNo };
}
