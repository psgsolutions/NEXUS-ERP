"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  Package, 
  ShieldCheck, 
  Truck,
  Plus, 
  MapPin,
  FileText,
  Search,
  ArrowLeft,
  AlertCircle,
  FileSpreadsheet,
  Boxes,
  Sliders,
  DollarSign,
  X,
  CheckCircle2
} from "lucide-react";
import { 
  PillButton, 
  PillInput, 
  PillTabs,
  NexusDataField,
  GlassCard,
  cn,
  Modal
} from "@/components/ui/Base";
import { SmartSelect, StepperInput } from "@/components/ui/SmartComponents";
import { useInventory } from "@/hooks/useInventory";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { apiFetch } from "@/lib/api-client";
import { saveToFirestore } from "@/lib/firebaseUtils";
import { Warehouse3D } from "@/components/inventory/Warehouse3D";
import { useSystemDialog } from "@/context/DialogContext";
import { SmartScanner } from "@/components/shared/SmartScanner";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { UomHierarchyBuilder } from "@/components/inventory/UomHierarchyBuilder";
import { SupplierMatrix } from "@/components/inventory/SupplierMatrix";
import { DocumentVaultUploader, DigitalDocumentItem } from "@/components/shared/DocumentVaultUploader";
import { ProductConversion, ProductSupplierInfo } from "@/types/inventory";
import { getRequiredFieldsStatus, checkSkuDuplicate, findBarcodeConflict } from "@/lib/product-validation";

const INITIAL_FORM_DATA = {
  // 1. Identification & Classification
  sku: "",
  productCode: "",
  barcode: "",
  name: "",
  category: "",
  subCategory: "",
  brand: "",
  model: "",
  subModel: "",
  productType: "",
  lifecycleStatus: "",
  
  // 2. Accounting & Financial Dimension
  taxType: "",
  glIncomeAccount: "",
  glCogsAccount: "",
  glInventoryAccount: "",

  // 3. UOM & Packaging Hierarchy
  packageUnit: "",
  baseUnit: "",
  conversionRate: 1,
  conversions: [] as ProductConversion[],

  // 4. Pricing & Costing
  cost: 0,
  price: 0,
  priceProject: 0,
  priceWholesale: 0,
  minimumFloorPrice: 0,

  // 5. Supply Chain & Procurement
  supplierId: "",
  supplierSku: "",
  mpn: "",
  leadTimeDays: null as number | null,
  supplierConfig: [] as ProductSupplierInfo[],
  qty: null as number | null,
  reorderPoint: null as number | null,
  minStock: null as number | null,
  maxStock: null as number | null,
  warehouseId: "",
  rackLocation: "",

  // 6. Traceability & Technical Specs
  isSerialized: false,
  isBatchTracked: false,
  isExpiryTracked: false,
  sns: "",
  weightKg: null as number | null,
  dimensionW: null as number | null,
  dimensionL: null as number | null,
  dimensionH: null as number | null,
  technicalSpecs: "",
  documents: [] as DigitalDocumentItem[],
  aliases: "",
  accessories: "",

  // Media & Ref
  imageUrl: "",
  poRef: ""
};

const computeNextSku = (existingProducts: any[], extraSkus: string[] = []) => {
  const now = new Date();
  const yy = now.getFullYear().toString().slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `PRD-${yy}${mm}-`;

  let nextNum = 1;
  const allSkus = [
    ...(existingProducts || []).map(p => p?.sku),
    ...extraSkus
  ].filter(sku => sku && typeof sku === "string" && sku.startsWith(prefix));

  if (allSkus.length > 0) {
    const numbers = allSkus.map(sku => {
      const parts = sku.split("-");
      const lastPart = parts[parts.length - 1];
      const num = parseInt(lastPart, 10);
      return isNaN(num) ? 0 : num;
    });
    const maxNum = Math.max(...numbers, 0);
    nextNum = maxNum + 1;
  }

  return `${prefix}${String(nextNum).padStart(3, "0")}`;
};

export default function NewProductPage() {
  const router = useRouter();
  const { showAlert, showConfirm } = useSystemDialog();
  const { products } = useInventory();
  const { user, companyId } = useAuth();
  
  const [submitting, setSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const [sourceMode, setSourceMode] = useState("manual");
  const [poItems, setPoItems] = useState<any[]>([]);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const [formData, setFormData] = useState(INITIAL_FORM_DATA);

  const { data: suppliers } = useRealtimeCollection("suppliers");
  const { data: warehouses } = useRealtimeCollection("warehouses");

  const INITIAL_CATEGORIES = [
    { value: "general", label: "ทั่วไป" },
    { value: "network-server", label: "ระบบเครือข่ายและเซิร์ฟเวอร์" },
    { value: "computer", label: "คอมพิวเตอร์และอุปกรณ์" },
    { value: "wires-cables", label: "สายไฟและสายสัญญาณ" },
    { value: "switches", label: "สวิตช์และเต้ารับ" },
    { value: "breakers", label: "เบรกเกอร์และตู้ไฟ" },
    { value: "lighting", label: "หลอดไฟและโคมไฟ" },
    { value: "conduits", label: "ท่อร้อยสายไฟและข้อต่อ" },
    { value: "cctv", label: "กล้องวงจรปิดและกันขโมย" },
    { value: "audio", label: "เครื่องเสียงและระบบประกาศ" },
    { value: "ups", label: "เครื่องสำรองไฟ" },
    { value: "tools", label: "เครื่องมือช่างและฮาร์ดแวร์" },
    { value: "software", label: "ซอฟต์แวร์" },
    { value: "service", label: "บริการและซ่อมบำรุง" },
    { value: "kit", label: "ชุดงานติดตั้ง" },
  ];

  const INITIAL_BRANDS = [
    { value: "NEXUS", label: "NEXUS (แบรนด์หลัก)" },
    { value: "Hikvision", label: "Hikvision" },
    { value: "Dahua", label: "Dahua" },
    { value: "Aruba", label: "Aruba" },
    { value: "Cisco", label: "Cisco" },
    { value: "Link", label: "Link" },
    { value: "Schneider", label: "Schneider Electric" },
    { value: "Panasonic", label: "Panasonic" },
    { value: "General", label: "ทั่วไป / ไม่ระบุ" },
  ];

  const INITIAL_UOMS = [
    { value: "ชิ้น", label: "ชิ้น" },
    { value: "เครื่อง", label: "เครื่อง" },
    { value: "กล่อง", label: "กล่อง" },
    { value: "ลัง", label: "ลัง" },
    { value: "แพ็ค", label: "แพ็ค" },
    { value: "ม้วน", label: "ม้วน" },
    { value: "ขด", label: "ขด" },
    { value: "เมตร", label: "เมตร" },
    { value: "เส้น", label: "เส้น" },
    { value: "หลอด", label: "หลอด" },
    { value: "โคม", label: "โคม" },
    { value: "ใบ", label: "ใบ" },
    { value: "ชุด", label: "ชุด" },
    { value: "งาน", label: "งาน" },
  ];

  const [categoriesList, setCategoriesList] = useState(INITIAL_CATEGORIES);
  const [brandOptions, setBrandOptions] = useState(INITIAL_BRANDS);
  const [uomOptions, setUomOptions] = useState(INITIAL_UOMS);

  // Load custom saved options from localStorage on mount
  useEffect(() => {
    try {
      const savedCats = localStorage.getItem("nexus_custom_categories");
      if (savedCats) {
        const parsed: string[] = JSON.parse(savedCats);
        setCategoriesList(prev => {
          const existingValues = new Set(prev.map(c => c.value));
          const newOpts = parsed.filter(c => !existingValues.has(c)).map(c => ({ value: c, label: c }));
          return [...prev, ...newOpts];
        });
      }

      const savedBrands = localStorage.getItem("nexus_custom_brands");
      if (savedBrands) {
        const parsed: string[] = JSON.parse(savedBrands);
        setBrandOptions(prev => {
          const existingValues = new Set(prev.map(b => b.value));
          const newOpts = parsed.filter(b => !existingValues.has(b)).map(b => ({ value: b, label: b }));
          return [...prev, ...newOpts];
        });
      }

      const savedUoms = localStorage.getItem("nexus_custom_uoms");
      if (savedUoms) {
        const parsed: string[] = JSON.parse(savedUoms);
        setUomOptions(prev => {
          const existingValues = new Set(prev.map(u => u.value));
          const newOpts = parsed.filter(u => !existingValues.has(u)).map(u => ({ value: u, label: u }));
          return [...prev, ...newOpts];
        });
      }
    } catch (e) {
      console.error("Error loading custom options:", e);
    }
  }, []);

  const handleCreateCategory = (newCat: string) => {
    if (!newCat.trim()) return;
    const catVal = newCat.trim();
    setCategoriesList(prev => {
      if (prev.some(c => c.value.toLowerCase() === catVal.toLowerCase())) return prev;
      const updated = [...prev, { value: catVal, label: catVal }];
      try {
        const customOnly = updated.filter(c => !INITIAL_CATEGORIES.some(ic => ic.value === c.value)).map(c => c.value);
        localStorage.setItem("nexus_custom_categories", JSON.stringify(customOnly));
      } catch (e) {}
      return updated;
    });
    setFormData(prev => ({ ...prev, category: catVal }));
  };

  const handleCreateBrand = (newBrand: string) => {
    if (!newBrand.trim()) return;
    const brandVal = newBrand.trim();
    setBrandOptions(prev => {
      if (prev.some(b => b.value.toLowerCase() === brandVal.toLowerCase())) return prev;
      const updated = [...prev, { value: brandVal, label: brandVal }];
      try {
        const customOnly = updated.filter(b => !INITIAL_BRANDS.some(ib => ib.value === b.value)).map(b => b.value);
        localStorage.setItem("nexus_custom_brands", JSON.stringify(customOnly));
      } catch (e) {}
      return updated;
    });
    setFormData(prev => ({ ...prev, brand: brandVal }));
  };

  const handleCreateUom = (newUom: string) => {
    if (!newUom.trim()) return;
    const uomVal = newUom.trim();
    setUomOptions(prev => {
      if (prev.some(u => u.value.toLowerCase() === uomVal.toLowerCase())) return prev;
      const updated = [...prev, { value: uomVal, label: uomVal }];
      try {
        const customOnly = updated.filter(u => !INITIAL_UOMS.some(iu => iu.value === u.value)).map(u => u.value);
        localStorage.setItem("nexus_custom_uoms", JSON.stringify(customOnly));
      } catch (e) {}
      return updated;
    });
  };

  const productTypeOptions = [
    { value: "PHYSICAL", label: "สินค้าทั่วไป (Physical Item)" },
    { value: "SERVICE", label: "งานบริการ (Service Item)" },
    { value: "ASSET", label: "สินทรัพย์ (Asset Item)" },
    { value: "BOM", label: "ชุดประกอบ (BOM Bundle)" },
  ];

  const lifecycleStatusOptions = [
    { value: "ACTIVE", label: "ใช้งานปกติ (Active)" },
    { value: "DRAFT", label: "บันทึกร่าง (Draft)" },
    { value: "PHASE_OUT", label: "ทยอยยกเลิก (Phase Out)" },
  ];

  const taxTypeOptions = [
    { value: "VAT_7", label: "ภาษีมูลค่าเพิ่ม 7%" },
    { value: "NON_VAT", label: "ภาษี 0%" },
    { value: "EXEMPT", label: "ยกเว้นภาษี" },
  ];

  const glIncomeOptions = [
    { value: "4110-01", label: "4110-01 : รายได้จากการขายสินค้า" },
    { value: "4120-01", label: "4120-01 : รายได้จากการให้บริการ" },
  ];

  const glCogsOptions = [
    { value: "5110-01", label: "5110-01 : ต้นทุนขายสินค้า" },
    { value: "5120-01", label: "5120-01 : ต้นทุนการให้บริการ" },
  ];

  const glInventoryOptions = [
    { value: "1140-01", label: "1140-01 : สินค้าคงเหลือ" },
    { value: "1140-02", label: "1140-02 : วัตถุดิบและอุปกรณ์" },
  ];

  const [isPriceManuallyEdited, setIsPriceManuallyEdited] = useState(false);
  const [show3DPicker, setShow3DPicker] = useState(false);
  const [showSubCategory, setShowSubCategory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setFormData(prev => ({ ...prev, imageUrl: url }));
    }
  };

  const handleCostChange = (val: number) => {
    setFormData(prev => {
      const newData = { ...prev, cost: val };
      if (!isPriceManuallyEdited) {
        newData.price = Number((val / 0.8).toFixed(2));
        newData.priceProject = Number((val / 0.75).toFixed(2));
      }
      return newData;
    });
    if (errors.cost && val >= 0) {
      setErrors(prev => ({ ...prev, cost: "" }));
    }
  };

  const handlePriceChange = (val: number) => {
    setIsPriceManuallyEdited(true);
    setFormData(prev => ({ ...prev, price: val }));
    if (errors.price && val >= 0) {
      setErrors(prev => ({ ...prev, price: "" }));
    }
  };

  // Generate SKU on mount
  useEffect(() => {
    const generatedSku = computeNextSku(products);
    setFormData(prev => ({
      ...prev,
      sku: prev.sku || generatedSku
    }));
  }, [products]);

  const isFormDirty = () => {
    return (
      formData.name.trim() !== "" ||
      formData.category !== "" ||
      formData.brand !== "" ||
      formData.model !== "" ||
      formData.subModel !== "" ||
      formData.barcode !== "" ||
      formData.cost > 0 ||
      formData.price > 0 ||
      formData.poRef !== "" ||
      formData.technicalSpecs !== "" ||
      formData.aliases !== "" ||
      formData.accessories !== "" ||
      poItems.length > 0
    );
  };

  const handleCancel = async () => {
    if (isFormDirty()) {
      const confirmed = await showConfirm(
        "คุณมีข้อมูลที่ยังไม่ได้บันทึก ต้องการยกเลิกและออกจากหน้านี้ใช่หรือไม่?",
        "ยืนยันการยกเลิก"
      );
      if (confirmed) {
        router.push("/inventory");
      }
    } else {
      router.push("/inventory");
    }
  };

  const profit = formData.price - formData.cost;
  const profitMargin = formData.price > 0 ? ((profit / formData.price) * 100).toFixed(1) : "0.0";
  const initialQty = (formData.qty && formData.qty > 0) ? formData.qty : 0;
  const totalCost = sourceMode === "manual" 
    ? (initialQty * (formData.cost || 0))
    : poItems.reduce((acc, item) => acc + (item.qtyReceived * (item.cost || 0)), 0);

  // รับสินค้าจากใบสั่งซื้อทำที่หน้ารับสินค้าเข้าคลัง (ผ่าน stock engine + ลงบัญชี)
  const fetchPOItems = () => {
    router.push("/inventory/in/new");
  };

  const updatePoItem = (id: string, field: string, value: any) => {
    setPoItems(poItems.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const barcodeConflict = React.useMemo(
    () => findBarcodeConflict(formData.barcode, products || [], companyId || ""),
    [formData.barcode, products, companyId]
  );

  const isSkuDuplicate = React.useMemo(() => {
    return checkSkuDuplicate(formData.sku, products || [], companyId || "");
  }, [formData.sku, products, companyId]);

  const requiredStatus = React.useMemo(() => {
    return getRequiredFieldsStatus(formData);
  }, [formData]);

  const scrollToField = (fieldId: string) => {
    const el = document.getElementById(fieldId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => {
        const input = el.querySelector("input, select, textarea, button") as HTMLElement | null;
        if (input) {
          input.focus();
        }
      }, 200);
    }
  };

  const skuStatusDisplay = React.useMemo(() => {
    if (!formData.sku?.trim()) {
      return {
        label: "รอระบุ",
        variant: "bg-white/10 text-white/50 border-white/10"
      };
    }
    if (isSkuDuplicate) {
      return {
        label: "รหัสซ้ำ",
        variant: "bg-rose-500/20 text-rose-400 border-rose-500/40"
      };
    }
    return {
      label: "รหัสไม่ซ้ำ",
      variant: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
    };
  }, [formData.sku, isSkuDuplicate]);

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};
    const reqStatus = getRequiredFieldsStatus(formData);

    for (const missing of reqStatus.missingFields) {
      if (missing.key === "name") newErrors.name = "กรุณาระบุชื่อสินค้า";
      if (missing.key === "category") newErrors.category = "กรุณาระบุหมวดหมู่หลัก";
      if (missing.key === "cost") newErrors.cost = "ราคาต้นทุนต้องมากกว่า 0";
      if (missing.key === "price") newErrors.price = "ราคาขายต้องมากกว่า 0";
      if (missing.key === "warehouseId") newErrors.warehouseId = "กรุณาระบุคลังสินค้าเมื่อมียอดยกมา";
    }

    if (isSkuDuplicate) {
      newErrors.sku = "รหัสสินค้านี้มีอยู่ในระบบแล้ว";
    }

    if (barcodeConflict) {
      newErrors.barcode = `บาร์โค้ดซ้ำกับ ${barcodeConflict}`;
    }

    // Validation for inventory level hierarchy: ขั้นต่ำ <= จุดสั่งซื้อ <= สูงสุด
    const minVal = formData.minStock;
    const reorderVal = formData.reorderPoint;
    const maxVal = formData.maxStock;

    if (minVal !== null && minVal !== undefined && reorderVal !== null && reorderVal !== undefined) {
      if (minVal > reorderVal) {
        newErrors.minStock = "สต็อกขั้นต่ำต้องไม่เกินจุดสั่งซื้อ";
        newErrors.reorderPoint = "จุดสั่งซื้อต้องไม่ต่ำกว่าสต็อกขั้นต่ำ";
      }
    }

    if (reorderVal !== null && reorderVal !== undefined && maxVal !== null && maxVal !== undefined) {
      if (reorderVal > maxVal) {
        newErrors.reorderPoint = "จุดสั่งซื้อต้องไม่เกินสต็อกสูงสุด";
        newErrors.maxStock = "สต็อกสูงสุดต้องไม่ต่ำกว่าจุดสั่งซื้อ";
      }
    }

    if (minVal !== null && minVal !== undefined && maxVal !== null && maxVal !== undefined) {
      if (minVal > maxVal) {
        newErrors.minStock = "สต็อกขั้นต่ำต้องไม่เกินสต็อกสูงสุด";
        newErrors.maxStock = "สต็อกสูงสุดต้องไม่ต่ำกว่าสต็อกขั้นต่ำ";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (saveAndContinue = false) => {
    if (isSubmittingRef.current || submitting) return;
    if (!companyId || !user) return;
    
    if (sourceMode === "manual") {
      if (!validateForm()) {
        showAlert("กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน");
        return;
      }
    }

    isSubmittingRef.current = true;
    setSubmitting(true);
    
    try {
      if (sourceMode === "manual") {
        const prodId = `PROD-${Date.now()}`;
        const initialQty = (formData.qty && formData.qty > 0) ? formData.qty : 0;
        const totalQty = initialQty * (formData.conversionRate || 1);
        const savedSku = formData.sku;

        const saveOp = async () => {
          const productData = {
            sku: formData.sku,
            productCode: formData.productCode || formData.sku,
            barcode: formData.barcode,
            barcodes: formData.barcode ? [formData.barcode] : [],
            name: formData.name,
            productName: formData.name,
            category: formData.category || "general",
            subCategory: formData.subCategory || "",
            brand: formData.brand || "NEXUS",
            model: formData.model || "",
            mainModel: formData.model || "",
            subModel: formData.subModel || "",
            productType: formData.productType || "PHYSICAL",
            lifecycleStatus: formData.lifecycleStatus || "ACTIVE",
            taxType: formData.taxType || "VAT_7",
            vatType: formData.taxType || "VAT_7",
            glIncomeAccount: formData.glIncomeAccount || "4110-01",
            glCogsAccount: formData.glCogsAccount || "5110-01",
            glInventoryAccount: formData.glInventoryAccount || "1140-01",
            unit: formData.baseUnit || "ชิ้น",
            baseUnit: formData.baseUnit || "ชิ้น",
            packageUnit: formData.packageUnit || "ชิ้น",
            purchaseUnit: formData.packageUnit || "ชิ้น",
            conversionRate: formData.conversionRate,
            conversionFactor: formData.conversionRate,
            conversions: formData.conversions.length > 0 ? formData.conversions : [
              {
                toUnit: formData.packageUnit || "ชิ้น",
                relativeRate: formData.conversionRate,
                relativeToUnit: formData.baseUnit || "ชิ้น",
                rateToBase: formData.conversionRate,
                barcode: formData.barcode
              }
            ],
            warehouseId: formData.warehouseId || "WH-01",
            rackLocation: formData.rackLocation || "",
            warehouseLocation: formData.rackLocation ? `${formData.warehouseId || "WH-01"}:${formData.rackLocation}` : (formData.warehouseId || "WH-01"),
            supplierId: formData.supplierId || "",
            supplierConfig: formData.supplierConfig.length > 0 ? formData.supplierConfig : [
              {
                supplierId: formData.supplierId,
                supplierSku: formData.supplierSku,
                mpn: formData.mpn,
                latestCost: formData.cost,
                leadTimeDays: formData.leadTimeDays,
                isPrimary: true
              }
            ],
            inventoryControl: {
              reorderPoint: formData.reorderPoint ?? 0,
              minStock: formData.minStock ?? 0,
              maxStock: formData.maxStock ?? 0,
              orderUnit: formData.packageUnit
            },
            imageUrl: formData.imageUrl || "",
            stockStatus: {
              onHand: totalQty,
              reserved: 0,
              available: totalQty
            },
            pricing: {
              costWAC: formData.cost,
              pricePOS: formData.price,
              priceProject: formData.priceProject || formData.price * 1.2,
              priceWholesale: formData.priceWholesale || formData.price * 0.9,
              minimumFloorPrice: formData.minimumFloorPrice || formData.cost * 1.05
            },
            costPrice: formData.cost,
            unitPrice: formData.price,
            wholesalePrice: formData.priceWholesale || formData.price * 0.9,
            isSerialized: formData.isSerialized,
            isSerialTracked: formData.isSerialized,
            isBatchTracked: formData.isBatchTracked,
            isExpiryTracked: formData.isExpiryTracked,
            weightKg: formData.weightKg,
            dimensions: {
              w: formData.dimensionW,
              l: formData.dimensionL,
              h: formData.dimensionH
            },
            technicalSpecs: formData.technicalSpecs,
            aliases: formData.aliases ? [{ type: "CUSTOMER", name: formData.aliases }] : [],
            accessories: formData.accessories ? formData.accessories.split(",").map(a => a.trim()) : [],
          };
          // สต็อกและต้นทุนเริ่มต้นไม่เขียนตรง: ส่งเป็นยอดยกมาให้ server รับเข้าผ่าน stock engine
          const { stockStatus: _s, ...withoutStock } = productData as any; void _s;
          const res = await apiFetch("/api/master-data", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ companyId, action: "create", entity: "products", id: prodId, data: withoutStock, openingStock: { qty: totalQty, unitCost: formData.cost || 0 } }),
          });
          const d = await res.json();
          if (!res.ok || !d.success) throw new Error(d.error || "บันทึกสินค้าไม่สำเร็จ");
        };
        await saveToFirestore(saveOp());
        showAlert("เพิ่มสินค้าใหม่เข้าสู่ระบบเรียบร้อยแล้ว");

        if (saveAndContinue) {
          const nextSku = computeNextSku(products, [savedSku]);
          setFormData({
            ...INITIAL_FORM_DATA,
            sku: nextSku
          });
          setErrors({});
          setPoItems([]);
          return;
        }

      } else {
        // รับสินค้าจากใบสั่งซื้อทำที่หน้ารับสินค้าเข้าคลัง (ตัดสต็อก ต้นทุนเฉลี่ย และลงบัญชีที่ server)
        setSubmitting(false);
        isSubmittingRef.current = false;
        router.push("/inventory/in/new");
        return;
      }

      router.push("/inventory");
    } catch (error: any) {
      console.error("APO Product Save Alert:", error);
      showAlert(error?.message || "ล้มเหลวในการบันทึกข้อมูลสินค้า", "บันทึกไม่สำเร็จ", "error");
    } finally {
      isSubmittingRef.current = false;
      setSubmitting(false);
    }
  };

  const headerContent = (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-6 rounded-3xl backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <PillButton variant="glass" onClick={handleCancel} className="w-10 h-10 p-0 flex items-center justify-center">
          <ArrowLeft size={20} />
        </PillButton>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-white uppercase tracking-tight">
              เพิ่มข้อมูลสินค้าใหม่
            </h1>
            <span className="px-3 py-1 rounded-full bg-nexus-teal/10 border border-nexus-teal/30 text-nexus-teal text-sm font-mono font-bold select-none cursor-default pointer-events-none">
              PROD-NEW
            </span>
          </div>
          <p className="text-sm text-white/60 font-medium mt-1">
            ลงทะเบียนข้อมูลสินค้า กำหนดรหัสสินค้า SKU บาร์โค้ด หมวดหมู่ และการควบคุมสต็อก
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
        <PillTabs 
          tabs={[
            { id: "manual", label: "คีย์สินค้าเข้าระบบ", icon: <Package size={14} /> },
            { id: "po", label: "รับจากคำสั่งซื้อ", icon: <Truck size={14} /> }
          ]} 
          activeTab={sourceMode} 
          onTabChange={(tab: string) => tab === "po" ? router.push("/inventory/in/new") : setSourceMode(tab)}
        />
      </div>
    </div>
  );

  const warehouseOptions = warehouses?.map(wh => ({ value: wh.id, label: wh.name })) || [
    { value: "WH-01", label: "คลังสินค้าหลัก (WH-01)" }
  ];

  const supplierOptions = suppliers?.map(s => ({ value: s.id, label: s.name })) || [];

  const leftContent = (
    <div className="space-y-3.5 pr-1 pb-10">
      {sourceMode === "manual" ? (
        <div className="space-y-3.5">
          {/* ROW 1: Card 1 (ซ้าย) & Card 2 (ขวา) */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5 items-start">
            {/* CARD 1: ข้อมูลหลัก หมวดหมู่ และผังบัญชี */}
            <GlassCard accentColor="teal" className="p-4 space-y-3.5 animate-in fade-in duration-300 relative overflow-visible">
              <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/20">
                    <Package size={14} />
                  </div>
                  <div>
                    <h3 className="text-[13px] font-bold text-white uppercase tracking-wider">1. ข้อมูลหลัก หมวดหมู่ และผังบัญชี</h3>
                  </div>
                </div>
                <SmartScanner 
                  type="product_label"
                  buttonLabel="สแกนฉลาก"
                  onDataExtracted={(data) => {
                    setFormData(prev => ({
                      ...prev,
                      name: data.name || prev.name,
                      barcode: data.model || prev.barcode,
                    }));
                  }}
                />
              </div>

              {/* BROW 1 & 2: รูปภาพสินค้า (สี่เหลี่ยมด้านเท่า สูงเท่ากับ 2 บรรทัด) | (รหัสสินค้า-ชื่อสินค้ามาตรฐาน) | (บาร์โค้ด-หมวดหมู่หลัก-หมวดหมู่ย่อย) */}
              <div className="flex gap-3 items-stretch">
                {/* ช่องใส่รูปภาพ (สี่เหลี่ยมด้านเท่า สูงเท่ากับ 2 บรรทัด = 104px) */}
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-[104px] h-[104px] aspect-square rounded-xl bg-white/[0.02] border border-dashed border-white/20 flex flex-col items-center justify-center text-white/30 hover:border-nexus-teal hover:text-nexus-teal cursor-pointer transition-colors shrink-0 overflow-hidden relative group self-center"
                  title="แนบรูปสินค้า"
                >
                  {formData.imageUrl ? (
                    <>
                      <img src={formData.imageUrl} alt="รูปสินค้า" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <span className="text-[10px] font-semibold uppercase text-white">เปลี่ยนรูป</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <Plus size={18} className="mb-0.5 text-nexus-teal" />
                      <span className="text-[9px] font-bold uppercase tracking-wider text-white/60">แนบรูป</span>
                    </>
                  )}
                </div>
                <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />

                <div className="flex-1 space-y-2 flex flex-col justify-between">
                  {/* บรรทัดที่ 1: รหัสสินค้า - ชื่อสินค้ามาตรฐาน */}
                  <div className="flex flex-wrap gap-2 items-end">
                    <div className="w-[130px] shrink-0">
                      <Field label="รหัสสินค้า">
                        <PillInput 
                          value={formData.sku} 
                          readOnly 
                          disabled
                          tabIndex={-1}
                          className="w-full h-8 px-3 rounded-full bg-white/5 border-white/5 text-nexus-teal/70 font-black cursor-default opacity-70 font-mono text-center pointer-events-none select-none text-[12px]" 
                        />
                      </Field>
                    </div>
                    
                    <div id="field-product-name" className="flex-1 min-w-[170px]">
                      <Field label="ชื่อสินค้ามาตรฐาน" required error={errors.name}>
                        <PillInput 
                          value={formData.name} 
                          onChange={(e) => {
                            setFormData(prev => ({ ...prev, name: e.target.value }));
                            if (errors.name) setErrors(prev => ({ ...prev, name: "" }));
                          }} 
                          className={cn("w-full h-8 px-3 rounded-full text-[12px]", errors.name && "border-danger focus:ring-danger")} 
                          placeholder="ระบุชื่อสินค้า ยี่ห้อ รุ่น และสเปก..." 
                        />
                      </Field>
                    </div>
                  </div>

                  {/* บรรทัดที่ 2: บาร์โค้ด - หมวดหมู่หลัก - (หมวดหมู่ย่อย) */}
                  <div className="flex flex-wrap gap-2 items-end">
                    <div className="w-[130px] shrink-0">
                      <Field label="บาร์โค้ด" error={errors.barcode || (barcodeConflict ? `ซ้ำกับ ${barcodeConflict}` : undefined)}>
                        <PillInput
                          value={formData.barcode}
                          onChange={(e) => setFormData(prev => ({ ...prev, barcode: e.target.value }))} 
                          className="w-full h-8 px-3 rounded-full font-mono text-center text-[12px] placeholder:text-center" 
                          placeholder="สแกนบาร์โค้ด..." 
                        />
                      </Field>
                    </div>

                    <div id="field-product-category" className="flex-1 min-w-[130px]">
                      <Field label="หมวดหมู่หลัก" required error={errors.category}>
                        <SmartSelect
                          options={categoriesList}
                          value={formData.category}
                          onChange={(val) => {
                            setFormData(prev => ({ ...prev, category: val }));
                            if (errors.category) setErrors(prev => ({ ...prev, category: "" }));
                          }}
                          onCreateOption={handleCreateCategory}
                          placeholder="เลือกหมวดหมู่..."
                        />
                      </Field>
                    </div>

                    {showSubCategory || formData.subCategory ? (
                      <div className="flex-1 min-w-[120px]">
                        <Field label="หมวดหมู่ย่อย">
                          <div className="relative">
                            <PillInput
                              value={formData.subCategory}
                              onChange={(e) => setFormData(prev => ({ ...prev, subCategory: e.target.value }))}
                              placeholder="ระบุหมวดหมู่ย่อย..."
                              className="w-full h-8 px-3 pr-7 rounded-full text-[12px]"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setShowSubCategory(false);
                                setFormData(prev => ({ ...prev, subCategory: "" }));
                              }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-rose-400 p-0.5 transition-colors"
                              title="ซ่อนหมวดหมู่ย่อย"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        </Field>
                      </div>
                    ) : (
                      <div className="flex items-center pb-0.5">
                        <button
                          type="button"
                          onClick={() => setShowSubCategory(true)}
                          title="เพิ่มหมวดหมู่ย่อย"
                          className="group/btn relative w-8 h-8 rounded-full bg-white/[0.04] border border-white/10 hover:bg-nexus-teal/10 hover:border-nexus-teal/40 hover:text-nexus-teal text-white/60 transition-all flex items-center justify-center shrink-0"
                        >
                          <Plus size={14} />
                          <span className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 hidden group-hover/btn:flex items-center bg-gray-900/95 text-white text-[10px] font-medium px-2 py-1 rounded-md shadow-xl border border-white/10 whitespace-nowrap z-50 pointer-events-none animate-in fade-in duration-150">
                            เพิ่มหมวดหมู่ย่อย
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* BROW 3: ยี่ห้อ - รุ่นหลัก (Model) - รุ่นย่อย / ซีรีส์ */}
              <div className="flex flex-wrap gap-2 items-end">
                <div className="flex-1 min-w-[130px]">
                  <Field label="ยี่ห้อ (Brand)">
                    <SmartSelect
                      options={brandOptions}
                      value={formData.brand}
                      onChange={(val) => setFormData(prev => ({ ...prev, brand: val }))}
                      onCreateOption={handleCreateBrand}
                      placeholder="เลือกยี่ห้อ..."
                    />
                  </Field>
                </div>

                <div className="flex-1 min-w-[120px]">
                  <Field label="รุ่นหลัก (Model)">
                    <PillInput
                      value={formData.model}
                      onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
                      placeholder="ระบุรุ่นหลัก..."
                    />
                  </Field>
                </div>

                <div className="flex-1 min-w-[120px]">
                  <Field label="รุ่นย่อย / ซีรีส์">
                    <PillInput
                      value={formData.subModel}
                      onChange={(e) => setFormData(prev => ({ ...prev, subModel: e.target.value }))}
                      placeholder="ระบุรุ่นย่อย..."
                    />
                  </Field>
                </div>
              </div>

              {/* BROW 4: ประเภทสินค้า - ประเภทภาษี - สถานะการจำหน่าย (วงจรชีวิตสินค้า) */}
              <div className="flex flex-wrap gap-2 items-end">
                <div className="flex-1 min-w-[130px]">
                  <Field label="ประเภทสินค้า">
                    <SmartSelect
                      options={productTypeOptions}
                      value={formData.productType}
                      onChange={(val) => setFormData(prev => ({ ...prev, productType: val }))}
                      placeholder="ประเภท..."
                    />
                  </Field>
                </div>

                <div className="flex-1 min-w-[130px]">
                  <Field label="ประเภทภาษี">
                    <SmartSelect
                      options={taxTypeOptions}
                      value={formData.taxType}
                      onChange={(val) => setFormData(prev => ({ ...prev, taxType: val }))}
                      placeholder="เลือกภาษี..."
                    />
                  </Field>
                </div>

                <div className="flex-1 min-w-[130px]">
                  <Field label="สถานะการจำหน่าย">
                    <SmartSelect
                      options={lifecycleStatusOptions}
                      value={formData.lifecycleStatus}
                      onChange={(val) => setFormData(prev => ({ ...prev, lifecycleStatus: val }))}
                      placeholder="เลือกสถานะ..."
                    />
                  </Field>
                </div>
              </div>

              {/* BROW 5: การผูกผังบัญชี (GL Mapping) */}
              <div className="pt-2 border-t border-white/5 space-y-2">
                <h6 className="text-[11px] font-bold uppercase text-nexus-teal tracking-wider">การผูกผังบัญชี (GL Mapping)</h6>
                <div className="flex flex-wrap gap-2 bg-black/40 p-2.5 rounded-xl border border-white/5 items-end">
                  <div className="flex-1 min-w-[140px]">
                    <Field label="บัญชีรายได้">
                      <SmartSelect
                        options={glIncomeOptions}
                        value={formData.glIncomeAccount}
                        onChange={(val) => setFormData(prev => ({ ...prev, glIncomeAccount: val }))}
                        placeholder="รายได้..."
                      />
                    </Field>
                  </div>

                  <div className="flex-1 min-w-[140px]">
                    <Field label="บัญชีต้นทุน">
                      <SmartSelect
                        options={glCogsOptions}
                        value={formData.glCogsAccount}
                        onChange={(val) => setFormData(prev => ({ ...prev, glCogsAccount: val }))}
                        placeholder="ต้นทุน..."
                      />
                    </Field>
                  </div>

                  <div className="flex-1 min-w-[140px]">
                    <Field label="บัญชีคลังสินค้า">
                      <SmartSelect
                        options={glInventoryOptions}
                        value={formData.glInventoryAccount}
                        onChange={(val) => setFormData(prev => ({ ...prev, glInventoryAccount: val }))}
                        placeholder="คลัง..."
                      />
                    </Field>
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* CARD 2: ราคาและอัตรากำไร */}
            <GlassCard accentColor="blue" className="p-4 space-y-3 animate-in fade-in duration-300 relative overflow-visible">
              <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                <div className="w-6 h-6 rounded-lg bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/20">
                  <DollarSign size={14} />
                </div>
                <h3 className="text-[13px] font-bold text-white uppercase tracking-wider">2. ราคาและอัตรากำไร</h3>
              </div>

              <div className="space-y-2.5">
                {/* บรรทัดที่ 1: ราคาต้นทุนเฉลี่ย - ราคาขายหน้าร้าน - ราคาขายโครงการ */}
                <div className="flex flex-wrap gap-2 items-end">
                  <div id="field-product-cost" className="flex-1 min-w-[110px]">
                    <Field label="ราคาต้นทุนเฉลี่ย" required error={errors.cost}>
                      <StepperInput value={formData.cost} onChange={handleCostChange} className="text-danger font-black" />
                    </Field>
                  </div>
                  
                  <div id="field-product-price" className="flex-1 min-w-[110px]">
                    <Field label="ราคาขายหน้าร้าน" required error={errors.price}>
                      <StepperInput value={formData.price} onChange={handlePriceChange} className="text-nexus-teal font-black" />
                    </Field>
                  </div>

                  <div className="flex-1 min-w-[110px]">
                    <Field label="ราคาขายโครงการ">
                      <StepperInput 
                        value={formData.priceProject} 
                        onChange={(val) => setFormData(prev => ({ ...prev, priceProject: val }))} 
                        className="text-cyan-400 font-black" 
                      />
                    </Field>
                  </div>
                </div>

                {/* บรรทัดที่ 2: ราคาขายส่ง B2B - ราคาควบคุมขายต่ำสุด (MAP Guard) */}
                <div className="flex flex-wrap gap-2 items-end">
                  <div className="flex-1 min-w-[130px]">
                    <Field label="ราคาขายส่ง B2B">
                      <StepperInput 
                        value={formData.priceWholesale} 
                        onChange={(val) => setFormData(prev => ({ ...prev, priceWholesale: val }))} 
                        className="text-indigo-400 font-black" 
                      />
                    </Field>
                  </div>

                  <div className="flex-1 min-w-[130px]">
                    <Field label="ราคาควบคุมขายต่ำสุด (MAP Guard)">
                      <StepperInput 
                        value={formData.minimumFloorPrice} 
                        onChange={(val) => setFormData(prev => ({ ...prev, minimumFloorPrice: val }))} 
                        className="text-rose-400 font-black" 
                      />
                    </Field>
                  </div>
                </div>

                <div className="w-full flex justify-between items-center pt-2 border-t border-white/5 px-1">
                  <span className="text-[12px] font-bold text-white/60 uppercase tracking-wide">กำไรคาดการณ์หน้าร้าน</span>
                  <span className={cn("text-[13px] font-bold font-mono", profit > 0 ? "text-nexus-teal" : "text-white/40")}>
                    ฿{profit.toLocaleString()} <span className="text-[11px]">({profitMargin}%)</span>
                  </span>
                </div>
              </div>
            </GlassCard>
          </div>

          {/* ROW 2: Card 3 (ซ้าย) & Card 4 (ขวา) */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5 items-start">
            {/* CARD 3: คลังจัดเก็บ และหน่วยนับ */}
            <GlassCard accentColor="purple" className="p-4 space-y-3 animate-in fade-in duration-300 relative overflow-visible">
              <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                <div className="w-6 h-6 rounded-lg bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/20">
                  <Boxes size={14} />
                </div>
                <h3 className="text-[13px] font-bold text-white uppercase tracking-wider">3. คลังจัดเก็บ และหน่วยนับ</h3>
              </div>

              <div className="space-y-2.5">
                <div className="flex flex-wrap gap-2.5 items-end">
                  <div id="field-product-warehouse" className="flex-1 min-w-[150px]">
                    <Field label="คลังสินค้า" required={!!(formData.qty && formData.qty > 0)} error={errors.warehouseId}>
                      <SmartSelect
                        options={warehouseOptions}
                        value={formData.warehouseId}
                        onChange={(val) => {
                          setFormData(prev => ({ ...prev, warehouseId: val, rackLocation: "" }));
                          if (errors.warehouseId) setErrors(prev => ({ ...prev, warehouseId: "" }));
                        }}
                        placeholder="เลือกคลังสินค้า..."
                      />
                    </Field>
                  </div>

                  <div className="flex-1 min-w-[180px]">
                    <Field label="พิกัดจัดเก็บ">
                      <div className="flex gap-1.5">
                        <PillInput 
                          value={formData.rackLocation} 
                          onChange={(e) => setFormData(prev => ({ ...prev, rackLocation: e.target.value }))} 
                          placeholder="พิกัด..." 
                          className="flex-1 h-8 px-3.5 rounded-full font-mono font-bold text-nexus-teal text-[12px]" 
                        />
                        <PillButton 
                          variant="glass" 
                          onClick={() => setShow3DPicker(true)} 
                          className="px-3 h-8 rounded-full hover:text-nexus-teal hover:border-nexus-teal/30 flex items-center gap-1 text-[11px] shrink-0"
                        >
                          <MapPin size={12} className="text-nexus-teal" />
                          <span>พิกัด 3D</span>
                        </PillButton>
                      </div>
                    </Field>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/5 space-y-2">
                  <h6 className="text-[11px] font-bold uppercase text-nexus-teal tracking-wider">หน่วยนับแปลงค่า</h6>
                  <div className="flex flex-wrap gap-2 bg-black/40 p-3 rounded-xl border border-white/5 items-end">
                    <div className="flex-1 min-w-[110px]">
                      <Field label="หน่วยจัดเก็บ">
                        <SmartSelect
                          options={uomOptions}
                          value={formData.packageUnit}
                          onChange={(val) => setFormData(prev => ({ ...prev, packageUnit: val }))}
                          onCreateOption={(val) => {
                            handleCreateUom(val);
                            setFormData(prev => ({ ...prev, packageUnit: val }));
                          }}
                          placeholder="หน่วย..."
                        />
                      </Field>
                    </div>
                    
                    <div className="w-[85px]">
                      <Field label="อัตรา">
                        <StepperInput 
                          value={formData.conversionRate} 
                          onChange={(val) => setFormData(prev => ({ ...prev, conversionRate: val }))} 
                          className="text-center text-nexus-teal font-bold" 
                        />
                      </Field>
                    </div>
                    
                    <div className="flex-1 min-w-[110px]">
                      <Field label="หน่วยขาย">
                        <SmartSelect
                          options={uomOptions}
                          value={formData.baseUnit}
                          onChange={(val) => setFormData(prev => ({ ...prev, baseUnit: val }))}
                          onCreateOption={(val) => {
                            handleCreateUom(val);
                            setFormData(prev => ({ ...prev, baseUnit: val }));
                          }}
                          placeholder="หน่วย..."
                        />
                      </Field>
                    </div>
                  </div>

                  <UomHierarchyBuilder
                    baseUnit={formData.baseUnit}
                    conversions={formData.conversions}
                    onChange={(conversions) => setFormData(prev => ({ ...prev, conversions }))}
                  />
                </div>

                {/* น้ำหนักและขนาด */}
                <div className="pt-2 border-t border-white/5 space-y-2">
                  <h6 className="text-[11px] font-bold uppercase text-nexus-teal tracking-wider">มิติและน้ำหนัก</h6>
                  <div className="flex flex-wrap gap-2 bg-black/40 p-3 rounded-xl border border-white/5 items-end">
                    <div className="flex-1 min-w-[75px]">
                      <Field label="น้ำหนัก (กก.)">
                        <StepperInput 
                          value={formData.weightKg} 
                          placeholder="0.00"
                          step={0.1}
                          onChange={(val) => setFormData(prev => ({ ...prev, weightKg: val }))} 
                        />
                      </Field>
                    </div>
                    <div className="flex-1 min-w-[75px]">
                      <Field label="กว้าง (ซม.)">
                        <StepperInput 
                          value={formData.dimensionW} 
                          placeholder="0.0"
                          step={0.5}
                          onChange={(val) => setFormData(prev => ({ ...prev, dimensionW: val }))} 
                        />
                      </Field>
                    </div>
                    <div className="flex-1 min-w-[75px]">
                      <Field label="ยาว (ซม.)">
                        <StepperInput 
                          value={formData.dimensionL} 
                          placeholder="0.0"
                          step={0.5}
                          onChange={(val) => setFormData(prev => ({ ...prev, dimensionL: val }))} 
                        />
                      </Field>
                    </div>
                    <div className="flex-1 min-w-[75px]">
                      <Field label="สูง (ซม.)">
                        <StepperInput 
                          value={formData.dimensionH} 
                          placeholder="0.0"
                          step={0.5}
                          onChange={(val) => setFormData(prev => ({ ...prev, dimensionH: val }))} 
                        />
                      </Field>
                    </div>
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* CARD 4: การจัดซื้อ และการควบคุมสต๊อก */}
            <GlassCard accentColor="amber" className="p-4 space-y-3 animate-in fade-in duration-300 relative overflow-visible">
              <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                <div className="w-6 h-6 rounded-lg bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/20">
                  <Truck size={14} />
                </div>
                <h3 className="text-[13px] font-bold text-white uppercase tracking-wider">4. การจัดซื้อ และควบคุมสต๊อก</h3>
              </div>

              <div className="space-y-2.5">
                <div className="w-full">
                  <Field label="ผู้จำหน่ายหลัก">
                    <SmartSelect
                      options={supplierOptions}
                      value={formData.supplierId}
                      onChange={(val) => setFormData(prev => ({ ...prev, supplierId: val }))}
                      placeholder="เลือกผู้จำหน่าย..."
                    />
                  </Field>
                </div>

                <div className="flex flex-wrap gap-2.5 items-end">
                  <div className="flex-1 min-w-[130px]">
                    <Field label="รหัสซัพพลายเออร์">
                      <PillInput 
                        value={formData.supplierSku} 
                        onChange={(e) => setFormData(prev => ({ ...prev, supplierSku: e.target.value }))} 
                        placeholder="รหัสซัพฯ..." 
                        className="w-full h-8 px-4 rounded-full font-mono text-center placeholder:text-center text-[12px]"
                      />
                    </Field>
                  </div>

                  <div className="flex-1 min-w-[130px]">
                    <Field label="รหัสพาร์ท MPN">
                      <PillInput 
                        value={formData.mpn} 
                        onChange={(e) => setFormData(prev => ({ ...prev, mpn: e.target.value }))} 
                        placeholder="MPN..." 
                        className="w-full h-8 px-4 rounded-full font-mono text-center placeholder:text-center text-[12px]"
                      />
                    </Field>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2.5 items-end">
                  <div className="flex-1 min-w-[130px]">
                    <Field label="รอสินค้า (วัน)">
                      <StepperInput 
                        value={formData.leadTimeDays} 
                        placeholder="ระบุวัน"
                        onChange={(val) => setFormData(prev => ({ ...prev, leadTimeDays: val }))} 
                        className="font-bold"
                      />
                    </Field>
                  </div>

                  <div className="flex-1 min-w-[130px]">
                    <Field label="จำนวนรับเริ่มต้น" error={errors.qty}>
                      <StepperInput 
                        value={formData.qty} 
                        placeholder="0 (ทางเลือก)"
                        onChange={(val) => setFormData(prev => ({ ...prev, qty: val }))} 
                        className="font-bold text-nexus-teal" 
                      />
                    </Field>
                  </div>
                </div>

                <SupplierMatrix
                  supplierConfig={formData.supplierConfig}
                  suppliersList={supplierOptions}
                  onChange={(supplierConfig) => setFormData(prev => ({ ...prev, supplierConfig }))}
                />

                <div className="pt-2 border-t border-white/5 space-y-2">
                  <h6 className="text-[11px] font-bold uppercase text-nexus-teal tracking-wider">ระดับสต๊อกสินค้า</h6>
                  <div className="flex flex-wrap gap-2 bg-black/40 p-3 rounded-xl border border-white/5 items-end">
                    <div className="flex-1 min-w-[90px]">
                      <Field label="จุดสั่งซื้อ" error={errors.reorderPoint}>
                        <StepperInput 
                          value={formData.reorderPoint} 
                          placeholder="0"
                          onChange={(val) => {
                            setFormData(prev => ({ ...prev, reorderPoint: val }));
                            if (errors.reorderPoint) setErrors(prev => ({ ...prev, reorderPoint: "", minStock: "", maxStock: "" }));
                          }} 
                          className="text-amber-400 font-bold"
                        />
                      </Field>
                    </div>

                    <div className="flex-1 min-w-[90px]">
                      <Field label="ขั้นต่ำ" error={errors.minStock}>
                        <StepperInput 
                          value={formData.minStock} 
                          placeholder="0"
                          onChange={(val) => {
                            setFormData(prev => ({ ...prev, minStock: val }));
                            if (errors.minStock) setErrors(prev => ({ ...prev, minStock: "", reorderPoint: "", maxStock: "" }));
                          }} 
                          className="text-rose-400 font-bold"
                        />
                      </Field>
                    </div>

                    <div className="flex-1 min-w-[90px]">
                      <Field label="สูงสุด" error={errors.maxStock}>
                        <StepperInput 
                          value={formData.maxStock} 
                          placeholder="0"
                          onChange={(val) => {
                            setFormData(prev => ({ ...prev, maxStock: val }));
                            if (errors.maxStock) setErrors(prev => ({ ...prev, maxStock: "", reorderPoint: "", minStock: "" }));
                          }} 
                          className="text-emerald-400 font-bold"
                        />
                      </Field>
                    </div>
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>

          {/* ROW 3: Card 5 (แถวล่างสุด - เต็มความกว้าง) */}
          <GlassCard accentColor="emerald" className="p-4 space-y-3 animate-in fade-in duration-300 relative overflow-visible">
            <div className="flex items-center gap-2 border-b border-white/5 pb-2">
              <div className="w-6 h-6 rounded-lg bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/20">
                <Sliders size={14} />
              </div>
              <h3 className="text-[13px] font-bold text-white uppercase tracking-wider">5. การติดตาม สเปก และเอกสาร</h3>
            </div>

            <div className="space-y-2.5">
              <div className="flex flex-wrap gap-4 bg-black/40 p-2.5 rounded-xl border border-white/5 justify-between">
                <label className="flex items-center gap-2 cursor-pointer p-1 rounded-lg hover:bg-white/5 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={formData.isSerialized} 
                    onChange={(e) => setFormData(prev => ({ ...prev, isSerialized: e.target.checked }))} 
                    className="w-3.5 h-3.5 rounded text-nexus-teal focus:ring-nexus-teal bg-white/10 border-white/20" 
                  />
                  <span className="text-[11px] font-bold text-white">คุม S/N</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer p-1 rounded-lg hover:bg-white/5 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={formData.isBatchTracked} 
                    onChange={(e) => setFormData(prev => ({ ...prev, isBatchTracked: e.target.checked }))} 
                    className="w-3.5 h-3.5 rounded text-nexus-teal focus:ring-nexus-teal bg-white/10 border-white/20" 
                  />
                  <span className="text-[11px] font-bold text-white">คุมล็อต</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer p-1 rounded-lg hover:bg-white/5 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={formData.isExpiryTracked} 
                    onChange={(e) => setFormData(prev => ({ ...prev, isExpiryTracked: e.target.checked }))} 
                    className="w-3.5 h-3.5 rounded text-nexus-teal focus:ring-nexus-teal bg-white/10 border-white/20" 
                  />
                  <span className="text-[11px] font-bold text-white">คุมหมดอายุ</span>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <Field label="หมายเลขซีเรียล">
                  <textarea 
                    value={formData.sns} 
                    onChange={(e) => setFormData(prev => ({ ...prev, sns: e.target.value }))} 
                    placeholder="สแกนหรือระบุหมายเลขซีเรียล..." 
                    className="w-full h-16 rounded-xl bg-black/40 border border-white/10 text-white text-[12px] font-mono p-2.5 focus:outline-none focus:ring-1 focus:ring-nexus-teal/50 custom-scrollbar" 
                  />
                </Field>

                <Field label="รายละเอียดเชิงเทคนิคและสเปก">
                  <textarea 
                    value={formData.technicalSpecs} 
                    onChange={(e) => setFormData(prev => ({ ...prev, technicalSpecs: e.target.value }))} 
                    placeholder="รายละเอียดทางเทคนิค เช่น แรงดันไฟฟ้า สเปก TOR..." 
                    className="w-full h-16 rounded-xl bg-black/40 border border-white/10 text-white text-[12px] p-2.5 focus:outline-none focus:ring-1 focus:ring-nexus-teal/50 custom-scrollbar" 
                  />
                </Field>
              </div>

              <div className="flex flex-wrap gap-2.5 items-end">
                <div className="flex-1 min-w-[200px]">
                  <Field label="ชื่อเรียกหลายมิติ / TOR">
                    <PillInput 
                      value={formData.aliases} 
                      onChange={(e) => setFormData(prev => ({ ...prev, aliases: e.target.value }))} 
                      placeholder="ชื่อลูกค้า/TOR..." 
                      className="w-full h-8 px-4 rounded-full text-[12px]"
                    />
                  </Field>
                </div>

                <div className="flex-1 min-w-[200px]">
                  <Field label="อุปกรณ์พ่วง">
                    <PillInput 
                      value={formData.accessories} 
                      onChange={(e) => setFormData(prev => ({ ...prev, accessories: e.target.value }))} 
                      placeholder="น็อต พุก..." 
                      className="w-full h-8 px-4 rounded-full text-[12px]"
                    />
                  </Field>
                </div>
              </div>

              <DocumentVaultUploader
                documents={formData.documents}
                onChange={(documents) => setFormData(prev => ({ ...prev, documents }))}
              />
            </div>
          </GlassCard>
        </div>
      ) : (
        /* PO Import Mode */
        <GlassCard className="p-6 space-y-6 animate-in fade-in duration-300 relative overflow-visible">
          <div className="flex items-end gap-3 bg-white/[0.02] p-4 rounded-xl border border-white/5">
            <div className="flex-1">
              <Field label="ค้นหาเลขที่คำสั่งซื้อ">
                <div className="relative">
                  <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
                  <PillInput 
                    value={formData.poRef} 
                    onChange={(e) => setFormData(prev => ({ ...prev, poRef: e.target.value }))} 
                    placeholder="ระบุเลขที่ใบสั่งซื้อ (PO-XXXXX)..." 
                    className="w-full h-8 pl-10 rounded-full font-mono text-[13px]" 
                  />
                </div>
              </Field>
            </div>
            <PillButton 
              onClick={fetchPOItems} 
              className="px-5 h-8 bg-nexus-teal/20 text-nexus-teal border border-nexus-teal/30 font-black hover:bg-nexus-teal/30 rounded-full text-xs"
            >
              <Search size={13} className="mr-1.5" />
              ดึงรายการ
            </PillButton>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center px-1">
              <h5 className="text-[11px] font-semibold text-white/40 uppercase tracking-widest">รายการที่รอการรับเข้า ({poItems.length})</h5>
            </div>
            
            {poItems.length === 0 ? (
              <div className="p-12 border border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center text-center space-y-2">
                <Package size={32} className="text-white/20" />
                <p className="text-xs text-white/30 font-bold">ยังไม่มีรายการ (กรุณาระบุเลขที่ใบสั่งซื้อแล้วกดยืนยันดึงรายการ)</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {poItems.map((item) => (
                  <div key={item.id} className="bg-white/[0.02] border border-white/5 p-3 rounded-xl flex items-center gap-4 hover:bg-white/[0.04] transition-all">
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-nexus-teal shrink-0">
                      <Package size={16} />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-white uppercase">{item.name}</p>
                      <p className="text-[10px] text-white/40 font-mono mt-0.5">{item.sku} • สั่งซื้อ: {item.qtyOrdered}</p>
                    </div>
                    <div className="w-24">
                      <p className="text-[9px] font-semibold text-white/40 uppercase mb-1">รับจริง</p>
                      <StepperInput 
                        value={item.qtyReceived} 
                        onChange={(val) => updatePoItem(item.id, "qtyReceived", val)} 
                        className="text-center font-bold text-nexus-teal" 
                      />
                    </div>
                    <div className="w-28">
                      <p className="text-[9px] font-semibold text-white/40 uppercase mb-1">ต้นทุน/หน่วย</p>
                      <StepperInput 
                        value={item.cost} 
                        onChange={(val) => updatePoItem(item.id, "cost", val)} 
                        className="text-right font-bold font-mono" 
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </GlassCard>
      )}
    </div>
  );

  const rightSidebar = (
    <GlassCard className="p-6 space-y-6 sticky top-0 bg-surface-1 shadow-2xl relative overflow-hidden border-white/5 rounded-3xl">
      <div className="space-y-1 relative z-10 border-b border-white/5 pb-3">
        <p className="text-[12px] font-bold text-white/60 uppercase tracking-widest">การตรวจสอบข้อมูล</p>
        <h5 className="text-[14px] font-bold text-white uppercase tracking-tight">สรุปความถูกต้องของสินค้า</h5>
      </div>

      <div className="p-5 rounded-2xl bg-nexus-teal/5 border border-nexus-teal/10 space-y-4 relative z-10">
        {sourceMode === "manual" ? (
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold text-white/60 uppercase">สถานะรหัสสินค้า</span>
            <span className={cn("text-[12px] font-bold px-2.5 py-0.5 rounded-full border", skuStatusDisplay.variant)}>
              {skuStatusDisplay.label}
            </span>
          </div>
        ) : (
          <NexusDataField label="สถานะตรวจสอบคำสั่งซื้อ" value={poItems.length > 0 ? "สมบูรณ์" : "รอตรวจสอบ"} highlight={poItems.length > 0} />
        )}

        {/* Dynamic Checklist */}
        {sourceMode === "manual" && (
          <div className="space-y-2.5 pt-2 border-t border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold text-white/60 uppercase">
                ช่องบังคับ {requiredStatus.filledCount}/{requiredStatus.totalCount}
              </span>
              <span className={cn(
                "text-[11px] font-bold px-2 py-0.5 rounded-full border",
                requiredStatus.isComplete 
                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                  : "bg-amber-500/20 text-amber-400 border-amber-500/40"
              )}>
                {requiredStatus.isComplete ? "ครบถ้วน" : "ยังไม่ครบ"}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full transition-all duration-300 rounded-full",
                  requiredStatus.isComplete ? "bg-emerald-400" : "bg-nexus-teal"
                )}
                style={{ width: `${(requiredStatus.filledCount / requiredStatus.totalCount) * 100}%` }}
              />
            </div>

            {/* Missing Fields or Complete Message */}
            {!requiredStatus.isComplete ? (
              <div className="space-y-1.5 pt-1">
                <p className="text-[11px] font-bold text-white/50">ช่องที่ยังไม่ระบุ ({requiredStatus.missingFields.length}):</p>
                <div className="space-y-1">
                  {requiredStatus.missingFields.map((field) => (
                    <button
                      key={field.key}
                      type="button"
                      onClick={() => scrollToField(field.id)}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-[12px] text-white/80 hover:text-white transition-all text-left group"
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                        <span className="font-medium">{field.label}</span>
                      </span>
                      <span className="text-[10px] text-nexus-teal opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 font-bold">
                        ไปยังช่อง <ArrowLeft size={10} className="rotate-180" />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[12px] font-medium">
                <CheckCircle2 size={14} className="shrink-0" />
                <span>กรอกข้อมูลจำเป็นครบถ้วนแล้ว</span>
              </div>
            )}
          </div>
        )}

        <div className="pt-2 border-t border-white/10">
          <NexusDataField label="มูลค่าต้นทุนรวม" value={`฿${totalCost.toLocaleString()}`} highlight />
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 relative z-10">
        <p className="text-[14px] text-white/60 font-normal leading-relaxed">
          * ข้อมูลสินค้าใหม่จะได้รับการจัดสรรพิกัดและประทับเวลาเคลื่อนย้ายของคลังสินค้าโดยทันทีหลังจากกดยืนยัน
        </p>
      </div>
      
      <div className="absolute bottom-0 right-0 w-48 h-48 bg-nexus-teal/10 blur-[60px] translate-x-1/4 translate-y-1/4 rounded-full pointer-events-none" />
    </GlassCard>
  );

  const footerContent = (
    <div className="flex items-center justify-between gap-4 w-full">
      <div className="flex items-center gap-2">
        <PillButton 
          variant="glass" 
          onClick={handleCancel} 
          disabled={submitting}
          className="h-8 px-5 text-[14px]"
        >
          ยกเลิก
        </PillButton>
      </div>
      <div className="flex items-center gap-3">
        <PillButton 
          variant="primary" 
          onClick={() => handleSubmit(true)} 
          disabled={submitting} 
          className="h-8 px-5 text-[14px]"
        >
          {submitting ? "กำลังบันทึก..." : "บันทึกและเพิ่มต่อ"}
        </PillButton>
        <PillButton 
          variant="save" 
          onClick={() => handleSubmit(false)} 
          disabled={submitting} 
          className="h-8 px-6 text-[14px] font-bold shadow-neon-teal"
        >
          {submitting ? "กำลังบันทึก..." : "บันทึก"}
        </PillButton>
      </div>
    </div>
  );

  return (
    <>
      <NexusPageLayout
        header={headerContent}
        leftContent={leftContent}
        rightSidebar={rightSidebar}
        footer={footerContent}
      />
      <Modal isOpen={show3DPicker} onClose={() => setShow3DPicker(false)} title="เครื่องมือเลือกพิกัด 3 มิติ" maxWidth="max-w-[1400px]">
        <div className="w-full h-[85vh] bg-surface-0 flex flex-col overflow-hidden p-6">
          <div className="flex-1 overflow-hidden relative rounded-2xl border border-white/5 bg-surface-1">
            <Warehouse3D 
              pickerMode={true} 
              initialWarehouseId={formData.warehouseId} 
              onSelectLocation={(loc, whId) => {
                setFormData(prev => ({ ...prev, rackLocation: loc, warehouseId: whId }));
                setShow3DPicker(false);
              }} 
            />
          </div>
        </div>
      </Modal>
    </>
  );
}

function Field({ label, children, required, error }: { label: string, children: React.ReactNode, required?: boolean, error?: string }) {
  const cleanLabel = label.replace('*', '').trim();
  const hasAsterisk = required || label.includes('*');

  return (
    <div className="w-full flex flex-col justify-start space-y-1.5">
      <label className="text-[12px] font-bold text-white/60 uppercase tracking-wide flex items-center gap-1 pl-1 whitespace-nowrap">
        <span>{cleanLabel}</span>
        {hasAsterisk && <span className="text-danger font-semibold">*</span>}
      </label>
      <div className="w-full relative">{children}</div>
      {error && (
        <span className="text-[11px] font-medium text-danger flex items-center gap-1 pl-1">
          <AlertCircle size={10} /> {error}
        </span>
      )}
    </div>
  );
}
