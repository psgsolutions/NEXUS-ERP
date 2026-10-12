"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** ใบกำกับภาษี/ใบแจ้งหนี้ออกจากใบสั่งขาย (ปุ่ม "ออกใบกำกับภาษี" ในหน้าใบสั่งขาย) เพื่อให้เลขเรียงต่อเนื่องและลงบัญชีครบ */
export default function InvoiceCreateRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/sales/orders"); }, [router]);
  return <div className="p-10 text-center text-white/50 text-sm">ออกใบกำกับภาษีจากใบสั่งขาย กำลังไปหน้ารายการใบสั่งขาย...</div>;
}
