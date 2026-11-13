import { NextResponse } from "next/server";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can, canViewCost } from "@/lib/permissions";
import { groupIdOfCompany } from "@/lib/company-group.server";
import { getProduct } from "@/lib/product-store.server";
import { catalogToProduct, searchCatalog } from "@/lib/supplier-catalog";
import { listCatalogs, loadCatalog } from "@/lib/supplier-catalog.server";

/**
 * แคตตาล็อกราคาผู้ขาย — POST /api/catalog { companyId, action, ... }
 *  list                     แคตตาล็อกที่มี (ชื่อ · จำนวน)
 *  search { q, key? }       ค้นในแคตตาล็อก (ทุนแสดงเฉพาะผู้เห็นต้นทุน) · บอกว่ารายการไหนมีเป็นสินค้าในระบบแล้ว
 *  adopt  { key, code }     ใช้รายการนี้: มีสินค้าที่ผูกรหัสนี้แล้ว → คืนสินค้าเดิม · ไม่มี → สร้างสินค้าใหม่ผ่าน /api/master-data
 * สินค้าที่สร้าง/ผูกจากแคตตาล็อกมี catalogCodes = ["{key}:{รหัสผู้ขาย}"] ไว้กันสร้างซ้ำ
 */
const str = (v: any, max = 200) => String(v ?? "").trim().slice(0, max);
const VIEW = ["sales:view", "procurement:view", "inventory:view"] as const;
const tag = (key: string, code: string) => `${key}:${code}`;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const companyId = str(body.companyId, 80);
    const user = await requireApiUser(request, companyId);
    if (!VIEW.some((p) => can(user.roles, p))) throw new ApiAuthError(403, "สิทธิ์การใช้งานไม่เพียงพอ");
    const groupId = await groupIdOfCompany(companyId);
    const action = str(body.action, 20);
    const seeCost = canViewCost(user.roles);

    if (action === "list") return NextResponse.json({ success: true, catalogs: await listCatalogs(groupId) });

    if (action === "search") {
      const q = str(body.q, 100);
      if (q.replace(/\s/g, "").length < 2) return NextResponse.json({ success: true, items: [] });
      const keys = body.key ? [str(body.key, 40)] : (await listCatalogs(groupId)).map((c) => c.key);
      const out: any[] = [];
      for (const key of keys) {
        const cat = await loadCatalog(groupId, key);
        if (!cat) continue;
        for (const it of searchCatalog(cat.items, q, 30)) out.push({ key, catalog: cat.meta.name, code: it.c, sku: it.s, name: it.n, brand: it.b, model: it.m, category: it.h || it.g, unit: it.u, service: it.t === "S", price: it.p, ...(seeCost ? { cost: it.k } : {}) });
      }
      const items = out.slice(0, 30);
      // รายการที่มีเป็นสินค้าแล้ว (อ่านเฉพาะสินค้าที่ตรง)
      const tags = items.map((x) => tag(x.key, x.code));
      const have = new Map<string, string>();
      for (let i = 0; i < tags.length; i += 30) {
        const snap = await adminDb.collection(`companies/${companyId}/products`).where("catalogCodes", "array-contains-any", tags.slice(i, i + 30)).get();
        for (const d of snap.docs) if (d.get("isDeleted") !== true) for (const t of d.get("catalogCodes") || []) have.set(t, d.id);
      }
      return NextResponse.json({ success: true, items: items.map((x) => ({ ...x, productId: have.get(tag(x.key, x.code)) || "" })) });
    }

    if (action === "adopt") {
      const key = str(body.key, 40), code = str(body.code, 120);
      const cat = await loadCatalog(groupId, key);
      const it = cat?.items.find((x) => x.c === code);
      if (!cat || !it) throw new ApiAuthError(404, "ไม่พบรายการนี้ในแคตตาล็อก");
      const existing = (await adminDb.collection(`companies/${companyId}/products`).where("catalogCodes", "array-contains", tag(key, code)).limit(5).get()).docs.find((d) => d.get("isDeleted") !== true);
      if (existing) {
        const h = await getProduct(companyId, existing.id);
        if (h) return NextResponse.json({ success: true, created: false, product: { ...h.data, id: h.id } });
      }
      // สร้างผ่าน /api/master-data (ตรวจสิทธิ์ · ห้ามซ้ำ · รหัสระบบ) — SKU/บาร์โค้ดชนกับของเดิม: ลองใหม่ด้วยรหัสอัตโนมัติ/ไม่ใส่บาร์โค้ด
      const data: Record<string, any> = { ...catalogToProduct(it, cat.meta), catalogCodes: [tag(key, code)] };
      const call = (d: Record<string, any>, autoSku: boolean) => fetch(new URL("/api/master-data", request.url), {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: request.headers.get("authorization") || "" },
        body: JSON.stringify({ companyId, action: "create", entity: "products", data: d, autoSku }),
      }).then(async (r) => ({ status: r.status, ...(await r.json().catch(() => ({}))) }));
      let r = await call(data, false);
      if (r.status === 409 && /บาร์โค้ด/.test(r.error || "")) { delete data.barcode; delete data.barcodes; r = await call(data, false); }
      if (r.status === 409 && /SKU|รหัสสินค้า/i.test(r.error || "")) { delete data.sku; delete data.productCode; r = await call(data, true); }
      if (r.status === 403) throw new ApiAuthError(403, "การเพิ่มสินค้าจากแคตตาล็อกต้องมีสิทธิ์เพิ่มสินค้า — ให้ฝ่ายคลัง/จัดซื้อเพิ่มให้");
      if (!r.success) throw new ApiAuthError(r.status >= 400 ? r.status : 500, r.error || "สร้างสินค้าไม่สำเร็จ");
      const id = r.id || r.data?.id;
      const h = id ? await getProduct(companyId, id) : null;
      return NextResponse.json({ success: true, created: true, product: h ? { ...h.data, id: h.id } : { ...data, id } });
    }

    return NextResponse.json({ success: false, error: "ไม่รู้จักคำสั่ง" }, { status: 400 });
  } catch (err: any) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    console.error("[CATALOG_API]", err);
    return NextResponse.json({ success: false, error: err.message || "ทำรายการไม่สำเร็จ" }, { status: 500 });
  }
}
