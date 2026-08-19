import React from "react";
import { cn } from "@/lib/utils";

export interface DocumentFlowStepperProps {
  steps: {
    id: string;
    label: string;
    icon: React.ReactNode;
  }[];
  activeTab: string;
  onStepClick: (tab: string) => void;
}

export function DocumentFlowStepper({ activeTab, onStepClick, steps }: DocumentFlowStepperProps) {
  const activeIndex = steps.findIndex((s) => s.id === activeTab);

  return (
    <div className="w-full relative pb-12 pt-1 h-[70px]">
      <div className="flex items-center w-full justify-between relative">
        {/* Background Line */}
        <div className="absolute top-1/2 left-0 w-full h-[2px] bg-white/5 -translate-y-1/2 z-0 rounded-full"></div>

        {/* Progress Line */}
        {activeIndex >= 0 && (
          <div
            className="absolute top-1/2 left-0 h-[2px] bg-nexus-teal -translate-y-1/2 z-0 transition-all duration-700 ease-in-out shadow-[0_0_10px_rgba(20,163,204,0.6)] rounded-full opacity-50"
            style={{ width: `${(activeIndex / (steps.length - 1)) * 100}%` }}
          ></div>
        )}

        {steps.map((step, idx) => {
          const isActive = activeTab === step.id;
          const isPast = activeIndex > idx;

          return (
            <div
              key={step.id}
              className="relative z-10 flex flex-col items-center group cursor-pointer"
              onClick={() => onStepClick(step.id)}
            >
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center transition-all duration-500",
                  isActive
                    ? "bg-nexus-teal text-black shadow-[0_0_15px_rgba(20,163,204,0.6)] scale-110"
                    : isPast
                    ? "bg-black text-nexus-teal border border-nexus-teal"
                    : "bg-[#111] text-white/20 border border-white/10 group-hover:border-white/30 hover:text-white/60 hover:bg-white/[0.05]"
                )}
              >
                {step.icon}
              </div>
              <div className="absolute top-10 left-1/2 -translate-x-1/2 text-center w-32">
                <p
                  className={cn(
                    "text-[11px] font-medium transition-colors duration-300",
                    isActive
                      ? "text-nexus-teal font-bold drop-shadow-[0_0_8px_rgba(20,163,204,0.6)]"
                      : isPast
                      ? "text-white/90"
                      : "text-white/50 group-hover:text-white/80"
                  )}
                >
                  {step.label}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
