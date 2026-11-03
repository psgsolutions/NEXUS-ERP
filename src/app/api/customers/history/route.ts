import { NextResponse } from "next/server";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can, canAny } from "@/lib/permissions";
import { quotationStage, QUOTATION_STAGE } from "@/lib/quotation-status";

/**
 * [API-SERVER] ประวัติการค้าขายกับลูกค้า (ของบริษัทที่เลือก)
 * Endpoint: POST /api/customers/history { companyId, customerId }
 * คืน: โครงการ · ใบเสนอราคา · ใบสั่งขาย · ใบกำกับภาษี/ใบแจ้งหนี้ · ใบเสร็จ · งานบริการ (แจ้งซ่อม/ใบงาน) + ยอดสรุป
 * อ่านด้วยสิทธิ์ server (ไม่ต้องเปิด rules ให้หน้าจออ่านทุก collection) — แต่ละส่วนแสดงตามสิทธิ์ของผู้ใช้
 */

const LIMIT = 100;
const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const dateOf = (v: any): string => {
  if (!v) return "";
  if (typeof v === "string") return v.slice(0, 10);
  const ms = v.seconds ? v.seconds * 1000 : typeof v.toMillis === "function" ? v.toMillis() : 0;
  return ms ? new Date(ms + 7 * 3600e3).toISOString().slice(0, 10) : "";
};

interface Row { id: string; no: string; date: string; title: string; amount: number | null; status: string; href: string; extra?: string }

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = String(body.companyId || "").trim();
    const customerId = String(body.customerId || "").trim();
    if (!companyId || !customerId) throw new ApiAuthError(400, "ข้อมูลไม่ครบ");
    const apiUser = await requireApiUser(request, companyId);
    if (!canAny(apiUser.roles, ["sales:view", "finance:view", "projects:view"])) throw new ApiAuthError(403, "ไม่มีสิทธิ์ดูประวัติลูกค้า");
    const roles = apiUser.roles;
    const col = (name: string) => adminDb.collection(`companies/${companyId}/${name}`).where("customerId", "==", customerId).limit(LIMIT).get();
    const live = (d: FirebaseFirestore.QueryDocumentSnapshot) => d.data().isDeleted !== true;
    const sortDesc = (rows: Row[]) => rows.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    const seeSales = can(roles, "sales:view") || can(roles, "finance:view");
    const [projects, quotations, orders, invoices, receipts, tickets, jobs] = await Promise.all([
      canAny(roles, ["projects:view", "sales:view"]) ? col("projects") : null,
      seeSales ? col("quotations") : null,
      seeSales ? col("sales_orders") : null,
      seeSales ? col("invoices") : null,
      can(roles, "finance:view") || can(roles, "sales:billing") ? col("receipts") : null,
      col("service_tickets"),
      col("jobs"),
    ]);

    const out = {
      projects: sortDesc((projects?.docs || []).filter(live).map((d) => {
        const p = d.data();
        return { id: d.id, no: String(p.projectId || p.projectCode || d.id), date: dateOf(p.startDate || p.createdAt), title: String(p.projectName || p.title || p.name || "-"),
          amount: num(p.contractValue ?? p.contractAmount ?? p.budget ?? p.totalValue) || null, status: String(p.status || "-"), href: `/projects/${encodeURIComponent(d.id)}` };
      })),
      quotations: sortDesc((quotations?.docs || []).filter(live).map((d) => {
        const q = d.data();
        return { id: d.id, no: String(q.documentNo || q.quotationNumber || d.id), date: dateOf(q.docDate || q.date || q.createdAt), title: String(q.projectName || q.subject || "-"),
          amount: num(q.grandTotal) || null, status: QUOTATION_STAGE[quotationStage(q)].label, href: `/sales/quotations/${encodeURIComponent(d.id)}`, extra: q.linkedSo ? `→ ${q.linkedSo}` : undefined };
      })),
      orders: sortDesc((orders?.docs || []).filter(live).map((d) => {
        const s = d.data();
        return { id: d.id, no: String(s.documentNo || s.soId || d.id), date: dateOf(s.docDate || s.createdAt), title: String(s.projectName || s.quotationNo || "-"),
          amount: num(s.grandTotal ?? s.totalAmount) || null, status: String(s.status || "-"), href: `/sales/orders/${encodeURIComponent(d.id)}`, extra: s.invoiceNo ? `ใบกำกับ ${s.invoiceNo}` : undefined };
      })),
      invoices: sortDesc((invoices?.docs || []).filter(live).map((d) => {
        const i = d.data();
        const cancelled = String(i.status || "").toLowerCase() === "cancelled";
        return { id: d.id, no: String(i.invoiceNo || i.documentNo || d.id), date: dateOf(i.issueDate || i.createdAt), title: String(i.projectName || i.orderRefNo || "-"),
          amount: num(i.grandTotal) || null, status: cancelled ? "ยกเลิก" : i.paymentStatus === "paid" ? "ชำระครบ" : i.paymentStatus === "partial" ? "ชำระบางส่วน" : "ค้างชำระ",
          href: "/sales?tab=invoices", extra: !cancelled && num(i.balance) > 0 ? `ค้าง ${num(i.balance).toLocaleString("th-TH", { minimumFractionDigits: 2 })}` : undefined };
      })),
      receipts: sortDesc((receipts?.docs || []).filter(live).map((d) => {
        const r = d.data();
        return { id: d.id, no: String(r.receiptNo || r.documentNo || d.id), date: dateOf(r.paymentDate || r.createdAt), title: String(r.invoiceNo || "-"),
          amount: num(r.totalApplied ?? r.amount) || null, status: String(r.status || "-") === "cancelled" ? "ยกเลิก" : String(r.paymentMethodLabel || "รับแล้ว"), href: "/finance" };
      })),
      service: sortDesc([
        ...(tickets?.docs || []).filter(live).map((d) => {
          const t = d.data();
          return { id: d.id, no: d.id, date: dateOf(t.createdAt), title: String(t.productName || t.symptom || "แจ้งซ่อม").slice(0, 120), amount: null, status: String(t.status || "-"), href: "/support" };
        }),
        ...(jobs?.docs || []).filter(live).map((d) => {
          const j = d.data();
          return { id: d.id, no: String(j.jobNo || d.id), date: String(j.scheduledDate || dateOf(j.createdAt)), title: String(j.title || "-"), amount: null, status: String(j.status || "-"), href: "/service/dispatch" };
        }),
      ]),
    };
    const active = out.invoices.filter((i) => i.status !== "ยกเลิก");
    const summary = {
      projects: out.projects.length,
      quotations: out.quotations.length,
      won: out.quotations.filter((q) => q.status === QUOTATION_STAGE.won.label).length,
      salesTotal: r2(active.reduce((s, i) => s + num(i.amount), 0)),
      outstanding: r2((invoices?.docs || []).filter(live).filter((d) => String(d.data().status || "").toLowerCase() !== "cancelled").reduce((s, d) => s + Math.max(0, num(d.data().balance)), 0)),
      lastDealDate: [...out.invoices, ...out.orders, ...out.quotations].map((r) => r.date).filter(Boolean).sort().pop() || "",
      truncated: [projects, quotations, orders, invoices, receipts, tickets, jobs].some((s) => (s?.size || 0) >= LIMIT),
    };
    return NextResponse.json({ success: true, summary, ...out });
  } catch (err: any) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    console.error("[CUSTOMER_HISTORY]", err);
    return NextResponse.json({ success: false, error: "โหลดประวัติลูกค้าไม่สำเร็จ" }, { status: 500 });
  }
}
