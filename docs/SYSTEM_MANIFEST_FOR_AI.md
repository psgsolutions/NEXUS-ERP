# 🧠 NEXUS ERP: System Manifest for AI (V2.9)

ชุดคำสั่งแม่แบบ (Prompt Templates) และแนวทางสำหรับ AI ในการพัฒนาระบบ NEXUS ERP

---

## 1. 🛡️ หลักการทำงาน (Operational Principles)
- **No Inference**: ห้ามเดาโครงสร้างข้อมูล ให้อ้างอิงจาก `src/types/database.ts` หรือ `NEXUS_SPEC.md` เท่านั้น
- **Protocol First**: ทุกการแก้ไข UI ต้องเช็คกฎ `h-9` และ `rounded-full` เสมอ
- **Security Scoping**: ทุก Query ต้องมี `where("companyId", "==", companyId)`

---

## 2. 🧩 รูปแบบการเขียนโค้ด (Coding Patterns)

### A. การเรียกใช้ฐานข้อมูล (Firestore Query)
```typescript
const q = query(
  collection(db, "target_collection"),
  where("companyId", "==", companyId),
  where("isDeleted", "==", false),
  orderBy("updatedAt", "desc")
);
```

### B. มาตรฐานคอมโพเนนต์ (Component Standard)
```tsx
<PillButton variant="primary" onClick={handleAction}>
  <Icon size={18} />
  Action Label
</PillButton>
```

---

## 3. 🎨 กฎการออกแบบ UI (UI Rules)
- **Height**: 36px (h-9) สำหรับปุ่มและอินพุต
- **Shape**: rounded-full (Pill-shape)
- **Font**: font-style: normal !important (ห้ามตัวเอียง)
- **Numbers**: mono-numbers (Font-mono) สำหรับข้อมูลตัวเลขและรหัส

---

## 4. 📝 ขั้นตอนการทำงาน (Workflow)
1. **Plan**: วิเคราะห์ความต้องการและตรวจสอบกฎใน Spec
2. **Execute**: แก้ไขโค้ดตามมาตรฐาน PSG Standard V2.9
3. **Audit**: บันทึกกิจกรรมลงใน `audit_logs` (ถ้ามีการเปลี่ยนแปลงข้อมูล)
4. **Deliver**: ตรวจสอบความถูกต้องและประสิทธิภาพก่อนส่งมอบ

---
*Status: SYSTEM MANIFEST ACTIVE | Master AI Guard V2.9*
