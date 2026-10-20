/**
 * หนังสือที่ใช้บ่อยในงานโครงการ/ราชการ (ฟังก์ชันล้วน) — เติมข้อมูลจากโครงการ สัญญา ลูกค้า ให้อัตโนมัติ แล้วแก้ข้อความได้ก่อนพิมพ์
 *  - SITE_ACCESS: ขออนุญาตเข้าพื้นที่ปฏิบัติงาน (รายชื่อผู้ปฏิบัติงาน/ทะเบียนรถ)
 *  - HANDOVER: ส่งมอบงาน (ขอให้ตรวจรับ)
 *  - GUARANTEE_RETURN: ขอคืนหลักประกันสัญญา (พ้นระยะรับประกันแล้ว)
 */

export type LetterKind = "SITE_ACCESS" | "HANDOVER" | "GUARANTEE_RETURN";
export const LETTER_LABELS: Record<LetterKind, string> = { SITE_ACCESS: "หนังสือขออนุญาตเข้าพื้นที่", HANDOVER: "หนังสือส่งมอบงาน", GUARANTEE_RETURN: "หนังสือขอคืนหลักประกัน" };

export interface LetterContext {
  customerName: string;
  projectName: string;
  contractNo?: string;
  orderNo?: string;
  signDate?: string;
  contractValue?: number;
  handoverDate?: string;
  warrantyEnd?: string;
  guarantee?: { label: string; number?: string; issuer?: string; amount: number };
  /** เข้าพื้นที่ */
  from?: string;
  to?: string;
  workers?: string[];
  vehicles?: string;
  location?: string;
  sellerName: string;
}

export interface LetterContent { subject: string; refs: string[]; attachments: string[]; body: string[] }

const thaiDate = (d?: string) => {
  if (!d) return "........";
  const t = new Date(`${d}T00:00:00Z`);
  return t.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
};
const money = (n?: number) => (n ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const contractRef = (c: LetterContext) =>
  c.contractNo ? `สัญญาเลขที่ ${c.contractNo}${c.signDate ? ` ลงวันที่ ${thaiDate(c.signDate)}` : ""}` : c.orderNo ? `ใบสั่งซื้อ/ใบสั่งจ้างเลขที่ ${c.orderNo}` : "";

export function buildLetter(kind: LetterKind, c: LetterContext): LetterContent {
  const ref = contractRef(c);
  if (kind === "SITE_ACCESS") {
    const workers = (c.workers || []).filter(Boolean);
    return {
      subject: `ขออนุญาตเข้าพื้นที่ปฏิบัติงาน ${c.projectName}`,
      refs: ref ? [ref] : [],
      attachments: workers.length ? [`รายชื่อผู้ปฏิบัติงาน จำนวน ${workers.length} คน`] : [],
      body: [
        `ตามที่ ${c.sellerName} ได้รับมอบหมายให้ดำเนินงาน ${c.projectName}${ref ? ` ตาม${ref}` : ""} นั้น`,
        `บริษัทฯ ขออนุญาตนำผู้ปฏิบัติงานเข้าพื้นที่${c.location ? ` ${c.location}` : ""} ระหว่างวันที่ ${thaiDate(c.from)} ถึงวันที่ ${thaiDate(c.to)}${c.vehicles ? ` โดยใช้ยานพาหนะทะเบียน ${c.vehicles}` : ""} รายชื่อผู้ปฏิบัติงานดังนี้`,
        ...workers.map((w, i) => `${i + 1}. ${w}`),
        "บริษัทฯ จะปฏิบัติตามระเบียบของหน่วยงานอย่างเคร่งครัด จึงเรียนมาเพื่อโปรดพิจารณาอนุญาต",
      ],
    };
  }
  if (kind === "HANDOVER") {
    return {
      subject: `ส่งมอบงาน ${c.projectName}`,
      refs: ref ? [ref] : [],
      attachments: ["ใบส่งของ / รายการอุปกรณ์", "ใบแจ้งหนี้ / ใบกำกับภาษี", "รูปถ่ายผลงาน"],
      body: [
        `ตามที่ ${c.customerName} ได้ตกลงจ้าง ${c.sellerName} ดำเนินงาน ${c.projectName}${ref ? ` ตาม${ref}` : ""}${c.contractValue ? ` เป็นเงิน ${money(c.contractValue)} บาท` : ""} นั้น`,
        `บัดนี้ บริษัทฯ ได้ดำเนินงานแล้วเสร็จครบถ้วนตามสัญญา${c.handoverDate ? ` เมื่อวันที่ ${thaiDate(c.handoverDate)}` : ""} จึงขอส่งมอบงานและขอให้คณะกรรมการตรวจรับพัสดุดำเนินการตรวจรับต่อไป`,
        "จึงเรียนมาเพื่อโปรดพิจารณา",
      ],
    };
  }
  const g = c.guarantee;
  return {
    subject: `ขอคืน${g?.label || "หลักประกันสัญญา"}`,
    refs: ref ? [ref] : [],
    attachments: [],
    body: [
      `ตามที่ ${c.sellerName} ได้วาง${g?.label || "หลักประกันสัญญา"}${g?.number ? ` เลขที่ ${g.number}` : ""}${g?.issuer ? ` ของ${g.issuer}` : ""} จำนวนเงิน ${money(g?.amount)} บาท ไว้กับ ${c.customerName} สำหรับงาน ${c.projectName}${ref ? ` ตาม${ref}` : ""} นั้น`,
      `บัดนี้ บริษัทฯ ได้ปฏิบัติตามสัญญาครบถ้วน${c.warrantyEnd ? ` และพ้นระยะเวลารับประกันความชำรุดบกพร่องแล้วเมื่อวันที่ ${thaiDate(c.warrantyEnd)}` : ""} จึงขอรับหลักประกันดังกล่าวคืน`,
      "จึงเรียนมาเพื่อโปรดพิจารณาดำเนินการ",
    ],
  };
}
