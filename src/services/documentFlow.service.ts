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

    const salesOrder: Partial<SalesOrder> = {
      id: soRef.id,
      companyId,
      orderId: `SO-${new Date().toISOString().substring(2,7).replace('-','')}-${Math.floor(Math.random() * 1000)}`,
      quotationRefNo: quotation.documentNo,
      customerId: quotation.customerInfo.customerId,
      orderDate: serverTimestamp(),
      deliveryDate: quotation.dueDate,
      items: soItems,
      shippingAddress: quotation.customerInfo.address,
      billingAddress: quotation.customerInfo.address,
      shippingMethod: 'Standard',
      paymentStatus: 'pending',
      depositAmount: 0,
      totalAmount: quotation.grandTotal,
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
  }
};
