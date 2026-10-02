"use client";

import { useRouter, useSearchParams } from "next/navigation";
import React, { useState, useEffect, useMemo } from "react";
import { 
  Briefcase,
  ArrowLeft, 
  Search, 
  Plus, 
  Calendar,
  Users,
  BarChart3,
  ClipboardList,
  Target,
  DollarSign,
  Sparkles,
  Clock,
  ShieldCheck,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Activity,
  FileText,
  X,
  Filter,
  Trash2,
  Settings,
  Zap,
  TrendingDown,
  AlertCircle,
  Package,
  Star,
  Phone,
  Wrench,
  CheckCircle2,
  ArrowRight,
  UserCheck,
  FileSpreadsheet,
  Building2,
  Layers,
  MapPin
} from "lucide-react";
import { 
  PillButton, 
  PillInput, 
  PillSelect,
  MasterMetricCard, 
  cn, 
  Modal, 
  Toast, 
  NexusTable, 
  NexusTableRow, 
  NexusTableCell, 
  StatusBadge, 
  PillTabs,
  GlassCard,
  NexusDataField,
  NexusPageLayout
} from "@/components/ui/Base";
import { SmartSelect, StepperInput } from "@/components/ui/SmartComponents";
import { NumberStepper } from "@/components/ui/NumberStepper";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase-client";
import { doc, setDoc, getDoc, getDocs, collection, query, where, orderBy, onSnapshot, serverTimestamp, writeBatch } from "firebase/firestore";
import { generateStockPilotId } from "@/lib/utils";
import { can } from "@/lib/permissions";
import { idService } from "@/lib/idService";
import { KitEditor } from "@/components/projects/KitEditor";
import { ContractorModal } from "@/components/projects/ContractorModal";
import { DocumentItemsTable } from "@/components/commerce/DocumentItemsTable";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { ProjectTypeCode, PROJECT_TYPE_CONFIGS } from "@/types/database";
import { apiFetch } from "@/lib/api-client";



export default function NewProjectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, companyId, role } = useAuth();
  const currentCompanyId = companyId || "COMP-001";

  // Collapsible Card States (Continuous Scroll Layout)
  const [openCards, setOpenCards] = useState({
    general: true,
    boq: true,
    team: true,
    summary: true
  });

  const toggleCard = (key: keyof typeof openCards) => {
    setOpenCards(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const setAllCards = (open: boolean) => {
    setOpenCards({ general: open, boq: open, team: open, summary: open });
  };

  const [toast, setToast] = useState({ message: "", isVisible: false, isError: false });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Firestore Realtime Collections
  const customerConditions = useMemo(() => [where("companyId", "==", currentCompanyId)], [currentCompanyId]);
  const { data: rawCustomers } = useRealtimeCollection("customers", customerConditions, false);

  const [dbProducts, setDbProducts] = useState<any[]>([]);
  const [dbContractors, setDbContractors] = useState<any[]>([]);

  // 1: ข้อมูลทั่วไปของโครงการ (General Info)
  const [projectId, setProjectId] = useState<string>("");
  const [projectName, setProjectName] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [projectTypeCode, setProjectTypeCode] = useState<ProjectTypeCode>(4);
  const [projectType, setProjectType] = useState("งานขายอุปกรณ์พร้อมติดตั้งครบวงจร");
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
  const [catalogSearchQuery, setCatalogSearchQuery] = useState("");
  const [catalogActiveSubTab, setCatalogActiveSubTab] = useState<"warehouse" | "packages">("warehouse");

  // 3: จัดทีมงานและทรัพยากร (Team & Resources)
  const [projectManager, setProjectManager] = useState(user?.email?.split("@")[0] || "ผู้จัดการโครงการหลัก");
  const [assignedTeam, setAssignedTeam] = useState<any[]>([
    { id: "MEM-01", name: "วิศวกรระบบอาวุโส", role: "Lead Systems Engineer", allocation: 100 },
    { id: "MEM-02", name: "ช่างติดตั้งสายสัญญาณ", role: "Installation Technician", allocation: 80 }
  ]);
  const [activeModal, setActiveModal] = useState<string | null>(null);

  const [numberingScheme, setNumberingScheme] = useState<any>(null);

  // Auto Generate Project ID via Configurable Numbering Engine API (Dynamic reserveOn)
  useEffect(() => {
    if (!currentCompanyId) return;
    let isMounted = true;
    
    apiFetch(`/api/settings/numbering-schemes?companyId=${currentCompanyId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        const prjScheme = data.schemes?.PRJ || { reserveOn: "draft" };
        setNumberingScheme(prjScheme);
        
        // Dynamic Check: If reserveOn === "draft", reserve immediately on mount
        if (prjScheme.reserveOn === "draft") {
          idService.generateDocumentNumber("PRJ", currentCompanyId, { mnemonic: projectName || "GEN" })
            .then((res) => {
              if (isMounted && res.documentNumber) {
                setProjectId(res.documentNumber);
              }
            })
            .catch(() => {
              // ออกเลขไม่สำเร็จ: ให้ระบบออกเลขใหม่ตอนกดบันทึกแทน
              if (isMounted) setProjectId("");
            });
        } else {
          // If reserveOn === "approve", display placeholder and reserve upon submission
          setProjectId("(รออนุมัติเพื่อออกเลข)");
        }
      })
      .catch((err) => {
        console.error("Failed to fetch PRJ numbering scheme:", err);
      });

    return () => { isMounted = false; };
  }, [currentCompanyId]);

  // Load Realtime Products & Contractors
  useEffect(() => {
    if (!currentCompanyId) return;

    const qProd = query(
      collection(db, "products"),
      where("companyId", "==", currentCompanyId),
      where("isDeleted", "==", false)
    );

    const unsubProd = onSnapshot(qProd, (snapshot) => {
      const items: any[] = [];
      snapshot.forEach((docSnap) => items.push({ id: docSnap.id, ...docSnap.data() }));
      setDbProducts(items);
    });

    const qCont = query(
      collection(db, "contractors"),
      where("companyId", "==", currentCompanyId),
      where("isActive", "==", true)
    );

    const unsubCont = onSnapshot(qCont, (snapshot) => {
      const items: any[] = [];
      snapshot.forEach((docSnap) => items.push({ id: docSnap.id, ...docSnap.data() }));
      setDbContractors(items);
    });

    return () => {
      unsubProd();
      unsubCont();
    };
  }, [currentCompanyId]);

  // Handle Import from Quotation if query param present
  useEffect(() => {
    const fromQuotationId = searchParams?.get("fromQuotationId");
    if (fromQuotationId && currentCompanyId) {
      const fetchQuotationData = async () => {
        try {
          const headerRef = doc(db, `companies/${currentCompanyId}/quotations`, fromQuotationId);
          const headerSnap = await getDoc(headerRef);
          
          if (headerSnap.exists()) {
            const data = headerSnap.data();
            setProjectName(data.projectName || data.quotationNumber || "");
            setSelectedCustomerId(data.customerId || "");
            setClientReference(data.quotationNumber || "");
            
            const linesRef = collection(db, `companies/${currentCompanyId}/quotations/${fromQuotationId}/lines`);
            const linesSnap = await getDocs(linesRef);
            
            const newEquipments: any[] = [];
            const newLabors: any[] = [];
            
            linesSnap.forEach(docSnap => {
              const lineData = docSnap.data();
              const isLabor = lineData.sku?.toLowerCase().includes("lab") || 
                              lineData.productName?.includes("บริการ") || 
                              lineData.productName?.includes("ค่าแรง") || 
                              lineData.productName?.includes("ติดตั้ง");
              
              if (isLabor) {
                newLabors.push({
                  id: Date.now() + Math.random(),
                  name: lineData.productName,
                  type: "lump-sum",
                  points: lineData.qty || 1,
                  materialCost: 0,
                  laborCost: lineData.costPrice || 0,
                  price: lineData.unitPrice || 0,
                  cost: (lineData.costPrice || 0) * (lineData.qty || 1),
                  totalPrice: lineData.lineTotal || 0
                });
              } else {
                newEquipments.push({
                  id: Date.now() + Math.random(),
                  productId: lineData.productId || null,
                  name: lineData.productName,
                  sku: lineData.sku || "SKU-GENERIC",
                  qty: lineData.qty || 1,
                  unit: lineData.unit || "ชิ้น",
                  cost: lineData.costPrice || 0,
                  price: lineData.unitPrice || 0,
                  discount: lineData.discount || ""
                });
              }
            });
            
            if (newEquipments.length > 0) setDocumentItems(newEquipments);
            if (newLabors.length > 0) setProjectLabors(newLabors);
            showToast(`นำเข้าข้อมูลจากใบเสนอราคา ${data.quotationNumber} สำเร็จ`, false);
          }
        } catch (error) {
          console.error("Error fetching quotation:", error);
          showToast("ไม่สามารถนำเข้าข้อมูลจากใบเสนอราคาได้", true);
        }
      };
      
      fetchQuotationData();
    }
  }, [searchParams, currentCompanyId]);

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

  // Active Products & Kits (Strict: Zero mock fallback)
  const activeWarehouseProducts = useMemo(() => {
    if (dbProducts.length === 0) return [];
    return dbProducts.filter((p: any) => p.category_id !== "Kit" && !p.isKit).map((p: any) => ({
      id: p.id,
      sku: p.sku || "N/A",
      name: p.name || "ไม่มีชื่อพัสดุ",
      unit: p.unit ? p.unit.split(" ")[0] : "ชิ้น",
      cost: p.pricing?.costWAC || p.pricing?.avg_cost || p.cost || 0,
      price: p.pricing?.priceProject || p.pricing?.pricePOS || p.price || 0,
      qty_on_hand: p.stockStatus?.onHand ?? p.currentQty ?? 0
    }));
  }, [dbProducts]);

  // Live Budget & Financial Estimation Calculation
  const budgetSummary = useMemo(() => {
    const equipCount = documentItems.length;
    const equipTotalQty = documentItems.reduce((sum, item) => sum + (Number(item.qty) || 1), 0);
    const equipCost = documentItems.reduce((sum, item) => {
      if (item.isOptional) return sum;
      return sum + ((Number(item.cost) || 0) * (Number(item.qty) || 1));
    }, 0);
    const equipRev = documentItems.reduce((sum, item) => {
      if (item.isOptional) return sum;
      const lineTotal = (Number(item.qty) || 0) * (Number(item.price) || 0);
      let discountAmt = 0;
      if (item.discount) {
        const str = String(item.discount).trim();
        if (str.endsWith('%')) {
          const pct = Number(str.replace('%', '')) || 0;
          discountAmt = lineTotal * (pct / 100);
        } else {
          discountAmt = Number(str.replace(/,/g, '')) || 0;
        }
      }
      return sum + Math.max(0, lineTotal - discountAmt);
    }, 0);
    
    const laborCount = projectLabors.length;
    const laborTotalPoints = projectLabors.reduce((sum, item) => {
      return sum + (item.type === "per-point" ? (item.points || 1) : 1);
    }, 0);

    const laborCost = projectLabors.reduce((sum, item) => {
      if (item.type === "per-point") {
        const matCost = item.materialCost || 0;
        const labCost = item.laborCost || 0;
        const pts = item.points || 1;
        return sum + ((matCost + labCost) * pts);
      }
      return sum + (item.cost || 0);
    }, 0);

    const laborRev = projectLabors.reduce((sum, item) => {
      if (item.type === "per-point") {
        const prc = item.price || 0;
        const pts = item.points || 1;
        return sum + (prc * pts);
      }
      return sum + (item.price || 0);
    }, 0);
    
    const totalCost = equipCost + laborCost;
    const totalRev = equipRev + laborRev;
    
    // เงินสำรองฉุกเฉินและความเสี่ยงโครงการ (5% ของต้นทุนทางตรง)
    const contingencyBuffer = Math.round(totalCost * 0.05);
    const grandTotalCost = totalCost + contingencyBuffer;

    // การคำนวณกำไรและสัดส่วน
    const grossProfit = totalRev - totalCost;
    const netProfit = totalRev - grandTotalCost;
    const gpPercent = totalRev > 0 ? ((grossProfit / totalRev) * 100).toFixed(1) : "0.0";
    const netProfitPercent = totalRev > 0 ? ((netProfit / totalRev) * 100).toFixed(1) : "0.0";
    const markupPercent = totalCost > 0 ? ((grossProfit / totalCost) * 100).toFixed(1) : "0.0";
    const costToRevRatio = totalRev > 0 ? ((totalCost / totalRev) * 100).toFixed(1) : "0.0";

    // ภาษีมูลค่าเพิ่ม (7%)
    const vatAmount = Math.round(totalRev * 0.07);
    const grandTotalWithVat = totalRev + vatAmount;

    // คำนวณระยะเวลาดำเนินงาน (วัน)
    let durationDays = 1;
    if (startDate && endDate) {
      const start = new Date(startDate).getTime();
      const end = new Date(endDate).getTime();
      if (end >= start) {
        durationDays = Math.max(1, Math.ceil((end - start) / (1000 * 3600 * 24)));
      }
    }

    const revenuePerDay = Math.round(totalRev / durationDays);
    const costPerDay = Math.round(totalCost / durationDays);

    return { 
      equipCount,
      equipTotalQty,
      equipCost, 
      equipRev, 
      laborCount,
      laborTotalPoints,
      laborCost, 
      laborRev, 
      totalCost, 
      totalRev, 
      contingencyBuffer,
      grandTotalCost,
      grossProfit, 
      netProfit,
      gpPercent: parseFloat(gpPercent),
      netProfitPercent: parseFloat(netProfitPercent),
      markupPercent: parseFloat(markupPercent),
      costToRevRatio: parseFloat(costToRevRatio),
      vatAmount,
      grandTotalWithVat,
      durationDays,
      revenuePerDay,
      costPerDay
    };
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
    if (!projectManager.trim()) {
      showToast("กรุณาระบุผู้จัดการโครงการหลักที่รับผิดชอบ", true);
      return false;
    }
    return true;
  };

  // Add Equipment item to Selection List
  const handleSelectWarehouseProduct = (prod: any) => {
    setDocumentItems((prev) => {
      const existing = prev.find((item) => item.sku === prod.sku);
      if (existing) {
        return prev.map((item) => (item.sku === prod.sku ? { ...item, qty: (Number(item.qty) || 0) + 1 } : item));
      }
      return [
        ...prev,
        {
          id: Date.now() + Math.random(),
          productId: prod.id,
          name: prod.name,
          sku: prod.sku,
          qty: 1,
          unit: prod.unit || "ชิ้น",
          cost: prod.cost || 0,
          price: prod.price || 0,
          discount: ""
        }
      ];
    });
    showToast(`เพิ่มพัสดุ ${prod.name} เข้าตารางสินค้าอัจฉริยะสำเร็จ`, false);
  };

  // Add Custom Labor / Service Item
  const handleAddCustomLabor = () => {
    setProjectLabors((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: "ระบุรายการงานบริการติดตั้ง...",
        type: "lump-sum",
        points: 1,
        materialCost: 0,
        laborCost: 0,
        cost: 0,
        price: 0
      }
    ]);
  };

  // Submit & Save Project via Server-Side Atomic API (/api/projects/create)
  const handleSaveProject = async () => {
    if (!validateForm()) return;

    if (!can(role, "projects:edit")) {
      showToast("บัญชีของคุณไม่มีสิทธิ์ในการสร้างโครงการ (ต้องเป็น Role Admin/Engineer ขึ้นไป)", true);
      return;
    }

    try {
      setIsSubmitting(true);

      let finalProjectId = projectId;
      if (!finalProjectId || finalProjectId.includes("รออนุมัติ") || numberingScheme?.reserveOn === "approve") {
        const generated = await idService.generateDocumentNumber("PRJ", currentCompanyId, { mnemonic: projectName || "GEN" });
        finalProjectId = generated.documentNumber;
        setProjectId(finalProjectId);
      }

      const chosenCustomer = customerOptions.find((c: any) => c.value === selectedCustomerId);
      const custName = chosenCustomer ? chosenCustomer.label : selectedCustomerId;

      const payload = {
        companyId: currentCompanyId,
        projectId: finalProjectId,
        userRole: role,
        userId: user?.email || "SYSTEM_USER",
        projectName: projectName,
        selectedCustomerId: selectedCustomerId,
        customerName: custName,
        clientReference: clientReference,
        projectTypeCode: projectTypeCode,
        projectType: projectType,
        sectorType: sectorType,
        priority: projectPriority,
        startDate: startDate,
        endDate: endDate,
        siteLocation: siteLocation || "ไม่ได้ระบุ",
        siteContact: {
          name: siteContactName || "ไม่ระบุ",
          phone: siteContactPhone || "ไม่ระบุ"
        },
        followers: projectFollowers.filter((f) => f.name && f.name.trim() !== ""),
        projectManager: projectManager,
        items: [...documentItems, ...projectLabors],
        resources: assignedTeam.map((t) => ({ ...t, userId: t.id })),
        governmentDetails: sectorType === "Government" ? {
          torDocNo: govTorDocNo,
          referencePrice: govReferencePrice,
          govContractNo: govContractNo,
          bankGuarantee: { status: "Active" }
        } : undefined,
        privateDetails: sectorType === "Private" ? {
          customerPO: pvtCustomerPO || clientReference,
          paymentTerms: pvtPaymentTerms
        } : undefined,
        budgetSummary: budgetSummary
      };

      const res = await apiFetch("/api/projects/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const resData = await res.json();

      if (!res.ok || !resData.success) {
        throw new Error(resData.error || "เกิดข้อผิดพลาดในการบันทึกโครงการผ่านเซิร์ฟเวอร์");
      }

      const createdId = resData.projectId || projectId;
      setProjectId(createdId);
      showToast(resData.message || `สร้างโครงการ ${createdId} และส่งขออนุมัติ 3 ชั้นสำเร็จ! 🎉`, false);
      
      setTimeout(() => {
        router.push("/projects");
      }, 1200);

    } catch (err: any) {
      console.error("Error saving project to Server API:", err);
      showToast(err.message || "เกิดข้อผิดพลาดในการบันทึกโครงการ กรุณาลองใหม่อีกครั้ง", true);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Header Content
  const headerContent = (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-6 rounded-3xl backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <PillButton variant="glass" onClick={() => router.back()} className="w-10 h-10 p-0 flex items-center justify-center">
          <ArrowLeft size={20} />
        </PillButton>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-white uppercase tracking-tight">
              สร้างโครงการใหม่
            </h1>
            <span className="px-3 py-1 rounded-full bg-nexus-teal/10 border border-nexus-teal/30 text-nexus-teal text-sm font-mono font-bold select-none cursor-default pointer-events-none">
              {projectId || "PRJ-2609-0001"}
            </span>
          </div>
          <p className="text-sm text-white/60 font-medium mt-1">
            หน้าเพจสร้างโครงการแบบรวมศูนย์ เลื่อนต่อเนื่อง กำหนดงบประมาณ พัสดุ จัดทีมงาน และส่งอนุมัติ
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
        <PillButton 
          variant="glass" 
          onClick={() => setAllCards(!openCards.general)} 
          className="h-8 px-3.5 text-xs font-bold"
        >
          {openCards.general ? "พับเก็บทั้งหมด" : "ขยายทั้งหมด"}
        </PillButton>

        <PillButton 
          variant="glass" 
          onClick={() => showToast("บันทึกฉบับร่างเรียบร้อยแล้ว", false)} 
          className="h-8 px-4 text-xs font-bold text-white/80"
        >
          บันทึกฉบับร่าง
        </PillButton>

        <PillButton 
          variant="glass" 
          onClick={() => router.back()} 
          className="h-8 px-4 text-xs font-bold text-white/50"
        >
          ยกเลิก
        </PillButton>

        <PillButton 
          variant="confirm"
          onClick={handleSaveProject} 
          disabled={isSubmitting || !can(role, "projects:edit")} 
          className={cn("h-8 px-5 font-bold text-xs", !can(role, "projects:edit") && "opacity-50 cursor-not-allowed")}
          title={!can(role, "projects:edit") ? "สิทธิ์การใช้งานไม่เพียงพอ (ต้องเป็น Role Admin/Engineer ขึ้นไป)" : undefined}
        >
          {isSubmitting ? "กำลังบันทึก..." : !can(role, "projects:edit") ? "ไม่มีสิทธิ์เปิดโครงการ 🔒" : "ส่งขออนุมัติเปิดโครงการ 🚀"}
        </PillButton>
      </div>
    </div>
  );

  // Left Content - Continuous Scroll Modular Cards
  const leftContent = (
    <div className="space-y-8 pb-20">

      {/* CARD 1: ข้อมูลพื้นฐานโครงการและผู้ติดตามหน้างาน */}
      <div className="bg-neutral-900/90 border border-white/15 rounded-3xl overflow-hidden shadow-2xl transition-all border-l-4 border-l-nexus-teal hover:border-white/25">
        <div 
          onClick={() => toggleCard("general")}
          className="p-4 sm:p-5 flex items-center justify-between bg-white/[0.04] border-b border-white/10 cursor-pointer hover:bg-white/[0.08] transition-colors select-none"
        >
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-xl bg-nexus-teal/20 text-nexus-teal border border-nexus-teal/40 font-mono font-black text-xs shadow-sm">
              01
            </span>
            <div className="flex items-center gap-2 text-nexus-teal">
              <Sparkles size={20} />
              <h3 className="text-base font-bold uppercase tracking-wider text-white">
                1. ข้อมูลพื้นฐานโครงการและผู้ติดตามหน้างาน
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-2 text-white/40">
            <span className="text-xs font-medium">{openCards.general ? "ซ่อนข้อมูล" : "แสดงข้อมูล"}</span>
            {openCards.general ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </div>

        {openCards.general && (
          <div className="p-4 sm:p-5 space-y-4 animate-in fade-in duration-300">
            {/* แถวที่ 1: สวิตช์เลือกประเภทองค์กรและรูปแบบประเภทโครงการ (Compact Segment Control Bar) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 pb-3 border-b border-white/10 items-center">
              {/* ประเภทองค์กรลูกค้า (4 cols) */}
              <div className="lg:col-span-4 flex items-center justify-between gap-2 bg-black/40 p-1 rounded-full border border-white/10 h-9">
                <span className="text-xs font-bold text-white/60 pl-3 shrink-0">องค์กรลูกค้า:</span>
                <div className="flex items-center gap-1 w-full justify-end">
                  <button
                    type="button"
                    onClick={() => setSectorType("Government")}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 h-7",
                      sectorType === "Government"
                        ? "bg-nexus-teal/20 text-nexus-teal border border-nexus-teal/40 backdrop-blur-md shadow-sm"
                        : "text-white/40 hover:text-white"
                    )}
                  >
                    <span>🏛️</span> ภาครัฐ
                  </button>
                  <button
                    type="button"
                    onClick={() => setSectorType("Private")}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 h-7",
                      sectorType === "Private"
                        ? "bg-nexus-blue/20 text-nexus-blue border border-nexus-blue/40 backdrop-blur-md shadow-sm"
                        : "text-white/40 hover:text-white"
                    )}
                  >
                    <span>🏢</span> ภาคเอกชน
                  </button>
                </div>
              </div>

              {/* รูปแบบประเภทโครงการ (8 cols) */}
              <div className="lg:col-span-8 flex items-center justify-between gap-2 bg-black/40 p-1 rounded-full border border-white/10 h-9 overflow-x-auto custom-scrollbar">
                <span className="text-xs font-bold text-white/60 pl-3 shrink-0" title="กำหนดประเภทเอกสารตรวจรับและขั้นตอนการอนุมัติบังคับตามมาตรฐาน Compliance">รูปแบบการดำเนินงาน:</span>
                <div className="flex items-center gap-1 shrink-0">
                  {[
                    { code: 1, icon: "🛒", label: "ซื้อขายส่งมอบ" },
                    { code: 2, icon: "🛠️", label: "ซ่อมบำรุงรักษา" },
                    { code: 3, icon: "⚡", label: "บริการติดตั้ง" },
                    { code: 4, icon: "🚀", label: "ซื้อขายพร้อมติดตั้ง" }
                  ].map((pt) => {
                    const isSelected = projectTypeCode === pt.code;
                    return (
                      <button
                        key={pt.code}
                        type="button"
                        onClick={() => {
                          setProjectTypeCode(pt.code as ProjectTypeCode);
                          setProjectType(pt.code === 1 ? "งานซื้อขายส่งมอบสินค้า" : pt.code === 2 ? "งานซ่อมบำรุงรักษาและบริการ" : pt.code === 3 ? "งานบริการติดตั้งและผูกทีมช่าง" : "งานขายอุปกรณ์พร้อมติดตั้งครบวงจร");
                        }}
                        className={cn(
                          "px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1 h-7 whitespace-nowrap",
                          isSelected
                            ? "bg-nexus-teal/20 text-nexus-teal border border-nexus-teal/40 backdrop-blur-md shadow-sm"
                            : "text-white/40 hover:text-white"
                        )}
                      >
                        <span>{pt.icon}</span>
                        <span>{pt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* แถวที่ 2: ข้อมูลโครงการหลัก (Responsive 3-Column Grid) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              <div className="space-y-1 md:col-span-2">
                <label className="text-[12px] font-bold text-white/70 uppercase tracking-wider ml-1">
                  ชื่อโครงการ / หัวข้อการติดตั้ง <span className="text-rose-500 font-bold ml-0.5">*</span>
                </label>
                <PillInput 
                  value={projectName} 
                  onChange={(e) => setProjectName(e.target.value)} 
                  placeholder="เช่น โครงการติดตั้งระบบจอ LED Wall และระบบเครือข่าย อาคาร B" 
                  className="w-full text-white font-bold h-8 text-sm" 
                />
              </div>

              <div className="space-y-1">
                <label className="text-[12px] font-bold text-white/70 uppercase tracking-wider ml-1">
                  ชื่อลูกค้าผู้ชำระเงิน <span className="text-rose-500 font-bold ml-0.5">*</span>
                </label>
                <SmartSelect
                  options={customerOptions}
                  value={selectedCustomerId}
                  onChange={(val) => setSelectedCustomerId(val)}
                  placeholder="พิมพ์ค้นหาหรือเลือกชื่อลูกค้า..."
                  addNewLabel="เพิ่มรายชื่อลูกค้าใหม่"
                  onAddNew={() => router.push("/customers/new")}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[12px] font-bold text-white/70 uppercase tracking-wider ml-1">รหัสเอกสารอ้างอิงลูกค้า</label>
                <PillInput 
                  value={clientReference} 
                  onChange={(e) => setClientReference(e.target.value)} 
                  placeholder="เช่น PO-2026-9912 หรือ เลขที่ใบเสนอราคาอ้างอิง..." 
                  className="w-full h-8 text-sm" 
                />
              </div>

              <div className="space-y-1">
                <label className="text-[12px] font-bold text-white/70 uppercase tracking-wider ml-1">หมวดธุรกิจโครงการ</label>
                <PillSelect value={projectType} onChange={(e) => setProjectType(e.target.value)} className="w-full h-8 text-sm font-medium">
                  <option value="งานขายอุปกรณ์พร้อมติดตั้งครบวงจร">งานขายอุปกรณ์พร้อมติดตั้งครบวงจร</option>
                  <option value="งานระบบโครงสร้างและสถาปัตยกรรม">งานระบบโครงสร้างและสถาปัตยกรรม</option>
                  <option value="งานพัฒนาระบบซอฟต์แวร์">งานพัฒนาระบบซอฟต์แวร์</option>
                  <option value="งานบริการที่ปรึกษาโครงการ">งานบริการที่ปรึกษาโครงการ</option>
                  <option value="งานบริการซ่อมบำรุงรักษา">งานบริการซ่อมบำรุงรักษา</option>
                </PillSelect>
                <span className="text-[10px] text-white/40 block ml-1">ใช้จัดกลุ่มประเภทงานในรายงานภาพรวม</span>
              </div>

              <div className="space-y-1">
                <label className="text-[12px] font-bold text-white/70 uppercase tracking-wider ml-1">ลำดับความสำคัญ</label>
                <PillSelect value={projectPriority} onChange={(e) => setProjectPriority(e.target.value)} className="w-full h-8 font-bold text-warning text-sm">
                  <option value="ทั่วไป">ทั่วไป</option>
                  <option value="ปานกลาง">ปานกลาง</option>
                  <option value="เร่งด่วน">เร่งด่วน</option>
                  <option value="วิกฤต">วิกฤต</option>
                </PillSelect>
              </div>

              <div className="space-y-1">
                <label className="text-[12px] font-bold text-white/70 uppercase tracking-wider ml-1">
                  วันที่เริ่มโครงการ <span className="text-rose-500 font-bold ml-0.5">*</span>
                </label>
                <PillInput type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full h-8 text-sm font-mono" />
              </div>

              <div className="space-y-1">
                <label className="text-[12px] font-bold text-white/70 uppercase tracking-wider ml-1">
                  วันที่ส่งมอบ/สิ้นสุด <span className="text-rose-500 font-bold ml-0.5">*</span>
                </label>
                <PillInput type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full h-8 text-sm font-mono" />
              </div>

              {/* ข้อมูลสถานที่และผู้ติดต่อหน้างาน */}
              <div className="space-y-1.5 md:col-span-3 pt-3 border-t border-white/10">
                <div className="flex items-center gap-1.5 text-nexus-blue mb-1">
                  <MapPin size={16} />
                  <span className="text-xs font-bold uppercase text-white">สถานที่ติดตั้งและผู้ติดต่อหน้างาน</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <PillInput 
                      value={siteLocation} 
                      onChange={(e) => setSiteLocation(e.target.value)} 
                      placeholder="ระบุสถานที่ติดตั้ง เลขที่อาคาร หรือลิงก์ Google Maps หน้างาน..." 
                      className="w-full h-8 text-sm" 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <PillInput 
                      value={siteContactName} 
                      onChange={(e) => setSiteContactName(e.target.value)} 
                      placeholder="ชื่อผู้ติดต่อหน้างาน..." 
                      className="w-full h-8 text-sm font-medium" 
                    />
                    <PillInput 
                      value={siteContactPhone} 
                      onChange={(e) => setSiteContactPhone(e.target.value)} 
                      placeholder="เบอร์โทรศัพท์..." 
                      className="w-full h-8 text-sm font-mono font-bold" 
                    />
                  </div>
                </div>
              </div>

              {/* รายชื่อผู้ติดตามและผู้ประสานงานหน้างานเพิ่มเติม */}
              <div className="space-y-2 md:col-span-3 pt-3 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-nexus-teal">
                    <UserCheck size={16} />
                    <span className="text-xs font-bold uppercase text-white">รายชื่อผู้ติดตามและผู้ประสานงานหน้างาน</span>
                    <span className="text-[11px] text-white/40 font-mono font-bold">({projectFollowers.length} คน)</span>
                  </div>
                  <PillButton 
                    variant="glass" 
                    onClick={handleAddFollower}
                    className="h-7 px-3 text-xs font-bold text-nexus-teal border-nexus-teal/30"
                  >
                    + เพิ่มผู้ติดตาม
                  </PillButton>
                </div>

                {projectFollowers.length === 0 ? (
                  <div className="p-3 border border-dashed border-white/10 rounded-xl text-center text-white/40 text-xs">
                    ยังไม่มีรายชื่อผู้ติดตามหน้างาน (กดปุ่ม "+ เพิ่มผู้ติดตาม" เพื่อเพิ่มข้อมูล)
                  </div>
                ) : (
                  <div className="space-y-2">
                    {projectFollowers.map((fol) => (
                      <div key={fol.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-black/30 border border-white/10 p-2 rounded-2xl">
                        <div className="sm:col-span-3">
                          <PillInput 
                            value={fol.name}
                            onChange={(e) => handleUpdateFollower(fol.id, "name", e.target.value)}
                            placeholder="ชื่อ-นามสกุล..."
                            className="w-full h-8 text-sm font-medium"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <PillInput 
                            value={fol.role}
                            onChange={(e) => handleUpdateFollower(fol.id, "role", e.target.value)}
                            placeholder="ตำแหน่ง / บทบาท..."
                            className="w-full h-8 text-sm text-white/80"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <PillInput 
                            value={fol.phone}
                            onChange={(e) => handleUpdateFollower(fol.id, "phone", e.target.value)}
                            placeholder="เบอร์โทรศัพท์..."
                            className="w-full h-8 text-sm font-mono font-bold"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <PillInput 
                            value={fol.note || ""}
                            onChange={(e) => handleUpdateFollower(fol.id, "note", e.target.value)}
                            placeholder="หมายเหตุ..."
                            className="w-full h-8 text-sm text-white/60"
                          />
                        </div>
                        <div className="sm:col-span-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleRemoveFollower(fol.id)}
                            className="p-1 text-white/40 hover:text-danger transition-colors shrink-0"
                            title="ลบรายชื่อ"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CARD 2: รายการพัสดุอุปกรณ์และงานบริการ */}
      <div className="bg-neutral-900/90 border border-white/15 rounded-3xl overflow-hidden shadow-2xl transition-all border-l-4 border-l-nexus-blue hover:border-white/25">
        <div 
          onClick={() => toggleCard("boq")}
          className="p-4 sm:p-5 flex items-center justify-between bg-white/[0.04] border-b border-white/10 cursor-pointer hover:bg-white/[0.08] transition-colors select-none"
        >
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-xl bg-nexus-blue/20 text-nexus-blue border border-nexus-blue/40 font-mono font-black text-xs shadow-sm">
              02
            </span>
            <div className="flex items-center gap-2 text-nexus-blue">
              <Package size={20} />
              <h3 className="text-base font-bold uppercase tracking-wider text-white">
                2. รายการพัสดุอุปกรณ์และงานบริการติดตั้ง (BOQ)
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-white/40">
            {openCards.boq ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </div>

        {openCards.boq && (
          <div className="p-4 sm:p-6 space-y-6 animate-in fade-in duration-300">
            {/* ตารางสินค้าอัจฉริยะ (DocumentItemsTable) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white/80 uppercase tracking-wider flex items-center gap-2">
                  <FileSpreadsheet size={18} className="text-nexus-teal" /> ตารางรายการสินค้าและพัสดุอัจฉริยะ ({documentItems.length} รายการ)
                </h4>
                <div className="flex items-center gap-2">
                  <PillButton 
                    variant="glass" 
                    onClick={() => {
                      setDocumentItems((prev) => [
                        ...prev,
                        {
                          id: Date.now() + Math.random(),
                          productId: null,
                          sku: "",
                          name: "",
                          qty: 1,
                          unit: "ชิ้น",
                          price: 0,
                          cost: 0,
                          discount: "",
                          isOptional: false
                        }
                      ]);
                    }}
                    className="h-7 px-3 text-xs font-bold text-nexus-teal border-nexus-teal/30"
                  >
                    + เพิ่มแถวพัสดุใหม่
                  </PillButton>
                </div>
              </div>

              <DocumentItemsTable
                items={documentItems}
                onChange={(newItems) => setDocumentItems(newItems)}
                isLocked={false}
                taxType="EXCLUSIVE"
              />
            </div>

            {/* ส่วนรายการงานบริการและค่าแรงติดตั้ง */}
            <div className="pt-4 border-t border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white/80 uppercase tracking-wider flex items-center gap-2">
                  <Wrench size={18} className="text-nexus-blue" /> รายการงานบริการและค่าแรงติดตั้ง ({projectLabors.length} รายการ)
                </h4>
                <PillButton 
                  variant="glass" 
                  onClick={handleAddCustomLabor} 
                  className="h-7 px-3 text-xs font-bold text-nexus-blue border-nexus-blue/30"
                >
                  + เพิ่มรายการงานบริการ
                </PillButton>
              </div>

              {projectLabors.length === 0 ? (
                <div className="p-4 border border-dashed border-white/10 rounded-2xl text-center text-white/40 text-xs">
                  ยังไม่มีรายการงานบริการติดตั้ง (คลิกปุ่มด้านบนเพื่อเพิ่มรายการงานบริการ)
                </div>
              ) : (
                <div className="space-y-3">
                  {projectLabors.map((lab) => (
                    <div key={lab.id} className="p-3 bg-nexus-blue/10 border border-nexus-blue/20 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <PillInput
                          value={lab.name}
                          onChange={(e) => setProjectLabors((prev) => prev.map((item) => (item.id === lab.id ? { ...item, name: e.target.value } : item)))}
                          placeholder="ระบุชื่องานบริการ..."
                          className="w-full h-8 text-sm font-bold"
                        />
                        <button
                          type="button"
                          onClick={() => setProjectLabors((prev) => prev.filter((item) => item.id !== lab.id))}
                          className="p-1 text-white/40 hover:text-danger transition-colors shrink-0"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-bold text-white/50 uppercase block">ต้นทุนบริการ (บาท)</label>
                          <NumberStepper
                            value={lab.cost || 0}
                            onChange={(val) => setProjectLabors((prev) => prev.map((item) => (item.id === lab.id ? { ...item, cost: val } : item)))}
                            step={500}
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-nexus-teal uppercase block">ราคาขายเสนอ (บาท)</label>
                          <NumberStepper
                            value={lab.price || 0}
                            onChange={(val) => setProjectLabors((prev) => prev.map((item) => (item.id === lab.id ? { ...item, price: val } : item)))}
                            step={500}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* CARD 3: จัดทีมงานและทรัพยากร */}
      <div className="bg-neutral-900/90 border border-white/15 rounded-3xl overflow-hidden shadow-2xl transition-all border-l-4 border-l-purple-500 hover:border-white/25">
        <div 
          onClick={() => toggleCard("team")}
          className="p-4 sm:p-5 flex items-center justify-between bg-white/[0.04] border-b border-white/10 cursor-pointer hover:bg-white/[0.08] transition-colors select-none"
        >
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/40 font-mono font-black text-xs shadow-sm">
              03
            </span>
            <div className="flex items-center gap-2 text-purple-400">
              <Users size={20} />
              <h3 className="text-base font-bold uppercase tracking-wider text-white">
                3. การมอบหมายผู้จัดการโครงการและจัดทีมงาน
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-2 text-white/40">
            {openCards.team ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </div>

        {openCards.team && (
          <div className="p-6 space-y-6 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-white/70 uppercase tracking-wider ml-1">
                  ผู้จัดการโครงการหลัก <span className="text-rose-500 font-bold ml-0.5">*</span>
                </label>
                <PillInput 
                  value={projectManager} 
                  onChange={(e) => setProjectManager(e.target.value)} 
                  placeholder="ระบุชื่อผู้จัดการโครงการ..." 
                  className="w-full h-8 font-bold text-sm text-nexus-teal" 
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-white/70 uppercase tracking-wider ml-1">อัตราค่าแรงผู้รับเหมาช่วง</label>
                <PillButton variant="glass" onClick={() => setActiveModal("contractor")} className="w-full h-8 justify-center text-sm text-white/80">
                  <Wrench size={16} className="mr-2 text-warning" /> จัดการข้อมูลผู้รับเหมาและชุดค่าแรง
                </PillButton>
              </div>
            </div>

            {/* Assigned Team List */}
            <div className="space-y-3 pt-4 border-t border-white/10">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white/70 uppercase tracking-wider">ทีมวิศวกรและช่างเทคนิคที่ได้รับมอบหมาย</h4>
                <button
                  type="button"
                  onClick={() => setAssignedTeam((prev) => [...prev, { id: `MEM-${Date.now()}`, name: "บุคลากรใหม่", role: "Support Engineer", allocation: 100 }])}
                  className="text-sm text-nexus-teal font-bold hover:underline"
                >
                  + เพิ่มทีมงาน
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {assignedTeam.map((member) => (
                  <div key={member.id} className="p-4 bg-white/[0.03] border border-white/10 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <PillInput
                        value={member.name}
                        onChange={(e) => setAssignedTeam((prev) => prev.map((m) => (m.id === member.id ? { ...m, name: e.target.value } : m)))}
                        className="h-8 text-sm font-bold w-3/4"
                      />
                      <button
                        type="button"
                        onClick={() => setAssignedTeam((prev) => prev.filter((m) => m.id !== member.id))}
                        className="text-white/30 hover:text-danger p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/60 font-bold">{member.role}</span>
                      <span className="text-nexus-blue font-mono font-bold">มอบหมาย: {member.allocation}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CARD 4: สรุปงบประมาณโครงการ รายละเอียดการประเมิน และขั้นตอนการอนุมัติ 3 ชั้น */}
      <div className="bg-neutral-900/90 border border-white/15 rounded-3xl overflow-hidden shadow-2xl transition-all border-l-4 border-l-emerald-500 hover:border-white/25">
        <div 
          onClick={() => toggleCard("summary")}
          className="p-4 sm:p-5 flex items-center justify-between bg-white/[0.04] border-b border-white/10 cursor-pointer hover:bg-white/[0.08] transition-colors select-none"
        >
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-mono font-black text-xs shadow-sm">
              04
            </span>
            <div className="flex items-center gap-2 text-emerald-400">
              <BarChart3 size={20} />
              <h3 className="text-base font-bold uppercase tracking-wider text-white">
                4. สรุปงบประมาณโครงการ รายละเอียดการประเมิน และขั้นตอนการอนุมัติ 3 ชั้น
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-2 text-white/40">
            {openCards.summary ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </div>

        {openCards.summary && (
          <div className="p-6 space-y-6 animate-in fade-in duration-300">
            {/* GP% Soft Warning Banner */}
            {budgetSummary.totalRev > 0 && budgetSummary.gpPercent < 0 && (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 animate-in fade-in">
                <AlertCircle size={20} className="text-rose-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-bold text-sm text-rose-200">
                    ⚠️ แจ้งเตือนความเสี่ยงทางการเงิน: อัตรากำไรขั้นต้นติดลบ ({budgetSummary.gpPercent}%)
                  </p>
                  <p className="text-white/70">
                    โครงการนี้มีต้นทุนทางตรงสูงกว่าราคาเสนอขาย อาจส่งผลให้ขาดทุนสุทธิ ฿{Math.abs(budgetSummary.grossProfit).toLocaleString()} (ระบบอนุญาตให้ส่งขออนุมัติเพื่อพิจารณาเป็นกรณีพิเศษได้)
                  </p>
                </div>
              </div>
            )}

            {budgetSummary.totalRev > 0 && budgetSummary.gpPercent >= 0 && budgetSummary.gpPercent < 15 && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-300 animate-in fade-in">
                <AlertCircle size={20} className="text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-bold text-sm text-amber-200">
                    ⚠️ แจ้งเตือนอัตรากำไรขั้นต้นต่ำกว่าเกณฑ์มาตรฐาน ({budgetSummary.gpPercent}%)
                  </p>
                  <p className="text-white/70">
                    อัตรากำไรขั้นต้นต่ำกว่าเกณฑ์เป้าหมาย 15% ของบริษัท กรุณาตรวจสอบส่วนลดและรายการต้นทุนก่อนส่งขออนุมัติ
                  </p>
                </div>
              </div>
            )}

            {/* 1. สรุปตัวเลขทางการเงินหลัก (Master Financial KPI Cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1">
                <span className="text-xs font-bold text-white/60 uppercase">ราคาเสนอขายก่อนภาษี</span>
                <p className="text-xl font-mono font-black text-nexus-teal">฿{budgetSummary.totalRev.toLocaleString()}</p>
                <p className="text-[11px] text-white/50">รวมพัสดุและบริการในโครงการ</p>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1">
                <span className="text-xs font-bold text-white/60 uppercase">ต้นทุนทางตรงรวม</span>
                <p className="text-xl font-mono font-black text-rose-400">฿{budgetSummary.totalCost.toLocaleString()}</p>
                <p className="text-[11px] text-white/50">ต้นทุนสินค้า WAC + ค่าแรงบริการ</p>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1">
                <span className="text-xs font-bold text-white/60 uppercase">กำไรขั้นต้นประมาณการ</span>
                <div className="flex items-baseline gap-2">
                  <p className="text-xl font-mono font-black text-emerald-400">฿{budgetSummary.grossProfit.toLocaleString()}</p>
                  <span className="text-xs font-mono font-bold text-nexus-blue">({budgetSummary.gpPercent}%)</span>
                </div>
                <p className="text-[11px] text-white/50">ส่วนต่างราคาขายเทียบต้นทุนทางตรง</p>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1">
                <span className="text-xs font-bold text-white/60 uppercase">ยอดขายรวมภาษีมูลค่าเพิ่ม 7%</span>
                <p className="text-xl font-mono font-black text-white">฿{budgetSummary.grandTotalWithVat.toLocaleString()}</p>
                <p className="text-[11px] text-white/50">ภาษี 7%: ฿{budgetSummary.vatAmount.toLocaleString()}</p>
              </div>
            </div>

            {/* 2. ตารางจำแนกรายละเอียดต้นทุน ค่าใช้จ่าย และกำไร (Detailed Breakdown Table) */}
            <div className="pt-4 border-t border-white/10 space-y-3">
              <h4 className="text-sm font-bold text-white/80 uppercase tracking-wider flex items-center gap-2">
                <ClipboardList size={18} className="text-nexus-blue" /> ตารางจำแนกโครงสร้างต้นทุน ค่าใช้จ่าย และกำไรโครงการ
              </h4>

              <div className="border border-white/10 rounded-2xl overflow-hidden bg-black/20">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-white/5 text-[12px] font-bold text-white/60 uppercase border-b border-white/10">
                      <tr>
                        <th className="py-3 px-4">หมวดรายการประเมิน</th>
                        <th className="py-3 px-4 text-right">ต้นทุนทางตรง (บาท)</th>
                        <th className="py-3 px-4 text-right">ราคาขายเสนอ (บาท)</th>
                        <th className="py-3 px-4 text-right">กำไรส่วนต่าง (บาท)</th>
                        <th className="py-3 px-4 text-center">สัดส่วนรายได้ (%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-medium">
                      <tr>
                        <td className="py-3 px-4 text-white font-bold flex items-center gap-2">
                          <span>📦</span> พัสดุและอุปกรณ์โครงการ ({budgetSummary.equipCount} รายการ / {budgetSummary.equipTotalQty} ชิ้น)
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-rose-400">฿{budgetSummary.equipCost.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right font-mono text-nexus-teal">฿{budgetSummary.equipRev.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right font-mono text-emerald-400">฿{(budgetSummary.equipRev - budgetSummary.equipCost).toLocaleString()}</td>
                        <td className="py-3 px-4 text-center font-mono text-white/70">
                          {budgetSummary.totalRev > 0 ? ((budgetSummary.equipRev / budgetSummary.totalRev) * 100).toFixed(1) : "0.0"}%
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 text-white font-bold flex items-center gap-2">
                          <span>🛠️</span> งานบริการ ค่าแรง และผู้รับเหมาช่วง ({budgetSummary.laborCount} รายการ / {budgetSummary.laborTotalPoints} จุด)
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-rose-400">฿{budgetSummary.laborCost.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right font-mono text-nexus-teal">฿{budgetSummary.laborRev.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right font-mono text-emerald-400">฿{(budgetSummary.laborRev - budgetSummary.laborCost).toLocaleString()}</td>
                        <td className="py-3 px-4 text-center font-mono text-white/70">
                          {budgetSummary.totalRev > 0 ? ((budgetSummary.laborRev / budgetSummary.totalRev) * 100).toFixed(1) : "0.0"}%
                        </td>
                      </tr>
                      <tr className="bg-amber-500/5">
                        <td className="py-3 px-4 text-amber-300 font-bold flex items-center gap-2">
                          <span>🛡️</span> เงินสำรองฉุกเฉินและความเสี่ยงโครงการ (5%)
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-amber-400">฿{budgetSummary.contingencyBuffer.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right font-mono text-white/40">-</td>
                        <td className="py-3 px-4 text-right font-mono text-amber-400">-฿{budgetSummary.contingencyBuffer.toLocaleString()}</td>
                        <td className="py-3 px-4 text-center font-mono text-amber-400/80">5.0% (ต้นทุน)</td>
                      </tr>
                      <tr className="bg-white/[0.02]">
                        <td className="py-3 px-4 text-white/80 font-bold flex items-center gap-2">
                          <span>🧾</span> ภาษีมูลค่าเพิ่ม (VAT 7%)
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-white/40">-</td>
                        <td className="py-3 px-4 text-right font-mono text-white/90">฿{budgetSummary.vatAmount.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right font-mono text-white/40">-</td>
                        <td className="py-3 px-4 text-center font-mono text-white/60">7.0%</td>
                      </tr>
                      <tr className="bg-nexus-teal/10 font-bold text-white border-t-2 border-nexus-teal/30">
                        <td className="py-3.5 px-4 text-nexus-teal flex items-center gap-2">
                          <span>💎</span> สรุปรวมมูลค่าทั้งสิ้นและกำไรคงเหลือสุทธิ
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-rose-300">฿{budgetSummary.grandTotalCost.toLocaleString()}</td>
                        <td className="py-3.5 px-4 text-right font-mono text-nexus-teal">฿{budgetSummary.grandTotalWithVat.toLocaleString()}</td>
                        <td className="py-3.5 px-4 text-right font-mono text-emerald-300">฿{budgetSummary.netProfit.toLocaleString()}</td>
                        <td className="py-3.5 px-4 text-center font-mono text-emerald-400">{budgetSummary.netProfitPercent}% สุทธิ</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* 3. ดัชนีชี้วัดการประเมินโครงการและประสิทธิภาพ (Estimation Metrics Grid) */}
            <div className="pt-4 border-t border-white/10 space-y-3">
              <h4 className="text-sm font-bold text-white/80 uppercase tracking-wider flex items-center gap-2">
                <Target size={18} className="text-nexus-teal" /> ตัวเลขวิเคราะห์และดัชนีชี้วัดประสิทธิภาพการประเมินโครงการ
              </h4>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-1">
                  <span className="text-[12px] font-bold text-white/60 uppercase">อัตราส่วนมาร์กอัปต้นทุน</span>
                  <p className="text-base font-mono font-bold text-emerald-400">+{budgetSummary.markupPercent}%</p>
                  <p className="text-[11px] text-white/40">มาร์กอัปต่อต้นทุนรวม</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-1">
                  <span className="text-[12px] font-bold text-white/60 uppercase">สัดส่วนต้นทุนต่อรายได้</span>
                  <p className="text-base font-mono font-bold text-rose-400">{budgetSummary.costToRevRatio}%</p>
                  <p className="text-[11px] text-white/40">ภาระต้นทุนต่อยอดเสนอขาย</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-1">
                  <span className="text-[12px] font-bold text-white/60 uppercase">กำไรสุทธิหลังเงินสำรอง</span>
                  <p className="text-base font-mono font-bold text-nexus-blue">{budgetSummary.netProfitPercent}%</p>
                  <p className="text-[11px] text-white/40">อัตรากำไรสุทธิประมาณการ</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-1">
                  <span className="text-[12px] font-bold text-white/60 uppercase">ระยะเวลาดำเนินงาน</span>
                  <p className="text-base font-mono font-bold text-white">{budgetSummary.durationDays} วัน</p>
                  <p className="text-[11px] text-white/40">จำนวนวันทั้งหมดของโครงการ</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-1">
                  <span className="text-[12px] font-bold text-white/60 uppercase">รายได้เฉลี่ยต่อวัน</span>
                  <p className="text-base font-mono font-bold text-nexus-teal">฿{budgetSummary.revenuePerDay.toLocaleString()}</p>
                  <p className="text-[11px] text-white/40">อัตราสร้างรายได้ต่อวัน</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-1">
                  <span className="text-[12px] font-bold text-white/60 uppercase">ต้นทุนเฉลี่ยต่อวัน</span>
                  <p className="text-base font-mono font-bold text-rose-400">฿{budgetSummary.costPerDay.toLocaleString()}</p>
                  <p className="text-[11px] text-white/40">อัตราสิ้นเปลืองต้นทุนต่อวัน</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-1">
                  <span className="text-[12px] font-bold text-white/60 uppercase">ปริมาณพัสดุอุปกรณ์รวม</span>
                  <p className="text-base font-mono font-bold text-white">{budgetSummary.equipTotalQty} ชิ้น</p>
                  <p className="text-[11px] text-white/40">จาก {budgetSummary.equipCount} รายการสินค้า</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-1">
                  <span className="text-[12px] font-bold text-white/60 uppercase">ปริมาณงานบริการรวม</span>
                  <p className="text-base font-mono font-bold text-white">{budgetSummary.laborTotalPoints} จุด</p>
                  <p className="text-[11px] text-white/40">จาก {budgetSummary.laborCount} รายการบริการ</p>
                </div>
              </div>
            </div>

            {/* 4. รายการเอกสารบังคับตามมาตรฐานการดำเนินงาน (Document Checklist Compliance Preview) */}
            <div className="space-y-4 pt-4 border-t border-white/10">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white/80 uppercase tracking-wider flex items-center gap-2">
                  <FileText size={18} className="text-nexus-teal" /> รายการเอกสารบังคับตามมาตรฐาน (Document Checklist - {PROJECT_TYPE_CONFIGS[projectTypeCode]?.nameTh})
                </h4>
                <span className="px-3 py-1 rounded-full bg-nexus-teal/10 border border-nexus-teal/30 text-nexus-teal text-xs font-mono font-bold">
                  สร้างอัตโนมัติ {PROJECT_TYPE_CONFIGS[projectTypeCode]?.requiredDocuments.length || 0} รายการ
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PROJECT_TYPE_CONFIGS[projectTypeCode]?.requiredDocuments.map((docItem) => (
                  <div key={docItem.docCode} className="p-3 rounded-2xl bg-white/[0.02] border border-white/10 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 font-mono font-bold text-[11px] text-nexus-teal shrink-0">
                        {docItem.docCode}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">{docItem.docName}</p>
                        <span className="text-[10px] text-white/50">{docItem.category}</span>
                      </div>
                    </div>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0",
                      docItem.isMandatory ? "bg-rose-500/10 text-rose-400 border border-rose-500/30" : "bg-white/5 text-white/40 border border-white/10"
                    )}>
                      {docItem.isMandatory ? "บังคับแนบ" : "เลือกแนบได้"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 5. ขั้นตอนการอนุมัติเปิดโครงการแบบ 3 ชั้น (Approval Steps Preview) */}
            <div className="space-y-4 pt-4 border-t border-white/10">
              <h4 className="text-sm font-bold text-white/70 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck size={18} className="text-nexus-teal" /> ขั้นตอนการอนุมัติเปิดโครงการแบบ 3 ชั้น
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { step: 1, title: "ชั้นที่ 1: หัวหน้าฝ่าย", role: "Project Director", desc: "ตรวจสอบขอบเขตและเป้าหมายโครงการ" },
                  { step: 2, title: "ชั้นที่ 2: ฝ่ายการเงิน", role: "Finance Manager", desc: "อนุมัติกรอบวงเงินและอัตรากำไร GP %" },
                  { step: 3, title: "ชั้นที่ 3: ผู้บริหาร", role: "Executive / CEO", desc: "อนุมัติสั่งการเปิดโครงการอย่างเป็นทางการ" }
                ].map((app) => (
                  <div key={app.step} className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2 relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-nexus-teal">{app.title}</span>
                      <span className="px-2.5 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/20 text-xs font-bold uppercase">
                        รอการอนุมัติ
                      </span>
                    </div>
                    <p className="text-sm font-bold text-white">{app.role}</p>
                    <p className="text-xs text-white/50">{app.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Right Sidebar - Sticky Split Layout Summary Panel (20%)
  const rightSidebar = (
    <div className="bg-neutral-900/90 border border-white/15 rounded-3xl p-5 shadow-2xl space-y-5 sticky top-4 border-t-4 border-t-nexus-teal">
      <div className="border-b border-white/10 pb-3">
        <h4 className="text-sm font-bold text-white/90 uppercase tracking-wider flex items-center gap-2">
          <Briefcase size={18} className="text-nexus-teal" /> สรุปข้อมูลโครงการ
        </h4>
      </div>

      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between py-1 border-b border-white/5">
          <span className="text-white/60 font-medium">รหัสโครงการ</span>
          <span className="font-mono font-bold text-nexus-teal pointer-events-none select-none">{projectId || "PRJ-2609-0001"}</span>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-white/5">
          <span className="text-white/60 font-medium">ชื่อโครงการ</span>
          <span className="font-bold text-white max-w-[160px] truncate text-right">{projectName || "ยังไม่ได้ระบุชื่อ"}</span>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-white/5">
          <span className="text-white/60 font-medium">รูปแบบโครงการ</span>
          <span className="font-bold text-white/80 max-w-[150px] truncate text-right">{projectType}</span>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-white/5">
          <span className="text-white/60 font-medium">ระยะเวลาดำเนินงาน</span>
          <span className="font-mono font-bold text-white text-right">{budgetSummary.durationDays} วัน</span>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-white/5">
          <span className="text-white/60 font-medium">ราคาเสนอขายก่อนภาษี</span>
          <span className="font-mono font-bold text-nexus-teal text-right">฿{budgetSummary.totalRev.toLocaleString()}</span>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-white/5">
          <span className="text-white/60 font-medium">ภาษีมูลค่าเพิ่ม (7%)</span>
          <span className="font-mono font-bold text-white/70 text-right">฿{budgetSummary.vatAmount.toLocaleString()}</span>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-white/5">
          <span className="text-white/60 font-medium">มูลค่ารวมทั้งสิ้น (รวม VAT)</span>
          <span className="font-mono font-bold text-white text-right">฿{budgetSummary.grandTotalWithVat.toLocaleString()}</span>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-white/5">
          <span className="text-white/60 font-medium">ต้นทุนทางตรงพัสดุ/ค่าแรง</span>
          <span className="font-mono font-bold text-rose-400 text-right">฿{budgetSummary.totalCost.toLocaleString()}</span>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-white/5">
          <span className="text-white/60 font-medium">สำรองความเสี่ยง (5%)</span>
          <span className="font-mono font-bold text-amber-400 text-right">฿{budgetSummary.contingencyBuffer.toLocaleString()}</span>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-white/5">
          <span className="text-white/60 font-medium">รวมต้นทุนโครงการสุทธิ</span>
          <span className="font-mono font-bold text-rose-300 text-right">฿{budgetSummary.grandTotalCost.toLocaleString()}</span>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-white/5">
          <span className="text-white/60 font-medium">กำไรขั้นต้นประมาณการ</span>
          <span className="font-mono font-bold text-emerald-400 text-right">
            ฿{budgetSummary.grossProfit.toLocaleString()} <span className="text-nexus-blue">({budgetSummary.gpPercent}%)</span>
          </span>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-white/5">
          <span className="text-white/60 font-medium">กำไรสุทธิประมาณการ</span>
          <span className="font-mono font-bold text-emerald-300 text-right">
            ฿{budgetSummary.netProfit.toLocaleString()} <span className="text-nexus-teal">({budgetSummary.netProfitPercent}%)</span>
          </span>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-white/5">
          <span className="text-white/60 font-medium">มาร์กอัปบนต้นทุน</span>
          <span className="font-mono font-bold text-emerald-400 text-right">+{budgetSummary.markupPercent}%</span>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-white/5">
          <span className="text-white/60 font-medium">รายได้เฉลี่ยต่อวัน</span>
          <span className="font-mono font-bold text-nexus-teal text-right">฿{budgetSummary.revenuePerDay.toLocaleString()}</span>
        </div>

        <div className="flex items-center justify-between py-1">
          <span className="text-white/60 font-medium">สถานะการอนุมัติ</span>
          <span className="font-bold text-warning text-xs text-right">รออนุมัติ (3 ชั้น)</span>
        </div>
      </div>

      {toast.isVisible && (
        <Toast
          isVisible={toast.isVisible}
          message={toast.message}
          onClose={() => setToast((prev) => ({ ...prev, isVisible: false }))}
        />
      )}

      {activeModal === "contractor" && (
        <ContractorModal
          isOpen={true}
          onClose={() => setActiveModal(null)}
          onSave={(c: any) => {
            showToast(`บันทึกข้อมูลผู้รับเหมา ${c?.name || ""} เรียบร้อย`, false);
            setActiveModal(null);
          }}
          showToast={(msg: string) => showToast(msg, false)}
        />
      )}
    </div>
  );

  return (
    <NexusPageLayout
      header={headerContent}
      leftContent={leftContent}
      rightSidebar={rightSidebar}
    />
  );
}
