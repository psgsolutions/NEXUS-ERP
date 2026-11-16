/**
 * รหัสผ่านเริ่มต้นของบัญชีพนักงาน = "0000" (ตัดสินใจ 2026-11-16) — ใช้ได้ครั้งเดียว ระบบบังคับตั้งรหัสใหม่ทันทีที่เข้าระบบ
 * Firebase บังคับรหัสผ่านอย่างน้อย 6 ตัว จึงเก็บใน Firebase เป็น INITIAL_PASSWORD_AUTH แล้วหน้าล็อกอินแปลง "0000" ให้
 * (รหัสที่ผู้ใช้ตั้งเองต้องยาวอย่างน้อย 8 ตัว จึงไม่มีทางชนกับ "0000")
 * ข้อควรระวัง: ทุกคนรู้รหัสเริ่มต้นนี้ — แจ้งพนักงานให้เข้าระบบและตั้งรหัสใหม่ทันทีหลังสร้างบัญชี/รีเซ็ต
 */
export const INITIAL_PASSWORD = "0000";
export const INITIAL_PASSWORD_AUTH = "0000-nexus-first-login";

/** รหัสที่ส่งให้ Firebase ตอนล็อกอิน */
export const authPassword = (typed: string) => (typed === INITIAL_PASSWORD ? INITIAL_PASSWORD_AUTH : typed);
