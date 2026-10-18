# คู่มือดูแลระบบ NEXUS ERP (ทดสอบ · สำรองข้อมูล · ตั้งค่า)

สำหรับผู้ดูแลระบบและนักพัฒนา — ขั้นตอน deploy ดูที่ [DEPLOY_GUIDE_TH.md](DEPLOY_GUIDE_TH.md)

## 1. การทดสอบ

| คำสั่ง | ทดสอบอะไร | ต้องมี |
|---|---|---|
| `npm run typecheck` | ชนิดข้อมูล TypeScript | – |
| `npm run lint` | รูปแบบโค้ด | – |
| `npm test` | ฟังก์ชันคำนวณ (ภาษี งวดงาน ต้นทุน ฯลฯ) ไม่แตะฐานข้อมูล | – |
| `npm run test:rules` | กฎความปลอดภัย Firestore บน emulator | Java 21 |
| `npm run test:e2e` | ระบบจริงผ่าน API กับฐานข้อมูลจริง (32 ชุด) | `npm run dev` เปิดอยู่ + `.env.local` |
| `npm run check:data` | เอกสาร TEST ค้าง / ตัวนับเลขเอกสารเพี้ยน | `.env.local` |

### ชุดทดสอบกับฐานข้อมูลจริง (`tests/e2e`)
- ระบบใช้ฐานข้อมูลจริงในการพัฒนา ชุดทดสอบจึงสร้างข้อมูลที่ติดคำว่า **TEST** แล้วลบเองเมื่อจบ
- `npm run test:e2e -- d2 p6` รันเฉพาะชุด, `npm run test:e2e -- --list` ดูรายชื่อ
- ตัวรันเก็บและคืน **ตัวนับเลขเอกสาร** ของบริษัทรอบทุกชุด (ชุดทดสอบออกเลขจริงผ่าน API)
  - ⚠️ ถ้ามีผู้ใช้จริงออกเอกสารระหว่างชุดทดสอบทำงาน เลขนั้นจะถูกคืนค่าทับ — **รันนอกเวลาทำงาน** และดูผล `ตัวนับต่ำกว่าเลขจริง` ตอนจบ
- จบแล้วตัวรันลบ audit log ของผู้ใช้ทดสอบ (สำรองไว้ที่ `tests/e2e/.out/`) เพื่อไม่ให้ปนในหน้า "กิจกรรมล่าสุด"
- ไม่ยิงใส่เครื่องอื่นนอกจาก localhost เว้นแต่ตั้ง `E2E_ALLOW_REMOTE=1`
- ชุดอีเมล (`d5`, `p6e`): ตั้ง `MOCK_SMTP=1` และเปิด dev server ด้วย `SMTP_HOST=127.0.0.1 SMTP_PORT=2525 SMTP_USER=x SMTP_PASS=x` เพื่อส่งเข้า SMTP จำลองในเครื่อง (ไม่มีอีเมลออกจริง)

## 2. สำรองและกู้คืนข้อมูล

### สำรอง (ฟรี ทำในเครื่อง)
```
npm run backup:firestore                         # -> backups/firestore-<project>-<วันเวลา>.jsonl.gz
node scripts/backup-firestore.mjs --out=D:/Backup  # เก็บที่อื่น
```
- อ่านอย่างเดียว เก็บทุก collection และ subcollection (ยกเว้น `rate_limits`)
- **ไฟล์มีข้อมูลทั้งระบบ** (ลูกค้า พนักงาน เงินเดือน) — เก็บในที่ปลอดภัย ห้าม commit (`backups/` อยู่ใน .gitignore)
- ควรสำรอง **ก่อน deploy กฎ/ย้ายข้อมูลทุกครั้ง** และอย่างน้อยสัปดาห์ละครั้ง (ตั้ง Windows Task Scheduler ให้รันได้)

### กู้คืน (ค่าเริ่มต้นตรวจอย่างเดียว)
```
node scripts/restore-firestore.mjs <ไฟล์> --only=companies/COM-NEXUS-01/invoices        # dry-run: หาย/เหมือน/ต่าง
node scripts/restore-firestore.mjs <ไฟล์> --only=... --apply                             # สร้างเฉพาะที่หายไป
node scripts/restore-firestore.mjs <ไฟล์> --only=... --apply --overwrite                 # เขียนทับที่ต่างด้วย
```
- กู้คืนเอกสารบัญชี/ภาษีย้อนหลังอาจไม่ตรงกับเอกสารที่ออกหลังวันสำรอง — ใช้ `--only` ให้แคบที่สุดและตรวจ dry-run ก่อน

### สำรองอัตโนมัติบน Google Cloud (ทางเลือก)
ถ้าโปรเจกต์ Firebase เป็นแพ็กเกจ **Blaze** เปิด *Firestore → Disaster recovery → Backups* ตั้งรอบรายวันเก็บ 7 วันได้ (ค่าใช้จ่ายตามขนาดข้อมูล ตอนนี้ข้อมูลไม่ถึง 1 MB)

## 3. ค่าที่ต้องตั้งใน Vercel (Environment Variables)

| ชื่อ | ใช้ทำอะไร | จำเป็น |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_*` | เชื่อมต่อ Firebase ฝั่งเว็บ | ✅ |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | service account ฝั่ง server | ✅ |
| `CRON_SECRET` | ป้องกันงานประจำวัน `/api/cron/daily` และ `/api/cron/warranty-ma-check` | ✅ |
| `RATE_LIMIT_SALT` | ซ่อน IP ในตัวนับการใช้งานหน้าสาธารณะ | แนะนำ |
| `SMTP_USER`, `SMTP_PASS` | ส่งอีเมลเอกสาร/สรุปประจำวัน (Gmail App Password) | ถ้าใช้อีเมล |
| `SMTP_HOST`, `SMTP_PORT` | ผู้ให้บริการอีเมลอื่น (ค่าเริ่มต้น smtp.gmail.com:465) | – |
| `NEXT_PUBLIC_APP_URL` | โดเมนในลิงก์ที่ส่งลูกค้า (ถ้าไม่ตั้ง ใช้โดเมนที่เปิดอยู่) | – |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | ผู้ช่วย AI | ถ้าใช้ AI |

## 4. งานประจำวัน (Vercel Cron 08:00 น.)
- `/api/cron/daily` — ใบเสนอราคาใกล้หมดอายุ, ใบแจ้งหนี้ใกล้ครบ/เลยกำหนด (1/7/30 วัน), งวดงานที่ยังไม่เรียกเก็บ + อีเมลสรุปถึงผู้ดูแลการเงิน (ถ้าตั้งอีเมลแล้ว)
- `/api/cron/warranty-ma-check` — งานบำรุงรักษา/รับประกัน
- แพ็กเกจ Hobby ใช้ cron ได้ 2 รายการ — เพิ่มงานใหม่ให้รวมใน `/api/cron/daily`

## 5. ลำดับ deploy ที่ต้องระวัง
1. สำรองข้อมูล (`npm run backup:firestore`)
2. deploy แอป (push ขึ้น main) **ก่อน**
3. deploy indexes แล้วค่อย rules — กฎใหม่ปิดการเขียนบางส่วนจากหน้าเว็บ ถ้า deploy กฎก่อนแอป หน้าที่ยังเขียนตรงแบบเก่าจะใช้งานไม่ได้
