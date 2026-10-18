# ชุดทดสอบกับฐานข้อมูลจริง (E2E)

```
npm run dev            # เปิดไว้อีกหน้าต่าง (ต่อฐานข้อมูลจริงตาม .env.local)
npm run test:e2e       # ทุกชุด (~25 นาที)
npm run test:e2e -- d2 p6 pos
npm run test:e2e -- --list
npm run check:data     # ตรวจเอกสาร TEST ค้าง / ตัวนับเลขเอกสาร
```

- `suites/*.cjs` — แต่ละชุดสร้างข้อมูลติดคำว่า TEST ผ่าน API จริง ตรวจผล แล้วลบเองใน `finally`
- `run.cjs` — รันทีละชุด คืนตัวนับเลขเอกสารของบริษัทหลังแต่ละชุด ตรวจข้อมูลค้าง และลบ audit log ของผู้ใช้ทดสอบ (สำรองที่ `.out/`)
- `tools/checks.cjs` — ตรวจข้อมูลหลังทดสอบ, `tools/auth-shots.cjs` — ล็อกอินและถ่ายภาพหน้าจอ (Playwright)
- ผลลัพธ์ (PDF ภาพ ไฟล์สำรอง) อยู่ที่ `.out/` (ไม่ commit)

เขียนชุดใหม่: ผู้ใช้ทดสอบ uid ขึ้นต้น `test-` · เลขที่/ชื่อเอกสารมี `TEST` · ลบทุกอย่างที่สร้างใน `finally` · พิมพ์ `PASS ...`/`FAIL ...` ทีละบรรทัด และ `ALL PASS` ตอนจบ
รายละเอียดเพิ่มเติม: [docs/OPERATIONS_TH.md](../../docs/OPERATIONS_TH.md)
