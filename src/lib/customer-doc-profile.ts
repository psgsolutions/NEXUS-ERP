/**
 * โปรไฟล์เอกสารของลูกค้า (ฟังก์ชันล้วน — ใช้ทั้งหน้าจอ, API และ unit test)
 * เก็บที่ companies/{c}/customers/{id}.docProfile (ของบริษัท ไม่ใช่ข้อมูลกลาง)
 * เลือกลูกค้าแล้วระบบรู้ว่าองค์กรนี้ต้องการเอกสารอย่างไร: แสดงราคาก่อน/รวม VAT, ใส่วันที่หรือไม่,
 * ข้อความบังคับ, เอกสารแนบตอนวางบิล, วิธีวางบิล/รับเงิน, วันรับวางบิล/รับเช็ค, หัก ณ ที่จ่าย
 *
 * ค่าที่ไม่ได้ตั้งใช้ค่าตั้งต้นตามประเภทองค์กร (ORG_DEFAULTS)
 * ข้อจำกัดทางกฎหมาย: ใบกำกับภาษี (รวมใบเสร็จที่เป็นใบกำกับภาษี) ต้องมีวันที่เสมอ (ม.86/4)
 */

export type OrgType = "GOV" | "STATE" | "PRIVATE" | "PERSON";
export type PriceDisplay = "EXCLUSIVE" | "INCLUSIVE";
export type BillingMethod = "BILL_THEN_TRANSFER" | "BILL_WITH_RECEIPT" | "CHEQUE" | "CASH";
export type UndatedDoc = "billingNote" | "deliveryNote" | "receipt";

export interface DocProfile {
  orgType: OrgType;
  priceDisplay?: PriceDisplay;
  /** เอกสารที่พิมพ์แบบเว้นวันที่ (ให้ลูกค้าลงวันที่เอง) */
  undated?: UndatedDoc[];
  billingMethod?: BillingMethod;
  /** รับวางบิลทุกวันที่ (1-31) / ทุกวันศุกร์สุดท้าย = 0 ไม่ใช้ */
  billingDay?: number | null;
  /** จ่ายเงิน/รับเช็คทุกวันที่ */
  paymentDay?: number | null;
  creditTermDays?: number | null;
  /** อัตราหัก ณ ที่จ่ายที่ลูกค้ามักหัก (%) */
  whtRate?: number | null;
  /** ข้อความที่ต้องมีบนเอกสาร */
  notes?: { quotation?: string; billingNote?: string; invoice?: string; receipt?: string };
  /** เอกสารที่ต้องแนบตอนวางบิล */
  attachments?: string[];
  contacts?: { procurement?: string; finance?: string; inspector?: string };
  /** ล็อกแล้ว: ระบบจะไม่ปรับโปรไฟล์ให้เองจากเอกสารที่ออก (ผู้มีสิทธิ์ยังแก้ได้ และบันทึกผู้แก้ล่าสุดเสมอ) */
  locked?: boolean;
  updatedBy?: string;
  updatedAt?: string;
}

export const ORG_LABELS: Record<OrgType, string> = { GOV: "ส่วนราชการ / หน่วยงานรัฐ", STATE: "รัฐวิสาหกิจ", PRIVATE: "เอกชน", PERSON: "บุคคลธรรมดา" };
export const BILLING_LABELS: Record<BillingMethod, string> = {
  BILL_THEN_TRANSFER: "วางบิล แล้วรอโอน",
  BILL_WITH_RECEIPT: "วางบิลพร้อมใบเสร็จ (รอโอน/เช็ค)",
  CHEQUE: "วางบิล แล้วรับเช็คตามรอบ",
  CASH: "ชำระทันที (เงินสด/โอน)",
};
export const UNDATED_LABELS: Record<UndatedDoc, string> = { billingNote: "ใบวางบิล", deliveryNote: "ใบส่งของ", receipt: "ใบเสร็จรับเงิน" };
export const COMMON_ATTACHMENTS = ["ใบส่งของ", "ใบกำกับภาษี/ใบแจ้งหนี้", "สำเนาใบสั่งซื้อ/สัญญา", "ใบตรวจรับพัสดุ/ตรวจรับงาน", "หนังสือส่งมอบงาน", "รูปถ่ายผลงาน", "ใบรับประกัน"];

/** ค่าตั้งต้นตามประเภทองค์กร (แก้รายลูกค้าได้) */
export const ORG_DEFAULTS: Record<OrgType, Omit<DocProfile, "orgType">> = {
  GOV: {
    priceDisplay: "INCLUSIVE", undated: ["billingNote", "receipt"], billingMethod: "BILL_WITH_RECEIPT", creditTermDays: 30, whtRate: 1,
    notes: { quotation: "ราคาดังกล่าวรวมภาษีมูลค่าเพิ่มแล้ว" },
    attachments: ["ใบส่งของ", "ใบกำกับภาษี/ใบแจ้งหนี้", "สำเนาใบสั่งซื้อ/สัญญา", "หนังสือส่งมอบงาน"],
  },
  STATE: { priceDisplay: "EXCLUSIVE", undated: [], billingMethod: "BILL_THEN_TRANSFER", creditTermDays: 30, attachments: ["ใบส่งของ", "ใบกำกับภาษี/ใบแจ้งหนี้", "สำเนาใบสั่งซื้อ/สัญญา"] },
  PRIVATE: { priceDisplay: "EXCLUSIVE", undated: [], billingMethod: "BILL_THEN_TRANSFER", creditTermDays: 30, attachments: ["ใบส่งของ", "ใบกำกับภาษี/ใบแจ้งหนี้"] },
  PERSON: { priceDisplay: "INCLUSIVE", undated: [], billingMethod: "CASH", creditTermDays: 0, attachments: [] },
};

const ORG_TYPES = Object.keys(ORG_LABELS) as OrgType[];
const str = (v: any, max = 300) => String(v ?? "").trim().slice(0, max);
const day = (v: any) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 1 && n <= 31 ? n : null; };

/** ทำความสะอาดค่าที่รับจากหน้าจอ (ใช้ที่ server ก่อนบันทึก) */
export function normalizeDocProfile(raw: any): DocProfile {
  const r = raw && typeof raw === "object" ? raw : {};
  const orgType: OrgType = ORG_TYPES.includes(r.orgType) ? r.orgType : "PRIVATE";
  const out: DocProfile = { orgType };
  if (r.priceDisplay === "EXCLUSIVE" || r.priceDisplay === "INCLUSIVE") out.priceDisplay = r.priceDisplay;
  if (Array.isArray(r.undated)) out.undated = Array.from(new Set(r.undated.filter((d: any) => d in UNDATED_LABELS))) as UndatedDoc[];
  if (r.billingMethod in BILLING_LABELS) out.billingMethod = r.billingMethod;
  if (r.billingDay !== undefined) out.billingDay = day(r.billingDay);
  if (r.paymentDay !== undefined) out.paymentDay = day(r.paymentDay);
  if (r.creditTermDays !== undefined && r.creditTermDays !== null && r.creditTermDays !== "") {
    const n = Math.round(Number(r.creditTermDays));
    if (Number.isFinite(n) && n >= 0 && n <= 365) out.creditTermDays = n;
  }
  if (r.whtRate !== undefined && r.whtRate !== null && r.whtRate !== "" && [0, 1, 2, 3, 5].includes(Number(r.whtRate))) out.whtRate = Number(r.whtRate);
  if (r.notes && typeof r.notes === "object") {
    const notes = Object.fromEntries(["quotation", "billingNote", "invoice", "receipt"].map((k) => [k, str(r.notes[k], 500)]).filter(([, v]) => v));
    if (Object.keys(notes).length) out.notes = notes;
  }
  if (Array.isArray(r.attachments)) out.attachments = Array.from(new Set(r.attachments.map((a: any) => str(a, 80)).filter(Boolean))).slice(0, 20) as string[];
  if (r.contacts && typeof r.contacts === "object") {
    const c = Object.fromEntries(["procurement", "finance", "inspector"].map((k) => [k, str(r.contacts[k], 120)]).filter(([, v]) => v));
    if (Object.keys(c).length) out.contacts = c;
  }
  if (r.locked === true) out.locked = true;
  return out;
}

/** โปรไฟล์ที่ใช้งานจริง = ค่าตั้งต้นของประเภทองค์กร + ค่าที่ตั้งเฉพาะลูกค้า */
export function effectiveDocProfile(customerOrProfile: any): Required<Pick<DocProfile, "orgType" | "priceDisplay" | "undated" | "billingMethod" | "attachments">> & DocProfile {
  const p: Partial<DocProfile> = customerOrProfile?.docProfile ?? customerOrProfile ?? {};
  const orgType: OrgType = ORG_TYPES.includes(p.orgType as OrgType) ? (p.orgType as OrgType) : "PRIVATE";
  const base = ORG_DEFAULTS[orgType];
  return {
    ...base,
    ...Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined)),
    orgType,
    priceDisplay: p.priceDisplay || base.priceDisplay || "EXCLUSIVE",
    undated: p.undated ?? base.undated ?? [],
    billingMethod: p.billingMethod || base.billingMethod || "BILL_THEN_TRANSFER",
    attachments: p.attachments ?? base.attachments ?? [],
    notes: { ...(base.notes || {}), ...(p.notes || {}) },
  };
}

/** พิมพ์วันที่บนเอกสารนี้หรือไม่ (ใบเสร็จที่เป็นใบกำกับภาษีต้องมีวันที่เสมอ) */
export function showDocDate(profile: any, doc: UndatedDoc, opts: { isTaxInvoice?: boolean } = {}): boolean {
  if (opts.isTaxInvoice) return true;
  return !effectiveDocProfile(profile).undated.includes(doc);
}

/** ค่าตั้งต้นของใบเสนอราคาเมื่อเลือกลูกค้า */
export function quotationDefaults(profile: any): { taxType: PriceDisplay; whtRate: number; note: string; paymentTerms: string } {
  const p = effectiveDocProfile(profile);
  const term = p.creditTermDays ? `เครดิต ${p.creditTermDays} วัน` : p.billingMethod === "CASH" ? "เงินสด" : "";
  return { taxType: p.priceDisplay, whtRate: p.whtRate ?? 0, note: p.notes?.quotation || "", paymentTerms: [term, BILLING_LABELS[p.billingMethod]].filter(Boolean).join(" · ") };
}

/** สรุปสั้นสำหรับแสดงข้างชื่อลูกค้า */
export function docProfileSummary(profile: any): string[] {
  const p = effectiveDocProfile(profile);
  return [
    ORG_LABELS[p.orgType],
    p.priceDisplay === "INCLUSIVE" ? "แสดงราคารวม VAT" : "แสดงราคาก่อน VAT",
    p.undated.length ? `เว้นวันที่: ${p.undated.map((d) => UNDATED_LABELS[d]).join(", ")}` : "",
    BILLING_LABELS[p.billingMethod],
    p.billingDay ? `รับวางบิลวันที่ ${p.billingDay}` : "",
    p.paymentDay ? `จ่ายเงิน/รับเช็ควันที่ ${p.paymentDay}` : "",
    p.whtRate ? `หัก ณ ที่จ่าย ${p.whtRate}%` : "",
  ].filter(Boolean);
}

/** วันที่ถัดไปที่ตรงกับ "ทุกวันที่ N" (เดือนที่ไม่มีวันนั้นใช้วันสุดท้ายของเดือน) — ใช้แจ้งเตือน */
export function nextMonthlyDate(dayOfMonth: number, from: string): string {
  const [y, m, d] = from.split("-").map(Number);
  const last = (yy: number, mm: number) => new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  let yy = y, mm = m;
  if (d > Math.min(dayOfMonth, last(yy, mm))) { mm += 1; if (mm > 12) { mm = 1; yy += 1; } }
  const dd = Math.min(dayOfMonth, last(yy, mm));
  return `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

// ---------- รอบวางบิล / รับเงินของลูกค้า ----------

export interface ScheduleEvent {
  customerId: string;
  customerName: string;
  kind: "billing" | "payment";
  date: string;
  daysAway: number;
  /** ใบแจ้งหนี้ค้างทั้งหมด / ยอดค้าง */
  invoiceCount: number;
  outstanding: number;
  /** รับเงิน: ยอดที่ครบกำหนดภายในวันนั้น */
  dueTotal: number;
  attachments: string[];
  billingMethod: BillingMethod;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400e3);
const dateStr = (v: any): string => {
  if (!v) return "";
  if (typeof v === "string") return v.slice(0, 10);
  const secs = v.seconds ?? v._seconds;
  return secs !== undefined ? new Date(secs * 1000 + 7 * 3600e3).toISOString().slice(0, 10) : "";
};
const openBalance = (inv: any) => {
  if (inv.isDeleted === true || inv.isSample === true || String(inv.status || "").toLowerCase() === "cancelled") return 0;
  const total = Number(inv.grandTotal ?? inv.totalAmount) || 0;
  return r2(inv.balance !== undefined ? Number(inv.balance) || 0 : total - (Number(inv.paidAmount) || 0));
};

/** นัดวางบิล/รับเงินของลูกค้าที่ตั้งรอบไว้ ภายใน horizonDays วัน (เฉพาะลูกค้าที่มียอดค้าง) เรียงตามวัน */
export function customerSchedule(customers: any[], invoices: any[], today: string, horizonDays = 31): ScheduleEvent[] {
  const byCustomer = new Map<string, any[]>();
  for (const inv of invoices) {
    if (!inv?.customerId || openBalance(inv) <= 0.009) continue;
    const k = String(inv.customerId);
    byCustomer.set(k, [...(byCustomer.get(k) || []), inv]);
  }
  const events: ScheduleEvent[] = [];
  for (const c of customers) {
    const open = byCustomer.get(String(c.id));
    if (!open?.length) continue;
    const p = effectiveDocProfile(c);
    const outstanding = r2(open.reduce((s, i) => s + openBalance(i), 0));
    const base = { customerId: String(c.id), customerName: String(c.name || c.customerName || c.id), invoiceCount: open.length, outstanding, attachments: p.attachments, billingMethod: p.billingMethod };
    if (p.billingDay) {
      const date = nextMonthlyDate(p.billingDay, today);
      const daysAway = dayDiff(today, date);
      if (daysAway <= horizonDays) events.push({ ...base, kind: "billing", date, daysAway, dueTotal: 0 });
    }
    if (p.paymentDay) {
      const date = nextMonthlyDate(p.paymentDay, today);
      const daysAway = dayDiff(today, date);
      const dueTotal = r2(open.filter((i) => { const d = dateStr(i.dueDate); return !d || d <= date; }).reduce((s, i) => s + openBalance(i), 0));
      if (daysAway <= horizonDays && dueTotal > 0.009) events.push({ ...base, kind: "payment", date, daysAway, dueTotal });
    }
  }
  return events.sort((a, b) => a.date.localeCompare(b.date) || a.customerName.localeCompare(b.customerName, "th"));
}

/** แจ้งเตือนล่วงหน้า: วางบิล 2 วัน, รับเงิน/เช็ค 1 วัน (รวมวันนั้นเอง) */
export const SCHEDULE_LEAD_DAYS = { billing: 2, payment: 1 } as const;
