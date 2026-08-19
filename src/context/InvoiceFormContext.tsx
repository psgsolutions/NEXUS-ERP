"use client";

import React, { createContext, useContext, useState, useMemo } from "react";
import { DocumentItem } from "@/types/shared";
import { db } from "@/lib/firebase-client";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { nexusSequenceEngine } from "@/lib/sequence-engine";
import { arabicNumberToThaiText } from "@/lib/utils/thaiBahtText";
import { useRouter } from "next/navigation";
import { useRealtimeCollection } from '@/hooks/useRealtimeCollection';

export interface InvoiceFormData {
  soId: string;
  soCode: string;
  issueDate: string;
  dueDate: string;
  customerId: string;
  customerName: string;
  customerTaxId: string;
  billingAddress: string;
  taxDisplayMode: 'VAT_EXCLUDED' | 'VAT_INCLUDED' | 'NON_VAT';
  whtRate: number;
  globalDiscount: number;
  remarks: string;
}

interface InvoiceFormContextType {
  formData: InvoiceFormData;
  setFormData: React.Dispatch<React.SetStateAction<InvoiceFormData>>;
  items: DocumentItem[];
  setItems: React.Dispatch<React.SetStateAction<DocumentItem[]>>;
  loading: boolean;
  salesOrders: any[];
  summary: {
    rawSubTotal: number;
    subTotalAfterDiscount: number;
    vatAmount: number;
    whtAmount: number;
    grandTotal: number;
    preVatAmount: number;
    thaiBahtText: string;
  };
  handleSOChange: (value: string) => void;
  handleSave: () => Promise<void>;
  currentCompanyId: string;
}

const InvoiceFormContext = createContext<InvoiceFormContextType | null>(null);

export function InvoiceFormProvider({ children }: { children: React.ReactNode }) {
  const { user, companyId } = useAuth();
  const currentCompanyId = companyId || 'COMP-001';
  const router = useRouter();

  const { data: salesOrders } = useRealtimeCollection('sales_orders');

  const [formData, setFormData] = useState<InvoiceFormData>({
    soId: '',
    soCode: '',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    customerId: '',
    customerName: '',
    customerTaxId: '',
    billingAddress: '',
    taxDisplayMode: 'VAT_EXCLUDED',
    whtRate: 0,
    globalDiscount: 0,
    remarks: 'กรุณาชำระเงินภายในกำหนดเวลาที่ระบุไว้ในใบวางบิล',
  });

  const [items, setItems] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(false);

  const summary = useMemo(() => {
    const rawSubTotal = items.reduce((sum, item) => sum + item.totalAmount, 0);
    const subAfterDiscount = Math.max(0, rawSubTotal - formData.globalDiscount);
    
    let vatAmount = 0;
    let preVatAmount = subAfterDiscount;
    let whtAmount = 0;
    let grandTotal = 0;

    if (formData.taxDisplayMode === 'VAT_EXCLUDED') {
      vatAmount = subAfterDiscount * 0.07;
      whtAmount = subAfterDiscount * (formData.whtRate / 100);
      grandTotal = subAfterDiscount + vatAmount - whtAmount;
    } else if (formData.taxDisplayMode === 'VAT_INCLUDED') {
      vatAmount = subAfterDiscount - (subAfterDiscount / 1.07);
      preVatAmount = subAfterDiscount - vatAmount;
      whtAmount = preVatAmount * (formData.whtRate / 100);
      grandTotal = subAfterDiscount - whtAmount;
    } else {
      vatAmount = 0;
      whtAmount = subAfterDiscount * (formData.whtRate / 100);
      grandTotal = subAfterDiscount - whtAmount;
    }

    const thaiBahtText = arabicNumberToThaiText(grandTotal);

    return {
      rawSubTotal,
      subTotalAfterDiscount: subAfterDiscount,
      vatAmount,
      whtAmount,
      grandTotal,
      preVatAmount,
      thaiBahtText
    };
  }, [items, formData.globalDiscount, formData.taxDisplayMode, formData.whtRate]);

  const handleSOChange = (value: string) => {
    const so = salesOrders.find(s => s.id === value);
    if (so) {
      setFormData(prev => ({
        ...prev,
        soId: so.id,
        soCode: so.soCode || so.documentNo || so.id,
        customerId: so.customerId || so.customer?.customerId || '',
        customerName: so.customerName || so.customer?.name || so.customer || '',
        customerTaxId: so.customerTaxId || '',
        billingAddress: so.billingAddress || '',
        taxDisplayMode: so.taxDisplayMode || 'VAT_EXCLUDED',
        globalDiscount: so.globalDiscount || 0,
        whtRate: so.whtRate || 0,
      }));
      if (so.items && Array.isArray(so.items)) {
        const newItems: DocumentItem[] = so.items.map((i: any) => ({
          ...i,
          id: Date.now().toString() + Math.random().toString(36).substring(2, 7)
        }));
        setItems(newItems);
      }
    } else {
      setFormData(prev => ({ ...prev, soId: '', soCode: '', customerId: '', customerName: '', customerTaxId: '', billingAddress: '' }));
      setItems([]);
    }
  };

  const handleSave = async () => {
    if (!formData.soId || items.length === 0) {
      alert("กรุณาเลือกอ้างอิงใบสั่งขาย (SO) และต้องมีรายการอย่างน้อย 1 รายการ");
      return;
    }
    
    try {
      setLoading(true);
      const invCode = await nexusSequenceEngine('INV', currentCompanyId);
      
      const payload = {
        companyId: currentCompanyId,
        invoiceCode: invCode,
        soId: formData.soId,
        soCode: formData.soCode,
        issueDate: formData.issueDate,
        dueDate: formData.dueDate,
        customerId: formData.customerId,
        customerName: formData.customerName,
        customerTaxId: formData.customerTaxId,
        billingAddress: formData.billingAddress,
        taxDisplayMode: formData.taxDisplayMode,
        items,
        subTotal: summary.rawSubTotal,
        globalDiscount: formData.globalDiscount,
        subTotalAfterDiscount: summary.subTotalAfterDiscount,
        vatRate: formData.taxDisplayMode === 'NON_VAT' ? 0 : 7,
        vatAmount: summary.vatAmount,
        whtRate: formData.whtRate,
        whtAmount: summary.whtAmount,
        grandTotal: summary.grandTotal,
        thaiBahtText: summary.thaiBahtText,
        remarks: formData.remarks,
        salespersonId: user?.uid || 'SYSTEM',
        createdBy: user?.uid || 'SYSTEM',
        createdAt: serverTimestamp(),
        isDeleted: false,
        status: 'UNPAID'
      };

      await addDoc(collection(db, 'invoices'), payload);
      
      alert(`บันทึกใบแจ้งหนี้สำเร็จ: ${invCode}`);
      router.push('/finance/invoices');
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setLoading(false);
    }
  };

  return (
    <InvoiceFormContext.Provider value={{
      formData,
      setFormData,
      items,
      setItems,
      loading,
      salesOrders,
      summary,
      handleSOChange,
      handleSave,
      currentCompanyId
    }}>
      {children}
    </InvoiceFormContext.Provider>
  );
}

export function useInvoiceForm() {
  const context = useContext(InvoiceFormContext);
  if (!context) {
    throw new Error("useInvoiceForm must be used within InvoiceFormProvider");
  }
  return context;
}
