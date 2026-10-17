"use client";

import React, { useState } from "react";
import { AlertTriangle, Trash2, X, ShieldAlert } from "lucide-react";
import { PillButton, PillInput, Modal, cn } from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { auditService } from "@/services/audit.service";
import { doc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase-client";
import { useSystemDialog } from "@/context/DialogContext";
import { apiFetch } from "@/lib/api-client";
import { can, type Permission } from "@/lib/permissions";

/** เอกสารที่ต้องลบผ่าน server (ตรวจเอกสารอ้างอิงและคืนสถานะเอกสารต้นทางในทรานแซกชันเดียว) */
export type ServerDeleteKind = "purchase_order" | "expense" | "wht" | "sales_order";

/** สิทธิ์ที่ต้องมีเพื่อลบเอกสาร (ตรงกับ /api/documents/delete) */
function deletePermission(kind?: ServerDeleteKind, collectionName?: string): Permission {
  if (kind) return kind === "sales_order" ? "sales:delete" : "finance:delete";
  const col = String(collectionName || "").split("/").pop() || "";
  if (["customers", "quotations", "sales_orders"].includes(col)) return "sales:delete";
  if (["invoices", "expenses", "withholding_taxes", "purchase_orders"].includes(col)) return "finance:delete";
  if (["products", "warehouses"].includes(col)) return "inventory:delete";
  if (col === "projects") return "projects:delete";
  return "settings:manage";
}

interface SecureDeleteActionProps {
  collectionName?: string;
  /** ระบุเมื่อเอกสารต้องลบผ่าน /api/documents/delete */
  serverKind?: ServerDeleteKind;
  documentId: string;
  displayName: string;
  onSuccess?: () => void;
  className?: string;
  compact?: boolean;
}

export function SecureDeleteAction({
  collectionName,
  serverKind,
  documentId,
  displayName,
  onSuccess,
  className,
  compact = false
}: SecureDeleteActionProps) {
  const { roles, companyId, user } = useAuth();
  const { showAlert } = useSystemDialog();
  const [isOpen, setIsOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // ลบได้ตามสิทธิ์ของประเภทเอกสาร (server ตรวจซ้ำอีกชั้น)
  const canDelete = can(roles, deletePermission(serverKind, collectionName));

  if (!canDelete) return null;

  const handleDelete = async () => {
    if (confirmText !== "DELETE") {
      await showAlert(`คำยืนยันไม่ถูกต้อง (ต้องพิมพ์: DELETE)`, "แจ้งเตือน", "warning");
      return;
    }

    if (!companyId || !user) {
      await showAlert("ข้อมูลเซสชันไม่สมบูรณ์ ไม่สามารถทำรายการได้", "แจ้งเตือน", "error");
      return;
    }

    setIsDeleting(true);
    try {
      if (serverKind) {
        const res = await apiFetch("/api/documents/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyId, kind: serverKind, id: documentId }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || "ลบไม่สำเร็จ");
      } else {
        if (!collectionName) throw new Error("ไม่พบตำแหน่งเอกสาร");
        await deleteDoc(doc(db, collectionName, documentId));

      // Audit Logging
        await auditService.logDelete(user.uid, companyId, `DELETE_${collectionName.toUpperCase()}`, documentId);
      }

      setIsOpen(false);
      setConfirmText("");
      if (onSuccess) onSuccess();
      
      await showAlert(`ลบข้อมูล ${displayName} ออกจากระบบแล้ว`, "แจ้งเตือน", "info");
    } catch (err: any) {
      console.error("Delete Error:", err);
      await showAlert(`ไม่สามารถลบข้อมูลได้: ${err.message}`, "แจ้งเตือน", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <PillButton 
        onClick={() => setIsOpen(true)}
        className={cn(
          "bg-danger/10 text-danger border-danger/20 hover:bg-danger/20 hover:border-danger/40 transition-all",
          compact ? "h-8 px-3 text-xs" : "",
          className
        )}
      >
        <Trash2 size={compact ? 14 : 16} className={compact ? "" : "mr-2"} />
        {!compact && "ลบข้อมูล"}
      </PillButton>

      <Modal 
        isOpen={isOpen} 
        onClose={() => !isDeleting && setIsOpen(false)}
        title="ยืนยันการลบข้อมูล"
        maxWidth="max-w-[500px]"
      >
        <div className="p-8 space-y-6">
          <div className="p-6 rounded-2xl bg-danger/10 border border-danger/20 flex flex-col items-center justify-center text-center space-y-4">
             <ShieldAlert size={48} className="text-danger animate-pulse" />
             <div className="space-y-1">
                <h4 className="text-lg font-semibold text-danger uppercase">Danger Zone</h4>
                <p className="text-sm font-bold text-danger/80 leading-relaxed">
                   การลบข้อมูลนี้จะเป็นการลบข้อมูลออกจากฐานข้อมูลถาวร ไม่สามารถกู้คืนได้
                </p>
             </div>
          </div>

          <div className="space-y-4">
            <p className="text-sm font-bold text-white/80">
              คุณกำลังจะลบข้อมูล: <span className="text-nexus-teal">{displayName}</span>
            </p>
            <div className="space-y-2">
              <label className="text-[11px] font-medium text-white/40 uppercase tracking-widest">
                เพื่อยืนยัน กรุณาพิมพ์: <span className="text-white bg-white/10 px-1 py-0.5 rounded select-all">DELETE</span>
              </label>
              <PillInput 
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="พิมพ์ DELETE ที่นี่..."
                className="w-full font-mono text-center text-danger border-danger/30 focus:border-danger"
                disabled={isDeleting}
              />
            </div>
          </div>

          <div className="pt-4 flex gap-4">
            <PillButton 
              className="flex-1 bg-danger border-danger shadow-neon-blue"
              style={{ boxShadow: '0 0 15px rgba(239, 68, 68, 0.4)' }}
              onClick={handleDelete}
              disabled={isDeleting || confirmText !== "DELETE"}
             variant="confirm">ยืนยัน</PillButton>
            <PillButton 
              variant="ghost" 
              className="flex-1"
              onClick={() => setIsOpen(false)}
              disabled={isDeleting}
            >
              ยกเลิก
            </PillButton>
          </div>
        </div>
      </Modal>
    </>
  );
}
