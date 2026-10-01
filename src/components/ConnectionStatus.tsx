'use client';

import { useConnection } from '@/context/ConnectionContext';
import { useEffect, useState } from 'react';

export function ConnectionStatus({ className = '' }: { className?: string }) {
  const { isConnected, isLoading } = useConnection();
  const isOnline = isConnected;
  const errorMsg = null;
  const [latency, setLatency] = useState<number>(0);

  // Periodic health check for latency to the server API
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          const data = await res.json();
          // Extract latency integer
          const lat = parseInt(data.latency.replace('ms', ''), 10);
          setLatency(lat);
        }
      } catch (err) {
        // Handle fetch errors silently or update state
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  // Theme styling based on status
  let bgColor = 'bg-cyan-400';
  let pulseColor = 'bg-cyan-400/50';
  let message = `SYS-OK: ${latency}ms`;

  if (!isOnline) {
    if (errorMsg === 'AUTH_REVOKED') {
      bgColor = 'bg-amber-500';
      pulseColor = 'bg-amber-500/50';
      message = 'ERR-403: AUTH_REVOKED';
    } else {
      bgColor = 'bg-red-500';
      pulseColor = 'bg-red-500/50';
      message = 'ERR-OFFLINE: CLIENT_DISCONNECTED';
    }
  }

  return (
    <div className={`flex items-center gap-3 rounded-full border border-white/10 bg-surface-0/80 px-4 py-2 backdrop-blur-md shadow-lg ${className}`}>
      <div className="relative flex h-3 w-3 items-center justify-center">
        <div className={`absolute inline-flex h-full w-full animate-ping rounded-full ${pulseColor} opacity-75`}></div>
        <div className={`relative inline-flex h-2 w-2 rounded-full ${bgColor}`}></div>
      </div>
      <span className="font-mono text-xs tracking-wider text-gray-300">
        {message}
      </span>
    </div>
  );
}
