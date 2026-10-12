import { expenseAmount, type ProjectExpense } from "./project-templates";

/**
 * โครงสร้างรายการ (BOQ) และงบประมาณโครงการ — ใช้ร่วมกันทั้งหน้าจอและ server
 * server คำนวณซ้ำจากรายการเสมอ (ไม่เชื่อตัวเลขสรุปที่ส่งมาจาก browser)
 */

export type ProjectLineKind = "PRODUCT" | "SERVICE" | "LABOR" | "GROUP";

export interface ProjectLine {
  lineId: string;
  kind: ProjectLineKind;
  productId: string | null;
  sku: string;
  name: string;
  details: string;
  qty: number;
  unit: string;
  unitCost: number;
  unitPrice: number;
  discountType: "PERCENT" | "AMOUNT";
  discountValue: number;
  whtRate: number;
  isOptional: boolean;
  /** ราคาขายสุทธิของบรรทัด (หลังส่วนลด) */
  amount: number;
  /** ต้นทุนรวมของบรรทัด */
  costAmount: number;
  /** รายการจากส่วน "งานบริการและค่าแรง" ของหน้าโครงการ (ใช้คืนค่าตอนแก้ไขฉบับร่าง) */
  origin?: "labor";
  laborType?: "lump-sum" | "per-point";
  materialUnitCost?: number;
  laborUnitCost?: number;
}

const num = (v: any) => {
  const n = Number(typeof v === "string" ? v.replace(/,/g, "") : v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n: number) => Math.round(n * 100) / 100;
const str = (v: any, max = 500) => String(v ?? "").trim().slice(0, max);

function lineDiscount(qty: number, price: number, item: any): { type: "PERCENT" | "AMOUNT"; value: number; amount: number } {
  const gross = qty * price;
  // รูปแบบตารางสินค้า: discountType/discountValue; รูปแบบเก่า: ข้อความ "10%" หรือ "500"
  if (item.discountType || item.discountValue !== undefined) {
    const type = item.discountType === "AMOUNT" ? "AMOUNT" : "PERCENT";
    const value = Math.max(0, num(item.discountValue));
    return { type, value, amount: type === "PERCENT" ? gross * (value / 100) : value };
  }
  const s = str(item.discount);
  if (s.endsWith("%")) {
    const value = Math.max(0, num(s.slice(0, -1)));
    return { type: "PERCENT", value, amount: gross * (value / 100) };
  }
  const value = Math.max(0, num(s));
  return { type: "AMOUNT", value, amount: value };
}

/** รายการจากตารางสินค้า (DocumentItemsTable) */
export function normalizeItemLine(item: any, index: number): ProjectLine {
  const kindRaw = String(item.itemType || "PRODUCT").toUpperCase();
  const kind: ProjectLineKind = kindRaw === "GROUP_HEADER" ? "GROUP" : kindRaw === "SERVICE" ? "SERVICE" : kindRaw === "LABOR" ? "LABOR" : "PRODUCT";
  const qty = kind === "GROUP" ? 0 : Math.max(0, num(item.qty));
  const unitPrice = kind === "GROUP" ? 0 : Math.max(0, num(item.price ?? item.unitPrice));
  const unitCost = kind === "GROUP" ? 0 : Math.max(0, num(item.cost ?? item.costPrice ?? item.unitCost));
  const disc = lineDiscount(qty, unitPrice, item);
  return {
    lineId: str(item.lineId || item.id || `L${index + 1}`, 60),
    kind,
    productId: item.productId ? str(item.productId, 120) : null,
    sku: str(item.sku, 120),
    name: str(item.name || item.productName, 300),
    details: str(item.details || item.description, 2000),
    qty,
    unit: str(item.unit || "ชิ้น", 30),
    unitCost,
    unitPrice,
    discountType: disc.type,
    discountValue: disc.value,
    whtRate: Math.max(0, num(item.whtRate)),
    isOptional: !!item.isOptional,
    amount: round2(Math.max(0, qty * unitPrice - disc.amount)),
    costAmount: round2(qty * unitCost),
  };
}

/** รายการงานบริการ/ค่าแรงของหน้าโครงการ (เหมา หรือ คิดต่อจุด) */
export function normalizeLaborLine(labor: any, index: number): ProjectLine {
  const perPoint = labor.type === "per-point";
  const qty = perPoint ? Math.max(0, num(labor.points || 1)) : 1;
  const unitCost = perPoint ? num(labor.materialCost) + num(labor.laborCost) : num(labor.cost);
  const unitPrice = Math.max(0, num(labor.price));
  return {
    lineId: str(labor.lineId || labor.id || `LAB${index + 1}`, 60),
    kind: "LABOR",
    productId: null,
    sku: str(labor.sku, 120),
    name: str(labor.name, 300),
    details: str(labor.details, 2000),
    qty,
    unit: perPoint ? "จุด" : "งาน",
    unitCost: Math.max(0, unitCost),
    unitPrice,
    discountType: "PERCENT",
    discountValue: 0,
    whtRate: Math.max(0, num(labor.whtRate ?? 3)),
    isOptional: false,
    amount: round2(qty * unitPrice),
    costAmount: round2(qty * Math.max(0, unitCost)),
    origin: "labor",
    laborType: perPoint ? "per-point" : "lump-sum",
    // เหมาจ่าย: ต้นทุน = cost (แยกค่าวัสดุ/ค่าแรงไว้ถ้ามี)
    materialUnitCost: perPoint ? Math.max(0, num(labor.materialCost)) : Math.min(Math.max(0, unitCost), Math.max(0, num(labor.materialCost))),
    laborUnitCost: perPoint ? Math.max(0, num(labor.laborCost)) : Math.max(0, unitCost - Math.min(Math.max(0, unitCost), Math.max(0, num(labor.materialCost)))),
  };
}

/** แปลงรายการที่บันทึกไว้กลับเป็นข้อมูลฟอร์ม (ตารางสินค้า / งานบริการ) */
export function linesToForm(lines: any[]): { items: any[]; labors: any[] } {
  const items: any[] = [];
  const labors: any[] = [];
  (Array.isArray(lines) ? lines : []).forEach((l: any, i: number) => {
    const id = l.lineId || `L${i + 1}`;
    if (l.origin === "labor") {
      const perPoint = l.laborType === "per-point";
      labors.push({
        id,
        name: l.name || "",
        type: perPoint ? "per-point" : "lump-sum",
        points: perPoint ? l.qty : 1,
        materialCost: l.materialUnitCost || 0,
        laborCost: perPoint ? l.laborUnitCost || 0 : (l.laborUnitCost ?? l.unitCost) || 0,
        cost: perPoint ? 0 : l.unitCost || 0,
        price: l.unitPrice || 0,
        whtRate: l.whtRate,
      });
      return;
    }
    items.push({
      id,
      productId: l.productId || null,
      sku: l.sku || "",
      name: l.name || "",
      details: l.details || "",
      qty: l.qty,
      unit: l.unit || "ชิ้น",
      price: l.unitPrice || 0,
      cost: l.unitCost || 0,
      itemType: l.kind === "GROUP" ? "GROUP_HEADER" : l.kind,
      discountType: l.discountType || "PERCENT",
      discountValue: l.discountValue || 0,
      whtRate: l.whtRate || 0,
      isOptional: !!l.isOptional,
    });
  });
  return { items, labors };
}

export interface ProjectBudgetOptions {
  contingencyRate?: number; // สัดส่วนเงินสำรองความเสี่ยงของต้นทุน (ค่าเริ่มต้น 5%)
  vatRate?: number; // ค่าเริ่มต้น 7%
  startDate?: string;
  endDate?: string;
  /** ค่าใช้จ่ายดำเนินงาน (ถ้าส่งมา ใช้แทนเงินสำรองคงที่ 5%; รายการ key RISK = เงินสำรองความเสี่ยง) */
  expenses?: ProjectExpense[];
}

export function computeProjectBudget(lines: ProjectLine[], opts: ProjectBudgetOptions = {}) {
  const useExpenses = Array.isArray(opts.expenses);
  const vatRate = opts.vatRate ?? 0.07;
  const counted = lines.filter((l) => l.kind !== "GROUP" && !l.isOptional);
  const equip = counted.filter((l) => l.kind !== "LABOR");
  const labor = counted.filter((l) => l.kind === "LABOR");
  const sum = (ls: ProjectLine[], k: "amount" | "costAmount") => round2(ls.reduce((s, l) => s + l[k], 0));

  const equipRev = sum(equip, "amount");
  const equipCost = sum(equip, "costAmount");
  const laborRev = sum(labor, "amount");
  const laborCost = sum(labor, "costAmount");
  const totalRev = round2(equipRev + laborRev);
  const totalCost = round2(equipCost + laborCost);
  const expenseLines = (opts.expenses || []).map((e) => ({ ...e, amount: expenseAmount(e, totalCost, totalRev) }));
  const risk = expenseLines.find((e) => e.key === "RISK");
  const contingencyRate = useExpenses
    ? (risk && risk.basis === "PCT_DIRECT" ? risk.value / 100 : 0)
    : opts.contingencyRate ?? 0.05;
  const contingencyBuffer = useExpenses ? round2(risk?.amount || 0) : round2(totalCost * contingencyRate);
  /** ค่าใช้จ่ายดำเนินงานรวม (รวมเงินสำรองความเสี่ยง) */
  const expensesTotal = useExpenses ? round2(expenseLines.reduce((s, e) => s + e.amount, 0)) : contingencyBuffer;
  const grandTotalCost = round2(totalCost + expensesTotal);
  const grossProfit = round2(totalRev - totalCost);
  const netProfit = round2(totalRev - grandTotalCost);
  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
  const vatAmount = round2(totalRev * vatRate);

  let durationDays = 1;
  if (opts.startDate && opts.endDate) {
    const s = new Date(opts.startDate).getTime();
    const e = new Date(opts.endDate).getTime();
    if (Number.isFinite(s) && Number.isFinite(e) && e >= s) durationDays = Math.max(1, Math.ceil((e - s) / 86400000));
  }

  return {
    equipCount: equip.length,
    equipTotalQty: equip.reduce((s, l) => s + l.qty, 0),
    equipCost,
    equipRev,
    laborCount: labor.length,
    laborTotalPoints: labor.reduce((s, l) => s + l.qty, 0),
    laborCost,
    laborRev,
    totalCost,
    totalRev,
    contingencyRate,
    contingencyBuffer,
    expenseLines,
    expensesTotal,
    grandTotalCost,
    grossProfit,
    netProfit,
    gpPercent: pct(grossProfit, totalRev),
    netProfitPercent: pct(netProfit, totalRev),
    markupPercent: pct(grossProfit, totalCost),
    costToRevRatio: pct(totalCost, totalRev),
    vatRate,
    vatAmount,
    grandTotalWithVat: round2(totalRev + vatAmount),
    durationDays,
    revenuePerDay: Math.round(totalRev / durationDays),
    costPerDay: Math.round(totalCost / durationDays),
  };
}

export type ProjectBudget = ReturnType<typeof computeProjectBudget>;
