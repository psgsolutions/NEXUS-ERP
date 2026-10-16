import { NextResponse } from "next/server";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can, canAny } from "@/lib/permissions";
import { agingSummary, payableRows, receivableRows } from "@/lib/executive-metrics";
import { assetRegister, bankBook, bookOf, customerStatement, inventoryValuation, payeeKeyOf, stockCard, supplierStatement, type BankAccount } from "@/lib/subledgers";
import { monthEnd } from "@/lib/financial-reports";

/**
 * [API-SERVER] บัญชีย่อยและทะเบียน
 * Endpoint: POST /api/reports/subledger { companyId, report, from?, to? (YYYY-MM), customerId?, payeeKey?, bookId?, productId? }
 *  report: ar-aging | ap-aging | ar-statement | ap-statement | bank-book | cheques | assets   (ฝ่ายบัญชี/ผู้บริหาร)
 *          stock-card (ผู้ดูคลังสินค้า; ต้นทุนเห็นเฉพาะผู้มีสิทธิ์ดูต้นทุน) | valuation (บัญชี/ผู้บริหาร)
 */

const YM = /^\d{4}-(0[1-9]|1[0-2])$/;
const thisMonth = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 7);
const str = (v: any, max = 200) => String(v ?? "").trim().slice(0, max);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const apiUser = await requireApiUser(request, companyId);
    const report = str(body.report, 30);
    const to = YM.test(String(body.to || "")) ? String(body.to) : thisMonth();
    const from = YM.test(String(body.from || "")) ? String(body.from) : to;
    if (from > to) throw new ApiAuthError(400, "ช่วงเวลาไม่ถูกต้อง");
    const fromDate = `${from}-01`, toDate = monthEnd(to);
    const col = (c: string) => adminDb.collection(`companies/${companyId}/${c}`).get().then((s) => s.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    const root = (c: string) => adminDb.collection(c).where("companyId", "==", companyId).get().then((s) => s.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    const base = { success: true, report, from, to, fromDate, toDate, generatedAt: new Date().toISOString() };
    const finance = can(apiUser.roles, "finance:view");
    const needFinance = () => { if (!finance) throw new ApiAuthError(403, "รายงานนี้เปิดได้เฉพาะฝ่ายบัญชีและผู้บริหาร"); };

    if (report === "ar-aging" || report === "ap-aging") {
      needFinance();
      const rows = report === "ar-aging" ? receivableRows(await col("invoices")) : payableRows(await col("expenses"));
      return NextResponse.json({ ...base, ...agingSummary(rows, Date.now(), 1000) });
    }

    if (report === "ar-statement") {
      needFinance();
      const [invoices, receipts, cndns, refunds] = await Promise.all([col("invoices"), col("receipts"), col("cndn"), col("customer_refunds")]);
      const parties = Array.from(new Map(invoices.filter((i) => i.customerId).map((i) => [String(i.customerId), String(i.customerName || i.customerSnapshot?.name || i.customerId)])).entries())
        .map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "th"));
      const customerId = str(body.customerId, 120) || parties[0]?.id || "";
      const party = parties.find((p) => p.id === customerId) || null;
      const snapshot = invoices.find((i) => i.customerId === customerId)?.customerSnapshot || null;
      return NextResponse.json({ ...base, parties, party, partyInfo: snapshot, customerId, statement: customerId ? customerStatement(customerId, { invoices, receipts, cndns, refunds }, fromDate, toDate) : null });
    }

    if (report === "ap-statement") {
      needFinance();
      const [expenses, payments] = await Promise.all([col("expenses"), col("payments")]);
      const parties = Array.from(new Map(expenses.map((e) => [payeeKeyOf(e), String(e.supplierName || e.vendor || e.employeeName || "ไม่ระบุ")])).entries())
        .filter(([k]) => k !== "NAME:-").map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "th"));
      const payeeKey = str(body.payeeKey, 200) || parties[0]?.id || "";
      return NextResponse.json({ ...base, parties, party: parties.find((p) => p.id === payeeKey) || null, payeeKey, statement: payeeKey ? supplierStatement(payeeKey, { expenses, payments }, fromDate, toDate) : null });
    }

    if (report === "bank-book") {
      needFinance();
      const [accountsRaw, receipts, payments, refunds] = await Promise.all([col("bank_accounts"), col("receipts"), col("payments"), col("customer_refunds")]);
      const accounts: BankAccount[] = accountsRaw.filter((a) => a.isDeleted !== true).map((a) => ({ id: a.id, name: a.name, bankName: a.bankName, accountNo: a.accountNo, openingBalance: a.openingBalance, openingDate: a.openingDate, legacyLabels: a.legacyLabels }));
      const counts = new Map<string, number>();
      for (const d of [...receipts, ...payments, ...refunds]) { const b = bookOf(d, accounts); counts.set(b, (counts.get(b) || 0) + 1); }
      const books = [
        ...accountsRaw.filter((a) => a.isDeleted !== true).map((a) => ({ id: a.id, name: `${a.name} ${a.accountNo || ""}`.trim(), active: a.active !== false, count: counts.get(a.id) || 0, account: a })),
        { id: "CASH", name: "เงินสด", active: true, count: counts.get("CASH") || 0, account: null },
        ...(counts.get("UNASSIGNED") ? [{ id: "UNASSIGNED", name: "ยังไม่ระบุบัญชี (ข้อมูลเดิม)", active: true, count: counts.get("UNASSIGNED") || 0, account: null }] : []),
      ];
      const bookId = str(body.bookId, 120) || books[0]?.id || "CASH";
      return NextResponse.json({ ...base, books, bookId, book: bankBook(bookId, accounts, { receipts, payments, refunds }, fromDate, toDate) });
    }

    if (report === "cheques") {
      needFinance();
      const rows = (await col("cheques")).filter((c) => c.isDeleted !== true)
        .map((c) => ({ id: c.id, direction: c.direction, chequeNo: c.chequeNo, chequeDate: c.chequeDate, chequeBank: c.chequeBank || "", bankAccount: c.bankAccount || "", party: c.party || "", amount: c.amount || 0, status: c.status, docNo: c.docNo, docKind: c.docKind }))
        .sort((a, b) => String(a.chequeDate).localeCompare(String(b.chequeDate)));
      return NextResponse.json({ ...base, rows });
    }

    if (report === "assets") {
      needFinance();
      const [assets, runs] = await Promise.all([root("assets"), root("assetDepreciations")]);
      const history = runs.map((r) => ({ period: r.period, total: r.totalAmount ?? r.total ?? 0, count: r.assetCount ?? (r.assets || []).length ?? 0, journalId: r.journalId || "" }))
        .sort((a, b) => String(b.period).localeCompare(String(a.period))).slice(0, 24);
      return NextResponse.json({ ...base, ...assetRegister(assets), history });
    }

    if (report === "valuation") {
      if (!finance && !can(apiUser.roles, "sales:cost")) throw new ApiAuthError(403, "มูลค่าสินค้าคงเหลือเปิดได้เฉพาะฝ่ายบัญชีและผู้บริหาร");
      return NextResponse.json({ ...base, ...inventoryValuation(await root("products")) });
    }

    if (report === "stock-card") {
      if (!can(apiUser.roles, "inventory:view")) throw new ApiAuthError(403, "สิทธิ์การใช้งานไม่เพียงพอ");
      const showCost = finance || can(apiUser.roles, "sales:cost") || canAny(apiUser.roles, ["procurement:edit"]);
      const products = (await root("products")).filter((p) => p.isDeleted !== true && (p.itemType || "PRODUCT") === "PRODUCT")
        .map((p) => ({ id: p.id, sku: p.sku || "", name: p.name || p.productName || p.id, unit: p.unit || "ชิ้น" }))
        .sort((a, b) => String(a.sku || a.name).localeCompare(String(b.sku || b.name)));
      const productId = str(body.productId, 120) || products[0]?.id || "";
      if (!productId) return NextResponse.json({ ...base, products, productId, card: null, showCost });
      const [co, legacy] = await Promise.all([
        adminDb.collection(`companies/${companyId}/stock_movements`).where("productId", "==", productId).get(),
        adminDb.collection("stockMovements").where("companyId", "==", companyId).where("productId", "==", productId).get(),
      ]);
      const card = stockCard([...co.docs, ...legacy.docs].map((d) => d.data()), fromDate, toDate);
      if (!showCost) card.entries.forEach((e: any) => { e.unitCost = 0; e.wac = 0; e.value = 0; });
      return NextResponse.json({ ...base, products, productId, product: products.find((p) => p.id === productId) || null, card: showCost ? card : { ...card, openingValue: 0, closingValue: 0 }, showCost });
    }

    throw new ApiAuthError(400, "ไม่พบรายงานที่ต้องการ");
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error("[SUBLEDGER_REPORT_ERROR]:", error);
    return NextResponse.json({ success: false, error: "สร้างรายงานไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
