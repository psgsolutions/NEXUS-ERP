/**
 * สัญญาและหลักประกันของโครงการ (เน้นงานภาครัฐ) — ฟังก์ชันล้วน ใช้ทั้งหน้าจอ, API, cron และ unit test
 * เก็บที่ companies/{c}/projects/{id}.contract
 *
 * ค่าตั้งต้นตามแนวปฏิบัติทั่วไปของการจัดซื้อจัดจ้างภาครัฐ (แก้ได้ทุกช่อง — เกณฑ์จริงให้ยึดเอกสารประกวด/สัญญาของหน่วยงาน):
 *  - วงเงินเกิน 500,000 บาท (รวม VAT) ใช้วิธีประกวดราคาอิเล็กทรอนิกส์ (e-bidding), ไม่เกินใช้วิธีเฉพาะเจาะจง
 *  - หลักประกันการเสนอราคา / หลักประกันสัญญา 5%
 *  - อากรแสตมป์สัญญาจ้างทำของ 1 บาท ต่อทุก 1,000 บาท (เศษของ 1,000 คิดเป็น 1,000)
 *    วิธีชำระ (ปิดแสตมป์ / ชำระเป็นตัวเงิน / e-Stamp) เลือกตามที่หน่วยงานหรือสรรพากรกำหนด — ระบบไม่บังคับ
 */

export type ProcurementMethod = "SPECIFIC" | "EBIDDING" | "SELECTION" | "PRIVATE";
export type GuaranteeType = "BID" | "PERFORMANCE" | "ADVANCE" | "WARRANTY";
export type GuaranteeForm = "BANK_GUARANTEE" | "CASH" | "CHEQUE" | "GOV_BOND" | "EGP";
export type StampMethod = "STAMP" | "CASH" | "E_STAMP";

export const EBIDDING_THRESHOLD = 500_000;
export const METHOD_LABELS: Record<ProcurementMethod, string> = { SPECIFIC: "วิธีเฉพาะเจาะจง", EBIDDING: "ประกวดราคาอิเล็กทรอนิกส์ (e-bidding)", SELECTION: "วิธีคัดเลือก", PRIVATE: "งานเอกชน (ตามใบสั่งซื้อ/สัญญา)" };
export const GUARANTEE_LABELS: Record<GuaranteeType, string> = { BID: "หลักประกันการเสนอราคา", PERFORMANCE: "หลักประกันสัญญา", ADVANCE: "หลักประกันเงินล่วงหน้า", WARRANTY: "หลักประกันผลงาน/รับประกัน" };
export const GUARANTEE_FORM_LABELS: Record<GuaranteeForm, string> = { BANK_GUARANTEE: "หนังสือค้ำประกันธนาคาร", CASH: "เงินสด", CHEQUE: "เช็คที่ธนาคารรับรอง", GOV_BOND: "พันธบัตรรัฐบาล", EGP: "หนังสือค้ำประกันอิเล็กทรอนิกส์ (e-GP)" };
export const STAMP_LABELS: Record<StampMethod, string> = { STAMP: "ปิดอากรแสตมป์", CASH: "ชำระเป็นตัวเงิน (ตีตรา)", E_STAMP: "e-Stamp Duty" };
export const DEFAULT_GUARANTEE_PERCENT: Record<GuaranteeType, number> = { BID: 5, PERFORMANCE: 5, ADVANCE: 100, WARRANTY: 5 };

export interface Guarantee {
  id: string;
  type: GuaranteeType;
  form: GuaranteeForm;
  percent: number;
  amount: number;
  number?: string;
  issuer?: string;
  issueDate?: string;
  expiryDate?: string;
  returned?: boolean;
  returnDate?: string;
}

export interface ProjectContract {
  method: ProcurementMethod;
  contractNo?: string;
  /** เลขที่ใบสั่งซื้อ/ใบสั่งจ้างของลูกค้า */
  orderNo?: string;
  contractValue: number;
  signDate?: string;
  startDate?: string;
  dueDate?: string;
  /** วันส่งมอบงานจริง (เริ่มนับระยะรับประกัน) */
  handoverDate?: string;
  /** ค่าปรับต่อวัน (% ของค่าจ้าง) และขั้นต่ำต่อวัน (บาท) */
  penaltyRatePct?: number;
  penaltyMinPerDay?: number;
  warrantyMonths?: number;
  stamp?: { base: number; method?: StampMethod; paid?: boolean; ref?: string };
  guarantees: Guarantee[];
  notes?: string;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: any, min = 0, max = 1e12) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : 0; };
const str = (v: any, max = 120) => String(v ?? "").trim().slice(0, max);
const date = (v: any) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : undefined);
const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400e3);

/** วิธีจัดซื้อที่ควรใช้ตามวงเงิน (รวม VAT) */
export function suggestMethod(sector: string, valueInclVat: number): ProcurementMethod {
  if (sector !== "Government") return "PRIVATE";
  return valueInclVat > EBIDDING_THRESHOLD ? "EBIDDING" : "SPECIFIC";
}

/** อากรแสตมป์สัญญาจ้างทำของ: 1 บาท ต่อทุก 1,000 บาท (เศษคิดเต็ม) */
export function stampDuty(base: number): number {
  return base > 0 ? Math.ceil(base / 1000) : 0;
}

export function guaranteeAmount(percent: number, base: number): number {
  return r2((num(percent, 0, 100) / 100) * num(base));
}

/** เพิ่มเดือนให้วันที่ (วันที่เกินเดือนใช้วันสุดท้ายของเดือน) */
export function addMonths(d: string, months: number): string {
  const [y, m, day] = d.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const yy = Math.floor(total / 12), mm = (total % 12) + 1;
  const last = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  return `${yy}-${String(mm).padStart(2, "0")}-${String(Math.min(day, last)).padStart(2, "0")}`;
}

/** สิ้นสุดระยะรับประกัน (นับจากวันส่งมอบจริง) */
export function warrantyEnd(c: Pick<ProjectContract, "handoverDate" | "warrantyMonths">): string | null {
  return c.handoverDate && c.warrantyMonths ? addMonths(c.handoverDate, c.warrantyMonths) : null;
}

/** ค่าปรับสะสม ณ วันที่ (ส่งมอบช้ากว่ากำหนด) */
export function penaltyAccrued(c: ProjectContract, asOf: string): { daysLate: number; perDay: number; total: number } {
  if (!c.dueDate) return { daysLate: 0, perDay: 0, total: 0 };
  const end = c.handoverDate && c.handoverDate < asOf ? c.handoverDate : asOf;
  const daysLate = Math.max(0, dayDiff(c.dueDate, end));
  const perDay = r2(Math.max((num(c.penaltyRatePct) / 100) * num(c.contractValue), num(c.penaltyMinPerDay)));
  return { daysLate, perDay, total: r2(daysLate * perDay) };
}

/** ทำความสะอาดข้อมูลจากหน้าจอ (ใช้ที่ server) */
export function normalizeContract(raw: any, fallback: { sector?: string; value?: number; warrantyMonths?: number } = {}): ProjectContract {
  const r = raw && typeof raw === "object" ? raw : {};
  const contractValue = r2(num(r.contractValue ?? fallback.value));
  const methods = Object.keys(METHOD_LABELS) as ProcurementMethod[];
  const c: ProjectContract = {
    method: methods.includes(r.method) ? r.method : suggestMethod(fallback.sector || "", contractValue),
    contractValue,
    guarantees: [],
  };
  for (const k of ["contractNo", "orderNo"] as const) if (str(r[k])) c[k] = str(r[k]);
  for (const k of ["signDate", "startDate", "dueDate", "handoverDate"] as const) if (date(r[k])) c[k] = date(r[k]);
  if (r.penaltyRatePct !== undefined && r.penaltyRatePct !== "") c.penaltyRatePct = num(r.penaltyRatePct, 0, 10);
  if (r.penaltyMinPerDay !== undefined && r.penaltyMinPerDay !== "") c.penaltyMinPerDay = r2(num(r.penaltyMinPerDay, 0, 1e7));
  const wm = r.warrantyMonths ?? fallback.warrantyMonths;
  if (wm !== undefined && wm !== "") c.warrantyMonths = Math.round(num(wm, 0, 120));
  if (r.stamp && typeof r.stamp === "object") {
    const sm = Object.keys(STAMP_LABELS) as StampMethod[];
    c.stamp = { base: r2(num(r.stamp.base ?? contractValue)), ...(sm.includes(r.stamp.method) ? { method: r.stamp.method } : {}), ...(r.stamp.paid === true ? { paid: true } : {}), ...(str(r.stamp.ref) ? { ref: str(r.stamp.ref) } : {}) };
  }
  const types = Object.keys(GUARANTEE_LABELS) as GuaranteeType[];
  const forms = Object.keys(GUARANTEE_FORM_LABELS) as GuaranteeForm[];
  for (const g of Array.isArray(r.guarantees) ? r.guarantees.slice(0, 10) : []) {
    if (!g || !types.includes(g.type)) continue;
    const percent = num(g.percent ?? DEFAULT_GUARANTEE_PERCENT[g.type as GuaranteeType], 0, 100);
    c.guarantees.push({
      id: str(g.id, 40) || `${g.type}-${c.guarantees.length + 1}`,
      type: g.type, form: forms.includes(g.form) ? g.form : "BANK_GUARANTEE", percent,
      amount: g.amount !== undefined && g.amount !== "" ? r2(num(g.amount)) : guaranteeAmount(percent, contractValue),
      ...(str(g.number) ? { number: str(g.number) } : {}), ...(str(g.issuer) ? { issuer: str(g.issuer) } : {}),
      ...(date(g.issueDate) ? { issueDate: date(g.issueDate) } : {}), ...(date(g.expiryDate) ? { expiryDate: date(g.expiryDate) } : {}),
      ...(g.returned === true ? { returned: true } : {}), ...(date(g.returnDate) ? { returnDate: date(g.returnDate) } : {}),
    });
  }
  if (str(r.notes, 1000)) c.notes = str(r.notes, 1000);
  return c;
}

export interface ContractReminder { key: string; kind: "due_soon" | "overdue" | "guarantee_expiring" | "guarantee_return"; title: string; message: string }

/**
 * เรื่องที่ต้องติดตามของสัญญา (cron รายวัน — key คงที่ต่อเหตุการณ์ กันแจ้งซ้ำ)
 *  - ใกล้ครบกำหนดส่งมอบ 7 วัน / เลยกำหนด (ค่าปรับเริ่มนับ) แจ้งวันที่ 1, 7, 30
 *  - หลักประกันจะหมดอายุภายใน 30 วัน (ยังไม่คืน)
 *  - พ้นระยะรับประกันแล้ว: ขอคืนหลักประกันสัญญา/ผลงาน
 */
export function contractReminders(projectNo: string, c: ProjectContract | null | undefined, today: string): ContractReminder[] {
  if (!c) return [];
  const out: ContractReminder[] = [];
  const money = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (c.dueDate && !c.handoverDate) {
    const d = dayDiff(today, c.dueDate);
    if (d >= 0 && d <= 7) out.push({ key: `due-${c.dueDate}`, kind: "due_soon", title: `ใกล้ครบกำหนดส่งมอบ (${projectNo})`, message: `ครบกำหนด ${c.dueDate} (อีก ${d} วัน)${c.contractNo ? ` · สัญญา ${c.contractNo}` : ""}` });
    if (d < 0 && [1, 7, 30].includes(-d)) {
      const p = penaltyAccrued(c, today);
      out.push({ key: `late-${-d}`, kind: "overdue", title: `ส่งมอบล่าช้า ${-d} วัน (${projectNo})`, message: `ค่าปรับประมาณ ${money(p.perDay)} บาท/วัน · สะสม ${money(p.total)} บาท` });
    }
  }
  for (const g of c.guarantees) {
    if (g.returned || !g.expiryDate) continue;
    const d = dayDiff(today, g.expiryDate);
    if (d >= 0 && d <= 30) out.push({ key: `gexp-${g.id}-${g.expiryDate}`, kind: "guarantee_expiring", title: `${GUARANTEE_LABELS[g.type]}ใกล้หมดอายุ (${projectNo})`, message: `${g.number || GUARANTEE_FORM_LABELS[g.form]} ${money(g.amount)} บาท หมดอายุ ${g.expiryDate} — ต่ออายุหรือขอคืน` });
  }
  const wEnd = warrantyEnd(c);
  if (wEnd && today >= wEnd) {
    for (const g of c.guarantees) {
      if (g.returned || (g.type !== "PERFORMANCE" && g.type !== "WARRANTY")) continue;
      out.push({ key: `gret-${g.id}`, kind: "guarantee_return", title: `ขอคืน${GUARANTEE_LABELS[g.type]} (${projectNo})`, message: `พ้นระยะรับประกันเมื่อ ${wEnd} · ${money(g.amount)} บาท — ทำหนังสือขอคืนหลักประกัน` });
    }
  }
  return out;
}
