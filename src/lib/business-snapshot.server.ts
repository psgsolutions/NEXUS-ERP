import { listProducts } from "@/lib/product-store.server";
import { adminDb } from "@/lib/firebase-admin";
import { lastMonthKeys, lowStockProducts, activeProjects, monthlyProfitAndLoss, overdueInvoices, toMillis } from "@/lib/dashboard-metrics";
import { PROJECT_STATUS_TH } from "@/lib/project-status";

/**
 * สรุปข้อมูลธุรกิจจริงของบริษัทแบบย่อ (ไม่รวมข้อมูลตัวอย่าง) สำหรับส่งให้ AI ตอบคำถาม
 * เก็บเฉพาะตัวเลขสรุปและรายการสำคัญเพื่อลดขนาดและไม่ส่งข้อมูลส่วนบุคคลเกินจำเป็น
 * (ไม่ส่งเงินเดือนรายคน เลขบัตรประชาชน หรือเลขบัญชีธนาคาร)
 */

const r2 = (n: number) => Math.round(n * 100) / 100;
const live = (d: any) => d.isDeleted !== true && !d.isSample;
const dateOf = (v: any) => { const ms = toMillis(v); return ms ? new Date(ms + 7 * 3600e3).toISOString().slice(0, 10) : ""; };

export async function buildBusinessSnapshot(companyId: string) {
  const c = `companies/${companyId}`;
  const [company, invoices, expenses, journals, products, projects, receipts, payments, employees, workOrders] = await Promise.all([
    adminDb.doc(c).get(),
    adminDb.collection(`${c}/invoices`).get(),
    adminDb.collection(`${c}/expenses`).get(),
    adminDb.collection(`${c}/journal_entries`).get(),
    listProducts(companyId),
    adminDb.collection(`${c}/projects`).get(),
    adminDb.collection(`${c}/receipts`).get(),
    adminDb.collection(`${c}/payments`).get(),
    adminDb.collection("employees").where("companyId", "==", companyId).get(),
    adminDb.collection(`${c}/work_orders`).get(),
  ]);
  const rows = (s: FirebaseFirestore.QuerySnapshot) => s.docs.map((d) => ({ id: d.id, ...d.data() } as any)).filter(live);
  const inv = rows(invoices);
  const exp = rows(expenses);
  const today = dateOf(Date.now());

  const arOpen = inv.filter((i) => String(i.paymentStatus || "").toLowerCase() !== "paid" && String(i.status || "").toLowerCase() !== "cancelled");
  const arBalance = (i: any) => Number(i.balance ?? i.grandTotal ?? 0);
  const apOpen = exp.filter((e) => !String(e.status || "").startsWith("Paid") && String(e.status || "").toLowerCase() !== "cancelled");
  const apBalance = (e: any) => Number(e.balance ?? e.totalAmount ?? 0);
  const byCustomer = new Map<string, number>();
  arOpen.forEach((i) => byCustomer.set(i.customerName || "-", (byCustomer.get(i.customerName || "-") || 0) + arBalance(i)));

  const months = lastMonthKeys(6);
  const pl = monthlyProfitAndLoss(rows(journals), months);
  const posted = (s: FirebaseFirestore.QuerySnapshot) => rows(s).filter((x) => String(x.status || "").toLowerCase() !== "cancelled");

  return {
    asOf: today,
    company: { name: company.data()?.name || companyId },
    currency: "THB",
    profitAndLossByMonth: pl.map((m) => ({ month: m.label, revenue: m.revenue, expense: m.expense, profit: r2(m.revenue - m.expense) })),
    sales: {
      invoiceCount: inv.length,
      recentInvoices: inv
        .sort((a, b) => toMillis(b.issueDate || b.createdAt) - toMillis(a.issueDate || a.createdAt))
        .slice(0, 15)
        .map((i) => ({ no: i.invoiceNo || i.documentNo || i.id, customer: i.customerName || "-", date: dateOf(i.issueDate || i.createdAt), total: r2(Number(i.grandTotal) || 0), status: i.paymentStatus || i.status || "" })),
    },
    receivables: {
      outstandingTotal: r2(arOpen.reduce((s, i) => s + arBalance(i), 0)),
      openInvoiceCount: arOpen.length,
      overdue: overdueInvoices(arOpen).map((i: any) => ({ no: i.invoiceNo || i.id, customer: i.customerName || "-", dueDate: dateOf(i.dueDate), balance: r2(arBalance(i)) })).slice(0, 20),
      topCustomers: Array.from(byCustomer.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([customer, balance]) => ({ customer, balance: r2(balance) })),
    },
    payables: {
      outstandingTotal: r2(apOpen.reduce((s, e) => s + apBalance(e), 0)),
      openCount: apOpen.length,
      items: apOpen.sort((a, b) => apBalance(b) - apBalance(a)).slice(0, 15).map((e) => ({ no: e.expenseId || e.id, payee: e.supplierName || e.vendor || e.employeeName || "-", dueDate: dateOf(e.dueDate), balance: r2(apBalance(e)) })),
    },
    cash: {
      receiptsLast30Days: r2(posted(receipts).filter((r) => (r.paymentDate || "") >= dateOf(Date.now() - 30 * 86400e3)).reduce((s, r) => s + (Number(r.cashReceived ?? r.amount) || 0), 0)),
      paymentsLast30Days: r2(posted(payments).filter((p) => (p.paymentDate || "") >= dateOf(Date.now() - 30 * 86400e3)).reduce((s, p) => s + (Number(p.netPaid ?? p.totalAmount) || 0), 0)),
    },
    inventory: {
      productCount: products.filter(live).length,
      lowStock: lowStockProducts(products.filter(live)).slice(0, 20).map((p) => ({ sku: p.sku, name: p.name, onHand: p.onHand, reorderPoint: p.min, unit: p.unit })),
    },
    projects: activeProjects(rows(projects)).slice(0, 25).map((p) => {
      const full = rows(projects).find((x) => x.id === p.id) || {};
      return { code: p.code, name: p.name, status: PROJECT_STATUS_TH[p.status], progress: p.progress, endDate: dateOf(full.endDate), contractValue: r2(Number(full.budget) || 0), budgetCost: r2(Number(full.allocatedCost) || 0), actualCost: r2(Number(full.actualCost) || 0) };
    }),
    workOrders: {
      open: rows(workOrders).filter((w) => String(w.status || "").toUpperCase() !== "COMPLETED").length,
      completedLast30Days: rows(workOrders).filter((w) => String(w.status || "").toUpperCase() === "COMPLETED" && toMillis(w.completedAt) > Date.now() - 30 * 86400e3).length,
    },
    people: { activeEmployees: rows(employees).filter((e) => String(e.status || "active").toLowerCase() !== "resigned").length },
  };
}
