"use client";

import { DocumentPdfModal } from "@/components/documents/DocumentPdfViewer";
import { useSystemDialog } from "@/context/DialogContext";
import React, { useState, useEffect } from "react";
import {
  Users,
  Plus,
  Search,
  FileText,
  Target,
  TrendingUp,
  MessageSquare,
  Bell,
  Sparkles,
  Building2,
  ClipboardList,
  ChevronDown,
  CreditCard,
  MapPin,
  UserCheck,
  ShieldCheck,
  Receipt,
  Trash2,
  Filter,
  Landmark,
  User,
  RefreshCw,
  CalendarDays,
  Percent,
  Printer,
  Copy,
  Ban
} from "lucide-react";
import {
  PillButton,
  PillInput,
  PillSelect,
  MasterMetricCard,
  cn,
  Modal,
  Toast,
  NexusTable,
  NexusTableRow,
  NexusTableCell,
  StatusBadge,
  PillTabs,
  GlassCard,
  NexusDataField,
  NexusSearchInput
} from "@/components/ui/Base";
import { DocumentFlowStepper } from "@/components/ui/DocumentFlowStepper";
import { OpportunityScorer } from "@/components/sales/OpportunityScorer";
import { CustomerModal } from "@/components/commerce/CustomerModal";
import { QuotationModal } from "@/components/commerce/QuotationModal";
import { SalesOrderModal } from "@/components/commerce/SalesOrderModal";
import { BillingNoteModal } from "@/components/commerce/BillingNoteModal";
import { CNDNModal } from "@/components/commerce/CNDNModal";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { SecureDeleteAction } from "@/components/ui/SecureDeleteAction";
import { EmptyGuide } from "@/components/guide/Guidance";
import { useAdvancedTabs } from "@/components/guide/Onboarding";
import { useAuth } from "@/context/AuthContext";
import { useCustomers } from "@/hooks/useCustomers";
import { auditService } from "@/services/audit.service";
import { db } from "@/lib/firebase-client";
import { collection, query, where, onSnapshot, doc, setDoc } from "firebase/firestore";

export async function handleConvertSOApi(quoteId: string, companyId: string) {
  const res = await apiFetch("/api/sales/convert-so", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quoteId, companyId })
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "เกิดข้อผิดพลาดในการแปลงใบสั่งขาย");
  }
  return data.soId;
}

import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { can } from "@/lib/permissions";
import { quotationCanDelete, QUOTATION_STAGE, quotationStage, quotationValidUntil, type QuotationStage } from "@/lib/quotation-status";


// ---------- แปลงเอกสารจาก Firestore เป็นแถวในตาราง (ข้อมูลจริงเท่านั้น ไม่มี mock) ----------
const toDateStr = (v: any): string => {
  if (!v) return "-";
  if (typeof v === "string") return v.split("T")[0];
  if (v.seconds) return new Date(v.seconds * 1000).toISOString().split("T")[0];
  if (v instanceof Date) return v.toISOString().split("T")[0];
  return "-";
};
const toMoney = (n: any): string => `฿${Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const firstOf = (d: any, keys: string[]) => keys.map(k => d[k]).find(v => v !== undefined && v !== null && v !== "");

// raw ข้อมูลอยู่ก่อน ค่าที่จัดรูปแบบแล้ววางทับ; docId = ID จริงของเอกสาร (ใช้ลบ/อ้างอิง), id = เลขเอกสารที่แสดง
const toRow = (snap: any, display: (d: any) => Record<string, any>) => {
  const d = snap.data();
  return {
    ...d,
    docId: snap.id,
    customerNameRaw: firstOf(d, ["customerName", "customerId", "customer"]) || "",
    ...display(d),
  };
};


type SalesSubModule = "crm" | "opportunities" | "quotations" | "orders" | "invoices" | "billing" | "receipts" | "cndn";

export default function SalesPage() {
  const { showConfirm } = useSystemDialog();
  const router = useRouter();

  const { user, companyId, role: userRole, roles } = useAuth();
  const [activeTab, setActiveTab] = useState<SalesSubModule>("quotations");
  const [quoteFilter, setQuoteFilter] = useState<"all" | QuotationStage>("all");
  // เปิดแท็บ/ตัวกรองจาก URL เช่น /sales?tab=quotations&status=pending (หน้า /sales/quotations เดิมส่งต่อมาที่นี่)
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const tab = qs.get("tab") as SalesSubModule | null;
    if (tab && ["crm", "opportunities", "quotations", "orders", "invoices", "billing", "receipts", "cndn"].includes(tab)) setActiveTab(tab);
    const st = qs.get("status") as QuotationStage | null;
    if (st && st in QUOTATION_STAGE) setQuoteFilter(st);
  }, []);

  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [cndnCancel, setCndnCancel] = useState<{ docId: string; no: string; reason: string } | null>(null);
  // พิมพ์/ดูเอกสาร (เทมเพลตมาตรฐาน)
  const [printDoc, setPrintDoc] = useState<{ type: string; id: string; title: string } | null>(null);
  // ยกเลิกใบกำกับภาษี / ยกเลิกและออกใบแทน (แก้ข้อมูลผู้ซื้อ)
  const [invCancel, setInvCancel] = useState<{ docId: string; no: string; reason: string; replace: boolean; customer: { name: string; taxId: string; branch: string; address: string } } | null>(null);
  const [invBusy, setInvBusy] = useState(false);
  const canCancelInvoice = can(roles, "finance:edit") || can(roles, "sales:approve");
  const openInvoiceCancel = (inv: any) => {
    const c = inv.customerSnapshot || {};
    setInvCancel({ docId: inv.docId, no: inv.id, reason: "", replace: true, customer: { name: c.name || c.customerName || inv.customerName || "", taxId: c.taxId || c.customerTaxId || "", branch: c.branch || c.customerBranch || "", address: c.address || c.customerAddress || "" } });
  };
  const cancelInvoice = async () => {
    if (!invCancel || !companyId) return;
    setInvBusy(true);
    try {
      const res = await apiFetch("/api/sales/tax-invoice/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, invoiceDocId: invCancel.docId, reason: invCancel.reason, replace: invCancel.replace, ...(invCancel.replace ? { customer: invCancel.customer } : {}) }) });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || "ยกเลิกไม่สำเร็จ");
      setInvCancel(null);
      showToast(d.mode === "replaced" ? `ยกเลิก ${d.invoiceNo} และออกใบแทนเลขที่ ${d.newInvoiceNo} แล้ว` : `ยกเลิก ${d.invoiceNo} แล้ว ใบสั่งขายกลับไปออกใบกำกับใหม่ได้`);
      if (d.mode === "replaced") setPrintDoc({ type: "invoice", id: d.newInvoiceDocId, title: `ใบกำกับภาษี ${d.newInvoiceNo}` });
    } catch (e: any) { showToast(e.message); } finally { setInvBusy(false); }
  };
  const [cndnBusy, setCndnBusy] = useState(false);
  const cancelCndn = async () => {
    if (!cndnCancel || !companyId) return;
    try {
      setCndnBusy(true);
      const res = await apiFetch("/api/sales/cndn/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, cndnId: cndnCancel.docId, reason: cndnCancel.reason }) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "ยกเลิกไม่สำเร็จ");
      showToast(`ยกเลิก ${data.docNo} แล้ว — ยอดค้างใบกำกับ ${data.invoiceNo} เหลือ ฿${Number(data.balanceAfter).toLocaleString("th-TH", { minimumFractionDigits: 2 })}${data.journal === "reversed" ? " · สร้างรายการกลับบัญชีรออนุมัติ" : ""}`);
      setCndnCancel(null);
    } catch (e: any) {
      showToast(e.message);
    } finally {
      setCndnBusy(false);
    }
  };
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState({ message: "", isVisible: false });

  const showToast = (message: string) => {
    setToast({ message, isVisible: true });
  };

  const tabs = [
    { id: "quotations", label: "ใบเสนอราคา (Quotations)", icon: <FileText size={14} /> },
    { id: "orders", label: "ใบสั่งขาย (Sales Orders)", icon: <ClipboardList size={14} /> },
    { id: "invoices", label: "ใบแจ้งหนี้ (Invoices)", icon: <Receipt size={14} /> },
    { id: "billing", label: "ใบวางบิล (Billing Notes)", icon: <FileText size={14} /> },
    { id: "receipts", label: "ใบเสร็จรับเงิน (Receipts)", icon: <Landmark size={14} /> },
    { id: "cndn", label: "ใบลดหนี้ / เพิ่มหนี้ (CN/DN)", icon: <Receipt size={14} /> },
    { id: "crm", label: "ข้อมูลลูกค้า", icon: <Users size={14} /> },
    { id: "opportunities", label: "ติดตามงานขาย (Sales Pipeline)", icon: <Target size={14} /> },
  ];
  const salesTabs = useAdvancedTabs(tabs, ["opportunities"], activeTab);

  const salesFlowSteps = [
    { id: "quotations", label: "ใบเสนอราคา", icon: <FileText size={14} /> },
    { id: "orders", label: "ใบสั่งขาย", icon: <ClipboardList size={14} /> },
    { id: "invoices", label: "ใบแจ้งหนี้", icon: <Receipt size={14} /> },
    { id: "billing", label: "ใบวางบิล", icon: <FileText size={14} /> },
    { id: "receipts", label: "ใบเสร็จรับเงิน", icon: <Landmark size={14} /> },
  ];

  // ลูกค้าของบริษัท (ข้อมูลกลางของเครือ + ของบริษัท)
  const { data: customersList } = useCustomers<any>();
  const [quotationsList, setQuotationsList] = useState<any[]>([]);
  const [ordersList, setOrdersList] = useState<any[]>([]);
  const [invoicesList, setInvoicesList] = useState<any[]>([]);
  const [billingList, setBillingList] = useState<any[]>([]);
  const [receiptsList, setReceiptsList] = useState<any[]>([]);
  const [cndnList, setCndnList] = useState<any[]>([]);
  const [opportunitiesList, setOpportunitiesList] = useState<any[]>([]);

  useEffect(() => {
    if (customersList.length > 0) {
      const applyFallbacks = (raw: any) => ({
        ...raw,
        displayId: raw.customer_code || raw.customerId || raw.id,
        displayTaxId: raw.tax_id || raw.taxId || "-",
        industry: raw.industry || raw.business_group || raw.businessType || "อื่นๆ",
        status: raw.status || "active",
        credit_term_days: parseInt(String(raw.credit_term_days ?? raw.creditTermDays ?? raw.credit_term ?? raw.paymentTerms ?? raw.payment_term ?? 0).match(/\d+/)?.[0] || "0", 10)
      });

      if (!selectedCustomer) {
        setSelectedCustomer(applyFallbacks(customersList[0]));
      } else {
        const updated = customersList.find(c => c.id === selectedCustomer.id);
        if (updated) {
          const mappedUpdated = applyFallbacks(updated);
          if (JSON.stringify(mappedUpdated) !== JSON.stringify(selectedCustomer)) {
            setSelectedCustomer(mappedUpdated);
          }
        }
      }
    }
  }, [customersList, selectedCustomer]);

  useEffect(() => {
    if (!companyId) return;

    const listen = (path: string, display: (d: any) => Record<string, any>, setter: (rows: any[]) => void) =>
      onSnapshot(query(collection(db, `companies/${companyId}/${path}`)), (snap) => {
        const rows: any[] = [];
        snap.forEach(docSnap => {
          if (docSnap.data().isDeleted !== true) rows.push(toRow(docSnap, display));
        });
        setter(rows);
      }, (err) => console.error(`[SALES] โหลด ${path} ไม่สำเร็จ:`, err));

    // Quotations
    const unsubQuote = listen("quotations", (d) => ({
      id: firstOf(d, ["documentNo", "quotationNo", "quoteNo", "quoteId"]) || "-",
      title: firstOf(d, ["projectName", "subject", "title"]) || "-",
      value: toMoney(firstOf(d, ["grandTotal", "totalRevenue", "netTotal"])),
      status: d.status || "DRAFT",
      stage: quotationStage(d),
      validUntil: quotationValidUntil(d),
      canDelete: quotationCanDelete(d),
    }), setQuotationsList);

    // Sales Orders
    const unsubOrder = listen("sales_orders", (d) => ({
      id: firstOf(d, ["documentNo", "soId", "soNo", "orderNo", "orderId"]) || "-",
      date: toDateStr(firstOf(d, ["convertedAt", "date", "createdAt"])),
      total: toMoney(firstOf(d, ["grandTotal", "totalRevenue", "totalAmount", "netTotal"])),
      status: d.status || "Pending",
    }), setOrdersList);

    // Invoices
    const unsubInv = listen("invoices", (d) => ({
      id: firstOf(d, ["invoiceNo", "documentNo", "docNumber", "invNo"]) || "-",
      soId: firstOf(d, ["orderRefNo", "soId"]) || "-",
      date: toDateStr(firstOf(d, ["issueDate", "issuedAt", "createdAt"])),
      dueDate: toDateStr(d.dueDate),
      total: toMoney(firstOf(d, ["grandTotal", "totalRevenue", "totalAmount"])),
      status: String(d.status || "").toLowerCase() === "cancelled" ? "cancelled" : d.paymentStatus === "paid" || d.status === "Paid" ? "paid" : d.paymentStatus === "partial" ? "partial" : "pending",
      isSample: !!d.isSample,
      refundDue: Number(d.refundDue) || 0,
      replacedByNo: d.replacedByNo || "",
    }), setInvoicesList);

    // Receipts
    const unsubRec = listen("receipts", (d) => ({
      id: firstOf(d, ["receiptNo", "documentNo", "docNumber"]) || "-",
      invoiceId: firstOf(d, ["invoiceNo", "invoiceRefNo", "invoiceId"]) || "-",
      date: toDateStr(firstOf(d, ["paymentDate", "createdAt"])),
      total: toMoney(firstOf(d, ["amount", "grandTotal", "totalAmount", "totalRevenue"])),
      status: String(d.status || "").toLowerCase() === "cancelled" ? "cancelled" : "paid",
    }), setReceiptsList);

    // Billing Notes
    const unsubBill = listen("billing_notes", (d) => ({
      id: firstOf(d, ["billingNoteNo", "documentNo", "docNumber", "billingNo"]) || "-",
      date: toDateStr(firstOf(d, ["issueDate", "createdAt"])),
      dueDate: toDateStr(d.dueDate),
      total: toMoney(firstOf(d, ["totalAmount", "grandTotal"])),
      status: d.status === "paid" || d.status === "Paid" ? "Paid" : "Pending",
    }), setBillingList);

    // CN/DN
    const unsubCndn = listen("cndn", (d) => ({
      id: firstOf(d, ["documentNo", "cndnNo", "docNumber"]) || "-",
      date: toDateStr(firstOf(d, ["issueDate", "createdAt"])),
      total: toMoney(firstOf(d, ["totalAmount", "grandTotal"])),
      type: d.type || "CN",
      invoiceNo: d.invoiceNo || d.refInvoiceId || "-",
      reason: d.reason || "",
      status: d.status || "issued",
      cancellable: !!d.invoiceDocId && !d.isSample,
    }), setCndnList);

    // Real-time listener for Opportunities
    const qOpp = query(
      collection(db, `companies/${companyId}/opportunities`)
    );
    const unsubOpp = onSnapshot(qOpp, (snap) => {
      const list: any[] = [];
      snap.forEach(doc => {
        const d = doc.data();
        list.push({
          id: doc.id,
          customerName: d.customerName || d.customer || "Unknown",
          projectValue: d.projectValue || d.value || 0,
          lastContact: d.lastContact || "ไม่ทราบ",
          aiScore: d.aiScore || d.score || 0,
          sentiment: d.sentiment || "Neutral",
          nextStep: d.nextStep || "N/A",
          ...d
        });
      });
      setOpportunitiesList(list);
    });

    return () => {
      unsubQuote();
      unsubOrder();
      unsubInv();
      unsubRec();
      unsubBill();
      unsubCndn();
      unsubOpp();
    };
  }, [companyId]);

  const filteredCustomers = customersList.filter(c =>
    (c.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.customerId || c.customer_code || c.id || "").toLowerCase().includes(searchQuery.toLowerCase())
  ).map(c => ({
    ...c,
    displayId: c.customer_code || c.customerId || c.id,
    displayTaxId: c.tax_id || c.taxId || "-",
    industry: c.industry || c.business_group || c.businessType || "อื่นๆ",
    status: c.status || "active",
    credit_term_days: parseInt(String(c.credit_term_days ?? c.creditTermDays ?? c.credit_term ?? c.paymentTerms ?? c.payment_term ?? 0).match(/\d+/)?.[0] || "0", 10)
  }));

  const getCustomerName = (id: string) => {
    if (!id) return "-";
    const cust = customersList.find(c => c.id === id || c.customerId === id);
    return cust ? (cust.name || cust.displayId) : id;
  };

  const searchedQuotations = quotationsList.filter(q =>
    (q.customerNameRaw || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (q.id || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (q.title || "").toLowerCase().includes(searchQuery.toLowerCase())
  );
  const stageCounts = searchedQuotations.reduce((m: Record<string, number>, q: any) => { m[q.stage] = (m[q.stage] || 0) + 1; return m; }, {});
  // "ทั้งหมด" ไม่รวมฉบับที่ถูกแทนที่ด้วย Revision แล้ว (ดูได้จากตัวกรอง "ถูกแทนที่")
  const filteredQuotations = searchedQuotations.filter(q => quoteFilter === "all" ? q.stage !== "superseded" : q.stage === quoteFilter).map(q => ({
    ...q,
    customer: getCustomerName(q.customerNameRaw)
  }));

  // สรุป pipeline และรายการต้องติดตาม จากใบเสนอราคาจริง
  const quoteAmount = (q: any) => Number(firstOf(q, ["grandTotal", "totalRevenue", "netTotal"]) || 0);
  const pipelineStages: QuotationStage[] = ["draft", "pending", "sent", "won", "expired"];
  const pipeline = Object.fromEntries(pipelineStages.map((k) => [k, { count: 0, value: 0 }])) as Record<string, { count: number; value: number }>;
  quotationsList.forEach(q => {
    if (pipeline[q.stage]) {
      pipeline[q.stage].count++;
      pipeline[q.stage].value += quoteAmount(q);
    }
  });
  // ตัวเลขหัวหน้า: ยอดขายเดือนนี้ (ใบแจ้งหนี้), อัตราปิดการขาย (ใบเสนอราคาที่ส่งแล้ว), ใบแจ้งหนี้ค้างชำระ
  const thisMonth = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 7);
  const monthSales = invoicesList
    .filter((inv: any) => !inv.isSample && toDateStr(firstOf(inv, ["issueDate", "issuedAt", "createdAt"])).startsWith(thisMonth))
    .reduce((sum: number, inv: any) => sum + Number(firstOf(inv, ["grandTotal", "totalRevenue", "totalAmount"]) || 0), 0);
  // อัตราปิดการขาย = ได้งาน ÷ ใบที่ส่งถึงลูกค้าแล้ว (ส่งแล้ว + ได้งาน + หมดอายุ)
  const decided = quotationsList.filter(q => ["sent", "won", "expired"].includes(q.stage));
  const winRate = decided.length ? Math.round((decided.filter(q => q.stage === "won").length / decided.length) * 100) : null;
  const unpaidInvoices = invoicesList.filter((inv: any) => !inv.isSample && inv.status !== "paid").length;
  const duplicateQuotation = async (docId: string) => {
    if (!companyId || !await showConfirm("คัดลอกใบเสนอราคานี้เป็นใบใหม่ (ฉบับร่าง)?")) return;
    try {
      const res = await apiFetch(`/api/quotations/${encodeURIComponent(docId)}/duplicate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId }) });
      const data = await res.json();
      if (!res.ok || !data.success || !data.newQuotationId) throw new Error(data.error || "คัดลอกไม่สำเร็จ");
      showToast(`คัดลอกเป็น ${data.newDocumentNo || "ใบใหม่"} แล้ว`);
      router.push(`/sales/quotations/${encodeURIComponent(data.newQuotationId)}`);
    } catch (err: any) {
      showToast(err.message);
    }
  };
  const toCompactMoney = (n: number) => `฿${n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + "M" : n >= 1_000 ? (n / 1_000).toFixed(0) + "K" : n.toFixed(0)}`;
  const followUps = filteredQuotations
    .filter(q => q.stage === "sent")
    .map(q => {
      const sentDate = toDateStr(firstOf(q, ["docDate", "issueDate", "createdAt"]));
      const daysSince = sentDate === "-" ? 0 : Math.floor((Date.now() - new Date(sentDate).getTime()) / 86_400_000);
      return { ...q, daysSince };
    })
    .filter(q => q.daysSince > 7)
    .sort((a, b) => b.daysSince - a.daysSince)
    .slice(0, 5);

  const filteredOrders = ordersList.filter(o =>
    (o.customerNameRaw || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (o.id || "").toLowerCase().includes(searchQuery.toLowerCase())
  ).map(o => ({
    ...o,
    customer: getCustomerName(o.customerNameRaw)
  }));

  const filteredInvoices = invoicesList.filter(inv =>
    (inv.customerNameRaw || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (inv.id || "").toLowerCase().includes(searchQuery.toLowerCase())
  ).map(inv => ({
    ...inv,
    customer: getCustomerName(inv.customerNameRaw)
  }));

  const filteredReceipts = receiptsList.filter(rec =>
    (rec.customerNameRaw || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (rec.id || "").toLowerCase().includes(searchQuery.toLowerCase())
  ).map(rec => ({
    ...rec,
    customer: getCustomerName(rec.customerNameRaw)
  }));

  const filteredBilling = billingList.filter(b =>
    (b.customerNameRaw || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (b.id || "").toLowerCase().includes(searchQuery.toLowerCase())
  ).map(b => ({
    ...b,
    customer: getCustomerName(b.customerNameRaw)
  }));

  const filteredCndn = cndnList.filter(c =>
    (c.customerNameRaw || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.id || "").toLowerCase().includes(searchQuery.toLowerCase())
  ).map(c => ({
    ...c,
    customer: getCustomerName(c.customerNameRaw)
  }));



  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent">
      {/* Compact Module Header — icon + title + inline metric chips on same plane */}
      <header className="px-6 py-2.5 min-h-[60px] border-b border-white/5 flex flex-col xl:flex-row xl:items-center justify-between gap-3 bg-black/20 shrink-0">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal shadow-lg border border-nexus-teal/10">
            <ClipboardList size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight leading-none">ระบบบริหารงานขายและลูกค้าสัมพันธ์</h1>
            <p className="text-xs font-semibold text-white/60 mt-1 leading-none">ใบเสนอราคา ใบสั่งขาย ใบแจ้งหนี้ รับชำระ และข้อมูลลูกค้า</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="px-4 py-1.5 bg-black/40 border border-white/5 rounded-xl flex items-center gap-2.5 min-w-[130px] transition-all hover:border-nexus-teal/30 hover:bg-white/[0.03]">
            <div className="w-8 h-8 rounded-lg bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/20 shrink-0">
              <Target size={16} />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-[11px] font-medium text-white/60 tracking-widest leading-none">ยอดขายเดือนนี้</span>
              <span className="text-[17px] font-bold text-nexus-teal mt-0.5 mono-numbers leading-none" title={toMoney(monthSales)}>{toCompactMoney(monthSales)}</span>
            </div>
          </div>
          <div className="px-4 py-1.5 bg-black/40 border border-white/5 rounded-xl flex items-center gap-2.5 min-w-[130px] transition-all hover:border-nexus-blue/30 hover:bg-white/[0.03]">
            <div className="w-8 h-8 rounded-lg bg-nexus-blue/10 flex items-center justify-center text-nexus-blue border border-nexus-blue/20 shrink-0">
              <TrendingUp size={16} />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-[11px] font-medium text-white/60 tracking-widest leading-none">อัตราปิดการขาย</span>
              <span className="text-[17px] font-bold text-nexus-blue mt-0.5 mono-numbers leading-none" title="ใบเสนอราคาที่อนุมัติ ÷ ใบเสนอราคาที่ส่งแล้วทั้งหมด">{winRate === null ? "-" : `${winRate}%`}</span>
            </div>
          </div>
          <div className="px-4 py-1.5 bg-black/40 border border-white/5 rounded-xl flex items-center gap-2.5 min-w-[130px] transition-all hover:border-white/20 hover:bg-white/[0.03]">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white border border-white/10 shrink-0">
              <MessageSquare size={16} />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-[11px] font-medium text-white/60 tracking-widest leading-none">ใบแจ้งหนี้ค้างชำระ</span>
              <span className="text-[17px] font-bold text-white mt-0.5 mono-numbers leading-none">{unpaidInvoices} ฉบับ</span>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation (Stepper) & Actions */}
      <section className="px-6 min-h-[56px] py-2 bg-black/10 border-b border-white/5 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <PillTabs className="flex-1 min-w-[min(100%,520px)]"
          tabs={salesTabs.tabs}
          activeTab={activeTab}
          onTabChange={(id: any) => { if (!salesTabs.handleToggle(id)) setActiveTab(id); }}
        />
        <div className="flex flex-wrap items-center justify-end gap-2 ml-auto">
          {activeTab === "crm" && (
            <PillButton variant="primary" onClick={() => { setSelectedItem(null); setSelectedCustomer(null); router.push("/customers/new"); }} className="h-8 px-5 shadow-neon-teal">
              <Plus size={14} className="mr-1.5" />
              เพิ่มลูกค้าใหม่
            </PillButton>
          )}
          {activeTab === "quotations" && (
            <PillButton variant="primary" onClick={() => { setSelectedItem(null); router.push("/sales/quotations/new"); }} className="h-8 px-5 shadow-neon-teal">
              <FileText size={14} className="mr-1.5" />
              สร้างใบเสนอราคา
            </PillButton>
          )}
          {activeTab === "orders" && (
            <PillButton variant="primary" onClick={() => { setSelectedItem(null); router.push("/sales/orders/new"); }} className="h-8 px-5 shadow-neon-teal">
              <Receipt size={14} className="mr-1.5" />
              เปิดใบสั่งขาย
            </PillButton>
          )}
          {activeTab === "invoices" && (
            <PillButton variant="confirm" onClick={() => { showToast("เลือกใบสั่งขายที่ต้องการสร้างใบแจ้งหนี้จากแท็บ SO"); setActiveTab("orders"); }} className="h-8 px-5 shadow-neon-blue">
              <Receipt size={14} className="mr-1.5" />
              ดึงจาก SO
            </PillButton>
          )}
          {activeTab === "cndn" && (
            <PillButton variant="primary" onClick={() => router.push("/sales/cndn/new")} className="h-8 px-5 shadow-neon-teal">
              <Plus size={14} className="mr-1.5" /> ออกใบลดหนี้ / เพิ่มหนี้
            </PillButton>
          )}
          {activeTab === "receipts" && (
            <PillButton variant="save" onClick={() => router.push("/finance/receipts/new")} className="h-8 px-5 shadow-neon-teal">
              <Landmark size={14} className="mr-1.5" />
              รับชำระจาก INV
            </PillButton>
          )}
        </div>
      </section>

      {/* Main Content Scroll Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="p-5 space-y-3 max-w-[1800px] mx-auto">

      <div className="flex flex-col xl:flex-row items-start gap-4">
        <div className="flex-1 w-full space-y-3">
          <div className="space-y-3">

            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
               <div className="flex items-center gap-4 shrink-0 min-w-[140px]">
                  <div className="text-nexus-teal flex items-center justify-center">
                     {activeTab === "crm" ? <Users size={24} /> :
                     activeTab === "opportunities" ? <Target size={24} /> :
                     activeTab === "quotations" ? <FileText size={24} /> :
                     activeTab === "orders" ? <ClipboardList size={24} /> :
                     activeTab === "invoices" ? <Receipt size={24} /> :
                     activeTab === "billing" ? <FileText size={24} /> :
                     activeTab === "receipts" ? <Landmark size={24} /> : <FileText size={24} />}
                  </div>
                  <div className="space-y-0.5">
                     <p className="text-[11px] font-medium text-white/30 uppercase tracking-widest">
                       {activeTab === "crm" ? "ระบบบริหารจัดการความสัมพันธ์ลูกค้า" : "ระบบจัดการงานขายและรายได้"}
                     </p>
                     <h2 className="text-xl font-bold text-white uppercase">
                        {activeTab === "crm" && "ข้อมูลลูกค้า"}
                        {activeTab === "opportunities" && "ติดตามงานขาย (Sales Pipeline)"}
                        {activeTab === "quotations" && "ใบเสนอราคา"}
                        {activeTab === "orders" && "ใบสั่งขาย"}
                        {activeTab === "invoices" && "ใบแจ้งหนี้"}
                        {activeTab === "billing" && "ใบวางบิล"}
                        {activeTab === "receipts" && "ใบเสร็จรับเงิน"}
                        {activeTab === "cndn" && "ลดหนี้ / เพิ่มหนี้"}
                     </h2>
                  </div>
               </div>

               {/* Document Sequence Visualizer */}
              {salesFlowSteps.some(s => s.id === activeTab) && (
                <div className="hidden xl:block">
                   <DocumentFlowStepper activeTab={activeTab} onStepClick={(id) => setActiveTab(id as any)} steps={salesFlowSteps} />
                </div>
              )}
            </div>

            {/* Tactical Command Bar */}
            <div className="flex flex-col md:flex-row items-center gap-4 bg-white/[0.01] p-1.5 rounded-full border border-white/5 backdrop-blur-md">
               <NexusSearchInput
                 placeholder="พิมพ์เพื่อค้นหา..."
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 className="flex-1"
                 kbd="F"
               />
               <div className="flex items-center gap-2 pr-1.5">
                  <PillButton variant="glass" className="h-9 w-9 p-0 rounded-full border-white/5 hover:border-nexus-teal/30 hover:bg-nexus-teal/5">
                    <Filter size={18} className="text-white/40" />
                  </PillButton>
               </div>
            </div>

            {/* CRM / Quotation / Order Content - Conditional Rendering wrapped in standard GlassCard viewport */}
            <GlassCard accentColor="teal" className="p-0 overflow-hidden min-h-[640px] flex flex-col justify-between">
              <div className="overflow-x-auto custom-scrollbar flex-1 w-full p-2">
                {activeTab === "crm" && (
                  <div className="animate-in fade-in duration-500">
                    <NexusTable
                      headers={["รหัสลูกค้า", "ชื่อนิติบุคคล / ลูกค้า (ชื่อทางการ)", "ประเภทธุรกิจ", "เลขผู้เสียภาษี", "สถานะ", "จัดการ"]}
                    >
                      {filteredCustomers.map(cus => (
                        <CustomerRow
                          key={cus.id}
                          docId={cus.id}
                          id={cus.displayId}
                          name={cus.name || "-"}
                          industry={cus.industry || "-"}
                          taxId={cus.displayTaxId}
                          status={cus.status || "active"}
                          canDelete={can(roles, "sales:delete")}
                          companyId={companyId || ""}
                          onClick={() => setSelectedCustomer(cus)}
                        />
                      ))}
                    </NexusTable>
                  </div>
                )}

                {activeTab === "opportunities" && (
                  <OpportunityScorer leads={opportunitiesList.filter(l => (l.customerName || "").toLowerCase().includes(searchQuery.toLowerCase()))} />
                )}

                {activeTab === "quotations" && (
                  <div className="animate-in fade-in duration-500 space-y-2">
                    <div className="flex flex-wrap gap-1.5 px-1 pt-1">
                      {(["all", "draft", "pending", "sent", "won", "expired", "rejected", "superseded"] as const).map((k) => {
                        const n = k === "all" ? searchedQuotations.length - (stageCounts.superseded || 0) : stageCounts[k] || 0;
                        if (k !== "all" && !n && quoteFilter !== k) return null;
                        return (
                          <button key={k} onClick={() => setQuoteFilter(k)} className={cn("h-7 px-3 rounded-full text-[12px] font-bold border transition-colors", quoteFilter === k ? "bg-nexus-teal/15 border-nexus-teal/40 text-nexus-teal" : "border-white/10 text-white/60 hover:text-white")}>
                            {k === "all" ? "ทั้งหมด" : QUOTATION_STAGE[k].label} <span className="font-mono">{n}</span>
                          </button>
                        );
                      })}
                    </div>
                    <NexusTable
                      headers={["เลขที่ใบเสนอราคา", "ลูกค้า", "ชื่อโครงการ", "ยืนราคาถึง", "มูลค่าสุทธิ", "สถานะ", "จัดการ"]}
                    >
                      {filteredQuotations.length === 0 && (
                        <EmptyGuide cols={7} text="ไม่พบใบเสนอราคา" hint="ยังไม่เคยสร้าง: กด &quot;สร้างใบเสนอราคา&quot; มุมขวาบน (ต้องมีข้อมูลลูกค้าก่อน) · ถ้าค้นหาอยู่ ลองล้างคำค้นหรือตัวกรอง" />
                      )}
                      {filteredQuotations.map(q => (
                        <QuotationRow
                          key={q.docId}
                          docId={q.docId}
                          id={q.id}
                          customer={q.customer}
                          title={q.title}
                          value={q.value}
                          stage={q.stage}
                          validUntil={q.validUntil}
                          canDelete={q.canDelete}
                          companyId={companyId || ""}
                          onClick={() => setSelectedItem(q)}
                          onDuplicate={() => duplicateQuotation(q.docId)}
                        />
                      ))}
                    </NexusTable>
                  </div>
                )}

                {activeTab === "orders" && (
                  <div className="animate-in fade-in duration-500">
                    <NexusTable
                      headers={["เลขที่ใบสั่งขาย", "ลูกค้า", "สืบหน้าจากงาน", "ยอดรวม", "สถานะ", "จัดการ"]}
                    >
                      {filteredOrders.map(so => (
                        <SalesOrderRow
                          key={so.docId}
                          docId={so.docId}
                          id={so.id}
                          customer={so.customer}
                          date={so.date}
                          total={so.total}
                          status={so.status}
                          companyId={companyId || ""}
                          onPrint={() => setPrintDoc({ type: "sales_order", id: so.docId, title: `ใบสั่งขาย ${so.id}` })}
                          onClick={() => setSelectedItem(so)}
                        />
                      ))}
                    </NexusTable>
                  </div>
                )}

                {activeTab === "invoices" && (
                  <div className="animate-in fade-in duration-500">
                    {invCancel && (
                      <div className="mb-3 px-4 py-3 rounded-2xl border border-danger/25 bg-danger/[0.04] space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[13px] font-semibold text-white">ยกเลิกใบกำกับภาษี {invCancel.no}</span>
                          <label className="flex items-center gap-1.5 text-[13px] text-white/70"><input type="radio" checked={invCancel.replace} onChange={() => setInvCancel({ ...invCancel, replace: true })} /> ยกเลิกและออกใบแทน (แก้ข้อมูลผู้ซื้อ ยอดเงินเท่าเดิม)</label>
                          <label className="flex items-center gap-1.5 text-[13px] text-white/70"><input type="radio" checked={!invCancel.replace} onChange={() => setInvCancel({ ...invCancel, replace: false })} /> ยกเลิกอย่างเดียว (กลับรายการบัญชี)</label>
                        </div>
                        <input autoFocus value={invCancel.reason} onChange={(e) => setInvCancel({ ...invCancel, reason: e.target.value })} placeholder="เหตุผลการยกเลิก (จำเป็น) เช่น ชื่อ/ที่อยู่ผู้ซื้อไม่ถูกต้อง" className="h-9 w-full px-3 rounded-full bg-white/[0.03] border border-white/10 text-[13px] leading-[1.9] text-white focus:outline-none" />
                        {invCancel.replace && (
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                            <input value={invCancel.customer.name} onChange={(e) => setInvCancel({ ...invCancel, customer: { ...invCancel.customer, name: e.target.value } })} placeholder="ชื่อผู้ซื้อ" className="h-9 px-3 rounded-full bg-white/[0.03] border border-white/10 text-[13px] leading-[1.9] text-white md:col-span-2 focus:outline-none" />
                            <input value={invCancel.customer.taxId} onChange={(e) => setInvCancel({ ...invCancel, customer: { ...invCancel.customer, taxId: e.target.value.replace(/\D/g, "").slice(0, 13) } })} placeholder="เลขผู้เสียภาษี 13 หลัก" className="h-9 px-3 rounded-full bg-white/[0.03] border border-white/10 text-[13px] leading-[1.9] text-white font-mono focus:outline-none" />
                            <input value={invCancel.customer.branch} onChange={(e) => setInvCancel({ ...invCancel, customer: { ...invCancel.customer, branch: e.target.value } })} placeholder="สาขา (00000 = สำนักงานใหญ่)" className="h-9 px-3 rounded-full bg-white/[0.03] border border-white/10 text-[13px] leading-[1.9] text-white focus:outline-none" />
                            <input value={invCancel.customer.address} onChange={(e) => setInvCancel({ ...invCancel, customer: { ...invCancel.customer, address: e.target.value } })} placeholder="ที่อยู่ผู้ซื้อ" className="h-9 px-3 rounded-full bg-white/[0.03] border border-white/10 text-[13px] leading-[1.9] text-white md:col-span-4 focus:outline-none" />
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <button type="button" disabled={invBusy || invCancel.reason.trim().length < 3} onClick={cancelInvoice} className="h-8 px-4 rounded-full border border-danger/40 text-danger text-[12px] font-bold disabled:opacity-40">{invBusy ? "กำลังดำเนินการ..." : invCancel.replace ? "ยืนยันยกเลิกและออกใบแทน" : "ยืนยันยกเลิก"}</button>
                          <button type="button" onClick={() => setInvCancel(null)} className="h-8 px-3 rounded-full border border-white/10 text-white/60 text-[12px] font-bold">ปิด</button>
                          <span className="text-[12px] text-white/40">เรียกใบเดิมคืนจากลูกค้าเพื่อยกเลิก · ต้องแก้ยอดเงิน ให้ออกใบลดหนี้/เพิ่มหนี้แทน</span>
                        </div>
                      </div>
                    )}
                    <NexusTable
                      headers={["เลขที่ใบแจ้งหนี้", "อ้างอิง SO", "ลูกค้า", "วันที่ออก", "ครบกำหนด", "ยอดรวม", "สถานะ", "จัดการ"]}
                    >
                      {filteredInvoices.map(inv => (
                        <InvoiceRow
                          onPrint={() => setPrintDoc({ type: "invoice", id: inv.docId, title: `ใบกำกับภาษี ${inv.id}` })}
                          onCancel={canCancelInvoice ? () => openInvoiceCancel(inv) : undefined}
                          replacedByNo={inv.replacedByNo}
                          key={inv.docId}
                          docId={inv.docId}
                          id={inv.id}
                          soRef={inv.soId || "-"}
                          customer={inv.customer}
                          date={inv.date}
                          dueDate={inv.dueDate || "-"}
                          total={inv.total}
                          status={inv.status}
                          isSample={inv.isSample}
                          refundDue={inv.refundDue}
                          companyId={companyId || ""}
                          onClick={() => setSelectedItem(inv)}
                        />
                      ))}
                    </NexusTable>
                  </div>
                )}

                {activeTab === "billing" && (
                  <div className="animate-in fade-in duration-500">
                    <NexusTable
                      headers={["เลขที่ใบวางบิล", "ลูกค้า", "วันที่ออก", "นัดรับชำระ", "ยอดรวม", "สถานะ", "จัดการ"]}
                    >
                      {filteredBilling.map(bill => (
                        <BillingNoteRow
                          onPrint={() => setPrintDoc({ type: "billing_note", id: bill.docId, title: `ใบวางบิล ${bill.id}` })}
                          key={bill.docId}
                          docId={bill.docId}
                          id={bill.id}
                          customer={bill.customer}
                          date={bill.date}
                          dueDate={bill.dueDate}
                          total={bill.total}
                          status={bill.status}
                          companyId={companyId || ""}
                          onClick={() => setSelectedItem(bill)}
                        />
                      ))}
                    </NexusTable>
                  </div>
                )}

                {activeTab === "cndn" && (
                  <div className="animate-in fade-in duration-500">
                    {cndnCancel && (
                      <div className="flex flex-wrap items-center gap-2 mb-3 px-4 py-3 rounded-2xl border border-danger/25 bg-danger/[0.04]">
                        <span className="text-[13px] text-white/80">ยกเลิก {cndnCancel.no}</span>
                        <input autoFocus value={cndnCancel.reason} onChange={(e) => setCndnCancel({ ...cndnCancel, reason: e.target.value })} placeholder="เหตุผลการยกเลิก (จำเป็น)" className="h-8 flex-1 min-w-[220px] px-3 rounded-full bg-white/[0.03] border border-white/10 text-[13px] text-white focus:outline-none" />
                        <button type="button" disabled={cndnBusy || cndnCancel.reason.trim().length < 3} onClick={cancelCndn} className="h-8 px-3 rounded-full border border-danger/40 text-danger text-[12px] font-bold disabled:opacity-40">{cndnBusy ? "กำลังยกเลิก..." : "ยืนยันยกเลิก"}</button>
                        <button type="button" onClick={() => setCndnCancel(null)} className="h-8 px-3 rounded-full border border-white/10 text-white/60 text-[12px] font-bold">ปิด</button>
                      </div>
                    )}
                    <NexusTable
                      headers={["เลขที่เอกสาร", "ลูกค้า", "ประเภท", "อ้างอิงใบกำกับ", "วันที่ออก", "ยอดรวม", "สถานะ", ""]}
                    >
                      {filteredCndn.map(cndn => (
                        <CndnRow
                          onPrint={() => setPrintDoc({ type: "cndn", id: cndn.docId, title: `${cndn.type === "DN" ? "ใบเพิ่มหนี้" : "ใบลดหนี้"} ${cndn.id}` })}
                          key={cndn.docId}
                          docId={cndn.docId}
                          id={cndn.id}
                          customer={cndn.customer}
                          type={cndn.type}
                          invoiceNo={cndn.invoiceNo}
                          reason={cndn.reason}
                          date={cndn.date}
                          total={cndn.total}
                          status={cndn.status}
                          canCancel={cndn.cancellable && (can(roles, "sales:edit") || can(roles, "finance:edit"))}
                          onCancel={() => setCndnCancel({ docId: cndn.docId, no: cndn.id, reason: "" })}
                          onClick={() => setSelectedItem(cndn)}
                        />
                      ))}
                    </NexusTable>
                  </div>
                )}

                {activeTab === "receipts" && (
                  <div className="animate-in fade-in duration-500">
                    <NexusTable
                      headers={["เลขที่ใบเสร็จ", "อ้างอิง INV", "ลูกค้า", "วันที่รับชำระ", "ยอดรวม", "สถานะ", "จัดการ"]}
                    >
                      {filteredReceipts.map(rec => (
                        <ReceiptRow
                          onPrint={() => setPrintDoc({ type: "receipt", id: rec.docId, title: `ใบเสร็จรับเงิน ${rec.id}` })}
                          key={rec.docId}
                          docId={rec.docId}
                          id={rec.id}
                          invRef={rec.invoiceId || "-"}
                          customer={rec.customer}
                          date={rec.date}
                          total={rec.total}
                          status={rec.status}
                          companyId={companyId || ""}
                          onClick={() => setSelectedItem(rec)}
                        />
                      ))}
                    </NexusTable>
                  </div>
                )}
              </div>

            </GlassCard>
          </div>

        </div>

        <div className="w-full xl:w-[25%] shrink-0 sticky top-[96px] space-y-3 max-h-[calc(100vh-120px)] overflow-y-auto custom-scrollbar pb-10">
           {activeTab === "crm" && selectedCustomer ? (
             <GlassCard accentColor="blue" className="p-5">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h4 className="text-[14px] font-bold text-white">{selectedCustomer.name}</h4>
                    <p className="text-[11px] text-white/50">{selectedCustomer.displayId}</p>
                  </div>
                  <StatusBadge status={selectedCustomer.status || "active"} label={selectedCustomer.status === "active" ? "ใช้งาน" : "ปิดใช้งาน"} />
                </div>

                <div className="space-y-3 text-xs font-medium text-white/70">
                   <div className="flex items-center gap-3">
                     <Building2 size={16} className="text-nexus-blue shrink-0" />
                     <span>
                       ประเภท: {selectedCustomer.type === "person" ? "บุคคลธรรมดา" : selectedCustomer.type === "government" ? "หน่วยงานราชการ" : "นิติบุคคล"}
                       {" "}•{" "}
                       {selectedCustomer.branch_type === "branch" ? `สาขา ${selectedCustomer.branch_code || "-"}` : "สำนักงานใหญ่"}
                     </span>
                   </div>
                   <div className="flex items-start gap-3">
                     <MapPin size={16} className="text-nexus-teal shrink-0 mt-0.5" />
                     <span>
                       {selectedCustomer.addresses?.[0]
                         ? `${selectedCustomer.addresses[0].addressNo || ""} ${selectedCustomer.addresses[0].moo ? `ม.${selectedCustomer.addresses[0].moo}` : ""} ${selectedCustomer.addresses[0].subDistrict || ""} ${selectedCustomer.addresses[0].district || ""} ${selectedCustomer.addresses[0].province || ""} ${selectedCustomer.addresses[0].zipCode || ""}`
                         : "ไม่ได้ระบุที่อยู่"
                       }
                     </span>
                   </div>
                   <div className="flex items-center gap-3">
                     <Target size={16} className="text-nexus-blue shrink-0" />
                     <span>กลุ่มธุรกิจ: {selectedCustomer.industry || selectedCustomer.business_group || selectedCustomer.businessType || "-"}</span>
                   </div>
                   <div className="flex items-center gap-3">
                     <FileText size={16} className="text-white/40 shrink-0" />
                     <span className="font-mono">TAX ID: {selectedCustomer.tax_id || selectedCustomer.taxId || "-"}</span>
                   </div>
                   <div className="flex items-center gap-3">
                     <CreditCard size={16} className="text-nexus-purple shrink-0" />
                     <span>เครดิตเทอม: {parseInt(String(selectedCustomer.credit_term_days ?? selectedCustomer.creditTermDays ?? selectedCustomer.credit_term ?? selectedCustomer.paymentTerms ?? selectedCustomer.payment_term ?? 0).match(/\d+/)?.[0] || "0", 10)} วัน (วงเงิน {parseInt(String(selectedCustomer.credit_limit ?? selectedCustomer.creditLimit ?? 0).match(/\d+/)?.[0] || "0", 10).toLocaleString()} ฿)</span>
                   </div>
                   <div className="flex items-center gap-3">
                     <RefreshCw size={16} className="text-nexus-teal shrink-0" />
                     <span>รอบวางบิล: {selectedCustomer.billing_cycle || selectedCustomer.billingCycle || "ตามรอบเครดิต"}</span>
                   </div>
                   {(selectedCustomer.bank_name || selectedCustomer.bankName || selectedCustomer.bank_account || selectedCustomer.bankAccount) && (
                     <div className="flex items-center gap-3">
                       <Landmark size={16} className="text-warning shrink-0" />
                       <span>{selectedCustomer.bank_name || selectedCustomer.bankName || "-"} • <span className="font-mono text-white">{selectedCustomer.bank_account || selectedCustomer.bankAccount || selectedCustomer.accountNo || "-"}</span></span>
                     </div>
                   )}
                   {(selectedCustomer.phone || selectedCustomer.email || selectedCustomer.website) && (
                     <div className="flex items-start gap-3">
                       <MessageSquare size={16} className="text-white/40 shrink-0 mt-0.5" />
                       <div className="flex flex-col gap-1">
                         {selectedCustomer.phone && <span>โทร: {selectedCustomer.phone}</span>}
                         {selectedCustomer.email && <span>อีเมล: {selectedCustomer.email}</span>}
                         {selectedCustomer.website && <span>เว็บไซต์: {selectedCustomer.website}</span>}
                       </div>
                     </div>
                   )}
                   {selectedCustomer.contacts && selectedCustomer.contacts.length > 0 && (
                     <div className="flex items-start gap-3 pt-3 border-t border-white/5">
                       <User size={16} className="text-nexus-blue shrink-0 mt-0.5" />
                       <div className="flex flex-col gap-1">
                         <span className="text-white/40 text-[11px] uppercase tracking-wider">ผู้ติดต่อหลัก</span>
                         <span>{selectedCustomer.contacts[0].name || "-"} {selectedCustomer.contacts[0].position ? `(${selectedCustomer.contacts[0].position})` : ""}</span>
                         <span className="font-mono text-nexus-teal">{selectedCustomer.contacts[0].phone || "-"}</span>
                       </div>
                     </div>
                   )}
                </div>

                <div className="mt-6 pt-6 border-t border-white/5 flex flex-col gap-3">
                   <PillButton size="sm" variant="glass" onClick={() => { setSelectedItem(selectedCustomer); router.push("/customers/new"); }} className="w-full border-white/20 hover:border-nexus-teal shadow-none">
                     <FileText size={14} className="mr-2" />
                     ดู / แก้ไขข้อมูลทั้งหมด
                   </PillButton>
                   <PillButton size="sm" variant="glass" onClick={() => setSelectedCustomer(null)} className="w-full border-white/20 text-white/40 shadow-none">
                     ปิดหน้าต่าง
                   </PillButton>
                </div>
             </GlassCard>
           ) : activeTab === "quotations" && selectedItem ? (
             <GlassCard className="p-4 border-white/5 ">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h4 className="text-[14px] font-bold text-white">{selectedItem.title}</h4>
                    <p className="text-[11px] text-white/50">{selectedItem.id}</p>
                  </div>
                  <StatusBadge status={(QUOTATION_STAGE[selectedItem.stage as QuotationStage] || QUOTATION_STAGE.draft).badge} label={(QUOTATION_STAGE[selectedItem.stage as QuotationStage] || QUOTATION_STAGE.draft).label} />
                </div>

                <div className="space-y-3 text-xs font-medium text-white/70">
                   <div className="flex items-center gap-3">
                     <Building2 size={16} className="text-nexus-teal shrink-0" />
                     <span>ลูกค้า: <span className="text-white">{selectedItem.customer || selectedItem.customerNameRaw || selectedItem.customerId || "-"}</span></span>
                   </div>
                   <div className="flex items-center gap-3">
                     <User size={16} className="text-nexus-blue shrink-0" />
                     <span>พนักงานขาย: {selectedItem.salesPerson || "-"}</span>
                   </div>
                   <div className="flex items-center gap-3">
                     <CalendarDays size={16} className="text-white/40 shrink-0" />
                     <span>วันที่เอกสาร: {selectedItem.date || selectedItem.issueDate || "-"}</span>
                   </div>
                   <div className="flex items-center gap-3">
                     <ShieldCheck size={16} className="text-warning shrink-0" />
                     <span>ยืนราคาถึง: {selectedItem.validUntil || "-"}{selectedItem.stage === "expired" ? " (หมดอายุแล้ว)" : ""}</span>
                   </div>
                   <div className="flex items-center gap-3">
                     <RefreshCw size={16} className="text-nexus-purple shrink-0" />
                     <span>เครดิตเทอม: {selectedItem.paymentTerms || selectedItem.credit_term || "-"}</span>
                   </div>
                   <div className="flex items-center gap-3">
                     <Percent size={16} className="text-white/40 shrink-0" />
                     <span>รูปแบบภาษี: {selectedItem.taxMode || selectedItem.vat_type || "-"}</span>
                   </div>
                   <div className="flex items-center gap-3">
                     <ClipboardList size={16} className="text-nexus-teal shrink-0" />
                     <span>จำนวนรายการ: {selectedItem.items?.length || 0} รายการ</span>
                   </div>
                   <div className="flex items-center gap-3 pt-3 border-t border-white/5">
                     <CreditCard size={16} className="text-nexus-blue shrink-0" />
                     <span className="font-mono text-[14px] text-white">ยอดสุทธิ: {selectedItem.value || "฿0.00"}</span>
                   </div>
                </div>

                <div className="mt-6 pt-6 border-t border-white/5 flex flex-col gap-3">
                   <PillButton size="sm" variant="glass" onClick={() => router.push(`/sales/quotations/${encodeURIComponent(selectedItem.docId)}`)} className="w-full border-white/20 hover:border-nexus-teal shadow-none">
                     <FileText size={14} className="mr-2" />
                     ดู / แก้ไขใบเสนอราคา
                   </PillButton>
                   <PillButton size="sm" variant="glass" onClick={() => setPrintDoc({ type: "quotation", id: selectedItem.docId, title: `ใบเสนอราคา ${selectedItem.id}` })} className="w-full border-white/20 hover:border-nexus-blue shadow-none">
                     <Printer size={14} className="mr-2" />
                     พิมพ์ / ส่งใบเสนอราคา
                   </PillButton>
                   <PillButton size="sm" variant="glass" onClick={() => setSelectedItem(null)} className="w-full border-white/20 text-white/40 shadow-none">
                     ปิดหน้าต่าง
                   </PillButton>
                </div>
             </GlassCard>
           ) : activeTab === "orders" && selectedItem ? (
             <GlassCard className="p-4 border-white/5 ">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h4 className="text-[14px] font-bold text-white">{selectedItem.customer}</h4>
                    <p className="text-[11px] text-white/50">{selectedItem.id}</p>
                  </div>
                  <StatusBadge {...salesOrderStatusBadge(selectedItem.status)} />
                </div>

                <div className="space-y-3 text-xs font-medium text-white/70">
                   <div className="flex items-center gap-3">
                     <FileText size={16} className="text-nexus-blue shrink-0" />
                     <span>อ้างอิง: {selectedItem.linkedQuotation || selectedItem.quoteId || selectedItem.quotationRefNo || "-"}</span>
                   </div>
                   <div className="flex items-center gap-3">
                     <CreditCard size={16} className="text-nexus-teal shrink-0" />
                     <span className="font-mono text-white">ยอดรวม: {selectedItem.total || "0.00"}</span>
                   </div>
                </div>

                <div className="mt-6 pt-6 border-t border-white/5 flex flex-col gap-3">
                   <PillButton size="sm" variant="glass" onClick={() => router.push(`/sales/orders/${encodeURIComponent(selectedItem.docId)}`)} className="w-full border-white/20 hover:border-nexus-blue shadow-none">
                     <Receipt size={14} className="mr-2" />
                     ดู / แก้ไขใบสั่งขาย
                   </PillButton>
                   <PillButton size="sm" variant="glass" onClick={() => setPrintDoc({ type: "sales_order", id: selectedItem.docId, title: `ใบสั่งขาย ${selectedItem.id}` })} className="w-full border-white/20 hover:border-nexus-teal shadow-none">
                     <Printer size={14} className="mr-2" />
                     พิมพ์ใบสั่งขาย
                   </PillButton>
                   {(Array.isArray(selectedItem.deliveryNotes) ? selectedItem.deliveryNotes : []).map((dn: string) => (
                     <PillButton key={dn} size="sm" variant="glass" onClick={() => setPrintDoc({ type: "delivery_note", id: dn, title: `ใบส่งของ ${dn}` })} className="w-full border-white/20 hover:border-nexus-teal shadow-none">
                       <Printer size={14} className="mr-2" />
                       ใบส่งของ {dn}
                     </PillButton>
                   ))}
                   <PillButton size="sm" variant="glass" onClick={() => setSelectedItem(null)} className="w-full border-white/20 text-white/40 shadow-none">
                     ปิดหน้าต่าง
                   </PillButton>
                </div>
             </GlassCard>
           ) : (
             <>
               <GlassCard className="p-4 border-white/5 ">
                  <h4 className="text-[12px] font-medium text-nexus-blue uppercase tracking-widest mb-6">ขั้นตอนการปิดการขาย</h4>
                  <div className="space-y-3">
                     <PipelineStage label="ร่าง" count={pipeline.draft.count} value={toCompactMoney(pipeline.draft.value)} />
                     <PipelineStage label="รออนุมัติ" count={pipeline.pending.count} value={toCompactMoney(pipeline.pending.value)} color="bg-warning" />
                     <PipelineStage label="ส่งลูกค้าแล้ว" count={pipeline.sent.count} value={toCompactMoney(pipeline.sent.value)} color="bg-nexus-blue" />
                     <PipelineStage label="ได้งาน" count={pipeline.won.count} value={toCompactMoney(pipeline.won.value)} color="bg-nexus-teal" />
                     {pipeline.expired.count > 0 && <PipelineStage label="หมดอายุ" count={pipeline.expired.count} value={toCompactMoney(pipeline.expired.value)} color="bg-danger" />}
                  </div>
               </GlassCard>

               <GlassCard className="p-4 border-white/5">
                  <h4 className="text-[12px] font-medium text-white/20 uppercase tracking-widest mb-6 flex items-center gap-2">
                     <Bell size={14} className="text-warning" />
                     แจ้งเตือนการติดตามงาน
                  </h4>
                  <div className="space-y-3">
                     {followUps.length === 0 ? (
                       <p className="text-[12px] text-white/30">ไม่มีใบเสนอราคาที่ส่งเกิน 7 วันและรอติดตาม</p>
                     ) : followUps.map(q => (
                       <ReminderItem key={q.docId} name={q.customer} detail={`${q.id} (ส่งแล้ว ${q.daysSince} วัน)`} />
                     ))}
                  </div>
               </GlassCard>
             </>
           )}
        </div>
      </div>
      </div>
      </div>













      <Toast
        message={toast.message}
        isVisible={toast.isVisible}
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
      />
      <DocumentPdfModal open={!!printDoc} onClose={() => setPrintDoc(null)} source={printDoc ? { type: printDoc.type, id: printDoc.id } : undefined} title={printDoc?.title || ""} />
    </div>
  );
}

function CustomerRow({ id, docId, name, industry, taxId, status, canDelete, companyId, onClick }: { id: string, docId: string, name: string, industry: string, taxId: string, status: "active" | "inactive", canDelete: boolean, companyId: string, onClick?: () => void }) {
  return (
    <NexusTableRow onClick={onClick}>
      <NexusTableCell className="w-[1%] whitespace-nowrap align-middle text-center font-mono text-[13px] text-nexus-blue font-medium tracking-tighter">{id}</NexusTableCell>
      <NexusTableCell className="font-bold text-white/80 group-hover:text-white transition-colors w-full">{name}</NexusTableCell>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-center text-[13px] font-medium text-white/60">{industry}</NexusTableCell>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-center font-mono text-xs text-white/30">{taxId}</NexusTableCell>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-center">
        <StatusBadge status={status} label={status === "active" ? "ใช้งาน" : "ปิดใช้งาน"} />
      </NexusTableCell>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-center">
         {canDelete && (
           <div onClick={(e) => e.stopPropagation()} className="inline-block">
             <SecureDeleteAction
               collectionName={`companies/${companyId || ""}/customers`}
               documentId={docId}
               displayName={name}
               compact
             />
           </div>
         )}
      </NexusTableCell>
    </NexusTableRow>
  );
}


function salesOrderStatusBadge(status: string): { status: "active" | "warning" | "danger" | "pending"; label: string } {
  switch (String(status || "").toUpperCase()) {
    case "COMPLETED": return { status: "active", label: "ออกใบกำกับแล้ว" };
    case "CONFIRMED": return { status: "active", label: "ยืนยันแล้ว" };
    case "PROCESSING": return { status: "warning", label: "กำลังดำเนินการ" };
    case "DELIVERED": return { status: "active", label: "ส่งมอบแล้ว" };
    case "CANCELLED": return { status: "danger", label: "ยกเลิก" };
    default: return { status: "pending", label: "รอดำเนินการ" };
  }
}

function QuotationRow({ id, docId, customer, title, value, stage, validUntil, canDelete, companyId, onClick, onDuplicate }: { id: string, docId: string, customer: string, title: string, value: string, stage: QuotationStage, validUntil: string, canDelete: boolean, companyId: string, onClick?: () => void, onDuplicate: () => void }) {
  const st = QUOTATION_STAGE[stage] || QUOTATION_STAGE.draft;
  const href = `/sales/quotations/${encodeURIComponent(docId)}`;
  return (
    <NexusTableRow onClick={onClick}>
      <NexusTableCell mono><Link href={href} onClick={(e) => e.stopPropagation()} className="text-nexus-teal hover:underline" title="เปิดใบเสนอราคา">{id}</Link></NexusTableCell>
      <NexusTableCell className="font-bold text-white/80">{customer}</NexusTableCell>
      <NexusTableCell className="text-white/60">{title}</NexusTableCell>
      <NexusTableCell className={stage === "expired" ? "text-danger" : "text-white/60"}>{validUntil ? new Date(`${validUntil}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" }) : "-"}</NexusTableCell>
      <NexusTableCell className="text-white" mono>{value}</NexusTableCell>
      <NexusTableCell><StatusBadge status={st.badge} label={st.label} /></NexusTableCell>
      <NexusTableCell>
        <div onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1.5" style={{ width: 86, justifyContent: "flex-start" }}>
          <button onClick={onDuplicate} className="w-8 h-8 rounded-full border border-white/15 text-white/60 flex items-center justify-center hover:text-white hover:bg-white/[0.05]" title="คัดลอกเป็นใบเสนอราคาใหม่" aria-label="คัดลอก"><Copy size={14} /></button>
          {/* ลบได้เฉพาะใบที่ยังไม่ส่งออกไปภายนอก เพื่อไม่ให้เลขเอกสารที่ลูกค้าเห็นแล้วหายไป (เว้นช่องไว้ให้ปุ่มตรงแนวกัน) */}
          {canDelete ? <SecureDeleteAction collectionName={`companies/${companyId}/quotations`} documentId={docId} displayName={title} compact /> : null}
        </div>
      </NexusTableCell>
    </NexusTableRow>
  );
}

function SalesOrderRow({ id, docId, customer, date, total, status, onClick, onPrint }: { id: string, docId: string, customer: string, date: string, total: string, status: string, companyId: string, onClick?: () => void, onPrint?: () => void }) {
  return (
    <NexusTableRow onClick={onClick}>
      <NexusTableCell className="w-[1%] whitespace-nowrap align-middle text-center font-mono text-[13px] text-nexus-blue font-medium tracking-tighter">{id}</NexusTableCell>
      <NexusTableCell className="font-bold text-white/80 w-full">{customer}</NexusTableCell>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-center text-[13px] font-medium text-white/40 uppercase tracking-widest">{date}</NexusTableCell>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-right text-white" mono>{total}</NexusTableCell>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-center">
        <StatusBadge {...salesOrderStatusBadge(status)} />
      </NexusTableCell>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-center">
        <div onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1.5">
          <SecureDeleteAction serverKind="sales_order" documentId={docId} displayName={customer} compact />
          <PrintButton onPrint={onPrint} label={id} />
        </div>
      </NexusTableCell>
    </NexusTableRow>
  );
}

function PrintButton({ onPrint, label }: { onPrint?: () => void; label: string }) {
  if (!onPrint) return null;
  return <button type="button" onClick={(e) => { e.stopPropagation(); onPrint(); }} className="w-8 h-8 rounded-full border border-white/15 text-white/60 hover:text-white hover:bg-white/[0.05] inline-flex items-center justify-center" title={`พิมพ์ ${label}`} aria-label={`พิมพ์ ${label}`}><Printer size={14} /></button>;
}

function InvoiceRow({ id, docId, soRef, customer, date, dueDate, total, status, companyId, isSample, refundDue = 0, replacedByNo, onClick, onPrint, onCancel }: { id: string, docId: string, soRef: string, customer: string, date: string, dueDate: string, total: string, status: string, companyId: string, isSample?: boolean, refundDue?: number, replacedByNo?: string, onClick?: () => void, onPrint?: () => void, onCancel?: () => void }) {
  const cancelled = status === "cancelled";
  return (
    <NexusTableRow onClick={onClick}>
      <NexusTableCell className="w-[1%] whitespace-nowrap align-middle text-center font-mono text-[13px] text-nexus-blue font-medium tracking-tighter">{id}</NexusTableCell>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-center font-mono text-[13px] text-white/40">{soRef}</NexusTableCell>
      <NexusTableCell className="font-bold text-white/80 w-full">{customer}</NexusTableCell>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-center text-[13px] font-medium text-white/40">{date}</NexusTableCell>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-center text-[13px] font-medium text-warning">{dueDate}</NexusTableCell>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-right text-white" mono>{total}</NexusTableCell>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-center">
        {cancelled ? (
          <span title={replacedByNo ? `ออกใบแทนเลขที่ ${replacedByNo}` : undefined}><StatusBadge status="danger" label={replacedByNo ? "ยกเลิก (มีใบแทน)" : "ยกเลิกแล้ว"} /></span>
        ) : refundDue > 0 ? (
          <StatusBadge status="warning" label="ค้างคืนเงิน" />
        ) : (
          <StatusBadge
            status={status === "paid" ? "active" : status === "partial" ? "warning" : "pending"}
            label={status === "paid" ? "ชำระแล้ว" : status === "partial" ? "ชำระบางส่วน" : "รอชำระ"}
          />
        )}
      </NexusTableCell>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-center">
        <div onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1.5">
          <PrintButton onPrint={onPrint} label={id} />
          {!cancelled && <>
          {refundDue > 0 && !isSample && (
            <Link href={`/finance/refunds/new?invoice=${encodeURIComponent(docId)}`} className="h-8 px-3 rounded-full border border-warning/40 text-warning text-[12px] font-bold flex items-center hover:bg-warning/10" title={`คืนเงินลูกค้า ฿${refundDue.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`}>
              คืนเงิน
            </Link>
          )}
          {status !== "paid" && !isSample && (
            <Link href={`/finance/receipts/new?invoice=${encodeURIComponent(docId)}`} className="h-8 px-3 rounded-full border border-nexus-teal/30 text-nexus-teal text-[12px] font-bold flex items-center hover:bg-nexus-teal/10">
              รับชำระ
            </Link>
          )}
          {/* ใบกำกับภาษีลบไม่ได้ (เลขต้องต่อเนื่อง) — แก้มูลค่าด้วยใบลดหนี้/เพิ่มหนี้; ลบได้เฉพาะเอกสารตัวอย่าง */}
          {isSample ? (
            <SecureDeleteAction collectionName={`companies/${companyId}/invoices`} documentId={docId} displayName={customer} compact />
          ) : (
            <Link href={`/sales/cndn/new?invoice=${encodeURIComponent(docId)}`} className="h-8 px-3 rounded-full border border-white/15 text-white/70 text-[12px] font-bold flex items-center hover:bg-white/[0.05]" title="ออกใบลดหนี้ / ใบเพิ่มหนี้อ้างอิงใบกำกับนี้">
              ลดหนี้
            </Link>
          )}
          {onCancel && !isSample && status === "pending" && (
            <button type="button" onClick={onCancel} className="w-8 h-8 rounded-full border border-white/15 text-white/50 hover:text-danger hover:border-danger/40 inline-flex items-center justify-center" title={`ยกเลิก / ออกใบแทน ${id}`} aria-label={`ยกเลิก ${id}`}><Ban size={14} /></button>
          )}
          </>}
        </div>
      </NexusTableCell>
    </NexusTableRow>
  );
}

function BillingNoteRow({ id, docId, customer, date, dueDate, total, status, companyId, onClick, onPrint }: any) {
  return (
    <NexusTableRow onClick={onClick}>
      <NexusTableCell className="w-[1%] whitespace-nowrap align-middle text-center font-mono text-[13px] text-warning font-medium tracking-tighter">{id}</NexusTableCell>
      <NexusTableCell className="font-bold text-white/80 w-full">{customer}</NexusTableCell>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-center text-[13px] font-medium text-white/40">{date}</NexusTableCell>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-center text-[13px] font-medium text-warning">{dueDate}</NexusTableCell>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-right text-white" mono>{total}</NexusTableCell>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-center">
        <StatusBadge status={status === "Paid" ? "active" : "pending"} label={status === "Paid" ? "รับชำระแล้ว" : "รอดำเนินการ"} />
      </NexusTableCell>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-center">
        {/* ใบวางบิลออกคู่กับใบกำกับภาษี จึงไม่ให้ลบแยก */}
        <PrintButton onPrint={onPrint} label={id} />
      </NexusTableCell>
    </NexusTableRow>
  );
}

function CndnRow({ id, customer, type, invoiceNo, reason, date, total, status, canCancel, onCancel, onClick, onPrint }: any) {
  const cancelled = String(status || "").toLowerCase() === "cancelled";
  return (
    <NexusTableRow onClick={onClick}>
      <NexusTableCell className="font-mono text-[13px] text-nexus-blue"><span title={reason ? `เหตุผล: ${reason}` : undefined}>{id}</span></NexusTableCell>
      <NexusTableCell className="font-bold text-white/80">{customer}</NexusTableCell>
      <NexusTableCell><span className={type === "DN" ? "text-warning text-[12px] font-bold" : "text-nexus-teal text-[12px] font-bold"}>{type === "DN" ? "ใบเพิ่มหนี้" : "ใบลดหนี้"}</span></NexusTableCell>
      <NexusTableCell className="font-mono text-[13px] text-white/60">{invoiceNo}</NexusTableCell>
      <NexusTableCell className="text-white/60">{date}</NexusTableCell>
      <NexusTableCell className="text-white" mono>{total}</NexusTableCell>
      <NexusTableCell>{cancelled ? <StatusBadge status="danger" label="ยกเลิกแล้ว" /> : <StatusBadge status="active" label="ออกแล้ว" />}</NexusTableCell>
      <NexusTableCell>
        <span className="inline-flex items-center gap-1.5">
        <PrintButton onPrint={onPrint} label={id} />
        {!cancelled && canCancel ? (
          <button type="button" onClick={(e) => { e.stopPropagation(); onCancel(); }} className="w-8 h-8 rounded-full border border-white/15 text-white/50 hover:text-danger hover:border-danger/40 inline-flex items-center justify-center" title={`ยกเลิก ${id}`} aria-label={`ยกเลิก ${id}`}><Ban size={14} /></button>
        ) : null}
        </span>
      </NexusTableCell>
    </NexusTableRow>
  );
}

function ReceiptRow({ id, docId, invRef, customer, date, total, status, companyId, onClick, onPrint }: any) {
  return (
    <NexusTableRow onClick={onClick}>
      <NexusTableCell className="w-[1%] whitespace-nowrap align-middle text-center font-mono text-[13px] text-emerald-400 font-medium tracking-tighter">{id}</NexusTableCell>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-center font-mono text-[13px] text-white/40">{invRef}</NexusTableCell>
      <NexusTableCell className="font-bold text-white/80 w-full">{customer}</NexusTableCell>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-center text-[13px] font-medium text-white/40">{date}</NexusTableCell>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-right text-emerald-400" mono>{total}</NexusTableCell>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-center">
        {status === "cancelled" ? <StatusBadge status="danger" label="ยกเลิกแล้ว" /> : <StatusBadge status="active" label="รับชำระแล้ว" />}
      </NexusTableCell>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-center">
        <span className="inline-flex items-center gap-1.5"><PrintButton onPrint={onPrint} label={id} />
        <Link href={`/finance/receipts/${encodeURIComponent(docId)}`} onClick={(e) => e.stopPropagation()} className="h-8 px-3 rounded-full border border-white/15 text-white/70 text-[12px] font-bold inline-flex items-center hover:bg-white/[0.05]">
          เปิดดู
        </Link></span>
      </NexusTableCell>
    </NexusTableRow>
  );
}


function PipelineStage({ label, count, value, color = "bg-white/10" }: { label: string, count: number, value: string, color?: string }) {
  return (
    <div className="space-y-2">
       <div className="flex justify-between items-center text-[13px] font-medium uppercase tracking-widest">
          <span className="text-white/30">{label} ({count})</span>
          <span className="text-white/80 mono-numbers">{value}</span>
       </div>
       <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
          <div className={cn("h-full", color)} style={{ width: (count / 20 * 100) + "%" }} />
       </div>
    </div>
  );
}

function ReminderItem({ name, detail }: { name: string, detail: string }) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 group hover:bg-white/[0.05] transition-all">
       <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center text-warning group-hover:shadow-neon-warning transition-all">
          <Bell size={16} />
       </div>
       <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{name}</p>
          <p className="text-[12px] text-white/30 uppercase font-medium tracking-[0.1em] mt-0.5">{detail}</p>
       </div>
    </div>
  );
}



