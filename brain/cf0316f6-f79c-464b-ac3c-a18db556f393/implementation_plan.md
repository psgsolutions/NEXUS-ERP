# บังคับใช้กฎระบบการแสดงผล (Enforce System UI Rules)

แผนการดำเนินการนี้มีเป้าหมายเพื่อบังคับใช้กฎ 3 ข้อหลักให้เป็นมาตรฐานเดียวกันทั่วทั้งระบบ ตามข้อกำหนดใน `AGENTS.md`

## สรุปสิ่งที่จะปรับปรุง

1. **กฎสีของรหัสเอกสาร (Document Code Colors)**
   - **รหัสหลัก (Primary Code):** ปรับให้เป็น `text-nexus-teal font-mono font-bold` ในทุกหน้าที่มีการแสดงรหัสหลักของหน้านั้น (เช่น หน้าสร้าง PO, หน้าดูเอกสาร)
   - **รหัสอ้างอิง (Reference Code):** ปรับให้เป็น `text-blue-400 font-mono` สำหรับรหัสที่ดึงมาจากเอกสารอื่น (เช่น รหัสใบเสนอราคาในหน้าสร้างใบสั่งขาย, รหัส PO ในหน้ารับสินค้า)

2. **กฎรูปแบบรหัสเอกสาร (Dynamic Code Format)**
   - **ปัญหา:** ปัจจุบันมีการ Hardcode รหัสเช่น `"PO-2607-0001"` หรือ `"INV-2026-0042"` กระจายอยู่ตามหน้าต่างๆ และ State เริ่มต้น
   - **วิธีแก้:** จะสร้าง Hook/Utility function `useDocumentFormat(docType)` หรือ `formatDocumentCode(prefix, year, month, running)` ที่เชื่อมโยงกับค่าจากหน้า Settings ทำให้เมื่อมีการแก้ Prefix ใน Settings (เช่น เปลี่ยนจาก PO- เป็น PUR-) รหัสในหน้าต่างๆ จะเปลี่ยนตามไปด้วยโดยอัตโนมัติ

3. **กฎเครื่องหมายดอกจันสีแดง 100% (Mandatory Asterisk)**
   - สแกนหาช่องกรอกข้อมูล (`Field`, `NexusInput`, `NexusSelect` ฯลฯ) ทั่วทั้งระบบ ที่มีการใช้ `*` เพื่อบอกว่าเป็นช่องบังคับกรอก
   - บังคับใช้คลาส `text-red-500 font-bold` ให้เหมือนกัน 100% ทั้งหมด เพื่อไม่ให้มีสีซีด สีเขียว หรือสีอื่นหลงเหลือ

## ขั้นตอนการดำเนินการ (Proposed Changes)

---

### 1. ระบบจัดการรูปแบบรหัส (Document Format System)
สร้าง Utility กลางเพื่อจัดการ Format รหัส

#### [NEW] `src/hooks/useDocumentFormat.ts`
สร้าง Hook สำหรับดึงรูปแบบรหัสเอกสารจาก `useSettings` (หรือ LocalStorage) และสร้างฟังก์ชัน `generateCode(type)` สำหรับฟอร์มสร้างเอกสารใหม่

### 2. ปรับปรุงหน้าฟอร์ม (Form Pages)
แทนที่รหัส Hardcode ด้วยการดึงจาก Hook และแยกสีรหัสหลัก/รหัสอ้างอิง

#### [MODIFY] `src/app/(authenticated)/sales/orders/new/page.tsx`
- ปรับช่องแสดงเลขที่ใบสั่งขาย (รหัสหลัก) เป็น `text-nexus-teal`
- ปรับช่องแสดงเลขที่ใบเสนอราคาอ้างอิง (รหัสอ้างอิง) เป็น `text-blue-400`
- ใช้ `generateCode('salesOrder')` เป็นค่าเริ่มต้น แทน Hardcode

#### [MODIFY] `src/app/(authenticated)/procurement/po/new/page.tsx`
- ปรับช่องแสดงเลขที่ใบสั่งซื้อ (รหัสหลัก) เป็น `text-nexus-teal`
- ปรับรหัสอ้างอิง PR (รหัสอ้างอิง) เป็น `text-blue-400`

#### [MODIFY] หน้าฟอร์มอื่นๆ (Accounting, Inventory, Finance)
- `accounting/ar/invoice/new/page.tsx`
- `accounting/ap/payment-voucher/new/page.tsx`
- `inventory/new/page.tsx`
- นำ Hook `useDocumentFormat` ไปใช้ และปรับสีรหัสให้ตรงตามกฎ

### 3. ปรับปรุงสีเครื่องหมายบังคับกรอก (Red Asterisk Fixes)
ค้นหาและปรับแก้ Component ที่มีการสร้างฟอร์ม หรือมี `Field` ภายใน

#### [MODIFY] `src/components/core/NexusInput.tsx` (ตรวจสอบและย้ำความถูกต้อง)
#### [MODIFY] `src/components/core/NexusSelect.tsx` (ตรวจสอบและย้ำความถูกต้อง)
#### [MODIFY] `src/components/reports/FormBuilder.tsx`
#### [MODIFY] หน้าอื่นๆ ที่มี Inline Field components

## User Review Required

> [!IMPORTANT]
> **การใช้ `useDocumentFormat` ในระบบหน้าจอที่มี Mock Data ปัจจุบัน:** 
> ข้อมูลตัวอย่างในตาราง (เช่น หน้ารายการ PO/Invoice) ที่เป็น Mock Data ควรอัปเดตให้สอดคล้องกับการตั้งค่าหรือไม่? หรือให้เริ่มใช้ Hook นี้เฉพาะกับ "หน้าสร้างเอกสารใหม่ (New Document)" และการแสดงผลหน้า Detail เป็นหลัก?
> **แนะนำ:** เพื่อความรวดเร็วและปลอดภัย จะปรับให้ **หน้าสร้างเอกสารใหม่** ดึงรหัสจาก Settings เสมอ ส่วน **ตารางข้อมูล Mock** จะปรับคลาสสี (Color Rules) ให้ถูกต้องแต่อาจจะใช้ Mock ID ไปก่อน เพื่อไม่ให้กระทบ Flow การเดโม่

## Verification Plan

### Manual Verification
- เปิดหน้าจอ "ตั้งค่าระบบ" ลองแก้ไขรูปแบบ Prefix ของ PO เป็นแบบอื่น
- ไปที่หน้า "สร้างใบสั่งซื้อใหม่" ตรวจสอบว่ารหัสที่ Gen ออกมาใช้ Prefix ใหม่หรือไม่ และแสดงด้วยสี **Nexus Teal**
- ไปที่หน้าอ้างอิงเอกสาร ตรวจสอบว่ารหัสอ้างอิงแสดงด้วยสี **ฟ้า (Blue-400)**
- ตรวจสอบฟอร์มหน้าต่างๆ ว่าเครื่องหมาย `*` แดงสด 100% ตรงกันทั้งหมด