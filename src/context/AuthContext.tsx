"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { 
  onAuthStateChanged,
  signOut,
  User as FirebaseUser
} from "firebase/auth";
import { auth, db } from "@/lib/firebase-client";
import { collection, doc, getDoc, getDocs, limit, query } from "firebase/firestore";

import { can, Permission, primaryRole, resolveRoles } from "@/lib/permissions";
import { inactiveReason, isSuperAdminAccount } from "@/lib/user-status";

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  companyId: string | null;
  /** ตำแหน่งหลัก (แสดงผล/เทียบกับ "SUPERADMIN") — ตรวจสิทธิ์ให้ใช้ checkPermission หรือ can(roles, ...) */
  role: string | null;
  /** ทุกตำแหน่งของผู้ใช้ */
  roles: string[];
  /** ชื่อที่แสดง (ชื่อในโปรไฟล์ > ชื่อบัญชี > ส่วนหน้าอีเมล) */
  displayName: string;
  /** เอกสาร users/{uid} ล่าสุด (เช่น ความคืบหน้าการเริ่มใช้งาน) */
  profile: Record<string, any>;
  checkPermission: (permission: Permission) => boolean;
  switchCompany: (newCompanyId: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  companyId: null,
  role: null,
  roles: [],
  displayName: "",
  profile: {},
  checkPermission: () => false,
  switchCompany: () => {},
});

// Mock login (ใช้กับสคริปต์ทดสอบเช่น scripts/layout-audit.ts) เปิดเฉพาะตอน `next dev` เท่านั้น
// ใน production build จะไม่มีทางล็อกอินผ่าน localStorage ได้
const MOCK_AUTH_ENABLED = process.env.NODE_ENV === "development";

// โปรไฟล์ล่าสุดของผู้ใช้ (uid, roles, companyId) ใช้แสดงผลระหว่างรอโหลดโปรไฟล์จริง — เฉพาะผู้ใช้คนเดิมเท่านั้น
const PROFILE_CACHE_KEY = "nexus_profile_cache";
const readProfileCache = (uid: string): { roles: string[]; companyId: string } | null => {
  try {
    const c = JSON.parse(localStorage.getItem(PROFILE_CACHE_KEY) || "null");
    return c && c.uid === uid && c.companyId ? { roles: resolveRoles(c), companyId: String(c.companyId) } : null;
  } catch { return null; }
};
const writeProfileCache = (uid: string, roles: string[], companyId: string) => {
  try { localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({ uid, roles, companyId })); } catch { /* ignore */ }
};
const mockRoles = (mock: any): string[] => resolveRoles({ role: mock?.role || "ADMIN", roles: mock?.roles });

const readMockUser = (): any | null => {
  if (!MOCK_AUTH_ENABLED || typeof window === "undefined") return null;
  const mock = localStorage.getItem("nexus_mock_auth_user");
  if (!mock) return null;
  try { return JSON.parse(mock); } catch (e) { return null; }
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(() => readMockUser());
  // ไม่มีบริษัทตั้งต้นแบบพิมพ์ตายตัว: ได้จากโปรไฟล์ผู้ใช้เท่านั้น (SUPERADMIN เลือกบริษัทได้)
  const [companyId, setCompanyId] = useState<string | null>(() => readMockUser()?.companyId || null);
  const [roles, setRoles] = useState<string[]>(() => {
    const mock = readMockUser();
    return mock ? mockRoles(mock) : [];
  });
  const role = roles.length ? primaryRole(roles) : null;
  const [loading, setLoading] = useState<boolean>(() => !readMockUser());
  const [profile, setProfile] = useState<Record<string, any>>({});
  const displayName = String(profile.name || profile.displayName || profile.fullName || user?.displayName || user?.email?.split("@")[0] || "");

  // สลับบริษัทได้เฉพาะ SUPERADMIN (ผู้ใช้ทั่วไปผูกกับบริษัทในโปรไฟล์)
  const switchCompany = (newCompanyId: string) => {
    if (role !== "SUPERADMIN") return;
    setCompanyId(newCompanyId);
    localStorage.setItem("selectedCompanyId", newCompanyId);
  };

  const checkPermission = (permission: Permission) => {
    return can(roles, permission);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        const superAdmin = isSuperAdminAccount(user.uid, user.email);
        // [1] แสดงผลทันทีจากโปรไฟล์ล่าสุดของผู้ใช้คนเดิม (ถ้ามี) — ไม่สมมติสิทธิ์ ADMIN หรือบริษัทใด ๆ ให้
        const cached = readProfileCache(user.uid);
        if (cached) {
          setCompanyId(superAdmin ? localStorage.getItem("selectedCompanyId") || cached.companyId : cached.companyId);
          setRoles(superAdmin ? ["SUPERADMIN"] : cached.roles);
          setLoading(false);
        }

        // [2] โปรไฟล์จริงจาก Firestore
        try {
          const userDoc: any = await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error("TIMEOUT")), 15000);
            getDoc(doc(db, "users", user.uid))
              .then((res) => { clearTimeout(timer); resolve(res); })
              .catch((err) => { clearTimeout(timer); reject(err); });
          });
          const exists = !!userDoc?.exists?.();
          const data: any = exists ? userDoc.data() : {};

          // บัญชีรออนุมัติ/ถูกระงับ หรือยังไม่ผูกบริษัท -> ออกจากระบบทันที (หน้า login แสดงเหตุผล)
          if (!superAdmin && (!exists || inactiveReason(data) || !data.companyId)) {
            await signOut(auth);
            return;
          }

          const finalRoles = superAdmin ? ["SUPERADMIN"] : resolveRoles(data);
          let finalCompanyId: string | null = superAdmin
            ? localStorage.getItem("selectedCompanyId") || data.companyId || null
            : data.companyId;
          if (superAdmin && !finalCompanyId) {
            // SUPERADMIN ยังไม่เคยเลือกบริษัท -> เริ่มที่บริษัทแรก (สลับได้ที่ตัวเลือกบริษัท)
            const first = await getDocs(query(collection(db, "companies"), limit(1)));
            finalCompanyId = first.docs[0]?.id || null;
          }
          setCompanyId(finalCompanyId);
          setRoles(finalRoles);
          setProfile(data);
          if (finalCompanyId) writeProfileCache(user.uid, finalRoles, finalCompanyId);
        } catch (error: any) {
          console.warn("Network timeout or error fetching user profile:", error?.message || error);
          // ไม่มีโปรไฟล์ในเครื่องให้ใช้ -> ไม่ปล่อยเข้าระบบด้วยสิทธิ์ที่เดาเอง
          if (!cached) { await signOut(auth); return; }
        } finally {
          setLoading(false);
        }
      } else {
        const mock = readMockUser();
        if (mock) {
          setUser(mock as any);
          setCompanyId(mock.companyId || null);
          setRoles(mockRoles(mock));
          setLoading(false);
        } else {
          setUser(null);
          setCompanyId(null);
          setRoles([]);
          setProfile({});
          setLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, companyId, role, roles, displayName, profile, checkPermission, switchCompany }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
