/**
 * คลังคุณลักษณะเฉพาะ (สเปก TOR) — ใช้ร่วมกันทั้งหน้าจอและ server
 *
 * 1 อุปกรณ์/งาน = 1 แม่แบบ ที่มีได้หลายรูปแบบการเขียน (เลือกได้มากกว่า 1 รูปแบบ)
 * เช่น งานเดินสาย LAN: ร้อยท่อ EMT / ร้อยท่ออ่อน / รางเก็บสาย / เดินในฝ้า
 *      งานเข้าหัว: เข้าหัว RJ45 ตัวผู้ / ตั้ง Box ติดตั้งเต้ารับ / เข้า Patch Panel
 * ข้อความเป็นคุณลักษณะพื้นฐาน ไม่ระบุยี่ห้อหรือรุ่น (ห้ามล็อกสเปก)
 *
 * แม่แบบมาตรฐานอยู่ในโค้ด; บริษัทแก้ไข/เพิ่ม/ซ่อนได้ที่ companies/{c}/spec_templates/{id}
 * (เอกสารที่ id ตรงกับแม่แบบมาตรฐานจะใช้แทน, isDeleted = ซ่อน)
 */

export type SpecAppliesTo = "PRODUCT" | "SERVICE";

export interface SpecVariant {
  id: string;
  name: string;
  clauses: string[];
  /** เลือกให้อัตโนมัติเมื่อจับคู่แม่แบบได้ */
  isDefault?: boolean;
}

export interface SpecTemplate {
  id: string;
  name: string;
  category: string;
  appliesTo: SpecAppliesTo;
  /** คำที่ใช้จับคู่กับชื่อรายการ (ไม่สนตัวพิมพ์เล็ก/ใหญ่) */
  keywords: string[];
  variants: SpecVariant[];
  isDeleted?: boolean;
  /** true = มาจากแม่แบบมาตรฐานในโค้ด (ยังไม่ถูกแก้) */
  builtIn?: boolean;
}

export interface SpecChoice {
  templateId: string | null; // null = ไม่ใช้คลังสเปก
  variantIds: string[];
}

const UTP = "สายสัญญาณต้องเป็นชนิด UTP Category 6 หรือดีกว่า ผ่านมาตรฐาน ANSI/TIA-568";

const RAW_TEMPLATES: SpecTemplate[] = [
  {
    id: "LAN_CABLE", name: "งานเดินสายสัญญาณ LAN", category: "งานเดินสาย", appliesTo: "SERVICE",
    keywords: ["เดินสาย lan", "สาย lan", "สายแลน", "utp", "cat6", "cat 6", "เดินสายสัญญาณ", "เดินสาย"],
    variants: [
      { id: "EMT", name: "ร้อยท่อ EMT", isDefault: true, clauses: [UTP, "เดินสายร้อยในท่อโลหะ EMT ขนาดไม่น้อยกว่า 1/2 นิ้ว ยึดด้วยแคลมป์ทุกระยะไม่เกิน 1.5 เมตร", "ข้อต่อและข้อโค้งของท่อต้องใช้อุปกรณ์สำเร็จรูปที่ได้มาตรฐาน"] },
      { id: "FLEX", name: "ร้อยท่ออ่อน (Flex)", clauses: [UTP, "เดินสายร้อยในท่ออ่อน (Flexible Conduit) ในช่วงที่ต้องการความยืดหยุ่นหรือช่วงต่อเข้าอุปกรณ์", "ยึดท่ออ่อนให้แน่นหนา ไม่หย่อนคล้อย"] },
      { id: "TRUNK", name: "รางเก็บสาย (Trunking)", clauses: [UTP, "เดินสายในรางเก็บสายขนาดเหมาะสมกับจำนวนสาย มีฝาปิดเรียบร้อย ยึดติดผนังแน่นหนา"] },
      { id: "CEILING", name: "เดินในฝ้าเพดาน", clauses: [UTP, "เดินสายเหนือฝ้าเพดาน ยึดด้วยตะขอหรือกิ๊บรัดสายเป็นระยะ ไม่วางพาดบนแผ่นฝ้า"] },
    ],
  },
  {
    id: "LAN_TERM", name: "งานเข้าหัวและจุดเชื่อมต่อสาย LAN", category: "งานเดินสาย", appliesTo: "SERVICE",
    keywords: ["เข้าหัว", "rj45", "rj-45", "patch", "outlet", "เต้ารับ", "box"],
    variants: [
      { id: "RJ45M", name: "เข้าหัว RJ45 ตัวผู้", isDefault: true, clauses: ["เข้าหัวสายด้วยหัว RJ45 ชนิด Category 6 พร้อมปลอกหุ้มหัว (Boot)"] },
      { id: "OUTLET", name: "ตั้ง Box ติดตั้งเต้ารับ", clauses: ["ติดตั้งกล่อง (Box) พร้อมหน้ากากและเต้ารับ RJ45 ชนิด Category 6 แบบติดลอยหรือฝังผนัง", "ติดป้ายหมายเลขจุดที่หน้ากากทุกจุด"] },
      { id: "PATCH", name: "เข้า Patch Panel", clauses: ["เข้าสายที่แผงกระจายสาย (Patch Panel) Category 6 ภายในตู้ Rack", "จัดเก็บสายด้วยอุปกรณ์จัดสาย (Cable Management) และติดป้ายหมายเลขทุกพอร์ต"] },
      { id: "TEST", name: "ทดสอบและออกรายงานผล", clauses: ["ทดสอบสายสัญญาณทุกจุดตามมาตรฐาน Category 6 และส่งมอบรายงานผลการทดสอบ", "จัดทำผังการเดินสาย (As-built Drawing) ส่งมอบ"] },
    ],
  },
  {
    id: "ELECTRIC", name: "งานเดินสายไฟฟ้า", category: "งานเดินสาย", appliesTo: "SERVICE",
    keywords: ["สายไฟ", "ไฟฟ้า", "เบรกเกอร์", "breaker", "ปลั๊ก"],
    variants: [
      { id: "EMT", name: "ร้อยท่อ EMT", isDefault: true, clauses: ["ใช้สายไฟฟ้าที่ได้รับมาตรฐาน มอก. ขนาดเหมาะสมกับโหลดใช้งาน", "เดินสายร้อยในท่อโลหะ EMT ยึดด้วยแคลมป์เป็นระยะ", "มีระบบสายดินตามมาตรฐานการติดตั้งทางไฟฟ้าสำหรับประเทศไทย"] },
      { id: "PVC", name: "ร้อยท่อ PVC", clauses: ["ใช้สายไฟฟ้าที่ได้รับมาตรฐาน มอก. ขนาดเหมาะสมกับโหลดใช้งาน", "เดินสายร้อยในท่อ PVC สำหรับงานไฟฟ้า ยึดด้วยแคลมป์เป็นระยะ"] },
      { id: "BREAKER", name: "ติดตั้งเบรกเกอร์แยกวงจร", clauses: ["ติดตั้งเบรกเกอร์ป้องกันแยกวงจรสำหรับอุปกรณ์ในโครงการ พร้อมติดป้ายระบุวงจร"] },
    ],
  },
  {
    id: "INSTALL", name: "งานติดตั้งและทดสอบระบบ", category: "งานบริการ", appliesTo: "SERVICE",
    keywords: ["ติดตั้ง", "ทดสอบ", "installation", "setup", "config"],
    variants: [
      { id: "STD", name: "ติดตั้งและทดสอบ", isDefault: true, clauses: ["ดำเนินการติดตั้งโดยช่างผู้ชำนาญงาน ถูกต้องตามหลักวิชาการและมาตรฐานความปลอดภัย", "ทดสอบการทำงานของระบบให้ใช้งานได้ครบถ้วนก่อนส่งมอบ", "จัดทำคู่มือการใช้งานและผังการติดตั้งส่งมอบ"] },
      { id: "TRAIN", name: "ฝึกอบรมผู้ใช้งาน", clauses: ["จัดฝึกอบรมการใช้งานและการดูแลรักษาระบบเบื้องต้นแก่เจ้าหน้าที่ไม่น้อยกว่า 1 ครั้ง"] },
      { id: "CLEAN", name: "เก็บงานและทำความสะอาด", clauses: ["เก็บเศษวัสดุและทำความสะอาดพื้นที่ปฏิบัติงานให้เรียบร้อยหลังติดตั้ง"] },
    ],
  },
  {
    id: "CCTV", name: "กล้องโทรทัศน์วงจรปิด (IP Camera)", category: "ระบบกล้องวงจรปิด", appliesTo: "PRODUCT",
    keywords: ["กล้อง", "camera", "cctv", "ip cam"],
    variants: [
      { id: "OUTDOOR", name: "ติดตั้งภายนอกอาคาร", isDefault: true, clauses: ["เป็นกล้องโทรทัศน์วงจรปิดชนิดเครือข่าย (IP Camera) ความละเอียดไม่น้อยกว่า 2,000,000 pixel", "มีระบบอินฟราเรดสำหรับถ่ายภาพในที่มืดได้ในระยะไม่น้อยกว่า 30 เมตร", "ตัวกล้องต้องได้มาตรฐานการป้องกันฝุ่นและน้ำไม่ต่ำกว่า IP66", "รองรับการจ่ายไฟผ่านสายสัญญาณ (PoE) ตามมาตรฐาน IEEE 802.3af", "รองรับมาตรฐาน ONVIF"] },
      { id: "INDOOR", name: "แบบโดมภายในอาคาร", clauses: ["เป็นกล้องโทรทัศน์วงจรปิดชนิดเครือข่าย (IP Camera) แบบโดม ความละเอียดไม่น้อยกว่า 2,000,000 pixel", "มีระบบอินฟราเรดสำหรับถ่ายภาพในที่มืดได้ในระยะไม่น้อยกว่า 20 เมตร", "รองรับการจ่ายไฟผ่านสายสัญญาณ (PoE) ตามมาตรฐาน IEEE 802.3af", "รองรับมาตรฐาน ONVIF"] },
    ],
  },
  {
    id: "NVR", name: "เครื่องบันทึกภาพผ่านเครือข่าย (NVR)", category: "ระบบกล้องวงจรปิด", appliesTo: "PRODUCT",
    keywords: ["nvr", "เครื่องบันทึก", "บันทึกภาพ"],
    variants: [
      { id: "STD", name: "มาตรฐาน", isDefault: true, clauses: ["รองรับการบันทึกภาพจากกล้องได้ไม่น้อยกว่าจำนวนกล้องในโครงการ", "มีฮาร์ดดิสก์สำหรับบันทึกภาพที่สามารถบันทึกภาพย้อนหลังได้ไม่น้อยกว่า 30 วัน", "สามารถดูภาพสดและภาพย้อนหลังผ่านเครือข่ายและอุปกรณ์เคลื่อนที่ได้", "รองรับมาตรฐาน ONVIF"] },
    ],
  },
  {
    id: "SWITCH", name: "อุปกรณ์กระจายสัญญาณ (L2 Switch)", category: "ระบบเครือข่าย", appliesTo: "PRODUCT",
    keywords: ["switch", "สวิตช์", "สวิตซ์"],
    variants: [
      { id: "POE8", name: "PoE 8 ช่อง", isDefault: true, clauses: ["มีลักษณะการทำงานไม่น้อยกว่า Layer 2 ของ OSI Model", "มีช่องเชื่อมต่อระบบเครือข่าย (Network Interface) แบบ 10/100/1000Base-T ไม่น้อยกว่า 8 ช่อง", "สามารถจ่ายไฟผ่านสายสัญญาณ (PoE) ตามมาตรฐาน IEEE 802.3af/at"] },
      { id: "P24", name: "24 ช่อง", clauses: ["มีลักษณะการทำงานไม่น้อยกว่า Layer 2 ของ OSI Model", "มีช่องเชื่อมต่อระบบเครือข่าย (Network Interface) แบบ 10/100/1000Base-T ไม่น้อยกว่า 24 ช่อง", "สามารถทำ VLAN ตามมาตรฐาน IEEE 802.1Q ได้"] },
    ],
  },
  {
    id: "UPS", name: "เครื่องสำรองไฟฟ้า (UPS)", category: "ระบบไฟฟ้า", appliesTo: "PRODUCT",
    keywords: ["ups", "สำรองไฟ"],
    variants: [
      { id: "800VA", name: "ขนาด 800 VA", isDefault: true, clauses: ["มีกำลังไฟฟ้าด้านนอกไม่น้อยกว่า 800 VA (480 Watts)", "สามารถสำรองไฟฟ้าได้ไม่น้อยกว่า 15 นาที"] },
      { id: "1KVA", name: "ขนาด 1 kVA", clauses: ["มีกำลังไฟฟ้าด้านนอกไม่น้อยกว่า 1 kVA (600 Watts)", "สามารถสำรองไฟฟ้าได้ไม่น้อยกว่า 15 นาที"] },
      { id: "3KVA", name: "ขนาด 3 kVA", clauses: ["มีกำลังไฟฟ้าด้านนอกไม่น้อยกว่า 3 kVA (2,100 Watts)", "สามารถสำรองไฟฟ้าได้ไม่น้อยกว่า 5 นาที"] },
    ],
  },
  {
    id: "RACK", name: "ตู้สำหรับจัดเก็บอุปกรณ์ (Rack)", category: "ระบบเครือข่าย", appliesTo: "PRODUCT",
    keywords: ["rack", "แร็ค", "ตู้"],
    variants: [
      { id: "WALL", name: "แบบติดผนัง", isDefault: true, clauses: ["เป็นตู้แบบติดผนังขนาดความสูงไม่น้อยกว่า 9U ความลึกไม่น้อยกว่า 45 เซนติเมตร", "มีพัดลมระบายอากาศและรางปลั๊กไฟสำหรับอุปกรณ์", "ประตูหน้าต้องเป็นกระจกพร้อมกุญแจล็อก"] },
      { id: "FLOOR", name: "แบบตั้งพื้น", clauses: ["เป็นตู้แบบตั้งพื้นขนาดความสูงไม่น้อยกว่า 42U ความลึกไม่น้อยกว่า 80 เซนติเมตร", "มีพัดลมระบายอากาศ ถาดวางอุปกรณ์ และรางปลั๊กไฟ", "ต้องมีประตูหน้าและหลังพร้อมกุญแจล็อก"] },
    ],
  },
];

/** ข้อความในคลังเป็นประโยคข้อกำหนดสมบูรณ์: ขึ้นต้นด้วย "ต้อง" หรือมี "ต้อง" อยู่ในประโยค */
const must = (c: string) => (/^(ต้อง|ไม่)/.test(c) || /^\S{1,30}ต้อง(เป็น|ใช้|ได้|มี)/.test(c) ? c : `ต้อง${c}`);

export const DEFAULT_SPEC_TEMPLATES: SpecTemplate[] = RAW_TEMPLATES.map((t) => ({
  ...t,
  variants: t.variants.map((v) => ({ ...v, clauses: v.clauses.map(must) })),
}));

const str = (v: any, max = 300) => String(v ?? "").trim().slice(0, max);

/** ตรวจ/ทำความสะอาดแม่แบบที่รับมาจากหน้าจอ */
export function normalizeSpecTemplate(raw: any): SpecTemplate | null {
  const id = str(raw?.id, 40).replace(/[^A-Za-z0-9_-]/g, "");
  const name = str(raw?.name, 150);
  if (!id || !name) return null;
  const variants: SpecVariant[] = (Array.isArray(raw?.variants) ? raw.variants : []).slice(0, 20)
    .map((v: any, i: number) => ({
      id: str(v?.id, 40).replace(/[^A-Za-z0-9_-]/g, "") || `V${i + 1}`,
      name: str(v?.name, 100),
      clauses: (Array.isArray(v?.clauses) ? v.clauses : String(v?.clauses || "").split(/\r?\n/))
        .map((c: any) => str(c, 500)).filter(Boolean).slice(0, 40),
      isDefault: v?.isDefault === true,
    }))
    .filter((v: SpecVariant) => v.name && v.clauses.length);
  return {
    id,
    name,
    category: str(raw?.category, 80) || "อื่น ๆ",
    appliesTo: raw?.appliesTo === "PRODUCT" ? "PRODUCT" : "SERVICE",
    keywords: (Array.isArray(raw?.keywords) ? raw.keywords : String(raw?.keywords || "").split(","))
      .map((k: any) => str(k, 60).toLowerCase()).filter(Boolean).slice(0, 30),
    variants,
  };
}

/** แม่แบบมาตรฐาน + ฉบับของบริษัท (ทับด้วย id เดียวกัน, isDeleted = ซ่อน) */
export function mergeSpecLibrary(companyDocs: any[]): SpecTemplate[] {
  const byId = new Map<string, SpecTemplate>(DEFAULT_SPEC_TEMPLATES.map((t) => [t.id, { ...t, builtIn: true }]));
  for (const d of companyDocs || []) {
    if (!d?.id) continue;
    if (d.isDeleted) { byId.delete(d.id); continue; }
    const t = normalizeSpecTemplate(d);
    if (t) byId.set(t.id, t);
  }
  return Array.from(byId.values());
}

/** จับคู่แม่แบบจากชื่อรายการ: คำที่ยาวกว่าตรงกันได้คะแนนมากกว่า และต้องตรงประเภท (สินค้า/บริการ) */
export function suggestSpec(name: string, kind: string, library: SpecTemplate[]): SpecChoice | null {
  const text = String(name || "").toLowerCase();
  if (!text.trim()) return null;
  const want: SpecAppliesTo = kind === "PRODUCT" ? "PRODUCT" : "SERVICE";
  let best: { t: SpecTemplate; score: number } | null = null;
  for (const t of library) {
    if (t.appliesTo !== want) continue;
    const score = t.keywords.reduce((s, k) => (k && text.includes(k) ? s + k.length : s), 0);
    if (score > 0 && (!best || score > best.score)) best = { t, score };
  }
  if (!best) return null;
  const defaults = best.t.variants.filter((v) => v.isDefault).map((v) => v.id);
  return { templateId: best.t.id, variantIds: defaults.length ? defaults : best.t.variants.slice(0, 1).map((v) => v.id) };
}

/** ข้อความสเปกของรายการตามรูปแบบที่เลือก (ไม่ซ้ำ) */
export function specClausesFor(choice: SpecChoice | null | undefined, library: SpecTemplate[]): string[] {
  if (!choice?.templateId) return [];
  const t = library.find((x) => x.id === choice.templateId);
  if (!t) return [];
  const out: string[] = [];
  for (const v of t.variants) {
    if (!choice.variantIds.includes(v.id)) continue;
    for (const c of v.clauses) if (!out.includes(c)) out.push(c);
  }
  return out;
}

export function normalizeSpecChoices(raw: any): Record<string, SpecChoice> {
  const out: Record<string, SpecChoice> = {};
  if (!raw || typeof raw !== "object") return out;
  Object.entries(raw).slice(0, 500).forEach(([k, v]: [string, any]) => {
    const key = str(k, 60);
    if (!key) return;
    out[key] = {
      templateId: v?.templateId ? str(v.templateId, 40) : null,
      variantIds: (Array.isArray(v?.variantIds) ? v.variantIds : []).map((x: any) => str(x, 40)).filter(Boolean).slice(0, 20),
    };
  });
  return out;
}
