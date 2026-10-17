import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase-client";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { Product } from "@/types/database";

/**
 * [DAT-01] Real-time Inventory Data Hook
 * Fetches products scoped to the current companyId.
 */
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { useProducts } from "./useProducts";

/**
 * [DAT-01] Real-time Inventory Data Hook
 * Fetches products scoped to the current companyId.
 */
export function useInventory() {
  const { data: products, loading } = useProducts<any>();
  
  // Optionally sort in memory to avoid Firebase Index errors
  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => {
      const timeA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : 0;
      const timeB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : 0;
      return timeB - timeA;
    });
  }, [products]);

  return { products: sortedProducts, loading };
}
