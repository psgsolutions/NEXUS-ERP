# API สำหรับแอปภายนอก: งานมอบหมาย และผังคลัง

เอกสารนี้สำหรับนักพัฒนาที่จะทำแอปแยก เช่น แอปช่าง แอป MA หรือแอปคลังสินค้า ให้ใช้ข้อมูลชุดเดียวกับ NEXUS ERP

## การยืนยันตัวตน

- ทุก endpoint เป็น `POST` และรับ JSON
- แนบ Firebase ID token ของผู้ใช้ทุกครั้ง: `Authorization: Bearer <idToken>`
  - ได้ token จาก Firebase Auth ของโปรเจกต์ `nexuserp-base` ด้วยบัญชีผู้ใช้จริงของบริษัท
- ใส่ `companyId` ใน body ทุกครั้ง ผู้ใช้เข้าถึงได้เฉพาะบริษัทของตัวเอง
- สิทธิ์เป็นไปตามตำแหน่งของผู้ใช้ (ดู `src/lib/permissions.ts`) ระบบตรวจซ้ำที่ server ทุกครั้ง
- รูปแบบผลลัพธ์:
  - สำเร็จ: `{ "success": true, ... }`
  - ไม่สำเร็จ: `{ "success": false, "error": "ข้อความภาษาไทย" }` พร้อม HTTP status 400 / 403 / 404 / 409

## งานมอบหมาย — `POST /api/jobs`

**ประเภทงาน** (`type`)

| ค่า | ความหมาย |
|---|---|
| `SERVICE` | ซ่อม/บริการ |
| `INSTALL` | ติดตั้ง |
| `MA` | บำรุงรักษา |
| `PICK_PACK` | จัดของ |
| `MOVE` | ขนย้าย |
| `DELIVERY` | ส่งของ |
| `OTHER` | งานอื่น ๆ |

**สถานะ** (`status`)

```
OPEN → ASSIGNED → ACCEPTED → IN_PROGRESS → DONE
         ↓
      REJECTED → (จ่ายใหม่) ASSIGNED

ยกเลิกได้ทุกขั้นก่อนปิดงาน → CANCELLED
```

**อุปกรณ์** (`equipment[]`)

| ค่า `kind` | ความหมาย |
|---|---|
| `MATERIAL` | วัสดุ ถ้ามี `productId` จะตัดสต็อกตอนผู้รับงานกด `accept` |
| `TOOL` | เครื่องมือ บันทึกการยืมตอนรับงาน และคืนตอนปิดงานหรือด้วย `returnTools` |

**สำหรับผู้รับงาน** (ใช้กับแอปช่าง/แอป MA)

| action | body เพิ่มเติม | ผลลัพธ์ |
|---|---|---|
| `mine` | `includeDone?: boolean` | `jobs[]` ที่มอบหมายให้ฉัน และ `workOrders[]` (ใบสั่งงานบริการจากใบสั่งขาย) |
| `get` | `jobNo` | `job` |
| `accept` | `jobNo` | รับงานและรับอุปกรณ์ ถ้าสต็อกวัสดุไม่พอจะตอบ 409 |
| `reject` | `jobNo, reason` | ปฏิเสธงาน แล้วแจ้งผู้จ่ายงาน |
| `start` | `jobNo` | เริ่มงาน |
| `check` | `jobNo, index, done` | ติ๊กขั้นตอนในเช็กลิสต์ |
| `complete` | `jobNo, note?, returnTools?` | ปิดงาน |
| `returnTools` | `jobNo` | คืนเครื่องมือ |

**สำหรับผู้จ่ายงาน** (ตำแหน่ง: โครงการ คลัง ขาย จัดซื้อ ผู้บริหาร)

| action | body เพิ่มเติม |
|---|---|
| `board` | `status?` |
| `assignees` | — คืนรายชื่อผู้รับงานพร้อมจำนวนงานค้าง |
| `create` | `job: { type, title, description?, priority?, scheduledDate?, scheduledTime?, site?, customerName?, equipment?, checklist?, assignees? }` |
| `update` | `jobNo, job` |
| `assign` | `jobNo, assignees: [uid]` |
| `cancel` | `jobNo, reason` |

ตัวอย่าง: ช่างกดรับงาน

```http
POST /api/jobs
Authorization: Bearer <idToken>
Content-Type: application/json

{ "companyId": "COM-NEXUS-01", "action": "accept", "jobNo": "JOB-2610-0001" }
```

## ผังคลังและตำแหน่งจัดเก็บ — `POST /api/inventory/warehouses`

| action | สิทธิ์ | ผลลัพธ์ |
|---|---|---|
| `list` | ดูคลังสินค้า | `warehouses[]` (พร้อม `zones`), `locations[]` (ทุกตำแหน่ง), `stock` (ยอดคงเหลือต่อตำแหน่ง) |
| `create` | แก้ไขคลัง | `code, name` → เพิ่มคลัง |
| `saveLayout` | แก้ไขคลัง | `warehouseId, zones` → บันทึกผัง ถ้าลบตำแหน่งที่ยังมีสินค้า จะตอบ 409 |

**รหัสตำแหน่ง** (เนื้อหาใน QR ที่ติดชั้นวาง)

| รหัส | ความหมาย |
|---|---|
| `WH-01-A-R01-L2-B03` | คลัง WH-01 › โซน A › ชั้นวาง R01 › ชั้น 2 › ช่อง 3 |
| `WH-01-A-R01-L2` | ชั้นวางที่ไม่แบ่งช่อง |
| `WH-01-RECV` | พื้นที่รับสินค้า |

แอปที่สแกน QR ส่งรหัสนี้ไปที่ `/api/inventory/putaway` (จัดเก็บ) หรือ `/api/inventory/pick` (เบิก) ได้ทันที

## การเก็บข้อมูล (Firestore)

| ข้อมูล | ตำแหน่ง | การเขียน |
|---|---|---|
| งาน | `companies/{companyId}/jobs/{jobNo}` | ผ่าน API เท่านั้น |
| คลัง | `warehouses/{companyId}_{code}` | ผ่าน API |
| ยอดคงเหลือตามตำแหน่ง | `companies/{companyId}/inventory_balance/{location}_{productId}` | ผ่าน API |
