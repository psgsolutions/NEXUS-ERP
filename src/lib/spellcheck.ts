/**
 * ตรวจคำผิด (ภาษาไทยเป็นหลัก) — ฟังก์ชันล้วน ใช้ได้ทั้งหน้าจอ การนำเข้า และ unit test
 *  1. ปรับรูปแบบที่ปลอดภัยให้อัตโนมัติ: "ํา" (นิคหิต+สระอา จากการคัดลอก PDF) → "ำ", ช่องว่างซ้ำ/หัวท้าย, อักขระล่องหน
 *  2. โครงสร้างคำผิด: วรรณยุกต์/สระซ้อน, สระหน้าไม่มีพยัญชนะตาม, เครื่องหมายขึ้นต้นคำ
 *  3. คำที่พิมพ์ผิดบ่อยในเอกสารธุรกิจ/ราชการ (พจนานุกรม + ใกล้เคียง 1 ตัวอักษร)
 *  4. ที่อยู่: จังหวัด/อำเภอ/ตำบล/รหัสไปรษณีย์ เทียบฐานข้อมูลที่อยู่ไทย พร้อมคำที่น่าจะถูก
 * ไม่บล็อกการบันทึก — เป็นคำเตือนพร้อมคำแนะนำให้กดแก้
 */

export interface Typo { wrong: string; suggest: string; reason: string }

const ZERO_WIDTH = /[​-‍﻿­]/g;

/** ปรับรูปแบบที่ไม่เปลี่ยนความหมาย — คืนข้อความใหม่และจำนวนจุดที่ปรับ */
export function normalizeThaiText(raw: unknown): { text: string; changes: number } {
  const src = String(raw ?? "");
  let changes = 0;
  const count = (re: RegExp) => { const m = src.match(re); return m ? m.length : 0; };
  changes += count(/ํา/g) + count(ZERO_WIDTH) + count(/ {2,}/g) + (src !== src.trim() ? 1 : 0);
  const text = src.replace(ZERO_WIDTH, "").replace(/ํา/g, "ำ").replace(/[ \t]{2,}/g, " ").trim();
  return { text, changes: text === src ? 0 : Math.max(changes, 1) };
}

/** คำที่พิมพ์ผิดบ่อย → คำที่ถูก */
const COMMON_MISSPELLINGS: Record<string, string> = {
  "บริษท": "บริษัท", "บริศัท": "บริษัท", "บริสัท": "บริษัท", "บริษัษ": "บริษัท", "บริฺษัท": "บริษัท",
  "จำกัษ": "จำกัด", "จำกัต": "จำกัด", "จำกด": "จำกัด", "จกัด": "จำกัด",
  "มหาชล": "มหาชน", "ห้างหุ่นส่วน": "ห้างหุ้นส่วน", "หุ่นส่วน": "หุ้นส่วน",
  "สำนักงานใหย่": "สำนักงานใหญ่", "สำนักงานไหญ่": "สำนักงานใหญ่", "สำนักานใหญ่": "สำนักงานใหญ่",
  "กรุงเทพมหานครฯ": "กรุงเทพมหานคร", "กรุงเทพฯมหานคร": "กรุงเทพมหานคร",
  "อนุญาติ": "อนุญาต", "อนุญาตต": "อนุญาต", "ใบอนุญาติ": "ใบอนุญาต",
  "ลายเซ็นต์": "ลายเซ็น", "เซ็นต์ชื่อ": "เซ็นชื่อ",
  "โครงการณ์": "โครงการ", "สังเกตุ": "สังเกต", "อุปการณ์": "อุปกรณ์", "อุปกร": "อุปกรณ์",
  "คอมพิวเตอ": "คอมพิวเตอร์", "คอมพิเตอร์": "คอมพิวเตอร์", "ซอฟแวร์": "ซอฟต์แวร์", "ซอฟท์แวร์": "ซอฟต์แวร์", "ซอฟต์แวร": "ซอฟต์แวร์",
  "ไลเซ่นส์": "ไลเซนส์", "ไลเซนต์": "ไลเซนส์", "อินเตอร์เนท": "อินเทอร์เน็ต", "อินเตอร์เน็ต": "อินเทอร์เน็ต", "เน็ตเวิร์ก": "เน็ตเวิร์ก",
  "กล้องวงจรปิค": "กล้องวงจรปิด", "วงจรปิค": "วงจรปิด", "เบรคเกอร์": "เบรกเกอร์", "เบรกเกอ": "เบรกเกอร์",
  "ปริ้นเตอร์": "พรินเตอร์", "ปริ๊นเตอร์": "พรินเตอร์", "เซิฟเวอร์": "เซิร์ฟเวอร์", "เซิร์ฟเวอ": "เซิร์ฟเวอร์", "เซิร์ฟเวอร์์": "เซิร์ฟเวอร์",
  "ออฟฟิต": "ออฟฟิศ", "ออฟฟิส": "ออฟฟิศ", "แอร์์": "แอร์", "มิเตอร์์": "มิเตอร์",
  "อำเถอ": "อำเภอ", "อำเพอ": "อำเภอ", "ตำบน": "ตำบล", "จังหวัค": "จังหวัด", "จังหวัต": "จังหวัด",
  "กระทรวน": "กระทรวง", "มหาวิทยาลับ": "มหาวิทยาลัย", "มหาวิทยาไล": "มหาวิทยาลัย", "โรงพยาบาน": "โรงพยาบาล", "โรงเรีบน": "โรงเรียน",
  "เทศบาน": "เทศบาล", "องค์การบริหารส่วนตำบน": "องค์การบริหารส่วนตำบล", "กองทัพอากาส": "กองทัพอากาศ", "กองทัพอากาษ": "กองทัพอากาศ",
};

/** คำหลักที่ใช้ตรวจแบบใกล้เคียง (ผิด 1 ตัวอักษร) — เฉพาะคำยาว ≥ 5 ตัวอักษร กันเตือนพลาด */
const KEY_WORDS = [
  "บริษัท", "จำกัด", "มหาชน", "ห้างหุ้นส่วนจำกัด", "ห้างหุ้นส่วนสามัญ", "สำนักงานใหญ่", "สำนักงาน", "กรุงเทพมหานคร",
  "กระทรวง", "มหาวิทยาลัย", "โรงพยาบาล", "โรงเรียน", "เทศบาล", "องค์การบริหารส่วนตำบล", "องค์การบริหารส่วนจังหวัด",
  "กองทัพอากาศ", "กองทัพบก", "กองทัพเรือ", "รัฐวิสาหกิจ", "การไฟฟ้า", "การประปา",
  "คอมพิวเตอร์", "ซอฟต์แวร์", "เซิร์ฟเวอร์", "อินเทอร์เน็ต", "กล้องวงจรปิด", "เบรกเกอร์", "อุปกรณ์", "ติดตั้ง", "บำรุงรักษา",
];
const THAI_MISSPELL_RE = new RegExp(Object.keys(COMMON_MISSPELLINGS).sort((a, b) => b.length - a.length).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g");

/** ระยะแก้ไข (Levenshtein) ตามตัวอักษร (code point) */
export function editDistance(a: string, b: string, max = Infinity): number {
  const A = Array.from(a), B = Array.from(b);
  if (Math.abs(A.length - B.length) > max) return max + 1;
  let prev = Array.from({ length: B.length + 1 }, (_, j) => j);
  for (let i = 1; i <= A.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= B.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (A[i - 1] === B[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[B.length];
}

const TONES = "่-๋";            // ่ ้ ๊ ๋
const ABOVE = "ัิ-ื็์ํ"; // ั ิ ี ึ ื ็ ์ ํ
const BELOW = "ุ-ฺ";            // ุ ู ฺ
const LEADING = "เ-ไ";          // เ แ โ ใ ไ
const COMBINING = `${TONES}${ABOVE}${BELOW}`;

/** คำผิดเชิงโครงสร้างของอักษรไทย */
function structuralTypos(text: string): Typo[] {
  const out: Typo[] = [];
  const add = (re: RegExp, reason: string, fix: (m: string) => string) => {
    for (const m of text.match(re) || []) out.push({ wrong: m, suggest: fix(m), reason });
  };
  add(new RegExp(`([${COMBINING}])\\1+`, "g"), "เครื่องหมายซ้ำ", (m) => m[0]);
  add(new RegExp(`[${TONES}][${TONES}]`, "g"), "วรรณยุกต์ซ้อน", (m) => m[m.length - 1]);
  // สระบนซ้อน — ยกเว้นทัณฑฆาตบนสระ (ศักดิ์ สิทธิ์ ภูมิ์) ซึ่งถูกต้อง
  add(new RegExp(`[${ABOVE}][${ABOVE.replace("์", "")}]`, "g"), "สระบนซ้อน", (m) => m[m.length - 1]);
  add(new RegExp(`(^|[\\s(])[${COMBINING}]+`, "g"), "สระ/วรรณยุกต์ขึ้นต้นคำ", (m) => m.replace(new RegExp(`[${COMBINING}]+`, "g"), ""));
  add(new RegExp(`[${LEADING}](?=$|[\\s${LEADING}${COMBINING}\\u0E30-\\u0E33])`, "g"), "สระหน้าไม่มีพยัญชนะตาม", () => "");
  return out;
}

/** หาคำที่อาจพิมพ์ผิดในข้อความ (ไม่รวมการปรับรูปแบบอัตโนมัติ) */
export function findTypos(raw: unknown): Typo[] {
  const text = normalizeThaiText(raw).text;
  if (!/[฀-๿]/.test(text)) return [];
  const out: Typo[] = [];
  const seen = new Set<string>();
  const push = (t: Typo) => { const k = `${t.wrong}>${t.suggest}`; if (!seen.has(k) && t.wrong !== t.suggest) { seen.add(k); out.push(t); } };

  // ข้ามจุดที่เป็นคำที่ถูกอยู่แล้ว (คำผิดบางคำเป็นส่วนต้นของคำที่ถูก เช่น "เบรกเกอ" ใน "เบรกเกอร์")
  for (const m of text.matchAll(THAI_MISSPELL_RE)) {
    const right = COMMON_MISSPELLINGS[m[0]];
    if (text.startsWith(right, m.index!) || text.slice(Math.max(0, m.index! - right.length), m.index! + m[0].length + right.length).includes(right)) continue;
    push({ wrong: m[0], suggest: right, reason: "สะกดผิดบ่อย" });
  }
  structuralTypos(text).forEach(push);

  // ใกล้เคียงคำหลัก 1 ตัวอักษร — ตรวจบนข้อความที่แก้ข้างบนแล้ว (ไม่เสนอแก้ซ้ำจุดเดิม)
  // คำสั้น (< 7 ตัว) นับเฉพาะพิมพ์ผิดแทนที่ 1 ตัว ความยาวเท่าเดิม กันเตือนพลาดกลางคำอื่น เช่น "มหาน" ใน "มหานคร"
  let fixed = text;
  for (const t of out) fixed = fixed.split(t.wrong).join(t.suggest);
  const chars = Array.from(fixed);
  for (const w of KEY_WORDS) {
    const L = Array.from(w).length;
    if (L < 5 || fixed.includes(w)) continue;
    for (const len of L >= 7 ? [L, L - 1, L + 1] : [L]) {
      let hit = "";
      for (let i = 0; i + len <= chars.length && !hit; i++) {
        const piece = chars.slice(i, i + len).join("");
        if (/[s()]/.test(piece) || KEY_WORDS.includes(piece)) continue;
        if (editDistance(piece, w, 1) === 1) hit = piece;
      }
      if (hit) { push({ wrong: hit, suggest: w, reason: "ใกล้เคียงคำที่ถูก" }); fixed = fixed.split(hit).join(w); break; }
    }
  }
  return out;
}

/** แก้ตามคำแนะนำทั้งหมด */
export function applyTypoFixes(raw: unknown, typos: Typo[] = findTypos(raw)): string {
  let text = normalizeThaiText(raw).text;
  // ตามลำดับที่พบ (คำผิดบ่อย → โครงสร้าง → ใกล้เคียง) เพราะคำแนะนำหลังคิดจากข้อความที่แก้ก่อนหน้าแล้ว
  for (const t of typos) text = text.split(t.wrong).join(t.suggest);
  return normalizeThaiText(text).text;
}

// ---------- ที่อยู่ ----------

export interface AddressRow { district: string; amphoe: string; province: string; zipcode: number | string }
export interface AddressIndex { provinces: string[]; amphoes: Map<string, string[]>; tambons: Map<string, { name: string; zip: string }[]> }

export function buildAddressIndex(rows: AddressRow[]): AddressIndex {
  const amphoes = new Map<string, Set<string>>(), tambons = new Map<string, { name: string; zip: string }[]>();
  for (const r of rows || []) {
    if (!amphoes.has(r.province)) amphoes.set(r.province, new Set());
    amphoes.get(r.province)!.add(r.amphoe);
    const k = `${r.province}|${r.amphoe}`;
    if (!tambons.has(k)) tambons.set(k, []);
    tambons.get(k)!.push({ name: r.district, zip: String(r.zipcode) });
  }
  return { provinces: Array.from(amphoes.keys()), amphoes: new Map(Array.from(amphoes, ([p, s]) => [p, Array.from(s)])), tambons };
}

const stripPrefix = (v: unknown, re: RegExp) => String(v ?? "").trim().replace(re, "").trim();
const closest = (value: string, options: string[], maxRatio = 0.34): string | null => {
  let best: string | null = null, bestD = Infinity;
  for (const o of options) {
    const d = editDistance(value, o, Math.max(1, Math.ceil(Array.from(o).length * maxRatio)));
    if (d < bestD) { bestD = d; best = o; }
  }
  return best && bestD <= Math.max(1, Math.ceil(Array.from(best).length * maxRatio)) ? best : null;
};

export interface AddressIssue { field: "province" | "district" | "subDistrict" | "zipCode"; value: string; suggest: string; message: string }

/** ตรวจจังหวัด → อำเภอ/เขต → ตำบล/แขวง → รหัสไปรษณีย์ ตามลำดับ (ช่องว่างไม่ตรวจ) */
export function checkThaiAddress(a: { province?: unknown; district?: unknown; subDistrict?: unknown; zipCode?: unknown }, idx: AddressIndex): AddressIssue[] {
  const out: AddressIssue[] = [];
  let province = stripPrefix(a.province, /^(จังหวัด|จ\.)\s*/);
  if (/^(กทม\.?|กรุงเทพฯ?)$/.test(province)) province = "กรุงเทพมหานคร";
  if (!province) return out;
  if (!idx.provinces.includes(province)) {
    const s = closest(province, idx.provinces);
    out.push({ field: "province", value: String(a.province), suggest: s || "", message: s ? `จังหวัด "${province}" → ${s}` : `ไม่พบจังหวัด "${province}"` });
    if (!s) return out;
    province = s;
  }
  const district = stripPrefix(a.district, /^(อำเภอ|เขต|อ\.)\s*/);
  if (!district) return out;
  const amphoes = idx.amphoes.get(province) || [];
  let amphoe = district;
  if (!amphoes.includes(district)) {
    const s = closest(district, amphoes);
    out.push({ field: "district", value: String(a.district), suggest: s || "", message: s ? `อำเภอ/เขต "${district}" → ${s}` : `ไม่พบอำเภอ/เขต "${district}" ใน${province}` });
    if (!s) return out;
    amphoe = s;
  }
  const tambons = idx.tambons.get(`${province}|${amphoe}`) || [];
  const sub = stripPrefix(a.subDistrict, /^(ตำบล|แขวง|ต\.)\s*/);
  let zips = Array.from(new Set(tambons.map((t) => t.zip)));
  if (sub) {
    const names = tambons.map((t) => t.name);
    let tambon = sub;
    if (!names.includes(sub)) {
      const s = closest(sub, names);
      out.push({ field: "subDistrict", value: String(a.subDistrict), suggest: s || "", message: s ? `ตำบล/แขวง "${sub}" → ${s}` : `ไม่พบตำบล/แขวง "${sub}" ใน${amphoe}` });
      tambon = s || "";
    }
    if (tambon) zips = tambons.filter((t) => t.name === tambon).map((t) => t.zip);
  }
  const zip = String(a.zipCode ?? "").replace(/\D/g, "");
  if (zip && zips.length && !zips.includes(zip)) out.push({ field: "zipCode", value: zip, suggest: zips.length === 1 ? zips[0] : "", message: `รหัสไปรษณีย์ ${zip} ไม่ตรงพื้นที่ (ควรเป็น ${zips.join(" / ")})` });
  return out;
}
