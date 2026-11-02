"use client";

import React, { useState } from "react";
import { Trash2 } from "lucide-react";
import { PillButton } from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { useSystemDialog } from "@/context/DialogContext";
import { apiFetch } from "@/lib/api-client";
import { can, type Permission } from "@/lib/permissions";

/**
 * ปุ่มลบข้อมูลหลักในหน้ารายละเอียด (ลูกค้า ผู้ขาย สินค้า พนักงาน)
 *  - ลบได้เมื่อยังไม่ถูกใช้ในเอกสาร (server ตรวจ) — ถูกใช้แล้ว แจ้งเหตุผลให้ตั้งระงับใช้งาน/ลาออกแทน
 *  - สิทธิ์: สิทธิ์ลบของชนิดนั้น หรือรายการที่นำเข้าจาก Excel ใช้สิทธิ์เดียวกับการนำเข้า (ตรงกับ /api/master-data)
 *  - สินค้าที่มีแค่ยอดยกมา: ระบบกลับรายการยอดยกมาให้
 */
type Kind = "customers" | "suppliers" | "products" | "employees";

const PERMS: Record<Kind, { remove: Permission; imported: Permission; label: string }> = {
  customers: { remove: "sales:delete", imported: "sales:edit", label: "ลูกค้า" },
  suppliers: { remove: "procurement:edit", imported: "procurement:edit", label: "ผู้ขาย" },
  products: { remove: "inventory:delete", imported: "inventory:edit", label: "สินค้า" },
  employees: { remove: "hr:edit", imported: "hr:edit", label: "พนักงาน" },
};

export function RecordDeleteButton({ kind, id, name, record, onDeleted, className }: {
  kind: Kind;
  id: string;
  name: string;
  record?: Record<string, any> | null;
  onDeleted: () => void;
  className?: string;
}) {
  const { roles, companyId } = useAuth();
  const { showConfirm, showAlert } = useSystemDialog();
  const [busy, setBusy] = useState(false);
  const p = PERMS[kind];
  const allowed = can(roles, p.remove) || (record?.importedFrom === "excel" && can(roles, p.imported));
  if (!allowed || !id) return null;

  const post = async (url: string, body: Record<string, any>) => {
    const res = await apiFetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, ...body }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || d.success === false) throw new Error(d.error || "ลบไม่สำเร็จ");
    return d;
  };

  const remove = async () => {
    const extra = kind === "products" ? " ถ้ามีแค่ยอดยกมา ระบบกลับรายการยอดยกมาให้" : kind === "employees" ? " (ต้องยังไม่มีประวัติลงเวลา/เงินเดือน)" : "";
    if (!(await showConfirm(`ลบ${p.label} "${name}"? — ลบได้เมื่อยังไม่ถูกใช้ในเอกสาร${extra} · ลบแล้วเลขผู้เสียภาษี/รหัสนำมาใช้ใหม่ได้`))) return;
    setBusy(true);
    try {
      if (kind === "employees") await post("/api/hr/employees", { action: "delete", employeeDocId: id });
      else {
        const d = await post("/api/master-data", { action: "remove", entity: kind, id });
        // ผู้ขายมีผู้รับเหมารหัสเดียวกัน (สร้างคู่กันตอนนำเข้า/เพิ่มผู้ขาย)
        if (kind === "suppliers") await post("/api/master-data", { action: "remove", entity: "contractors", id }).catch(() => undefined);
        if (d.reversedOpeningQty) await showAlert(`ลบแล้ว และกลับรายการยอดยกมา ${d.reversedOpeningQty} หน่วย`, "ลบข้อมูล", "info");
      }
      onDeleted();
    } catch (err: any) {
      await showAlert(err.message, "ลบไม่ได้", "warning");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PillButton variant="danger" onClick={remove} disabled={busy} className={className || "h-9 px-4 text-xs"}>
      <Trash2 size={14} /> {busy ? "กำลังลบ…" : "ลบข้อมูล"}
    </PillButton>
  );
}
