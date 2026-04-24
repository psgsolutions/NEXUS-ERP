"use client";

import React, { useEffect, useState } from "react";
import { Zap, Wifi, WifiOff, Activity } from "lucide-react";
import { healthService } from "@/services/health.service";
import { cn } from "@/components/ui/Base";

export function SystemHealthIndicator() {
  const [status, setStatus] = useState<"checking" | "online" | "offline">("checking");
  const [latency, setLatency] = useState<number>(0);

  useEffect(() => {
    const checkHealth = async () => {
      const result = await healthService.checkDatabaseConnectivity();
      setStatus(result.status);
      setLatency(result.latency);
    };

    checkHealth();
    // ตรวจสอบทุกๆ 30 วินาที
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-3.5 bg-white/[0.02] border border-white/5 rounded-full h-9 px-4 backdrop-blur-md select-none group hover:border-nexus-teal/30 hover:bg-white/[0.05] transition-all duration-300">
      <div className="flex items-center gap-2">
        {status === "online" ? (
          <Wifi size={13} className="text-nexus-teal" />
        ) : status === "offline" ? (
          <WifiOff size={13} className="text-danger" />
        ) : (
          <Activity size={13} className="text-white/20" />
        )}
        <span className={cn(
          "text-[9px] font-black uppercase tracking-widest font-mono",
          status === "online" ? "text-nexus-teal" : "text-white/20"
        )}>
          DB: {status}
        </span>
      </div>

      {status === "online" && (
        <div className="flex items-center gap-2 border-l border-white/10 pl-3.5">
          <Zap size={11} className="text-nexus-blue" />
          <span className="text-[9px] font-black text-white/40 uppercase font-mono tracking-wide">
            {latency}ms <span className="text-white/25">LATENCY</span>
          </span>
        </div>
      )}
    </div>
  );
}
