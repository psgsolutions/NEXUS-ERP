"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** รายการใบเสนอราคารวมอยู่ที่แท็บ "ใบเสนอราคา" ในหน้างานขาย (/sales) — ส่งต่อพร้อมตัวกรองสถานะ */
export default function QuotationListRedirect() {
  const router = useRouter();
  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("status");
    router.replace(`/sales?tab=quotations${status ? `&status=${encodeURIComponent(status)}` : ""}`);
  }, [router]);
  return <div className="p-10 text-center text-white/50 text-sm">กำลังไปหน้ารายการใบเสนอราคา...</div>;
}
