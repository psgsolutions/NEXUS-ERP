"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Send, Building2, Calendar, Plus, Info, AlertTriangle, Search, Trash2, FileText, Mail, MessageSquare, Download, Edit3, ChevronDown, CheckCircle2, Lock, Share2 } from 'lucide-react';
import { PillButton, cn, NexusDatePicker, GlassCard, Modal } from "@/components/ui/Base";
import { DocumentItemsTable } from "@/components/commerce/DocumentItemsTable";
import { DocumentAttachmentsCard } from "@/components/commerce/DocumentAttachmentsCard";
import { DocumentViewerModal } from "@/components/commerce/DocumentViewerModal";
import {
  calculateERPDocument,
  VatTypeV3,
  LineItem,
  formatCurrency,
  getProfitRainbowColor,
  validateQuotationDates,
  canWriteBackToProductMaster,
  calculateProfitAmount,
  QUOTATION_STATUS_LABELS,
  QUOTATION_STATUS_COLORS
} from "@/lib/erp-logic";
import { canViewCost } from "@/lib/permissions";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { DocumentStepper } from "@/components/ui/DocumentStepper";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { useCompanyProjects } from "@/hooks/useCompanyProjects";
import { useRealtimeDocument } from "@/hooks/useRealtimeDocument";
import { useAuth } from "@/context/AuthContext";
import { SmartSelect, StepperInput, SciFiDropdownPortal } from "@/components/ui/SmartComponents";
import { searchAddressByPostalCode } from "@/lib/thailand-address-helper";
import { db } from "@/lib/firebase-client";
import { writeBatch, doc, collection, serverTimestamp } from "firebase/firestore";

export default function QuotationCreationPage() {
  const router = useRouter();
  const { user, companyId, role } = useAuth();

  // Data Fetching from both root collection and company subcollection
  const effectiveCompanyId = companyId || 'COM-NEXUS-01';
  const { data: rootCustomers, loading: rootCustomersLoading } = useRealtimeCollection('customers');
  const { data: companyCustomers, loading: companyCustomersLoading } = useRealtimeCollection(`companies/${effectiveCompanyId}/customers`, [], false);
  const { data: users, loading: usersLoading } = useRealtimeCollection('users');

  const customersLoading = rootCustomersLoading && companyCustomersLoading;

  // Combine & deduplicate customer data from all Firestore stores
  const customers = useMemo(() => {
    const allItems = [...(companyCustomers || []), ...(rootCustomers || [])];
    const mapById = new Map<string, any>();
    const seenKeys = new Set<string>();
    const result: any[] = [];

    allItems.forEach((c: any) => {
      if (!c || !c.id || c.isDeleted === true) return;
      
      const nameKey = (c.customerName || c.name || c.companyName || "").trim().toLowerCase();
      const taxKey = (c.taxId || c.customerTaxId || "").trim().toLowerCase();
      const uniqueKey = taxKey ? `tax_${taxKey}` : nameKey ? `name_${nameKey}` : `id_${c.id}`;

      if (!mapById.has(c.id) && !seenKeys.has(uniqueKey)) {
        mapById.set(c.id, c);
        seenKeys.add(uniqueKey);
        result.push(c);
      }
    });

    return result;
  }, [rootCustomers, companyCustomers]);

  // Auto-generated fields
  const [quotationNumber] = useState(`QT-${new Date().getFullYear().toString().slice(-2)}${(new Date().getMonth() + 1).toString().padStart(2, '0')}-0001`);

  // Header State
  const [quotationType, setQuotationType] = useState("SALE");
  const [isQuotationTypeDropdownActive, setIsQuotationTypeDropdownActive] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [docDate, setDocDate] = useState(new Date().toISOString().split('T')[0]);
  const [validDays, setValidDays] = useState<number>(30);
  const [validUntil, setValidUntil] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [paymentTerms, setPaymentTerms] = useState("เงินสด");
  const [referenceNo, setReferenceNo] = useState("");

  useEffect(() => {
    if (docDate && validDays !== undefined) {
      const date = new Date(docDate);
      date.setDate(date.getDate() + validDays);
      setValidUntil(date.toISOString().split('T')[0]);
    }
  }, [docDate, validDays]);

  // Customer State
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const selectedCustomer = useMemo(() => customers.find(c => c.id === selectedCustomerId), [customers, selectedCustomerId]);
  const getCustomerName = (c: any) => c?.customerName || c?.name || c?.companyName || "";

  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isSendMenuOpen, setIsSendMenuOpen] = useState(false);
  const canSeeCost = canViewCost(role);

  const [addrLine1, setAddrLine1] = useState("");
  const [addrLine2, setAddrLine2] = useState("");
  const [subDistrict, setSubDistrict] = useState("");
  const [district, setDistrict] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [customerTaxId, setCustomerTaxId] = useState("");
  const [customerBranch, setCustomerBranch] = useState("สำนักงานใหญ่");
  const [contactPerson, setContactPerson] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  useEffect(() => {
    if (selectedCustomer) {
      setIsEditingAddress(false);
      if (selectedCustomer.addrLine1) {
        setAddrLine1(selectedCustomer.addrLine1 || "");
        setAddrLine2(selectedCustomer.addrLine2 || "");
        setSubDistrict(selectedCustomer.subDistrict || "");
        setDistrict(selectedCustomer.district || "");
        setProvince(selectedCustomer.province || "");
        setPostalCode(selectedCustomer.postalCode || "");
      } else if (selectedCustomer.address) {
        const extractLastPrefix = (textStr: string, prefixes: string[]) => {
          let bestIdx = -1;
          for (const p of prefixes) {
            const idx = textStr.lastIndexOf(p);
            if (idx > bestIdx && (idx === 0 || textStr[idx - 1] === ' ' || textStr[idx - 1] === '/')) {
              bestIdx = idx;
            } else if (idx > bestIdx && [".", "จ", "อ", "ต", "ข", "ถ", "ซ"].includes(p[0])) {
              bestIdx = idx;
            }
          }
          if (bestIdx !== -1) {
            return {
              extracted: textStr.substring(bestIdx).trim(),
              rest: textStr.substring(0, bestIdx).trim()
            };
          }
          return { extracted: "", rest: textStr };
        };

        let remaining = selectedCustomer.address.replace(/\s+/g, " ").trim();
        let pCode = "", prov = "", dist = "", subDist = "", road = "", soi = "", addr1 = "";

        const pMatch = remaining.match(/\s*(\d{5})$/);
        if (pMatch) {
          pCode = pMatch[1];
          remaining = remaining.substring(0, pMatch.index).trim();
        }

        let res = extractLastPrefix(remaining, ["จังหวัด", "จ.", "กทม.", "กทม", "กรุงเทพ"]);
        if (res.extracted) { prov = res.extracted; remaining = res.rest; }

        res = extractLastPrefix(remaining, ["เขต", "อำเภอ", "อ."]);
        if (res.extracted) { dist = res.extracted; remaining = res.rest; }

        res = extractLastPrefix(remaining, ["แขวง", "แขง", "ตำบล", "ตำบล.", "ข.", "ต."]);
        if (res.extracted) { subDist = res.extracted; remaining = res.rest; }

        res = extractLastPrefix(remaining, ["ถนน", "ถ."]);
        if (res.extracted) { road = res.extracted; remaining = res.rest; }

        res = extractLastPrefix(remaining, ["ซอย", "ซ."]);
        if (res.extracted) { soi = res.extracted; remaining = res.rest; }

        addr1 = remaining;

        setAddrLine1(addr1);
        setAddrLine2([soi, road].filter(Boolean).join(" "));
        setSubDistrict(subDist);
        setDistrict(dist);
        setProvince(prov);
        setPostalCode(pCode);
      } else {
        setAddrLine1("");
        setAddrLine2("");
        setSubDistrict("");
        setDistrict("");
        setProvince("");
        setPostalCode("");
      }
      setCustomerTaxId(selectedCustomer.taxId || selectedCustomer.customerTaxId || "");
      if (selectedCustomer.customerBranch || selectedCustomer.branch || selectedCustomer.branchCode) {
        setCustomerBranch(selectedCustomer.customerBranch || selectedCustomer.branch || selectedCustomer.branchCode);
      }
      if (selectedCustomer.contactPerson || selectedCustomer.contact || selectedCustomer.primaryContact) {
        setContactPerson(selectedCustomer.contactPerson || selectedCustomer.contact || selectedCustomer.primaryContact);
      }
      if (selectedCustomer.contactPhone || selectedCustomer.phone || selectedCustomer.mobile) {
        setContactPhone(selectedCustomer.contactPhone || selectedCustomer.phone || selectedCustomer.mobile);
      }
      if (selectedCustomer.contactEmail || selectedCustomer.email) {
        setContactEmail(selectedCustomer.contactEmail || selectedCustomer.email);
      }
    } else {
      setAddrLine1("");
      setAddrLine2("");
      setSubDistrict("");
      setDistrict("");
      setProvince("");
      setPostalCode("");
      setCustomerTaxId("");
      setCustomerBranch("สำนักงานใหญ่");
      setContactPerson("");
      setContactPhone("");
      setContactEmail("");
    }
  }, [selectedCustomer]);

  // Customer Smart Search State
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState("");
  const [isCustomerSearchActive, setIsCustomerSearchActive] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedCustomerSearch(customerSearchTerm), 300);
    return () => clearTimeout(timer);
  }, [customerSearchTerm]);

  const filteredCustomers = useMemo(() => {
    if (!debouncedCustomerSearch) return customers.slice(0, 50);
    const lower = debouncedCustomerSearch.toLowerCase().trim();
    return customers.filter(c =>
      getCustomerName(c).toLowerCase().includes(lower) ||
      (c.taxId && c.taxId.includes(lower)) ||
      (c.customerTaxId && c.customerTaxId.includes(lower)) ||
      (c.customerCode && c.customerCode.toLowerCase().includes(lower)) ||
      (c.code && c.code.toLowerCase().includes(lower)) ||
      (c.contactPerson && c.contactPerson.toLowerCase().includes(lower)) ||
      (c.phone && c.phone.includes(lower)) ||
      (c.address && c.address.toLowerCase().includes(lower))
    ).slice(0, 50);
  }, [customers, debouncedCustomerSearch]);

  const customerOptions = useMemo(() => {
    return customers.map(c => {
      const name = getCustomerName(c);
      const code = c.customerCode || c.code || "";
      const taxId = c.taxId || c.customerTaxId || "";
      const contact = c.contactPerson || c.contact || c.primaryContact || "";
      const phone = c.contactPhone || c.phone || c.mobile || "";
      const addr = c.address || [c.addrLine1, c.subDistrict, c.province].filter(Boolean).join(" ") || "";
      const descParts = [];
      if (code) descParts.push(`รหัส: ${code}`);
      if (taxId) descParts.push(`เลขผู้เสียภาษี: ${taxId}`);
      if (contact) descParts.push(`ผู้ติดต่อ: ${contact}`);
      if (phone) descParts.push(`โทร: ${phone}`);
      if (addr) descParts.push(addr);
      return {
        value: c.id,
        label: name,
        description: descParts.join(" • ")
      };
    });
  }, [customers]);

  // Salesperson Smart Search State
  const [salespersonSearchTerm, setSalespersonSearchTerm] = useState("");
  const [debouncedSalespersonSearch, setDebouncedSalespersonSearch] = useState("");
  const [isSalespersonSearchActive, setIsSalespersonSearchActive] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSalespersonSearch(salespersonSearchTerm), 300);
    return () => clearTimeout(timer);
  }, [salespersonSearchTerm]);

  const filteredSalespersons = useMemo(() => {
    if (!debouncedSalespersonSearch) return users.slice(0, 50);
    const lower = debouncedSalespersonSearch.toLowerCase();
    return users.filter((u: any) =>
      (u.displayName && u.displayName.toLowerCase().includes(lower)) ||
      (u.name && u.name.toLowerCase().includes(lower)) ||
      (u.email && u.email.toLowerCase().includes(lower))
    ).slice(0, 50);
  }, [users, debouncedSalespersonSearch]);

  // Table State
  const [items, setItems] = useState<any[]>([]);

  // Summary State
  const [taxType, setTaxType] = useState<VatTypeV3>("EXCLUSIVE");
  const [termsAndConditions, setTermsAndConditions] = useState("1. กำหนดยืนราคา 30 วันนับจากวันที่เสนอราคา\n2. การรับประกันสินค้าเป็นไปตามเงื่อนไขของบริษัท");
  const [remark, setRemark] = useState("");
  const [whtRate, setWhtRate] = useState<number>(0);

  const handleTaxTypeChange = (newType: VatTypeV3) => {
    if (newType === "INCLUSIVE_AUTO" && taxType !== "INCLUSIVE_AUTO") {
      setItems(prev => prev.map(item => ({ ...item, price: Math.ceil((item.price || 0) * 1.07) })));
    } else if (taxType === "INCLUSIVE_AUTO" && newType !== "INCLUSIVE_AUTO") {
      setItems(prev => prev.map(item => ({ ...item, price: Math.round((item.price || 0) / 1.07) })));
    }
    setTaxType(newType);
  };

  // Extended CRM & Logistics Data (Batch B)
  const [probability, setProbability] = useState<number>(50);
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [attachments, setAttachments] = useState<any[]>([]);
  const [leadSource] = useState("");
  const [projectName, setProjectName] = useState("");
  const [incoTerms, setIncoTerms] = useState("");
  const [isShippingTermsActive, setIsShippingTermsActive] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [savedQuotationId, setSavedQuotationId] = useState("");
  const [expectedDeliveryDays, setExpectedDeliveryDays] = useState<number>(30);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [selectedSalespersonId, setSelectedSalespersonId] = useState("");
  const getSalespersonName = (u: any) => u?.displayName || u?.name || u?.email || "ไม่ระบุชื่อ";
  const selectedSalesperson = users.find(u => u.id === selectedSalespersonId);

  // Auto set expectedCloseDate from docDate + expectedDeliveryDays
  useEffect(() => {
    if (docDate && expectedDeliveryDays !== undefined) {
      const d = new Date(docDate);
      if (!isNaN(d.getTime())) {
        d.setDate(d.getDate() + Number(expectedDeliveryDays));
        setExpectedCloseDate(d.toISOString().split('T')[0]);
      }
    }
  }, [docDate, expectedDeliveryDays]);

  const dateValidation = useMemo(() => {
    return validateQuotationDates(docDate, expectedCloseDate);
  }, [docDate, expectedCloseDate]);

  // Document Discount & Terms State (Patch 7 & 10)
  const [docDiscountType, setDocDiscountType] = useState<'PERCENT' | 'AMOUNT'>('AMOUNT');
  const [docDiscountValue, setDocDiscountValue] = useState<number>(0);
  const [paymentSchedules, setPaymentSchedules] = useState<Array<{ id: string; name: string; percent: number; amount: number }>>([
    { id: '1', name: 'งวดที่ 1 (มัดจำ)', percent: 50, amount: 0 },
    { id: '2', name: 'งวดที่ 2 (ส่งมอบงาน)', percent: 50, amount: 0 }
  ]);
  const [warrantyTerms, setWarrantyTerms] = useState("รับประกันสินค้า 1 ปี");
  const [scopeOfWork, setScopeOfWork] = useState("");
  const [exclusions, setExclusions] = useState("");

  // Projects list for SmartSelect (Patch 9)
  const { data: rawProjects = [] } = useCompanyProjects();
  const projectOptions = useMemo(() => {
    return rawProjects.map((p: any) => ({
      value: p.id,
      label: p.projectName || p.title || p.name || p.id,
      description: `รหัส: ${p.projectId || p.code || p.projectCode || p.id}`
    }));
  }, [rawProjects]);

  // Postal Code Auto-fill (Patch 9)
  useEffect(() => {
    if (postalCode && postalCode.trim().length === 5) {
      try {
        const results = searchAddressByPostalCode(postalCode.trim());
        if (results && results.length > 0) {
          const match = results[0];
          if (match.subdistrict || match.district) setSubDistrict(match.subdistrict || match.district || "");
          if (match.district) setDistrict(match.district || "");
          if (match.province) setProvince(match.province || "");
        }
      } catch (e) {
        // Ignore fallback
      }
    }
  }, [postalCode]);

  // Fetch Company Config for Settings (min GP threshold & price deviation warning)
  // อ่านเฉพาะเอกสารบริษัทตัวเอง (tenant rules ไม่อนุญาตให้ list companies ทั้งหมด)
  const { data: companyDoc } = useRealtimeDocument(effectiveCompanyId ? `companies/${effectiveCompanyId}` : null);
  const companyDocs = useMemo<any[]>(() => (companyDoc ? [companyDoc] : []), [companyDoc]);
  const companyConfig = useMemo(() => {
    const matched = companyDocs.find((c: any) => c.id === effectiveCompanyId || c.companyId === effectiveCompanyId);
    return matched?.settings || {};
  }, [companyDocs, effectiveCompanyId]);

  const minGpPercentForAutoSend = companyConfig.minGpPercentForAutoSend ?? 15;
  const priceDeviationWarningPercent = companyConfig.priceDeviationWarningPercent ?? 10;

  useEffect(() => {
    if (user?.uid && !selectedSalespersonId) {
      setSelectedSalespersonId(user.uid);
    }
  }, [user, selectedSalespersonId]);

  // Guardrail State
  const [status, setStatus] = useState("DRAFT");
  const [showCreditWarning, setShowCreditWarning] = useState(false);

  // Calculation Engine (Patch 4, 7)
  const summary = useMemo(() => {
    const calcItems: LineItem[] = items.map(i => {
      return {
        id: i.id,
        qty: Number(i.qty) || 0,
        costPrice: Number(i.cost ?? i.costPrice) || 0,
        projectPrice: Number(i.price) || 0,
        retailPrice: Number(i.price) || 0,
        whtRate: i.whtRate !== undefined ? Number(i.whtRate) : undefined,
        itemType: i.itemType,
        discountType: i.discountType,
        discountValue: Number(i.discountValue) || 0,
        isGroupHeader: i.isGroupHeader || i.itemType === 'GROUP_HEADER'
      };
    });

    return calculateERPDocument(calcItems, taxType, true, whtRate, 7, docDiscountType, docDiscountValue);
  }, [items, taxType, whtRate, docDiscountType, docDiscountValue]);

  const rainbow = getProfitRainbowColor(summary.profitMargin);

  // Guardrail check
  useEffect(() => {
    if (selectedCustomer && selectedCustomer.creditLimit) {
      const currentBalance = Number(selectedCustomer.currentBalance) || 0;
      const limit = Number(selectedCustomer.creditLimit);
      if (currentBalance + summary.grandTotal > limit) {
        setShowCreditWarning(true);
        if (status === "DRAFT") setStatus("PENDING_APPROVAL");
      } else {
        setShowCreditWarning(false);
        if (status === "PENDING_APPROVAL") setStatus("DRAFT");
      }
    } else {
      setShowCreditWarning(false);
      if (status === "PENDING_APPROVAL") setStatus("DRAFT");
    }
  }, [summary.grandTotal, selectedCustomer, status]);

  // PDF Document Preview Data
  const previewDocumentData = useMemo(() => ({
    title: "ใบเสนอราคา (QUOTATION)",
    docNo: quotationNumber,
    date: docDate,
    companyName: companyDocs.find((c: any) => c.id === effectiveCompanyId)?.name || "NEXUS TECHNOLOGY CO., LTD.",
    companyAddress: companyDocs.find((c: any) => c.id === effectiveCompanyId)?.address || "123 อาคารเน็กซัสทาวเวอร์ ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110",
    companyTaxId: companyDocs.find((c: any) => c.id === effectiveCompanyId)?.taxId || "0105559012345",
    customerName: selectedCustomer ? getCustomerName(selectedCustomer) : (customerSearchTerm || "ลูกค้าทั่วไป"),
    customerAddress: [addrLine1, addrLine2, subDistrict, district, province, postalCode].filter(Boolean).join(" ") || "-",
    customerTaxId: customerTaxId || "-",
    items: items.map((item, idx) => {
      const lineSubtotal = (Number(item.qty) || 0) * (Number(item.price) || 0);
      const lineDiscAmt = item.discountType === 'PERCENT' ? lineSubtotal * ((Number(item.discountValue) || 0) / 100) : (Number(item.discountValue) || 0);
      return {
        id: String(idx + 1),
        description: item.name + (item.details ? `\n${item.details}` : ''),
        qty: Number(item.qty) || 0,
        unitPrice: Number(item.price) || 0,
        discount: lineDiscAmt,
        total: Math.max(0, lineSubtotal - lineDiscAmt)
      };
    }),
    summary: {
      subtotal: summary.subTotal,
      discount: summary.docDiscountAmount,
      tax: summary.vatAmount,
      total: summary.grandTotal
    }
  }), [quotationNumber, docDate, companyDocs, effectiveCompanyId, selectedCustomer, customerSearchTerm, addrLine1, addrLine2, subDistrict, district, province, postalCode, customerTaxId, items, summary]);

  // Handle Save with Multi-channel Audit Trail (Patch 11 & 12)
  const handleSave = async (isSubmit: boolean = false, sendChannel?: 'EMAIL' | 'LINE' | 'DOWNLOAD' | 'SYSTEM') => {
    if (!selectedCustomerId && !customerSearchTerm.trim()) {
      alert("กรุณาระบุชื่อลูกค้า");
      return;
    }
    if (!contactPerson || !contactPerson.trim()) {
      alert("กรุณาระบุชื่อผู้ติดต่อ (บังคับกรอก)");
      return;
    }
    if (!customerTaxId || !/^\d{13}$/.test(customerTaxId.trim())) {
      alert("กรุณาระบุเลขประจำตัวผู้เสียภาษีให้ถูกต้องครบ 13 หลัก");
      return;
    }
    if (!addrLine1.trim() && !selectedCustomer?.address) {
      alert("กรุณาระบุที่อยู่สำหรับเปิดบิล");
      return;
    }
    if (!quotationType) {
      alert("กรุณาระบุประเภทงานเสนอราคา");
      return;
    }
    if (!docDate) {
      alert("กรุณาระบุวันที่ออกเอกสาร");
      return;
    }
    const dateValidation = validateQuotationDates(docDate, expectedCloseDate);
    if (!dateValidation.isValid) {
      alert(dateValidation.error);
      return;
    }
    if (items.length === 0) {
      alert("กรุณาเพิ่มรายการสินค้าหรือบริการอย่างน้อย 1 รายการ");
      return;
    }
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.itemType === 'GROUP_HEADER') continue;
      if (!item.qty || Number(item.qty) <= 0) {
        alert(`กรุณาระบุจำนวนสินค้าในรายการที่ ${i + 1}`);
        return;
      }
      if (!item.price || Number(item.price) < 0) {
        alert(`กรุณาระบุราคาต่อหน่วยในรายการที่ ${i + 1}`);
        return;
      }
    }
    const totalPaymentPercent = paymentSchedules.reduce((sum, p) => sum + (Number(p.percent) || 0), 0);
    if (paymentSchedules.length > 0 && Math.abs(totalPaymentPercent - 100) > 0.01) {
      alert("ผลรวมสัดส่วนงวดชำระต้องเท่ากับ 100%");
      return;
    }
    if (!companyId) {
      alert("ไม่พบรหัสบริษัท กรุณาเข้าสู่ระบบใหม่");
      return;
    }

    try {
      const isGpBelowThreshold = summary.profitMargin < minGpPercentForAutoSend;
      const finalStatus = isSubmit 
        ? (isGpBelowThreshold || showCreditWarning ? "PENDING_APPROVAL" : "SENT") 
        : status;
      const batch = writeBatch(db);

      let finalCustomerId = selectedCustomerId;
      let finalCustomerName = getCustomerName(selectedCustomer);

      if (!finalCustomerId && customerSearchTerm.trim()) {
        const newCustomerRef = doc(collection(db, 'customers'));
        batch.set(newCustomerRef, {
          customerName: customerSearchTerm.trim(),
          name: customerSearchTerm.trim(),
          address: [addrLine1, addrLine2, subDistrict, district, province, postalCode].filter(Boolean).join(" "),
          taxId: customerTaxId,
          companyId: companyId,
          isDeleted: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        finalCustomerId = newCustomerRef.id;
        finalCustomerName = customerSearchTerm.trim();
      }

      // 1. Create Header Ref
      const quotationRef = doc(collection(db, `companies/${companyId}/quotations`));
      const fullAddressStr = [addrLine1, addrLine2, subDistrict, district, province, postalCode].filter(Boolean).join(" ");

      const auditEntry = {
        id: `LOG-${Date.now()}`,
        userId: user?.uid || "anonymous",
        userName: user?.displayName || user?.email || "ผู้ใช้งาน",
        action: !isSubmit ? "SAVE_DRAFT" : isGpBelowThreshold || showCreditWarning ? "SUBMIT_APPROVAL" : `SEND_${sendChannel || 'MANUAL'}`,
        channel: sendChannel || (isSubmit ? "SYSTEM" : "DRAFT"),
        clientIp: "127.0.0.1",
        timestamp: new Date().toISOString(),
        details: !isSubmit 
          ? "บันทึกร่างเอกสารใบเสนอราคา" 
          : isGpBelowThreshold 
            ? `ส่งขออนุมัติเนื่องจาก GP (${summary.profitMargin}%) ต่ำกว่าเกณฑ์ (${minGpPercentForAutoSend}%)`
            : showCreditWarning
              ? "ส่งขออนุมัติเนื่องจากเกินวงเงินเครดิต"
              : `บันทึกและส่งเอกสารผ่านช่องทาง ${sendChannel === 'EMAIL' ? 'อีเมล' : sendChannel === 'LINE' ? 'LINE' : sendChannel === 'DOWNLOAD' ? 'ดาวน์โหลด PDF' : 'ระบบ'}`
      };

      const headerPayload = {
        companyId,
        isDeleted: false,
        documentNo: quotationNumber,
        quotationNumber,
        revision: 0,
        revisionNumber: 1,
        parentQuotationId: null,
        revisionHistory: [],
        status: finalStatus,
        docDate,
        validUntil,
        paymentTerms,
        referenceNo,
        customerPoNo: referenceNo,
        customerId: finalCustomerId,
        customerName: finalCustomerName,
        customerTaxId: customerTaxId,
        customerAddress: fullAddressStr,
        addrLine1,
        addrLine2,
        subDistrict,
        district,
        province,
        postalCode,
        salesPersonId: selectedSalespersonId || user?.uid || "",
        salespersonName: users.find(u => u.id === selectedSalespersonId)?.displayName || users.find(u => u.id === selectedSalespersonId)?.name || "",
        currency: "THB",
        exchangeRate: 1,
        taxType,
        whtRate: whtRate,
        subTotal: summary.subTotal,
        docDiscountType,
        docDiscountValue,
        docDiscountAmount: summary.docDiscountAmount,
        discountTotal: summary.docDiscountAmount,
        netTotal: summary.subTotal,
        vatAmount: summary.vatAmount,
        whtAmount: summary.whtAmount,
        grandTotal: summary.grandTotal,
        netPayable: summary.netPayable,
        termsAndConditions,
        remark,
        // Terms & Conditions
        paymentSchedules,
        warrantyTerms,
        scopeOfWork,
        exclusions,
        // V3.0 New Fields
        quotationType,
        projectId,
        customerBranch,
        contactPerson,
        contactPhone,
        contactEmail,
        validDays,
        thaiBahtText: summary.thaiBahtText,
        deliveryAddress,

        // Batch B New Fields
        attachments: attachments || [],
        customerSnapshot: {
          customerId: finalCustomerId,
          name: finalCustomerName,
          taxId: customerTaxId,
          branch: customerBranch,
          address: fullAddressStr,
          addrLine1,
          addrLine2,
          subDistrict,
          district,
          province,
          postalCode,
          contactPerson,
          phone: contactPhone,
          email: contactEmail
        },

        // Extended CRM Fields
        probability,
        expectedCloseDate,
        leadSource,
        projectName,
        incoTerms,
        expectedDeliveryDays,
        internalNotes,
        createdBy: user?.uid || "",
        createdAt: serverTimestamp(),
        date: docDate,
        auditLogs: [auditEntry]
      };

      const finalDocRef = doc(db, `companies/${companyId}/quotations`, quotationRef.id);
      batch.set(finalDocRef, headerPayload);

      // Save audit log to subcollection
      const auditRef = doc(collection(db, `companies/${companyId}/quotations/${finalDocRef.id}/audit_logs`));
      batch.set(auditRef, {
        ...auditEntry,
        createdAt: serverTimestamp()
      });

      // 2. Create Line Items in subcollection
      items.forEach((item, index) => {
        const lineRef = doc(collection(db, `companies/${companyId}/quotations/${finalDocRef.id}/lines`));
        const lineSubtotal = (Number(item.qty) || 0) * (Number(item.price) || 0);
        const lineDiscAmt = item.discountType === 'PERCENT' ? lineSubtotal * ((Number(item.discountValue) || 0) / 100) : Number(item.discountValue) || 0;
        const lineTotalAmt = Math.max(0, lineSubtotal - lineDiscAmt);

        const linePayload = {
          sequence: index + 1,
          productId: item.productId || item.id || "",
          sku: item.sku || "",
          productName: item.name || "",
          description: item.details || item.description || "",
          qty: Number(item.qty) || 0,
          uom: item.unit || "ชิ้น",
          uomConversionFactor: 1,
          costPrice: Number(item.cost ?? item.costPrice) || 0,
          unitPrice: Number(item.price) || 0,
          itemType: item.itemType || 'PRODUCT',
          discountType: item.discountType || 'PERCENT',
          discountValue: Number(item.discountValue) || 0,
          discountAmount: lineDiscAmt,
          whtRate: Number(item.whtRate) || 0,
          lineTotal: lineTotalAmt,
          isVatable: true,
          whtApplicable: (Number(item.whtRate) || 0) > 0,
          glAccountId: item.incomeAccountId || "411100",
          isOptional: !!item.isOptional,
          margin: (Number(item.price) || 0) - (Number(item.cost ?? item.costPrice) || 0),
          saveToProductMaster: !!item.saveToProductMaster
        };
        batch.set(lineRef, linePayload);

        // Update product master if user checked saveToProductMaster and has RBAC permission
        if (item.saveToProductMaster && item.productId && canWriteBackToProductMaster(role, true)) {
          const productRef = doc(db, `companies/${companyId}/products`, item.productId);
          const updatePayload: Record<string, any> = {
            updatedAt: serverTimestamp()
          };
          if (item.details && item.details.trim()) {
            updatePayload.technicalSpecs = item.details.trim();
          }
          if (item.datasheetUrl && item.datasheetUrl.trim()) {
            updatePayload.datasheetUrl = item.datasheetUrl.trim();
          }
          if (Object.keys(updatePayload).length > 1) {
            batch.update(productRef, updatePayload);
          }
        }
      });

      await batch.commit();

      setSavedQuotationId(finalDocRef.id);
      
      if (sendChannel === 'DOWNLOAD') {
        setShowPreviewModal(true);
      } else if (sendChannel === 'EMAIL') {
        alert(`บันทึกและส่งใบเสนอราคาไปยังอีเมล ${contactEmail || 'ลูกค้า'} สำเร็จ`);
      } else if (sendChannel === 'LINE') {
        alert(`บันทึกและสร้างลิงก์สำหรับส่งผ่าน LINE สำเร็จ`);
      }

      setShowSuccessModal(true);
    } catch (error: any) {
      console.error("Save error:", error);
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล: " + error.message);
    }
  };

  const headerContent = (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-6 rounded-3xl backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <PillButton
          variant="glass"
          onClick={() => router.back()}
          className="w-10 h-10 p-0 flex items-center justify-center rounded-full"
        >
          <ArrowLeft size={20} />
        </PillButton>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-white uppercase tracking-tight">สร้างใบเสนอราคาใหม่</h1>
            <span className="font-mono text-sm font-bold text-nexus-teal bg-nexus-teal/10 px-3 py-1 rounded-full border border-nexus-teal/30 select-none cursor-default pointer-events-none">
              {quotationNumber}
            </span>
          </div>
          <p className="text-sm text-white/60 font-medium mt-1">ระบุรายละเอียดลูกค้า รายการสินค้า และเงื่อนไขทางการค้าเพื่อออกใบเสนอราคา</p>
        </div>
      </div>

      <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
        <DocumentStepper steps={["ร่าง", "รออนุมัติ", "ส่งแล้ว", "ยอมรับแล้ว"]} currentStep={status === "PENDING_APPROVAL" ? 1 : status === "SENT" ? 2 : status === "ACCEPTED" ? 3 : 0} />
        
        {/* PDF Preview Button */}
        <PillButton
          variant="glass"
          onClick={() => setShowPreviewModal(true)}
          className="h-8 px-4 text-xs font-bold text-nexus-blue border-nexus-blue/30 hover:bg-nexus-blue/10"
        >
          <FileText size={14} className="mr-1.5" /> ตัวอย่างเอกสาร
        </PillButton>

        {/* Save Draft Button */}
        <PillButton
          variant="glass"
          onClick={() => handleSave(false)}
          className="h-8 px-4 text-xs font-bold text-white border-white/20"
        >
          <Save size={14} className="mr-1.5" /> บันทึกร่าง
        </PillButton>

        {/* Send / Approval Button with Channel Options */}
        {summary.profitMargin < minGpPercentForAutoSend || showCreditWarning ? (
          <PillButton
            variant="confirm"
            onClick={() => handleSave(true)}
            className="h-8 px-5 text-xs font-bold text-warning border-warning/40 bg-warning/20 hover:bg-warning/30"
          >
            <AlertTriangle size={14} className="mr-1.5" /> {showCreditWarning ? "ส่งขออนุมัติวงเงิน" : `ส่งขออนุมัติ (GP ${summary.profitMargin}% < เกณฑ์ ${minGpPercentForAutoSend}%)`}
          </PillButton>
        ) : (
          <div className="relative">
            <SciFiDropdownPortal
              isOpen={isSendMenuOpen}
              onClose={() => setIsSendMenuOpen(false)}
              trigger={
                <PillButton
                  variant="primary"
                  onClick={() => setIsSendMenuOpen(!isSendMenuOpen)}
                  className="h-8 px-5 text-xs font-bold text-nexus-teal border-nexus-teal/40 flex items-center gap-1.5"
                >
                  <Send size={14} /> บันทึกและส่ง <ChevronDown size={14} />
                </PillButton>
              }
            >
              <div className="bg-surface-1 border border-white/10 rounded-2xl shadow-2xl p-1.5 min-w-[200px] space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsSendMenuOpen(false);
                    handleSave(true, 'EMAIL');
                  }}
                  className="w-full px-3 py-2 text-left text-xs text-white/80 hover:bg-white/10 rounded-lg flex items-center gap-2"
                >
                  <Send size={12} className="text-nexus-teal" /> ส่งผ่านอีเมลลูกค้า
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsSendMenuOpen(false);
                    handleSave(true, 'LINE');
                  }}
                  className="w-full px-3 py-2 text-left text-xs text-white/80 hover:bg-white/10 rounded-lg flex items-center gap-2"
                >
                  <Share2 size={12} className="text-nexus-blue" /> ส่งผ่าน LINE OA
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsSendMenuOpen(false);
                    handleSave(true, 'DOWNLOAD');
                  }}
                  className="w-full px-3 py-2 text-left text-xs text-white/80 hover:bg-white/10 rounded-lg flex items-center gap-2"
                >
                  <FileText size={12} className="text-purple-400" /> พิมพ์ / ดาวน์โหลด PDF
                </button>
              </div>
            </SciFiDropdownPortal>
          </div>
        )}
      </div>
    </div>
  );

  const leftContent = (
    <div className="space-y-6 w-full">
      {/* 1. Header Cards Grid */}
      {/* จอไม่กว้างพอ: ลูกค้าเต็มแถว แล้วรายละเอียดการขาย + ข้อมูลเอกสารคู่กันด้านล่าง; จอกว้าง (≥1700px) เรียงสามใบในแถวเดียว */}
      <div className="grid grid-cols-1 md:grid-cols-2 min-[1700px]:flex min-[1700px]:flex-row gap-4 items-stretch">
        {/* Customer Information Card */}
        <div className="md:col-span-2 min-w-0 flex-[2] bg-neutral-900/90 border border-white/15 rounded-3xl overflow-visible shadow-2xl p-4 space-y-4 border-l-4 border-l-nexus-teal hover:border-white/25 relative z-[30]">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <h3 className="text-base font-semibold uppercase tracking-widest text-white/80 flex items-center gap-2">
              <Building2 size={16} className="text-nexus-teal drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" /> ข้อมูลลูกค้า
            </h3>
            {selectedCustomer && (
              <span className="text-[11px] font-mono font-bold text-nexus-teal bg-nexus-teal/10 border border-nexus-teal/30 px-2.5 py-0.5 rounded-full">
                รหัส: {selectedCustomer.customerCode || selectedCustomer.code || selectedCustomer.id}
              </span>
            )}
          </div>

          <div className="space-y-3">
            {/* Customer Smart Select */}
            <div className="space-y-1">
              <label className="text-[12px] font-bold text-white/70 flex items-center justify-between">
                <span>ค้นหาและเลือกลูกค้า <span className="text-danger">*</span></span>
                {customersLoading && <span className="text-[10px] text-white/40">กำลังโหลด...</span>}
              </label>
              
              {!selectedCustomerId ? (
                <div className="relative">
                  <SmartSelect
                    value={selectedCustomerId}
                    onChange={(val) => {
                      setSelectedCustomerId(val);
                      setIsCustomerSearchActive(false);
                    }}
                    options={customerOptions}
                    placeholder="พิมพ์ชื่อลูกค้า เลขผู้เสียภาษี รหัส หรือเบอร์โทรเพื่อค้นหา..."
                    allowCustom={true}
                    className="w-full h-8"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between px-3 py-1.5 rounded-full bg-black/40 border border-nexus-teal/50 shadow-[0_0_15px_rgba(34,211,238,0.1)]">
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-bold text-[13px] text-white truncate">{getCustomerName(selectedCustomer)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCustomerId("");
                      setCustomerSearchTerm("");
                    }}
                    className="text-xs text-white/40 hover:text-danger font-bold ml-2 transition-colors shrink-0"
                  >
                    เปลี่ยนลูกค้า
                  </button>
                </div>
              )}
            </div>

            {/* Address Lines & Details (Collapsible single-line with Edit Toggle) */}
            <div className="space-y-3 pt-1">
              {selectedCustomer && !isEditingAddress ? (
                <div className="flex items-center justify-between p-2.5 px-4 rounded-2xl bg-black/30 border border-white/10">
                  <div className="flex items-center gap-2 truncate text-[13px] text-white/90">
                    <span className="text-nexus-teal shrink-0 font-bold">📍</span>
                    <span className="truncate">{[addrLine1, addrLine2, subDistrict, district, province, postalCode].filter(Boolean).join(" ") || selectedCustomer.address || "ยังไม่ได้ระบุที่อยู่"}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEditingAddress(true)}
                    className="text-[12px] text-nexus-teal hover:text-white font-bold bg-nexus-teal/10 hover:bg-nexus-teal/20 px-3 py-1 rounded-full border border-nexus-teal/30 ml-2 shrink-0 transition-colors flex items-center gap-1"
                  >
                    <Edit3 size={12} /> แก้ไขที่อยู่
                  </button>
                </div>
              ) : (
                <div className="space-y-2 p-3 rounded-2xl bg-black/20 border border-white/10">
                  <div className="flex items-center justify-between">
                    <label className="text-[12px] font-bold text-white/70">ที่อยู่เปิดบิล <span className="text-danger">*</span></label>
                    {selectedCustomer && (
                      <button
                        type="button"
                        onClick={() => setIsEditingAddress(false)}
                        className="text-[12px] text-white/60 hover:text-white font-bold bg-white/5 hover:bg-white/10 px-2.5 py-0.5 rounded-full border border-white/10 transition-colors"
                      >
                        ย่อที่อยู่
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={addrLine1}
                    onChange={(e) => setAddrLine1(e.target.value)}
                    placeholder="บ้านเลขที่ / อาคาร / ชั้น / หมู่บ้าน"
                    className="w-full h-8 bg-black/20 focus:bg-surface-0/90 focus:backdrop-blur-md border border-white/10 focus:border-nexus-teal/50 rounded-full px-4 py-0 text-[13px] font-bold text-white focus:text-nexus-teal focus:outline-none placeholder:text-white/70 transition-all"
                  />
                  <div className="grid grid-cols-5 gap-2 pt-1">
                    <input
                      type="text"
                      value={addrLine2}
                      onChange={(e) => setAddrLine2(e.target.value)}
                      placeholder="ซอย / ถนน"
                      className="w-full h-8 bg-black/20 focus:bg-surface-0/90 focus:backdrop-blur-md border border-white/10 focus:border-nexus-teal/50 rounded-full px-4 py-0 text-[13px] font-bold text-white focus:text-nexus-teal focus:outline-none placeholder:text-white/70 transition-all"
                    />
                    <input
                      type="text"
                      value={subDistrict}
                      onChange={(e) => setSubDistrict(e.target.value)}
                      placeholder="แขวง / ตำบล"
                      className="w-full h-8 bg-black/20 focus:bg-surface-0/90 focus:backdrop-blur-md border border-white/10 focus:border-nexus-teal/50 rounded-full px-4 py-0 text-[13px] font-bold text-white focus:text-nexus-teal focus:outline-none placeholder:text-white/70 transition-all"
                    />
                    <input
                      type="text"
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      placeholder="เขต / อำเภอ"
                      className="w-full h-8 bg-black/20 focus:bg-surface-0/90 focus:backdrop-blur-md border border-white/10 focus:border-nexus-teal/50 rounded-full px-4 py-0 text-[13px] font-bold text-white focus:text-nexus-teal focus:outline-none placeholder:text-white/70 transition-all"
                    />
                    <input
                      type="text"
                      value={province}
                      onChange={(e) => setProvince(e.target.value)}
                      placeholder="จังหวัด"
                      className="w-full h-8 bg-black/20 focus:bg-surface-0/90 focus:backdrop-blur-md border border-white/10 focus:border-nexus-teal/50 rounded-full px-4 py-0 text-[13px] font-bold text-white focus:text-nexus-teal focus:outline-none placeholder:text-white/70 transition-all"
                    />
                    <input
                      type="text"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                      placeholder="รหัสไปรษณีย์"
                      className="w-full h-8 bg-black/20 focus:bg-surface-0/90 focus:backdrop-blur-md border border-white/10 focus:border-nexus-teal/50 rounded-full px-4 py-0 text-[13px] font-bold font-mono text-white focus:text-nexus-teal focus:outline-none placeholder:text-white/70 transition-all"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[12px] font-bold text-white/70">เลขผู้เสียภาษี (13 หลัก) <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    value={customerTaxId}
                    onChange={(e) => setCustomerTaxId(e.target.value.replace(/\D/g, '').slice(0, 13))}
                    placeholder="เลขประจำตัวผู้เสียภาษี 13 หลัก"
                    className="w-full h-8 bg-black/20 focus:bg-surface-0/90 focus:backdrop-blur-md border border-white/10 focus:border-nexus-teal/50 rounded-full px-4 py-0 text-[13px] font-bold font-mono text-white focus:text-nexus-teal focus:outline-none placeholder:text-white/70 transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[12px] font-bold text-white/70">สาขา</label>
                  <input
                    type="text"
                    value={customerBranch}
                    onChange={(e) => setCustomerBranch(e.target.value)}
                    placeholder="สำนักงานใหญ่ หรือ เลขสาขา"
                    className="w-full h-8 bg-black/20 focus:bg-surface-0/90 focus:backdrop-blur-md border border-white/10 focus:border-nexus-teal/50 rounded-full px-4 py-0 text-[13px] font-bold text-white focus:text-nexus-teal focus:outline-none placeholder:text-white/70 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[12px] font-bold text-white/70">ข้อมูลผู้ติดต่อ <span className="text-danger">*</span></label>
                <div className="grid grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="ชื่อผู้ติดต่อ (บังคับกรอก)"
                    className="w-full h-8 bg-black/20 focus:bg-surface-0/90 focus:backdrop-blur-md border border-white/10 focus:border-nexus-teal/50 rounded-full px-4 py-0 text-[13px] font-bold text-white focus:text-nexus-teal focus:outline-none placeholder:text-white/70 transition-all"
                  />
                  <input
                    type="text"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="เบอร์โทรศัพท์"
                    className="w-full h-8 bg-black/20 focus:bg-surface-0/90 focus:backdrop-blur-md border border-white/10 focus:border-nexus-teal/50 rounded-full px-4 py-0 text-[13px] font-bold font-mono text-white focus:text-nexus-teal focus:outline-none placeholder:text-white/70 transition-all"
                  />
                  <input
                    type="text"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="อีเมล"
                    className="w-full h-8 bg-black/20 focus:bg-surface-0/90 focus:backdrop-blur-md border border-white/10 focus:border-nexus-teal/50 rounded-full px-4 py-0 text-[13px] font-bold text-white focus:text-nexus-teal focus:outline-none placeholder:text-white/70 transition-all"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Extended CRM & Logistics Data */}
        <div className="flex-1 min-w-0 bg-neutral-900/90 border border-white/15 rounded-3xl overflow-visible shadow-2xl p-4 space-y-4 border-l-4 border-l-nexus-blue hover:border-white/25 relative z-[20]">
          <h3 className="text-base font-semibold uppercase tracking-widest text-white/80 flex items-center gap-2 border-b border-white/10 pb-2">
            รายละเอียดการขาย
          </h3>
          <div className="grid grid-cols-6 gap-x-4 gap-y-3">
            <div className="space-y-1 col-span-3">
              <label className="text-[12px] font-semibold uppercase tracking-widest text-white/40">ประเภทงานเสนอราคา</label>
              <SciFiDropdownPortal
                isOpen={isQuotationTypeDropdownActive}
                onClose={() => setIsQuotationTypeDropdownActive(false)}
                trigger={
                  <div
                    onClick={() => setIsQuotationTypeDropdownActive(true)}
                    className="w-full h-8 flex items-center justify-between px-4 rounded-full border border-white/10 bg-black/20 transition-colors cursor-pointer hover:bg-white/[0.02] hover:border-nexus-teal/50"
                  >
                    <p className="flex-1 font-bold text-[13px] text-white py-0 leading-relaxed truncate">
                      {quotationType === "SALE" && "SALE (ขายทั่วไป)"}
                      {quotationType === "INSTALLATION" && "INSTALLATION (ขายพร้อมติดตั้ง)"}
                      {quotationType === "MAINTENANCE" && "MAINTENANCE (สัญญา MA)"}
                      {quotationType === "PROJECT_GOV" && "PROJECT_GOV (งานประมูลราชการ)"}
                    </p>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/20"><path d="m6 9 6 6 6-6" /></svg>
                  </div>
                }
              >
                <div className="max-h-[260px] overflow-y-auto custom-scrollbar p-1 space-y-1">
                  {[
                    { value: "SALE", label: "SALE (ขายทั่วไป)" },
                    { value: "INSTALLATION", label: "INSTALLATION (ขายพร้อมติดตั้ง)" },
                    { value: "MAINTENANCE", label: "MAINTENANCE (สัญญา MA)" },
                    { value: "PROJECT_GOV", label: "PROJECT_GOV (งานประมูลราชการ)" }
                  ].map((option) => (
                    <div
                      key={option.value}
                      onClick={() => {
                        setQuotationType(option.value);
                        setIsQuotationTypeDropdownActive(false);
                      }}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors rounded-xl border",
                        quotationType === option.value
                          ? "bg-nexus-teal/10 border-nexus-teal/50"
                          : "border-transparent hover:bg-nexus-teal/10 hover:border-nexus-teal/30"
                      )}
                    >
                      <span className={cn("font-bold text-[13px]", quotationType === option.value ? "text-nexus-teal" : "text-white")}>
                        {option.label}
                      </span>
                    </div>
                  ))}
                </div>
              </SciFiDropdownPortal>
            </div>
            <div className="space-y-1 col-span-3">
              <label className="text-[12px] font-semibold uppercase tracking-widest text-white/40">พนักงานขาย</label>
              <div className="relative">
                {isSalespersonSearchActive ? (
                  <SciFiDropdownPortal
                    isOpen={isSalespersonSearchActive}
                    onClose={() => setIsSalespersonSearchActive(false)}
                    trigger={
                      <div className="relative w-full">
                        <input
                          type="text"
                          value={salespersonSearchTerm}
                          onChange={(e) => setSalespersonSearchTerm(e.target.value)}
                          placeholder="ค้นหาพนักงานขาย..."
                          className="w-full h-8 bg-black/20 focus:bg-surface-0/90 focus:backdrop-blur-md border border-nexus-teal/50 rounded-full px-4 py-0 text-[13px] font-bold text-nexus-teal focus:outline-none focus:shadow-[0_0_15px_rgba(20,184,166,0.15)] placeholder:text-white/30"
                        />
                      </div>
                    }
                  >
                    <div className="max-h-[260px] overflow-y-auto custom-scrollbar p-1.5 bg-surface-1 border border-white/10 rounded-2xl shadow-2xl">
                      <div className="py-1">
                        {filteredSalespersons.length === 0 ? (
                          <div className="px-4 py-3 text-center text-[12px] text-white/40">
                            ไม่พบข้อมูลพนักงานขาย
                          </div>
                        ) : (
                          filteredSalespersons.map((u: any) => (
                            <div
                              key={u.id}
                              onClick={() => {
                                setSelectedSalespersonId(u.id);
                                setSalespersonSearchTerm(getSalespersonName(u));
                                setIsSalespersonSearchActive(false);
                              }}
                              className="flex items-center gap-3 px-3 py-2 hover:bg-nexus-teal/10 cursor-pointer transition-colors rounded-xl border border-transparent hover:border-nexus-teal/30"
                            >
                              <div className="flex-1 truncate">
                                <span className="font-bold text-[13px] text-white flex items-center gap-2">
                                  {getSalespersonName(u)}
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </SciFiDropdownPortal>
                ) : (
                  <div
                    onClick={() => {
                      if (selectedSalesperson) {
                        setSalespersonSearchTerm(getSalespersonName(selectedSalesperson));
                      }
                      setIsSalespersonSearchActive(true);
                    }}
                    className="w-full h-8 flex items-center px-4 rounded-full border border-white/10 bg-black/20 transition-colors cursor-text hover:bg-white/[0.02] hover:border-nexus-teal/50 group"
                  >
                    <p className={cn("flex-1 font-bold text-[13px] truncate py-0 leading-relaxed", (!selectedSalesperson && !salespersonSearchTerm) ? "text-white/40" : "text-white")}>
                      {selectedSalesperson ? getSalespersonName(selectedSalesperson) : (salespersonSearchTerm || (usersLoading ? "กำลังโหลดข้อมูล..." : "เลือกพนักงานขาย..."))}
                    </p>
                    <Search size={14} className="text-white/20 group-hover:text-nexus-teal/50 transition-colors" />
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-1 col-span-3">
              <label className="text-[12px] font-semibold uppercase tracking-widest text-white/40">โอกาสการขาย (%)</label>
              <StepperInput
                value={probability}
                onChange={(val) => setProbability(val)}
                min={0}
                max={100}
                suffix="%"
                className="w-full h-8 bg-black/20 focus:bg-surface-0/90 focus:backdrop-blur-md border border-white/10 focus:border-nexus-teal/50 text-white focus:text-nexus-teal text-[13px] placeholder:text-white/30"
              />
            </div>
            <div className="space-y-1 col-span-3">
              <label className="text-[12px] font-semibold uppercase tracking-widest text-white/40">เวลาจัดส่ง</label>
              <StepperInput
                value={expectedDeliveryDays}
                onChange={(val) => setExpectedDeliveryDays(val)}
                min={0}
                suffix="วัน"
                className="w-full h-8 bg-black/20 focus:bg-surface-0/90 focus:backdrop-blur-md border border-white/10 focus:border-nexus-teal/50 text-white focus:text-nexus-teal text-[13px] placeholder:text-white/30"
              />
            </div>
            <div className="space-y-1 col-span-6">
              <label className="text-[12px] font-semibold uppercase tracking-widest text-white/40">คาดว่าปิดจบ</label>
              <NexusDatePicker
                value={expectedCloseDate}
                onChange={(e) => setExpectedCloseDate(e.target.value)}
                className={cn(
                  "w-full h-8 bg-black/20 focus:bg-surface-0/90 focus:backdrop-blur-md border rounded-full px-4 py-0 leading-relaxed text-[13px] font-bold text-white font-mono focus:text-nexus-teal text-left",
                  !dateValidation.isValid
                    ? "border-danger text-danger focus:border-danger"
                    : "border-white/10 focus:border-nexus-teal/50"
                )}
              />
              {!dateValidation.isValid && (
                <p className="text-[11px] font-bold text-danger mt-1">{dateValidation.error}</p>
              )}
            </div>
            <div className="space-y-1 col-span-4">
              <label className="text-[12px] font-bold text-white/70">ชื่อโครงการ (SmartSelect)</label>
              <SmartSelect
                value={projectId}
                onChange={(val) => {
                  setProjectId(val);
                  const matched = rawProjects.find((p: any) => p.id === val);
                  if (matched) setProjectName(matched.name || matched.projectName || matched.id);
                }}
                options={projectOptions}
                placeholder="เลือกโครงการจากระบบ..."
                allowCustom={false}
                className="w-full h-8"
              />
            </div>
            <div className="space-y-1 col-span-6 relative">
              <label className="text-[12px] font-semibold uppercase tracking-widest text-white/40">เงื่อนไขการส่ง</label>
              <SciFiDropdownPortal
                isOpen={isShippingTermsActive}
                onClose={() => setIsShippingTermsActive(false)}
                trigger={
                  <div className="relative w-full">
                    <input
                      type="text"
                      value={incoTerms}
                      onChange={(e) => setIncoTerms(e.target.value)}
                      onFocus={() => setIsShippingTermsActive(true)}
                      placeholder="Ex. จัดส่งฟรี, ขนส่งเอกชน, รับสินค้าด้วยตัวเอง..."
                      className="w-full h-8 bg-black/20 focus:bg-surface-0/90 focus:backdrop-blur-md border border-white/10 focus:border-nexus-teal/50 rounded-full px-4 text-[13px] font-bold text-white focus:text-nexus-teal text-left"
                    />
                  </div>
                }
              >
                <div className="max-h-[260px] overflow-y-auto custom-scrollbar p-1.5 bg-surface-1 border border-white/10 rounded-2xl shadow-2xl space-y-1">
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-2 pb-1">ตัวเลือกแนะนำ</p>
                  {["จัดส่งฟรี", "คิดค่าจัดส่งตามระยะทาง", "จัดส่งผ่านขนส่งเอกชน", "ลูกค้ารับสินค้าเอง"].map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => {
                        setIncoTerms(term);
                        setIsShippingTermsActive(false);
                      }}
                      className="w-full text-left px-3 py-1.5 rounded-xl text-[12px] font-bold text-white/70 hover:text-white hover:bg-nexus-teal/20 transition-all border border-transparent hover:border-nexus-teal/30"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </SciFiDropdownPortal>
            </div>
            <div className="space-y-1 col-span-6">
              <div className="flex items-center justify-between">
                <label className="text-[12px] font-semibold uppercase tracking-widest text-white/40">สถานที่จัดส่ง</label>
                <button
                  type="button"
                  onClick={() => {
                    const billingAdd = [addrLine1, addrLine2, subDistrict, district, province, postalCode].filter(Boolean).join(" ");
                    setDeliveryAddress(billingAdd);
                  }}
                  className="text-[10px] text-nexus-teal/80 hover:text-nexus-teal font-bold bg-nexus-teal/10 hover:bg-nexus-teal/20 px-2 py-0.5 rounded transition-colors flex items-center gap-1"
                >
                  📍 ใช้ที่อยู่เดียวกับสำนักงานใหญ่
                </button>
              </div>
              <input
                type="text"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="ระบุสถานที่จัดส่ง หรือคลิกปุ่มด้านบน"
                className="w-full h-8 bg-black/20 focus:bg-surface-0/90 focus:backdrop-blur-md border border-white/10 focus:border-nexus-teal/50 rounded-full px-4 text-[13px] font-bold text-white focus:text-nexus-teal"
              />
            </div>
          </div>
        </div>

        {/* 3. Document Info */}
        <div className="w-full min-w-0 min-[1700px]:w-[25%] shrink-0 bg-neutral-900/90 border border-white/15 rounded-3xl overflow-visible shadow-2xl p-4 space-y-4 border-l-4 border-l-purple-500 hover:border-white/25 relative z-[10]">
          <h3 className="text-base font-semibold uppercase tracking-widest text-white/80 flex items-center gap-2 border-b border-white/10 pb-2">
            <Calendar size={16} className="text-nexus-teal drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" /> ข้อมูลเอกสาร
          </h3>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold uppercase tracking-widest text-white/40">วันที่ออก <span className="text-danger">*</span></label>
                <NexusDatePicker value={docDate} onChange={(e) => setDocDate(e.target.value)} className="w-full h-8 rounded-full px-2 text-nexus-teal text-[13px] font-bold font-mono text-center" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold uppercase tracking-widest text-white/40">ใช้งานได้ถึง</label>
                <div className="w-full h-8 rounded-full px-3 flex items-center justify-center bg-black/20 border border-white/10 text-nexus-teal text-[13px] font-bold whitespace-nowrap overflow-hidden pointer-events-none select-none cursor-default" title={`อีก ${validDays} วัน`}>
                  {validUntil ? new Date(`${validUntil}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" }) : "-"}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold uppercase tracking-widest text-white/40">ยืนราคา (วัน) <span className="text-danger">*</span></label>
                <StepperInput
                  value={validDays}
                  onChange={(val) => setValidDays(val || 0)}
                  min={0}
                  suffix="วัน"
                  className="w-full h-8 bg-black/20 border border-white/10 text-[13px] font-bold text-white font-mono text-center"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold uppercase tracking-widest text-white/40">เงื่อนไขชำระ</label>
                <input
                  type="text"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  className="w-full h-8 bg-black/20 border border-white/10 rounded-full px-2 text-[13px] font-bold text-nexus-teal text-center"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold uppercase tracking-widest text-white/40">เลขอ้างอิง</label>
              <input
                type="text"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="PR-2026-001"
                className="w-full h-8 bg-black/20 border border-white/10 rounded-full px-2 text-[13px] font-bold text-nexus-teal font-mono text-center"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Line Items Table */}
      <div className="bg-neutral-900/90 border border-white/15 rounded-3xl overflow-visible shadow-2xl p-4 space-y-4 border-l-4 border-l-emerald-500 hover:border-white/25 relative z-[10]">
        <div className="flex items-center justify-between border-b border-white/10 pb-4 h-[36px]">
          <h3 className="text-base font-semibold uppercase tracking-widest text-white/80 flex items-center gap-2">
            รายการสินค้า / บริการ
          </h3>

          {items.length > 0 && (
            <div className={cn("px-2.5 py-0.5 rounded-full border text-[11px] font-bold uppercase tracking-widest flex items-center gap-1", rainbow.bg, rainbow.border, rainbow.text)}>
              <Info size={12} />
              <span>{rainbow.label} ({summary.profitMargin}%)</span>
            </div>
          )}
        </div>

        <DocumentItemsTable
          items={items}
          onChange={setItems}
          taxType={taxType}
          priceDeviationWarningPercent={priceDeviationWarningPercent}
        />
      </div>

      {/* Attachments Section */}
      <DocumentAttachmentsCard
        attachments={attachments}
        onChange={setAttachments}
      />

      {/* Payment Schedule & Additional Terms Cards (Patch 10) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Payment Schedule Card */}
        <div className="bg-surface-1 border border-white/10 rounded-3xl p-4 shadow-2xl space-y-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <h3 className="text-base font-semibold uppercase tracking-widest text-white/80 flex items-center gap-2">
              เงื่อนไขการชำระเงิน (งวดชำระ)
            </h3>
            <button
              type="button"
              onClick={() => {
                setPaymentSchedules(prev => [
                  ...prev,
                  { id: Date.now().toString(), name: `งวดที่ ${prev.length + 1}`, percent: 0, amount: 0 }
                ]);
              }}
              className="text-[10px] text-nexus-teal hover:text-white font-bold bg-nexus-teal/10 hover:bg-nexus-teal/20 px-2.5 py-1 rounded-full border border-nexus-teal/30 transition-all"
            >
              + เพิ่มงวดชำระ
            </button>
          </div>

          <div className="space-y-2">
            {paymentSchedules.map((sch) => {
              const calcAmt = summary.grandTotal * ((Number(sch.percent) || 0) / 100);
              return (
                <div key={sch.id} className="grid grid-cols-12 gap-2 items-center bg-black/20 p-2 rounded-xl border border-white/5">
                  <input
                    type="text"
                    value={sch.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPaymentSchedules(prev => prev.map(p => p.id === sch.id ? { ...p, name: val } : p));
                    }}
                    className="col-span-5 bg-transparent border border-white/10 rounded-full px-3 h-8 text-[12px] text-white focus:outline-none focus:border-nexus-teal font-bold"
                    placeholder="ชื่องวด..."
                  />
                  <div className="col-span-3 flex items-center bg-black/40 border border-white/10 rounded-full h-8 px-2">
                    <input
                      type="number"
                      value={sch.percent || ''}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;
                        setPaymentSchedules(prev => prev.map(p => p.id === sch.id ? { ...p, percent: val } : p));
                      }}
                      className="w-full bg-transparent text-right font-mono text-[12px] text-white focus:outline-none"
                      placeholder="0"
                    />
                    <span className="text-[11px] text-white/50 ml-1 font-bold">%</span>
                  </div>
                  <div className="col-span-3 text-right font-mono text-[12px] font-bold text-nexus-teal">
                    {formatCurrency(calcAmt)}
                  </div>
                  <div className="col-span-1 text-center">
                    <button
                      type="button"
                      onClick={() => setPaymentSchedules(prev => prev.filter(p => p.id !== sch.id))}
                      className="text-danger/60 hover:text-danger p-1 rounded-full hover:bg-danger/10"
                      title="ลบงวดชำระ"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
            <div className="flex justify-between items-center text-[11px] font-bold px-2 pt-1">
              <span className="text-white/60">รวมสัดส่วนงวดชำระ:</span>
              <span className={cn("font-mono font-black", paymentSchedules.reduce((sum, p) => sum + (Number(p.percent) || 0), 0) === 100 ? "text-nexus-teal" : "text-danger")}>
                {paymentSchedules.reduce((sum, p) => sum + (Number(p.percent) || 0), 0)}%
              </span>
            </div>
          </div>
        </div>

        {/* Warranty & Scope Card */}
        <div className="bg-surface-1 border border-white/10 rounded-3xl p-4 shadow-2xl space-y-3">
          <h3 className="text-base font-semibold uppercase tracking-widest text-white/80 border-b border-white/10 pb-2">
            ข้อกำหนดและการรับประกัน
          </h3>
          <div className="space-y-2">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-white/70">การรับประกัน (Warranty)</label>
              <input
                type="text"
                value={warrantyTerms}
                onChange={(e) => setWarrantyTerms(e.target.value)}
                placeholder="การรับประกันสินค้า 1 ปี..."
                className="w-full h-8 bg-black/20 border border-white/10 rounded-full px-3 text-[12px] text-white focus:outline-none focus:border-nexus-teal"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-white/70">ขอบเขตงาน (Scope of Work)</label>
              <input
                type="text"
                value={scopeOfWork}
                onChange={(e) => setScopeOfWork(e.target.value)}
                placeholder="ขอบเขตการติดตั้งและทดสอบ..."
                className="w-full h-8 bg-black/20 border border-white/10 rounded-full px-3 text-[12px] text-white focus:outline-none focus:border-nexus-teal"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-white/70">ข้อยกเว้น (Exclusions)</label>
              <input
                type="text"
                value={exclusions}
                onChange={(e) => setExclusions(e.target.value)}
                placeholder="ไม่รวมงานเดินสายระบบไฟฟ้าหลัก..."
                className="w-full h-8 bg-black/20 border border-white/10 rounded-full px-3 text-[12px] text-white focus:outline-none focus:border-nexus-teal"
              />
            </div>
          </div>
        </div>
      </div>

      {/* T&C, Remarks, and Internal Notes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface-1 border border-white/5 rounded-3xl p-4 shadow-2xl space-y-4">
          <h3 className="text-base font-semibold uppercase tracking-widest text-white/80 flex items-center gap-2 border-b border-white/5 pb-2">
            เงื่อนไขการค้า
          </h3>
          <textarea
            value={termsAndConditions}
            onChange={(e) => setTermsAndConditions(e.target.value)}
            className="w-full h-32 bg-black/20 focus:bg-surface-0/90 focus:backdrop-blur-md border border-white/10 focus:border-nexus-teal/50 rounded-xl p-3 text-[13px] text-white focus:text-nexus-teal focus:outline-none resize-none leading-relaxed placeholder:text-white/30 transition-all"
          />
        </div>
        <div className="bg-surface-1 border border-white/5 rounded-3xl p-4 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <h3 className="text-base font-semibold uppercase tracking-widest text-white/80 flex items-center gap-2">
              หมายเหตุ
            </h3>
            <div className="flex gap-2">
              <button type="button" onClick={() => setRemark(prev => prev + (prev ? "\n" : "") + "- เงื่อนไขการรับประกันสินค้า 1 ปี")} className="text-[10px] bg-white/5 hover:bg-white/10 text-white/60 hover:text-white px-2 py-1 rounded transition-colors font-bold tracking-wider">รับประกัน</button>
              <button type="button" onClick={() => setRemark(prev => prev + (prev ? "\n" : "") + "- บัญชีโอนเงิน: ธ.กสิกรไทย สาขาxxx เลขที่ 123-4-56789-0 บจก. เน็กซัส")} className="text-[10px] bg-white/5 hover:bg-white/10 text-white/60 hover:text-white px-2 py-1 rounded transition-colors font-bold tracking-wider">บัญชีโอนเงิน</button>
            </div>
          </div>
          <textarea
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="หมายเหตุเพิ่มเติมที่ต้องการแสดงบนเอกสาร..."
            className="w-full h-24 bg-black/20 focus:bg-surface-0/90 focus:backdrop-blur-md border border-white/10 focus:border-nexus-teal/50 rounded-xl p-3 text-[13px] text-white focus:text-nexus-teal focus:outline-none resize-none leading-relaxed placeholder:text-white/30 transition-all"
          />
          <div className="flex flex-wrap gap-2 pt-1">
            {['#รับประกัน 1 ปี', '#ชำระมัดจำ 50%', '#ส่งมอบภายใน 30 วัน', '#ราคานี้ยืนระยะเวลา 15 วัน'].map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => setRemark(prev => prev ? `${prev}\n${tag}` : tag)}
                className="px-3 py-1 rounded-full bg-nexus-teal/10 text-nexus-teal border border-nexus-teal/20 text-[10px] font-bold hover:bg-nexus-teal/20 transition-colors cursor-pointer"
              >
                + {tag}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-surface-1 border border-warning/20 rounded-3xl p-4 shadow-[0_0_15px_rgba(234,179,8,0.05)] space-y-4">
          <h3 className="text-base font-semibold uppercase tracking-widest text-warning flex items-center gap-2 border-b border-warning/20 pb-2">
            หมายเหตุภายใน (ไม่พิมพ์)
          </h3>
          <textarea
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            placeholder="ระบุเหตุผลการให้ส่วนลด หรือข้อความสำหรับผู้อนุมัติ (ลูกค้าจะไม่เห็นข้อความนี้)..."
            className="w-full h-32 bg-black/40 border border-warning/10 rounded-xl p-3 text-[13px] text-warning/80 focus:outline-none focus:border-warning/50 resize-none leading-relaxed placeholder:text-warning/30"
          />
        </div>
      </div>
    </div>
  );

  const rightSidebar = (
    <div className="space-y-4 h-fit pb-10">
      {/* Credit Limit Guardrail Warning */}
      {showCreditWarning && (
        <GlassCard className="p-4 border-danger/30 rounded-3xl bg-danger/10 shadow-[0_0_30px_rgba(239,68,68,0.15)] space-y-3 w-full">
          <div className="flex items-center gap-2 text-danger">
            <AlertTriangle size={18} />
            <span className="text-[12px] font-semibold uppercase tracking-widest">แจ้งเตือนวงเงินเครดิตเต็ม</span>
          </div>
          <p className="text-[12px] text-white/70 leading-relaxed">
            มูลค่าเอกสารรวมกับยอดค้างชำระปัจจุบัน เกินวงเงินเครดิตที่ตั้งไว้สำหรับลูกค้ารายนี้ (<span className="text-danger font-mono font-bold">{formatCurrency(selectedCustomer?.creditLimit || 0)}</span>) เอกสารฉบับนี้จะถูกส่งไปขออนุมัติพิเศษ (PENDING_APPROVAL) ทันที
          </p>
        </GlassCard>
      )}

      <GlassCard className="p-4 border-white/15 rounded-3xl bg-neutral-900/90 shadow-2xl space-y-4 w-full border-t-4 border-t-nexus-teal">
        {/* Live Profit Margin Inspector with Target Line & Role Protection (Patch 11 & 13) */}
        {canSeeCost ? (
          <div className="flex flex-col gap-2 border-b border-white/5 pb-4">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-semibold text-white/60 uppercase tracking-widest">อัตรากำไร (GP)</span>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-mono font-bold text-white/70">
                  กำไร ฿{formatCurrency(calculateProfitAmount(summary.subTotal, summary.totalCost))}
                </span>
                <span className={cn("text-[14px] font-mono font-black", rainbow.text)}>
                  {summary.profitMargin}%
                </span>
              </div>
            </div>
            
            {/* Progress bar with Target marker */}
            <div className="relative w-full h-3 bg-white/10 rounded-full overflow-hidden">
              <div
                className={cn("h-full transition-all duration-500 rounded-full", summary.profitMargin < minGpPercentForAutoSend ? "bg-danger/80" : rainbow.bg)}
                style={{ width: `${Math.min(Math.max(summary.profitMargin, 0), 100)}%` }}
              />
              {/* Target Marker at minGpPercentForAutoSend (default 15%) */}
              <div 
                className="absolute top-0 bottom-0 w-[2px] bg-white border-r border-black shadow-[0_0_6px_rgba(255,255,255,0.8)] z-10"
                style={{ left: `${Math.min(Math.max(minGpPercentForAutoSend, 0), 100)}%` }}
                title={`เกณฑ์ขั้นต่ำ ${minGpPercentForAutoSend}%`}
              />
            </div>

            <div className="flex justify-between text-[12px] font-semibold text-white/40 mt-0.5">
              <span>0%</span>
              <span className="text-nexus-teal font-mono text-[12px] font-bold">เป้าหมาย {minGpPercentForAutoSend}%</span>
              <span>100%</span>
            </div>

            {summary.profitMargin < minGpPercentForAutoSend && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-danger/10 border border-danger/30 text-danger text-[12px] font-bold mt-1">
                <AlertTriangle size={14} className="shrink-0" />
                <span>GP ต่ำกว่าเกณฑ์ {minGpPercentForAutoSend}% (ต้องส่งขออนุมัติ)</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <span className="text-[12px] font-semibold text-white/40 uppercase tracking-widest flex items-center gap-1.5">
              <Lock size={12} /> ข้อมูลต้นทุนและกำไร
            </span>
            <span className="text-[12px] text-white/40 font-mono">สงวนสิทธิ์เฉพาะผู้จัดการ</span>
          </div>
        )}

        {/* Tax Selector with Tooltips (Patch 13) */}
        <div className="flex flex-col gap-3 border-b border-white/5 pb-4">
          <span className="text-[12px] font-semibold text-white/40 uppercase tracking-widest">รูปแบบภาษี</span>
          <div className="flex bg-black/40 p-1 rounded-full border border-white/5 w-full">
            <button
              type="button"
              title="ไม่มี VAT: เอกสารไม่คิดภาษีมูลค่าเพิ่ม (0%)"
              onClick={() => handleTaxTypeChange("NON_VAT")}
              className={cn(
                "flex-1 h-8 rounded-full flex flex-col items-center justify-center text-[12px] font-black uppercase tracking-widest transition-all",
                taxType === "NON_VAT" ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/70 hover:bg-white/[0.02]"
              )}
            >
              ไม่มี VAT
            </button>
            <button
              type="button"
              title="แยก VAT: ราคาสินค้ายังไม่รวมภาษี ระบบจะคำนวณ VAT 7% เพิ่มจากยอดรวม"
              onClick={() => handleTaxTypeChange("EXCLUSIVE")}
              className={cn(
                "flex-1 h-8 rounded-full flex flex-col items-center justify-center text-[12px] font-black uppercase tracking-widest transition-all",
                taxType === "EXCLUSIVE" ? "bg-nexus-teal/20 text-nexus-teal shadow-sm border border-nexus-teal/30" : "text-white/40 hover:text-white/70 hover:bg-white/[0.02]"
              )}
            >
              แยก VAT
            </button>
            <button
              type="button"
              title="รวม VAT (ปกติ): ราคาสินค้ารวม VAT 7% แล้ว ระบบจะถอด VAT ออกมาคำนวณแยก"
              onClick={() => handleTaxTypeChange("INCLUSIVE")}
              className={cn(
                "flex-1 h-8 rounded-full flex flex-col items-center justify-center gap-[1px] text-[12px] font-black uppercase tracking-widest transition-all leading-none",
                taxType === "INCLUSIVE" ? "bg-nexus-teal/20 text-nexus-teal shadow-sm border border-nexus-teal/30" : "text-white/40 hover:text-white/70 hover:bg-white/[0.02]"
              )}
            >
              <span>รวม VAT</span>
              <span className="text-[12px] font-normal tracking-normal text-white/70 leading-none mt-0.5">(ปกติ)</span>
            </button>
            <button
              type="button"
              title="รวม VAT (บวกเพิ่ม): ราคาสินค้ารวม VAT 7% โดยคำนวณบวก VAT เพิ่มจากฐานราคาทุน/ขาย"
              onClick={() => handleTaxTypeChange("INCLUSIVE_AUTO")}
              className={cn(
                "flex-1 h-8 rounded-full flex flex-col items-center justify-center gap-[1px] text-[12px] font-black uppercase tracking-widest transition-all leading-none",
                taxType === "INCLUSIVE_AUTO" ? "bg-nexus-teal/20 text-nexus-teal shadow-sm border border-nexus-teal/30" : "text-white/40 hover:text-white/70 hover:bg-white/[0.02]"
              )}
            >
              <span>รวม VAT</span>
              <span className="text-[12px] font-normal tracking-normal text-white/70 leading-none mt-0.5">(บวกเพิ่ม)</span>
            </button>
          </div>
        </div>

        {/* WHT Selector */}
        <div className="flex flex-col gap-3 border-b border-white/5 pb-4">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-white/40 uppercase tracking-widest">หัก ณ ที่จ่าย</span>
            <button
              type="button"
              onClick={() => {
                setItems(prev => prev.map(item => ({ ...item, whtRate })));
              }}
              className="text-[12px] text-nexus-teal hover:text-white font-bold bg-nexus-teal/10 hover:bg-nexus-teal/20 px-2.5 py-1 rounded-full border border-nexus-teal/30 transition-all"
            >
              ใช้กับทุกบรรทัด
            </button>
          </div>
          <div className="flex bg-black/40 p-1 rounded-full border border-white/5 w-full">
            {[0, 1, 3, 5].map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => setWhtRate(rate)}
                className={cn(
                  "flex-1 h-8 rounded-full flex flex-col items-center justify-center text-[12px] font-black uppercase tracking-widest transition-all",
                  whtRate === rate ? (rate === 0 ? "bg-white/10 text-white shadow-sm" : "bg-warning/20 text-warning shadow-sm border border-warning/30") : "text-white/40 hover:text-white/70 hover:bg-white/[0.02]"
                )}
              >
                {rate === 0 ? "ไม่มี" : `${rate}%`}
              </button>
            ))}
          </div>
        </div>

        {/* Document Discount Selector */}
        <div className="flex flex-col gap-2 border-b border-white/5 pb-4">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-white/40 uppercase tracking-widest">ส่วนลดท้ายบิล/เอกสาร</span>
            <div className="flex bg-black/40 p-0.5 rounded-full border border-white/5">
              <button
                type="button"
                onClick={() => setDocDiscountType('PERCENT')}
                className={cn("px-2.5 py-0.5 rounded-full text-[12px] font-bold transition-all", docDiscountType === 'PERCENT' ? "bg-nexus-teal/20 text-nexus-teal border border-nexus-teal/30" : "text-white/40")}
              >
                %
              </button>
              <button
                type="button"
                onClick={() => setDocDiscountType('AMOUNT')}
                className={cn("px-2.5 py-0.5 rounded-full text-[12px] font-bold transition-all", docDiscountType === 'AMOUNT' ? "bg-nexus-teal/20 text-nexus-teal border border-nexus-teal/30" : "text-white/40")}
              >
                บาท
              </button>
            </div>
          </div>
          <input
            type="number"
            value={docDiscountValue === 0 ? '' : docDiscountValue}
            onChange={(e) => setDocDiscountValue(Math.max(0, Number(e.target.value) || 0))}
            placeholder="0.00"
            className="w-full h-8 px-4 rounded-full bg-black/40 border border-white/10 text-right font-mono text-[13px] text-nexus-teal font-bold focus:outline-none focus:border-nexus-teal"
          />
        </div>

        <div className="flex justify-between items-center pt-2">
          <span className="text-sm font-semibold text-white/40 uppercase tracking-widest">มูลค่ารวมก่อนส่วนลด</span>
          <span className="text-sm text-white font-mono font-bold not-italic text-right">{formatCurrency(summary.subTotal)} บาท</span>
        </div>

        {summary.docDiscountAmount > 0 && (
          <div className="flex justify-between items-center pb-2">
            <span className="text-sm font-semibold text-warning uppercase tracking-widest">ส่วนลดเอกสาร</span>
            <span className="text-sm text-warning font-mono font-bold not-italic text-right">-{formatCurrency(summary.docDiscountAmount)} บาท</span>
          </div>
        )}

        {taxType !== 'NON_VAT' && (
          <div className="flex justify-between items-center pb-2">
            <span className="text-sm font-semibold text-white/40 uppercase tracking-widest">ภาษีมูลค่าเพิ่ม 7%</span>
            <span className="text-sm text-white font-mono font-bold not-italic text-right">{formatCurrency(summary.vatAmount)} บาท</span>
          </div>
        )}

        <div className="flex justify-between items-center pb-4 border-b border-white/5">
          <span className="text-sm font-semibold text-white/70 uppercase tracking-widest">จำนวนเงินรวมทั้งสิ้น</span>
          <span className="text-lg text-white font-mono font-bold not-italic text-right">{formatCurrency(summary.grandTotal)} บาท</span>
        </div>

        {summary.whtAmount > 0 && (
          <div className="flex justify-between items-center pt-2 pb-4 border-b border-white/5">
            <span className="text-sm font-black text-warning uppercase tracking-widest">หัก ณ ที่จ่าย</span>
            <span className="text-sm text-warning font-mono font-bold not-italic text-right">-{formatCurrency(summary.whtAmount)} บาท</span>
          </div>
        )}

        {/* Net Payable: Reduced Weight when equal to Grand Total (Patch 13) */}
        <div className="flex justify-between items-end pt-4">
          <span className="text-sm font-semibold text-white/70 uppercase tracking-widest">ยอดชำระสุทธิ</span>
          <span className={cn(
            "font-mono tracking-tighter not-italic text-right transition-all",
            summary.whtAmount > 0 
              ? "text-3xl font-black text-nexus-teal drop-shadow-[0_0_15px_rgba(34,211,238,0.2)]" 
              : "text-2xl font-bold text-white/90"
          )}>
            {formatCurrency(summary.netPayable)} <span className="text-sm font-normal text-white/60">บาท</span>
          </span>
        </div>

        <div className="bg-white/5 rounded-xl p-3 flex justify-center border border-white/5">
          <span className="text-[12px] font-black text-white/60 tracking-widest text-center">{summary.thaiBahtText}</span>
        </div>
      </GlassCard>
    </div>
  );

  return (
    <>
      <NexusPageLayout
        header={headerContent}
        leftContent={leftContent}
        rightSidebar={rightSidebar}
      />
      {/* Live Document PDF Preview Modal (Patch 12) */}
      <DocumentViewerModal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        documentData={previewDocumentData}
        documentType="ใบเสนอราคา (Quotation)"
      />
      {showSuccessModal && (
        <Modal isOpen={true} onClose={() => { }} title="บันทึกสำเร็จ">
          <div className="p-6 space-y-6 text-center">
            <div className="w-16 h-16 bg-nexus-teal/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Building2 className="text-nexus-teal" size={32} />
            </div>
            <h3 className="text-xl font-bold text-white">บันทึกใบเสนอราคาสำเร็จ!</h3>
            <p className="text-white/60">คุณต้องการทำสิ่งใดต่อไป?</p>
            <div className="flex flex-col gap-3">
              <PillButton onClick={() => router.push(`/projects/new?fromQuotationId=${savedQuotationId}`)} className="w-full h-12 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 font-bold justify-center">
                <Building2 size={18} className="mr-2" /> แปลงเป็นโครงการทันที
              </PillButton>
              <PillButton onClick={() => router.push("/sales/quotations")} className="w-full h-12 bg-white/5 text-white/80 hover:bg-white/10 font-bold justify-center">
                กลับสู่หน้ารายการใบเสนอราคา
              </PillButton>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
