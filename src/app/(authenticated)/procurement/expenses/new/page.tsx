import { redirect } from "next/navigation";

// ฟอร์มเดิมบันทึกผิดที่ (collection ระดับบนสุด) และข้อความเสีย encoding:
// ใบสำคัญจ่ายสร้างจากใบสั่งซื้อที่หน้าจัดซื้อ (ปุ่ม "รับ+ตั้งหนี้")
export default function LegacyExpenseRedirect() {
  redirect("/procurement");
}
