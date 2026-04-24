"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/components/ui/Base";
import { X } from "lucide-react";

interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}

/**
 * [UI-04] L3 Detail View (Slide-over / Sheet)
 * Glassmorphism detail view for editing/adding data.
 */
export const Sheet = ({ 
  isOpen, 
  onClose, 
  title, 
  description, 
  children 
}: SheetProps) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (isOpen) setMounted(true);
  }, [isOpen]);

  if (!mounted) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className={cn(
          "fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Sheet Content */}
      <div 
        className={cn(
          "fixed top-0 right-0 h-full w-full max-w-xl glass-card bg-zinc-900/90 rounded-none border-l border-white/10 z-50 transform transition-transform duration-300 ease-in-out p-0 flex flex-col",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <header className="p-6 border-b border-white/5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">{title}</h2>
            {description && <p className="text-xs text-white/40 mt-1">{description}</p>}
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </div>
    </>
  );
};
