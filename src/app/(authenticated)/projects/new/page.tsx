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
  ExternalLink,
  FileSignature,
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
import {
  DocSectionsEditor, ExpensesEditor, FIELD_W, Field, NumCell, SpecChoiceEditor, TimelineEditor, type DocSource, type SpecRow,
} from "@/components/projects/ProjectPlanEditors";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { ProjectTypeCode, PROJECT_TYPE_CONFIGS } from "@/types/database";
import { apiFetch } from "@/lib/api-client";
import { computeProjectBudget, linesToForm, normalizeItemLine, normalizeLaborLine } from "@/lib/project-budget";
import { APPROVAL_STEPS, EDITABLE_STATUSES, normalizeProjectStatus } from "@/lib/project-status";
import {
  AI_DOC_KEYS, BUDGET_SOURCES, MAINTENANCE_LEVELS, PROCUREMENT_METHODS, PROJECT_STAGES, buildMaintenanceLabors,
  defaultExpenses, defaultTimeline, docSectionsFor, fiscalYearOf, generateAllSections, inferProjectType,
  normalizeStage, priceForMargin, resolveExpenses, roundUpPrice, sectionNumber, timelineError,
  type DocSectionKey, type ExpenseContext, type MaintenanceEquipment, type MaintenanceLevel, type ProjectExpense, type ProjectStage, type Sector, type TimelinePhase,
} from "@/lib/project-templates";
import { mergeSpecLibrary, specClausesFor, suggestSpec, type SpecChoice } from "@/lib/spec-library";

const STEPS = [
  { title: "ข้อมูลโครงการ" },
  { title: "รายการและต้นทุน" },
  { title: "แผนงานและงวดงาน" },
  { title: "รายละเอียดโครงการ" },
  { title: "ทีมงานและตรวจทาน" },
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
const laborUnitCost = (l: any) => (l.type === "per-point" ? (Number(l.materialCost) || 0) + (Number(l.laborCost) || 0) : Number(l.cost) || 0);

export default function NewProjectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, companyId, role, roles } = useAuth();
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
  const [manualTypeCode, setManualTypeCode] = useState<ProjectTypeCode | null>(null); // ว่าง = ให้ระบบเลือกจากรายการ
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
  const [expenseRows, setExpenseRows] = useState<ProjectExpense[] | null>(null); // null = ชุดมาตรฐาน (อัตโนมัติทุกแถว)
  const [targetMargin, setTargetMargin] = useState(10);
  const [quotation, setQuotation] = useState<{ id: string; docNo: string } | null>(null);
  const [quoting, setQuoting] = useState(false);

  // ---------- 3: แผนงาน ----------
  const [timelineEdited, setTimelineEdited] = useState<TimelinePhase[] | null>(null); // null = ตามรูปแบบงาน

  // ---------- 4: รายละเอียดโครงการ ----------
  const [docEdited, setDocEdited] = useState<Partial<Record<DocSectionKey, string>>>({}); // หัวข้อที่แก้เอง/AI
  const [docSource, setDocSource] = useState<Partial<Record<DocSectionKey, DocSource>>>({});
  const [aiNotes, setAiNotes] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [productSpecs, setProductSpecs] = useState<Record<string, string>>({});
  const [specUser, setSpecUser] = useState<Record<string, SpecChoice>>({}); // รูปแบบสเปกที่ผู้ใช้เลือกเอง (lineId)

  // ---------- โครงการบำรุงรักษาต่อจากโครงการเดิม (?maintenanceFrom=<id เอกสารโครงการ>) ----------
  const [maintSource, setMaintSource] = useState<{ docId: string; projectId: string; name: string; equipment: MaintenanceEquipment[] } | null>(null);
  const [maintLevel, setMaintLevel] = useState<MaintenanceLevel>(1);
  const [maintRounds, setMaintRounds] = useState(4);
  const [maintSelected, setMaintSelected] = useState<Set<string>>(new Set());

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
  const projectTypeCode: ProjectTypeCode | null = typeAuto ? inferredType ?? manualTypeCode : manualTypeCode;

  const isGov = sectorType === "Government";
  const stage: ProjectStage = isGov ? projectStage : "CONTRACTED";
  const durationDays = daysBetween(startDate, endDate);

  // ค่าใช้จ่าย: อัตราอัตโนมัติคำนวณจากต้นทุนอุปกรณ์/ค่าแรง รูปแบบงาน และระยะเวลา
  const directBudget = useMemo(() => computeProjectBudget(lines, { startDate, endDate }), [lines, startDate, endDate]);
  const expenseCtx: ExpenseContext = useMemo(() => ({
    sector: sectorType, typeCode: projectTypeCode, equipCost: directBudget.equipCost, laborCost: directBudget.laborCost, durationDays,
  }), [sectorType, projectTypeCode, directBudget.equipCost, directBudget.laborCost, durationDays]);
  const expenses = useMemo(() => resolveExpenses(expenseRows ?? defaultExpenses(expenseCtx), expenseCtx), [expenseRows, expenseCtx]);

  const budget = useMemo(() => computeProjectBudget(lines, { startDate, endDate, expenses }), [lines, startDate, endDate, expenses]);
  const expenseAmounts = useMemo(() => Object.fromEntries(budget.expenseLines.map((e) => [e.id, e.amount])), [budget.expenseLines]);
  const contractValue = budget.grandTotalWithVat;
  const fiscalYear = govFiscalYear ?? fiscalYearOf(startDate);
  const budgetAmount = isGov && govBudgetAmount > 0 ? govBudgetAmount : contractValue;
  const overBudget = isGov && govBudgetAmount > 0 && contractValue > govBudgetAmount + 0.009;
  const overRefPrice = isGov && govReferencePrice > 0 && contractValue > govReferencePrice + 0.009;
  const suggestedPrice = priceForMargin(budget.equipCost, budget.laborCost, expenses, targetMargin);

  const autoTimeline = useMemo(() => defaultTimeline(projectTypeCode, startDate, endDate), [projectTypeCode, startDate, endDate]);
  const timeline = timelineEdited ?? autoTimeline;

  const docDefs = useMemo(() => docSectionsFor(sectorType), [sectorType]);
  // คลังคุณลักษณะเฉพาะ: แม่แบบมาตรฐาน + ฉบับของบริษัท, จับคู่กับรายการอัตโนมัติ (เลือกเองได้)
  const { data: companySpecDocs } = useRealtimeCollection<any>(currentCompanyId ? `companies/${currentCompanyId}/spec_templates` : "");
  const specLibrary = useMemo(() => mergeSpecLibrary(companySpecDocs), [companySpecDocs]);
  const specRows: SpecRow[] = useMemo(
    () => lines.filter((l) => l.kind !== "GROUP" && l.name).map((l) => ({ lineId: l.lineId, name: l.name, kind: l.kind, qty: l.qty, unit: l.unit })),
    [lines]
  );
  const specChoices = useMemo(() => Object.fromEntries(specRows.map((r) => [r.lineId, specUser[r.lineId] ?? suggestSpec(r.name, r.kind, specLibrary)])) as Record<string, SpecChoice | null>, [specRows, specUser, specLibrary]);
  const specClauses = useMemo(() => Object.fromEntries(Object.entries(specChoices).map(([k, c]) => [k, specClausesFor(c, specLibrary)])), [specChoices, specLibrary]);
  const specAutoIds = useMemo(() => new Set(specRows.filter((r) => !specUser[r.lineId]).map((r) => r.lineId)), [specRows, specUser]);

  const autoDoc = useMemo(() => generateAllSections({
    projectName, customerName, sector: sectorType, typeCode: projectTypeCode, stage,
    startDate, endDate, durationDays, budgetAmount, referencePrice: govReferencePrice,
    budgetSource: govBudgetSource, fiscalYear, warrantyMonths, lines, timeline, productSpecs, specClauses,
    maintenance: maintSource ? { level: maintLevel, rounds: maintRounds, sourceName: maintSource.name } : null,
  }), [projectName, customerName, sectorType, projectTypeCode, stage, startDate, endDate, durationDays, budgetAmount, govReferencePrice, govBudgetSource, fiscalYear, warrantyMonths, lines, timeline, productSpecs, specClauses, maintSource, maintLevel, maintRounds]);
  const lockedKeys = useMemo(() => new Set(docDefs.filter((d) => d.locked).map((d) => d.key)), [docDefs]);
  const docSections = useMemo(() => {
    const out = { ...autoDoc } as Record<DocSectionKey, string>;
    Object.entries(docEdited).forEach(([k, v]) => { if (!lockedKeys.has(k as DocSectionKey) && v !== undefined) out[k as DocSectionKey] = v; });
    return out;
  }, [autoDoc, docEdited, lockedKeys]);

  // สเปกจากทะเบียนสินค้า ใช้สร้างคุณลักษณะเฉพาะเมื่อรายการไม่มีรายละเอียด
  const productIdsKey = Array.from(new Set(documentItems.map((i: any) => i.productId).filter(Boolean))).sort().join("|");
  useEffect(() => {
    if (!currentCompanyId || !productIdsKey) return;
    const missing = productIdsKey.split("|").filter((id) => !(id in productSpecs));
    if (!missing.length) return;
    Promise.all(missing.map((id) => getDoc(doc(db, `companies/${currentCompanyId}/products`, id)).then((s) => [id, String(s.data()?.technicalSpecs || "")] as const).catch(() => [id, ""] as const)))
      .then((pairs) => setProductSpecs((prev) => ({ ...prev, ...Object.fromEntries(pairs) })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCompanyId, productIdsKey]);

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
      setManualTypeCode([1, 2, 3, 4].includes(Number(d.projectTypeCode)) ? (Number(d.projectTypeCode) as ProjectTypeCode) : null);
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
      if (Array.isArray(d.expenses) && d.expenses.length) setExpenseRows(d.expenses);
      if (d.targetMargin) setTargetMargin(Number(d.targetMargin));
      if (Array.isArray(d.milestones) && d.milestones.length) {
        setTimelineEdited(d.milestones.map((m: any) => ({ id: m.id, name: m.name, startDate: m.startDate, endDate: m.endDate, weight: Number(m.weight) || 0 })));
      }
      // ข้อความที่บันทึกไว้เป็นของโครงการนี้: ถือเป็นฉบับแก้ไข (ไม่ถูกสร้างทับ)
      // หัวข้ออัตโนมัติสร้างใหม่ตามข้อมูลล่าสุด (บันทึกรุ่นเก่าที่ไม่มี docSources ถือว่าแก้เองทั้งหมด)
      const sources: Record<string, DocSource> = d.docSources && typeof d.docSources === "object" ? d.docSources : {};
      const savedDoc = Object.fromEntries(Object.entries(d.docSections || {})
        .filter(([k, v]) => String(v || "").trim() && (!d.docSources || sources[k] === "edited" || sources[k] === "ai"))) as Partial<Record<DocSectionKey, string>>;
      setDocEdited(savedDoc);
      setDocSource(Object.fromEntries(Object.keys(savedDoc).map((k) => [k, sources[k] || "edited"])));
      setAiNotes(d.aiNotes || "");
      if (d.specChoices && typeof d.specChoices === "object") setSpecUser(d.specChoices);
      if (d.maintenanceOf?.projectDocId) {
        setMaintLevel((Number(d.maintenanceOf.level) || 1) as MaintenanceLevel);
        setMaintRounds(Number(d.maintenanceOf.rounds) || 4);
        loadMaintSource(d.maintenanceOf.projectDocId, false);
      }
      if (d.quotationDocId) setQuotation({ id: d.quotationDocId, docNo: d.clientReference || d.quotationDocId });
      setVisited(new Set(STEPS.map((_, i) => i)));
      setEditLoaded(true);
    })().catch((e) => {
      console.error("load project for edit:", e);
      showToast("โหลดข้อมูลโครงการไม่สำเร็จ", true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editDocId, currentCompanyId]);

  // ---------- โครงการบำรุงรักษา: โหลดอุปกรณ์จากโครงการเดิม ----------
  const loadMaintSource = async (sourceDocId: string, prefill: boolean) => {
    try {
      const snap = await getDoc(doc(db, `companies/${currentCompanyId}/projects`, sourceDocId));
      if (!snap.exists()) return showToast("ไม่พบโครงการต้นทาง", true);
      const src: any = snap.data();
      const equipment: MaintenanceEquipment[] = (Array.isArray(src.items) ? src.items : [])
        .filter((l: any) => (l.kind || "PRODUCT") === "PRODUCT" && !l.isOptional && l.name && Number(l.qty) > 0)
        .map((l: any, i: number) => ({ lineId: String(l.lineId || `L${i + 1}`), name: l.name, qty: Number(l.qty) || 0, unit: l.unit || "ชิ้น", unitPrice: Number(l.unitPrice ?? l.price) || 0 }));
      const srcName = src.projectName || src.title || "";
      setMaintSource({ docId: sourceDocId, projectId: src.projectId || sourceDocId, name: srcName, equipment });
      setMaintSelected(new Set(equipment.map((e) => e.lineId)));
      if (!prefill) return;
      setSectorType(src.sectorType === "Private" ? "Private" : "Government");
      setSelectedCustomerId(src.customerId || "");
      setProjectName(`บำรุงรักษา${srcName}`);
      setManualTypeCode(2);
      setTypeAuto(false);
      setClientReference(src.projectId || sourceDocId);
      setSiteLocation(src.siteLocation || "");
      setSiteContactName(src.siteContact?.name || "");
      setSiteContactPhone(src.siteContact?.phone || "");
      setWarrantyMonths(0);
      const after = src.endDate && src.endDate >= today() ? addDays(src.endDate, 1) : today();
      setStartDate(after);
      setEndDate(addDays(after, 364));
      setProjectLabors(buildMaintenanceLabors(equipment, 1, 4, 1));
      showToast(`นำอุปกรณ์ ${equipment.length} รายการจากโครงการ ${src.projectId || ""} มาตั้งโครงการบำรุงรักษาแล้ว`, false);
    } catch (e) {
      console.error("load maintenance source:", e);
      showToast("โหลดโครงการต้นทางไม่สำเร็จ", true);
    }
  };
  useEffect(() => {
    const from = searchParams?.get("maintenanceFrom");
    if (!from || !currentCompanyId || editDocId) return;
    loadMaintSource(from, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, currentCompanyId]);
  const regenerateMaintenance = () => {
    if (!maintSource) return;
    const chosen = maintSource.equipment.filter((e) => maintSelected.has(e.lineId));
    if (!chosen.length) return showToast("กรุณาเลือกอุปกรณ์อย่างน้อย 1 รายการ", true);
    setProjectLabors((prev) => [...prev.filter((l: any) => !l.maint && !String(l.id).startsWith("MT-")), ...buildMaintenanceLabors(chosen, maintLevel, maintRounds, Math.max(1, durationDays) / 365)]);
    setTimelineEdited(null);
    showToast(`สร้างรายการบำรุงรักษา ${chosen.length} อุปกรณ์ × ${maintRounds} ครั้ง แล้ว`, false);
  };

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
        setQuotation({ id: headerSnap.id, docNo });
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
    if (i === 1) {
      if (budget.equipCount + budget.laborCount === 0) return "กรุณาเพิ่มรายการสินค้าหรืองานบริการอย่างน้อย 1 รายการ";
      if (!projectTypeCode) return "กรุณาเลือกรูปแบบงาน";
    }
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

  // ---------- ปรับราคาขายให้ได้กำไรตามเป้า แล้วปัดราคาต่อหน่วยขึ้นเป็นเลขกลม ----------
  const applyTargetMargin = () => {
    if (!(suggestedPrice > 0)) {
      showToast("คำนวณราคาไม่ได้ — ตรวจสอบต้นทุนและอัตรากำไร/ค่าใช้จ่าย (รวมกันต้องน้อยกว่า 100%)", true);
      return;
    }
    let items = documentItems;
    let labors = projectLabors;
    for (let pass = 0; pass < 4; pass++) {
      const b = computeProjectBudget([...items.map(normalizeItemLine), ...labors.map(normalizeLaborLine)], { expenses });
      const target = priceForMargin(b.equipCost, b.laborCost, expenses, targetMargin);
      if (b.totalRev > 0) {
        const k = target / b.totalRev;
        if (Math.abs(k - 1) < 1e-6) break;
        items = items.map((it) => (it.itemType === "GROUP_HEADER" ? it : { ...it, price: (Number(it.price) || 0) * k }));
        labors = labors.map((l) => ({ ...l, price: (Number(l.price) || 0) * k }));
      } else if (b.totalCost > 0) {
        const k = target / b.totalCost;
        items = items.map((it) => (it.itemType === "GROUP_HEADER" ? it : { ...it, price: (Number(it.cost) || 0) * k }));
        labors = labors.map((l) => ({ ...l, price: laborUnitCost(l) * k }));
      } else break;
    }
    // ราคาต่อหน่วยเป็นเลขกลม (ปัดขึ้น กำไรไม่ต่ำกว่าเป้า)
    items = items.map((it) => (it.itemType === "GROUP_HEADER" ? it : { ...it, price: roundUpPrice(it.price) }));
    labors = labors.map((l) => ({ ...l, price: roundUpPrice(l.price) }));
    setDocumentItems(items);
    setProjectLabors(labors);
    showToast(`ปรับราคาขายให้ได้กำไรสุทธิไม่ต่ำกว่า ${targetMargin}% และปัดราคาต่อหน่วยเป็นเลขกลมแล้ว`, false);
  };

  // ---------- ออก/ปรับปรุงใบเสนอราคาจากรายการ ----------
  const issueQuotation = async () => {
    if (!can(roles, "sales:edit")) return showToast("บัญชีของคุณไม่มีสิทธิ์ออกใบเสนอราคา", true);
    if (selectedCustomerId.trim().length < 2) { setStep(0); return showToast("กรุณาระบุลูกค้าก่อนออกใบเสนอราคา", true); }
    if (budget.equipCount + budget.laborCount === 0) return showToast("กรุณาเพิ่มรายการสินค้าหรืองานบริการก่อน", true);
    const docDate = today();
    const vat = r2(budget.totalRev * 0.07);
    const qLines = [
      ...documentItems.map((it: any) => ({
        itemType: it.itemType || "PRODUCT", productId: it.productId || "", sku: it.sku || "", productName: it.name || "",
        description: it.details || "", details: it.details || "", qty: Number(it.qty) || 0, uom: it.unit || "ชิ้น",
        costPrice: Number(it.cost) || 0, unitPrice: Number(it.price) || 0,
        discountType: it.discountType || "PERCENT", discountValue: Number(it.discountValue) || 0, whtRate: Number(it.whtRate) || 0, isOptional: !!it.isOptional,
      })),
      ...projectLabors.filter((l: any) => l.name).map((l: any) => ({
        itemType: "LABOR", productName: l.name, description: "", qty: l.type === "per-point" ? Number(l.points) || 1 : 1,
        uom: l.type === "per-point" ? "จุด" : "งาน", costPrice: laborUnitCost(l), unitPrice: Number(l.price) || 0,
        discountType: "PERCENT", discountValue: 0, whtRate: 3,
      })),
    ];
    const header = {
      docDate, date: docDate, validUntil: addDays(docDate, 30), validDays: 30,
      customerId: isNewCustomer ? "" : selectedCustomerId, customerName,
      customerSnapshot: { customerId: isNewCustomer ? "" : selectedCustomerId, name: customerName },
      projectName, quotationType: "PROJECT", taxType: "EXCLUSIVE", currency: "THB", exchangeRate: 1,
      subTotal: budget.totalRev, netTotal: budget.totalRev, vatAmount: vat, grandTotal: r2(budget.totalRev + vat), netPayable: r2(budget.totalRev + vat),
      docDiscountType: "PERCENT", docDiscountValue: 0, docDiscountAmount: 0, discountTotal: 0,
      referenceNo: isGov ? govEgpNo || govTorDocNo : pvtCustomerPO,
      internalNotes: `สร้างจากหน้าสร้างโครงการ${projectId ? ` ${projectId}` : ""}`,
    };
    try {
      setQuoting(true);
      const res = await apiFetch(quotation ? `/api/quotations/${encodeURIComponent(quotation.id)}/save` : "/api/quotations/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: currentCompanyId, submit: false, header, lines: qLines, ...(isNewCustomer ? { newCustomer: { name: customerName } } : {}) }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "ออกใบเสนอราคาไม่สำเร็จ");
      const q = { id: quotation?.id || data.id, docNo: data.docNo || quotation?.docNo || "" };
      setQuotation(q);
      setClientReference(q.docNo);
      if (isNewCustomer && data.customerId) setSelectedCustomerId(data.customerId); // ลูกค้าถูกสร้างแล้ว ไม่สร้างซ้ำตอนบันทึกโครงการ
      showToast(quotation ? `ปรับปรุงใบเสนอราคา ${q.docNo} ตามรายการล่าสุดแล้ว` : `ออกใบเสนอราคา ${q.docNo} (ฉบับร่าง) แล้ว`, false);
    } catch (e: any) {
      showToast(e.message || "ออกใบเสนอราคาไม่สำเร็จ", true);
    } finally {
      setQuoting(false);
    }
  };

  // ---------- ให้ AI ช่วยเรียบเรียงรายละเอียดโครงการ ----------
  const runAi = async () => {
    if (!projectName.trim()) return showToast("กรุณาระบุชื่อโครงการก่อน", true);
    const targets = docDefs.filter((d) => d.ai && AI_DOC_KEYS.includes(d.key));
    try {
      setAiBusy(true);
      const res = await apiFetch("/api/ai/project-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: currentCompanyId,
          notes: aiNotes,
          project: {
            projectName, customer: customerName, sector: isGov ? "ภาครัฐ" : "เอกชน",
            projectType: PROJECT_TYPES.find((t) => t.code === projectTypeCode)?.label || "-", stage,
            durationDays, siteLocation, timeline: timeline.map((p) => p.name),
            lines: lines.filter((l) => l.name && !l.isOptional).map((l) => ({
              kind: l.kind, name: l.name, qty: l.qty, unit: l.unit,
              details: [l.details || (l.productId && productSpecs[l.productId]) || "", ...(specClauses[l.lineId] || [])].filter(Boolean).join("\n"),
            })),
          },
          sections: Object.fromEntries(targets.map((d) => [d.key, { number: sectionNumber(sectorType, d.key), title: d.title, current: docSections[d.key] }])),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "AI เรียบเรียงไม่สำเร็จ");
      const got = data.sections as Partial<Record<DocSectionKey, string>>;
      setDocEdited((prev) => ({ ...prev, ...got }));
      setDocSource((prev) => ({ ...prev, ...Object.fromEntries(Object.keys(got).map((k) => [k, "ai"])) }));
      showToast(`AI เรียบเรียง ${Object.keys(got).length} หัวข้อแล้ว ตรวจทานก่อนบันทึก`, false);
    } catch (e: any) {
      showToast(e.message || "AI เรียบเรียงไม่สำเร็จ", true);
    } finally {
      setAiBusy(false);
    }
  };

  // ---------- บันทึก ----------
  const canCreate = can(roles, "projects:edit");
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
        quotationDocId: quotation?.id || "",
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
        docSources: docSource,
        aiNotes,
        specChoices: Object.fromEntries(Object.entries(specChoices).filter(([, c]) => c)),
        maintenanceOf: maintSource ? { projectDocId: maintSource.docId, projectId: maintSource.projectId, projectName: maintSource.name, level: maintLevel, rounds: maintRounds } : null,
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
  const segLabel = (text: string, extra?: React.ReactNode) => (
    <label className="text-[12px] font-bold text-white/70 ml-1 flex items-center gap-1.5 min-h-[18px]">{text}{extra}</label>
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
  const row = (children: React.ReactNode) => <div className="flex flex-wrap gap-3">{children}</div>;
  const typeLabel = PROJECT_TYPES.find((t) => t.code === projectTypeCode)?.label || "ยังไม่เลือก";
  const typeConfig = projectTypeCode ? PROJECT_TYPE_CONFIGS[projectTypeCode] : null;
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
  const maintDef = MAINTENANCE_LEVELS.find((l) => l.code === maintLevel) || MAINTENANCE_LEVELS[0];
  const maintenanceCard = maintSource && (
    <GlassCard className="p-5 space-y-3 border-nexus-blue/25">
      {cardTitle(<Wrench size={16} className="text-nexus-blue" />, `บำรุงรักษาอุปกรณ์จากโครงการ ${maintSource.projectId}`,
        <span className="text-[11px] text-white/40 truncate max-w-[50%]" title={maintSource.name}>{maintSource.name}</span>)}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          {segLabel("ระดับการบำรุงรักษา")}
          <div className="flex gap-2 flex-wrap">
            {MAINTENANCE_LEVELS.map((l) => (
              <button key={l.code} type="button" onClick={() => setMaintLevel(l.code)} className={segBtn(maintLevel === l.code)} title={l.duties.join("\n")}>
                {l.code}. {l.label}
              </button>
            ))}
          </div>
        </div>
        <Field label="จำนวนครั้งตลอดสัญญา" w={140}>
          <NumCell value={maintRounds} onChange={(v) => setMaintRounds(Math.min(52, Math.max(1, Math.round(v))))} suffix="ครั้ง" />
        </Field>
      </div>
      <p className="text-[12px] text-white/45 ml-1">
        ค่าบริการต่อปี {maintDef.annualRate}% ของมูลค่าอุปกรณ์{maintDef.sparePct > 0 && ` + สำรองอะไหล่ ${maintDef.sparePct}%`} · ปรับราคาได้ที่ขั้นรายการและต้นทุน
      </p>
      {maintSource.equipment.length === 0 ? (
        <p className="text-[13px] text-white/40">โครงการต้นทางไม่มีรายการอุปกรณ์</p>
      ) : (
        <div className="space-y-1">
          {maintSource.equipment.map((e) => {
            const on = maintSelected.has(e.lineId);
            return (
              <button key={e.lineId} type="button" onClick={() => setMaintSelected((prev) => { const n = new Set(prev); if (n.has(e.lineId)) n.delete(e.lineId); else n.add(e.lineId); return n; })}
                className={cn("w-full grid grid-cols-[20px_minmax(0,1fr)_100px_140px] gap-2 items-center px-3 py-1.5 rounded-xl border text-left text-[13px]",
                  on ? "border-nexus-teal/30 bg-nexus-teal/5 text-white" : "border-white/5 text-white/40")}>
                <span className={cn("w-4 h-4 rounded border flex items-center justify-center", on ? "bg-nexus-teal border-nexus-teal text-black" : "border-white/30")}>{on && <Check size={11} />}</span>
                <span className="truncate" title={e.name}>{e.name}</span>
                <span className="text-right font-mono">{e.qty.toLocaleString("th-TH")} {e.unit}</span>
                <span className="text-right font-mono">{baht(e.qty * e.unitPrice)}</span>
              </button>
            );
          })}
        </div>
      )}
      <div className="flex justify-end">
        <PillButton variant="confirm" onClick={regenerateMaintenance} className="h-9 px-4 text-xs font-bold">
          <Sparkles size={13} className="mr-1.5" /> สร้างรายการบำรุงรักษา
        </PillButton>
      </div>
    </GlassCard>
  );

  const stepGeneral = (
    <div className="space-y-4">
      {maintenanceCard}
      <GlassCard className="p-5 space-y-4">
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <div className="space-y-1.5">
            {segLabel("ประเภทลูกค้า")}
            <div className="flex gap-2">
              <button type="button" onClick={() => setSectorType("Government")} className={segBtn(isGov)}><Landmark size={14} /> ภาครัฐ</button>
              <button type="button" onClick={() => setSectorType("Private")} className={segBtn(!isGov)}><Store size={14} /> เอกชน</button>
            </div>
          </div>
          {isGov && (
            <div className="space-y-1.5 min-w-0">
              {segLabel("ขั้นของโครงการ")}
              <div className="flex gap-2 flex-wrap">
                {PROJECT_STAGES.map((s) => (
                  <button key={s.code} type="button" onClick={() => setProjectStage(s.code)} className={segBtn(projectStage === s.code)} title={s.hint}>{s.label}</button>
                ))}
              </div>
            </div>
          )}
        </div>
        {isGov && <p className="text-[12px] text-white/45 -mt-2 ml-1">{PROJECT_STAGES.find((s) => s.code === projectStage)?.hint}</p>}

        {row(<>
          <Field label="ชื่อโครงการ" required w={320} grow>
            <PillInput value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="เช่น จัดซื้อพร้อมติดตั้งระบบกล้องโทรทัศน์วงจรปิด อาคาร B" className="w-full h-9 text-sm font-bold" />
          </Field>
          <Field label={isGov ? "หน่วยงาน / ลูกค้า" : "ลูกค้า"} required w={260} grow>
            <SmartSelect
              options={customerOptions}
              value={selectedCustomerId}
              onChange={(val) => setSelectedCustomerId(val)}
              placeholder={isGov ? "ค้นหา หรือพิมพ์ชื่อหน่วยงานใหม่..." : "ค้นหา หรือพิมพ์ชื่อลูกค้าใหม่..."}
            />
          </Field>
        </>)}

        <div className="space-y-1.5">
          {segLabel("รูปแบบงาน", typeAuto
            ? <span className="text-[11px] font-bold text-nexus-teal flex items-center gap-1"><Sparkles size={11} /> {inferredType ? "เลือกจากรายการสินค้า/บริการ" : "ยังไม่เลือก — เลือกเอง หรือระบบเลือกให้เมื่อเพิ่มรายการ"}</span>
            : <button type="button" onClick={() => setTypeAuto(true)} className="text-[11px] font-bold text-white/50 hover:text-nexus-teal">ให้ระบบเลือกจากรายการ</button>)}
          <div className="flex gap-2 flex-wrap">
            {PROJECT_TYPES.map((t) => (
              <button key={t.code} type="button" onClick={() => { setManualTypeCode(t.code); setTypeAuto(false); }} className={segBtn(projectTypeCode === t.code)}>{t.label}</button>
            ))}
          </div>
        </div>

        {row(<>
          <Field label="วันที่เริ่ม" required w={FIELD_W.date}>
            <PillInput type="date" value={startDate} onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              setEndDate(addDays(v, Math.max(1, durationDays) - 1)); // คงระยะเวลาเดิม
              setStartDate(v);
            }} className="w-full h-9 text-sm font-mono px-4" />
          </Field>
          <Field label="วันที่ส่งมอบ" required w={FIELD_W.date}>
            <PillInput type="date" value={endDate} onChange={(e) => e.target.value && setEndDate(e.target.value)} className="w-full h-9 text-sm font-mono px-4" />
          </Field>
          <Field label="ระยะเวลา" w={FIELD_W.days}>
            <NumCell value={durationDays} onChange={(v) => setEndDate(addDays(startDate, Math.max(1, Math.round(v)) - 1))} suffix="วัน" />
          </Field>
          <Field label="รับประกัน" w={FIELD_W.months}>
            <NumCell value={warrantyMonths} onChange={(v) => setWarrantyMonths(Math.min(120, Math.round(v)))} suffix="เดือน" />
          </Field>
          <Field label="ความสำคัญ" w={136}>
            <PillSelect value={projectPriority} onChange={(e) => setProjectPriority(e.target.value)} className="w-full h-9 text-sm">
              <option value="ทั่วไป">ทั่วไป</option>
              <option value="ปานกลาง">ปานกลาง</option>
              <option value="เร่งด่วน">เร่งด่วน</option>
              <option value="วิกฤต">วิกฤต</option>
            </PillSelect>
          </Field>
          <Field label="ใบเสนอราคาอ้างอิง" w={FIELD_W.code} grow>
            <PillInput value={clientReference} onChange={(e) => setClientReference(e.target.value)} placeholder="เลขที่ใบเสนอราคา" className="w-full h-9 text-sm font-mono" />
          </Field>
        </>)}
      </GlassCard>

      <GlassCard className="p-5 space-y-3">
        {cardTitle(<Receipt size={16} className="text-nexus-teal" />, isGov ? "งบประมาณและการจัดซื้อจัดจ้าง" : "เงื่อนไขการว่าจ้าง")}
        {isGov ? (
          <>
            {row(<>
              <Field label="ปีงบประมาณ" w={FIELD_W.year}>
                <NumCell kind="year" value={fiscalYear} onChange={(v) => setGovFiscalYear(Math.round(v) || null)} />
              </Field>
              <Field label="แหล่งงบประมาณ" w={196}>
                <PillSelect value={govBudgetSource} onChange={(e) => setGovBudgetSource(e.target.value)} className="w-full h-9 text-sm">
                  {BUDGET_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                </PillSelect>
              </Field>
              <Field label="วงเงินงบประมาณ (บาท)" w={FIELD_W.money} extra={govBudgetAmount === 0 && contractValue > 0 ? <span className="text-[11px] text-white/40 font-normal">= มูลค่าโครงการ</span> : null}>
                <NumCell kind="money" value={govBudgetAmount || r2(contractValue)} onChange={(v) => setGovBudgetAmount(v)} warn={overBudget} />
              </Field>
              <Field label="ราคากลาง (บาท)" w={FIELD_W.money}>
                <NumCell kind="money" value={govReferencePrice} onChange={(v) => setGovReferencePrice(v)} warn={overRefPrice} />
              </Field>
              <Field label="วิธีจัดซื้อจัดจ้าง" w={280} grow>
                <PillSelect value={govMethod} onChange={(e) => setGovMethod(e.target.value)} className="w-full h-9 text-sm">
                  {PROCUREMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </PillSelect>
              </Field>
            </>)}
            {row(<>
              <Field label="เลขที่โครงการ (e-GP)" w={FIELD_W.code} grow>
                <PillInput value={govEgpNo} onChange={(e) => setGovEgpNo(e.target.value)} placeholder="ระบุเมื่อประกาศ" className="w-full h-9 text-sm font-mono" />
              </Field>
              <Field label="เลขที่สัญญา" w={140} grow>
                <PillInput value={govContractNo} onChange={(e) => setGovContractNo(e.target.value)} disabled={stage !== "CONTRACTED"} placeholder={stage === "CONTRACTED" ? "เช่น 15/2569" : "เมื่อได้งาน"} className="w-full h-9 text-sm font-mono" />
              </Field>
              <Field label="เลขที่ TOR / ประกาศ" w={FIELD_W.code} grow>
                <PillInput value={govTorDocNo} onChange={(e) => setGovTorDocNo(e.target.value)} placeholder="เช่น TOR-2569-015" className="w-full h-9 text-sm font-mono" />
              </Field>
              <Field label="มูลค่าโครงการ (รวม VAT)" w={200} grow>
                <div className={cn("h-9 px-4 rounded-full border flex items-center justify-end text-[13px] font-mono font-bold",
                  overBudget || overRefPrice ? "border-warning/40 bg-warning/10 text-warning" : "border-white/10 bg-white/[0.02] text-white/80")}>
                  {baht(contractValue)}
                </div>
              </Field>
            </>)}
            {(overBudget || overRefPrice) && (
              <p className="text-[12px] text-warning flex items-center gap-1.5">
                <AlertCircle size={13} /> มูลค่าโครงการสูงกว่า{overBudget ? "วงเงินงบประมาณ" : "ราคากลาง"} — ปรับราคาที่ขั้น &ldquo;รายการและต้นทุน&rdquo;
              </p>
            )}
          </>
        ) : (
          row(<>
            <Field label="เลขที่ใบสั่งซื้อ (PO)" w={FIELD_W.code}>
              <PillInput value={pvtCustomerPO} onChange={(e) => setPvtCustomerPO(e.target.value)} placeholder="เช่น PO-2026-9912" className="w-full h-9 text-sm font-mono" />
            </Field>
            <Field label="เงื่อนไขการชำระเงิน" w={300} grow>
              <PillInput value={pvtPaymentTerms} onChange={(e) => setPvtPaymentTerms(e.target.value)} placeholder="เว้นว่าง = ตามงวดงาน" className="w-full h-9 text-sm" />
            </Field>
          </>)
        )}
      </GlassCard>

      <GlassCard className="p-5 space-y-3">
        {cardTitle(<MapPin size={16} className="text-nexus-blue" />, "สถานที่และผู้ติดต่อหน้างาน")}
        {row(<>
          <Field label="สถานที่ดำเนินงาน" w={280} grow>
            <PillInput value={siteLocation} onChange={(e) => setSiteLocation(e.target.value)} placeholder="อาคาร / ชั้น / ที่อยู่ หรือลิงก์แผนที่" className="w-full h-9 text-sm" />
          </Field>
          <Field label="ผู้ติดต่อ" w={180} grow>
            <PillInput value={siteContactName} onChange={(e) => setSiteContactName(e.target.value)} placeholder="ชื่อ-นามสกุล" className="w-full h-9 text-sm" />
          </Field>
          <Field label="เบอร์โทร" w={FIELD_W.phone}>
            <PillInput value={siteContactPhone} onChange={(e) => setSiteContactPhone(e.target.value)} placeholder="08x-xxx-xxxx" className="w-full h-9 text-sm font-mono" />
          </Field>
        </>)}

        <div className="pt-3 border-t border-white/10 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-bold text-white flex items-center gap-1.5"><UserCheck size={14} className="text-nexus-teal" /> ผู้ประสานงาน / {isGov ? "กรรมการตรวจรับ" : "ผู้ติดตามหน้างาน"} ({projectFollowers.length} คน)</span>
            <PillButton variant="glass" onClick={() => setProjectFollowers((prev) => [...prev, { id: `FOL-${Date.now()}`, name: "", role: isGov ? "กรรมการตรวจรับพัสดุ" : "ผู้ประสานงานหน้างาน", phone: "", note: "" }])} className="h-8 px-3 text-xs font-bold text-nexus-teal border-nexus-teal/30">+ เพิ่มรายชื่อ</PillButton>
          </div>
          {projectFollowers.map((fol) => {
            const upd = (field: string, value: string) => setProjectFollowers((prev) => prev.map((f) => (f.id === fol.id ? { ...f, [field]: value } : f)));
            return (
              <div key={fol.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_148px_minmax(0,1fr)_24px] gap-2 items-center">
                <PillInput value={fol.name} onChange={(e) => upd("name", e.target.value)} placeholder="ชื่อ-นามสกุล" className="h-9 text-sm" />
                <PillInput value={fol.role} onChange={(e) => upd("role", e.target.value)} placeholder="ตำแหน่ง / บทบาท" className="h-9 text-sm" />
                <PillInput value={fol.phone} onChange={(e) => upd("phone", e.target.value)} placeholder="เบอร์โทร" className="h-9 text-sm font-mono" />
                <PillInput value={fol.note || ""} onChange={(e) => upd("note", e.target.value)} placeholder="หมายเหตุ" className="h-9 text-sm" />
                <button type="button" onClick={() => setProjectFollowers((prev) => prev.filter((f) => f.id !== fol.id))} className="justify-self-end p-1 text-white/40 hover:text-danger" title="ลบรายชื่อ"><Trash2 size={15} /></button>
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
  const laborCols = "grid grid-cols-[minmax(0,1fr)_72px_64px_100px_100px_104px_24px] 2xl:grid-cols-[minmax(0,1fr)_80px_72px_128px_128px_136px_136px_28px] gap-1.5 2xl:gap-2 items-center";
  const head = "text-[11px] font-bold text-white/45 uppercase tracking-wide";
  const hasLines = budget.equipCount + budget.laborCount > 0;

  const quotationActions = (
    <div className="flex flex-wrap items-center gap-2">
      {quotation && (
        <a href={`/sales/quotations/${encodeURIComponent(quotation.id)}`} target="_blank" rel="noreferrer" className="h-8 px-3 rounded-full border border-white/10 text-xs font-bold text-white/70 hover:text-nexus-teal flex items-center gap-1.5">
          <ExternalLink size={13} /> {quotation.docNo}
        </a>
      )}
      <PillButton variant="glass" onClick={issueQuotation} disabled={quoting || !hasLines} className="h-8 px-3 text-xs font-bold text-nexus-teal border-nexus-teal/30" title="สร้างใบเสนอราคา (ฉบับร่าง) จากรายการสินค้าและงานบริการ">
        <FileSignature size={13} className="mr-1.5" /> {quoting ? "กำลังบันทึก..." : quotation ? "ปรับปรุงใบเสนอราคา" : "ออกใบเสนอราคา"}
      </PillButton>
    </div>
  );

  const stepItems = (
    <div className="space-y-4">
      <GlassCard className="p-5 space-y-3">
        {cardTitle(<FileSpreadsheet size={16} className="text-nexus-teal" />, `สินค้าและพัสดุ (${documentItems.length} รายการ)`, quotationActions)}
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
              <span className={cn(head, "text-right pr-3")}>จำนวน</span>
              <span className={cn(head, "text-right pr-3")}>วัสดุ/หน่วย</span>
              <span className={cn(head, "text-right pr-3")}>ค่าแรง/หน่วย</span>
              <span className={cn(head, "text-right pr-3")}>ขาย/หน่วย</span>
              <span className={cn(head, "text-right hidden 2xl:block")}>รวมขาย</span>
              <span />
            </div>
            {projectLabors.map((lab) => {
              const perPoint = lab.type === "per-point";
              const qty = perPoint ? Number(lab.points) || 1 : 1;
              return (
                <div key={lab.id} className={laborCols}>
                  <PillInput value={lab.name} title={lab.name} onChange={(e) => updateLabor(lab.id, { name: e.target.value })} placeholder="เช่น เดินสาย LAN ร้อยท่อ EMT" className="h-9 text-sm px-4" />
                  <button
                    type="button"
                    onClick={() => updateLabor(lab.id, { type: perPoint ? "lump-sum" : "per-point" })}
                    title="กดเพื่อสลับ เหมาจ่าย / คิดต่อจุด"
                    className={cn("h-9 rounded-full border text-[12px] font-bold whitespace-nowrap", perPoint ? "border-nexus-blue/40 bg-nexus-blue/10 text-nexus-blue" : "border-white/10 bg-white/[0.03] text-white/70")}
                  >
                    {perPoint ? "ต่อจุด" : "เหมา"}
                  </button>
                  <NumCell value={qty} disabled={!perPoint} onChange={(v) => updateLabor(lab.id, { points: Math.max(1, Math.round(v)) })} title={perPoint ? "จำนวนจุด" : "เหมาจ่าย = 1 งาน"} />
                  <NumCell kind="money" value={Number(lab.materialCost) || 0} onChange={(v) => updateLabor(lab.id, { materialCost: v })} />
                  <NumCell kind="money" value={Number(lab.laborCost) || 0} onChange={(v) => updateLabor(lab.id, { laborCost: v })} />
                  <NumCell kind="money" value={Number(lab.price) || 0} onChange={(v) => updateLabor(lab.id, { price: v })} />
                  <span className="text-[13px] font-mono text-white text-right whitespace-nowrap hidden 2xl:block">{baht(qty * (Number(lab.price) || 0))}</span>
                  <button type="button" onClick={() => setProjectLabors((prev) => prev.filter((item) => item.id !== lab.id))} className="p-1 text-white/40 hover:text-danger justify-self-end" title="ลบรายการ"><Trash2 size={15} /></button>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      <GlassCard className="p-5 space-y-3">
        {cardTitle(<Receipt size={16} className="text-warning" />, "ค่าใช้จ่ายดำเนินงานโครงการ",
          <span className="text-[11px] text-white/40">อัตราอัตโนมัติตามขนาด รูปแบบงาน และระยะเวลาโครงการ · แก้ไขได้ทุกแถว</span>)}
        <ExpensesEditor expenses={expenses} amounts={expenseAmounts} onChange={(next) => setExpenseRows(next)} onReset={() => setExpenseRows(null)} />
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
          <Field label="กำไรสุทธิเป้าหมาย" w={136}>
            <NumCell kind="pct" value={targetMargin} onChange={(v) => setTargetMargin(Math.min(80, v))} suffix="%" />
          </Field>
          <Field label="ราคาขายที่ได้กำไรตามเป้า (ก่อน VAT)" w={260} grow>
            <div className="h-9 px-4 rounded-full border border-white/10 bg-white/[0.02] flex items-center justify-between gap-3 text-[13px]">
              <b className="font-mono text-white">{suggestedPrice > 0 ? baht(suggestedPrice) : "-"}</b>
              {suggestedPrice > 0 && budget.totalRev > 0 && (
                <span className={cn("font-mono text-[12px]", suggestedPrice >= budget.totalRev ? "text-warning" : "text-nexus-teal")}>
                  {suggestedPrice >= budget.totalRev ? "+" : ""}{baht(suggestedPrice - budget.totalRev)}
                </span>
              )}
            </div>
          </Field>
          <PillButton variant="confirm" onClick={applyTargetMargin} disabled={!(budget.totalCost > 0)} className="h-9 px-4 text-xs font-bold" title="ปรับราคาขายทุกรายการตามสัดส่วน แล้วปัดราคาต่อหน่วยขึ้นเป็นเลขกลม">
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
    <div className="space-y-4">
    <GlassCard className="p-5 space-y-3">
      {cardTitle(<ClipboardList size={16} className="text-nexus-teal" />, "รูปแบบคุณลักษณะเฉพาะของแต่ละรายการ",
        <span className="text-[11px] text-white/40">เลือกได้หลายรูปแบบต่อรายการ · ข้อความไปอยู่ในหัวข้อคุณลักษณะเฉพาะ</span>)}
      <SpecChoiceEditor
        rows={specRows}
        library={specLibrary}
        choices={specChoices}
        autoIds={specAutoIds}
        onChange={(id, c) => setSpecUser((prev) => ({ ...prev, [id]: c }))}
        onReset={(id) => setSpecUser((prev) => { const n = { ...prev }; delete n[id]; return n; })}
        manageHref={can(roles, "settings:manage") ? "/settings?tab=specs" : undefined}
      />
    </GlassCard>
    <GlassCard className="p-5 space-y-4">
      {cardTitle(<FileText size={16} className="text-nexus-teal" />, isGov ? "รายละเอียดโครงการ (ร่างขอบเขตของงาน)" : "รายละเอียดโครงการ",
        <PillButton variant="glass" onClick={() => { setDocEdited({}); setDocSource({}); }} className="h-8 px-3 text-xs font-bold text-white/60">
          <Sparkles size={13} className="mr-1" /> สร้างใหม่ทั้งหมด
        </PillButton>)}
      <p className="text-[12px] text-white/45 -mt-2">เรียงหัวข้อตามแบบ{isGov ? "ร่างขอบเขตของงาน (TOR) ภาครัฐ" : "เอกสารโครงการ"} ข้อความที่แก้ไขหรือให้ AI เรียบเรียงจะบันทึกเป็นของโครงการนี้ และไม่ถูกสร้างทับ</p>
      <DocSectionsEditor
        defs={docDefs}
        sections={docSections}
        source={docSource}
        onChange={(key, value) => { setDocEdited((prev) => ({ ...prev, [key]: value })); setDocSource((prev) => ({ ...prev, [key]: "edited" })); }}
        onRegenerate={(key) => {
          setDocEdited((prev) => { const n = { ...prev }; delete n[key]; return n; });
          setDocSource((prev) => { const n = { ...prev }; delete n[key]; return n; });
        }}
        aiNotes={aiNotes}
        onAiNotes={setAiNotes}
        onAi={runAi}
        aiBusy={aiBusy}
      />
    </GlassCard>
    </div>
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
        {row(<>
          <Field label="ผู้จัดการโครงการ" required w={240} grow>
            <PillSelect value={projectManagerUid} onChange={(e) => setProjectManagerUid(e.target.value)} className="w-full h-9 text-sm font-bold">
              <option value="">-- เลือกผู้จัดการโครงการ --</option>
              {userOptions.map((u: any) => <option key={u.uid} value={u.uid}>{u.name}</option>)}
            </PillSelect>
          </Field>
          <Field label="เพิ่มทีมงาน" w={240} grow>
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
          </Field>
        </>)}
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
            {reviewRow("ใบเสนอราคา", quotation?.docNo || clientReference)}
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
          {!typeConfig && <p className="text-[13px] text-white/40">เลือกรูปแบบงานเพื่อดูเอกสารที่ต้องใช้</p>}
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
