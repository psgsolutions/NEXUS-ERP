import { adminDb } from "@/lib/firebase-admin";
import { listProducts } from "@/lib/product-store.server";
import { listRecords } from "@/lib/master-store.server";
import { notify } from "@/lib/notifications.server";
import { latestLotSupplier, reorderSuggestions, type ReorderLine } from "@/lib/reorder";

/**
 * รายการแนะนำสั่งซื้อของบริษัท (ใช้ร่วมกัน: หน้าสั่งซื้อตามจุดสั่งซื้อ · สร้างใบขอซื้อ/ใบสั่งซื้อ · แจ้งเตือนรายวัน)
 * includeUnset: รวมสินค้าที่ยังไม่ตั้งจุดสั่งซื้อแต่หมดสต็อกและเคยมีของ (มี Lot)
 * ชื่อผู้ขายเติมจากทะเบียนผู้ขาย (supplierConfig เก็บแค่รหัส)
 */
export async function loadReorder(companyId: string, opts: { includeUnset?: boolean } = {}): Promise<ReorderLine[]> {
  const [products, prs, pos, lots, suppliers] = await Promise.all([
    listProducts(companyId),
    adminDb.collection(`companies/${companyId}/purchase_requests`).where("status", "in", ["PENDING_APPROVAL", "APPROVED"]).get(),
    adminDb.collection(`companies/${companyId}/purchase_orders`).get(),
    adminDb.collection(`companies/${companyId}/stock_lots`).select("productId", "supplierId", "supplierName", "receivedDate", "lotNo", "unitCost", "isDeleted").get(),
    listRecords("suppliers", companyId),
  ]);
  const lotDocs = lots.docs.map((d) => d.data());
  const names = new Map(suppliers.filter((s: any) => s.isDeleted !== true).map((s: any) => [String(s.id), String(s.name || s.supplierName || s.companyName || "")]));
  return reorderSuggestions(products, prs.docs.map((d) => d.data()), pos.docs.map((d) => d.data()), {
    includeUnset: !!opts.includeUnset,
    everStocked: new Set(lotDocs.map((l) => String(l.productId || "")).filter(Boolean)),
    lotSupplier: latestLotSupplier(lotDocs),
  }).map((l) => (l.supplierId && names.has(l.supplierId) ? { ...l, supplierName: names.get(l.supplierId) || l.supplierName } : l.supplierId && !names.has(l.supplierId) && l.supplierSource === "lot" ? { ...l, supplierId: "" } : l));
}

/**
 * งานประจำวัน: สินค้าถึงจุดสั่งซื้อ → แจ้งเตือนฝ่ายจัดซื้อ/คลัง (วันละครั้งต่อบริษัท) พร้อมลิงก์ไปสร้างใบขอซื้อ
 * ไม่สร้างใบขอซื้อเอง — ให้คนตรวจจำนวนก่อน (ใบขอซื้อยังต้องอนุมัติตามขั้นตอน)
 */
export async function runReorderAlerts(opts: { today: string; companyIds?: string[] }) {
  const companies = opts.companyIds || (await adminDb.collection("companies").select().get()).docs.map((d) => d.id);
  const out: { companyId: string; items: number }[] = [];
  for (const companyId of companies) {
    try {
      const lines = await loadReorder(companyId);
      if (!lines.length) continue;
      const names = lines.slice(0, 3).map((l) => l.name).join(", ");
      await notify(companyId, {
        type: "REORDER_POINT",
        title: `สินค้าถึงจุดสั่งซื้อ ${lines.length} รายการ`,
        message: `${names}${lines.length > 3 ? ` และอีก ${lines.length - 3} รายการ` : ""} — ตรวจจำนวนแล้วสร้างใบขอซื้อ`,
        link: "/procurement/reorder",
        targetRoles: ["PURCHASING", "WAREHOUSE"],
        dedupeKey: `reorder-${opts.today}`,
      });
      out.push({ companyId, items: lines.length });
    } catch (err) {
      console.error("[REORDER_ALERT]", companyId, err);
    }
  }
  return { companies: out.length, alerts: out };
}
