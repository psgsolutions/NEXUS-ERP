"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** ตัวออกแบบเอกสารที่ใช้งานจริงอยู่ที่ ตั้งค่า > ออกแบบเอกสาร */
export default function ReportBuilderRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/settings/document-builder"); }, [router]);
  return <div className="p-10 text-center text-white/50 text-sm">กำลังไปหน้าออกแบบเอกสาร...</div>;
}
