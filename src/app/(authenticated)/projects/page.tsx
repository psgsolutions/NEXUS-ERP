// @ts-nocheck
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Briefcase, 
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
  Wrench
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
  NexusSearchInput
} from "@/components/ui/Base";
import { GanttChart } from "@/components/projects/GanttChart";
import { ProfitForecaster } from "@/components/projects/ProfitForecaster";
import { QuotationModal } from "@/components/commerce/QuotationModal";
import { NumberStepper } from "@/components/ui/NumberStepper";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase-client";
import { doc, setDoc, collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { generateStockPilotId } from "@/lib/utils";
import { KitEditor } from "@/components/projects/KitEditor";
import { ContractorModal } from "@/components/projects/ContractorModal";


const WAREHOUSE_PRODUCTS = [
  { sku: "SKU-LED-40212", name: "LED Panel P2.5 Indoor Cabinet", unit: "ชิ้น", cost: 45000, price: 65000, qty_on_hand: 120 },
  { sku: "SKU-LED-40400", name: "LED Panel P3.9 Outdoor Waterproof", unit: "ชิ้น", cost: 55000, price: 78000, qty_on_hand: 80 },
  { sku: "SKU-SW-9200", name: "Cisco Catalyst 9200 24-Port Switch", unit: "เครื่อง", cost: 85000, price: 120000, qty_on_hand: 12 },
  { sku: "SKU-ARU-0992", name: "Aruba AP-505 Enterprise Access Point", unit: "เครื่อง", cost: 12000, price: 18000, qty_on_hand: 45 },
  { sku: "SKU-CAB-006", name: "CAT6 SFTP Network Cable (305m Box)", unit: "กล่อง", cost: 3500, price: 5500, qty_on_hand: 50 },
  { sku: "SKU-PWR-ラック", name: "PDU Rack Power Strip 8-Outlets", unit: "ชุด", cost: 1800, price: 2900, qty_on_hand: 30 },
  { sku: "SKU-FIB-10G", name: "Fiber Optic Patch Cord OM3 LC-LC 3m", unit: "เส้น", cost: 450, price: 850, qty_on_hand: 150 }
];

const PRICING_HISTORY: Record<string, Record<string, number>> = {
  "CUS-004": { // QSNCC
    "SKU-LED-40212": 63000,
    "SKU-SW-9200": 115000,
    "SKU-CAB-006": 5200
  },
  "CUS-001": { // Taksin Hospital
    "SKU-LED-40212": 62000,
    "SKU-SW-9200": 118000
  },
  "CUS-002": { // PSG Solutions
    "SKU-LED-40212": 60000,
    "SKU-CAB-006": 4800
  }
};


const MOCK_PROJECTS = [
  { id: 'PRJ-2606-001', name: 'ระบบเครือข่ายไร้สาย (Wi-Fi 6) อาคาร A', customer: 'โรงพยาบาลตากสิน', value: 1250000, progress: 45, status: 'Active', startDate: '2026-06-01', endDate: '2026-08-30' },
  { id: 'PRJ-2606-002', name: 'ติดตั้งระบบ CCTV และ Access Control', customer: 'ศูนย์ประชุมแห่งชาติ', value: 3400000, progress: 15, status: 'Active', startDate: '2026-06-15', endDate: '2026-11-30' }
];


type ProjectSubModule = "list" | "planning" | "report" | "costing";

export default function ProjectsPage() {
  const { user, companyId } = useAuth();
  const [activeTab, setActiveTab] = useState<ProjectSubModule>("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [modalActiveTab, setModalActiveTab] = useState("basic");
  const [toast, setToast] = useState({ message: "", isVisible: false });

  // Quotation Integration States
  const [isQuotationOpen, setIsQuotationOpen] = useState(false);
  const [quotationInitialData, setQuotationInitialData] = useState<any>(null);

  // Kit Editor States
  const [isKitEditorOpen, setIsKitEditorOpen] = useState(false);
  const [kitEditorInitialData, setKitEditorInitialData] = useState<any>(null);
  const [dbProducts, setDbProducts] = useState<any[]>([]);

  // Contractor States
  const [isContractorModalOpen, setIsContractorModalOpen] = useState(false);
  const [selectedContractor, setSelectedContractor] = useState<any>(null);
  const [dbContractors, setDbContractors] = useState<any[]>([]);
  useEffect(() => {
    if (!companyId) return;

    const q = query(
      collection(db, "products"),
      where("companyId", "==", companyId),
      where("isDeleted", "==", false),
      orderBy("updatedAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: any[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() });
      });
      setDbProducts(items);
    });

    return () => unsubscribe();
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;

    const qc = query(
      collection(db, "contractors"),
      where("companyId", "==", companyId),
      where("isActive", "==", true),
      orderBy("updatedAt", "desc")
    );

    const unsubscribeCont = onSnapshot(qc, (snapshot) => {
      const items: any[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() });
      });
      setDbContractors(items);
    });

    return () => unsubscribeCont();
  }, [companyId]);

  // Active search ID for live product suggestions
  const [activeSearchId, setActiveSearchId] = useState<number | null>(null);

  // Search query for Available Catalog items inside the split view
  const [catalogSearchQuery, setCatalogSearchQuery] = useState("");

  // Project Creation States
  const [projectName, setProjectName] = useState("ติดตั้งระบบ LED Wall - ศูนย์ประชุมหลัก");
  const [projectCustomer, setProjectCustomer] = useState("CUS-004");
  const [projectType, setProjectType] = useState("Infrastructure (งานระบบโครงสร้าง)");
  const [projectPriority, setProjectPriority] = useState("HIGH (เร่งด่วน)");
  const [projectRef, setProjectRef] = useState("REF-LED-2026");
  const [startDate, setStartDate] = useState("2026-05-20");
  const [endDate, setEndDate] = useState("2026-06-15");
  
  // Custom Equipments List
  const [projectEquipments, setProjectEquipments] = useState<any[]>([
    { id: 1, name: "LED Panel P2.5 Indoor Cabinet", sku: "SKU-LED-40212", qty: 24, cost: 45000, price: 65000 },
    { id: 2, name: "LED Video Processor V1 4K", sku: "SKU-LED-40400", qty: 2, cost: 75000, price: 110000 },
    { id: 3, name: "CAT6 SFTP Network Cable (305m Box)", sku: "SKU-CAB-006", qty: 5, cost: 3500, price: 5500 }
  ]);

  // Custom Labors / Expenses List
  const [projectLabors, setProjectLabors] = useState<any[]>([
    { 
      id: 1, 
      name: "งานติดตั้งจุดเชื่อมต่อและเดินสาย LAN UTP CAT6", 
      type: "per-point", 
      points: 40, 
      materialSku: "SKU-CAB-006", 
      materialCost: 150, 
      laborCost: 350, 
      price: 750, 
      cost: 20000, 
      totalPrice: 30000 
    },
    { 
      id: 2, 
      name: "ค่าบริการประกอบและติดตั้งโครงสร้างเหล็ก LED", 
      type: "lump-sum", 
      points: 1, 
      materialSku: "", 
      materialCost: 0, 
      laborCost: 35000, 
      price: 55000, 
      cost: 35000, 
      totalPrice: 55000 
    }
  ]);

  // Installation Packages Catalog (dynamic)
  const [installationPackages, setInstallationPackages] = useState<any[]>([
    {
      id: "PKG-LED-001",
      sku: "PKG-LED-SETUP",
      name: "ชุดประกอบและติดตั้งโครงสร้างเหล็กจอ LED Panel OM3",
      cost: 35000,
      price: 55000,
      qty_on_hand: 5,
      unit: "ชุด",
      details: "งานประกอบโครงสร้างพร้อมชุดยึดตู้เหล็ก LED"
    },
    {
      id: "PKG-LAN-40",
      sku: "PKG-UTP-CAT6",
      name: "ชุดงานเดินสายแลนพร้อมบล็อกเต้ารับ UTP CAT6 (40 จุด)",
      cost: 20000,
      price: 30000,
      qty_on_hand: 10,
      unit: "ชุด",
      details: "รวมสายแลน 5 กล่อง + ค่าแรงเดินสายเข้าหัว 40 จุด"
    }
  ]);

  // Strategic Live Catalogs (Database + Mock Merge)
  const activeWarehouseProducts = useMemo(() => {
    if (dbProducts.length === 0) return WAREHOUSE_PRODUCTS;
    return dbProducts.filter(p => p.category_id !== "Kit" && !p.isKit);
  }, [dbProducts]);

  const activeInstallationPackages = useMemo(() => {
    const dbKits = dbProducts
      .filter(p => p.category_id === "Kit" || p.isKit)
      .map(p => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        cost: p.pricing?.costWAC || p.pricing?.avg_cost || 0,
        price: p.pricing?.priceProject || p.pricing?.pricePOS || 0,
        qty_on_hand: p.stockStatus?.onHand || 0,
        unit: p.unit ? p.unit.split(" ")[0] : "ชุด",
        details: p.description || "ชุดงานติดตั้งพร้อมใช้",
        items: p.kitItems || [],
        labor_items: p.kitLabors || []
      }));
    
    const combined = [...dbKits, ...installationPackages];
    const unique = combined.filter((v, i, a) => a.findIndex(t => t.sku === v.sku) === i);
    return unique;
  }, [dbProducts, installationPackages]);

  // Sub-tab state for warehouse items vs installation packages picker
  const [catalogActiveSubTab, setCatalogActiveSubTab] = useState<"warehouse" | "packages">("warehouse");

  // Selection sub-tab: Equipments list vs Labor & Services list
  const [rightActiveSubTab, setRightActiveSubTab] = useState<"equipment" | "labor">("equipment");

  const initialProjects = [
    { id: "PRJ-26-001", name: "ติดตั้ง LED Wall - ศูนย์ประชุม", progress: 75, team: "4 คน", deadline: "24 พ.ค.", status: "active" as const },
    { id: "PRJ-26-002", name: "วางระบบ Network - อาคาร PSG", progress: 100, team: "2 คน", deadline: "15 เม.ย.", status: "completed" as const },
    { id: "PRJ-26-003", name: "MA Service - Hospital A", progress: 20, team: "1 คน", deadline: "30 มิ.ย.", status: "active" as const },
  ];

  const initialMilestones = [
    { id: "1", task: "สรุปแบบติดตั้ง & ผังระบบ", start: "2026-04-01", end: "2026-04-10", progress: 100, status: "completed" as const },
    { id: "2", task: "จัดส่งอุปกรณ์เข้าหน้างาน", start: "2026-04-11", end: "2026-04-15", progress: 100, status: "completed" as const },
    { id: "3", task: "ติดตั้งจอ LED Wall (Phase 1)", start: "2026-04-16", end: "2026-04-30", progress: 75, status: "in-progress" as const },
    { id: "4", task: "ทดสอบระบบและ UAT", start: "2026-05-01", end: "2026-05-10", progress: 0, status: "pending" as const },
  ];

  const filteredProjects = initialProjects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredMilestones = initialMilestones.filter(m => 
    m.task.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const showToast = (message: string) => {
    setToast({ message, isVisible: true });
  };

  // Add Equipment item in project modal
  const addEquipment = () => {
    setProjectEquipments(prev => [
      ...prev,
      { id: Date.now(), name: "ระบุรายการอุปกรณ์...", qty: 1, cost: 0, price: 0 }
    ]);
  };

  // Remove Equipment
  const removeEquipment = (id: number) => {
    setProjectEquipments(prev => prev.filter(item => item.id !== id));
  };

  // Update Equipment field
  const updateEquipment = (id: number, field: string, value: any) => {
    setProjectEquipments(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  // Add Labor
  const addLabor = () => {
    setProjectLabors(prev => [
      ...prev,
      { id: Date.now(), name: "ระบุรายละเอียดงานบริการ...", type: "lump-sum", points: 1, materialSku: "", materialCost: 0, laborCost: 0, price: 0, cost: 0 }
    ]);
  };

  // Remove Labor
  const removeLabor = (id: number) => {
    setProjectLabors(prev => prev.filter(item => item.id !== id));
  };

  // Update Labor
  const updateLabor = (id: number, field: string, value: any) => {
    setProjectLabors(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  // Save labor item as a re-usable package in catalog
  const saveLaborAsPackage = async (laborItem: any) => {
    let finalCost = 0;
    let finalPrice = 0;
    
    if (laborItem.type === "per-point") {
      const matCost = laborItem.materialCost || 0;
      const labCost = laborItem.laborCost || 0;
      const pts = laborItem.points || 1;
      finalCost = (matCost + labCost) * pts;
      finalPrice = (laborItem.price || 0) * pts;
    } else {
      finalCost = laborItem.cost || 0;
      finalPrice = laborItem.price || 0;
    }

    const newSku = `PKG-LAB-${Math.floor(1000 + Math.random() * 9000)}`;

    const newPkg = {
      id: `PKG-${Date.now()}`,
      sku: newSku,
      name: `[ชุดงาน] ${laborItem.name}`,
      cost: finalCost,
      price: finalPrice,
      qty_on_hand: 1,
      unit: "ชุด",
      details: laborItem.type === "per-point" ? `คิดตามจุด (${laborItem.points} จุด @ ฿${(laborItem.price || 0).toLocaleString()})` : "เหมาจ่ายรวม"
    };

    setInstallationPackages(prev => [newPkg, ...prev]);

    // Save to Firestore products collection as a "Kit"
    try {
      const cid = companyId || "nexus-global-node";
      const productId = `prod_kit_${Date.now()}`;
      
      const productData = {
        productId: productId,
        sku: newSku,
        name: `[ชุดงาน] ${laborItem.name}`,
        description: laborItem.type === "per-point" ? `คิดตามจุด (${laborItem.points} จุด @ ฿${(laborItem.price || 0).toLocaleString()})` : "เหมาจ่ายรวม",
        category: "ชุดงานติดตั้ง",
        category_id: "Kit",
        brand: "NEXUS-KIT",
        unit: "ชุด",
        stockStatus: {
          onHand: 1,
          reserved: 0,
          available: 1
        },
        currentQty: 1,
        pricing: {
          costWAC: finalCost,
          pricePOS: finalPrice,
          priceProject: finalPrice
        },
        companyId: cid,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: user?.uid || "system",
        updatedBy: user?.uid || "system"
      };

      await setDoc(doc(db, "products", productId), productData);
      showToast(`บันทึกชุดงาน "${laborItem.name}" เป็นรายการพัสดุสำเร็จรูป และเพิ่มเป็นชุด Kit ในคลังสินค้าสำเร็จ! 📦`);
    } catch (err: any) {
      console.error("Error saving kit to Firestore:", err);
      showToast(`บันทึกชุดงาน "${laborItem.name}" ในระบบเรียบร้อย แต่ไม่สามารถเชื่อมต่อคลังสินค้า Firestore ได้`);
    }
  };

  // Live budget math
  const budgetSummary = React.useMemo(() => {
    const equipCost = projectEquipments.reduce((sum, item) => sum + ((item.cost || 0) * (item.qty || 1)), 0);
    const equipRev = projectEquipments.reduce((sum, item) => sum + ((item.price || 0) * (item.qty || 1)), 0);
    
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
    const grossProfit = totalRev - totalCost;
    const gpPercent = totalRev > 0 ? Math.round((grossProfit / totalRev) * 100) : 0;

    return { totalCost, totalRev, grossProfit, gpPercent };
  }, [projectEquipments, projectLabors]);

  // Automated Quotation Export Trigger
  const handleGenerateQuotation = () => {
    // Map project equipment and labors to standard quotation items
    const aggregatedItems = [
      ...projectEquipments.map(item => ({
        id: Date.now() + Math.random(),
        name: `[อุปกรณ์] ${item.name}`,
        qty: item.qty,
        unit: "Set",
        cost: item.cost,
        price: item.price
      })),
      ...projectLabors.map(item => {
        if (item.type === "per-point") {
          return {
            id: Date.now() + Math.random(),
            name: `[งานบริการ] ${item.name} (${item.points} จุด)`,
            qty: item.points,
            unit: "จุด",
            cost: (item.materialCost || 0) + (item.laborCost || 0),
            price: item.price
          };
        }
        return {
          id: Date.now() + Math.random(),
          name: `[งานบริการ] ${item.name}`,
          qty: 1,
          unit: "Lot",
          cost: item.cost,
          price: item.price
        };
      })
    ];

    setQuotationInitialData({
      title: projectName,
      customer: projectCustomer,
      items: aggregatedItems
    });

    setActiveModal(null); // Close project modal
    setIsQuotationOpen(true); // Open QuotationModal automatically!
    showToast("ดึงข้อมูลอุปกรณ์และงานค่าใช้จ่ายออกใบเสนอราคาสำเร็จ!");
  };

  const tabs = [
    { id: "list", label: "โครงการ", icon: <Briefcase size={14} /> },
    { id: "planning", label: "งวดงาน", icon: <Target size={14} /> },
    { id: "report", label: "รายงานบริการ", icon: <ClipboardList size={14} /> },
    { id: "costing", label: "งบประมาณ & กำไร", icon: <BarChart3 size={14} /> },
    { id: "contractors", label: "ผู้รับเหมา", icon: <Users size={14} /> },
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent">

      {/* Compact Module Header — icon + title + inline metric chips on same plane */}
      <header className="p-6 border-b border-white/5 flex flex-col xl:flex-row xl:items-center justify-between gap-5 bg-black/20 shrink-0">
        <div className="flex items-center gap-4 shrink-0">
          <div className="w-10 h-10 rounded-2xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal shadow-lg border border-nexus-teal/10">
            <Briefcase size={22} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight leading-none">ศูนย์บริหารโครงการ</h1>
            <p className="text-sm font-medium text-white/30 uppercase mt-1.5 tracking-widest leading-none">Project Management Hub</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-5 py-3 bg-black/40 border border-white/5 rounded-2xl flex items-center gap-3 min-w-[130px] transition-all hover:border-nexus-teal/30 hover:bg-white/[0.03]">
            <div className="w-10 h-10 rounded-xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/20 shrink-0">
              <Activity size={18} />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-sm font-medium text-white/30 uppercase tracking-widest leading-none">โครงการ Active</span>
              <span className="text-[17px] font-bold text-nexus-teal mt-1 mono-numbers leading-none">12 งาน</span>
            </div>
          </div>
          <div className="px-5 py-3 bg-black/40 border border-white/5 rounded-2xl flex items-center gap-3 min-w-[130px] transition-all hover:border-nexus-blue/30 hover:bg-white/[0.03]">
            <div className="w-10 h-10 rounded-xl bg-nexus-blue/10 flex items-center justify-center text-nexus-blue border border-nexus-blue/20 shrink-0">
              <DollarSign size={18} />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-sm font-medium text-white/30 uppercase tracking-widest leading-none">งบประมาณรวม</span>
              <span className="text-[17px] font-bold text-nexus-blue mt-1 mono-numbers leading-none">฿8.5M</span>
            </div>
          </div>
          <div className="px-5 py-3 bg-black/40 border border-white/5 rounded-2xl flex items-center gap-3 min-w-[130px] transition-all hover:border-white/20 hover:bg-white/[0.03]">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white border border-white/10 shrink-0">
              <Users size={18} />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-sm font-medium text-white/30 uppercase tracking-widest leading-none">วิศวกรหน้างาน</span>
              <span className="text-[17px] font-bold text-white mt-1 mono-numbers leading-none">24 คน</span>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <section className="px-6 py-4 bg-black/10 border-b border-white/5 shrink-0">
        <PillTabs 
          tabs={tabs} 
          activeTab={activeTab} 
          onTabChange={(id: any) => setActiveTab(id)} 
        />
      </section>

      {/* Main Content Scroll Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="p-5 space-y-3 max-w-[1800px] mx-auto">

      <div className="flex flex-col lg:flex-row items-start gap-4">
        <div className="flex-1 w-full space-y-10">
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                 <Activity className="text-nexus-teal" size={24} />
                 <div className="space-y-0.5">
                    <p className="text-sm font-medium text-white/60 uppercase tracking-widest">สถานะการติดตั้งโครงสร้างพื้นฐาน (เขตกรุงเทพฯ)</p>
                    <h2 className="text-xl font-bold text-white uppercase">ทะเบียนข้อมูล</h2>
                 </div>
              </div>
              <div className="flex gap-3">
                 <PillButton variant="glass" className="h-9 px-6 rounded-full" onClick={() => setActiveTab("report")}>
                   <ClipboardList size={18} />
                   Service Report
                 </PillButton>
                 
                 {activeTab === "list" && (
                   <PillButton onClick={() => { setModalActiveTab("basic"); setActiveModal("project"); }} className="h-9 px-6 rounded-full shadow-neon-teal">
                     <Plus size={18} />
                     เริ่มโครงการใหม่
                   </PillButton>
                 )}
                 {activeTab === "planning" && (
                   <PillButton onClick={() => setActiveModal("milestone")} className="h-9 px-6 rounded-full shadow-neon-teal">
                     <Target size={18} />
                     เพิ่มเป้าหมาย
                   </PillButton>
                 )}
                 {activeTab === "report" && (
                   <PillButton onClick={() => setActiveModal("report")} className="h-9 px-6 rounded-full shadow-neon-teal">
                     <FileText size={18} />
                     บันทึกงานใหม่
                   </PillButton>
                 )}
              </div>
            </div>

            {/* Tactical Command Bar */}
            <div className="flex flex-col md:flex-row items-center gap-4 bg-white/[0.01] p-1.5 rounded-full border border-white/5 backdrop-blur-md">
               <NexusSearchInput 
                 placeholder="ค้นหาโครงการ, เลขที่ PRJ หรือข้อมูลในทะเบียน..." 
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 className="flex-1"
                 kbd="F"
               />
               <div className="flex items-center gap-2 pr-1.5">
                  <PillButton variant="glass" className="h-9 w-9 p-0 rounded-full border-white/5 hover:border-nexus-teal/30 hover:bg-nexus-teal/5">
                    <Filter size={18} className="text-white/40" />
                  </PillButton>
               </div>
            </div>

            {/* List / Planning / Report / Costing Content - Conditional Rendering wrapped in standard GlassCard viewport */}
            <GlassCard className="p-0 overflow-hidden border-white/5 min-h-[640px] flex flex-col justify-between bg-black/40">
              <div className="overflow-x-auto custom-scrollbar flex-1 w-full p-2">
                {activeTab === "list" && (
                  <div className="animate-in fade-in duration-500">
                    <NexusTable headers={["รหัสโครงการ", "ความคืบหน้า", "ทีมงาน", "กำหนดการ", "สถานะ"]}>
                      {filteredProjects.map(prj => (
                        <ProjectRow 
                          key={prj.id}
                          id={prj.id} 
                          name={prj.name} 
                          progress={prj.progress} 
                          team={prj.team} 
                          deadline={prj.deadline} 
                          status={prj.status} 
                        />
                      ))}
                    </NexusTable>
                  </div>
                )}

                {activeTab === "planning" && (
                  <div className="animate-in fade-in duration-500 space-y-3">
                    <GanttChart milestones={filteredMilestones} />
                  </div>
                )}

                {activeTab === "report" && (
                  <div className="animate-in fade-in duration-500">
                    <NexusTable headers={["เลขที่ Report", "โครงการ", "ช่างเทคนิค", "วันที่", "สถานะการเซ็น"]}>
                      <ReportRow id="SR-2604-001" project="Hospital A" tech="Kriangkrai M." date="24/04/2026" status="active" />
                      <ReportRow id="SR-2604-002" project="Hospital A" tech="Somchai J." date="25/04/2026" status="pending" />
                    </NexusTable>
                  </div>
                )}

                {activeTab === "costing" && (
                  <div className="animate-in fade-in duration-500">
                    <ProfitForecaster data={{
                      budget: 850000,
                      actualSpend: 620000,
                      progress: 75,
                      estimatedTotal: 785000
                    }} />
                  </div>
                )}

                {activeTab === "contractors" && (
                  <div className="animate-in fade-in duration-500 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                        <Users size={16} className="text-nexus-blue" />
                        ทำเนียบผู้รับเหมา และทีมช่างติดตั้ง
                      </h3>
                      <PillButton
                        type="button"
                        onClick={() => {
                          setSelectedContractor(null);
                          setIsContractorModalOpen(true);
                        }}
                        className="h-9 px-6 bg-nexus-blue text-white shadow-[0_0_15px_rgba(37,99,235,0.3)] text-xs font-bold uppercase rounded-full"
                      >
                        <Plus size={14} /> เพิ่มทีมช่างใหม่
                      </PillButton>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {dbContractors.length === 0 ? (
                        <div className="col-span-full p-12 text-center text-white/30 border border-white/5 border-dashed rounded-3xl">
                          ไม่มีข้อมูลผู้รับเหมาในระบบ
                        </div>
                      ) : (
                        dbContractors.map(cont => (
                          <div 
                            key={cont.id} 
                            onClick={() => {
                              setSelectedContractor(cont);
                              setIsContractorModalOpen(true);
                            }}
                            className="bg-white/[0.02] border border-white/5 p-5 rounded-[2rem] hover:bg-nexus-blue/5 hover:border-nexus-blue/30 transition-all cursor-pointer group"
                          >
                            <div className="flex justify-between items-start mb-3">
                              <div className="p-3 bg-black/40 rounded-2xl border border-white/5 group-hover:border-nexus-blue/30 transition-all">
                                <Users size={18} className="text-nexus-blue/70" />
                              </div>
                              <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-full border border-white/5">
                                <Star size={10} className="text-warning fill-warning" />
                                <span className="text-sm font-medium font-mono text-white/80">{cont.rating?.toFixed(1) || "5.0"}</span>
                              </div>
                            </div>
                            <h4 className="text-[13px] font-bold text-white mb-1 truncate">{cont.name}</h4>
                            <div className="text-[11px] text-white/50 font-bold mb-4 flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></span>
                              Active Partner
                            </div>
                            
                            <div className="space-y-1.5 border-t border-white/5 pt-4">
                              <div className="flex items-center gap-2 text-[10px] text-white/40">
                                <Phone size={12} className="text-white/20"/> {cont.phone || "-"}
                              </div>
                              <div className="flex items-center justify-between text-[10px] text-white/40 mt-1">
                                <span className="flex items-center gap-2"><Wrench size={12} className="text-white/20"/> ชุดค่าแรงมาตรฐาน</span>
                                <span className="font-mono text-nexus-blue">{cont.laborRates?.length || 0} รายการ</span>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-white/5 bg-black/10 flex items-center justify-between text-xs text-white/30 font-bold">
                <span>สตรีมข้อมูลคลาวด์สด • NEXUS Real-time Engine</span>
                <span>PSG Master UI Standard V3.1</span>
              </div>
            </GlassCard>
          </div>

        </div>

        {/* Right Sidebar Status */}
        <div className="space-y-3">
           <GlassCard className="p-4 border-white/10 bg-nexus-teal/5">
              <h4 className="text-sm font-medium text-nexus-teal uppercase tracking-widest mb-6">ดัชนีชี้วัดสุขภาพโครงการ</h4>
              <div className="space-y-3">
                 <HealthItem label="อัตราการใช้งบประมาณ" value="72%" color="bg-nexus-teal" />
                 <HealthItem label="ความสำเร็จของงาน" value="85%" color="bg-nexus-blue" />
                 <HealthItem label="การปฏิบัติตาม SLA" value="100%" color="bg-nexus-teal" />
              </div>
           </GlassCard>

           <GlassCard className="p-4 border-white/10">
              <h4 className="text-sm font-medium text-white/60 uppercase tracking-widest mb-6">กำหนดการสำคัญที่ใกล้ถึง</h4>
              <div className="space-y-3">
                 <DeadlineItem title="ติดตั้ง Core Switch" date="พรุ่งนี้" project="PRJ-26-001" />
                 <DeadlineItem title="ส่งมอบงานลูกค้า" date="28 เม.ย." project="PRJ-26-002" />
              </div>
           </GlassCard>
        </div>
      </div>
      </div>
      </div>

      {/* Standardized Management Modal - Context Aware */}
      <Modal 
        isOpen={!!activeModal} 
        onClose={() => setActiveModal(null)} 
        title={
          activeModal === "project" ? "เปิดโครงการใหม่" :
          activeModal === "milestone" ? "เพิ่มเป้าหมาย" :
          "บันทึกรายงานหน้างาน"
        }
        maxWidth="max-w-7xl"
      >
        <div className="flex h-full divide-x divide-white/5 bg-[#0a0a0c]">
           <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <div className="max-w-4xl mx-auto space-y-10">
                  {activeModal === "project" && (
                    <>
                     <PillTabs 
                         tabs={[
                           { id: "basic", label: "รายละเอียด" },
                           { id: "site", label: "ไซต์งาน" },
                           { id: "governance", label: "ทีมงาน" },
                           { id: "budget", label: "งบประมาณ" }
                         ]}
                         activeTab={modalActiveTab}
                         onTabChange={setModalActiveTab}
                     />
                     
                     <div className="space-y-3 animate-in fade-in duration-500">
                         {modalActiveTab === "basic" && (
                           <div className="space-y-10 animate-in slide-in-from-left-4 duration-300">
                               <div className="space-y-3">
                                 <div className="flex items-center gap-3 text-nexus-teal"><Sparkles size={18} /><h4 className="text-[13px] font-bold uppercase tracking-widest">1. ข้อมูลพื้นฐานโครงการ</h4></div>
                                 <div className="space-y-3">
                                     <div className="space-y-2">
                                       <label className="text-[12px] font-bold text-white/60 uppercase tracking-widest ml-1">ชื่อโครงการ / หัวข้อการติดตั้ง *</label>
                                       <PillInput value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="ระบุชื่อโครงการ..." className="w-full text-white font-bold" />
                                     </div>
                                     <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                       <div className="space-y-2">
                                           <label className="text-[12px] font-bold text-white/60 uppercase tracking-widest ml-1">ประเภทโครงการ</label>
                                           <PillSelect value={projectType} onChange={(e) => setProjectType(e.target.value)} className="w-full">
                                             <option value="Infrastructure (งานระบบโครงสร้าง)">Infrastructure (งานระบบโครงสร้าง)</option>
                                             <option value="Software (งานซอฟต์แวร์)">Software (งานซอฟต์แวร์)</option>
                                             <option value="Consulting (งานที่ปรึกษา)">Consulting (งานที่ปรึกษา)</option>
                                             <option value="Maintenance (งานซ่อมบำรุง)">Maintenance (งานซ่อมบำรุง)</option>
                                           </PillSelect>
                                       </div>
                                       <div className="space-y-2">
                                           <label className="text-[12px] font-bold text-white/60 uppercase tracking-widest ml-1">ลำดับความสำคัญ</label>
                                           <PillSelect value={projectPriority} onChange={(e) => setProjectPriority(e.target.value)} className="w-full text-warning font-bold">
                                             <option value="LOW (ทั่วไป)">LOW (ทั่วไป)</option>
                                             <option value="MEDIUM (ปานกลาง)">MEDIUM (ปานกลาง)</option>
                                             <option value="HIGH (เร่งด่วน)">HIGH (เร่งด่วน)</option>
                                             <option value="CRITICAL (วิกฤต)">CRITICAL (วิกฤต)</option>
                                           </PillSelect>
                                       </div>
                                     </div>
                                     <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                       <div className="space-y-2">
                                           <label className="text-[12px] font-bold text-white/60 uppercase tracking-widest ml-1">รหัสอ้างอิงลูกค้า</label>
                                           <PillInput value={projectRef} onChange={(e) => setProjectRef(e.target.value)} placeholder="ระบุรหัสเอกสารอ้างอิง..." className="w-full" />
                                       </div>
                                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                           <div className="space-y-2">
                                             <label className="text-[12px] font-bold text-white/60 uppercase tracking-widest ml-1">วันที่เริ่ม</label>
                                             <PillInput type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full" />
                                           </div>
                                           <div className="space-y-2">
                                             <label className="text-[12px] font-bold text-white/60 uppercase tracking-widest ml-1">วันสิ้นสุด</label>
                                             <PillInput type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full" />
                                           </div>
                                       </div>
                                     </div>
                                 </div>
                               </div>
                           </div>
                         )}

                         {modalActiveTab === "site" && (
                           <div className="space-y-10 animate-in slide-in-from-left-4 duration-300">
                               <div className="space-y-3">
                                 <div className="flex items-center gap-3 text-nexus-blue"><Sparkles size={18} /><h4 className="text-[13px] font-bold uppercase tracking-widest">2. พิกัดและข้อมูลผู้ติดต่อหน้างาน</h4></div>
                                 <div className="space-y-3">
                                     <div className="space-y-2">
                                       <label className="text-[12px] font-bold text-white/60 uppercase tracking-widest ml-1">สถานที่ติดตั้ง *</label>
                                       <textarea 
                                           className="w-full h-24 rounded-lg bg-white/[0.03] border border-white/10 text-white text-[14px] font-bold p-5 focus:outline-none focus:border-nexus-blue/40 transition-all placeholder:text-white/5"
                                           placeholder="ระบุที่อยู่ที่แน่นอน หรือลิงก์ Google Maps..."
                                           defaultValue="ศูนย์ประชุมแห่งชาติสิริกิติ์ อาคาร 2 ชั้น 1 ห้องสัมมนาย่อย"
                                       />
                                     </div>
                                     <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                       <div className="space-y-2">
                                           <label className="text-[12px] font-bold text-white/60 uppercase tracking-widest ml-1">ผู้ติดต่อหน้างาน</label>
                                           <PillInput defaultValue="Somchai J." placeholder="ชื่อผู้ติดต่อ..." className="w-full" />
                                       </div>
                                       <div className="space-y-2">
                                           <label className="text-[12px] font-bold text-white/60 uppercase tracking-widest ml-1">เบอร์โทรศัพท์ติดต่อ</label>
                                           <PillInput defaultValue="089-123-4567" placeholder="08x-xxx-xxxx" className="w-full" />
                                       </div>
                                     </div>
                                 </div>
                               </div>
                           </div>
                         )}

                         {modalActiveTab === "governance" && (
                           <div className="space-y-10 animate-in slide-in-from-left-4 duration-300">
                               <div className="space-y-3">
                                 <div className="flex items-center gap-3 text-white"><Sparkles size={18} /><h4 className="text-[13px] font-bold uppercase tracking-widest">3. ผู้รับผิดชอบและงบประมาณ</h4></div>
                                 <div className="space-y-3">
                                     <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                       <div className="space-y-2">
                                           <label className="text-[12px] font-bold text-white/60 uppercase tracking-widest ml-1">ผู้จัดการโครงการ</label>
                                           <PillSelect defaultValue="Chatchai S." className="w-full px-6">
                                             <option value="">กรุณาเลือกผู้รับผิดชอบ...</option>
                                             <option value="Chatchai S.">Chatchai S. (Lead)</option>
                                             <option value="Kriangkrai M.">Kriangkrai M.</option>
                                           </PillSelect>
                                       </div>
                                       <div className="space-y-2">
                                           <label className="text-[12px] font-bold text-white/60 uppercase tracking-widest ml-1">ชื่อลูกค้าผู้ชำระเงิน *</label>
                                           <PillSelect value={projectCustomer} onChange={(e) => setProjectCustomer(e.target.value)} className="w-full px-6 text-nexus-teal font-bold">
                                             <option value="">เลือกชื่อลูกค้า...</option>
                                             <option value="CUS-001">โรงพยาบาลตากสิน</option>
                                             <option value="CUS-002">PSG Solutions</option>
                                             <option value="CUS-003">สถาบันเทคโนโลยีพระจอมเกล้าฯ</option>
                                             <option value="CUS-004">ศูนย์ประชุมแห่งชาติ</option>
                                           </PillSelect>
                                       </div>
                                     </div>
                                     <div className="space-y-2">
                                       <label className="text-[12px] font-bold text-white/60 uppercase tracking-widest ml-1">ทีมวิศวกรที่ได้รับมอบหมาย</label>
                                       <div className="p-4 rounded-lg bg-white/[0.02] border border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                           {['Engineering Team A', 'Support Staff', 'Network Engineer', 'Electrician'].map(team => (
                                             <div key={team} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-all cursor-pointer">
                                                 <div className="w-4 h-4 rounded border border-white/20 flex-shrink-0 bg-nexus-blue/20 border-nexus-blue" />
                                                 <span className="text-[12px] font-bold text-white/80">{team}</span>
                                             </div>
                                           ))}
                                       </div>
                                     </div>
                                 </div>
                               </div>
                           </div>
                         )}

                         {/* NEW DETAILED BUDGET & EQUIPMENT TAB */}
                         {modalActiveTab === "budget" && (
                           <div className="space-y-3 animate-in slide-in-from-right-4 duration-300">
                             {/* Dual Catalogue & Selected List Split Grid */}
                             <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
                               
                               {/* LEFT COLUMN: AVAILABLE CATALOGUE WAREHOUSE & labor PACKAGES SPLIT TABLE (42% Width) */}
                               <div className="xl:col-span-5 space-y-3">
                                 <div className="flex flex-wrap items-center justify-between gap-4 w-full">
                                   <h4 className="text-[12px] font-bold text-white/70 uppercase tracking-[0.2em] flex items-center gap-2 shrink-0">
                                     <Package size={14} className="text-nexus-blue animate-pulse" /> 1.1 คลังพัสดุและชุดงาน
                                   </h4>

                                   {/* Sub-tabs to choose between standard warehouse items or installation packages */}
                                    <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto min-w-0">
                                      <div className={`transition-all duration-300 overflow-hidden shrink-0 ${catalogActiveSubTab === "packages" ? "w-full sm:w-auto opacity-100" : "w-0 opacity-0 pointer-events-none"}`}>
                                        <button
                                          type="button"
                                          onClick={() => setIsKitEditorOpen(true)}
                                          className="h-9 px-6 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 hover:bg-cyan-500/30 transition-all text-sm font-medium uppercase tracking-wider flex items-center justify-center gap-1.5 whitespace-nowrap w-full"
                                        >
                                          <Plus size={12} /> สร้างชุดงาน 🛠️
                                        </button>
                                      </div>
                                      <div className="flex bg-[#0a0a0c] rounded-full p-0.5 border border-white/5 shrink-0 overflow-x-auto no-scrollbar flex-nowrap min-w-0 w-full sm:w-auto">
                                     <button
                                       type="button"
                                       onClick={() => setCatalogActiveSubTab("warehouse")}
                                       className={`flex-1 sm:flex-none justify-center px-4 py-1.5 rounded-full text-[12px] font-bold uppercase tracking-wider transition-all whitespace-nowrap shrink-0 ${catalogActiveSubTab === "warehouse" ? "bg-nexus-blue text-white" : "text-white/40 hover:text-white"}`}
                                     >
                                       📦 อุปกรณ์
                                     </button>
                                     <button
                                       type="button"
                                       onClick={() => setCatalogActiveSubTab("packages")}
                                       className={`flex-1 sm:flex-none justify-center px-4 py-1.5 rounded-full text-[12px] font-bold uppercase tracking-wider transition-all whitespace-nowrap shrink-0 ${catalogActiveSubTab === "packages" ? "bg-nexus-teal text-black" : "text-white/40 hover:text-white"}`}
                                     >
                                       ⚡ ชุดงานติดตั้ง
                                      </button>
                                    </div>
                                  </div>
                                 </div>

                                 <div className="space-y-3 p-5 rounded-[2rem] bg-white/[0.02] border border-white/5 shadow-xl">
                                   {/* Compact intelligent search input */}
                                   <div className="relative">
                                     <PillInput 
                                       className="w-full bg-[#0a0a0c] border-white/5 text-white text-xs font-bold" 
                                       placeholder={catalogActiveSubTab === "warehouse" ? "🔍 พิมพ์ค้นหา SKU หรือชื่ออุปกรณ์..." : "🔍 ค้นหาชุดงานติดตั้งพร้อมใช้..."} 
                                       value={catalogSearchQuery}
                                       onChange={(e) => setCatalogSearchQuery(e.target.value)}
                                     />
                                     {catalogSearchQuery && (
                                       <button 
                                         type="button" 
                                         onClick={() => setCatalogSearchQuery("")} 
                                         className="absolute right-3 top-2.5 text-white/30 hover:text-white transition-colors"
                                       >
                                         <X size={14} />
                                       </button>
                                     )}
                                   </div>

                                   <div className="border border-white/5 rounded-[1.5rem] overflow-hidden bg-white/[0.01] max-h-[360px] overflow-y-auto custom-scrollbar">
                                     {catalogActiveSubTab === "warehouse" ? (
                                       <NexusTable headers={["ข้อมูลสินค้า / SKU", "สต็อก", "ราคามาตรฐาน", "เลือก"]}>
                                         {(() => {
                                           const filtered = activeWarehouseProducts.filter(p => 
                                             p.name.toLowerCase().includes(catalogSearchQuery.toLowerCase()) ||
                                             p.sku.toLowerCase().includes(catalogSearchQuery.toLowerCase())
                                           );

                                           if (filtered.length === 0) {
                                             return (
                                               <NexusTableRow>
                                                 <NexusTableCell colSpan={4} className="text-center py-8 text-white/30 italic text-xs">
                                                   ไม่พบพัสดุตรงตามคำค้นหา
                                                 </NexusTableCell>
                                               </NexusTableRow>
                                             );
                                           }

                                           return filtered.map(p => (
                                             <NexusTableRow key={p.sku} className="hover:bg-white/[0.02] transition-colors">
                                               <NexusTableCell className="w-[50%]">
                                                 <div className="font-mono text-xs text-nexus-blue">{p.sku}</div>
                                                 <div className="text-xs font-bold text-white/80 whitespace-nowrap" title={p.name}>{p.name}</div>
                                               </NexusTableCell>
                                               <NexusTableCell className="text-center w-[20%]">
                                                 <span className="text-xs text-white/60 font-medium">{p.qty_on_hand} {p.unit}</span>
                                               </NexusTableCell>
                                               <NexusTableCell className="text-right w-[20%] font-mono text-xs text-nexus-teal font-medium">
                                                 ฿ {p.price.toLocaleString()}
                                               </NexusTableCell>
                                               <NexusTableCell className="text-center w-[10%]">
                                                 <button
                                                   type="button"
                                                   onClick={() => {
                                                     const existing = projectEquipments.find(item => item.sku === p.sku);
                                                     if (existing) {
                                                       updateEquipment(existing.id, "qty", existing.qty + 1);
                                                       showToast(`เพิ่มจำนวน ${p.name} เป็น ${existing.qty + 1} ชิ้น`);
                                                     } else {
                                                       setProjectEquipments([
                                                         ...projectEquipments,
                                                         { id: Date.now(), name: p.name, sku: p.sku, qty: 1, cost: p.cost, price: p.price }
                                                       ]);
                                                       showToast(`เพิ่ม ${p.name} เข้าโครงการสำเร็จ!`);
                                                     }
                                                   }}
                                                   className="p-1.5 rounded-full bg-nexus-teal/10 hover:bg-nexus-teal text-nexus-teal hover:text-black border border-nexus-teal/20 transition-all flex items-center justify-center"
                                                 >
                                                   <Plus size={12} />
                                                 </button>
                                               </NexusTableCell>
                                             </NexusTableRow>
                                           ));
                                         })()}
                                       </NexusTable>
                                     ) : (
                                       <NexusTable headers={["รหัส / ชุดงานติดตั้ง", "ราคาเสนอขายรวม", "การทำงาน"]}>
                                         {(() => {
                                            const filtered = activeInstallationPackages.filter(p => 
                                             p.name.toLowerCase().includes(catalogSearchQuery.toLowerCase()) ||
                                             p.sku.toLowerCase().includes(catalogSearchQuery.toLowerCase())
                                           );

                                           if (filtered.length === 0) {
                                             return (
                                               <NexusTableRow>
                                                 <NexusTableCell colSpan={3} className="text-center py-8 text-white/30 italic text-xs">
                                                   ไม่พบชุดงานติดตั้งพร้อมใช้
                                                 </NexusTableCell>
                                               </NexusTableRow>
                                             );
                                           }

                                           return filtered.map(pkg => (
                                             <NexusTableRow key={pkg.sku} className="hover:bg-white/[0.02] transition-colors">
                                               <NexusTableCell className="w-[55%]">
                                                 <div className="font-mono text-xs text-nexus-teal font-bold">{pkg.sku}</div>
                                                 <div className="text-xs font-bold text-white/80 whitespace-nowrap" title={pkg.name}>{pkg.name}</div>
                                                 <div className="text-xs text-white/40 font-bold leading-none mt-0.5">{pkg.details}</div>
                                               </NexusTableCell>
                                               <NexusTableCell className="text-right w-[25%] font-mono text-xs text-nexus-teal font-medium">
                                                 ฿ {pkg.price.toLocaleString()}
                                               </NexusTableCell>
                                               <NexusTableCell className="text-center w-[20%]">
                                                 <div className="flex items-center justify-center gap-1.5">
                                                   <button
                                                     type="button"
                                                     title="เพิ่มใส่เป็น 1 รายการอุปกรณ์ในโครงการ"
                                                     onClick={() => {
                                                       const existing = projectEquipments.find(item => item.sku === pkg.sku);
                                                       if (existing) {
                                                         updateEquipment(existing.id, "qty", existing.qty + 1);
                                                         showToast(`เพิ่มจำนวนชุดงาน ${pkg.name} เป็น ${existing.qty + 1} ชุด`);
                                                       } else {
                                                         setProjectEquipments([
                                                           ...projectEquipments,
                                                           { id: Date.now(), name: pkg.name, sku: pkg.sku, qty: 1, cost: pkg.cost, price: pkg.price }
                                                         ]);
                                                         showToast(`เพิ่มชุดงาน "${pkg.name}" เป็น 1 รายการอุปกรณ์ในโครงการสำเร็จ!`);
                                                       }
                                                     }}
                                                     className="p-1.5 rounded-full bg-nexus-blue/10 hover:bg-nexus-blue text-nexus-blue hover:text-white border border-nexus-blue/20 transition-all flex items-center justify-center"
                                                   >
                                                     <Plus size={11} />
                                                   </button>
                                                   <button
                                                     type="button"
                                                     title="ออกใบเสนอราคาสำหรับชุดงานนี้ทันที"
                                                     onClick={() => {
                                                       setQuotationInitialData({
                                                         title: pkg.name,
                                                         customer: projectCustomer,
                                                         items: [
                                                           {
                                                             id: Date.now() + Math.random(),
                                                             name: pkg.name,
                                                             qty: 1,
                                                             unit: pkg.unit,
                                                             cost: pkg.cost,
                                                             price: pkg.price
                                                           }
                                                         ]
                                                       });
                                                       setActiveModal(null);
                                                       setIsQuotationOpen(true);
                                                       showToast(`ดึงชุดงาน "${pkg.name}" ออกใบเสนอราคาสำเร็จ!`);
                                                     }}
                                                     className="p-1.5 rounded-full bg-nexus-teal/10 hover:bg-nexus-teal text-nexus-teal hover:text-black border border-nexus-teal/20 transition-all flex items-center justify-center"
                                                   >
                                                     <FileText size={11} />
                                                   </button>
                                                 </div>
                                               </NexusTableCell>
                                             </NexusTableRow>
                                           ));
                                         })()}
                                       </NexusTable>
                                     )}
                                   </div>
                                 </div>
                               </div>

                              {/* RIGHT COLUMN: INTEGRATED SELECTION & BUDGET MANAGERS (58% Width) */}
                              <div className="xl:col-span-7 space-y-3">
                                <div className="flex flex-wrap justify-between items-center gap-4">
                                  {/* Sleek Sub-tabs for separating Equipment and Installation Work */}
                                  <div className="flex bg-[#0a0a0c] rounded-full p-0.5 border border-white/5 shrink-0 overflow-x-auto no-scrollbar flex-nowrap min-w-0 w-full xl:w-auto">
                                    <button
                                      type="button"
                                      onClick={() => setRightActiveSubTab("equipment")}
                                      className={`px-4 py-1.5 rounded-full text-[12px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${rightActiveSubTab === "equipment" ? "bg-nexus-teal text-black shadow-neon-teal/20" : "text-white/40 hover:text-white"}`}
                                    >
                                      <Package size={14} />
                                      📦 อุปกรณ์โครงการ ({projectEquipments.length})
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setRightActiveSubTab("labor")}
                                      className={`px-4 py-1.5 rounded-full text-[12px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${rightActiveSubTab === "labor" ? "bg-nexus-blue text-white shadow-neon-blue/20" : "text-white/40 hover:text-white"}`}
                                    >
                                      <Users size={14} />
                                      🛠️ งานติดตั้ง/ค่าแรง ({projectLabors.length})
                                    </button>
                                  </div>

                                  {/* Tab-specific Quick Action Button */}
                                  <div className="shrink-0 w-full sm:w-auto flex">
                                   {rightActiveSubTab === "equipment" ? (
                                     <PillButton className="h-9 px-6 rounded-full w-full flex-1" onClick={addEquipment}>
                                      <Plus size={14} /> เพิ่มรายการอิสระ
                                    </PillButton>
                                  ) : (
                                     <PillButton variant="glass" className="h-9 px-6 rounded-full w-full flex-1" onClick={addLabor}>
                                      <Plus size={14} /> เพิ่มงานบริการ
                                    </PillButton>
                                  )}
                                </div>
                                </div>

                                {/* Dynamic Sub-tab Panels */}
                                {rightActiveSubTab === "equipment" ? (
                                  /* EQUIPMENT LIST PANEL */
                                  <div className="border border-white/5 rounded-[2rem] overflow-hidden bg-white/[0.01] shadow-2xl min-h-[360px] max-h-[460px] overflow-y-auto custom-scrollbar">
                                    {projectEquipments.length === 0 ? (
                                      <div className="flex flex-col items-center justify-center p-16 text-center space-y-3">
                                        <Package size={48} className="text-white/10 animate-pulse" />
                                        <p className="text-xs text-white/40 font-bold uppercase tracking-widest">ยังไม่มีการเลือกอุปกรณ์สำหรับโครงการนี้</p>
                                        <p className="text-[10px] text-white/30">กรุณากดปุ่มเครื่องหมายบวกจากตารางสินค้าในคลังทางซ้าย เพื่อเลือกพัสดุ</p>
                                      </div>
                                    ) : (
                                      <NexusTable headers={["รหัส/รายการพัสดุ", "จำนวน", "ราคาขาย/ชิ้น", "ราคารวมเสนอ", "ราคาแนะนำเดิม", "ลบ"]}>
                                        {projectEquipments.map((item) => {
                                          const historicalPrice = item.sku && PRICING_HISTORY[projectCustomer]?.[item.sku];

                                          return (
                                            <NexusTableRow key={item.id} className="hover:bg-white/[0.01] transition-colors">
                                              {/* Product details */}
                                              <NexusTableCell className="w-[30%] min-w-[180px]">
                                                <div className="space-y-1">
                                                  {item.sku && <span className="px-2 py-0.5 rounded bg-nexus-blue/10 text-nexus-blue text-xs font-mono font-medium">{item.sku}</span>}
                                                  <div className="text-xs font-bold text-white whitespace-nowrap" title={item.name}>{item.name}</div>
                                                </div>
                                              </NexusTableCell>

                                              {/* Qty */}
                                              <NexusTableCell className="w-[15%] min-w-[90px]">
                                                <NumberStepper value={item.qty} unit="ชิ้น" onChange={(v) => updateEquipment(item.id, "qty", v)} />
                                              </NexusTableCell>

                                              {/* Price */}
                                              <NexusTableCell className="w-[18%] min-w-[110px]">
                                                <NumberStepper value={item.price} unit="฿" step={100} onChange={(v) => updateEquipment(item.id, "price", v)} />
                                              </NexusTableCell>

                                              {/* Total */}
                                              <NexusTableCell className="text-right font-bold font-mono text-nexus-teal text-xs w-[15%]">
                                                ฿ {(item.qty * item.price).toLocaleString()}
                                              </NexusTableCell>

                                              {/* Historical price trigger */}
                                              <NexusTableCell className="w-[17%] min-w-[110px]">
                                                {historicalPrice ? (
                                                  <button 
                                                    type="button"
                                                    onClick={() => {
                                                      updateEquipment(item.id, "price", historicalPrice);
                                                      showToast("ดึงราคาประวัติเดิมสำเร็จ!");
                                                    }}
                                                    className="flex items-center gap-1 px-2 py-1 rounded-full bg-nexus-teal/10 hover:bg-nexus-teal/20 text-nexus-teal font-bold border border-nexus-teal/20 hover:border-nexus-teal/40 transition-all cursor-pointer text-xs w-full justify-center animate-shimmer"
                                                  >
                                                    <Zap size={9} className="animate-pulse shrink-0 text-nexus-teal" />
                                                    <span>ประวัติ: ฿{historicalPrice.toLocaleString()}</span>
                                                  </button>
                                                ) : (
                                                  <span className="text-white/20 italic text-xs block text-center">ไม่มีประวัติเดิม</span>
                                                )}
                                              </NexusTableCell>

                                              {/* Actions */}
                                              <NexusTableCell className="text-center w-[5%]">
                                                <button onClick={() => removeEquipment(item.id)} className="p-2 text-white/40 hover:text-danger transition-colors">
                                                  <Trash2 size={14} />
                                                </button>
                                              </NexusTableCell>
                                            </NexusTableRow>
                                          );
                                        })}
                                      </NexusTable>
                                    )}
                                  </div>
                                ) : (
                                  /* INSTALLATION LABOR / WORK CARD LIST PANEL */
                                  <div className="space-y-3 max-h-[460px] overflow-y-auto custom-scrollbar pr-2 min-h-[360px]">
                                    {projectLabors.length === 0 ? (
                                      <div className="flex flex-col items-center justify-center p-16 text-center space-y-3 bg-white/[0.01] border border-white/5 rounded-[2rem] h-full">
                                        <Users size={48} className="text-white/10 animate-pulse" />
                                        <p className="text-xs text-white/40 font-bold uppercase tracking-widest">ยังไม่มีรายการงานติดตั้งหรือค่าบริการ</p>
                                        <p className="text-[10px] text-white/30">กดปุ่ม "เพิ่มงานบริการ" ที่มุมขวาบนเพื่อเริ่มกำหนดค่าแรงและแผนงาน</p>
                                      </div>
                                    ) : (
                                      projectLabors.map((item) => {
                                        const isPerPoint = item.type === "per-point";
                                        const matCost = item.materialCost || 0;
                                        const labCost = item.laborCost || 0;
                                        const pts = item.points || 1;
                                        const unitCost = matCost + labCost;
                                        const totalCost = isPerPoint ? (unitCost * pts) : (item.cost || 0);
                                        const pricePerPoint = item.price || 0;
                                        const totalRevenue = isPerPoint ? (pricePerPoint * pts) : (item.price || 0);
                                        const itemProfit = totalRevenue - totalCost;
                                        const itemGP = totalRevenue > 0 ? Math.round((itemProfit / totalRevenue) * 100) : 0;

                                        return (
                                          <div key={item.id} className="p-5 bg-white/[0.02] border border-white/5 rounded-[2rem] space-y-3 shadow-lg group hover:border-nexus-blue/20 transition-all">
                                            {/* Header row: Name & Toggle Mode */}
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                              <div className="flex-1 min-w-[200px] space-y-1">
                                                <label className="text-xs font-medium text-white/55 uppercase tracking-widest ml-1">รายละเอียดงานบริการ / ค่าแรง</label>
                                                <PillInput className="w-full bg-[#0a0a0c] border-white/5 text-white text-xs font-bold focus:border-nexus-blue/50" value={item.name} onChange={(e) => updateLabor(item.id, "name", e.target.value)} />
                                              </div>

                                              <div className="flex flex-col xl:flex-row xl:items-center gap-3 shrink-0 min-w-0">
                                                <div className="flex bg-[#0a0a0c] rounded-full p-0.5 border border-white/5 shrink-0 overflow-x-auto no-scrollbar flex-nowrap min-w-0 w-full xl:w-auto">
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      updateLabor(item.id, "type", "lump-sum");
                                                      updateLabor(item.id, "cost", totalCost);
                                                      updateLabor(item.id, "price", totalRevenue);
                                                    }}
                                                    className={`flex-1 sm:flex-none justify-center px-4 py-1.5 rounded-full text-sm font-medium uppercase tracking-wider transition-all whitespace-nowrap shrink-0 ${!isPerPoint ? "bg-nexus-blue text-white shadow-neon-blue/20" : "text-white/40 hover:text-white"}`}
                                                  >
                                                    เหมาจ่าย
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      updateLabor(item.id, "type", "per-point");
                                                      updateLabor(item.id, "points", 1);
                                                      updateLabor(item.id, "materialSku", "");
                                                      updateLabor(item.id, "materialCost", 0);
                                                      updateLabor(item.id, "laborCost", totalCost);
                                                      updateLabor(item.id, "price", totalRevenue);
                                                    }}
                                                    className={`flex-1 sm:flex-none justify-center px-4 py-1.5 rounded-full text-sm font-medium uppercase tracking-wider transition-all whitespace-nowrap shrink-0 ${isPerPoint ? "bg-nexus-teal text-black shadow-neon-teal/20" : "text-white/40 hover:text-white"}`}
                                                  >
                                                    คิดตามจุด ⚡
                                                  </button>
                                                </div>
                                              </div>
                                            </div>

                                            {/* Mode conditional options */}
                                            {isPerPoint ? (
                                              <div className="grid grid-cols-1 gap-3 items-center bg-black/30 p-4 rounded-[1.5rem] border border-white/[0.02]">
                                                {/* Step 1: Material Stock Picker */}
                                                <div className="space-y-1">
                                                  <label className="text-xs font-medium text-white/55 uppercase tracking-widest block">
                                                    เชื่อมพัสดุในคลัง
                                                  </label>
                                                  <PillSelect 
                                                    value={item.materialSku || ""}
                                                    onChange={(e) => {
                                                      const sku = e.target.value;
                                                      const product = WAREHOUSE_PRODUCTS.find(p => p.sku === sku);
                                                      if (product) {
                                                        updateLabor(item.id, "materialSku", sku);
                                                        updateLabor(item.id, "materialCost", product.price);
                                                        showToast(`เชื่อมพัสดุ ${product.name} สำเร็จ!`);
                                                      } else {
                                                        updateLabor(item.id, "materialSku", "");
                                                        updateLabor(item.id, "materialCost", 0);
                                                      }
                                                    }}
                                                    className="w-full bg-[#0a0a0c] text-[11px] font-bold text-white border-white/5 h-8 py-0"
                                                  >
                                                    <option value="">-- ไม่เชื่อมโยงพัสดุ --</option>
                                                    {WAREHOUSE_PRODUCTS.map(p => (
                                                      <option key={p.sku} value={p.sku}>{p.sku} - {p.name} (฿ {p.price})</option>
                                                    ))}
                                                  </PillSelect>
                                                </div>

                                                <div className="grid grid-cols-4 gap-2">
                                                  {/* Step 2: Number of Points */}
                                                  <div className="space-y-1">
                                                    <label className="text-[10px] font-medium text-white/55 uppercase tracking-widest block text-center">จุดติดตั้ง</label>
                                                    <NumberStepper value={pts} unit="จุด" min={1} onChange={(v) => updateLabor(item.id, "points", v)} />
                                                  </div>

                                                  {/* Step 3: Material Cost / Point */}
                                                  <div className="space-y-1">
                                                    <label className="text-[10px] font-medium text-white/55 uppercase tracking-widest block text-right">ค่าวัสดุ/จุด</label>
                                                    <NumberStepper value={matCost} unit="฿" step={50} onChange={(v) => updateLabor(item.id, "materialCost", v)} />
                                                  </div>

                                                  {/* Step 4: Labor Cost / Point */}
                                                  <div className="space-y-1">
                                                    <label className="text-[10px] font-medium text-white/55 uppercase tracking-widest block text-right">ค่าแรง/จุด</label>
                                                    <NumberStepper value={labCost} unit="฿" step={50} onChange={(v) => updateLabor(item.id, "laborCost", v)} />
                                                  </div>

                                                  {/* Step 5: Selling Price / Point */}
                                                  <div className="space-y-1">
                                                    <label className="text-[10px] font-medium text-white/55 uppercase tracking-widest block text-right text-nexus-teal">ราคาขาย/จุด</label>
                                                    <NumberStepper value={pricePerPoint} unit="฿" step={50} onChange={(v) => updateLabor(item.id, "price", v)} />
                                                  </div>
                                                </div>
                                              </div>
                                            ) : (
                                              /* Lump Sum Mode Inputs */
                                              <div className="grid grid-cols-2 gap-4 bg-black/10 p-4 rounded-[1.5rem] border border-white/[0.02]">
                                                <div className="space-y-1">
                                                  <label className="text-xs font-medium text-white/55 uppercase tracking-widest block text-right">ต้นทุนเหมาจ่าย (฿)</label>
                                                  <NumberStepper value={item.cost || 0} unit="฿" step={500} onChange={(v) => updateLabor(item.id, "cost", v)} />
                                                </div>
                                                <div className="space-y-1">
                                                  <label className="text-xs font-medium text-white/55 uppercase tracking-widest block text-right text-nexus-blue">ราคาเสนอขายเหมา (฿)</label>
                                                  <NumberStepper value={item.price || 0} unit="฿" step={500} onChange={(v) => updateLabor(item.id, "price", v)} />
                                                </div>
                                              </div>
                                            )}

                                            {/* Sub-footer details inside labor card */}
                                            <div className="flex flex-wrap items-center justify-between pt-2 border-t border-white/[0.03] text-[10px]">
                                              <div className="flex flex-col gap-0.5">
                                                {isPerPoint ? (
                                                  <>
                                                    <span className="text-white/45 font-bold uppercase tracking-wider">
                                                      ต้นทุนสะสม: <span className="text-danger font-mono ml-1 text-[10px]">฿{totalCost.toLocaleString()}</span> (฿{unitCost.toLocaleString()}/จุด)
                                                    </span>
                                                    <span className="text-white/45 font-bold uppercase tracking-wider">
                                                      เสนอขายสะสม: <span className="text-nexus-teal font-mono ml-1 text-[10px]">฿{totalRevenue.toLocaleString()}</span> (฿{pricePerPoint.toLocaleString()}/จุด)
                                                    </span>
                                                  </>
                                                ) : (
                                                  <>
                                                    <span className="text-white/45 font-bold uppercase tracking-wider">
                                                      ต้นทุนเหมา: <span className="text-danger font-mono ml-1 text-[10px]">฿{totalCost.toLocaleString()}</span>
                                                    </span>
                                                    <span className="text-white/45 font-bold uppercase tracking-wider">
                                                      เสนอขายเหมา: <span className="text-nexus-blue font-mono ml-1 text-[10px]">฿{totalRevenue.toLocaleString()}</span>
                                                    </span>
                                                  </>
                                                )}
                                              </div>

                                              <div className="flex items-center gap-3">
                                                <div className="flex items-center shrink-0">
                                                  <span className="px-2 py-0.5 rounded-full bg-white/[0.04] text-xs font-mono font-bold text-nexus-teal border border-white/5">
                                                    กำไร: ฿ {itemProfit.toLocaleString()} ({itemGP}%)
                                                  </span>
                                                </div>
                                                <button
                                                  type="button"
                                                  onClick={() => saveLaborAsPackage(item)}
                                                  className="px-2.5 py-1 rounded-full bg-nexus-teal/10 hover:bg-nexus-teal text-nexus-teal hover:text-black border border-nexus-teal/20 transition-all text-[10px] font-medium uppercase tracking-wider flex items-center gap-0.5 shadow-sm"
                                                  title="บันทึกชุดงานติดตั้งนี้เป็น 1 รายการอุปกรณ์พร้อมเลือกสำหรับใช้ซ้ำ"
                                                >
                                                  <Sparkles size={8} className="animate-pulse" />
                                                  บันทึก 💾
                                                </button>
                                                <button onClick={() => removeLabor(item.id)} className="p-1.5 text-white/40 hover:text-danger transition-colors">
                                                  <Trash2 size={13} />
                                                </button>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Pre-export summary stats dashboard */}
                            <div className="p-6 rounded-[2.5rem] bg-white/[0.03] border border-white/10 grid grid-cols-4 gap-5 items-center shadow-2xl">
                              <div className="space-y-1">
                                <span className="text-xs font-medium text-white/55 uppercase tracking-widest">ต้นทุนรวมโครงการ (Est. Cost)</span>
                                <div className="text-xl font-mono font-bold text-danger">฿ {budgetSummary.totalCost.toLocaleString()}</div>
                              </div>
                              <div className="space-y-1">
                                <span className="text-xs font-medium text-white/55 uppercase tracking-widest">ราคาขายเสนอรวม (Est. Revenue)</span>
                                <div className="text-xl font-mono font-bold text-nexus-teal">฿ {budgetSummary.totalRev.toLocaleString()}</div>
                              </div>
                              <div className="space-y-1">
                                <span className="text-xs font-medium text-white/55 uppercase tracking-widest">กำไรเบื้องต้น (Est. Profit)</span>
                                <div className="text-xl font-mono font-bold text-white">฿ {budgetSummary.grossProfit.toLocaleString()}</div>
                              </div>
                              <div className="space-y-1">
                                <span className="text-xs font-medium text-white/55 uppercase tracking-widest">GP PERCENTAGE</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-2xl font-mono font-bold text-nexus-blue">{budgetSummary.gpPercent}%</span>
                                  <div className="h-2 w-16 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                    <div className="h-full bg-nexus-blue" style={{ width: `${budgetSummary.gpPercent}%` }} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                    </div>
                   </>
                  )}

                  {activeModal === "milestone" && (
                     <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="space-y-3">
                           <div className="flex items-center gap-3 text-nexus-teal"><Target size={18} /><h4 className="text-[13px] font-bold uppercase tracking-widest">กำหนดเป้าหมายโครงการ</h4></div>
                           
                           <div className="grid grid-cols-2 gap-5">
                              <div className="space-y-3">
                                 <div className="space-y-2">
                                    <label className="text-[12px] font-bold text-white/60 uppercase tracking-widest ml-1">ชื่อเป้าหมาย / กิจกรรมสำคัญ *</label>
                                    <PillInput placeholder="เช่น สรุปแบบติดตั้ง, ส่งมอบเฟส 1..." className="w-full" />
                                 </div>
                                 <div className="space-y-2">
                                    <label className="text-[12px] font-bold text-white/60 uppercase tracking-widest ml-1">เชื่อมโยงกับโครงการ</label>
                                    <PillSelect className="w-full px-6">
                                       <option>เลือกโครงการ...</option>
                                       <option>PRJ-26-001: LED Wall</option>
                                       <option>PRJ-26-002: Network Upgrade</option>
                                    </PillSelect>
                                 </div>
                                 <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                       <label className="text-[12px] font-bold text-white/60 uppercase tracking-widest ml-1">กำหนดส่ง</label>
                                       <PillInput type="date" className="w-full" />
                                    </div>
                                    <div className="space-y-2">
                                       <label className="text-[12px] font-bold text-white/60 uppercase tracking-widest ml-1">น้ำหนักความสำคัญ (Weight %)</label>
                                       <PillInput type="number" placeholder="0" className="w-full text-nexus-teal font-bold" />
                                    </div>
                                 </div>
                              </div>

                              <div className="space-y-3">
                                 <div className="space-y-2">
                                    <label className="text-[12px] font-bold text-white/60 uppercase tracking-widest ml-1">รายละเอียดและเกณฑ์การวัดผล</label>
                                    <textarea 
                                       className="w-full h-[108px] rounded-lg bg-white/[0.03] border border-white/10 text-white text-[14px] font-bold p-5 focus:outline-none focus:border-nexus-teal/40 transition-all"
                                       placeholder="ระบุสิ่งที่ต้องทำให้สำเร็จเพื่อให้ Milestone นี้ผ่าน..."
                                    />
                                 </div>
                                 <div className="space-y-2">
                                    <label className="text-[12px] font-bold text-white/60 uppercase tracking-widest ml-1">ผู้รับผิดชอบ</label>
                                    <PillSelect className="w-full px-6">
                                       <option>ระบุผู้รับผิดชอบ...</option>
                                       <option>Somchai J. (Engineer)</option>
                                       <option>Kriangkrai M. (Lead)</option>
                                    </PillSelect>
                                 </div>
                                 <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                                    <div className="w-10 h-6 bg-white/10 rounded-full relative cursor-pointer p-1">
                                       <div className="w-4 h-4 bg-white/20 rounded-full" />
                                    </div>
                                    <div>
                                       <p className="text-sm font-medium text-white uppercase tracking-widest">เส้นตายวิกฤต</p>
                                       <p className="text-xs text-white/40 font-bold uppercase tracking-widest">หากล่าช้าจะส่งผลต่อโครงการทั้งหมด</p>
                                    </div>
                                 </div>
                              </div>
                           </div>
                        </div>
                     </div>
                  )}

                  {activeModal === "report" && (
                     <div className="space-y-10 animate-in fade-in duration-500">
                        <PillTabs 
                           tabs={[
                              { id: "work", label: "การทำงาน" },
                              { id: "parts", label: "วัสดุ" },
                              { id: "sign", label: "ส่งมอบ" }
                           ]}
                           activeTab={modalActiveTab === "basic" ? "work" : modalActiveTab}
                           onTabChange={setModalActiveTab}
                        />

                        <div className="space-y-3">
                           {(modalActiveTab === "work" || modalActiveTab === "basic") && (
                              <div className="grid grid-cols-2 gap-5 animate-in slide-in-from-left-4 duration-500">
                                 <div className="space-y-3">
                                    <div className="space-y-2">
                                       <label className="text-[12px] font-bold text-white/60 uppercase tracking-widest ml-1">หัวข้องาน / รายการที่ปฏิบัติ *</label>
                                       <PillInput placeholder="เช่น ติดตั้ง Core Switch, ตรวจเช็คระบบ..." className="w-full" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                       <div className="space-y-2">
                                          <label className="text-[12px] font-bold text-white/60 uppercase tracking-widest ml-1">ประเภทงาน</label>
                                          <PillSelect className="w-full px-6">
                                             <option>Installation (ติดตั้ง)</option>
                                             <option>Maintenance (บำรุงรักษา)</option>
                                             <option>Repair (ซ่อมแซม)</option>
                                             <option>Survey (สำรวจหน้างาน)</option>
                                          </PillSelect>
                                       </div>
                                       <div className="space-y-2">
                                          <label className="text-[12px] font-bold text-white/60 uppercase tracking-widest ml-1">วันที่ปฏิบัติงาน</label>
                                          <PillInput type="date" className="w-full" />
                                       </div>
                                    </div>
                                    <div className="space-y-2">
                                       <label className="text-[12px] font-bold text-white/60 uppercase tracking-widest ml-1">โครงการที่เกี่ยวข้อง</label>
                                       <PillSelect className="w-full px-6">
                                          <option>ระบุโครงการ...</option>
                                          <option>PRJ-26-001: LED Wall</option>
                                       </PillSelect>
                                    </div>
                                 </div>
                                 <div className="space-y-2">
                                    <label className="text-[12px] font-bold text-white/60 uppercase tracking-widest ml-1">รายละเอียดการทำงาน</label>
                                    <textarea 
                                       className="w-full h-[220px] rounded-lg bg-white/[0.03] border border-white/10 text-white text-[14px] font-bold p-5 focus:outline-none focus:border-nexus-teal/40 transition-all"
                                       placeholder="ระบุรายละเอียดงานที่ทำ ผลการดำเนินงาน และปัญหาที่พบ..."
                                    />
                                 </div>
                              </div>
                           )}

                           {modalActiveTab === "parts" && (
                              <div className="space-y-3 animate-in slide-in-from-right-4 duration-500">
                                 <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 w-full">
                                    <h4 className="text-[13px] font-bold text-white uppercase tracking-widest">รายการพัสดุและอุปกรณ์ที่ใช้</h4>
                                    <PillButton variant="glass" className="h-9 px-6 rounded-full"><Plus size={14} /> เพิ่มรายการ</PillButton>
                                 </div>
                                 <div className="rounded-lg border border-white/5 overflow-hidden">
                                    <NexusTable headers={["SKU / สินค้า", "S/N Number", "จำนวน", "Action"]}>
                                       <NexusTableRow>
                                          <NexusTableCell>CAT6 Cable (Box)</NexusTableCell>
                                          <NexusTableCell className="text-white/40">-</NexusTableCell>
                                          <NexusTableCell>1</NexusTableCell>
                                          <NexusTableCell><PillButton variant="ghost" className="w-8 p-0 text-danger"><X size={14} /></PillButton></NexusTableCell>
                                       </NexusTableRow>
                                       <NexusTableRow>
                                          <NexusTableCell>Cisco Catalyst 9200</NexusTableCell>
                                          <NexusTableCell className="text-nexus-blue font-mono text-[10px]">SN-SW-2600412</NexusTableCell>
                                          <NexusTableCell>1</NexusTableCell>
                                          <NexusTableCell><PillButton variant="ghost" className="w-8 p-0 text-danger"><X size={14} /></PillButton></NexusTableCell>
                                       </NexusTableRow>
                                    </NexusTable>
                                 </div>
                              </div>
                           )}

                           {modalActiveTab === "sign" && (
                              <div className="grid grid-cols-2 gap-12 animate-in fade-in duration-500">
                                 <div className="space-y-3">
                                    <h4 className="text-[13px] font-bold text-white uppercase tracking-widest">ภาพถ่ายหน้างาน</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                       <div className="aspect-video rounded-2xl border border-dashed border-white/10 flex flex-col items-center justify-center gap-2 hover:bg-white/5 cursor-pointer transition-all">
                                          <Plus size={24} className="text-white/20" />
                                          <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">อัปโหลดรูปภาพ</span>
                                       </div>
                                    </div>
                                 </div>
                                 <div className="space-y-3">
                                    <h4 className="text-[13px] font-bold text-white uppercase tracking-widest">การเซ็นรับงาน</h4>
                                    <div className="aspect-[4/3] rounded-xl bg-white/[0.02] border border-white/10 relative flex flex-col items-center justify-center">
                                       <div className="absolute inset-0 flex items-center justify-center text-white/10 pointer-events-none">
                                          <p className="text-[12px] font-bold uppercase tracking-[0.5em]">SIGNATURE AREA</p>
                                       </div>
                                       <div className="absolute bottom-6 w-3/4 h-px bg-white/10" />
                                    </div>
                                    <div className="space-y-2">
                                       <label className="text-[12px] font-bold text-white/60 uppercase tracking-widest ml-1">ชื่อผู้อนุมัติรับงาน</label>
                                       <PillInput placeholder="ระบุชื่อลูกค้า..." className="w-full text-center" />
                                    </div>
                                 </div>
                              </div>
                           )}
                        </div>
                     </div>
                  )}
              </div>
           </div>

           {/* Project Hub Right Controls */}
           <div className="w-[420px] flex flex-col bg-[#0d0d10] p-10 flex-shrink-0">
              <div className="flex-1 space-y-3">
                 <div className="p-5 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
                    <div className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-nexus-teal animate-ping" /><h5 className="text-[13px] font-bold text-white/70 uppercase tracking-widest">Project Intelligence</h5></div>
                    <div className="space-y-3">
                       <NexusDataField label="Project ID" value="AUTO_PRJ_26" highlight />
                       <NexusDataField label="สถานะเริ่มต้น" value="PROVISIONING" />
                       <NexusDataField label="มูลค่าต้นทุนสะสม" value={`฿ ${budgetSummary.totalCost.toLocaleString()}`} className="text-danger" />
                       <NexusDataField label="ยอดประเมินรายรับ" value={`฿ ${budgetSummary.totalRev.toLocaleString()}`} className="text-nexus-teal" />
                    </div>
                 </div>

                 {/* AUTOMATED QUOTATION TRIGGER - Premium Glowing Bridge Action */}
                 {activeModal === "project" && (
                   <div className="p-5 rounded-xl bg-nexus-teal/5 border border-nexus-teal/20 space-y-3 animate-bounce">
                     <div className="flex items-center gap-2 text-nexus-teal">
                       <Zap size={16} className="animate-spin" />
                       <span className="text-sm font-medium uppercase tracking-widest">ออกใบเสนอราคาด่วน</span>
                     </div>
                     <p className="text-[10px] text-white/60 font-bold leading-relaxed">
                       ดึงข้อมูลรายการอุปกรณ์และงานค่าใช้จ่ายทั้งหมดออกใบเสนอราคา อัตโนมัติทันที
                     </p>
                     <PillButton variant="primary" onClick={handleGenerateQuotation} className="w-full h-9 px-6 rounded-full font-bold uppercase flex items-center justify-center gap-2">
                       <FileText size={16} /> ออกใบเสนอราคา ⚡
                     </PillButton>
                   </div>
                 )}
              </div>
              
              <div className="space-y-3 pt-10 border-t border-white/5">
                 <PillButton variant="primary" className="w-full h-9 px-6 rounded-full flex items-center justify-center gap-2" onClick={() => { setActiveModal(null); showToast("เริ่มต้นโครงการใหม่สำเร็จ"); }}>
                    <Briefcase size={18} />ยืนยันเปิดโครงการ
                 </PillButton>
                 <PillButton variant="glass" className="w-full h-9 px-6 rounded-full hover:" onClick={() => setActiveModal(null)}>ยกเลิกรายการ</PillButton>
              </div>
           </div>
        </div>
      </Modal>

      <QuotationModal 
        isOpen={isQuotationOpen}
        onClose={() => setIsQuotationOpen(false)}
        initialData={quotationInitialData}
        onSave={async (data) => {
          console.log("Quotation generated successfully:", data);
          setIsQuotationOpen(false);
          showToast(`ออกใบเสนอราคาสำเร็จ สำหรับโครงการ: ${data.subject || "LED Wall"}`);
        }}
      />

      <KitEditor
        isOpen={isKitEditorOpen}
        onClose={() => {
          setIsKitEditorOpen(false);
          setKitEditorInitialData(null);
        }}
        showToast={showToast}
        initialData={kitEditorInitialData}
        onSave={async (formData) => {
          // 1. Generate premium sequence SKU
          const newSku = generateStockPilotId("KIT", formData.name);
          const productId = `prod_kit_${Date.now()}`;
          const cid = companyId || "nexus-global-node";

          const productData = {
            productId: productId,
            sku: newSku,
            name: formData.name,
            description: formData.description || "ชุดงานติดตั้งพร้อมใช้",
            category: "ชุดงานติดตั้ง",
            category_id: "Kit",
            brand: "NEXUS-KIT",
            unit: formData.unit_type,
            stockStatus: {
              onHand: 1,
              reserved: 0,
              available: 1
            },
            currentQty: 1,
            pricing: {
              costWAC: formData.financials.total_cost,
              pricePOS: formData.financials.suggested_price,
              priceProject: formData.financials.suggested_price
            },
            kitItems: formData.items,
            kitLabors: formData.labor_items,
            bomData: {
              bomNo: newSku,
              bomName: formData.name,
              totalMaterialCost: formData.financials.material_cost,
              laborCost: formData.financials.labor_cost,
              grandTotal: formData.financials.total_cost
            },
            isKit: true,
            companyId: cid,
            isDeleted: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: user?.uid || "system",
            updatedBy: user?.uid || "system"
          };

          // Save to Firestore
          await setDoc(doc(db, "products", productId), productData);

          // Update local catalog state
          const newPkg = {
            id: productId,
            sku: newSku,
            name: formData.name,
            cost: formData.financials.total_cost,
            price: formData.financials.suggested_price,
            qty_on_hand: 1,
            unit: formData.unit_type.split(" ")[0],
            details: formData.description || "ชุดงานติดตั้งพร้อมใช้",
            items: formData.items,
            labor_items: formData.labor_items
          };
          setInstallationPackages(prev => [newPkg, ...prev]);

          showToast(`บันทึกชุดงาน "${formData.name}" เข้าคลังสินค้าและบัญชีแยกประเภทเรียบร้อย! 📦`, "success");
          setIsKitEditorOpen(false);
          setKitEditorInitialData(null);
        }}
      />

      <ContractorModal
        isOpen={isContractorModalOpen}
        onClose={() => {
          setIsContractorModalOpen(false);
          setSelectedContractor(null);
        }}
        showToast={showToast}
        initialData={selectedContractor}
        onSave={async (formData) => {
          try {
            const cid = companyId || "nexus-global-node";
            let contId = selectedContractor?.id;
            
            if (!contId) {
              contId = `cont_${Date.now()}`;
            }

            const payload = {
              ...formData,
              id: contId,
              companyId: cid,
              isActive: true,
              updatedAt: new Date(),
              ...(!selectedContractor && { createdAt: new Date() })
            };

            await setDoc(doc(db, "contractors", contId), payload);
            showToast(`บันทึกข้อมูลทีมช่าง "${formData.name}" เรียบร้อย! 👷‍♂️`, "success");
          } catch (e) {
            console.error(e);
            throw e;
          }
        }}
      />

      <Toast 
        message={toast.message} 
        isVisible={toast.isVisible} 
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))} 
      />
    </div>
  );
}

function ProjectRow({ id, name, progress, team, deadline, status }: { id: string, name: string, progress: number, team: string, deadline: string, status: "active" | "completed" | "delayed" }) {
  return (
    <NexusTableRow>
      <NexusTableCell>
        <Link href={`/projects/${id}`} className="block">
           <p className="font-mono text-xs text-nexus-blue font-medium tracking-tighter">{id}</p>
           <p className="text-sm font-bold text-white/80 group-hover:text-white transition-colors whitespace-nowrap">{name}</p>
        </Link>
      </NexusTableCell>
      <NexusTableCell className="w-48">
         <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs font-medium text-white/40 uppercase">
               <span>ความคืบหน้า</span>
               <span className="text-white/75">{progress}%</span>
            </div>
            <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
               <div className="h-full bg-nexus-teal shadow-neon-teal" style={{ width: `${progress}%` }} />
            </div>
         </div>
      </NexusTableCell>
      <NexusTableCell className="text-sm font-medium text-white/60 uppercase">{team}</NexusTableCell>
      <NexusTableCell className="text-sm font-medium text-white/60 uppercase">{deadline}</NexusTableCell>
      <NexusTableCell>
        <StatusBadge status={status === "active" ? "active" : status === "completed" ? "active" : "danger"} label={status === "active" ? "กำลังดำเนินการ" : status === "completed" ? "เสร็จสิ้น" : "ล่าช้า"} />
      </NexusTableCell>
    </NexusTableRow>
  );
}

function MilestoneRow({ name, project, due, weight, status }: { name: string, project: string, due: string, weight: string, status: string }) {
  return (
    <NexusTableRow>
      <NexusTableCell className="font-bold text-white/80">{name}</NexusTableCell>
      <NexusTableCell className="w-[140px] font-mono text-sm text-nexus-blue font-medium tracking-tighter">{project}</NexusTableCell>
      <NexusTableCell className="w-[180px] text-sm font-medium text-white/60 uppercase tracking-widest">{due}</NexusTableCell>
      <NexusTableCell className="w-[120px] text-sm font-medium text-nexus-teal uppercase tracking-widest">{weight}</NexusTableCell>
      <NexusTableCell className="w-[180px]">
        <StatusBadge status={status as any} label={status === "active" ? "ดำเนินการอยู่" : "รอดำเนินการ"} />
      </NexusTableCell>
    </NexusTableRow>
  );
}

function ReportRow({ id, project, tech, date, status }: { id: string, project: string, tech: string, date: string, status: string }) {
  return (
    <NexusTableRow>
      <NexusTableCell className="w-[140px] font-mono text-sm text-nexus-teal font-medium tracking-tighter">{id}</NexusTableCell>
      <NexusTableCell className="font-bold text-white/80">{project}</NexusTableCell>
      <NexusTableCell className="w-[180px] text-sm font-medium text-white/60 uppercase tracking-widest">{tech}</NexusTableCell>
      <NexusTableCell className="w-[180px] text-sm font-medium text-white/60 uppercase tracking-widest">{date}</NexusTableCell>
      <NexusTableCell className="w-[180px]">
        <StatusBadge status={status as any} label="เซ็นแล้ว" />
      </NexusTableCell>
    </NexusTableRow>
  );
}

function CostRow({ name, budget, actual, balance, margin }: { name: string, budget: string, actual: string, balance: string, margin: string }) {
  return (
    <NexusTableRow>
      <NexusTableCell className="font-bold text-white/80">{name}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-right font-bold text-white/60 mono-numbers">{budget}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-right font-bold text-danger mono-numbers">{actual}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-right font-bold text-nexus-teal mono-numbers">{balance}</NexusTableCell>
      <NexusTableCell className="w-[120px] text-right">
        <span className="px-3 py-1 rounded-full bg-nexus-teal/10 text-nexus-teal text-sm font-medium">{margin}</span>
      </NexusTableCell>
    </NexusTableRow>
  );
}

function HealthItem({ label, value, color }: { label: string, value: string, color: string }) {
  return (
    <div className="space-y-2">
       <div className="flex justify-between items-center text-sm font-medium uppercase tracking-widest">
          <span className="text-white/60">{label}</span>
          <span className="text-white/80">{value}</span>
       </div>
       <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
          <div className={cn("h-full", color)} style={{ width: value }} />
       </div>
    </div>
  );
}

function DeadlineItem({ title, date, project }: { title: string, date: string, project: string }) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 group hover:bg-white/[0.05] transition-all">
       <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/40 group-hover:text-nexus-blue transition-colors">
          <Clock size={16} />
       </div>
       <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-white truncate">{title}</p>
          <p className="text-xs text-white/60 uppercase font-medium tracking-[0.1em] mt-0.5">{project} • {date}</p>
       </div>
    </div>
  );
}

