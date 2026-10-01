"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { 
  onAuthStateChanged, 
  User as FirebaseUser 
} from "firebase/auth";
import { auth, db } from "@/lib/firebase-client";
import { doc, getDoc } from "firebase/firestore";

import { can, Permission } from "@/lib/permissions";

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  companyId: string | null;
  role: string | null;
  checkPermission: (permission: Permission) => boolean;
  switchCompany: (newCompanyId: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  companyId: null,
  role: null,
  checkPermission: () => false,
  switchCompany: () => {},
});

// Mock login (ใช้กับสคริปต์ทดสอบเช่น scripts/layout-audit.ts) เปิดเฉพาะตอน `next dev` เท่านั้น
// ใน production build จะไม่มีทางล็อกอินผ่าน localStorage ได้
const MOCK_AUTH_ENABLED = process.env.NODE_ENV === "development";

const readMockUser = (): any | null => {
  if (!MOCK_AUTH_ENABLED || typeof window === "undefined") return null;
  const mock = localStorage.getItem("nexus_mock_auth_user");
  if (!mock) return null;
  try { return JSON.parse(mock); } catch (e) { return null; }
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(() => readMockUser());
  const [companyId, setCompanyId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return readMockUser()?.companyId || localStorage.getItem('selectedCompanyId') || 'COM-NEXUS-01';
    }
    return null;
  });
  const [role, setRole] = useState<string | null>(() => {
    const mock = readMockUser();
    return mock ? (mock.role || 'ADMIN') : null;
  });
  const [loading, setLoading] = useState<boolean>(() => !readMockUser());

  const switchCompany = (newCompanyId: string) => {
    setCompanyId(newCompanyId);
    localStorage.setItem("selectedCompanyId", newCompanyId);
  };

  const checkPermission = (permission: Permission) => {
    return can(role, permission);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        // [1] Optimistic UI: Set defaults based on LocalStorage & Email to unblock loading immediately
        const cachedCompanyId = localStorage.getItem("selectedCompanyId") || "COM-NEXUS-01";
        let defaultRole = "ADMIN";
        if (user.uid === "fgIglIug2dh4aNMMeachaugIyFM2" || user.email === "sadmin@admin.com") {
          defaultRole = "SUPERADMIN";
        }
        
        setCompanyId(cachedCompanyId);
        setRole(defaultRole);
        setLoading(false); // <--- ปลดล็อกหน้า Loading ทันที ไม่ต้องรอ Firestore

        // [2] Background Fetch: ไปดึงข้อมูล Profile จริงทีหลัง
        try {
          const fetchWithTimeout = async () => {
             return new Promise((resolve, reject) => {
               const timer = setTimeout(() => reject(new Error('TIMEOUT')), 15000);
               getDoc(doc(db, "users", user.uid))
                 .then(res => {
                   clearTimeout(timer);
                   resolve(res);
                 })
                 .catch(err => {
                   clearTimeout(timer);
                   reject(err);
                 });
             });
          };

          const userDoc: any = await fetchWithTimeout();

          let data: any = {};
          if (userDoc && typeof userDoc.exists === 'function' && userDoc.exists()) {
            data = userDoc.data();
          }

          const finalCompanyId = data.companyId || cachedCompanyId;
          let finalRole = data.role?.toUpperCase() || defaultRole;

          if (user.uid === "fgIglIug2dh4aNMMeachaugIyFM2" || user.email === "sadmin@admin.com") {
            finalRole = "SUPERADMIN";
          }

          // Update state with the real data from DB if it differs
          setCompanyId(finalCompanyId);
          setRole(finalRole);
        } catch (error: any) {
          console.warn("Network timeout or error fetching user profile:", error?.message || error);
          // Keep optimistic defaults
        }
      } else {
        const mock = readMockUser();
        if (mock) {
          setUser(mock as any);
          setCompanyId(mock.companyId || localStorage.getItem('selectedCompanyId') || 'COM-NEXUS-01');
          setRole(mock.role || 'ADMIN');
          setLoading(false);
        } else {
          setUser(null);
          setCompanyId(null);
          setRole(null);
          setLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, companyId, role, checkPermission, switchCompany }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
