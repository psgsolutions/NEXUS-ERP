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

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const switchCompany = (newCompanyId: string) => {
    setCompanyId(newCompanyId);
    localStorage.setItem("selectedCompanyId", newCompanyId);
  };

  const checkPermission = (permission: Permission) => {
    return can(role, permission);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      if (user) {
        try {
          // [FIX] เพิ่ม Timeout เพื่อป้องกันระบบค้างตอนโหลดครั้งแรกผ่าน network ที่ช้า
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

          let finalCompanyId = data.companyId || localStorage.getItem("selectedCompanyId") || "COM-NEXUS-01";
          let finalRole = data.role?.toUpperCase() || "ADMIN";

          // Force SUPERADMIN role for specific admin account
          if (user.uid === "fgIglIug2dh4aNMMeachaugIyFM2" || user.email === "sadmin@admin.com") {
            finalRole = "SUPERADMIN";
          }

          setCompanyId(finalCompanyId);
          setRole(finalRole);
        } catch (error: any) {
          console.warn("Network timeout or error fetching user profile:", error?.message || error);
          let finalCompanyId = localStorage.getItem("selectedCompanyId") || "COM-NEXUS-01";
          let finalRole = "ADMIN";
          
          if (user.uid === "fgIglIug2dh4aNMMeachaugIyFM2" || user.email === "sadmin@admin.com") {
            finalRole = "SUPERADMIN";
          }
          
          setCompanyId(finalCompanyId);
          setRole(finalRole);
        }
      } else {
        setCompanyId(null);
        setRole(null);
      }
      
      setLoading(false);
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
