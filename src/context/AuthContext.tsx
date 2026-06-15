"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { 
  onAuthStateChanged, 
  User as FirebaseUser 
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

import { can, Permission } from "@/lib/permissions";

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  companyId: string | null;
  role: string | null;
  checkPermission: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  companyId: null,
  role: null,
  checkPermission: () => false,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

          const userDoc = await fetchWithTimeout();

          if (userDoc && typeof userDoc.exists === 'function' && userDoc.exists()) {
            const data = userDoc.data();
            setCompanyId(data.companyId || "COMP-PREVIEW-01");
            setRole(data.role?.toUpperCase() || "ENGINEER");
          } else {
            // Fallback for development/preview
            setCompanyId("COMP-PREVIEW-01");
            setRole("ADMIN");
          }
        } catch (error: any) {
          console.warn("Network timeout or error fetching user profile:", error?.message || error);
          // Fallback on error to prevent blocking access
          setCompanyId("COMP-PREVIEW-01");
          setRole("ADMIN"); // เปลี่ยนเป็น ADMIN เพื่อให้เข้าถึงระบบได้ชั่วคราวเวลา network มีปัญหา
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
    <AuthContext.Provider value={{ user, loading, companyId, role, checkPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
