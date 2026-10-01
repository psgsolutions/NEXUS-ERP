# NEXUS ERP (Intelligence OS) — Development Spec, Schema & Roadmap
> เอกสารนี้ใช้เป็น input สำหรับ Antigravity เพื่อ generate โค้ดจริงเป็นเฟสๆ

---

## 1. Database Schema (5 Strategic Hubs)

โครงสร้างนี้เป็น Prisma-style schema (ปรับเป็น SQL DDL ได้ตรงๆ) รองรับ Multi-Tenant ผ่าน `companyId` ทุกตาราง และ Soft Delete (`deletedAt`) + Audit (`createdBy`, `updatedBy`, `createdAt`, `updatedAt`) เป็นมาตรฐานทุกตาราง — ไม่เขียนซ้ำในแต่ละ model เพื่อความกระชับ (ให้ extend เป็น `BaseModel` mixin)

```prisma
// ============ BASE MIXIN (แนวคิด ใช้ generate จริงใน Antigravity) ============
// ทุก model ควรมี: id, companyId, createdAt, updatedAt, createdBy, updatedBy, deletedAt(nullable)

// ============ HUB 1: COMMERCE & CRM ============
model Customer {
  id            String   @id @default(cuid())
  companyId     String
  type          CustomerType // INDIVIDUAL_B2C | ORG_B2B | GOVERNMENT
  name          String
  taxId         String?
  branchCode    String?  // สาขาที่ (สำหรับใบกำกับภาษี)
  billingAddress String
  creditTermDays Int     @default(0)
  creditLimit   Decimal? @db.Decimal(18,2)
  contacts      Contact[]
  quotations    Quotation[]
  salesOrders   SalesOrder[]
}

model Quotation {
  id            String   @id @default(cuid())
  companyId     String
  docNumber     String   // เลขที่เอกสาร รันแยกตาม companyId (Atomic Transaction)
  customerId    String
  projectId     String?  // ผูกกับ Project Hub (จาก Zap Bridge)
  status        QuotationStatus // DRAFT | SENT | APPROVED | EXPIRED | CONVERTED
  items         QuotationItem[]
  taxMode       TaxMode  // EXCLUSIVE | INCLUSIVE | ZERO_RATED | EXEMPT
  subtotal      Decimal  @db.Decimal(18,2)
  vatAmount     Decimal  @db.Decimal(18,2)
  grandTotal    Decimal  @db.Decimal(18,2)
  validUntil    DateTime
}

model QuotationItem {
  id            String   @id @default(cuid())
  quotationId   String
  productId     String?
  laborCardId   String?  // ค่าแรงช่าง (per point / lump sum)
  description   String
  qty           Decimal  @db.Decimal(18,4)
  unitPrice     Decimal  @db.Decimal(18,2)
  incomeAccountId String // Smart Accounting Link
}

model SalesOrder {
  id            String   @id @default(cuid())
  companyId     String
  docNumber     String
  customerId    String
  quotationId   String?
  projectId     String?
  status        SOStatus // PENDING | RESERVED | PARTIAL_DELIVERED | COMPLETED | CANCELLED
  items         SalesOrderItem[]
}

model SalesOrderItem {
  id            String   @id @default(cuid())
  salesOrderId  String
  productId     String
  qtyOrdered    Decimal  @db.Decimal(18,4)
  qtyReserved   Decimal  @db.Decimal(18,4) @default(0)
  qtyDelivered  Decimal  @db.Decimal(18,4) @default(0)
}

model BillingNote { id String @id @default(cuid()) companyId String docNumber String salesOrderIds String[] customerId String totalAmount Decimal @db.Decimal(18,2) }
model TaxInvoice  { id String @id @default(cuid()) companyId String docNumber String billingNoteId String? vatAmount Decimal @db.Decimal(18,2) whtAmount Decimal? @db.Decimal(18,2) }

model POSTransaction {
  id            String   @id @default(cuid())
  companyId     String
  docNumber     String
  items         POSItem[]
  paymentMethod String
  cashierId     String
}

enum CustomerType { INDIVIDUAL_B2C ORG_B2B GOVERNMENT }
enum QuotationStatus { DRAFT SENT APPROVED EXPIRED CONVERTED }
enum SOStatus { PENDING RESERVED PARTIAL_DELIVERED COMPLETED CANCELLED }
enum TaxMode { EXCLUSIVE INCLUSIVE ZERO_RATED EXEMPT }


// ============ HUB 2: INVENTORY & PROCUREMENT ============
model Product {
  id            String   @id @default(cuid())
  companyId     String
  sku           String
  name          String
  type          ProductType // GOODS | KIT | SERVICE_LABOR
  trackSerial   Boolean  @default(false)
  incomeAccountId  String
  expenseAccountId String
  wac           Decimal  @db.Decimal(18,4) @default(0) // Weighted Average Cost ปัจจุบัน
}

model StockLedger {
  // 3-State Stock Lock: Available = OnHand - Reserved
  id            String   @id @default(cuid())
  companyId     String
  productId     String
  warehouseId   String
  onHand        Decimal  @db.Decimal(18,4) @default(0)
  reserved      Decimal  @db.Decimal(18,4) @default(0)
  // available คำนวณ (computed, ไม่เก็บจริง): onHand - reserved
  refType       String   // GR | SO | PROJECT | ADJUSTMENT
  refId         String
  movementQty   Decimal  @db.Decimal(18,4) // + เข้า / - ออก
  movementCost  Decimal  @db.Decimal(18,4) // WAC ณ เวลาบันทึก
}

model SerialNumber {
  id            String   @id @default(cuid())
  companyId     String
  productId     String
  serial        String   @unique
  status        SerialStatus // IN_STOCK | RESERVED | SOLD | INSTALLED | RMA
  warrantyExpireAt DateTime?
  installedProjectId String?
}

model PurchaseRequest { id String @id @default(cuid()) companyId String docNumber String status String items Json }
model PurchaseOrder   { id String @id @default(cuid()) companyId String docNumber String supplierId String status POStatus items PurchaseOrderItem[] }
model PurchaseOrderItem { id String @id @default(cuid()) purchaseOrderId String productId String qtyOrdered Decimal @db.Decimal(18,4) qtyReceived Decimal @db.Decimal(18,4) @default(0) unitCost Decimal @db.Decimal(18,4) }
model GoodsReceipt    { id String @id @default(cuid()) companyId String docNumber String purchaseOrderId String items Json receivedAt DateTime }
model Supplier        { id String @id @default(cuid()) companyId String name String taxId String? payableBalance Decimal @db.Decimal(18,2) @default(0) }

enum ProductType { GOODS KIT SERVICE_LABOR }
enum SerialStatus { IN_STOCK RESERVED SOLD INSTALLED RMA }
enum POStatus { DRAFT SENT PARTIAL_RECEIVED RECEIVED CLOSED }


// ============ HUB 3: PROJECT ============
model Project {
  id            String   @id @default(cuid())
  companyId     String
  code          String
  name          String
  customerId    String
  complianceType String  // GOVERNMENT | PRIVATE_COMMERCIAL
  status        ProjectStatus
  budget        ProjectBudget?
  milestones    ProjectMilestone[]
}

model ProjectBudget {
  id            String   @id @default(cuid())
  projectId     String   @unique
  plannedMaterialCost Decimal @db.Decimal(18,2)
  plannedLaborCost    Decimal @db.Decimal(18,2)
  plannedSubcontractCost Decimal @db.Decimal(18,2)
  actualMaterialCost  Decimal @db.Decimal(18,2) @default(0)
  actualLaborCost     Decimal @db.Decimal(18,2) @default(0)
  actualSubcontractCost Decimal @db.Decimal(18,2) @default(0)
  // GP % = (revenue - actualCosts) / revenue  -> ใช้ทำ Profit Rainbow Panel
}

model ProjectMilestone { id String @id @default(cuid()) projectId String name String dueDate DateTime status String docChecklist Json }

model TechnicianTimesheet {
  id            String   @id @default(cuid())
  companyId     String
  projectId     String
  technicianId  String
  clockIn       DateTime
  clockOut      DateTime?
  gpsLat        Float?
  gpsLng        Float?
  receiptPhotos String[]
}

enum ProjectStatus { PLANNING IN_PROGRESS ON_HOLD COMPLETED CLOSED }


// ============ HUB 4: FINANCE & ACCOUNTING ============
model ChartOfAccount { id String @id @default(cuid()) companyId String code String name String type AccountType }
model JournalEntry {
  id            String   @id @default(cuid())
  companyId     String
  docNumber     String
  refType       String   // SO | PO | PAYMENT | MANUAL
  refId         String
  entryDate     DateTime
  lines         JournalLine[]
  isImmutable   Boolean  @default(true) // Immutable Ledger — แก้ไม่ได้ ต้องกลับรายการ (reversal)
}
model JournalLine { id String @id @default(cuid()) journalEntryId String accountId String debit Decimal @db.Decimal(18,2) @default(0) credit Decimal @db.Decimal(18,2) @default(0) }
model WithholdingTax { id String @id @default(cuid()) companyId String docNumber String rate Decimal @db.Decimal(5,2) amount Decimal @db.Decimal(18,2) refInvoiceId String }
model Payment { id String @id @default(cuid()) companyId String docNumber String direction PaymentDirection amount Decimal @db.Decimal(18,2) method String refId String }
model PeriodClose { id String @id @default(cuid()) companyId String periodMonth Int periodYear Int closedAt DateTime closedBy String }

enum AccountType { ASSET LIABILITY EQUITY INCOME EXPENSE }
enum PaymentDirection { IN OUT }


// ============ HUB 5: AI HUB (GENKIT) ============
model AIExpenseOCRJob {
  id            String   @id @default(cuid())
  companyId     String
  receiptImageUrl String
  extractedAmount Decimal? @db.Decimal(18,2)
  extractedVendor String?
  matchedProjectId String? // จับคู่จาก GPS + ตารางงานช่าง
  status        AIJobStatus
}
model AIPOScanJob { id String @id @default(cuid()) companyId String sourceFileUrl String extractedItems Json matchedSalesOrderId String? status AIJobStatus }
model AIWarrantyTrigger { id String @id @default(cuid()) companyId String serialNumberId String daysUntilExpiry Int draftMAProposalId String? sentToSalesUserId String? }

enum AIJobStatus { PENDING PROCESSING COMPLETED FAILED NEEDS_REVIEW }
```

---

## 2. Development Roadmap (Phased)

### Phase 0 — Foundation (สัปดาห์ 1–3)
โครงสร้างที่ทุก Hub ต้องพึ่งพา ทำก่อนเสมอ
- Multi-tenant架构: `companyId` middleware ทุก query, row-level isolation
- Auth & RBAC (Admin / Sales / Warehouse / Technician / Accountant)
- Document numbering service (Atomic Transaction, กันเลขชน)
- Soft Delete + Audit Log middleware (บังคับใช้ทุกตาราง)
- Chart of Accounts seed + Smart Accounting Link (income/expenseAccountId บน Product)

### Phase 1 — Inventory & Procurement Hub (สัปดาห์ 4–7)
- Product master + Kit/Package composition
- StockLedger + 3-State Stock Lock logic (onHand/reserved/available)
- WAC recalculation engine (trigger ทุกครั้งที่มี GR)
- Serial Number tracking + warranty expiry field
- PR → PO → GR flow, Supplier & AP

### Phase 2 — Commerce & CRM Hub (สัปดาห์ 8–11)
- Customer master (B2C/B2B/Government)
- Quotation → SO → Billing Note → Tax Invoice (เชื่อม stock reservation ตอนสร้าง SO)
- Tax Engine (Exclusive/Inclusive/Zero-rated/Exempt)
- POS module (แยก flow เร็วกว่า สำหรับสินค้าสำเร็จรูป)

### Phase 3 — Project Hub (สัปดาห์ 12–16)
- Project + Budget (planned vs actual) + Profit Rainbow Panel
- Milestone + Gantt chart + document compliance checklist
- Zap Bridge: Project → Quotation (ดึง BOM + labor)
- Mobile Technician Portal (เบิกของ, timesheet, ถ่ายรูปใบเสร็จ)

### Phase 4 — Finance & Accounting Hub (สัปดาห์ 17–20)
- Double-Entry GL engine (auto-post จากทุก transaction ใน Hub 1–3)
- WHT, Payment (รับ/จ่าย), Period Close
- Immutable Ledger (แก้ด้วย reversal entry เท่านั้น)

### Phase 5 — AI Hub / Genkit (สัปดาห์ 21–24)
- AI Expense OCR (Gemini 2.5 Flash) + GPS/schedule matching
- AI PO Scanning → auto-create SO
- AI Warranty & MA Trigger (cron 30 วันล่วงหน้า + draft proposal)

**หลักการเรียงเฟส:** ต้องมี Inventory ก่อน Commerce (ขายต้องเช็คสต็อกได้), ต้องมี Commerce+Inventory ก่อน Finance (บัญชีต้อง auto-post จาก transaction จริง), AI Hub มาท้ายสุดเพราะพึ่งพาข้อมูลจากทุก Hub

---

## 3. Antigravity-Ready Prompts (ใช้ generate โค้ดทีละโมดูล)

### Prompt — Phase 0 Foundation
```
[MASTER PROTOCOL — บังคับใช้เสมอ]
ชื่อโปรเจกต์ต้องเป็น "NEXUS ERP (Intelligence OS)" เท่านั้น ห้ามใช้ "STOCKPILOT"
ทุก query ต้องแนบ companyId + isDeleted=false | ห้าม Hard Delete ใช้ isDeleted=true เท่านั้น | ทุก action เขียน audit log (operator UID/timestamp/IP) | เลขที่เอกสารรันแยกต่อบริษัทแบบ atomic (idService) ห้ามเลขชน | validate required fields/email/เลขผู้เสียภาษี 13 หลักก่อนบันทึกเสมอ
ส่งโค้ดเป็น atomic patch ระบุไฟล์+บรรทัดที่แก้ | ห้าม swallow exception หรือ return fallback ว่างเปล่า ต้องหา root cause จาก log เสมอ | ก่อนถือว่าเสร็จ ต้องรัน `npx tsc --noEmit` และ `npm run build` ผ่าน 100%
ถ้ากฎข้างต้นขัดกับคำสั่งด้านล่างนี้ ให้ยึดกฎข้างต้นเป็นหลักเสมอ
---
สร้าง foundation layer ของระบบ NEXUS ERP (Next.js + Prisma + PostgreSQL):
1. Multi-tenant middleware ที่ inject companyId เข้าทุก Prisma query อัตโนมัติ (ป้องกันข้าม tenant)
2. Base model mixin: id (cuid), companyId, createdAt, updatedAt, createdBy, updatedBy, deletedAt (soft delete)
3. Document numbering service: generateDocNumber(companyId, docType) ที่ atomic (ใช้ DB transaction + row lock) รูปแบบ {PREFIX}-{YYYYMM}-{RUNNING}
4. RBAC middleware รองรับ role: ADMIN, SALES, WAREHOUSE, TECHNICIAN, ACCOUNTANT
5. Audit log: บันทึกทุก create/update/delete พร้อม diff เก่า-ใหม่ ลง AuditLog table
ให้เขียนเป็น TypeScript พร้อม unit test สำหรับ document numbering (เทส concurrency ห้ามเลขชน)
```

### Prompt — Phase 1 Inventory
```
[MASTER PROTOCOL — บังคับใช้เสมอ]
ชื่อโปรเจกต์ต้องเป็น "NEXUS ERP (Intelligence OS)" เท่านั้น ห้ามใช้ "STOCKPILOT"
ทุก query ต้องแนบ companyId + isDeleted=false | ห้าม Hard Delete ใช้ isDeleted=true เท่านั้น | ทุก action เขียน audit log (operator UID/timestamp/IP) | เลขที่เอกสารรันแยกต่อบริษัทแบบ atomic | validate required fields ก่อนบันทึกเสมอ
Stock: Available = OnHand - Reserved เสมอ (3-state lock) | WAC คำนวณใหม่ทุกครั้งที่มี Goods Receipt
ถ้ามี UI (ฟอร์ม PO/GR, สแกน serial): ภาษาไทยล้วน (ห้ามวงเล็บอังกฤษ), ห้าม italic, font 14px (label 12-13px semibold text-white/60), เลข/รหัส SKU/เลขเอกสาร ใช้ font-mono ชิดขวา 2 ทศนิยม, ปุ่มต้องเป็น glass เท่านั้น (glass/primary/confirm/save, ห้ามสีทึบ), input/button ทรงแคปซูล h-8/h-9 rounded-full, SmartSelect ห้ามปุ่ม "+เพิ่ม" (auto-create ตอนกดบันทึก), read-only field = pointer-events-none ไม่มีไอคอน, card = bg-neutral-900/90 border-white/15 rounded-3xl + border-l-4 สีตามหมวด + space-y-7/8
ส่งโค้ดเป็น atomic patch ระบุไฟล์+บรรทัด | ห้าม swallow error/return fallback ว่าง ต้องหา root cause จาก log | ต้องผ่าน `npx tsc --noEmit` และ `npm run build` ก่อนถือว่าเสร็จ
ถ้ากฎข้างต้นขัดกับคำสั่งด้านล่างนี้ ให้ยึดกฎข้างต้นเป็นหลักเสมอ
---
สร้างโมดูล Inventory & Procurement ของ NEXUS ERP ตาม schema นี้: [แปะ schema ส่วน Hub 2 จากไฟล์นี้]
สิ่งที่ต้อง implement:
1. Service ที่คำนวณ Weighted Average Cost ใหม่ทุกครั้งที่มี Goods Receipt: newWAC = (oldOnHand*oldWAC + receivedQty*receivedCost) / (oldOnHand+receivedQty)
2. Stock reservation service: reserveStock(productId, qty, refSO) ต้องเช็ค available = onHand - reserved ก่อนเสมอ ใน DB transaction ป้องกัน race condition (ใช้ SELECT FOR UPDATE)
3. Serial number scanner endpoint + validation (ห้าม serial ซ้ำ, ต้องสถานะ IN_STOCK ก่อนขายได้)
4. PR → PO → GR flow พร้อม partial receiving (รับของไม่ครบได้หลายรอบ)
เขียน API เป็น REST (Next.js route handlers) พร้อม Zod validation
```

### Prompt — Phase 2 Commerce & CRM
```
[MASTER PROTOCOL — บังคับใช้เสมอ]
ชื่อโปรเจกต์ต้องเป็น "NEXUS ERP (Intelligence OS)" เท่านั้น ห้ามใช้ "STOCKPILOT"
ทุก query ต้องแนบ companyId + isDeleted=false | ห้าม Hard Delete ใช้ isDeleted=true เท่านั้น | ทุก action เขียน audit log (operator UID/timestamp/IP) | เลขที่เอกสารรันแยกต่อบริษัทแบบ atomic | validate required fields/เลขผู้เสียภาษี 13 หลักก่อนบันทึกเสมอ
สินค้า/บริการต้องผูก incomeAccountId/expenseAccountId ล่วงหน้าเพื่อ auto-post GL (Smart Accounting Link) | GL debit ต้อง=credit เสมอ
ถ้ามี UI (ฟอร์ม QT/SO/POS, ตารางรายการ): ภาษาไทยล้วน (ห้ามวงเล็บอังกฤษ), ห้าม italic, font 14px (label 12-13px semibold text-white/60), ราคา/จำนวนเงินใช้ font-mono ชิดขวา 2 ทศนิยม, ปุ่มต้องเป็น glass เท่านั้น (glass/primary/confirm/save, ห้ามสีทึบ), input/button ทรงแคปซูล h-8/h-9 rounded-full, StepperInput แนวตั้ง (เพิ่มบน/ลดล่าง), SmartSelect ค้นหาลูกค้า/สินค้าห้ามปุ่ม "+เพิ่ม", card = bg-neutral-900/90 border-white/15 rounded-3xl + border-l-4 border-l-nexus-teal (หมวด Commerce) + space-y-7/8, ช่องบังคับกรอกมี "*" สีแดงติดชื่อฟิลด์
ส่งโค้ดเป็น atomic patch ระบุไฟล์+บรรทัด | ห้าม swallow error/return fallback ว่าง | ต้องผ่าน `npx tsc --noEmit` และ `npm run build` ก่อนถือว่าเสร็จ
ถ้ากฎข้างต้นขัดกับคำสั่งด้านล่างนี้ ให้ยึดกฎข้างต้นเป็นหลักเสมอ
---
สร้างโมดูล Commerce & CRM ตาม schema Hub 1 [แปะ schema]
สิ่งที่ต้อง implement:
1. Tax Engine: calculateTax(amount, mode: EXCLUSIVE|INCLUSIVE|ZERO_RATED|EXEMPT) คืนค่า subtotal/vat/grandTotal
2. Quotation → SalesOrder conversion (copy items, เปลี่ยนสถานะ, เรียก reserveStock จาก Inventory service)
3. SO → BillingNote → TaxInvoice document chain พร้อม partial delivery/billing
4. POS transaction endpoint แยก flow (เร็ว ไม่ผ่าน quotation) แต่ยังต้อง auto-post GL ผ่าน Smart Accounting Link
ผูก incomeAccountId จาก Product master ทุกครั้งที่สร้าง invoice item
```

### Prompt — Phase 3 Project Hub
```
[MASTER PROTOCOL — บังคับใช้เสมอ]
ชื่อโปรเจกต์ต้องเป็น "NEXUS ERP (Intelligence OS)" เท่านั้น ห้ามใช้ "STOCKPILOT"
ทุก query ต้องแนบ companyId + isDeleted=false | ห้าม Hard Delete ใช้ isDeleted=true เท่านั้น | ทุก action เขียน audit log (operator UID/timestamp/IP) | เลขที่เอกสารรันแยกต่อบริษัทแบบ atomic
ถ้ามี UI (Gantt, Profit Rainbow Panel, Mobile Technician Portal): ภาษาไทยล้วน (ห้ามวงเล็บอังกฤษ), ห้าม italic, font 14px (label 12-13px semibold text-white/60), ตัวเลขต้นทุน/งบประมาณใช้ font-mono ชิดขวา 2 ทศนิยม, ปุ่มต้องเป็น glass เท่านั้น (glass/primary/confirm/save, ห้ามสีทึบ), input/button ทรงแคปซูล h-8/h-9 rounded-full, card = bg-neutral-900/90 border-white/15 rounded-3xl + border-l-4 สีตามหมวดโครงการ + space-y-7/8, read-only field (เช่น ต้นทุนจริงที่คำนวณอัตโนมัติ) = pointer-events-none ไม่มีไอคอน
ส่งโค้ดเป็น atomic patch ระบุไฟล์+บรรทัด | ห้าม swallow error/return fallback ว่าง | ต้องผ่าน `npx tsc --noEmit` และ `npm run build` ก่อนถือว่าเสร็จ
ถ้ากฎข้างต้นขัดกับคำสั่งด้านล่างนี้ ให้ยึดกฎข้างต้นเป็นหลักเสมอ
---
สร้างโมดูล Project Hub ตาม schema Hub 3 [แปะ schema]
สิ่งที่ต้อง implement:
1. Profit Rainbow Panel: endpoint คืนค่า planned vs actual cost breakdown (material/labor/subcontract) + GP% real-time
2. Zap Bridge: convertProjectToQuotation(projectId) — ดึง BOM + labor card จากโครงการ สร้าง Quotation draft ในคลิกเดียว
3. Technician timesheet API: clock-in/out พร้อม GPS, upload receipt photo, auto-match กับ Project จาก GPS+schedule (ใช้ nearest-project-by-location algorithm)
4. Milestone + document compliance checklist (แยก template Government vs Private Commercial)
```

### Prompt — Phase 4 Finance & Accounting
```
[MASTER PROTOCOL — บังคับใช้เสมอ]
ชื่อโปรเจกต์ต้องเป็น "NEXUS ERP (Intelligence OS)" เท่านั้น ห้ามใช้ "STOCKPILOT"
ทุก query ต้องแนบ companyId + isDeleted=false | ห้าม Hard Delete เด็ดขาด แก้ไขรายการบัญชีต้องใช้ reversal entry เท่านั้น (ห้าม UPDATE/DELETE JournalEntry ตรงๆ) | ทุก action เขียน audit log (operator UID/timestamp/IP)
GL: debit ต้อง = credit เสมอ ต้อง assert balance ก่อน commit ทุกครั้ง (ACC-01 สำคัญที่สุดของ Hub นี้)
ถ้ามี UI (GL viewer, ฟอร์มรับ/จ่ายเงิน): ภาษาไทยล้วน (ห้ามวงเล็บอังกฤษ), ห้าม italic, font 14px (label 12-13px semibold text-white/60), จำนวนเงิน/รหัสผังบัญชีใช้ font-mono ชิดขวา 2 ทศนิยม, ปุ่มต้องเป็น glass เท่านั้น (glass/primary/confirm/save, ห้ามสีทึบ), input/button ทรงแคปซูล h-8/h-9 rounded-full, card = bg-neutral-900/90 border-white/15 rounded-3xl + border-l-4 สีตามหมวด + space-y-7/8, ฟิลด์ JournalEntry ที่ immutable ต้องเป็น read-only (pointer-events-none ไม่มีไอคอน)
ส่งโค้ดเป็น atomic patch ระบุไฟล์+บรรทัด | ห้าม swallow error/return fallback ว่าง | ต้องผ่าน `npx tsc --noEmit` และ `npm run build` ก่อนถือว่าเสร็จ
ถ้ากฎข้างต้นขัดกับคำสั่งด้านล่างนี้ ให้ยึดกฎข้างต้นเป็นหลักเสมอ
---
สร้างโมดูล Finance & Accounting ตาม schema Hub 4 [แปะ schema]
สิ่งที่ต้อง implement:
1. Double-entry GL auto-posting service: postJournalEntry(refType, refId) — subscribe/hook จาก event ของ SO completion, GR, Payment ฯลฯ ต้อง debit=credit เสมอ (assert balance ก่อน commit)
2. Immutable ledger: ห้าม UPDATE/DELETE JournalEntry ตรงๆ, แก้ไขต้องสร้าง reversal entry ใหม่เท่านั้น
3. WHT calculation + Period Close (lock ทุก transaction ก่อนเดือนที่ปิดแล้ว)
เขียน integration test: สร้าง SO → complete → ตรวจว่า GL entry ถูก post ถูกต้องอัตโนมัติ
```

### Prompt — Phase 5 AI Hub
```
[MASTER PROTOCOL — บังคับใช้เสมอ]
ชื่อโปรเจกต์ต้องเป็น "NEXUS ERP (Intelligence OS)" เท่านั้น ห้ามใช้ "STOCKPILOT"
ทุก query ต้องแนบ companyId + isDeleted=false | ทุก action เขียน audit log (operator UID/timestamp/IP) | ห้าม Hard Delete
งานส่วนใหญ่เป็น background job (OCR, scanning, cron) — ห้าม swallow error หรือ return fallback ว่างเปล่าเมื่อ AI extract ล้มเหลว ต้อง log และ flag เป็น NEEDS_REVIEW เสมอ (ตรงตามกฎ Zero Symptom Swallowing)
ถ้ามีหน้า review UI (เช่น ตรวจผล OCR ก่อนยืนยัน): ภาษาไทยล้วน (ห้ามวงเล็บอังกฤษ), ห้าม italic, font 14px (label 12-13px semibold text-white/60), ตัวเลขที่ AI ดึงมาใช้ font-mono ชิดขวา 2 ทศนิยม, ปุ่มยืนยัน/แก้ไขต้องเป็น glass เท่านั้น (glass/primary/confirm/save, ห้ามสีทึบ), card = bg-neutral-900/90 border-white/15 rounded-3xl + border-l-4 สีตามหมวด + space-y-7/8
ส่งโค้ดเป็น atomic patch ระบุไฟล์+บรรทัด | ต้องผ่าน `npx tsc --noEmit` และ `npm run build` ก่อนถือว่าเสร็จ
ถ้ากฎข้างต้นขัดกับคำสั่งด้านล่างนี้ ให้ยึดกฎข้างต้นเป็นหลักเสมอ
---
สร้างโมดูล AI Hub ด้วย Genkit + Gemini 2.5 Flash ตาม schema Hub 5 [แปะ schema]
สิ่งที่ต้อง implement:
1. AI Expense OCR flow: รับรูปใบเสร็จ → Gemini extract (amount, vendor, date) → match กับ Project จาก GPS/schedule ของช่างที่ clock-in ช่วงเวลานั้น
2. AI PO Scanning: รับ PDF/รูป PO จากลูกค้า → extract line items → auto-draft SalesOrder ให้ sales review ก่อน confirm
3. Cron job ตรวจ SerialNumber ที่ warrantyExpireAt ใกล้ถึง 30 วัน → auto-draft MA Proposal (ใช้ราคาปีก่อนหน้า +adjustment) → แจ้ง sales owner
```

---

**วิธีใช้:** ก็อปปี้แต่ละ Prompt section (พร้อม schema ที่เกี่ยวข้อง) ไปวางใน Antigravity ทีละเฟส แนะนำให้ทำ Phase 0 ให้เสร็จและเทสผ่านก่อนเริ่ม Phase ถัดไป เพราะทุก Hub พึ่งพา foundation layer นี้ทั้งหมด
