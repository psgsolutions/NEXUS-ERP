import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility for merging tailwind classes with standard NEXUS rules.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'glass' | 'ghost' | 'danger';
  size?: 'default' | 'sm' | 'lg';
}

/**
 * [UI-02] Pill-shaped Button (rounded-full)
 * [UI-01] Fixed height h-9 (36px)
 * Enhanced with Rich Aesthetics V2.9
 */
export const PillButton = ({ 
  className, 
  variant = 'primary', 
  size = 'default',
  ...props 
}: ButtonProps) => {
  const variants = {
    primary: "bg-nexus-blue text-black font-bold shadow-[0_0_15px_rgba(20,163,204,0.3)] hover:shadow-[0_0_25px_rgba(20,163,204,0.5)] hover:scale-[1.02] active:scale-[0.98]",
    secondary: "bg-nexus-teal text-black font-bold shadow-[0_0_15px_rgba(16,187,168,0.3)] hover:shadow-[0_0_25px_rgba(16,187,168,0.5)] hover:scale-[1.02] active:scale-[0.98]",
    glass: "bg-white/5 border border-white/10 text-white backdrop-blur-md hover:border-white/30 hover:bg-white/10 hover:shadow-[0_0_20px_rgba(255,255,255,0.05)]",
    ghost: "bg-transparent text-white/60 hover:text-white hover:bg-white/5",
    danger: "bg-danger/20 text-danger border border-danger/30 hover:bg-danger/30 active:bg-danger/20",
  };

  return (
    <button
      className={cn(
        "h-9 px-6 rounded-full flex items-center justify-center transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none tracking-normal select-none",
        variants[variant],
        className
      )}
      {...props}
    />
  );
};

/**
 * [UI-02] Pill-shaped Input (rounded-full)
 * [UI-01] Fixed height h-9 (36px)
 */
export const PillInput = ({ 
  className, 
  ...props 
}: React.InputHTMLAttributes<HTMLInputElement>) => {
  return (
    <input
      className={cn(
        "h-9 px-5 rounded-full bg-white/5 border border-white/10 text-white placeholder:text-white/20 transition-all duration-500 tracking-normal",
        "focus:outline-none focus:border-nexus-blue/50 focus:bg-white/10 focus:shadow-[0_0_15px_rgba(20,163,204,0.1)]",
        className
      )}
      {...props}
    />
  );
};

/**
 * [UI-04] Glassmorphism Card
 * Enhanced with Internal Ambient Glow
 */
export const GlassCard = ({ 
  children, 
  className 
}: { 
  children: React.ReactNode; 
  className?: string;
}) => {
  return (
    <div className={cn(
      "relative overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-900/40 backdrop-blur-2xl transition-all duration-500",
      "hover:border-white/20 hover:bg-zinc-900/50 hover:shadow-[0_0_40px_rgba(255,255,255,0.02)]",
      className
    )}>
      {/* Strategic Ambient Glow Effect */}
      <div className="absolute -top-32 -left-32 w-64 h-64 bg-white/[0.01] blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-nexus-blue/5 blur-[100px] rounded-full pointer-events-none" />
      
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};
