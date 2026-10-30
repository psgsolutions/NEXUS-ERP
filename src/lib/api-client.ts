import { auth } from "./firebase-client";

/**
 * fetch() สำหรับเรียก API ภายใน (/api/...) โดยแนบ Firebase ID token ของผู้ใช้ปัจจุบันไปด้วย
 * API route ตรวจด้วย requireApiUser() ใน api-auth.ts
 */
/** บันทึกผ่าน API สำเร็จ — ตัวเตือนฟอร์มยังไม่บันทึก (UnsavedChangesGuard) ฟังเพื่อล้างสถานะ
 *  ไม่นับ AI อ่านเอกสาร/สร้าง PDF/ค้นข้อมูล ซึ่งเป็น POST แต่ไม่ได้บันทึกฟอร์ม */
export const SAVED_EVENT = "nexus:saved";
const NOT_A_SAVE = /^\/api\/(ai\/|documents\/(pdf|history)|health)/;

export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = await auth.currentUser?.getIdToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(input, { ...init, headers });
  if (res.ok && init.method && init.method.toUpperCase() !== "GET" && !NOT_A_SAVE.test(input) && typeof window !== "undefined") {
    window.dispatchEvent(new Event(SAVED_EVENT));
  }
  return res;
}
