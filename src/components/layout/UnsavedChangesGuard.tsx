"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSystemDialog } from "@/context/DialogContext";
import { SAVED_EVENT } from "@/lib/api-client";

/**
 * เตือนก่อนออกจากฟอร์มที่ยังไม่ได้บันทึก (C-14) — ครอบทุกหน้าสร้าง/แก้ไขในที่เดียว ไม่ต้องแก้ทีละฟอร์ม
 * - ใช้กับหน้า …/new, หน้าที่มี ?edit= และหน้าแก้ไขใบเสนอราคา
 * - ผู้ใช้พิมพ์/เลือกค่าในเนื้อหาหน้า (<main>) = มีการแก้ที่ยังไม่บันทึก
 * - บันทึกสำเร็จ (apiFetch ตอบ ok) หรือเปลี่ยนหน้า = ล้างสถานะ
 * - ปิดแท็บ/รีโหลด: เบราว์เซอร์ถามเอง · กดลิงก์ในระบบ (เมนู ฯลฯ): ถามด้วยกล่องยืนยันของระบบ
 */
const isFormPage = (path: string, edit: string | null) =>
  /\/new$/.test(path) || !!edit || /^\/sales\/quotations\/[^/]+$/.test(path);

export default function UnsavedChangesGuard() {
  const pathname = usePathname() || "";
  const search = useSearchParams();
  const router = useRouter();
  const { showConfirm } = useSystemDialog();
  const active = isFormPage(pathname, search?.get("edit") ?? null);
  const dirty = useRef(false);

  // เปลี่ยนหน้า = เริ่มใหม่
  useEffect(() => { dirty.current = false; }, [pathname, search]);

  useEffect(() => {
    if (!active) return;
    const mark = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (e.isTrusted && t?.closest?.("main")) dirty.current = true;
    };
    const saved = () => { dirty.current = false; };
    const leave = (e: BeforeUnloadEvent) => {
      if (!dirty.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    const click = async (e: MouseEvent) => {
      if (!dirty.current || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
      e.preventDefault();
      e.stopPropagation();
      if (await showConfirm("ยังไม่ได้บันทึกข้อมูลในฟอร์มนี้ ออกจากหน้านี้หรือไม่? ข้อมูลที่กรอกไว้จะหาย", "ออกโดยไม่บันทึก")) {
        dirty.current = false;
        router.push(url.pathname + url.search + url.hash);
      }
    };
    document.addEventListener("input", mark, true);
    document.addEventListener("change", mark, true);
    document.addEventListener("click", click, true);
    window.addEventListener(SAVED_EVENT, saved);
    window.addEventListener("beforeunload", leave);
    return () => {
      document.removeEventListener("input", mark, true);
      document.removeEventListener("change", mark, true);
      document.removeEventListener("click", click, true);
      window.removeEventListener(SAVED_EVENT, saved);
      window.removeEventListener("beforeunload", leave);
    };
  }, [active, router, showConfirm]);

  return null;
}
