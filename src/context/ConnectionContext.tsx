'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

// สร้างโครงสร้างข้อมูลสำหรับ Context
interface ConnectionContextType {
  isConnected: boolean;
  isLoading: boolean;
}

const ConnectionContext = createContext<ConnectionContextType>({
  isConnected: false,
  isLoading: true,
});

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 💡 กฎเหล็ก: ฝั่งหน้าบ้าน ต้องถามสถานะผ่าน API เท่านั้น ห้ามดึง firebase-admin ตรงๆ
    const checkConnection = async () => {
      try {
        const response = await fetch('/api/health');
        if (response.ok) {
          const data = await response.json();
          if (data.database === 'connected') {
            setIsConnected(true);
          } else {
            setIsConnected(false);
          }
        } else {
          setIsConnected(false);
        }
      } catch (error) {
        setIsConnected(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 15000); // Check every 15s to recover from offline state
    return () => clearInterval(interval);
  }, []);

  return (
    <ConnectionContext.Provider value={{ isConnected, isLoading }}>
      {children}
    </ConnectionContext.Provider>
  );
}

// สร้าง Hook ไว้ให้หน้าอื่นๆ เรียกใช้งานได้ง่ายๆ
export const useConnection = () => useContext(ConnectionContext);
