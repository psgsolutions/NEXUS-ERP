# 🧠 StockPilot System Design Philosophy & Engineering Manifesto (V2.9)

เอกสารฉบับนี้ระบุหลักการคิด (Logic), ปรัชญาการออกแบบ (Design), และสถาปัตยกรรมฐานข้อมูลเชิงลึก สำหรับระบบ NEXUS ERP

---

## 1. 🏗️ สถาปัตยกรรมทางความคิด (Strategic Logic)

### A. Strategic Consistency (ความสอดคล้องเชิงยุทธศาสตร์)
- **Reservation Protocol**: เมื่อเกิดใบสั่งขาย (SO) ระบบจะ "จอง" พัสดุไว้ทันที ข้อมูลสต็อกจะถูกแบ่งเป็น `onHand` (มีจริง), `reserved` (ติดจอง), และ `available` (พร้อมขาย) เพื่อป้องกันความเสี่ยงในการขายสินค้าที่ไม่มีอยู่จริง
- **Automated Double-Entry**: ทุกกิจกรรมที่มีมูลค่า (เงิน/พัสดุ) เช่น การรับของ (GRN) หรือ การเบิก (Issue) จะถูกส่งพิกัดไปลงบัญชีในสมุดรายวันกลาง (General Ledger) อัตโนมัติ 100%
- **Weighted Average Cost (WAC)**: คำนวณต้นทุนใหม่ทุกครั้งที่มีพัสดุเข้าคลัง เพื่อความแม่นยำในการวิเคราะห์กำไรขั้นต้น (GP)

### B. Multi-tenancy Scoping (การแยกส่วนนิติบุคคล)
- **Hard Scoping**: ข้อมูลทุก Byte ถูกกำกับด้วย `companyId` ในระดับ Root Query เพื่อรองรับการบริหารจัดการหลายบริษัทในระบบเดียวอย่างปลอดภัย
- **Isolated Sequences**: ลำดับเลขที่เอกสาร (PRJ, SKU, SO) ของแต่ละบริษัทจะรันแยกกันโดยเด็ดขาดผ่านระบบ Atomic Transaction ในคอลเลกชัน `counters`

---

## 2. 🗄️ หลักการออกแบบฐานข้อมูล (Database Architecture)

### A. Document Data Modeling (NoSQL Strategic Structure)
- **Flattened Collections**: ใช้โครงสร้างคอลเลกชันหลัก (products, projects, invoices) เพื่อความเร็วในการ Query
- **Snapshot Pattern**: บันทึกข้อมูลสำคัญ (เช่น ชื่อลูกค้า, ที่อยู่) ลงในเอกสารธุรกรรมทันที เพื่อป้องกันข้อมูลเปลี่ยนไปเมื่อมีการอัปเดต Master Data ในอนาคต
- **Atomic Counters**: ใช้คอลเลกชัน `counters` เพื่อเก็บลำดับเลขเอกสารล่าสุด โดยล็อคด้วยระบบ Transaction ของ Firestore

### B. Accounting Schema (General Ledger Logic)
- **Journal Entry Object**: บันทึกรายการในรูปแบบรายการบัญชีคู่ (Debit/Credit) ที่มียอดรวมสมดุลเสมอ (Balanced Entry)
- **Reference Mnemonics**: ผูกโยงรายการบัญชีกับรหัสเอกสารต้นทาง (Source Ref) เพื่อความสะดวกในการตรวจสอบย้อนกลับ (Audit Trail)

---

## 3. 🎨 ปรัชญาการออกแบบ UX/UI (The PSG Standard)

### A. กฎเหล็กมิติคงที่ (Strict Dimensions)
- **h-9 Action Standard**: ทุกปุ่ม ช่องกรอก และตัวเลือก ต้องมีความสูงคงที่ที่ **36px (h-9)** เท่านั้น
- **Absolute Pill-shape**: บังคับใช้ความโค้งระดับสูงสุด (`rounded-full`) เพื่อสร้างภาพลักษณ์ที่ลื่นไหลและพรีเมียม
- **Compact Density**: ลดระยะห่าง (Gaps) ระหว่างองค์ประกอบเพื่อให้แสดงผลข้อมูลได้หนาแน่นที่สุด เหมาะสำหรับงานบริหารที่ต้องการข้อมูลครบในหน้าจอเดียว

### B. สถาปัตยกรรมตัวอักษร (Typography Hardening)
- **Non-italic Policy**: ห้ามใช้ตัวเอียงในทุกจุดของระบบ 100% เพื่อความชัดเจนในการอ่านรหัสและตัวเลข
- **Precision Numerics**: ใช้ฟอนต์ **Monospace** สำหรับยอดเงินและรหัสเอกสาร เพื่อให้พิกัดตัวเลขตรงกันเสมอเมื่อแสดงผลในรูปแบบตาราง

---

## 4. 📝 การออกแบบหน้าจอการบันทึกข้อมูล (Input & Entry Design)

### A. Dual-Column Editor Architecture
- **Input Canvas (Left/Top)**: พื้นที่สำหรับกรอกข้อมูล แบ่งเป็นหมวดหมู่ (Tabs) เพื่อลดความซับซ้อน
- **Strategic Sidebar (Right)**: แสดงสรุปยอดเงิน (Financial Summary), สถานะ และปุ่ม Action หลัก (Save/Confirm) เพื่อให้ผู้ใช้เห็นผลกระทบก่อนยืนยัน

### B. Visual Context Entry
- **AI-First Entry**: ลดการพิมพ์ด้วยการใช้กล้องสแกน (Visual Scanner) สำหรับรหัส SKU และ Serial Number เพื่อความแม่นยำ 100%

---
*Status: MASTER BLUEPRINT LOCKED | Version 2.9 Active*
