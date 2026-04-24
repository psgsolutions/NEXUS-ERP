# 🗺️ NEXUS ERP: Strategic Architecture & Intelligence Map (V2.5)

เอกสารฉบับนี้ระบุตรรกะหัวใจหลัก (Core Logic), ขีดความสามารถ (Capabilities) และอัจฉริยภาพ (Intelligence) ของระบบ NEXUS ERP เพื่อใช้เป็นบรรทัดฐานในการขยายตัวระดับ Enterprise

---

## 🧠 1. ตรรกะหัวใจหลัก (System Core Logic)

ระบบทำงานบนพื้นฐานของ **"ความสอดคล้องเชิงยุทธศาสตร์" (Strategic Consistency)** โดยมีตรรกะควบคุมดังนี้:

### A. ตรรกะการไหลของพัสดุ (Resource Flow Logic)
- **Reservation Protocol**: เมื่อเกิด `Sales Order (SO)` ระบบจะไม่หักสต็อกทันที แต่จะทำการ **"จอง" (Reserved)** เพื่อป้องกันการขายซ้ำ
- **Atomic Deduction**: สต็อกจะถูกหักจริง (Hard Deduct) ต่อเมื่อเกิด `Internal Issue` (เบิกไปหน้างาน) หรือ `POS Sale` (ขายหน้าร้าน) เท่านั้น
- **Weighted Average Cost (WAC)**: ทุกครั้งที่มีการ `Goods Receipt (GRN)` ระบบจะคำนวณต้นทุนเฉลี่ยใหม่ทันที เพื่อความแม่นยำในการคำนวณกำไร (GP)

### B. ตรรกะบัญชีคู่ขนาน (Double-Entry Automation)
- **Automated Posting**: ทุกธุรกรรมทางการเงิน (แจ้งหนี้, รับของ, เบิกพัสดุ) จะถูกส่งพิกัดไปลงบัญชีใน `General Ledger (GL)` อัตโนมัติ 100%
- **Accrual Basis**: ใช้เกณฑ์คงค้างในการรับรู้รายได้และค่าใช้จ่าย เพื่อให้รายงานภาษี (ภ.พ.30) และงบกำไรขาดทุนสะท้อนความจริงสูงสุด

### C. ตรรกะการแยกส่วนนิติบุคคล (Multi-tenancy Isolation)
- **Root Scoping**: ข้อมูลทุก Byte ถูกกำกับด้วย `company_id`
- **Isolated Sequences**: เลขที่เอกสาร (PRJ, SKU, SO) ของแต่ละบริษัทจะรันแยกกันโดยเด็ดขาดผ่านระบบ `idService`

---

## 🛠️ 2. ขีดความสามารถของระบบ (System Capabilities)

ระบบถูกแบ่งออกเป็น 5 ศูนย์บัญชาการเชิงกลยุทธ์:

- **Commerce Hub**: จัดการวงจรรายได้ (CRM -> Quotation -> SO -> POS) พร้อมระบบสลับชื่อพัสดุตามความต้องการลูกค้า (Smart Alias)
- **Inventory Hub**: ควบคุมพัสดุผ่านระบบชุดงาน (Kits/BOM), การโอนย้ายระหว่างคลัง (Transfers) และการตรวจสอบยอด (Audit)
- **Project Hub**: บริหารงานติดตั้งและบริการหน้างาน เชื่อมโยงต้นทุนพัสดุ (Material Cost) และค่าแรง (Labor Cost) เข้ากับโครงการโดยตรง
- **Finance Hub**: จัดการวงจรรายจ่าย (Supplier -> PO -> AP) และการเก็บเงิน (Billing -> AR) พร้อมรายงานภาษีครบวงจร
- **Intelligence Hub**: ศูนย์รวมการวิเคราะห์สถิติและตั้งค่าความปลอดภัยระดับสูง (RBAC)

---

## ⚡ 3. อัจฉริยภาพของระบบ (System Intelligence)

NEXUS ERP ใช้ขุมพลัง **Gemini 2.5 Flash** ผ่าน **Genkit 1.x** ในการขับเคลื่อนความฉลาด:

### A. Visual Intelligence (การรับรู้ผ่านภาพ)
- **AI Industrial Scanner**: สแกนรหัส SKU และ Serial Number จากป้ายชื่ออุปกรณ์จริง เพื่อลดความผิดพลาดในการคีย์ข้อมูล
- **OCR Financial Extraction**: อ่านภาพใบเสร็จค่าใช้จ่ายหน้างาน แล้วสกัดข้อมูล (ร้านค้า, ยอดเงิน, วันที่) เพื่อบันทึกบัญชีอัตโนมัติ

### B. Analytical Intelligence (การวิเคราะห์เชิงรุก)
- **Inventory Optimization**: AI วิเคราะห์ประวัติการขายร่วมกับยอดสต็อกปัจจุบัน เพื่อแนะนำ **Reorder Point** ที่เหมาะสมที่สุด เพื่อลด "เงินจม" ในคลัง
- **Smart Discovery**: ระบบค้นหาพิกัดอุปกรณ์ในหน้าแจ้งซ่อม โดย AI จะไล่เรียงประวัติจาก `Internal Issue` เพื่อระบุว่าอุปกรณ์ S/N นี้ อยู่ที่โครงการไหนและใครเป็นเจ้าของ

### C. Operational Intelligence (การสั่งการอัจฉริยะ)
- **AI Command Center**: ระบบ Command-line ภาษาธรรมชาติที่เข้าใจคำสั่งมนุษย์ (เช่น "เปิดใบสั่งขายให้บริษัท ABC") และดำเนินการนำทางหรือประมวลผลให้ทันที

---
*Status: ARCHITECTURE LOCKED | Master Logic V2.5 Active*
