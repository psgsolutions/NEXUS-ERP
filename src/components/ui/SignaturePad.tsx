"use client";

import React, { useRef, useState, useEffect } from "react";
import { Eraser, Check } from "lucide-react";
import { PillButton } from "./Base";

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  onClear?: () => void;
}

export function SignaturePad({ onSave, onClear }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.strokeStyle = "#10bba8"; // Nexus Teal
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
  }, []);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      onSave(canvas.toDataURL());
    }
  };

  const draw = (e: any) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.beginPath();
      if (onClear) onClear();
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative border-2 border-dashed border-white/10 rounded-2xl bg-black/40 overflow-hidden cursor-crosshair">
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          onMouseDown={startDrawing}
          onMouseUp={stopDrawing}
          onMouseMove={draw}
          onTouchStart={startDrawing}
          onTouchEnd={stopDrawing}
          onTouchMove={draw}
          className="w-full h-[200px] touch-none"
        />
        <div className="absolute top-4 left-4 tactical-label opacity-30 pointer-events-none uppercase">
           Customer Digital Signature
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <PillButton variant="glass" onClick={clear}>
          <Eraser size={14} /> ล้างลายเซ็น
        </PillButton>
        <PillButton className="shadow-neon-teal" onClick={() => {
           const canvas = canvasRef.current;
           if (canvas) onSave(canvas.toDataURL());
        }}>
          <Check size={14} /> บันทึกลายเซ็น
        </PillButton>
      </div>
    </div>
  );
}
