"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** รายงานบริการบันทึกผ่านใบสั่งงานช่าง (ปิดงานพร้อมรูปถ่ายและลายเซ็นลูกค้าในแอปช่าง) */
export default function ProjectReportRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/service/work-orders/new"); }, [router]);
  return <div className="p-10 text-center text-white/50 text-sm">กำลังไปหน้าสร้างใบสั่งงาน...</div>;
}
