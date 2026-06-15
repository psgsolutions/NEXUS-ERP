'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';

interface ConnectionContextType {
  isOnline: boolean;
  errorMsg: string | null;
}

const ConnectionContext = createContext<ConnectionContextType>({
  isOnline: true,
  errorMsg: null,
});

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    // กฎเหล็ก: ทำ Tenant Isolation ดึงข้อมูลตัวอย่างมาเช็คการเชื่อมต่อ
    // We listen to a generic path, or 'system_status' as required
    const unsubscribe = onSnapshot(
      collection(db, 'system_status'),
      (snapshot) => {
        // ถ้ายิงสำเร็จและได้ข้อมูล (หรือได้ Snapshot เปล่า) แปลว่าเชื่อมต่อสมบูรณ์
        setIsOnline(true);
        setErrorMsg(null);
      },
      (error) => {
        // ดักจับจังหวะหลุดออฟไลน์
        if (error.code === 'unavailable' || error.message.includes('offline')) {
          setIsOnline(false);
          setErrorMsg('CLIENT_DISCONNECTED');
        } else if (error.code === 'permission-denied') {
          // You might still be online, but just have a permission error.
          // However, based on the prompt we can treat this specifically if we want
          // Let's just track offline for now, or flag auth issues
          setIsOnline(false);
          setErrorMsg('AUTH_REVOKED');
        }
      }
    );

    return () => unsubscribe();
  }, []);

  return (
    <ConnectionContext.Provider value={{ isOnline, errorMsg }}>
      {children}
    </ConnectionContext.Provider>
  );
}

export const useDbStatus = () => useContext(ConnectionContext);
