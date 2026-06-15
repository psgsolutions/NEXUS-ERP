"use client";

import React, { useState, useEffect } from "react";
import { Toast } from "@/components/ui/Base";

/**
 * SystemAlertProvider
 * Overrides the native window.alert globally to use the NEXUS ERP Toast system instead.
 */
export function SystemAlertProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ message: string, isVisible: boolean, type: "error" | "warning" | "success" }>({
    message: "",
    isVisible: false,
    type: "warning"
  });

  useEffect(() => {
    const originalAlert = window.alert;
    
    // Override native alert with custom system toast
    window.alert = (message: string) => {
      setToast({
        message,
        isVisible: true,
        type: "warning" // Alerts are generally warnings or errors
      });
    };

    // Cleanup on unmount (though this lives at root level)
    return () => {
      window.alert = originalAlert;
    };
  }, []);

  return (
    <>
      {children}
      <Toast 
        message={toast.message} 
        isVisible={toast.isVisible} 
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))} 
      />
    </>
  );
}
