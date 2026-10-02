"use client";
import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { normalizePoStatus } from "@/lib/procurement-status";
import { useSystemDialog } from "@/context/DialogContext";
import {
  Package,
  ShieldCheck,
  Truck,
  ArrowLeft,
  FileText
} from "lucide-react";
import {
  PillButton,
  PillInput,
  PillSelect,
  PillTabs,
  GlassCard,
  NexusDatePicker
} from "@/components/ui/Base";
import { DocumentItemsTable } from "@/components/commerce/DocumentItemsTable";
import { formatCurrency } from "@/lib/erp-logic";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { apiFetch } from "@/lib/api-client";
import { db } from "@/lib/firebase-client";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { listLocations } from "@/lib/warehouse-location";

const DEFAULT_WAREHOUSE = "Main Warehouse";

function NewInventoryInScreen() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showAlert, showConfirm } = useSystemDialog();
  const { user, companyId } = useAuth();

  // ข้อมูลจริงของบริษัท
  const { data: suppliers } = useRealtimeCollection<any>("suppliers");
  const { data: warehouses } = useRealtimeCollection<any>("warehouses");
  const { data: rootPOs } = useRealtimeCollection<any>("purchase_orders");
  const { data: companyPOs } = useRealtimeCollection<any>(`companies/${companyId}/purchase_orders`);

  const [activeTab, setActiveTab] = useState("manual");
  const [items, setItems] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [header, setHeader] = useState({
    supplierId: "",
    poRef: "",
    poDocPath: "",
    warehouseId: "",
    date: new Date().toISOString().split('T')[0],
    reference: "",
    note: ""
  });

  // ตำแหน่งรับเข้า:
  //  - ยังไม่มีผังชั้นวาง → เลือกได้แค่คลัง และรับเข้าแบบไม่ระบุตำแหน่ง (ค่า "@WH-01" = ไม่สร้างยอดตามตำแหน่ง)
  //  - มีชั้นวางแล้ว → พื้นที่รับสินค้า (WH-xx-RECV) แล้วจัดเก็บเข้าชั้นภายหลัง หรือเลือกชั้นวางตรง
  const hasRacks = warehouses.some((w: any) => (w.racks || []).length > 0);
  const warehouseOptions = warehouses.length === 0
    ? [{ value: `@${DEFAULT_WAREHOUSE}`, label: "คลังหลัก (ยังไม่ได้ตั้งค่าคลังสินค้า)" }]
    : !hasRacks
      ? warehouses.map((w: any) => {
          const code = w.code || w.warehouseCode || w.id;
          return { value: `@${code}`, label: `${code} : ${w.name || w.warehouseName || code} (ไม่ระบุตำแหน่ง)` };
        })
      : listLocations(warehouses).map((l) => ({ value: l.code, label: l.isReceiving ? `${l.label} (แนะนำ: จัดเก็บเข้าชั้นภายหลัง)` : `${l.code} • ${l.label}` }));
  const warehouseId = header.warehouseId || warehouseOptions[0].value;
  const receiveLocation = warehouseId.startsWith("@") ? "" : warehouseId;           // ส่งเป็นตำแหน่งสต็อก
  const receiveWarehouse = warehouseId.startsWith("@") ? warehouseId.slice(1) : warehouseId.split("-").slice(0, 2).join("-"); // รหัสคลังในเอกสาร

  // ใบสั่งซื้อที่ยังรับไม่ครบ (มีทั้งแบบเก็บที่ root และใต้บริษัท)
  const openPOs = [
    ...rootPOs.map((po: any) => ({ ...po, _path: `purchase_orders/${po.id}` })),
    ...companyPOs.map((po: any) => ({ ...po, _path: `companies/${companyId}/purchase_orders/${po.id}` })),
  ].filter((po: any) => !po.isSample && ["APPROVED", "PARTIAL_RECEIVED"].includes(normalizePoStatus(po.status))); // รับได้เฉพาะใบจริงที่อนุมัติแล้ว (ไม่รวมข้อมูลตัวอย่าง)
  const poLabel = (po: any) => po.poCode || po.documentNo || po.poNo || po.id;

  const supplierName = (id: string) => {
    const sup = suppliers.find((s: any) => s.id === id || s.supplierId === id);
    return sup ? (sup.name || sup.supplierName || sup.companyName || id) : "";
  };

  // ต้นทุนรับเข้า: ตอนเลือกสินค้า ตารางใส่ราคาขาย จึงเปลี่ยนเป็นต้นทุนเฉลี่ยปัจจุบันเป็นค่าเริ่มต้น (แก้ได้)
  const handleItemsChange = (newItems: any[]) => {
    setItems(newItems.map((it) =>
      it.productId && it._costInitFor !== it.productId
        ? { ...it, price: Number(it.cost ?? it.costPrice ?? it.price ?? 0), _costInitFor: it.productId }
        : it
    ));
  };

  const handleBack = async () => {
    const isDirty = items.length > 0 || header.supplierId !== "" || header.poRef !== "";
    if (isDirty) {
      if (await showConfirm("คุณมีการกรอกข้อมูลค้างไว้ ต้องการย้อนกลับโดยไม่บันทึกใช่หรือไม่?")) {
        router.back();
      }
    } else {
      router.back();
    }
  };

  const receivableItems = () => items
    .filter((it) => it.itemType !== "GROUP_HEADER" && it.productId && (Number(it.qty) || 0) > 0)
    .map((it) => ({
      productId: it.productId,
      sku: it.sku || "",
      name: it.name || "",
      unit: it.unit || "",
      qtyReceived: Number(it.qty) || 0,
      unitPrice: Number(it.price) || 0,
      poLineIndex: it.poLineIndex ?? null,
    }));

  const handleSave = async () => {
    if (!companyId || !user) return void showAlert("ไม่พบข้อมูลผู้ใช้หรือรหัสบริษัท กรุณาเข้าสู่ระบบใหม่");
    if (activeTab === "po" && !header.poDocPath) return void showAlert("กรุณาเลือกใบสั่งซื้อ");
    if (activeTab === "manual" && !header.supplierId) return void showAlert("กรุณาเลือกผู้จัดจำหน่าย");
    const lines = receivableItems();
    if (lines.length === 0) return void showAlert("กรุณาเพิ่มรายการสินค้าที่มีในระบบ และจำนวนมากกว่า 0 อย่างน้อย 1 รายการ");

    setSaving(true);
    try {
      const res = await apiFetch("/api/inventory/goods-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          poRef: activeTab === "po" ? header.poRef : "",
          supplier: supplierName(header.supplierId) || header.supplierId,
          receiptDate: header.date,
          deliveryNote: header.reference,
          receivedBy: user.email || user.uid,
          warehouse: receiveLocation,
          warehouseCode: receiveWarehouse,
          items: lines,
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || "บันทึกรับสินค้าไม่สำเร็จ");

      // อัปเดตจำนวนที่รับแล้วในใบสั่งซื้อ
      if (activeTab === "po" && header.poDocPath) {
        const po = openPOs.find((p: any) => p._path === header.poDocPath);
        if (po) {
          const poItems = (po.items || []).map((pi: any, idx: number) => {
            const got = lines.filter((l) => l.poLineIndex === idx).reduce((sum, l) => sum + l.qtyReceived, 0);
            return { ...pi, qtyReceived: (Number(pi.qtyReceived) || 0) + got };
          });
          const allReceived = poItems.every((pi: any) => (Number(pi.qtyReceived) || 0) >= (Number(pi.qty ?? pi.qtyOrdered) || 0));
          await updateDoc(doc(db, header.poDocPath), {
            items: poItems,
            status: allReceived ? "RECEIVED" : "PARTIAL_RECEIVED",
            updatedAt: serverTimestamp(),
          });
        }
      }

      showAlert(`บันทึกรับสินค้าเข้าคลังเรียบร้อย (เลขที่ ${result.grId}) มูลค่า ${formatCurrency(result.totalAmount)}`);
      router.push(receiveLocation.endsWith("-RECV") ? "/inventory/putaway" : "/inventory");
    } catch (err: any) {
      console.error("[GR_SAVE_ERROR]", err);
      showAlert(`บันทึกไม่สำเร็จ: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const selectPO = (path: string) => {
    const po = openPOs.find((p: any) => p._path === path);
    if (!po) {
      setHeader((prev) => ({ ...prev, poDocPath: "", poRef: "", supplierId: "" }));
      setItems([]);
      return;
    }
    setHeader((prev) => ({ ...prev, poDocPath: path, poRef: poLabel(po), supplierId: po.supplierId || "" }));
    // รายการที่ยังรับไม่ครบ: จำนวนคงค้าง = สั่ง - รับแล้ว, ต้นทุน = ราคาในใบสั่งซื้อ
    setItems((po.items || [])
      .map((pi: any, idx: number) => ({
        id: `${po.id}-${idx}`,
        poLineIndex: idx,
        productId: pi.productId,
        sku: pi.sku,
        name: pi.name || pi.description,
        unit: pi.unit,
        qty: Math.max(0, (Number(pi.qty ?? pi.qtyOrdered) || 0) - (Number(pi.qtyReceived) || 0)),
        price: Number(pi.price ?? pi.unitCost ?? pi.cost ?? 0),
        cost: Number(pi.price ?? pi.unitCost ?? pi.cost ?? 0),
        itemType: pi.itemType || "PRODUCT",
        _costInitFor: pi.productId,
      }))
      .filter((it: any) => it.qty > 0));
  };

  // มาจากหน้าใบสั่งซื้อ (?po=companies/.../purchase_orders/PO-xxx): เลือกใบสั่งซื้อให้อัตโนมัติ
  const poParam = searchParams.get("po") || "";
  useEffect(() => {
    if (!poParam || header.poDocPath) return;
    if (openPOs.some((p: any) => p._path === poParam)) {
      setActiveTab("po");
      selectPO(poParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poParam, openPOs.length]);

  const totalCost = items.reduce((acc, i) => acc + ((Number(i.qty) || 0) * (Number(i.price) || 0)), 0);

  const headerContent = (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-6 rounded-3xl backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <PillButton variant="glass" onClick={handleBack} className="w-10 h-10 p-0 flex items-center justify-center">
          <ArrowLeft size={20} />
        </PillButton>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-white uppercase tracking-tight">
              บันทึกรับสินค้าเข้าคลัง
            </h1>
            <span className="px-3 py-1 rounded-full bg-nexus-teal/10 border border-nexus-teal/30 text-nexus-teal text-sm font-mono font-bold select-none cursor-default pointer-events-none">
              GR-NEW
            </span>
          </div>
          <p className="text-sm text-white/60 font-medium mt-1">
            รับสินค้าเข้าคลังสินค้า อ้างอิงใบสั่งซื้อหรือรับเข้าโดยตรง (ปรับสต็อก ต้นทุนเฉลี่ย และลงบัญชีสินค้าคงเหลือ/เจ้าหนี้)
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
        <PillTabs
          tabs={[
            { id: "manual", label: "รับเข้าด้วยตนเอง", icon: <Package size={14} /> },
            { id: "po", label: "รับจากใบสั่งซื้อ (PO)", icon: <FileText size={14} /> }
          ]}
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            setItems([]);
            setHeader(prev => ({ ...prev, poRef: "", poDocPath: "", supplierId: "" }));
          }}
        />
        <PillButton variant="glass" className="h-8 px-4 text-xs font-bold text-white/50" onClick={handleBack}>
          ยกเลิก
        </PillButton>
        <PillButton variant="save" className="h-8 px-5 font-bold text-xs" onClick={handleSave} disabled={saving}>
          <ShieldCheck size={14} className="mr-1.5" /> {saving ? "กำลังบันทึก..." : "บันทึกรับเข้าคลัง"}
        </PillButton>
      </div>
    </div>
  );

  const leftContent = (
    <div className="space-y-4">
      <GlassCard className="p-8 space-y-8 animate-in fade-in duration-500 min-h-[60vh] border-white/5 bg-black/20">

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <Field label="วันที่ทำรายการ (Date) *">
              <NexusDatePicker value={header.date}
                onChange={(e) => setHeader({...header, date: e.target.value})}
                className="w-full h-9 rounded-full px-6"
              />
            </Field>
            <Field label="ตำแหน่งรับเข้า (Location)">
              <PillSelect
                value={warehouseId}
                onChange={(e) => setHeader({...header, warehouseId: e.target.value})}
                className="w-full text-cyan-400 border-cyan-500/30 font-bold h-9 rounded-full px-6"
              >
                {warehouseOptions.map((w) => (
                  <option key={w.value} value={w.value}>{w.label}</option>
                ))}
              </PillSelect>
            </Field>
          </div>

          {activeTab === "po" ? (
            <div className="grid grid-cols-2 gap-6">
              <Field label="อ้างอิงใบสั่งซื้อ (PO Reference) *">
                <PillSelect
                  value={header.poDocPath}
                  onChange={(e) => selectPO(e.target.value)}
                  className="w-full text-amber-400 border-amber-500/30 h-9 rounded-full px-6 font-mono text-[13px]"
                >
                  <option value="">{openPOs.length === 0 ? "-- ไม่มีใบสั่งซื้อที่รอรับสินค้า --" : "-- เลือกใบสั่งซื้อ --"}</option>
                  {openPOs.map((po: any) => (
                    <option key={po._path} value={po._path}>{poLabel(po)} • {po.supplierName || supplierName(po.supplierId) || "-"}</option>
                  ))}
                </PillSelect>
              </Field>
              <Field label="ผู้จัดจำหน่าย (Supplier)">
                <PillInput
                  value={supplierName(header.supplierId) || "-- อ้างอิงจาก PO --"}
                  readOnly
                  className="w-full h-9 rounded-full px-6 opacity-60"
                />
              </Field>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-6">
              <Field label="ผู้จัดจำหน่าย (Supplier) *">
                <PillSelect
                  value={header.supplierId}
                  onChange={(e) => setHeader({...header, supplierId: e.target.value})}
                  className="w-full h-9 rounded-full px-6"
                >
                  <option value="">{suppliers.length === 0 ? "ยังไม่มีข้อมูลผู้จัดจำหน่าย" : "เลือกคู่ค้า..."}</option>
                  {suppliers.map((sup: any) => (
                    <option key={sup.id} value={sup.id}>{sup.name || sup.supplierName || sup.companyName || sup.id}</option>
                  ))}
                </PillSelect>
              </Field>
              <Field label="เอกสารอ้างอิง (Ref. No.)">
                <PillInput
                  value={header.reference}
                  onChange={(e) => setHeader({...header, reference: e.target.value})}
                  placeholder="เช่น เลขที่ใบส่งของของผู้จำหน่าย"
                  className="w-full h-9 rounded-full px-6 font-mono text-[13px]"
                />
              </Field>
            </div>
          )}
        </div>

        <div className="space-y-4 pt-6 border-t border-white/5">
          <div className="flex items-center gap-2 mb-2">
            <Truck size={16} className="text-white/40" />
            <h4 className="text-[13px] font-semibold text-white/60 uppercase tracking-widest">รายการสินค้า (Items)</h4>
          </div>
          <p className="text-[11px] text-white/40">
            ช่อง &quot;ราคา&quot; ในตาราง = ต้นทุนต่อหน่วยที่รับเข้า (ค่าเริ่มต้นคือต้นทุนเฉลี่ยปัจจุบัน หรือราคาในใบสั่งซื้อ) ใช้คำนวณต้นทุนเฉลี่ยใหม่และลงบัญชีสินค้าคงเหลือ
          </p>
          <DocumentItemsTable
            items={items}
            onChange={handleItemsChange}
          />
        </div>

        <div className="space-y-6 pt-6 border-t border-white/5">
          <Field label="หมายเหตุ (Remarks)">
            <textarea
              className="w-full h-24 rounded-2xl bg-white/[0.03] border border-white/10 text-white text-[14px] p-4 focus:outline-none focus:border-cyan-400/40 transition-all custom-scrollbar"
              value={header.note}
              onChange={(e) => setHeader({...header, note: e.target.value})}
              placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)..."
            />
          </Field>
        </div>

      </GlassCard>
    </div>
  );

  const rightSidebar = (
    <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-5 shadow-2xl space-y-6 sticky top-0">
      <div className="space-y-1 border-b border-white/5 pb-4">
        <p className="text-[12px] font-semibold text-white/20 uppercase tracking-[0.2em]">สรุปการรับเข้า</p>
        <h5 className="text-[13px] font-black text-white/80 uppercase tracking-widest flex items-center gap-2">Receipt Summary</h5>
      </div>

      <div className="relative z-10 space-y-4">
        <div className="flex justify-between items-center pb-4 border-b border-white/5">
          <span className="text-[11px] text-white/60 font-semibold uppercase tracking-widest">จำนวนรายการ</span>
          <span className="text-[14px] font-mono font-bold text-white">{items.length} รายการ</span>
        </div>
        <div className="flex justify-between items-center pb-4 border-b border-white/5">
          <span className="text-[11px] text-white/60 font-semibold uppercase tracking-widest">จำนวนชิ้นรวม</span>
          <span className="text-[14px] font-mono font-bold text-white">{items.reduce((acc, i) => acc + (Number(i.qty) || 0), 0)} ชิ้น</span>
        </div>
        <div className="flex justify-between items-end pt-2">
          <span className="text-[12px] text-white/80 font-semibold uppercase tracking-widest">มูลค่าต้นทุนรวม</span>
          <span className="text-xl font-mono font-black text-emerald-400 drop-shadow-neon text-right">{formatCurrency(totalCost)}</span>
        </div>
      </div>

      {/* Background glow */}
      <div className="absolute bottom-0 right-0 w-48 h-48 bg-emerald-500/10 blur-[60px] translate-x-1/4 translate-y-1/4 rounded-full pointer-events-none" />
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

function Field({ label, children, required }: { label: string, children: React.ReactNode, required?: boolean }) {
  const cleanLabel = label.replace('*', '').trim();
  const hasAsterisk = required || label.includes('*');
  const parts = cleanLabel.split(' (');
  const thaiText = parts[0];
  const engText = parts.length > 1 ? '(' + parts[1] : '';

  return (
    <div className="space-y-2 w-full flex flex-col items-start justify-center">
      <label className="text-[12px] font-bold text-white/70 flex flex-wrap items-center gap-1 ml-1">
        <span className="flex items-center">
          {thaiText}
          {hasAsterisk && <span className="text-danger ml-1 font-bold">*</span>}
        </span>
        {engText && <span className="text-white/40 font-normal uppercase tracking-widest text-[10px]">{engText}</span>}
      </label>
      {children}
    </div>
  );
}

export default function NewInventoryInPage() {
  return (
    <Suspense fallback={<div className="p-10 text-white/40 text-sm">กำลังโหลด...</div>}>
      <NewInventoryInScreen />
    </Suspense>
  );
}
