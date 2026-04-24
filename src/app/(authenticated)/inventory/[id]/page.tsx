"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Package,
  ChevronLeft,
  Edit3,
  Save,
  ScanBarcode,
  Truck,
  History,
  TrendingUp,
  Activity,
  ShieldCheck,
  BarChart3,
  ArrowUpRight,
  RefreshCw,
  Loader2,
  Box,
  DollarSign,
  Zap,
  Lock,
  Unlock,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Info
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
  PillBackButton,
  NexusDataField,
  PillInput,
  PillSelect,
  Toast
} from "@/components/ui/Base";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  doc,
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
  limit
} from "firebase/firestore";
import { inventoryService } from "@/services/inventory.service";
import { Product } from "@/types/database";

const CATEGORIES = [
  "Network & Wireless",
  "Server & Datacenter",
  "Fiber & Cabling",
  "Security Systems",
  "Power & UPS",
  "Computing & Workstation",
  "Software & Licensing",
  "Consumables",
  "General"
];

const UNITS = ["EA", "Unit", "Pcs", "Box", "Set", "Roll", "Meter", "License"];

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, companyId } = useAuth();
  const productId = params.id as string;

  const [activeTab, setActiveTab] = useState("overview");
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [movements, setMovements] = useState<any[]>([]);

  // Form state
  const [form, setForm] = useState({
    sku: "",
    name: "",
    description: "",
    category: "",
    brand: "",
    unit: "EA",
    minStock: 0,
    costWAC: 0,
    pricePOS: 0,
    priceProject: 0,
    onHand: 0,
    reserved: 0
  });

  const [toast, setToast] = useState({
    message: "",
    isVisible: false,
    type: "success" as "success" | "error" | "warning"
  });

  // Real-time product listener
  useEffect(() => {
    if (!productId) return;
    const unsubscribe = onSnapshot(
      doc(db, "products", productId),
      (snap) => {
        if (snap.exists()) {
          const data = { id: snap.id, ...snap.data() } as Product;
          setProduct(data);
          setForm({
            sku: data.sku || "",
            name: data.name || "",
            description: data.description || "",
            category: data.category || "",
            brand: data.brand || "",
            unit: data.unit || "EA",
            minStock: (data as any).minStock || 0,
            costWAC: data.pricing?.costWAC || 0,
            pricePOS: data.pricing?.pricePOS || 0,
            priceProject: data.pricing?.priceProject || 0,
            onHand: data.stockStatus?.onHand || 0,
            reserved: data.stockStatus?.reserved || 0
          });
        }
        setLoading(false);
      },
      (err) => {
        console.error("Product snapshot error:", err);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [productId]);

  // Real-time stock movements
  useEffect(() => {
    if (!companyId || !productId) return;
    const q = query(
      collection(db, "stockMovements"),
      where("companyId", "==", companyId),
      where("productId", "==", productId),
      orderBy("createdAt", "desc"),
      limit(10)
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const items: any[] = [];
      snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
      setMovements(items);
    }, () => {
      // Fallback mock for index building
      setMovements([
        { id: "1", transactionId: "TX-GRN-1209", type: "IN", quantity: 24, fromLocation: "EXTERNAL", toLocation: "WH-01-A1-L4", userId: user?.displayName || "System", createdAt: new Date() },
        { id: "2", transactionId: "TX-ISS-0982", type: "OUT", quantity: 5, fromLocation: "WH-01-A1-L4", toLocation: "PROJECT-26-001", userId: "Kriangkrai M.", createdAt: new Date(Date.now() - 86400000) }
      ]);
    });
    return () => unsubscribe();
  }, [companyId, productId]);

  const margin = useMemo(() => {
    if (!form.priceProject) return 0;
    const profit = form.priceProject - form.costWAC;
    return Math.round((profit / form.priceProject) * 100);
  }, [form.priceProject, form.costWAC]);

  const totalValue = useMemo(() => form.onHand * form.costWAC, [form.onHand, form.costWAC]);

  const handleSave = async () => {
    if (!user || !companyId || !productId) return;
    if (!form.sku.trim() || !form.name.trim()) {
      setToast({ message: "กรุณาระบุรหัส SKU และชื่อพัสดุ", isVisible: true, type: "warning" });
      return;
    }
    setIsSaving(true);
    try {
      await inventoryService.updateItem(user.uid, companyId, productId, {
        sku: form.sku.trim(),
        name: form.name.trim(),
        description: form.description,
        category: form.category,
        brand: form.brand,
        unit: form.unit,
        pricing: {
          costWAC: form.costWAC,
          pricePOS: form.pricePOS,
          priceProject: form.priceProject
        },
        stockStatus: {
          onHand: form.onHand,
          reserved: form.reserved,
          available: form.onHand - form.reserved
        }
      });
      setToast({ message: "บันทึกข้อมูลพัสดุเรียบร้อยแล้ว", isVisible: true, type: "success" });
      setIsEditMode(false);
    } catch (err) {
      console.error(err);
      setToast({ message: "เกิดข้อผิดพลาดในการบันทึกข้อมูล", isVisible: true, type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (product) {
      setForm({
        sku: product.sku || "",
        name: product.name || "",
        description: product.description || "",
        category: product.category || "",
        brand: product.brand || "",
        unit: product.unit || "EA",
        minStock: (product as any).minStock || 0,
        costWAC: product.pricing?.costWAC || 0,
        pricePOS: product.pricing?.pricePOS || 0,
        priceProject: product.pricing?.priceProject || 0,
        onHand: product.stockStatus?.onHand || 0,
        reserved: product.stockStatus?.reserved || 0
      });
    }
    setIsEditMode(false);
  };

  const tabs = [
    { id: "overview", label: "ข้อมูลสินค้า (INFO)", icon: <Info size={14} /> },
    { id: "pricing", label: "ราคาและต้นทุน (PRICING)", icon: <DollarSign size={14} /> },
    { id: "stock", label: "ควบคุมสต็อก (STOCK)", icon: <Box size={14} /> },
    { id: "history", label: "ความเคลื่อนไหว (LOGS)", icon: <Activity size={14} /> }
  ];

  const isLow = form.onHand <= form.minStock;
  const isOut = form.onHand === 0;
  const stockStatus = isOut ? "danger" : isLow ? "pending" : "active";
  const stockLabel = isOut ? "สินค้าหมด" : isLow ? "สต็อกต่ำ" : "พร้อมใช้งาน";

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-nexus-teal" />
          <p className="text-xs font-black text-white/30 uppercase tracking-widest">กำลังโหลดข้อมูลพัสดุ...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <GlassCard className="p-10 text-center space-y-4 max-w-md">
          <AlertTriangle size={40} className="mx-auto text-warning" />
          <h3 className="text-lg font-black text-white">ไม่พบรายการพัสดุ</h3>
          <p className="text-sm text-white/40">รหัสพัสดุ {productId} ไม่มีอยู่ในระบบหรืออาจถูกลบแล้ว</p>
          <PillButton variant="glass" onClick={() => router.back()} className="mx-auto">
            <ChevronLeft size={16} /> กลับหน้าคลังพัสดุ
          </PillButton>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent">

      {/* Page Header */}
      <header className="p-6 border-b border-white/5 flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-black/20">
        <div className="flex items-center gap-4">
          <PillBackButton onClick={() => router.back()} />
          <div className="w-px h-8 bg-white/10" />
          <div className="flex items-center gap-3">
            <StatusBadge status={stockStatus} label={stockLabel} />
            <p className="text-[10px] font-black text-white/20 uppercase tracking-widest font-mono">
              ID: {productId}
            </p>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div>
            <h1 className="text-lg font-black text-white tracking-tight leading-none">
              {product.name}
            </h1>
            <p className="text-[10px] font-black text-white/30 uppercase mt-1 tracking-widest font-mono">
              {product.sku}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isEditMode ? (
            <>
              <PillButton
                variant="glass"
                className="gap-2 h-9 text-xs border-white/10 text-white/40 hover:text-white"
                onClick={handleCancel}
                disabled={isSaving}
              >
                ยกเลิก
              </PillButton>
              <PillButton
                className="gap-2 h-9 text-xs shadow-neon-teal"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                บันทึกข้อมูล
              </PillButton>
            </>
          ) : (
            <PillButton
              variant="glass"
              className="gap-2 h-9 text-xs border-nexus-blue/20 text-nexus-blue hover:text-white"
              onClick={() => setIsEditMode(true)}
            >
              <Edit3 size={14} /> แก้ไขข้อมูล
            </PillButton>
          )}
        </div>
      </header>

      {/* Tab Navigation */}
      <section className="px-6 py-3 bg-black/10 border-b border-white/5">
        <PillTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
      </section>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(20,163,204,0.03)_0%,transparent_50%)] pointer-events-none" />

        <div className="flex flex-col lg:flex-row gap-6 items-start relative z-10 w-full animate-in fade-in duration-500">

          {/* Left Column - Main Form */}
          <div className="flex-1 w-full space-y-6">

            {/* Summary Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MasterMetricCard
                icon={<Package size={20} />}
                label="คงเหลือในคลัง"
                value={`${form.onHand.toLocaleString()} ${form.unit}`}
                color="text-nexus-teal"
                neon="shadow-neon-teal"
              />
              <MasterMetricCard
                icon={<TrendingUp size={20} />}
                label="ต้นทุนเฉลี่ย (WAC)"
                value={`\u0E3F${form.costWAC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                color="text-nexus-blue"
              />
              <MasterMetricCard
                icon={<BarChart3 size={20} />}
                label="มูลค่ารวมในคลัง"
                value={`\u0E3F${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                color="text-warning"
              />
            </div>

            {/* Edit Mode Notice */}
            {isEditMode && (
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-nexus-blue/5 border border-nexus-blue/20">
                <Unlock size={16} className="text-nexus-blue shrink-0" />
                <p className="text-[11px] font-black text-nexus-blue uppercase tracking-widest">
                  โหมดแก้ไข — แก้ไขข้อมูลแล้วกด "บันทึกข้อมูล" เพื่อยืนยัน
                </p>
              </div>
            )}

            {/* Tab: Overview - Product Info */}
            {activeTab === "overview" && (
              <GlassCard className="p-6 border-white/5 bg-black/40 space-y-8">
                <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                  <Zap size={16} className="text-nexus-blue" />
                  <h3 className="text-[11px] font-black text-nexus-blue uppercase tracking-widest">
                    อัตลักษณ์พัสดุ (Product Identity)
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField label="รหัสสินค้า (SKU CODE) *">
                    {isEditMode ? (
                      <PillInput
                        value={form.sku}
                        onChange={(e) => setForm({ ...form, sku: e.target.value })}
                        placeholder="ระบุรหัส SKU..."
                        className="w-full font-mono text-nexus-blue font-black"
                      />
                    ) : (
                      <div className="px-4 py-3 rounded-2xl bg-white/5 border border-white/5 font-mono text-sm font-black text-nexus-blue">
                        {form.sku || "—"}
                      </div>
                    )}
                  </FormField>

                  <FormField label="ชื่อพัสดุ / สินค้า *">
                    {isEditMode ? (
                      <PillInput
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="ชื่อที่แสดงในเอกสาร..."
                        className="w-full"
                      />
                    ) : (
                      <div className="px-4 py-3 rounded-2xl bg-white/5 border border-white/5 text-sm font-bold text-white">
                        {form.name || "—"}
                      </div>
                    )}
                  </FormField>

                  <FormField label="หมวดหมู่สินค้า">
                    {isEditMode ? (
                      <PillSelect
                        value={form.category}
                        onChange={(e) => setForm({ ...form, category: e.target.value })}
                        className="w-full"
                      >
                        <option value="">เลือกหมวดหมู่...</option>
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </PillSelect>
                    ) : (
                      <div className="px-4 py-3 rounded-2xl bg-white/5 border border-white/5 text-sm font-bold text-white/70">
                        {form.category || "—"}
                      </div>
                    )}
                  </FormField>

                  <FormField label="แบรนด์ / ผู้ผลิต">
                    {isEditMode ? (
                      <PillInput
                        value={form.brand}
                        onChange={(e) => setForm({ ...form, brand: e.target.value })}
                        placeholder="เช่น Aruba, Cisco, Dell..."
                        className="w-full"
                      />
                    ) : (
                      <div className="px-4 py-3 rounded-2xl bg-white/5 border border-white/5 text-sm font-bold text-white/70">
                        {form.brand || "—"}
                      </div>
                    )}
                  </FormField>

                  <FormField label="หน่วยนับ (UNIT)">
                    {isEditMode ? (
                      <PillSelect
                        value={form.unit}
                        onChange={(e) => setForm({ ...form, unit: e.target.value })}
                        className="w-full"
                      >
                        {UNITS.map((u) => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </PillSelect>
                    ) : (
                      <div className="px-4 py-3 rounded-2xl bg-white/5 border border-white/5 text-sm font-bold text-white/70">
                        {form.unit || "—"}
                      </div>
                    )}
                  </FormField>

                  <FormField label="คำอธิบายสินค้า (Description)">
                    {isEditMode ? (
                      <textarea
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        placeholder="รายละเอียดสินค้าสำหรับเอกสาร..."
                        rows={3}
                        className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-sm font-bold text-white placeholder:text-white/20 focus:outline-none focus:border-nexus-teal/30 resize-none"
                      />
                    ) : (
                      <div className="px-4 py-3 rounded-2xl bg-white/5 border border-white/5 text-sm text-white/60 min-h-[80px]">
                        {form.description || <span className="text-white/20 italic">ยังไม่มีคำอธิบาย</span>}
                      </div>
                    )}
                  </FormField>
                </div>
              </GlassCard>
            )}

            {/* Tab: Pricing */}
            {activeTab === "pricing" && (
              <GlassCard className="p-6 border-white/5 bg-black/40 space-y-8">
                <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                  <DollarSign size={16} className="text-warning" />
                  <h3 className="text-[11px] font-black text-warning uppercase tracking-widest">
                    โครงสร้างราคาและต้นทุน (Financial Structure)
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="col-span-full p-4 rounded-2xl bg-white/[0.02] border border-white/5 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField label="ราคาเสนอโครงการ (PROJECT PRICE)">
                      {isEditMode ? (
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-sm font-black">\u0E3F</span>
                          <PillInput
                            type="number"
                            value={form.priceProject}
                            onChange={(e) => setForm({ ...form, priceProject: Number(e.target.value) })}
                            className="w-full pl-8 font-mono mono-numbers"
                          />
                        </div>
                      ) : (
                        <div className="px-4 py-3 rounded-2xl bg-white/5 border border-white/5 font-mono font-black text-white">
                          \u0E3F{form.priceProject.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                      )}
                    </FormField>

                    <FormField label="ราคาขายปลีก (RETAIL PRICE)">
                      {isEditMode ? (
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-sm font-black">\u0E3F</span>
                          <PillInput
                            type="number"
                            value={form.pricePOS}
                            onChange={(e) => setForm({ ...form, pricePOS: Number(e.target.value) })}
                            className="w-full pl-8 font-mono mono-numbers"
                          />
                        </div>
                      ) : (
                        <div className="px-4 py-3 rounded-2xl bg-white/5 border border-white/5 font-mono font-black text-white">
                          \u0E3F{form.pricePOS.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                      )}
                    </FormField>

                    <FormField label="ต้นทุนเฉลี่ย (WAC COST)">
                      {isEditMode ? (
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-sm font-black">\u0E3F</span>
                          <PillInput
                            type="number"
                            value={form.costWAC}
                            onChange={(e) => setForm({ ...form, costWAC: Number(e.target.value) })}
                            className="w-full pl-8 font-mono mono-numbers"
                          />
                        </div>
                      ) : (
                        <div className="px-4 py-3 rounded-2xl bg-white/5 border border-white/5 font-mono font-black text-nexus-teal">
                          \u0E3F{form.costWAC.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                      )}
                    </FormField>
                  </div>

                  {/* Margin Indicator */}
                  <div className="col-span-full flex flex-col md:flex-row gap-4">
                    <div className="flex-1 p-6 rounded-2xl bg-nexus-teal/5 border border-nexus-teal/15 flex flex-col items-center justify-center gap-2">
                      <span className="text-[9px] font-black text-nexus-teal uppercase tracking-widest">Project Margin</span>
                      <div className={cn("text-3xl font-black font-mono", margin >= 20 ? "text-nexus-teal" : margin >= 0 ? "text-warning" : "text-danger")}>
                        {margin}%
                      </div>
                      <span className="text-[9px] text-white/30 font-bold">
                        กำไรต่อหน่วย: \u0E3F{(form.priceProject - form.costWAC).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex-1 p-6 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col items-center justify-center gap-2">
                      <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">มูลค่าคงคลังรวม</span>
                      <div className="text-2xl font-black font-mono text-nexus-blue">
                        \u0E3F{totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                      <span className="text-[9px] text-white/30 font-bold">
                        {form.onHand} {form.unit} x \u0E3F{form.costWAC.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </GlassCard>
            )}

            {/* Tab: Stock Control */}
            {activeTab === "stock" && (
              <GlassCard className="p-6 border-white/5 bg-black/40 space-y-8">
                <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                  <Box size={16} className="text-nexus-teal" />
                  <h3 className="text-[11px] font-black text-nexus-teal uppercase tracking-widest">
                    การควบคุมระดับพัสดุ (Stock Control)
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <FormField label="ระดับสต็อกปัจจุบัน (ON HAND)">
                    {isEditMode ? (
                      <PillInput
                        type="number"
                        value={form.onHand}
                        onChange={(e) => setForm({ ...form, onHand: Number(e.target.value) })}
                        className="w-full font-mono mono-numbers"
                      />
                    ) : (
                      <div className="px-4 py-3 rounded-2xl bg-nexus-teal/5 border border-nexus-teal/15 font-mono font-black text-nexus-teal text-lg">
                        {form.onHand.toLocaleString()} {form.unit}
                      </div>
                    )}
                  </FormField>

                  <FormField label="ถูกจองใช้งาน (RESERVED)">
                    {isEditMode ? (
                      <PillInput
                        type="number"
                        value={form.reserved}
                        onChange={(e) => setForm({ ...form, reserved: Number(e.target.value) })}
                        className="w-full font-mono mono-numbers"
                      />
                    ) : (
                      <div className="px-4 py-3 rounded-2xl bg-white/5 border border-white/5 font-mono font-black text-warning text-lg">
                        {form.reserved.toLocaleString()} {form.unit}
                      </div>
                    )}
                  </FormField>

                  <FormField label="พร้อมใช้งาน (AVAILABLE)">
                    <div className="px-4 py-3 rounded-2xl bg-white/5 border border-white/5 font-mono font-black text-nexus-blue text-lg">
                      {Math.max(0, form.onHand - form.reserved).toLocaleString()} {form.unit}
                    </div>
                  </FormField>

                  <FormField label="ระดับแจ้งเตือนขั้นต่ำ (MIN STOCK)">
                    {isEditMode ? (
                      <PillInput
                        type="number"
                        value={form.minStock}
                        onChange={(e) => setForm({ ...form, minStock: Number(e.target.value) })}
                        className="w-full font-mono mono-numbers"
                      />
                    ) : (
                      <div className="px-4 py-3 rounded-2xl bg-white/5 border border-white/5 font-mono font-black text-white/60">
                        {form.minStock} {form.unit}
                      </div>
                    )}
                  </FormField>
                </div>

                {/* Stock Status Visual */}
                <div className={cn(
                  "p-4 rounded-2xl border flex items-center gap-4",
                  isOut ? "bg-danger/5 border-danger/20" :
                  isLow ? "bg-warning/5 border-warning/20" :
                  "bg-nexus-teal/5 border-nexus-teal/20"
                )}>
                  {isOut ? <AlertTriangle size={20} className="text-danger shrink-0" /> :
                   isLow ? <AlertTriangle size={20} className="text-warning shrink-0" /> :
                   <CheckCircle2 size={20} className="text-nexus-teal shrink-0" />}
                  <div>
                    <p className={cn("text-xs font-black uppercase tracking-widest", isOut ? "text-danger" : isLow ? "text-warning" : "text-nexus-teal")}>
                      {stockLabel}
                    </p>
                    <p className="text-[10px] text-white/40 font-bold mt-0.5">
                      {isOut ? "สินค้าหมดคลัง กรุณาดำเนินการสั่งซื้อทันที" :
                       isLow ? `ต่ำกว่าระดับขั้นต่ำ (${form.minStock} ${form.unit}) แนะนำเติมสต็อก` :
                       `อยู่ในระดับปลอดภัย (เกินขั้นต่ำ ${form.onHand - form.minStock} ${form.unit})`}
                    </p>
                  </div>
                </div>
              </GlassCard>
            )}

            {/* Tab: Movement History */}
            {activeTab === "history" && (
              <GlassCard className="p-0 overflow-hidden border-white/5 bg-black/40">
                <div className="p-4 border-b border-white/5 flex items-center gap-3">
                  <Activity size={16} className="text-nexus-teal" />
                  <h3 className="text-[11px] font-black text-nexus-teal uppercase tracking-widest">
                    ประวัติการเคลื่อนไหว (Stock Movements)
                  </h3>
                </div>
                <NexusTable 
                  headers={["เลขที่ธุรกรรม", "ประเภทธุรกรรม", "จำนวน", "เส้นทางจัดส่ง / โอนย้าย", "ผู้บันทึกรายการ"]}
                  minWidth="min-w-[600px]"
                >
                  {movements.length === 0 ? (
                    <NexusTableRow>
                      <NexusTableCell colSpan={5} className="p-16 text-center text-white/20">
                        <span className="text-[11px] font-black tracking-widest uppercase">ยังไม่มีประวัติการเคลื่อนไหว</span>
                      </NexusTableCell>
                    </NexusTableRow>
                  ) : (
                    movements.map((move) => (
                      <NexusTableRow key={move.id}>
                        <NexusTableCell mono className="w-36">{move.transactionId}</NexusTableCell>
                        <NexusTableCell className="w-24">
                          <StatusBadge
                            status={move.type === "IN" ? "active" : move.type === "OUT" ? "danger" : "pending"}
                            label={move.type}
                          />
                        </NexusTableCell>
                        <NexusTableCell mono className="w-20 text-right">{move.quantity}</NexusTableCell>
                        <NexusTableCell className="font-mono text-[10px] text-white/40 uppercase">
                          {move.fromLocation || "EXTERNAL"} &rarr; {move.toLocation || "MAIN-WH"}
                        </NexusTableCell>
                        <NexusTableCell className="w-36 text-xs font-bold text-white/50">{move.userId || "System"}</NexusTableCell>
                      </NexusTableRow>
                    ))
                  )}
                </NexusTable>
                <div className="p-3 border-t border-white/5 bg-black/10 flex items-center justify-between text-[10px] text-white/20 font-bold">
                  <span>NEXUS Real-time Stock Ledger</span>
                  <span>PSG Master UI Standard V3.2</span>
                </div>
              </GlassCard>
            )}
          </div>

          {/* Right Sidebar */}
          <div className="w-full lg:w-[360px] shrink-0 space-y-4">

            {/* Quick Stats Card */}
            <GlassCard className="p-5 border-white/5 space-y-5">
              <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                <ShieldCheck size={14} className="text-nexus-teal" />
                <h4 className="text-[10px] font-black text-nexus-teal uppercase tracking-widest">สรุปข้อมูลสินค้า</h4>
                {!isEditMode && (
                  <span className="ml-auto flex items-center gap-1 text-[9px] text-white/20 font-black uppercase">
                    <Lock size={10} /> READ
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <NexusDataField label="รหัส SKU" value={form.sku || "—"} />
                <NexusDataField label="หมวดหมู่" value={form.category || "—"} />
                <NexusDataField label="แบรนด์" value={form.brand || "—"} />
                <NexusDataField label="หน่วยนับ" value={form.unit || "—"} />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5">
                <div className="p-3 rounded-xl bg-nexus-teal/5 border border-nexus-teal/10 text-center">
                  <span className="text-[8px] font-black text-white/30 uppercase tracking-widest block">ON HAND</span>
                  <span className="text-lg font-black text-nexus-teal mt-1 block mono-numbers">{form.onHand}</span>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                  <span className="text-[8px] font-black text-white/30 uppercase tracking-widest block">RESERVED</span>
                  <span className="text-lg font-black text-warning mt-1 block mono-numbers">{form.reserved}</span>
                </div>
              </div>
            </GlassCard>

            {/* Actions Card */}
            <GlassCard className="p-5 border-white/5 space-y-3">
              <h4 className="text-[10px] font-black text-white/30 uppercase tracking-widest">การดำเนินการด่วน</h4>
              <PillButton
                className="w-full text-xs shadow-neon-teal"
                onClick={() => setIsEditMode(true)}
                disabled={isEditMode}
              >
                <Edit3 size={14} /> แก้ไขข้อมูลสินค้า
              </PillButton>
              <PillButton
                variant="glass"
                className="w-full text-xs border-nexus-blue/20 text-nexus-blue hover:text-white"
                onClick={() => setActiveTab("history")}
              >
                <History size={14} /> ดูประวัติการเคลื่อนไหว
              </PillButton>
              <PillButton
                variant="glass"
                className="w-full text-xs border-white/5 text-white/40 hover:text-white"
                onClick={() => router.back()}
              >
                <ChevronLeft size={14} /> กลับหน้าคลังพัสดุ
              </PillButton>
            </GlassCard>

            {/* Margin Indicator (when on pricing tab) */}
            {activeTab === "pricing" && (
              <GlassCard className="p-5 border-nexus-teal/10 bg-nexus-teal/5 space-y-2 text-center">
                <span className="text-[9px] font-black text-nexus-teal uppercase tracking-widest block">Project Gross Margin</span>
                <div className={cn("text-4xl font-black font-mono", margin >= 20 ? "text-nexus-teal" : margin >= 0 ? "text-warning" : "text-danger")}>
                  {margin}%
                </div>
                <span className="text-[10px] text-white/40 font-bold block">
                  กำไรต่อหน่วย: \u0E3F{(form.priceProject - form.costWAC).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </GlassCard>
            )}
          </div>
        </div>
      </main>

      {/* Toast */}
      <Toast
        message={toast.message}
        isVisible={toast.isVisible}
        type={toast.type}
        onClose={() => setToast((prev) => ({ ...prev, isVisible: false }))}
      />
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1 block">
        {label}
      </label>
      {children}
    </div>
  );
}
