"use client";

import React, { useState, useEffect } from "react";
import { Truck, ChevronDown, Check, Tag } from "lucide-react";
import { PillButton, cn } from "@/components/ui/Base";
import { fetchSupplierPriceHistory, SupplierPriceRecord } from "@/lib/procurement-service";
import { useAuth } from "@/context/AuthContext";

interface SupplierPriceSelectorProps {
  productId?: string;
  productName?: string;
  onSelectPrice: (price: number, supplierName?: string, supplierId?: string) => void;
  className?: string;
}

export function SupplierPriceSelector({
  productId,
  productName,
  onSelectPrice,
  className
}: SupplierPriceSelectorProps) {
  const { companyId } = useAuth();
  const currentCompanyId = companyId || "COMP-001";
  
  const [history, setHistory] = useState<SupplierPriceRecord[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const targetId = productId || productName;

  useEffect(() => {
    if (!targetId || !currentCompanyId) {
      setHistory([]);
      return;
    }

    let isMounted = true;
    setLoading(true);

    fetchSupplierPriceHistory(targetId, currentCompanyId)
      .then((records) => {
        if (isMounted) {
          setHistory(records);
        }
      })
      .catch((err) => {
        console.error("Failed to load supplier price history:", err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [targetId, currentCompanyId]);

  if (!targetId || history.length === 0) {
    return null;
  }

  return (
    <div className={cn("relative inline-block", className)}>
      <PillButton
        variant="glass"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="h-8 px-3 rounded-full text-[12px] text-nexus-teal border border-nexus-teal/30 hover:bg-nexus-teal/20 transition-all flex items-center gap-1.5"
        title="เปรียบเทียบราคาซัพพลายเออร์ย้อนหลัง"
      >
        <Truck size={13} className="text-nexus-teal" />
        <span>ราคาเปรียบเทียบ ({history.length})</span>
        <ChevronDown size={12} className={cn("transition-transform duration-200", isOpen && "rotate-180")} />
      </PillButton>

      {isOpen && (
        <div className="absolute z-[999999] left-0 top-full mt-2 w-72 bg-neutral-900/95 backdrop-blur-xl border border-white/15 rounded-2xl shadow-2xl p-3 space-y-2 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-white/10 pb-2 px-1">
            <span className="text-[12px] font-bold text-white flex items-center gap-1.5">
              <Tag size={13} className="text-nexus-teal" />
              เปรียบเทียบราคาซัพพลายเออร์ล่าสุด
            </span>
            <span className="text-[10px] text-white/40 font-mono">สูงสุด 3 ราย</span>
          </div>

          <div className="space-y-1.5 max-h-56 overflow-y-auto custom-scrollbar">
            {history.map((rec, idx) => (
              <div
                key={idx}
                onClick={() => {
                  onSelectPrice(rec.price, rec.supplierName, rec.supplierId);
                  setIsOpen(false);
                }}
                className="flex items-center justify-between p-2 rounded-xl bg-white/[0.03] hover:bg-nexus-teal/10 border border-white/5 hover:border-nexus-teal/30 cursor-pointer transition-all group"
              >
                <div className="space-y-0.5 truncate pr-2">
                  <p className="text-[12px] font-bold text-white group-hover:text-nexus-teal truncate">
                    {rec.supplierName}
                  </p>
                  {rec.poCode && (
                    <p className="text-[10px] text-white/40 font-mono">
                      {rec.poCode} {rec.date ? `(${rec.date})` : ""}
                    </p>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[14px] font-black font-mono text-nexus-teal">
                    ฿{rec.price.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <p className="text-[10px] text-white/50 group-hover:text-nexus-teal font-bold flex items-center justify-end gap-0.5">
                    <Check size={10} /> เลือกราคานี้
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
