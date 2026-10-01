"use client";
// @ts-nocheck
import { useRouter } from "next/navigation";

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
  NexusPageLayout,
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

export default function MilestoneNewPage() {
  const router = useRouter();
  const { user, companyId } = useAuth();
  const [activeTab, setActiveTab] = useState<ProjectSubModule>("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [modalActiveTab, setModalActiveTab] = useState("basic");
  const [toast, setToast] = useState({ message: "", isVisible: false });

  // Quotation Integration States
  
  const [quotationInitialData, setQuotationInitialData] = useState<any>(null);

  // Kit Editor States
  
  const [kitEditorInitialData, setKitEditorInitialData] = useState<any>(null);
  const [dbProducts, setDbProducts] = useState<any[]>([]);

  // Contractor States
  
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
    router.push("/sales/quotations/new"); // Open QuotationModal automatically!
    showToast("ดึงข้อมูลอุปกรณ์และงานค่าใช้จ่ายออกใบเสนอราคาสำเร็จ!");
  };

  const tabs = [
    { id: "list", label: "โครงการ", icon: <Briefcase size={14} /> },
    { id: "planning", label: "งวดงาน", icon: <Target size={14} /> },
    { id: "report", label: "รายงานบริการ", icon: <ClipboardList size={14} /> },
    { id: "costing", label: "งบประมาณ & กำไร", icon: <BarChart3 size={14} /> },
    { id: "contractors", label: "ผู้รับเหมา", icon: <Users size={14} /> },
  ];



  const headerContent = (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-6 rounded-3xl backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <PillButton variant="glass" onClick={() => router.back()} className="w-10 h-10 p-0 flex items-center justify-center">
          <ArrowLeft size={20} />
        </PillButton>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-white uppercase tracking-tight">
              เพิ่มเป้าหมายและงวดงาน
            </h1>
            <span className="px-3 py-1 rounded-full bg-nexus-teal/10 border border-nexus-teal/30 text-nexus-teal text-sm font-mono font-bold select-none cursor-default pointer-events-none">
              MILESTONE
            </span>
          </div>
          <p className="text-sm text-white/60 font-medium mt-1">กำหนดรายละเอียดงวดงานเพื่อใช้ในการติดตามและเรียกเก็บเงิน</p>
        </div>
      </div>

      <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
        <PillButton variant="glass" onClick={() => router.back()} className="h-8 px-4 text-xs font-bold text-white/50">
          ยกเลิก
        </PillButton>
        <PillButton variant="confirm" onClick={() => router.back()} className="h-8 px-5 font-bold text-xs">
          ยืนยันการบันทึก
        </PillButton>
      </div>
    </div>
  );


  const leftContent = (
    <div className="space-y-8 pb-20">
      <div className="bg-neutral-900/90 border border-white/15 rounded-3xl overflow-hidden shadow-2xl transition-all border-l-4 border-l-nexus-teal hover:border-white/25">
        <div className="p-4 sm:p-5 flex items-center justify-between bg-white/[0.04] border-b border-white/10 select-none">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-xl bg-nexus-teal/20 text-nexus-teal border border-nexus-teal/40 font-mono font-black text-xs shadow-sm">
              01
            </span>
            <div className="flex items-center gap-2 text-nexus-teal">
              <Target size={20} />
              <h3 className="text-base font-bold uppercase tracking-wider text-white">
                1. ข้อมูลเป้าหมายและงวดงานโครงการ
              </h3>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-8 animate-in fade-in duration-300">
          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-3">
                <div className="space-y-2">
                   <label className="text-[12px] font-bold text-white/60 uppercase tracking-widest ml-1">
                     ชื่อเป้าหมาย / กิจกรรมสำคัญ <span className="text-rose-500 font-bold ml-0.5">*</span>
                   </label>
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
               <div className="flex items-center gap-4 p-4 rounded-2xl bg-black/30 border border-white/10">
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
    </div>
  );


  const rightSidebar = (
    <div className="bg-neutral-900/90 border border-white/15 rounded-3xl p-5 shadow-2xl space-y-8 sticky top-0 border-t-4 border-t-nexus-teal">
      <div className="space-y-1 border-b border-white/10 pb-4">
        <h5 className="text-[13px] font-semibold text-white/80 uppercase tracking-widest flex items-center gap-2">
          สรุปการทำรายการ
        </h5>
      </div>
      
      <div className="p-6 rounded-3xl bg-black/30 border border-white/10 space-y-6">
        <div className="space-y-5">
          <NexusDataField label="สถานะเริ่มต้น" value="Draft" />
          <NexusDataField label="ประเภท" value={projectType} />
        </div>
      </div>
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
