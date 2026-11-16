/**
 * นโยบายการเข้าระบบ: ปิดทุกแท็บของระบบแล้ว ต้องล็อกอินใหม่ (ตัดสินใจ 2026-11-16)
 * - รีเฟรชแท็บเดิม หรือเปิดแท็บใหม่ระหว่างที่ยังมีแท็บของระบบเปิดอยู่ = ใช้ต่อได้ ไม่ต้องล็อกอินซ้ำ
 * - แต่ละแท็บลงทะเบียนตัวเองใน localStorage (nx_tabs: { tabId: เวลาล่าสุด }) อัปเดตทุก 15 วินาที และลบตัวเองตอนปิด (pagehide)
 *   แท็บที่ค้างเกิน TAB_TTL (เบราว์เซอร์ปิดกะทันหัน/แท็บพื้นหลังถูกหน่วง) ไม่นับ
 * - แท็บที่ผ่านการตรวจแล้วจำไว้ใน sessionStorage (อยู่เฉพาะแท็บนั้น รีเฟรชแล้วยังอยู่)
 * นี่คือนโยบายความสะดวก/ความปลอดภัยฝั่งเครื่องผู้ใช้ — สิทธิ์จริงยังตรวจด้วย token ที่ server ทุกครั้ง
 */
const TABS = "nx_tabs";
const TAB_FLAG = "nx_tab_session";
const TAB_TTL = 120_000; // แท็บพื้นหลังของ Chrome อาจหน่วงตัวจับเวลาถึง 1 นาที

const safe = <T,>(fn: () => T, fallback: T): T => { try { return fn(); } catch { return fallback; } };
const readTabs = (): Record<string, number> => safe(() => JSON.parse(localStorage.getItem(TABS) || "{}") || {}, {});
const writeTabs = (t: Record<string, number>) => safe(() => localStorage.setItem(TABS, JSON.stringify(t)), undefined);

/** แท็บอื่นที่ยังเปิดอยู่ (ไม่รวมแท็บนี้) */
export function otherTabsAlive(selfId = "", now = Date.now(), tabs = readTabs()): number {
  return Object.entries(tabs).filter(([id, at]) => id !== selfId && now - Number(at) < TAB_TTL).length;
}

/** เรียกก่อนล็อกอิน: แท็บนี้กำลังเริ่ม session ใหม่ */
export function markSessionStart() {
  safe(() => sessionStorage.setItem(TAB_FLAG, "1"), undefined);
  safe(() => localStorage.setItem("nx_last_active", String(Date.now())), undefined);
}

/** ผู้ใช้ที่ล็อกอินค้างไว้ ใช้ต่อในแท็บนี้ได้ไหม (แท็บนี้เคยผ่าน หรือยังมีแท็บของระบบเปิดอยู่) */
export function sessionAllowed(): boolean {
  if (typeof window === "undefined") return true;
  // สภาพแวดล้อมที่ใช้ storage ไม่ได้ (โหมดส่วนตัวบางแบบ): ไม่บังคับ ให้ Firebase ตัดสินตามปกติ
  if (!safe(() => { sessionStorage.setItem("nx_probe", "1"); sessionStorage.removeItem("nx_probe"); localStorage.getItem(TABS); return true; }, false)) return true;
  if (safe(() => sessionStorage.getItem(TAB_FLAG) === "1", false)) return true;
  if (otherTabsAlive() > 0) { markSessionStart(); return true; }
  return false;
}

/** ลงทะเบียนแท็บนี้ระหว่างที่ล็อกอินอยู่ — คืนฟังก์ชันหยุด */
export function startTabHeartbeat(): () => void {
  if (typeof window === "undefined") return () => {};
  const id = safe(() => sessionStorage.getItem("nx_tab_id") || "", "") || `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  safe(() => sessionStorage.setItem("nx_tab_id", id), undefined);
  // gone: กำลังปิด/ออกจากหน้า — หยุดลงทะเบียน (เหตุการณ์ "ซ่อนแท็บ" ที่ตามมาตอนปิดต้องไม่ลงทะเบียนกลับ)
  let gone = false;
  const beat = () => {
    if (gone) return;
    const now = Date.now();
    const tabs = Object.fromEntries(Object.entries(readTabs()).filter(([, at]) => now - Number(at) < TAB_TTL));
    tabs[id] = now;
    writeTabs(tabs);
  };
  const leave = () => { gone = true; const tabs = readTabs(); delete tabs[id]; writeTabs(tabs); };
  beat();
  const timer = setInterval(beat, 15_000);
  const onShow = (e?: Event) => {
    if (e?.type === "pageshow") gone = false; // กลับมาจาก back/forward cache
    if (document.visibilityState === "visible") beat();
  };
  window.addEventListener("pagehide", leave);
  window.addEventListener("pageshow", onShow);
  document.addEventListener("visibilitychange", onShow);
  return () => { clearInterval(timer); window.removeEventListener("pagehide", leave); window.removeEventListener("pageshow", onShow); document.removeEventListener("visibilitychange", onShow); };
}

/** ออกจากระบบ: ล้างสถานะของแท็บนี้ (แท็บอื่นจะถูก Firebase ออกจากระบบตามกันอยู่แล้ว) */
export function clearTabSession() {
  safe(() => { sessionStorage.removeItem(TAB_FLAG); }, undefined);
}

/**
 * ปล่อยหน้าจอทิ้งไว้ 30 นาที (ไม่ขยับเมาส์/คีย์บอร์ด/แตะจอ ในทุกแท็บของระบบ) → ออกจากระบบอัตโนมัติ (ตัดสินใจ 2026-11-16)
 * เวลาใช้งานล่าสุดเก็บใน localStorage (nx_last_active) ร่วมกันทุกแท็บ — ทำงานอยู่แท็บหนึ่ง แท็บอื่นไม่หลุด
 * เตือนล่วงหน้า 2 นาที · เครื่องหลับ/พับจอนานเกิน 30 นาที กลับมาแล้วออกทันที
 */
export const IDLE_LIMIT = 30 * 60_000;
export const IDLE_WARN = 2 * 60_000;
const LAST_ACTIVE = "nx_last_active";
export const LOGOUT_REASON = "nx_logout_reason";

/**
 * เครื่อง POS (ตั้งที่เครื่องนั้นโดยผู้ดูแล: ขายหน้าร้าน › ตั้งค่าหน้าร้าน) — ทั้งเครื่องไม่ออกอัตโนมัติไม่ว่าเปิดหน้าไหน
 * เก็บใน localStorage ของเบราว์เซอร์เครื่องนั้น (ล้างข้อมูลเบราว์เซอร์ = ต้องตั้งใหม่)
 */
const POS_DEVICE = "nx_pos_device";
export function isPosDevice(): boolean {
  return safe(() => localStorage.getItem(POS_DEVICE) === "1", false);
}
export function setPosDevice(on: boolean) {
  safe(() => (on ? localStorage.setItem(POS_DEVICE, "1") : localStorage.removeItem(POS_DEVICE)), undefined);
}

/** ไม่ออกอัตโนมัติ: เครื่องที่ตั้งเป็นเครื่อง POS หรือกำลังเปิดหน้าขาย POS (ตัดสินใจ 2026-11-16) */
export function idleExempt(pathname: string | null | undefined): boolean {
  const p = String(pathname || "");
  return p === "/pos" || p.startsWith("/pos/") || isPosDevice();
}

export function lastActivity(): number {
  return safe(() => Number(localStorage.getItem(LAST_ACTIVE)) || 0, 0);
}
export function markActivity(now = Date.now()) {
  safe(() => localStorage.setItem(LAST_ACTIVE, String(now)), undefined);
}
/** เหลือเวลาอีกกี่ ms ก่อนออกอัตโนมัติ (ไม่เคยบันทึก = เต็มเวลา) */
export function idleRemaining(now = Date.now(), last = lastActivity()): number {
  if (!last) return IDLE_LIMIT;
  return Math.max(0, IDLE_LIMIT - (now - last));
}
