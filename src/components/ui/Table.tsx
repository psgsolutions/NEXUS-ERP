import React from "react";
import { cn } from "@/components/ui/Base";

interface TableProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

interface TableHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

interface TableRowProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

interface TableCellProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export function Table({ className, children, ...props }: TableProps) {
  return (
    <div className={cn("w-full", className)} {...props}>
      {children}
    </div>
  );
}

export function TableHeader({ className, children, ...props }: TableHeaderProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-12 text-[10px] font-black text-white/40 uppercase tracking-widest px-6 py-3 border-b border-white/5",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function TableRow({ className, children, ...props }: TableRowProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-12 gap-4 items-center px-6 py-3 hover:bg-nexus-blue/10 border border-transparent hover:border-nexus-blue/30 rounded-full transition-all cursor-pointer group",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function TableCell({ className, children, ...props }: TableCellProps) {
  return (
    <div className={cn("", className)} {...props}>
      {children}
    </div>
  );
}
