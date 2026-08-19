# แผนการพัฒนา Dynamic Quotation Engine (Ultimate Document Form Builder)

เอกสารนี้อธิบายแผนการปรับปรุงระบบใบเสนอราคาตาม Requirement "Dynamic Quotation Engine" เพื่อรองรับงาน 3 ประเภท และความยืดหยุ่นสำหรับลูกค้าทุกกลุ่ม

## User Review Required
> [!IMPORTANT]
> ระบบต้องการให้มีการปัดเศษ (Round up/down) สำหรับ Mode B (รวม VAT) ในตารางสินค้า เพื่อให้เลขกลมสวยงาม กรุณายืนยันว่าต้องการให้ปัดเศษเป็นทศนิยม 2 ตำแหน่งตามมาตรฐาน หรือปัดเป็นจำนวนเต็ม (Whole Number) ในส่วนของราคาต่อหน่วย

## Open Questions
> [!WARNING]
> 1. ในส่วนของ "Customer Preset" การเก็บข้อมูล `defaultQuotationFormat` จะให้มีตัวเลือกเป็นอะไรบ้างครับ? เช่น `trading`, `project`, `maintenance` หรือเน้นไปที่รูปแบบแสดงผล VAT/ชื่อย่อเป็นหลัก?
> 2. ต้องการให้สร้างหน้าต่างตั้งค่าขั้นสูง (Advanced Document Settings) แยกต่างหากเพื่อสลับโหมด, ประเภทเอกสาร, หรือเอาไว้รวมในหน้าจอเดียวเลยครับ?

## Proposed Changes

---

### UI & UX (Quotation Form)
การเปลี่ยนแปลงในหน้าสร้างใบเสนอราคา `src/app/(authenticated)/sales/quotations/new/page.tsx`

#### [MODIFY] page.tsx
- **เพิ่มตัวเลือกประเภทใบเสนอราคา (Quotation Type):**
  - Trading / Product Sales (งานซื้อมาขายไป)
  - Project & Installation / Turnkey (งานโครงการและติดตั้ง)
  - Maintenance Service / SLA (งานบริการและบำรุงรักษา)
- **ปรับปรุง VAT Mode Switcher:**
  - สร้างปุ่มกดเปลี่ยนโหมดแบบ Toggle ตามกฎ UI `h-9 px-6 rounded-full` สำหรับสลับ Exclusive VAT (Mode A) และ Inclusive VAT (Mode B)
- **Customer Preset:**
  - เพิ่มการตรวจสอบฟิลด์ `defaultQuotationFormat` จากข้อมูลลูกค้าเพื่อเปลี่ยนโหมด VAT และประเภทเอกสารอัตโนมัติ

---

### Commerce Components
การปรับปรุงตารางสินค้า `src/components/commerce/DocumentItemsTable.tsx` และ Summary Panel

#### [MODIFY] DocumentItemsTable.tsx
- **Dynamic Naming (Custom Alias):**
  - เพิ่มฟิลด์ `customName` และ `customDescription` เพื่อป้องกันการกระทบ Master Data
  - เพิ่ม Toggle Switch (Checkbox) เพื่อเลือกว่าจะ "แสดงสเปคละเอียด" หรือ "แสดงแค่ชื่อบรรทัดเดียว" (Show Detailed Specs / Single Line Name)
- **WHT (หัก ณ ที่จ่าย):**
  - คงฟีเจอร์ WHT สำหรับงานที่เป็น "ค่าแรง", "ติดตั้ง", "บริการ" และปรับให้ครอบคลุมตามประเภทใบเสนอราคาที่เป็นแบบ Project หรือ Maintenance
- **Financial UI Protocol:**
  - บังคับใช้คลาส `font-mono tracking-tight text-right` กับตัวเลขการเงินทั้งหมด

#### [MODIFY] DocumentSummaryPanel.tsx (คาดว่าจะต้องแก้)
- ปรับปรุงการแสดงผลสรุปยอดเมื่ออยู่ในโหมด Inclusive VAT (Mode B):
  - แสดงช่อง "รวมเป็นเงิน (Sub Total)" โดยถอด VAT ออกมาแสดงให้ชัดเจน (ราคารวมทั้งหมด x 100/107)
  - ภาษีมูลค่าเพิ่ม 7% (VAT) (ราคารวมทั้งหมด x 7/107)
  - ยอดชำระสุทธิ (Grand Total) ที่ปัดเศษตรงกันเป๊ะตามมาตรฐานบัญชี

---

### Accounting Engine
การปรับปรุงตรรกะการคำนวณใน `src/lib/accounting-engine.ts`

#### [MODIFY] accounting-engine.ts
- ปรับจูนฟังก์ชัน `calculateDocumentTotals` สำหรับโหมด Inclusive:
  - เพิ่มการคำนวณที่รองรับ "การถอด VAT ออก" (Vat Extract) แบบเป๊ะๆ สำหรับ Sub Total ใน Summary Panel เพื่อให้ตรงตามสูตรบัญชีที่ขอมา
  - รองรับการปัดเศษ (Rounding) ในระดับบรรทัดรายการสินค้าสำหรับโหมด Inclusive เพื่อให้ราคาต่อหน่วยแสดงเป็นเลขที่สวยงาม (หรือทศนิยม 2 ตำแหน่งแบบเป๊ะ)

## Verification Plan

### Automated Tests
- (ถ้ามี) รัน `npm run test` เพื่อตรวจสอบลอจิกการคำนวณ `accounting-engine.ts` ว่าโหมด inclusive (ถอด VAT) คำนวณได้ยอดตรงกับที่ลูกค้าคาดหวังหรือไม่
- รัน `npm run lint` และ `npm run build` เพื่อตรวจสอบ TypeScript types

### Manual Verification
1. เปิดหน้า "สร้างใบเสนอราคา"
2. ลองเปลี่ยน Quotation Type ระหว่าง 3 แบบ
3. ทดลองเพิ่มรายการสินค้าและกดเปิดการแสดงผล "สเปคละเอียด"
4. เปลี่ยนสลับระหว่าง โหมด VAT แบบ Exclusive และ Inclusive และตรวจสอบยอดในช่อง Sub Total, VAT, Grand Total ว่าแสดงผลและใช้ font-mono ถูกต้องตามเงื่อนไข
5. เลือกชื่อลูกค้าที่เป็นหน่วยงานรัฐ (ตั้งค่า Preset ไว้) แล้วดูว่าโหมดกระโดดไปตามที่ตั้งไว้หรือไม่