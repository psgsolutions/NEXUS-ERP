import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';

/**
 * Realtime listener ของเอกสารเดียว (เช่น `companies/${companyId}`)
 * ใช้แทนการ list ทั้ง collection เพื่อให้ผ่าน tenant rules
 */
export function useRealtimeDocument<T = any>(path: string | null) {
  const [data, setData] = useState<(T & { id: string }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!path) {
      setData(null);
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(doc(db, path), (snap) => {
      setData(snap.exists() ? ({ id: snap.id, ...snap.data() } as T & { id: string }) : null);
      setLoading(false);
      setError(null);
    }, (err) => {
      console.error(`Error fetching document ${path}:`, err);
      setError(err as Error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [path]);

  return { data, loading, error };
}
