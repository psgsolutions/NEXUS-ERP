"use client";

import { useRouter, useSearchParams } from "next/navigation";
import React, { useState, useEffect, useMemo } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Check,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  Landmark,
  MapPin,
  Package,
  ShieldCheck,
  Store,
  Trash2,
  UserCheck,
  Users,
  Wrench,
} from "lucide-react";
import {
  PillButton,
  PillInput,
  PillSelect,
  cn,
  Toast,
  NexusTable,
  NexusTableRow,
  NexusTableCell,
  GlassCard,
  NexusPageLayout
} from "@/components/ui/Base";
import { SmartSelect } from "@/components/ui/SmartComponents";
import { NumberStepper } from "@/components/ui/NumberStepper";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase-client";
import { doc, getDoc, getDocs, collection } from "firebase/firestore";
import { can } from "@/lib/permissions";
import { DocumentItemsTable } from "@/components/commerce/DocumentItemsTable";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { ProjectTypeCode, PROJECT_TYPE_CONFIGS } from "@/types/database";
import { apiFetch } from "@/lib/api-client";
import { computeProjectBudget, linesToForm, normalizeItemLine, normalizeLaborLine } from "@/lib/project-budget";
import { APPROVAL_STEPS, EDITABLE_STATUSES, normalizeProjectStatus } from "@/lib/project-status";

const STEPS = [
  { title: "ข้อมูลโครงการและสัญญา", icon: Briefcase },
  { title: "รายการสินค้าและงานบริการ", icon: Package },
  { title: "ทีมงานและตรวจทาน", icon: ShieldCheck },
];

const PROJECT_TYPES: { code: ProjectTypeCode; label: string }[] = [
  { code: 1, label: "ซื้อขายส่งมอบ" },
  { code: 2, label: "ซ่อมบำรุงรักษา" },
  { code: 3, label: "บริการติดตั้ง" },
  { code: 4, label: "ซื้อขายพร้อมติดตั้ง" },
];

const GP_TARGET = 15; // เกณฑ์กำไรขั้นต้นขั้นต่ำ (%)

const baht = (n: number) => `฿${(Number(n) || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function NewProjectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, companyId, role } = useAuth();
  const currentCompanyId = companyId || "";
  const [step, setStep] = useState(0);

  const [toast, setToast] = useState({ message: "", isVisible: false, isError: false });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ลูกค้าของบริษัท (ที่เก็บหลัก + รุ่นเก่าที่ root ไม่นับซ้ำ)
  const { data: ownCustomers } = useRealtimeCollection<any>(currentCompanyId ? `companies/${currentCompanyId}/customers` : "");
  const { data: legacyCustomers } = useRealtimeCollection<any>("customers");
  const rawCustomers = useMemo(() => {
    const ids = new Set(ownCustomers.map((c: any) => c.id));
    return [...ownCustomers, ...legacyCustomers.filter((c: any) => !ids.has(c.id))];
  }, [ownCustomers, legacyCustomers]);

  // ผู้ใช้ของบริษัทที่ใช้งานอยู่ (เลือกเป็นผู้จัดการโครงการ/ทีมงาน)
  const { data: companyUsers } = useRealtimeCollection<any>("users");
  const userOptions = useMemo(
    () => companyUsers
      .filter((u: any) => !u.status || String(u.status).toUpperCase() === "ACTIVE")
      .map((u: any) => ({ uid: u.id, name: u.name || u.displayName || u.email || u.id, role: String(u.role || "").toUpperCase() }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name, "th")),
    [companyUsers]
  );

  // 1: ข้อมูลทั่วไปของโครงการ (General Info)
  const [projectId, setProjectId] = useState<string>("");
  const [projectName, setProjectName] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [projectTypeCode, setProjectTypeCode] = useState<ProjectTypeCode>(4);
  const [sectorType, setSectorType] = useState<"Government" | "Private">("Private");
  const [projectPriority, setProjectPriority] = useState("ปานกลาง");
  const [clientReference, setClientReference] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  });
  const [siteLocation, setSiteLocation] = useState("");
  const [siteContactName, setSiteContactName] = useState("");
  const [siteContactPhone, setSiteContactPhone] = useState("");

  // On-site Followers State & Handlers
  const [projectFollowers, setProjectFollowers] = useState<any[]>([
    { id: "FOL-1", name: "", role: "ผู้ประสานงานหน้างาน", phone: "", note: "" }
  ]);

  const handleAddFollower = () => {
    setProjectFollowers((prev) => [
      ...prev,
      { id: `FOL-${Date.now()}`, name: "", role: "ผู้ติดตามหน้างาน", phone: "", note: "" }
    ]);
  };

  const handleRemoveFollower = (id: string) => {
    setProjectFollowers((prev) => prev.filter((f) => f.id !== id));
  };

  const handleUpdateFollower = (id: string, field: string, value: string) => {
    setProjectFollowers((prev) =>
      prev.map((f) => (f.id === id ? { ...f, [field]: value } : f))
    );
  };

  // Sector Specific Inputs
  const [govTorDocNo, setGovTorDocNo] = useState("");
  const [govReferencePrice, setGovReferencePrice] = useState(0);
  const [govContractNo, setGovContractNo] = useState("");
  const [pvtCustomerPO, setPvtCustomerPO] = useState("");
  const [pvtPaymentTerms, setPvtPaymentTerms] = useState("มัดจำ 30%, ชำระงวดสุดท้าย 70% หลังส่งมอบ");

  // 2: พัสดุอุปกรณ์และงานบริการ (Items & Packages)
  const [documentItems, setDocumentItems] = useState<any[]>([]);
  const [projectLabors, setProjectLabors] = useState<any[]>([]);

  // 3: จัดทีมงานและทรัพยากร (Team & Resources)
  // ผู้จัดการโครงการและทีมงาน: เลือกจากผู้ใช้จริงของบริษัท (ค่าเริ่มต้น = ผู้สร้างโครงการ)
  const [projectManagerUid, setProjectManagerUid] = useState<string>(user?.uid || "");
  const [assignedTeam, setAssignedTeam] = useState<{ uid: string; name: string; role: string; allocation: number }[]>([]);
  const projectManagerName = userOptions.find((u: any) => u.uid === projectManagerUid)?.name || "";

  // เลขโครงการออกที่ server ครั้งเดียวตอนบันทึก (ไม่จองเลขตอนเปิดหน้า)

  // แก้ไขฉบับร่าง / โครงการที่ถูกตีกลับ (?edit=<id เอกสารโครงการ>)
  const editDocId = searchParams?.get("edit") || "";
  const [editLoaded, setEditLoaded] = useState(false);
  useEffect(() => {
    if (!editDocId || !currentCompanyId || editLoaded) return;
    (async () => {
      const snap = await getDoc(doc(db, `companies/${currentCompanyId}/projects`, editDocId));
      if (!snap.exists()) {
        showToast("ไม่พบโครงการที่ต้องการแก้ไข", true);
        return;
      }
      const d: any = snap.data();
      if (!EDITABLE_STATUSES.includes(normalizeProjectStatus(d.status))) {
        showToast("โครงการนี้แก้ไขไม่ได้แล้ว (ส่งอนุมัติหรือเริ่มดำเนินการแล้ว)", true);
        setTimeout(() => router.push(`/projects/${encodeURIComponent(editDocId)}`), 1200);
        return;
      }
      setProjectId(d.projectId || editDocId);
      setProjectName(d.projectName || d.title || "");
      setSelectedCustomerId(d.customerId || "");
      setClientReference(d.clientReference || "");
      if ([1, 2, 3, 4].includes(Number(d.projectTypeCode))) setProjectTypeCode(Number(d.projectTypeCode) as ProjectTypeCode);
      setSectorType(d.sectorType === "Government" ? "Government" : "Private");
      setProjectPriority(d.priority || "ปานกลาง");
      if (d.startDate) setStartDate(d.startDate);
      if (d.endDate) setEndDate(d.endDate);
      setSiteLocation(d.siteLocation || "");
      setSiteContactName(d.siteContact?.name || "");
      setSiteContactPhone(d.siteContact?.phone || "");
      setProjectFollowers((d.followers || []).map((f: any, i: number) => ({ id: `FOL-${i}`, ...f })));
      setGovTorDocNo(d.governmentDetails?.torDocNo || "");
      setGovReferencePrice(Number(d.governmentDetails?.referencePrice) || 0);
      setGovContractNo(d.governmentDetails?.govContractNo || "");
      setPvtCustomerPO(d.privateDetails?.customerPO || "");
      setPvtPaymentTerms(d.privateDetails?.paymentTerms || "");
      if (d.projectManagerUid) setProjectManagerUid(d.projectManagerUid);
      setAssignedTeam((d.resources || []).filter((m: any) => m.userId).map((m: any) => ({ uid: m.userId, name: m.name, role: m.role || "", allocation: Number(m.allocation) || 0 })));
      const form = linesToForm(d.items || []);
      setDocumentItems(form.items);
      setProjectLabors(form.labors);
      setEditLoaded(true);
    })().catch((e) => {
      console.error("load project for edit:", e);
      showToast("โหลดข้อมูลโครงการไม่สำเร็จ", true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editDocId, currentCompanyId]);

  // นำเข้าจากใบเสนอราคา (?fromQuotationId=) — รองรับทั้ง lines subcollection และรูปแบบเก่า (items array)
  useEffect(() => {
    const fromQuotationId = searchParams?.get("fromQuotationId");
    if (!fromQuotationId || !currentCompanyId) return;
    (async () => {
      try {
        const headerSnap = await getDoc(doc(db, `companies/${currentCompanyId}/quotations`, fromQuotationId));
        if (!headerSnap.exists()) {
          showToast("ไม่พบใบเสนอราคาที่ต้องการนำเข้า", true);
          return;
        }
        const data: any = headerSnap.data();
        const docNo = data.documentNo || data.quotationNumber || data.quoteId || headerSnap.id;
        setProjectName(data.projectName || data.subject || "");
        setClientReference(docNo);
        // รูปแบบเก่าเก็บชื่อลูกค้าไว้ใน customerId: จับคู่กับรายชื่อลูกค้าตามชื่อ
        const byId = rawCustomers.find((c: any) => c.id === data.customerId);
        const byName = rawCustomers.find((c: any) => (c.customerName || c.name) === (data.customerName || data.customerId));
        setSelectedCustomerId(byId?.id || byName?.id || "");

        const linesSnap = await getDocs(collection(db, `companies/${currentCompanyId}/quotations/${fromQuotationId}/lines`));
        const source: any[] = linesSnap.empty
          ? (Array.isArray(data.items) ? data.items : [])
          : linesSnap.docs.map((d) => d.data()).sort((a: any, b: any) => (a.sequence || 0) - (b.sequence || 0));
        const imported = source.map((l: any, i: number) => ({
          id: Date.now() + i,
          productId: l.productId || null,
          sku: l.sku || "",
          name: l.productName || l.name || "",
          details: l.details || l.description || "",
          qty: Number(l.qty ?? l.quantity) || 1,
          unit: l.uom || l.unit || "ชิ้น",
          price: Number(l.unitPrice ?? l.price) || 0,
          cost: Number(l.costPrice ?? l.cost) || 0,
          itemType: String(l.itemType || "PRODUCT").toUpperCase(),
          discountType: l.discountType === "AMOUNT" ? "AMOUNT" : "PERCENT",
          discountValue: Number(l.discountValue) || 0,
          whtRate: Number(l.whtRate) || 0,
        }));
        if (imported.length > 0) setDocumentItems(imported);
        showToast(`นำเข้าข้อมูลจากใบเสนอราคา ${docNo} แล้ว (${imported.length} รายการ)`, false);
      } catch (error) {
        console.error("Error importing quotation:", error);
        showToast("ไม่สามารถนำเข้าข้อมูลจากใบเสนอราคาได้", true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, currentCompanyId, rawCustomers.length > 0]);

  // Customer List Mapping (Strict: Zero mock fallback to prevent saving dirty data)
  const customerOptions = useMemo(() => {
    if (!rawCustomers || rawCustomers.length === 0) {
      return [];
    }
    return rawCustomers.map((c: any) => ({
      value: c.id,
      label: c.customerName || c.name || "ไม่ระบุชื่อลูกค้า",
      description: `เลข 13 หลัก: ${c.taxId || "-"} | สาขา: ${c.branchCode || "00000"}`
    }));
  }, [rawCustomers]);

  // งบประมาณ: สูตรเดียวกับที่ server ใช้บันทึก (lib/project-budget)
  const budgetSummary = useMemo(() => {
    const lines = [...documentItems.map(normalizeItemLine), ...projectLabors.map(normalizeLaborLine)];
    return computeProjectBudget(lines, { startDate, endDate });
  }, [documentItems, projectLabors, startDate, endDate]);

  const showToast = (message: string, isError = false) => {
    setToast({ message, isVisible: true, isError });
  };

  // Data Validation Rules (GEMINI.md Rule 1)
  const validateForm = (): boolean => {
    if (!projectName.trim() || projectName.trim().length < 3) {
      showToast("กรุณาระบุชื่อโครงการอย่างน้อย 3 ตัวอักษร", true);
      return false;
    }
    if (!selectedCustomerId) {
      showToast("กรุณาเลือกชื่อลูกค้าผู้ชำระเงินในโครงการ", true);
      return false;
    }
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      showToast("วันสิ้นสุดโครงการต้องไม่อยู่ก่อนวันที่เริ่มโครงการ", true);
      return false;
    }
    if (documentItems.length === 0 && projectLabors.length === 0) {
      showToast("กรุณาเลือกพัสดุอุปกรณ์หรือรายการงานบริการอย่างน้อย 1 รายการ", true);
      return false;
    }
    if (!projectManagerUid) {
      showToast("กรุณาเลือกผู้จัดการโครงการ", true);
      return false;
    }
    return true;
  };

  // Add Custom Labor / Service Item
  const handleAddCustomLabor = () => {
    setProjectLabors((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: "",
        type: "lump-sum",
        points: 1,
        materialCost: 0,
        laborCost: 0,
        cost: 0,
        price: 0
      }
    ]);
  };

  // บันทึกผ่าน server (ออกเลข ตรวจข้อมูล และคำนวณงบประมาณที่ server)
  const handleSaveProject = async (asDraft = false) => {
    if (asDraft) {
      if (!projectName.trim() || projectName.trim().length < 3) {
        showToast("กรุณาระบุชื่อโครงการอย่างน้อย 3 ตัวอักษร", true);
        return;
      }
      if (!selectedCustomerId) {
        showToast("กรุณาเลือกลูกค้าของโครงการ", true);
        return;
      }
    } else if (!validateForm()) {
      return;
    }

    if (!can(role, "projects:edit")) {
      showToast("บัญชีของคุณไม่มีสิทธิ์สร้างโครงการ", true);
      return;
    }
    if (!currentCompanyId) return;

    try {
      setIsSubmitting(true);
      const payload = {
        companyId: currentCompanyId,
        asDraft,
        projectName,
        selectedCustomerId,
        clientReference,
        projectTypeCode,
        sectorType,
        priority: projectPriority,
        startDate,
        endDate,
        siteLocation,
        siteContact: { name: siteContactName, phone: siteContactPhone },
        followers: projectFollowers,
        projectManager: projectManagerName,
        projectManagerUid,
        items: documentItems,
        labors: projectLabors,
        resources: assignedTeam.map((m) => ({ userId: m.uid, name: m.name, role: m.role, allocation: m.allocation })),
        governmentDetails: { torDocNo: govTorDocNo, referencePrice: govReferencePrice, govContractNo },
        privateDetails: { customerPO: pvtCustomerPO || clientReference, paymentTerms: pvtPaymentTerms },
      };

      const res = await apiFetch(editDocId ? "/api/projects/update" : "/api/projects/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editDocId ? { ...payload, projectDocId: editDocId } : payload)
      });
      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.error || "บันทึกโครงการไม่สำเร็จ");
      }

      setProjectId(resData.projectId);
      showToast(resData.message, false);
      const target = editDocId || resData.projectId;
      setTimeout(() => router.push(`/projects/${encodeURIComponent(target)}`), 1200);
    } catch (err: any) {
      console.error("Error saving project:", err);
      showToast(err.message || "บันทึกโครงการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", true);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------- ตรวจทีละขั้นก่อนไปขั้นถัดไป ----------
  const stepError = (i: number): string | null => {
    if (i === 0) {
      if (projectName.trim().length < 3) return "กรุณาระบุชื่อโครงการอย่างน้อย 3 ตัวอักษร";
      if (!selectedCustomerId) return "กรุณาเลือกลูกค้าของโครงการ";
      if (startDate && endDate && endDate < startDate) return "วันสิ้นสุดต้องไม่อยู่ก่อนวันที่เริ่ม";
    }
    if (i === 1 && budgetSummary.equipCount + budgetSummary.laborCount === 0) return "กรุณาเพิ่มรายการสินค้าหรืองานบริการอย่างน้อย 1 รายการ";
    if (i === 2 && !projectManagerUid) return "กรุณาเลือกผู้จัดการโครงการ";
    return null;
  };
  const goTo = (target: number) => {
    for (let i = 0; i < target; i++) {
      const err = stepError(i);
      if (err) {
        setStep(i);
        showToast(err, true);
        return;
      }
    }
    setStep(target);
  };

  const canCreate = can(role, "projects:edit");
  const gpLow = budgetSummary.totalRev > 0 && budgetSummary.gpPercent < GP_TARGET;
  const typeConfig = PROJECT_TYPE_CONFIGS[projectTypeCode];
  const customerName = customerOptions.find((c: any) => c.value === selectedCustomerId)?.label || "-";

  const label = (text: string, required = false) => (
    <label className="text-[12px] font-bold text-white/70 ml-1">
      {text}{required && <span className="text-danger ml-0.5">*</span>}
    </label>
  );

  // ---------- Header ----------
  const headerContent = (
    <div className="flex flex-col gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-5 rounded-3xl backdrop-blur-xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <PillButton variant="glass" onClick={() => router.back()} className="w-10 h-10 p-0 flex items-center justify-center shrink-0">
            <ArrowLeft size={20} />
          </PillButton>
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold text-white tracking-tight">{editDocId ? "แก้ไขโครงการ" : "สร้างโครงการใหม่"}</h1>
              <span className="px-3 py-1 rounded-full bg-nexus-teal/10 border border-nexus-teal/30 text-nexus-teal text-sm font-mono font-bold">
                {projectId || "ออกเลขเมื่อบันทึก"}
              </span>
            </div>
            <p className="text-sm text-white/60 mt-1">กรอกทีละขั้น บันทึกเป็นฉบับร่างได้ทุกเมื่อ แล้วส่งขออนุมัติในขั้นสุดท้าย</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <PillButton variant="glass" onClick={() => router.back()} className="h-9 px-4 text-xs font-bold text-white/60">ยกเลิก</PillButton>
          <PillButton variant="glass" onClick={() => handleSaveProject(true)} disabled={isSubmitting || !canCreate} className="h-9 px-4 text-xs font-bold">
            บันทึกฉบับร่าง
          </PillButton>
        </div>
      </div>

      {/* ขั้นตอน */}
      <div className="flex items-center gap-2 flex-wrap">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const done = i < step;
          const active = i === step;
          return (
            <React.Fragment key={s.title}>
              <button
                type="button"
                onClick={() => goTo(i)}
                className={cn(
                  "h-9 px-4 rounded-full border text-[13px] font-bold flex items-center gap-2 transition-all whitespace-nowrap",
                  active ? "bg-nexus-teal/15 border-nexus-teal/40 text-nexus-teal"
                    : done ? "bg-white/[0.04] border-nexus-teal/20 text-white/80"
                    : "bg-white/[0.02] border-white/10 text-white/40 hover:text-white"
                )}
              >
                <span className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-mono", active ? "bg-nexus-teal text-black" : done ? "bg-nexus-teal/30 text-nexus-teal" : "bg-white/10")}>
                  {done ? <Check size={12} /> : i + 1}
                </span>
                <Icon size={14} />
                {s.title}
              </button>
              {i < STEPS.length - 1 && <div className={cn("w-6 h-px", done ? "bg-nexus-teal/40" : "bg-white/15")} />}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );

  // ---------- ขั้นที่ 1: ข้อมูลโครงการและสัญญา ----------
  const segBtn = (activeOn: boolean) => cn(
    "h-9 px-4 rounded-full text-[13px] font-bold border transition-all flex items-center gap-1.5 whitespace-nowrap",
    activeOn ? "bg-nexus-teal/15 border-nexus-teal/40 text-nexus-teal" : "bg-white/[0.02] border-white/10 text-white/50 hover:text-white"
  );

  const stepGeneral = (
    <div className="space-y-4">
      <GlassCard className="p-5 space-y-4">
        <div className="flex flex-col 2xl:flex-row gap-3">
          <div className="space-y-1.5">
            {label("ประเภทลูกค้า")}
            <div className="flex gap-2 flex-wrap">
              <button type="button" onClick={() => setSectorType("Private")} className={segBtn(sectorType === "Private")}><Store size={14} /> เอกชน</button>
              <button type="button" onClick={() => setSectorType("Government")} className={segBtn(sectorType === "Government")}><Landmark size={14} /> ภาครัฐ</button>
            </div>
          </div>
          <div className="space-y-1.5 2xl:ml-4">
            {label("รูปแบบงาน")}
            <div className="flex gap-2 flex-wrap">
              {PROJECT_TYPES.map((t) => (
                <button key={t.code} type="button" onClick={() => setProjectTypeCode(t.code)} className={segBtn(projectTypeCode === t.code)}>{t.label}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
          <div className="space-y-1 md:col-span-2">
            {label("ชื่อโครงการ", true)}
            <PillInput value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="เช่น ติดตั้งระบบกล้องวงจรปิดและเครือข่าย อาคาร B" className="w-full h-9 text-sm font-bold" />
          </div>
          <div className="space-y-1 md:col-span-2">
            {label("ลูกค้า", true)}
            <SmartSelect
              options={customerOptions}
              value={selectedCustomerId}
              onChange={(val) => setSelectedCustomerId(val)}
              placeholder="พิมพ์ค้นหาหรือเลือกลูกค้า..."
              addNewLabel="เพิ่มลูกค้าใหม่"
              onAddNew={() => router.push("/customers/new")}
            />
          </div>
          <div className="space-y-1">
            {label("เอกสารอ้างอิงลูกค้า")}
            <PillInput value={clientReference} onChange={(e) => setClientReference(e.target.value)} placeholder="เลขที่ใบเสนอราคา / เลขอ้างอิง" className="w-full h-9 text-sm" />
          </div>
          <div className="space-y-1">
            {label("ลำดับความสำคัญ")}
            <PillSelect value={projectPriority} onChange={(e) => setProjectPriority(e.target.value)} className="w-full h-9 text-sm">
              <option value="ทั่วไป">ทั่วไป</option>
              <option value="ปานกลาง">ปานกลาง</option>
              <option value="เร่งด่วน">เร่งด่วน</option>
              <option value="วิกฤต">วิกฤต</option>
            </PillSelect>
          </div>
          <div className="space-y-1">
            {label("วันที่เริ่ม", true)}
            <PillInput type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full h-9 text-sm font-mono" />
          </div>
          <div className="space-y-1">
            {label("วันที่ส่งมอบ", true)}
            <PillInput type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full h-9 text-sm font-mono" />
          </div>
        </div>
      </GlassCard>

      <GlassCard className="p-5 space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2"><FileText size={16} className="text-nexus-teal" /> {sectorType === "Government" ? "ข้อมูลสัญญาภาครัฐ" : "เงื่อนไขการว่าจ้าง"}</h3>
        {sectorType === "Government" ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">{label("เลขที่เอกสาร TOR")}<PillInput value={govTorDocNo} onChange={(e) => setGovTorDocNo(e.target.value)} placeholder="เช่น TOR-2569-015" className="w-full h-9 text-sm" /></div>
            <div className="space-y-1">{label("ราคากลาง (บาท)")}<PillInput type="number" value={govReferencePrice || ""} onChange={(e) => setGovReferencePrice(Number(e.target.value) || 0)} placeholder="0.00" className="w-full h-9 text-sm font-mono text-right" /></div>
            <div className="space-y-1">{label("เลขที่สัญญา")}<PillInput value={govContractNo} onChange={(e) => setGovContractNo(e.target.value)} placeholder="ระบุเมื่อลงนามสัญญาแล้ว" className="w-full h-9 text-sm" /></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">{label("เลขที่ใบสั่งซื้อของลูกค้า (PO)")}<PillInput value={pvtCustomerPO} onChange={(e) => setPvtCustomerPO(e.target.value)} placeholder="เช่น PO-2026-9912" className="w-full h-9 text-sm" /></div>
            <div className="space-y-1 md:col-span-2">{label("เงื่อนไขการชำระเงิน / งวดงาน")}<PillInput value={pvtPaymentTerms} onChange={(e) => setPvtPaymentTerms(e.target.value)} placeholder="เช่น มัดจำ 30% ชำระงวดสุดท้าย 70% หลังส่งมอบ" className="w-full h-9 text-sm" /></div>
          </div>
        )}
      </GlassCard>

      <GlassCard className="p-5 space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2"><MapPin size={16} className="text-nexus-blue" /> สถานที่และผู้ติดต่อหน้างาน</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1 md:col-span-2">{label("สถานที่ติดตั้ง")}<PillInput value={siteLocation} onChange={(e) => setSiteLocation(e.target.value)} placeholder="อาคาร / ชั้น / ที่อยู่ หรือลิงก์แผนที่" className="w-full h-9 text-sm" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">{label("ผู้ติดต่อ")}<PillInput value={siteContactName} onChange={(e) => setSiteContactName(e.target.value)} placeholder="ชื่อ" className="w-full h-9 text-sm" /></div>
            <div className="space-y-1">{label("เบอร์โทร")}<PillInput value={siteContactPhone} onChange={(e) => setSiteContactPhone(e.target.value)} placeholder="08x-xxx-xxxx" className="w-full h-9 text-sm font-mono" /></div>
          </div>
        </div>

        <div className="pt-3 border-t border-white/10 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-bold text-white flex items-center gap-1.5"><UserCheck size={14} className="text-nexus-teal" /> ผู้ติดตาม / ผู้ประสานงานหน้างาน ({projectFollowers.length} คน)</span>
            <PillButton variant="glass" onClick={handleAddFollower} className="h-9 px-4 text-xs font-bold text-nexus-teal border-nexus-teal/30">+ เพิ่มผู้ติดตาม</PillButton>
          </div>
          {projectFollowers.map((fol) => (
            <div key={fol.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <PillInput value={fol.name} onChange={(e) => handleUpdateFollower(fol.id, "name", e.target.value)} placeholder="ชื่อ-นามสกุล" className="sm:col-span-3 w-full h-9 text-sm" />
              <PillInput value={fol.role} onChange={(e) => handleUpdateFollower(fol.id, "role", e.target.value)} placeholder="ตำแหน่ง / บทบาท" className="sm:col-span-3 w-full h-9 text-sm" />
              <PillInput value={fol.phone} onChange={(e) => handleUpdateFollower(fol.id, "phone", e.target.value)} placeholder="เบอร์โทร" className="sm:col-span-2 w-full h-9 text-sm font-mono" />
              <PillInput value={fol.note || ""} onChange={(e) => handleUpdateFollower(fol.id, "note", e.target.value)} placeholder="หมายเหตุ" className="sm:col-span-3 w-full h-9 text-sm" />
              <button type="button" onClick={() => handleRemoveFollower(fol.id)} className="sm:col-span-1 justify-self-end p-1 text-white/40 hover:text-danger" title="ลบรายชื่อ"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );

  // ---------- ขั้นที่ 2: รายการ ----------
  const updateLabor = (id: any, patch: any) => setProjectLabors((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  const stepItems = (
    <div className="space-y-4">
      <GlassCard className="p-5 space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2"><FileSpreadsheet size={16} className="text-nexus-teal" /> สินค้าและพัสดุ ({documentItems.length} รายการ)</h3>
        <DocumentItemsTable items={documentItems} onChange={(newItems) => setDocumentItems(newItems)} isLocked={false} taxType="EXCLUSIVE" />
      </GlassCard>

      <GlassCard className="p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2"><Wrench size={16} className="text-nexus-blue" /> งานบริการและค่าแรงติดตั้ง ({projectLabors.length} รายการ)</h3>
          <PillButton variant="glass" onClick={handleAddCustomLabor} className="h-9 px-4 text-xs font-bold text-nexus-blue border-nexus-blue/30">+ เพิ่มงานบริการ</PillButton>
        </div>
        {projectLabors.length === 0 && (
          <div className="p-4 border border-dashed border-white/10 rounded-2xl text-center text-white/40 text-xs">ยังไม่มีงานบริการ</div>
        )}
        {projectLabors.map((lab) => {
          const perPoint = lab.type === "per-point";
          return (
            <div key={lab.id} className="p-3 bg-white/[0.02] border border-white/10 rounded-2xl space-y-3">
              <div className="flex items-center gap-2">
                <PillInput value={lab.name} onChange={(e) => updateLabor(lab.id, { name: e.target.value })} placeholder="ชื่องานบริการ" className="w-full h-9 text-sm font-bold" />
                <button type="button" onClick={() => updateLabor(lab.id, { type: "lump-sum" })} className={segBtn(!perPoint)}>เหมาจ่าย</button>
                <button type="button" onClick={() => updateLabor(lab.id, { type: "per-point" })} className={segBtn(perPoint)}>คิดต่อจุด</button>
                <button type="button" onClick={() => setProjectLabors((prev) => prev.filter((item) => item.id !== lab.id))} className="p-1 text-white/40 hover:text-danger shrink-0" title="ลบรายการ"><Trash2 size={16} /></button>
              </div>
              {perPoint ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>{label("จำนวนจุด")}<NumberStepper value={lab.points || 1} onChange={(v) => updateLabor(lab.id, { points: Math.max(1, v) })} step={1} /></div>
                  <div>{label("ค่าวัสดุต่อจุด")}<NumberStepper value={lab.materialCost || 0} onChange={(v) => updateLabor(lab.id, { materialCost: v })} step={50} /></div>
                  <div>{label("ค่าแรงต่อจุด")}<NumberStepper value={lab.laborCost || 0} onChange={(v) => updateLabor(lab.id, { laborCost: v })} step={50} /></div>
                  <div>{label("ราคาขายต่อจุด")}<NumberStepper value={lab.price || 0} onChange={(v) => updateLabor(lab.id, { price: v })} step={50} /></div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>{label("ต้นทุนบริการ (บาท)")}<NumberStepper value={lab.cost || 0} onChange={(v) => updateLabor(lab.id, { cost: v })} step={500} /></div>
                  <div>{label("ราคาขาย (บาท)")}<NumberStepper value={lab.price || 0} onChange={(v) => updateLabor(lab.id, { price: v })} step={500} /></div>
                </div>
              )}
            </div>
          );
        })}
      </GlassCard>
    </div>
  );

  // ---------- ขั้นที่ 3: ทีมงานและตรวจทาน ----------
  const reviewRow = (k: string, v: React.ReactNode) => (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-white/5 last:border-0">
      <span className="text-[13px] text-white/50 shrink-0">{k}</span>
      <span className="text-[13px] text-white text-right break-words min-w-0">{v || "-"}</span>
    </div>
  );

  const stepReview = (
    <div className="space-y-4">
      <GlassCard className="p-5 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2"><Users size={16} className="text-nexus-blue" /> ผู้จัดการโครงการและทีมงาน</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            {label("ผู้จัดการโครงการ", true)}
            <PillSelect value={projectManagerUid} onChange={(e) => setProjectManagerUid(e.target.value)} className="w-full h-9 text-sm font-bold">
              <option value="">-- เลือกผู้จัดการโครงการ --</option>
              {userOptions.map((u: any) => <option key={u.uid} value={u.uid}>{u.name}</option>)}
            </PillSelect>
          </div>
          <div className="space-y-1">
            {label("เพิ่มทีมงาน")}
            <PillSelect
              value=""
              onChange={(e) => {
                const u = userOptions.find((x: any) => x.uid === e.target.value);
                if (u && !assignedTeam.some((m) => m.uid === u.uid)) {
                  setAssignedTeam((prev) => [...prev, { uid: u.uid, name: u.name, role: u.role === "TECHNICIAN" ? "ช่างเทคนิค" : "ทีมงานโครงการ", allocation: 100 }]);
                }
              }}
              className="w-full h-9 text-sm"
            >
              <option value="">-- เลือกผู้ใช้เพื่อเพิ่มเข้าทีม --</option>
              {userOptions.filter((u: any) => !assignedTeam.some((m) => m.uid === u.uid)).map((u: any) => <option key={u.uid} value={u.uid}>{u.name}</option>)}
            </PillSelect>
          </div>
        </div>
        {assignedTeam.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {assignedTeam.map((member) => (
              <div key={member.uid} className="p-3 bg-white/[0.03] border border-white/10 rounded-2xl space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-white truncate" title={member.name}>{member.name}</span>
                  <button type="button" onClick={() => setAssignedTeam((prev) => prev.filter((m) => m.uid !== member.uid))} className="text-white/30 hover:text-danger p-1 shrink-0" title="นำออกจากทีม"><Trash2 size={16} /></button>
                </div>
                <div className="grid grid-cols-[1fr_110px] gap-2">
                  <PillInput value={member.role} onChange={(e) => setAssignedTeam((prev) => prev.map((m) => (m.uid === member.uid ? { ...m, role: e.target.value } : m)))} placeholder="หน้าที่ในโครงการ" className="h-9 text-sm" />
                  <div className="relative">
                    <PillInput type="number" value={member.allocation} onChange={(e) => setAssignedTeam((prev) => prev.map((m) => (m.uid === member.uid ? { ...m, allocation: Math.min(100, Math.max(0, Number(e.target.value) || 0)) } : m)))} className="h-9 text-sm font-mono text-right pr-8" title="สัดส่วนเวลาที่ทำงานให้โครงการ" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/40">%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {gpLow && (
        <div className={cn("p-4 rounded-2xl border flex items-start gap-3", budgetSummary.gpPercent < 0 ? "bg-danger/10 border-danger/30" : "bg-warning/10 border-warning/30")}>
          <AlertCircle size={18} className={cn("shrink-0 mt-0.5", budgetSummary.gpPercent < 0 ? "text-danger" : "text-warning")} />
          <div className="text-[13px]">
            <p className={cn("font-bold", budgetSummary.gpPercent < 0 ? "text-danger" : "text-warning")}>
              {budgetSummary.gpPercent < 0 ? `กำไรขั้นต้นติดลบ (${budgetSummary.gpPercent}%)` : `กำไรขั้นต้นต่ำกว่าเกณฑ์ ${GP_TARGET}% (${budgetSummary.gpPercent}%)`}
            </p>
            <p className="text-white/60">ส่งขออนุมัติได้ แต่ฝ่ายการเงินจะพิจารณาเป็นกรณีพิเศษ ตรวจสอบราคาขาย ส่วนลด และต้นทุนอีกครั้ง</p>
          </div>
        </div>
      )}

      <GlassCard className="p-5">
        <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2"><Briefcase size={16} className="text-nexus-teal" /> ตรวจทานข้อมูล</h3>
        {reviewRow("ชื่อโครงการ", projectName)}
        {reviewRow("ลูกค้า", customerName)}
        {reviewRow("รูปแบบงาน", `${typeConfig?.nameTh || "-"} · ${sectorType === "Government" ? "ภาครัฐ" : "เอกชน"}`)}
        {reviewRow("ระยะเวลา", `${startDate} ถึง ${endDate} (${budgetSummary.durationDays} วัน)`)}
        {sectorType === "Government"
          ? reviewRow("สัญญา", [govTorDocNo && `TOR ${govTorDocNo}`, govReferencePrice ? `ราคากลาง ${baht(govReferencePrice)}` : "", govContractNo && `สัญญา ${govContractNo}`].filter(Boolean).join(" · "))
          : reviewRow("เงื่อนไข", [pvtCustomerPO && `PO ${pvtCustomerPO}`, pvtPaymentTerms].filter(Boolean).join(" · "))}
        {reviewRow("ผู้จัดการโครงการ", projectManagerName)}
        {reviewRow("ทีมงาน", assignedTeam.length ? assignedTeam.map((m) => m.name).join(", ") : "-")}
      </GlassCard>

      <GlassCard className="p-0 overflow-hidden">
        <NexusTable headers={["หมวด", "ต้นทุน", "ราคาขาย", "กำไร"]}>
          <NexusTableRow>
            <NexusTableCell>สินค้าและพัสดุ ({budgetSummary.equipCount} รายการ)</NexusTableCell>
            <NexusTableCell mono>{baht(budgetSummary.equipCost)}</NexusTableCell>
            <NexusTableCell mono>{baht(budgetSummary.equipRev)}</NexusTableCell>
            <NexusTableCell mono>{baht(budgetSummary.equipRev - budgetSummary.equipCost)}</NexusTableCell>
          </NexusTableRow>
          <NexusTableRow>
            <NexusTableCell>งานบริการและค่าแรง ({budgetSummary.laborCount} รายการ)</NexusTableCell>
            <NexusTableCell mono>{baht(budgetSummary.laborCost)}</NexusTableCell>
            <NexusTableCell mono>{baht(budgetSummary.laborRev)}</NexusTableCell>
            <NexusTableCell mono>{baht(budgetSummary.laborRev - budgetSummary.laborCost)}</NexusTableCell>
          </NexusTableRow>
          <NexusTableRow>
            <NexusTableCell>สำรองความเสี่ยง ({Math.round(budgetSummary.contingencyRate * 100)}% ของต้นทุน)</NexusTableCell>
            <NexusTableCell mono>{baht(budgetSummary.contingencyBuffer)}</NexusTableCell>
            <NexusTableCell>-</NexusTableCell>
            <NexusTableCell mono>{baht(-budgetSummary.contingencyBuffer)}</NexusTableCell>
          </NexusTableRow>
          <NexusTableRow className="bg-nexus-teal/5">
            <NexusTableCell className="font-bold text-white">รวม (กำไรสุทธิหลังสำรอง)</NexusTableCell>
            <NexusTableCell mono>{baht(budgetSummary.grandTotalCost)}</NexusTableCell>
            <NexusTableCell mono>{baht(budgetSummary.totalRev)}</NexusTableCell>
            <NexusTableCell mono>{baht(budgetSummary.netProfit)} ({budgetSummary.netProfitPercent}%)</NexusTableCell>
          </NexusTableRow>
        </NexusTable>
      </GlassCard>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <GlassCard className="p-5 space-y-2">
          <h3 className="text-sm font-bold text-white flex items-center gap-2"><ClipboardList size={16} className="text-nexus-teal" /> เอกสารบังคับ ({typeConfig?.requiredDocuments.length || 0} รายการ)</h3>
          {typeConfig?.requiredDocuments.map((d) => (
            <div key={d.docCode} className="flex items-center justify-between gap-3 py-1.5 border-b border-white/5 last:border-0">
              <span className="text-[13px] text-white/80">{d.docName}</span>
              <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap", d.isMandatory ? "text-warning border-warning/30 bg-warning/10" : "text-white/40 border-white/10")}>{d.isMandatory ? "บังคับ" : "ไม่บังคับ"}</span>
            </div>
          ))}
        </GlassCard>
        <GlassCard className="p-5 space-y-2">
          <h3 className="text-sm font-bold text-white flex items-center gap-2"><ShieldCheck size={16} className="text-nexus-teal" /> ขั้นตอนอนุมัติหลังส่ง</h3>
          {APPROVAL_STEPS.map((s) => (
            <div key={s.stepOrder} className="flex items-start gap-3 py-1.5 border-b border-white/5 last:border-0">
              <span className="w-6 h-6 rounded-full bg-white/10 text-white/70 text-[12px] font-mono flex items-center justify-center shrink-0">{s.stepOrder}</span>
              <div>
                <p className="text-[13px] font-bold text-white">{s.title}</p>
                <p className="text-[12px] text-white/50">{s.description}</p>
              </div>
            </div>
          ))}
        </GlassCard>
      </div>
    </div>
  );

  // ---------- เนื้อหา + ปุ่มเลื่อนขั้น ----------
  const leftContent = (
    <div className="space-y-4 pb-10">
      {step === 0 && stepGeneral}
      {step === 1 && stepItems}
      {step === 2 && stepReview}

      <div className="flex items-center justify-between gap-3 pt-2">
        <PillButton variant="glass" disabled={step === 0} onClick={() => setStep(step - 1)} className="h-9 px-5 text-xs font-bold">
          <ArrowLeft size={14} className="mr-1.5" /> ย้อนกลับ
        </PillButton>
        {step < STEPS.length - 1 ? (
          <PillButton variant="confirm" onClick={() => goTo(step + 1)} className="h-9 px-5 text-xs font-bold">
            ถัดไป: {STEPS[step + 1].title} <ArrowRight size={14} className="ml-1.5" />
          </PillButton>
        ) : (
          <div className="flex items-center gap-2">
            <PillButton variant="glass" onClick={() => handleSaveProject(true)} disabled={isSubmitting || !canCreate} className="h-9 px-5 text-xs font-bold">
              บันทึกฉบับร่าง
            </PillButton>
            <PillButton
              variant="confirm"
              onClick={() => handleSaveProject(false)}
              disabled={isSubmitting || !canCreate}
              title={!canCreate ? "บัญชีของคุณไม่มีสิทธิ์สร้างโครงการ" : undefined}
              className="h-9 px-5 text-xs font-bold"
            >
              {isSubmitting ? "กำลังบันทึก..." : "ส่งขออนุมัติเปิดโครงการ"}
            </PillButton>
          </div>
        )}
      </div>
    </div>
  );

  // ---------- แผงสรุป (ตัวเลขที่ใช้ตัดสินใจ) ----------
  const sideRow = (k: string, v: string, cls = "text-white") => (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-white/5 last:border-0">
      <span className="text-[13px] text-white/60">{k}</span>
      <span className={cn("text-[14px] font-mono font-bold text-right", cls)}>{v}</span>
    </div>
  );

  const rightSidebar = (
    <div className="p-4 space-y-4">
      <GlassCard className="p-4">
        <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2"><Briefcase size={16} className="text-nexus-teal" /> สรุปโครงการ</h4>
        {sideRow("ราคาขายก่อนภาษี", baht(budgetSummary.totalRev), "text-nexus-teal")}
        {sideRow("ต้นทุนรวม", baht(budgetSummary.totalCost))}
        {sideRow("กำไรขั้นต้น", `${baht(budgetSummary.grossProfit)} (${budgetSummary.gpPercent}%)`, budgetSummary.gpPercent < 0 ? "text-danger" : gpLow ? "text-warning" : "text-white")}
        {sideRow(`สำรองความเสี่ยง (${Math.round(budgetSummary.contingencyRate * 100)}%)`, baht(budgetSummary.contingencyBuffer))}
        {sideRow("มูลค่ารวมภาษี", baht(budgetSummary.grandTotalWithVat))}
        {sideRow("ระยะเวลา", `${budgetSummary.durationDays} วัน`)}
      </GlassCard>

      <GlassCard className="p-4 space-y-2">
        <h4 className="text-sm font-bold text-white mb-1">ความครบถ้วน</h4>
        {STEPS.map((s, i) => {
          const err = stepError(i);
          return (
            <button key={s.title} type="button" onClick={() => goTo(i)} className="w-full flex items-start gap-2 text-left py-1">
              <span className={cn("w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5", err ? "bg-white/10 text-white/40" : "bg-nexus-teal/20 text-nexus-teal")}>
                {err ? <span className="text-[11px] font-mono">{i + 1}</span> : <Check size={12} />}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] text-white/80">{s.title}</span>
                {err && <span className="block text-[12px] text-white/40">{err}</span>}
              </span>
            </button>
          );
        })}
      </GlassCard>

      {toast.isVisible && (
        <Toast isVisible={toast.isVisible} message={toast.message} onClose={() => setToast((prev) => ({ ...prev, isVisible: false }))} />
      )}
    </div>
  );

  return <NexusPageLayout header={headerContent} leftContent={leftContent} rightSidebar={rightSidebar} />;
}
