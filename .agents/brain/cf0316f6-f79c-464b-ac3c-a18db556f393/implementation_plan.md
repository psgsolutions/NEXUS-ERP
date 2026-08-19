# ย้ายหน้าต่างเพิ่มสินค้า (Add Product) เป็นหน้า Page ตาม UI Protocol

เปลี่ยนฟีเจอร์ "เพิ่มสินค้า" จากเดิมที่เป็น Modal (`AddProductSheet.tsx`) ให้เป็นหน้า Page เดี่ยว (`/inventory/new`) ตามมาตรฐาน UI Protocol (Split Layout) ที่กำหนดไว้ โดยจะยังคงฟีเจอร์เดิม (สแกน AI, แบ่งแท็บ Manual/PO, เลือกพิกัด 3D) ไว้ครบถ้วน

## User Review Required

- การนำทาง: เมื่อผู้ใช้กดปุ่ม "เพิ่มสินค้า" ระบบจะเปลี่ยนหน้าไปยัง `/inventory/new` และเมื่อบันทึกข้อมูลสำเร็จ (หรือกดยกเลิก) ระบบจะพากลับมาที่ `/inventory`
- โครงสร้างหน้าจอจะใช้มาตรฐานเดียวกับ Dashboard อื่นๆ คือแบ่งเป็น 2 คอลัมน์ (เนื้อหาหลักฝั่งซ้าย และ แผงควบคุมสรุปยอด/ปุ่มบันทึกฝั่งขวาแบบ Sticky)

## Open Questions

- ควบคุมการเข้าถึงหน้าจอนี้ผ่าน Role ด้วยหรือไม่ หรือให้พนักงานทุกคนเข้าถึงได้ตามสิทธิ์เดิมที่เคยเข้า `AddProductSheet` ได้?

## Proposed Changes

### Inventory Feature

#### [NEW] src/app/(authenticated)/inventory/new/page.tsx
- สร้างหน้า Page ใหม่สำหรับ "เพิ่มสินค้า"
- โครงสร้างหน้าจอเป็น Split Layout (`xl:flex-row gap-4`)
- เนื้อหาหลัก (ซ้าย) จะประกอบไปด้วยช่องกรอกข้อมูลสินค้า, การอัปโหลดรูปภาพ, เลือกหมวดหมู่, ใส่พิกัด 3D, กรอกจำนวน, และกำหนดราคา
- คอลัมน์สรุป (ขวา) แบบเการะติดจอ (Sticky) จะแสดง Validation Briefing, สถานะรหัส SKU, มูลค่ารวม, ปุ่มยืนยัน และ ปุ่มยกเลิก
- ดึง Logic หลักๆ จาก `AddProductSheet.tsx` มาประยุกต์ใช้ เช่น `handleSubmit`, การจัดการ State และ `fetchPOItems`

#### [MODIFY] src/app/(authenticated)/inventory/page.tsx
- เปลี่ยน Action ของปุ่ม "เพิ่มสินค้า" จากการสั่ง `setIsAddSheetOpen(true)` ไปเป็น `router.push("/inventory/new")`
- ลบการเรียกใช้งาน `<AddProductSheet />` ออกจากหน้าหลัก เพื่อลดความซ้ำซ้อนของโค้ด

## Verification Plan

### Manual Verification
1. ทดสอบกดปุ่ม "เพิ่มสินค้า" บนหน้า `/inventory` ว่าสามารถนำทางไปยังหน้า `/inventory/new` ได้สำเร็จ
2. ทดสอบกรอกข้อมูลเพิ่มสินค้าใหม่แบบ Manual และตรวจสอบในหน้า Inventory ว่าสินค้าปรากฏขึ้นถูกต้อง (พร้อมล็อกประวัติ 3D location)
3. ทดสอบโหมดนำเข้าผ่าน PO (ระบุเลข PO เสมือน) ว่าสามารถดึงข้อมูลและเพิ่มสินค้าเข้าสู่ระบบได้
4. ตรวจสอบการพับเก็บ/กางออกของ Dropdown ต่างๆ ว่าทำงานตรงตาม Click Outside rule
5. ตรวจสอบความถูกต้องของการออกแบบ (UI Protocol) ในขนาดหน้าจอต่างๆ (Responsive Split Layout)