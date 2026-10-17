/**
 * คำนวณตัวเลขหน้าภาพรวม (Dashboard) จากข้อมูลจริงของบริษัท
 * - รายได้/ค่าใช้จ่าย: จากรายการบัญชี (หมวด 4 = รายได้, หมวด 5 = ต้นทุน/ค่าใช้จ่าย) แบบเดียวกับหน้าการเงิน
 * - ไม่นับเอกสารตัวอย่าง (isSample) ในตัวเลขเงิน
 */

import { OPEN_STATUSES, PROJECT_STATUS_TH, normalizeProjectStatus } from "./project-status";

const TH_OFFSET_MS = 7 * 3600 * 1000;
const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export function toMillis(v: any): number {
  if (!v) return 0;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (typeof v.seconds === "number") return v.seconds * 1000;
  if (typeof v === "string" || typeof v === "number" || v instanceof Date) {
    const t = new Date(v).getTime();
    return Number.isFinite(t) ? t : 0;
  }
  return 0;
}

/** "YYYY-MM" ตามเวลาไทย */
export function thaiMonthKey(ms: number): string {
  return new Date(ms + TH_OFFSET_MS).toISOString().slice(0, 7);
}

export function thaiMonthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${TH_MONTHS[m - 1]} ${String((y + 543) % 100).padStart(2, "0")}`;
}

/** n เดือนล่าสุด (เก่า -> ใหม่) รวมเดือนปัจจุบัน */
export function lastMonthKeys(n: number, now = Date.now()): string[] {
  const d = new Date(now + TH_OFFSET_MS);
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
    keys.push(x.toISOString().slice(0, 7));
  }
  return keys;
}

export interface MonthlyPL {
  key: string;
  label: string;
  revenue: number;
  expense: number;
}

const journalLines = (j: any): any[] => (Array.isArray(j.items) ? j.items : Array.isArray(j.lines) ? j.lines : []);

/** รายได้และค่าใช้จ่ายรายเดือน จากรายการบัญชี */
export function monthlyProfitAndLoss(journals: any[], months: string[]): MonthlyPL[] {
  const byMonth = new Map(months.map((k) => [k, { revenue: 0, expense: 0 }]));
  for (const j of journals) {
    if (j.isDeleted === true || j.isSample) continue;
    const ms = toMillis(j.date) || toMillis(j.postingDate) || toMillis(j.createdAt);
    if (!ms) continue;
    const bucket = byMonth.get(thaiMonthKey(ms));
    if (!bucket) continue;
    for (const l of journalLines(j)) {
      const code = String(l.accountCode || l.accountId || l.code || "");
      const dr = Number(l.debit) || 0;
      const cr = Number(l.credit) || 0;
      if (code.startsWith("4")) bucket.revenue += cr - dr;
      else if (code.startsWith("5")) bucket.expense += dr - cr;
    }
  }
  return months.map((key) => {
    const b = byMonth.get(key)!;
    return { key, label: thaiMonthLabel(key), revenue: round2(b.revenue), expense: round2(b.expense) };
  });
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** สินค้าต่ำกว่าจุดสั่งซื้อ (เรียงจากวิกฤตที่สุด) */
export function lowStockProducts(products: any[]) {
  return products
    .filter((p) => !p.isSample && p.isDeleted !== true && (p.itemType || "PRODUCT") === "PRODUCT")
    .map((p) => {
      const onHand = Number(p.stockStatus?.onHand ?? p.currentStock ?? 0);
      const min = Number(p.minStock ?? p.reorderPoint ?? p.inventory?.minStock ?? 0);
      return { id: p.id, name: p.name || p.productName || p.sku || p.id, sku: p.sku || "", onHand, min, unit: p.unit || "ชิ้น" };
    })
    .filter((p) => p.min > 0 && p.onHand <= p.min)
    .sort((a, b) => a.onHand / a.min - b.onHand / b.min);
}

export function activeProjects(projects: any[]) {
  return projects
    .filter((p) => p.isDeleted !== true && OPEN_STATUSES.includes(normalizeProjectStatus(p.status)))
    .map((p) => ({
      id: p.id,
      code: p.projectCode || p.projectId || p.id,
      name: p.title || p.name || p.projectName || "-",
      progress: Math.max(0, Math.min(100, Number(p.progress) || 0)),
      status: normalizeProjectStatus(p.status),
      deadlineMs: toMillis(p.deadline) || toMillis(p.endDate),
      isSample: !!p.isSample,
    }));
}

export const PROJECT_STATUS_LABEL = PROJECT_STATUS_TH;

/** ใบแจ้งหนี้ค้างชำระที่เลยกำหนด */
export function overdueInvoices(invoices: any[], now = Date.now()) {
  return invoices.filter((inv) => {
    if (inv.isDeleted === true || inv.isSample) return false;
    const paid = String(inv.paymentStatus || inv.status || "").toLowerCase() === "paid";
    const cancelled = String(inv.status || "").toLowerCase() === "cancelled";
    const due = toMillis(inv.dueDate);
    return !paid && !cancelled && due > 0 && due < now;
  });
}

const MODULE_LABELS: [RegExp, string][] = [
  [/QUOTATION/, "ใบเสนอราคา"],
  [/SALES_ORDER|SALES_ORDERS/, "ใบสั่งขาย"],
  [/TAX_INVOICE|INVOICE/, "ใบแจ้งหนี้/ใบกำกับภาษี"],
  [/BILLING/, "ใบวางบิล"],
  [/RECEIPT/, "ใบเสร็จรับเงิน"],
  [/CRM|CUSTOMER/, "ลูกค้า"],
  [/PROJECT/, "โครงการ"],
  [/WHT/, "หนังสือหัก ณ ที่จ่าย"],
  [/PROCURE|PURCHASE|PO\b/, "จัดซื้อ"],
  [/KIT|BOM/, "ชุดอุปกรณ์"],
  [/INVENTORY|STOCK|PRODUCT/, "คลังสินค้า"],
  [/ASSET/, "สินทรัพย์"],
  [/TAX/, "ภาษี"],
  [/FINANCE|JOURNAL|ACCOUNT/, "การเงิน/บัญชี"],
  [/TECHNICIAN|CONTRACTOR/, "ช่าง/ผู้รับเหมา"],
  [/USER/, "ผู้ใช้งาน"],
];

const ACTION_LABELS: Record<string, string> = { CREATE: "สร้าง", UPDATE: "แก้ไข", DELETE: "ลบ", APPROVE: "อนุมัติ", POST: "ลงบัญชี" };

export type ActivityKind = "success" | "info" | "warning";

export interface ActivityItem {
  id: string;
  message: string;
  kind: ActivityKind;
  atMs: number;
}

/** แปลงบันทึกระบบ (logs) เป็นข้อความกิจกรรมภาษาไทย */
export function activityFeed(logs: any[], max = 8): ActivityItem[] {
  return logs
    .filter((l) => l.isDeleted !== true)
    .map((l) => {
      const action = String(l.action || "").toUpperCase();
      const moduleName = String(l.module || "").toUpperCase();
      const label = MODULE_LABELS.find(([re]) => re.test(moduleName))?.[1] || (moduleName ? moduleName.toLowerCase().replace(/_/g, " ") : "รายการ");
      const verb = ACTION_LABELS[action] || (action ? action.toLowerCase() : "บันทึก");
      const kind: ActivityKind = action === "DELETE" ? "warning" : action === "CREATE" || action === "APPROVE" || action === "POST" ? "success" : "info";
      return {
        id: l.id,
        message: `${verb}${label}${l.targetId ? ` ${l.targetId}` : ""}`,
        kind,
        atMs: toMillis(l.createdAt),
      };
    })
    .sort((a, b) => b.atMs - a.atMs)
    .slice(0, max);
}

export function relativeTimeTh(ms: number, now = Date.now()): string {
  if (!ms) return "-";
  const diff = Math.max(0, now - ms);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "เมื่อสักครู่";
  if (min < 60) return `${min} นาทีที่แล้ว`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ชม. ที่แล้ว`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} วันที่แล้ว`;
  return new Date(ms).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
}

/** ย่อจำนวนเงิน: 2,450,000 -> ฿2.45M */
export function compactBaht(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  // Number(...) ตัดศูนย์ท้าย: 5.0K -> 5K, 2.50M -> 2.5M
  if (abs >= 1e6) return `${sign}฿${Number((abs / 1e6).toFixed(abs >= 1e7 ? 1 : 2))}M`;
  if (abs >= 1e3) return `${sign}฿${Number((abs / 1e3).toFixed(abs >= 1e4 ? 0 : 1))}K`;
  return `${sign}฿${abs.toLocaleString("th-TH", { maximumFractionDigits: 0 })}`;
}

export function fullBaht(n: number): string {
  return `฿${n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
