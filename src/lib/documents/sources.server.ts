/**
 * ที่เก็บเอกสารแต่ละชนิด (companies/{id}/<col>) และฟิลด์ที่ใช้แสดงในประวัติเอกสาร
 * ใช้กับ: ประวัติเอกสารที่ออก (/api/documents/history) · ดูตัวอย่างการออกแบบด้วยเอกสารจริง
 */
export interface DocSource { col: string; no: string[]; party: string[]; amount: string[]; date: string[] }

export const DOC_SOURCES: Record<string, DocSource> = {
  quotation: { col: "quotations", no: ["documentNo", "quotationNumber"], party: ["customerName"], amount: ["grandTotal", "netTotal"], date: ["docDate", "createdAt"] },
  sales_order: { col: "sales_orders", no: ["documentNo", "soId"], party: ["customerName"], amount: ["grandTotal", "totalAmount"], date: ["orderDate", "createdAt"] },
  invoice: { col: "invoices", no: ["invoiceNo", "documentNo"], party: ["customerName"], amount: ["grandTotal", "totalAmount"], date: ["issueDate", "createdAt"] },
  billing_note: { col: "billing_notes", no: ["billingNoteNo", "documentNo"], party: ["customerName"], amount: ["totalAmount"], date: ["issueDate", "createdAt"] },
  receipt: { col: "receipts", no: ["receiptNo", "documentNo"], party: ["customerName"], amount: ["totalApplied", "amount"], date: ["paymentDate", "createdAt"] },
  delivery_note: { col: "delivery_notes", no: ["dnNo"], party: ["customerName"], amount: [], date: ["deliveryDate", "createdAt"] },
  cndn: { col: "cndn", no: ["documentNo", "cndnNo"], party: ["customerName"], amount: ["amount"], date: ["issueDate", "createdAt"] },
  purchase_order: { col: "purchase_orders", no: ["poCode", "documentNo"], party: ["supplierName", "vendorName"], amount: ["grandTotal", "totalAmount"], date: ["poDate", "createdAt"] },
  payment: { col: "payments", no: ["paymentNo", "documentNo"], party: ["payeeName", "supplierName", "vendorName"], amount: ["amount", "totalAmount"], date: ["paymentDate", "createdAt"] },
  work_order: { col: "work_orders", no: ["woCode", "documentNo"], party: ["customerName"], amount: [], date: ["scheduleDate", "createdAt"] },
  wht: { col: "withholding_taxes", no: ["whtId"], party: ["vendorName", "vendor"], amount: ["whtAmount", "taxAmount"], date: ["filingDate", "issuedAt", "createdAt"] },
  journal: { col: "journal_entries", no: ["jvId", "journalNo", "documentNo"], party: ["description"], amount: ["totalDebit"], date: ["date", "createdAt"] },
  service_ticket: { col: "service_tickets", no: ["ticketNo"], party: ["customerName", "phone"], amount: [], date: ["createdAt"] },
  letter: { col: "letters", no: ["number"], party: ["to"], amount: [], date: ["date", "createdAt"] },
};

/** ค่าแรกที่มีของฟิลด์ที่เป็นไปได้ */
export const pick = (d: Record<string, any>, keys: string[]) => keys.map((k) => d[k]).find((v) => v !== undefined && v !== null && v !== "");
/** วันที่ (Timestamp / ISO / YYYY-MM-DD) → YYYY-MM-DD */
export function dateOf(v: any): string {
  if (!v) return "";
  if (typeof v?.toDate === "function") return v.toDate().toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}
