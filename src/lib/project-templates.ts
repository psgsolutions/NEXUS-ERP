/**
 * ค่ากลางของโครงการ — ใช้ร่วมกันทั้งหน้าจอและ server
 *  - ขั้นของโครงการ (วางแผนก่อนจัดซื้อจัดจ้าง / ประกวดราคา / ได้งานแล้ว)
 *  - ข้อมูลภาครัฐ: วิธีจัดซื้อจัดจ้าง แหล่งงบประมาณ ปีงบประมาณ
 *  - ค่าใช้จ่ายดำเนินงานมาตรฐาน (ตั้งให้อัตโนมัติ แก้ไขได้)
 *  - แผนงาน/งวดงานตามรูปแบบงาน
 *  - หัวข้อรายละเอียดโครงการ (สร้างข้อความอัตโนมัติ แก้ไขได้)
 *  - ข้อกำหนดทางกฎหมาย (อ้างอิงอัตโนมัติ ไม่ต้องแก้ไข)
 *  - รูปแบบงานอัตโนมัติจากรายการสินค้า/บริการ
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
  { code: "PLANNING", label: "วางแผน / ก่อนจัดซื้อจัดจ้าง", hint: "ช่วยหน่วยงานวางแผน จัดทำงบประมาณและคุณลักษณะเฉพาะ (TOR)" },
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
  "งบประมาณรายจ่ายประจำปี",
  "เงินรายได้ของหน่วยงาน",
  "เงินอุดหนุน",
  "เงินกู้",
  "เงินนอกงบประมาณอื่น ๆ",
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
/** PCT_DIRECT = % ของต้นทุนตรง (สินค้า+ค่าแรง), PCT_PRICE = % ของราคาขาย, AMOUNT = จำนวนเงิน */
export type ExpenseBasis = "PCT_DIRECT" | "PCT_PRICE" | "AMOUNT";

export const EXPENSE_BASIS_TH: Record<ExpenseBasis, string> = {
  PCT_DIRECT: "% ต้นทุน",
  PCT_PRICE: "% ราคาขาย",
  AMOUNT: "จำนวนเงิน",
};

export interface ProjectExpense {
  id: string;
  key?: string; // รายการมาตรฐาน (RISK = เงินสำรองความเสี่ยง)
  name: string;
  basis: ExpenseBasis;
  value: number; // % หรือ บาท ตาม basis
}

export function defaultExpenses(sector: Sector): ProjectExpense[] {
  const list: Omit<ProjectExpense, "id">[] = [
    { key: "TRANSPORT", name: "ค่าขนส่งและยกย้ายอุปกรณ์", basis: "PCT_DIRECT", value: 1 },
    { key: "TRAVEL", name: "ค่าเดินทาง ที่พัก เบี้ยเลี้ยงทีมงาน", basis: "AMOUNT", value: 0 },
    { key: "OVERHEAD", name: "ค่าดำเนินงานและบริหารโครงการ", basis: "PCT_DIRECT", value: 5 },
    ...(sector === "Government"
      ? [{ key: "GUARANTEE", name: "ค่าธรรมเนียมหนังสือค้ำประกันสัญญา", basis: "PCT_PRICE" as const, value: 0.1 }]
      : []),
    { key: "RISK", name: "เงินสำรองความเสี่ยง", basis: "PCT_DIRECT", value: 5 },
  ];
  return list.map((e, i) => ({ ...e, id: `EXP-${e.key || i}` }));
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function expenseAmount(e: Pick<ProjectExpense, "basis" | "value">, directCost: number, price: number): number {
  const v = Math.max(0, num(e.value));
  if (e.basis === "AMOUNT") return r2(v);
  return r2((e.basis === "PCT_PRICE" ? price : directCost) * (v / 100));
}

export function normalizeExpenses(raw: any): ProjectExpense[] {
  return (Array.isArray(raw) ? raw : []).slice(0, 30)
    .map((e: any, i: number) => ({
      id: String(e?.id || `EXP-${i}`).slice(0, 40),
      ...(e?.key ? { key: String(e.key).slice(0, 20) } : {}),
      name: String(e?.name ?? "").trim().slice(0, 200),
      basis: (["PCT_DIRECT", "PCT_PRICE", "AMOUNT"].includes(e?.basis) ? e.basis : "AMOUNT") as ExpenseBasis,
      value: r2(Math.max(0, num(e?.value))),
    }))
    .filter((e) => e.name);
}

/**
 * ราคาขาย (ก่อน VAT) ที่ทำให้ได้กำไรสุทธิตามเป้า หลังหักต้นทุนตรงและค่าใช้จ่ายดำเนินงาน
 * price × (1 − margin − Σ%ราคา) = ต้นทุนตรง × (1 + Σ%ต้นทุน) + Σจำนวนเงิน
 */
export function priceForMargin(directCost: number, expenses: ProjectExpense[], marginPercent: number): number {
  const pd = expenses.filter((e) => e.basis === "PCT_DIRECT").reduce((s, e) => s + num(e.value), 0) / 100;
  const pp = expenses.filter((e) => e.basis === "PCT_PRICE").reduce((s, e) => s + num(e.value), 0) / 100;
  const fixed = expenses.filter((e) => e.basis === "AMOUNT").reduce((s, e) => s + num(e.value), 0);
  const denom = 1 - marginPercent / 100 - pp;
  if (denom <= 0) return 0;
  return r2((directCost * (1 + pd) + fixed) / denom);
}

// ---------------------------------------------------------------------------
// รูปแบบงานอัตโนมัติ
// ---------------------------------------------------------------------------
/** สินค้าอย่างเดียว = ซื้อขาย, บริการอย่างเดียว = ติดตั้ง (หรือคงบำรุงรักษาไว้), มีทั้งคู่ = ซื้อขายพร้อมติดตั้ง */
export function inferProjectType(lines: Pick<ProjectLine, "kind" | "name">[], current: ProjectTypeCode): ProjectTypeCode | null {
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

/** แผนงานเริ่มต้นตามรูปแบบงาน แบ่งช่วงเวลาตามสัดส่วนระหว่างวันเริ่ม-วันส่งมอบ */
export function defaultTimeline(typeCode: ProjectTypeCode, startDate: string, endDate: string): TimelinePhase[] {
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
  } else tpl = PHASES[typeCode];

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
// รายละเอียดโครงการ (เอกสาร)
// ---------------------------------------------------------------------------
export type DocSectionKey = "background" | "objectives" | "scope" | "budget" | "duration" | "specs" | "payment";

export const DOC_SECTIONS: { key: DocSectionKey; title: string; rows: number }[] = [
  { key: "background", title: "ความเป็นมา", rows: 4 },
  { key: "objectives", title: "วัตถุประสงค์", rows: 4 },
  { key: "scope", title: "ขอบเขตของงาน", rows: 5 },
  { key: "budget", title: "งบประมาณและแหล่งงบประมาณ", rows: 3 },
  { key: "duration", title: "ระยะเวลาดำเนินการ", rows: 2 },
  { key: "specs", title: "คุณลักษณะเฉพาะ", rows: 10 },
  { key: "payment", title: "การส่งมอบ การชำระเงิน และการรับประกัน", rows: 5 },
];

export interface DocContext {
  projectName: string;
  customerName: string;
  sector: Sector;
  typeCode: ProjectTypeCode;
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

export function generateSection(key: DocSectionKey, c: DocContext): string {
  const gov = c.sector === "Government";
  const customer = c.customerName || (gov ? "หน่วยงาน" : "ผู้ว่าจ้าง");
  const name = c.projectName || "โครงการ";
  const real = c.lines.filter((l) => l.name && !l.isOptional);
  switch (key) {
    case "background":
      return gov
        ? `ด้วย${customer} มีความจำเป็นต้องดำเนิน${name} เพื่อให้การปฏิบัติงานและการให้บริการเป็นไปอย่างมีประสิทธิภาพ ต่อเนื่อง และรองรับความต้องการที่เพิ่มขึ้น จึงได้จัดทำโครงการนี้เพื่อจัดหาตามระเบียบการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ`
        : `${customer} มีความประสงค์จะดำเนิน${name} เพื่อเพิ่มประสิทธิภาพการดำเนินงาน จึงว่าจ้างให้ดำเนินการตามขอบเขตของงานและคุณลักษณะเฉพาะที่กำหนดในเอกสารนี้`;
    case "objectives":
      return OBJECTIVES[c.typeCode].map((o, i) => `${i + 1}. ${o}`).join("\n");
    case "scope": {
      const phases = c.timeline.length ? c.timeline.map((p, i) => `${i + 1}. ${p.name}`) : [];
      return [
        `ผู้รับจ้างต้องดำเนินการ${name} ให้แล้วเสร็จครบถ้วน ประกอบด้วย`,
        ...phases,
        "รายละเอียดอุปกรณ์และงานบริการเป็นไปตามคุณลักษณะเฉพาะ",
      ].join("\n");
    }
    case "budget":
      if (gov) {
        const amt = c.budgetAmount;
        return [
          `วงเงินงบประมาณ ${fmt(amt)} บาท (${arabicToThaiBaht(amt)}) รวมภาษีมูลค่าเพิ่ม`,
          `แหล่งงบประมาณ: ${c.budgetSource || "-"} ประจำปีงบประมาณ พ.ศ. ${c.fiscalYear}`,
          ...(c.referencePrice > 0 ? [`ราคากลาง ${fmt(c.referencePrice)} บาท (${arabicToThaiBaht(c.referencePrice)})`] : []),
        ].join("\n");
      }
      return `มูลค่าโครงการ ${fmt(c.budgetAmount)} บาท (${arabicToThaiBaht(c.budgetAmount)}) รวมภาษีมูลค่าเพิ่มแล้ว`;
    case "duration":
      return gov && c.stage !== "CONTRACTED"
        ? `ระยะเวลาดำเนินการ ${c.durationDays} วัน นับถัดจากวันลงนามในสัญญา`
        : `ระยะเวลาดำเนินการ ${c.durationDays} วัน ตั้งแต่วันที่ ${thaiDate(c.startDate)} ถึงวันที่ ${thaiDate(c.endDate)}`;
    case "specs": {
      const out: string[] = [];
      let n = 0;
      for (const l of real) {
        if (l.kind === "GROUP") { out.push(`${out.length ? "\n" : ""}หมวด ${l.name}`); continue; }
        n += 1;
        out.push(`${n}. ${l.name} จำนวน ${qtyText(l.qty)} ${l.unit}`);
        String(l.details || "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
          .forEach((d) => out.push(`   - ${d.replace(/^[-•*]\s*/, "")}`));
      }
      return out.join("\n") || "ยังไม่มีรายการ";
    }
    case "payment": {
      const lines = c.timeline.filter((p) => p.weight > 0).map((p, i) =>
        `งวดที่ ${i + 1} ร้อยละ ${qtyText(p.weight)} ของวงเงิน (${fmt((c.budgetAmount * p.weight) / 100)} บาท) เมื่อ${p.name}แล้วเสร็จและผ่านการตรวจรับ`);
      return [
        ...(lines.length ? lines : ["ชำระเงินครั้งเดียวเมื่อส่งมอบงานครบถ้วนและผ่านการตรวจรับ"]),
        `รับประกันความชำรุดบกพร่องเป็นระยะเวลา ${c.warrantyMonths} เดือน นับถัดจากวันที่ตรวจรับงาน`,
      ].join("\n");
    }
  }
}

export function generateAllSections(c: DocContext): Record<DocSectionKey, string> {
  return Object.fromEntries(DOC_SECTIONS.map((s) => [s.key, generateSection(s.key, c)])) as Record<DocSectionKey, string>;
}

// ---------------------------------------------------------------------------
// ข้อกำหนดทางกฎหมาย (อ้างอิงอัตโนมัติ ไม่ต้องแก้ไข)
// ---------------------------------------------------------------------------
export function legalReferences(sector: Sector): string[] {
  return sector === "Government"
    ? [
        "พระราชบัญญัติการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560",
        "ระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560",
        "ผู้ยื่นข้อเสนอต้องลงทะเบียนในระบบจัดซื้อจัดจ้างภาครัฐด้วยอิเล็กทรอนิกส์ (e-GP)",
        "หลักประกันสัญญาร้อยละ 5 ของวงเงินตามสัญญา",
        "ค่าปรับกรณีส่งมอบล่าช้าเป็นรายวันตามอัตราที่กำหนดในสัญญา",
        "ส่วนราชการหักภาษีเงินได้ ณ ที่จ่ายร้อยละ 1 · ภาษีมูลค่าเพิ่มร้อยละ 7",
      ]
    : [
        "ประมวลกฎหมายแพ่งและพาณิชย์ ลักษณะซื้อขาย และจ้างทำของ",
        "ภาษีมูลค่าเพิ่มร้อยละ 7 · ภาษีเงินได้หัก ณ ที่จ่ายค่าบริการร้อยละ 3 (ประมวลรัษฎากร)",
      ];
}
