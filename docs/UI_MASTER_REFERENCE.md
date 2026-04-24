# 🎨 NEXUS ERP: UI Master Reference (PSG Standard V2.9)

คู่มืออ้างอิงมาตรฐานการออกแบบ UI/UX สำหรับระบบ NEXUS ERP

---

## 1. 📏 มิติและสัดส่วน (Dimensions)
- **Base Height**: `h-9` (36px) สำหรับปุ่ม, Input, Select, และ Tabs
- **Border Radius**: `rounded-full` สำหรับ Pill-shape และ `rounded-2xl` สำหรับการ์ด (GlassCard)
- **Compact Spacing**: `gap-2` หรือ `gap-4` สำหรับองค์ประกอบภายในกลุ่มข้อมูล

---

## 2. 🔠 สถาปัตยกรรมตัวอักษร (Typography)
- **Font Family**: `Sarabun` (สำหรับเนื้อหาภาษาไทย) และ `Inter` (สำหรับสากล)
- **Numeric Font**: `Monospace` (JetBrains Mono หรือ Roboto Mono) สำหรับรหัสและจำนวนเงิน
- **Strict Rule**:
    - `font-style: normal !important` (ห้ามตัวเอียง)
    - `tracking-tight` สำหรับหัวข้อขนาดใหญ่
    - `tracking-widest` สำหรับป้ายกำกับระดับ Tactical

---

## 3. 🎨 จานสีและการแสดงผล (Colors & Aesthetics)
- **Theme**: Ultra Dark (#0D0D0D)
- **Accent**: Nexus Teal (#00FFD1) พร้อมเอฟเฟกต์ Neon Glow
- **Secondary**: Nexus Blue (#00A3FF) สำหรับงานฝ่ายบุคคลและไอที
- **Danger**: Nexus Red (#FF0055) สำหรับจุดวิกฤต
- **Aesthetic**: **Neon-Glass** (Backdrop blur + Gradient borders)

---

## 4. 🧩 มาตรฐานคอมโพเนนต์ (Component Standards)
- **PillButton**: ต้องรองรับ `variant="primary"`, `variant="glass"`, และ `variant="outline"`
- **GlassCard**: ต้องมี `backdrop-blur-3xl` และขอบจางๆ `border-white/10`
- **NexusTable**: ต้องใช้ `h-9` สำหรับแถว และมี Hover Effect เสมอ

---
*Status: UI MASTER REFERENCE LOCKED | PSG Standard V2.9 Active*
