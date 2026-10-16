"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { where } from "firebase/firestore";
import { ArrowLeft, Loader2, LogIn, LogOut, MapPin } from "lucide-react";
import { GlassCard, PillButton, PillInput, cn } from "@/components/ui/Base";
import { SmartSelect } from "@/components/ui/SmartComponents";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { apiFetch } from "@/lib/api-client";
import { can } from "@/lib/permissions";
import { WORK_START, bkkParts, employeeName, employeeStatus } from "@/lib/hr";

type Gps = { lat: number; lng: number; accuracy: number } | null;

export default function AttendancePage() {
  const router = useRouter();
  const { user, companyId, role, roles } = useAuth();
  const isHr = can(roles, "hr:edit");
  const { data: employees } = useRealtimeCollection<any>("employees");

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const clock = bkkParts(now);

  const me = useMemo(() => employees.find((e: any) => String(e.email || "").toLowerCase() === String(user?.email || "").toLowerCase()), [employees, user?.email]);
  const [mode, setMode] = useState<"self" | "manual">("self");
  const [employeeDocId, setEmployeeDocId] = useState("");
  const [date, setDate] = useState(clock.date);
  const [time, setTime] = useState(clock.time);
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const [gps, setGps] = useState<Gps>(null);
  const [gpsState, setGpsState] = useState<"idle" | "busy" | "error">("idle");
  const [busy, setBusy] = useState<"" | "IN" | "OUT">("");
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const viewDate = mode === "self" ? clock.date : date;
  const dayFilter = useMemo(() => [where("date", "==", viewDate)], [viewDate]);
  const { data: todayRecs } = useRealtimeCollection<any>("attendance", dayFilter);
  const target = mode === "self" ? me : employees.find((e: any) => e.id === employeeDocId);
  const dayRecs = todayRecs.filter((r: any) => target && r.employeeDocId === target.id && r.date === viewDate);
  const inRec = dayRecs.find((r: any) => r.type === "IN");
  const outRec = dayRecs.find((r: any) => r.type === "OUT");

  const options = employees
    .filter((e: any) => employeeStatus(e) !== "resigned")
    .map((e: any) => ({ value: e.id, label: `${e.employeeId || e.id} ${employeeName(e)}`, description: e.position || "" }));

  const captureGps = () => {
    if (!navigator.geolocation) return setGpsState("error");
    setGpsState("busy");
    navigator.geolocation.getCurrentPosition(
      (p) => { setGps({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }); setGpsState("idle"); },
      () => setGpsState("error"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };
  useEffect(() => { if (mode === "self") captureGps(); }, [mode]);

  const submit = async (type: "IN" | "OUT") => {
    setBusy(type);
    setMessage(null);
    try {
      const res = await apiFetch("/api/hr/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, type, location, note, gps, ...(mode === "manual" ? { employeeDocId, date, time } : {}) }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "ลงเวลาไม่สำเร็จ");
      setMessage({ text: `${type === "IN" ? "ลงเวลาเข้างาน" : "ลงเวลาออกงาน"} ${json.name} เวลา ${json.time} น.${json.status === "late" ? " (เข้าสาย)" : ""}` });
      setNote("");
    } catch (err: any) {
      setMessage({ text: err.message, error: true });
    } finally {
      setBusy("");
    }
  };

  const ready = mode === "self" ? !!me : !!employeeDocId;

  const header = (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-5 rounded-3xl backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <PillButton variant="glass" onClick={() => router.back()} className="w-10 h-10 p-0 flex items-center justify-center"><ArrowLeft size={20} /></PillButton>
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">ลงเวลาทำงาน</h1>
          <p className="text-sm text-white/60 mt-1">เวลาเข้างานปกติ {WORK_START} น. · ลงเวลาเองใช้เวลาของระบบ</p>
        </div>
      </div>
      {isHr && (
        <div className="flex rounded-full border border-white/10 p-0.5">
          {(["self", "manual"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={cn("h-8 px-4 rounded-full text-xs font-bold", mode === m ? "bg-nexus-teal/15 text-nexus-teal" : "text-white/50 hover:text-white")}>
              {m === "self" ? "ลงเวลาตัวเอง" : "ลงแทนพนักงาน"}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const left = (
    <div className="space-y-4 pb-10 max-w-3xl">
      {message && <div className={cn("p-3 rounded-xl text-xs font-bold border", message.error ? "bg-danger/10 border-danger/20 text-danger" : "bg-nexus-teal/10 border-nexus-teal/20 text-nexus-teal")}>{message.text}</div>}

      <GlassCard className="p-6 space-y-4">
        {mode === "self" ? (
          <div className="text-center space-y-1">
            <p className="text-5xl font-bold font-mono text-white tracking-tight">{clock.time}<span className="text-2xl text-white/40">:{new Date(now).toISOString().slice(17, 19)}</span></p>
            <p className="text-sm text-white/60">{new Date(now).toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
            <p className="text-sm text-white pt-2">{me ? `${employeeName(me)} · ${me.position || ""}` : <span className="text-warning">ไม่พบข้อมูลพนักงานที่ผูกกับอีเมล {user?.email} กรุณาติดต่อฝ่ายบุคคล</span>}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_150px_110px] gap-3">
            <div className="space-y-1 min-w-0">
              <label className="text-[12px] font-bold text-white/70 ml-1">พนักงาน <span className="text-danger">*</span></label>
              <SmartSelect options={options} value={employeeDocId} onChange={setEmployeeDocId} allowCustom={false} placeholder="ค้นหารหัส / ชื่อพนักงาน" />
            </div>
            <div className="space-y-1">
              <label className="text-[12px] font-bold text-white/70 ml-1">วันที่</label>
              <PillInput type="date" value={date} max={clock.date} onChange={(e) => setDate(e.target.value)} className="w-full h-9 text-sm font-mono" />
            </div>
            <div className="space-y-1">
              <label className="text-[12px] font-bold text-white/70 ml-1">เวลา</label>
              <PillInput type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full h-9 text-sm font-mono" />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[12px] font-bold text-white/70 ml-1">สถานที่ / ไซต์งาน</label>
            <PillInput value={location} onChange={(e) => setLocation(e.target.value)} placeholder={target?.workLocation || "เช่น สำนักงานใหญ่, หน้างานลูกค้า"} className="w-full h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-[12px] font-bold text-white/70 ml-1">หมายเหตุ</label>
            <PillInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="(ถ้ามี)" className="w-full h-9 text-sm" />
          </div>
        </div>

        {mode === "self" && (
          <div className="flex items-center justify-between gap-3 text-[12px] text-white/60">
            <span className="flex items-center gap-1.5 min-w-0">
              <MapPin size={13} className={gps ? "text-nexus-teal" : "text-white/40"} />
              {gpsState === "busy" ? "กำลังหาพิกัด..." : gps ? <span className="font-mono truncate">{gps.lat.toFixed(5)}, {gps.lng.toFixed(5)} (±{Math.round(gps.accuracy)} ม.)</span> : gpsState === "error" ? "จับพิกัดไม่ได้ (ลงเวลาได้โดยไม่มีพิกัด)" : "ยังไม่มีพิกัด"}
            </span>
            <button onClick={captureGps} className="text-nexus-teal hover:underline shrink-0">จับพิกัดใหม่</button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <PillButton variant="confirm" onClick={() => submit("IN")} disabled={!ready || !!busy || !!inRec} className="h-12 text-sm font-bold">
            {busy === "IN" ? <Loader2 size={16} className="animate-spin mr-2" /> : <LogIn size={16} className="mr-2" />} เข้างาน
          </PillButton>
          <PillButton variant="glass" onClick={() => submit("OUT")} disabled={!ready || !!busy || !inRec || !!outRec} className="h-12 text-sm font-bold">
            {busy === "OUT" ? <Loader2 size={16} className="animate-spin mr-2" /> : <LogOut size={16} className="mr-2" />} ออกงาน
          </PillButton>
        </div>
        {target && (
          <p className="text-[12px] text-white/50 text-center">
            วันนี้: เข้างาน {inRec ? `${inRec.time} น.${inRec.status === "late" ? " (สาย)" : ""}` : "-"} · ออกงาน {outRec ? `${outRec.time} น.` : "-"}
          </p>
        )}
      </GlassCard>
    </div>
  );

  return <NexusPageLayout header={header} leftContent={left} />;
}
