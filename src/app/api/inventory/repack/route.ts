import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { auditServer } from "@/services/audit.server";
import { getProduct } from "@/lib/product-store.server";
import { isStockItem } from "@/lib/product-kind";
import { prepareSequence } from "@/lib/sequence-server";
import { processStockMovements, type StockMovement } from "@/lib/stock-service";
import { normalizePackOf, planRepack, repackShares } from "@/lib/repack";

/**
 * แบ่งบรรจุ (แบ่งขาย) — POST /api/inventory/repack { companyId, action }
 *  list                       ใบแบ่งบรรจุล่าสุด 50 ใบ
 *  run { sourceId, sourceQty, piecesPerSource, pieceUnit, packProductId, packSize, packs, remainderMode, looseProductId?, location?, note? }
 *     ตัดสินค้าต้นทาง (ไม่ลงต้นทุนขาย) + รับห่อเล็ก (และเศษแยกชิ้น) เข้าในทรานแซกชันเดียว
 *     ต้นทุนห่อ = ต้นทุนจริงของที่แกะ × สัดส่วนชิ้น ÷ จำนวนห่อ (มูลค่าคลังรวมเท่าเดิม) · บันทึก companies/{id}/repacks/{RP-…}
 * ต้องมีสิทธิ์ inventory:edit
 */
const str = (v: any, max = 200) => String(v ?? "").trim().slice(0, max);
const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const id = (v: any) => { const x = str(v, 120); return x && !x.includes("/") ? x : ""; };

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const companyId = str(body.companyId, 80);
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const user = await requireApiUser(request, companyId);
    if (!can(user.roles, "inventory:edit")) throw new ApiAuthError(403, "ต้องมีสิทธิ์แก้ไขคลังสินค้า");
    const action = str(body.action, 20);
    const col = adminDb.collection(`companies/${companyId}/repacks`);

    if (action === "list") {
      const snap = await col.orderBy("createdAt", "desc").limit(50).get();
      return NextResponse.json({ success: true, items: snap.docs.map((d) => { const x = d.data(); return { ...x, createdAt: x.createdAt?.toDate?.().toISOString?.() || "" }; }) });
    }
    if (action !== "run") throw new ApiAuthError(400, "ไม่รู้จักคำสั่ง");

    const sourceId = id(body.sourceId), packId = id(body.packProductId), looseId = id(body.looseProductId);
    const pieceUnit = str(body.pieceUnit, 20) || "ชิ้น";
    const plan = planRepack({ sourceQty: num(body.sourceQty), piecesPerSource: num(body.piecesPerSource), packSize: num(body.packSize), packs: body.packs === undefined ? undefined : num(body.packs), remainderMode: body.remainderMode === "loose" ? "loose" : "waste" });
    if (plan.errors.length) throw new ApiAuthError(400, plan.errors.join(" · "));
    if (!sourceId || !packId) throw new ApiAuthError(400, "เลือกสินค้าต้นทางและสินค้าห่อเล็ก");
    if (sourceId === packId || sourceId === looseId) throw new ApiAuthError(400, "สินค้าห่อเล็ก/แยกชิ้นต้องเป็นคนละรายการกับสินค้าต้นทาง");
    const needLoose = plan.remainder > 0 && plan.remainderMode === "loose";
    if (needLoose && !looseId) throw new ApiAuthError(400, "เลือกสินค้าแยกชิ้นสำหรับเก็บเศษ");
    if (needLoose && looseId === packId) throw new ApiAuthError(400, "สินค้าแยกชิ้นต้องเป็นคนละรายการกับห่อเล็ก");

    const [src, pack, loose] = await Promise.all([getProduct(companyId, sourceId), getProduct(companyId, packId), needLoose ? getProduct(companyId, looseId) : Promise.resolve(null)]);
    if (!src || src.data.isDeleted) throw new ApiAuthError(404, "ไม่พบสินค้าต้นทาง");
    if (!pack || pack.data.isDeleted) throw new ApiAuthError(404, "ไม่พบสินค้าห่อเล็ก");
    if (needLoose && (!loose || loose.data.isDeleted)) throw new ApiAuthError(404, "ไม่พบสินค้าแยกชิ้น");
    for (const p of [src, pack, ...(needLoose ? [loose!] : [])]) if (!isStockItem(p.data)) throw new ApiAuthError(400, `${p.data.name || p.id} เป็นงานบริการ ไม่มีสต็อก`);
    const onHand = num(src.data.stockStatus?.onHand);
    if (onHand < num(body.sourceQty)) throw new ApiAuthError(400, `สต็อก ${src.data.name} ไม่พอ (คงเหลือ ${onHand} ${src.data.unit || ""})`);
    // ห่อเล็กต้องผูกกับสินค้าต้นทางนี้และขนาดเดียวกัน (ยังไม่ผูก = ผูกให้ตอนนี้)
    const packOf = normalizePackOf(pack.data.packOf);
    if (packOf && (packOf.productId !== sourceId || packOf.pieces !== num(body.packSize))) throw new ApiAuthError(400, `${pack.data.name} ผูกกับสินค้าอื่น/ขนาดอื่นอยู่แล้ว (${packOf.pieces} ${packOf.pieceUnit})`);
    const looseOf = needLoose ? normalizePackOf(loose!.data.packOf) : null;
    if (looseOf && (looseOf.productId !== sourceId || looseOf.pieces !== 1)) throw new ApiAuthError(400, `${loose!.data.name} ผูกกับสินค้าอื่นอยู่แล้ว`);

    const { packShare, looseShare } = repackShares(plan);
    const location = str(body.location, 80);
    const note = str(body.note, 500);
    const lotInfo = { source: "REPACK" as const, supplierName: str(src.data.name, 200) };
    const movements: StockMovement[] = [
      { companyId, userId: user.uid, productId: sourceId, type: "OUT", quantity: num(body.sourceQty), skipGl: true, partyName: "แบ่งบรรจุ", ...(location ? { fromLocation: location } : {}) },
      ...(plan.packs > 0 ? [{ companyId, userId: user.uid, productId: packId, type: "IN" as const, quantity: plan.packs, costFrom: { index: 0, share: packShare }, partyName: "แบ่งบรรจุ", lotInfo: { ...lotInfo }, ...(location ? { toLocation: location } : {}) }] : []),
      ...(needLoose ? [{ companyId, userId: user.uid, productId: looseId, type: "IN" as const, quantity: plan.remainder, costFrom: { index: 0, share: looseShare }, partyName: "แบ่งบรรจุ", lotInfo: { ...lotInfo }, ...(location ? { toLocation: location } : {}) }] : []),
    ];
    const take = await prepareSequence("RP", companyId);
    let rpNo = "";
    const held: { seq?: Awaited<ReturnType<typeof take>> } = {};
    let result: Record<string, any> = {};
    await processStockMovements(movements, async (tx, applied) => {
      held.seq!.commit();
      const packIdx = plan.packs > 0 ? 1 : -1, looseIdx = needLoose ? movements.length - 1 : -1;
      const line = (p: any, i: number, qty: number, unit: string, extra: Record<string, any> = {}) => ({
        productId: p.id, sku: str(p.data.sku, 80), name: str(p.data.name, 300), unit, qty, unitCost: applied.unitCosts[i] ?? 0, lotNo: applied.lotNos[i] || "", movementId: applied.transactionIds[i] || "", ...extra,
      });
      result = {
        rpNo, companyId, date: new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10), status: "done",
        source: { ...line(src, 0, num(body.sourceQty), str(src.data.unit, 20)), piecesPerSource: num(body.piecesPerSource) },
        pieceUnit, totalPieces: plan.totalPieces, totalCost: Math.round((applied.totalValues[0] || 0) * 100) / 100,
        pack: packIdx > 0 ? line(pack, packIdx, plan.packs, str(pack.data.unit, 20) || "ถุง", { packSize: num(body.packSize) }) : null,
        loose: looseIdx > 0 ? line(loose, looseIdx, plan.remainder, str(loose!.data.unit, 20) || pieceUnit) : null,
        remainder: plan.remainder, remainderMode: plan.remainderMode, location, note,
        createdBy: user.uid, createdByEmail: user.email || "", createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      tx.set(col.doc(rpNo), result);
      // จำการผูกห่อเล็ก/แยกชิ้นกับสินค้าต้นทาง และจำนวนชิ้นต่อหน่วยต้นทาง (ครั้งหน้ากรอกให้)
      tx.set(adminDb.doc(`companies/${companyId}/products/${packId}`), { packOf: { productId: sourceId, pieces: num(body.packSize), pieceUnit }, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      if (needLoose) tx.set(adminDb.doc(`companies/${companyId}/products/${looseId}`), { packOf: { productId: sourceId, pieces: 1, pieceUnit }, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      tx.set(adminDb.doc(`companies/${companyId}/products/${sourceId}`), { repackPieces: num(body.piecesPerSource), pieceUnit, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    }, async (tx) => {
      held.seq = await take(tx);
      rpNo = held.seq.number;
      for (const m of movements) { m.referenceId = rpNo; if (m.lotInfo) m.lotInfo.poRef = rpNo; }
    });
    await auditServer.logCreate(user.uid, companyId, "INVENTORY_REPACK", rpNo, { source: sourceId, qty: num(body.sourceQty), pack: packId, packs: plan.packs, remainder: plan.remainder, mode: plan.remainderMode });
    return NextResponse.json({ success: true, repack: { ...result, createdAt: new Date().toISOString() } });
  } catch (err: any) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    const msg = String(err?.message || "");
    if (/สต็อก|ไม่พอ|ปิดงวด|งวดบัญชี/.test(msg)) return NextResponse.json({ success: false, error: msg }, { status: 400 });
    console.error("[REPACK_API_ERROR]", err);
    return NextResponse.json({ success: false, error: "แบ่งบรรจุไม่สำเร็จ" }, { status: 500 });
  }
}
