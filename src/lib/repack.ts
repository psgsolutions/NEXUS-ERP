/**
 * แบ่งบรรจุ (แบ่งขาย) — แกะสินค้าหน่วยใหญ่ (เช่น สกรู 1 กล่อง = 1,000 ตัว) แบ่งเป็นห่อเล็ก (ถุงละ N ตัว) เข้าคลัง
 *  - ตัดสินค้าต้นทาง (กล่อง) ออก → รับสินค้าห่อเล็ก (ถุง) เข้า เป็นสินค้าคนละรหัส มีบาร์โค้ด/ฉลากของตัวเอง
 *  - ต้นทุน: ต้นทุนจริงของกล่องที่แกะ (FIFO/ถัวเฉลี่ย) กระจายตามจำนวนชิ้น → มูลค่าคลังรวมเท่าเดิม ไม่ลงบัญชีต้นทุนขาย
 *  - เศษที่แบ่งไม่ครบห่อ: เก็บเป็นสินค้าแยกชิ้น (ต้นทุนตามสัดส่วน) หรือตัดเป็นเศษสูญเสีย (ต้นทุนรวมเข้าห่อ)
 * ห่อเล็กผูกกับสินค้าต้นทางที่ product.packOf = { productId, pieces, pieceUnit }
 */

export type RemainderMode = "loose" | "waste";
export interface PackOf { productId: string; pieces: number; pieceUnit: string }

export interface RepackInput {
  /** จำนวนหน่วยต้นทางที่แกะ (เช่น 3 กล่อง) */
  sourceQty: number;
  /** ชิ้นต่อ 1 หน่วยต้นทาง (1 กล่อง = 1,000 ตัว) */
  piecesPerSource: number;
  /** ชิ้นต่อ 1 ห่อ (ถุงละ 50 ตัว) */
  packSize: number;
  /** จำนวนห่อที่บรรจุ (ไม่ระบุ = เต็มที่ได้) */
  packs?: number;
  remainderMode?: RemainderMode;
}
export interface RepackPlan {
  totalPieces: number; maxPacks: number; packs: number; packedPieces: number; remainder: number;
  remainderMode: RemainderMode; errors: string[];
}

const round4 = (n: number) => Math.round(n * 10000) / 10000;
const int = (v: unknown) => (Number.isFinite(Number(v)) ? Math.floor(Number(v)) : 0);

export function planRepack(input: RepackInput): RepackPlan {
  const errors: string[] = [];
  const sourceQty = Number(input.sourceQty) || 0, perSource = Number(input.piecesPerSource) || 0, packSize = Number(input.packSize) || 0;
  if (!(sourceQty > 0)) errors.push("ระบุจำนวนที่แกะ");
  if (!(perSource > 0)) errors.push("ระบุจำนวนชิ้นต่อหน่วยต้นทาง");
  if (!(packSize > 0)) errors.push("ระบุจำนวนชิ้นต่อห่อ");
  const totalPieces = round4(sourceQty * perSource);
  const maxPacks = packSize > 0 ? Math.floor(totalPieces / packSize + 1e-9) : 0;
  const packs = input.packs === undefined || input.packs === null ? maxPacks : int(input.packs);
  if (packSize > 0 && packSize > totalPieces && totalPieces > 0) errors.push(`ห่อละ ${packSize} มากกว่าจำนวนชิ้นทั้งหมด (${totalPieces})`);
  if (packs < 0) errors.push("จำนวนห่อติดลบไม่ได้");
  if (packs > maxPacks) errors.push(`บรรจุได้ไม่เกิน ${maxPacks} ห่อ`);
  if (packs === 0 && maxPacks > 0) errors.push("ระบุจำนวนห่อ");
  const packedPieces = round4(Math.max(0, Math.min(packs, maxPacks)) * packSize);
  const remainder = round4(Math.max(0, totalPieces - packedPieces));
  const remainderMode: RemainderMode = input.remainderMode === "loose" ? "loose" : "waste";
  // ตัดเป็นเศษได้เฉพาะส่วนที่ไม่ครบ 1 ห่อ — บรรจุไม่เต็มแล้วเหลือของ ต้องเก็บเป็นสินค้าแยกชิ้น (ไม่ทิ้งของดี)
  if (remainderMode === "waste" && packSize > 0 && remainder >= packSize) errors.push(`เหลือ ${remainder} ชิ้น (บรรจุได้อีก ${Math.floor(remainder / packSize)} ห่อ) — เพิ่มจำนวนห่อ หรือเลือกเก็บเศษเป็นสินค้าแยกชิ้น`);
  return { totalPieces, maxPacks, packs: Math.max(0, packs), packedPieces, remainder, remainderMode, errors };
}

/** สัดส่วนต้นทุนที่ห่อและเศษได้รับ (รวม = 1) — เศษสูญเสีย = ต้นทุนทั้งหมดอยู่ในห่อ */
export function repackShares(plan: RepackPlan): { packShare: number; looseShare: number } {
  if (!(plan.totalPieces > 0)) return { packShare: 0, looseShare: 0 };
  if (plan.remainderMode === "waste" || !(plan.remainder > 0)) return { packShare: plan.packs > 0 ? 1 : 0, looseShare: plan.packs > 0 ? 0 : 1 };
  const looseShare = plan.remainder / plan.totalPieces;
  return { packShare: 1 - looseShare, looseShare };
}

/** ต้นทุนต่อห่อ / ต่อชิ้นของเศษ จากต้นทุนรวมของที่แกะ */
export function repackCosts(totalCost: number, plan: RepackPlan): { packUnitCost: number; looseUnitCost: number } {
  const { packShare, looseShare } = repackShares(plan);
  return {
    packUnitCost: plan.packs > 0 ? round4((totalCost * packShare) / plan.packs) : 0,
    looseUnitCost: plan.remainder > 0 && plan.remainderMode === "loose" ? round4((totalCost * looseShare) / plan.remainder) : 0,
  };
}

const fmt = (n: number) => Number(n).toLocaleString("th-TH", { maximumFractionDigits: 4 });
/** ชื่อสินค้าห่อเล็ก/แยกชิ้นที่สร้างให้อัตโนมัติ (แก้ได้ก่อนบันทึก) */
export function packProductName(sourceName: string, pieces: number, pieceUnit: string, packUnit: string): string {
  const base = String(sourceName || "").replace(/\s*\((?:กล่อง|ลัง|แพ็ค|ม้วน|box|carton)[^)]*\)\s*$/i, "").trim();
  return pieces === 1 ? `${base} (แยก${pieceUnit || "ชิ้น"})` : `${base} (${packUnit || "ถุง"}ละ ${fmt(pieces)} ${pieceUnit || "ชิ้น"})`;
}

/** สินค้าห่อเล็กที่มีอยู่แล้วของสินค้าต้นทางและขนาดนี้ */
export function findPackProduct<T extends { id: string; packOf?: Partial<PackOf>; isDeleted?: boolean }>(products: T[], sourceId: string, pieces: number): T | undefined {
  return products.find((p) => !p.isDeleted && p.packOf?.productId === sourceId && Number(p.packOf?.pieces) === Number(pieces));
}

export function normalizePackOf(raw: any): PackOf | null {
  if (!raw || typeof raw !== "object") return null;
  const productId = String(raw.productId || "").trim().slice(0, 120), pieces = Number(raw.pieces);
  if (!productId || productId.includes("/") || !(pieces > 0) || pieces > 1e7) return null;
  return { productId, pieces: round4(pieces), pieceUnit: String(raw.pieceUnit || "ชิ้น").trim().slice(0, 20) };
}
