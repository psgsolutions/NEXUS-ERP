import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { Product } from "@/types/database";

/**
 * [DAT-01] Real-time Inventory Data Hook
 * Fetches products scoped to the current companyId.
 */
export function useInventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, companyId } = useAuth();

  useEffect(() => {
    if (!companyId) return;

    // [SEC-01] Strict Multi-tenant Scoping
    const q = query(
      collection(db, "products"),
      where("companyId", "==", companyId),
      where("isDeleted", "==", false),
      orderBy("updatedAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: Product[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as Product);
      });
      setProducts(items);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [companyId]);

  return { products, loading };
}
