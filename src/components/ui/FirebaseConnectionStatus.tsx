"use client";

import React, { useState, useEffect } from "react";
import { Wifi, WifiOff } from "lucide-react";

export function FirebaseConnectionStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Initial check
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full">
        <Wifi size={14} className="text-green-500" />
        <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest">
          Database Connected
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-full animate-pulse">
      <WifiOff size={14} className="text-red-500" />
      <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">
        Connection Lost
      </span>
    </div>
  );
}
