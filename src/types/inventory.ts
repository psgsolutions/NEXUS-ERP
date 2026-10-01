export interface ProductConversion {
  toUnit: string;        // เช่น กล่อง, ลัง
  relativeRate: number;  // สัดส่วนเทียบกับหน่วยย่อย เช่น 1 กล่อง = 10 ชิ้น
  relativeToUnit: string;
  rateToBase: number;    // สัดส่วนรวมถึง Base Unit
  barcode: string;       // บาร์โค้ดประจำบรรจุภัณฑ์นั้นๆ
  weightKg?: number;     // น้ำหนักประจำแพ็กเกจ (กก.)
  dimensions?: { w: number; l: number; h: number }; // มิติประจำแพ็กเกจ (ซม.)
}

export interface ProductSupplierInfo {
  supplierId: string;    // อ้างอิงตาราง suppliers
  supplierSku?: string;  // รหัสสินค้าฝั่งซัพพลายเออร์
  mpn?: string;          // Manufacturer Part Number
  latestCost: number;    // ราคาทุนล่าสุด (font-mono)
  leadTimeDays: number;  // ระยะเวลารอคอยสินค้า (วัน)
  moq?: number;          // ปริมาณสั่งซื้อขั้นต่ำจากผู้จำหน่าย (Minimum Order Quantity)
  isPrimary: boolean;    // ผู้จำหน่ายหลัก
  supplierWarrantyPeriod?: number; // ระยะเวลารับประกัน (เดือน)
}

export interface ProductAlias {
  type: "CUSTOMER" | "GOVERNMENT_TOR" | "SUPPLIER" | "INTERNAL";
  name: string;
  referenceCode?: string;
}

export type StockStatus = "UNRESTRICTED" | "RESERVED" | "QA" | "BLOCKED";
export type LifecycleStatus = "DRAFT" | "ACTIVE" | "PHASE_OUT" | "OBSOLETE";

export interface StockBalance {
  id?: string;
  companyId: string;
  productId: string;
  warehouseId: string;
  binLocationId?: string; // ถ้ามี
  batchNumber?: string;   // สำหรับสินค้าควบคุม Batch
  status: StockStatus; // สถานะสินค้าคงคลัง
  quantity: number;
  updatedAt: Date;
}

export interface StockLedger {
  id?: string;
  companyId: string;
  transactionDate: Date;
  documentRef: string;    // เช่น INV-IN-2609-001
  transactionType: "GRN" | "ISSUE" | "TRANSFER" | "ADJUSTMENT" | "RETURN";
  productId: string;
  warehouseId: string;
  binLocationId?: string;
  batchNumber?: string;
  statusChange?: {
    from: StockStatus | null;
    to: StockStatus;
  };
  quantityChange: number;
  balanceAfter: number;
  userId: string;
  createdAt: Date;
}

export interface ProductMaster {
  id?: string;
  companyId: string;               // [CRITICAL] Strict Tenant Isolation
  
  // 1. Core & Identification
  sku: string;                     // รหัสสินค้าหลัก (font-mono)
  productCode?: string;            // รหัสสินค้า (Alias / Alternative SKU)
  barcode: string;                 // บาร์โค้ดสินค้าหลัก
  barcodes?: string[];             // รายการบาร์โค้ดทั้งหมด (Array)
  name: string;                    // ชื่อมาตรฐานสินค้า
  brand: string;                   // ยี่ห้อ (ค่าเริ่มต้น NEXUS)
  model?: string;                  // รุ่นหลักของสินค้า (Main Model)
  mainModel?: string;              // รุ่นหลัก (Alias)
  subModel?: string;               // รุ่นย่อยหรือซีรีส์ (Sub Model / Series)
  category: string;                // หมวดหมู่สินค้าหลัก
  subCategory?: string;            // หมวดหมู่ย่อย (Sub Category)
  productType: "PHYSICAL" | "SERVICE" | "ASSET" | "BOM";
  
  // 2. Accounting & Tax Mapping (GL Integration)
  taxType: "VAT_7" | "NON_VAT" | "EXEMPT";
  vatType?: string;                // ประเภทภาษี (Alias)
  whtRate?: number;                // อัตราภาษีหัก ณ ที่จ่าย (%)
  costingMethod: "FIFO" | "MOVING_AVERAGE" | "SPECIFIC";
  glIncomeAccount: string;         // ผังบัญชีรายได้
  glCogsAccount: string;           // ผังบัญชีต้นทุน
  glInventoryAccount: string;      // ผังบัญชีคลังสินค้า
  
  // 3. Units & Packaging Hierarchy
  unit: string;                    // หน่วยย่อยที่สุด (Base Unit เช่น ชิ้น, เมตร)
  baseUnit?: string;               // หน่วยย่อยที่สุด (Alias)
  purchaseUnit?: string;           // หน่วยที่ซื้อจากซัพพลายเออร์ (เช่น กล่อง, ลัง, ม้วน)
  conversionFactor?: number;       // ตัวคูณแปลงหน่วย (Conversion Factor)
  salesUnit?: string;              // หน่วยขายเริ่มต้น
  conversions: ProductConversion[];// โครงสร้างบรรจุภัณฑ์หลายระดับ
  
  // 4. Pricing & Margin Automation
  costWAC: number;                 // ต้นทุนเฉลี่ยถ่วงน้ำหนัก (font-mono)
  costPrice?: number;              // ต้นทุนเฉลี่ย / ต้นทุนมาตรฐาน (Alias)
  pricePOS: number;                // ราคาขายหน้าร้าน
  unitPrice?: number;              // ราคาขายมาตรฐาน (Retail Price Alias)
  priceProject: number;            // ราคาขายโครงการ
  priceWholesale?: number;         // ราคาขายส่ง / B2B
  wholesalePrice?: number;         // ราคาขายส่ง (Alias)
  minimumFloorPrice?: number;      // ราคาขายขั้นต่ำ (MAP Safety Guard)
  
  // 5. Supply Chain & Procurement
  supplierConfig: ProductSupplierInfo[];
  inventoryControl: {
    orderUnit: string;
    reorderPoint: number;
    minStock: number;
    maxStock: number;
  };
  defaultWarehouseId?: string;     // คลังสินค้ารับเข้าเริ่มต้น
  defaultRackLocation?: string;    // ตำแหน่งรับเข้าเริ่มต้น
  warehouseLocation?: string;      // ตำแหน่งจัดเก็บในคลัง (Alias)
  
  // 6. Traceability & Technical Specs
  isSerialized: boolean;           // คุม Serial Number รายตัว
  isSerialTracked?: boolean;       // ระบบติดตามหมายเลขเครื่อง (Alias)
  isBatchTracked: boolean;         // คุม Lot/Batch
  isExpiryTracked: boolean;        // คุมวันหมดอายุ (FEFO)
  shelfLifeDays?: number;          // อายุการเก็บรักษา (วัน)
  hazardousClass?: string;         // การจัดกลุ่มวัตถุอันตราย/สารเคมี
  weightKg: number;                // น้ำหนัก (กก.)
  dimensions: { w: number; l: number; h: number }; // มิติ (ซม.)
  technicalSpecs: string;          // รายละเอียดทางเทคนิค / TOR
  assets: {
    mainImage?: string;
    labelImage?: string;
    documents?: string[];
  };
  attachments: string[];           // (Legacy) URL เอกสาร Data Sheet / PDF
  aliases: ProductAlias[];         // ชื่อเรียกอื่นๆ (ฝั่งลูกค้า / TOR ราชการ)
  accessories: string[];           // BOM สำหรับงานบริการ (วัสดุสิ้นเปลืองพ่วง)
  manufacturerWarrantyPeriod?: number; // ระยะเวลาประกันจากผู้ผลิต
  manufacturerWarrantyTerms?: string; // เงื่อนไขประกันจากผู้ผลิต
  
  // 7. System Control
  lifecycleStatus: LifecycleStatus; // สถานะวงจรชีวิตสินค้า
  isDeleted: boolean;              // Soft Delete (default: false)
  createdByUserId?: string;        // ผู้บันทึกสร้าง
  updatedByUserId?: string;        // ผู้แก้ไขล่าสุด
  createdAt: Date;
  updatedAt: Date;
}
