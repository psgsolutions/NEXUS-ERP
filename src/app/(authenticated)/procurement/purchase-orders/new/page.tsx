import { redirect } from "next/navigation";

// ฟอร์มเดิมบันทึกใบสั่งซื้อไว้ที่ collection ระดับบนสุด: ใช้ฟอร์มใบสั่งซื้อหลักแทน
export default function LegacyPurchaseOrderRedirect() {
  redirect("/procurement/orders/new");
}
