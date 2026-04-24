import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility for merging tailwind classes with standard NEXUS rules.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'glass' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
}

/**
 * [UI-02] Pill-shaped Button (rounded-full)
 * [UI-01] Fixed height h-9 (36px)
 */
export const PillButton = ({ 
  className, 
  variant = 'primary', 
  size = 'default',
  ...props 
}: ButtonProps) => {
  const variants = {
    primary: "bg-nexus-blue text-black font-bold hover:shadow-nexus-glow",
    secondary: "bg-nexus-teal text-black font-bold hover:shadow-nexus-glow",
    glass: "glass-card bg-white/5 border border-white/10 text-white hover:border-nexus-blue/50",
    ghost: "bg-transparent text-white/70 hover:text-white hover:bg-white/5",
  };

  return (
    <button
      className={cn(
        "h-9 px-6 rounded-full flex items-center justify-center transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:pointer-events-none tracking-normal",
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
        "h-9 px-5 rounded-full bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-nexus-blue/50 focus:ring-1 focus:ring-nexus-blue/20 transition-all tracking-normal",
        className
      )}
      {...props}
    />
  );
};

/**
 * [UI-04] Glassmorphism Card
 */
export const GlassCard = ({ 
  children, 
  className 
}: { 
  children: React.ReactNode; 
  className?: string;
}) => {
  return (
    <div className={cn("glass-card p-6", className)}>
      {children}
    </div>
  );
};
