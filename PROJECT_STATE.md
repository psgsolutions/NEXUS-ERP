# 🛡️ NEXUS ERP (Intelligence OS) — Master Project State Report (PROJECT_STATE.md)
> **เอกสารรายงานสถานะจริงของโปรเจกต์ (Codebase Audit & Discovery Report)**
> สแกนและอัปเดตล่าสุด: 23 กันยายน 2026 (NEXUS OS V3.2)

---

## 📁 1. โครงสร้างโฟลเดอร์ระดับบนสุด (Top-Level Folder Structure)

```
NEXUS-ERP/
├── src/                          # โค้ดหลักของแอปพลิเคชัน Next.js (App Router V15/16)
│   ├── app/                      # Next.js Route Handlers และ UI Pages
│   │   ├── (authenticated)/      # หน้าเพจที่ต้องผ่านการยืนยันตัวตน (มี Sidebar & Header)
│   │   │   ├── dashboard/        # ศูนย์ควบคุมหลัก Executive Command Center
│   │   │   ├── sales/            # โมดูลงานขาย (Quotations, Sales Orders, Customers)
│   │   │   ├── inventory/        # โมดูลคลังสินค้า (Products, Stock Ledgers, Serial Numbers)
│   │   │   ├── procurement/      # โมดูลการจัดซื้อ (Purchase Requests, POs, Suppliers)
│   │   │   ├── projects/         # โมดูลบริหารโครงการ IT (Projects, Milestones, KitEditor, Compliance)
│   │   │   ├── finance/          # โมดูลการเงินและบัญชี (GL, Chart of Accounts, Invoices)
│   │   │   ├── accounting/       # หน้ารายงานและปรับปรุงรายการบัญชี double-entry
│   │   │   ├── hr/               # โมดูลบริหารบุคคลและบันทึกเวลาช่าง (Attendance, Timesheets)
│   │   │   ├── ai/               # ศูนย์ควบคุม AI Hub (Genkit, OCR Receipts, PO Scanning)
│   │   │   ├── pos/              # หน้าจอขายหน้าร้าน Point of Sale
│   │   │   ├── mobile/           # Mobile Portal สำหรับช่างสนาม
│   │   │   ├── reports/          # รายงานสรุปเชิงผู้บริหาร
│   │   │   └── settings/         # ตั้งค่าองค์กร และ Tenant Isolation Config
│   │   ├── api/                  # Backend Next.js Route Handlers (REST endpoints)
│   │   │   ├── ai/               # AI Endpoints (/api/ai/vision, /api/ai/scan-po)
│   │   │   ├── documents/        # /api/documents (สรุปข้อมูลเอกสาร multi-tenant)
│   │   │   ├── health/           # System status endpoint
│   │   │   └── setup-mock-data/  # API สำหรับตั้งค่าข้อมูลทดสอบ
│   │   ├── login/                # หน้าเข้าสู่ระบบ
│   │   ├── register/             # หน้าลงทะเบียนบริษัทใหม่
│   │   ├── globals.css           # Global Design System Tokens, CSS Variables & Rules
│   │   └── layout.tsx            # Root Layout
│   ├── components/               # React Modular UI Components
│   │   ├── ui/                   # Reusable Capsule Design System (Base.tsx, SmartComponents.tsx)
│   │   ├── projects/             # Component เฉพาะ Project Hub (KitEditor, Gantt, Compliance)
│   │   ├── inventory/            # Component คลังสินค้า
│   │   ├── sales/                # Component งานขายและออกเอกสาร
│   │   ├── finance/              # Component บัญชีและการเงิน
│   │   ├── hr/                   # Component บุคลากรและเวลาช่าง
│   │   ├── ai/                   # Component AI Review & OCR Visualizer
│   │   └── common/               # Sidebar, Header, Navigation controls
│   ├── services/                 # Business Logic & Firestore Services (Core Engines)
│   ├── lib/                      # SDK Bridges (Firebase Client/Admin, Genkit AI, Utilities)
│   ├── types/                    # TypeScript Data Interfaces & Schemas (database.ts, inventory.ts)
│   ├── context/                  # React Context Providers (AuthContext, TenantContext)
│   ├── hooks/                    # Custom React Hooks (useAuth, useTenant, useFirestore)
│   └── utils/                    # Data binding helpers & Export engines
├── docs/                         # เอกสารสถาปัตยกรรมและแผนการพัฒนา (Master Implementation Plans)
├── public/                       # Static Assets & Web Fonts
└── scripts/                      # Helper Scripts & Automation Utilities
```

---

## 🗄️ 2. Schema จริงของระบบ (Actual Database Schema & Field Mapping)

> **ข้อสังเกตสำคัญ (Spec vs Reality):** ระบบใช้ **Firebase Firestore** แบบ Multi-Tenancy Scoped (ไม่ใช่ Prisma SQL แบบดั้งเดิมใน Spec) โดยทุก Collection อยู่ภายใต้มาตรฐาน `BaseDocument`

### Base Document Mixin Interface (`BaseDocument`)
```typescript
export interface BaseDocument {
  id: string;          // Primary Document Key
  companyId: string;   // Tenant ID (Multi-tenancy Scoped)
  createdAt: any;      // Firestore ServerTimestamp
  updatedAt: any;      // Firestore ServerTimestamp
  createdBy: string;   // Operator User UID
  updatedBy: string;   // Operator User UID
  isDeleted: boolean;  // Soft Delete Flag
}
```

### รายชื่อ Collections & Model Interfaces ที่มีอยู่จริง

| ชื่อ Collection จริง | TypeScript Interface | ฟิลด์หลักที่มีอยู่จริง | หมายเหตุการเทียบกับ Spec |
| :--- | :--- | :--- | :--- |
| `users` | `UserProfile` | `email`, `displayName`, `role` (`SUPERADMIN` \| `ADMIN` \| `ENGINEER` \| `SALES` \| `ACCOUNTANT` \| `HR` \| `PURCHASING`), `permissions`, `status`, `lastLogin` | ใช้ `role` uppercase ตรงตาม spec |
| `companies` | `CompanyConfig` | `name`, `taxId`, `address`, `phone`, `website`, `logoUrl`, `settings` (`currency`, `timezone`, `idFormats`, `focAccounts`) | เก็บค่าตั้งค่าเลขเอกสาร `idFormats` แยกตามประเภท |
| `customers` | `Customer` | `customerId`, `name`, `taxId`, `contactPerson`, `email`, `phone`, `address` (`billing`, `shipping`) | ใช้ `address` เป็น object แยก `billing` และ `shipping` |
| `quotations` | `Quotation` | `documentNo` *(spec ใช้ docNumber)*, `issueDate`, `dueDate`, `customerInfo` (`customerId`, `name`, `taxId`, `branch`, `address`), `isVatRegistered`, `vatType`, `items` (`itemCode`, `description`, `quantity`, `unitPrice`, `discount`, `totalAmount`, `isFOC`), `subTotal`, `totalDiscount`, `vatAmount`, `grandTotal`, `remarks`, `status`, `paymentTermDays`, `probability`, `expectedRevenue` | ฟิลด์รหัสเอกสารใช้ `documentNo` |
| `sales_orders` | `SalesOrder` | `documentNo`, `quotationId`, `projectId`, `customerInfo`, `items`, `subTotal`, `vatAmount`, `grandTotal`, `status` (`draft` \| `confirmed` \| `processing` \| `delivered` \| `cancelled`), `fulfillmentStatus` (`pending` \| `partial` \| `fulfilled`) | มี `fulfillmentStatus` สำหรับคุม stock reservation |
| `products` | `Product` | `sku`, `name`, `type` (`GOODS` \| `KIT` \| `SERVICE_LABOR`), `trackSerial`, `unit`, `costPrice`, `sellingPrice`, `incomeAccountId`, `expenseAccountId`, `wac`, `category`, `brand`, `stockQty` | รองรับ `incomeAccountId` / `expenseAccountId` สำหรับ Smart Accounting Link |
| `stock_ledgers` | `StockLedger` | `productId`, `warehouseId`, `onHand`, `reserved`, `refType` (`GR` \| `SO` \| `PROJECT` \| `ADJUSTMENT`), `refId`, `movementQty`, `movementCost` | คำนวณ `available` = `onHand - reserved` ตามกฎ 3-State Lock |
| `serial_numbers` | `SerialNumber` | `productId`, `serial`, `status` (`IN_STOCK` \| `RESERVED` \| `SOLD` \| `INSTALLED` \| `RMA`), `warrantyExpireAt`, `installedProjectId` | ใช้ `warrantyExpireAt` สำหรับ Smart Warranty Trigger |
| `projects` | `Project` | `projectCode`, `projectName`, `customerId`, `complianceType` (`GOVERNMENT` \| `PRIVATE_COMMERCIAL`), `status` (`PLANNING` \| `IN_PROGRESS` \| `ON_HOLD` \| `COMPLETED` \| `CLOSED`), `budget` (`plannedMaterialCost`, `plannedLaborCost`, `plannedSubcontractCost`, `actualMaterialCost`, `actualLaborCost`, `actualSubcontractCost`), `milestones` | มี sub-objects คุมงบ `planned` vs `actual` สำหรับ Profit Rainbow |
| `purchase_orders` | `PurchaseOrder` | `documentNo`, `supplierId`, `supplierName`, `items` (`productId`, `qtyOrdered`, `qtyReceived`, `unitCost`), `status` (`DRAFT` \| `SENT` \| `PARTIAL_RECEIVED` \| `RECEIVED` \| `CLOSED`), `totalAmount` | ใช้ `documentNo` ตัวล็อค `PO-YYMM-XXXX` |
| `goods_receipts` | `GoodsReceipt` | `documentNo`, `purchaseOrderId`, `receivedAt`, `items`, `receivedBy` | บันทึกของเข้าเพื่อ trigger การคำนวณ WAC ใหม่ |
| `journal_entries` | `JournalEntry` | `docNumber`, `refType`, `refId`, `entryDate`, `lines` (`accountId`, `debit`, `credit`), `isImmutable` | บันทึกลงสมุดรายวันทั่วไปแบบ Double-Entry (Debitต้องเท่ากับCredit) |
| `audit_logs` | `AuditLog` | `action` (`CREATE` \| `UPDATE` \| `DELETE` \| `LOGIN` \| `EXPORT`), `module`, `targetId`, `reason`, `changes` (`before`, `after`), `metadata` | สร้างแบบ Immutable Append-only |

---

## 🌐 3. รายชื่อ API Routes ที่มีอยู่จริง (Actual Active API Endpoints)

| HTTP Method | API Path | ไฟล์ที่อยู่ | หน้าที่ / การทำงาน |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/documents` | `src/app/api/documents/route.ts` | สรุปข้อมูลเอกสารในคลัง Multi-tenant ของบริษัทปัจจุบัน |
| `POST` | `/api/projects/create` | `src/app/api/projects/create/route.ts` | บันทึกสร้างโครงการใหม่แบบ Server-Side Atomic Dual-Write (Subcollection + Root Index) ผ่าน Firebase Admin SDK พร้อม RBAC Check (`projects:edit`) และ Audit Log |
| `POST` | `/api/stock/reserve` | `src/app/api/stock/reserve/route.ts` | บริหารสต็อกและตัดยอดแบบ Server-Side Transaction |
| `POST` | `/api/projects/wip-expense` | `src/app/api/projects/wip-expense/route.ts` | บันทึกต้นทุนงานระหว่างก่อสร้าง (WIP Asset) เข้าโครงการและสมุดรายวันทั่วไป |
| `POST` | `/api/ai/vision` | `src/app/api/ai/vision/route.ts` | ดึงข้อมูลยอดเงิน Vendor และหมวดหมู่จากใบเสร็จรับเงินด้วย Gemini 2.5 Flash OCR |
| `POST` | `/api/ai/scan-po` | `src/app/api/ai/scan-po/route.ts` | สแกนเอกสาร PO ของลูกค้าและแปลงเป็นรายการสินค้าอัตโนมัติ |

---

## 🛠️ 4. Service / Utility Functions ที่ reusable ในระบบ

### 1. Document Numbering Service (`src/lib/idService.ts` & `src/lib/sequence-engine.ts`)
* `generateDocNumber(companyId: string, docType: 'QU' | 'SO' | 'PO' | 'PRJ' | 'INV')`: สร้างรหัสเอกสารรันอัตโนมัติตามแพตเทิร์นองค์กร ป้องกันเลขชนแบบ Atomic Transaction

### 2. Audit Logging Service (`src/services/audit.service.ts` & `src/lib/audit-logger.ts`)
* `auditService.logCreate(userId, companyId, module, targetId, data)`: บันทึกประวัติการสร้าง
* `auditService.logUpdate(userId, companyId, module, targetId, before, after)`: บันทึกประวัติการแก้ไขและเก็บ Diff
* `auditService.logDelete(userId, companyId, module, targetId, reason)`: บันทึกการลบแบบ Soft Delete

### 3. Inventory & WAC Engine (`src/services/inventoryService.ts` & `src/lib/stock-service.ts`)
* `reserveStock(productId, qty, refId)`: ล็อคสต็อกสินค้าแบบ 3-State Lock (`available = onHand - reserved`)
* `calculateWAC(oldOnHand, oldWAC, receivedQty, receivedCost)`: คำนวณราคาทุนเฉลี่ยถ่วงน้ำหนักใหม่เมื่อมี Goods Receipt
* `checkStockAvailability(productId, qty)`: ตรวจสอบจำนวนสต็อกพร้อมขาย

### 4. Double-Entry GL Engine (`src/services/accountingEngine.ts` & `src/lib/auto-journal-service.ts`)
* `postJournalEntry(entry)`: ตรวจสอบดุลบัญชี (Debit === Credit) ก่อนบันทึกลงสมุดรายวันทั่วไป
* `createReversalEntry(journalEntryId, reason)`: กลับรายการบัญชีแทนการแก้ไขเอกสารเด็ดขาด (Immutable Ledger)

### 5. Tax & Document Conversion Engine (`src/services/taxEngine.ts` & `src/services/documentFlow.service.ts`)
* `taxEngine.calculateTax(amount, taxMode)`: คำนวณ Subtotal, VAT (7%) และ GrandTotal
* `documentFlowService.convertQuotationToSalesOrder(quotationId)`: แปลงใบเสนอราคาเป็น Sales Order พร้อมสั่งจองสต็อก
* `projectCostingService.calculateProfitRainbow(projectId)`: คำนวณ GP% และเปรียบเทียบ Planned vs Actual Cost

### 6. Authentication & Security Engine (`src/lib/permissions.ts`)
* `hasPermission(userRole, requiredPermission)`: ตรวจสอบสิทธิ์การเข้าถึงข้อมูลตาม RBAC

---

## 🎨 5. UI Components ที่ reuse ได้ (Reusable UI Controls)

> ทุก Control อยู่ภายใต้คลาส **Standard Height Capsule System (`h-8` / `h-9` rounded-full)** และ **Glassmorphism Theme**

### จาก `src/components/ui/Base.tsx`
* `PillButton`: ปุ่มกดแบบโปร่งใส (`variant`: `"glass"` \| `"primary"` \| `"save"` \| `"confirm"` \| `"warning"` \| `"danger"`)
* `PillInput`: ช่องกรอกข้อมูลแคปซูล ความสูง `h-8` ตัวอักษร `14px`
* `PillSelect`: Dropdown Selector สไตล์แคปซูลโปร่งใส
* `PillTabs`: แถบสลับแท็บเมนูทรงแคปซูล
* `PillCheckbox`: ช่องติ๊กเลือกสไตล์เนออน
* `GlassCard`: การ์ดแสดงข้อมูลแบบกระจกพร้อมขอบ Glow (`bg-neutral-900/90 border border-white/15 rounded-3xl`)
* `DocumentStatusBadge`: ป้ายแสดงสถานะเอกสารภาษาไทย (ร่าง, รออนุมัติ, ผ่านการอนุมัติ, บันทึกบัญชีแล้ว ฯลฯ)
* `NexusTable` / `StrategicTable`: ตารางข้อมูลความหนาแน่นสูง ตัวเลขใช้ `font-mono` ชิดขวา
* `MasterMetricCard`: การ์ดสรุปตัวเลข KPI ประจำหน้าจอ
* `Modal` / `SlideOver`: หน้าต่างป๊อบอัพและพาเนลสไลด์จากด้านข้าง
* `Toast`: ป้ายแจ้งเตือนผลการทำงาน (Success, Error, Warning)

### จาก `src/components/ui/SmartComponents.tsx`
* `SmartSelect`: Dropdown ค้นหาและกรอกข้อมูลในช่องเดียว (typing & filter ไร้ปุ่ม "+ เพิ่ม" ซ้ำซ้อน)
* `StepperInput`: ปุ่มปรับเพิ่ม-ลดตัวเลขทรงตั้ง (ChevronUp / ChevronDown)
* `NumberInput`: ช่องกรอกตัวเลขแบบฟอร์แมตทศนิยมและคอมม่าอัตโนมัติ
* `SmartTable`: ตารางข้อมูลพร้อมระบบกรองและจัดเรียงคอลัมน์ dynamic

---

## 🎨 6. Design Tokens & Theme Variables

### Colors (`tailwind.config.ts` & `src/app/globals.css`)
* Base Background: `--background: #0D0D0D` (Dark Void Surface)
* Primary Accent: `--nexus-teal: #00FFD1` / `text-nexus-teal`
* Secondary Accent: `--nexus-blue: #0090FF` / `text-nexus-blue`
* Danger/Alert: `--danger: #FF3B30`
* Warning: `--warning: #FFCC00`
* Success/Save: `emerald-500` / `#10B981`

### Fonts & Typography Rules (`globals.css` - Mandatory)
* Main Body & UI Text: `font-sarabun` / `14px` (`text-[14px]` เท่ากับ Sidebar Menu)
* Header Labels: `12px - 13px` `font-bold` / `font-semibold` `text-white/60`
* Monospace Numbers: `font-mono` (ใช้สำหรับรหัสเอกสาร, SKU, ราคา, ยอดเงิน, Serial Numbers)
* **Italic Usage Rule:** ปิดการใช้งานตัวเอียง 100% (`font-style: normal !important;`)

### Radius & Border Rules
* Controls: `rounded-full` (Capsule shape)
* Modular Cards: `rounded-3xl` (`border border-white/15`) พร้อมขอบเน้นขอบซ้าย `border-l-4` ตามหมวดหมู่

---

## 🔐 7. Environment Variables ที่ใช้จริงในโปรเจกต์

| ชื่อ Environment Variable | สถานที่ใช้งาน | วัตถุประสงค์ / ความสำคัญ |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `src/lib/firebase-client.ts` | กำหนด Project ID สำหรับ Firebase Client SDK |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `src/lib/firebase-client.ts` | API Key สำหรับการสื่อสารกับ Firebase Services |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `src/lib/firebase-client.ts` | Domain ยืนยันตัวตนผ่าน Firebase Auth |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `src/lib/firebase-client.ts` | Storage Bucket สำหรับอัปโหลดรูปภาพใบเสร็จ |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `src/lib/firebase-client.ts` | Messaging Sender ID สำหรับระบบแจ้งเตือน Push Notification |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `src/lib/firebase-client.ts` | App Identification ID ของ Web App |
| `FIREBASE_CLIENT_EMAIL` | `src/lib/firebase-admin.ts` | Service Account Email สำหรับ Firebase Admin SDK |
| `FIREBASE_PRIVATE_KEY` | `src/lib/firebase-admin.ts` | Service Account Private Key สำหรับสิทธิ์ความปลอดภัย Server-side |
| `GEMINI_API_KEY` | `src/lib/genkit.ts` | API Key เชื่อมต่อ Gemini 2.5 Flash เพื่อประมวลผล OCR & Scanning |

---

## 📊 8. ตารางสรุปสถานะการเทียบ Roadmap 6 เฟส (Roadmap Progress Audit)

```
[Phase 0: Foundation]    --> 🟩 100% Complete (Multi-tenancy, RBAC, idService, Audit Logger, Firestore Rules)
[Phase 1: Inventory]     --> 🟩  95% Complete (Products, StockLedger, Real-time WAC Engine, Serials, Supplier Matrix PO Integration Done)
[Phase 2: Commerce]      --> 🟩  95% Complete (Customers, Quotation, SO, vatType Carry-over, One-Click Tax Invoice & Billing Note Automation Done)
[Phase 3: Project Hub]   --> 🟩  85% Complete (Project Budget, Profit Rainbow, WIP Asset Site Expense Posting from Mobile Technician Portal Done)
[Phase 4: Accounting]    --> 🟩  85% Complete (Double-Entry Engine, COA, Post-Journal API, Tax Filing ภ.พ.30/ภ.ง.ด.3/ภ.ง.ด.53 Export Engine Done)
[Phase 5: AI Hub]        --> 🟩  85% Complete (Real-time Gemini 1.5 Flash Vision API, Scan-PO API, Warranty MA Proposal Auto-Cron Engine Done)
```

### รายละเอียดข้อสรุปงานที่เสร็จสมบูรณ์และสิ่งที่ได้รับการปรับปรุงล่าสุด:
1. **Phase 1 Inventory & Procurement (95%):** 
   - ระบบคำนวณราคาทุนถัวเฉลี่ยถ่วงน้ำหนัก (WAC) แบบ Real-time ทันทีที่มี Goods Receipt (GR) แบบ Atomic Transaction
   - ระบบดึงประวัติราคาเปรียบเทียบผู้จำหน่ายย้อนหลัง (Supplier Matrix) 2-3 รายล่าสุดเข้าสู่ฟอร์มสร้าง Purchase Order แบบ One-Click
2. **Phase 2 Commerce & CRM (95%):** 
   - ระบบบันทึกและส่งต่อ `vatType` (Quotation -> SalesOrder -> TaxInvoice)
   - ปุ่มกด "ออกใบกำกับภาษี" แบบ One-Click (`variant="save"`) สร้างเอกสาร Tax Invoice (`INV-YY-XXXX`) และ Billing Note (`BN-YY-XXXX`) พร้อมกันใน Atomic Transaction
3. **Phase 3 Project Hub (85%):** 
   - บันทึกต้นทุนงานระหว่างก่อสร้าง (WIP Asset - บัญชี 114100) จาก Mobile Technician Portal เข้าสู่ระบบบัญชี GL พร้อม Sync ค่า `Project.actualCost` และ `wipValue` อัตโนมัติ
4. **Phase 4 Finance & Accounting (85%):** 
   - ระบบบันทึกสมุดรายวันทั่วไปผ่าน Server Endpoint (`POST /api/accounting/post-journal`) พร้อมตรวจสอบความเท่ากันของ Debit-Credit และ Period Lock
   - ระบบ Export รายงานภาษีกรมสรรพากร 3 รูปแบบ (ภ.พ.30, ภ.ง.ด.3, ภ.ง.ด.53) เป็น CSV (UTF-8 BOM) พร้อมระบบ Lock เตือนยื่นซ้ำ
5. **Phase 5 AI Hub (85%):** 
   - ปรับแต่ง `POST /api/ai/vision` และ `POST /api/ai/scan-po` เป็น Real-time Gemini 1.5 Flash Vision API ปราศจาก mock delay พร้อมระบบจัดการข้อผิดพลาดและ Flag สถานะ `NEEDS_REVIEW`
   - ระบบ Cron Job ประจำวัน (`/api/cron/warranty-ma-check`) ตรวจสอบอุปกรณ์ใกล้หมดประกันภายใน 30 วัน และร่างข้อเสนอสัญญา MA อัตโนมัติ พร้อมระบบป้องกันการสร้างเอกสารซ้ำ

---
*เอกสารนี้ถูกบันทึกใน `PROJECT_STATE.md` สำหรับใช้เป็น Context อ้างอิงระบบ NEXUS ERP (Intelligence OS)*
