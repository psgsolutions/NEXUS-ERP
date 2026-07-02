"use client";

import React, { useState, useRef } from "react";
import { Camera, Upload, Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { PillButton, cn } from "@/components/ui/Base";

interface SmartScannerProps {
  type: "business_card" | "product_label" | "quotation";
  onDataExtracted: (data: any) => void;
  buttonLabel?: string;
}

export function SmartScanner({ type, onDataExtracted, buttonLabel = "AI สแกนข้อมูล" }: SmartScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsScanning(true);
      setIsSuccess(false);

      // Convert file to Base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64String = reader.result as string;

        // Send to API
        const response = await fetch('/api/ai/vision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64String,
            type: type
          })
        });

        const result = await response.json();

        if (result.success && result.data) {
          setIsSuccess(true);
          onDataExtracted(result.data);
          
          // Reset success state after a while
          setTimeout(() => {
            setIsSuccess(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }, 3000);
        } else {
          console.error("Vision API Error:", result.error);
          alert("เกิดข้อผิดพลาดในการวิเคราะห์ภาพ: " + (result.error || "Unknown error"));
        }
        setIsScanning(false);
      };
      reader.onerror = (error) => {
        console.error('Error reading file:', error);
        setIsScanning(false);
        alert("เกิดข้อผิดพลาดในการอ่านไฟล์");
      };

    } catch (err) {
      console.error(err);
      setIsScanning(false);
      alert("เกิดข้อผิดพลาดในการเชื่อมต่อระบบ AI");
    }
  };

  return (
    <div className="relative inline-block">
      <input 
        type="file" 
        accept="image/*" 
        capture="environment" // Suggests camera on mobile
        className="hidden" 
        ref={fileInputRef}
        onChange={handleFileChange}
      />
      <PillButton 
        variant="glass"
        onClick={() => fileInputRef.current?.click()}
        disabled={isScanning}
        className={cn(
          "border-nexus-teal/30 text-nexus-teal hover:bg-nexus-teal/10",
          isScanning && "opacity-70 cursor-not-allowed border-nexus-blue/30 text-nexus-blue",
          isSuccess && "border-success/30 text-success"
        )}
      >
        {isScanning ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            กำลังวิเคราะห์ AI...
          </>
        ) : isSuccess ? (
          <>
            <CheckCircle2 size={16} />
            ดึงข้อมูลสำเร็จ
          </>
        ) : (
          <>
            <Sparkles size={16} className="animate-pulse" />
            {buttonLabel}
          </>
        )}
      </PillButton>
    </div>
  );
}
