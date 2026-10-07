'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MapPin, Camera, CheckCircle, Navigation, X, Upload, ChevronLeft, ClipboardList, Loader2 } from 'lucide-react';
import { cn } from '@/components/ui/Base';
import { apiFetch } from "@/lib/api-client";
import { useAuth } from '@/context/AuthContext';
import { useRealtimeCollection } from '@/hooks/useRealtimeCollection';
import { db } from '@/lib/firebase-client';
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

type Gps = { lat: number; lng: number; accuracy: number } | null;
type PhotoType = 'before' | 'after' | 'signature';

const OPEN_STATUSES = ['ASSIGNED', 'IN_PROGRESS'];
const STATUS_LABEL: Record<string, string> = { ASSIGNED: 'รอเริ่มงาน', IN_PROGRESS: 'กำลังทำงาน', COMPLETED: 'ปิดงานแล้ว' };

// พิกัดจริงจากอุปกรณ์ (ต้องเปิดผ่าน https หรือ localhost เบราว์เซอร์จึงจะยอมให้ใช้ GPS)
function getGps(timeout = 15000): Promise<Gps> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('อุปกรณ์นี้ไม่รองรับ GPS'));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) }),
      (err) => reject(new Error(err.code === err.PERMISSION_DENIED ? 'ไม่ได้รับอนุญาตให้ใช้ตำแหน่ง' : 'จับพิกัดไม่สำเร็จ')),
      { enableHighAccuracy: true, timeout, maximumAge: 0 }
    );
  });
}

// ย่อรูปเป็น JPEG ขนาดพอเหมาะก่อนบันทึก (เก็บใน Firestore ได้ไม่เกิน ~1MB ต่อเอกสาร)
async function compressImage(file: File, maxSize = 1280): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('อ่านไฟล์รูปไม่ได้'));
      i.src = url;
    });
    const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    let quality = 0.7;
    let data = canvas.toDataURL('image/jpeg', quality);
    while (data.length > 700_000 && quality > 0.3) {
      quality -= 0.1;
      data = canvas.toDataURL('image/jpeg', quality);
    }
    return data;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Simple HTML5 Canvas Signature Pad
function SignaturePad({ onClear, onSave }: { onClear: () => void, onSave: (dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  }, []);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const point = 'touches' in e ? e.touches[0] : (e as React.MouseEvent);
    // แปลงพิกัดจอเป็นพิกัด canvas (canvas ถูกยืดเต็มความกว้าง)
    return {
      x: ((point.clientX - rect.left) * canvas.width) / rect.width,
      y: ((point.clientY - rect.top) * canvas.height) / rect.height,
    };
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
      setHasInk(true);
    }
  };

  const stopDrawing = () => {
    canvasRef.current?.getContext('2d')?.closePath();
    setIsDrawing(false);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    onClear();
  };

  return (
    <div className="space-y-2 w-full flex flex-col">
      <div className="bg-white/[0.05] border border-white/20 rounded-xl overflow-hidden relative">
        <canvas
          ref={canvasRef}
          width={600}
          height={300}
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
          className="absolute top-2 right-2 p-1.5 bg-danger/20 text-danger rounded-full hover:bg-danger/40"
        >
          <X size={14} />
        </button>
      </div>
      <button
        disabled={!hasInk}
        onClick={() => canvasRef.current && onSave(canvasRef.current.toDataURL('image/png'))}
        className="w-full h-12 bg-nexus-teal/20 text-nexus-teal font-bold rounded-xl border border-nexus-teal/30 active:bg-nexus-teal/40 disabled:opacity-40"
      >
        ยืนยันลายเซ็น
      </button>
    </div>
  );
}

export default function FieldTechnicianApp() {
  const { user, role, companyId } = useAuth();
  const isTechnician = role === 'TECHNICIAN';

  const { data: workOrders, loading: woLoading } = useRealtimeCollection<any>(companyId ? `companies/${companyId}/work_orders` : '');
  const myOrders = useMemo(
    () => workOrders
      .filter((w: any) => OPEN_STATUSES.includes(String(w.status || '').toUpperCase()))
      .filter((w: any) => !isTechnician || w.technicianUid === user?.uid)
      .sort((a: any, b: any) => String(a.scheduleDate || '').localeCompare(String(b.scheduleDate || ''))),
    [workOrders, isTechnician, user?.uid]
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const wo = useMemo(() => workOrders.find((w: any) => w.id === selectedId) || null, [workOrders, selectedId]);
  const woPath = companyId && wo ? `companies/${companyId}/work_orders/${wo.id}` : '';

  // รูปถ่าย/ลายเซ็นเก็บแยกเป็นเอกสารย่อยของใบงาน (attachments/before|after|signature)
  const { data: attachments } = useRealtimeCollection<any>(woPath ? `${woPath}/attachments` : '');
  const photo = (type: PhotoType) => attachments.find((a: any) => a.id === type)?.dataUrl || null;

  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [uploading, setUploading] = useState<PhotoType | null>(null);
  const [completing, setCompleting] = useState(false);
  const [message, setMessage] = useState('');
  const fileInputs = { before: useRef<HTMLInputElement>(null), after: useRef<HTMLInputElement>(null) };

  // WIP Site Expense State
  const [expenseAmount, setExpenseAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [expenseNote, setExpenseNote] = useState<string>("");
  const [isPostingExpense, setIsPostingExpense] = useState<boolean>(false);
  const [postedJournalId, setPostedJournalId] = useState<string | null>(null);

  const isCheckedIn = !!wo?.checkIn;

  const selectOrder = (id: string | null) => {
    setSelectedId(id);
    setGpsError('');
    setMessage('');
    setPostedJournalId(null);
    setExpenseAmount('');
    setExpenseNote('');
  };

  const handleCheckIn = async (withoutGps = false) => {
    if (!woPath) return;
    setGpsLoading(true);
    setGpsError('');
    try {
      const gps = withoutGps ? null : await getGps();
      await updateDoc(doc(db, woPath), {
        status: 'IN_PROGRESS',
        checkIn: { at: serverTimestamp(), by: user?.uid || null, gps, ...(withoutGps ? { note: 'ไม่มีพิกัด GPS' } : {}) },
        updatedAt: serverTimestamp(),
      });
    } catch (err: any) {
      setGpsError(err.message || 'เช็คอินไม่สำเร็จ');
    } finally {
      setGpsLoading(false);
    }
  };

  const saveAttachment = async (type: PhotoType, dataUrl: string) => {
    if (!woPath || !companyId) return;
    setUploading(type);
    try {
      await setDoc(doc(db, `${woPath}/attachments`, type), {
        companyId,
        type,
        dataUrl,
        createdAt: serverTimestamp(),
        createdBy: user?.uid || null,
      });
    } catch (err: any) {
      setMessage(`บันทึกไม่สำเร็จ: ${err.message}`);
    } finally {
      setUploading(null);
    }
  };

  const handlePhotoSelected = async (type: 'before' | 'after', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      await saveAttachment(type, await compressImage(file));
    } catch (err: any) {
      setMessage(err.message);
    }
  };

  const handlePostWipExpense = async () => {
    const amt = parseFloat(expenseAmount);
    if (!wo?.projectId || !companyId || isNaN(amt) || amt <= 0) return;

    setIsPostingExpense(true);
    try {
      const res = await apiFetch("/api/projects/wip-expense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          projectId: wo.projectId,
          workOrderId: wo.id,
          amount: amt,
          paymentMethod,
          note: [wo.woCode, expenseNote].filter(Boolean).join(' '),
        })
      });

      const data = await res.json();
      if (data.success) {
        setPostedJournalId(data.journalId);
      } else {
        setMessage(`บันทึกค่าใช้จ่ายไม่สำเร็จ: ${data.error}`);
      }
    } catch (err: any) {
      setMessage(`เชื่อมต่อเซิร์ฟเวอร์ไม่ได้: ${err.message}`);
    } finally {
      setIsPostingExpense(false);
    }
  };

  const canComplete = isCheckedIn && !!photo('after') && !!photo('signature');
  const handleComplete = async () => {
    if (!woPath || !canComplete) return;
    setCompleting(true);
    try {
      // พิกัดตอนปิดงาน (ถ้าจับไม่ได้ก็ปิดงานต่อได้)
      const gps = await getGps(8000).catch(() => null);
      await updateDoc(doc(db, woPath), {
        status: 'COMPLETED',
        checkOut: { at: serverTimestamp(), by: user?.uid || null, gps },
        completedAt: serverTimestamp(),
        completedBy: user?.uid || null,
        updatedAt: serverTimestamp(),
      });
      setMessage(`ปิดงาน ${wo.woCode || wo.id} เรียบร้อย`);
      setSelectedId(null);
    } catch (err: any) {
      setMessage(`ปิดงานไม่สำเร็จ: ${err.message}`);
    } finally {
      setCompleting(false);
    }
  };

  // [Master Blueprint V3.1] Global Layout Lock
  React.useEffect(() => {
    const mainEl = document.querySelector("main");
    if (mainEl) mainEl.style.overflowY = "hidden";
    return () => {
      if (mainEl) mainEl.style.overflowY = "auto";
    };
  }, []);

  const photoTile = (type: 'before' | 'after', label: string) => {
    const src = photo(type);
    return (
      <div
        onClick={() => fileInputs[type].current?.click()}
        className="aspect-square bg-white/[0.02] border border-dashed border-white/20 rounded-2xl flex flex-col items-center justify-center text-white/40 active:bg-white/15 relative overflow-hidden cursor-pointer"
      >
        <input ref={fileInputs[type]} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handlePhotoSelected(type, e)} />
        {uploading === type ? (
          <Loader2 size={24} className="animate-spin" />
        ) : src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={label} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <>
            <Camera size={24} className="mb-2" />
            <span className="text-[10px] font-bold">{label}</span>
          </>
        )}
      </div>
    );
  };

  return (
    // Fixed absolute overlay to cover sidebar on desktop and simulate Mobile App
    <div className="fixed inset-0 z-50 bg-surface-0 flex flex-col md:items-center md:justify-center overflow-y-auto">

      {/* Mobile Container wrapper for desktop preview */}
      <div className="w-full md:w-[400px] md:h-[800px] md:border md:border-white/10 md:rounded-3xl md:shadow-2xl bg-surface-0 flex flex-col relative overflow-hidden">

        {/* Header */}
        <div className="h-16 bg-surface-1 border-b border-white/5 flex items-center justify-center relative shrink-0">
          <button className="absolute left-4 text-nexus-teal" onClick={() => (wo ? selectOrder(null) : window.history.back())}>
            {wo ? <ChevronLeft size={24} /> : <X size={24} />}
          </button>
          <h1 className="font-semibold text-lg text-white tracking-widest">{wo ? (wo.woCode || wo.id) : 'งานช่างของฉัน'}</h1>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
          {message && (
            <div className="p-3 rounded-xl bg-nexus-teal/10 border border-nexus-teal/20 text-nexus-teal text-xs font-bold text-center">{message}</div>
          )}

          {/* รายการใบงานที่เปิดอยู่ */}
          {!wo && (
            <div className="space-y-3">
              {!isTechnician && (
                <p className="text-[11px] text-white/40 text-center">มุมมองผู้ดูแล: แสดงใบงานที่เปิดอยู่ทั้งหมดของบริษัท</p>
              )}
              {woLoading && <p className="text-center text-white/40 text-sm py-10">กำลังโหลดใบงาน...</p>}
              {!woLoading && myOrders.length === 0 && (
                <div className="flex flex-col items-center text-center text-white/40 py-16 gap-3">
                  <ClipboardList size={36} />
                  <p className="text-sm">ยังไม่มีใบงานที่มอบหมายให้คุณ</p>
                </div>
              )}
              {myOrders.map((w: any) => (
                <button
                  key={w.id}
                  onClick={() => selectOrder(w.id)}
                  className="w-full text-left bg-white/[0.03] border border-white/10 rounded-2xl p-4 active:bg-white/[0.06] transition-all"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={cn(
                      "text-[10px] font-semibold px-2 py-1 rounded-full",
                      w.status === 'IN_PROGRESS' ? "bg-warning/20 text-warning" : "bg-nexus-teal/20 text-nexus-teal"
                    )}>{STATUS_LABEL[w.status] || w.status}</span>
                    <span className="font-mono text-xs text-white/40">{w.woCode || w.id}</span>
                  </div>
                  <p className="text-sm font-bold text-white">{w.customerName || '-'}</p>
                  <p className="text-[11px] text-white/50 mt-1">
                    {w.scheduleDate ? `นัดหมาย ${new Date(w.scheduleDate).toLocaleDateString('th-TH')}` : 'ยังไม่ระบุวันนัด'}
                    {!isTechnician && w.technicianName ? ` · ${w.technicianName}` : ''}
                  </p>
                </button>
              ))}
            </div>
          )}

          {wo && (
            <>
              {/* WO Info Card */}
              <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 shadow-xl">
                <div className="flex justify-between items-start mb-2">
                  <span className="bg-nexus-teal/20 text-nexus-teal text-[10px] font-semibold px-2 py-1 rounded-full">{STATUS_LABEL[wo.status] || wo.status}</span>
                  <span className="font-mono text-xs text-white/40">{wo.soCode}</span>
                </div>
                <h2 className="text-base font-black text-white leading-tight mb-1">{wo.customerName || '-'}</h2>
                <p className="text-xs text-white/60 flex items-center gap-1 mb-3">
                  <MapPin size={12} className="text-danger" /> {wo.scheduleDate ? `นัดหมาย ${new Date(wo.scheduleDate).toLocaleDateString('th-TH')}` : 'ยังไม่ระบุวันนัด'}
                </p>
                {Array.isArray(wo.items) && wo.items.length > 0 && (
                  <ul className="text-[12px] text-white/70 space-y-1 mb-3 border-t border-white/5 pt-3">
                    {wo.items.map((it: any, i: number) => (
                      <li key={it.id || i} className="flex justify-between gap-2">
                        <span className="truncate">{it.name || it.description || '-'}</span>
                        <span className="font-mono text-white/50 shrink-0">x{it.quantity ?? it.qty ?? 1}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {wo.remarks && <p className="text-[11px] text-warning mb-3">หมายเหตุ: {wo.remarks}</p>}

                {/* Check-in Button */}
                {!isCheckedIn ? (
                  <div className="space-y-2">
                    <button
                      onClick={() => handleCheckIn(false)}
                      disabled={gpsLoading}
                      className={cn(
                        "w-full h-12 rounded-xl font-black text-sm tracking-widest flex items-center justify-center gap-2 transition-all",
                        gpsLoading ? "bg-nexus-blue/50 text-white/80" : "bg-nexus-blue text-white active:scale-95"
                      )}
                    >
                      <Navigation size={18} className={gpsLoading ? "animate-spin" : ""} />
                      {gpsLoading ? 'กำลังจับพิกัด GPS...' : 'เช็คอินเริ่มงาน'}
                    </button>
                    {gpsError && (
                      <div className="text-center space-y-1">
                        <p className="text-[11px] text-danger">{gpsError}</p>
                        <button onClick={() => handleCheckIn(true)} className="text-[11px] font-bold text-white/60 underline">
                          เช็คอินโดยไม่บันทึกพิกัด
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-full h-12 rounded-xl bg-transparent border border-nexus-teal/20 text-nexus-teal font-semibold text-sm tracking-widest flex items-center justify-center gap-2">
                    <CheckCircle size={18} /> เช็คอินแล้ว
                    {wo.checkIn?.gps && (
                      <a
                        href={`https://maps.google.com/?q=${wo.checkIn.gps.lat},${wo.checkIn.gps.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] font-mono text-white/50 underline"
                      >
                        ±{wo.checkIn.gps.accuracy}ม.
                      </a>
                    )}
                  </div>
                )}
              </div>

              {isCheckedIn && (
                <>
                  {/* Photo Evidence */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-white/60 tracking-widest pl-1">รูปถ่ายหน้างาน</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {photoTile('before', 'ถ่ายรูปก่อนทำ')}
                      {photoTile('after', 'ถ่ายรูปหลังทำ *')}
                    </div>
                  </div>

                  {/* Signature */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-white/60 tracking-widest pl-1">ลายเซ็นลูกค้า *</h3>
                    {!photo('signature') ? (
                      <SignaturePad onClear={() => undefined} onSave={(data) => saveAttachment('signature', data)} />
                    ) : (
                      <div className="bg-white/[0.05] border border-white/10 rounded-xl p-2 relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo('signature')} alt="ลายเซ็นลูกค้า" className="w-full bg-white/15 rounded-lg" />
                        <p className="text-center text-[10px] text-nexus-teal mt-2">บันทึกลายเซ็นแล้ว</p>
                      </div>
                    )}
                  </div>

                  {/* Site Expense & WIP Asset Posting */}
                  <div className="space-y-3 pt-4 border-t border-white/10">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xs font-semibold text-white/60 tracking-widest pl-1">เบิกค่าใช้จ่ายหน้างาน</h3>
                      <span className="text-[10px] font-mono text-nexus-teal font-bold bg-nexus-teal/10 px-2 py-0.5 rounded-full">บัญชีงานระหว่างทำ</span>
                    </div>

                    {!wo.projectId ? (
                      <p className="text-[11px] text-white/40 bg-white/[0.03] border border-white/10 rounded-2xl p-4">
                        ใบงานนี้ไม่ได้ผูกกับโครงการ จึงบันทึกค่าใช้จ่ายเข้างานระหว่างทำไม่ได้ (ใช้เมนูเบิกค่าใช้จ่ายแทน)
                      </p>
                    ) : (
                      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 space-y-4">
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-white/70">จำนวนเงินตามใบเสร็จ (บาท)</label>
                          <input
                            type="number"
                            placeholder="0.00"
                            value={expenseAmount}
                            onChange={(e) => setExpenseAmount(e.target.value)}
                            className="w-full h-10 px-4 rounded-xl bg-black/40 border border-white/15 text-nexus-teal font-mono font-bold text-sm focus:outline-none focus:border-nexus-teal/50"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-white/70">วิธีชำระเงิน</label>
                          <select
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value)}
                            className="w-full h-10 px-4 rounded-xl bg-black/40 border border-white/15 text-white text-xs font-bold focus:outline-none focus:border-nexus-teal/50"
                          >
                            <option value="cash">เงินสด (1111-00)</option>
                            <option value="ap">สำรองจ่าย / เจ้าหนี้ (2111-00)</option>
                            <option value="bank">เงินฝากธนาคาร (1112-00)</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-white/70">รายละเอียดค่าใช้จ่าย</label>
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
                          disabled={isPostingExpense || !expenseAmount || !!postedJournalId}
                          className={cn(
                            "w-full h-10 rounded-xl font-bold text-xs tracking-wider flex items-center justify-center gap-2 transition-all",
                            postedJournalId
                              ? "bg-nexus-teal/10 text-nexus-teal border border-nexus-teal/30"
                              : "bg-nexus-teal/20 text-nexus-teal border border-nexus-teal/40 hover:bg-nexus-teal/30"
                          )}
                        >
                          {isPostingExpense
                            ? "กำลังบันทึก..."
                            : postedJournalId
                              ? `✓ ส่งบันทึกบัญชีแล้ว (รออนุมัติ)`
                              : "บันทึกค่าใช้จ่ายเข้าโครงการ"}
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Bottom Action Bar */}
        {wo && isCheckedIn && (
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-surface-0 via-surface-0 to-transparent shrink-0">
            <button
              onClick={handleComplete}
              disabled={!canComplete || completing}
              className={cn(
                "w-full h-12 rounded-xl font-black text-sm tracking-widest flex items-center justify-center gap-2 transition-all",
                canComplete
                  ? "bg-nexus-teal/20 text-nexus-teal border border-nexus-teal/40 backdrop-blur-md shadow-neon-teal active:scale-95"
                  : "bg-white/15 text-white/20"
              )}
            >
              {completing ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
              {canComplete ? 'ปิดงานและส่งข้อมูล' : 'ต้องมีรูปหลังทำและลายเซ็นก่อนปิดงาน'}
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
