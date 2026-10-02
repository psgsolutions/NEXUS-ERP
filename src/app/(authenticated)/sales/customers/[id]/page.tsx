import { redirect } from "next/navigation";

// หน้าต้นแบบ (mock) เดิม: ข้อมูลลูกค้าจริงอยู่ที่ /customers
export default function SalesCustomerDetailRedirect() {
  redirect("/customers");
}
