import { auth } from "./firebase-client";

/**
 * fetch() สำหรับเรียก API ภายใน (/api/...) โดยแนบ Firebase ID token ของผู้ใช้ปัจจุบันไปด้วย
 * API route ตรวจด้วย requireApiUser() ใน api-auth.ts
 */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = await auth.currentUser?.getIdToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(input, { ...init, headers });
}
