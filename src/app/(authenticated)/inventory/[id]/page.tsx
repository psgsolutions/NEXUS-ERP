"use client";
import Link from "next/link";

import React, { useState, useEffect, useMemo } from "react";
import {
  ArrowLeft,
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
} from 'lucide-react';
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
import { AttachmentPicker } from "@/components/shared/AttachmentPicker";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase-client";
import {
  doc,
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
  limit
} from "firebase/firestore";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { useProducts } from "@/hooks/useProducts";
import { apiFetch } from "@/lib/api-client";
import { findBarcodeConflict } from "@/lib/product-validation";
import { Product } from "@/types/database";
import { RecordDeleteButton } from "@/components/shared/RecordDeleteButton";
import { ProductSuppliersBox } from "@/components/shared/ProductSuppliersBox";
import { ProductCostHistory } from "@/components/shared/ProductCostHistory";
import { ServiceRecipeCard } from "@/components/inventory/ServiceRecipeCard";
import { SpecItemsCard } from "@/components/inventory/SpecItemsCard";
import { ProductLotsCard } from "@/components/inventory/ProductLotsCard";
import { can } from "@/lib/permissions";
import { ChoiceInput } from "@/components/ui/ChoiceInput";
import { FieldHistory } from "@/components/ui/FieldHistory";

/** ช่องที่ฝ่ายขาย/วิศวกร (ไม่มีสิทธิ์คลัง) แก้ได้ — ตรงกับ PRODUCT_SALES_FIELDS ที่ server */
const SALES_FIELDS = ["description", "datasheetUrl", "warrantyMonths"];
const LIFECYCLE: { value: string; label: string }[] = [
  { value: "ACTIVE", label: "ใช้งาน" }, { value: "DRAFT", label: "ร่าง (ยังไม่ขาย)" }, { value: "PHASE_OUT", label: "ทยอยยกเลิก" },
];
const blankForm = {
  sku: "", barcode: "", name: "", description: "", category: "", subCategory: "", brand: "", model: "", partNumber: "",
  unit: "ชิ้น", warrantyMonths: 0, datasheetUrl: "", lifecycleStatus: "ACTIVE",
  minStock: 0, reorderPoint: 0, maxStock: 0, costWAC: 0, pricePOS: 0, priceProject: 0, priceWholesale: 0, onHand: 0, reserved: 0,
};
/** ข้อมูลสินค้า → ฟอร์ม (อ่านทั้งชื่อฟิลด์ใหม่และรุ่นเก่า) */
function formFromProduct(p: any): typeof blankForm {
  const ic = p?.inventoryControl || {};
  const n = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  return {
    sku: p?.sku || "", barcode: p?.barcode || "", name: p?.name || "", description: p?.description || p?.technicalSpecs || "",
    category: p?.category || "", subCategory: p?.subCategory || "", brand: p?.brand || "", model: p?.model || p?.mainModel || "",
    partNumber: p?.partNumber || "", unit: p?.unit || "ชิ้น", warrantyMonths: n(p?.warrantyMonths), datasheetUrl: p?.datasheetUrl || "",
    lifecycleStatus: p?.lifecycleStatus || "ACTIVE",
    minStock: n(ic.minStock ?? p?.minStock), reorderPoint: n(ic.reorderPoint ?? p?.reorderPoint), maxStock: n(ic.maxStock ?? p?.maxStock),
    costWAC: n(p?.pricing?.costWAC ?? p?.costPrice), pricePOS: n(p?.pricing?.pricePOS ?? p?.unitPrice), priceProject: n(p?.pricing?.priceProject),
    priceWholesale: n(p?.pricing?.priceWholesale ?? p?.wholesalePrice), onHand: n(p?.stockStatus?.onHand), reserved: n(p?.stockStatus?.reserved),
  };
}



export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, companyId, roles } = useAuth();
  const productId = params.id as string;

  const [activeTab, setActiveTab] = useState("overview");
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [movements, setMovements] = useState<any[]>([]);

  // สิทธิ์: คลัง/จัดซื้อ/วิศวกร/ผู้บริหาร แก้ได้ทั้งหมด (ยกเว้นค่าที่ระบบสร้าง) · ฝ่ายขายแก้ได้เฉพาะข้อมูลประกอบการขาย
  const canFull = can(roles, "inventory:edit");
  const canSalesInfo = !canFull && (can(roles, "sales:edit") || can(roles, "projects:edit"));
  const canSku = can(roles, "settings:manage");
  const ed = (field: string) => isEditMode && (canFull || (canSalesInfo && SALES_FIELDS.includes(field)));

  // Form state
  const [form, setForm] = useState(blankForm);

  const [toast, setToast] = useState({
    message: "",
    isVisible: false,
    type: "success" as "success" | "error" | "warning"
  });

  // สินค้าของบริษัท (ข้อมูลกลางของเครือ + ค่าของบริษัท หรือข้อมูลรุ่นเก่า) แบบเรียลไทม์
  const { data: companyProducts, loading: productsLoading } = useProducts<any>();
  const [masterCtx, setMasterCtx] = useState<{ companyCount: number; canEditMaster: boolean } | null>(null);
  const [saveToGroup, setSaveToGroup] = useState(false);
  useEffect(() => {
    if (!companyId) return;
    apiFetch("/api/master-data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "context" }) })
      .then((r) => r.json()).then((d) => d.success && setMasterCtx({ companyCount: d.companyCount, canEditMaster: !!d.canEditMaster?.products }))
      .catch(() => setMasterCtx(null));
  }, [companyId]);
  useEffect(() => {
    if (!productId) return;
    const found = companyProducts.find((x: any) => x.id === productId);
    if (found && !isEditMode) {
      const data = found as Product;
      setProduct(data);
      setForm(formFromProduct(data));
    }
    if (!productsLoading) setLoading(false);
  }, [productId, companyProducts, productsLoading, isEditMode]);

  useEffect(() => {
    if (!product || typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("edit") === "1" && (canFull || canSalesInfo)) setIsEditMode(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

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
    }, (err) => {
      // ไม่ใช้ข้อมูลจำลอง: ถ้าโหลดไม่ได้ (เช่น index ยังสร้างไม่เสร็จ) ให้แสดงว่าง
      console.warn("Product stock movements snapshot failed", err?.code || err);
      setMovements([]);
    });
    return () => unsubscribe();
  }, [companyId, productId]);

  // ตัวเลือกจากสินค้าที่มีอยู่จริง (หมวด หมวดย่อย หน่วย ยี่ห้อ)
  const choices = useMemo(() => {
    const uniq = (k: string) => Array.from(new Set(companyProducts.map((x: any) => String(x?.[k] || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "th"));
    return { category: uniq("category"), subCategory: uniq("subCategory"), unit: uniq("unit"), brand: uniq("brand") };
  }, [companyProducts]);

  // ตรวจบาร์โค้ดซ้ำกับสินค้าอื่นในบริษัท (เทียบทั้งบาร์โค้ดและ SKU)
  const barcodeConflict = useMemo(
    () => findBarcodeConflict(form.barcode, companyProducts, companyId || "", productId as string),
    [form.barcode, companyProducts, companyId, productId]
  );

  const margin = useMemo(() => {
    if (!form.priceProject) return 0;
    const profit = form.priceProject - form.costWAC;
    return Math.round((profit / form.priceProject) * 100);
  }, [form.priceProject, form.costWAC]);

  const totalValue = useMemo(() => form.onHand * form.costWAC, [form.onHand, form.costWAC]);

  const handleSave = async () => {
    if (!user || !companyId || !productId) {
      setToast({ message: "ระบบขัดข้อง: ไม่พบข้อมูลผู้ใช้งานหรือรหัสองค์กร กรุณาเข้าสู่ระบบใหม่", isVisible: true, type: "error" });
      return;
    }
    if (canFull && !form.name.trim()) {
      setToast({ message: "กรุณาระบุชื่อสินค้า", isVisible: true, type: "warning" });
      return;
    }
    if (barcodeConflict) {
      setToast({ message: `บาร์โค้ดซ้ำกับ ${barcodeConflict}`, isVisible: true, type: "warning" });
      return;
    }
    setIsSaving(true);
    try {
      // เครือบริษัทเดียว: แก้ค่ากลางได้เลย / หลายบริษัท: ชื่อ รายละเอียด หมวด เป็นค่าของบริษัท เว้นแต่ผู้ดูแลเครือเลือกบันทึกเป็นค่ากลาง
      // ไม่บันทึก costWAC / stockStatus จากหน้านี้: เปลี่ยนผ่าน stock engine เท่านั้น
      const scope = canFull && masterCtx && (masterCtx.companyCount <= 1 || saveToGroup) && masterCtx.canEditMaster ? "group" : "company";
      const res = await apiFetch("/api/master-data", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId, action: "update", entity: "products", id: productId, scope,
          changes: canFull ? {
            ...(canSku && form.sku.trim() && form.sku.trim() !== String(product?.sku || "") ? { sku: form.sku.trim(), productCode: form.sku.trim() } : {}),
            name: form.name.trim(), description: form.description, technicalSpecs: form.description,
            category: form.category, subCategory: form.subCategory, brand: form.brand, model: form.model, mainModel: form.model, partNumber: form.partNumber.trim(),
            unit: form.unit, barcode: form.barcode.trim(), barcodes: form.barcode.trim() ? [form.barcode.trim()] : [],
            warrantyMonths: Number(form.warrantyMonths) || 0, datasheetUrl: form.datasheetUrl.trim(), lifecycleStatus: form.lifecycleStatus,
            pricing: { pricePOS: form.pricePOS, priceProject: form.priceProject, priceWholesale: form.priceWholesale },
            unitPrice: form.pricePOS, wholesalePrice: form.priceWholesale,
            inventoryControl: { ...((product as any)?.inventoryControl || {}), minStock: form.minStock, reorderPoint: form.reorderPoint, maxStock: form.maxStock },
          } : { description: form.description, technicalSpecs: form.description, datasheetUrl: form.datasheetUrl.trim(), warrantyMonths: Number(form.warrantyMonths) || 0 },
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || "บันทึกไม่สำเร็จ");
      setToast({ message: "บันทึกข้อมูลพัสดุเรียบร้อยแล้ว", isVisible: true, type: "success" });
      setIsEditMode(false);
    } catch (err: any) {
      console.error(err);
      setToast({ message: err?.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล", isVisible: true, type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (product) {
      setForm(formFromProduct(product));
    }
    setIsEditMode(false);
  };

  const tabs = [
    { id: "overview", label: "ข้อมูลสินค้า", icon: <Info size={14} /> },
    { id: "pricing", label: "ราคาและต้นทุน", icon: <DollarSign size={14} /> },
    { id: "stock", label: "ควบคุมสต็อก", icon: <Box size={14} /> },
    { id: "history", label: "ความเคลื่อนไหว", icon: <Activity size={14} /> }
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
          <p className="text-[12px] font-medium text-white/30 uppercase tracking-widest">กำลังโหลดข้อมูลพัสดุ...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <GlassCard className="p-10 text-center space-y-3 max-w-md">
          <AlertTriangle size={40} className="mx-auto text-warning" />
          <h3 className="text-lg font-bold text-white">ไม่พบรายการพัสดุ</h3>
          <p className="text-sm text-white/40">รหัสพัสดุ {productId} ไม่มีอยู่ในระบบหรืออาจถูกลบแล้ว</p>
          <PillButton variant="glass" onClick={() => router.back()} className="mx-auto">
            <ChevronLeft size={16} /> กลับหน้าคลังพัสดุ
          </PillButton>
        </GlassCard>
      </div>
    );
  }

  const headerContent = (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-6 rounded-3xl backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <PillButton variant="glass" onClick={() => router.back()} className="w-9 h-9 p-0 flex items-center justify-center">
          <ArrowLeft size={20} />
        </PillButton>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-white uppercase tracking-tight">
              {product.name}
            </h1>
            <span className="px-3 py-1 rounded-full bg-nexus-teal/10 border border-nexus-teal/30 text-nexus-teal text-sm font-mono font-bold select-none cursor-default pointer-events-none">
              {product.sku || productId}
            </span>
          </div>
          <p className="text-sm text-white/60 font-medium mt-1">
            รายละเอียดข้อมูลสินค้า สต็อกคงเหลือ ต้นทุน และประวัติการเคลื่อนไหวสินค้าในระบบ
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
        {isEditMode ? (
          <>
            {masterCtx && masterCtx.companyCount > 1 && (
              masterCtx.canEditMaster ? (
                <label className="flex items-center gap-2 text-[12px] text-white/60 cursor-pointer" title="ชื่อ รายละเอียด หมวด จะเปลี่ยนให้ทุกบริษัทในเครือที่ไม่ได้ตั้งชื่อของตัวเอง">
                  <input type="checkbox" checked={saveToGroup} onChange={(e) => setSaveToGroup(e.target.checked)} className="accent-nexus-teal" />
                  บันทึกเป็นค่ากลางของเครือ
                </label>
              ) : (
                <span className="text-[12px] text-white/40" title="SKU บาร์โค้ด ยี่ห้อ หน่วย แก้ได้เฉพาะผู้ดูแลเครือ">ชื่อ/รายละเอียดที่แก้จะใช้เฉพาะบริษัทนี้</span>
              )
            )}
            <PillButton
              variant="glass"
              className="h-8 px-4 text-xs font-bold text-white/50"
              onClick={handleCancel}
              disabled={isSaving}
            >
              ยกเลิก
            </PillButton>
            <PillButton
              variant="save"
              className="h-8 px-5 font-bold text-xs"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? <RefreshCw size={14} className="animate-spin mr-1.5" /> : <Save size={14} className="mr-1.5" />}
              บันทึกข้อมูล
            </PillButton>
          </>
        ) : (
          <>
          {canFull && <RecordDeleteButton kind="products" id={productId} name={product.name} record={product} onDeleted={() => router.push("/inventory")} className="h-8 px-4 text-xs" />}
          {(canFull || canSalesInfo) && (
            <PillButton
              variant="confirm"
              className="h-8 px-4 text-xs font-bold flex items-center gap-1.5"
              onClick={() => setIsEditMode(true)}
              data-product-edit
            >
              <Edit3 size={14} /> {canFull ? "แก้ไขข้อมูล" : "แก้ไขรายละเอียด/สเปก"}
            </PillButton>
          )}
          </>
        )}
      </div>
    </div>
  );

  const leftContent = (
    <div className="flex flex-col overflow-y-auto custom-scrollbar pr-2 pb-10 space-y-6">
      <PillTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
      
      <div className="space-y-4">

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
            label="ต้นทุนเฉลี่ย"
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
            <p className="text-[12px] font-medium text-nexus-blue uppercase tracking-widest">
              {canFull ? "โหมดแก้ไข — แก้ได้ทุกช่องยกเว้นค่าที่ระบบสร้าง (รหัสสินค้า สต็อก ต้นทุน Lot) แล้วกด \"บันทึกข้อมูล\"" : "แก้ได้เฉพาะรายละเอียด/สเปก ลิงก์ datasheet และระยะประกัน — ช่องอื่นแก้โดยฝ่ายคลัง/จัดซื้อ"}
            </p>
          </div>
        )}

        {/* Tab: Overview - Product Info */}
        {activeTab === "overview" && (
          <GlassCard className="p-4 border-white/5 bg-black/15 space-y-3">
            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
              <Zap size={16} className="text-nexus-blue" />
              <h3 className="text-[12px] font-medium text-nexus-blue uppercase tracking-widest">
                อัตลักษณ์พัสดุ
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormField label={canSku ? "รหัสสินค้า (ระบบกำหนด · ผู้ดูแลแก้ได้)" : "รหัสสินค้า (ระบบกำหนด)"}>
                {isEditMode && canSku ? (
                  <PillInput
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    placeholder="ระบุรหัส SKU..."
                    className="w-full font-mono text-nexus-blue font-bold"
                  />
                ) : (
                  <div className="px-4 py-3 rounded-2xl bg-white/15 border border-white/5 font-mono text-sm font-bold text-nexus-blue">
                    {form.sku || "—"}
                  </div>
                )}
              </FormField>

              <FormField label="บาร์โค้ด (ยิงจากสินค้า หรือว่างไว้ใช้ SKU)">
                {ed("barcode") ? (
                  <>
                    <PillInput
                      value={form.barcode}
                      onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                      placeholder="ยิงบาร์โค้ดที่ตัวสินค้า..."
                      className="w-full font-mono"
                    />
                    {barcodeConflict && <p className="text-[11px] text-danger mt-1 ml-2">ซ้ำกับ {barcodeConflict}</p>}
                  </>
                ) : (
                  <div className="px-4 py-3 rounded-2xl bg-white/15 border border-white/5 font-mono text-sm font-bold text-white/80">
                    {form.barcode || "— (ใช้ SKU)"}
                  </div>
                )}
              </FormField>

              <FormField label="ชื่อพัสดุ / สินค้า *">
                {ed("name") ? (
                  <PillInput
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="ชื่อที่แสดงในเอกสาร..."
                    className="w-full"
                  />
                ) : (
                  <div className="px-4 py-3 rounded-2xl bg-white/15 border border-white/5 text-sm font-bold text-white">
                    {form.name || "—"}
                  </div>
                )}
              </FormField>

              <FormField label="หมวดหมู่สินค้า">
                {ed("category") ? (
                  <ChoiceInput value={form.category} onChange={(v) => setForm({ ...form, category: v })} options={choices.category} placeholder="เลือกหรือพิมพ์หมวดหมู่" className="w-full" />
                ) : (
                  <div className="px-4 py-3 rounded-2xl bg-white/15 border border-white/5 text-sm font-bold text-white/70">
                    {form.category || "—"}
                  </div>
                )}
              </FormField>

              <FormField label="แบรนด์ / ผู้ผลิต">
                {ed("brand") ? (
                  <PillInput
                    value={form.brand}
                    onChange={(e) => setForm({ ...form, brand: e.target.value })}
                    placeholder="เช่น Aruba, Cisco, Dell..."
                    className="w-full"
                  />
                ) : (
                  <div className="px-4 py-3 rounded-2xl bg-white/15 border border-white/5 text-sm font-bold text-white/70">
                    {form.brand || "—"}
                  </div>
                )}
              </FormField>

              <FormField label="หน่วยนับ">
                {ed("unit") ? (
                  <ChoiceInput value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} options={choices.unit} placeholder="เลือกหรือพิมพ์หน่วย" className="w-full" />
                ) : (
                  <div className="px-4 py-3 rounded-2xl bg-white/15 border border-white/5 text-sm font-bold text-white/70">
                    {form.unit || "—"}
                  </div>
                )}
              </FormField>

              <FormField label="คำอธิบายสินค้า">
                {ed("description") ? (
                  <FieldHistory k="product.description" value={form.description} onPick={(v) => setForm({ ...form, description: v })}>
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="รายละเอียดสินค้าสำหรับเอกสาร..."
                      rows={5}
                      className="w-full px-4 py-3 rounded-2xl bg-white/15 border border-white/10 text-sm font-bold text-white focus:outline-none focus:border-nexus-teal/30 resize-none"
                    />
                  </FieldHistory>
                ) : (
                  <div className="px-4 py-3 rounded-2xl bg-white/15 border border-white/5 text-sm text-white/60 min-h-[80px]">
                    {form.description || <span className="text-white/20">ยังไม่มีคำอธิบาย</span>}
                  </div>
                )}
              </FormField>
              <FormField label="หมวดย่อย">
                {ed("subCategory") ? <ChoiceInput value={form.subCategory} onChange={(v) => setForm({ ...form, subCategory: v })} options={choices.subCategory} placeholder="เลือกหรือพิมพ์หมวดย่อย" className="w-full" /> : <div className="px-4 py-3 rounded-2xl bg-white/15 border border-white/5 text-sm font-bold text-white/70">{form.subCategory || "—"}</div>}
              </FormField>
              <FormField label="รุ่น">
                {ed("model") ? <PillInput value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="รุ่นของผู้ผลิต" className="w-full" /> : <div className="px-4 py-3 rounded-2xl bg-white/15 border border-white/5 text-sm font-bold text-white/70">{form.model || "—"}</div>}
              </FormField>
              <FormField label="Part number / รหัสผู้ผลิต">
                {ed("partNumber") ? <PillInput value={form.partNumber} onChange={(e) => setForm({ ...form, partNumber: e.target.value })} placeholder="รหัสสินค้าของผู้ผลิต/แบรนด์" className="w-full font-mono" /> : <div className="px-4 py-3 rounded-2xl bg-white/15 border border-white/5 text-sm font-bold text-white/70 font-mono">{form.partNumber || "—"}</div>}
              </FormField>
              <FormField label="รับประกัน (เดือน)">
                {ed("warrantyMonths") ? <PillInput inputMode="numeric" value={String(form.warrantyMonths || "")} onChange={(e) => setForm({ ...form, warrantyMonths: Number(e.target.value.replace(/[^\d]/g, "")) || 0 })} placeholder="เช่น 12" className="w-full font-mono" /> : <div className="px-4 py-3 rounded-2xl bg-white/15 border border-white/5 text-sm font-bold text-white/70">{form.warrantyMonths ? `${form.warrantyMonths} เดือน` : "—"}</div>}
              </FormField>
              <FormField label="สถานะสินค้า">
                {ed("lifecycleStatus") ? (
                  <PillSelect value={form.lifecycleStatus} onChange={(e) => setForm({ ...form, lifecycleStatus: e.target.value })} className="w-full">
                    {LIFECYCLE.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                  </PillSelect>
                ) : <div className="px-4 py-3 rounded-2xl bg-white/15 border border-white/5 text-sm font-bold text-white/70">{LIFECYCLE.find((x) => x.value === form.lifecycleStatus)?.label || form.lifecycleStatus}</div>}
              </FormField>
              <FormField label="ลิงก์ datasheet">
                {ed("datasheetUrl") ? <PillInput value={form.datasheetUrl} onChange={(e) => setForm({ ...form, datasheetUrl: e.target.value })} placeholder="https://..." className="w-full" /> : (
                  <div className="px-4 py-3 rounded-2xl bg-white/15 border border-white/5 text-sm truncate">
                    {form.datasheetUrl ? <a href={form.datasheetUrl} target="_blank" rel="noreferrer" className="text-nexus-teal hover:underline">เปิด datasheet</a> : <span className="text-white/30">—</span>}
                  </div>
                )}
              </FormField>
            </div>
          </GlassCard>
        )}

        {/* Tab: Pricing */}
        {activeTab === "pricing" && (
          <GlassCard className="p-4 border-white/5 bg-black/15 space-y-3">
            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
              <DollarSign size={16} className="text-warning" />
              <h3 className="text-[12px] font-medium text-warning uppercase tracking-widest">
                โครงสร้างราคาและต้นทุน
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="col-span-full p-4 rounded-2xl bg-white/[0.02] border border-white/5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <FormField label="ราคาเสนอโครงการ">
                  {ed("priceProject") ? (
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-sm font-bold">฿</span>
                      <PillInput
                        type="number"
                        value={form.priceProject}
                        onChange={(e) => setForm({ ...form, priceProject: Number(e.target.value) })}
                        className="w-full pl-8 font-mono mono-numbers"
                      />
                    </div>
                  ) : (
                    <div className="px-4 py-3 rounded-2xl bg-white/15 border border-white/5 font-mono font-bold text-white">
                      ฿{form.priceProject.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  )}
                </FormField>

                <FormField label="ราคาขายปลีก">
                  {ed("pricePOS") ? (
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-sm font-bold">฿</span>
                      <PillInput
                        type="number"
                        value={form.pricePOS}
                        onChange={(e) => setForm({ ...form, pricePOS: Number(e.target.value) })}
                        className="w-full pl-8 font-mono mono-numbers"
                      />
                    </div>
                  ) : (
                    <div className="px-4 py-3 rounded-2xl bg-white/15 border border-white/5 font-mono font-bold text-white">
                      ฿{form.pricePOS.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  )}
                </FormField>

                <FormField label="ราคาส่ง">
                  {ed("priceWholesale") ? (
                    <PillInput inputMode="decimal" value={String(form.priceWholesale || "")} onChange={(e) => setForm({ ...form, priceWholesale: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })} className="w-full font-mono mono-numbers" />
                  ) : (
                    <div className="px-4 py-3 rounded-2xl bg-white/15 border border-white/5 font-mono font-bold text-white">฿{form.priceWholesale.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  )}
                </FormField>

                {/* ต้นทุนเฉลี่ยคำนวณจากการรับสินค้าเท่านั้น (แก้ตรงจะทำให้มูลค่าสต็อกไม่ตรงบัญชี) */}
                <FormField label="ต้นทุนเฉลี่ย (คำนวณอัตโนมัติ)">
                  <div className="px-4 py-3 rounded-2xl bg-white/15 border border-white/5 font-mono font-bold text-nexus-teal">
                    ฿{form.costWAC.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </FormField>
                {/* ราคากลาง (BOM) — ใช้คิดต้นทุนงานบริการแบบ BOM ก่อนต้นทุนเฉลี่ย · แก้ที่ คลัง › ราคากลาง */}
                {Number((product as any)?.refCost) > 0 && (() => { const rp = product as any; return (
                  <FormField label={`ราคากลาง BOM (${rp.bomCode || "-"})`}>
                    <Link href="/inventory/ref-prices" className={cn("block px-4 py-3 rounded-2xl bg-white/15 border border-white/5 font-mono font-bold hover:border-nexus-teal/40",
                      rp.refCostStatus === "Y" ? "text-danger" : rp.refCostStatus === "WEB" ? "text-nexus-blue" : "text-white")}
                      title={String(rp.refCostSource || "")} data-product-refcost>
                      ฿{Number(rp.refCost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      <span className="ml-2 text-[11px] font-normal text-white/50">{rp.refCostStatus === "Y" ? "ประมาณการ ต้องยืนยัน" : rp.refCostStatus === "WEB" ? "ราคาเว็บ" : "ไฟล์บริษัท"}{Number(rp.refCostPer) > 1 ? ` · 1 ${rp.unit} = ${rp.refCostPer} ${rp.refCostUnit}` : ""}</span>
                    </Link>
                  </FormField>
                ); })()}
              </div>

              {/* Margin Indicator */}
              <div className="col-span-full flex flex-col md:flex-row gap-4">
                <div className="flex-1 p-5 rounded-2xl bg-nexus-teal/5 border border-nexus-teal/15 flex flex-col items-center justify-center gap-2">
                  <span className="text-[11px] font-normal text-nexus-teal uppercase tracking-widest">Project Margin</span>
                  <div className={cn("text-3xl font-bold font-mono", margin >= 20 ? "text-nexus-teal" : margin >= 0 ? "text-warning" : "text-danger")}>
                    {margin}%
                  </div>
                  <span className="text-xs text-white/30 font-bold">
                    กำไรต่อหน่วย: ฿{(form.priceProject - form.costWAC).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex-1 p-5 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col items-center justify-center gap-2">
                  <span className="text-[11px] font-normal text-white/30 uppercase tracking-widest">มูลค่าคงคลังรวม</span>
                  <div className="text-2xl font-bold font-mono text-nexus-blue">
                    ฿{totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                  <span className="text-xs text-white/30 font-bold">
                    {form.onHand} {form.unit} x ฿{form.costWAC.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </GlassCard>
        )}

        {/* Tab: Stock Control */}
        {activeTab === "stock" && (
          <GlassCard className="p-4 border-white/5 bg-black/15 space-y-3">
            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
              <Box size={16} className="text-nexus-teal" />
              <h3 className="text-[12px] font-medium text-nexus-teal uppercase tracking-widest">
                การควบคุมระดับพัสดุ
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* ยอดคงเหลือ/ยอดจองเปลี่ยนผ่านการรับสินค้า เบิก หรือจองตามใบสั่งขายเท่านั้น (ไม่ให้แก้ตรง) */}
              <FormField label="ระดับสต็อกปัจจุบัน">
                <div className="px-4 py-3 rounded-2xl bg-nexus-teal/5 border border-nexus-teal/15 font-mono font-bold text-nexus-teal text-lg">
                  {form.onHand.toLocaleString()} {form.unit}
                </div>
              </FormField>

              <FormField label="ถูกจองใช้งาน">
                <div className="px-4 py-3 rounded-2xl bg-white/15 border border-white/5 font-mono font-bold text-warning text-lg">
                  {form.reserved.toLocaleString()} {form.unit}
                </div>
              </FormField>

              <FormField label="พร้อมใช้งาน">
                <div className="px-4 py-3 rounded-2xl bg-white/15 border border-white/5 font-mono font-bold text-nexus-blue text-lg">
                  {Math.max(0, form.onHand - form.reserved).toLocaleString()} {form.unit}
                </div>
              </FormField>

              <FormField label="จุดสั่งซื้อ (ใช้กับหน้าสั่งซื้อตามจุดสั่งซื้อ)">
                {ed("reorderPoint") ? (
                  <PillInput inputMode="numeric" value={String(form.reorderPoint || "")} onChange={(e) => setForm({ ...form, reorderPoint: Number(e.target.value.replace(/[^\d]/g, "")) || 0 })} className="w-full font-mono mono-numbers" />
                ) : (
                  <div className="px-4 py-3 rounded-2xl bg-white/15 border border-white/5 font-mono font-bold text-white/60">{form.reorderPoint ? `${form.reorderPoint} ${form.unit}` : "ยังไม่ตั้ง"}</div>
                )}
              </FormField>

              <FormField label="สต็อกสูงสุด (เติมให้ถึง)">
                {ed("maxStock") ? (
                  <PillInput inputMode="numeric" value={String(form.maxStock || "")} onChange={(e) => setForm({ ...form, maxStock: Number(e.target.value.replace(/[^\d]/g, "")) || 0 })} className="w-full font-mono mono-numbers" />
                ) : (
                  <div className="px-4 py-3 rounded-2xl bg-white/15 border border-white/5 font-mono font-bold text-white/60">{form.maxStock ? `${form.maxStock} ${form.unit}` : "ยังไม่ตั้ง"}</div>
                )}
              </FormField>

              <FormField label="ระดับแจ้งเตือนขั้นต่ำ">
                {ed("minStock") ? (
                  <PillInput
                    type="number"
                    value={form.minStock}
                    onChange={(e) => setForm({ ...form, minStock: Number(e.target.value) })}
                    className="w-full font-mono mono-numbers"
                  />
                ) : (
                  <div className="px-4 py-3 rounded-2xl bg-white/15 border border-white/5 font-mono font-bold text-white/60">
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
                <p className={cn("text-[12px] font-medium uppercase tracking-widest", isOut ? "text-danger" : isLow ? "text-warning" : "text-nexus-teal")}>
                  {stockLabel}
                </p>
                <p className="text-[11px] text-white/40 font-bold mt-0.5">
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
          <GlassCard className="p-0 overflow-hidden border-white/5 bg-black/15">
            <div className="p-4 border-b border-white/5 flex items-center gap-3">
              <Activity size={16} className="text-nexus-teal" />
              <h3 className="text-[12px] font-medium text-nexus-teal uppercase tracking-widest">
                ประวัติการเคลื่อนไหว
              </h3>
            </div>
            <NexusTable 
              headers={["เลขที่ธุรกรรม", "ประเภทธุรกรรม", "จำนวน", "เส้นทางจัดส่ง / โอนย้าย", "ผู้บันทึกรายการ"]}
              minWidth="min-w-[600px]"
            >
              {movements.length === 0 ? (
                <NexusTableRow>
                  <NexusTableCell colSpan={5} className="p-16 text-center text-white/20">
                    <span className="text-[12px] font-medium tracking-widest uppercase">ยังไม่มีประวัติการเคลื่อนไหว</span>
                  </NexusTableCell>
                </NexusTableRow>
              ) : (
                movements.map((move) => (
                  <NexusTableRow key={move.id}>
                    <NexusTableCell variant="code">{move.transactionId}</NexusTableCell>
                    <NexusTableCell align="center">
                      <StatusBadge
                        status={move.type === "IN" ? "active" : move.type === "OUT" ? "danger" : "pending"}
                        label={move.type}
                      />
                    </NexusTableCell>
                    <NexusTableCell mono className="w-20 text-right">{move.quantity}</NexusTableCell>
                    <NexusTableCell variant="text" className="font-mono text-[11px] text-white/40 uppercase">
                      {move.fromLocation || "EXTERNAL"} &rarr; {move.toLocation || "MAIN-WH"}
                    </NexusTableCell>
                    <NexusTableCell variant="text" className="text-xs font-semibold text-white/50">{move.userId || "System"}</NexusTableCell>
                  </NexusTableRow>
                ))
              )}
            </NexusTable>
          </GlassCard>
        )}
      </div>
    </div>
  );

  const rightSidebar = (
    <div className="space-y-3">
      {/* Quick Stats Card */}
      <GlassCard className="p-4 border-white/5 space-y-5">
        <div className="flex items-center gap-2 border-b border-white/5 pb-3">
          <ShieldCheck size={14} className="text-nexus-teal" />
          <h4 className="text-sm font-medium text-nexus-teal uppercase tracking-widest">สรุปข้อมูลสินค้า</h4>
          {!isEditMode && (
            <span className="ml-auto flex items-center gap-1 text-sm text-white/20 font-normal uppercase">
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
            <span className="text-sm font-medium text-white/30 uppercase tracking-widest block">ON HAND</span>
            <span className="text-lg font-medium text-nexus-teal mt-1 block mono-numbers">{form.onHand}</span>
          </div>
          <div className="p-3 rounded-xl bg-white/15 border border-white/10 text-center">
            <span className="text-sm font-medium text-white/30 uppercase tracking-widest block">RESERVED</span>
            <span className="text-lg font-medium text-warning mt-1 block mono-numbers">{form.reserved}</span>
          </div>
        </div>
      </GlassCard>

      {/* คุณลักษณะเฉพาะเป็นข้อ ๆ (AI อ่าน datasheet ได้) — ใช้ในร่าง TOR */}
      <SpecItemsCard product={product} />

      {/* เอกสารประกอบสินค้า (datasheet คู่มือ ใบรับรอง) — ทุกคนที่ดูสินค้าได้เปิดดูได้ แนบ/ลบโดยผู้มีสิทธิ์คลังสินค้า */}
      <GlassCard className="p-4 border-white/5 space-y-3">
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-nexus-teal" />
          <h4 className="text-[12px] font-bold text-white/80 uppercase tracking-widest">เอกสารประกอบสินค้า</h4>
        </div>
        <AttachmentPicker ownerType="product" ownerId={productId} hint="Datasheet คู่มือ ใบรับรอง (PDF หรือรูป) · คลิกไฟล์เพื่อเปิดดู" />
      </GlassCard>

      {/* ผู้ขายสินค้านี้ (ผูกจากหน้าผู้ขาย › สินค้าที่ขาย) */}
      <ProductSuppliersBox config={(product as any).supplierConfig} />

      {/* ราคาทุนแต่ละล็อตที่รับเข้า เทียบต้นทุนเฉลี่ย */}
      {companyId && String((product as any).itemType || "").toUpperCase() === "SERVICE"
        ? <div id="service-recipe" className="scroll-mt-4"><ServiceRecipeCard companyId={companyId} product={product} canEdit={can(roles, "inventory:edit")} /></div>
        : companyId && <><ProductLotsCard companyId={companyId} productId={productId} unit={(product as any).unit} /><ProductCostHistory companyId={companyId} productId={productId} /></>}

      {/* Actions Card */}
      <GlassCard className="p-4 border-white/5 space-y-3">
        <h4 className="text-sm font-medium text-white/30 uppercase tracking-widest">การดำเนินการด่วน</h4>
        {(canFull || canSalesInfo) && (
          <PillButton
            className="w-full text-xs shadow-neon-teal"
            onClick={() => { setActiveTab("overview"); setIsEditMode(true); }}
            disabled={isEditMode}
          >
            <Edit3 size={14} /> {canFull ? "แก้ไขข้อมูลสินค้า" : "แก้ไขรายละเอียด/สเปก"}
          </PillButton>
        )}
        <PillButton
          variant="glass"
          className="w-full text-xs border-nexus-blue/20 text-nexus-blue hover:"
          onClick={() => setActiveTab("history")}
        >
          <History size={14} /> ดูประวัติการเคลื่อนไหว
        </PillButton>
        <PillButton
          variant="glass"
          className="w-full text-xs border-white/5 hover:"
          onClick={() => router.back()}
        >
          <ChevronLeft size={14} /> กลับหน้าคลังพัสดุ
        </PillButton>
      </GlassCard>

      {/* Margin Indicator (when on pricing tab) */}
      {activeTab === "pricing" && (
        <GlassCard className="p-4 border-nexus-teal/10 bg-nexus-teal/5 space-y-2 text-center">
          <span className="text-sm font-normal text-nexus-teal uppercase tracking-widest block">Project Gross Margin</span>
          <div className={cn("text-4xl font-medium font-mono", margin >= 20 ? "text-nexus-teal" : margin >= 0 ? "text-warning" : "text-danger")}>
            {margin}%
          </div>
          <span className="text-sm text-white/40 font-medium block">
            กำไรต่อหน่วย: ฿{(form.priceProject - form.costWAC).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
        </GlassCard>
      )}
    </div>
  );

  return (
    <>
      <NexusPageLayout
        header={headerContent}
        leftContent={leftContent}
        rightSidebar={rightSidebar}
      />
      <Toast
        message={toast.message}
        isVisible={toast.isVisible}
        type={toast.type}
        onClose={() => setToast((prev) => ({ ...prev, isVisible: false }))}
      />
    </>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-white/30 uppercase tracking-widest ml-1 block">
        {label}
      </label>
      {children}
    </div>
  );
}
