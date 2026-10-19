/**
 * การเริ่มใช้งานตามตำแหน่ง (ฟังก์ชันล้วน — ใช้ทั้งหน้าจอ, /api/onboarding และ unit test)
 *  - intro: ข้อความต้อนรับครั้งแรก "หน้าที่ของคุณในระบบ"
 *  - tasks: รายการเริ่มต้นใช้งาน ติ๊กให้อัตโนมัติเมื่อทำจริง
 *      doc   = พบเอกสารที่ผู้ใช้คนนี้สร้าง (ตามฟิลด์ผู้สร้างของเอกสารนั้น)
 *      visit = ผู้ใช้เปิดหน้านั้นแล้ว (งานที่เป็นการดู/เรียนรู้)
 *      help  = เคยเปิดแผง "วิธีใช้หน้านี้"
 * ผู้ใช้หลายตำแหน่งเห็นงานของทุกตำแหน่งรวมกัน (งานซ้ำนับครั้งเดียว)
 */
import { ROLE_LABELS } from "@/lib/permissions";

export type TaskCheck =
  | { kind: "doc"; col: string; scope: "company" | "group"; field: string; byEmail?: boolean }
  | { kind: "visit"; path: string }
  | { kind: "help" };

export interface OnboardingTask { id: string; label: string; href: string; check: TaskCheck }
export interface RoleIntro { role: string; duties: string; daily: string[] }

const T = {
  help: { id: "help", label: "เปิดดู \"วิธีใช้หน้านี้\" (ปุ่ม ? มุมขวาบน) สักหน้า", href: "/dashboard", check: { kind: "help" } },
  customer: { id: "customer", label: "เพิ่มลูกค้ารายแรก", href: "/customers/new", check: { kind: "doc", col: "customers", scope: "group", field: "createdBy" } },
  quotation: { id: "quotation", label: "ทำใบเสนอราคาใบแรก", href: "/sales/quotations/new", check: { kind: "doc", col: "quotations", scope: "company", field: "createdBy" } },
  salesOrder: { id: "salesOrder", label: "แปลงใบเสนอราคาเป็นใบสั่งขาย", href: "/sales?tab=quotations", check: { kind: "doc", col: "sales_orders", scope: "company", field: "createdBy" } },
  receipt: { id: "receipt", label: "บันทึกรับชำระเงินจากลูกค้า", href: "/finance/receipts/new", check: { kind: "doc", col: "receipts", scope: "company", field: "createdBy" } },
  pr: { id: "pr", label: "เปิดใบขอซื้อใบแรก", href: "/procurement/requests/new", check: { kind: "doc", col: "purchase_requests", scope: "company", field: "createdBy" } },
  po: { id: "po", label: "ออกใบสั่งซื้อใบแรก", href: "/procurement", check: { kind: "doc", col: "purchase_orders", scope: "company", field: "createdBy" } },
  supplier: { id: "supplier", label: "เพิ่มผู้ขายรายแรก", href: "/procurement/suppliers/new", check: { kind: "doc", col: "suppliers", scope: "group", field: "createdBy" } },
  goodsIn: { id: "goodsIn", label: "รับสินค้าเข้าคลังครั้งแรก", href: "/inventory/in/new", check: { kind: "doc", col: "goods_receipts", scope: "company", field: "createdBy", byEmail: true } },
  stockCard: { id: "stockCard", label: "ดูบัญชีคุมสินค้า (ความเคลื่อนไหวรายตัว)", href: "/inventory/stock-card", check: { kind: "visit", path: "/inventory/stock-card" } },
  pick: { id: "pick", label: "ดูหน้าจัดของ / เบิกสินค้าตามใบสั่งขาย", href: "/inventory/pick", check: { kind: "visit", path: "/inventory/pick" } },
  postJournal: { id: "postJournal", label: "ตรวจและอนุมัติลงบัญชีรายการแรก", href: "/finance", check: { kind: "doc", col: "journal_entries", scope: "company", field: "postedByUid" } },
  payment: { id: "payment", label: "บันทึกจ่ายชำระเจ้าหนี้", href: "/finance/payments/new", check: { kind: "doc", col: "payments", scope: "company", field: "createdBy" } },
  reports: { id: "reports", label: "เปิดรายงานบัญชีและภาษี", href: "/finance/reports", check: { kind: "visit", path: "/finance/reports" } },
  project: { id: "project", label: "สร้างโครงการแรก", href: "/projects/new", check: { kind: "doc", col: "projects", scope: "company", field: "createdBy" } },
  projectsView: { id: "projectsView", label: "เปิดดูหน้าโครงการและงวดงาน", href: "/projects", check: { kind: "visit", path: "/projects" } },
  myJobs: { id: "myJobs", label: "เปิด \"งานของฉัน\" บนมือถือ", href: "/mobile/technician", check: { kind: "visit", path: "/mobile/technician" } },
  dispatch: { id: "dispatch", label: "เปิดศูนย์จ่ายงาน", href: "/service/dispatch", check: { kind: "visit", path: "/service/dispatch" } },
  hrView: { id: "hrView", label: "เปิดหน้าบุคลากร", href: "/hr", check: { kind: "visit", path: "/hr" } },
  executive: { id: "executive", label: "เปิดแดชบอร์ดผู้บริหาร", href: "/executive", check: { kind: "visit", path: "/executive" } },
  settings: { id: "settings", label: "ตรวจข้อมูลบริษัทบนหัวเอกสาร", href: "/settings", check: { kind: "visit", path: "/settings" } },
  importData: { id: "importData", label: "เปิดหน้านำเข้าข้อมูล Excel", href: "/data-import", check: { kind: "visit", path: "/data-import" } },
} satisfies Record<string, OnboardingTask>;

const ROLE_SETUP: Record<string, { duties: string; daily: string[]; tasks: OnboardingTask[] }> = {
  SALES: {
    duties: "ดูแลลูกค้า ทำใบเสนอราคา ติดตามจนเป็นใบสั่งขาย และออกใบกำกับภาษี",
    daily: ["ดูใบเสนอราคาที่รอลูกค้าตอบ/ใกล้หมดอายุ", "อนุมัติ/ติดตามใบสั่งขายจนส่งมอบ", "ออกใบกำกับภาษีเมื่อส่งมอบแล้ว"],
    tasks: [T.customer, T.quotation, T.salesOrder, T.help],
  },
  PURCHASING: {
    duties: "ซื้อสินค้าและบริการตามใบขอซื้อ ดูแลผู้ขาย และติดตามการรับของ",
    daily: ["ตรวจใบขอซื้อที่อนุมัติแล้ว ออกใบสั่งซื้อ", "ติดตามของที่ยังไม่มาส่ง", "ตั้งเบิกเมื่อได้ใบแจ้งหนี้จากผู้ขาย"],
    tasks: [T.supplier, T.pr, T.po, T.help],
  },
  WAREHOUSE: {
    duties: "รับสินค้าเข้า จัดเก็บ เบิกจ่ายตามใบสั่งขาย/โครงการ และดูแลจำนวนคงเหลือให้ตรง",
    daily: ["รับของตามใบสั่งซื้อ", "จัดของตามใบสั่งขายที่อนุมัติแล้ว พิมพ์ใบส่งของ", "ตรวจสินค้าใกล้หมด"],
    tasks: [T.goodsIn, T.pick, T.stockCard, T.help],
  },
  ACCOUNTANT: {
    duties: "ตรวจและอนุมัติรายการบัญชีที่ระบบสร้างจากเอกสาร รับ-จ่ายเงิน ภาษี และปิดงวด",
    daily: ["อนุมัติรายการบัญชีร่าง (กล่องงานรอดำเนินการ)", "รับชำระ/จ่ายชำระ", "สิ้นเดือน: รายงานภาษี แล้วปิดงวด"],
    tasks: [T.postJournal, T.receipt, T.payment, T.reports, T.help],
  },
  ENGINEER: {
    duties: "ดูแลโครงการ แบ่งงวดงาน เบิกของ ติดตามความคืบหน้าและต้นทุนเทียบงบ",
    daily: ["อัปเดตความคืบหน้างวดงาน", "ขอซื้อ/เบิกของเข้าโครงการ", "ดูต้นทุนจริงเทียบงบ"],
    tasks: [T.projectsView, T.project, T.help],
  },
  TECHNICIAN: {
    duties: "รับงานที่ได้รับมอบหมายบนมือถือ เช็คอินหน้างาน บันทึกผลและปิดงาน",
    daily: ["เปิด \"งานของฉัน\" ดูงานใหม่", "เช็คอินเมื่อถึงหน้างาน", "ถ่ายรูป ให้ลูกค้าเซ็น แล้วปิดงาน"],
    tasks: [T.myJobs, T.help],
  },
  HR: {
    duties: "ข้อมูลพนักงาน ลงเวลา เงินเดือน และการเบิกค่าใช้จ่ายของพนักงาน",
    daily: ["ตรวจการลงเวลา", "ทำเงินเดือนสิ้นเดือน", "ตรวจรายการเบิกค่าใช้จ่าย"],
    tasks: [T.hrView, T.help],
  },
  EXECUTIVE: {
    duties: "ดูภาพรวมธุรกิจ และอนุมัติเอกสารตามวงเงิน",
    daily: ["ดูงานรออนุมัติที่หน้าภาพรวม", "ดูแดชบอร์ดผู้บริหาร: รายได้ กำไร เงินสด ลูกหนี้"],
    tasks: [T.executive, T.help],
  },
  ADMIN: {
    duties: "ดูแลผู้ใช้ ตำแหน่งงาน และการตั้งค่าระบบ",
    daily: ["เพิ่ม/ระงับผู้ใช้", "ตรวจบันทึกการใช้งาน"],
    tasks: [T.settings, T.help],
  },
  SUPERADMIN: {
    duties: "ดูแลระบบทั้งหมด กำหนดตำแหน่งผู้ใช้ และตั้งค่าบริษัท",
    daily: ["ตรวจงานรออนุมัติ", "ดูแลผู้ใช้และตำแหน่ง"],
    tasks: [T.settings, T.importData, T.help],
  },
};

/** งานเริ่มต้นของผู้ใช้ (รวมทุกตำแหน่ง งานซ้ำนับครั้งเดียว ตามลำดับตำแหน่ง) */
export function tasksForRoles(roles: string[]): OnboardingTask[] {
  const out = new Map<string, OnboardingTask>();
  for (const r of roles) for (const t of ROLE_SETUP[String(r).toUpperCase()]?.tasks || []) if (!out.has(t.id)) out.set(t.id, t);
  // "เปิดวิธีใช้" ไว้ท้ายสุดเสมอ
  const help = out.get("help");
  if (help) { out.delete("help"); out.set("help", help); }
  return Array.from(out.values());
}

export function introsForRoles(roles: string[]): RoleIntro[] {
  return roles
    .map((r) => String(r).toUpperCase())
    .filter((r, i, a) => ROLE_SETUP[r] && a.indexOf(r) === i)
    .map((r) => ({ role: ROLE_LABELS[r] || r, duties: ROLE_SETUP[r].duties, daily: ROLE_SETUP[r].daily }));
}

/** เส้นทางที่ต้องบันทึกว่าเปิดแล้ว (สำหรับงานแบบ visit ที่ยังไม่เสร็จ) */
export function visitTargets(tasks: { check: TaskCheck; done?: boolean }[]): string[] {
  return tasks.filter((t) => !t.done && t.check.kind === "visit").map((t) => (t.check as { path: string }).path);
}
