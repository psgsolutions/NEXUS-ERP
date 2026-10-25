"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { PillButton } from "@/components/ui/Base";
import { X, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface DialogContextType {
  showAlert: (message: string, title?: string, type?: "info" | "warning" | "error") => Promise<void>;
  showConfirm: (message: string, title?: string) => Promise<boolean>;
  /** แทน window.prompt: คืนข้อความที่พิมพ์ หรือ null ถ้ากดยกเลิก */
  showPrompt: (message: string, title?: string, placeholder?: string) => Promise<string | null>;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export function useSystemDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error("useSystemDialog must be used within a DialogProvider");
  }
  return context;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<{
    type: "alert" | "confirm" | "prompt";
    message: string;
    title: string;
    alertType: "info" | "warning" | "error";
    placeholder?: string;
  }>({
    type: "alert",
    message: "",
    title: "",
    alertType: "info",
  });
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const [resolvePromise, setResolvePromise] = useState<((value: any) => void) | null>(null);

  const showAlert = (message: string, title = "แจ้งเตือน", type: "info" | "warning" | "error" = "info"): Promise<void> => {
    return new Promise((resolve) => {
      setConfig({ type: "alert", message, title, alertType: type });
      setResolvePromise(() => resolve);
      setIsOpen(true);
    });
  };

  const showConfirm = (message: string, title = "ยืนยันการทำรายการ"): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfig({ type: "confirm", message, title, alertType: "warning" });
      setResolvePromise(() => resolve);
      setIsOpen(true);
    });
  };

  const showPrompt = (message: string, title = "ระบุข้อมูล", placeholder = ""): Promise<string | null> => {
    return new Promise((resolve) => {
      setText("");
      setConfig({ type: "prompt", message, title, alertType: "info", placeholder });
      setResolvePromise(() => resolve);
      setIsOpen(true);
    });
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => { if (isOpen && config.type === "prompt") setTimeout(() => inputRef.current?.focus(), 30); }, [isOpen, config.type]);

  const handleClose = (value: boolean | string | null | void) => {
    setIsOpen(false);
    if (resolvePromise) {
      resolvePromise(value);
      setResolvePromise(null);
    }
  };
  const cancelValue = config.type === "confirm" ? false : config.type === "prompt" ? null : undefined;

  const dialogContent = isOpen && mounted && typeof document !== "undefined" ? createPortal(
    <div className="fixed inset-0 flex items-center justify-center p-6 animate-in fade-in duration-200" style={{ zIndex: 9999999 }}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-3xl" onClick={() => handleClose(cancelValue)} />
      <div className="relative w-full max-w-md bg-surface-0/80 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-2xl p-8 flex flex-col gap-6 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300" style={{ zIndex: 10000000 }}>

            <div className="flex items-start gap-4">
               <div className={cn(
                 "w-12 h-12 rounded-full flex items-center justify-center border shrink-0",
                 config.alertType === 'error' ? "bg-danger/10 text-danger border-danger/20 shadow-[0_0_15px_rgba(255,77,79,0.2)]" :
                 config.alertType === 'warning' ? "bg-warning/10 text-warning border-warning/20 shadow-[0_0_15px_rgba(255,197,61,0.2)]" :
                 "bg-nexus-teal/10 text-nexus-teal border-nexus-teal/20 shadow-neon-teal/20"
               )}>
                  {config.alertType === 'error' ? <X size={24} /> : config.alertType === 'warning' ? <AlertTriangle size={24} /> : <Info size={24} />}
               </div>
               <div className="space-y-2 flex-1 pt-1 min-w-0">
                 <h3 className="text-lg font-semibold text-white tracking-tight leading-snug">{config.title}</h3>
                 <p className="text-[14px] text-white/70 font-bold leading-relaxed whitespace-pre-line break-words">{config.message}</p>
               </div>
            </div>

            {config.type === "prompt" && (
              <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} placeholder={config.placeholder}
                onKeyDown={(e) => { if (e.key === "Enter") handleClose(text); if (e.key === "Escape") handleClose(null); }}
                className="w-full h-11 px-4 rounded-2xl bg-white/[0.04] border border-white/10 text-white text-[14px] leading-[1.9] outline-none focus:border-nexus-teal/40" />
            )}

            <div className="flex items-center justify-end gap-3 mt-2">
              {config.type !== "alert" ? (
                <>
                  <PillButton variant="glass" onClick={() => handleClose(cancelValue)}>
                    ยกเลิก
                  </PillButton>
                  <PillButton variant={config.alertType === 'error' ? 'danger' : 'primary'} onClick={() => handleClose(config.type === "prompt" ? text : true)}>
                    ยืนยัน
                  </PillButton>
                </>
              ) : (
                <PillButton variant="primary" onClick={() => handleClose()}>
                  รับทราบ
                </PillButton>
              )}
            </div>
          </div>
        </div>,
    document.body
  ) : null;

  return (
    <DialogContext.Provider value={{ showAlert, showConfirm, showPrompt }}>
      {children}
      {dialogContent}
    </DialogContext.Provider>
  );
}
