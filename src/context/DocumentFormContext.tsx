"use client";

import React, { createContext, useContext, useState, useMemo } from "react";

export interface DocumentItem {
  id: string;
  code: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  amount: number;
}

interface DocumentFormContextType {
  header: {
    docNo: string;
    docDate: string;
    customerId: string;
    customerName: string;
    taxMode: "VAT_EXCLUDED" | "VAT_INCLUDED" | "NON_VAT";
  };
  setHeader: React.Dispatch<React.SetStateAction<any>>;
  items: DocumentItem[];
  setItems: React.Dispatch<React.SetStateAction<DocumentItem[]>>;
  summary: {
    subTotal: number;
    vatAmount: number;
    grandTotal: number;
  };
}

const DocumentFormContext = createContext<DocumentFormContextType | null>(null);

export function DocumentFormProvider({ children }: { children: React.ReactNode }) {
  const [header, setHeader] = useState({
    docNo: "",
    docDate: new Date().toISOString().split("T")[0],
    customerId: "",
    customerName: "",
    taxMode: "VAT_EXCLUDED" as "VAT_EXCLUDED" | "VAT_INCLUDED" | "NON_VAT",
  });

  const [items, setItems] = useState<DocumentItem[]>([]);

  // คำนวณยอดรวม Real-time ป้องกัน Re-render โดยไม่จำเป็น
  const summary = useMemo(() => {
    const subTotal = items.reduce((sum, item) => sum + (item.amount || 0), 0);
    let vatAmount = 0;
    if (header.taxMode === "VAT_EXCLUDED") {
      vatAmount = subTotal * 0.07;
    } else if (header.taxMode === "VAT_INCLUDED") {
      vatAmount = subTotal - subTotal / 1.07;
    }
    const grandTotal = header.taxMode === "VAT_EXCLUDED" ? subTotal + vatAmount : subTotal;

    return { subTotal, vatAmount, grandTotal };
  }, [items, header.taxMode]);

  return (
    <DocumentFormContext.Provider
      value={{ header, setHeader, items, setItems, summary }}
    >
      {children}
    </DocumentFormContext.Provider>
  );
}

export function useDocumentForm() {
  const context = useContext(DocumentFormContext);
  if (!context) {
    throw new Error("useDocumentForm must be used within DocumentFormProvider");
  }
  return context;
}
