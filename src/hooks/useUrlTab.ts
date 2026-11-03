"use client";

import { useCallback, useEffect, useState } from "react";

const memoKey = (path: string, param: string) => `nexus:lastTab:${path}:${param}`;

/**
 * แท็บของหน้าที่จำไว้ใน URL (?tab=...) และจำแท็บล่าสุดของหน้านั้นไว้ในแท็บเบราว์เซอร์
 * - รีเฟรช / ส่งลิงก์ต่อ: เปิดแท็บตาม URL
 * - บันทึกเอกสารแล้วระบบพากลับมาที่โมดูล (เช่น /procurement ไม่มี ?tab): เปิดแท็บล่าสุดที่ใช้อยู่
 * - ค่าที่ไม่รู้จัก = ใช้ค่าเริ่มต้น · เปลี่ยนแท็บ = แก้ URL แบบ replace (ไม่เพิ่มประวัติย้อนกลับ)
 */
export function useUrlTab<T extends string>(defaultTab: T, isValid?: (t: string) => boolean, param = "tab"): [T, (t: T) => void] {
  const [tab, setTabState] = useState<T>(defaultTab);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const fromUrl = new URLSearchParams(window.location.search).get(param);
    let v = fromUrl;
    if (!v) { try { v = window.sessionStorage.getItem(memoKey(window.location.pathname, param)); } catch { v = null; } }
    if (v && (!isValid || isValid(v))) {
      setTabState(v as T);
      // แท็บที่จำไว้ (ไม่มีใน URL): ใส่ลง URL ให้รีเฟรชครั้งต่อไปตรงกัน
      if (!fromUrl && v !== defaultTab) {
        const url = new URL(window.location.href);
        url.searchParams.set(param, v);
        window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
      }
    }
    // อ่านครั้งเดียวตอนเปิดหน้า
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setTab = useCallback((t: T) => {
    setTabState(t);
    if (typeof window === "undefined") return;
    try { window.sessionStorage.setItem(memoKey(window.location.pathname, param), t); } catch { /* โหมดส่วนตัว: จำใน URL อย่างเดียว */ }
    const url = new URL(window.location.href);
    if (t === defaultTab) url.searchParams.delete(param); else url.searchParams.set(param, t);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, [defaultTab, param]);

  return [tab, setTab];
}
