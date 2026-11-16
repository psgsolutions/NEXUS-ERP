import { apiFetch } from "@/lib/api-client";

/**
 * อัตราค่าแรงของช่าง/ผู้รับเหมา = รายการงานบริการ "[ค่าแรง] งาน (ชื่อช่าง)" ผูก subcontractorId
 * (เลือกได้ในสูตรงานบริการ ใบเสนอราคา และ BOQ) + บันทึกอัตราที่ subcontractor_rates (ประวัติ/อ้างอิงจัดซื้อ)
 * ใช้ทั้งหน้าเพิ่มช่างใหม่ และการ์ดอัตราค่าแรงในหน้าช่างที่มีอยู่แล้ว
 */
export interface LaborRateInput { serviceType: string; unit?: string; ratePerUnit: number; standardSellingPrice?: number; remarks?: string; itemCode?: string }

export const laborItemName = (serviceType: string, contractorName: string) => `[ค่าแรง] ${serviceType.trim()}${contractorName ? ` (${contractorName.trim()})` : ""}`;

async function post(url: string, body: any) {
  const res = await apiFetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || d.success === false) throw new Error(d.error || "บันทึกไม่สำเร็จ");
  return d;
}

export async function createLaborRate(companyId: string, contractor: { id: string; name: string }, rate: LaborRateInput): Promise<{ productId: string; sku: string }> {
  const cost = Math.max(0, Number(rate.ratePerUnit) || 0);
  if (!rate.serviceType.trim() || !(cost > 0)) throw new Error("กรุณาระบุชื่องานและอัตราค่าแรง");
  const sell = Number(rate.standardSellingPrice) || Math.ceil(cost / 0.8);
  const unit = rate.unit?.trim() || "จุด";
  const created = await post("/api/master-data", {
    companyId, action: "create", entity: "products", autoSku: !rate.itemCode,
    data: {
      ...(rate.itemCode ? { sku: rate.itemCode } : {}),
      name: laborItemName(rate.serviceType, contractor.name), category: "SERVICES", type: "SERVICE", itemType: "SERVICE", productType: "SERVICE",
      unit, costPrice: cost, price: sell, sellingPrice: sell, unitPrice: sell, pricing: { priceProject: sell, pricePOS: sell },
      subcontractorId: contractor.id, subcontractorName: contractor.name, whtRate: 3, isActive: true, lifecycleStatus: "ACTIVE",
      ...(rate.remarks ? { notes: rate.remarks } : {}),
    },
  });
  await post("/api/procurement/subcontractor-rates", {
    companyId, action: "create",
    rate: { subcontractorId: contractor.id, subcontractorName: contractor.name, itemCode: created.sku || created.id, serviceType: rate.serviceType.trim(), unit, ratePerUnit: cost, standardSellingPrice: sell, remarks: rate.remarks || "" },
  });
  return { productId: created.id, sku: created.sku || "" };
}

/** แก้อัตรา/ราคาขายของรายการค่าแรงที่มีอยู่ */
export async function updateLaborRate(companyId: string, productId: string, patch: { ratePerUnit?: number; standardSellingPrice?: number; unit?: string }) {
  const changes: Record<string, any> = {};
  if (patch.ratePerUnit !== undefined) changes.costPrice = Math.max(0, Number(patch.ratePerUnit) || 0);
  if (patch.standardSellingPrice !== undefined) {
    const s = Math.max(0, Number(patch.standardSellingPrice) || 0);
    Object.assign(changes, { price: s, sellingPrice: s, unitPrice: s, pricing: { priceProject: s, pricePOS: s } });
  }
  if (patch.unit) changes.unit = patch.unit;
  return post("/api/master-data", { companyId, action: "update", entity: "products", id: productId, scope: "company", changes });
}
