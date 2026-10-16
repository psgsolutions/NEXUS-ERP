import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  QueryConstraint,
  where,
  orderBy
} from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import { useAuth } from '@/context/AuthContext';

export function useRealtimeCollection<T = any>(
  collectionName: string, 
  constraints: QueryConstraint[] = [],
  requiresCompanyScope: boolean = true
) {
  const { companyId } = useAuth();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // ไม่ระบุ collection (เช่น ผู้ใช้ไม่มีสิทธิ์ดูข้อมูลนี้ หรือยังไม่ได้เลือกเอกสาร) -> ไม่โหลด
    if (!collectionName) {
      setData([]);
      setLoading(false);
      return;
    }
    // If company scope is required but not available, wait.
    if (requiresCompanyScope && !companyId) {
      setLoading(true);
      return;
    }

    try {
      const colRef = collection(db, collectionName);
      
      const queryConstraints: QueryConstraint[] = [];
      
      if (requiresCompanyScope && companyId) {
        queryConstraints.push(where('companyId', '==', companyId));
      }
      
      // Enforce soft-delete rule globally (NEXUS Schema V3.0)
      // Removed the query-level constraint to prevent Firebase Index errors. 
      // The client-side snapshot loop already filters `if (data.isDeleted !== true)`
      // queryConstraints.push(where('isDeleted', '==', false));      
      queryConstraints.push(...constraints);

      const q = query(colRef, ...queryConstraints);

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const results: T[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.isDeleted !== true) {
            results.push({ id: doc.id, ...data } as unknown as T);
          }
        });
        setData(results);
        setLoading(false);
        setError(null);
      }, (err) => {
        console.error(`Error fetching collection ${collectionName}:`, err);
        setError(err as Error);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (err) {
      console.error(`Setup error for collection ${collectionName}:`, err);
      setError(err as Error);
      setLoading(false);
    }
  }, [collectionName, companyId, requiresCompanyScope, JSON.stringify(constraints)]);

  return { data, loading, error };
}
