/**
 * ต้นทุนจริงของโครงการเทียบงบประมาณ (ฟังก์ชันล้วน)
 * คำนวณจากเอกสารต้นทาง ไม่ใช้ตัวนับสะสม (ไม่คลาดเคลื่อนเมื่อมีการยกเลิกเอกสาร)
 *
 *  วัสดุ/อุปกรณ์   = ค่าใช้จ่ายจากใบสั่งซื้อประเภท "โครงการ" + ต้นทุนสินค้าที่เบิกจากคลังตามใบสั่งขายของโครงการ
 *  ค่าแรง/ผู้รับเหมา = ค่าใช้จ่ายผู้รับเหมา (Subcontract)
 *  ค่าใช้จ่ายดำเนินงาน = ใบเบิกค่าใช้จ่ายที่ระบุโครงการ + ค่าใช้จ่ายหน้างาน (บันทึกจากหน้าช่าง)
 *  ผูกพันแล้ว       = ใบสั่งซื้อประเภทโครงการที่อนุมัติแล้วแต่ยังไม่ตั้งเป็นค่าใช้จ่าย
 * ทุกยอดเป็นยอดก่อน VAT
 */

export type CostCategory = "materials" | "labor" | "operating";
export const COST_CATEGORY_TH: Record<CostCategory, string> = {
  materials: "วัสดุและอุปกรณ์",
  labor: "ค่าแรงและผู้รับเหมา",
  operating: "ค่าใช้จ่ายดำเนินงาน",
};

export interface CostLine {
  date: string;
  category: CostCategory;
  source: string;
  docNo: string;
  description: string;
  amount: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const live = (x: any) => x && x.isDeleted !== true && x.isSample !== true && String(x.status || "").toLowerCase() !== "cancelled";
const dateOf = (v: any) => {
  if (!v) return "";
  if (typeof v === "string") return v.slice(0, 10);
  const secs = v.seconds ?? v._seconds;
  return secs !== undefined ? new Date(secs * 1000 + 7 * 3600e3).toISOString().slice(0, 10) : "";
};

export function projectCostLines(input: {
  expenses: any[];          // companies/{c}/expenses ที่ projectId = โครงการ
  purchaseOrders: any[];    // ใบสั่งซื้อที่ projectId = โครงการ
  siteJournals: any[];      // รายการบัญชีค่าใช้จ่ายหน้างาน (projectId = โครงการ)
  stockIssueJournals: { soNo: string; journal: any }[]; // รายการบัญชีต้นทุนขายจากการเบิกตามใบสั่งขายของโครงการ
}): { lines: CostLine[]; committed: CostLine[] } {
  const lines: CostLine[] = [];
  const poById = new Map(input.purchaseOrders.map((p) => [String(p.poCode || p.documentNo || p.id), p]));

  for (const e of input.expenses) {
    if (!live(e)) continue;
    const type = String(e.documentType || "");
    const base = r2(Number(e.subTotal ?? (Number(e.totalAmount) || 0) - (Number(e.vatAmount) || 0)) || 0);
    if (!(base > 0)) continue;
    let category: CostCategory, source: string;
    if (type === "Subcontract") { category = "labor"; source = "ผู้รับเหมา"; }
    else if (type === "ExpenseClaim") { category = "operating"; source = "เบิกค่าใช้จ่าย"; }
    else {
      // ใบสั่งซื้อเข้าสต็อก: นับเป็นต้นทุนตอนเบิกจากคลัง (ไม่นับซ้ำตอนตั้งหนี้)
      const po = e.poRef ? poById.get(String(e.poRef)) : null;
      if (po && String(po.orderType || "STOCK") !== "PROJECT") continue;
      category = "materials"; source = "ซื้อเข้าโครงการ";
    }
    lines.push({
      date: dateOf(e.supplierTaxInvoiceDate || e.issueDate || e.createdAt), category, source,
      docNo: String(e.expenseId || e.id), description: String(e.description || e.supplierName || e.vendor || e.poRef || ""), amount: base,
    });
  }

  for (const j of input.siteJournals) {
    if (!live(j)) continue;
    // นับเฉพาะเดบิตงานระหว่างทำ (1161) — ไม่นับภาษีซื้อหรือรายการเงินสดในใบสำคัญเดียวกัน
    const wip = (Array.isArray(j.items) ? j.items : []).filter((l: any) => String(l.accountCode) === "1161-00");
    const amount = r2(wip.length ? wip.reduce((s: number, l: any) => s + (Number(l.debit) || 0), 0) : Number(j.totalDebit) || 0);
    if (!(amount > 0)) continue;
    lines.push({ date: dateOf(j.date || j.createdAt), category: "operating", source: "ค่าใช้จ่ายหน้างาน", docNo: String(j.reference || j.id || ""), description: String(j.description || "").replace(/^\[[^\]]+\]\s*/, ""), amount });
  }

  for (const { soNo, journal: j } of input.stockIssueJournals) {
    if (!live(j)) continue;
    const amount = r2((j.items || j.lines || []).filter((l: any) => String(l.accountCode) === "5111-00").reduce((s: number, l: any) => s + (Number(l.debit) || 0) - (Number(l.credit) || 0), 0));
    if (!(amount > 0)) continue;
    lines.push({ date: dateOf(j.date || j.createdAt), category: "materials", source: "เบิกจากคลัง", docNo: soNo, description: String(j.description || "").replace(/^\[AUTO\]\s*/, ""), amount });
  }

  // ผูกพันแล้ว: ใบสั่งซื้อโครงการที่อนุมัติแต่ยังไม่ตั้งค่าใช้จ่าย
  const expensedPo = new Set(input.expenses.filter(live).map((e) => String(e.poRef || "")).filter(Boolean));
  const committed: CostLine[] = input.purchaseOrders
    .filter((p) => live(p) && String(p.orderType) === "PROJECT" && ["APPROVED", "PARTIAL_RECEIVED", "RECEIVED"].includes(String(p.status || "").toUpperCase()))
    .filter((p) => !expensedPo.has(String(p.poCode || p.documentNo || p.id)) && !p.expenseId)
    .map((p) => ({ date: dateOf(p.date || p.createdAt), category: "materials" as CostCategory, source: "ใบสั่งซื้อรอตั้งหนี้", docNo: String(p.poCode || p.id), description: String(p.supplierName || ""), amount: r2(Number(p.subTotal) || 0) }))
    .filter((l) => l.amount > 0);

  return { lines: lines.sort((a, b) => a.date.localeCompare(b.date) || a.docNo.localeCompare(b.docNo)), committed };
}

export interface BudgetByCategory { materials: number; labor: number; operating: number }

export function costVsBudget(budget: BudgetByCategory, lines: CostLine[], committed: CostLine[]) {
  const sum = (arr: CostLine[], c: CostCategory) => r2(arr.filter((l) => l.category === c).reduce((s, l) => s + l.amount, 0));
  const rows = (Object.keys(COST_CATEGORY_TH) as CostCategory[]).map((c) => {
    const b = r2(Number(budget[c]) || 0), actual = sum(lines, c), comm = sum(committed, c);
    return { category: c, label: COST_CATEGORY_TH[c], budget: b, actual, committed: comm, remaining: r2(b - actual - comm), usedPercent: b > 0 ? Math.round(((actual + comm) / b) * 1000) / 10 : null };
  });
  const total = {
    budget: r2(rows.reduce((s, r) => s + r.budget, 0)), actual: r2(rows.reduce((s, r) => s + r.actual, 0)), committed: r2(rows.reduce((s, r) => s + r.committed, 0)),
  };
  return { rows, total: { ...total, remaining: r2(total.budget - total.actual - total.committed), usedPercent: total.budget > 0 ? Math.round(((total.actual + total.committed) / total.budget) * 1000) / 10 : null } };
}

/** ประมาณการกำไร: รายได้ตามสัญญา − ต้นทุนที่คาดว่าจะใช้ (หมวดละ ค่าที่มากกว่าระหว่างงบกับจริง+ผูกพัน) */
export function forecastProfit(revenue: number, cmp: ReturnType<typeof costVsBudget>) {
  const expected = r2(cmp.rows.reduce((s, r) => s + Math.max(r.budget, r.actual + r.committed), 0));
  const profit = r2((Number(revenue) || 0) - expected);
  return { expectedCost: expected, profit, percent: revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : null };
}
