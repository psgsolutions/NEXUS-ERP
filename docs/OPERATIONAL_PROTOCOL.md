# 📜 NEXUS ERP: Operational Protocol (V2.9 Locked)

เอกสารฉบับนี้ระบุกฎการปฏิบัติงานที่เคร่งครัดสำหรับนักพัฒนาและ AI เพื่อรักษามาตรฐานระบบสูงสุด

---

## 1. 🛡️ ขอบเขตการทำงาน (Scope of Work)
- **Production-Ready Only**: โค้ดที่เขียนต้องผ่านการทดสอบ Dependency และไม่มีข้อผิดพลาด Runtime ก่อนส่งมอบ
- **Context Awareness**: ก่อนแก้ไขไฟล์ใดๆ ต้องอ่าน Metadata และ `NEXUS_SPEC.md` ทุกครั้ง
- **Strict Adherence**: ห้ามแก้ไขส่วนที่อยู่นอกเหนือคำสั่งของ User และห้ามเปลี่ยนสไตล์โดยพลการ

---

## 2. 🔐 มาตรฐานความปลอดภัย (Security Protocol)
- **Tenant Isolation**: ทุกฟังก์ชันงาน (Hooks, Services, Server Actions) ต้องรับ `companyId` และใช้ใน Query เสมอ
- **RBAC Enforcement**: ตรวจสอบ Role ผู้ใช้งานก่อนอนุญาตให้เข้าถึง Action สำคัญ (เช่น การลบ หรือการอนุมัติการเงิน)
- **Admin Confirmation**: การลบข้อมูลสำคัญต้องมี Modal ยืนยัน 2 ชั้น

---

## 3. 🧪 มาตรฐานวิศวกรรม (Engineering Protocol)
- **Atomic Transactions**: งานที่เกี่ยวข้องกับเงิน สต็อก และเลขที่เอกสาร ต้องรันภายใต้ `runTransaction` เท่านั้น
- **Double-Entry Consistency**: เมื่อมีการเคลื่อนย้ายพัสดุหรือเงิน ต้องมีการลงบัญชี GL ที่สมดุลเสมอ
- **Error Handling**: ใช้ `try-catch` บล็อกพร้อมการแจ้งเตือนผู้ใช้งานผ่าน `Toast` หรือ `Alert`

---

## 4. 🎨 มาตรฐาน UI/UX (PSG Protocol)
- **h-9 Standard**: บังคับความสูง 36px สำหรับทุก Input และ Button
- **Pill-shaped**: บังคับ `rounded-full` สำหรับ Interactive Elements
- **Non-italic Policy**: ตรวจสอบและยกเลิกการใช้ `italic` ใน CSS และ Tailwind Classes ทั้งหมด

---
*Status: OPERATIONAL PROTOCOL ACTIVE | Standard V2.9 Engaged*
