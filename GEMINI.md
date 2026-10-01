# NEXUS-ERP UI & Development Standards

## 1. Data Validation Requirement
- **Rule**: Every input field, form, or data entry component MUST implement strict Data Validation rules.
- **Details**: Validate data types, check required fields before submission, ensure proper constraints (e.g., maximum length, valid email formats, 13-digit Thai Tax ID), and provide clear error messages.
- **Goal**: Prevent dirty data from entering the Firestore database.

## 2. UI Label Language Standard (Thai Only)
- **Rule**: All UI labels, form labels, and visible text elements MUST be written in Thai language only.
- **Details**: Do NOT include English translations or English brackets in labels (e.g., use "ข้อมูลลูกค้า" instead of "ข้อมูลลูกค้า (Customer Info)"). This applies to components like `<Field>`, `<label>`, placeholders, and table headers.
- **Goal**: Maintain a consistent and clean Thai-only interface for users.

## 3. Standard Height Capsule Inputs & Design System Controls
- **Rule**: All input fields, textboxes, comboboxes, and numeric controls MUST adhere to standard capsule design system components (`PillInput`, `SmartSelect`, `StepperInput`, `PillTabs`, `PillButton`).
- **Details**:
  - **Capsule Input Height**: Fixed standard height `h-8` rounded-full for all input fields and buttons.
  - **Single-Input Smart Search Combobox (`SmartSelect`)**: Typing and real-time filtering MUST occur directly within a single input box. Custom typed entries NOT in the database MUST NOT render any "+ เพิ่ม" button inside the dropdown list; custom entries MUST be typed directly in the input box and automatically saved to the database when the user clicks Save/Submit ("เมื่อกดบันทึกหรือเซฟ").
  - **Vertical Stepper Controls (`StepperInput`)**: Up/Down increment and decrement controls MUST be vertically stacked (`ChevronUp` on top, `ChevronDown` on bottom).
  - **Glass Buttons (`PillButton`)**: All action, secondary, and cancellation buttons MUST use transparent glass styling (`variant="glass"`, `variant="primary"`, `variant="confirm"`, `variant="save"` with backdrop-blur-md).

## 4. Non-Actionable Read-Only Fields Standard
- **Rule**: Input fields, displays, or components that do NOT allow user interaction/action (e.g. read-only, system-locked fields like Product SKU) MUST NOT contain any internal action icons, badges, or mouse interaction triggers.
- **Details**: Read-only fields must be styled cleanly with `pointer-events-none select-none cursor-default` without internal icons (e.g. ShieldCheck) or clickable indicators, ensuring zero interactive mouse cursor behaviors.
- **Goal**: Prevent user confusion and keep locked fields clean and non-distracting.

## 5. Page Typography & Font Weight Standards (ขนาดและความหนา-บางตัวอักษร)
- **Rule**: ทุกหน้าเพจในระบบต้องใช้ขนาดตัวอักษรพื้นฐาน (Body, Table Cell, Form Input, Dropdown Value) ที่เท่ากับขนาดตัวอักษรของเมนู Sidebar Navigation (`14px` / `text-[14px]` / `text-sm`) และจัดลำดับความหนา-บางของฟอนต์ (Font Weight) ให้เหมาะสม สวยงาม มีระเบียบ
- **Details**:
  - **ขนาดฟอนต์เนื้อหาพื้นฐานและช่องกรอก (Base Text & Inputs)**: กำหนดเป็น `14px` (`text-[14px]` หรือ `text-sm`) เท่ากับ Sidebar Menu สำหรับเนื้อหาในหน้าเพจ, ข้อมูลในตาราง (`td`), ข้อความในช่องกรอก (`PillInput`, `SmartSelect`, `StepperInput`, `PillSelect`)
  - **ความหนาตัวอักษรข้อมูล (Body/Value Weight)**: ใช้ `font-medium` (500) หรือ `font-normal` (400) สำหรับข้อความทั่วไปและค่าข้อมูลในช่องกรอก เพื่อให้อ่านง่าย สบายตา
  - **ความหนาหัวข้อช่องและตาราง (Label & Header Weight)**: ใช้ `font-bold` (700) หรือ `font-semibold` (600) ขนาด `12px` - `13px` สีจางลง (`text-white/60`) เพื่อจำแนกประเภทหัวข้ออย่างชัดเจน
  - **ปุ่มและองค์ประกอบตอบสนอง (Action Buttons & Badges)**: ใช้ `font-bold` (700) ขนาด `14px` หรือ `12px` ตัวพิมพ์ใหญ่ (Uppercase) เพื่อเน้นปุ่มกดและการทำงานต่างๆ
- **Goal**: สร้างความสอดคล้องอย่างสมบูรณ์ระหว่างแถบเมนูข้าง (Sidebar) กับเนื้อหาทุกหน้าเพจ เพิ่มความอ่านง่ายและยกระดับดีไซน์ให้มีความพรีเมียม สวยงาม ละเอียดเรียบร้อย

## 6. Mandatory Transparent Glass Buttons Standard (กฎปุ่มแบบโปร่งเท่านั้น)
- **Rule**: ทุกปุ่มกดในระบบ (All buttons across the entire application) ต้องใช้สไตล์ปุ่มแบบโปร่งเท่านั้น (Transparent Glassmorphic Buttons) ห้ามใช้ปุ่มสีทึบตัดทึบ (Solid Opaque Buttons) โดยเด็ดขาด
- **Details**:
  - **การตั้งค่าปุ่มโปร่ง**: ทุกปุ่มกด (`PillButton`, `<button>`, Action Trigger, Submit/Save/Cancel Buttons) ต้องใช้พื้นหลังแบบกระจกโปร่งใส (Glassmorphism) มีความโปร่งแสง เช่น `variant="glass"` (`bg-white/10 text-white border border-white/20 backdrop-blur-md`), `variant="primary"` (`bg-nexus-teal/20 text-nexus-teal border border-nexus-teal/40 backdrop-blur-md`), `variant="confirm"` (`bg-nexus-blue/20 text-nexus-blue border border-nexus-blue/40 backdrop-blur-md`), หรือ `variant="save"` (`bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 backdrop-blur-md`)
  - **ห้ามใช้สีทึบ**: ห้ามใช้คลาสสีทึบตัน เช่น `bg-nexus-teal text-black`, `bg-nexus-blue text-white`, `bg-blue-500 text-white` ที่ไม่มีความโปร่งใส (`opacity/alpha`) บนปุ่มกดใดๆ ในระบบ
- **Goal**: รักษารูปลักษณ์ภาพรวมของระบบให้เป็นแบบ Neon-Glass Glassmorphic Design สวยงาม พรีเมียม และสอดคล้องกันทุกหน้าเพจ

## 7. Clear Visual Card Separation Standard (มาตรฐานการแบ่งการ์ดลึก คมชัด สดใส)
- **Rule**: ทุกหน้าเพจในระบบที่มีการ์ดแสดงข้อมูล (Modular Cards, Form Cards, Summary Panels) ต้องมีสไตล์การแบ่งการ์ดที่คมชัด สะดุดตา อ่านง่าย ไม่กลืนกัน
- **Details**:
  - **การตั้งค่ากรอบการ์ด**: ใช้พื้นหลังเข้มลึกและขอบเด่นชัด เช่น `bg-neutral-900/90 border border-white/15 rounded-3xl overflow-hidden shadow-2xl transition-all hover:border-white/25`
  - **แถบสีขอบซ้ายประจำการ์ด (Accent Borders)**: เพิ่มแถบสีเน้นขอบซ้ายตามลำดับการ์ด เช่น `border-l-4 border-l-nexus-teal`, `border-l-4 border-l-nexus-blue`, `border-l-4 border-l-purple-500`, `border-l-4 border-l-emerald-500`
  - **ส่วนหัวการ์ดและลำดับการ์ด (Header Block & Index Badges)**: ส่วนหัวการ์ดต้องใช้ `bg-white/[0.04] border-b border-white/10` พร้อมป้าย Badge บอกลำดับการ์ด (`01`, `02`, `03` ฯลฯ) ในกล่องโกลว์ขนาดเล็ก
  - **ระยะห่างระหว่างการ์ด (Card Gap)**: ใช้ระยะห่างระหว่างการ์ด `space-y-7` หรือ `space-y-8` เพื่อให้มีพื้นที่หายใจ สบายตา ไม่สับสน
- **Goal**: ช่วยให้ผู้ใช้งานจำแนกขอบเขตการ์ดและหมวดหมู่ข้อมูลได้อย่างรวดเร็ว ชัดเจน มีความเป็นระเบียบและพรีเมียมเท่าเทียมกันทุกหน้าเพจ

## 8. Mandatory Front-Most Dropdown Portal Layer Standard (กฎแท็บและดรอปดาวน์แสดงหน้าสุดเท่านั้น)
- **Rule**: ทุกแท็บ ดรอปดาวน์ (Dropdown Menu), Combobox, และป๊อบอัปเลือกข้อมูลในระบบ ต้องแสดงผลอยู่ชั้นหน้าสุดเสมอ (`fixed z-[999999]` หรือใช้ `SciFiDropdownPortal` / React Portal) ห้ามถูกตัด บัง หรือซ่อนใต้ Scroll Containers หรือขอบการ์ดทุกหน้าจอ
- **Details**:
  - **การเรนเดอร์ใน Portal Layer**: ทุกดรอปดาวน์ตัวเลือก (`SmartSelect`, `SciFiDropdownPortal`, Dropdown Table Cells, Popover Menus) ต้องถูกส่งออกไปเรนเดอร์ที่ `document.body` ผ่าน React Portal พร้อมคลาสตำแหน่ง `fixed z-[999999]`
  - **ห้ามใช้ Absolute ใน Overflow Container**: ห้ามใช้ `absolute` ธรรมดาในการสร้างป๊อบอัปดรอปดาวน์ภายใน Container ที่มี `overflow-hidden` หรือ `overflow-x-auto` โดยเด็ดขาด เพื่อป้องกันปัญหาเมนูดรอปดาวน์หลุดหรือถูกบังใต้ตาราง/การ์ด
  - **รองรับทุกอุปกรณ์และทุกหน้าจอ**: ตำแหน่งของแท็บดรอปดาวน์ต้องคำนวณพิกัดสัมพัทธ์จาก Element ต้นทางแบบไดนามิก และอัปเดตอัตโนมัติเมื่อเกิด Event Scroll หรือ Resize
- **Goal**: การันตีความสมบูรณ์แบบของ UX/UI ให้เมนูดรอปดาวน์และแท็บเลือกข้อมูลลอยเด่นอยู่ชั้นหน้าสุด ลื่นไหล ไม่ถูกบังทุกหน้าจอในระบบ NEXUS-ERP


