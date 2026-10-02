/**
 * NEXUS-ERP Product Validation Module
 * Single source of truth for required fields and validation logic.
 */

export interface RequiredFieldItem {
  id: string; // DOM ID for scrolling/focusing
  key: string;
  label: string;
  isFilled: boolean;
}

export interface ProductFormDataLike {
  name?: string | null;
  category?: string | null;
  cost?: number | null;
  price?: number | null;
  qty?: number | null;
  warehouseId?: string | null;
  sku?: string | null;
  productType?: string | null;
  [key: string]: any;
}

export interface RequiredFieldsResult {
  fields: RequiredFieldItem[];
  totalCount: number;
  filledCount: number;
  missingFields: RequiredFieldItem[];
  isComplete: boolean;
}

/**
 * Single source of truth for required fields status on Product forms.
 * Base fields (denominator = 4):
 * 1. name (ชื่อสินค้า)
 * 2. category (หมวดหมู่หลัก)
 * 3. cost (ราคาต้นทุน)
 * 4. price (ราคาขายหน้าร้าน)
 * 
 * Conditional fields:
 * - When qty > 0, warehouseId (คลังสินค้า) is required (denominator = 5).
 */
export function getRequiredFieldsStatus(formData: ProductFormDataLike): RequiredFieldsResult {
  const hasInitialQty = typeof formData.qty === "number" && formData.qty > 0;
  
  const fields: RequiredFieldItem[] = [
    {
      id: "field-product-name",
      key: "name",
      label: "ชื่อสินค้า",
      isFilled: typeof formData.name === "string" && formData.name.trim().length > 0,
    },
    {
      id: "field-product-category",
      key: "category",
      label: "หมวดหมู่หลัก",
      isFilled: typeof formData.category === "string" && formData.category.trim().length > 0,
    },
    {
      id: "field-product-cost",
      key: "cost",
      label: "ราคาต้นทุน",
      isFilled: typeof formData.cost === "number" && formData.cost > 0,
    },
    {
      id: "field-product-price",
      key: "price",
      label: "ราคาขายหน้าร้าน",
      isFilled: typeof formData.price === "number" && formData.price > 0,
    },
  ];

  if (hasInitialQty) {
    fields.push({
      id: "field-product-warehouse",
      key: "warehouseId",
      label: "คลังสินค้า",
      isFilled: typeof formData.warehouseId === "string" && formData.warehouseId.trim().length > 0,
    });
  }

  const totalCount = fields.length;
  const filledCount = fields.filter(f => f.isFilled).length;
  const missingFields = fields.filter(f => !f.isFilled);
  const isComplete = filledCount === totalCount;

  return {
    fields,
    totalCount,
    filledCount,
    missingFields,
    isComplete,
  };
}

/**
 * Checks if a given SKU is duplicate within the same company.
 */
export function checkSkuDuplicate(
  sku: string | null | undefined,
  existingProducts: Array<{ sku?: string; companyId?: string; isDeleted?: boolean }>,
  companyId: string,
  excludeProductId?: string
): boolean {
  if (!sku || !sku.trim()) return false;
  const normalized = sku.trim().toLowerCase();
  
  return existingProducts.some(p => {
    if (excludeProductId && (p as any).id === excludeProductId) return false;
    if (p.isDeleted) return false;
    if (p.companyId !== companyId) return false;
    return (p.sku || "").trim().toLowerCase() === normalized;
  });
}

/**
 * บาร์โค้ดซ้ำ: ต้องไม่ซ้ำกับบาร์โค้ดหรือ SKU ของสินค้าอื่นในบริษัท
 * (ตอนยิง ระบบจับคู่ทั้งบาร์โค้ดและ SKU ถ้าซ้ำจะไม่รู้ว่าเป็นสินค้าตัวไหน)
 * คืนค่าชื่อสินค้าที่ซ้ำ หรือ null
 */
export function findBarcodeConflict(
  barcode: string | null | undefined,
  existingProducts: Array<Record<string, any>>,
  companyId: string,
  excludeProductId?: string
): string | null {
  const normalized = String(barcode || "").trim().toUpperCase();
  if (!normalized) return null;
  const hit = existingProducts.find((p) => {
    if (excludeProductId && p.id === excludeProductId) return false;
    if (p.isDeleted || p.companyId !== companyId) return false;
    const codes = [p.barcode, p.sku, ...(Array.isArray(p.barcodes) ? p.barcodes : [])]
      .filter(Boolean)
      .map((v: any) => String(v).trim().toUpperCase());
    return codes.includes(normalized);
  });
  return hit ? (hit.name || hit.productName || hit.sku || hit.id) : null;
}
