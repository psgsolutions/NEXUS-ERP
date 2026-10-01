import React from 'react';
import { Check } from 'lucide-react';
import { cn } from './Base';

export function DocumentStepper({ steps, currentStep }: { steps: string[], currentStep: number }) {
  return (
    <div className="flex items-center gap-1.5 ml-4 border-l border-white/10 pl-4 h-7">
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isActive = index === currentStep;
        return (
          <React.Fragment key={step}>
            <div className={cn(
              "flex items-center justify-center px-3 h-7 rounded-full text-[12px] font-bold uppercase tracking-wider transition-all",
              isCompleted ? "bg-nexus-teal/15 text-nexus-teal border border-nexus-teal/40" : 
              isActive ? "bg-white/20 text-white border border-white/40 shadow-[0_0_10px_rgba(255,255,255,0.15)]" : 
              "bg-white/5 text-white/70 border border-white/20"
            )}>
              {isCompleted && <Check size={12} className="mr-1.5 text-nexus-teal" />}
              {step}
            </div>
            {index < steps.length - 1 && (
              <div className={cn(
                "w-3 h-[1px]",
                isCompleted ? "bg-nexus-teal/40" : "bg-white/20"
              )} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
