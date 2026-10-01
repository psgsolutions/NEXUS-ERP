"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Package, 
  ShieldCheck, 
  Truck,
  Plus, 
  Trash2, 
  ChevronDown, 
  MapPin,
  Sparkles,
  RefreshCw,
  FileText,
  Search
} from "lucide-react";
import { 
  PillButton, 
  PillInput, 
  PillSelect, 
  Modal, 
  PillTabs,
  NexusDataField,
  cn
} from "@/components/ui/Base";
import { useInventory } from "@/hooks/useInventory";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { db } from "@/lib/firebase-client";
import { doc, setDoc, collection } from "firebase/firestore";
import { saveToFirestore } from "@/lib/firebaseUtils";
import { Warehouse3D, mockWarehouses } from "./Warehouse3D";
import { useSystemDialog } from "@/context/DialogContext";
import { SmartScanner } from "@/components/shared/SmartScanner";

interface AddProductSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddProductSheet({ isOpen, onClose }: AddProductSheetProps) {
  const { showAlert, showConfirm } = useSystemDialog();

  const { products } = useInventory();
  const { user, companyId } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [sourceMode, setSourceMode] = useState("manual");
  const [poItems, setPoItems] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    supplierId: "SUPP-001",
    poRef: "",
    defaultWarehouseId: "WH-01",
    sku: "",
    name: "",
    brand: "NEXUS",
    model: "",
    supplierSku: "",
    mpn: "",
    barcode: "",
    category: "general",
    defaultRackLocation: "",
    lifecycleStatus: "ACTIVE" as "DRAFT" | "ACTIVE" | "PHASE_OUT" | "OBSOLETE",
    qty: 1,
    cost: 0,
    price: 0,
    packageUnit: "ชิ้น",
    baseUnit: "ชิ้น",
    conversionRate: 1,
    sns: "",
    imageUrl: ""
  });

  const { data: suppliers } = useRealtimeCollection("suppliers");
  const { data: warehouses } = useRealtimeCollection("warehouses");

  const [categoriesList, setCategoriesList] = useState([
    { id: "general", label: "ทั่วไป", isSystem: true },
    { id: "network-server", label: "ระบบเครือข่ายและเซิร์ฟเวอร์ (Network & Server)", isSystem: true },
    { id: "computer", label: "คอมพิวเตอร์และอุปกรณ์ (Computer & Peripherals)", isSystem: true },
    { id: "wires-cables", label: "สายไฟและสายสัญญาณ (Wires & Cables)", isSystem: true },
    { id: "switches", label: "สวิตช์และเต้ารับ (Switches & Receptacles)", isSystem: true },
    { id: "breakers", label: "เบรกเกอร์และตู้ไฟ (Breakers & Load Centers)", isSystem: true },
    { id: "lighting", label: "หลอดไฟและโคมไฟ (Lighting & Fixtures)", isSystem: true },
    { id: "conduits", label: "ท่อร้อยสายไฟและข้อต่อ (Conduits & Fittings)", isSystem: true },
    { id: "cctv", label: "กล้องวงจรปิดและกันขโมย (CCTV & Security)", isSystem: true },
    { id: "audio", label: "เครื่องเสียงและระบบประกาศ (PA & Audio)", isSystem: true },
    { id: "ups", label: "เครื่องสำรองไฟ (UPS & Stabilizers)", isSystem: true },
    { id: "tools", label: "เครื่องมือช่างและฮาร์ดแวร์ (Tools & Hardware)", isSystem: true },
    { id: "software", label: "ซอฟต์แวร์ (Software & Licenses)", isSystem: true },
    { id: "service", label: "บริการและซ่อมบำรุง (Services & Maintenance)", isSystem: true },
    { id: "kit", label: "ชุดงานติดตั้ง", isSystem: true },
  ]);

  const uomOptions = [
    "ชิ้น",
    "เครื่อง",
    "กล่อง",
    "ลัง",
    "แพ็ค",
    "ม้วน",
    "ขด",
    "เมตร",
    "เส้น",
    "หลอด",
    "โคม",
    "ใบ",
    "ชุด",
    "งาน",
    "ชั่วโมง",
    "วัน",
  ];

  const [catSearch, setCatSearch] = useState("ทั่วไป");
  const [isCatFocused, setIsCatFocused] = useState(false);
  const [isPriceManuallyEdited, setIsPriceManuallyEdited] = useState(false);
  const [show3DPicker, setShow3DPicker] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setFormData({ ...formData, imageUrl: url });
    }
  };

  const filteredCats = categoriesList.filter(c => c.label.toLowerCase().includes(catSearch.toLowerCase()));

  const handleSelectCat = (id: string, label: string) => {
    const updatedForm = { ...formData, category: id };
    if (id === "kit") {
      updatedForm.packageUnit = "ชุด";
      updatedForm.baseUnit = "ชุด";
      if (!updatedForm.sku.startsWith("PKG-LAB-")) {
        updatedForm.sku = `PKG-LAB-${Math.floor(1000 + Math.random() * 9000)}`;
      }
    }
    setFormData(updatedForm);
    setCatSearch(label);
    setIsCatFocused(false);
  };

  const handleCreateCat = () => {
    if (!catSearch.trim()) return;
    const newId = catSearch.toLowerCase().replace(/\s+/g, '-');
    setCategoriesList([...categoriesList, { id: newId, label: catSearch, isSystem: false }]);
    setFormData({...formData, category: newId});
    setIsCatFocused(false);
  };

  const handleDeleteCategory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setCategoriesList(categoriesList.filter(c => c.id !== id));
    if (formData.category === id) setFormData({...formData, category: "general"});
  };

  const handleCostChange = (val: number) => {
    setFormData(prev => {
      const newData = { ...prev, cost: val };
      if (!isPriceManuallyEdited) {
        newData.price = Number((val / 0.8).toFixed(2));
      }
      return newData;
    });
  };

  const handlePriceChange = (val: number) => {
    setIsPriceManuallyEdited(true);
    setFormData(prev => ({ ...prev, price: val }));
  };

  // Reset/generate SKU when opened
  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const yy = now.getFullYear().toString().slice(-2);
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const prefix = `PRD-${yy}${mm}-`;

      let nextNum = 1;
      if (products && products.length > 0) {
        const matches = products
          .map(p => p.sku)
          .filter(sku => sku && sku.startsWith(prefix));
        
        if (matches.length > 0) {
          const numbers = matches.map(sku => {
            const parts = sku.split("-");
            const lastPart = parts[parts.length - 1];
            const num = parseInt(lastPart, 10);
            return isNaN(num) ? 0 : num;
          });
          const maxNum = Math.max(...numbers);
          nextNum = maxNum + 1;
        }
      }

      const generatedSku = `${prefix}${String(nextNum).padStart(3, "0")}`;

      setFormData({
        supplierId: "SUPP-001",
        poRef: "",
        defaultWarehouseId: "WH-01",
        sku: generatedSku,
        name: "",
        brand: "NEXUS",
        model: "",
        supplierSku: "",
        mpn: "",
        barcode: "",
        category: "general",
        defaultRackLocation: "",
        lifecycleStatus: "ACTIVE",
        qty: 1,
        cost: 0,
        price: 0,
        packageUnit: "ชิ้น",
        baseUnit: "ชิ้น",
        conversionRate: 1,
        sns: "",
        imageUrl: ""
      });
      setCatSearch("ทั่วไป");
      setIsPriceManuallyEdited(false);
      setSourceMode("manual");
      setPoItems([]);
    }
  }, [isOpen, products]);

  const profit = formData.price - formData.cost;
  const profitMargin = formData.price > 0 ? ((profit / formData.price) * 100).toFixed(1) : "0.0";
  const totalCost = sourceMode === "manual" 
    ? (formData.qty * formData.cost)
    : poItems.reduce((acc, item) => acc + (item.qtyReceived * (item.cost || 0)), 0);

  const fetchPOItems = () => {
    if (!formData.poRef) return void showAlert("กรุณาระบุเลขที่ใบสั่งซื้อ");
    // Mock PO Data
    setPoItems([
      { id: "ITEM-001", name: "Aruba AP-505", sku: "AP-505-RW", qtyOrdered: 10, qtyReceived: 10, cost: 4500, sns: "" },
      { id: "ITEM-002", name: "CAT6 Cable 305m", sku: "CBL-CAT6-305", qtyOrdered: 5, qtyReceived: 5, cost: 2800, sns: "" }
    ]);
    setFormData(prev => ({ ...prev, supplierId: "SUPP-001" }));
  };

  const updatePoItem = (id: string, field: string, value: any) => {
    setPoItems(poItems.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const tabs = [
    { id: "manual", label: "คีย์สินค้าเข้าระบบ" },
    { id: "po", label: "รับจากคำสั่งซื้อ" }
  ];

  const handleSubmit = async () => {
    if (!companyId || !user) return;

    setSubmitting(true);
    
    try {
      if (sourceMode === "manual") {
        if (!formData.name.trim()) {
          setSubmitting(false);
          return void showAlert("กรุณาระบุชื่อสินค้า");
        }
        if (formData.qty <= 0) {
          setSubmitting(false);
          return void showAlert("จำนวนเริ่มต้นต้องมากกว่า 0");
        }
        if (formData.cost < 0) {
          setSubmitting(false);
          return void showAlert("ราคาต้นทุนต้องไม่ต่ำกว่า 0");
        }
        if (formData.price < 0) {
          setSubmitting(false);
          return void showAlert("ราคาขายต้องไม่ต่ำกว่า 0");
        }

        const saveOp = async () => {
          const prodId = `PROD-${Date.now()}`;
          const productRef = doc(db, "products", prodId);
          
          const totalQty = formData.qty * formData.conversionRate;
          
          // Save/merge the new item in products collection
          await setDoc(productRef, {
            companyId,
            sku: formData.sku,
            barcode: formData.barcode,
            name: formData.name,
            brand: formData.brand || "NEXUS",
            model: formData.model || "",
            category: formData.category,
            unit: formData.baseUnit,
            packageUnit: formData.packageUnit,
            conversionRate: formData.conversionRate,
            defaultWarehouseId: formData.defaultWarehouseId,
            defaultRackLocation: formData.defaultRackLocation || "WH-01-A1",
            lifecycleStatus: formData.lifecycleStatus,
            supplierId: formData.supplierId,
            supplierConfig: [
              {
                supplierId: formData.supplierId,
                supplierSku: formData.supplierSku || "",
                mpn: formData.mpn || "",
                latestCost: formData.cost,
                leadTimeDays: 3,
                isPrimary: true
              }
            ],
            costWAC: formData.cost,
            pricePOS: formData.price,
            priceProject: formData.price * 1.2,
            imageUrl: formData.imageUrl || "",
            stockStatus: {
              onHand: totalQty,
              reserved: 0,
              available: totalQty
            },
            updatedAt: new Date(),
            isDeleted: false
          }, { merge: true });

          // Save/record a corresponding inbound transaction in stockMovements
          const logRef = doc(collection(db, "stockMovements"));
          await setDoc(logRef, {
            companyId,
            transactionId: `TX-GRN-${Date.now().toString().slice(-4)}`,
            type: "IN",
            productId: prodId,
            quantity: totalQty,
            fromLocation: "EXTERNAL",
            toLocation: formData.defaultRackLocation || "WH-01-A1",
            userId: user.displayName || "system",
            createdAt: new Date()
          });
        };
        await saveToFirestore(saveOp());
        showAlert("เพิ่มสินค้าและรับเข้าคลังเรียบร้อยแล้ว");

      } else {
        // PO mode
        if (poItems.length === 0) {
          setSubmitting(false);
          return void showAlert("กรุณาดึงข้อมูล PO และตรวจสอบรายการก่อนยืนยัน");
        }

        const saveOp = async () => {
          // Loop through each item in the PO
          for (const item of poItems) {
            if (item.qtyReceived <= 0) continue; // Skip non-received items
            
            // Check if this product already exists by matching SKU or name
            let existingProd = products.find(p => p.sku === item.sku || p.name.toLowerCase() === item.name.toLowerCase());
            const prodId = existingProd?.id || `PROD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
            const productRef = doc(db, "products", prodId);
            
            let currentOnHand = existingProd?.stockStatus?.onHand || 0;
            let currentCostWAC = existingProd?.pricing?.costWAC || 0;
            
            // Calculate WAC: (currentVal + newVal) / (currentQty + newQty)
            const newQty = currentOnHand + item.qtyReceived;
            const newCostWAC = (currentOnHand + item.qtyReceived > 0)
              ? ((currentOnHand * currentCostWAC) + (item.qtyReceived * (item.cost || 0))) / newQty
              : (item.cost || 0);

            await setDoc(productRef, {
              companyId,
              sku: item.sku || existingProd?.sku || `SKU-${Date.now().toString().slice(-4)}`,
              name: item.name || existingProd?.name || "Unnamed Product from PO",
              category: existingProd?.category || "general",
              brand: existingProd?.brand || "NEXUS",
              unit: existingProd?.unit || "ชิ้น",
              stockStatus: {
                onHand: newQty,
                reserved: existingProd?.stockStatus?.reserved || 0,
                available: newQty - (existingProd?.stockStatus?.reserved || 0)
              },
              pricing: {
                costWAC: newCostWAC,
                pricePOS: existingProd?.pricing?.pricePOS || Number(((item.cost || 0) / 0.8).toFixed(2)),
                priceProject: existingProd?.pricing?.priceProject || Number(((item.cost || 0) / 0.8).toFixed(2)) * 1.2
              },
              defaultWarehouseId: formData.defaultWarehouseId || (existingProd as any)?.defaultWarehouseId || "WH-01",
              defaultRackLocation: formData.defaultRackLocation || (existingProd as any)?.defaultRackLocation || "WH-01-A1",
              lifecycleStatus: formData.lifecycleStatus || (existingProd as any)?.lifecycleStatus || "ACTIVE",
              supplierId: formData.supplierId,
              updatedAt: new Date(),
              isDeleted: false
            }, { merge: true });

            // Stock log entry
            const logRef = doc(collection(db, "stockMovements"));
            await setDoc(logRef, {
              companyId,
              transactionId: `TX-GRN-${Date.now().toString().slice(-4)}`,
              type: "IN",
              productId: prodId,
              quantity: item.qtyReceived,
              fromLocation: "EXTERNAL",
              toLocation: formData.defaultRackLocation || "WH-01-A1",
              userId: user.displayName || "system",
              createdAt: new Date()
            });
          }
        };
        await saveToFirestore(saveOp());
        showAlert("เพิ่มสินค้าและรับเข้าคลังเรียบร้อยแล้ว");
      }

      onClose();
    } catch (error) {
      console.error("APO Product Save Alert: Failed to write to Firestore,", error);
      showAlert("ล้มเหลวในการบันทึกข้อมูลสินค้า");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="เพิ่มสินค้า"
      maxWidth="max-w-[1600px]"
    >
      <div className="flex h-full divide-x divide-white/5 bg-surface-0">
        {/* Left main form pane */}
        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
          <div className="max-w-4xl mx-auto space-y-12">
            <div className="flex justify-between items-end border-b border-white/5 pb-8">
               <div className="space-y-1">
                  <p className="text-[12px] font-semibold text-nexus-teal uppercase tracking-[0.2em]">Inbound Logistics Operation / New Product Registration</p>
                  <h4 className="text-xl font-semibold text-white uppercase tracking-tight">ระบุข้อมูลพื้นฐานและพิกัดจัดเก็บสินค้า</h4>
               </div>
               <PillTabs tabs={tabs} activeTab={sourceMode} onTabChange={setSourceMode} />
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
               {sourceMode === "manual" ? (
                 <div className="grid grid-cols-2 gap-10">
                    <div className="space-y-8">
                        <div className="flex items-center justify-between">
                           <div className="flex items-center gap-3 text-nexus-teal">
                              <Package size={18} />
                              <h5 className="text-[13px] font-semibold uppercase tracking-widest">ข้อมูลสินค้า</h5>
                           </div>
                           <SmartScanner 
                             type="product_label"
                             buttonLabel="AI สแกนฉลาก/สเปก"
                             onDataExtracted={(data) => {
                               setFormData(prev => ({
                                 ...prev,
                                 name: data.name || prev.name,
                                 barcode: data.model || prev.barcode,
                               }));
                             }}
                           />
                        </div>
                       <div className="space-y-6">
                          <div className="flex gap-4">
                             {/* Image Upload */}
                             <div 
                                onClick={() => fileInputRef.current?.click()}
                                className="w-24 h-24 rounded-2xl bg-white/[0.02] border border-dashed border-white/20 flex flex-col items-center justify-center text-white/30 hover:border-nexus-teal hover:text-nexus-teal cursor-pointer transition-colors shrink-0 overflow-hidden relative group"
                             >
                                {formData.imageUrl ? (
                                   <>
                                      <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                         <span className="text-[9px] font-semibold uppercase text-white">Change</span>
                                      </div>
                                   </>
                                ) : (
                                   <>
                                      <Plus size={20} className="mb-1" />
                                      <span className="text-[9px] font-semibold uppercase">Upload</span>
                                   </>
                                )}
                             </div>
                             <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                             <div className="flex-1 space-y-4">
                                <Field label="รหัสสินค้า (Product SKU)">
                                   <div className="flex gap-2 relative group">
                                      <PillInput 
                                        value={formData.sku} 
                                        readOnly 
                                        disabled
                                        className="flex-1 h-9 px-6 rounded-full bg-white/5 border-white/5 text-nexus-teal/70 font-black cursor-not-allowed opacity-70 font-mono text-right" 
                                      />
                                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-50">
                                         <ShieldCheck size={14} className="text-nexus-teal" />
                                         <span className="text-[9px] font-semibold uppercase text-nexus-teal">System Locked</span>
                                      </div>
                                   </div>
                                </Field>
                                <Field label="บาร์โค้ด (Barcode)">
                                   <PillInput value={formData.barcode} onChange={(e) => setFormData({...formData, barcode: e.target.value})} className="w-full h-9 px-6 rounded-full font-mono text-right" placeholder="Scan barcode..." />
                                </Field>
                             </div>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-3">
                             <div className="col-span-2">
                                <Field label="ชื่อสินค้า * (Product Name)">
                                   <PillInput value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full h-9 px-6 rounded-full" placeholder="ระบุชื่อพัสดุ / สินค้าใหม่..." />
                                </Field>
                             </div>
                             <div>
                                <Field label="ยี่ห้อ (Brand)">
                                   <PillInput value={formData.brand} onChange={(e) => setFormData({...formData, brand: e.target.value})} className="w-full h-9 px-4 rounded-full" placeholder="NEXUS" />
                                </Field>
                             </div>
                          </div>

                          <div className="grid grid-cols-3 gap-3">
                             <div>
                                <Field label="รุ่นสินค้า (Model)">
                                   <PillInput value={formData.model} onChange={(e) => setFormData({...formData, model: e.target.value})} className="w-full h-9 px-4 rounded-full font-mono text-[13px]" placeholder="เช่น C930e" />
                                </Field>
                             </div>
                             <div>
                                <Field label="รหัสของผู้จำหน่าย (Vendor SKU)">
                                   <PillInput value={formData.supplierSku} onChange={(e) => setFormData({...formData, supplierSku: e.target.value})} className="w-full h-9 px-4 rounded-full font-mono text-[13px]" placeholder="SKU-SUPP-123" />
                                </Field>
                             </div>
                             <div>
                                <Field label="รหัสผู้ผลิต (MPN)">
                                   <PillInput value={formData.mpn} onChange={(e) => setFormData({...formData, mpn: e.target.value})} className="w-full h-9 px-4 rounded-full font-mono text-[13px]" placeholder="Part Number..." />
                                </Field>
                             </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                             <Field label="หมวดหมู่ * (Category)">
                                <div className={cn("relative", isCatFocused && "z-[99999]")}>
                                  <div className="relative">
                                    <PillInput
                                      value={catSearch}
                                      onChange={(e) => {
                                        setCatSearch(e.target.value);
                                        setIsCatFocused(true);
                                      }}
                                      onFocus={() => {
                                         setIsCatFocused(true);
                                         setCatSearch("");
                                      }}
                                      onBlur={() => {
                                         setTimeout(() => {
                                            setIsCatFocused(false);
                                            setCatSearch(categoriesList.find(c => c.id === formData.category)?.label || "");
                                         }, 200);
                                      }}
                                      placeholder="เลือกหรือพิมพ์ใหม่..."
                                      className="w-full h-9 pl-6 pr-10 rounded-full"
                                    />
                                    <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                                  </div>
                                  
                                  {isCatFocused && (
                                    <div className="absolute top-full left-0 mt-2 w-full bg-surface-1 border border-white/10 rounded-2xl shadow-xl z-[99999] overflow-hidden flex flex-col py-2 max-h-48 overflow-y-auto custom-scrollbar">
                                       {filteredCats.map(c => (
                                          <div 
                                             key={c.id} 
                                             className="flex items-center justify-between px-4 py-2 hover:bg-white/5 cursor-pointer group transition-colors"
                                             onClick={() => handleSelectCat(c.id, c.label)}
                                          >
                                             <span className={cn("text-xs font-semibold uppercase", formData.category === c.id ? "text-nexus-teal" : "text-white/70")}>{c.label}</span>
                                             {!c.isSystem && (
                                                <button 
                                                   onClick={(e) => handleDeleteCategory(c.id, e)}
                                                   className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-danger p-1 transition-all"
                                                   title="ลบหมวดหมู่นี้"
                                                >
                                                   <Trash2 size={14} />
                                                </button>
                                             )}
                                          </div>
                                       ))}
                                       {catSearch.trim() && !categoriesList.find(c => c.label.toLowerCase() === catSearch.toLowerCase()) && (
                                          <div 
                                             className="flex items-center px-4 py-2 hover:bg-nexus-teal/10 cursor-pointer text-nexus-teal text-xs font-black"
                                             onClick={handleCreateCat}
                                          >
                                             <Plus size={14} className="mr-2" /> เพิ่ม "{catSearch}"
                                          </div>
                                       )}
                                    </div>
                                  )}
                                </div>
                             </Field>
                             <Field label="คลังสินค้ารับเข้าเริ่มต้น (Default Warehouse)">
                                <PillSelect value={formData.defaultWarehouseId} onChange={(e) => setFormData({...formData, defaultWarehouseId: e.target.value, defaultRackLocation: ""})} className="w-full h-9 px-6 rounded-full font-bold">
                                   {warehouses?.map(wh => <option key={wh.id} value={wh.id}>{wh.name}</option>)}
                                </PillSelect>
                             </Field>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                             <Field label="ตำแหน่งรับเข้าเริ่มต้น (Default Rack Location)">
                                <div className="flex gap-2">
                                   <PillInput value={formData.defaultRackLocation} onChange={(e) => setFormData({...formData, defaultRackLocation: e.target.value})} placeholder="สแกนบาร์โค้ดพิกัด หรือ เลือกจากแผนผัง 3D..." className="flex-1 h-9 px-6 rounded-full font-mono font-bold text-nexus-teal" />
                                   <PillButton variant="glass" onClick={() => setShow3DPicker(true)} className="px-6 h-9 rounded-full hover:text-nexus-teal hover:border-nexus-teal/30 flex items-center gap-2">
                                      <MapPin size={16} className="text-nexus-teal" />
                                      <span>เลือกพิกัด 3D</span>
                                   </PillButton>
                                </div>
                             </Field>
                             <Field label="สถานะสินค้า (Lifecycle Status)">
                                <PillSelect value={formData.lifecycleStatus} onChange={(e) => setFormData({...formData, lifecycleStatus: e.target.value as any})} className="w-full h-9 px-6 rounded-full font-bold text-center">
                                   <option value="DRAFT">ร่างข้อมูล (DRAFT)</option>
                                   <option value="ACTIVE">เปิดใช้งานปกติ (ACTIVE)</option>
                                   <option value="PHASE_OUT">เลิกสั่งซื้อ (PHASE_OUT)</option>
                                   <option value="OBSOLETE">ยกเลิก (OBSOLETE)</option>
                                </PillSelect>
                             </Field>
                          </div>
                           
                           <div className="pt-2 border-t border-white/5 space-y-4 mt-2">
                              <h6 className="text-[10px] font-semibold uppercase text-nexus-teal tracking-widest">หน่วยและขนาดบรรจุภัณฑ์ (UOM & Packaging)</h6>
                              <div className="grid grid-cols-3 gap-4 bg-black/40 p-4 rounded-xl border border-white/5 items-end">
                                 <Field label="หน่วยจัดเก็บ (Package Unit)">
                                    <PillSelect value={formData.packageUnit} onChange={(e) => setFormData({...formData, packageUnit: e.target.value})} className="w-full h-9 px-6 rounded-full text-center">
                                       {uomOptions.map(uom => <option key={uom} value={uom}>{uom}</option>)}
                                    </PillSelect>
                                 </Field>
                                 <Field label={`1 ${formData.packageUnit?.split(' ')[0] || "หน่วยใหญ่"} บรรจุ (Conversion Rate)`}>
                                    <StepperInput value={formData.conversionRate} onChange={(val) => setFormData({...formData, conversionRate: val})} className="text-center text-nexus-teal font-black" />
                                 </Field>
                                 <Field label="หน่วยขาย (Base Unit)">
                                    <PillSelect value={formData.baseUnit} onChange={(e) => setFormData({...formData, baseUnit: e.target.value})} className="w-full h-9 px-6 rounded-full text-center">
                                       {uomOptions.map(uom => <option key={uom} value={uom}>{uom}</option>)}
                                    </PillSelect>
                                 </Field>
                              </div>
                           </div>
                        </div>
                    </div>

                    <div className="space-y-8">
                       <div className="flex items-center gap-3 text-white">
                          <Truck size={18} />
                          <h5 className="text-[13px] font-semibold uppercase tracking-widest">รับเข้า & การเงิน (Inbound & Financials)</h5>
                       </div>
                       <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-6">
                          <div className="grid grid-cols-2 gap-4">
                             <Field label="ผู้จำหน่าย (Supplier)">
                                <PillSelect value={formData.supplierId} onChange={(e) => setFormData({...formData, supplierId: e.target.value})} className="w-full h-9 px-6 rounded-full">
                                   {suppliers?.map(s => (
                                      <option key={s.id} value={s.id}>{s.name}</option>
                                   ))}
                                </PillSelect>
                             </Field>
                             <Field label={`จำนวนรับเข้า * (Receive Qty)`}>
                                <div className="space-y-1.5">
                                   <StepperInput value={formData.qty} onChange={(val) => setFormData({...formData, qty: val})} className="font-black text-nexus-teal" />
                                   {formData.conversionRate > 1 && (
                                      <div className="flex items-center gap-1.5 text-[9px] font-semibold text-white/40 uppercase tracking-widest pl-1">
                                         <Package size={10} className="text-nexus-teal" /> สต๊อกสุทธิ: <span className="text-nexus-teal">{formData.qty * formData.conversionRate} {formData.baseUnit}</span>
                                      </div>
                                   )}
                                </div>
                             </Field>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 bg-black/40 p-4 rounded-xl border border-white/5">
                             <Field label="ราคาต้นทุน * (Cost)">
                                <StepperInput value={formData.cost} onChange={handleCostChange} className="text-danger font-black" />
                             </Field>
                             <Field label="ราคาขาย * (Selling Price)">
                                <div className="space-y-1.5">
                                   <StepperInput value={formData.price} onChange={handlePriceChange} className="text-nexus-teal font-black" />
                                   <div className="flex items-center gap-1.5 text-[9px] font-semibold text-white/30 uppercase tracking-widest pl-1">
                                      <span className="text-nexus-teal/60">💡</span> ราคาแนะนำ (Margin 20%): ฿{(formData.cost / 0.8).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                   </div>
                                </div>
                             </Field>
                             <div className="col-span-2 flex justify-between items-center pt-2 border-t border-white/5">
                                <span className="text-[11px] font-semibold text-white/40 uppercase tracking-widest">กำไรคาดการณ์</span>
                                <span className={cn("text-sm font-black mono-numbers", profit > 0 ? "text-nexus-teal" : "text-white/40")}>
                                   ฿{profit.toLocaleString()} <span className="text-xs">({profitMargin}%)</span>
                               </span>
                             </div>
                          </div>

                          <Field label="หมายเลขซีเรียล (Serial Numbers)">
                             <textarea value={formData.sns} onChange={(e) => setFormData({...formData, sns: e.target.value})} placeholder="Scan or type serial numbers here..." className="w-full h-20 rounded-2xl bg-black/40 border border-white/10 text-white text-[12px] font-mono p-4 custom-scrollbar" />
                          </Field>
                       </div>
                    </div>
                 </div>
               ) : (
                 <div className="space-y-10">
                    <div className="flex items-end gap-4 bg-white/[0.02] p-8 rounded-2xl border border-white/5">
                       <div className="flex-1">
                          <Field label="ค้นหาเลขที่คำสั่งซื้อ * (Search PO)">
                             <div className="relative">
                                <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                                <PillInput value={formData.poRef} onChange={(e) => setFormData({...formData, poRef: e.target.value})} placeholder="ระบุ PO-XXXXX..." className="w-full h-9 pl-12 rounded-full font-mono" />
                             </div>
                          </Field>
                       </div>
                       <PillButton onClick={fetchPOItems} className="px-8 shadow-neon-teal">
                          <Search size={18} />
                          ดึงรายการ
                       </PillButton>
                    </div>

                    <div className="space-y-6">
                       <div className="flex justify-between items-center px-2">
                          <h5 className="text-[11px] font-semibold text-white/40 uppercase tracking-widest">รายการที่รอการรับเข้า ({poItems.length})</h5>
                       </div>
                       {poItems.length === 0 ? (
                          <div className="p-20 border border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center text-center space-y-4">
                             <Package size={48} className="text-white/5" />
                             <p className="text-[11px] text-white/20 font-semibold uppercase tracking-widest">ยังไม่มีรายการ (กรุณาระบุเลขที่ PO)</p>
                          </div>
                       ) : (
                          <div className="space-y-4">
                             {poItems.map((item) => (
                               <div key={item.id} className="bg-white/[0.02] border border-white/5 p-6 rounded-xl flex items-center gap-8 group hover:bg-white/[0.04] transition-all">
                                  <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-white/20 group-hover:text-nexus-teal transition-colors">
                                     <Package size={24} />
                                  </div>
                                  <div className="flex-1">
                                     <p className="text-sm font-semibold text-white uppercase">{item.name}</p>
                                     <p className="text-[10px] text-white/30 font-bold uppercase mt-0.5">{item.sku} • สั่งซื้อ: {item.qtyOrdered}</p>
                                  </div>
                                  <div className="w-24">
                                     <p className="text-[9px] font-semibold text-white/20 uppercase mb-1">รับจริง</p>
                                     <PillInput type="number" value={item.qtyReceived} onChange={(e) => updatePoItem(item.id, "qtyReceived", Number(e.target.value))} className="w-full h-9 px-4 rounded-full text-center font-black text-nexus-teal font-mono" />
                                  </div>
                                  <div className="w-32">
                                     <p className="text-[9px] font-semibold text-white/20 uppercase mb-1">ต้นทุน/หน่วย</p>
                                     <PillInput type="number" value={item.cost} onChange={(e) => updatePoItem(item.id, "cost", Number(e.target.value))} className="w-full h-9 px-4 rounded-full text-center font-black font-mono text-right" />
                                  </div>
                               </div>
                             ))}
                          </div>
                       )}
                    </div>
                 </div>
               )}
            </div>
          </div>
        </div>

        {/* Right validation & summary sidebar */}
        <div className="w-[380px] bg-surface-1 p-12 flex flex-col overflow-y-auto custom-scrollbar shrink-0">
           <div className="flex-1 space-y-10">
              <div className="space-y-1">
                <p className="text-[12px] font-semibold text-white/20 uppercase tracking-[0.2em]">Validation Briefing</p>
                <h5 className="text-sm font-semibold text-white uppercase tracking-tight">Stock Integrity</h5>
              </div>

              <div className="p-8 rounded-2xl bg-nexus-teal/5 border border-nexus-teal/10 space-y-6">
                 {sourceMode === "manual" ? (
                   <NexusDataField label="สถานะรหัส SKU" value={formData.sku ? "PASS" : "WAITING"} highlight={!!formData.sku} />
                 ) : (
                   <NexusDataField label="สถานะการตรวจสอบ PO" value={poItems.length > 0 ? "PASS" : "WAITING"} highlight={poItems.length > 0} />
                 )}
                 <NexusDataField label="มูลค่าต้นทุนรวม" value={`฿${totalCost.toLocaleString()}`} highlight />
              </div>

              <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
                 <p className="text-[11px] text-white/40 font-bold leading-relaxed uppercase tracking-widest">
                    * ข้อมูลสินค้าใหม่จะได้รับการจัดสรรพิกัดและประทับตาเวลาเคลื่อนย้ายของคลังสินค้า โดยทันทีหลังจากกดยืนยัน
                 </p>
              </div>
           </div>

           <div className="space-y-4">
              <PillButton className="w-full px-8 shadow-neon-blue uppercase tracking-[0.2em]" onClick={handleSubmit} disabled={submitting}>
                 {submitting ? <RefreshCw size={18} className="animate-spin" /> : <ShieldCheck size={22} />}
                 {submitting ? "กำลังบันทึก..." : sourceMode === "manual" ? "ยืนยันเพิ่มสินค้า" : "ยืนยันรับจาก PO"}
              </PillButton>
              <PillButton variant="ghost" className="w-full hover: uppercase tracking-widest" onClick={onClose} disabled={submitting}>
                 ยกเลิก
              </PillButton>
           </div>
        </div>
      </div>
    </Modal>

    <Modal isOpen={show3DPicker} onClose={() => setShow3DPicker(false)} title="เครื่องมือเลือกพิกัด 3 มิติ (3D LOCATION PICKER)" maxWidth="max-w-[1400px]">
      <div className="w-full h-[85vh] bg-surface-0 flex flex-col overflow-hidden p-6">
         <div className="flex-1 overflow-hidden relative rounded-2xl border border-white/5 bg-black/40">
            <Warehouse3D 
               pickerMode={true} 
               initialWarehouseId={formData.defaultWarehouseId} 
               onSelectLocation={(loc, whId) => {
                  setFormData({...formData, defaultRackLocation: loc, defaultWarehouseId: whId});
                  setShow3DPicker(false);
               }} 
            />
         </div>
      </div>
    </Modal>
    </>
  );
}

function Field({ label, children }: { label: string, children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <label className="text-[11px] font-semibold text-white/30 uppercase tracking-widest ml-1">{label}</label>
      {children}
    </div>
  );
}

function StepperInput({ value, onChange, className = "" }: { value: number, onChange: (v: number) => void, className?: string }) {
  return (
    <div className="relative flex items-center group">
      <PillInput 
        type="number" 
        value={value === 0 ? "" : value} 
        onChange={(e) => onChange(Number(e.target.value))} 
        onFocus={(e) => e.target.select()}
        className={cn("w-full h-9 px-6 rounded-full pr-8 font-mono text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none", className)} 
      />
      <div className="absolute right-1.5 top-1.5 bottom-1.5 flex flex-col justify-between w-5 rounded-md overflow-hidden bg-white/[0.03] border border-white/5 opacity-50 group-hover:opacity-100 transition-opacity">
        <button 
          onClick={() => onChange((Number(value) || 0) + 1)} 
          className="flex-1 flex items-center justify-center hover:bg-nexus-teal hover:text-black text-white/40 transition-colors"
          tabIndex={-1}
        >
          <div className="w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-b-[4px] border-b-current" />
        </button>
        <div className="h-[1px] w-full bg-white/10" />
        <button 
          onClick={() => onChange(Math.max(0, (Number(value) || 0) - 1))} 
          className="flex-1 flex items-center justify-center hover:bg-danger hover:text-white text-white/40 transition-colors"
          tabIndex={-1}
        >
          <div className="w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[4px] border-t-current" />
        </button>
      </div>
    </div>
  );
}
