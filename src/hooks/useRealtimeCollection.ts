import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  QueryConstraint,
  where,
  orderBy
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
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
      
      // We don't filter out isDeleted here to keep the hook generic, 
      // but usually we would push(where('isDeleted', '==', false)).
      // Let's add it automatically if desired, but we can rely on consumers to add it or do it here.
      // Usually, ERPs filter out soft-deleted records.
      queryConstraints.push(where('isDeleted', '==', false));
      
      queryConstraints.push(...constraints);

      const q = query(colRef, ...queryConstraints);

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const results: T[] = [];
        snapshot.forEach((doc) => {
          results.push({ id: doc.id, ...doc.data() } as unknown as T);
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
