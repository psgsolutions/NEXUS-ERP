# แผนการพัฒนาระบบออกแบบเอกสารอิสระ (Ultimate Document Form Builder)

ระบบนี้จะช่วยให้ผู้ใช้สามารถออกแบบเอกสารได้เองผ่านหน้าจอแบบ Drag & Drop โดยสามารถผูกข้อมูลกับฐานข้อมูล (Dynamic Data Binding) และแปลงผลลัพธ์เป็นไฟล์ PDF ได้อย่างสมบูรณ์แบบ

## User Review Required

> [!IMPORTANT]
> **การเลือกไลบรารี Drag & Drop:** ในแผนนี้เราจะใช้ `dnd-kit` เป็นหลักเพื่อให้ได้ความอิสระสูงสุด (Freeform Layout) แต่หากต้องการให้จัดวางง่ายขึ้นแบบ Snap-to-Grid อาจต้องพิจารณาใช้ `react-grid-layout` ร่วมด้วยหรือแทนที่ รบกวนยืนยันว่าต้องการเน้นอิสระสูงสุด (Freeform) หรือความเป็นระเบียบ (Grid) ครับ
> 
> **การแสดงผล PDF:** ระบบจะใช้ `@react-pdf/renderer` ซึ่งอาจมีข้อจำกัดบางประการในการเรนเดอร์ UI ที่ซับซ้อนมากๆ เมื่อเทียบกับการใช้ HTML2Canvas เราจะเน้นโครงสร้างแบบง่ายและรองรับฟอนต์ไทย (Sarabun) เป็นหลัก

## Open Questions

> [!NOTE]
> 1. **ขนาดกระดาษ:** นอกเหนือจากขนาด A4 แนวตั้งแล้ว ต้องการให้รองรับแนวนอน (Landscape) หรือขนาดอื่นๆ (เช่น A5, Letter) ในเฟสแรกเลยหรือไม่?
> 2. **หมวดหมู่ข้อมูล (Data Sources):** ในเบื้องต้นจะมีการผูกข้อมูลจากหมวด "ลูกค้า", "สินค้า", "บริษัท" มีหมวดหมู่อื่นๆ ที่ต้องเตรียมไว้ล่วงหน้าหรือไม่?
> 3. **รูปแบบเอกสาร (Templates):** ต้องการให้มีเทมเพลตเริ่มต้น (Default Templates) ให้ผู้ใช้เลือกก่อนสร้างใหม่หรือไม่ หรือเริ่มจากกระดาษเปล่าเสมอ?

## Proposed Changes

การพัฒนาระบบจะแบ่งออกเป็น 3 ส่วนหลักคือ UI Layout, State Management, และ PDF Rendering

---

### UI / UX Components (3-Pane Layout)

สร้างหน้าจอหลักสำหรับการออกแบบเอกสาร โดยแบ่งเป็น 3 ส่วนตามมาตรฐาน

#### [NEW] `src/app/(authenticated)/settings/document-builder/page.tsx`
- หน้าเพจหลักที่เป็นคอนเทนเนอร์สำหรับ Document Form Builder
- โครงสร้างแบบ 3-Pane Layout (Toolbox, Canvas, Properties)

#### [NEW] `src/components/document-builder/ToolboxPanel.tsx`
- **แถบซ้าย (Toolbox / Data Sources):**
- เมนูองค์ประกอบ (Elements): กล่องข้อความ, รูปภาพ/โลโก้, เส้นกั้น, ตาราง
- เมนูตัวแปร (Data Fields): รายการตัวแปรจากฐานข้อมูล (เช่น `{customerName}`, `{documentNo}`) เพื่อให้ลากไปวางบน Canvas

#### [NEW] `src/components/document-builder/CanvasWorkspace.tsx`
- **ตรงกลาง (Canvas Workspace):**
- พื้นที่จำลองกระดาษ (เช่น ขนาด A4) 
- ใช้ `dnd-kit` ในการจัดการการวาง (Drop), ย้าย (Drag), และปรับขนาด (Resize) องค์ประกอบ
- แสดงผล Real-time Preview เมื่อมีการผูกตัวแปร (จำลองข้อมูลตัวอย่าง)

#### [NEW] `src/components/document-builder/PropertiesPanel.tsx`
- **แถบขวา (Properties Panel):**
- ฟอร์มการตั้งค่าสำหรับองค์ประกอบที่ถูกเลือก (Active Element)
- ปรับขนาดฟอนต์, สี, ตัวหนา (ตามกฎคือ **ห้ามมีตัวเอน**)
- ตั้งค่าการผูกตัวแปร (Data Binding) สำหรับกล่องข้อความ

---

### State Management & Engine

จัดการข้อมูลพิกัด รูปแบบ และการผูกตัวแปรบน Canvas

#### [NEW] `src/contexts/DocumentBuilderContext.tsx`
- ใช้ React Context API เก็บสถานะ (State) ของเอกสาร
- เก็บ JSON Array ขององค์ประกอบทั้งหมดบนหน้าจอ ประกอบด้วย: id, type, x, y, width, height, properties (font, color), และ boundField
- ฟังก์ชันจัดการ: addElement, updateElement, removeElement, selectElement

#### [NEW] `src/types/document-builder.ts`
- กำหนด Type Definition สำหรับระบบ Builder
- `DocumentElement`: อินเทอร์เฟซหลักขององค์ประกอบบนกระดาษ
- `TemplateData`: โครงสร้างข้อมูล JSON ที่จะบันทึกลง Firebase

---

### Data Fetching & PDF Rendering

การแปลง Template JSON เป็น PDF และผูกข้อมูลจริง

#### [NEW] `src/utils/document-renderer.ts`
- ฟังก์ชันสำหรับแปลงตัวแปร Template Literals (เช่น `{customerName}`) โดยดึงข้อมูลจริงจาก Firebase
- ตรวจสอบ `companyId == currentCompanyId` เสมอ

#### [NEW] `src/components/document-builder/DocumentPDFGenerator.tsx`
- ใช้ `@react-pdf/renderer` เพื่อแปลง Template JSON ให้กลายเป็นเอกสาร PDF
- โหลดฟอนต์ภาษาไทย (Sarabun)
- จัดวางตำแหน่งพิกัดแบบ Absolute ตามค่า X, Y ที่ถูกออกแบบไว้บน Canvas

## Verification Plan

### Manual Verification
1. **UI Layout:** ตรวจสอบว่าหน้าจอ 3-Pane Layout แสดงผลได้ถูกต้อง สามารถใช้งานได้สะดวก
2. **Drag & Drop:** ทดสอบลากองค์ประกอบจาก Toolbox มาวางบน Canvas, ย้ายตำแหน่ง, และปรับขนาดได้อย่างอิสระ
3. **Properties:** ทดสอบการเปลี่ยนสี, ขนาดฟอนต์, ตัวหนา และการตั้งค่าตัวแปรใน Properties Panel
4. **Data Binding & PDF:** บันทึก Template, ทำการ Mock ข้อมูลฐานข้อมูล, และทดสอบการสร้างไฟล์ PDF ว่าตัวแปรถูกแทนที่ด้วยข้อมูลจริง และฟอนต์ภาษาไทยแสดงผลถูกต้อง ตำแหน่งตรงตามที่ออกแบบ
