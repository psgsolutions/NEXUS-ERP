"use client";

import React, { createContext, useContext, useState, useMemo, useEffect } from "react";
import { DocumentItem } from "@/types/shared";
import { db } from "@/lib/firebase-client";
import { collection, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { nexusSequenceEngine } from "@/lib/sequence-engine";
import { arabicNumberToThaiText } from "@/lib/utils/thaiBahtText";
import { useRouter } from "next/navigation";

export interface QuotationFormData {
  quotationType: string;
  issueDate: string;
  validDays: number;
  customerId: string;
  customerName: string;
  customerTaxId: string;
  customerBranch: string;
  billingAddress: string;
  contactPerson: string;
  taxDisplayMode: 'VAT_EXCLUDED' | 'VAT_INCLUDED' | 'NON_VAT';
  vatIncAddPerItem: boolean;
  projectId: string;
  projectName: string;
  totalLaborCost: number;
  deliveryAddress: string;
  paymentTerms: string;
  whtRate: number;
  globalDiscount: number;
  remarks: string;
  isCompetitorQuote: boolean;
  competitorFor: string;
}

interface QuotationFormContextType {
  formData: QuotationFormData;
  setFormData: React.Dispatch<React.SetStateAction<QuotationFormData>>;
  items: DocumentItem[];
  setItems: React.Dispatch<React.SetStateAction<DocumentItem[]>>;
  loading: boolean;
  qtFormat: string;
  validUntil: string;
  summary: {
    rawSubTotal: number;
    totalCost: number;
    subTotalAfterDiscount: number;
    vatAmount: number;
    whtAmount: number;
    grandTotal: number;
    preVatAmount: number;
    grossProfit: number;
    thaiBahtText: string;
  };
  handleCustomerChange: (val: string, cust: any) => void;
  handleSave: () => Promise<void>;
  currentCompanyId: string;
}

const QuotationFormContext = createContext<QuotationFormContextType | null>(null);

export function QuotationFormProvider({ children }: { children: React.ReactNode }) {
  const { user, companyId } = useAuth();
  const currentCompanyId = companyId || 'COMP-001';
  const router = useRouter();
  
  const [sourceProjectId, setSourceProjectId] = useState<string | null>(null);
  const [qtFormat, setQtFormat] = useState('QT-[YYMM]-[0000]');
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState<QuotationFormData>({
    quotationType: 'SALE',
    issueDate: new Date().toISOString().split('T')[0],
    validDays: 30,
    customerId: '',
    customerName: '',
    customerTaxId: '',
    customerBranch: '',
    billingAddress: '',
    contactPerson: '',
    taxDisplayMode: 'VAT_INCLUDED',
    vatIncAddPerItem: false,
    projectId: '',
    projectName: '',
    totalLaborCost: 0,
    deliveryAddress: '',
    paymentTerms: '',
    whtRate: 0,
    globalDiscount: 0,
    remarks: 'กำหนดยืนราคา 30 วันนับจากวันที่เสนอราคา\nการชำระเงิน: โอนเงินเข้าบัญชีบริษัท',
    isCompetitorQuote: false,
    competitorFor: '',
  });

  const [items, setItems] = useState<DocumentItem[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const pid = urlParams.get('projectId');
      if (pid) setSourceProjectId(pid);
    }

    const fetchFormat = async () => {
      try {
        const formatRef = doc(db, `companies/${currentCompanyId}/settings`, "sequence_formats");
        const snap = await getDoc(formatRef);
        if (snap.exists() && snap.data()['QT']) {
          setQtFormat(snap.data()['QT']);
        }
      } catch (e) {
        console.error("Failed to fetch format", e);
      }
    };
    fetchFormat();
  }, [currentCompanyId]);

  useEffect(() => {
    if (sourceProjectId) {
      const fetchProject = async () => {
        try {
          const docRef = doc(db, 'projects', sourceProjectId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const pData = docSnap.data();
            
            let cust: any = null;
            if (pData.customerId) {
              const cSnap = await getDoc(doc(db, 'customers', pData.customerId));
              if (cSnap.exists()) {
                cust = { id: cSnap.id, ...cSnap.data() };
              }
            }
            
            setFormData(prev => ({
              ...prev,
              projectId: sourceProjectId,
              projectName: pData.title || prev.projectName,
              customerId: pData.customerId || prev.customerId,
              customerName: cust ? (cust.customerName || cust.name || '') : prev.customerName,
              customerTaxId: cust ? (cust.taxId || '') : prev.customerTaxId,
              customerBranch: cust ? (cust.branchCode || '00000') : prev.customerBranch,
              billingAddress: cust ? [cust.addressNo, cust.soi, cust.road, cust.subDistrict, cust.district, cust.province, cust.zipCode].filter(Boolean).join(' ') : prev.billingAddress,
              paymentTerms: cust ? (cust.paymentTerms || prev.paymentTerms) : prev.paymentTerms,
              contactPerson: cust ? (cust.contactPerson || prev.contactPerson) : prev.contactPerson,
            }));
          }
        } catch (e) {
          console.error("Error fetching project:", e);
        }
      };
      fetchProject();
    }
  }, [sourceProjectId]);

  const validUntil = useMemo(() => {
    if (!formData.issueDate) return '';
    const d = new Date(formData.issueDate);
    if (isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + (Number(formData.validDays) || 0));
    return d.toISOString().split('T')[0];
  }, [formData.issueDate, formData.validDays]);

  const summary = useMemo(() => {
    const rawSubTotal = items.reduce((sum, item) => sum + item.totalAmount, 0);
    const totalCost = items.reduce((sum, item) => sum + ((item.cost || 0) * item.quantity), 0) + formData.totalLaborCost;
    
    const subAfterDiscount = Math.max(0, rawSubTotal - formData.globalDiscount);
    
    let vatAmount = 0;
    let preVatAmount = subAfterDiscount;
    let whtAmount = 0;
    let grandTotal = 0;

    // WHT รายบรรทัด: กระจายส่วนลดท้ายบิลตามสัดส่วน และคิดจากยอดก่อน VAT
    const discountFactor = rawSubTotal > 0 ? subAfterDiscount / rawSubTotal : 0;
    const vatDivisor = formData.taxDisplayMode === 'VAT_INCLUDED' ? 1.07 : 1;
    const perLineWhtSum = items.reduce((sum, item: any) => {
      const lineTotal = item.totalAmount || ((item.quantity || 1) * (item.unitPrice || item.price || 0));
      const lineBase = (lineTotal * discountFactor) / vatDivisor;
      const lineWhtRate = Number(item.whtRate) || 0;
      return sum + (lineBase * (lineWhtRate / 100));
    }, 0);

    const hasPerLineWht = items.some((item: any) => (item.whtRate || 0) > 0);

    if (formData.taxDisplayMode === 'VAT_EXCLUDED') {
      vatAmount = subAfterDiscount * 0.07;
      whtAmount = hasPerLineWht ? perLineWhtSum : subAfterDiscount * (formData.whtRate / 100);
      grandTotal = subAfterDiscount + vatAmount - whtAmount;
    } else if (formData.taxDisplayMode === 'VAT_INCLUDED') {
      vatAmount = subAfterDiscount - (subAfterDiscount / 1.07);
      preVatAmount = subAfterDiscount - vatAmount;
      whtAmount = hasPerLineWht ? perLineWhtSum : preVatAmount * (formData.whtRate / 100);
      grandTotal = subAfterDiscount - whtAmount;
    } else {
      vatAmount = 0;
      whtAmount = hasPerLineWht ? perLineWhtSum : subAfterDiscount * (formData.whtRate / 100);
      grandTotal = subAfterDiscount - whtAmount;
    }

    const thaiBahtText = arabicNumberToThaiText(grandTotal);

    return {
      rawSubTotal,
      totalCost,
      subTotalAfterDiscount: subAfterDiscount,
      vatAmount,
      whtAmount,
      grandTotal,
      preVatAmount,
      grossProfit: subAfterDiscount - totalCost,
      thaiBahtText
    };
  }, [items, formData.globalDiscount, formData.taxDisplayMode, formData.whtRate, formData.totalLaborCost]);

  const handleCustomerChange = (val: string, cust: any) => {
    if (cust) {
      setFormData(prev => ({
        ...prev,
        customerId: cust.id,
        customerName: cust.customerName || cust.name || '',
        customerTaxId: cust.taxId || '',
        customerBranch: cust.branchCode || '00000',
        billingAddress: [cust.addressNo, cust.soi, cust.road, cust.subDistrict, cust.district, cust.province, cust.zipCode].filter(Boolean).join(' '),
        paymentTerms: cust.paymentTerms || prev.paymentTerms,
        contactPerson: cust.contactPerson || prev.contactPerson,
      }));
    }
  };

  const handleSave = async () => {
    if ((!formData.customerId && !formData.isCompetitorQuote) || (!formData.customerName && formData.isCompetitorQuote) || items.length === 0) {
      alert("กรุณาระบุชื่อลูกค้าและเพิ่มรายการสินค้าอย่างน้อย 1 รายการ");
      return;
    }
    
    try {
      setLoading(true);
      const qtCode = await nexusSequenceEngine('QT', currentCompanyId);
      
      const payload = {
        companyId: currentCompanyId,
        quotationNo: qtCode,
        quotationType: formData.quotationType,
        issueDate: formData.issueDate,
        validDays: formData.validDays,
        validUntil,
        currency: 'THB',
        exchangeRate: 1,
        status: 'DRAFT',
        revisionNo: 0,
        
        customerId: formData.customerId,
        customerName: formData.customerName,
        customerTaxId: formData.customerTaxId,
        customerBranch: formData.customerBranch,
        billingAddress: formData.billingAddress,
        contactPerson: formData.contactPerson,
        deliveryAddress: formData.deliveryAddress,
        taxDisplayMode: formData.taxDisplayMode,
        paymentTerms: formData.paymentTerms,
        
        items,
        
        projectId: formData.projectId,
        projectName: formData.projectName,
        totalLaborCost: formData.totalLaborCost,
        totalCost: summary.totalCost,
        
        subTotal: summary.rawSubTotal,
        globalDiscount: formData.globalDiscount,
        subTotalAfterDiscount: summary.subTotalAfterDiscount,
        grossProfit: summary.grossProfit,
        vatRate: formData.taxDisplayMode === 'NON_VAT' ? 0 : 7,
        vatAmount: summary.vatAmount,
        whtRate: formData.whtRate,
        whtAmount: summary.whtAmount,
        grandTotal: summary.grandTotal,
        thaiBahtText: summary.thaiBahtText,
        
        remarks: formData.remarks,
        salespersonId: user?.uid || 'SYSTEM',
        salespersonName: user?.email || 'System User',
        
        createdBy: user?.uid || 'SYSTEM',
        createdAt: serverTimestamp(),
        isDeleted: false,
        
        isCompetitorQuote: formData.isCompetitorQuote,
        competitorFor: formData.competitorFor,
      };

      await addDoc(collection(db, `companies/${currentCompanyId}/quotations`), payload);
      
      alert(`บันทึกใบเสนอราคาสำเร็จ: ${qtCode}`);
      router.push('/sales?tab=quotations');
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setLoading(false);
    }
  };

  return (
    <QuotationFormContext.Provider value={{
      formData,
      setFormData,
      items,
      setItems,
      loading,
      qtFormat,
      validUntil,
      summary,
      handleCustomerChange,
      handleSave,
      currentCompanyId
    }}>
      {children}
    </QuotationFormContext.Provider>
  );
}

export function useQuotationForm() {
  const context = useContext(QuotationFormContext);
  if (!context) {
    throw new Error("useQuotationForm must be used within QuotationFormProvider");
  }
  return context;
}
