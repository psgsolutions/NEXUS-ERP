import { redirect } from "next/navigation";

// หน้าต้นแบบ (mock) เดิมถูกแทนด้วยฟอร์มลูกค้าจริงที่ /customers/new
export default function SalesCustomerNewRedirect() {
  redirect("/customers/new");
}
