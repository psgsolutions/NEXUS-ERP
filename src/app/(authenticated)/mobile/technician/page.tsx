'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MapPin, Camera, CheckCircle, Navigation, X, Upload } from 'lucide-react';
import { cn } from '@/components/ui/Base';
import { apiFetch } from "@/lib/api-client";

// Simple HTML5 Canvas Signature Pad
function SignaturePad({ onClear, onSave }: { onClear: () => void, onSave: (dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  }, []);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    } else {
      return {
        x: (e as React.MouseEvent).clientX - rect.left,
        y: (e as React.MouseEvent).clientY - rect.top
      };
    }
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      setIsDrawing(true);
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) ctx.closePath();
    setIsDrawing(false);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
    onClear();
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      onSave(canvas.toDataURL());
    }
  };

  return (
    <div className="space-y-2 w-full flex flex-col h-[calc(100vh-4rem)] overflow-y-auto custom-scrollbar">
      <div className="bg-white/[0.05] border border-white/20 rounded-xl overflow-hidden relative">
        <canvas
          ref={canvasRef}
          width={300}
          height={150}
          className="w-full h-[150px] touch-none"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        <button 
          onClick={handleClear}
          className="absolute top-2 right-2 p-1.5 bg-red-500/20 text-red-400 rounded-full hover:bg-red-500/40"
        >
          <X size={14} />
        </button>
      </div>
      <button 
        onClick={handleSave}
        className="w-full h-12 bg-nexus-teal/20 text-nexus-teal font-bold rounded-xl border border-nexus-teal/30 active:bg-nexus-teal/40"
      >
        ยืนยันลายเซ็น (Confirm Signature)
      </button>
    </div>
  );
}

export default function FieldTechnicianApp() {
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  
  const [photos, setPhotos] = useState<{ before: string | null, after: string | null }>({
    before: null,
    after: null
  });

  const [signature, setSignature] = useState<string | null>(null);

  // WIP Site Expense State
  const [expenseAmount, setExpenseAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [expenseNote, setExpenseNote] = useState<string>("");
  const [isPostingExpense, setIsPostingExpense] = useState<boolean>(false);
  const [postedJournalId, setPostedJournalId] = useState<string | null>(null);

  const handlePostWipExpense = async () => {
    const amt = parseFloat(expenseAmount);
    if (isNaN(amt) || amt <= 0) return;

    setIsPostingExpense(true);
    try {
      const res = await apiFetch("/api/projects/wip-expense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: "COMP-001",
          projectId: "PRJ-2605-001",
          amount: amt,
          paymentMethod,
          note: expenseNote,
          userId: "TECH-001"
        })
      });

      const data = await res.json();
      if (data.success) {
        setPostedJournalId(data.journalId);
      } else {
        alert(`เกิดข้อผิดพลาดในการบันทึก WIP: ${data.error}`);
      }
    } catch (err: any) {
      alert(`เกิดข้อผิดพลาดในการเชื่อมต่อ API: ${err.message}`);
    } finally {
      setIsPostingExpense(false);
    }
  };

  const handleCheckIn = () => {
    setGpsLoading(true);
    // Mock GPS delay
    setTimeout(() => {
      setIsCheckedIn(true);
      setGpsLoading(false);
    }, 1500);
  };

  const handlePhotoUpload = (type: 'before' | 'after') => {
    // Mock photo taking (In a real app, this opens the camera)
    setPhotos(prev => ({
      ...prev,
      [type]: 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&q=80&w=300' // Mock image
    }));
  };


  // [Master Blueprint V3.1] Global Layout Lock
  React.useEffect(() => {
    const mainEl = document.querySelector("main");
    if (mainEl) mainEl.style.overflowY = "hidden";
    return () => {
      if (mainEl) mainEl.style.overflowY = "auto";
    };
  }, []);
  return (
    // Fixed absolute overlay to cover sidebar on desktop and simulate Mobile App
    <div className="fixed inset-0 z-50 bg-surface-0 flex flex-col md:items-center md:justify-center overflow-y-auto">
      
      {/* Mobile Container wrapper for desktop preview */}
      <div className="w-full md:w-[400px] md:h-[800px] md:border md:border-white/10 md:rounded-3xl md:shadow-2xl bg-surface-0 flex flex-col relative overflow-hidden">
        
        {/* Header */}
        <div className="h-16 bg-surface-1 border-b border-white/5 flex items-center justify-center relative shrink-0">
          <button className="absolute left-4 text-nexus-teal" onClick={() => window.history.back()}>
             <X size={24} />
          </button>
          <h1 className="font-semibold text-lg text-white uppercase tracking-widest">NEXUS TECH</h1>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
          
          {/* WO Info Card */}
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 shadow-xl">
            <div className="flex justify-between items-start mb-2">
              <span className="bg-nexus-teal/20 text-nexus-teal text-[10px] font-semibold px-2 py-1 rounded-full uppercase">Assigned</span>
              <span className="font-mono text-xs text-white/40">WO-2024-001</span>
            </div>
            <h2 className="text-base font-black text-white leading-tight mb-1">ติดตั้งระบบกล้องวงจรปิด AI (10 จุด)</h2>
            <p className="text-xs text-white/60 flex items-center gap-1 mb-4">
              <MapPin size={12} className="text-red-400" /> บริษัท ตัวอย่าง จำกัด (สาขา 1)
            </p>

            {/* Check-in Button */}
            {!isCheckedIn ? (
              <button 
                onClick={handleCheckIn}
                disabled={gpsLoading}
                className={cn(
                  "w-full h-12 rounded-xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)]",
                  gpsLoading ? "bg-blue-500/50 text-white/80" : "bg-blue-500 text-white active:scale-95"
                )}
              >
                <Navigation size={18} className={gpsLoading ? "animate-spin" : ""} /> 
                {gpsLoading ? 'กำลังจับพิกัด GPS...' : 'Check-in เริ่มงาน'}
              </button>
            ) : (
              <div className="w-full h-12 rounded-xl bg-transparent border border-emerald-500/20 text-emerald-400 font-semibold text-sm uppercase tracking-widest flex items-center justify-center gap-2">
                <CheckCircle size={18} /> Check-in เรียบร้อย
              </div>
            )}
          </div>

          {isCheckedIn && (
            <>
              {/* Photo Evidence */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-white/60 uppercase tracking-widest pl-1">รูปถ่ายหน้างาน (Evidence)</h3>
                
                <div className="grid grid-cols-2 gap-3">
                  {/* Before */}
                  <div 
                    onClick={() => handlePhotoUpload('before')}
                    className="aspect-square bg-white/[0.02] border border-dashed border-white/20 rounded-2xl flex flex-col items-center justify-center text-white/40 active:bg-white/15 relative overflow-hidden"
                  >
                    {photos.before ? (
                      <img src={photos.before} alt="Before" className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <>
                        <Camera size={24} className="mb-2" />
                        <span className="text-[10px] font-bold uppercase">ถ่ายรูปก่อนทำ</span>
                      </>
                    )}
                  </div>

                  {/* After */}
                  <div 
                    onClick={() => handlePhotoUpload('after')}
                    className="aspect-square bg-white/[0.02] border border-dashed border-white/20 rounded-2xl flex flex-col items-center justify-center text-white/40 active:bg-white/15 relative overflow-hidden"
                  >
                    {photos.after ? (
                      <img src={photos.after} alt="After" className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <>
                        <Camera size={24} className="mb-2" />
                        <span className="text-[10px] font-bold uppercase">ถ่ายรูปหลังทำ</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Signature */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-white/60 uppercase tracking-widest pl-1">ลายเซ็นลูกค้า (E-Signature)</h3>
                
                {!signature ? (
                  <SignaturePad 
                    onClear={() => setSignature(null)} 
                    onSave={(data) => setSignature(data)}
                  />
                ) : (
                  <div className="bg-white/[0.05] border border-white/10 rounded-xl p-2 relative">
                    <img src={signature} alt="Signature" className="w-full bg-white/15 rounded-lg" />
                    <button 
                      onClick={() => setSignature(null)}
                      className="absolute top-4 right-4 p-1.5 bg-red-500/20 text-red-400 rounded-full"
                    >
                      <X size={14} />
                    </button>
                    <p className="text-center text-[10px] text-nexus-teal mt-2 font-mono">Signed via Nexus Tech</p>
                  </div>
                )}
              </div>

              {/* Site Expense & WIP Asset Posting */}
              <div className="space-y-3 pt-4 border-t border-white/10">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-semibold text-white/60 uppercase tracking-widest pl-1">เบิกค่าใช้จ่ายหน้างาน (Site Expense Receipt)</h3>
                  <span className="text-[10px] font-mono text-nexus-teal font-bold bg-nexus-teal/10 px-2 py-0.5 rounded-full">GL: WIP Asset</span>
                </div>

                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 space-y-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-white/70">จำนวนเงินตามใบเสร็จ (THB)</label>
                    <input 
                      type="number" 
                      placeholder="0.00"
                      value={expenseAmount}
                      onChange={(e) => setExpenseAmount(e.target.value)}
                      className="w-full h-10 px-4 rounded-xl bg-black/40 border border-white/15 text-nexus-teal font-mono font-bold text-sm focus:outline-none focus:border-nexus-teal/50"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-white/70">วิธีชำระเงิน (Payment Method)</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full h-10 px-4 rounded-xl bg-black/40 border border-white/15 text-white text-xs font-bold focus:outline-none focus:border-nexus-teal/50"
                    >
                      <option value="cash">เงินสด (Cash - Account 111100)</option>
                      <option value="ap">เจ้าหนี้การค้า / สำรองจ่าย (AP - Account 211100)</option>
                      <option value="bank">เงินฝากธนาคาร (Bank - Account 111200)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-white/70">รายละเอียดค่าใช้จ่าย (Description)</label>
                    <input 
                      type="text" 
                      placeholder="เช่น ค่าพัสดุฉุกเฉินหน้างาน / ค่าเดินทาง"
                      value={expenseNote}
                      onChange={(e) => setExpenseNote(e.target.value)}
                      className="w-full h-10 px-4 rounded-xl bg-black/40 border border-white/15 text-white text-xs focus:outline-none focus:border-nexus-teal/50"
                    />
                  </div>

                  <button
                    onClick={handlePostWipExpense}
                    disabled={isPostingExpense || !expenseAmount}
                    className={cn(
                      "w-full h-10 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all",
                      postedJournalId
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                        : "bg-nexus-teal/20 text-nexus-teal border border-nexus-teal/40 hover:bg-nexus-teal/30"
                    )}
                  >
                    {isPostingExpense ? (
                      "กำลังบันทึกบัญชี WIP..."
                    ) : postedJournalId ? (
                      `✓ บันทึก WIP แล้ว (Ref: ${postedJournalId.slice(0, 8)})`
                    ) : (
                      "บันทึกใบเสร็จ & โพสต์บัญชี WIP"
                    )}
                  </button>
                </div>
              </div>
            </>
          )}

        </div>

        {/* Bottom Action Bar */}
        {isCheckedIn && (
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-surface-0 via-surface-0 to-transparent shrink-0">
            <button 
              disabled={!signature}
              className={cn(
                "w-full h-12 rounded-xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all",
                signature 
                  ? "bg-nexus-teal/20 text-nexus-teal border border-nexus-teal/40 backdrop-blur-md shadow-[0_0_20px_rgba(0,255,204,0.4)] active:scale-95" 
                  : "bg-white/15 text-white/20"
              )}
            >
              <Upload size={18} /> ปิดงานและส่งข้อมูล (Complete)
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
