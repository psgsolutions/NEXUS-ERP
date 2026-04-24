"use client";

import React from "react";
import { Plus, Minus } from "lucide-react";
import { cn } from "./Base";

interface NumberStepperProps {
  value: number;
  onChange: (val: number) => void;
  unit?: string;
  step?: number;
  min?: number;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function NumberStepper({ 
  value, 
  onChange, 
  unit, 
  step = 1, 
  min = 0, 
  disabled = false,
  size = "md",
  className 
}: NumberStepperProps) {
  return (
    <div className={cn(
      "flex items-center bg-white/[0.03] border border-white/10 rounded-full overflow-hidden backdrop-blur-sm",
      size === "sm" ? "h-8" : "h-9",
      disabled && "opacity-50 pointer-events-none",
      className
    )}>
      <button 
        onClick={() => onChange(Math.max(min, value - step))}
        className="w-8 h-full flex items-center justify-center hover:bg-white/5 text-white/40 hover:text-white transition-all"
      >
        <Minus size={12} />
      </button>
      <div className="flex-1 px-2 flex items-center justify-center gap-1 min-w-[60px]">
        <span className="text-[13px] font-black text-white font-mono">{value.toLocaleString()}</span>
        {unit && <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">{unit}</span>}
      </div>
      <button 
        onClick={() => onChange(value + step)}
        className="w-8 h-full flex items-center justify-center hover:bg-white/5 text-white/40 hover:text-white transition-all"
      >
        <Plus size={12} />
      </button>
    </div>
  );
}
