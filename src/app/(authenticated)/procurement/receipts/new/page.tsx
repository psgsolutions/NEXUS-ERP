import { redirect } from "next/navigation";

// หน้าเดิมใช้ข้อมูลใบสั่งซื้อจำลองและข้อความเสีย encoding: ใช้หน้ารับสินค้าเข้าคลังจริงแทน
export default function ProcurementReceiptRedirect() {
  redirect("/inventory/in/new");
}
