/**
 * ค่ากลางของโครงการ — ใช้ร่วมกันทั้งหน้าจอและ server
 *  - ขั้นของโครงการ (วางแผนก่อนจัดซื้อจัดจ้าง / ประกวดราคา / ได้งานแล้ว)
 *  - ข้อมูลภาครัฐ: วิธีจัดซื้อจัดจ้าง แหล่งงบประมาณ ปีงบประมาณ
 *  - ค่าใช้จ่ายดำเนินงาน: อัตราที่เหมาะสมคำนวณอัตโนมัติตามขนาด/รูปแบบ/ระยะเวลาโครงการ (แก้ไขได้)
 *  - แผนงาน/งวดงานตามรูปแบบงาน
 *  - รายละเอียดโครงการเรียงตามร่างขอบเขตของงาน (TOR) ภาครัฐ
 *  - รูปแบบงานอัตโนมัติจากรายการสินค้า/บริการ
 *  - การปัดราคาขายเป็นตัวเลขกลม
 */

import type { ProjectTypeCode } from "@/types/database";
import type { ProjectLine } from "./project-budget";
import { arabicToThaiBaht } from "./erp-logic";

export type Sector = "Government" | "Private";

// ---------------------------------------------------------------------------
// ขั้นของโครงการ
// ---------------------------------------------------------------------------
export type ProjectStage = "PLANNING" | "BIDDING" | "CONTRACTED";

export const PROJECT_STAGES: { code: ProjectStage; label: string; hint: string }[] = [
  { code: "PLANNING", label: "วางแผน / ก่อนจัดซื้อจัดจ้าง", hint: "ช่วยหน่วยงานวางแผน จัดทำงบประมาณและร่างขอบเขตของงาน (TOR)" },
  { code: "BIDDING", label: "ระหว่างประกวดราคา", hint: "ประกาศ e-bidding แล้ว รอผลการพิจารณา" },
  { code: "CONTRACTED", label: "ได้งาน / ลงนามสัญญาแล้ว", hint: "พร้อมส่งขออนุมัติเปิดโครงการ" },
];

export const normalizeStage = (v: unknown): ProjectStage =>
  v === "PLANNING" || v === "BIDDING" ? v : "CONTRACTED";

// ---------------------------------------------------------------------------
// ภาครัฐ
// ---------------------------------------------------------------------------
export const PROCUREMENT_METHODS = [
  "วิธีประกาศเชิญชวนทั่วไป (e-bidding)",
  "วิธีตลาดอิเล็กทรอนิกส์ (e-market)",
  "วิธีคัดเลือก",
  "วิธีเฉพาะเจาะจง",
];

export const BUDGET_SOURCES = [
  "งบประมาณประจำปี",
  "เงินรายได้ของหน่วยงาน",
  "เงินอุดหนุน",
  "เงินกู้",
  "เงินนอกงบประมาณ",
];

/** ปีงบประมาณ (พ.ศ.) ของวันที่ — เริ่ม 1 ต.ค. */
export function fiscalYearOf(date: string): number {
  const d = new Date(`${date || new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  const y = d.getUTCFullYear() + 543;
  return d.getUTCMonth() >= 9 ? y + 1 : y;
}

// ---------------------------------------------------------------------------
// ค่าใช้จ่ายดำเนินงาน
// ---------------------------------------------------------------------------
/** ฐานคำนวณ: % ต้นทุนรวม / % ค่าอุปกรณ์ / % ค่าแรง / % ราคาขาย / จำนวนเงิน */
export type ExpenseBasis = "PCT_DIRECT" | "PCT_EQUIP" | "PCT_LABOR" | "PCT_PRICE" | "AMOUNT";

export const EXPENSE_BASIS_TH: Record<ExpenseBasis, string> = {
  PCT_DIRECT: "% ต้นทุน",
  PCT_EQUIP: "% อุปกรณ์",
  PCT_LABOR: "% ค่าแรง",
  PCT_PRICE: "% ราคาขาย",
  AMOUNT: "บาท",
};

export interface ProjectExpense {
  id: string;
  key?: string; // รายการมาตรฐาน (RISK = เงินสำรองความเสี่ยง)
  name: string;
  basis: ExpenseBasis;
  value: number; // % หรือ บาท ตาม basis
  /** true = อัตราคำนวณอัตโนมัติตามข้อมูลโครงการ (แก้ค่าเองแล้วจะเป็น false) */
  auto?: boolean;
}

export interface ExpenseContext {
  sector: Sector;
  typeCode: ProjectTypeCode | null;
  equipCost: number;
  laborCost: number;
  durationDays: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

type ExpenseTpl = { key: string; name: string; basis: ExpenseBasis; govOnly?: boolean; rate: (c: ExpenseContext) => number; when?: (c: ExpenseContext) => boolean };

/** อัตรามาตรฐาน — ปรับตามขนาด รูปแบบงาน และระยะเวลาโครงการ */
const EXPENSE_TEMPLATES: ExpenseTpl[] = [
  {
    key: "TRANSPORT", name: "ค่าขนส่งและยกย้ายอุปกรณ์", basis: "PCT_EQUIP",
    rate: (c) => (c.equipCost < 100_000 ? 2 : c.equipCost < 1_000_000 ? 1.5 : 1),
  },
  {
    key: "TRAVEL", name: "ค่าเดินทาง ที่พัก เบี้ยเลี้ยงทีมงาน", basis: "PCT_LABOR",
    rate: (c) => (c.durationDays > 180 ? 10 : c.durationDays > 60 ? 8 : 6),
  },
  {
    key: "OVERHEAD", name: "ค่าดำเนินงานและบริหารโครงการ", basis: "PCT_DIRECT",
    rate: (c) => { const t = c.equipCost + c.laborCost; return t < 300_000 ? 8 : t < 3_000_000 ? 5 : 3; },
  },
  {
    key: "GUARANTEE", name: "ค่าธรรมเนียมหนังสือค้ำประกันสัญญา", basis: "PCT_PRICE", govOnly: true,
    // หลักประกัน 5% × ค่าธรรมเนียมธนาคารราว 2% ต่อปี ≈ 0.1% ของราคาต่อปี
    rate: (c) => r2(0.1 * Math.max(1, Math.ceil(c.durationDays / 365))),
  },
  {
    key: "STAMP", name: "ค่าอากรแสตมป์สัญญาจ้าง", basis: "PCT_PRICE", govOnly: true,
    rate: () => 0.1,
    when: (c) => c.typeCode !== 1, // ซื้อขายอย่างเดียวไม่ใช่สัญญาจ้างทำของ
  },
  {
    key: "RISK", name: "เงินสำรองความเสี่ยง", basis: "PCT_DIRECT",
    rate: (c) => ({ 1: 2, 2: 3, 3: 5, 4: 5 } as Record<number, number>)[c.typeCode || 4] + (c.durationDays > 180 ? 1 : 0),
  },
];

const tplOf = (key?: string) => EXPENSE_TEMPLATES.find((t) => t.key === key);

/** ค่าใช้จ่ายเริ่มต้นของโครงการ (ทุกแถวคำนวณอัตโนมัติ) */
export function defaultExpenses(c: ExpenseContext): ProjectExpense[] {
  return EXPENSE_TEMPLATES
    .filter((t) => (!t.govOnly || c.sector === "Government") && (!t.when || t.when(c)))
    .map((t) => ({ id: `EXP-${t.key}`, key: t.key, name: t.name, basis: t.basis, value: t.rate(c), auto: true }));
}

/** แถวที่ยังเป็นอัตโนมัติ: คำนวณอัตราใหม่ตามข้อมูลโครงการล่าสุด */
export function resolveExpenses(rows: ProjectExpense[], c: ExpenseContext): ProjectExpense[] {
  return rows.map((e) => {
    const t = tplOf(e.key);
    return e.auto && t ? { ...e, basis: t.basis, value: t.rate(c) } : e;
  });
}

export interface CostBase { equipCost: number; laborCost: number; price: number }

export function expenseAmount(e: Pick<ProjectExpense, "basis" | "value">, b: CostBase): number {
  const v = Math.max(0, num(e.value));
  switch (e.basis) {
    case "AMOUNT": return r2(v);
    case "PCT_EQUIP": return r2(b.equipCost * v / 100);
    case "PCT_LABOR": return r2(b.laborCost * v / 100);
    case "PCT_PRICE": return r2(b.price * v / 100);
    default: return r2((b.equipCost + b.laborCost) * v / 100);
  }
}

export function normalizeExpenses(raw: any): ProjectExpense[] {
  const bases: ExpenseBasis[] = ["PCT_DIRECT", "PCT_EQUIP", "PCT_LABOR", "PCT_PRICE", "AMOUNT"];
  return (Array.isArray(raw) ? raw : []).slice(0, 30)
    .map((e: any, i: number) => ({
      id: String(e?.id || `EXP-${i}`).slice(0, 40),
      ...(e?.key ? { key: String(e.key).slice(0, 20) } : {}),
      name: String(e?.name ?? "").trim().slice(0, 200),
      basis: (bases.includes(e?.basis) ? e.basis : "AMOUNT") as ExpenseBasis,
      value: r2(Math.max(0, num(e?.value))),
      auto: e?.auto === true,
    }))
    .filter((e) => e.name);
}

/**
 * ราคาขาย (ก่อน VAT) ที่ทำให้ได้กำไรสุทธิตามเป้า หลังหักต้นทุนตรงและค่าใช้จ่ายดำเนินงาน
 * price × (1 − margin − Σ%ราคา) = ต้นทุน + ค่าใช้จ่ายที่ไม่ขึ้นกับราคา
 */
export function priceForMargin(equipCost: number, laborCost: number, expenses: ProjectExpense[], marginPercent: number): number {
  const fixed = equipCost + laborCost + expenses.filter((e) => e.basis !== "PCT_PRICE")
    .reduce((s, e) => s + expenseAmount(e, { equipCost, laborCost, price: 0 }), 0);
  const pp = expenses.filter((e) => e.basis === "PCT_PRICE").reduce((s, e) => s + num(e.value), 0) / 100;
  const denom = 1 - marginPercent / 100 - pp;
  if (denom <= 0) return 0;
  return r2(fixed / denom);
}

/** ปัดราคาขายต่อหน่วยขึ้นเป็นเลขกลม: < 1,000 ปัดเต็มบาท, < 100,000 ปัดหลักสิบ, ตั้งแต่หลักแสน ปัดหลักร้อย */
export function roundUpPrice(p: number): number {
  const v = Math.max(0, Number(p) || 0);
  if (v === 0) return 0;
  const step = v < 1_000 ? 1 : v < 100_000 ? 10 : 100;
  return Math.ceil(v / step - 1e-9) * step;
}

// ---------------------------------------------------------------------------
// รูปแบบงานอัตโนมัติ
// ---------------------------------------------------------------------------
/** สินค้าอย่างเดียว = ซื้อขาย, บริการอย่างเดียว = ติดตั้ง (หรือคงบำรุงรักษาไว้), มีทั้งคู่ = ซื้อขายพร้อมติดตั้ง */
export function inferProjectType(lines: Pick<ProjectLine, "kind" | "name">[], current: ProjectTypeCode | null): ProjectTypeCode | null {
  const real = lines.filter((l) => l.kind !== "GROUP" && l.name);
  const hasProduct = real.some((l) => l.kind === "PRODUCT");
  const hasService = real.some((l) => l.kind === "SERVICE" || l.kind === "LABOR");
  if (hasProduct && hasService) return current === 2 ? 2 : 4;
  if (hasProduct) return 1;
  if (hasService) return current === 2 ? 2 : 3;
  return null;
}

// ---------------------------------------------------------------------------
// แผนงาน / งวดงาน
// ---------------------------------------------------------------------------
export interface TimelinePhase {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  weight: number; // % ของงาน = % ของงวดเงิน
}

type PhaseTpl = { name: string; share: number; weight: number };

const PHASES: Record<Exclude<ProjectTypeCode, 2>, PhaseTpl[]> = {
  1: [
    { name: "จัดหาและตรวจสอบอุปกรณ์", share: 60, weight: 0 },
    { name: "ส่งมอบอุปกรณ์", share: 25, weight: 0 },
    { name: "ตรวจรับพัสดุ", share: 15, weight: 100 },
  ],
  3: [
    { name: "สำรวจหน้างานและวางแผนติดตั้ง", share: 15, weight: 10 },
    { name: "ติดตั้งและเดินสาย", share: 55, weight: 50 },
    { name: "ทดสอบระบบ", share: 15, weight: 20 },
    { name: "ตรวจรับและส่งมอบงาน", share: 15, weight: 20 },
  ],
  4: [
    { name: "สำรวจหน้างานและออกแบบ", share: 10, weight: 10 },
    { name: "จัดหาและส่งมอบอุปกรณ์", share: 30, weight: 30 },
    { name: "ติดตั้งและเดินสาย", share: 35, weight: 35 },
    { name: "ทดสอบระบบและฝึกอบรม", share: 15, weight: 15 },
    { name: "ตรวจรับและส่งมอบงาน", share: 10, weight: 10 },
  ],
};

const DAY = 86400e3;
const toMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
const toDate = (t: number) => new Date(t).toISOString().slice(0, 10);

/** แผนงานเริ่มต้นตามรูปแบบงาน (ยังไม่เลือก = แบบซื้อขายพร้อมติดตั้ง) แบ่งช่วงเวลาตามสัดส่วน */
export function defaultTimeline(typeCode: ProjectTypeCode | null, startDate: string, endDate: string): TimelinePhase[] {
  const s = toMs(startDate);
  const e = toMs(endDate);
  if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return [];
  const days = Math.round((e - s) / DAY) + 1;

  let tpl: PhaseTpl[];
  if (typeCode === 2) {
    // บำรุงรักษา: เข้าบำรุงรักษาทุก 3 เดือน (อย่างน้อย 1 ครั้ง) งวดเงินเท่ากัน
    const rounds = Math.max(1, Math.min(12, Math.round(days / 91)));
    const w = Math.floor((100 / rounds) * 100) / 100;
    tpl = Array.from({ length: rounds }, (_, i) => ({
      name: `บำรุงรักษาครั้งที่ ${i + 1}`,
      share: 100 / rounds,
      weight: i === rounds - 1 ? r2(100 - w * (rounds - 1)) : w,
    }));
  } else tpl = PHASES[typeCode || 4];

  const out: TimelinePhase[] = [];
  let cursor = 0;
  tpl.forEach((p, i) => {
    const len = i === tpl.length - 1 ? days - cursor : Math.max(1, Math.round((days * p.share) / 100));
    const from = Math.min(cursor, days - 1);
    const to = Math.max(from, Math.min(days - 1, cursor + len - 1));
    out.push({ id: `PH-${i + 1}`, name: p.name, startDate: toDate(s + from * DAY), endDate: toDate(s + to * DAY), weight: p.weight });
    cursor = to + 1;
  });
  return out;
}

export function normalizeTimeline(raw: any): TimelinePhase[] {
  const isDate = (v: any) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
  return (Array.isArray(raw) ? raw : []).slice(0, 60)
    .map((p: any, i: number) => ({
      id: String(p?.id || `PH-${i + 1}`).slice(0, 40),
      name: String(p?.name ?? "").trim().slice(0, 200),
      startDate: isDate(p?.startDate) ? p.startDate : "",
      endDate: isDate(p?.endDate) ? p.endDate : "",
      weight: r2(Math.min(100, Math.max(0, num(p?.weight)))),
    }))
    .filter((p) => p.name && p.startDate && p.endDate);
}

export function timelineError(phases: TimelinePhase[]): string | null {
  for (const [i, p] of phases.entries()) {
    if (p.endDate < p.startDate) return `งวดที่ ${i + 1}: วันที่สิ้นสุดอยู่ก่อนวันที่เริ่ม`;
  }
  const total = r2(phases.reduce((s, p) => s + p.weight, 0));
  if (phases.length && Math.abs(total - 100) > 0.01) return `สัดส่วนงวดงานรวม ${total}% ต้องเท่ากับ 100%`;
  return null;
}

// ---------------------------------------------------------------------------
// รายละเอียดโครงการ (ร่างขอบเขตของงาน)
// ---------------------------------------------------------------------------
export type DocSectionKey =
  | "background" | "objectives" | "qualifications" | "scope" | "specs" | "duration"
  | "criteria" | "budget" | "payment" | "penalty" | "warranty" | "reservation" | "legal";

export interface DocSectionDef {
  key: DocSectionKey;
  title: string;
  /** ข้อความมาตรฐานตามกฎหมาย — ไม่ต้องแก้ไข */
  locked?: boolean;
  /** ให้ AI ช่วยเรียบเรียงได้ (หัวข้อที่เป็นตัวเลข/กฎหมาย ระบบสร้างจากข้อมูลจริงเท่านั้น) */
  ai?: boolean;
  sectors: Sector[];
}

/** เรียงตามแบบร่างขอบเขตของงาน (TOR) ภาครัฐ; เอกชนใช้เฉพาะหัวข้อที่เกี่ยวข้อง */
const SECTION_DEFS: DocSectionDef[] = [
  { key: "background", title: "ความเป็นมา", ai: true, sectors: ["Government", "Private"] },
  { key: "objectives", title: "วัตถุประสงค์", ai: true, sectors: ["Government", "Private"] },
  { key: "qualifications", title: "คุณสมบัติของผู้ยื่นข้อเสนอ", locked: true, sectors: ["Government"] },
  { key: "scope", title: "ขอบเขตของงาน", ai: true, sectors: ["Government", "Private"] },
  { key: "specs", title: "คุณลักษณะเฉพาะ", ai: true, sectors: ["Government", "Private"] },
  { key: "duration", title: "ระยะเวลาดำเนินการและส่งมอบ", sectors: ["Government", "Private"] },
  { key: "criteria", title: "หลักเกณฑ์การพิจารณาคัดเลือกข้อเสนอ", sectors: ["Government"] },
  { key: "budget", title: "วงเงินงบประมาณและราคากลาง", sectors: ["Government"] },
  { key: "budget", title: "มูลค่าโครงการ", sectors: ["Private"] },
  { key: "payment", title: "งวดงานและการจ่ายเงิน", sectors: ["Government", "Private"] },
  { key: "penalty", title: "อัตราค่าปรับ", sectors: ["Government", "Private"] },
  { key: "warranty", title: "การรับประกันความชำรุดบกพร่อง", sectors: ["Government", "Private"] },
  { key: "reservation", title: "ข้อสงวนสิทธิ์", locked: true, sectors: ["Government"] },
  { key: "legal", title: "ข้อกำหนดตามกฎหมาย", locked: true, sectors: ["Private"] },
];

export const docSectionsFor = (sector: Sector) => SECTION_DEFS.filter((d) => d.sectors.includes(sector));
export const ALL_DOC_KEYS = Array.from(new Set(SECTION_DEFS.map((d) => d.key)));
export const AI_DOC_KEYS = Array.from(new Set(SECTION_DEFS.filter((d) => d.ai).map((d) => d.key)));

export interface DocContext {
  projectName: string;
  customerName: string;
  sector: Sector;
  typeCode: ProjectTypeCode | null;
  stage: ProjectStage;
  startDate: string;
  endDate: string;
  durationDays: number;
  budgetAmount: number; // วงเงินงบประมาณ / มูลค่าโครงการ (รวม VAT)
  referencePrice: number;
  budgetSource: string;
  fiscalYear: number;
  warrantyMonths: number;
  lines: ProjectLine[];
  timeline: TimelinePhase[];
  /** สเปกจากทะเบียนสินค้า (productId -> ข้อความ) ใช้เมื่อรายการไม่มีรายละเอียด */
  productSpecs?: Record<string, string>;
  /** ข้อความจากคลังสเปกตามรูปแบบที่เลือก (lineId -> ข้อความ) */
  specClauses?: Record<string, string[]>;
}

const OBJECTIVES: Record<ProjectTypeCode, string[]> = {
  1: ["เพื่อจัดหาอุปกรณ์ที่มีคุณภาพ ได้มาตรฐาน และเหมาะสมกับการใช้งาน", "เพื่อทดแทนหรือเพิ่มเติมอุปกรณ์ให้เพียงพอต่อความต้องการ"],
  2: ["เพื่อให้ระบบและอุปกรณ์อยู่ในสภาพพร้อมใช้งานอย่างต่อเนื่อง", "เพื่อลดความเสี่ยงจากการหยุดชะงักของระบบ", "เพื่อยืดอายุการใช้งานของอุปกรณ์"],
  3: ["เพื่อติดตั้งระบบให้ถูกต้องตามมาตรฐานและพร้อมใช้งาน", "เพื่อให้การติดตั้งเป็นไปอย่างปลอดภัย เรียบร้อย และตรวจสอบได้"],
  4: ["เพื่อจัดหาและติดตั้งระบบให้พร้อมใช้งานอย่างครบถ้วน", "เพื่อเพิ่มประสิทธิภาพการปฏิบัติงานและการให้บริการ", "เพื่อให้ผู้ใช้งานได้รับการถ่ายทอดความรู้ในการใช้งานและดูแลรักษาระบบ"],
};

const fmt = (n: number) => (Number(n) || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const TH_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
export const thaiDate = (d: string) => {
  const [y, m, day] = String(d || "").split("-").map(Number);
  return y && m && day ? `${day} ${TH_MONTHS[m - 1]} ${y + 543}` : "-";
};
const qtyText = (n: number) => (Number(n) || 0).toLocaleString("th-TH", { maximumFractionDigits: 2 });

/** แปลงรายละเอียดสินค้าเป็นภาษาข้อกำหนด: "รองรับ 4K" -> "ต้องรองรับ 4K", "ขนาด 1000VA" -> "ต้องมีขนาด 1000VA" */
export function specSentence(raw: string): string {
  const s = raw.trim().replace(/^[-•*·]\s*/, "").replace(/^\d+(\.\d+)*[.)]?\s+/, "");
  if (!s) return "";
  if (/^(ต้อง|ไม่)/.test(s)) return s;
  if (/^(มี|เป็น|สามารถ|รองรับ|ได้รับ|ผ่าน|ใช้|ทำงาน|ติดตั้ง|ประกอบ|ผลิต|รับประกัน)/.test(s)) return `ต้อง${s}`;
  return `ต้องมี${s}`;
}

/** หัวข้อที่ n ของเอกสาร (เลขข้อ) */
export function sectionNumber(sector: Sector, key: DocSectionKey): number {
  return docSectionsFor(sector).findIndex((d) => d.key === key) + 1;
}

const QUALIFICATIONS = (agency: string) => [
  "มีความสามารถตามกฎหมาย",
  "ไม่เป็นบุคคลล้มละลาย",
  "ไม่อยู่ระหว่างเลิกกิจการ",
  "ไม่เป็นบุคคลซึ่งอยู่ระหว่างถูกระงับการยื่นข้อเสนอหรือทำสัญญากับหน่วยงานของรัฐไว้ชั่วคราว เนื่องจากเป็นผู้ที่ไม่ผ่านเกณฑ์การประเมินผลการปฏิบัติงานของผู้ประกอบการตามระเบียบที่รัฐมนตรีว่าการกระทรวงการคลังกำหนด ตามที่ประกาศเผยแพร่ในระบบเครือข่ายสารสนเทศของกรมบัญชีกลาง",
  "ไม่เป็นบุคคลซึ่งถูกระบุชื่อไว้ในบัญชีรายชื่อผู้ทิ้งงานและได้แจ้งเวียนชื่อให้เป็นผู้ทิ้งงานของหน่วยงานของรัฐในระบบเครือข่ายสารสนเทศของกรมบัญชีกลาง ซึ่งรวมถึงนิติบุคคลที่ผู้ทิ้งงานเป็นหุ้นส่วนผู้จัดการ กรรมการผู้จัดการ ผู้บริหาร ผู้มีอำนาจในการดำเนินงานในกิจการของนิติบุคคลนั้นด้วย",
  "มีคุณสมบัติและไม่มีลักษณะต้องห้ามตามที่คณะกรรมการนโยบายการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐกำหนดในราชกิจจานุเบกษา",
  "เป็นนิติบุคคลหรือบุคคลธรรมดาผู้มีอาชีพขายหรือรับจ้างงานที่จัดซื้อจัดจ้างในครั้งนี้",
  `ไม่เป็นผู้มีผลประโยชน์ร่วมกันกับผู้ยื่นข้อเสนอรายอื่นที่เข้ายื่นข้อเสนอให้แก่${agency} ณ วันประกาศ หรือไม่เป็นผู้กระทำการอันเป็นการขัดขวางการแข่งขันอย่างเป็นธรรม`,
  "ไม่เป็นผู้ได้รับเอกสิทธิ์หรือความคุ้มกัน ซึ่งอาจปฏิเสธไม่ยอมขึ้นศาลไทย เว้นแต่รัฐบาลของผู้ยื่นข้อเสนอได้มีคำสั่งให้สละเอกสิทธิ์และความคุ้มกันเช่นว่านั้น",
  "ผู้ยื่นข้อเสนอต้องลงทะเบียนในระบบจัดซื้อจัดจ้างภาครัฐด้วยอิเล็กทรอนิกส์ (Electronic Government Procurement : e-GP) ของกรมบัญชีกลาง",
];

export function generateSection(key: DocSectionKey, c: DocContext): string {
  const gov = c.sector === "Government";
  const n = sectionNumber(c.sector, key) || 1;
  const sub = (items: string[]) => items.map((t, i) => `${n}.${i + 1} ${t}`).join("\n");
  const agency = c.customerName || (gov ? "หน่วยงาน" : "ผู้ว่าจ้าง");
  const name = c.projectName || "โครงการ";
  const type = c.typeCode || 4;
  const isPurchase = type === 1;
  const real = c.lines.filter((l) => l.name && !l.isOptional);
  switch (key) {
    case "background":
      return gov
        ? `ด้วย${agency} มีความจำเป็นต้องดำเนิน${name} เพื่อให้การปฏิบัติงานและการให้บริการเป็นไปอย่างมีประสิทธิภาพ ต่อเนื่อง และรองรับความต้องการที่เพิ่มขึ้น จึงได้จัดทำโครงการนี้เพื่อจัดหาตามระเบียบการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ`
        : `${agency} มีความประสงค์จะดำเนิน${name} เพื่อเพิ่มประสิทธิภาพการดำเนินงาน จึงว่าจ้างให้ดำเนินการตามขอบเขตของงานและคุณลักษณะเฉพาะที่กำหนดในเอกสารนี้`;
    case "objectives":
      return sub(OBJECTIVES[type]);
    case "qualifications":
      return sub(QUALIFICATIONS(agency));
    case "scope":
      return [
        `ผู้รับจ้างต้องดำเนินการ${name} ให้แล้วเสร็จครบถ้วนใช้งานได้ดี ประกอบด้วย`,
        sub(c.timeline.length ? c.timeline.map((p) => p.name) : ["จัดหาและส่งมอบตามคุณลักษณะเฉพาะ"]),
        `รายละเอียดอุปกรณ์และงานบริการเป็นไปตามข้อ ${sectionNumber(c.sector, "specs")} คุณลักษณะเฉพาะ`,
      ].join("\n");
    case "specs": {
      const out: string[] = [];
      let i = 0;
      for (const l of real) {
        if (l.kind === "GROUP") { out.push(`${out.length ? "\n" : ""}${l.name}`); continue; }
        i += 1;
        const own = String(l.details || (l.productId && c.productSpecs?.[l.productId]) || "").split(/\r?\n/);
        // รายละเอียดของรายการแปลงเป็นภาษาข้อกำหนด; ข้อความจากคลังสเปกเป็นประโยคข้อกำหนดอยู่แล้ว
        const details = Array.from(new Set([...own.map(specSentence), ...(c.specClauses?.[l.lineId] || []).map((x) => x.trim())].filter(Boolean)));
        out.push(`${n}.${i} ${l.name} จำนวน ${qtyText(l.qty)} ${l.unit}${details.length ? " มีคุณลักษณะดังนี้" : ""}`);
        details.forEach((d, j) => out.push(`    ${n}.${i}.${j + 1} ${d}`));
      }
      return out.join("\n") || "ยังไม่มีรายการ";
    }
    case "duration":
      return gov && c.stage !== "CONTRACTED"
        ? `ผู้รับจ้างต้องดำเนินการให้แล้วเสร็จและส่งมอบภายใน ${c.durationDays} วัน นับถัดจากวันลงนามในสัญญา`
        : `ระยะเวลาดำเนินการ ${c.durationDays} วัน ตั้งแต่วันที่ ${thaiDate(c.startDate)} ถึงวันที่ ${thaiDate(c.endDate)}`;
    case "criteria":
      return `การพิจารณาคัดเลือกข้อเสนอจะใช้เกณฑ์ราคา โดยพิจารณาจากราคารวมต่ำสุดของผู้ยื่นข้อเสนอที่มีคุณสมบัติและข้อเสนอทางเทคนิคถูกต้องครบถ้วนตามเงื่อนไขที่กำหนด`;
    case "budget":
      if (gov) {
        return [
          `วงเงินงบประมาณ ${fmt(c.budgetAmount)} บาท (${arabicToThaiBaht(c.budgetAmount)}) รวมภาษีมูลค่าเพิ่มและค่าใช้จ่ายทั้งปวง`,
          `แหล่งงบประมาณ: ${c.budgetSource || "-"} ปีงบประมาณ พ.ศ. ${c.fiscalYear}`,
          ...(c.referencePrice > 0 ? [`ราคากลาง ${fmt(c.referencePrice)} บาท (${arabicToThaiBaht(c.referencePrice)})`] : []),
        ].join("\n");
      }
      return `มูลค่าโครงการ ${fmt(c.budgetAmount)} บาท (${arabicToThaiBaht(c.budgetAmount)}) รวมภาษีมูลค่าเพิ่มแล้ว`;
    case "payment": {
      const paid = c.timeline.filter((p) => p.weight > 0);
      return paid.length
        ? paid.map((p, i) => `${n}.${i + 1} งวดที่ ${i + 1} เป็นเงินร้อยละ ${qtyText(p.weight)} ของวงเงินตามสัญญา (${fmt((c.budgetAmount * p.weight) / 100)} บาท) เมื่อผู้รับจ้างดำเนินการ${p.name}แล้วเสร็จ และคณะกรรมการตรวจรับพัสดุได้ตรวจรับเรียบร้อยแล้ว`).join("\n")
        : "ชำระเงินครั้งเดียวเมื่อผู้รับจ้างส่งมอบงานครบถ้วนและผ่านการตรวจรับแล้ว";
    }
    case "penalty":
      return isPurchase
        ? `หากผู้ขายส่งมอบพัสดุล่าช้ากว่ากำหนด ต้องชำระค่าปรับเป็นรายวันในอัตราร้อยละ 0.20 ของราคาพัสดุที่ยังไม่ได้รับมอบ นับถัดจากวันครบกำหนดส่งมอบจนถึงวันที่ส่งมอบถูกต้องครบถ้วน`
        : `หากผู้รับจ้างส่งมอบงานล่าช้ากว่ากำหนด ต้องชำระค่าปรับเป็นรายวันในอัตราร้อยละ 0.10 ของราคาค่าจ้างตามสัญญา แต่ไม่ต่ำกว่าวันละ 100 บาท นับถัดจากวันครบกำหนดจนถึงวันที่ทำงานแล้วเสร็จ`;
    case "warranty":
      return `ผู้รับจ้างต้องรับประกันความชำรุดบกพร่องของงานเป็นระยะเวลาไม่น้อยกว่า ${c.warrantyMonths} เดือน นับถัดจากวันที่ผู้ว่าจ้างได้รับมอบงาน หากเกิดความชำรุดบกพร่องภายในระยะเวลาดังกล่าว ผู้รับจ้างต้องซ่อมแซมแก้ไขให้ใช้การได้ดีดังเดิมภายใน 7 วัน นับถัดจากวันที่ได้รับแจ้ง โดยไม่คิดค่าใช้จ่ายใด ๆ`;
    case "reservation":
      return sub([
        `การจัดซื้อจัดจ้างครั้งนี้จะมีการลงนามในสัญญาต่อเมื่อ${agency}ได้รับอนุมัติเงินงบประมาณแล้ว`,
        `${agency}สงวนสิทธิ์ที่จะยกเลิกการจัดซื้อจัดจ้าง หรือไม่พิจารณาจัดซื้อจัดจ้างก็ได้ หากมีเหตุอันสมควรตามระเบียบ`,
        "ผู้รับจ้างต้องวางหลักประกันสัญญาเป็นจำนวนเงินเท่ากับร้อยละ 5 ของราคาค่าจ้างตามสัญญา",
        "การดำเนินการเป็นไปตามพระราชบัญญัติการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560 และระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560",
      ]);
    case "legal":
      return sub([
        "สัญญาเป็นไปตามประมวลกฎหมายแพ่งและพาณิชย์ ลักษณะซื้อขาย และจ้างทำของ",
        "ราคารวมภาษีมูลค่าเพิ่มร้อยละ 7 ผู้ว่าจ้างหักภาษีเงินได้ ณ ที่จ่ายค่าบริการร้อยละ 3 ตามประมวลรัษฎากร",
      ]);
  }
}

export function generateAllSections(c: DocContext): Record<DocSectionKey, string> {
  return Object.fromEntries(docSectionsFor(c.sector).map((s) => [s.key, generateSection(s.key, c)])) as Record<DocSectionKey, string>;
}

/** ข้อกำหนดที่ล็อกไว้ (บันทึกเป็นสำเนาในโครงการ) */
export function legalReferences(sector: Sector): string[] {
  return sector === "Government"
    ? [
        "พระราชบัญญัติการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560",
        "ระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560",
      ]
    : ["ประมวลกฎหมายแพ่งและพาณิชย์ ลักษณะซื้อขาย และจ้างทำของ", "ประมวลรัษฎากร"];
}
