"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import AuthenticatedLayout from "@/components/layout/AuthenticatedLayout";
import { Loader2 } from "lucide-react";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // [SEC-01] Route Protection: Redirect to login if not authenticated
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="h-screen w-full bg-[#09090b] flex flex-col items-center justify-center gap-4 text-nexus-blue">
        <Loader2 className="w-12 h-12 animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] animate-pulse">Initializing Security Protocol...</p>
      </div>
    );
  }

  if (!user) return null;

  return <AuthenticatedLayout>{children}</AuthenticatedLayout>;
}
