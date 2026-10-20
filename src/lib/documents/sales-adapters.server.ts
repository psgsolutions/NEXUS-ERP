import { adminDb } from "@/lib/firebase-admin";
import { ApiAuthError } from "@/lib/api-auth";
import type { DocumentModel } from "./model";
import { documentProfileOf } from "./profile";
import { mergeSeller } from "./seller.server";
import { partyOf, taxTypeOf } from "./tax-adapters.server";
import { quotationLines, totalsRows } from "./build";
import { thaiDate, toDateStr } from "./format";
import { customerDocProfile } from "./customer-profile.server";
import { showDocDate } from "@/lib/customer-doc-profile";

/**
 * เอกสารฝั่งขาย/บริการ -> DocumentModel
 * ใบสั่งขาย, ใบส่งของ, ใบสั่งงานบริการ / ใบรายงานการให้บริการ (พร้อมรูปและลายเซ็นลูกค้า)
 */

const num = (v: any) => Number(v) || 0;
const str = (v: any) => String(v ?? "").trim();
const r2 = (n: number) => Math.round(n * 100) / 100;

async function load(companyId: string, col: string, id: string, notFound: string) {
  const [company, snap] = await Promise.all([adminDb.doc(`companies/${companyId}`).get(), adminDb.doc(`companies/${companyId}/${col}/${id}`).get()]);
  if (!snap.exists) throw new ApiAuthError(404, notFound);
  const d = snap.data()!;
  if (d.companyId && d.companyId !== companyId) throw new ApiAuthError(404, notFound);
  return { d, ref: snap.ref, seller: mergeSeller(documentProfileOf(company.data()), d.sellerSnapshot) };
}

const cancelled = (d: any) => String(d.status || "").toUpperCase() === "CANCELLED";

export async function loadSalesOrder(companyId: string, id: string): Promise<DocumentModel> {
  const { d, seller } = await load(companyId, "sales_orders", id, "ไม่พบใบสั่งขาย");
  const lines = quotationLines(Array.isArray(d.items) ? d.items : []);
  const lineSum = r2(lines.reduce((s, l) => s + num(l.amount), 0));
  const taxType = taxTypeOf(d.vatType || d.taxMode);
  const grand = num(d.grandTotal ?? d.totalAmount);
  const net = taxType === "INCLUSIVE" ? grand : num(d.subTotal) || lineSum;
  const billDiscount = taxType !== "INCLUSIVE" && lineSum - net > 0.009 ? r2(lineSum - net) : 0;
  const st = String(d.status || "").toUpperCase();
  const dns: string[] = Array.isArray(d.deliveryNotes) ? d.deliveryNotes : [];
  return {
    type: "sales_order", title: "ใบสั่งขาย", titleEn: "SALES ORDER",
    number: str(d.documentNo || d.soId || id), date: toDateStr(d.docDate || d.date || d.createdAt),
    meta: [
      { label: "เครดิต", value: d.paymentTermDays ? `${num(d.paymentTermDays)} วัน` : str(d.paymentTerms) || "-" },
      ...(d.quoteId || d.quotationNo ? [{ label: "อ้างอิงใบเสนอราคา", value: str(d.quotationNo || d.quoteId) }] : []),
      ...(d.customerPoNo ? [{ label: "เลขที่ใบสั่งซื้อ", value: str(d.customerPoNo) }] : []),
      ...(d.projectName ? [{ label: "โครงการ", value: str(d.projectName) }] : []),
    ],
    seller,
    party: partyOf("ลูกค้า", d.customerSnapshot, str(d.customerName)),
    columns: ["no", "code", "description", "qty", "unit", "price", "discount", "amount"],
    lines,
    totals: totalsRows({ lineTotal: lineSum || net, billDiscount, net, vat: num(d.vatAmount), grand, taxType }),
    amountInWords: grand,
    notes: [
      d.deliveryAddress ? `สถานที่ส่งมอบ: ${str(d.deliveryAddress)}` : "",
      dns.length ? `ใบส่งของ: ${dns.join(", ")}` : "",
      d.invoiceNo ? `ออกใบกำกับภาษีแล้ว เลขที่ ${str(d.invoiceNo)}` : "",
      str(d.remarks || d.remark),
      cancelled(d) ? `ยกเลิก: ${str(d.cancelReason) || "-"}` : "",
    ].filter(Boolean),
    signatures: ["ผู้รับคำสั่งซื้อ", "ผู้อนุมัติ"],
    watermark: cancelled(d) ? "ยกเลิก" : st === "DRAFT" ? "ฉบับร่าง" : undefined,
  };
}

export async function loadDeliveryNote(companyId: string, id: string): Promise<DocumentModel> {
  const { d, seller } = await load(companyId, "delivery_notes", id, "ไม่พบใบส่งของ");
  const profile = await customerDocProfile(companyId, d.customerId);
  const lines: any[] = Array.isArray(d.lines) ? d.lines : [];
  const totalQty = lines.reduce((s, l) => s + num(l.qty), 0);
  return {
    type: "delivery_note", title: "ใบส่งของ", titleEn: "DELIVERY NOTE",
    number: str(d.dnNo || id), date: showDocDate(profile, "deliveryNote") ? toDateStr(d.deliveryDate || d.createdAt) : "",
    dateOption: { actual: toDateStr(d.deliveryDate || d.createdAt), profileUndated: !showDocDate(profile, "deliveryNote"), customerId: str(d.customerId), docKind: "deliveryNote" },
    meta: [
      { label: "ใบสั่งขาย", value: str(d.soNo) },
      ...(d.customerPoNo ? [{ label: "เลขที่ใบสั่งซื้อ", value: str(d.customerPoNo) }] : []),
      ...(d.projectName ? [{ label: "โครงการ", value: str(d.projectName) }] : []),
    ],
    seller,
    party: { ...partyOf("ลูกค้า", d.customerSnapshot, str(d.customerName)), ...(d.deliveryAddress ? { contactLabel: "สถานที่ส่ง", contact: str(d.deliveryAddress) } : {}) },
    columns: ["no", "code", "description", "qty", "unit"],
    lines: lines.map((l) => ({ code: str(l.sku), description: str(l.name), detail: l.location ? `เบิกจาก ${str(l.location)}` : "", qty: num(l.qty), unit: str(l.unit) })),
    totals: [],
    notes: [
      `รวม ${lines.length} รายการ จำนวน ${totalQty.toLocaleString("th-TH")} หน่วย`,
      "ได้รับสินค้า/บริการตามรายการข้างต้นในสภาพเรียบร้อยครบถ้วน",
      cancelled(d) ? `ยกเลิก: ${str(d.cancelReason) || "-"}` : "",
    ].filter(Boolean),
    signatures: ["ผู้ส่งของ", "ผู้รับของ", "ผู้ตรวจรับ"],
    watermark: cancelled(d) ? "ยกเลิก" : undefined,
  };
}

const WO_STATUS: Record<string, string> = { ASSIGNED: "รอเริ่มงาน", IN_PROGRESS: "กำลังทำงาน", COMPLETED: "ปิดงานแล้ว", CANCELLED: "ยกเลิก" };

/** เวลาไทย "18 ตุลาคม 2569 14:05" */
function thaiDateTime(v: any) {
  const secs = v?.seconds ?? v?._seconds;
  const ms = secs !== undefined ? secs * 1000 : Date.parse(v);
  if (!Number.isFinite(ms)) return "";
  const t = new Date(ms + 7 * 3600e3).toISOString();
  return `${thaiDate(t.slice(0, 10))} ${t.slice(11, 16)} น.`;
}

export async function loadWorkOrder(companyId: string, id: string): Promise<DocumentModel> {
  const { d, ref, seller } = await load(companyId, "work_orders", id, "ไม่พบใบสั่งงาน");
  const [att, so] = await Promise.all([
    ref.collection("attachments").get(),
    d.soId ? adminDb.doc(`companies/${companyId}/sales_orders/${str(d.soId)}`).get() : Promise.resolve(null),
  ]);
  const img = (t: string) => {
    const a = att.docs.find((x) => x.id === t)?.data();
    return typeof a?.dataUrl === "string" && /^data:image\/(png|jpe?g);base64,/.test(a.dataUrl) ? a.dataUrl : "";
  };
  const s = so?.exists ? so.data()! : null;
  const st = String(d.status || "").toUpperCase();
  const done = st === "COMPLETED";
  const items: any[] = Array.isArray(d.items) ? d.items : [];
  const sig = img("signature");
  const gps = (g: any) => (g && Number.isFinite(g.lat) ? ` (พิกัด ${Number(g.lat).toFixed(5)}, ${Number(g.lng).toFixed(5)})` : "");
  return {
    type: "work_order",
    title: done ? "ใบรายงานการให้บริการ" : "ใบสั่งงานบริการ", titleEn: done ? "SERVICE REPORT" : "WORK ORDER",
    number: str(d.woCode || d.documentNo || id), date: toDateStr(d.scheduleDate || d.createdAt),
    meta: [
      { label: "ใบสั่งขาย", value: str(d.soCode) || "-" },
      { label: "ช่างผู้รับผิดชอบ", value: str(d.technicianName) || "-" },
      ...(d.scheduleDate && String(d.scheduleDate).length > 10 ? [{ label: "นัดหมาย", value: `${thaiDate(d.scheduleDate)} ${String(d.scheduleDate).slice(11, 16)} น.` }] : []),
      { label: "สถานะ", value: WO_STATUS[st] || str(d.status) },
    ],
    seller,
    party: { ...partyOf("ลูกค้า", s?.customerSnapshot, str(d.customerName)), ...(s?.deliveryAddress ? { contactLabel: "สถานที่ปฏิบัติงาน", contact: str(s.deliveryAddress) } : {}) },
    columns: ["no", "code", "description", "qty", "unit"],
    lines: items.map((l) => ({ code: str(l.sku), description: str(l.name), detail: str(l.details), qty: num(l.qty), unit: str(l.unit) })),
    totals: [],
    notes: [
      d.remarks ? `รายละเอียดงาน: ${str(d.remarks)}` : "",
      d.checkIn?.at ? `เริ่มงาน ${thaiDateTime(d.checkIn.at)}${gps(d.checkIn.gps)}${d.checkIn.note ? ` · ${str(d.checkIn.note)}` : ""}` : "",
      d.checkOut?.at ? `ปิดงาน ${thaiDateTime(d.checkOut.at)}${gps(d.checkOut.gps)}` : "",
      done ? "ลูกค้าได้ตรวจรับงานตามรายการข้างต้นเรียบร้อยแล้ว" : "",
    ].filter(Boolean),
    photos: [["before", "ก่อนทำงาน"], ["after", "หลังทำงาน"]].map(([t, label]) => ({ label, src: img(t) })).filter((p) => p.src),
    signatures: ["ช่างผู้ปฏิบัติงาน", "ลูกค้าผู้ตรวจรับงาน"],
    signed: {
      "ช่างผู้ปฏิบัติงาน": { name: str(d.technicianName), ...(d.completedAt ? { date: toDateStr(d.completedAt) } : {}) },
      ...(sig ? { "ลูกค้าผู้ตรวจรับงาน": { image: sig, ...(d.completedAt ? { date: toDateStr(d.completedAt) } : {}) } } : {}),
    },
    watermark: st === "CANCELLED" ? "ยกเลิก" : undefined,
  };
}
