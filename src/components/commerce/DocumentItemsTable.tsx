"use client";

import React, { useState, useMemo, useRef, useLayoutEffect } from "react";
import { Plus, Trash2, Search, ChevronUp, ChevronDown, CornerDownRight, AlignLeft, Copy, AlertTriangle } from "lucide-react";
import { PillButton, Modal, cn } from "@/components/ui/Base";
import { formatCurrency, calculateLineGP } from "@/lib/erp-logic";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { useAuth } from "@/context/AuthContext";
import { can, canViewCost } from "@/lib/permissions";
import { SupplierPriceSelector } from "@/components/inventory/SupplierPriceSelector";
import { SciFiDropdownPortal } from "@/components/ui/SmartComponents";

export interface DocumentItemsTableProps {
  items: any[];
  onChange: (newItems: any[], summary?: { subtotal: number, taxAmount: number, grandTotal: number }) => void;
  isLocked?: boolean;
  taxType?: any;
  priceDeviationWarningPercent?: number;
}

/* ---------------------------------------------------------------------------
 * คอลัมน์ปรับตามความกว้างจริงของตาราง (13"-27" และหน้าที่วางตารางในพื้นที่แคบ)
 * - ทุกแถวเป็นบรรทัดเดียว ไม่มี scrollbar แนวนอน
 * - คอลัมน์ที่ไม่พอแสดง ย้ายไปอยู่ในแผง "รายละเอียดเพิ่มเติม" ของแต่ละรายการ (ข้อมูลไม่หาย)
 * ------------------------------------------------------------------------- */
type ColKey = "seq" | "type" | "sku" | "name" | "more" | "qty" | "unit" | "price" | "discount" | "wht" | "amount" | "actions";
type Tier = "full" | "mid" | "small" | "compact";

const COL_LABEL: Record<ColKey, string> = {
  seq: "ที่", type: "ประเภท", sku: "รหัสสินค้า", name: "รายการสินค้า / บริการ", more: "",
  qty: "จำนวน", unit: "หน่วย", price: "ราคา/หน่วย", discount: "ส่วนลด", wht: "WHT %", amount: "จำนวนเงิน", actions: "",
};
const COL_ALIGN: Partial<Record<ColKey, string>> = { name: "text-left", price: "text-right", amount: "text-right" };

// ความกว้างแต่ละคอลัมน์ต่อระดับ (ผลรวม + ช่องว่าง ต้องไม่เกินเกณฑ์ใน pickTier)
const TIER_COLUMNS: Record<Tier, [ColKey, string][]> = {
  full: [["seq", "28px"], ["type", "76px"], ["sku", "100px"], ["name", "minmax(160px,1fr)"], ["more", "28px"], ["qty", "60px"], ["unit", "56px"], ["price", "92px"], ["discount", "84px"], ["wht", "56px"], ["amount", "100px"], ["actions", "56px"]],
  mid: [["seq", "28px"], ["sku", "88px"], ["name", "minmax(160px,1fr)"], ["more", "28px"], ["qty", "56px"], ["price", "92px"], ["amount", "96px"], ["actions", "56px"]],
  small: [["seq", "28px"], ["name", "minmax(136px,1fr)"], ["more", "28px"], ["qty", "60px"], ["price", "92px"], ["amount", "96px"], ["actions", "56px"]],
  compact: [["seq", "24px"], ["name", "minmax(96px,1fr)"], ["more", "28px"], ["qty", "52px"], ["amount", "88px"]],
};

function pickTier(width: number): Tier {
  if (width >= 980) return "full";
  if (width >= 680) return "mid";
  if (width >= 552) return "small";
  return "compact";
}

const gridStyle = (tier: Tier): React.CSSProperties => ({
  gridTemplateColumns: TIER_COLUMNS[tier].map(([, w]) => w).join(" "),
});

// คงไว้เพื่อความเข้ากันได้กับโค้ดที่ import ไปใช้
export const ITEM_GRID = "grid items-center gap-x-1.5";

const CompactVerticalStepperInput = ({ value, onChange, min = 0 }: { value: number, onChange: (val: number) => void, min?: number }) => {
  return (
    <div className="relative flex items-center bg-transparent border border-white/20 hover:border-white/30 rounded-full h-8 w-full group/stepper transition-colors focus-within:border-nexus-teal/50 focus-within:bg-white/[0.02]">
      <input
        type="number"
        value={value === 0 ? "" : value}
        onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
        onFocus={(e) => e.target.select()}
        className="flex-1 w-full h-full bg-transparent text-center font-mono text-[13px] font-black text-white px-1 focus:outline-none placeholder:text-white/70 rounded-full not-italic [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        min={min}
      />
      <div className="absolute right-1 top-1 bottom-1 flex flex-col items-center justify-between w-4 opacity-0 group-hover/stepper:opacity-100 focus-within:opacity-100 transition-opacity bg-black/40 rounded-full overflow-hidden border border-white/10">
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="w-full h-1/2 flex items-center justify-center text-nexus-teal hover:text-white hover:bg-nexus-teal/20 transition-all"
        >
          <ChevronUp size={9} strokeWidth={3} />
        </button>
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          className="w-full h-1/2 flex items-center justify-center text-nexus-teal hover:text-white hover:bg-nexus-teal/20 transition-all"
        >
          <ChevronDown size={9} strokeWidth={3} />
        </button>
      </div>
    </div>
  );
};

const ProductPickerList = ({ products, onPick }: { products: any[], onPick: (p: any) => void }) => (
  <>
    <div className="p-2 border-b border-white/10 text-[12px] font-bold text-nexus-teal tracking-wider flex items-center justify-between">
      <span>เลือกรายการสินค้า</span>
      <span className="text-[12px] text-white/60 font-mono">{products.length} รายการ</span>
    </div>
    <div className="max-h-[260px] overflow-y-auto custom-scrollbar p-1 space-y-1">
      {products.length > 0 ? (
        products.map((p: any) => {
          const displaySku = p.sku || p.productCode || p.code || p.id;
          const displayName = p.name || p.productName || "Unnamed Product";
          const displayPrice = p.price ?? p.unitPrice ?? p.retailPrice ?? p.pricing?.pricePOS ?? p.pricing?.priceProject ?? 0;
          const displayStock = p.currentStock ?? p.stock ?? p.quantity;
          return (
            <button
              key={p.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onPick(p);
              }}
              className="w-full text-left px-3 py-2 rounded-xl text-[12px] hover:bg-nexus-teal/15 border border-transparent hover:border-nexus-teal/30 flex items-center justify-between gap-2 transition-all cursor-pointer group/item"
            >
              <div className="w-[110px] shrink-0 font-mono text-[12px] text-nexus-teal font-bold break-all">{displaySku}</div>
              <div className="flex-1 min-w-0">
                <span className="font-bold text-white group-hover/item:text-nexus-teal flex items-center gap-2 flex-wrap">
                  <span>{displayName}</span>
                  {displayStock !== undefined && (
                    <span className={cn("text-[12px] font-normal border px-2 py-0.5 rounded-full whitespace-nowrap shrink-0", displayStock === 0 ? "text-danger bg-danger/10 border-danger/30 font-bold" : "text-nexus-teal/70 bg-nexus-teal/10 border-nexus-teal/20")}>
                      {displayStock === 0 ? "สินค้าหมดคลัง" : `คลัง: ${displayStock}`}
                    </span>
                  )}
                </span>
              </div>
              <div className="text-right shrink-0 font-mono text-[12px] font-bold text-white/90">{formatCurrency(displayPrice)}</div>
            </button>
          );
        })
      ) : (
        <div className="p-4 text-center text-[12px] text-nexus-teal/50 font-mono">ไม่พบข้อมูลสินค้าในฐานข้อมูล</div>
      )}
    </div>
  </>
);

const InlineRow = ({
  item,
  index,
  tier,
  updateItem,
  updateItemFields,
  onProductSelected,
  removeItem,
  duplicateItem,
  isLocked,
  availableProducts,
  priceDeviationWarningPercent = 10
}: any) => {
  const { role, checkPermission } = useAuth();
  const canEditProduct = checkPermission ? checkPermission("inventory:edit") : can(role, "inventory:edit");
  const canSeeCost = canViewCost(role);
  const [activeSearchField, setActiveSearchField] = useState<'sku' | 'name' | null>(null);
  const [searchTerm, setSearchTerm] = useState(item.productId ? item.name : "");
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const matchedProduct = useMemo(() => {
    if (!item.productId && !item.sku) return null;
    return availableProducts.find((p: any) => p.id === item.productId || (item.sku && (p.sku === item.sku || p.code === item.sku)));
  }, [availableProducts, item.productId, item.sku]);

  const standardPrice = matchedProduct ? Number(matchedProduct.price || 0) : 0;
  const thresholdPrice = standardPrice > 0 ? standardPrice * (1 - (priceDeviationWarningPercent || 10) / 100) : 0;
  const isBelowStandard = standardPrice > 0 && Number(item.price || 0) > 0 && Number(item.price || 0) < thresholdPrice;
  const deviationPercent = isBelowStandard ? Math.round(((standardPrice - Number(item.price || 0)) / standardPrice) * 100) : 0;

  const filteredProducts = useMemo(() => {
    if (!searchTerm || !searchTerm.trim()) return availableProducts;
    const lower = searchTerm.trim().toLowerCase();
    if (item.productId && (lower === (item.name || "").toLowerCase() || lower === (item.sku || "").toLowerCase())) {
      return availableProducts;
    }
    return availableProducts.filter((p: any) => {
      const skuMatch = (p.sku || p.productCode || p.code || p.id || "").toLowerCase().includes(lower);
      const nameMatch = (p.name || p.productName || "").toLowerCase().includes(lower);
      return skuMatch || nameMatch;
    });
  }, [availableProducts, searchTerm, item.productId, item.name, item.sku]);

  const handleSelectProduct = (product: any) => {
    const pId = product.id;
    const pSku = product.sku || product.productCode || product.code || product.id;
    const pName = product.name || product.productName || "Unnamed Product";
    const pUnit = product.unit || product.productUnit || "ชิ้น";
    const pPrice = product.price ?? product.unitPrice ?? product.retailPrice ?? product.pricing?.pricePOS ?? product.pricing?.priceProject ?? 0;
    const pCost = product.cost ?? product.costPrice ?? product.costWAC ?? product.pricing?.costWAC ?? 0;
    const pStock = product.currentStock ?? product.stock ?? product.quantity ?? 0;
    const pItemType = product.itemType || "PRODUCT";

    const selectedObj = {
      productId: pId,
      sku: pSku,
      name: pName,
      unit: pUnit,
      price: pPrice,
      cost: pCost,
      costPrice: pCost,
      currentStock: pStock,
      itemType: pItemType,
      whtRate: pItemType === 'SERVICE' || pItemType === 'LABOR' ? 3 : 0,
      details: product.details || product.description || "",
      datasheetUrl: product.datasheetUrl || ""
    };

    if (onProductSelected) {
      onProductSelected(item.id, selectedObj);
    } else {
      updateItemFields(item.id, selectedObj);
    }
    setSearchTerm(pName);
    setActiveSearchField(null);
  };

  const isGroupHeader = item.itemType === 'GROUP_HEADER';
  const hasDetails = !!(item.details || item.datasheetUrl);
  const isOutOfStock = item.itemType === 'PRODUCT' && item.currentStock !== undefined && Number(item.currentStock) === 0;

  const lineSubtotal = (Number(item.qty) || 0) * (Number(item.price) || 0);
  const lineDiscountVal = Number(item.discountValue) || 0;
  const lineDiscountAmt = item.discountType === 'PERCENT'
    ? lineSubtotal * (lineDiscountVal / 100)
    : lineDiscountVal;
  const lineFinalAmount = Math.max(0, lineSubtotal - lineDiscountAmt);
  const lineGP = calculateLineGP(item.price, item.cost ?? item.costPrice ?? 0);

  const handleItemTypeChange = (newType: string) => {
    let defaultWht = item.whtRate;
    if (newType === 'PRODUCT') defaultWht = 0;
    else if (newType === 'SERVICE' || newType === 'LABOR') defaultWht = 3;
    else if (newType === 'GROUP_HEADER') defaultWht = 0;

    updateItemFields(item.id, {
      itemType: newType,
      whtRate: defaultWht,
      ...(newType === 'GROUP_HEADER' ? { qty: 0, price: 0 } : {})
    });
  };

  if (isGroupHeader) {
    return (
      <div className="px-3 py-2 bg-nexus-teal/10 border-b border-nexus-teal/20 border-l-4 border-l-nexus-teal flex items-center justify-between gap-3 my-1">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-[12px] font-bold text-nexus-teal tracking-widest px-2.5 py-0.5 rounded-full bg-nexus-teal/20 border border-nexus-teal/30 whitespace-nowrap">
            หัวข้อกลุ่ม
          </span>
          <input
            type="text"
            value={item.name || ""}
            onChange={(e) => updateItem(item.id, "name", e.target.value)}
            disabled={isLocked}
            placeholder="ระบุชื่อหัวข้อกลุ่ม (เช่น: หมวดหมู่อุปกรณ์เครือข่าย)..."
            className="flex-1 min-w-0 bg-transparent text-[13px] font-bold text-white focus:outline-none placeholder:text-white/70"
          />
        </div>
        <div className="flex items-center gap-1">
          {!isLocked && (
            <>
              <button type="button" onClick={() => duplicateItem(item.id)} className="p-1 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors" title="ทำซ้ำแถว">
                <Copy size={13} />
              </button>
              <button type="button" onClick={() => removeItem(item.id)} className="p-1 rounded-full text-danger/60 hover:text-danger hover:bg-danger/10 transition-colors" title="ลบแถว">
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  /* ---------- ตัวแก้ไขแต่ละช่อง (ใช้ได้ทั้งในแถวและในแผงรายละเอียด) ---------- */

  const renderType = () => !isLocked ? (
    <select
      value={item.itemType || 'PRODUCT'}
      onChange={(e) => handleItemTypeChange(e.target.value)}
      className="w-full h-8 px-1 rounded-full bg-black/30 border border-white/15 text-center font-bold text-[12px] text-nexus-teal focus:outline-none focus:border-nexus-teal transition-colors"
    >
      <option value="PRODUCT" className="bg-neutral-900 text-white">สินค้า</option>
      <option value="SERVICE" className="bg-neutral-900 text-white">บริการ</option>
      <option value="LABOR" className="bg-neutral-900 text-white">ค่าแรง</option>
      <option value="GROUP_HEADER" className="bg-neutral-900 text-white">หัวข้อกลุ่ม</option>
    </select>
  ) : (
    <span className="text-[12px] font-bold text-white/70">
      {item.itemType === 'SERVICE' ? 'บริการ' : item.itemType === 'LABOR' ? 'ค่าแรง' : 'สินค้า'}
    </span>
  );

  const renderSku = () => !isLocked ? (
    <SciFiDropdownPortal
      isOpen={activeSearchField === 'sku'}
      onClose={() => {
        setActiveSearchField(null);
        if (!item.productId && searchTerm && searchTerm.trim() !== "") {
          updateItem(item.id, "sku", searchTerm.trim());
        }
      }}
      align="left"
      className="w-[440px] max-w-[90vw] p-2 bg-surface-2/95 backdrop-blur-xl border border-nexus-teal/30 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.95),0_0_20px_rgba(0,255,255,0.2)]"
      trigger={
        <div
          onClick={() => {
            setSearchTerm(item.sku || "");
            setActiveSearchField('sku');
          }}
          title={item.sku || undefined}
          className={cn(
            "w-full h-8 px-2 rounded-full bg-black/30 border flex items-center justify-between gap-1 transition-all cursor-pointer group/trigger",
            activeSearchField === 'sku' ? "border-nexus-teal ring-1 ring-nexus-teal/50 bg-black/50" : "border-white/15 hover:border-nexus-teal/40 hover:bg-white/[0.04]"
          )}
        >
          <input
            type="text"
            placeholder="รหัส..."
            value={activeSearchField === 'sku' ? searchTerm : (item.sku || "")}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              if (activeSearchField !== 'sku') setActiveSearchField('sku');
            }}
            onFocus={() => {
              setSearchTerm(item.sku || "");
              setActiveSearchField('sku');
            }}
            className="w-full min-w-0 bg-transparent text-center font-mono text-[12px] text-nexus-teal font-bold focus:outline-none placeholder:text-white/70 placeholder:font-sans placeholder:font-normal cursor-text"
          />
          <ChevronDown size={12} className={cn("text-nexus-teal/60 group-hover/trigger:text-nexus-teal shrink-0 transition-transform duration-200", activeSearchField === 'sku' && "rotate-180 text-nexus-teal")} />
        </div>
      }
    >
      <ProductPickerList products={filteredProducts} onPick={handleSelectProduct} />
    </SciFiDropdownPortal>
  ) : (
    <p className="font-mono text-[12px] text-nexus-teal px-1 not-italic break-all">{item.sku || "-"}</p>
  );

  const renderName = () => !isLocked ? (
    <SciFiDropdownPortal
      isOpen={activeSearchField === 'name'}
      onClose={() => {
        setActiveSearchField(null);
        if (!item.productId && searchTerm && searchTerm.trim() !== "") {
          updateItem(item.id, "name", searchTerm.trim());
        }
      }}
      align="left"
      className="w-[500px] max-w-[90vw] p-2 bg-surface-2/95 backdrop-blur-xl border border-nexus-teal/30 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.95),0_0_20px_rgba(0,255,255,0.2)]"
      trigger={
        <div
          onClick={() => {
            setSearchTerm(item.name || "");
            setActiveSearchField('name');
          }}
          title={item.name || undefined}
          className={cn(
            "w-full h-8 px-2.5 rounded-full bg-black/30 border flex items-center justify-between gap-2 transition-all cursor-pointer group/trigger",
            activeSearchField === 'name' ? "border-nexus-teal ring-1 ring-nexus-teal/50 bg-black/50" : "border-white/15 hover:border-nexus-teal/40 hover:bg-white/[0.04]"
          )}
        >
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <Search size={12} className="text-nexus-teal/60 shrink-0" />
            <input
              type="text"
              placeholder="เลือก/ค้นหาชื่อสินค้า..."
              value={activeSearchField === 'name' ? searchTerm : (item.name || "")}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (activeSearchField !== 'name') setActiveSearchField('name');
              }}
              onFocus={() => {
                setSearchTerm(item.name || "");
                setActiveSearchField('name');
              }}
              className="w-full min-w-0 bg-transparent text-[12px] text-white font-bold focus:outline-none placeholder:text-white/70 placeholder:font-normal cursor-text"
            />
          </div>
          <ChevronDown size={12} className={cn("text-nexus-teal/60 group-hover/trigger:text-nexus-teal shrink-0 transition-transform duration-200", activeSearchField === 'name' && "rotate-180 text-nexus-teal")} />
        </div>
      }
    >
      <ProductPickerList products={filteredProducts} onPick={handleSelectProduct} />
    </SciFiDropdownPortal>
  ) : (
    <p className="font-bold text-[12px] text-white px-2 break-words leading-snug">{item.name}</p>
  );

  const renderQty = () => !isLocked ? (
    <CompactVerticalStepperInput value={item.qty} onChange={(val) => updateItem(item.id, "qty", val)} min={1} />
  ) : (
    <div className="text-center"><span className="font-mono text-[13px] text-white/80 not-italic">{item.qty}</span></div>
  );

  const renderUnit = () => !isLocked ? (
    <input
      type="text"
      value={item.unit || ""}
      onChange={(e) => updateItem(item.id, "unit", e.target.value)}
      className="w-full h-8 px-1 rounded-full bg-black/20 border border-white/20 hover:border-white/30 focus:bg-white/[0.02] text-center font-bold text-[12px] text-white/80 focus:outline-none focus:border-nexus-teal transition-colors not-italic"
    />
  ) : (
    <div className="text-center"><p className="font-bold text-[12px] text-white/60 not-italic">{item.unit || "ชิ้น"}</p></div>
  );

  const priceText = item.price ? Number(item.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
  const renderPrice = () => !isLocked ? (
    isEditingPrice ? (
      <input
        type="number"
        autoFocus
        value={item.price === 0 ? "" : item.price}
        onChange={(e) => updateItem(item.id, "price", Number(e.target.value) || 0)}
        onFocus={(e) => e.target.select()}
        onBlur={() => setIsEditingPrice(false)}
        className={cn(
          "w-full h-8 px-1.5 rounded-full bg-black/20 border hover:border-white/30 focus:bg-white/[0.02] text-right font-mono text-[12px] text-white/80 focus:outline-none focus:border-nexus-teal transition-colors not-italic [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
          isBelowStandard ? "border-warning/60" : "border-white/20"
        )}
      />
    ) : (
      <input
        type="text"
        readOnly
        value={priceText}
        onClick={() => setIsEditingPrice(true)}
        onFocus={() => setIsEditingPrice(true)}
        title={isBelowStandard ? `ต่ำกว่าราคามาตรฐาน ${deviationPercent}%` : undefined}
        className={cn(
          "w-full h-8 px-1.5 rounded-full bg-black/20 border hover:border-white/30 text-right font-mono text-[12px] focus:outline-none transition-colors not-italic cursor-text",
          isBelowStandard ? "border-warning/60 text-warning" : "border-white/20 text-white/80"
        )}
      />
    )
  ) : (
    <div className="text-right"><p className="font-mono text-[12px] text-white/80 not-italic">{priceText || "0.00"}</p></div>
  );

  const renderDiscount = () => !isLocked ? (
    <div className="flex items-center w-full h-8 bg-black/20 border border-white/20 hover:border-white/30 rounded-full p-0.5 focus-within:border-nexus-teal">
      <button
        type="button"
        onClick={() => updateItem(item.id, "discountType", item.discountType === 'AMOUNT' ? 'PERCENT' : 'AMOUNT')}
        className="w-5 h-6 rounded-full bg-nexus-teal/20 hover:bg-nexus-teal/30 text-nexus-teal text-[12px] font-black flex items-center justify-center transition-colors shrink-0"
        title="สลับประเภทส่วนลด (% หรือ บาท)"
      >
        {item.discountType === 'AMOUNT' ? '฿' : '%'}
      </button>
      <input
        type="number"
        value={item.discountValue === 0 ? "" : item.discountValue}
        onChange={(e) => updateItem(item.id, "discountValue", Number(e.target.value) || 0)}
        placeholder="0"
        onFocus={(e) => e.target.select()}
        className="w-full min-w-0 bg-transparent text-right font-mono text-[12px] text-white px-1 focus:outline-none placeholder:text-white/70 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
    </div>
  ) : (
    <div className="text-center font-mono text-[12px] text-white/60">
      {item.discountValue ? `${item.discountValue}${item.discountType === 'AMOUNT' ? '฿' : '%'}` : '-'}
    </div>
  );

  const renderWht = () => !isLocked ? (
    <select
      value={item.whtRate || 0}
      onChange={(e) => updateItem(item.id, "whtRate", Number(e.target.value) || 0)}
      className="w-full h-8 px-1 rounded-full bg-black/20 border border-white/20 hover:border-white/30 text-center font-mono text-[12px] text-white/80 focus:outline-none focus:border-nexus-teal transition-colors"
    >
      {[0, 1, 2, 3, 5].map((r) => <option key={r} value={r} className="bg-neutral-900 text-white">{r}%</option>)}
    </select>
  ) : (
    <div className="text-center"><p className="font-mono text-[12px] text-white/60">{item.whtRate || 0}%</p></div>
  );

  const renderAmount = () => (
    <p className="text-right font-mono text-[13px] font-black text-nexus-teal not-italic whitespace-nowrap">
      {lineFinalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </p>
  );

  const renderActions = () => !isLocked ? (
    <div className="flex justify-center items-center gap-1">
      <button type="button" onClick={() => duplicateItem(item.id)} className="w-6 h-6 flex items-center justify-center rounded-full bg-nexus-teal/10 text-nexus-teal/70 hover:text-nexus-teal hover:bg-nexus-teal/20 transition-all" title="ทำซ้ำรายการ">
        <Copy size={12} />
      </button>
      <button type="button" onClick={() => removeItem(item.id)} className="w-6 h-6 flex items-center justify-center rounded-full bg-danger/10 text-danger/70 hover:text-danger hover:bg-danger/20 transition-all" title="ลบรายการ">
        <Trash2 size={12} />
      </button>
    </div>
  ) : null;

  // ปุ่มรายละเอียด: จุดสีบอกว่ามีเรื่องต้องดูในแผง (หมดคลัง > ราคาต่ำกว่ามาตรฐาน > มีรายละเอียด)
  const alerts = [
    isOutOfStock && "สินค้าหมดคลัง",
    isBelowStandard && `ต่ำกว่าราคามาตรฐาน ${deviationPercent}%`,
  ].filter(Boolean) as string[];
  const dotClass = isOutOfStock ? "bg-danger shadow-[0_0_8px_rgba(255,59,48,0.9)]"
    : isBelowStandard ? "bg-warning shadow-[0_0_8px_rgba(255,204,0,0.9)]"
    : hasDetails ? "bg-nexus-teal shadow-[0_0_8px_rgba(34,211,238,0.9)]" : "";
  const renderMore = () => (
    <div className="flex justify-center items-center">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
        className={cn("relative p-1.5 rounded-full transition-colors", isExpanded ? "bg-nexus-teal/20 text-nexus-teal" : "text-nexus-teal/50 hover:text-nexus-teal hover:bg-nexus-teal/10")}
        title={["รายละเอียดเพิ่มเติม", ...alerts].join(" • ")}
      >
        <AlignLeft size={14} />
        {dotClass && <span className={cn("absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full", dotClass)} />}
      </button>
    </div>
  );

  const seqCell = (
    <div className="text-center font-mono text-[13px] text-white/60 flex items-center justify-center gap-1">
      {item.isSubItem ? <CornerDownRight size={12} className="text-nexus-teal/50" /> : (index + 1)}
    </div>
  );

  const cellFor: Record<ColKey, () => React.ReactNode> = {
    seq: () => seqCell,
    type: () => <div className="text-center">{renderType()}</div>,
    sku: () => <div className="text-center relative min-w-0">{renderSku()}</div>,
    name: () => <div className="relative min-w-0">{renderName()}</div>,
    more: renderMore,
    qty: () => <div className="flex justify-center items-center">{renderQty()}</div>,
    unit: () => <div className="flex justify-center items-center">{renderUnit()}</div>,
    price: () => <div className="min-w-0">{renderPrice()}</div>,
    discount: () => <div className="flex justify-center items-center">{renderDiscount()}</div>,
    wht: () => <div className="flex justify-center items-center">{renderWht()}</div>,
    amount: renderAmount,
    actions: () => renderActions(),
  };

  const visible = TIER_COLUMNS[tier as Tier].map(([k]) => k);
  // ช่องที่ไม่ได้แสดงในแถว -> แสดงในแผงรายละเอียดแทน
  const hiddenFields: { key: ColKey; label: string; render: () => React.ReactNode }[] = ([
    ["type", renderType], ["sku", renderSku], ["unit", renderUnit], ["price", renderPrice],
    ["discount", renderDiscount], ["wht", renderWht], ["actions", renderActions],
  ] as [ColKey, () => React.ReactNode][])
    .filter(([k]) => !visible.includes(k) && !(k === "actions" && isLocked))
    .map(([k, render]) => ({ key: k, label: k === "actions" ? "จัดการรายการ" : COL_LABEL[k], render }));

  const narrowPanel = tier === "compact" || tier === "small";

  return (
    <>
      <div
        className={cn(
          ITEM_GRID,
          "px-2 py-1 min-h-[40px] hover:bg-white/[0.02] border-b border-white/5 transition-colors",
          item.isSubItem ? "pl-6 bg-white/[0.01]" : ""
        )}
        style={gridStyle(tier)}
      >
        {visible.map((k) => <React.Fragment key={k}>{cellFor[k]()}</React.Fragment>)}
      </div>

      {/* แผงรายละเอียดเพิ่มเติมของรายการ */}
      {isExpanded && (
        <div className={cn("px-4 py-4 bg-black/40 border-b border-white/5 gap-4 relative z-0 shadow-inner grid", narrowPanel ? "grid-cols-1" : "grid-cols-[minmax(0,1fr)_minmax(0,1fr)_240px]")}>

          {tier !== "full" && item.name && (
            <p className={cn("text-[13px] font-bold text-white leading-snug break-words", !narrowPanel && "col-span-3")}>{item.name}</p>
          )}

          {hiddenFields.length > 0 && (
            <div className={cn("grid gap-3", narrowPanel ? "grid-cols-2" : "col-span-3 grid-cols-4")}>
              {hiddenFields.map((f) => (
                <div key={f.key} className="space-y-1 min-w-0">
                  <label className="text-[12px] text-white/60 font-semibold">{f.label}</label>
                  <div>{f.render()}</div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2 min-w-0">
            <label className="text-[12px] text-nexus-teal font-semibold tracking-wider flex items-center gap-1">
              <AlignLeft size={12} /> รายละเอียดสินค้าเพิ่มเติม
            </label>
            <textarea
              value={item.details || ""}
              onChange={(e) => updateItem(item.id, "details", e.target.value)}
              disabled={isLocked}
              className="w-full bg-white/[0.02] border border-white/10 rounded-xl p-3 text-[12px] text-white/80 focus:outline-none focus:border-nexus-teal/50 transition-colors custom-scrollbar placeholder:text-white/70"
              rows={3}
              placeholder="ระบุสเปก, รุ่น, สี, ขนาด หรือรายละเอียดอื่นๆ..."
            />
          </div>

          <div className="space-y-2 min-w-0">
            <label className="text-[12px] text-nexus-teal font-semibold tracking-wider flex items-center gap-1">
              ลิงก์เอกสารอ้างอิง
            </label>
            <input
              type="url"
              value={item.datasheetUrl || ""}
              onChange={(e) => updateItem(item.id, "datasheetUrl", e.target.value)}
              disabled={isLocked}
              className="w-full bg-white/[0.02] border border-white/10 rounded-full px-4 h-8 text-[12px] text-white/80 focus:outline-none focus:border-nexus-teal/50 transition-colors placeholder:text-white/70"
              placeholder="https://..."
            />
            {canEditProduct && (
              <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2 flex-wrap">
                <label className="flex items-center gap-2 cursor-pointer text-[12px] font-bold text-white/70 hover:text-white transition-colors">
                  <input
                    type="checkbox"
                    checked={!!item.saveToProductMaster}
                    disabled={isLocked}
                    onChange={(e) => updateItem(item.id, "saveToProductMaster", e.target.checked)}
                    className="w-4 h-4 rounded border-white/20 text-nexus-teal focus:ring-nexus-teal/50 bg-black/40 disabled:opacity-40 disabled:cursor-not-allowed"
                  />
                  <span>บันทึกกลับไปยังสินค้า</span>
                </label>
                <span className="text-[12px] text-white/60">
                  {item.saveToProductMaster ? "*จะบันทึกกลับไปยังฐานข้อมูลสินค้า" : "*เฉพาะเอกสารนี้ (ค่าเริ่มต้น)"}
                </span>
              </div>
            )}

            {/* ราคาเปรียบเทียบจากผู้จำหน่าย (เดิมซ้อนอยู่ใต้ช่องราคา) */}
            {!isLocked && (item.productId || item.name) && (
              <div className="pt-2 border-t border-white/10 space-y-1.5">
                <label className="text-[12px] text-nexus-teal font-semibold tracking-wider">ราคาเปรียบเทียบจากผู้จำหน่าย</label>
                <SupplierPriceSelector
                  productId={item.productId || item.name}
                  onSelectPrice={(price) => updateItem(item.id, "price", price)}
                  emptyText="ยังไม่มีประวัติราคาจากผู้จำหน่ายสำหรับสินค้านี้"
                />
              </div>
            )}
          </div>

          {/* ข้อมูลเชิงลึก: คลัง / ต้นทุน / GP / ราคามาตรฐาน (เดิมเป็น badge ซ้อนใต้ชื่อสินค้า) */}
          <div className="min-w-0 bg-white/[0.01] border border-white/5 rounded-xl p-3 space-y-2 h-max">
            <label className="text-[12px] text-white/50 font-semibold tracking-wider flex items-center gap-1 border-b border-white/5 pb-2 mb-2">
              ข้อมูลเชิงลึก
            </label>

            {item.itemType === 'PRODUCT' && (
              <div className="flex justify-between items-center gap-2">
                <span className="text-[12px] text-white/60">คงเหลือในคลัง:</span>
                <span className={cn("text-[12px] font-mono font-bold", (item.currentStock || 0) > 0 ? "text-nexus-teal" : "text-danger")}>
                  {isOutOfStock ? "สินค้าหมดคลัง" : `${item.currentStock || 0} ${item.unit || "ชิ้น"}`}
                </span>
              </div>
            )}

            {standardPrice > 0 && (
              <div className="flex justify-between items-center gap-2">
                <span className="text-[12px] text-white/60">ราคามาตรฐาน:</span>
                <span className="text-[12px] font-mono font-bold text-white/80">{formatCurrency(standardPrice)}</span>
              </div>
            )}
            {isBelowStandard && (
              <div className="text-[12px] font-bold text-warning bg-warning/10 border border-warning/30 rounded-xl px-2 py-1 flex items-center gap-1">
                <AlertTriangle size={12} /> ต่ำกว่าราคามาตรฐาน {deviationPercent}%
              </div>
            )}

            {canSeeCost && (
              <>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-[12px] text-white/60">ต้นทุนเฉลี่ย:</span>
                  <span className="text-[12px] font-mono font-bold text-white/80">
                    {formatCurrency(item.cost ?? item.costPrice ?? 0)} บาท
                  </span>
                </div>
                <div className="flex justify-between items-center gap-2 pt-2 border-t border-white/5 mt-1">
                  <span className="text-[12px] text-white/60">กำไรคาดการณ์ (GP):</span>
                  <span className={cn("text-[13px] font-mono font-black", lineGP >= 0 ? "text-nexus-blue" : "text-danger")}>
                    {Number(item.price || 0) > 0 ? `${lineGP.toFixed(2)}%` : "-"}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export function DocumentItemsTable({
  items = [],
  onChange,
  isLocked = false,
  priceDeviationWarningPercent = 10
}: DocumentItemsTableProps) {
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);

  // วัดความกว้างจริงของตารางเพื่อเลือกชุดคอลัมน์ที่พอดี (ไม่ใช้ scrollbar แนวนอน)
  const containerRef = useRef<HTMLDivElement>(null);
  const [tier, setTier] = useState<Tier>("full");
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setTier(pickTier(el.clientWidth));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // สินค้าจริงของบริษัท (ไม่มีรายการจำลอง: ถ้ายังไม่มีสินค้า ให้ค้นแล้วไม่พบ)
  const { data: companyProducts = [] } = useRealtimeCollection('products');

  const availableProducts = useMemo(() => {
    const map = new Map<string, any>();
    companyProducts.forEach((p) => {
      if (p && p.id && !map.has(p.id)) {
        map.set(p.id, {
          id: p.id,
          sku: p.sku || p.productCode || p.code || p.id,
          name: p.name || p.productName || "Unnamed Product",
          unit: p.unit || p.productUnit || "ชิ้น",
          price: p.price ?? p.unitPrice ?? p.retailPrice ?? p.pricing?.pricePOS ?? p.pricing?.priceProject ?? 0,
          cost: p.cost ?? p.costPrice ?? p.costWAC ?? p.pricing?.costWAC ?? 0,
          currentStock: p.stockStatus?.available ?? p.stockStatus?.onHand ?? p.currentStock ?? p.stock ?? p.quantity ?? 0,
          itemType: p.itemType || "PRODUCT",
          details: p.details || p.description || "",
          datasheetUrl: p.datasheetUrl || ""
        });
      }
    });

    return Array.from(map.values());
  }, [companyProducts]);

  const taxRate = 7;

  const notifyChange = (newItems: any[]) => {
    let sub = 0;
    let totalWht = 0;
    newItems.forEach(item => {
      if (item.itemType === 'GROUP_HEADER') return;
      const lineSub = (Number(item.qty) || 0) * (Number(item.price) || 0);
      const lineDiscVal = Number(item.discountValue) || 0;
      const lineDiscAmt = item.discountType === 'PERCENT' ? lineSub * (lineDiscVal / 100) : lineDiscVal;
      const finalLineAmt = Math.max(0, lineSub - lineDiscAmt);
      sub += finalLineAmt;
      const whtR = Number(item.whtRate) || 0;
      totalWht += finalLineAmt * (whtR / 100);
    });
    const tax = sub * (taxRate / 100);
    onChange(newItems, { subtotal: sub, taxAmount: tax, grandTotal: sub + tax - totalWht });
  };

  const addItem = (itemType: string = 'PRODUCT') => {
    if (isLocked) return;
    notifyChange([...items, {
      id: Date.now(),
      productId: null,
      sku: "",
      name: "",
      qty: itemType === 'GROUP_HEADER' ? 0 : 1,
      unit: "ชิ้น",
      price: 0,
      cost: 0,
      costPrice: 0,
      itemType: itemType,
      whtRate: itemType === 'SERVICE' || itemType === 'LABOR' ? 3 : 0,
      discountType: 'PERCENT',
      discountValue: 0
    }]);
  };

  const duplicateItem = (id: number) => {
    if (isLocked) return;
    const targetIndex = items.findIndex(i => i.id === id);
    if (targetIndex === -1) return;
    const target = items[targetIndex];
    const newItem = {
      ...target,
      id: Date.now() + Math.random(),
      name: target.name ? `${target.name} (สำเนา)` : ""
    };
    const newItems = [...items];
    newItems.splice(targetIndex + 1, 0, newItem);
    notifyChange(newItems);
  };

  const addSubItem = (parentId: number) => {
    if (isLocked) return;
    const parentIndex = items.findIndex(i => i.id === parentId);
    const newItems = [...items];
    newItems.splice(parentIndex + 1, 0, {
      id: Date.now(),
      parentId: parentId,
      isSubItem: true,
      productId: null,
      sku: "",
      name: "",
      qty: 1,
      unit: "ชิ้น",
      price: 0,
      cost: 0,
      costPrice: 0,
      itemType: "PRODUCT",
      whtRate: 0,
      discountType: 'PERCENT',
      discountValue: 0
    });
    notifyChange(newItems);
  };

  const removeItem = (id: number) => {
    if (isLocked) return;
    notifyChange(items.filter(i => i.id !== id && i.parentId !== id));
  };

  const onProductSelected = (id: number, product: any) => {
    if (isLocked) return;
    const existingItemIndex = items.findIndex(i => i.productId === product.id && i.id !== id);
    if (existingItemIndex !== -1) {
      const newItems = [...items];
      newItems[existingItemIndex] = {
        ...newItems[existingItemIndex],
        qty: (Number(newItems[existingItemIndex].qty) || 0) + 1
      };
      const currentRowIndex = newItems.findIndex(i => i.id === id);
      if (currentRowIndex !== -1) {
        newItems.splice(currentRowIndex, 1);
      }
      notifyChange(newItems);
    } else {
      updateItemFields(id, product);
    }
  };

  const updateItemFields = (id: number, fields: any) => {
    if (isLocked) return;
    notifyChange(items.map(i => i.id === id ? { ...i, ...fields } : i));
  };

  const updateItem = (id: number, field: string, value: any) => {
    if (isLocked) return;
    notifyChange(items.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  return (
    <div ref={containerRef} className="nexus-items-table border border-white/10 rounded-xl bg-white/[0.01] shadow-2xl">
      {/* Header Row */}
      <div
        className={cn(ITEM_GRID, "text-[12px] font-bold text-white/60 tracking-wide px-2 py-2 border-b border-white/10 bg-white/[0.03] rounded-t-xl")}
        style={gridStyle(tier)}
      >
        {TIER_COLUMNS[tier].map(([k]) => (
          <div key={k} className={cn("whitespace-nowrap", COL_ALIGN[k] || "text-center")}>
            {COL_LABEL[k]}
          </div>
        ))}
      </div>

      {/* Body Rows */}
      <div className="flex flex-col">
        {items.map((item, index) => (
          <InlineRow
            key={item.id}
            item={item}
            index={index}
            tier={tier}
            updateItem={updateItem}
            updateItemFields={updateItemFields}
            onProductSelected={onProductSelected}
            removeItem={removeItem}
            duplicateItem={duplicateItem}
            addSubItem={addSubItem}
            isLocked={isLocked}
            availableProducts={availableProducts}
            priceDeviationWarningPercent={priceDeviationWarningPercent}
          />
        ))}
        {items.length === 0 && (
          <div className="min-h-[48px] flex items-center justify-center text-center py-6">
            <p className="text-white/70 font-semibold text-[12px] tracking-[0.2em]">ไม่มีรายการสินค้า</p>
          </div>
        )}
      </div>

      {/* Add Item Row & Summary */}
      {!isLocked && (
        <div className="px-4 py-3 border-t border-white/5 bg-white/[0.02] flex items-center justify-between gap-3 flex-wrap rounded-b-xl">
          <div className="flex items-center gap-3 flex-wrap">
            <PillButton
              type="button"
              variant="primary"
              onClick={() => addItem('PRODUCT')}
              className="text-[12px] font-bold h-8 px-3"
            >
              <Plus size={13} strokeWidth={3} className="mr-1" /> เพิ่มรายการสินค้า
            </PillButton>
            <PillButton
              type="button"
              variant="glass"
              onClick={() => addItem('GROUP_HEADER')}
              className="text-[12px] font-bold h-8 px-3 text-nexus-teal border-nexus-teal/30 hover:bg-nexus-teal/20"
            >
              <Plus size={13} strokeWidth={3} className="mr-1" /> เพิ่มหัวข้อกลุ่ม
            </PillButton>
            <span className="text-[12px] text-white/60 font-semibold tracking-wider border-l border-white/10 pl-4">
              รวม {items.filter(i => i.itemType !== 'GROUP_HEADER').length} รายการ / {items.reduce((sum, item) => sum + (item.itemType === 'GROUP_HEADER' ? 0 : Number(item.qty || 0)), 0)} ชิ้น
            </span>
          </div>
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => setIsConfirmingClear(true)}
              className="text-[12px] font-bold text-danger/80 hover:text-danger hover:underline transition-colors whitespace-nowrap"
              title="ล้างรายการทั้งหมด"
            >
              ล้างทั้งหมด
            </button>
          )}
        </div>
      )}

      {/* Clear All Confirmation Modal */}
      {isConfirmingClear && (
        <Modal
          isOpen={true}
          onClose={() => setIsConfirmingClear(false)}
          title="ยืนยันล้างรายการทั้งหมด"
        >
          <div className="p-6 space-y-6 text-center">
            <div className="w-12 h-12 bg-danger/20 rounded-full flex items-center justify-center mx-auto text-danger">
              <AlertTriangle size={24} />
            </div>
            <h4 className="text-lg font-bold text-white">คุณต้องการล้างรายการสินค้าทั้งหมดใช่หรือไม่?</h4>
            <p className="text-sm text-white/60">การกระทำนี้จะลบรายการสินค้าทุกบรรทัดในเอกสารนี้ และไม่สามารถยกเลิกได้</p>
            <div className="flex justify-center gap-3 pt-2">
              <PillButton
                variant="glass"
                onClick={() => setIsConfirmingClear(false)}
                className="px-6 h-10"
              >
                ยกเลิก
              </PillButton>
              <PillButton
                variant="confirm"
                onClick={() => {
                  onChange([]);
                  setIsConfirmingClear(false);
                }}
                className="px-6 h-10 bg-danger/20 text-danger border-danger/40 hover:bg-danger/30 font-bold"
              >
                ยืนยันล้างทั้งหมด
              </PillButton>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
