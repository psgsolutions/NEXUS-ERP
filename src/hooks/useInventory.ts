import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";

export interface Product {
  id: string;
  sku: string;
  name: string;
  category_id: string;
  currentQty: number;
  unit: string;
  pricing: {
    avg_cost: number;
    price_pos: number;
  };
  stock_status: {
    qty_on_hand: number;
    qty_reserved: number;
    qty_available: number;
  };
}

/**
 * [DAT-01] Real-time Inventory Data Hook
 * Fetches products scoped to the current company_id.
 */
export function useInventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, companyId } = useAuth();

  useEffect(() => {
    if (!companyId) return;

    // [SEC-01] Company Isolation Query
    const q = query(
      collection(db, "products"),
      where("company_id", "==", companyId),
      orderBy("createdAt", "desc")
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
