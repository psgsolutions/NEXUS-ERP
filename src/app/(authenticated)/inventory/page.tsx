"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Package, 
  Plus, 
  Search, 
  Filter, 
  ArrowUpRight, 
  ArrowLeftRight,
  ScanLine,
  Printer,
  ScanBarcode, 
  Layout, 
  History, 
  Box, 
  TrendingUp, 
  BarChart3,
  ShieldAlert,
  ShieldCheck,
  Cpu,
  Loader2,
  List,
  LayoutGrid,
  MoreHorizontal,
  ChevronRight,
  ChevronLeft,
  Calendar,
  DollarSign,
  User,
  Activity,
  Warehouse,
  MapPin,
  Sparkles,
  Trash2
} from "lucide-react";
import { 
  PillButton, 
  GlassCard, 
  cn, 
  PillTabs, 
  NexusTable, 
  NexusTableRow, 
  NexusTableCell, 
  StatusBadge, 
  MasterMetricCard,
  PillInput,
  Toast,
  NexusSearchInput,
  NexusDataField
} from "@/components/ui/Base";
import { DocumentFlowStepper } from "@/components/ui/DocumentFlowStepper";
import { StockTransferModal } from "@/components/inventory/StockTransferModal";
import { Warehouse3D } from "@/components/inventory/Warehouse3D";
import { useInventory } from "@/hooks/useInventory";
import { useRouter } from "next/navigation";
import { EmptyGuide } from "@/components/guide/Guidance";
import { useAdvancedTabs } from "@/components/guide/Onboarding";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase-client";
import { collection, query, where, onSnapshot, orderBy, limit } from "firebase/firestore";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { toMs as toSerialMs, warrantyState } from "@/lib/serials";
import { apiFetch } from "@/lib/api-client";

interface CreateKitModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: any[];
  onSave: (kit: any) => Promise<void> | void;
}

function CreateKitModal({ isOpen, onClose, products, onSave }: CreateKitModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedItems, setSelectedItems] = useState<{[key: string]: number}>({});
  const [productSearch, setProductSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("ทั้งหมด");
  const [isSaving, setIsSaving] = useState(false);

  const categories = useMemo(() => {
    if (!products) return ["ทั้งหมด"];
    const cats = new Set<string>();
    products.forEach(p => { if (p.category_id || p.category) cats.add(p.category_id || p.category); });
    return ["ทั้งหมด", ...Array.from(cats)].slice(0, 8);
  }, [products]);

  if (!isOpen) return null;

  let aggregateCost = 0;
  let aggregatePrice = 0;
  const componentsList: any[] = [];
  const selectedProducts: any[] = [];

  Object.entries(selectedItems).forEach(([prodId, qty]) => {
    if (qty <= 0) return;
    const prod = products.find(p => p.id === prodId);
    if (prod) {
      const cost = prod.pricing?.costWAC || 0;
      const price = prod.pricing?.priceProject || prod.pricing?.pricePOS || cost * 1.3;
      aggregateCost += cost * qty;
      aggregatePrice += price * qty;
      componentsList.push({
        productId: prod.id,
        name: prod.name,
        qty: qty,
        type: prod.category || "hardware",
        cost: cost,
        price: price
      });
      selectedProducts.push({ ...prod, qty });
    }
  });

  const handleQtyChange = (prodId: string, delta: number) => {
    setSelectedItems(prev => {
      const current = prev[prodId] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [prodId]: next };
    });
  };

  const handleSave = async () => {
    if (!name || componentsList.length === 0) return;
    setIsSaving(true);
    try {
      // ต้นทุน/ราคารวม server คำนวณจากรายการจริง (ไม่มีรายการตัวอย่างเติมให้)
      await onSave({ name, description, components: componentsList });
      setName("");
      setDescription("");
      setSelectedItems({});
    } finally {
      setIsSaving(false);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchSearch = (p.name || "").toLowerCase().includes(productSearch.toLowerCase()) || 
                        (p.sku || "").toLowerCase().includes(productSearch.toLowerCase());
    const matchCat = activeCategory === "ทั้งหมด" || (p.category_id === activeCategory || p.category === activeCategory);
    return matchSearch && matchCat;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <GlassCard className="w-full max-w-[1200px] border-nexus-teal/20 shadow-2xl flex flex-col h-[90vh] bg-surface-1/95 p-0 overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-white/5 flex justify-between items-center shrink-0 bg-black/40">
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">สร้างชุดอุปกรณ์สำเร็จรูป</h3>
            <p className="text-xs text-white/30 uppercase mt-0.5 tracking-widest font-medium">e-Bidding Package Configuration</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-colors">
            <ChevronLeft className="rotate-180" size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-5 space-y-3">
          
          {/* Top Form Fields */}
          <div className="flex flex-col md:flex-row gap-5 shrink-0">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium text-white/30 uppercase tracking-widest">ชื่อชุดอุปกรณ์ BOM *</label>
              <PillInput 
                placeholder="เช่น ชุดกล้องวงจรปิดพร้อมเครื่องบันทึก 8 จุด..." 
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full h-10 bg-black/40 border-white/10 text-white focus:border-nexus-teal/50"
              />
            </div>
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium text-white/30 uppercase tracking-widest">คำอธิบายรายละเอียด</label>
              <PillInput 
                placeholder="รายละเอียดเพิ่มเติมสำหรับประมูลงานและติดตั้ง..." 
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full h-10 bg-black/40 border-white/10 text-white focus:border-nexus-teal/50"
              />
            </div>
          </div>

          {/* Dual Pane Layout */}
          <div className="flex flex-col xl:flex-row gap-4 flex-1 min-h-0">
            
            {/* Left Pane: Catalog (65%) */}
            <div className="w-full lg:w-[65%] flex flex-col bg-black/40 border border-white/5 rounded-[2.5rem] p-5 space-y-3 shadow-inner min-h-0">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink-0">
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 md:pb-0 w-full md:w-auto">
                  {categories.map(cat => (
                    <button 
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={cn(
                        "px-5 py-2 rounded-full text-sm font-medium uppercase tracking-wider transition-all border shrink-0",
                        activeCategory === cat 
                          ? "bg-nexus-teal/20 text-nexus-teal border-nexus-teal/50 shadow-[0_0_15px_rgba(0,255,209,0.15)]" 
                          : "bg-white/[0.02] text-white/40 border-white/5 hover:text-white hover:bg-white/5"
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <div className="relative w-full md:w-64 shrink-0">
                  <PillInput 
                    placeholder="พิมพ์เพื่อค้นหา..." 
                    className="w-full pl-10 bg-surface-0 text-xs border-white/5 focus:border-nexus-teal/30" 
                    value={productSearch} 
                    onChange={(e) => setProductSearch(e.target.value)} 
                  />
                  <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar rounded-2xl border border-white/5 bg-surface-1/80 relative">
                <NexusTable headers={["รูปภาพ", "รหัสสินค้า", "ชื่อสินค้า", "ราคา", "สต็อก", "จัดการ"]}>
                  {filteredProducts.length === 0 ? (
                    <NexusTableRow>
                      <NexusTableCell colSpan={6} className="text-center py-16 text-white/20 text-xs">ไม่พบพัสดุ</NexusTableCell>
                    </NexusTableRow>
                  ) : (
                    filteredProducts.map(p => (
                      <NexusTableRow key={p.id} className="hover:bg-white/[0.02] transition-colors">
                        <NexusTableCell className="w-[10%]">
                          <div className="w-8 h-8 rounded-lg bg-black/60 border border-white/5 overflow-hidden flex items-center justify-center">
                            {p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover p-0.5" /> : <Package size={14} className="text-nexus-blue" />}
                          </div>
                        </NexusTableCell>
                        <NexusTableCell className="w-[20%] text-[10px] text-nexus-teal font-mono font-bold tracking-tighter">
                          {p.sku}
                        </NexusTableCell>
                        <NexusTableCell className="w-[35%] font-bold text-white/85 text-[11px] truncate max-w-[150px]">
                          {p.name}
                        </NexusTableCell>
                        <NexusTableCell className="w-[15%] font-mono font-bold text-nexus-teal/80 text-[11px] text-right">
                          ฿{(p.pricing?.costWAC || 0).toLocaleString()}
                        </NexusTableCell>
                        <NexusTableCell className="w-[10%]">
                          <div className="bg-nexus-teal/10 text-nexus-teal text-xs font-mono font-medium py-1 px-2 rounded text-center">
                            {p.stockStatus?.onHand || 0}
                          </div>
                        </NexusTableCell>
                        <NexusTableCell className="w-[10%] text-center">
                          <button onClick={() => handleQtyChange(p.id, 1)} className="p-1.5 bg-white/5 hover:bg-nexus-teal hover:text-black text-white/50 rounded-lg transition-all">
                            <Plus size={14} />
                          </button>
                        </NexusTableCell>
                      </NexusTableRow>
                    ))
                  )}
                </NexusTable>
              </div>
            </div>

            {/* Right Pane: Cart (35%) */}
            <div className="w-full lg:w-[35%] flex flex-col bg-surface-1/40 border border-white/5 rounded-[2.5rem] shadow-inner min-h-0 relative">
              <div className="p-5 border-b border-white/5 shrink-0 flex items-center justify-between">
                <h3 className="text-[13px] font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  พัสดุที่เลือก <span className="bg-nexus-teal/20 text-nexus-teal border border-nexus-teal/40 px-2 py-0.5 rounded-full text-[10px]">{selectedProducts.length}</span>
                </h3>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3 relative">
                {selectedProducts.length === 0 ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white/20">
                    <Box size={48} className="mb-4 opacity-50" />
                    <p className="text-xs font-bold uppercase tracking-wider">ยังไม่มีรายการสินค้า</p>
                  </div>
                ) : (
                  selectedProducts.map((item) => (
                    <div key={item.id} className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex flex-col gap-3 relative group hover:border-white/10 transition-colors">
                      <button 
                        onClick={() => setSelectedItems(prev => { const n = {...prev}; delete n[item.id]; return n; })} 
                        className="absolute top-3 right-3 text-white/20 hover:text-danger p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={14} />
                      </button>
                      
                      <div className="pr-6">
                        <div className="font-bold text-white/90 text-xs mb-1 line-clamp-2 leading-tight">{item.name}</div>
                        <div className="text-[10px] text-nexus-blue font-mono">SKU: {item.sku}</div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-white/5">
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleQtyChange(item.id, -1)} className="w-6 h-6 rounded bg-white/5 hover:bg-white/10 text-white flex items-center justify-center text-xs font-bold">-</button>
                          <span className="w-8 text-center text-xs font-bold text-white font-mono">{item.qty}</span>
                          <button onClick={() => handleQtyChange(item.id, 1)} className="w-6 h-6 rounded bg-white/5 hover:bg-white/10 text-white flex items-center justify-center text-xs font-bold">+</button>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-white/40 uppercase mb-0.5">รวมทุน</div>
                          <div className="font-mono font-bold text-white text-xs not-italic">฿{((item.pricing?.costWAC || 0) * item.qty).toLocaleString()}</div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-5 bg-black/40 border-t border-white/5 shrink-0 rounded-b-[2.5rem] space-y-2">
                <div className="flex justify-between text-[11px] font-bold text-white/50">
                  <span>ราคาทุนสะสม WAC</span>
                  <span className="font-mono text-white/80 not-italic">฿{aggregateCost.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[11px] font-bold text-white/50">
                  <span>ราคาขายรวมแนะนำ</span>
                  <span className="font-mono text-white/80 not-italic">฿{aggregatePrice.toLocaleString()}</span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Bottom Bar */}
        <div className="p-5 border-t border-white/5 bg-black/80 flex items-center justify-end gap-4 shrink-0">
          <PillButton variant="ghost" onClick={onClose} className="h-10 px-8 text-xs border-white/10 hover:">
            ยกเลิก
          </PillButton>
          <PillButton onClick={handleSave} disabled={!name || componentsList.length === 0 || isSaving} title={componentsList.length === 0 ? "เลือกสินค้าอย่างน้อย 1 รายการ" : undefined} className="h-10 px-8 text-xs shadow-neon-teal" variant="primary">
            สร้างสูตรจัดชุด
          </PillButton>
        </div>
      </GlassCard>
    </div>
  );
}


export default function InventoryPage() {
  const { products, loading } = useInventory();
  const { user, companyId } = useAuth();
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState("items");
  const inventoryTabs = useAdvancedTabs([
    { id: "items", label: "รายการพัสดุ", icon: <Package size={14} /> },
    { id: "assets", label: "ทะเบียนสินทรัพย์ถาวร", icon: <Box size={14} /> },
    { id: "serials", label: "หมายเลขซีเรียล", icon: <ScanBarcode size={14} /> },
    { id: "kits", label: "ชุดอุปกรณ์สำเร็จรูป", icon: <Cpu size={14} /> },
    { id: "history", label: "ความเคลื่อนไหว", icon: <History size={14} /> },
    { id: "layout", label: "แบบจำลองผังคลัง 3D (ทดลอง)", icon: <Layout size={14} /> },
  ], ["serials", "kits", "layout"], activeTab);
  const [searchQuery, setSearchQuery] = useState("");
  // กรองเฉพาะสินค้าที่ต่ำกว่าเกณฑ์ (คลิกจากตัวเลขสรุป/การ์ดสินค้าใกล้หมด)
  const [lowOnly, setLowOnly] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  
  
  // Real-time movement logs
  const [movements, setMovements] = useState<any[]>([]);
  const [movementsError, setMovementsError] = useState("");

  // Selected details for other tabs
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedSerialSn, setSelectedSerialSn] = useState<string | null>(null);
  const [selectedMovementId, setSelectedMovementId] = useState<string | null>(null);
  const [selectedKitId, setSelectedKitId] = useState<string | null>(null);
  const [isAddKitOpen, setIsAddKitOpen] = useState(false);

  // Toast notifications state
  const [toast, setToast] = useState({
    message: "",
    isVisible: false,
    type: "success" as "success" | "error" | "warning"
  });

  // ประวัติการเคลื่อนไหวสต็อก: รวม 2 แหล่ง
  //  - stockMovements (root, บันทึกจากหน้าจอเดิม)
  //  - companies/{companyId}/stock_movements (stock engine: รับสินค้า, จัดเก็บเข้าชั้น, เบิก/โอน)
  useEffect(() => {
    if (!companyId) return;
    let legacy: any[] = [];
    let engine: any[] = [];
    const toMs = (v: any) => v?.seconds ? v.seconds * 1000 : v instanceof Date ? v.getTime() : v ? new Date(v).getTime() : 0;
    const publish = () => {
      setMovements([...legacy, ...engine].sort((x, y) => toMs(y.createdAt) - toMs(x.createdAt)).slice(0, 30));
    };
    const onError = (err: any) => {
      // ไม่ใช้ข้อมูลจำลอง: แสดงข้อความแทน (เช่น index ของ Firestore ยังสร้างไม่เสร็จ)
      console.warn("Stock movements snapshot failed", err?.code || err);
      setMovementsError(err?.code === "failed-precondition"
        ? "ฐานข้อมูลยังสร้างดัชนี (index) สำหรับประวัติสต็อกไม่เสร็จ กรุณาลองใหม่ภายหลัง"
        : "โหลดประวัติการเคลื่อนไหวสินค้าไม่สำเร็จ");
    };

    const unsubLegacy = onSnapshot(
      query(collection(db, "stockMovements"), where("companyId", "==", companyId), orderBy("createdAt", "desc"), limit(20)),
      (snapshot) => {
        legacy = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setMovementsError("");
        publish();
      },
      onError
    );
    const unsubEngine = onSnapshot(
      query(collection(db, `companies/${companyId}/stock_movements`), orderBy("timestamp", "desc"), limit(20)),
      (snapshot) => {
        engine = snapshot.docs.map((d) => {
          const data = d.data();
          return { id: d.id, ...data, createdAt: data.timestamp, fromLocation: data.fromLocation || "EXTERNAL" };
        });
        publish();
      },
      onError
    );
    return () => { unsubLegacy(); unsubEngine(); };
  }, [companyId]);

  // Metric summaries (compact design to place directly on the header plane)
  const totalQty = products.reduce((acc, curr) => acc + (curr.stockStatus?.onHand || 0), 0);
  const totalCost = products.reduce((acc, curr) => acc + ((curr.stockStatus?.onHand || 0) * (curr.pricing?.costWAC || 0)), 0);
  const lowStockCount = products.filter(p => (p.stockStatus?.onHand || 0) <= ((p as any).minStock || 0)).length;


  const { data: dbKits, loading: kitsLoading } = useRealtimeCollection<any>('kits');
  const { data: dbAssets, loading: assetsLoading } = useRealtimeCollection<any>('assets');
  // หมายเลขเครื่องจริง: companies/{c}/serial_numbers (อัปเดตจากการรับ/เบิกสินค้า)
  const { data: rawSerials, loading: serialsLoading } = useRealtimeCollection<any>(companyId ? `companies/${companyId}/serial_numbers` : '', [], false);

  const kits = dbKits;
  const assets = dbAssets;
  const serials = rawSerials.map((s: any) => {
    const prod = products.find((p: any) => p.id === s.productId);
    const end = toSerialMs(s.warrantyEndDate);
    return {
      ...s,
      sn: s.sn || s.id,
      name: prod?.name || s.productId || "-",
      location: s.lastLocation || s.location || "-",
      expiry: end ? new Date(end).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" }) : "-",
    };
  });

  const filteredKits = kits.filter((k: any) =>
    (k.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (k.id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (k.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedKit = kits.find((k: any) => k.id === selectedKitId);

  // Filtering calculations
  const filteredProducts = products.filter(p =>
    (!lowOnly || (p.stockStatus?.onHand || 0) <= ((p as any).minStock || 0)) && (
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  const filteredAssets = assets.filter((a: any) => 
    (a.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (a.custodian || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (a.location || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSerials = serials.filter((s: any) => 
    (s.sn || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.location || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredMovements = movements.filter(m => {
    const prod = products.find(p => p.id === m.productId);
    return (
      m.transactionId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.fromLocation?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.toLocation?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (prod && prod.name.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  });

  const selectedProduct = products.find(p => p.id === selectedProductId);
  const selectedAsset = assets.find(a => a.id === selectedAssetId);
  const selectedSerial = serials.find(s => s.sn === selectedSerialSn);
  const selectedMovement = movements.find(m => m.id === selectedMovementId);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent">
      
      {/* Side-Sheets & Modals */}
      
      


      

      {/* Module Header with Compact Summaries aligned on the same horizontal plane */}
      <header className="px-6 py-2.5 min-h-[60px] border-b border-white/5 flex flex-col xl:flex-row xl:items-center justify-between gap-3 bg-black/20 shrink-0">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-nexus-blue/10 flex items-center justify-center text-nexus-blue shadow-lg border border-nexus-blue/10">
            <Package size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight leading-none">คลังสินค้าและพัสดุ</h1>
            <p className="text-xs font-semibold text-white/60 mt-1 leading-none">รายการสินค้า สต็อก รับ-เบิก-โอนย้าย และผังคลัง</p>
          </div>
        </div>

        {/* Aligned summaries in identical horizontal plane */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div role="button" tabIndex={0} title="คลิกเพื่อดูรายการสินค้าทั้งหมด" onClick={() => { setActiveTab("items"); setLowOnly(false); }} onKeyDown={(e) => { if (e.key === "Enter") (() => { setActiveTab("items"); setLowOnly(false); })(); }} className="cursor-pointer px-4 py-1.5 bg-black/40 border border-white/5 rounded-xl flex items-center gap-2.5 min-w-[130px] transition-all hover:border-nexus-teal/30 hover:bg-white/[0.03]">
            <div className="w-8 h-8 rounded-lg bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/20 shrink-0">
              <Package size={16} />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-sm font-medium text-white/30 uppercase tracking-widest leading-none">สต็อกคงคลัง</span>
              <span className="text-[17px] font-bold text-nexus-teal mt-0.5 mono-numbers leading-none">{totalQty.toLocaleString()} EA</span>
            </div>
          </div>
          <div role="button" tabIndex={0} title="คลิกเพื่อดูรายงานมูลค่าสินค้าคงเหลือ" onClick={() => router.push("/finance/subledgers")} onKeyDown={(e) => { if (e.key === "Enter") (() => router.push("/finance/subledgers"))(); }} className="cursor-pointer px-4 py-1.5 bg-black/40 border border-white/5 rounded-xl flex items-center gap-2.5 min-w-[130px] transition-all hover:border-nexus-blue/30 hover:bg-white/[0.03]">
            <div className="w-8 h-8 rounded-lg bg-nexus-blue/10 flex items-center justify-center text-nexus-blue border border-nexus-blue/20 shrink-0">
              <DollarSign size={16} />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-sm font-medium text-white/30 uppercase tracking-widest leading-none">มูลค่ารวม</span>
              <span className="text-[17px] font-bold text-nexus-blue mt-0.5 mono-numbers leading-none">฿{totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
          </div>
          <div role="button" tabIndex={0} title="คลิกเพื่อแสดงเฉพาะสินค้าต่ำกว่าเกณฑ์" onClick={() => { setActiveTab("items"); setLowOnly(true); }} onKeyDown={(e) => { if (e.key === "Enter") (() => { setActiveTab("items"); setLowOnly(true); })(); }} className="cursor-pointer px-4 py-1.5 bg-black/40 border border-white/5 rounded-xl flex items-center gap-2.5 min-w-[130px] transition-all hover:border-warning/30 hover:bg-white/[0.03]">
            <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center text-warning border border-warning/20 shrink-0">
              <ShieldAlert size={16} />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-sm font-medium text-white/30 uppercase tracking-widest leading-none">สต็อกต่ำกว่าเกณฑ์</span>
              <span className="text-[17px] font-bold text-warning mt-0.5 mono-numbers leading-none">{lowStockCount} SKU</span>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation and Toolbars */}
      <section className="module-toolbar">
        <PillTabs className="module-tabs flex-1 min-w-[min(100%,520px)]" 
          tabs={inventoryTabs.tabs}
          activeTab={activeTab}
          onTabChange={(tab) => {
            if (inventoryTabs.handleToggle(tab)) return;
            setActiveTab(tab);
            setSearchQuery("");
            setSelectedProductId(null);
            setSelectedAssetId(null);
            setSelectedSerialSn(null);
            setSelectedMovementId(null);
            setSelectedKitId(null);
          }} 
        />
        
        {activeTab !== "layout" && (
          <div className="module-toolbar-actions">
            <PillButton
              variant="glass"
              className="gap-1.5"
              onClick={() => router.push("/inventory/locations")}
            >
              <Layout size={14} /> ผังคลังและชั้นวาง
            </PillButton>
            <PillButton
              variant="glass"
              className="gap-1.5"
              onClick={() => router.push("/inventory/stock-card")}
            >
              <History size={14} /> บัญชีคุมสินค้า
            </PillButton>
            <PillButton 
              variant="confirm"
              className="gap-1.5 shadow-neon-blue"
              onClick={() => router.push("/inventory/putaway")}
            >
              <ArrowLeftRight size={14} /> โอนย้ายสต็อก
            </PillButton>
            <PillButton 
              variant="primary"
              className="gap-1.5 shadow-neon-teal"
              onClick={() => router.push("/inventory/in/new")}
            >
              <Plus size={14} /> รับสินค้าเข้าคลัง
            </PillButton>
            <PillButton
              variant="glass"
              className="gap-1.5"
              onClick={() => router.push("/inventory/putaway")}
            >
              <ScanLine size={14} /> จัดเก็บเข้าชั้น
            </PillButton>
            <PillButton
              variant="glass"
              className="gap-1.5"
              onClick={() => router.push("/inventory/pick")}
            >
              <ScanBarcode size={14} /> เบิกสินค้า
            </PillButton>
            <PillButton
              variant="glass"
              className="gap-1.5"
              onClick={() => router.push("/inventory/products/labels")}
            >
              <Printer size={14} /> ฉลากสินค้า
            </PillButton>
            {activeTab === "kits" ? (
              <PillButton 
                variant="primary"
                className="gap-1.5 shadow-neon-teal"
                onClick={() => setIsAddKitOpen(true)}
              >
                <Plus size={14} /> สร้างชุดอุปกรณ์
              </PillButton>
            ) : (
              <PillButton 
                variant="primary"
                className="gap-1.5 shadow-neon-teal"
                onClick={() => router.push("/inventory/products/new")}
              >
                <Plus size={14} /> เพิ่มสินค้า
              </PillButton>
            )}
          </div>
        )}
      </section>

      {/* Main Content Viewport */}
      <main className="flex-1 overflow-y-auto relative custom-scrollbar">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(20,163,204,0.03)_0%,transparent_50%)] pointer-events-none" />

        {/* 3D Digital Twin Layout Tab */}
        {activeTab === "layout" && (
          <div className="relative z-10 w-full animate-in fade-in duration-500 p-5">
            <Warehouse3D />
          </div>
        )}

        {/* Non-layout Tabs (Items, Assets, Serials, History) wrapped in the exact identical dual-column container */}
        {activeTab !== "layout" && (
          <div className="p-5 space-y-3 max-w-[1800px] mx-auto w-full relative z-10">
            <div className="flex flex-col xl:flex-row gap-4 items-start w-full animate-in fade-in duration-500">
              
              {/* Left Content Column */}
            <div className="flex-1 w-full space-y-3">
              
              {/* Tactical Command Bar */}
              <div className="flex flex-col md:flex-row items-center gap-4 bg-white/[0.01] p-1.5 rounded-full border border-white/5 backdrop-blur-md">
                 <NexusSearchInput 
                   placeholder={
                     activeTab === "items" ? "ค้นหา SKU หรือชื่อพัสดุ..." :
                     activeTab === "assets" ? "ค้นหาชื่อสินทรัพย์ ผู้รับผิดชอบ หรือ พิกัด..." :
                     activeTab === "serials" ? "ค้นหาซีเรียล หรือรหัสพัสดุ..." :
                     activeTab === "kits" ? "ค้นหาชุดอุปกรณ์ BOM..." :
                     "ค้นหาเลขประวัติ ความเคลื่อนไหว..."
                   } 
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   className="flex-1"
                   kbd="F"
                 />
                 <div className="flex items-center gap-4 pr-1.5">
                    {activeTab === "items" && lowOnly && (
                      <button type="button" onClick={() => setLowOnly(false)} title="ยกเลิกตัวกรอง" className="h-7 px-3 rounded-full text-[12px] font-bold border bg-warning/15 border-warning/40 text-warning whitespace-nowrap">เฉพาะสินค้าต่ำกว่าเกณฑ์ ✕</button>
                    )}
                    <span className="text-[11px] text-white/30 uppercase tracking-widest font-bold hidden sm:block px-2">
                      {activeTab === "items" ? `ค้นพบ ${filteredProducts.length} รายการ` :
                       activeTab === "assets" ? `ค้นพบ ${filteredAssets.length} รายการ` :
                       activeTab === "serials" ? `ค้นพบ ${filteredSerials.length} รายการ` :
                       activeTab === "kits" ? `ค้นพบ ${filteredKits.length} รายการ` :
                       `สตรีมประวัติล่าสุด ${filteredMovements.length} ล็อก`}
                    </span>
                    <div className="w-px h-4 bg-white/10 hidden sm:block"></div>
                    <PillButton variant="glass" className="h-9 w-9 p-0 rounded-full border-white/5 hover:border-nexus-teal/30 hover:bg-nexus-teal/5">
                      <Filter size={18} className="text-white/40" />
                    </PillButton>
                 </div>
              </div>

              {/* Data Table Grid inside identical height board */}
              <GlassCard accentColor="teal" className="p-0 overflow-hidden min-h-[640px] flex flex-col justify-between">
                <div className="overflow-x-auto custom-scrollbar flex-1 w-full">
                  
                  {/* Items List Table */}
                  {activeTab === "items" && (
                    <NexusTable 
                      headers={["รหัสสินค้า", "ชื่อพัสดุ / ทรัพยากร", "หมวดหมู่พัสดุ", "จำนวนคงเหลือ", "สถานะสต็อก", "ราคาทุนเฉลี่ย WAC"]}
                      minWidth="min-w-[140px]"
                    >
                      {loading ? (
                        <NexusTableRow className="bg-transparent hover:bg-transparent pointer-events-none">
                          <NexusTableCell colSpan={6} className="p-20 text-center text-white/20">
                            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-nexus-teal" />
                            <span className="text-sm font-medium tracking-widest uppercase">กำลังดึงข้อมูลพัสดุ...</span>
                          </NexusTableCell>
                        </NexusTableRow>
                      ) : filteredProducts.length === 0 ? (
                        <EmptyGuide cols={6} text="ไม่พบรายการสินค้า" hint="เพิ่มสินค้าที่ปุ่ม &quot;เพิ่มสินค้า&quot; หรือนำเข้าจาก Excel (เมนู นำเข้าข้อมูล Excel) · ถ้าค้นหาอยู่ ลองล้างคำค้น" />
                      ) : (
                        filteredProducts.map((item, idx) => {
                          const isLow = (item.stockStatus?.onHand || 0) <= ((item as any).minStock || 0);
                          const isOut = (item.stockStatus?.onHand || 0) === 0;
                          const statusLabel = isOut ? "สินค้าหมด" : isLow ? "สต็อกต่ำ" : "พร้อมใช้งาน";
                          const statusType = isOut ? "danger" : isLow ? "pending" : "active";

                          return (
                            <NexusTableRow 
                              key={item.id} 
                              className={cn(
                                selectedProductId === item.id ? "bg-nexus-teal/[0.05] border-l-2 border-l-nexus-teal shadow-[0_0_15px_rgba(20,163,204,0.05)]" : ""
                              )}
                              onClick={() => setSelectedProductId(selectedProductId === item.id ? null : item.id)}
                            >
                              <NexusTableCell className="w-[1%] whitespace-nowrap align-middle text-center text-nexus-blue text-xs font-bold tracking-tighter" mono>
                                {item.sku}
                              </NexusTableCell>
                              <NexusTableCell>
                                <span className="font-bold text-white group-hover:text-nexus-teal transition-colors text-sm">{item.name}</span>
                                {item.brand && <span className="text-xs text-white/30 font-bold uppercase ml-2">· {item.brand}</span>}
                              </NexusTableCell>
                              <NexusTableCell>
                                <span className="px-2 py-0.5 rounded bg-white/5 text-xs text-white/40 border border-white/10 uppercase font-bold tracking-widest">
                                  {item.category}
                                </span>
                              </NexusTableCell>
                              <NexusTableCell className="w-[1%] whitespace-nowrap text-right font-bold text-white" mono>
                                {(item.stockStatus?.onHand || 0).toLocaleString()}
                              </NexusTableCell>
                              <NexusTableCell className="w-[1%] whitespace-nowrap text-center">
                                <StatusBadge status={statusType} label={statusLabel} />
                              </NexusTableCell>
                              <NexusTableCell className="w-[1%] whitespace-nowrap text-right text-white/60 font-bold" mono>
                                ฿{(item.pricing?.costWAC || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </NexusTableCell>
                            </NexusTableRow>
                          );
                        })
                      )}
                    </NexusTable>
                  )}

                  {/* Assets Tab View */}
                  {activeTab === "assets" && (
                    <NexusTable
                      headers={["รหัสสินทรัพย์", "ชื่อสินทรัพย์", "หมวดหมู่สินทรัพย์", "ผู้ดูแล / ผู้ถือครอง", "มูลค่าประเมิน", "สถานะ"]}
                      minWidth="min-w-[140px]"
                    >
                      {filteredAssets.length === 0 ? (
                        <NexusTableRow className="bg-transparent hover:bg-transparent pointer-events-none">
                          <NexusTableCell colSpan={6} className="p-20 text-center text-white/20">
                            <span className="text-sm font-medium tracking-widest uppercase">ไม่พบรายการสินทรัพย์</span>
                          </NexusTableCell>
                        </NexusTableRow>
                      ) : (
                        filteredAssets.map((asset, idx) => (
                          <NexusTableRow 
                            key={asset.id} 
                            className={cn(
                              selectedAssetId === asset.id ? "bg-nexus-blue/[0.05] border-l-2 border-l-nexus-blue shadow-[0_0_15px_rgba(20,163,204,0.05)]" : ""
                            )}
                            onClick={() => setSelectedAssetId(selectedAssetId === asset.id ? null : asset.id)}
                          >
                            <NexusTableCell className="w-[1%] whitespace-nowrap align-middle text-center text-nexus-blue text-xs font-bold tracking-tighter" mono>{asset.id}</NexusTableCell>
                            <NexusTableCell className="w-full font-bold text-white group-hover:text-nexus-blue transition-colors text-sm">{asset.name}</NexusTableCell>
                            <NexusTableCell className="w-[1%] whitespace-nowrap text-center text-xs font-bold text-white/40 uppercase">{asset.category}</NexusTableCell>
                            <NexusTableCell className="w-[1%] whitespace-nowrap text-center text-xs font-bold text-white/60">{asset.custodian}</NexusTableCell>
                            <NexusTableCell className="w-[1%] whitespace-nowrap text-right font-bold text-white/80" mono>฿{asset.value.toLocaleString()}</NexusTableCell>
                            <NexusTableCell className="w-[1%] whitespace-nowrap text-center">
                              <StatusBadge status={asset.status === "active" ? "active" : "inactive"} label={asset.status === "active" ? "พร้อมใช้งาน" : "ไม่ทำงาน"} />
                            </NexusTableCell>
                          </NexusTableRow>
                        ))
                      )}
                    </NexusTable>
                  )}

                  {/* Serials Tab View */}
                  {activeTab === "serials" && (
                    <NexusTable
                      headers={["หมายเลขซีเรียล", "ชื่อรายการสินค้า", "สถานะการลงทะเบียน", "วันหมดอายุรับประกัน", "พิกัดแร็ค / จุดจัดเก็บ"]}
                      minWidth="min-w-[140px]"
                    >
                      {filteredSerials.length === 0 ? (
                        <NexusTableRow className="bg-transparent hover:bg-transparent pointer-events-none">
                          <NexusTableCell colSpan={5} className="p-20 text-center text-white/20">
                            <span className="text-sm font-medium tracking-widest uppercase">ไม่พบรายการซีเรียลนัมเบอร์</span>
                          </NexusTableCell>
                        </NexusTableRow>
                      ) : (
                        filteredSerials.map((s, idx) => (
                          <NexusTableRow 
                            key={s.sn} 
                            className={cn(
                              selectedSerialSn === s.sn ? "bg-nexus-teal/[0.05] border-l-2 border-l-nexus-teal shadow-[0_0_15px_rgba(20,163,204,0.05)]" : ""
                            )}
                            onClick={() => setSelectedSerialSn(selectedSerialSn === s.sn ? null : s.sn)}
                          >
                            <NexusTableCell className="w-[1%] whitespace-nowrap align-middle text-center text-nexus-teal text-xs font-bold tracking-tighter" mono>{s.sn}</NexusTableCell>
                            <NexusTableCell className="w-full font-bold text-white text-sm">{s.name}</NexusTableCell>
                            <NexusTableCell className="w-[1%] whitespace-nowrap text-center">
                              <StatusBadge 
                                status={
                                  s.status === "available" ? "active" : 
                                  s.status === "reserved" ? "pending" : 
                                  s.status === "rma" ? "danger" : "inactive"
                                } 
                                label={
                                  s.status === "available" ? "พร้อมใช้งาน" : 
                                  s.status === "reserved" ? "จองใช้งาน" : 
                                  s.status === "rma" ? " RMA / เคลม" : "ติดตั้งแล้ว"
                                } 
                              />
                            </NexusTableCell>
                            <NexusTableCell className="w-[1%] whitespace-nowrap text-center text-xs text-white/40" mono>{s.expiry}</NexusTableCell>
                            <NexusTableCell className="w-[1%] whitespace-nowrap text-center text-xs font-bold text-white/50" mono>{s.location}</NexusTableCell>
                          </NexusTableRow>
                        ))
                      )}
                    </NexusTable>
                  )}

                  {/* Movement History Logs Tab View */}
                  {activeTab === "history" && (
                    <NexusTable
                      headers={["เลขที่ธุรกรรม", "ประเภทธุรกรรม", "รายการพัสดุ", "จำนวน", "เส้นทางจัดส่ง / โอนย้าย", "ผู้บันทึกรายการ"]}
                      minWidth="min-w-[140px]"
                    >
                      {filteredMovements.length === 0 ? (
                        <NexusTableRow className="bg-transparent hover:bg-transparent pointer-events-none">
                          <NexusTableCell colSpan={6} className="p-20 text-center text-white/20">
                            <span className="text-sm font-medium tracking-widest uppercase">{movementsError || "ไม่พบประวัติการเคลื่อนไหวสินค้า"}</span>
                          </NexusTableCell>
                        </NexusTableRow>
                      ) : (
                        filteredMovements.map((move, idx) => {
                          const relatedProduct = products.find(p => p.id === move.productId);
                          const name = relatedProduct?.name || "Unknown Item (PKG)";

                          return (
                            <NexusTableRow 
                              key={move.id} 
                              className={cn(
                                selectedMovementId === move.id ? "bg-nexus-blue/[0.05] border-l-2 border-l-nexus-blue shadow-[0_0_15px_rgba(20,163,204,0.05)]" : ""
                              )}
                              onClick={() => setSelectedMovementId(selectedMovementId === move.id ? null : move.id)}
                            >
                              <NexusTableCell className="w-[1%] whitespace-nowrap align-middle text-center text-nexus-teal text-xs font-bold tracking-tighter" mono>{move.transactionId}</NexusTableCell>
                              <NexusTableCell>
                                <StatusBadge 
                                  status={move.type === "IN" ? "active" : move.type === "OUT" ? "danger" : "pending"} 
                                  label={move.type} 
                                />
                              </NexusTableCell>
                              <NexusTableCell className="w-full font-bold text-white group-hover:text-nexus-teal transition-colors text-sm">{name}</NexusTableCell>
                              <NexusTableCell className="w-[1%] whitespace-nowrap text-right font-bold text-white" mono>{move.quantity}</NexusTableCell>
                              <NexusTableCell className="w-[1%] whitespace-nowrap text-center text-xs text-white/40 uppercase" mono>
                                {move.fromLocation || "EXTERNAL"} → {move.toLocation || "MAIN-WH"}
                              </NexusTableCell>
                              <NexusTableCell className="w-[1%] whitespace-nowrap text-center text-xs font-bold text-white/50">{move.userId || "System"}</NexusTableCell>
                            </NexusTableRow>
                          );
                        })
                      )}
                    </NexusTable>
                  )}

                  {/* Kits Tab View */}
                  {activeTab === "kits" && (
                    <NexusTable 
                      headers={["รหัสชุดอุปกรณ์", "ชื่อชุดอุปกรณ์ BOM", "รายละเอียด / ส่วนประกอบ", "ราคาทุนสะสม WAC", "ราคาขายแนะนำ", "อัตรากำไร"]}
                      minWidth="min-w-[140px]"
                    >
                      {filteredKits.length === 0 ? (
                        <NexusTableRow className="bg-transparent hover:bg-transparent pointer-events-none">
                          <NexusTableCell colSpan={6} className="p-20 text-center text-white/20">
                            <span className="text-sm font-medium tracking-widest uppercase">ไม่พบรายการชุดอุปกรณ์สำเร็จรูป</span>
                          </NexusTableCell>
                        </NexusTableRow>
                      ) : (
                        filteredKits.map((kit, idx) => {
                          const marginPercent = kit.aggregatePrice > 0 
                            ? ((kit.aggregatePrice - kit.aggregateCost) / kit.aggregatePrice) * 100 
                            : 0;
                          return (
                            <NexusTableRow 
                              key={kit.id} 
                              className={cn(
                                selectedKitId === kit.id ? "bg-nexus-teal/[0.05] border-l-2 border-l-nexus-teal shadow-[0_0_15px_rgba(20,163,204,0.05)]" : ""
                              )}
                              onClick={() => setSelectedKitId(selectedKitId === kit.id ? null : kit.id)}
                            >
                              <NexusTableCell className="w-[1%] whitespace-nowrap align-middle text-center text-nexus-blue text-xs font-bold tracking-tighter" mono>
                                {kit.id}
                              </NexusTableCell>
                              <NexusTableCell>
                                <span className="font-bold text-white group-hover:text-nexus-teal transition-colors text-sm">{kit.name}</span>
                              </NexusTableCell>
                              <NexusTableCell>
                                <span className="px-2 py-0.5 rounded bg-white/5 text-xs text-white/40 border border-white/10 font-bold">
                                  {kit.components.length} ส่วนประกอบ ({kit.components.filter((c: any) => c.type === 'service').length} บริการ)
                                </span>
                                {kit.description && <span className="text-[12px] text-white/40 ml-2">{kit.description}</span>}
                              </NexusTableCell>
                              <NexusTableCell className="w-[1%] whitespace-nowrap text-right font-bold text-white" mono>
                                ฿{kit.aggregateCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </NexusTableCell>
                              <NexusTableCell className="w-[1%] whitespace-nowrap text-right text-nexus-teal font-bold" mono>
                                ฿{kit.aggregatePrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </NexusTableCell>
                              <NexusTableCell className="w-[1%] whitespace-nowrap text-right text-nexus-blue font-bold" mono>
                                {marginPercent.toFixed(1)}%
                              </NexusTableCell>
                            </NexusTableRow>
                          );
                        })
                      )}
                    </NexusTable>
                  )}


                </div>
                
                {/* Table Footer with details */}
              </GlassCard>
            </div>

            {/* Right Sidebar Column - EXACT same structure and width w-full lg:w-[280px] as Warehouse3D */}
            <div className="w-full xl:w-[25%] shrink-0 sticky top-[96px] space-y-3 max-h-[calc(100vh-120px)] overflow-y-auto custom-scrollbar pb-10">
              
              {/* SIDEBAR FOR TABS */}

              {/* Items Tab Sidebar */}
              {activeTab === "items" && (
                selectedProduct ? (
                  <GlassCard className="p-4 border-nexus-teal/20 shadow-2xl relative overflow-hidden animate-in slide-in-from-right duration-300">
                    <div className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] bg-gradient-to-br from-nexus-teal/5 via-transparent to-transparent rotate-45 pointer-events-none" />
                    <div className="relative z-10 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-xs font-medium text-nexus-teal uppercase tracking-[0.2em]">Product Inspector</p>
                          <h3 className="text-xl font-medium text-white tracking-tight mt-1">{selectedProduct.name}</h3>
                        </div>
                        <button 
                          onClick={() => setSelectedProductId(null)}
                          className="p-1 rounded-full bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                        >
                          <ChevronLeft className="rotate-180" size={16} />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-4 rounded-xl  border border-nexus-teal/10 flex flex-col justify-between">
                          <span className="text-sm font-medium text-white/30 uppercase tracking-widest">ในคลังพร้อมใช้</span>
                          <span className="text-2xl font-medium text-nexus-teal mt-1 mono-numbers">{selectedProduct.stockStatus?.onHand || 0}</span>
                        </div>
                        <div className="p-4 rounded-xl bg-white/5 border border-white/5 flex flex-col justify-between">
                          <span className="text-sm font-medium text-white/30 uppercase tracking-widest">ต้นทุน</span>
                          <span className="text-sm font-medium text-white mt-2 truncate mono-numbers">฿{(selectedProduct.pricing?.costWAC || 0).toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="space-y-3 pt-2">
                        <p className="text-sm font-medium text-white/30 uppercase tracking-widest border-b border-white/5 pb-2">รายละเอียดทางเทคนิค</p>
                        <NexusDataField label="SKU / ID" value={selectedProduct.sku} />
                        <NexusDataField label="หมวดหมู่หลัก" value={selectedProduct.category} />
                        <NexusDataField label="แบรนด์สินค้า" value={selectedProduct.brand || "ARUBA"} />
                        <NexusDataField label="หน่วยจัดเก็บ" value={selectedProduct.unit || "ชิ้น"} />
                        <NexusDataField label="จองการติดตั้ง" value={`${selectedProduct.stockStatus?.reserved || 0} EA`} />
                      </div>

                      <div className="space-y-3 pt-4 border-t border-white/5">
                        <PillButton 
                          className="w-full shadow-neon-teal text-xs" 
                          onClick={() => router.push(`/inventory/${selectedProduct.id}`)}
                        >
                          <Warehouse size={14} /> วิเคราะห์ความเคลื่อนไหวลึก
                        </PillButton>
                        
                        <div className="flex gap-2">
                          <PillButton 
                            variant="glass" 
                            className="flex-1 text-sm border-nexus-blue/20 text-nexus-blue h-9 hover:"
                            onClick={() => router.push("/inventory/putaway")}
                          >
                            <ArrowLeftRight size={12} /> โอนสต็อก
                          </PillButton>
                          <PillButton 
                            variant="glass" 
                            className="flex-1 text-sm border-nexus-teal/20 text-nexus-teal h-9 hover:"
                            onClick={() => router.push("/inventory/in/new")}
                          >
                            <Plus size={12} /> รับของ
                          </PillButton>
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                ) : (
                  <GlassCard className="p-4 border-white/5 space-y-3">
                    <div>
                      <h4 className="text-sm font-semibold text-white/60">สรุปคลังสินค้า</h4>
                      <p className="text-sm font-medium text-white/50 mt-1 leading-relaxed">คลิกรายการในตารางเพื่อดูรายละเอียดสินค้า ต้นทุนเฉลี่ย และตำแหน่งจัดเก็บ</p>
                    </div>

                    <div className="p-4 rounded-xl  border border-nexus-blue/15 space-y-3">
                      <p className="text-xs font-medium text-nexus-blue uppercase tracking-widest flex items-center gap-1.5">
                        <Cpu size={12} /> สินค้าใกล้หมด
                        <button type="button" onClick={() => { setActiveTab("items"); setLowOnly(true); }} className="ml-auto text-[12px] normal-case tracking-normal text-nexus-teal hover:underline">ดูรายการ</button>
                      </p>
                      <p className="text-sm text-white/70 leading-relaxed font-medium">
                        พบสินค้าต่ำกว่าปริมาณสั่งซื้อขั้นต่ำ <span className="text-warning font-medium">{lowStockCount} SKU</span> แนะนำทำการเติมสินค้า เพื่อป้องกันความล่าช้าโครงการติดตั้ง
                      </p>
                    </div>

                    {/* Low stock list directly inside inspector */}
                    <div className="space-y-3">
                      <p className="text-xs font-medium text-white/30 uppercase tracking-widest">สินค้าสต็อกต่ำที่ควรตรวจสอบ</p>
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                        {products.filter(p => (p.stockStatus?.onHand || 0) <= ((p as any).minStock || 0)).slice(0, 3).map(p => (
                          <div 
                            key={p.id}
                            className="p-3 rounded-lg bg-white/[0.02] border border-white/5 flex items-center justify-between cursor-pointer hover:border-warning/30 transition-all"
                            onClick={() => setSelectedProductId(p.id)}
                          >
                            <div>
                              <p className="text-xs font-medium text-white truncate max-w-[180px]">{p.name}</p>
                              <p className="text-xs text-white/20 font-medium tracking-widest mt-0.5">{p.sku}</p>
                            </div>
                            <span className="text-xs font-medium text-warning bg-warning/10 px-2 py-0.5 rounded font-mono">
                              {p.stockStatus?.onHand || 0} EA
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </GlassCard>
                )
              )}

              {/* Assets Tab Sidebar */}
              {activeTab === "assets" && (
                selectedAsset ? (
                  <GlassCard className="p-4 border-nexus-blue/20 shadow-2xl relative overflow-hidden animate-in slide-in-from-right duration-300">
                    <div className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] bg-gradient-to-br from-nexus-blue/5 via-transparent to-transparent rotate-45 pointer-events-none" />
                    <div className="relative z-10 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-xs font-medium text-nexus-blue uppercase tracking-[0.2em]">Asset Telemetry</p>
                          <h3 className="text-xl font-medium text-white tracking-tight mt-1">{selectedAsset.name}</h3>
                        </div>
                        <button 
                          onClick={() => setSelectedAssetId(null)}
                          className="p-1 rounded-full bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                        >
                          <ChevronLeft className="rotate-180" size={16} />
                        </button>
                      </div>

                      <div className="p-4 rounded-xl  border border-nexus-blue/10 space-y-2">
                        <span className="text-sm font-medium text-white/30 uppercase tracking-widest block">มูลค่าประเมินสินทรัพย์</span>
                        <span className="text-2xl font-medium text-white mono-numbers">฿{(Number(selectedAsset.value) || 0).toLocaleString("th-TH")}</span>
                      </div>

                      <div className="space-y-3">
                        <p className="text-sm font-medium text-white/30 uppercase tracking-widest border-b border-white/5 pb-2">ระบบจัดสรรสินทรัพย์</p>
                        <NexusDataField label="รหัสสินทรัพย์" value={selectedAsset.id} />
                        <NexusDataField label="หมวดหมู่อุปกรณ์" value={selectedAsset.category} />
                        <NexusDataField label="ผู้ครอบครอง" value={selectedAsset.custodian} />
                        <NexusDataField label="แผนผังพิกัด" value={selectedAsset.location} />
                      </div>

                      <div className="pt-4 border-t border-white/5 space-y-2">
                        <PillButton className="w-full text-xs bg-nexus-blue shadow-neon-blue">
                          โอนย้ายผู้รับผิดชอบสินทรัพย์
                        </PillButton>
                      </div>
                    </div>
                  </GlassCard>
                ) : (
                  <GlassCard className="p-4 border-white/5 space-y-3">
                    <div>
                      <h4 className="text-sm font-medium text-white/30 uppercase tracking-widest">ทะเบียนสินทรัพย์ถาวร</h4>
                      <p className="text-sm font-medium text-white/50 mt-1 leading-relaxed">ควบคุมตรวจติดตามสินทรัพย์ถาวรขององค์กร ตรวจสอบค่าเสื่อมสะสม และผู้รับผิดชอบอย่างโปร่งใส</p>
                    </div>

                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3 text-xs font-medium">
                      <div className="flex justify-between items-center">
                        <span className="text-white/40">มูลค่าสินทรัพย์ถาวรสุทธิ</span>
                        <span className="text-white font-medium mono-numbers">฿{assets.reduce((sum: number, a: any) => sum + (Number(a.value) || 0), 0).toLocaleString("th-TH")}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-white/40">จำนวนสินทรัพย์ในคลัง</span>
                        <span className="text-white font-medium">{assets.length} รายการ</span>
                      </div>
                    </div>
                  </GlassCard>
                )
              )}

              {/* Serials Tab Sidebar */}
              {activeTab === "serials" && (
                selectedSerial ? (
                  <GlassCard className="p-4 border-nexus-teal/20 shadow-2xl relative overflow-hidden animate-in slide-in-from-right duration-300">
                    <div className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] bg-gradient-to-br from-nexus-teal/5 via-transparent to-transparent rotate-45 pointer-events-none" />
                    <div className="relative z-10 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-xs font-medium text-nexus-teal uppercase tracking-[0.2em]">Serial Telemetry</p>
                          <h3 className="text-xl font-medium text-white tracking-tight mt-1 font-mono">{selectedSerial.sn}</h3>
                        </div>
                        <button 
                          onClick={() => setSelectedSerialSn(null)}
                          className="p-1 rounded-full bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                        >
                          <ChevronLeft className="rotate-180" size={16} />
                        </button>
                      </div>

                      <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-2 text-center">
                        <span className="text-sm font-medium text-white/30 uppercase tracking-widest block">สถานะประกัน</span>
                        <span className={cn("text-xs font-medium tracking-widest flex items-center justify-center gap-1", warrantyState(selectedSerial).tone)}>
                          <ShieldCheck size={14} /> {warrantyState(selectedSerial).label}
                        </span>
                      </div>

                      <div className="space-y-3">
                        <p className="text-sm font-medium text-white/30 uppercase tracking-widest border-b border-white/5 pb-2">ข้อมูลผลิตภัณฑ์ SN</p>
                        <NexusDataField label="ชื่อรายการ" value={selectedSerial.name} />
                        <NexusDataField label="ตำแหน่งการจัดเก็บ" value={selectedSerial.location} />
                        <NexusDataField label="วันหมดอายุรับประกัน" value={selectedSerial.expiry} />
                      </div>

                      <div className="pt-4 border-t border-white/5 space-y-2">
                        <PillButton className="w-full text-xs shadow-neon-teal" onClick={() => router.push(`/inventory/serials/${encodeURIComponent(selectedSerial.sn)}`)}>
                          ดูประวัติเครื่อง
                        </PillButton>
                      </div>
                    </div>
                  </GlassCard>
                ) : (
                  <GlassCard className="p-4 border-white/5 space-y-3">
                    <div>
                      <h4 className="text-sm font-medium text-white/30 uppercase tracking-widest">ระบบควบคุมหมายเลขซีเรียล</h4>
                      <p className="text-sm font-medium text-white/50 mt-1 leading-relaxed">ตรวจติดตามหมายเลข Serial Number รายอุปกรณ์ เพื่อรับประกันสิทธิ์การใช้งาน โอนย้าย หรือส่งเคลมโรงงาน</p>
                    </div>

                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3 text-xs font-medium">
                      {([["พร้อมใช้งาน", "available", "text-nexus-teal"], ["ติดตั้ง/ส่งมอบแล้ว", "deployed", "text-warning"], ["ส่ง RMA", "rma", "text-danger"]] as const).map(([label, key, tone]) => (
                        <div key={key} className="flex justify-between items-center">
                          <span className="text-white/40">{label}</span>
                          <span className={cn(tone, "font-medium")}>{serials.filter((x: any) => (x.status || "available") === key).length} เครื่อง</span>
                        </div>
                      ))}
                    </div>
                  </GlassCard>
                )
              )}

              {/* History Tab Sidebar */}
              {activeTab === "history" && (
                selectedMovement ? (
                  <GlassCard className="p-4 border-nexus-blue/20 shadow-2xl relative overflow-hidden animate-in slide-in-from-right duration-300">
                    <div className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] bg-gradient-to-br from-nexus-blue/5 via-transparent to-transparent rotate-45 pointer-events-none" />
                    <div className="relative z-10 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-xs font-medium text-nexus-blue uppercase tracking-[0.2em]">Audit Log Inspection</p>
                          <h3 className="text-xl font-medium text-white mt-1 font-mono">{selectedMovement.transactionId}</h3>
                        </div>
                        <button 
                          onClick={() => setSelectedMovementId(null)}
                          className="p-1 rounded-full bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                        >
                          <ChevronLeft className="rotate-180" size={16} />
                        </button>
                      </div>

                      <div className="p-4 rounded-xl bg-black/60 border border-white/5 space-y-3">
                        <NexusDataField label="ประเภทรายการ" value={selectedMovement.type} highlight />
                        <NexusDataField label="จำนวนย้ายจริง" value={`${selectedMovement.quantity} Units`} />
                        <NexusDataField label="ผู้ทำรายการ" value={selectedMovement.userId || "System"} />
                      </div>

                      <div className="space-y-3">
                        <p className="text-sm font-medium text-white/30 uppercase tracking-widest border-b border-white/5 pb-2">เส้นทางเดินสินค้า</p>
                        <div className="flex items-center justify-between text-xs font-medium bg-white/[0.02] p-3 rounded-lg border border-white/5 font-mono">
                          <span className="text-white/60">{selectedMovement.fromLocation || "EXTERNAL"}</span>
                          <span className="text-nexus-teal">→</span>
                          <span className="text-white/60">{selectedMovement.toLocation || "MAIN-WH"}</span>
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                ) : (
                  <GlassCard className="p-4 border-white/5 space-y-3">
                    <div>
                      <h4 className="text-sm font-medium text-white/30 uppercase tracking-widest">วิเคราะห์ความเคลื่อนไหว</h4>
                      <p className="text-sm font-medium text-white/50 mt-1 leading-relaxed">บันทึกเหตุการณ์รับเข้า-จ่ายออก และโอนย้ายพัสดุแบบ Real-time ตรวจสอบย้อนกลับและสอบทานบัญชีได้ 100%</p>
                    </div>

                    <div className="p-4 rounded-xl  border border-nexus-teal/10 space-y-2 text-xs font-medium">
                      <p className="text-nexus-teal uppercase tracking-widest text-xs font-medium">Logistics Ledger Security</p>
                      <p className="text-white/70 leading-relaxed font-medium">
                        ทุกธุรกรรมคลังพัสดุจะถูกเข้ารหัสลายเซ็นดิจิทัล ผูกกับบัญชีผู้ใช้และบันทึกเวลาสากล ป้องกันการแก้ไขหรือลบประวัติโดยพลการ
                      </p>
                    </div>
                  </GlassCard>
                )
              )}

              {/* Kits Tab Sidebar */}
              {activeTab === "kits" && (
                selectedKit ? (
                  <GlassCard className="p-4 border-nexus-teal/20 shadow-2xl relative overflow-hidden animate-in slide-in-from-right duration-300">
                    <div className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] bg-gradient-to-br from-nexus-teal/5 via-transparent to-transparent rotate-45 pointer-events-none" />
                    <div className="relative z-10 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-xs font-medium text-nexus-teal uppercase tracking-[0.2em]">BOM Kit Inspector</p>
                          <h3 className="text-xl font-medium text-white tracking-tight mt-1">{selectedKit.name}</h3>
                        </div>
                        <button 
                          onClick={() => setSelectedKitId(null)}
                          className="p-1 rounded-full bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                        >
                          <ChevronLeft className="rotate-180" size={16} />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-4 rounded-xl  border border-nexus-teal/10 flex flex-col justify-between">
                          <span className="text-sm font-medium text-white/30 uppercase tracking-widest">ราคาทุนรวม</span>
                          <span className="text-[14px] font-medium text-nexus-teal mt-1 mono-numbers">฿{selectedKit.aggregateCost.toLocaleString()}</span>
                        </div>
                        <div className="p-4 rounded-xl bg-white/5 border border-white/5 flex flex-col justify-between">
                          <span className="text-sm font-medium text-white/30 uppercase tracking-widest">ราคาเสนอขาย</span>
                          <span className="text-[14px] font-medium text-white mt-1 mono-numbers">฿{selectedKit.aggregatePrice.toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <p className="text-sm font-medium text-white/30 uppercase tracking-widest border-b border-white/5 pb-2">รายการส่วนประกอบในชุด</p>
                        <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                          {selectedKit.components.map((comp: any, cidx: number) => (
                            <div key={cidx} className="p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-1.5 hover:bg-white/[0.04] transition-colors">
                              <div className="flex justify-between items-start gap-2">
                                <span className="text-xs font-medium text-white leading-snug">{comp.name}</span>
                                <span className="px-1.5 py-0.5 rounded bg-white/5 text-sm text-white/40 border border-white/5 font-mono font-medium shrink-0">
                                  x{comp.qty}
                                </span>
                              </div>
                              <div className="flex justify-between text-xs font-medium uppercase text-white/30 tracking-wider">
                                <span>{comp.type}</span>
                                <span className="font-mono">฿{comp.price.toLocaleString()} / EA</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-4 border-t border-white/5 space-y-2">
                        <PillButton className="w-full text-xs shadow-neon-teal">
                          เบิกจ่ายชุดอุปกรณ์นี้เข้าโครงการ
                        </PillButton>
                      </div>
                    </div>
                  </GlassCard>
                ) : (
                  <GlassCard className="p-4 border-white/5 space-y-3">
                    <div>
                      <h4 className="text-sm font-medium text-white/30 uppercase tracking-widest">ชุดสูตรสำเร็จ</h4>
                      <p className="text-sm font-medium text-white/50 mt-1 leading-relaxed">รวบรวมพัสดุ Hardware, Materials และงานบริการ รวมเป็นชุดอุปกรณ์พร้อมขาย เพื่อความสะดวกในการออก BOQ และประมูลงานภาครัฐ</p>
                    </div>

                    <div className="p-4 rounded-xl  border border-nexus-teal/10 space-y-2 text-xs font-medium">
                      <p className="text-nexus-teal uppercase tracking-widest text-xs font-medium">e-Bidding Integration Tool</p>
                      <p className="text-white/70 leading-relaxed font-medium">
                        การจัดกลุ่มสินค้าช่วยให้ออกแบบงบประมาณ ได้เร็วขึ้น 80% ป้องกันการตกหล่นของรายการอุปกรณ์เสริมและงานเดินสาย
                      </p>
                    </div>
                  </GlassCard>
                )
              )}


            </div>
          </div>
        </div>
        )}
      </main>

      {/* Toast Notification */}
      <Toast 
        message={toast.message} 
        isVisible={toast.isVisible} 
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))} 
      />

      {/* Create BOM Kit Modal */}
      <CreateKitModal
        isOpen={isAddKitOpen}
        onClose={() => setIsAddKitOpen(false)}
        products={products}
        onSave={async (newKit) => {
          try {
            // บันทึกผ่าน server (ตรวจสิทธิ์ inventory:edit และบันทึกประวัติ)
            const res = await apiFetch("/api/inventory/kits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "create", kit: newKit }) });
            const d = await res.json().catch(() => ({}));
            if (!res.ok || !d.success) throw new Error(d.error || "บันทึกไม่สำเร็จ");
            
            setIsAddKitOpen(false);
            setToast({
              message: "สร้างชุดอุปกรณ์สำเร็จรูป สำเร็จ",
              isVisible: true,
              type: "success"
            });
          } catch (error: any) {
            console.error(error);
            setToast({
              message: `สร้างไม่สำเร็จ: ${error.message}`,
              isVisible: true,
              type: "error"
            });
          }
        }}
      />
    </div>
  );
}
