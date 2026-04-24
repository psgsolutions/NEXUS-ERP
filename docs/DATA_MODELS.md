# 📊 NEXUS ERP: Data Models & Firestore Schema

พิมพ์เขียวโครงสร้างข้อมูลหลักสำหรับระบบ NEXUS ERP เพื่อความแม่นยำในการจัดการพัสดุและการบัญชี

---

## 1. 🏢 Company Profile (นิติบุคคล)
- **Path**: `/companies/{id}`
- **Description**: ข้อมูลบริษัทปฏิบัติการในเครือ (Operational Node)

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | string | รหัสบริษัท |
| `name` | string | ชื่อบริษัท |
| `tax_id` | string | เลขประจำตัวผู้เสียภาษี |
| `theme` | object | การตั้งค่าสีและ UI เฉพาะบริษัท |
| `bank_info` | object | ข้อมูลบัญชีธนาคารสำหรับออกเอกสาร |

---

## 📦 2. Product Master (คลังพัสดุ)
- **Path**: `/products/{productId}`
- **Description**: ฐานข้อมูลพัสดุและสินค้าหลัก รองรับระบบ Reservation

| Field | Type | Description |
| :--- | :--- | :--- |
| `product_id` | string | รหัสสินค้าในระบบ |
| `sku` | string | รหัสพิกัดพัสดุ (TYPE-YY-XXXX) |
| `name` | string | ชื่อพัสดุ / สินค้า |
| `category_id` | string | หมวดหมู่ |
| `currentQty` | number | จำนวนรวมทั้งหมด |
| **stock_status** | object | รายละเอียดสถานะสต็อก |
| `- qty_on_hand` | number | จำนวนที่มีอยู่จริงในคลัง |
| `- qty_reserved` | number | จำนวนที่ถูกจองไว้ (Reserved) |
| `- qty_available` | number | จำนวนที่พร้อมขายจริง |
| **pricing** | object | โครงสร้างราคาและต้นทุน |
| `- avg_cost` | number | ต้นทุนถัวเฉลี่ยถ่วงน้ำหนัก (WAC) |
| `- price_pos` | number | ราคาขายหน้าร้าน |
| `- price_project` | number | ราคาขายงานโครงการ |

---

## 📒 3. Journal Entry (สมุดรายวันกลาง)
- **Path**: `/journal_entries/{entryId}`
- **Description**: รายการบันทึกบัญชีแยกประเภททั่วไป (General Ledger)

| Field | Type | Description |
| :--- | :--- | :--- |
| `entry_id` | string | รหัสรายการบัญชี |
| `company_id` | string | รหัสบริษัทที่เกิดรายการ |
| `date` | timestamp | วันที่เกิดรายการ |
| `description` | string | คำอธิบายรายการ |
| `reference` | string | เอกสารอ้างอิง (เช่น SO-24-001) |
| **items** | array | รายการ Debit/Credit |
| `- account_code` | string | รหัสผังบัญชี |
| `- account_name` | string | ชื่อบัญชี |
| `- debit` | number | ยอดเดบิต |
| `- credit` | number | ยอดเครดิต |
| `total_amount` | number | ยอดรวมของรายการ |

---
*Status: DATA SCHEMA LOCKED | Enterprise Ready*
