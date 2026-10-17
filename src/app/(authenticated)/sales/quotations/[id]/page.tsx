"use client";

import { useSystemDialog } from "@/context/DialogContext";
import React, { useState, useMemo, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Save, Send, Building2, Calendar, Plus, Info, AlertTriangle, Search, Trash2, FileText, Mail, MessageSquare, Download, Edit3, ChevronDown, CheckCircle2, Lock, GitBranch, Copy, History, XCircle, FileSpreadsheet } from "lucide-react";
import { PillButton, cn, NexusDatePicker, GlassCard, Modal } from "@/components/ui/Base";
import Link from "next/link";
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
import { useCustomers } from "@/hooks/useCustomers";
import { useRealtimeDocument } from "@/hooks/useRealtimeDocument";
import { useAuth } from "@/context/AuthContext";
import { SmartSelect, StepperInput, SciFiDropdownPortal } from "@/components/ui/SmartComponents";
import { db } from "@/lib/firebase-client";
import { doc, collection, getDoc, getDocs } from "firebase/firestore";
import { apiFetch } from "@/lib/api-client";

export default function QuotationEditPage() {
  const { showAlert, showConfirm, showPrompt } = useSystemDialog();
  const router = useRouter();
  // Next 16: params ของ page เป็น Promise จึงอ่านผ่าน useParams แทน
  const routeParams = useParams();
  const params = { id: decodeURIComponent(String(routeParams.id || "")) };
  const { user, companyId, role, roles } = useAuth();

  // Data Fetching from both root collection and company subcollection
  const effectiveCompanyId = companyId || "";
  const { data: companyCustomers, loading: companyCustomersLoading } = useCustomers();
  const { data: users, loading: usersLoading } = useRealtimeCollection('users');

  const customersLoading = companyCustomersLoading;

  // Combine & deduplicate customer data from all Firestore stores
  const customers = useMemo(() => {
    const allItems = [...(companyCustomers || [])];
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
  }, [companyCustomers]);

  const [isLoading, setIsLoading] = useState(true);

  // Auto-generated fields
  const [quotationNumber, setQuotationNumber] = useState("");

  // Header State
  const [quotationType, setQuotationType] = useState("SALE");
  const [isQuotationTypeDropdownActive, setIsQuotationTypeDropdownActive] = useState(false);
  const [docDate, setDocDate] = useState(new Date().toISOString().split('T')[0]);
  const [validUntil, setValidUntil] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [paymentTerms, setPaymentTerms] = useState("เครดิต 30 วัน");
  const [referenceNo, setReferenceNo] = useState("");

  // Customer State
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const selectedCustomer = useMemo(() => customers.find(c => c.id === selectedCustomerId), [customers, selectedCustomerId]);
  const getCustomerName = (c: any) => c?.customerName || c?.name || c?.companyName || "";

  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isSendMenuOpen, setIsSendMenuOpen] = useState(false);
  const canSeeCost = canViewCost(roles);

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
        else {
          const parts = remaining.split(" ");
          if (parts.length >= 4 && !parts[parts.length-1].includes("เขต") && !parts[parts.length-1].includes("อำเภอ")) {
            prov = parts.pop() || "";
            remaining = parts.join(" ");
          }
        }

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
      }
      setCustomerTaxId(selectedCustomer.taxId || selectedCustomer.customerTaxId || "");
      if (selectedCustomer.contactPerson || selectedCustomer.contact) {
        setContactPerson(selectedCustomer.contactPerson || selectedCustomer.contact || "");
      }
      if (selectedCustomer.phone || selectedCustomer.contactPhone) {
        setContactPhone(selectedCustomer.phone || selectedCustomer.contactPhone || "");
      }
      if (selectedCustomer.email || selectedCustomer.contactEmail) {
        setContactEmail(selectedCustomer.email || selectedCustomer.contactEmail || "");
      }
      if (selectedCustomer.branch) {
        setCustomerBranch(selectedCustomer.branch);
      }
    }
  }, [selectedCustomer]);

  // Customer Smart Search State
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedCustomerSearch(customerSearchTerm), 300);
    return () => clearTimeout(timer);
  }, [customerSearchTerm]);

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
  const [docDiscountType, setDocDiscountType] = useState<'PERCENT' | 'AMOUNT'>('PERCENT');
  const [docDiscountValue, setDocDiscountValue] = useState<number>(0);

  const handleTaxTypeChange = (newType: VatTypeV3) => {
    if (newType === "INCLUSIVE_AUTO" && taxType !== "INCLUSIVE_AUTO") {
      setItems(prev => prev.map(item => ({ ...item, price: Math.ceil((item.price || 0) * 1.07) })));
    } else if (taxType === "INCLUSIVE_AUTO" && newType !== "INCLUSIVE_AUTO") {
      setItems(prev => prev.map(item => ({ ...item, price: Math.round((item.price || 0) / 1.07) })));
    }
    setTaxType(newType);
  };

  // Extended CRM & Logistics Data
  const [probability, setProbability] = useState<number>(50);
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [nextFollowUpDate, setNextFollowUpDate] = useState("");
  const [attachments, setAttachments] = useState<any[]>([]);
  const [revisionNumber, setRevisionNumber] = useState<number>(1);
  const [parentQuotationId, setParentQuotationId] = useState<string | null>(null);
  const [revisionHistory, setRevisionHistory] = useState<any[]>([]);
  const [customerSnapshot, setCustomerSnapshot] = useState<any>(null);
  const [leadSource, setLeadSource] = useState("");
  const [projectName, setProjectName] = useState("");
  const [incoTerms, setIncoTerms] = useState("");
  const [expectedDeliveryDays, setExpectedDeliveryDays] = useState<number>(30);
  const [shippingAddress, setShippingAddress] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [selectedSalespersonId, setSelectedSalespersonId] = useState("");
  const getSalespersonName = (u: any) => u?.displayName || u?.name || u?.email || "ไม่ระบุชื่อ";
  const selectedSalesperson = users.find(u => u.id === selectedSalespersonId);

  // Modals & Actions
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [linkedSo, setLinkedSo] = useState<string>("");
  const [notesDirty, setNotesDirty] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [supersededBy, setSupersededBy] = useState<{ id: string; no: string } | null>(null);
  const [revisionChangeSummary, setRevisionChangeSummary] = useState("");
  const [isCreatingRevision, setIsCreatingRevision] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

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

  // Handlers for Revision, Duplicate, and Approval Gate
  const handleCreateRevisionSubmit = async () => {
    if (!params.id) return;
    setIsCreatingRevision(true);
    try {
      const res = await apiFetch(`/api/quotations/${params.id}/create-revision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          changeSummary: revisionChangeSummary,
          companyId: companyId || "",
          userUid: user?.uid || ""
        })
      });
      const result = await res.json();
      if (result.success && result.newQuotationId) {
        showAlert(`สร้างฉบับแก้ไข ${result.newDocumentNo} สำเร็จ`);
        setShowRevisionModal(false);
        router.push(`/sales/quotations/${result.newQuotationId}`);
      } else {
        showAlert(`เกิดข้อผิดพลาด: ${result.error || "ไม่สามารถสร้างฉบับแก้ไขได้"}`, "เกิดข้อผิดพลาด", "error");
      }
    } catch (err: any) {
      showAlert(`เกิดข้อผิดพลาดในการเชื่อมต่อ: ${err.message}`, "เกิดข้อผิดพลาด", "error");
    } finally {
      setIsCreatingRevision(false);
    }
  };

  const handleDuplicateSubmit = async () => {
    if (!params.id) return;
    if (!await showConfirm("คุณต้องการคัดลอกใบเสนอราคานี้เป็นใบใหม่หรือไม่?")) return;
    setIsDuplicating(true);
    try {
      const res = await apiFetch(`/api/quotations/${params.id}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: companyId || "",
          userUid: user?.uid || ""
        })
      });
      const result = await res.json();
      if (result.success && result.newQuotationId) {
        showAlert(`คัดลอกเอกสารสำเร็จ (${result.newDocumentNo})`);
        router.push(`/sales/quotations/${result.newQuotationId}`);
      } else {
        showAlert(`เกิดข้อผิดพลาด: ${result.error || "ไม่สามารถคัดลอกได้"}`, "เกิดข้อผิดพลาด", "error");
      }
    } catch (err: any) {
      showAlert(`เกิดข้อผิดพลาดในการเชื่อมต่อ: ${err.message}`, "เกิดข้อผิดพลาด", "error");
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleApprovalAction = async (targetStatus: "SENT" | "REJECTED") => {
    if (!companyId || !params.id) return;
    const isApprove = targetStatus === "SENT";
    const actionLabel = isApprove ? "อนุมัติ" : "ไม่อนุมัติ";
    if (!await showConfirm(`คุณต้องการ${actionLabel}ใบเสนอราคา ${quotationNumber} หรือไม่?`)) return;
    const comment = isApprove ? "" : (await showPrompt("เหตุผลที่ตีกลับให้แก้ไข (แสดงให้ผู้ขายเห็น)") || "");

    setIsApproving(true);
    try {
      const res = await apiFetch(`/api/quotations/${encodeURIComponent(params.id)}/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, decision: isApprove ? "approve" : "reject", comment }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "ทำรายการไม่สำเร็จ");
      setStatus(json.status);
      showAlert(`ทำรายการ${actionLabel}ใบเสนอราคาเรียบร้อยแล้ว`);
    } catch (err: any) {
      console.error("Error approving/rejecting quotation:", err);
      showAlert(`เกิดข้อผิดพลาดในการทำรายการ: ${err.message}`, "เกิดข้อผิดพลาด", "error");
    } finally {
      setIsApproving(false);
    }
  };

  // ใบรูปแบบเก่ามีแต่ชื่อลูกค้า: จับคู่กับลูกค้าในฐานข้อมูลตามชื่อ (ไม่สร้างลูกค้าซ้ำตอนบันทึก)
  useEffect(() => {
    if (selectedCustomerId || !customerSearchTerm || customers.length === 0) return;
    const name = customerSearchTerm.trim();
    const match = customers.find(c => getCustomerName(c).trim() === name);
    if (match) setSelectedCustomerId(match.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers, customerSearchTerm, selectedCustomerId]);

  // Load existing data
  useEffect(() => {
    async function loadQuotation() {
      if (!companyId || !params.id) return;
      try {
        const docRef = doc(db, `companies/${companyId}/quotations`, params.id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          // ใบเสนอราคารูปแบบเก่า: เลขที่อยู่ใน quoteId, วันที่ใน date, สถานะตัวพิมพ์เล็ก ("Draft"),
          // ชื่อลูกค้าเก็บใน customerId และรายการอยู่ใน items (ไม่มี subcollection lines)
          const normalizedStatus = String(data.status || "DRAFT").toUpperCase();
          const legacyCustomerName = !data.customerName && data.customerId && /[\s\u0E00-\u0E7F]/.test(String(data.customerId)) ? String(data.customerId) : "";
          setQuotationNumber(data.documentNo || data.quotationNumber || data.quoteId || docSnap.id);
          setQuotationType(data.quotationType || "SALE");
          setDocDate(data.docDate || data.date || new Date().toISOString().split('T')[0]);
          setValidUntil(data.validUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
          setPaymentTerms(data.paymentTerms || "เครดิต 30 วัน");
          setReferenceNo(data.referenceNo || data.customerPoNo || "");

          setRevisionNumber(data.revisionNumber || 1);
          setParentQuotationId(data.parentQuotationId || null);
          setRevisionHistory(data.revisionHistory || []);
          setLinkedSo(data.linkedSo || "");
          setSupersededBy(data.supersededBy ? { id: data.supersededBy, no: data.supersededByNo || "" } : null);
          setAttachments(data.attachments || []);
          setCustomerSnapshot(data.customerSnapshot || null);
          setNextFollowUpDate(data.nextFollowUpDate || "");

          if (legacyCustomerName) {
            // ผูกกับลูกค้าจริงอัตโนมัติเมื่อโหลดรายชื่อลูกค้าเสร็จ (ดู effect ด้านล่าง)
            setSelectedCustomerId("");
            setCustomerSearchTerm(legacyCustomerName);
          } else if (normalizedStatus !== "DRAFT" && data.customerSnapshot) {
            const snap = data.customerSnapshot;
            setSelectedCustomerId(snap.customerId || data.customerId || "");
            setCustomerSearchTerm(snap.customerName || data.customerName || "");
            setCustomerTaxId(snap.customerTaxId || data.customerTaxId || "");
            setCustomerBranch(snap.customerBranch || data.customerBranch || "สำนักงานใหญ่");
            setContactPerson(snap.contactPerson || data.contactPerson || "");
            setContactPhone(snap.contactPhone || data.contactPhone || "");
            setContactEmail(snap.contactEmail || data.contactEmail || "");
            setAddrLine1(snap.addrLine1 || "");
            setAddrLine2(snap.addrLine2 || "");
            setSubDistrict(snap.subDistrict || "");
            setDistrict(snap.district || "");
            setProvince(snap.province || "");
            setPostalCode(snap.postalCode || "");
          } else {
            setSelectedCustomerId(data.customerId || "");
            setCustomerSearchTerm(data.customerName || "");
            setCustomerTaxId(data.customerTaxId || data.taxId || "");
            setCustomerBranch(data.customerBranch || "สำนักงานใหญ่");
            setContactPerson(data.contactPerson || "");
            setContactPhone(data.contactPhone || "");
            setContactEmail(data.contactEmail || "");
            if (data.addrLine1) {
              setAddrLine1(data.addrLine1 || "");
              setAddrLine2(data.addrLine2 || "");
              setSubDistrict(data.subDistrict || "");
              setDistrict(data.district || "");
              setProvince(data.province || "");
              setPostalCode(data.postalCode || "");
            } else if (data.customerAddress) {
              setAddrLine1(data.customerAddress);
            }
          }

          const legacyTax = String(data.taxMode || "").toUpperCase();
          setTaxType(data.taxType || (legacyTax === "INCLUSIVE" ? "INCLUSIVE" : legacyTax === "NON_VAT" || legacyTax === "NONE" ? "NON_VAT" : "EXCLUSIVE"));
          setWhtRate(data.whtRate || 0);
          setDocDiscountType(data.docDiscountType || 'PERCENT');
          setDocDiscountValue(data.docDiscountValue || 0);
          setTermsAndConditions(data.termsAndConditions || "");
          setRemark(data.remark || "");
          setProbability(data.probability || 50);
          setExpectedCloseDate(data.expectedCloseDate || "");
          setLeadSource(data.leadSource || "");
          setProjectName(data.projectName || data.subject || "");
          setIncoTerms(data.incoTerms || "");
          setExpectedDeliveryDays(data.expectedDeliveryDays || 30);
          setShippingAddress(data.shippingAddress || "");
          setInternalNotes(data.internalNotes || "");
          setStatus(normalizedStatus);
          if (data.salesPersonId) {
             setSelectedSalespersonId(data.salesPersonId);
          }

          // Fetch lines
          const linesRef = collection(db, `companies/${companyId}/quotations/${params.id}/lines`);
          const linesSnap = await getDocs(linesRef);
          const loadedItems = linesSnap.docs.map(d => {
            const lData = d.data();
            return {
              id: d.id,
              productId: lData.productId || null,
              sku: lData.sku || "",
              name: lData.productName || "",
              description: lData.description || "",
              details: lData.details || lData.technicalSpecs || "",
              qty: lData.qty || 1,
              unit: lData.uom || "ชิ้น",
              price: lData.unitPrice || 0,
              cost: lData.costPrice || 0,
              discount: lData.discountString || "",
              discountType: lData.discountType || 'PERCENT',
              discountValue: lData.discountValue || 0,
              isOptional: !!lData.isOptional,
              incomeAccountId: lData.glAccountId || "411100",
              whtRate: lData.whtRate
            };
          });
          loadedItems.sort((a: any, b: any) => (a.sequence || 0) - (b.sequence || 0));
          if (loadedItems.length === 0 && Array.isArray(data.items)) {
            // รูปแบบเก่า: รายการเก็บในเอกสารหลัก
            loadedItems.push(...data.items.map((it: any, idx: number) => ({
              id: it.id || `legacy-${idx}`,
              productId: it.productId || null,
              sku: it.sku || "",
              name: it.name || it.productName || "",
              description: it.description || "",
              details: it.details || "",
              qty: Number(it.qty ?? it.quantity) || 1,
              unit: it.unit || it.uom || "ชิ้น",
              price: Number(it.price ?? it.unitPrice) || 0,
              cost: Number(it.cost ?? it.costPrice) || 0,
              discount: "",
              discountType: 'PERCENT',
              discountValue: 0,
              isOptional: false,
              incomeAccountId: "411100",
              whtRate: undefined
            })));
          }
          setItems(loadedItems);
        }
      } catch (err) {
        console.error("Failed to load quotation:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadQuotation();
  }, [params.id, companyId]);

  // Calculation Engine
  const summary = useMemo(() => {
    const calcItems: LineItem[] = items.map(i => {
      let dAmt = 0;
      const p = Number(i.price) || 0;
      const q = Number(i.qty) || 0;
      if (i.discount) {
        const str = String(i.discount).trim();
        if (str.endsWith('%')) {
          const pct = parseFloat(str.replace('%','')) || 0;
          dAmt = p * (pct / 100);
        } else {
          dAmt = (parseFloat(str.replace(/,/g, '')) || 0) / (q > 0 ? q : 1);
        }
      }
      return {
        id: i.id,
        qty: q,
        costPrice: Number(i.cost) || 0,
        projectPrice: Math.max(0, p - dAmt),
        retailPrice: Math.max(0, p - dAmt),
        whtRate: i.whtRate !== undefined ? Number(i.whtRate) : undefined
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

  // PDF Document Preview Data (Patch 12)
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

  // แก้ไขบนใบเดิมได้เฉพาะก่อนส่งลูกค้า (ร่าง / รออนุมัติ / ตีกลับ)
  // ส่งลูกค้าแล้ว = ล็อก ต้องออกฉบับแก้ไข (Revision), ได้งาน/ถูกแทนที่ = อ่านอย่างเดียว
  const isLocked = !["DRAFT", "PENDING_APPROVAL", "REJECTED"].includes(status);
  const canRevise = ["SENT", "ACCEPTED"].includes(status) && !linkedSo;

  const saveInternalNotes = async () => {
    if (!companyId || !params.id) return;
    setSavingNotes(true);
    try {
      const res = await apiFetch(`/api/quotations/${encodeURIComponent(params.id)}/internal-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, internalNotes }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "บันทึกไม่สำเร็จ");
      setNotesDirty(false);
    } catch (err: any) {
      showAlert(err.message);
    } finally {
      setSavingNotes(false);
    }
  };

  // Handle Save with Multi-channel Audit Trail (Patch 11 & 12)
  const handleSave = async (isSubmit: boolean = false, sendChannel?: 'EMAIL' | 'LINE' | 'DOWNLOAD' | 'SYSTEM') => {
    if (isLocked) {
      showAlert(canRevise ? "ใบเสนอราคานี้ส่งลูกค้าแล้ว แก้ไขได้โดยสร้างฉบับแก้ไข (Revision)" : "ใบเสนอราคานี้แก้ไขไม่ได้แล้ว");
      return;
    }
    if (!selectedCustomerId && !customerSearchTerm.trim()) {
      showAlert("กรุณาระบุชื่อลูกค้า", "ข้อมูลไม่ครบ", "warning");
      return;
    }
    if (!customerTaxId || !/^\d{13}$/.test(customerTaxId.trim())) {
      showAlert("กรุณาระบุเลขประจำตัวผู้เสียภาษีให้ถูกต้องครบ 13 หลัก", "ข้อมูลไม่ครบ", "warning");
      return;
    }
    if (!companyId) {
      showAlert("ไม่พบรหัสบริษัท กรุณาเข้าสู่ระบบใหม่", "ข้อมูลไม่ครบ", "warning");
      return;
    }

    try {
      const isGpBelowThreshold = summary.profitMargin < minGpPercentForAutoSend;
      let finalCustomerId = selectedCustomerId;
      let finalCustomerName = getCustomerName(selectedCustomer);
      let newCustomer: { name: string; address: string; taxId: string } | null = null;

      if (!finalCustomerId && customerSearchTerm.trim()) {
        // ลูกค้าใหม่: เซิร์ฟเวอร์สร้างให้ในการบันทึกครั้งเดียวกัน
        newCustomer = {
          name: customerSearchTerm.trim(),
          address: [addrLine1, addrLine2, subDistrict, district, province, postalCode].filter(Boolean).join(" "),
          taxId: customerTaxId,
        };
        finalCustomerName = customerSearchTerm.trim();
      }

      const fullAddressStr = [addrLine1, addrLine2, subDistrict, district, province, postalCode].filter(Boolean).join(" ");
      const customerSnapshotPayload = customerSnapshot || {
        customerId: finalCustomerId,
        customerName: finalCustomerName,
        customerTaxId: customerTaxId,
        customerBranch,
        contactPerson,
        contactPhone,
        contactEmail,
        addrLine1,
        addrLine2,
        subDistrict,
        district,
        province,
        postalCode,
        fullAddress: fullAddressStr,
        updatedAt: new Date().toISOString()
      };


      const headerPayload = {
        companyId,
        isDeleted: false,
        documentNo: quotationNumber,
        quotationNumber,
        quotationType,
        revisionNumber: revisionNumber || 1,
        parentQuotationId: parentQuotationId || null,
        revisionHistory: revisionHistory || [],
        attachments: attachments || [],
        customerSnapshot: customerSnapshotPayload,
        nextFollowUpDate: nextFollowUpDate || "",
        docDate,
        validUntil,
        paymentTerms,
        referenceNo,
        customerPoNo: referenceNo,
        customerId: finalCustomerId,
        customerName: finalCustomerName,
        customerTaxId: customerTaxId,
        customerBranch,
        contactPerson,
        contactPhone,
        contactEmail,
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
        probability,
        expectedCloseDate,
        leadSource,
        projectName,
        incoTerms,
        expectedDeliveryDays,
        shippingAddress,
        internalNotes,
      };

      const linesPayload = items.map((item) => ({
        productId: item.id || "",
        sku: item.sku || "",
        productName: item.name || "",
        description: item.description || "",
        details: item.details || "",
        qty: Number(item.qty) || 0,
        uom: item.unit || "ชิ้น",
        costPrice: Number(item.cost) || 0,
        unitPrice: Number(item.price) || 0,
        discountString: item.discount || "",
        discountType: item.discountType || "PERCENT",
        discountValue: Number(item.discountValue) || 0,
        glAccountId: item.incomeAccountId || "411100",
        isOptional: !!item.isOptional,
      }));
      const productWritebacks = items
        .filter((item) => item.saveToProductMaster && item.productId)
        .map((item) => ({ productId: item.productId, technicalSpecs: item.details || "", datasheetUrl: item.datasheetUrl || "" }));

      // บันทึกผ่านเซิร์ฟเวอร์: ตรวจสถานะ (ส่งลูกค้าแล้วแก้ไม่ได้) และเกณฑ์ GP ซ้ำอีกครั้ง
      const res = await apiFetch(`/api/quotations/${encodeURIComponent(params.id)}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          submit: isSubmit,
          requiresApproval: isSubmit && (isGpBelowThreshold || showCreditWarning),
          sendChannel,
          header: headerPayload,
          lines: linesPayload,
          newCustomer,
          productWritebacks,
        }),
      });
      const saved = await res.json();
      if (!res.ok || !saved.success) throw new Error(saved.error || "บันทึกไม่สำเร็จ");
      setStatus(saved.status);
      if (saved.customerId && !selectedCustomerId) setSelectedCustomerId(saved.customerId);

      if (sendChannel === 'DOWNLOAD') {
        setShowPreviewModal(true);
      }

      showAlert(`บันทึกใบเสนอราคา ${quotationNumber} สำเร็จ\nสถานะ: ${QUOTATION_STATUS_LABELS[saved.status as keyof typeof QUOTATION_STATUS_LABELS] || saved.status}`);

      if (saved.status === "SENT") {
        router.push("/sales?tab=quotations");
      }
    } catch (error: any) {
      console.error("Error saving quotation:", error);
      showAlert(error?.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล", "เกิดข้อผิดพลาด", "error");
    }
  };

  const headerContent = (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-6 rounded-3xl backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <PillButton variant="glass" onClick={() => router.back()} className="w-10 h-10 p-0 flex items-center justify-center rounded-full">
          <ArrowLeft size={20} />
        </PillButton>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold uppercase tracking-tight text-white flex items-center gap-2">
              ใบเสนอราคา
            </h1>
            <span className="px-3 py-1 rounded-full bg-nexus-teal/10 border border-nexus-teal/30 text-nexus-teal text-sm font-mono font-bold select-none cursor-default pointer-events-none">
              {quotationNumber || "กำลังโหลด..."}
            </span>
            {revisionNumber > 1 && (
              <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[12px] font-bold">
                Rev. {revisionNumber}
              </span>
            )}
            {status === "SUPERSEDED" && (
              <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[12px] font-bold border border-rose-500/30">
                ถูกทดแทนด้วยฉบับใหม่
              </span>
            )}
            {status === "PENDING_APPROVAL" && (
              <span className="px-2.5 py-0.5 rounded-full bg-warning/20 text-warning text-[12px] font-bold border border-warning/30">
                รออนุมัติพิเศษ
              </span>
            )}
          </div>
          <p className="text-sm text-white/60 font-medium mt-1">จัดการรายละเอียดใบเสนอราคา ประวัติเวอร์ชัน และการขออนุมัติทางการค้า</p>
        </div>
      </div>
      <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
        <DocumentStepper steps={["ร่าง", "รออนุมัติ", "ส่งแล้ว", "ยอมรับแล้ว"]} currentStep={status === "DRAFT" ? 0 : status === "PENDING_APPROVAL" ? 1 : status === "SENT" ? 2 : 3} />

        {/* Live PDF Document Preview Button (Patch 12) */}
        <PillButton
          variant="glass"
          onClick={() => setShowPreviewModal(true)}
          className="h-8 px-4 text-xs font-bold text-nexus-teal border-nexus-teal/40 hover:bg-nexus-teal/10"
        >
          <FileText size={14} className="mr-1.5" /> ตัวอย่างเอกสาร
        </PillButton>

        {/* Manager/Admin Approval Gate Buttons */}
        {status === "PENDING_APPROVAL" && ['ADMIN', 'MANAGER', 'SUPERADMIN'].includes(role || '') && (
          <div className="flex items-center gap-2 border-r border-white/10 pr-2 mr-1">
            <PillButton variant="confirm" onClick={() => handleApprovalAction("SENT")} disabled={isApproving} className="h-8 px-4 text-xs font-bold text-emerald-400 border-emerald-500/40">
              <CheckCircle2 size={14} className="mr-1.5" /> อนุมัติเอกสาร
            </PillButton>
            <PillButton variant="glass" onClick={() => handleApprovalAction("REJECTED")} disabled={isApproving} className="h-8 px-4 text-xs font-bold text-rose-400 border-rose-500/40 hover:bg-rose-500/10">
              <XCircle size={14} className="mr-1.5" /> ปฏิเสธ (ส่งกลับแก้ไข)
            </PillButton>
          </div>
        )}

        {/* Revision Trigger */}
        {canRevise && (
          <PillButton
            variant="glass"
            onClick={() => { setRevisionChangeSummary(""); setShowRevisionModal(true); }}
            className="h-8 px-4 text-xs font-bold text-purple-300 border-purple-500/30 hover:bg-purple-500/10"
            title="สร้างฉบับแก้ไข (Revision) เพื่อปรับราคาหรือข้อเสนอโดยยังคงรักษาประวัติฉบับเดิมไว้"
          >
            <FileSpreadsheet size={14} className="mr-1.5" /> สร้างฉบับแก้ไข
          </PillButton>
        )}

        <PillButton variant="glass" className="h-8 px-4 text-xs font-bold text-white/50" onClick={() => router.back()}>
          ยกเลิก
        </PillButton>
        {!isLocked && (
          <>
            <PillButton variant="glass" className="h-8 px-4 text-xs font-bold text-white/80" onClick={() => handleSave(false)}>
              <Save size={14} className="mr-1.5" /> บันทึกฉบับร่าง
            </PillButton>
            <PillButton variant="confirm" className="h-8 px-5 font-bold text-xs" onClick={() => handleSave(true)}>
              <CheckCircle2 size={14} className="mr-1.5" /> ปรับปรุงใบเสนอราคา
            </PillButton>
          </>
        )}
      </div>
    </div>
  );

  const leftContent = (
    <div className="space-y-4 pr-2 pb-10">
      {isLocked && status !== "" && (
        <div className={cn("p-3 rounded-2xl text-[13px] border flex flex-wrap items-center justify-between gap-3",
          status === "SUPERSEDED" ? "bg-white/[0.04] border-white/15 text-white/70" : "bg-purple-500/10 border-purple-500/25 text-purple-200")}>
          <span>
            {status === "SUPERSEDED"
              ? <>ฉบับนี้ถูกแทนที่แล้ว (อ่านอย่างเดียว){supersededBy && <> · ฉบับล่าสุด <Link href={`/sales/quotations/${encodeURIComponent(supersededBy.id)}`} className="underline font-mono">{supersededBy.no || "เปิด"}</Link></>}</>
              : linkedSo
                ? <>ได้งานแล้ว (แปลงเป็นใบสั่งขาย {linkedSo}) อ่านอย่างเดียว · การเปลี่ยนแปลงให้ทำที่ใบสั่งขายหรือใบลดหนี้/เพิ่มหนี้</>
                : canRevise
                  ? <>ส่งลูกค้าแล้ว ข้อมูลถูกล็อกเพื่อให้ตรงกับเอกสารที่ลูกค้าได้รับ · ต้องการเปลี่ยนราคา รายการ หรือเงื่อนไข ให้สร้างฉบับแก้ไข</>
                  : <>เอกสารนี้แก้ไขไม่ได้แล้ว (อ่านอย่างเดียว)</>}
          </span>
          {canRevise && (
            <PillButton variant="glass" onClick={() => { setRevisionChangeSummary(""); setShowRevisionModal(true); }} className="h-8 px-4 text-xs font-bold text-purple-300 border-purple-500/30 hover:bg-purple-500/10">
              <FileSpreadsheet size={14} className="mr-1.5" /> สร้างฉบับแก้ไข
            </PillButton>
          )}
        </div>
      )}
      <fieldset disabled={isLocked} className="m-0 p-0 border-0 min-w-0 space-y-4">

      {/* Customer and Header Info */}
      {/* จอไม่กว้างพอ: ลูกค้าเต็มแถว แล้วรายละเอียดการขาย + ข้อมูลเอกสารคู่กันด้านล่าง; จอกว้าง (≥1700px) เรียงสามใบในแถวเดียว */}
      <div className="grid grid-cols-1 md:grid-cols-2 min-[1700px]:flex min-[1700px]:flex-row gap-4 items-stretch">

        {/* 1. Customer Info */}
        <div className="md:col-span-2 min-w-0 flex-1 bg-neutral-900/90 border border-white/15 rounded-3xl overflow-visible shadow-2xl p-4 space-y-4 border-l-4 border-l-nexus-teal hover:border-white/25 relative z-[30]">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <h3 className="text-base font-semibold uppercase tracking-widest text-white/80 flex items-center gap-2">
              <Building2 size={16} /> ข้อมูลลูกค้า *
            </h3>
            {selectedCustomer && (
              <span className="text-[12px] font-mono font-bold text-nexus-teal bg-nexus-teal/10 border border-nexus-teal/30 px-2.5 py-0.5 rounded-full">
                {selectedCustomer.customerCode || selectedCustomer.code || "CUST-EXISTING"}
              </span>
            )}
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[12px] font-bold text-white/70">ชื่อลูกค้า / นิติบุคคล <span className="text-danger">*</span></label>
              <div className="relative w-full">
                <SmartSelect
                  options={customerOptions}
                  value={selectedCustomerId || customerSearchTerm}
                  onChange={(val) => {
                    const found = customers.find(c => c.id === val);
                    if (found) {
                      setSelectedCustomerId(found.id);
                      setCustomerSearchTerm(getCustomerName(found));
                    } else {
                      setSelectedCustomerId("");
                      setCustomerSearchTerm(val);
                    }
                  }}
                  placeholder={customersLoading ? "กำลังโหลดข้อมูลลูกค้า..." : "ค้นหาหรือพิมพ์เลือกชื่อลูกค้าจากฐานข้อมูล..."}
                  allowCustom={true}
                  searchable={true}
                  className="w-full"
                />
              </div>
            </div>

            {/* Collapsible Customer Address Section (Patch 13) */}
            <div className="space-y-2 border-t border-white/5 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-[12px] font-bold text-white/70">ที่อยู่ออกใบกำกับภาษี / เปิดบิล</label>
                <button
                  type="button"
                  onClick={() => setIsEditingAddress(!isEditingAddress)}
                  className="text-[12px] text-nexus-teal hover:text-white font-bold flex items-center gap-1 bg-nexus-teal/10 hover:bg-nexus-teal/20 px-2.5 py-1 rounded-full border border-nexus-teal/30 transition-all cursor-pointer"
                >
                  <Edit3 size={12} />
                  <span>{isEditingAddress ? "ย่อที่อยู่" : "แก้ไขที่อยู่"}</span>
                </button>
              </div>

              {!isEditingAddress ? (
                <div
                  onClick={() => setIsEditingAddress(true)}
                  className="w-full h-8 px-4 rounded-full bg-black/20 hover:bg-white/[0.03] border border-white/10 flex items-center justify-between text-[13px] text-white/80 cursor-pointer transition-all truncate group"
                  title="คลิกเพื่อแก้ไขที่อยู่แบบละเอียด"
                >
                  <span className="truncate">
                    {[addrLine1, addrLine2, subDistrict, district, province, postalCode].filter(Boolean).join(" ") || (selectedCustomer?.address ? selectedCustomer.address : "ยังไม่ได้ระบุที่อยู่ (คลิกแก้ไขเพื่อกรอกข้อมูล)")}
                  </span>
                  <span className="text-[12px] text-nexus-teal opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">แก้ไข</span>
                </div>
              ) : (
                <div className="space-y-2 bg-black/30 p-3 rounded-2xl border border-white/10 transition-all">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={addrLine1}
                      onChange={(e) => setAddrLine1(e.target.value)}
                      placeholder="บ้านเลขที่ / อาคาร / ชั้น"
                      className="w-full h-8 bg-black/20 focus:bg-surface-0/90 focus:backdrop-blur-md border border-white/10 focus:border-nexus-teal/50 rounded-full px-4 py-0 text-[13px] font-bold text-white focus:text-nexus-teal focus:outline-none placeholder:text-white/70 transition-all"
                    />
                    <input
                      type="text"
                      value={addrLine2}
                      onChange={(e) => setAddrLine2(e.target.value)}
                      placeholder="ถนน / ซอย"
                      className="w-full h-8 bg-black/20 focus:bg-surface-0/90 focus:backdrop-blur-md border border-white/10 focus:border-nexus-teal/50 rounded-full px-4 py-0 text-[13px] font-bold text-white focus:text-nexus-teal focus:outline-none placeholder:text-white/70 transition-all"
                    />
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <input
                      type="text"
                      value={subDistrict}
                      onChange={(e) => setSubDistrict(e.target.value)}
                      placeholder="ตำบล / แขวง"
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
                <label className="text-[12px] font-bold text-white/70">ข้อมูลผู้ติดต่อ</label>
                <div className="grid grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="ชื่อผู้ติดต่อ"
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
                    <ChevronDown size={14} className="text-white/20" />
                  </div>
                }
              >
                <div className="max-h-[260px] overflow-y-auto custom-scrollbar p-1 space-y-1 bg-neutral-900 border border-white/15 rounded-2xl shadow-2xl">
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
                      <div className="relative w-full flex items-center">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nexus-teal/50" />
                        <input
                          type="text"
                          autoFocus
                          placeholder="ค้นหาพนักงานขาย..."
                          value={salespersonSearchTerm}
                          onChange={(e) => setSalespersonSearchTerm(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              setIsSalespersonSearchActive(false);
                            }
                          }}
                          className="w-full h-8 pl-9 pr-4 bg-black/20 focus:bg-surface-0/90 focus:backdrop-blur-md border border-nexus-teal/50 rounded-full text-[13px] font-bold text-nexus-teal focus:outline-none placeholder:text-white/30"
                        />
                      </div>
                    }
                  >
                    <div className="max-h-[260px] overflow-y-auto custom-scrollbar p-1.5 bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl">
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
                className="w-full h-8 bg-black/20 focus:bg-surface-0/90 focus:backdrop-blur-md border border-white/10 focus:border-nexus-teal/50 text-white focus:text-nexus-teal text-[13px]"
              />
            </div>
            <div className="space-y-1 col-span-3">
              <label className="text-[12px] font-semibold uppercase tracking-widest text-white/40">เวลาจัดส่ง (วัน)</label>
              <StepperInput
                value={expectedDeliveryDays}
                onChange={(val) => setExpectedDeliveryDays(val)}
                min={0}
                className="w-full h-8 bg-black/20 focus:bg-surface-0/90 focus:backdrop-blur-md border border-white/10 focus:border-nexus-teal/50 text-white focus:text-nexus-teal text-[13px]"
              />
            </div>
            <div className="space-y-1 col-span-6">
              <label className="text-[12px] font-semibold uppercase tracking-widest text-white/40">คาดว่าปิดจบ</label>
              <NexusDatePicker value={expectedCloseDate} onChange={(e) => setExpectedCloseDate(e.target.value)} className="w-full h-8 bg-black/20 focus:bg-surface-0/90 focus:backdrop-blur-md border border-white/10 focus:border-nexus-teal/50 rounded-full px-4 py-0 leading-relaxed text-[13px] font-bold text-white font-mono focus:text-nexus-teal focus:outline-none transition-all text-left" />
            </div>
            <div className="space-y-1 col-span-3">
              <label className="text-[12px] font-semibold uppercase tracking-widest text-white/40">ชื่อโครงการ</label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="เช่น โครงการระบบเครือข่าย สนง.ใหญ่"
                className="w-full h-8 bg-black/20 focus:bg-surface-0/90 focus:backdrop-blur-md border border-white/10 focus:border-nexus-teal/50 rounded-full px-4 py-0 leading-relaxed text-[13px] font-bold text-white focus:text-nexus-teal focus:outline-none placeholder:text-white/30 transition-all text-left"
              />
            </div>
            <div className="space-y-1 col-span-3">
              <label className="text-[12px] font-semibold uppercase tracking-widest text-white/40">แหล่งที่มา</label>
              <input
                type="text"
                value={leadSource}
                onChange={(e) => setLeadSource(e.target.value)}
                placeholder="เช่น Website, งานสัมมนา, ลูกค้าแนะนำ"
                className="w-full h-8 bg-black/20 focus:bg-surface-0/90 focus:backdrop-blur-md border border-white/10 focus:border-nexus-teal/50 rounded-full px-4 py-0 leading-relaxed text-[13px] font-bold text-white focus:text-nexus-teal focus:outline-none placeholder:text-white/30 transition-all text-left"
              />
            </div>
            <div className="space-y-1 col-span-6">
              <label className="text-[12px] font-semibold uppercase tracking-widest text-white/40">เงื่อนไขการส่งมอบ</label>
              <input
                type="text"
                value={incoTerms}
                onChange={(e) => setIncoTerms(e.target.value)}
                placeholder="เช่น FOB, EXW, ส่งมอบถึงสถานที่ติดตั้ง"
                className="w-full h-8 bg-black/20 focus:bg-surface-0/90 focus:backdrop-blur-md border border-white/10 focus:border-nexus-teal/50 rounded-full px-4 py-0 leading-relaxed text-[13px] font-bold text-white focus:text-nexus-teal focus:outline-none placeholder:text-white/30 transition-all text-left"
              />
            </div>
            <div className="space-y-1 col-span-6">
              <label className="text-[12px] font-semibold uppercase tracking-widest text-white/40">สถานที่จัดส่ง</label>
              <input
                type="text"
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                placeholder="ระบุสถานที่จัดส่ง หรือเว้นว่างเพื่อใช้ที่อยู่ตามบิล"
                className="w-full h-8 bg-black/20 focus:bg-surface-0/90 focus:backdrop-blur-md border border-white/10 focus:border-nexus-teal/50 rounded-full px-4 py-0 leading-relaxed text-[13px] font-bold text-white focus:text-nexus-teal focus:outline-none placeholder:text-white/30 transition-all"
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
                <label className="text-[12px] font-semibold uppercase tracking-widest text-white/40">วันที่ออก *</label>
                <NexusDatePicker value={docDate} onChange={(e) => setDocDate(e.target.value)} className="w-full h-8 rounded-full px-2 py-0 leading-relaxed bg-black/20 focus:bg-surface-0/90 focus:backdrop-blur-md border border-white/10 focus:border-nexus-teal/50 text-nexus-teal text-[13px] font-bold font-mono focus:outline-none text-center transition-all" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold uppercase tracking-widest text-white/40">ยืนราคาถึง *</label>
                <NexusDatePicker value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="w-full h-8 rounded-full px-2 py-0 leading-relaxed bg-black/20 focus:bg-surface-0/90 focus:backdrop-blur-md border border-white/10 focus:border-nexus-teal/50 text-nexus-teal text-[13px] font-bold font-mono focus:outline-none text-center transition-all" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold uppercase tracking-widest text-white/40">เงื่อนไขชำระ</label>
                <input
                  type="text"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  className="w-full h-8 bg-black/20 focus:bg-surface-0/90 focus:backdrop-blur-md border border-white/10 focus:border-nexus-teal/50 rounded-full px-2 py-0 leading-relaxed text-[13px] font-bold text-nexus-teal text-center focus:outline-none transition-all"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold uppercase tracking-widest text-white/40">เลขอ้างอิง</label>
                <input
                  type="text"
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  placeholder="PR-2026-001"
                  className="w-full h-8 bg-black/20 focus:bg-surface-0/90 focus:backdrop-blur-md border border-white/10 focus:border-nexus-teal/50 rounded-full px-2 py-0 leading-relaxed text-[13px] font-bold text-nexus-teal font-mono text-center focus:outline-none placeholder:text-white/30 transition-all"
                />
              </div>
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

          {items.length > 0 && canSeeCost && (
            <div className={cn("px-2.5 py-0.5 rounded-full border text-[12px] font-black uppercase tracking-widest flex items-center gap-1.5", rainbow.bg, rainbow.border, rainbow.text)}>
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

      {/* File Attachments Card */}
      <DocumentAttachmentsCard
        attachments={attachments}
        onChange={setAttachments}
        readOnly={status !== "DRAFT"}
      />

      {/* Revision History Panel */}
      {revisionHistory && revisionHistory.length > 0 && (
        <div className="bg-neutral-900/90 border border-white/15 rounded-3xl p-4 shadow-2xl space-y-4 border-l-4 border-l-purple-500">
          <h3 className="text-base font-semibold uppercase tracking-widest text-white/80 flex items-center gap-2 border-b border-white/10 pb-2">
            <History size={16} className="text-purple-400" /> ประวัติการแก้ไข (Revision History)
          </h3>
          <div className="space-y-2">
            {revisionHistory.map((rev: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/5 text-[12px]">
                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
                    Rev. {rev.revisionNumber}
                  </span>
                  {rev.quotationId && rev.quotationId !== params.id
                    ? <Link href={`/sales/quotations/${encodeURIComponent(rev.quotationId)}`} className="font-mono text-nexus-teal font-semibold hover:underline">{rev.documentNumber}</Link>
                    : <span className="font-mono text-white font-semibold">{rev.documentNumber}{rev.quotationId === params.id ? " (ฉบับนี้)" : ""}</span>}
                  <span className="text-white/50">{rev.changeSummary || "ไม่มีรายละเอียดบันทึกการแก้ไข"}</span>
                </div>
                <div className="text-right font-mono text-white/70">
                  {formatCurrency(rev.grandTotal)} THB
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* T&C, Remarks, and Internal Notes */}
      <div className={cn("grid grid-cols-1 gap-4", isLocked ? "md:grid-cols-2" : "md:grid-cols-3")}>
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
          <h3 className="text-base font-semibold uppercase tracking-widest text-white/80 flex items-center gap-2 border-b border-white/5 pb-2">
            หมายเหตุ
          </h3>
          <textarea
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="หมายเหตุเพิ่มเติมที่ต้องการแสดงบนเอกสาร..."
            className="w-full h-32 bg-black/20 focus:bg-surface-0/90 focus:backdrop-blur-md border border-white/10 focus:border-nexus-teal/50 rounded-xl p-3 text-[13px] text-white focus:text-nexus-teal focus:outline-none resize-none leading-relaxed placeholder:text-white/30 transition-all"
          />
        </div>
        {!isLocked && (
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
        )}
      </div>
      </fieldset>

      {/* ใบที่ล็อกแล้ว: หมายเหตุภายในยังแก้ได้ (ลูกค้าไม่เห็น) บันทึกแยกเฉพาะฟิลด์นี้ */}
      {isLocked && (
        <div className="bg-surface-1 border border-warning/20 rounded-3xl p-4 shadow-[0_0_15px_rgba(234,179,8,0.05)] space-y-4">
          <h3 className="text-base font-semibold uppercase tracking-widest text-warning flex items-center gap-2 border-b border-warning/20 pb-2">
            หมายเหตุภายใน (ไม่พิมพ์)
          </h3>
          <textarea
            value={internalNotes}
            onChange={(e) => { setInternalNotes(e.target.value); setNotesDirty(true); }}
            disabled={status === "SUPERSEDED"}
            placeholder="ระบุเหตุผลการให้ส่วนลด หรือข้อความสำหรับผู้อนุมัติ (ลูกค้าจะไม่เห็นข้อความนี้)..."
            className="w-full h-32 bg-black/40 border border-warning/10 rounded-xl p-3 text-[13px] text-warning/80 focus:outline-none focus:border-warning/50 resize-none leading-relaxed placeholder:text-warning/30"
          />
          {status !== "SUPERSEDED" && (
            <div className="flex items-center justify-end gap-3">
              {notesDirty && <span className="text-[12px] text-warning/70">ยังไม่ได้บันทึก</span>}
              <PillButton variant="glass" onClick={saveInternalNotes} disabled={!notesDirty || savingNotes} className="h-8 px-4 text-xs font-bold text-warning border-warning/30">
                <Save size={14} className="mr-1.5" /> {savingNotes ? "กำลังบันทึก..." : "บันทึกหมายเหตุภายใน"}
              </PillButton>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const rightSidebar = (
    <div className="space-y-4 h-fit pb-10">
      <fieldset disabled={isLocked} className="m-0 p-0 border-0 min-w-0 space-y-4">

      {/* Credit Limit Guardrail Warning */}
      {showCreditWarning && (
        <GlassCard className="p-4 border-danger/30 rounded-3xl bg-danger/10 shadow-[0_0_30px_rgba(239,68,68,0.15)] space-y-3 w-full">
          <div className="flex items-center gap-2 text-danger">
            <AlertTriangle size={18} />
            <span className="text-[12px] font-semibold uppercase tracking-widest">แจ้งเตือนวงเงินเครดิตเต็ม</span>
          </div>
          <p className="text-[12px] text-white/70 leading-relaxed">
            มูลค่าเอกสารรวมกับยอดค้างชำระปัจจุบัน เกินวงเงินเครดิตที่ตั้งไว้สำหรับลูกค้ารายนี้ (<span className="text-danger font-mono font-bold">{formatCurrency(selectedCustomer?.creditLimit || 0)}</span>) เอกสารฉบับนี้จะต้องเข้าสู่กระบวนการขออนุมัติพิเศษ
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
              className="text-[12px] text-nexus-teal hover:text-white font-bold bg-nexus-teal/10 hover:bg-nexus-teal/20 px-2.5 py-1 rounded-full border border-nexus-teal/30 transition-all cursor-pointer"
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

      </fieldset>
    </div>
  );

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-surface-0">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-nexus-teal border-t-transparent rounded-full animate-spin"></div>
          <p className="text-nexus-teal/50 font-mono text-[12px]">Loading Quotation Data...</p>
        </div>
      </div>
    );
  }

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

      {showRevisionModal && (
        <Modal isOpen={showRevisionModal} onClose={() => setShowRevisionModal(false)} title="สร้างฉบับแก้ไข (New Revision)">
          <div className="space-y-4 p-2">
            <p className="text-[13px] text-white/70">
              ระบบจะสร้างใบเสนอราคาฉบับแก้ไข (เลขที่ต่อท้าย -R{revisionNumber + 1}) เป็นฉบับร่างให้แก้ไขต่อ และเปลี่ยนฉบับปัจจุบันเป็น &ldquo;ถูกแทนที่&rdquo; (อ่านอย่างเดียว)
            </p>
            <div className="space-y-1">
              <label className="text-[12px] font-semibold text-white/60">สรุปการเปลี่ยนแปลง (บันทึกในประวัติฉบับแก้ไข) *</label>
              <textarea
                value={revisionChangeSummary}
                onChange={(e) => setRevisionChangeSummary(e.target.value)}
                placeholder="เช่น ปรับเปลี่ยนราคาตามข้อตกลงใหม่, เพิ่มรายการสินค้า..."
                className="w-full h-24 bg-black/40 border border-white/10 rounded-xl p-3 text-[13px] text-white focus:outline-none focus:border-nexus-teal resize-none"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <PillButton onClick={() => setShowRevisionModal(false)} className="h-8 px-5 rounded-full bg-white/5 text-white/60 border border-white/10 hover:bg-white/10">
                ยกเลิก
              </PillButton>
              <PillButton onClick={handleCreateRevisionSubmit} disabled={isCreatingRevision || !revisionChangeSummary.trim()} className="h-8 px-5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 hover:bg-purple-500/30">
                {isCreatingRevision ? "กำลังสร้าง..." : "ยืนยันสร้างฉบับแก้ไข"}
              </PillButton>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
