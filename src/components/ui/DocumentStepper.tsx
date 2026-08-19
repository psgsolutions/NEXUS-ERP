import React from 'react';
import { Check } from 'lucide-react';
import { cn } from './Base';

export function DocumentStepper({ steps, currentStep }: { steps: string[], currentStep: number }) {
  return (
    <div className="flex items-center gap-1.5 ml-4 border-l border-white/10 pl-4 h-6">
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isActive = index === currentStep;
        return (
          <React.Fragment key={step}>
            <div className={cn(
              "flex items-center justify-center px-3 h-6 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
              isCompleted ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 opacity-50" : 
              isActive ? "bg-white/10 text-white border border-white/20 shadow-[0_0_10px_rgba(255,255,255,0.05)]" : 
              "bg-white/5 text-white/30 border border-transparent opacity-50"
            )}>
              {isCompleted && <Check size={10} className="mr-1.5" />}
              {step}
            </div>
            {index < steps.length - 1 && (
              <div className={cn(
                "w-3 h-[1px]",
                isCompleted ? "bg-cyan-500/30" : "bg-white/5"
              )} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
