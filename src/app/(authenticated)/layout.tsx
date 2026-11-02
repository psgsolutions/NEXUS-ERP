"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import AuthenticatedLayout from "@/components/layout/AuthenticatedLayout";
import { Loader2 } from "lucide-react";
import { ForcePasswordChange } from "@/components/shared/ForcePasswordChange";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, profile, displayName } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // [SEC-01] Route Protection: Redirect to login if not authenticated
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="h-screen w-full bg-surface-1 flex flex-col items-center justify-center gap-4 text-nexus-blue">
        <Loader2 className="w-12 h-12 animate-spin" />
        <p className="text-[11px] font-medium uppercase tracking-[0.3em] animate-pulse">กำลังตรวจสอบสิทธิ์การเข้าถึง...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <AuthenticatedLayout>
      {children}
      {/* บัญชีที่ผู้ดูแลระบบ/HR สร้างให้: ต้องตั้งรหัสผ่านใหม่ก่อนใช้งาน */}
      {profile?.mustChangePassword === true && <ForcePasswordChange name={displayName} />}
    </AuthenticatedLayout>
  );
}
