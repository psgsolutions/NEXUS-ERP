# 🛡️ NEXUS ERP: THE MASTER SPECIFICATION (Intelligence OS - V2.9 Locked)

นี่คือ "คัมภีร์หลัก" (Source of Truth) ของระบบ NEXUS ERP ที่ได้รับการอัปเกรดตามพิมพ์เขียว **StockPilot V2.9 (Strategic Precision)** ทุกการทำงานของ AI ต้องยึดถือเอกสารฉบับนี้เป็นที่สิ้นสุด **ห้ามแตกแถว ห้ามแก้ไขส่วนที่ไม่ได้สั่ง และต้องเคร่งครัดต่อมาตรฐาน UI/UX และ Security 100%**

---

## 1. 🏗️ สถาปัตยกรรมทางยุทธศาสตร์ (Hub-Centric Architecture)
ระบบถูกออกแบบให้เป็น "Hub-Centric" แบ่งเป็น 5 ศูนย์ยุทธศาสตร์หลักที่เชื่อมโยงกันแบบ Real-time:
1. **Commerce Hub**: วงจรรายได้และการบริหารลูกค้า.
2. **Inventory Hub**: การควบคุมพัสดุและทรัพยากร.
3. **Project Hub**: ศูนย์บัญชาการปฏิบัติการหน้างาน.
4. **Finance Hub**: ระบบบัญชีและการเงินแบบ Double-Entry.
5. **Intelligence Hub**: หน่วยประมวลผลอัจฉริยะ (AI & Analytics).

---

## 2. 🗄️ หลักการออกแบบฐานข้อมูล (StockPilot V2.9 Logic)

### A. การแยกส่วนข้อมูล (Multi-tenancy Isolation)
- **Hard Scoping**: ข้อมูลทุก Byte (ทุก Document) ต้องมีฟิลด์ `companyId` (camelCase) กำกับเสมอ
- **Isolated Sequences**: ลำดับเลขที่เอกสารของแต่ละบริษัทจะรันแยกกัน 100% ผ่านระบบ Atomic Transaction

### B. ความถูกต้องของข้อมูล (Data Integrity & Ledger)
- **Atomic Transactions**: ใช้ตรรกะระดับอะตอมในการปรับยอดสต็อกและบัญชี เพื่อป้องกัน Concurrency Error
- **Immutable Ledger (GL)**: บันทึกบัญชีในรูปแบบสมุดรายวันกลางที่ห้ามแก้ไขย้อนหลัง แต่ใช้การ "Adjust" เพื่อความโปร่งใส
- **Snapshot Pattern**: บันทึกข้อมูล Master Data (เช่น ชื่อลูกค้า, ราคา) ลงในเอกสารธุรกรรมทันทีเพื่อป้องกันข้อมูลเปลี่ยนในอนาคต

### C. ตรรกะการไหลของพัสดุ (Resource Flow)
- **Reservation Protocol**: เมื่อเกิด SO ระบบจะ "จอง" (Reserved) พัสดุไว้ทันที สต็อกจะแบ่งเป็น `onHand`, `reserved`, และ `available`
- **Weighted Average Cost (WAC)**: คำนวณต้นทุนใหม่ทุกครั้งที่มีการรับของ (GRN) เพื่อความแม่นยำของ GP

---

## 3. 🎨 มาตรฐานการออกแบบ UX/UI (The PSG Standard V2.9)

### A. กฎเหล็กมิติและรูปทรง (Hard Constraints)
- **h-9 Standard**: ทุก Action Elements (ปุ่ม, Input, Select) ต้องมีความสูงคงที่ที่ **36px (h-9)** เท่านั้น
- **Absolute Pill-shape**: บังคับใช้ความโค้งระดับสูงสุด (`rounded-full`) สำหรับองค์ประกอบที่มีปฏิสัมพันธ์
- **Glassmorphism**: ใช้เอฟเฟกต์กระจกนีออน (`backdrop-blur-3xl`, `bg-white/5`) เพื่อความพรีเมียม

### B. สถาปัตยกรรมตัวอักษร (Typography Hardening)
- **Non-italic Policy**: **ห้ามใช้ตัวเอียงในทุกจุดของระบบ 100%** เพื่อความชัดเจนในการอ่านรหัสและตัวเลข
- **Precision Numerics**: ใช้ฟอนต์ **Monospace** สำหรับยอดเงิน, รหัสเอกสาร และรหัส Hash เสมอ
- **Compact Data Density**: แสดงข้อมูลให้หนาแน่นที่สุด (Zero-Scroll Intent) เพื่อให้นักบริหารเห็นภาพรวมในหน้าจอเดียว

### C. สถาปัตยกรรมการบันทึกข้อมูล (Data Entry)
- **Split-View Architecture**: ฝั่งซ้ายคือส่วนกรอกข้อมูล (Inputs), ฝั่งขวาคือส่วนสรุปผลและปุ่ม Action (Strategic Sidebar)

---

## 4. ⚡ อัจฉริยภาพของระบบ (System Intelligence)
- **Engine**: Gemini 2.5 Flash ผ่าน Genkit 1.x
- **AI-First Operations**: สกัดข้อมูลจากภาพ (OCR) สำหรับใบเสร็จและป้าย SKU เพื่อลดการพิมพ์
- **Temporal Forecaster**: วิเคราะห์ระดับสต็อกที่เหมาะสมและจุดสั่งซื้อจากประวัติจริง

---

## 5. การควบคุมทางเทคนิค (Technical Hardening)
- **Singleton Database**: ใช้ Singleton Pattern สำหรับ Firebase Initialization
- **Admin-Only Delete**: การลบข้อมูลสำคัญต้องได้รับสิทธิ์ ADMIN และมี Confirmation Modal
- **Audit Trail**: ทุก Action (C/U/D) ต้องถูกบันทึกลง `audit_logs` อัตโนมัติ

---
*Locked under NEXUS ERP V2.9 | Strategic Precision Active | Master Blueprint Engaged*
