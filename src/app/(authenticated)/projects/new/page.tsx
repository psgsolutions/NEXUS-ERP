"use client";

import { useRouter, useSearchParams } from "next/navigation";
import React, { useState, useEffect, useMemo } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Briefcase,
  CalendarRange,
  Check,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  Landmark,
  MapPin,
  Receipt,
  ShieldCheck,
  Sparkles,
  Store,
  Target,
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
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase-client";
import { doc, getDoc, getDocs, collection } from "firebase/firestore";
import { can } from "@/lib/permissions";
import { DocumentItemsTable } from "@/components/commerce/DocumentItemsTable";
import { DocSectionsEditor, ExpensesEditor, NumCell, TimelineEditor } from "@/components/projects/ProjectPlanEditors";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { ProjectTypeCode, PROJECT_TYPE_CONFIGS } from "@/types/database";
import { apiFetch } from "@/lib/api-client";
import { computeProjectBudget, linesToForm, normalizeItemLine, normalizeLaborLine } from "@/lib/project-budget";
import { APPROVAL_STEPS, EDITABLE_STATUSES, normalizeProjectStatus } from "@/lib/project-status";
import {
  BUDGET_SOURCES, PROCUREMENT_METHODS, PROJECT_STAGES,
  defaultExpenses, defaultTimeline, fiscalYearOf, generateAllSections, inferProjectType, legalReferences,
  normalizeStage, priceForMargin, timelineError,
  type DocSectionKey, type ProjectExpense, type ProjectStage, type Sector, type TimelinePhase,
} from "@/lib/project-templates";

const STEPS = [
  { title: "ข้อมูลโครงการ", icon: Briefcase },
  { title: "รายการและต้นทุน", icon: FileSpreadsheet },
  { title: "แผนงานและงวดงาน", icon: CalendarRange },
  { title: "รายละเอียดโครงการ", icon: FileText },
  { title: "ทีมงานและตรวจทาน", icon: ShieldCheck },
];

const PROJECT_TYPES: { code: ProjectTypeCode; label: string }[] = [
  { code: 1, label: "ซื้อขายส่งมอบ" },
  { code: 2, label: "ซ่อมบำรุงรักษา" },
  { code: 3, label: "บริการติดตั้ง" },
  { code: 4, label: "ซื้อขายพร้อมติดตั้ง" },
];

const GP_TARGET = 15; // เกณฑ์กำไรขั้นต้นขั้นต่ำ (%)
const DAY = 86400e3;

const baht = (n: number) => `฿${(Number(n) || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const r2 = (n: number) => Math.round(n * 100) / 100;
const today = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => {
  const s = Date.parse(`${a}T00:00:00Z`);
  const e = Date.parse(`${b}T00:00:00Z`);
  return Number.isFinite(s) && Number.isFinite(e) && e >= s ? Math.round((e - s) / DAY) + 1 : 0;
};

export default function NewProjectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, companyId, role } = useAuth();
  const currentCompanyId = companyId || "";
  const [step, setStep] = useState(0);
  const [visited, setVisited] = useState<Set<number>>(() => new Set([0]));

  const [toast, setToast] = useState({ message: "", isVisible: false, isError: false });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const showToast = (message: string, isError = false) => setToast({ message, isVisible: true, isError });

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

  // ---------- 1: ข้อมูลโครงการ ----------
  const [projectId, setProjectId] = useState<string>("");
  const [projectName, setProjectName] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState(""); // id ลูกค้า หรือชื่อที่พิมพ์ใหม่
  const [sectorType, setSectorType] = useState<Sector>("Government");
  const [projectStage, setProjectStage] = useState<ProjectStage>("CONTRACTED");
  const [manualTypeCode, setManualTypeCode] = useState<ProjectTypeCode>(4);
  const [typeAuto, setTypeAuto] = useState(true);
  const [projectPriority, setProjectPriority] = useState("ปานกลาง");
  const [clientReference, setClientReference] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(() => addDays(today(), 89));
  const [warrantyMonths, setWarrantyMonths] = useState(12);
  const [siteLocation, setSiteLocation] = useState("");
  const [siteContactName, setSiteContactName] = useState("");
  const [siteContactPhone, setSiteContactPhone] = useState("");
  const [projectFollowers, setProjectFollowers] = useState<any[]>([]);

  // ภาครัฐ
  const [govTorDocNo, setGovTorDocNo] = useState("");
  const [govEgpNo, setGovEgpNo] = useState("");
  const [govReferencePrice, setGovReferencePrice] = useState(0);
  const [govBudgetAmount, setGovBudgetAmount] = useState(0);
  const [govBudgetSource, setGovBudgetSource] = useState(BUDGET_SOURCES[0]);
  const [govFiscalYear, setGovFiscalYear] = useState<number | null>(null); // null = ตามวันที่เริ่ม
  const [govMethod, setGovMethod] = useState(PROCUREMENT_METHODS[0]);
  const [govContractNo, setGovContractNo] = useState("");
  // เอกชน
  const [pvtCustomerPO, setPvtCustomerPO] = useState("");
  const [pvtPaymentTerms, setPvtPaymentTerms] = useState("");

  // ---------- 2: รายการและต้นทุน ----------
  const [documentItems, setDocumentItems] = useState<any[]>([]);
  const [projectLabors, setProjectLabors] = useState<any[]>([]);
  const [expensesEdited, setExpensesEdited] = useState<ProjectExpense[] | null>(null); // null = ค่าเริ่มต้นตามประเภทลูกค้า
  const [targetMargin, setTargetMargin] = useState(10);

  // ---------- 3: แผนงาน ----------
  const [timelineEdited, setTimelineEdited] = useState<TimelinePhase[] | null>(null); // null = ตามรูปแบบงาน

  // ---------- 4: รายละเอียดโครงการ ----------
  const [docEdited, setDocEdited] = useState<Partial<Record<DocSectionKey, string>>>({}); // หัวข้อที่แก้เอง

  // ---------- 5: ทีมงาน ----------
  const [projectManagerUid, setProjectManagerUid] = useState<string>(user?.uid || "");
  const [assignedTeam, setAssignedTeam] = useState<{ uid: string; name: string; role: string; allocation: number }[]>([]);
  const projectManagerName = userOptions.find((u: any) => u.uid === projectManagerUid)?.name || "";

  // ---------- ค่าที่คำนวณ ----------
  const customerOptions = useMemo(() => rawCustomers.map((c: any) => ({
    value: c.id,
    label: c.customerName || c.name || "ไม่ระบุชื่อลูกค้า",
    description: `เลขผู้เสียภาษี ${c.taxId || "-"} · สาขา ${c.branchCode || "00000"}`,
  })), [rawCustomers]);
  const matchedCustomer = customerOptions.find((c: any) => c.value === selectedCustomerId);
  const isNewCustomer = !!selectedCustomerId.trim() && !matchedCustomer;
  const customerName = matchedCustomer?.label || selectedCustomerId.trim();

  const lines = useMemo(
    () => [...documentItems.map(normalizeItemLine), ...projectLabors.map(normalizeLaborLine)],
    [documentItems, projectLabors]
  );
  const inferredType = useMemo(() => inferProjectType(lines, manualTypeCode), [lines, manualTypeCode]);
  const projectTypeCode: ProjectTypeCode = typeAuto && inferredType ? inferredType : manualTypeCode;

  const expenses = useMemo(() => expensesEdited ?? defaultExpenses(sectorType), [expensesEdited, sectorType]);
  const budget = useMemo(() => computeProjectBudget(lines, { startDate, endDate, expenses }), [lines, startDate, endDate, expenses]);
  const contractValue = budget.grandTotalWithVat;
  const isGov = sectorType === "Government";
  const stage: ProjectStage = isGov ? projectStage : "CONTRACTED";
  const fiscalYear = govFiscalYear ?? fiscalYearOf(startDate);
  const budgetAmount = isGov && govBudgetAmount > 0 ? govBudgetAmount : contractValue;
  const durationDays = daysBetween(startDate, endDate);
  const overBudget = isGov && govBudgetAmount > 0 && contractValue > govBudgetAmount + 0.009;
  const overRefPrice = isGov && govReferencePrice > 0 && contractValue > govReferencePrice + 0.009;

  const autoTimeline = useMemo(() => defaultTimeline(projectTypeCode, startDate, endDate), [projectTypeCode, startDate, endDate]);
  const timeline = timelineEdited ?? autoTimeline;

  const autoDoc = useMemo(() => generateAllSections({
    projectName, customerName, sector: sectorType, typeCode: projectTypeCode, stage,
    startDate, endDate, durationDays, budgetAmount, referencePrice: govReferencePrice,
    budgetSource: govBudgetSource, fiscalYear, warrantyMonths, lines, timeline,
  }), [projectName, customerName, sectorType, projectTypeCode, stage, startDate, endDate, durationDays, budgetAmount, govReferencePrice, govBudgetSource, fiscalYear, warrantyMonths, lines, timeline]);
  const docSections = { ...autoDoc, ...docEdited } as Record<DocSectionKey, string>;
  const legalRefs = legalReferences(sectorType);

  const suggestedPrice = priceForMargin(budget.totalCost, expenses, targetMargin);

  // ---------- แก้ไขฉบับร่าง / โครงการที่ถูกตีกลับ (?edit=<id เอกสารโครงการ>) ----------
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
      const g = d.governmentDetails || {};
      setProjectId(d.projectId || editDocId);
      setProjectName(d.projectName || d.title || "");
      setSelectedCustomerId(d.customerId || "");
      setClientReference(d.clientReference || "");
      if ([1, 2, 3, 4].includes(Number(d.projectTypeCode))) setManualTypeCode(Number(d.projectTypeCode) as ProjectTypeCode);
      setTypeAuto(d.typeAuto === true);
      setSectorType(d.sectorType === "Private" ? "Private" : "Government");
      setProjectStage(normalizeStage(d.projectStage));
      setProjectPriority(d.priority || "ปานกลาง");
      if (d.startDate) setStartDate(d.startDate);
      if (d.endDate) setEndDate(d.endDate);
      if (d.warrantyMonths !== undefined) setWarrantyMonths(Number(d.warrantyMonths) || 0);
      setSiteLocation(d.siteLocation || "");
      setSiteContactName(d.siteContact?.name || "");
      setSiteContactPhone(d.siteContact?.phone || "");
      setProjectFollowers((d.followers || []).map((f: any, i: number) => ({ id: `FOL-${i}`, ...f })));
      setGovTorDocNo(g.torDocNo || "");
      setGovEgpNo(g.egpProjectNo || "");
      setGovReferencePrice(Number(g.referencePrice) || 0);
      setGovBudgetAmount(Number(g.budgetAmount) || 0);
      if (g.budgetSource) setGovBudgetSource(g.budgetSource);
      if (g.fiscalYear) setGovFiscalYear(Number(g.fiscalYear));
      if (g.procurementMethod) setGovMethod(g.procurementMethod);
      setGovContractNo(g.govContractNo || "");
      setPvtCustomerPO(d.privateDetails?.customerPO || "");
      setPvtPaymentTerms(d.privateDetails?.paymentTerms || "");
      if (d.projectManagerUid) setProjectManagerUid(d.projectManagerUid);
      setAssignedTeam((d.resources || []).filter((m: any) => m.userId).map((m: any) => ({ uid: m.userId, name: m.name, role: m.role || "", allocation: Number(m.allocation) || 0 })));
      const form = linesToForm(d.items || []);
      setDocumentItems(form.items);
      setProjectLabors(form.labors);
      if (Array.isArray(d.expenses)) setExpensesEdited(d.expenses);
      if (d.targetMargin) setTargetMargin(Number(d.targetMargin));
      if (Array.isArray(d.milestones) && d.milestones.length) {
        setTimelineEdited(d.milestones.map((m: any) => ({ id: m.id, name: m.name, startDate: m.startDate, endDate: m.endDate, weight: Number(m.weight) || 0 })));
      }
      if (d.docSections) setDocEdited(Object.fromEntries(Object.entries(d.docSections).filter(([, v]) => String(v || "").trim())) as any);
      setVisited(new Set(STEPS.map((_, i) => i)));
      setEditLoaded(true);
    })().catch((e) => {
      console.error("load project for edit:", e);
      showToast("โหลดข้อมูลโครงการไม่สำเร็จ", true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editDocId, currentCompanyId]);

  // ---------- นำเข้าจากใบเสนอราคา (?fromQuotationId=) ----------
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

  // ---------- ตรวจทีละขั้น ----------
  const stepError = (i: number): string | null => {
    if (i === 0) {
      if (projectName.trim().length < 3) return "กรุณาระบุชื่อโครงการอย่างน้อย 3 ตัวอักษร";
      if (selectedCustomerId.trim().length < 2) return isGov ? "กรุณาเลือกหรือพิมพ์ชื่อหน่วยงาน" : "กรุณาเลือกหรือพิมพ์ชื่อลูกค้า";
      if (!startDate || !endDate || endDate < startDate) return "วันที่ส่งมอบต้องไม่อยู่ก่อนวันที่เริ่ม";
    }
    if (i === 1 && budget.equipCount + budget.laborCount === 0) return "กรุณาเพิ่มรายการสินค้าหรืองานบริการอย่างน้อย 1 รายการ";
    if (i === 2) return timeline.length ? timelineError(timeline) : "กรุณากำหนดงวดงานอย่างน้อย 1 งวด";
    if (i === 4 && !projectManagerUid) return "กรุณาเลือกผู้จัดการโครงการ";
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
    setVisited((prev) => new Set(prev).add(target));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ---------- ปรับราคาขายให้ได้กำไรตามเป้า ----------
  const applyTargetMargin = () => {
    if (!(suggestedPrice > 0)) {
      showToast("คำนวณราคาไม่ได้ — ตรวจสอบต้นทุนและอัตรากำไร/ค่าใช้จ่าย (รวมกันต้องน้อยกว่า 100%)", true);
      return;
    }
    let items = documentItems;
    let labors = projectLabors;
    for (let pass = 0; pass < 4; pass++) {
      const b = computeProjectBudget([...items.map(normalizeItemLine), ...labors.map(normalizeLaborLine)], { expenses });
      const target = priceForMargin(b.totalCost, expenses, targetMargin);
      if (b.totalRev > 0) {
        const k = target / b.totalRev;
        if (Math.abs(k - 1) < 1e-5) break;
        items = items.map((it) => (it.itemType === "GROUP_HEADER" ? it : { ...it, price: r2((Number(it.price) || 0) * k) }));
        labors = labors.map((l) => ({ ...l, price: r2((Number(l.price) || 0) * k) }));
      } else if (b.totalCost > 0) {
        const k = target / b.totalCost;
        items = items.map((it) => (it.itemType === "GROUP_HEADER" ? it : { ...it, price: r2((Number(it.cost) || 0) * k) }));
        const unitCost = (l: any) => (l.type === "per-point" ? (Number(l.materialCost) || 0) + (Number(l.laborCost) || 0) : Number(l.cost) || 0);
        labors = labors.map((l) => ({ ...l, price: r2(unitCost(l) * k) }));
      } else break;
    }
    setDocumentItems(items);
    setProjectLabors(labors);
    showToast(`ปรับราคาขายทุกรายการให้ได้กำไรสุทธิประมาณ ${targetMargin}% แล้ว`, false);
  };

  // ---------- บันทึก ----------
  const canCreate = can(role, "projects:edit");
  const handleSaveProject = async (asDraft = false) => {
    const checks = asDraft ? [0] : [0, 1, 2, 4];
    for (const i of checks) {
      const err = stepError(i);
      if (err) {
        setStep(i);
        showToast(err, true);
        return;
      }
    }
    if (!asDraft && stage !== "CONTRACTED") {
      showToast("โครงการที่ยังไม่ได้งานบันทึกเป็นแผนโครงการได้เท่านั้น", true);
      return;
    }
    if (!canCreate) {
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
        selectedCustomerId: isNewCustomer ? "" : selectedCustomerId,
        newCustomerName: isNewCustomer ? selectedCustomerId.trim() : "",
        clientReference,
        projectTypeCode,
        typeAuto,
        sectorType,
        projectStage: stage,
        priority: projectPriority,
        startDate,
        endDate,
        warrantyMonths,
        siteLocation,
        siteContact: { name: siteContactName, phone: siteContactPhone },
        followers: projectFollowers,
        projectManager: projectManagerName,
        projectManagerUid,
        items: documentItems,
        labors: projectLabors,
        expenses,
        targetMargin,
        timeline,
        docSections,
        resources: assignedTeam.map((m) => ({ userId: m.uid, name: m.name, role: m.role, allocation: m.allocation })),
        governmentDetails: {
          torDocNo: govTorDocNo, egpProjectNo: govEgpNo, referencePrice: govReferencePrice, budgetAmount: govBudgetAmount,
          budgetSource: govBudgetSource, fiscalYear, procurementMethod: govMethod, govContractNo,
        },
        privateDetails: { customerPO: pvtCustomerPO || clientReference, paymentTerms: pvtPaymentTerms },
      };

      const res = await apiFetch(editDocId ? "/api/projects/update" : "/api/projects/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editDocId ? { ...payload, projectDocId: editDocId } : payload)
      });
      const resData = await res.json();
      if (!res.ok || !resData.success) throw new Error(resData.error || "บันทึกโครงการไม่สำเร็จ");

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

  // ---------- ส่วนประกอบเล็ก ----------
  const label = (text: string, required = false, extra?: React.ReactNode) => (
    <label className="text-[12px] font-bold text-white/70 ml-1 flex items-center gap-1.5 min-h-[18px]">
      <span>{text}{required && <span className="text-danger ml-0.5">*</span>}</span>
      {extra}
    </label>
  );
  const segBtn = (activeOn: boolean) => cn(
    "h-9 px-4 rounded-full text-[13px] font-bold border transition-all flex items-center gap-1.5 whitespace-nowrap",
    activeOn ? "bg-nexus-teal/15 border-nexus-teal/40 text-nexus-teal" : "bg-white/[0.02] border-white/10 text-white/50 hover:text-white"
  );
  const cardTitle = (icon: React.ReactNode, text: string, right?: React.ReactNode) => (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-bold text-white flex items-center gap-2">{icon} {text}</h3>
      {right}
    </div>
  );
  const typeLabel = PROJECT_TYPES.find((t) => t.code === projectTypeCode)?.label || "-";
  const typeConfig = PROJECT_TYPE_CONFIGS[projectTypeCode];
  const gpLow = budget.totalRev > 0 && budget.gpPercent < GP_TARGET;

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
              {isGov && stage !== "CONTRACTED" && (
                <span className="px-3 py-1 rounded-full bg-warning/10 border border-warning/30 text-warning text-xs font-bold">แผนโครงการ</span>
              )}
            </div>
            <p className="text-sm text-white/60 mt-1">กรอกทีละขั้น ระบบตั้งค่าใช้จ่าย แผนงาน และรายละเอียดโครงการให้อัตโนมัติ แก้ไขได้ทุกจุด</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <PillButton variant="glass" onClick={() => router.back()} className="h-9 px-4 text-xs font-bold text-white/60">ยกเลิก</PillButton>
          <PillButton variant="glass" onClick={() => handleSaveProject(true)} disabled={isSubmitting || !canCreate} className="h-9 px-4 text-xs font-bold">
            {stage === "CONTRACTED" ? "บันทึกฉบับร่าง" : "บันทึกแผนโครงการ"}
          </PillButton>
        </div>
      </div>

      {/* ขั้นตอน */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {STEPS.map((s, i) => {
          const done = i !== step && visited.has(i) && !stepError(i);
          const active = i === step;
          return (
            <button
              key={s.title}
              type="button"
              onClick={() => goTo(i)}
              className={cn(
                "h-9 px-3 rounded-full border text-[12px] 2xl:text-[13px] font-bold flex items-center gap-2 transition-all min-w-0",
                active ? "bg-nexus-teal/15 border-nexus-teal/40 text-nexus-teal"
                  : done ? "bg-white/[0.04] border-nexus-teal/20 text-white/80"
                  : "bg-white/[0.02] border-white/10 text-white/40 hover:text-white"
              )}
            >
              <span className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-mono shrink-0", active ? "bg-nexus-teal text-black" : done ? "bg-nexus-teal/30 text-nexus-teal" : "bg-white/10")}>
                {done ? <Check size={12} /> : i + 1}
              </span>
              <span className="truncate">{s.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  // ---------- ขั้นที่ 1: ข้อมูลโครงการ ----------
  const stepGeneral = (
    <div className="space-y-4">
      <GlassCard className="p-5 space-y-4">
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <div className="space-y-1.5">
            {label("ประเภทลูกค้า")}
            <div className="flex gap-2">
              <button type="button" onClick={() => setSectorType("Government")} className={segBtn(isGov)}><Landmark size={14} /> ภาครัฐ</button>
              <button type="button" onClick={() => setSectorType("Private")} className={segBtn(!isGov)}><Store size={14} /> เอกชน</button>
            </div>
          </div>
          {isGov && (
            <div className="space-y-1.5 min-w-0">
              {label("ขั้นของโครงการ")}
              <div className="flex gap-2 flex-wrap">
                {PROJECT_STAGES.map((s) => (
                  <button key={s.code} type="button" onClick={() => setProjectStage(s.code)} className={segBtn(projectStage === s.code)} title={s.hint}>{s.label}</button>
                ))}
              </div>
            </div>
          )}
        </div>
        {isGov && (
          <p className="text-[12px] text-white/45 -mt-2 ml-1">{PROJECT_STAGES.find((s) => s.code === projectStage)?.hint}</p>
        )}

        <div className="grid grid-cols-12 gap-3">
          <div className="space-y-1 col-span-12 lg:col-span-7">
            {label("ชื่อโครงการ", true)}
            <PillInput value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="เช่น จัดซื้อพร้อมติดตั้งระบบกล้องโทรทัศน์วงจรปิด อาคาร B" className="w-full h-9 text-sm font-bold" />
          </div>
          <div className="space-y-1 col-span-12 lg:col-span-5">
            {label(isGov ? "หน่วยงาน / ลูกค้า" : "ลูกค้า", true)}
            <SmartSelect
              options={customerOptions}
              value={selectedCustomerId}
              onChange={(val) => setSelectedCustomerId(val)}
              placeholder={isGov ? "พิมพ์ค้นหา หรือพิมพ์ชื่อหน่วยงานใหม่..." : "พิมพ์ค้นหา หรือพิมพ์ชื่อลูกค้าใหม่..."}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          {label("รูปแบบงาน", false, typeAuto
            ? <span className="text-[11px] font-bold text-nexus-teal flex items-center gap-1"><Sparkles size={11} /> อัตโนมัติจากรายการสินค้า/บริการ</span>
            : <button type="button" onClick={() => setTypeAuto(true)} className="text-[11px] font-bold text-white/50 hover:text-nexus-teal">ใช้แบบอัตโนมัติ</button>)}
          <div className="flex gap-2 flex-wrap">
            {PROJECT_TYPES.map((t) => (
              <button key={t.code} type="button" onClick={() => { setManualTypeCode(t.code); setTypeAuto(false); }} className={segBtn(projectTypeCode === t.code)}>{t.label}</button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_96px_104px_128px] 2xl:grid-cols-[200px_200px_110px_120px_160px] gap-3">
          <div className="space-y-1">
            {label("วันที่เริ่ม", true)}
            <PillInput type="date" value={startDate} onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              setEndDate(addDays(v, Math.max(1, durationDays) - 1)); // คงระยะเวลาเดิม
              setStartDate(v);
            }} className="w-full h-9 text-sm font-mono px-4" />
          </div>
          <div className="space-y-1">
            {label("วันที่ส่งมอบ", true)}
            <PillInput type="date" value={endDate} onChange={(e) => e.target.value && setEndDate(e.target.value)} className="w-full h-9 text-sm font-mono px-4" />
          </div>
          <div className="space-y-1">
            {label("ระยะเวลา")}
            <NumCell value={durationDays} onChange={(v) => setEndDate(addDays(startDate, Math.max(1, Math.round(v)) - 1))} suffix="วัน" />
          </div>
          <div className="space-y-1">
            {label("รับประกัน")}
            <NumCell value={warrantyMonths} onChange={(v) => setWarrantyMonths(Math.min(120, Math.round(v)))} suffix="เดือน" />
          </div>
          <div className="space-y-1">
            {label("ความสำคัญ")}
            <PillSelect value={projectPriority} onChange={(e) => setProjectPriority(e.target.value)} className="w-full h-9 text-sm">
              <option value="ทั่วไป">ทั่วไป</option>
              <option value="ปานกลาง">ปานกลาง</option>
              <option value="เร่งด่วน">เร่งด่วน</option>
              <option value="วิกฤต">วิกฤต</option>
            </PillSelect>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="p-5 space-y-3">
        {cardTitle(<Receipt size={16} className="text-nexus-teal" />, isGov ? "งบประมาณและการจัดซื้อจัดจ้าง" : "เงื่อนไขการว่าจ้าง")}
        {isGov ? (
          <div className="grid grid-cols-12 gap-3">
            <div className="space-y-1 col-span-4 md:col-span-2">
              {label("ปีงบประมาณ")}
              <NumCell value={fiscalYear} onChange={(v) => setGovFiscalYear(Math.round(v) || null)} />
            </div>
            <div className="space-y-1 col-span-8 md:col-span-4">
              {label("แหล่งงบประมาณ")}
              <PillSelect value={govBudgetSource} onChange={(e) => setGovBudgetSource(e.target.value)} className="w-full h-9 text-sm">
                {BUDGET_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </PillSelect>
            </div>
            <div className="space-y-1 col-span-6 md:col-span-3">
              {label("วงเงินงบประมาณ (บาท)", false, govBudgetAmount === 0 && contractValue > 0 ? <span className="text-[11px] text-white/40 font-normal">= มูลค่าโครงการ</span> : null)}
              <NumCell value={govBudgetAmount || r2(contractValue)} onChange={(v) => setGovBudgetAmount(v)} className={overBudget ? "[&_input]:border-warning/60" : ""} />
            </div>
            <div className="space-y-1 col-span-6 md:col-span-3">
              {label("ราคากลาง (บาท)")}
              <NumCell value={govReferencePrice} onChange={(v) => setGovReferencePrice(v)} className={overRefPrice ? "[&_input]:border-warning/60" : ""} />
            </div>
            <div className="space-y-1 col-span-12 md:col-span-4">
              {label("วิธีจัดซื้อจัดจ้าง")}
              <PillSelect value={govMethod} onChange={(e) => setGovMethod(e.target.value)} className="w-full h-9 text-sm">
                {PROCUREMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </PillSelect>
            </div>
            <div className="space-y-1 col-span-6 md:col-span-4">
              {label("เลขที่โครงการ (e-GP)")}
              <PillInput value={govEgpNo} onChange={(e) => setGovEgpNo(e.target.value)} placeholder="ระบุเมื่อประกาศแล้ว" className="w-full h-9 text-sm font-mono" />
            </div>
            <div className="space-y-1 col-span-6 md:col-span-4">
              {label("เลขที่สัญญา")}
              <PillInput value={govContractNo} onChange={(e) => setGovContractNo(e.target.value)} disabled={stage !== "CONTRACTED"} placeholder={stage === "CONTRACTED" ? "เช่น 15/2569" : "ระบุเมื่อได้งาน"} className="w-full h-9 text-sm font-mono" />
            </div>
            <div className="space-y-1 col-span-6 md:col-span-4">
              {label("เลขที่ TOR / ประกาศ")}
              <PillInput value={govTorDocNo} onChange={(e) => setGovTorDocNo(e.target.value)} placeholder="เช่น TOR-2569-015" className="w-full h-9 text-sm font-mono" />
            </div>
            <div className="space-y-1 col-span-6 md:col-span-4">
              {label("ใบเสนอราคาอ้างอิง")}
              <PillInput value={clientReference} onChange={(e) => setClientReference(e.target.value)} placeholder="เลขที่ใบเสนอราคา" className="w-full h-9 text-sm font-mono" />
            </div>
            <div className="col-span-12 md:col-span-4 flex items-end">
              <div className={cn("w-full h-9 px-4 rounded-full border flex items-center justify-between gap-2 text-[12px]",
                overBudget ? "border-warning/40 bg-warning/10 text-warning" : "border-white/10 bg-white/[0.02] text-white/60")}>
                <span>มูลค่าโครงการ (รวม VAT)</span>
                <b className="font-mono">{baht(contractValue)}</b>
              </div>
            </div>
            {(overBudget || overRefPrice) && (
              <p className="col-span-12 text-[12px] text-warning flex items-center gap-1.5">
                <AlertCircle size={13} /> มูลค่าโครงการสูงกว่า{overBudget ? "วงเงินงบประมาณ" : "ราคากลาง"} — ปรับราคาที่ขั้น &ldquo;รายการและต้นทุน&rdquo;
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-3">
            <div className="space-y-1 col-span-6 md:col-span-3">
              {label("เลขที่ใบสั่งซื้อ (PO)")}
              <PillInput value={pvtCustomerPO} onChange={(e) => setPvtCustomerPO(e.target.value)} placeholder="เช่น PO-2026-9912" className="w-full h-9 text-sm font-mono" />
            </div>
            <div className="space-y-1 col-span-6 md:col-span-3">
              {label("ใบเสนอราคาอ้างอิง")}
              <PillInput value={clientReference} onChange={(e) => setClientReference(e.target.value)} placeholder="เลขที่ใบเสนอราคา" className="w-full h-9 text-sm font-mono" />
            </div>
            <div className="space-y-1 col-span-12 md:col-span-6">
              {label("เงื่อนไขการชำระเงิน")}
              <PillInput value={pvtPaymentTerms} onChange={(e) => setPvtPaymentTerms(e.target.value)} placeholder="เว้นว่าง = ตามงวดงาน" className="w-full h-9 text-sm" />
            </div>
          </div>
        )}
      </GlassCard>

      <GlassCard className="p-5 space-y-3">
        {cardTitle(<MapPin size={16} className="text-nexus-blue" />, "สถานที่และผู้ติดต่อหน้างาน")}
        <div className="grid grid-cols-12 gap-3">
          <div className="space-y-1 col-span-12 md:col-span-6">{label("สถานที่ดำเนินงาน")}<PillInput value={siteLocation} onChange={(e) => setSiteLocation(e.target.value)} placeholder="อาคาร / ชั้น / ที่อยู่ หรือลิงก์แผนที่" className="w-full h-9 text-sm" /></div>
          <div className="space-y-1 col-span-6 md:col-span-3">{label("ผู้ติดต่อ")}<PillInput value={siteContactName} onChange={(e) => setSiteContactName(e.target.value)} placeholder="ชื่อ-นามสกุล" className="w-full h-9 text-sm" /></div>
          <div className="space-y-1 col-span-6 md:col-span-3">{label("เบอร์โทร")}<PillInput value={siteContactPhone} onChange={(e) => setSiteContactPhone(e.target.value)} placeholder="08x-xxx-xxxx" className="w-full h-9 text-sm font-mono" /></div>
        </div>

        <div className="pt-3 border-t border-white/10 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-bold text-white flex items-center gap-1.5"><UserCheck size={14} className="text-nexus-teal" /> ผู้ประสานงาน / {isGov ? "กรรมการตรวจรับ" : "ผู้ติดตามหน้างาน"} ({projectFollowers.length} คน)</span>
            <PillButton variant="glass" onClick={() => setProjectFollowers((prev) => [...prev, { id: `FOL-${Date.now()}`, name: "", role: isGov ? "กรรมการตรวจรับพัสดุ" : "ผู้ประสานงานหน้างาน", phone: "", note: "" }])} className="h-8 px-3 text-xs font-bold text-nexus-teal border-nexus-teal/30">+ เพิ่มรายชื่อ</PillButton>
          </div>
          {projectFollowers.map((fol) => {
            const upd = (field: string, value: string) => setProjectFollowers((prev) => prev.map((f) => (f.id === fol.id ? { ...f, [field]: value } : f)));
            return (
              <div key={fol.id} className="grid grid-cols-12 gap-2 items-center">
                <PillInput value={fol.name} onChange={(e) => upd("name", e.target.value)} placeholder="ชื่อ-นามสกุล" className="col-span-6 md:col-span-3 h-9 text-sm" />
                <PillInput value={fol.role} onChange={(e) => upd("role", e.target.value)} placeholder="ตำแหน่ง / บทบาท" className="col-span-6 md:col-span-3 h-9 text-sm" />
                <PillInput value={fol.phone} onChange={(e) => upd("phone", e.target.value)} placeholder="เบอร์โทร" className="col-span-5 md:col-span-2 h-9 text-sm font-mono" />
                <PillInput value={fol.note || ""} onChange={(e) => upd("note", e.target.value)} placeholder="หมายเหตุ" className="col-span-6 md:col-span-3 h-9 text-sm" />
                <button type="button" onClick={() => setProjectFollowers((prev) => prev.filter((f) => f.id !== fol.id))} className="col-span-1 justify-self-end p-1 text-white/40 hover:text-danger" title="ลบรายชื่อ"><Trash2 size={15} /></button>
              </div>
            );
          })}
        </div>
      </GlassCard>
    </div>
  );

  // ---------- ขั้นที่ 2: รายการและต้นทุน ----------
  const updateLabor = (id: any, patch: any) => setProjectLabors((prev) => prev.map((item) => {
    if (item.id !== id) return item;
    const next = { ...item, ...patch };
    // เหมาจ่าย: ต้นทุน = ค่าวัสดุ + ค่าแรง
    if (next.type !== "per-point") next.cost = (Number(next.materialCost) || 0) + (Number(next.laborCost) || 0);
    return next;
  }));
  const laborCols = "grid grid-cols-[minmax(0,1fr)_104px_64px_92px_92px_100px_24px] 2xl:grid-cols-[minmax(0,1fr)_110px_72px_110px_110px_120px_120px_28px] gap-1.5 2xl:gap-2 items-center";
  const head = "text-[11px] font-bold text-white/45 uppercase tracking-wide";

  const stepItems = (
    <div className="space-y-4">
      <GlassCard className="p-5 space-y-3">
        {cardTitle(<FileSpreadsheet size={16} className="text-nexus-teal" />, `สินค้าและพัสดุ (${documentItems.length} รายการ)`)}
        <DocumentItemsTable items={documentItems} onChange={(newItems) => setDocumentItems(newItems)} isLocked={false} taxType="EXCLUSIVE" />
      </GlassCard>

      <GlassCard className="p-5 space-y-3">
        {cardTitle(<Wrench size={16} className="text-nexus-blue" />, `งานบริการและค่าแรงติดตั้ง (${projectLabors.length} รายการ)`,
          <PillButton variant="glass" onClick={() => setProjectLabors((prev) => [...prev, { id: Date.now(), name: "", type: "lump-sum", points: 1, materialCost: 0, laborCost: 0, cost: 0, price: 0 }])} className="h-8 px-3 text-xs font-bold text-nexus-blue border-nexus-blue/30">+ เพิ่มงานบริการ</PillButton>)}
        {projectLabors.length === 0 ? (
          <div className="p-4 border border-dashed border-white/10 rounded-2xl text-center text-white/40 text-xs">ยังไม่มีงานบริการ — งานติดตั้ง เดินสาย ทดสอบระบบ ฝึกอบรม ฯลฯ</div>
        ) : (
          <div className="space-y-2">
            <div className={cn(laborCols, "px-1")}>
              <span className={head}>ชื่องาน</span>
              <span className={head}>วิธีคิด</span>
              <span className={cn(head, "text-right")}>จำนวน</span>
              <span className={cn(head, "text-right")}>วัสดุ/หน่วย</span>
              <span className={cn(head, "text-right")}>ค่าแรง/หน่วย</span>
              <span className={cn(head, "text-right")}>ขาย/หน่วย</span>
              <span className={cn(head, "text-right hidden 2xl:block")}>รวมขาย</span>
              <span />
            </div>
            {projectLabors.map((lab) => {
              const perPoint = lab.type === "per-point";
              const qty = perPoint ? Number(lab.points) || 1 : 1;
              return (
                <div key={lab.id} className={laborCols}>
                  <PillInput value={lab.name} onChange={(e) => updateLabor(lab.id, { name: e.target.value })} placeholder="เช่น เดินสาย LAN ร้อยท่อ EMT" className="h-9 text-sm" />
                  <PillSelect value={perPoint ? "per-point" : "lump-sum"} onChange={(e) => updateLabor(lab.id, { type: e.target.value })} className="h-9 text-sm">
                    <option value="lump-sum">เหมา</option>
                    <option value="per-point">ต่อจุด</option>
                  </PillSelect>
                  <NumCell value={qty} disabled={!perPoint} onChange={(v) => updateLabor(lab.id, { points: Math.max(1, Math.round(v)) })} title={perPoint ? "จำนวนจุด" : "เหมาจ่าย = 1 งาน"} />
                  <NumCell value={Number(lab.materialCost) || 0} onChange={(v) => updateLabor(lab.id, { materialCost: v })} />
                  <NumCell value={Number(lab.laborCost) || 0} onChange={(v) => updateLabor(lab.id, { laborCost: v })} />
                  <NumCell value={Number(lab.price) || 0} onChange={(v) => updateLabor(lab.id, { price: v })} />
                  <span className="text-[13px] font-mono text-white text-right pr-1 whitespace-nowrap hidden 2xl:block">{baht(qty * (Number(lab.price) || 0))}</span>
                  <button type="button" onClick={() => setProjectLabors((prev) => prev.filter((item) => item.id !== lab.id))} className="p-1 text-white/40 hover:text-danger justify-self-end" title="ลบรายการ"><Trash2 size={15} /></button>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      <GlassCard className="p-5 space-y-3">
        {cardTitle(<Receipt size={16} className="text-warning" />, "ค่าใช้จ่ายดำเนินงานโครงการ",
          <span className="text-[11px] text-white/40">{expensesEdited ? "แก้ไขเอง" : `ค่าเริ่มต้นสำหรับลูกค้า${isGov ? "ภาครัฐ" : "เอกชน"}`}</span>)}
        <ExpensesEditor
          expenses={expenses}
          onChange={(next) => setExpensesEdited(next)}
          onReset={() => setExpensesEdited(null)}
          directCost={budget.totalCost}
          price={budget.totalRev}
        />
      </GlassCard>

      <GlassCard className="p-5 space-y-4">
        {cardTitle(<Target size={16} className="text-nexus-teal" />, "กำไรและราคาขาย")}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ["ต้นทุนตรง", baht(budget.totalCost), "text-white"],
            ["ค่าใช้จ่ายดำเนินงาน", baht(budget.expensesTotal), "text-white"],
            ["ราคาขาย (ก่อน VAT)", baht(budget.totalRev), "text-nexus-teal"],
            ["กำไรสุทธิ", `${baht(budget.netProfit)} (${budget.netProfitPercent}%)`, budget.netProfit < 0 ? "text-danger" : budget.netProfitPercent < targetMargin ? "text-warning" : "text-white"],
          ].map(([k, v, cls]) => (
            <div key={k} className="p-3 rounded-2xl bg-white/[0.02] border border-white/10 min-w-0">
              <p className="text-[11px] text-white/50">{k}</p>
              <p className={cn("text-[14px] font-mono font-bold truncate", cls)}>{v}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1 w-[140px]">
            {label("กำไรสุทธิเป้าหมาย")}
            <NumCell value={targetMargin} onChange={(v) => setTargetMargin(Math.min(80, v))} suffix="%" />
          </div>
          <div className="space-y-1 flex-1 min-w-[200px]">
            {label("ราคาขายที่ได้กำไรตามเป้า (ก่อน VAT)")}
            <div className="h-9 px-4 rounded-full border border-white/10 bg-white/[0.02] flex items-center justify-between text-[13px]">
              <b className="font-mono text-white">{suggestedPrice > 0 ? baht(suggestedPrice) : "-"}</b>
              {suggestedPrice > 0 && budget.totalRev > 0 && (
                <span className={cn("font-mono text-[12px]", suggestedPrice >= budget.totalRev ? "text-warning" : "text-nexus-teal")}>
                  {suggestedPrice >= budget.totalRev ? "+" : ""}{baht(suggestedPrice - budget.totalRev)}
                </span>
              )}
            </div>
          </div>
          <PillButton variant="confirm" onClick={applyTargetMargin} disabled={!(budget.totalCost > 0)} className="h-9 px-4 text-xs font-bold">
            <Sparkles size={13} className="mr-1.5" /> ปรับราคาขายทุกรายการตามเป้า
          </PillButton>
        </div>
        {isGov && (govBudgetAmount > 0 || govReferencePrice > 0) && (
          <p className={cn("text-[12px] flex items-center gap-1.5", overBudget || overRefPrice ? "text-warning" : "text-white/50")}>
            <AlertCircle size={13} /> มูลค่ารวม VAT {baht(contractValue)}
            {govBudgetAmount > 0 && ` · วงเงินงบประมาณ ${baht(govBudgetAmount)}`}
            {govReferencePrice > 0 && ` · ราคากลาง ${baht(govReferencePrice)}`}
          </p>
        )}
      </GlassCard>
    </div>
  );

  // ---------- ขั้นที่ 3: แผนงานและงวดงาน ----------
  const stepTimeline = (
    <GlassCard className="p-5 space-y-3">
      {cardTitle(<CalendarRange size={16} className="text-nexus-teal" />, "แผนงานและงวดงาน",
        <span className="text-[11px] text-white/40">{timelineEdited ? "แก้ไขเอง" : `แผนมาตรฐาน: ${typeLabel} · ${durationDays} วัน`}</span>)}
      <TimelineEditor
        phases={timeline}
        onChange={(next) => setTimelineEdited(next)}
        onRegenerate={() => setTimelineEdited(null)}
        contractValue={contractValue}
        startDate={startDate}
        endDate={endDate}
      />
    </GlassCard>
  );

  // ---------- ขั้นที่ 4: รายละเอียดโครงการ ----------
  const stepDocument = (
    <GlassCard className="p-5 space-y-4">
      {cardTitle(<FileText size={16} className="text-nexus-teal" />, "รายละเอียดโครงการ",
        <PillButton variant="glass" onClick={() => setDocEdited({})} className="h-8 px-3 text-xs font-bold text-white/60">
          <Sparkles size={13} className="mr-1" /> สร้างใหม่ทั้งหมด
        </PillButton>)}
      <p className="text-[12px] text-white/45 -mt-2">ข้อความสร้างจากข้อมูลโครงการ รายการ และงวดงานโดยอัตโนมัติ หัวข้อที่แก้เองจะไม่ถูกเขียนทับ</p>
      <DocSectionsEditor
        sections={docSections}
        dirty={Object.fromEntries(Object.keys(docEdited).map((k) => [k, true]))}
        onChange={(key, value) => setDocEdited((prev) => ({ ...prev, [key]: value }))}
        onRegenerate={(key) => setDocEdited((prev) => { const n = { ...prev }; delete n[key]; return n; })}
        legalRefs={legalRefs}
      />
    </GlassCard>
  );

  // ---------- ขั้นที่ 5: ทีมงานและตรวจทาน ----------
  const reviewRow = (k: string, v: React.ReactNode) => (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-white/5 last:border-0">
      <span className="text-[13px] text-white/50 shrink-0">{k}</span>
      <span className="text-[13px] text-white text-right break-words min-w-0">{v || "-"}</span>
    </div>
  );

  const stepReview = (
    <div className="space-y-4">
      <GlassCard className="p-5 space-y-4">
        {cardTitle(<Users size={16} className="text-nexus-blue" />, "ผู้จัดการโครงการและทีมงาน")}
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
          <div className="space-y-2">
            {assignedTeam.map((member) => (
              <div key={member.uid} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_96px_28px] gap-2 items-center">
                <span className="text-sm font-bold text-white truncate pl-1" title={member.name}>{member.name}</span>
                <PillInput value={member.role} onChange={(e) => setAssignedTeam((prev) => prev.map((m) => (m.uid === member.uid ? { ...m, role: e.target.value } : m)))} placeholder="หน้าที่ในโครงการ" className="h-9 text-sm" />
                <NumCell value={member.allocation} onChange={(v) => setAssignedTeam((prev) => prev.map((m) => (m.uid === member.uid ? { ...m, allocation: Math.min(100, Math.round(v)) } : m)))} suffix="%" title="สัดส่วนเวลาที่ทำงานให้โครงการ" />
                <button type="button" onClick={() => setAssignedTeam((prev) => prev.filter((m) => m.uid !== member.uid))} className="text-white/30 hover:text-danger p-1 justify-self-end" title="นำออกจากทีม"><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {gpLow && (
        <div className={cn("p-4 rounded-2xl border flex items-start gap-3", budget.gpPercent < 0 ? "bg-danger/10 border-danger/30" : "bg-warning/10 border-warning/30")}>
          <AlertCircle size={18} className={cn("shrink-0 mt-0.5", budget.gpPercent < 0 ? "text-danger" : "text-warning")} />
          <div className="text-[13px]">
            <p className={cn("font-bold", budget.gpPercent < 0 ? "text-danger" : "text-warning")}>
              {budget.gpPercent < 0 ? `กำไรขั้นต้นติดลบ (${budget.gpPercent}%)` : `กำไรขั้นต้นต่ำกว่าเกณฑ์ ${GP_TARGET}% (${budget.gpPercent}%)`}
            </p>
            <p className="text-white/60">ส่งขออนุมัติได้ แต่ฝ่ายการเงินจะพิจารณาเป็นกรณีพิเศษ ตรวจสอบราคาขาย ส่วนลด และต้นทุนอีกครั้ง</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
        <GlassCard className="p-5">
          {cardTitle(<Briefcase size={16} className="text-nexus-teal" />, "ตรวจทานข้อมูล")}
          <div className="mt-2">
            {reviewRow("ชื่อโครงการ", projectName)}
            {reviewRow(isGov ? "หน่วยงาน" : "ลูกค้า", customerName ? `${customerName}${isNewCustomer ? " (ใหม่)" : ""}` : "")}
            {reviewRow("รูปแบบงาน", `${typeLabel} · ${isGov ? "ภาครัฐ" : "เอกชน"}${isGov ? ` · ${PROJECT_STAGES.find((s) => s.code === stage)?.label}` : ""}`)}
            {reviewRow("ระยะเวลา", `${startDate} ถึง ${endDate} (${durationDays} วัน)`)}
            {isGov
              ? reviewRow("งบประมาณ", `${baht(budgetAmount)} · ${govBudgetSource} ปี ${fiscalYear} · ${govMethod}`)
              : reviewRow("เงื่อนไข", [pvtCustomerPO && `PO ${pvtCustomerPO}`, pvtPaymentTerms || "ตามงวดงาน"].filter(Boolean).join(" · "))}
            {reviewRow("งวดงาน", `${timeline.length} งวด`)}
            {reviewRow("ผู้จัดการโครงการ", projectManagerName)}
            {reviewRow("ทีมงาน", assignedTeam.length ? assignedTeam.map((m) => m.name).join(", ") : "-")}
          </div>
        </GlassCard>

        <GlassCard className="p-0 overflow-hidden self-start">
          <NexusTable headers={["หมวด", "ต้นทุน", "ราคาขาย"]}>
            <NexusTableRow>
              <NexusTableCell>สินค้าและพัสดุ ({budget.equipCount})</NexusTableCell>
              <NexusTableCell mono>{baht(budget.equipCost)}</NexusTableCell>
              <NexusTableCell mono>{baht(budget.equipRev)}</NexusTableCell>
            </NexusTableRow>
            <NexusTableRow>
              <NexusTableCell>งานบริการและค่าแรง ({budget.laborCount})</NexusTableCell>
              <NexusTableCell mono>{baht(budget.laborCost)}</NexusTableCell>
              <NexusTableCell mono>{baht(budget.laborRev)}</NexusTableCell>
            </NexusTableRow>
            <NexusTableRow>
              <NexusTableCell>ค่าใช้จ่ายดำเนินงาน ({budget.expenseLines.length})</NexusTableCell>
              <NexusTableCell mono>{baht(budget.expensesTotal)}</NexusTableCell>
              <NexusTableCell>-</NexusTableCell>
            </NexusTableRow>
            <NexusTableRow className="bg-nexus-teal/5">
              <NexusTableCell className="font-bold text-white">รวม · กำไรสุทธิ {baht(budget.netProfit)} ({budget.netProfitPercent}%)</NexusTableCell>
              <NexusTableCell mono>{baht(budget.grandTotalCost)}</NexusTableCell>
              <NexusTableCell mono>{baht(budget.totalRev)}</NexusTableCell>
            </NexusTableRow>
          </NexusTable>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <GlassCard className="p-5 space-y-2">
          {cardTitle(<ClipboardList size={16} className="text-nexus-teal" />, `เอกสารบังคับ (${typeConfig?.requiredDocuments.length || 0} รายการ)`)}
          {typeConfig?.requiredDocuments.map((d) => (
            <div key={d.docCode} className="flex items-center justify-between gap-3 py-1.5 border-b border-white/5 last:border-0">
              <span className="text-[13px] text-white/80">{d.docName}</span>
              <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap", d.isMandatory ? "text-warning border-warning/30 bg-warning/10" : "text-white/40 border-white/10")}>{d.isMandatory ? "บังคับ" : "ไม่บังคับ"}</span>
            </div>
          ))}
        </GlassCard>
        <GlassCard className="p-5 space-y-2">
          {cardTitle(<ShieldCheck size={16} className="text-nexus-teal" />, "ขั้นตอนอนุมัติหลังส่ง")}
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
  const isLast = step === STEPS.length - 1;
  const leftContent = (
    <div className="space-y-4 pb-10">
      {step === 0 && stepGeneral}
      {step === 1 && stepItems}
      {step === 2 && stepTimeline}
      {step === 3 && stepDocument}
      {step === 4 && stepReview}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <PillButton variant="glass" disabled={step === 0} onClick={() => goTo(step - 1)} className="h-9 px-5 text-xs font-bold">
          <ArrowLeft size={14} className="mr-1.5" /> ย้อนกลับ
        </PillButton>
        {!isLast ? (
          <PillButton variant="confirm" onClick={() => goTo(step + 1)} className="h-9 px-5 text-xs font-bold">
            ถัดไป: {STEPS[step + 1].title} <ArrowRight size={14} className="ml-1.5" />
          </PillButton>
        ) : stage !== "CONTRACTED" ? (
          <div className="flex flex-wrap items-center justify-end gap-3">
            <span className="text-[12px] text-white/50">ส่งขออนุมัติเปิดโครงการได้เมื่อได้งานแล้ว</span>
            <PillButton variant="confirm" onClick={() => handleSaveProject(true)} disabled={isSubmitting || !canCreate} className="h-9 px-5 text-xs font-bold">
              {isSubmitting ? "กำลังบันทึก..." : "บันทึกแผนโครงการ"}
            </PillButton>
          </div>
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

  // ---------- แผงสรุป ----------
  const sideRow = (k: string, v: string, cls = "text-white") => (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-white/5 last:border-0">
      <span className="text-[13px] text-white/60">{k}</span>
      <span className={cn("text-[13px] 2xl:text-[14px] font-mono font-bold text-right", cls)}>{v}</span>
    </div>
  );

  const rightSidebar = (
    <div className="p-4 pb-28 space-y-4">
      <GlassCard className="p-4">
        <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2"><Briefcase size={16} className="text-nexus-teal" /> สรุปโครงการ</h4>
        {sideRow("ราคาขายก่อนภาษี", baht(budget.totalRev), "text-nexus-teal")}
        {sideRow("ต้นทุนตรง", baht(budget.totalCost))}
        {sideRow("ค่าใช้จ่ายดำเนินงาน", baht(budget.expensesTotal))}
        {sideRow("กำไรขั้นต้น", `${budget.gpPercent}%`, budget.gpPercent < 0 ? "text-danger" : gpLow ? "text-warning" : "text-white")}
        {sideRow("กำไรสุทธิ", `${baht(budget.netProfit)} (${budget.netProfitPercent}%)`, budget.netProfit < 0 ? "text-danger" : budget.netProfitPercent < targetMargin ? "text-warning" : "text-white")}
        {sideRow("มูลค่ารวมภาษี", baht(contractValue))}
        {isGov && govBudgetAmount > 0 && sideRow("วงเงินงบประมาณ", baht(govBudgetAmount), overBudget ? "text-warning" : "text-white")}
        {sideRow("ระยะเวลา", `${durationDays} วัน · ${timeline.length} งวด`)}
      </GlassCard>

      <GlassCard className="p-4 space-y-2">
        <h4 className="text-sm font-bold text-white mb-1">ความครบถ้วน</h4>
        {STEPS.map((s, i) => {
          const err = stepError(i);
          const ok = visited.has(i) && !err;
          return (
            <button key={s.title} type="button" onClick={() => goTo(i)} className="w-full flex items-start gap-2 text-left py-1">
              <span className={cn("w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5", ok ? "bg-nexus-teal/20 text-nexus-teal" : "bg-white/10 text-white/40")}>
                {ok ? <Check size={12} /> : <span className="text-[11px] font-mono">{i + 1}</span>}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] text-white/80">{s.title}</span>
                {(err || !visited.has(i)) && <span className="block text-[12px] text-white/40">{err || "ยังไม่ได้ตรวจทาน"}</span>}
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
