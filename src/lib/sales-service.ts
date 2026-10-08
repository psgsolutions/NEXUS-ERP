import { db } from "./firebase-client";
import { 
  collection, 
  doc, 
  runTransaction, 
  serverTimestamp,
  getDoc,
  setDoc,
  updateDoc
} from "firebase/firestore";
import { nexusSequenceEngine } from "./sequence-engine";
import { InventoryService } from "@/services/inventoryService";
import { assertPeriodOpen } from "./period-close-service";


/**
 * [SALES-STRATEGY-V2.0]
 * Dynamic Quotation & Sales Order Engine
 */

export interface Quotation {
  id?: string;
  customerId: string;
  items: {
    productId: string;
    quantity: number;
    price: number;
    cost: number;
  }[];
  discount?: number;
  companyId: string;
  subject?: string;
  date?: string;
  validUntil?: string;
  taxMode?: string;
  paymentTerms?: string;
}

export async function createQuotation(quote: Quotation) {
  const { companyId, items } = quote;

  // 1. Calculate Margin & Validation
  let totalRevenue = 0;
  let totalCost = 0;
  items.forEach(item => {
    totalRevenue += item.price * item.quantity;
    totalCost += item.cost * item.quantity;
  });

  const margin = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0;
  
  // Rule: Reject if margin < 10% (unless override by superadmin)
  if (margin < 10 && totalRevenue > 0) {
    throw new Error(`กำไรต่ำกว่าเกณฑ์ (${margin.toFixed(2)}%) กรุณาขออนุมัติจาก Superadmin`);
  }

  // 2. Generate QT ID
  const quoteId = quote.id || await nexusSequenceEngine("QT", companyId);

  // 3. Save to Firestore
  const quoteRef = doc(db, `companies/${companyId}/quotations`, quoteId);
  await setDoc(quoteRef, {
    ...quote,
    id: quoteId,
    quoteId,
    totalRevenue,
    margin,
    status: quote.id && quote.id.includes("-REV") ? "Draft" : "Draft", // Keep Draft for revisions
    createdAt: serverTimestamp()
  }, { merge: true });

  return quoteId;
}

export async function createSalesOrder(data: any, companyId: string) {
  const soId = data.id || await nexusSequenceEngine("SO", companyId);
  const soRef = doc(db, `companies/${companyId}/sales_orders`, soId);
  
  let totalRevenue = 0;
  const items = data.items || [];
  items.forEach((item: any) => {
    const qty = item.qty || item.quantity || 0;
    totalRevenue += (item.price || 0) * qty;
  });
  
  await setDoc(soRef, {
    ...data.header,
    id: soId,
    customer: data.header?.customer || data.customer || "Unknown",
    items,
    summary: data.summary || {},
    soId,
    totalRevenue,
    status: data.header?.paymentStatus === "paid" ? "Confirmed" : "Pending",
    companyId,
    createdAt: serverTimestamp()
  }, { merge: true });
  
  return soId;
}

// convertToSalesOrder ย้ายไป sales-order.server.ts (Admin SDK) ใช้ผ่าน /api/sales/convert-so

export async function approveSalesOrder(soId: string, companyId: string, userId: string = "SYSTEM") {
  const soRef = doc(db, `companies/${companyId}/sales_orders`, soId);
  const soSnap = await getDoc(soRef);

  if (!soSnap.exists()) {
    throw new Error(`ไม่พบใบสั่งขายเลขที่ ${soId}`);
  }

  const soData = soSnap.data();
  if (soData.status === "APPROVED") {
    throw new Error(`ใบสั่งขาย ${soId} ถูกอนุมัติไปแล้ว`);
  }

  const items = soData.items || [];
  
  // 1. Process Stock Deduction (Hard Reserve / Deduct) via InventoryService
  // Note: InventoryService handles its own transaction for atomicity over stock updates
  if (items.length > 0) {
    await InventoryService.processSalesOrderStock(companyId, items, soId, userId);
  }

  // 2. Update Sales Order Status to APPROVED
  await updateDoc(soRef, {
    status: "APPROVED",
    approvedAt: new Date().toISOString(),
    approvedBy: userId
  });

  return true;
}

/**
 * [SALES-STRATEGY-V2.1]
 * Automated Procurement & Operations Generation from Sales Order
 * Step 8: SO -> PO & WO
 */
export async function autoGenerateOrdersFromSO(soId: string, companyId: string) {
  const soRef = doc(db, `companies/${companyId}/sales_orders`, soId);
  
  await runTransaction(db, async (transaction) => {
    const soSnap = await transaction.get(soRef);
    if (!soSnap.exists()) throw new Error("ไม่พบใบสั่งขาย");
    
    const soData = soSnap.data();
    if (soData.companyId !== companyId) {
      throw new Error("SECURITY_BREACH: Access to unauthorized company records.");
    }

    const items = soData.items || [];
    if (items.length === 0) return; // No items to process

    // 1. Generate Work Order (WO) for installation/services
    const woId = await nexusSequenceEngine("WO", companyId);
    const woRef = doc(db, `companies/${companyId}/work_orders`, woId);
    
    transaction.set(woRef, {
      woId,
      soRef: soId,
      projectId: soData.projectId || null,
      assignedTeam: [], // To be assigned later
      scheduledDate: soData.deliveryDate || serverTimestamp(),
      status: "draft",
      tasks: items.map((item: any) => ({
        description: `ติดตั้ง/ดำเนินงาน: ${item.name}`,
        isCompleted: false
      })),
      companyId,
      createdAt: serverTimestamp(),
      createdBy: "SYSTEM_AUTO"
    });

    // 2. Generate Purchase Orders (PO) grouped by Supplier (using Exclude VAT as default)
    // For simplicity, we create one draft PO. In reality, we'd group by primarySupplierId.
    const poId = await nexusSequenceEngine("PO", companyId);
    const poRef = doc(db, `companies/${companyId}/purchase_orders`, poId);
    
    let poSubTotal = 0;
    const poItems = items.map((item: any) => {
      // Use Exclude VAT logic: price is considered base cost
      const cost = item.price * 0.7; // Estimated cost if not provided
      const totalAmount = cost * item.quantity;
      poSubTotal += totalAmount;
      return {
        itemCode: item.productId,
        description: item.name,
        quantity: item.quantity,
        unitPrice: cost,
        totalAmount
      };
    });

    const vatAmount = poSubTotal * 0.07;
    const grandTotal = poSubTotal + vatAmount;

    transaction.set(poRef, {
      documentNo: poId,
      poId,
      soRef: soId,
      supplierInfo: {
        supplierId: "SUP-AUTO", // To be filled by purchasing team
        name: "Auto-Generated Supplier"
      },
      items: poItems,
      subTotal: poSubTotal,
      vatAmount,
      grandTotal,
      status: "draft",
      companyId,
      createdAt: serverTimestamp(),
      createdBy: "SYSTEM_AUTO"
    });

    // 3. Generate Delivery Note (DN)
    const dnId = await nexusSequenceEngine("DN", companyId);
    const dnRef = doc(db, `companies/${companyId}/delivery_notes`, dnId);

    transaction.set(dnRef, {
      dnId,
      soRef: soId,
      customerId: soData.customerId,
      deliveryDate: soData.deliveryDate || serverTimestamp(),
      shippingAddress: soData.shippingAddress || "",
      items: items.map((item: any) => ({
        itemCode: item.productId,
        description: item.name,
        quantityDelivered: item.quantity
      })),
      status: "draft",
      companyId,
      createdAt: serverTimestamp(),
      createdBy: "SYSTEM_AUTO"
    });
  });

  return true;
}

// ==========================================
// THAI ACCOUNTING DOCUMENT FLOW (PHASE 1)
// ==========================================

/**
 * Creates an Invoice (ใบแจ้งหนี้) from an existing Sales Order
 */
export async function createInvoiceFromSO(soId: string, companyId: string) {
  const soRef = doc(db, `companies/${companyId}/sales_orders`, soId);
  const soSnap = await getDoc(soRef);

  if (!soSnap.exists()) {
    throw new Error(`Sales Order ${soId} not found`);
  }

  const soData = soSnap.data();
  const invId = await nexusSequenceEngine("INV", companyId);
  const invRef = doc(db, `companies/${companyId}/invoices`, invId);

  await setDoc(invRef, {
    ...soData,
    id: invId,
    invoiceId: invId,
    soRef: soId,
    documentType: "Invoice",
    status: "Awaiting Payment",
    issuedAt: serverTimestamp(),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
    companyId,
    createdAt: serverTimestamp(),
  });

  return invId;
}

/**
 * Creates a Receipt (ใบเสร็จรับเงิน) from an existing Invoice
 */
// รับชำระเงิน: ใช้ POST /api/finance/receipts (ตัดยอดลูกหนี้ + บันทึกบัญชีใน transaction เดียว)
