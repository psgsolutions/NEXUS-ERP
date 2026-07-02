# 🛡️ NEXUS ERP: THE MASTER SPECIFICATION (Intelligence OS - V3.1 Locked)

นี่คือ "คัมภีร์หลัก" (Source of Truth) ของระบบ NEXUS ERP ที่ได้รับการอัปเกรดตามพิมพ์เขียว **PSG UI Protocol V3.1** และ **Database Schema V3.0** ทุกการทำงานของ AI ต้องยึดถือเอกสารฉบับนี้เป็นที่สิ้นสุด **ห้ามแตกแถว ห้ามแก้ไขส่วนที่ไม่ได้สั่ง และต้องเคร่งครัดต่อมาตรฐาน UI/UX และ Security 100%**

---

## 1. 🏗️ สถาปัตยกรรมทางยุทธศาสตร์ (Hub-Centric Architecture)
ระบบถูกออกแบบให้เป็น "Hub-Centric" แบ่งเป็น 5 ศูนย์ยุทธศาสตร์หลักที่เชื่อมโยงกันแบบ Real-time:
1. **Commerce Hub**: วงจรรายได้และการบริหารลูกค้า.
2. **Inventory Hub**: การควบคุมพัสดุและทรัพยากร.
3. **Project Hub**: ศูนย์บัญชาการปฏิบัติการหน้างาน.
4. **Finance Hub**: ระบบบัญชีและการเงินแบบ Double-Entry.
5. **Intelligence Hub**: หน่วยประมวลผลอัจฉริยะ (AI & Analytics).

---

## 2. 🗄️ โครงสร้างฐานข้อมูล (Database Schema V3.0)

### A. กฎเหล็กด้านความปลอดภัยและการแยกส่วนข้อมูล (Strict Tenant Isolation)
- **Hard Scoping**: ข้อมูลทุก Byte (ทุก Document) ต้องมีฟิลด์ `companyId` (camelCase) กำกับเสมอ และในทุกๆ การ Query ดึงข้อมูล หรือ Transaction ต้องมีการแนบเงื่อนไข `.where('companyId', '==', currentCompanyId)` และ `.where('isDeleted', '==', false)` เสมอ
- **Isolated Sequences**: ลำดับเลขที่เอกสารของแต่ละบริษัทจะรันแยกกัน 100% ผ่านระบบ Atomic Transaction

### B. ความถูกต้องของข้อมูล (Data Integrity & Ledger)
- **Soft Delete Only**: การจัดการข้อมูลบังคับใช้ระบบ Soft Delete (`isDeleted: true`) หรือการ Reverse Journal ตามมาตรฐานบัญชีเท่านั้น ห้ามใช้ Hard Delete เด็ดขาด
- **Atomic Transactions**: ใช้ตรรกะระดับอะตอมในการปรับยอดสต็อกและบัญชี เพื่อป้องกัน Concurrency Error
- **Immutable Ledger (GL)**: บันทึกบัญชีในรูปแบบสมุดรายวันกลางที่ห้ามแก้ไขย้อนหลัง แต่ใช้การ "Adjust" เพื่อความโปร่งใส

### C. โครงสร้างข้อมูลมาสเตอร์ (Master Data Structure)
- **Dynamic Product BOM Array**: ในคอลเลกชัน `products` โครงสร้างข้อมูลต้องรองรับ Array ของ Item ย่อยที่เก็บ `productId`, `quantity`, และ `allocatedCost` เพื่อผูกราคาชุดและกระจายต้นทุน
- **Account Mapping Node**: เพิ่ม Node การผูกรหัสบัญชีในเอกสารมาสเตอร์สินค้า:
  - `incomeAccountId: string` (ผูกรหัสผังบัญชีรายได้)
  - `expenseAccountId: string` (ผูกรหัสผังบัญชีค่าใช้จ่าย)

---

## 3. 🎨 มาตรฐานการออกแบบ UX/UI (PSG UI Protocol V3.1)

### A. ธีมและมิติรูปทรง (Theming & Components)
- **Theme**: Sci-Fi Aesthetic (Dark Theme ตัดกับจุดเด่นสี Cyan)
- **h-9 Standard**: ทุกช่อง Input และปุ่มสั่งการ บังคับใช้คลาส Tailwind `h-9 px-6 rounded-full` เพื่อคุมสเกลความเนี้ยบ
- **Contextual Modals (ป๊อปอัปกรอกข้อมูลแบบเลเยอร์)**: ฟอร์มประเภทป๊อปอัป (เช่น เพิ่ม บช ใหม่, ช่องทางการเงิน) ให้ใช้ Dialog Backdrop Blur ธีมมืด (`bg-black/50 backdrop-blur-sm`) เพื่อให้ผู้ใช้ไม่รู้สึกหลุดจาก Workflow

### B. สถาปัตยกรรมตัวอักษร (Typography & Data Alignment)
- **Non-italic Policy**: ห้ามใช้ตัวเอียงในทุกจุดของระบบ 100%
- **Precision Numerics & Master Code**: บังคับใช้ฟอนต์ **Monospace** สำหรับ "รหัสสินค้า" (SKU), "รหัสผังบัญชี" (เช่น 11-01-001), ยอดเงิน และรหัสเอกสารเสมอ เพื่อให้อ่านง่ายและจัดแนวตรงกันเป๊ะ
- **Table Alignment**: ตัวเลขจำนวนเงิน, ภาษี, ยอดรวม และรหัสสินค้าในตาราง บังคับใช้คลาส `font-mono tracking-tight text-right` และพ่วงฟังก์ชัน `calculateERPDocument` เพื่อให้ทศนิยม 2 ตำแหน่งตรงกันเป๊ะ

### C. โครงสร้าง Layout เพื่อการคีย์ข้อมูล (UI/UX Layout & Form)
- **Top-Level Metadata**: แบ่งหน้าจอส่วนหัวเอกสารเป็น Block ซ้าย-ขวา เพื่อให้ไล่อ่านจากบนลงล่างอย่างเป็นธรรมชาติ
- **Form Labels**: ฟิลด์บังคับกรอกให้ใช้รูปแบบ "ภาษาไทย * (English Specific)" เช่น `ชื่อผู้จำหน่าย * (Supplier Name)` (ดอกจันสีแดงติดกับภาษาไทยเสมอ)
- **Sticky Summary Bar**: แถบสรุปยอดเงิน (Grand Total) และภาษีแยกออกมาอย่างชัดเจน เพื่อ Instant Feedback
- **Data Table Tabular Layout**: ตารางกรอกรายการสินค้ารูปแบบ Grid ที่กระชับ กรอกรหัส จำนวน ราคา และส่วนลดในบรรทัดเดียว
- **Table Grouping**: การแสดงผลมาสเตอร์ดาต้าที่มีโครงสร้างซับซ้อน เช่น ผังบัญชี (COA) ให้ใช้โครงสร้างแบบ Nested Tree (ยุบ-ขยายตามหมวดหมู่ได้)

---

## 4. 🤖 ความฉลาดและการไหลของข้อมูลอัตโนมัติ (Intelligence OS Flow)

- **Smart Accounting Link (ลดการคีย์ 90%)**: เมื่อผู้ใช้ดึง "สินค้า" หรือ "ชุดจัดชุด" ไปเปิดเอกสาร ระบบจะดึง `incomeAccountId` หรือ `expenseAccountId` ไปสร้าง Journal Entry (เดบิต/เครดิต) ที่สมุดรายวันทันที พนักงานหน้าร้านไม่ต้องมีความรู้เรื่องบัญชี
- **Auto-Inference & Dropdown Linking**: เมื่อเลือกซัพพลายเออร์/ลูกค้า ระบบดึงที่อยู่, เลขผู้เสียภาษี และ Credit Term มาแสดงอัตโนมัติทันที
- **Tax Engine Toggle**: ระบบสลับประเภทภาษี (แยกนอก, รวมใน, อัตราศูนย์, ยกเว้น) ที่กดแล้วคำนวณตัวเลขในตารางใหม่ทั้งหมดโดยอัตโนมัติ
- **Smart Auto-Mapping Pipeline**: ระบบดึงข้อมูลข้ามเอกสารอัตโนมัติ (เช่น ใบเสนอราคา -> SO -> ใบกำกับภาษี) ข้อมูลสินค้า ทุน เรทค่าแรงจาก Sales BOM จะถูก Map ลงเอกสารใบถัดไปทันที
- **AI-First Operations**: สแกนเอกสารด้วย AI แปลงข้อมูลเข้าใบสั่งขาย (SO) อัตโนมัติ

---
*Locked under NEXUS ERP V3.1 | Strategic Precision Active | Master Blueprint Engaged*
