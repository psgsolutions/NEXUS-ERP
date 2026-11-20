import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can, canViewCost } from "@/lib/permissions";
import { groupIdOfCompany } from "@/lib/company-group.server";
import { auditServer } from "@/services/audit.server";
import { matchCandidates, refCostPerBase, sameUnit, type RefPriceRow, type RefStatus } from "@/lib/ref-prices";

/**
 * ราคากลาง (BOM) — POST /api/inventory/ref-prices { companyId, action, ... }
 *  list                                  สินค้าที่มีรหัสราคากลาง (bomCode) พร้อมราคากลาง/ต้นทุนจริง (ผู้เห็นต้นทุน)
 *  match { rows }                        เสนอสินค้าเดิมที่น่าจะตรงกับแต่ละรายการ (ให้คนตรวจก่อนบันทึก)
 *  apply { items: [{ row, productId, per }] }   ผูกรหัส + บันทึกราคากลางที่สินค้า (per = หน่วยในราคากลางต่อ 1 หน่วยหลัก)
 *  setRef { productId, refCost?, status?, source? }  แก้ราคากลางรายตัว
 * เขียนเฉพาะข้อมูลของบริษัท (companies/{id}/products) · ต้องมีสิทธิ์ inventory:edit
 */
const str = (v: any, max = 300) => String(v ?? "").trim().slice(0, max);
const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const ST = (v: any): RefStatus => (v === "WEB" || v === "Y" ? v : "");

async function companyProducts(companyId: string) {
  const groupId = await groupIdOfCompany(companyId);
  const [loc, grp] = await Promise.all([adminDb.collection(`companies/${companyId}/products`).get(), adminDb.collection(`groups/${groupId}/products`).get()]);
  const g = new Map(grp.docs.map((d) => [d.id, d.data()]));
  return loc.docs.map((d) => ({ id: d.id, ...(g.get(d.id) || {}), ...d.data() } as any)).filter((p) => p.isDeleted !== true);
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const companyId = str(body.companyId, 80);
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const user = await requireApiUser(request, companyId);
    if (!canViewCost(user.roles) && !can(user.roles, "inventory:edit")) throw new ApiAuthError(403, "ต้องมีสิทธิ์ดูต้นทุนหรือแก้ไขคลังสินค้า");
    const action = str(body.action, 20);
    const edit = () => { if (!can(user.roles, "inventory:edit")) throw new ApiAuthError(403, "ต้องมีสิทธิ์แก้ไขคลังสินค้า"); };
    const col = adminDb.collection(`companies/${companyId}/products`);

    if (action === "list") {
      const items = (await companyProducts(companyId)).filter((p) => str(p.bomCode, 40)).map((p) => ({
        productId: p.id, sku: str(p.sku, 80), name: str(p.name), unit: str(p.unit, 20), itemType: str(p.itemType || "PRODUCT", 20), bomCode: str(p.bomCode, 40),
        refCost: num(p.refCost), refCostUnit: str(p.refCostUnit, 20), refCostPer: num(p.refCostPer) || 1, refCostStatus: ST(p.refCostStatus), refCostSource: str(p.refCostSource, 500),
        refCostCategory: str(p.refCostCategory, 60), wac: num(p.pricing?.costWAC ?? p.costPrice), lifecycleStatus: str(p.lifecycleStatus, 20),
      })).sort((a, b) => a.bomCode.localeCompare(b.bomCode));
      return NextResponse.json({ success: true, items });
    }

    if (action === "match") {
      edit();
      const rows: RefPriceRow[] = (Array.isArray(body.rows) ? body.rows : []).slice(0, 2000);
      const products = await companyProducts(companyId);
      const result = rows.map((r) => ({ code: str(r.code, 40), candidates: matchCandidates({ ...r, code: str(r.code, 40) }, products, 5) }));
      return NextResponse.json({ success: true, result, products: products.length });
    }

    if (action === "apply") {
      edit();
      const items: any[] = (Array.isArray(body.items) ? body.items : []).slice(0, 2000);
      const products = await companyProducts(companyId);
      const byId = new Map(products.map((p) => [p.id, p]));
      const now = new Date().toISOString();
      let linked = 0, unlinked = 0;
      const codes = new Set<string>();
      let batch = adminDb.batch(), n = 0;
      const flush = async () => { if (n) { await batch.commit(); batch = adminDb.batch(); n = 0; } };
      for (const it of items) {
        const r = it?.row || {}, code = str(r.code, 40), pid = str(it?.productId, 120);
        if (!code || !pid || pid.includes("/") || codes.has(code)) continue;
        const p = byId.get(pid);
        if (!p) continue;
        codes.add(code);
        const per = num(it?.per) > 0 ? num(it.per) : 1;
        const unit = str(r.unit, 20);
        const subUnits = per !== 1 && unit && !sameUnit(unit, p.unit)
          ? [...(Array.isArray(p.subUnits) ? p.subUnits : []).filter((x: any) => x?.unit !== unit), { unit, perBase: per }].slice(0, 10) : undefined;
        batch.set(col.doc(pid), {
          bomCode: code, refCost: refCostPerBase(num(r.cost), per), refCostUnit: unit, refCostPer: per, refCostStatus: ST(r.status),
          refCostSource: str(r.source, 500), refCostCategory: str(r.category, 60), refCostAt: now, refCostBy: user.email || user.uid,
          ...(subUnits ? { subUnits } : {}), updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        n++; linked++;
        // รหัสเดียวกันที่เคยผูกกับสินค้าอื่น → ถอดออก
        for (const o of products) if (o.id !== pid && str(o.bomCode, 40) === code) { batch.set(col.doc(o.id), { bomCode: "", updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true }); n++; unlinked++; }
        if (n >= 400) await flush();
      }
      await flush();
      await auditServer.logUpdate(user.uid, companyId, "REF_PRICES", "ref_prices", {}, { linked, unlinked });
      return NextResponse.json({ success: true, linked, unlinked });
    }

    if (action === "setRef") {
      edit();
      const pid = str(body.productId, 120);
      if (!pid || pid.includes("/")) throw new ApiAuthError(400, "ไม่พบสินค้า");
      const ref = col.doc(pid);
      if (!(await ref.get()).exists) throw new ApiAuthError(404, "ไม่พบสินค้า");
      const patch: Record<string, any> = { refCostAt: new Date().toISOString(), refCostBy: user.email || user.uid, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
      if (body.refCost !== undefined) patch.refCost = Math.max(0, Math.round(num(body.refCost) * 10000) / 10000);
      if (body.status !== undefined) patch.refCostStatus = ST(body.status);
      if (body.source !== undefined) patch.refCostSource = str(body.source, 500);
      await ref.set(patch, { merge: true });
      await auditServer.logUpdate(user.uid, companyId, "REF_PRICES", pid, {}, patch);
      return NextResponse.json({ success: true });
    }
    throw new ApiAuthError(400, "ไม่รู้จักคำสั่ง");
  } catch (err: any) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    console.error("[REF_PRICES_API_ERROR]", err);
    return NextResponse.json({ success: false, error: "ดำเนินการราคากลางไม่สำเร็จ" }, { status: 500 });
  }
}
