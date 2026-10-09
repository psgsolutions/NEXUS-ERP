"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { arrayUnion, doc, limit, orderBy, writeBatch } from "firebase/firestore";
import { Bell, CheckCheck } from "lucide-react";
import { FloatingLayer } from "@/components/ui/FloatingLayer";
import { cn } from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { db } from "@/lib/firebase-client";
import { relativeTimeTh, toMillis } from "@/lib/dashboard-metrics";

/**
 * กระดิ่งแจ้งเตือน (companies/{companyId}/notifications)
 * แสดงเฉพาะที่ส่งถึงผู้ใช้คนนี้ / บทบาทของผู้ใช้ / ทุกคนในบริษัท; อ่านแล้วเก็บต่อคนใน readBy
 */
export function NotificationBell() {
  const router = useRouter();
  const { user, companyId, role } = useAuth();
  const uid = user?.uid || "";
  const myRole = String(role || "").toUpperCase();
  const constraints = useMemo(() => [orderBy("createdAt", "desc"), limit(100)], []);
  const { data } = useRealtimeCollection<any>(companyId ? `companies/${companyId}/notifications` : "", constraints, false);

  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!anchorRef.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const mine = useMemo(() => data.filter((n: any) => {
    const roles: string[] = Array.isArray(n.targetRoles) ? n.targetRoles : [];
    if (n.targetUserId) return n.targetUserId === uid;
    if (roles.length) return myRole === "SUPERADMIN" || roles.includes(myRole);
    return true;
  }), [data, uid, myRole]);
  const isUnread = (n: any) => (Array.isArray(n.readBy) ? !n.readBy.includes(uid) : n.isRead !== true);
  const unread = mine.filter(isUnread);

  const markRead = async (items: any[]) => {
    if (!companyId || !uid || !items.length) return;
    const batch = writeBatch(db);
    items.slice(0, 400).forEach((n) => batch.update(doc(db, `companies/${companyId}/notifications/${n.id}`), { readBy: arrayUnion(uid) }));
    await batch.commit().catch((err) => console.error("[NOTIFICATION_READ]", err));
  };

  const openItem = async (n: any) => {
    setOpen(false);
    if (isUnread(n)) markRead([n]);
    if (n.link) router.push(n.link);
  };

  return (
    <>
      <button
        ref={anchorRef}
        onClick={() => setOpen(!open)}
        className={cn("relative w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center transition-all", open ? "text-nexus-teal bg-white/10" : "text-white/60 hover:text-nexus-teal hover:bg-white/10")}
        title="การแจ้งเตือน"
        aria-label={`การแจ้งเตือน${unread.length ? ` (${unread.length} รายการใหม่)` : ""}`}
      >
        <Bell size={17} />
        {unread.length > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center font-mono">
            {unread.length > 99 ? "99+" : unread.length}
          </span>
        )}
      </button>

      <FloatingLayer ref={panelRef} anchorRef={anchorRef} open={open} matchWidth={false} align="right" minWidth={360} maxHeight={480} className="bg-surface-2 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col w-[360px]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
          <span className="text-[13px] font-bold text-white">การแจ้งเตือน{unread.length ? ` · ใหม่ ${unread.length}` : ""}</span>
          {unread.length > 0 && (
            <button onClick={() => markRead(unread)} className="text-[12px] text-nexus-teal hover:underline flex items-center gap-1">
              <CheckCheck size={13} /> อ่านทั้งหมด
            </button>
          )}
        </div>
        <div className="overflow-y-auto custom-scrollbar">
          {mine.length === 0 && <p className="px-4 py-8 text-center text-[13px] text-white/40">ยังไม่มีการแจ้งเตือน</p>}
          {mine.slice(0, 50).map((n: any) => {
            const fresh = isUnread(n);
            return (
              <button key={n.id} onClick={() => openItem(n)} className={cn("w-full text-left px-4 py-3 border-b border-white/5 last:border-0 flex gap-3 hover:bg-white/[0.04] transition-colors", fresh && "bg-nexus-teal/[0.04]")}>
                <span className={cn("mt-1.5 w-2 h-2 rounded-full shrink-0", fresh ? "bg-nexus-teal" : "bg-transparent")} />
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-[13px] truncate", fresh ? "font-bold text-white" : "text-white/70")}>{n.title}</span>
                  {n.message && <span className="block text-[12px] text-white/50 truncate">{n.message}</span>}
                  <span className="block text-[11px] text-white/35 mt-0.5">{relativeTimeTh(toMillis(n.createdAt))}</span>
                </span>
              </button>
            );
          })}
        </div>
      </FloatingLayer>
    </>
  );
}
