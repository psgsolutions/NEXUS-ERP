---
description: Standard Operating Procedure for NEXUS ERP (Intelligence OS) Version 3.1
---

# Standard Operating Procedure (SOP): NEXUS ERP (Intelligence OS)
**Version:** 3.1 (Locked & Production Ready)
**Framework Standards:** Next.js 15, React 19, TypeScript, Tailwind CSS, Firebase Firestore NoSQL

เอกสารฉบับนี้คือข้อตกลงและแนวปฏิบัติมาตรฐาน (Single Source of Truth) ที่ทีมพัฒนาและ AI ทุกตัว ต้องยึดถืออย่างเคร่งครัด ในการสร้าง แก้ไข และพัฒนาโมดูลต่างๆ ของระบบ NEXUS ERP เพื่อไม่ให้เกิดความขัดแย้งของโค้ด และรักษามาตรฐานระดับ Enterprise สูงสุด

## 1. 🏗️ สถาปัตยกรรมเลย์เอาต์และการจัดวางหน้าจอ (Layout & Dashboard Alignment)
- **Full-Page Master Layout:** ห้ามใช้ Modal หรือ Popup ซ้อนทับสำหรับการจัดการข้อมูลหลัก ทุกหน้าจอต้องรันบน Full-Page เต็มจอเสมอ (`fixed inset-0 z-[5000] w-screen h-screen flex flex-col bg-[#0a0a0c] overflow-hidden`)
- **Dashboard Visual Alignment (Strict Row Splicing):** การจัดวางการ์ดหรือ Widget บนหน้าแดชบอร์ด ห้ามมีความเหลื่อมล้ำสูงต่ำเด็ดขาด บังคับใช้ Grid หรือ Flexbox ควบคุมให้ขอบบนของการ์ดฝั่งซ้ายและฝั่งขวาอยู่ในระนาบเดียวกัน (Row Alignment) อย่างสมบูรณ์ การ์ดสรุปผลหรือ Widget ขนาดเล็กที่อยู่ส่วนบน ให้จัดวางแบบชิดขวา (`justify-end / ml-auto`) เพื่อความสมดุลของพื้นที่หน้าจอ
- **Glassmorphism & Translucent Icon Style:** ไอคอนทั้งหมดในหน้าจอ (เช่น KPI Cards, Action Buttons, Quick Menus) ต้องใช้ดีไซน์โปร่งแสง (Translucent / Semi-transparent) บังคับใช้คลาส Tailwind: `bg-white/[0.04] hover:bg-white/[0.08] text-cyan-400 border border-white/10 backdrop-blur-sm transition-all`

## 2. 🎨 มาตรฐาน UI/UX และการออกแบบ (PSG UI Protocol V3.1)
- **Theme & Aesthetic:** ใช้ธีม Sci-Fi (Dark Theme) พื้นหลังเข้ม ตัดกับเส้นขอบโปร่งแสงและจุดเด่นสี Cyan (`bg-[#0a0a0c]`, ขอบ `border-white/5` หรือ `border-white/10`)
- **Component Sizing (Capsule Standard):**
  - ปุ่มกด (Buttons) และช่องกรอกข้อมูล (Inputs/Selects) ทุกตัว บังคับใช้ความสูงและรูปทรงมาตรฐาน `h-9 px-6 rounded-full`
  - ปุ่มไอคอนเฉพาะ (Icon-only Buttons) บังคับใช้ขนาดทรงกลมมาตรฐาน `w-9 h-9 rounded-full flex items-center justify-center`
- **Typography & Non-Italic Policy:**
  - ห้ามมีตัวอักษรเอียง (0% Italic / `not-italic`) ทั่วทั้งระบบอย่างเด็ดขาด
  - ตัวเลขการเงิน รหัสเอกสาร รหัสสินค้า และรหัสพนักงาน บังคับใช้ฟอนต์ Monospace (`font-mono tracking-tight text-right`) เสมอ
- **Form Labels:** ป้ายกำกับฟอร์มต้องใช้รูปแบบมาตรฐาน "ภาษาไทย * (English Specific)" โดยเครื่องหมายดอกจันสีแดงต้องอยู่ติดกับคำภาษาไทยเสมอ

## 3. 🛡️ ความปลอดภัยฐานข้อมูลและข้อมูลสิทธิ์ (Database & Tenant Security)
- **Strict Tenant Isolation:** ทุกคำสั่ง Query หรือ Transaction ใน Firebase Firestore ต้องพ่วงเงื่อนไขบังคับ `.where('companyId', '==', currentCompanyId)` และ `.where('isDeleted', '==', false)` ทุกครั้งอย่างไร้ข้อยกเว้น เพื่อป้องกันข้อมูลรั่วไหลข้ามบริษัท
- **Soft Delete Policy:** ห้ามใช้คำสั่งลบข้อมูลทิ้งจริงถาวร (Hard Delete) บังคับใช้สถานะ `isDeleted: true` เท่านั้น
- **Audit Trail:** ทุกการเปลี่ยนแปลงข้อมูลสำคัญหรือการทำธุรกรรมการเงิน ต้องบันทึกชื่อผู้ทำรายการ (`createdBy`, `updatedBy`) และประทับเวลาลงในระบบ Audit Log เสมอ

## 4. ⚙️ มาตรฐานการพัฒนาโค้ด (Code Maintainability & State Management)
- **Modularization:** แยกโค้ดออกเป็นส่วนย่อย (Separation of Concerns) เช่น โฟลเดอร์ `components/ui/`, `hooks/`, และ `types/` เพื่อลดโค้ดซ้ำซ้อนและป้องกันปัญหา Variable Mismatch
- **Type Safety:** ทุกคอมโพเนนต์และฟังก์ชันต้องประกาศ TypeScript Interfaces หรือ Types ให้ชัดเจน ป้องกันการเกิด Hydration Error และ Type Mismatch บน Next.js App Router
