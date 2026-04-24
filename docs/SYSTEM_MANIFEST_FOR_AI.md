# 📜 APO Master Logic & Operational Protocol (V2.9) - STRICT ADHERENCE

เอกสารฉบับนี้คือ "ธรรมนูญสูงสุด" ของ NEXUS ERP (Intelligence OS) ที่ AI ทุกระบบต้องใช้เป็น System Instruction เพื่อรักษามาตรฐานเดียวกันอย่างเคร่งครัด

## 1. มาตรฐานส่วนต่อประสานผู้ใช้ (UI Master Standards)
- **[UI-01] มิติความสูงมาตรฐาน**: ทุกจุดที่เป็น Action (ปุ่ม, ช่องกรอก, ตัวเลือก) ต้องมีความสูงคงที่ที่ **`h-9` (36px)** เท่านั้น ห้ามใช้ความสูงอื่นโดยพลการ
- **[UI-02] รูปทรงแคปซูล (Pill-shaped)**: บังคับใช้ความโค้งมนระดับสูงสุด **`rounded-full`** สำหรับปุ่มและอินพุตแถวเดียว เพื่อสร้างภาพลักษณ์ที่ลื่นไหลและพรีเมียม
- **[UI-03] ข้อยกเว้นช่องกรอกเนื้อหา**: สำหรับช่องกรอกข้อมูลหลายบรรทัด (Textarea) ให้ใช้ความโค้ง **`rounded-[2rem]`** และ Padding **`p-5`** เพื่อป้องกันความโค้งไปบดบังแนวสายตาและเคอร์เซอร์
- **[UI-04] สุนทรียภาพแห่งนีออน (Neon-Glass)**: ใช้คลาส `.glass-card` (Backdrop blur 24px, Border white/10) ร่วมกับระบบเงาเรืองแสงแบบ Layered Glow ที่นุ่มนวล ห้ามมีรอยตัดขอบ (Clip) ของเงาเด็ดขาด
- **[UI-05] ความเป็นไทยสมบูรณ์แบบ**: เมนู สถานะ และคำแนะนำการใช้งาน ต้องเป็น **ภาษาไทยมาตรฐาน** 100% ที่กระชับและเป็นภาษานักบริหาร

## 2. สถาปัตยกรรมตัวอักษรและตัวเลข (Typography & Numeric Protocol)
- **[TYP-01] กฎตัวตรง (Non-italic Rule)**: ห้ามใช้ตัวเอียง (Italic) ในทุกจุดของระบบ 100% (รวมถึงตัวเลขและรหัส) เพื่อความชัดเจนและเป็นทางการระดับองค์กร
- **[TYP-02] ระยะห่างตัวอักษร**: บังคับใช้ **`tracking-normal`** (ระยะห่างปกติ) ในทุกจุดสัมผัส ห้ามบีบหรือขยายช่องว่างตัวอักษร
- **[TYP-03] มิติตัวเลขแม่นยำ**: การแสดงผลยอดเงินและรหัสเอกสาร ให้ใช้ฟอนต์ **Monospace** ที่ตั้งตรงเพื่อให้พิกัดตัวเลขตรงกันและอ่านง่ายสูงสุด

## 3. ความปลอดภัยและเสถียรภาพข้อมูล (Data Security & Integrity)
- **[DAT-01] Multi-tenancy Isolation**: ข้อมูลทุก Byte ต้องถูกคัดกรองด้วย **`company_id`** ในทุก Query 100% ห้ามมีการรั่วไหลของข้อมูลข้ามบริษัทปฏิบัติการ
- **[DAT-02] Administrative Absolute Purge**: สิทธิ์ในการลบข้อมูลถาวร (Hard Delete) สงวนไว้ให้บทบาท **ADMIN** เท่านั้น และต้องผ่านระบบยืนยันความปลอดภัย (Type "delete" keyword)
- **[DAT-03] Atomic Sequence IDs**: รหัสเอกสาร (PRJ, SKU, SO, INV) ต้องรันผ่าน `idService` ที่ใช้ระบบ Atomic Transaction เพื่อป้องกันเลขซ้ำเมื่อใช้งานพร้อมกันหลายคน
- **[DAT-04] Non-blocking Writes**: ใช้ตรรกะการเขียนข้อมูลแบบไม่รอคอย (Non-blocking) เพื่อความลื่นไหลของ UI โดยจัดการข้อผิดพลาดผ่าน Contextual Error Handling

## 4. ตรรกะทางธุรกิจเชิงยุทธศาสตร์ (Strategic Business Logic)
- **[LOG-01] Stock Reservation**: เมื่อเกิด Sales Order ระบบจะทำการ "จอง" (Reserved) พัสดุทันทีเพื่อป้องกันการขายซ้ำ แต่ยังไม่ตัดสต็อกจริง
- **[LOG-02] Double-Entry GL**: ทุกธุรกรรมที่มีมูลค่าเงินหรือพัสดุ (รับของ, วางบิล, เบิกจ่าย) ต้องส่งพิกัดไปลงบัญชีใน `General Ledger (GL)` อัตโนมัติทันที
- **[LOG-03] WAC Valuation**: ระบบต้องคำนวณต้นทุนถัวเฉลี่ยถ่วงน้ำหนัก (Weighted Average Cost) ทุกครั้งที่มีการรับพัสดุเข้าคลัง

## 5. ธรรมาภิบาลปัญญาประดิษฐ์ (AI Governance)
- **[AI-01] Manual Trigger Only**: ห้ามเขียนโค้ดที่รัน AI โดยอัตโนมัติเมื่อโหลดหน้า (onLoad) การประมวลผล AI ต้องเกิดจากการกดปุ่มของผู้ใช้เท่านั้น
- **[AI-02] Latest Engine Deployment**: บังคับใช้โมเดล **Gemini 2.5 Flash** ผ่าน Genkit 1.x เพื่อประสิทธิภาพและความเร็วสูงสุดในการประมวลผล Enterprise Data
- **[AI-03] Visual Context Protocol**: ระบบสแกนด้วยภาพต้องระบุบริบท (Context) ที่ชัดเจนเสมอ (SKU, S/N, หรือ ID) ก่อนส่งเข้า Flow ประมวลผล

## 6. มาตรฐานทางเทคนิค (Technical Readiness)
- **[DEP-01] Production Runtime**: ห้ามใช้ `output: 'export'` ใน Next.js Config เพื่อรองรับ Server Actions และ AI Genkit บน Vercel
- **[DEP-02] Singleton Instance**: ระบบเชื่อมต่อ Firebase ต้องเป็น Singleton และรองรับการ Fallback ระหว่าง Named Database และ Default Instance อย่างราบรื่น

---
*Status: MASTER PROTOCOL LOCKED | Version 2.9 Active*
