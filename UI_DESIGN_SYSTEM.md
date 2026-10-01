# 🎨 NEXUS ERP (Intelligence OS) — UI Design System & Component Specification
> **เอกสารข้อกำหนดพฤติกรรมและการออกแบบอินเทอร์เฟซจริงของระบบ (System UI/UX Specification)**
> สแกนและถอดสเปกจากโค้ดจริง ณ วันที่ 24 กันยายน 2026 (NEXUS OS V3.2)

---

## 1. SmartSelect / ช่องค้นหาอัจฉริยะ (`src/components/ui/SmartComponents.tsx`)

### 1.1 Flow การทำงานทีละขั้นตอน (Step-by-Step Execution Flow)
1. **การพิมพ์ค้นหาและการกรองข้อมูล (Real-time Filtering)**:
   - ผู้ใช้พิมพ์ข้อความลงในช่อง `PillInput` (Single-Input Combobox)
   - ระบบกรองข้อมูลในหน่วยความจำโดยเปรียบเทียบแบบ **Case-Insensitive Substring Match (`contains`)** ทั้งจาก `opt.label` และ `opt.description`:
     ```typescript
     const filteredOptions = useMemo(() => {
       if (!searchable) return uniqueOptions;
       if (isQueryMatchingSelectedLabel || !searchQuery.trim()) return uniqueOptions;
       const query = searchQuery.trim().toLowerCase();
       return uniqueOptions.filter((opt: SmartSelectOption) =>
         opt.label.toLowerCase().includes(query) ||
         (opt.description && opt.description.toLowerCase().includes(query))
       );
     }, [searchable, isQueryMatchingSelectedLabel, searchQuery, uniqueOptions]);
     ```
2. **พฤติกรรมเมื่อพิมพ์คำที่ไม่มีในระบบ (Custom Unsaved Entry Behavior)**:
   - ❌ **ห้ามแสดงปุ่ม "+ เพิ่ม" หรือ "+ เพิ่มข้อมูลใหม่" ในรายการ Dropdown** ตามกฎ Master Protocol Rule #3
   - ใน Dropdown จะแสดงข้อความแจ้งเตือนสีจาง:
     ```tsx
     {filteredOptions.length === 0 ? (
       <div className="p-3 text-center text-xs text-white/40">ไม่พบข้อมูลที่ค้นหา</div>
     ) : ( ... )}
     ```
   - ข้อความที่พิมพ์จะถูกส่งผ่าน `onChange(val)` เข้าสู่ Local State ของฟอร์มหลักทันที
3. **การบันทึกข้อมูลเข้าฐานข้อมูล (Form Commit & Persistence)**:
   - เมื่อผู้ใช้กดปุ่ม **"บันทึก" / " Save"** ของฟอร์มหลัก (เช่น `handleSave` ใน `QuotationModal.tsx`, `CustomerModal.tsx`, `CreatePurchaseOrderPage`)
   - ฟังก์ชันในฟอร์มหลักจะนำค่า String ที่ผู้ใช้พิมพ์ไว้ไปบันทึกลง Firestore Collection โดยตรง (เช่น Collection `customers` หรือ `suppliers`) ผ่าน `addDoc` หรือ `setDoc`:
     ```typescript
     // ตัวอย่างจาก QuotationModal.tsx (line 380)
     await addDoc(collection(db, "quotations"), {
       customerInfo: {
         name: formData.customerName, // ค่าจาก SmartSelect
         taxId: formData.taxId
       },
       companyId: currentCompanyId,
       createdAt: serverTimestamp()
     });
     ```

### 1.2 การโหลดข้อมูลและ Performance Latency
- **แหล่งที่มาของ Options**: โหลดแบบ Real-time Snapshot Listener ผ่าน Custom Hook `useRealtimeCollection` (เช่น `useRealtimeCollection('customers', [where('companyId', '==', companyId), where('isDeleted', '==', false)])`)
- **Search Debounce**: **0ms (Immediate)** — อัปเดต State `searchQuery` ทันทีที่พิมพ์ พร้อมกรองด้วย `useMemo` แบบเรียลไทม์ ปราศจาก Delay

---

## 2. Tab & Dropdown Behavior

### 2.1 รายการระบบ Tabs และ พฤติกรรมเฉพาะ (PillTabs & DocumentStepper)

| ชื่อ Component | ไฟล์ที่อยู่จริง | พฤติกรรมเฉพาะ (Specific Behavior) | State Persistence |
| :--- | :--- | :--- | :--- |
| `PillTabs` | `src/components/ui/Base.tsx` | ปุ่มแคปซูลทรงสูง `h-9 px-5 rounded-full` ข้อความสลับภาษาไทยอัตโนมัติผ่าน `EN_TO_TH_MAP` | **คงอยู่ 100%**: สลับแท็บเปลี่ยนเฉพาะ `activeTab` State ค่าที่กรอกในฟอร์มไม่สูญหาย |
| `DocumentStepper` | `src/components/ui/DocumentStepper.tsx` | แถบแสดงสถานะขั้นตอนเอกสาร Read-only (เช่น `["Draft", "Pending", "Approved", "Received"]`) | **Read-only**: แสดงตำแหน่งขั้นตอนตาม Index ปัจจุบัน |
| `DocumentFlowStepper` | `src/components/ui/DocumentFlowStepper.tsx` | แถบเชื่อมโยงเอกสารต่อเนื่อง (QT ➔ SO ➔ INV ➔ BN) | **Interactive Link**: กดคลิกเพื่อนำทางไปยังเอกสารต้นทาง |

#### โค้ดตัวอย่าง PillTabs:
```tsx
// src/components/ui/Base.tsx (line 403-446)
export function PillTabs({ tabs, activeTab, onTabChange, className }: { 
  tabs: { id: string, label: string, icon?: any }[], 
  activeTab: string, 
  onTabChange: (id: string) => void,
  className?: string
}) {
  return (
    <div className={cn("flex items-center gap-2 p-0 bg-transparent w-full overflow-x-auto no-scrollbar flex-nowrap", className)}>
      {tabs.map((tab) => {
        const { th, desc } = parseTabLabel(tab.label);
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            title={desc ? desc : undefined}
            className={cn(
              "h-9 px-5 rounded-full text-[13px] font-black transition-all duration-300 flex items-center gap-2.5 uppercase tracking-wider whitespace-nowrap flex-shrink-0",
              activeTab === tab.id 
                ? "bg-nexus-teal/15 text-nexus-teal shadow-[0_0_10px_rgba(0,255,209,0.1)] border border-nexus-teal/30" 
                : "bg-white/5 text-white/50 hover:text-white hover:bg-white/10 border border-transparent"
            )}
          >
            {tab.icon && React.cloneElement(tab.icon, { size: 16 })}
            <span>{th}</span>
          </button>
        );
      })}
    </div>
  );
}
```

### 2.2 รายการระบบ Dropdown (PillSelect)
- **ตำแหน่งการแสดงผล**: ซ้อนทับด้วย `z-[99999]` บน Container `relative` พร้อม Backdrop Blur `backdrop-blur-2xl bg-[#0D0D0D]/95 border border-white/10 rounded-2xl`
- **ลูกเล่น Animation**: ลูกศร `ChevronDown` หมุน 180 องศาเมื่อเปิด (`transition-transform duration-200 rotate-180 text-nexus-teal`)

---

## 3. ขนาดตัวอักษรและกฎการตัดคำ (Typography & Truncation Rules)

### 3.1 ขนาดและ Font Weight มาตรฐาน (Visual Hierarchy Standard)

```css
/* src/app/globals.css (line 40-49) */
body {
  font-size: 14px; /* เท่ากับขนาดเมนู Sidebar */
  line-height: 1.5;
  @apply text-sm antialiased;
}

input, select, textarea, button, td, th {
  font-size: 14px;
}
```

| ประเภทองค์ประกอบ | ขนาดฟอนต์จริง (CSS Class) | ความหนาฟอนต์ (Font Weight) | สีและสไตล์ |
| :--- | :--- | :--- | :--- |
| **เนื้อหาทั่วไป & ช่องกรอก (Body & Inputs)** | `14px` (`text-[14px]` / `text-sm`) | `font-medium` (500) / `font-semibold` (600) | `text-white` หรือ `text-white/80` |
| **หัวข้อช่อง & หัวตาราง (Labels & Headers)** | `12px` - `13px` (`text-[12px]` / `text-[13px]`) | `font-semibold` (600) / `font-bold` (700) | `text-white/70` หรือ `text-nexus-teal` (Uppercase) |
| **ตัวเลขสำคัญ, ยอดรวมเงิน, KPI (Key Numbers & Totals)** | `14px` - `32px` (`text-sm` - `text-3xl`) | **`font-black` (900)** / `font-mono` | `text-white` หรือ `text-nexus-teal` (เด่นชัดโฟกัสสายตา) |
| **รหัสเอกสาร & โค้ด (Codes & Monospace)** | `13px` - `14px` (`text-sm`) | `font-mono font-bold` | `text-nexus-teal` หรือ `text-white` (`[font-style:normal!important]`) |

### 3.2 กฎการตัดคำและการแสดงผลข้อความยาว (Truncation vs Wrap)

- **กรณีตัดคำ (Single-line Truncation)**: ใช้คลาส `truncate` (เทียบเท่า `overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`) ร่วมกับ Max Width เช่น `max-w-[200px]` หรือ `w-full truncate`:
  ```tsx
  <span className="truncate max-w-[220px] font-bold text-[14px] text-white">
    {customerName}
  </span>
  ```
- **กรณีขึ้นบรรทัดใหม่ (Multi-line Wrap)**: ใน `NexusTableCell` ใช้พร็อพ `wrap={true}` เพื่อเปลี่ยนคลาสเป็น `whitespace-normal break-words leading-relaxed py-3`:
  ```tsx
  <td className={cn(
    "px-6 text-[14px] font-normal text-white/80 transition-colors duration-300",
    wrap ? "whitespace-normal break-words leading-relaxed py-3" : "whitespace-nowrap"
  )}>
    {itemDetails}
  </td>
  ```
- **กฎตัวเอียง (Strict Normal Style Rule)**: ปิดการเอียงตัวอักษร 100% ทั้งระบบผ่าน `globals.css`:
  ```css
  * { font-style: normal !important; }
  ```

---

## 4. ขนาดช่องกรอกข้อมูล (Input Sizing & Layout Constraints)

### 4.1 ความสูงมาตรฐาน (Height Rules)
- **ความสูงมาตรฐานสำหรับ Control ทั้งหมด**: ล็อคความสูงที่ `h-8` (32px) หรือ `h-9` (36px) ทรงแคปซูล `rounded-full` เสมอ
- `PillInput`: `h-8 px-5 rounded-full`
- `PillSelect`: `h-8 px-5 rounded-full`
- `SmartSelect`: `h-8 pl-9 pr-14 rounded-full`
- `PillButton`: `h-8 px-5 rounded-full` หรือ `h-9 px-6 rounded-full`

### 4.2 ความกว้างและระยะขอบภายใน (Width & Internal Padding)
- **ความกว้าง (Width)**:
  - ในฟอร์มหลัก: ใช้ `w-full` ภายใน Responsive Grid (`grid grid-cols-1 md:grid-cols-2 gap-6`)
  - ในตารางสินค้า: กำหนด Fixed Width ชัดเจนเพื่อป้องกันคอลัมน์โยก:
    - รหัสสินค้า (SKU): `w-32`
    - จำนวน (Qty): `w-20`
    - หน่วยนับ (Unit): `w-20`
    - ราคาต่อหน่วย (Price): `w-24`
- **Internal Padding-X**: `px-5` หรือ `px-6` ตามมาตรฐาน Master Protocol (ยกเว้นช่องที่มีไอคอนค้นหาทางซ้ายจะใช้ `pl-9 pr-14`)

```tsx
// โค้ดมาตรฐาน PillInput (src/components/ui/Base.tsx line 48-61)
export const PillInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "h-8 px-5 py-1 leading-normal rounded-full bg-white/[0.03] border border-white/10 text-white text-[14px] font-medium focus:outline-none focus:border-nexus-teal/40 focus:bg-white/[0.06] transition-all placeholder:text-white/30 backdrop-blur-sm truncate w-full",
          className
        )}
        {...props}
      />
    );
  }
);
```

---

## 5. สีและธีมระบบ (Color Palette & Elevation Scale Tokens)

### 5.1 Elevation Scale Tokens จาก `tailwind.config.ts` & `globals.css`

| Token Name | Hex Code | Utility Class | ความหมายและการใช้งานจริงในระบบ |
| :--- | :--- | :--- | :--- |
| `surface-0` | `#0D0D0D` | `bg-surface-0` | **App Base Canvas**: พื้นหลังหลักของระบบ, ตารางข้อมูลข้อมูลหลัก, พื้นหลังหน้าเพจ |
| `surface-1` | `#0F0F12` | `bg-surface-1` | **First-Layer Cards & Side Panels**: การ์ดแสดงข้อมูลชั้นแรก, Sidebar Sub-panels, ส่วนหัว Modal Header |
| `surface-2` | `#14141A` | `bg-surface-2` | **Top-Layer Modals & Popovers**: โหมดัลชั้นบนสุด, SlideOver Drawers, Dropdown Popovers, Tool Controls |
| `nexus-teal` | `#00FFD1` | `text-nexus-teal`, `bg-nexus-teal/20` | สีเน้นหลัก (Primary Accent, Active States, Highlight Badges) |
| `nexus-blue` | `#0090FF` | `text-nexus-blue`, `bg-nexus-blue/20` | สีเน้นรอง (Secondary Accent, Information Panels, Confirm Buttons) |
| `danger` | `#FF3B30` | `text-danger`, `bg-danger/20` | สถานะเตือนอันตราย / ปุ่มยกเลิก-ลบ |
| `warning` | `#FFCC00` | `text-warning`, `bg-warning/20` | สถานะรอดำเนินการ / เตือนระวัง |
| `emerald-500` | `#10B981` | `text-emerald-400`, `bg-emerald-500/20` | สถานะบันทึกสำเร็จ / ปุ่มกดบันทึก (`variant="save"`) |

### 5.2 การป้องกัน Regression ป้องกันการ Hardcode สีมืดซ้ำ (CI / Pre-commit Guard)

ระบบมีสคริปต์สแกนตรวจสอบการ Hardcode สีพื้นหลังมืดแบบไม่ได้รับอนุญาตใน `src/` ผ่านคำสั่ง:
```bash
npm run check:hex-tokens
```
สคริปต์จะตรวจสอบว่าไม่มีการเขียน `bg-[#0D0D0D]`, `bg-[#0A0A0C]`, `bg-[#0F0F12]`, `bg-[#14141A]`, `bg-[#111111]` แบบ Hardcode นอกเหนือจากไฟล์ประกาศหลัก (`globals.css` และ `tailwind.config.ts`) ช่วยให้ระบบคงความเป็นมาตรฐานเดียวกันตลอดไป

---

## 6. Micro-interaction & UI Animations

### 6.1 Transition Duration & Hover Effects
- **มาตรฐาน Transition**: `transition-all duration-200` หรือ `duration-300`
- **Hover State บนปุ่ม**: `hover:bg-white/20 active:scale-95`
- **Glow Hover Effect บนการ์ด**: `hover:border-white/25 transition-all duration-300`

### 6.2 Animation ตอนเปิด Modal & Dropdown
- **Modal Opening Animation**:
  ```tsx
  "animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-300 ease-out"
  ```
- **Dropdown Opening Animation**:
  ```tsx
  "animate-in fade-in slide-in-from-top-2 duration-200"
  ```

### 6.3 Loading State & Spinner Pattern
```tsx
// ปุ่มบันทึกขณะกำลังประมวลผล (PillButton variant="save" หรือ "confirm")
<PillButton variant="save" disabled={loading} className="h-8 px-6 text-[12px] font-bold">
  {loading ? (
    <span className="flex items-center gap-2">
      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      กำลังบันทึก...
    </span>
  ) : (
    <span>บันทึกข้อมูล</span>
  )}
</PillButton>
```

### 6.4 Shared Ambient Signature Glow (.glow-accent & .glow-accent-hover)
- **รูปแบบการทำงาน (Extracted MasterMetricCard Glow Pattern)**:
  - สกัดจากเอฟเฟกต์ฟุ้งจาง `blur-[40px]` ของ `MasterMetricCard` เป็น Utility Class สดของระบบเพื่อควบคุมความพรีเมียมและขอบเขตการใช้งานอย่างรัดกุม
  - **ห้ามใส่บนทุกปุ่ม/badge ในระบบ** เพื่อไม่ให้ความพิเศษดูลดลงและไม่รบกวนสายตาขณะ Idle

- **ขอบเขตจุดที่อนุญาตให้ใช้งานในระบบ (Strictly Controlled Scopes)**:
  1. **Badge สถานะ "Active" / "กำลังดำเนินการ" ของโครงการ** (`StatusBadge status="active"`):
     - ใช้ `.glow-accent` เพื่อสร้างรัศมีสีเขียว/Teal ฟุ้งอ่อน สื่อถึงโครงการที่กำลังขับเคลื่อนเรียลไทม์
  2. **ปุ่มกด `variant="primary"` ขณะ Hover เท่านั้น** (`PillButton variant="primary"`):
     - ใช้ `.glow-accent-hover` โดยที่ภาวะพัก (Idle) จะไม่แสดงผลเรืองแสง แต่จะแสดงผลเมื่อผู้ใช้โฮเวอร์เมาส์เข้ามาเท่านั้น (`hover:before:opacity-35`)

- **โค้ดประกาศใน `src/app/globals.css`**:
  ```css
  .glow-accent {
    position: relative;
    z-index: 1;
  }
  .glow-accent::before {
    content: '';
    position: absolute;
    inset: -12px;
    border-radius: inherit;
    background: inherit;
    filter: blur(40px);
    opacity: 0.3;
    z-index: -1;
    pointer-events: none;
    transition: opacity 500ms ease;
  }

  .glow-accent-hover {
    position: relative;
    z-index: 1;
  }
  .glow-accent-hover::before {
    content: '';
    position: absolute;
    inset: -12px;
    border-radius: inherit;
    background: inherit;
    filter: blur(40px);
    opacity: 0;
    z-index: -1;
    pointer-events: none;
    transition: opacity 500ms ease;
  }
  .glow-accent-hover:hover::before {
    opacity: 0.35;
  }
  ```

---

## 7. Layout แบ่งหน้าซ้าย-ขวา พร้อมเลื่อนอิสระ (`NexusPageLayout.tsx`)

### 7.1 โครงสร้าง CSS Flex/Grid และการแบ่งสัดส่วน

```tsx
// src/components/layout/NexusPageLayout.tsx (line 17-55)
export default function NexusPageLayout({ 
  header, 
  leftContent, 
  rightSidebar,
  topContent,
  className 
}: { 
  header: React.ReactNode; 
  leftContent: React.ReactNode; 
  rightSidebar?: React.ReactNode; 
  topContent?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("w-full h-full min-h-[100vh] flex flex-col bg-[#0a0a0c] overflow-hidden font-sans relative z-10", className)}>
      
      {/* 1. Header: ตรึงนิ่งสนิทตามกฎ */}
      <header className="flex-none sticky top-0 z-50 bg-[#0a0a0c]/80 backdrop-blur-md border-b border-white/10">
        <div className="px-4 xl:px-6 py-2.5 xl:py-3 w-full">
          {header}
        </div>
      </header>

      {/* 2. Main Container: สัดส่วน 75 / 25 พร้อม Independent Scroll */}
      <div className="flex-1 flex flex-col xl:flex-row overflow-hidden w-full">
        
        {/* ฝั่งซ้าย (75%): เลื่อนอิสระเมื่อเนื้อหายาว */}
        <main className={cn(
          "flex-1 overflow-y-auto p-4 xl:p-6 custom-scrollbar pb-32 xl:pb-6",
          rightSidebar ? "w-full xl:w-[75%]" : "w-full"
        )}>
          {leftContent}
        </main>

        {/* ฝั่งขวา (25%): แผงสรุปยอดเกาะติด หรือเลื่อนแยกอิสระ */}
        {rightSidebar && (
          <aside className="w-full xl:w-[25%] flex-none border-t xl:border-t-0 xl:border-l border-white/10 bg-white/[0.02] overflow-y-auto custom-scrollbar">
            {rightSidebar}
          </aside>
        )}
      </div>
    </div>
  );
}
```

---

## 8. รูปแบบ Card / Modal Pattern อื่นๆ ในระบบ

### 8.1 Modular GlassCard พร้อม Accent Borders
- **โครงสร้างการ์ด**: `bg-neutral-900/90 border border-white/15 rounded-3xl overflow-hidden shadow-2xl transition-all hover:border-white/25`
- **แถบเน้นขอบซ้ายประจำการ์ด (Accent Left Border)**:
  - `border-l-4 border-l-nexus-teal` (ข้อมูลคลังสินค้า / สต็อก)
  - `border-l-4 border-l-nexus-blue` (ข้อมูลการค้า / รายการสินค้า)
  - `border-l-4 border-l-purple-500` (สรุปยอดการเงิน)
  - `border-l-4 border-l-emerald-500` (บันทึกสำเร็จ / การชำระเงิน)

```tsx
// src/components/ui/Base.tsx (line 213-244)
export function GlassCard({ className, children, accentColor }: { 
  className?: string; 
  children: React.ReactNode;
  accentColor?: "teal" | "blue" | "purple" | "emerald" | "amber" | "rose";
}) {
  const accentBorders = {
    teal: "border-l-4 border-l-nexus-teal",
    blue: "border-l-4 border-l-nexus-blue",
    purple: "border-l-4 border-l-purple-500",
    emerald: "border-l-4 border-l-emerald-500",
    amber: "border-l-4 border-l-amber-500",
    rose: "border-l-4 border-l-rose-500"
  };

  return (
    <div className={cn(
      "bg-neutral-900/90 backdrop-blur-3xl border border-white/15 rounded-3xl shadow-2xl overflow-hidden relative group/card hover:border-white/25 transition-all duration-300",
      accentColor && accentBorders[accentColor],
      className
    )}>
      {children}
    </div>
  );
}
```

### 8.2 Modal Container กับ React Portal Architecture
- **โครงสร้าง Modal**: ใช้ `createPortal` ไปยัง `document.body` ป้องกันปัญหา Z-Index ซ้อนทับ Parent Elements
- **Backdrop**: `fixed inset-0 bg-black/95 backdrop-blur-3xl z-[100000]`
- **Modal Box**: `max-w-[95vw] h-[85vh] bg-[#0D0D0D] rounded-2xl border border-white/10 shadow-[0_0_150px_rgba(0,0,0,1)] flex flex-col z-[100001]`

```tsx
// src/components/ui/Base.tsx (line 837-879)
export function Modal({ isOpen, onClose, title, children, maxWidth = "max-w-[1600px]" }: { 
  isOpen: boolean, 
  onClose: () => void, 
  title: string, 
  children: React.ReactNode, 
  maxWidth?: string 
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!isOpen || !mounted || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-6 animate-in fade-in duration-300 backdrop-blur-[2px]">
      <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl" onClick={onClose} />
      
      <div className={cn(
        "relative w-full max-w-[95vw] h-[85vh] bg-[#0D0D0D] overflow-hidden shadow-[0_0_150px_rgba(0,0,0,1)] rounded-2xl border border-white/10 flex flex-col z-[100001] animate-in zoom-in-95 slide-in-from-bottom-2 duration-300 ease-out",
        maxWidth
      )}>
        <div className="h-20 flex items-center justify-between px-10 bg-[#0F0F12] border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-6">
             <div className="w-12 h-12 rounded-xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/20 shadow-neon-teal/20">
                <Sparkles size={24} />
             </div>
             <div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight leading-none">{title}</h3>
                <p className="text-[12px] font-bold text-nexus-teal/40 uppercase mt-2 tracking-[0.3em] leading-none">MASTER.STRATEGIC.V3.1_STRICT</p>
             </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-12 h-12 flex items-center justify-center rounded-full bg-nexus-teal/15 text-nexus-teal border border-nexus-teal/20 hover:bg-nexus-teal/30 hover:text-white transition-all"
          >
            <X size={28} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto relative custom-scrollbar">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
```

---
*เอกสารนี้ถูกบันทึกใน `UI_DESIGN_SYSTEM.md` สำหรับใช้บังคับพฤติกรรมและการดีไซน์ระบบ UI/UX ของ NEXUS ERP (Intelligence OS)*
