/**
 * แม่แบบแผนงานโครงการ (จาก nexus_project_template.yaml v0.1) — กรอกข้อมูลโครงการ (profile) ครั้งเดียว
 * ระบบสร้างรายการงาน ลำดับ ผู้รับผิดชอบ วันที่ จุดตรวจ และตรวจกฎ R1–R11 ให้
 *
 * ตัดสินใจ 2026-11-20:
 * - นับวันแบบวันปฏิทิน (สัญญาราชการ) เป็นค่าเริ่มต้น ปรับเป็นวันทำงาน (จ.–ศ.) ได้ต่อโครงการ
 * - งานของหน่วยงาน/กรรมการ = "รอหน่วยงาน" (ไม่มอบให้ผู้ใช้ในระบบ)
 * - ค่าที่แม่แบบยังไม่กำหนด (จุดต่อวัน เวลาสั่งของ เผื่อหน้าฝน งานใน modules) ใส่ค่าเริ่มต้นไว้ ปรับได้ภายหลัง
 * - โครงการเอกชน: ข้ามงาน TOR/ประกาศ/ยื่นซอง (P2.1 P2.2 P3.*) และคืนหลักประกันสัญญา
 * - วันเริ่มสัญญา (C) = วันเริ่มโครงการ · วันเริ่มประกัน (W) = วันถัดจากตรวจรับงวดสุดท้าย
 * ไม่ประเมินข้อความเป็นโค้ด: เงื่อนไข (when) และระยะเวลาเป็นรหัสที่กำหนดไว้ในไฟล์นี้
 */

export type SystemType = "cctv" | "access_control" | "intercom" | "network" | "datacenter_room" | "fire_alarm";
export const SYSTEM_TYPES: { code: SystemType; label: string }[] = [
  { code: "cctv", label: "กล้องวงจรปิด (CCTV)" },
  { code: "access_control", label: "ควบคุมการเข้าออก (Access Control)" },
  { code: "intercom", label: "อินเตอร์คอม" },
  { code: "network", label: "ระบบเครือข่าย (Network)" },
  { code: "datacenter_room", label: "ห้อง Data Center / Server" },
  { code: "fire_alarm", label: "ระบบแจ้งเหตุเพลิงไหม้" },
];
export type ProcurementKind = "purchase" | "rent" | "hire";
export const PROCUREMENT_KINDS: { code: ProcurementKind; label: string }[] = [
  { code: "purchase", label: "ซื้อ" }, { code: "rent", label: "เช่า" }, { code: "hire", label: "จ้างเหมา" },
];
export type PlanMethod = "e-bidding" | "e-market" | "specific" | "selection";
export type ControlRoom = "none" | "existing" | "new" | "tbd";
export const CONTROL_ROOMS: { code: ControlRoom; label: string }[] = [
  { code: "none", label: "ไม่มี" }, { code: "existing", label: "ใช้ห้องเดิม" }, { code: "new", label: "สร้างใหม่" }, { code: "tbd", label: "ยังไม่สรุป" },
];
export const CIVIL_WORKS: { code: string; label: string }[] = [
  { code: "poles", label: "ตั้งเสา" }, { code: "partition", label: "ผนังกั้นห้อง" }, { code: "underground_conduit", label: "ท่อร้อยสายใต้ดิน" },
];
export type DayMode = "calendar" | "working";

export interface PlanSite { name: string; env: "indoor" | "outdoor"; points: number }
/** progressPct = ผลงานสะสมที่ต้องถึงเพื่อเบิกงวดนี้ (จ้างเหมา) */
export interface PlanInstallment { no: number; dueDay: number; payPct: number; points: number; scope: string; progressPct?: number }
export interface PlanQuestion { text: string; neededByTask: string }
export interface PlanDefaults {
  pointsPerDay: number; leadTimeDays: number; clientDays: number; announcementDays: number; beforeContractDays: number;
  civilDays: number; rainBufferDays: number;
}
export interface PlanProfile {
  systems: SystemType[];
  procurement: ProcurementKind;
  sites: PlanSite[];
  legacySystem: string;
  controlRoom: ControlRoom;
  civilWork: string[];
  electricalWork: boolean;
  installments: PlanInstallment[];
  /** เช่า: ระยะเช่า (เดือน) นับจากตรวจรับ — วางบิลค่าเช่ารายเดือน · SLA แทนการรับประกัน */
  rent: { months: number };
  sla: { responseHours: number; fixHours: number; uptimePct: number };
  pmIntervalMonths: number;
  onsiteAdmin: { count: number; hours: string };
  training: { sessions: number; hoursEach: number };
  openQuestions: PlanQuestion[];
  dayMode: DayMode;
  defaults: PlanDefaults;
}
/** ปรับแผนเอง: แก้จำนวนวัน ข้ามงาน กำหนดวันเริ่มเอง และงานที่เพิ่มเอง */
export interface PlanOverride { days?: number; skip?: boolean; startAt?: string }
export interface CustomTask { id: string; name: string; phase: number; after: string[]; days: number; owner: OwnerKey }
export interface PlanOverrides { tasks: Record<string, PlanOverride>; custom: CustomTask[] }

export const DEFAULT_PLAN_DEFAULTS: PlanDefaults = {
  pointsPerDay: 8, leadTimeDays: 30, clientDays: 30, announcementDays: 20, beforeContractDays: 7, civilDays: 10, rainBufferDays: 7,
};

/** ข้อมูลโครงการที่แผนใช้ (มาจากหน้าสร้างโครงการ) */
export interface PlanContext {
  sector: "Government" | "Private";
  contracted: boolean;          // ได้งาน/ลงนามแล้ว → ไม่วางแผนช่วงก่อนสัญญา
  method: PlanMethod;
  planStart: string;            // วันเริ่มวางแผน (ช่วงก่อนสัญญา)
  contractStart: string;        // C
  durationDays: number;
  warrantyMonths: number;
  installable: boolean;         // งานติดตั้ง (รูปแบบ 3/4) — ซื้อขายอย่างเดียว/บำรุงรักษา ไม่มีงานติดตั้ง
}

// ---------------------------------------------------------------------------
// ผู้รับผิดชอบ
// ---------------------------------------------------------------------------
export type OwnerKey = "designer" | "sales" | "pm" | "install" | "engineer" | "electrical" | "purchasing" | "client" | "committee" | "service" | "admin" | "accounting";
export const OWNERS: Record<OwnerKey, { label: string; role?: string; external?: boolean }> = {
  designer: { label: "ผู้ออกแบบ (วิศวกร)", role: "ENGINEER" },
  sales: { label: "ฝ่ายขาย", role: "SALES" },
  pm: { label: "ผู้จัดการโครงการ", role: "ENGINEER" },
  install: { label: "ทีมติดตั้ง/ช่าง", role: "TECHNICIAN" },
  engineer: { label: "วิศวกร", role: "ENGINEER" },
  electrical: { label: "วิศวกรไฟฟ้า", role: "ENGINEER" },
  purchasing: { label: "จัดซื้อ", role: "PURCHASING" },
  client: { label: "รอหน่วยงาน", external: true },
  committee: { label: "รอหน่วยงาน (กรรมการตรวจรับ)", external: true },
  service: { label: "ทีมบริการ", role: "TECHNICIAN" },
  admin: { label: "Admin ประจำหน้างาน", role: "TECHNICIAN" },
  accounting: { label: "บัญชี", role: "ACCOUNTANT" },
};

export const PHASE_LABELS: Record<number, string> = {
  1: "สำรวจและออกแบบ", 2: "TOR และราคากลาง", 3: "ประกาศและทำสัญญา", 4: "เตรียมงานหลังลงนาม",
  5: "ติดตั้งตามงวด", 6: "ทดสอบและส่งมอบ", 7: "ระยะประกัน",
};

// ---------------------------------------------------------------------------
// คลังงาน (library) — เงื่อนไขและระยะเวลาเป็นรหัส
// ---------------------------------------------------------------------------
type Cond = "always" | "legacy" | "outdoor" | "controlRoom" | "electrical" | "eBidding" | "purchaseOrRent" | "civilOrOutdoor" | "training" | "warranty" | "onsiteAdmin" | "gov";
type Dur = number | "client" | "announcement" | "before_contract" | "lead_time";
/** จุดอ้างอิงวันที่: C+days · C+ระยะสัญญา (duration) · W+days · W+ระยะประกัน (warrantyEnd) */
type Anchor = { at: "C" | "W"; days?: number; duration?: boolean; warrantyEnd?: boolean };
interface TaskTpl {
  id: string; name: string; phase: number; when?: Cond[]; after?: string[]; days?: Dur;
  start?: Anchor; deadline?: Anchor; owner: OwnerKey; gate?: string; checks?: string[]; designDependent?: boolean;
}

const LIB: TaskTpl[] = [
  { id: "P1.1", name: "รับความต้องการ กำหนดขอบเขต", phase: 1, days: 3, owner: "designer" },
  { id: "P1.2", name: "สำรวจหน้างาน", phase: 1, after: ["P1.1"], days: 5, owner: "designer" },
  { id: "P1.3", name: "สำรวจระบบเดิม", phase: 1, when: ["legacy"], after: ["P1.1"], days: 3, owner: "designer" },
  { id: "P1.4", name: "กำหนดจุดบนแบบ นับจำนวน", phase: 1, after: ["P1.2"], days: 7, owner: "designer" },
  { id: "P1.5", name: "วัดแนวสาย เสา ตู้ (+20%)", phase: 1, when: ["outdoor"], after: ["P1.4"], days: 3, owner: "designer" },
  { id: "P1.6", name: "ออกแบบ Diagram", phase: 1, after: ["P1.4"], days: 3, owner: "designer" },
  { id: "P1.7", name: "ออกแบบห้องควบคุม", phase: 1, when: ["controlRoom"], after: ["P1.4"], days: 5, owner: "designer" },
  { id: "P1.8", name: "รวบรวม Datasheet", phase: 1, after: ["P1.6"], days: 5, owner: "designer" },
  { id: "P2.1", name: "เขียน TOR", phase: 2, when: ["gov"], after: ["P1.8"], days: 10, owner: "designer" },
  { id: "P2.2", name: "เทียบสเป็กกับ Datasheet/DE", phase: 2, when: ["gov"], after: ["P2.1"], days: 3, owner: "designer", checks: ["R3"] },
  { id: "P2.3", name: "ต้นทุนและราคากลาง", phase: 2, after: ["P2.1", "P1.8"], days: 5, owner: "sales", checks: ["R11"] },
  { id: "P2.4", name: "แผนปฏิบัติการ", phase: 2, after: ["P2.1", "P1.8"], days: 2, owner: "designer", checks: ["R1", "R2", "R6", "R8"] },
  { id: "P3.1", name: "อนุมัติ TOR ประกาศ", phase: 3, when: ["gov"], after: ["P2.4"], days: "client", owner: "client" },
  { id: "P3.2", name: "เอกสารยื่น หลักประกันซอง", phase: 3, when: ["gov", "eBidding"], after: ["P3.1"], days: "announcement", owner: "sales" },
  { id: "P3.3", name: "หลักประกันสัญญา หนังสืออะไหล่ PDPA", phase: 3, when: ["gov"], after: ["P3.1"], days: "before_contract", owner: "sales", gate: "CONTRACT" },
  { id: "P4.1", name: "Kick-off", phase: 4, start: { at: "C", days: 1 }, days: 3, owner: "pm" },
  { id: "P4.2", name: "สำรวจยืนยันจุด", phase: 4, after: ["P4.1"], days: 9, owner: "install" },
  { id: "P4.3", name: "สำรอง Config ระบบเดิม", phase: 4, when: ["legacy"], after: ["P4.1"], days: 3, owner: "engineer", checks: ["R5"] },
  { id: "P4.4", name: "Shop Drawing แผน IP แผนทดสอบ", phase: 4, after: ["P4.2"], deadline: { at: "C", days: 15 }, owner: "engineer" },
  { id: "P4.5", name: "แบบไฟฟ้า กว.", phase: 4, when: ["electrical"], after: ["P4.2"], deadline: { at: "C", days: 15 }, owner: "electrical" },
  { id: "P4.6", name: "อนุมัติแบบ", phase: 4, after: ["P4.4", "P4.5"], days: 7, owner: "client", gate: "DESIGN_APPROVED" },
  { id: "P4.7", name: "แจ้งทีมงาน ใบรับรอง Admin", phase: 4, after: ["P4.1"], days: 3, owner: "pm" },
  { id: "P4.8", name: "สั่งอุปกรณ์มาตรฐาน", phase: 4, when: ["purchaseOrRent"], start: { at: "C", days: 1 }, days: "lead_time", owner: "purchasing", checks: ["R7"] },
  { id: "P4.9", name: "สั่งของที่ขึ้นกับแบบ", phase: 4, when: ["civilOrOutdoor"], after: ["DESIGN_APPROVED"], days: "lead_time", owner: "purchasing", designDependent: true },
  { id: "P4.10", name: "ยืนยันห้อง Server/ห้องควบคุมพร้อม", phase: 4, when: ["controlRoom"], after: ["DESIGN_APPROVED"], days: 1, owner: "client" },
  // P5 สร้างต่อจากงวดงาน (ดู expandInstallments)
  { id: "P6.1", name: "ทดสอบสาย UTP/ไฟเบอร์", phase: 6, after: ["P5.*.cabling"], days: 8, owner: "engineer" },
  { id: "P6.2", name: "ทดสอบทั้งระบบ", phase: 6, after: ["P6.1", "P5.*.devices"], days: 8, owner: "engineer", checks: ["R6"] },
  { id: "P6.3", name: "ฝึกอบรม", phase: 6, when: ["training"], after: ["P6.2"], days: 2, owner: "engineer" },
  { id: "P6.4", name: "เอกสารส่งมอบ", phase: 6, after: ["P6.2"], days: 6, owner: "pm" },
  { id: "P6.5", name: "ตรวจรับงวดสุดท้าย", phase: 6, after: ["P6.2", "P6.3", "P6.4"], days: 5, deadline: { at: "C", duration: true }, owner: "committee", gate: "WARRANTY_START" },
  { id: "P7.1", name: "ส่งแผน PM", phase: 7, when: ["warranty"], start: { at: "W" }, days: 5, deadline: { at: "W", days: 30 }, owner: "pm" },
  // P7.2 PM รอบที่ n / P7.3 รายงาน Admin สร้างตามรอบ (ดู expandWarranty)
  { id: "P7.4", name: "คืนหลักประกันสัญญา", phase: 7, when: ["gov"], start: { at: "W", warrantyEnd: true }, days: 1, owner: "accounting" },
];

/** งานเฉพาะระบบ (modules) — ค่าเริ่มต้น ปรับภายหลังได้ */
const MODULES: Record<SystemType, TaskTpl[]> = {
  cctv: [
    { id: "M.cctv.storage", name: "คำนวณพื้นที่จัดเก็บภาพ", phase: 1, after: ["P1.4"], days: 2, owner: "designer" },
    { id: "M.cctv.vms", name: "จัดหา/ลงทะเบียน License VMS", phase: 4, after: ["DESIGN_APPROVED"], days: 5, owner: "purchasing", designDependent: true },
    { id: "M.cctv.ai", name: "ตั้งค่า AI / Analytics", phase: 6, after: ["P6.1"], days: 3, owner: "engineer" },
    { id: "M.cctv.aiming", name: "ปรับมุมกล้อง", phase: 6, after: ["P6.1"], days: 3, owner: "install" },
  ],
  access_control: [
    { id: "M.ac.door", name: "สำรวจประตูและอุปกรณ์ล็อก", phase: 1, after: ["P1.2"], days: 2, owner: "designer" },
    { id: "M.ac.fire", name: "เชื่อมปลดล็อกกับระบบแจ้งเหตุเพลิงไหม้", phase: 6, after: ["P6.1"], days: 2, owner: "electrical" },
    { id: "M.ac.enrol", name: "ลงทะเบียนบัตร/ใบหน้า", phase: 6, after: ["P6.2"], days: 5, owner: "engineer" },
  ],
  intercom: [{ id: "M.ic.callplan", name: "ออกแบบผังการโทร", phase: 1, after: ["P1.6"], days: 2, owner: "designer" }],
  network: [
    { id: "M.net.vlan", name: "ออกแบบ VLAN / IP", phase: 1, after: ["P1.6"], days: 3, owner: "designer" },
    { id: "M.net.test", name: "ทดสอบ Throughput / Failover", phase: 6, after: ["P6.1"], days: 3, owner: "engineer" },
  ],
  datacenter_room: [
    { id: "M.dc.partition", name: "ผนังกั้นห้อง Data Center", phase: 5, after: ["DESIGN_APPROVED"], days: 10, owner: "install", designDependent: true },
    { id: "M.dc.floor", name: "พื้นยก (Raised floor)", phase: 5, after: ["M.dc.partition"], days: 7, owner: "install", designDependent: true },
    { id: "M.dc.electrical", name: "ระบบไฟฟ้าห้อง Data Center", phase: 5, after: ["M.dc.partition"], days: 7, owner: "electrical", designDependent: true },
    { id: "M.dc.ac", name: "เครื่องปรับอากาศ Precision", phase: 5, after: ["M.dc.floor"], days: 5, owner: "install", designDependent: true },
    { id: "M.dc.fire", name: "ระบบดับเพลิงอัตโนมัติ", phase: 5, after: ["M.dc.ac"], days: 5, owner: "install", designDependent: true },
  ],
  fire_alarm: [],
};

// ---------------------------------------------------------------------------
// วันที่
// ---------------------------------------------------------------------------
const DAY = 86400e3;
const toMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
const fmt = (t: number) => new Date(t).toISOString().slice(0, 10);
const isDate = (v: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) && Number.isFinite(toMs(String(v)));
const weekend = (t: number) => { const w = new Date(t).getUTCDay(); return w === 0 || w === 6; };

export function addDays(date: string, days: number, mode: DayMode = "calendar"): string {
  let t = toMs(date);
  if (mode === "calendar") return fmt(t + days * DAY);
  const step = days >= 0 ? 1 : -1;
  let left = Math.abs(days);
  while (left > 0) { t += step * DAY; if (!weekend(t)) left--; }
  return fmt(t);
}
export function addMonths(date: string, months: number): string {
  const d = new Date(toMs(date));
  const day = d.getUTCDate();
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return fmt(d.getTime());
}
/** วันทำงานแรกตั้งแต่วันนี้ (โหมดวันทำงาน) */
const firstDay = (date: string, mode: DayMode) => { let t = toMs(date); if (mode === "working") while (weekend(t)) t += DAY; return fmt(t); };
/** วันสิ้นสุดของงานที่เริ่ม start ใช้ days วัน (นับวันเริ่มด้วย) */
const endOf = (start: string, days: number, mode: DayMode) => (days <= 1 ? start : addDays(start, days - 1, mode));
export const daysBetween = (a: string, b: string) => Math.round((toMs(b) - toMs(a)) / DAY);

// ---------------------------------------------------------------------------
// ผลลัพธ์
// ---------------------------------------------------------------------------
export interface PlanTask {
  id: string; name: string; phase: number; owner: OwnerKey; ownerLabel: string; external: boolean;
  start: string; end: string; days: number; after: string[]; deps?: string[]; gate?: string; checks?: string[];
  deadline?: string; late?: boolean; skipped?: boolean; custom?: boolean; recurring?: boolean; designDependent?: boolean;
  installment?: number; rainBuffer?: boolean;
}
export interface PlanResult { tasks: PlanTask[]; contractStart: string; warrantyStart: string; warrantyEnd: string; preContractEnd: string }

const totalPoints = (p: PlanProfile) => p.sites.reduce((s, x) => s + (Number(x.points) || 0), 0);
const hasOutdoor = (p: PlanProfile) => p.sites.some((s) => s.env === "outdoor");

function condOk(conds: Cond[] | undefined, p: PlanProfile, c: PlanContext): boolean {
  return (conds || ["always"]).every((k) => {
    switch (k) {
      case "always": return true;
      case "legacy": return !!p.legacySystem.trim();
      case "outdoor": return hasOutdoor(p);
      case "controlRoom": return p.controlRoom !== "none";
      case "electrical": return p.electricalWork;
      case "eBidding": return c.method === "e-bidding";
      case "purchaseOrRent": return p.procurement === "purchase" || p.procurement === "rent";
      case "civilOrOutdoor": return p.civilWork.length > 0 || hasOutdoor(p);
      case "training": return p.training.sessions > 0;
      case "warranty": return c.warrantyMonths > 0;
      case "onsiteAdmin": return p.onsiteAdmin.count > 0;
      case "gov": return c.sector === "Government";
    }
  });
}

function durOf(d: Dur | undefined, p: PlanProfile): number {
  if (typeof d === "number") return d;
  const x = p.defaults;
  switch (d) {
    case "client": return x.clientDays;
    case "announcement": return x.announcementDays;
    case "before_contract": return x.beforeContractDays;
    case "lead_time": return x.leadTimeDays;
    default: return 1;
  }
}
const rainy = (date: string) => { const m = Number(date.slice(5, 7)); return m >= 5 && m <= 10; };

/** สร้างแผนงานจากข้อมูลโครงการ + การปรับแผนเอง */
export function generatePlan(p: PlanProfile, c0: PlanContext, ov: PlanOverrides = { tasks: {}, custom: [] }, tpl: TemplateConfig = EMPTY_TEMPLATE): PlanResult {
  // เช่า: ระยะเช่าแทนระยะประกัน (SLA/PM รื้อถอน วางบิลรายเดือน นับจากตรวจรับ)
  const c: PlanContext = p.procurement === "rent" ? { ...c0, warrantyMonths: Math.max(0, p.rent.months) } : c0;
  const mode = p.dayMode;
  const C = c.contractStart;
  const tpls: TaskTpl[] = [];
  const pre = (t: TaskTpl) => t.phase <= 3;

  // คลังงาน + งานเฉพาะระบบ + ปรับตามรูปแบบจัดซื้อ
  const apply = (t: TaskTpl): TaskTpl | null => {
    const o = tpl.tasks[t.id];
    if (!o) return t;
    if (o.disabled) return null;
    return { ...t, ...(o.name ? { name: o.name } : {}), ...(o.days && typeof t.days === "number" ? { days: o.days } : {}), ...(o.owner ? { owner: o.owner } : {}) };
  };
  for (const t0 of LIB) {
    const t = apply(t0);
    if (!t) continue;
    if (pre(t) && c.contracted) continue;
    if (!c.installable && (t.id === "P4.9" || t.id === "P6.1")) continue;
    if (t.id === "P3.2" && (c.method === "specific" || c.method === "e-market")) continue;
    if (condOk(t.when, p, c)) tpls.push(t);
  }
  for (const s of p.systems) for (const t0 of MODULES[s] || []) { const t = apply(t0); if (t && !(pre(t) && c.contracted) && (c.installable || t.phase !== 5)) tpls.push(t); }
  // งานที่บริษัทเพิ่มในแม่แบบ (ตั้งค่า › แม่แบบโครงการ)
  const known = new Set([...LIB.map((t) => t.id), ...Object.values(MODULES).flat().map((t) => t.id)]);
  for (const x of tpl.extra) {
    if (known.has(x.id) || (x.systems?.length && !x.systems.some((sy) => p.systems.includes(sy)))) continue;
    if (x.phase <= 3 && c.contracted) continue;
    if (x.when === "gov" && c.sector !== "Government") continue;
    tpls.push({ id: x.id, name: x.name, phase: x.phase, after: x.after, days: x.days, owner: x.owner });
  }
  if (p.procurement === "rent") tpls.push({ id: "X.rent.removal", name: "รื้อถอนอุปกรณ์เมื่อสิ้นสุดสัญญาเช่า", phase: 7, start: { at: "W", warrantyEnd: true }, days: 5, owner: "install" });
  for (const t of ov.custom || []) tpls.push({ id: t.id, name: t.name, phase: t.phase, after: t.after, days: t.days, owner: t.owner });

  // งวดติดตั้ง (P5.n.*)
  const inst = c.installable ? p.installments : [];
  const pointsPerInst = (i: number) => {
    const v = Number(inst[i]?.points) || 0;
    if (v > 0) return v;
    const tp = totalPoints(p);
    return tp > 0 && inst.length ? Math.ceil(tp / inst.length) : p.defaults.pointsPerDay * 5;
  };
  inst.forEach((it, i) => {
    const n = i + 1, pts = pointsPerInst(i), cab = Math.max(1, Math.ceil(pts / Math.max(1, p.defaults.pointsPerDay)));
    const prev = n > 1 ? [`P5.${n - 1}.cabling`] : [];
    const label = `งวด ${n}`;
    tpls.push({ id: `P5.${n}.cabling`, name: `${label}: เดินสาย (${pts} จุด)`, phase: 5, after: ["DESIGN_APPROVED", ...prev], days: cab, owner: "install", designDependent: true });
    if (n === 1 && (hasOutdoor(p) || p.civilWork.length)) {
      tpls.push({ id: `P5.1.civil`, name: `${label}: งานโยธา/นอกอาคาร`, phase: 5, after: ["DESIGN_APPROVED"], days: p.defaults.civilDays, owner: "install", designDependent: true });
    }
    tpls.push({ id: `P5.${n}.rack`, name: `${label}: ตู้ Rack ไฟฟ้า Switch`, phase: 5, after: [`P5.${n}.cabling`], days: 2, owner: "install" });
    tpls.push({ id: `P5.${n}.devices`, name: `${label}: ติดตั้งอุปกรณ์`, phase: 5, after: [`P5.${n}.rack`], days: Math.max(1, Math.ceil(pts / (Math.max(1, p.defaults.pointsPerDay) * 2))), owner: "install" });
    tpls.push({ id: `P5.${n}.config`, name: `${label}: ตั้งค่าและทดสอบ`, phase: 5, after: [`P5.${n}.devices`], days: 5, owner: "engineer" });
    tpls.push({ id: `P5.${n}.handover`, name: `${label}: ส่งมอบ/ตรวจรับงวด ${n}`, phase: 5, after: [`P5.${n}.config`], days: 1, owner: "committee", gate: "INSTALLMENT_ACCEPTED", deadline: { at: "C", days: Number(it.dueDay) || 0 } });
  });

  // ---- คำนวณวันที่ (ตามลำดับ: งานที่ทุกงานก่อนหน้าคิดแล้ว) ----
  const out = new Map<string, PlanTask>();
  const gateOf = new Map<string, string>(); // gate → task id
  for (const t of tpls) if (t.gate) gateOf.set(t.gate, t.id);
  const resolve = (ref: string): string[] => {
    if (gateOf.has(ref)) return [gateOf.get(ref)!];
    if (ref.includes("*")) { const re = new RegExp(`^${ref.replace(/\./g, "\\.").replace("*", "\\d+")}$`); return tpls.filter((t) => re.test(t.id)).map((t) => t.id); }
    return tpls.some((t) => t.id === ref) ? [ref] : [];
  };
  const preStart = firstDay(c.planStart || C, mode);
  let W = "";
  const anchorDate = (a: Anchor): string => {
    const base = a.at === "C" ? C : W;
    if (!base) return "";
    if (a.duration) return addDays(base, Math.max(0, c.durationDays - 1), "calendar");
    if (a.warrantyEnd) return addMonths(base, c.warrantyMonths);
    return a.days ? addDays(base, a.days, "calendar") : base;
  };

  const pending = [...tpls];
  let guard = 0;
  while (pending.length && guard++ < 2000) {
    const idx = pending.findIndex((t) => (t.after || []).flatMap(resolve).every((id) => out.has(id)) && (!t.start || t.start.at !== "W" || W) && (!t.deadline || t.deadline.at !== "W" || W));
    if (idx < 0) break; // วนกัน — ไม่ควรเกิดกับคลังงานนี้
    const t = pending.splice(idx, 1)[0];
    const o = ov.tasks?.[t.id] || {};
    const deps = (t.after || []).flatMap(resolve).map((id) => out.get(id)!).filter((d) => !d.skipped);
    let start = t.start ? anchorDate(t.start) : pre(t) ? preStart : C;
    for (const d of deps) { const nx = addDays(d.end, 1, mode); if (nx > start) start = nx; }
    if (!pre(t) && start < C) start = C;
    if (isDate(o.startAt)) start = o.startAt!;
    start = firstDay(start, mode);
    const deadline = t.deadline ? anchorDate(t.deadline) : "";
    let days = o.days !== undefined && o.days > 0 ? Math.round(o.days) : t.days !== undefined ? durOf(t.days, p) : 0;
    let rainBuffer = false;
    if (t.id === "P5.1.civil" && p.defaults.rainBufferDays > 0 && o.days === undefined && (rainy(start) || rainy(endOf(start, Math.max(1, days), mode)))) { days += p.defaults.rainBufferDays; rainBuffer = true; }
    let end = days > 0 ? endOf(start, days, mode) : (deadline && deadline >= start ? deadline : start);
    if (!days) days = daysBetween(start, end) + 1;
    const owner = OWNERS[t.owner];
    const task: PlanTask = {
      id: t.id, name: t.name, phase: t.phase, owner: t.owner, ownerLabel: owner.label, external: !!owner.external,
      start, end, days, after: t.after || [], deps: (t.after || []).flatMap(resolve), ...(t.gate ? { gate: t.gate } : {}), ...(t.checks ? { checks: t.checks } : {}),
      ...(deadline ? { deadline, late: end > deadline } : {}), ...(o.skip ? { skipped: true } : {}),
      ...(t.designDependent ? { designDependent: true } : {}), ...(ov.custom?.some((x) => x.id === t.id) ? { custom: true } : {}),
      ...(t.id.startsWith("P5.") ? { installment: Number(t.id.split(".")[1]) } : {}), ...(rainBuffer ? { rainBuffer: true } : {}),
    };
    if (o.skip) { task.end = task.start; }
    out.set(t.id, task);
    if (t.gate === "WARRANTY_START") W = addDays(task.end, 1, "calendar");
  }
  if (!W) W = addDays(C, Math.max(0, c.durationDays), "calendar");
  const warrantyEnd = c.warrantyMonths > 0 ? addMonths(W, c.warrantyMonths) : W;

  // ---- ระยะประกัน: PM ตามรอบ / รายงาน Admin / รายงานผู้ควบคุมงาน (จ้างเหมา) / วางบิลค่าเช่า ----
  const extra: PlanTask[] = [];
  const mk = (id: string, name: string, owner: OwnerKey, start: string, end: string, more: Partial<PlanTask> = {}): PlanTask => {
    const o = ov.tasks?.[id] || {};
    return { id, name, phase: 7, owner, ownerLabel: OWNERS[owner].label, external: !!OWNERS[owner].external, start, end, days: daysBetween(start, end) + 1, after: [], ...(o.skip ? { skipped: true } : {}), ...more };
  };
  if (c.warrantyMonths > 0) {
    const every = Math.max(1, Math.round(p.pmIntervalMonths) || 6);
    const label = p.procurement === "rent" ? "บริการตาม SLA" : "PM";
    for (let k = 1; k * every <= c.warrantyMonths; k++) {
      const d = addMonths(W, k * every);
      extra.push(mk(`P7.2.${k}`, `${label} รอบที่ ${k}`, "service", d, d, { recurring: true }));
    }
    if (p.onsiteAdmin.count > 0) extra.push(mk("P7.3", `รายงาน Admin ประจำเดือน (${c.warrantyMonths} ครั้ง)`, "admin", addMonths(W, 1), warrantyEnd, { recurring: true }));
  }
  // เช่า: วางบิลค่าเช่าทุกเดือน (เดือนที่ k = สิ้นเดือนเช่าที่ k) · จ้างเหมา: รายงานผู้ควบคุมงานทุกเดือนระหว่างสัญญา
  if (p.procurement === "rent") for (let k = 1; k <= c.warrantyMonths; k++) {
    const d = addDays(addMonths(W, k), -1, "calendar");
    extra.push({ ...mk(`X.rent.bill.${k}`, `วางบิลค่าเช่าเดือนที่ ${k}`, "accounting", d, d, { recurring: true }), phase: 7 });
  }
  if (p.procurement === "hire") {
    const last = addDays(C, Math.max(0, c.durationDays - 1), "calendar");
    for (let k = 1; addMonths(C, k) <= last && k <= 36; k++) { const d = addMonths(C, k); extra.push({ ...mk(`X.hire.report.${k}`, `รายงานผู้ควบคุมงานเดือนที่ ${k}`, "pm", d, d, { recurring: true }), phase: 5 }); }
  }

  const tasks = [...out.values(), ...extra].sort((a, b) => a.phase - b.phase || (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  const preTasks = tasks.filter((t) => t.phase <= 3 && !t.skipped);
  return { tasks, contractStart: C, warrantyStart: W, warrantyEnd, preContractEnd: preTasks.length ? preTasks.reduce((m, t) => (t.end > m ? t.end : m), "") : "" };
}

// ---------------------------------------------------------------------------
// กฎตรวจแผน R1–R11
// ---------------------------------------------------------------------------
export type RuleLevel = "stop" | "warn";
export interface RuleResult { id: string; level: RuleLevel; message: string }
/** ระดับเริ่มต้น — R3 (datasheet) และ R11 (ต้นทุน PM/Admin) เป็น "เตือน" ไว้ก่อน เพราะข้อมูลเดิมยังไม่ครบ */
export const RULE_LEVELS: Record<string, RuleLevel> = { R12: "warn", R13: "warn", R1: "stop", R2: "stop", R3: "warn", R4: "stop", R5: "stop", R6: "warn", R7: "warn", R8: "stop", R9: "warn", R10: "warn", R11: "warn", LATE: "warn", PRE: "warn" };
export interface RuleInputs { boqPoints?: number | null; missingDatasheets?: string[]; hasPmCost?: boolean; hasAdminCost?: boolean }

export function checkPlan(p: PlanProfile, c0: PlanContext, plan: PlanResult, x: RuleInputs = {}): RuleResult[] {
  const c: PlanContext = p.procurement === "rent" ? { ...c0, warrantyMonths: Math.max(0, p.rent.months) } : c0;
  const out: RuleResult[] = [];
  const add = (id: string, message: string) => out.push({ id, level: RULE_LEVELS[id] || "warn", message });
  const live = plan.tasks.filter((t) => !t.skipped);
  const get = (id: string) => live.find((t) => t.id === id);
  const instPts = p.installments.reduce((s, i) => s + (Number(i.points) || 0), 0);
  const sitePts = totalPoints(p);

  // เทียบเฉพาะค่าที่กรอกแล้ว (ยังไม่กรอกจุดในงวด/พื้นที่ = ยังไม่ตรวจ)
  if (c.installable && (instPts > 0 || sitePts > 0)) {
    const vals = ([["งวดงาน", instPts], ["พื้นที่ติดตั้ง", sitePts], ["BOQ (หน่วย จุด)", x.boqPoints || 0]] as [string, number][]).filter((v) => v[1] > 0);
    if (new Set(vals.map((v) => v[1])).size > 1) add("R1", `จำนวนจุดไม่ตรงกัน: ${vals.map(([k, v]) => `${k} ${v}`).join(" · ")}`);
  }
  const pct = Math.round(p.installments.reduce((s, i) => s + (Number(i.payPct) || 0), 0) * 100) / 100;
  if (p.procurement === "rent" && p.rent.months > 0) {
    if (pct > 100) add("R2", `งวดติดตั้งรวม ${pct}% เกิน 100% (ส่วนที่เหลือเป็นค่าเช่ารายเดือน)`);
  } else if (p.installments.length && pct !== 100) add("R2", `งวดเงินรวม ${pct}% ต้องเท่ากับ 100%`);
  if (p.procurement === "rent" && !(p.rent.months > 0)) add("R13", "สัญญาเช่ายังไม่ระบุระยะเช่า (เดือน)");
  if (p.procurement === "rent" && (!(p.sla.responseHours > 0) || !(p.sla.fixHours > 0))) add("R13", "สัญญาเช่ายังไม่กำหนด SLA (เวลาตอบสนอง/แก้ไข)");
  if (p.procurement === "hire" && p.installments.length) {
    const prog = p.installments.map((i) => Number(i.progressPct) || 0);
    if (prog.some((v, i) => i > 0 && v <= prog[i - 1]) || prog[prog.length - 1] !== 100) add("R12", `จ้างเหมา: ผลงานสะสมของงวดต้องเพิ่มขึ้นทุกงวดและงวดสุดท้าย = 100% (ตอนนี้ ${prog.join("/")}%)`);
  }
  if (x.missingDatasheets?.length) add("R3", `สเปกยังไม่มี Datasheet ${x.missingDatasheets.length} รายการ: ${x.missingDatasheets.slice(0, 3).join(", ")}${x.missingDatasheets.length > 3 ? " …" : ""}`);
  const approved = get("P4.6");
  if (approved) for (const t of live.filter((t) => t.designDependent && t.start <= approved.end)) add("R4", `"${t.name}" เริ่มก่อนอนุมัติแบบ (${approved.end})`);
  if (p.legacySystem.trim()) {
    const backup = get("P4.3"), first = get("P5.1.cabling");
    if (!backup) add("R5", `มีระบบเดิม (${p.legacySystem}) แต่ไม่มีงานสำรอง Config ระบบเดิม`);
    else if (first && backup.end >= first.start) add("R5", "ต้องสำรอง Config ระบบเดิมให้เสร็จก่อนเริ่มเดินสาย/เชื่อมระบบเดิม");
  }
  const test = get("P6.2");
  const lastDue = p.installments.length ? addDays(c.contractStart, Math.max(...p.installments.map((i) => Number(i.dueDay) || 0)), "calendar") : "";
  if (test && lastDue && daysBetween(test.start, lastDue) < 15) add("R6", `เริ่มทดสอบทั้งระบบ ${test.start} ห่างวันครบกำหนดงวดสุดท้าย ${lastDue} น้อยกว่า 15 วัน`);
  const firstCab = live.filter((t) => t.id.endsWith(".cabling")).sort((a, b) => (a.start < b.start ? -1 : 1))[0];
  for (const id of ["P4.8", "P4.9"]) { const t = get(id); if (t && firstCab && t.end >= firstCab.start) add("R7", `"${t.name}" ของถึง ${t.end} หลังเริ่มติดตั้ง ${firstCab.start}`); }
  if (c.warrantyMonths > 0) {
    const pm = plan.tasks.filter((t) => t.id.startsWith("P7.2."));
    if (!pm.length) add("R8", `ระยะประกัน ${c.warrantyMonths} เดือน แต่ไม่มีรอบ PM`);
    else if (pm.some((t) => t.skipped)) add("R8", "มีรอบ PM ที่ถูกข้าม — ต้องครอบคลุมตลอดระยะประกัน");
  }
  for (const q of p.openQuestions) if (q.text.trim() && !q.neededByTask) add("R9", `คำถาม "${q.text.slice(0, 40)}" ยังไม่ระบุว่าต้องได้คำตอบก่อนงานไหน`);
  const civil = get("P5.1.civil");
  if (civil && (rainy(civil.start) || rainy(civil.end))) add("R10", `งานโยธา/นอกอาคาร ${civil.start}–${civil.end} อยู่ในหน้าฝน (พ.ค.–ต.ค.)${civil.rainBuffer ? ` · เผื่อไว้แล้ว ${p.defaults.rainBufferDays} วัน` : " — ควรเผื่อเวลา"}`);
  if (c.warrantyMonths > 0 && x.hasPmCost === false) add("R11", "ต้นทุนยังไม่รวมค่า PM ตลอดระยะประกัน");
  if (p.onsiteAdmin.count > 0 && x.hasAdminCost === false) add("R11", "ต้นทุนยังไม่รวมค่า Admin ประจำหน้างาน");
  for (const t of live.filter((t) => t.late)) out.push({ id: "LATE", level: RULE_LEVELS.LATE, message: `"${t.name}" เสร็จ ${t.end} เกินกำหนด ${t.deadline}` });
  if (!c.contracted && plan.preContractEnd && plan.preContractEnd >= c.contractStart) out.push({ id: "PRE", level: RULE_LEVELS.PRE, message: `งานก่อนสัญญาเสร็จ ${plan.preContractEnd} — เลยวันเริ่มสัญญาที่ตั้งไว้ ${c.contractStart}` });
  return out;
}

// ---------------------------------------------------------------------------
// ค่าเริ่มต้น / ทำความสะอาดข้อมูล
// ---------------------------------------------------------------------------
const num = (v: unknown, min = 0, max = 1e9) => Math.min(max, Math.max(min, Number(v) || 0));
const s = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);

export function defaultProfile(sector: "Government" | "Private"): PlanProfile {
  return {
    systems: [], procurement: "purchase", sites: [], legacySystem: "", controlRoom: "none", civilWork: [], electricalWork: true,
    installments: [], rent: { months: 12 }, sla: { responseHours: 4, fixHours: 24, uptimePct: 99 }, pmIntervalMonths: 6, onsiteAdmin: { count: 0, hours: "" }, training: { sessions: 2, hoursEach: 6 },
    openQuestions: [], dayMode: sector === "Government" ? "calendar" : "calendar", defaults: { ...DEFAULT_PLAN_DEFAULTS },
  };
}

export function normalizeProfile(raw: any, sector: "Government" | "Private" = "Government"): PlanProfile {
  const d = defaultProfile(sector);
  if (!raw || typeof raw !== "object") return d;
  const codes = SYSTEM_TYPES.map((x) => x.code);
  return {
    systems: (Array.isArray(raw.systems) ? raw.systems : []).filter((x: any) => codes.includes(x)).slice(0, 6),
    procurement: (["purchase", "rent", "hire"] as const).includes(raw.procurement) ? raw.procurement : "purchase",
    sites: (Array.isArray(raw.sites) ? raw.sites : []).slice(0, 50).map((x: any) => ({ name: s(x?.name, 120), env: x?.env === "outdoor" ? "outdoor" : "indoor", points: Math.round(num(x?.points, 0, 100000)) })),
    legacySystem: s(raw.legacySystem, 120),
    controlRoom: (["none", "existing", "new", "tbd"] as const).includes(raw.controlRoom) ? raw.controlRoom : "none",
    civilWork: (Array.isArray(raw.civilWork) ? raw.civilWork : []).filter((x: any) => CIVIL_WORKS.some((c) => c.code === x)),
    electricalWork: raw.electricalWork !== false,
    installments: (Array.isArray(raw.installments) ? raw.installments : []).slice(0, 24).map((x: any, i: number) => ({
      no: i + 1, dueDay: Math.round(num(x?.dueDay, 0, 3650)), payPct: Math.round(num(x?.payPct, 0, 100) * 100) / 100, points: Math.round(num(x?.points, 0, 100000)), scope: s(x?.scope, 300),
      ...(Number(x?.progressPct) > 0 ? { progressPct: Math.round(num(x.progressPct, 0, 100)) } : {}),
    })),
    rent: { months: Math.round(num(raw.rent?.months ?? 12, 0, 48)) }, // งวดเงินโครงการสูงสุด 60 งวด
    sla: { responseHours: num(raw.sla?.responseHours ?? 4, 0, 720), fixHours: num(raw.sla?.fixHours ?? 24, 0, 2160), uptimePct: Math.min(100, num(raw.sla?.uptimePct ?? 99, 0, 100)) },
    pmIntervalMonths: Math.round(num(raw.pmIntervalMonths ?? 6, 1, 24)) || 6,
    onsiteAdmin: { count: Math.round(num(raw.onsiteAdmin?.count, 0, 20)), hours: s(raw.onsiteAdmin?.hours, 60) },
    training: { sessions: Math.round(num(raw.training?.sessions ?? 2, 0, 50)), hoursEach: num(raw.training?.hoursEach ?? 6, 0, 24) },
    openQuestions: (Array.isArray(raw.openQuestions) ? raw.openQuestions : []).slice(0, 50).map((q: any) => ({ text: s(q?.text, 500), neededByTask: s(q?.neededByTask, 40) })).filter((q: PlanQuestion) => q.text),
    dayMode: raw.dayMode === "working" ? "working" : "calendar",
    defaults: Object.fromEntries(Object.entries(DEFAULT_PLAN_DEFAULTS).map(([k, v]) => [k, raw.defaults && raw.defaults[k] !== undefined ? Math.round(num(raw.defaults[k], 0, 365)) || (k === "pointsPerDay" ? v : 0) : v])) as unknown as PlanDefaults,
  };
}

export function normalizeOverrides(raw: any): PlanOverrides {
  const tasks: Record<string, PlanOverride> = {};
  for (const [k, v] of Object.entries(raw?.tasks && typeof raw.tasks === "object" ? raw.tasks : {}).slice(0, 300)) {
    if (!/^[A-Za-z0-9._-]{1,40}$/.test(k) || !v || typeof v !== "object") continue;
    const o: PlanOverride = {};
    if ((v as any).skip === true) o.skip = true;
    if (Number((v as any).days) > 0) o.days = Math.round(num((v as any).days, 1, 3650));
    if (isDate((v as any).startAt)) o.startAt = (v as any).startAt;
    if (Object.keys(o).length) tasks[k] = o;
  }
  const custom: CustomTask[] = (Array.isArray(raw?.custom) ? raw.custom : []).slice(0, 50).map((t: any, i: number) => ({
    id: /^U\d{1,3}$/.test(String(t?.id)) ? String(t.id) : `U${i + 1}`, name: s(t?.name, 200), phase: Math.round(num(t?.phase, 1, 7)) || 4,
    after: (Array.isArray(t?.after) ? t.after : []).map((x: any) => s(x, 40)).filter(Boolean).slice(0, 5), days: Math.round(num(t?.days, 1, 3650)) || 1,
    owner: (Object.keys(OWNERS) as OwnerKey[]).includes(t?.owner) ? t.owner : "pm",
  })).filter((t: CustomTask) => t.name);
  return { tasks, custom };
}

/** วิธีจัดซื้อ (ข้อความในระบบ) → รหัสแม่แบบ */
export function methodCode(text: string): PlanMethod {
  const t = String(text || "");
  if (/e-market|ตลาดอิเล็กทรอนิกส์/.test(t)) return "e-market";
  if (/เฉพาะเจาะจง/.test(t)) return "specific";
  if (/คัดเลือก/.test(t)) return "selection";
  return "e-bidding";
}

/** งวดงาน → ช่วงงาน/งวดเงินของโครงการ (milestones เดิม) */
export function timelineFromInstallments(inst: PlanInstallment[], contractStart: string): { id: string; name: string; startDate: string; endDate: string; weight: number }[] {
  let prev = 0;
  return inst.map((it, i) => {
    const due = Math.max(prev + 1, Number(it.dueDay) || prev + 1);
    const row = { id: `PH-${i + 1}`, name: `งวดที่ ${i + 1}${it.scope ? ` — ${it.scope}` : ""}`.slice(0, 200), startDate: addDays(contractStart, prev, "calendar"), endDate: addDays(contractStart, due - 1, "calendar"), weight: it.payPct };
    prev = due;
    return row;
  });
}
/** ช่วงงานเดิม → งวดงาน (โครงการที่ยังไม่มีข้อมูลแผน) */
export function installmentsFromTimeline(phases: { endDate: string; weight: number; name: string }[], contractStart: string): PlanInstallment[] {
  return phases.filter((p) => isDate(p.endDate)).map((p, i) => ({ no: i + 1, dueDay: Math.max(1, daysBetween(contractStart, p.endDate) + 1), payPct: p.weight, points: 0, scope: p.name.replace(/^งวดที่ \d+( — )?/, "") }));
}

// ---------------------------------------------------------------------------
// ติดตามงานจริง (T4): สถานะต่องาน · งานที่ต้องรอ · ลิงก์ไปทำต่อในโมดูลอื่น · งานของใคร
// ---------------------------------------------------------------------------
export type TaskStatus = "todo" | "doing" | "done";
export const TASK_STATUS_TH: Record<TaskStatus, string> = { todo: "ยังไม่เริ่ม", doing: "กำลังทำ", done: "เสร็จแล้ว" };
export interface TaskState { status: TaskStatus; at?: string; by?: string; byName?: string; note?: string; assigneeUid?: string; assigneeName?: string }
/** งานในแผนที่บันทึกไว้กับโครงการ (project.plan.tasks) */
export interface SnapTask { id: string; name: string; phase: number; owner: OwnerKey; external?: boolean; start: string; end: string; days?: number; deps?: string[]; gate?: string; deadline?: string; skipped?: boolean }

export const stateOf = (st: Record<string, TaskState> | undefined, id: string): TaskState => st?.[id] || { status: "todo" };

/** งานก่อนหน้าที่ยังไม่เสร็จ (งานที่ข้ามไม่นับ) — ต้องเสร็จก่อนจึงเริ่มงานนี้ได้ */
export function taskBlockers(t: SnapTask, tasks: SnapTask[], st: Record<string, TaskState> | undefined): SnapTask[] {
  const byId = new Map(tasks.map((x) => [x.id, x]));
  return (t.deps || []).map((id) => byId.get(id)).filter((d): d is SnapTask => !!d && !d.skipped && stateOf(st, d.id).status !== "done");
}
/** งานที่ต่อจากงานนี้และเริ่มไปแล้ว — ถ้ามี ห้ามย้อนงานนี้กลับเป็นยังไม่เสร็จ */
export function startedDependents(id: string, tasks: SnapTask[], st: Record<string, TaskState> | undefined): SnapTask[] {
  return tasks.filter((t) => (t.deps || []).includes(id) && stateOf(st, t.id).status !== "todo");
}

/** ไปทำต่อที่โมดูลไหน */
export function taskAction(t: SnapTask, docId: string, projectName = "", customerName = ""): { label: string; href: string } | null {
  const proj = `/projects/${encodeURIComponent(docId)}`;
  const job = (type: string, label: string) => ({
    label,
    href: `/service/dispatch?new=1&type=${type}&project=${encodeURIComponent(docId)}&task=${encodeURIComponent(t.id)}&title=${encodeURIComponent(`${t.name} · ${projectName}`.slice(0, 180))}&customer=${encodeURIComponent(customerName)}&date=${t.start}`,
  });
  if (["P4.8", "P4.9", "M.cctv.vms"].includes(t.id)) return { label: "ขอซื้อตาม BOQ", href: `${proj}?tab=boq` };
  if (/^P5\.\d+\.handover$/.test(t.id) || t.id === "P6.5") return { label: "วางบิลงวดนี้", href: `${proj}?tab=billing` };
  if (/^P5\.\d+\.(cabling|civil|rack|devices)$/.test(t.id) || /^M\.dc\./.test(t.id) || t.id === "X.rent.removal") return job("INSTALL", "สร้างงานติดตั้ง");
  if (/^P7\.2\.\d+$/.test(t.id)) return job("MA", "นัด PM");
  if (["P3.3", "P7.4"].includes(t.id)) return { label: "สัญญา & หลักประกัน", href: `${proj}?tab=contract` };
  if (["P2.1", "P2.2", "P2.4"].includes(t.id)) return { label: "แก้ร่าง TOR/แผน", href: `/projects/new?edit=${encodeURIComponent(docId)}` };
  if (t.id === "P6.4") return { label: "เอกสารส่งมอบ", href: `${proj}?tab=docs` };
  if (t.id.startsWith("X.rent.bill.")) return { label: "วางบิลค่าเช่า", href: `${proj}?tab=billing` };
  return null;
}

/** งานนี้อยู่ใน "งานตามแผน" ของผู้ใช้ไหม: มอบหมายให้ตรง ๆ · งานผู้จัดการ/งานรอหน่วยงาน → ผู้จัดการโครงการ · อื่น ๆ ตามตำแหน่ง */
export function isMyTask(t: SnapTask, p: { projectManagerUid?: string }, uid: string, roles: string[], st: TaskState): boolean {
  if (st.assigneeUid) return st.assigneeUid === uid;
  const o = OWNERS[t.owner];
  if (!o || t.owner === "pm" || o.external) return !!p.projectManagerUid && p.projectManagerUid === uid;
  return !!o.role && roles.includes(o.role);
}

/** ความคืบหน้าของแผน (ไม่นับงานที่ข้าม/งานตามรอบหลังส่งมอบ) */
export function planProgress(tasks: SnapTask[], st: Record<string, TaskState> | undefined, today: string): { done: number; total: number; overdue: number; doing: number } {
  const live = tasks.filter((t) => !t.skipped && t.phase < 7);
  const s = (t: SnapTask) => stateOf(st, t.id).status;
  return {
    total: live.length, done: live.filter((t) => s(t) === "done").length, doing: live.filter((t) => s(t) === "doing").length,
    overdue: live.filter((t) => s(t) !== "done" && t.end < today).length,
  };
}

/** งวดเงินของโครงการ: งวดงาน + (เช่า) ค่าเช่ารายเดือนตลอดระยะเช่านับจากตรวจรับ — ส่วนที่เหลือจากงวดติดตั้งแบ่งเท่ากันทุกเดือน */
export function billingTimeline(p: PlanProfile, contractStart: string, warrantyStart: string): { id: string; name: string; startDate: string; endDate: string; weight: number }[] {
  const base = timelineFromInstallments(p.installments, contractStart);
  if (p.procurement !== "rent" || !(p.rent.months > 0) || !warrantyStart) return base;
  const rest = Math.round((100 - p.installments.reduce((s2, i) => s2 + (Number(i.payPct) || 0), 0)) * 100) / 100;
  if (rest <= 0) return base;
  const n = p.rent.months, per = Math.floor((rest / n) * 100) / 100;
  const months = Array.from({ length: n }, (_, i) => ({
    id: `RENT-${i + 1}`, name: `ค่าเช่าเดือนที่ ${i + 1}`, startDate: addMonths(warrantyStart, i), endDate: addDays(addMonths(warrantyStart, i + 1), -1, "calendar"),
    weight: i === n - 1 ? Math.round((rest - per * (n - 1)) * 100) / 100 : per,
  }));
  return [...base.map((b) => ({ ...b, name: b.name.replace(/^งวดที่/, "งวดติดตั้งที่") })), ...months];
}

// ---------------------------------------------------------------------------
// แม่แบบของบริษัท (T6): แก้งานในคลัง (ชื่อ วัน ผู้รับผิดชอบ ปิดใช้) · เพิ่มงานเอง · ค่าเริ่มต้นการคำนวณ
// เก็บที่ companies/{companyId}/settings/project_template
// ---------------------------------------------------------------------------
export interface TemplateTaskOverride { name?: string; days?: number; owner?: OwnerKey; disabled?: boolean }
export interface TemplateExtraTask { id: string; name: string; phase: number; after: string[]; days: number; owner: OwnerKey; systems?: SystemType[]; when?: "always" | "gov" }
export interface TemplateConfig { tasks: Record<string, TemplateTaskOverride>; extra: TemplateExtraTask[]; defaults?: PlanDefaults; updatedAt?: string; updatedBy?: string }
export const EMPTY_TEMPLATE: TemplateConfig = { tasks: {}, extra: [] };

/** รายการงานทั้งหมดในคลังมาตรฐาน (สำหรับหน้าตั้งค่า) */
export function libraryCatalog(): { id: string; name: string; phase: number; days: number | null; owner: OwnerKey; system?: SystemType; after: string[]; when: string }[] {
  const row = (t: TaskTpl, system?: SystemType) => ({ id: t.id, name: t.name, phase: t.phase, days: typeof t.days === "number" ? t.days : null, owner: t.owner, ...(system ? { system } : {}), after: t.after || [], when: (t.when || ["always"]).join(" & ") });
  return [...LIB.map((t) => row(t)), ...(Object.entries(MODULES) as [SystemType, TaskTpl[]][]).flatMap(([sy, ts]) => ts.map((t) => row(t, sy)))];
}

export function normalizeTemplate(raw: any): TemplateConfig {
  const owners = Object.keys(OWNERS) as OwnerKey[];
  const ids = new Set(libraryCatalog().map((t) => t.id));
  const tasks: Record<string, TemplateTaskOverride> = {};
  for (const [id, v] of Object.entries(raw?.tasks && typeof raw.tasks === "object" ? raw.tasks : {})) {
    if (!ids.has(id) || !v || typeof v !== "object") continue;
    const o: TemplateTaskOverride = {};
    const nm = s((v as any).name, 200); if (nm) o.name = nm;
    if (Number((v as any).days) > 0) o.days = Math.round(num((v as any).days, 1, 3650));
    if (owners.includes((v as any).owner)) o.owner = (v as any).owner;
    if ((v as any).disabled === true) o.disabled = true;
    if (Object.keys(o).length) tasks[id] = o;
  }
  const extra: TemplateExtraTask[] = (Array.isArray(raw?.extra) ? raw.extra : []).slice(0, 100).map((t: any, i: number) => ({
    id: /^C\d{1,3}$/.test(String(t?.id)) ? String(t.id) : `C${i + 1}`, name: s(t?.name, 200), phase: Math.round(num(t?.phase, 1, 7)) || 4,
    after: (Array.isArray(t?.after) ? t.after : []).map((x: any) => s(x, 40)).filter(Boolean).slice(0, 5), days: Math.round(num(t?.days, 1, 3650)) || 1,
    owner: owners.includes(t?.owner) ? t.owner : "pm",
    ...(Array.isArray(t?.systems) && t.systems.length ? { systems: t.systems.filter((x: any) => SYSTEM_TYPES.some((y) => y.code === x)) } : {}),
    ...(t?.when === "gov" ? { when: "gov" as const } : {}),
  })).filter((t: TemplateExtraTask) => t.name);
  const seen = new Set<string>();
  const uniq = extra.filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)));
  const out: TemplateConfig = { tasks, extra: uniq };
  if (raw?.defaults && typeof raw.defaults === "object") out.defaults = normalizeProfile({ defaults: raw.defaults }).defaults;
  return out;
}
