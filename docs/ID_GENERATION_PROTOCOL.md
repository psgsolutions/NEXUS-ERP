# 🆔 Strategic ID Generation Protocol (V8.5) - MASTER DOCUMENT

เอกสารฉบับนี้ระบุกฎเหล็กในการสร้างรหัส (ID) ทุกประเภทในระบบ NEXUS ERP (StockPilot Adaptation) เพื่อความเป็นระเบียบ ความแม่นยำ และการตรวจสอบย้อนกลับได้ง่าย (Traceability)

---

## 1. โครงสร้างรหัสพื้นฐาน (Standard Structure)
รหัสเกือบทั้งหมดจะใช้รูปแบบ: `PREFIX-YY-XXXX` หรือ `PREFIX-YY-MNEMONIC-XXXX`

| ส่วนประกอบ | คำอธิบาย | ตัวอย่าง |
| :--- | :--- | :--- |
| **PREFIX** | ตัวย่อประเภทเอกสาร 3 หลัก | PRJ, SKU, SO, PUR |
| **YY** | ปี ค.ศ. 2 หลักสุดท้าย | 26 (สำหรับปี 2026) |
| **MNEMONIC** | อักษรช่วยจำ 3 หลัก (Optional) | THT (จาก ThaiTech) |
| **XXXX** | ลำดับตัวเลข 4-5 หลัก | 0001, 00001 |

---

## 2. กฎการสร้างรหัสแยกตามโมดูล (Module Rules)

### A. งานโครงการ (Projects)
- **รูปแบบ**: `PRJ-YY-MNEMONIC-XXXX`
- **ตรรกะ**: สกัดอักษร 3 หลักแรกจากชื่อโครงการ (ถ้าเป็นภาษาไทยจะแปลงเป็น English Karaoke ก่อน)
- **ตัวอย่าง**: `PRJ-26-ALP-0005` (โครงการ Alpha)

### B. สินค้าและพัสดุ (SKU/Products)
- **รูปแบบ**: `SKU-CAT-XXXXX` (ใช้ 5 หลัก)
- **ตรรกะ**: CAT คือรหัสหมวดหมู่ (เช่น HW, SW, NW)
- **ตัวอย่าง**: `SKU-HW-00125`

### C. งานขายและลูกค้า (Commerce Hub)
- **Quotation (QUO)**: `QUO-YY-XXXX`
- **Sales Order (SO)**: `SO-YY-XXXX`
- **Customer (CUS)**: `CUS-YY-XXXX`

### D. งานจัดซื้อและการเงิน (Finance Hub)
- **Purchase Order (PUR)**: `PUR-YY-XXXX`
- **Invoice/Receipt (REC)**: `REC-YY-XXXX`
- **Journal Entry (GL)**: `GL-YY-XXXX`
- **Supplier (SUP)**: `SUP-YY-XXXX`

### E. งานปฏิบัติการและคลัง (Inventory Hub)
- **Internal Issue (ISS)**: `ISS-YY-XXXX`
- **Transfer (TRF)**: `TRF-YY-XXXX`
- **Stock Audit (STK)**: `STK-YY-XXXX`
- **Warehouse (WHS)**: `WHS-YY-XXXX`

---

## 3. ตรรกะทางเทคนิค (Atomic Sequence ID)
- **Multi-tenancy Isolation**: ระบบตัวนับเลข (Counter) จะถูกแยกขาดตาม `companyId`
- **Atomic Transaction**: ใช้ระบบ Firestore Transaction ในการดึงเลขถัดไป เพื่อป้องกันเลขซ้ำเมื่อมีผู้ใช้งานบันทึกพร้อมกัน
- **Immutable Sequence**: เมื่อรหัสถูกสร้างและบันทึกแล้ว ห้ามเปลี่ยนรหัสโดยเด็ดขาด

---
*Status: PROTOCOL LOCKED | Version 8.5 Active*
