import { db } from "@/lib/firebase-client";
import { collection, doc, writeBatch, serverTimestamp } from "firebase/firestore";
import { 
  ProjectBOQ, 
  Quotation, 
  SalesOrder, 
  DocumentCustomerInfo,
  UniversalLineItem,
  PurchaseOrder
} from "@/types/database";
import { calculateERPDocument, LineItem, VatTypeV3 } from "@/lib/erp-logic";
import { idService } from "@/lib/idService";
import { auditService } from "@/services/audit.service";

/**
 * NEXUS ERP - Document Flow Service
 * Handles One-Click Transformation between document phases.
 */
export const DocumentFlowService = {
  
  /**
   * Phase 2 -> 3: Convert Project BOQ to Quotation
   * If value > 500k, the UI should trigger Bidding mode via the returned isBiddingTriggered flag.
   */
  async convertBOQToQuotation(
    companyId: string,
    boq: ProjectBOQ,
    customerInfo: DocumentCustomerInfo,
    userId: string
  ): Promise<{ quotationId: string, isBiddingTriggered: boolean }> {
    const batch = writeBatch(db);
    const quotationRef = doc(collection(db, `companies/${companyId}/quotations`));

    // Map BOQ items to UniversalLineItems and logic LineItems
    const logicItems: LineItem[] = [];
    const universalItems: UniversalLineItem[] = [];

    boq.items.forEach(item => {
      logicItems.push({
        id: item.id,
        qty: item.qty,
        costPrice: item.estimatedCost,
        projectPrice: item.estimatedPrice,
        retailPrice: item.estimatedPrice
      });

      universalItems.push({
        id: item.id,
        itemCode: item.category === 'hardware' ? `HW-${item.id.substring(0,4)}` : `SV-${item.id.substring(0,4)}`,
        description: item.description,
        quantity: item.qty,
        unitPrice: item.estimatedPrice,
        discount: 0,
        totalAmount: item.totalPrice,
        isFOC: false
      });
    });

    // Calculate financials using V3 Logic Engine (Default to EXCLUSIVE VAT for Projects)
    const calc = calculateERPDocument(logicItems, 'EXCLUSIVE', true);

    const quotation: Partial<Quotation> = {
      id: quotationRef.id,
      companyId,
      documentNo: `QT-${new Date().toISOString().substring(2,7).replace('-','')}-${Math.floor(Math.random() * 1000)}`,
      issueDate: serverTimestamp(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      customerInfo,
      isVatRegistered: true,
      vatType: 'Exclude VAT',
      items: universalItems,
      subTotal: calc.subTotal,
      totalDiscount: 0,
      vatAmount: calc.vatAmount,
      grandTotal: calc.grandTotal,
      remarks: 'Generated automatically from BOQ',
      status: 'draft',
      paymentTermDays: 30,
      probability: 0.5,
      expectedRevenue: calc.grandTotal * 0.5,
      createdBy: userId,
      updatedBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isDeleted: false
    };

    batch.set(quotationRef, quotation);
    
    // Auto-update BOQ status
    const boqRef = doc(db, `companies/${companyId}/project_boqs`, boq.id);
    batch.update(boqRef, { status: 'approved', updatedAt: serverTimestamp(), updatedBy: userId });

    await batch.commit();

    return { 
      quotationId: quotationRef.id, 
      isBiddingTriggered: calc.isBiddingTriggered 
    };
  },

  /**
   * Phase 3 -> 4: Convert Quotation to Sales Order
   */
  async convertQuotationToSalesOrder(
    companyId: string,
    quotation: Quotation,
    userId: string
  ): Promise<string> {
    const batch = writeBatch(db);
    const soRef = doc(collection(db, `companies/${companyId}/sales_orders`));

    const soItems = quotation.items.map(item => ({
      productId: item.itemCode,
      name: item.description,
      qty: item.quantity,
      unit: 'Unit',
      price: item.unitPrice,
      discount: item.discount
    }));

    // Normalize vatType carry-over
    const rawVatType = String(quotation.vatType || (quotation as any).taxMode || 'Exclude VAT');
    let normalizedVatType = 'Exclude VAT';
    if (rawVatType === 'Inclusive' || rawVatType === 'Include VAT') {
      normalizedVatType = 'Include VAT';
    } else if (rawVatType === 'Exclusive' || rawVatType === 'Exclude VAT') {
      normalizedVatType = 'Exclude VAT';
    } else if (rawVatType === 'Non-VAT') {
      normalizedVatType = 'Non-VAT';
    }

    const salesOrder: Partial<SalesOrder> = {
      id: soRef.id,
      companyId,
      orderId: `SO-${new Date().toISOString().substring(2,7).replace('-','')}-${Math.floor(Math.random() * 1000)}`,
      quotationRefNo: quotation.documentNo,
      referenceNo: (quotation as any).referenceNo || (quotation as any).customerPoNo || quotation.documentNo || "",
      customerPoNo: (quotation as any).referenceNo || (quotation as any).customerPoNo || "",
      customerSnapshot: (quotation as any).customerSnapshot || null,
      customerId: quotation.customerInfo?.customerId || (quotation as any).customerId,
      orderDate: serverTimestamp(),
      deliveryDate: quotation.dueDate,
      items: soItems,
      shippingAddress: quotation.customerInfo?.address || "",
      billingAddress: quotation.customerInfo?.address || "",
      shippingMethod: 'Standard',
      paymentStatus: 'pending',
      depositAmount: 0,
      subTotal: quotation.subTotal || quotation.grandTotal,
      vatAmount: quotation.vatAmount || 0,
      totalAmount: quotation.grandTotal,
      vatType: normalizedVatType,
      isVatRegistered: quotation.isVatRegistered ?? true,
      status: 'confirmed',
      createdBy: userId,
      updatedBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isDeleted: false
    };

    batch.set(soRef, salesOrder);

    // Update Quotation Status
    const quoteRef = doc(db, `companies/${companyId}/quotations`, quotation.id);
    batch.update(quoteRef, { status: 'approved', updatedAt: serverTimestamp(), updatedBy: userId });

    await batch.commit();
    return soRef.id;
  },

  /**
   * Phase 4 -> 5: Auto Split Sales Order to Purchase Orders
   * Maps items to suppliers and generates separate POs.
   */
  async autoSplitSalesOrderToPO(
    companyId: string,
    salesOrder: SalesOrder,
    itemSupplierMap: Record<string, string>, // productId -> supplierId
    userId: string
  ): Promise<string[]> {
    const batch = writeBatch(db);
    const poIds: string[] = [];
    
    // Group items by supplier
    const supplierGroups: Record<string, any[]> = {};
    
    salesOrder.items.forEach(item => {
      const supplierId = itemSupplierMap[item.productId] || 'SUP-DEFAULT';
      if (!supplierGroups[supplierId]) {
        supplierGroups[supplierId] = [];
      }
      supplierGroups[supplierId].push(item);
    });

    // Create a PO for each supplier
    for (const [supplierId, items] of Object.entries(supplierGroups)) {
      const poRef = doc(collection(db, `companies/${companyId}/purchase_orders`));
      
      let subTotal = 0;
      items.forEach(i => subTotal += (i.qty * i.price));
      const vatAmount = subTotal * 0.07;

      const purchaseOrder: Partial<PurchaseOrder> = {
        id: poRef.id,
        companyId,
        poId: `PO-${new Date().toISOString().substring(2,7).replace('-','')}-${Math.floor(Math.random() * 1000)}`,
        soRef: salesOrder.orderId,
        supplierId,
        orderDate: serverTimestamp(),
        deliveryDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days
        items: items,
        shippingMethod: 'Supplier Delivery',
        paymentTerms: '30 Days',
        taxRate: 7,
        subtotal: subTotal,
        taxAmount: vatAmount,
        totalAmount: subTotal + vatAmount,
        vat_type: 'Exclusive',
        status: 'draft',
        createdBy: userId,
        updatedBy: userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isDeleted: false
      };

      batch.set(poRef, purchaseOrder);
      poIds.push(poRef.id);
    }

    // Update SO status
    const soRef = doc(db, `companies/${companyId}/sales_orders`, salesOrder.id);
    batch.update(soRef, { status: 'processing', updatedAt: serverTimestamp(), updatedBy: userId });

    await batch.commit();
    return poIds;
  },

  /**
   * One-Click Issue Tax Invoice & Billing Note from Delivered Sales Order
   */
  async issueTaxInvoiceAndBillingNoteFromSO(
    companyId: string,
    salesOrder: SalesOrder,
    userId: string
  ): Promise<{ taxInvoiceId: string; taxInvoiceNo: string; billingNoteId: string; billingNoteNo: string; vatAmount: number; subTotal: number; grandTotal: number; vatType: string }> {
    const rawVatType = String(salesOrder.vatType || (salesOrder as any).taxMode || 'Exclude VAT');
    let normalizedVatType = 'Exclude VAT';
    if (rawVatType === 'Inclusive' || rawVatType === 'Include VAT') {
      normalizedVatType = 'Include VAT';
    } else if (rawVatType === 'Non-VAT') {
      normalizedVatType = 'Non-VAT';
    } else {
      normalizedVatType = 'Exclude VAT';
    }

    const baseAmount = Number(salesOrder.totalAmount || (salesOrder as any).netTotal || 0);

    let subTotal = baseAmount;
    let vatAmount = 0;
    let grandTotal = baseAmount;

    if (normalizedVatType === 'Include VAT') {
      grandTotal = baseAmount;
      subTotal = Number((grandTotal / 1.07).toFixed(4));
      vatAmount = Number((grandTotal - subTotal).toFixed(4));
    } else if (normalizedVatType === 'Exclude VAT') {
      subTotal = baseAmount;
      vatAmount = Number((subTotal * 0.07).toFixed(4));
      grandTotal = Number((subTotal + vatAmount).toFixed(4));
    } else {
      // Non-VAT
      subTotal = baseAmount;
      vatAmount = 0;
      grandTotal = baseAmount;
    }

    // Atomic Sequence Generation for Tax Invoice and Billing Note
    const invSeq = await idService.getNextSequence('INV', companyId);
    const taxInvoiceNo = idService.formatId('INV', invSeq);

    const bnSeq = await idService.getNextSequence('BN', companyId);
    const billingNoteNo = idService.formatId('BN', bnSeq);

    const batch = writeBatch(db);

    // 1. Create TaxInvoice Document
    const invRef = doc(collection(db, `companies/${companyId}/invoices`));
    const invoicePayload = {
      id: invRef.id,
      companyId,
      invoiceId: taxInvoiceNo,
      invoiceNo: taxInvoiceNo,
      docNumber: taxInvoiceNo,
      orderRefNo: salesOrder.orderId || salesOrder.id,
      referenceNo: (salesOrder as any).referenceNo || (salesOrder as any).customerPoNo || (salesOrder as any).quotationRefNo || "",
      customerPoNo: (salesOrder as any).customerPoNo || (salesOrder as any).referenceNo || "",
      customerSnapshot: (salesOrder as any).customerSnapshot || null,
      customerId: salesOrder.customerId,
      customerName: (salesOrder as any).customerName || "",
      issueDate: serverTimestamp(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      items: salesOrder.items,
      isVatRegistered: salesOrder.isVatRegistered ?? true,
      vatType: normalizedVatType,
      subTotal,
      vatAmount,
      grandTotal,
      paymentStatus: 'unpaid',
      status: 'issued',
      createdBy: userId,
      updatedBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isDeleted: false
    };
    batch.set(invRef, invoicePayload);

    // 2. Create BillingNote Document
    const bnRef = doc(collection(db, `companies/${companyId}/billing_notes`));
    const billingNotePayload = {
      id: bnRef.id,
      companyId,
      billingNoteNo,
      docNumber: billingNoteNo,
      invoiceRefNo: taxInvoiceNo,
      salesOrderRefNo: salesOrder.orderId || salesOrder.id,
      referenceNo: (salesOrder as any).referenceNo || (salesOrder as any).customerPoNo || (salesOrder as any).quotationRefNo || "",
      customerPoNo: (salesOrder as any).customerPoNo || (salesOrder as any).referenceNo || "",
      customerSnapshot: (salesOrder as any).customerSnapshot || null,
      customerId: salesOrder.customerId,
      issueDate: serverTimestamp(),
      totalAmount: grandTotal,
      status: 'issued',
      createdBy: userId,
      updatedBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isDeleted: false
    };
    batch.set(bnRef, billingNotePayload);

    // 3. Update Sales Order Status to COMPLETED
    const soRef = doc(db, `companies/${companyId}/sales_orders`, salesOrder.id);
    batch.update(soRef, { 
      status: 'COMPLETED', 
      invoiceNo: taxInvoiceNo,
      billingNoteNo,
      updatedAt: serverTimestamp(), 
      updatedBy: userId 
    });

    await batch.commit();

    // 4. Audit Log Actions
    await auditService.logCreate(userId, companyId, "TAX_INVOICE", invRef.id, invoicePayload);
    await auditService.logCreate(userId, companyId, "BILLING_NOTE", bnRef.id, billingNotePayload);

    return {
      taxInvoiceId: invRef.id,
      taxInvoiceNo,
      billingNoteId: bnRef.id,
      billingNoteNo,
      subTotal,
      vatAmount,
      grandTotal,
      vatType: normalizedVatType
    };
  }
};
