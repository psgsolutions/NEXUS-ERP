import { adminDb } from "@/lib/firebase-admin";
import { listProducts } from "@/lib/product-store.server";
import { notify } from "@/lib/notifications.server";
import { reorderSuggestions } from "@/lib/reorder";

/**
 * งานประจำวัน: สินค้าถึงจุดสั่งซื้อ → แจ้งเตือนฝ่ายจัดซื้อ/คลัง (วันละครั้งต่อบริษัท) พร้อมลิงก์ไปสร้างใบขอซื้อ
 * ไม่สร้างใบขอซื้อเอง — ให้คนตรวจจำนวนก่อน (ใบขอซื้อยังต้องอนุมัติตามขั้นตอน)
 */
export async function runReorderAlerts(opts: { today: string; companyIds?: string[] }) {
  const companies = opts.companyIds || (await adminDb.collection("companies").select().get()).docs.map((d) => d.id);
  const out: { companyId: string; items: number }[] = [];
  for (const companyId of companies) {
    try {
      const [products, prs, pos] = await Promise.all([
        listProducts(companyId),
        adminDb.collection(`companies/${companyId}/purchase_requests`).where("status", "in", ["PENDING_APPROVAL", "APPROVED"]).get(),
        adminDb.collection(`companies/${companyId}/purchase_orders`).get(),
      ]);
      const lines = reorderSuggestions(products, prs.docs.map((d) => d.data()), pos.docs.map((d) => d.data()));
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
