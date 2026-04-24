"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";

/**
 * Root Router: ตัวควบคุมจราจรหลักของระบบ
 */
export default function RootPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        // [PASS] ล็อกอินแล้ว -> ไปหน้า Dashboard (ซึ่งอยู่ในกลุ่ม authenticated)
        // หมายเหตุ: เราจะย้าย Dashboard จริงไปที่ /dashboard เพื่อความชัวร์
        router.push("/dashboard");
      } else {
        // [FAIL] ยังไม่ล็อกอิน -> ไปหน้า Login
        router.push("/login");
      }
    }
  }, [user, loading, router]);

  return (
    <div className="h-screen w-full bg-[#020203] flex flex-col items-center justify-center gap-4 text-nexus-blue">
      <Loader2 className="w-12 h-12 animate-spin" />
      <p className="text-[10px] font-black uppercase tracking-[0.3em] animate-pulse">Establishing Secure Connection...</p>
    </div>
  );
}
