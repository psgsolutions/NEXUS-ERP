/**
 * รหัสสินค้าของระบบ: [หมวด]-[ยี่ห้อ]-[รุ่นย่อ](-[ตัวแปร]) เช่น NW-LNK-C6JK, CB-BEL-C6UTP-305M, OF-BRO-TZE621-YL
 * - รหัสผู้ผลิต/แบรนด์ (part number) เก็บแยกที่ partNumber ไม่ใช้เป็นรหัสระบบ
 * - ไม่ใส่ Lot/วันที่ในรหัสสินค้า (Lot มีเลขของตัวเอง) · สี/ขนาด/ความยาว = ตัวแปรท้ายรหัส
 * - ใช้เสนอรหัส (ผู้ใช้แก้ได้) — confidence "low" = ย่อรุ่นจากคำทั่วไป ควรตรวจ
 */
export const SKU_CATEGORIES: { code: string; label: string; words: RegExp }[] = [
  { code: "CT", label: "กล้องวงจรปิด", words: /\b(nvr|dvr|xvr|cctv|ip ?cam|camera|bullet|dome|fisheye|ptz|wizsense|hdcvi)\b|กล้อง/i },
  { code: "AC", label: "ควบคุมการเข้าออก", words: /\b(access ?control|door|lock|exit|lmb|magnetic|zkteco|keypad|fingerprint|face ?scan|turnstile|mifare|card|break ?glass|call ?point|release)\b|กลอน|ประตู|แม่เหล็ก|สแกนนิ้ว|บัตร/i },
  { code: "CB", label: "สายและอุปกรณ์เดินสาย", words: /\b(cable|utp|ftp|stp|fiber|fibre|coax|rg6|awg|patch ?cord|pigtail|cat ?5e?|cat ?6a?|reel|duplex|sc|lc|tray|duratray|conduit|vct|thw)\b|f\.o\.|สาย|หัวต่อ|ข้อต่อสาย|ท่อ|ราง/i },
  { code: "NW", label: "อุปกรณ์เครือข่าย", words: /\b(switch|sw|hub|port|router|firewall|access ?point|ap|sfp|poe|rj45|jack|modular|patch ?panel|wifi|wi-fi|lan|gbic|transceiver|controller|ruckus|aruba|ruijie|icx|gateway|rack|drawer|cabinet)\b|ตู้แร็ค/i },
  { code: "PC", label: "คอมพิวเตอร์และอุปกรณ์", words: /\b(pc|notebook|laptop|desktop|monitor|ssd|hdd|ram|ddr\d?|nvme|m\.2|cpu|mainboard|keyboard|mouse|printer|toner|ink|cartridge|usb|hdmi|vga|ups|flash ?drive|handy ?drive|sata|nas|synology)\b|เมาส์|คีย์บอร์ด|เครื่องพิมพ์|หมึก/i },
  { code: "DP", label: "จอภาพและทีวี", words: /\b(tv|smart ?tv|display|led ?display|signage|projector)\b|ทีวี|จอ|โปรเจคเตอร์/i },
  { code: "AV", label: "ภาพและเสียง", words: /\b(speaker|amplifier|amp|microphone|mic|pa|sound|audio|extender|splitter)\b|ลำโพง|ไมค์|เครื่องเสียง|เพิ่มสัญญาณ/i },
  { code: "SL", label: "โซลาร์เซลล์", words: /\b(solar|pv|inverter|mppt|panel ?mono|hi-mo|longi)\b|แผงโซลาร์|โซลาร์/i },
  { code: "PW", label: "ไฟฟ้าและแสงสว่าง", words: /\b(breaker|mcb|rcbo|consumer|plug|socket|outlet|power|led|lamp|light|panel ?light|terminal|battery|inverter ?ac)\b|adapter n\/b|ปลั๊ก|เต้ารับ|สวิตซ์|สวิตช์|เบรกเกอร์|เบรคเกอร์|ไฟ|โคม|หลอด|ถ่าน|บล๊อก|บล็อก|เมนคอนซูเมอร์|ขั้วต่อ|หางปลา|ฝา/i },
  { code: "TL", label: "เครื่องมือ", words: /\b(tester|fluke|drill|crimp|tool|meter|saw|gun|multimeter)\b|เครื่องมือ|สว่าน|ดอกสว่าน|ใบเลื่อย|ปืน|คีม|เครื่องทดสอบ/i },
  { code: "OF", label: "วัสดุสิ้นเปลืองและสำนักงาน", words: /\b(tape|label|tze|ribbon|paper|dvd|cd|laminat|glue|sealant|silicone|acrylic)\b|เทป|กาว|ซีลแลนด์|อะคริลิค|เคลือบบัตร|กระดาษ|สติ๊กเกอร์/i },
];
export const SKU_OTHER = { code: "OT", label: "อื่น ๆ" };

/** รหัสยี่ห้อที่กำหนดเอง (ที่เหลือย่อจากชื่ออัตโนมัติ) */
const BRAND_CODES: Record<string, string> = {
  "link": "LNK", "dahua": "DAH", "ruckus": "RCK", "aruba": "ARB", "azsic": "AZS", "brother": "BRO", "glink": "GLK", "lg": "LG", "hp": "HP",
  "ugreen": "UGR", "apacer": "APR", "planet": "PLN", "tp-link": "TPL", "zkteco": "ZKT", "belden": "BEL", "huawei": "HUA", "sandisk": "SND",
  "seagate": "SGT", "allied telesis": "ATI", "cisco": "CSC", "samsung": "SAM", "panasonic": "PAN", "philips": "PHI", "mitsubishi": "MIT",
  "schneider": "SCH", "ชไนเดอร์": "SCH", "apc": "APC", "dell": "DEL", "acer": "ACR", "toshiba": "TSB", "xiaomi": "XMI", "synology": "SYN",
  "logitech": "LGT", "commscope": "CSP", "panduit": "PDT", "eaton": "ETN", "sophos": "SPH", "ruijie": "RJE", "longi": "LGI", "draka": "DRK",
  "ยาซากิ": "YZK", "yazaki": "YZK", "ไทยยูเนี่ยน": "TUC", "lanko": "LNK2", "haco": "HCO",
};
/** คำที่เป็นประเภทสินค้า ไม่ใช่ยี่ห้อ */
const NOT_BRAND = /^(mini pc( ram| hdd)?|toner|ink|germany|system|genuine|waste cartridge|สายสั่งพิเศษ)$/i;

const COLORS: [RegExp, string][] = [
  [/\b(black|bk)\b|สีดำ|ดำ/i, "BK"], [/\b(white|wh)\b|สีขาว|ขาว/i, "WH"], [/\b(blue)\b|สีฟ้า|ฟ้า|น้ำเงิน/i, "BL"], [/\b(yellow)\b|เหลือง/i, "YL"],
  [/\b(red)\b|สีแดง|แดง/i, "RD"], [/\b(green)\b|เขียว/i, "GN"], [/\b(gr[ae]y)\b|เทา/i, "GY"], [/\b(orange)\b|ส้ม/i, "OR"],
];

const clean = (s: string) => String(s || "").replace(/\s+/g, " ").trim();
const alnum = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** แยกยี่ห้อจาก "ยี่ห้อ : รุ่น" — ส่วนหน้าที่เป็นภาษาไทยล้วน/ประเภทสินค้า ไม่ถือเป็นยี่ห้อ (ใช้คำอังกฤษในส่วนนั้นถ้ามี) */
export function splitBrand(name: string, brandField?: string): { brand: string; model: string } {
  const n = clean(name);
  const [left, ...rest] = n.includes(" : ") ? n.split(" : ") : ["", n];
  const model = clean(rest.join(" : ")) || n;
  const cand = clean(brandField || left);
  if (!cand || NOT_BRAND.test(cand)) return { brand: "", model };
  if (/^[A-Za-z0-9][A-Za-z0-9 .&+-]*$/.test(cand)) return { brand: cand, model };
  // ไทยปนอังกฤษ เช่น "เบรกเกอร์ Mitsubishi" "ถ่านกระดุม-Philips"
  const latin = cand.match(/[A-Za-z][A-Za-z0-9&+-]{1,}/g);
  if (latin?.length) return { brand: latin[latin.length - 1], model };
  const known = Object.keys(BRAND_CODES).find((k) => cand.includes(k));
  if (known) return { brand: cand, model };
  // ส่วนหน้าเป็นประเภทสินค้าภาษาไทย เช่น "กล่องเพิ่มสัญญาณภาพ : Aten VS184A" → ยี่ห้อ = คำอังกฤษแรกของส่วนหลัง (ไม่ใช่เลขรุ่น)
  const first = model.match(/^([A-Z][A-Za-z]{2,})\b/);
  return first ? { brand: first[1], model: clean(model.slice(first[1].length)) || model } : { brand: "", model: n };
}

export function brandCode(brand: string): string {
  const b = clean(brand).toLowerCase();
  if (!b) return "GEN";
  const hit = BRAND_CODES[b] || Object.entries(BRAND_CODES).find(([k]) => b.includes(k))?.[1];
  if (hit) return hit;
  const a = alnum(brand);
  if (a.length <= 3) return a || "GEN";
  // ตัวแรก + พยัญชนะถัดไป 2 ตัว (TEST → TST, VANZEL → VNZ)
  const cons = a.slice(1).replace(/[AEIOU]/g, "");
  return (a[0] + (cons.length >= 2 ? cons.slice(0, 2) : a.slice(1, 3))).slice(0, 3);
}

export function categoryOf(text: string): { code: string; label: string } {
  for (const c of SKU_CATEGORIES) if (c.words.test(text)) return { code: c.code, label: c.label };
  return SKU_OTHER;
}

/** ตัวแปร: สี และความยาว/ขนาดที่เป็นตัวบ่งชี้รุ่นย่อย (305M, 5M, 128GB, 1TB) */
export function variantOf(text: string): string {
  const parts: string[] = [];
  const len = text.match(/(?:^|[^\d.])(\d{1,4}(?:\.\d)?)\s?(m|เมตร|ม\.)(?![a-z])/i);
  if (len) parts.push(`${len[1].replace(".", "")}M`);
  const cap = text.match(/\b(\d{1,4})\s?(gb|tb)\b/i);
  if (cap) parts.push(`${cap[1]}${cap[2].toUpperCase()}`);
  const color = COLORS.find(([re]) => re.test(text));
  if (color) parts.push(color[1]);
  return parts.slice(0, 2).join("");
}

const SPEC = /^\d+(CH|MP|HDD|AWG|PR|GB|TB|M|MM|W|V|A|K|X|P|PCS|HZ|FT)$/i;

/** รุ่นย่อ: เลขรุ่นจริง (มีตัวอักษร+ตัวเลข) ก่อน · ไม่มีใช้คำย่อประเภท+สเปกแรก · สุดท้ายตัวอักษรแรกของคำอังกฤษ */
export function modelKey(model: string, partNumber?: string, brandCodeHint = ""): { key: string; confidence: "high" | "low" } {
  // รหัสภายในของตัวแทนจำหน่าย (A0143593) ไม่ใช่เลขรุ่น — ย่อจากชื่อแทน
  const raw = String(partNumber || "").trim();
  if (raw && !/^A\d{6,8}$/i.test(raw)) {
    const segs = raw.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
    // ตัดส่วนนำหน้าที่เป็นตัวย่อยี่ห้อ: GLK-GL-040 → GL040 · DHU-4108HS8… → 4108HS8… · ZK-LMB-280L → LMB280L
    if (segs.length > 1 && /^[A-Z]{1,3}$/.test(segs[0]) && (segs[0] === brandCodeHint || segs.slice(1).join("").length >= 4)) segs.shift();
    const pn = segs.join("");
    if (pn.length >= 3) return { key: pn.slice(0, 10), confidence: "high" };
  }
  const tokens = clean(model).split(/[\s,/()]+/).filter(Boolean);
  const modelLike = tokens.find((t) => /[A-Za-z]/.test(t) && /\d/.test(t) && alnum(t).length >= 4 && !SPEC.test(alnum(t)) && !/^(cat\d|usb\d|ddr\d|m\.2|rj45|ip\d\d)$/i.test(t));
  if (modelLike) return { key: alnum(modelLike).slice(0, 10), confidence: "high" };
  const acr = tokens.find((t) => /^[A-Z]{2,5}$/.test(t));
  const spec = tokens.find((t) => SPEC.test(alnum(t)) || /^\d{2,4}"?$/.test(t));
  if (acr) return { key: (acr + (spec ? alnum(spec) : "")).slice(0, 10), confidence: "low" };
  const initials = tokens.filter((t) => /^[A-Za-z]/.test(t)).map((t) => (/^[A-Z0-9-]+$/.test(t) && t.length <= 4 ? alnum(t) : t[0].toUpperCase())).join("");
  if (initials.length >= 2) return { key: initials.slice(0, 8), confidence: "low" };
  return { key: "", confidence: "low" };
}

export interface SkuSuggestion { sku: string; category: string; categoryLabel: string; brand: string; brandCode: string; model: string; variant: string; confidence: "high" | "low"; /** ย่อรุ่นไม่ได้ ใช้เลขลำดับแทน */ fallback: boolean }

/** เสนอรหัสสินค้า (taken = รหัสที่มีแล้ว ใช้กันซ้ำ: ซ้ำ = เติม -2, -3) */
export function suggestSku(p: { name: string; brand?: string; category?: string; partNumber?: string }, taken: Set<string> = new Set(), seqForBlank = 1): SkuSuggestion {
  const { brand, model } = splitBrand(p.name, p.brand);
  const cat = p.category && SKU_CATEGORIES.some((c) => c.code === p.category) ? SKU_CATEGORIES.find((c) => c.code === p.category)! : categoryOf(`${p.name}`);
  const bc = brandCode(brand);
  const mk = modelKey(model, p.partNumber, bc);
  const variant = variantOf(model);
  const key = mk.key && !variant.startsWith(mk.key) ? mk.key : mk.key || String(seqForBlank).padStart(4, "0");
  let sku = [cat.code, bc, key, variant && !key.endsWith(variant) ? variant : ""].filter(Boolean).join("-");
  if (taken.has(sku)) { let i = 2; while (taken.has(`${sku}-${i}`)) i++; sku = `${sku}-${i}`; }
  taken.add(sku);
  return { sku, category: cat.code, categoryLabel: cat.label, brand, brandCode: bc, model, variant, confidence: mk.key && bc !== "GEN" ? mk.confidence : "low", fallback: !mk.key };
}
