/**
 * [MASTER-STRATEGY-ID]
 * Nexus Intelligence Sequence Engine V1.0
 * ระบบรันเลขเอกสารอัจฉริยะสำหรับ Enterprise ERP
 * ออกเลขที่ server เท่านั้น: sequence-server.ts (ใน API) หรือ nextDocumentNumber() จาก sequence-client.ts
 */

export type SequencePrefix = "NXI" | "INV" | "POS" | "QT" | "PRJ" | "SO" | "PO" | "FIN" | "EXP" | "CUS" | "EMP" | "SUP" | "PRD" | "WO" | "DN" | "PR" | "WHT" | "RE" | "RV" | "PV" | "RF" | "GR" | "IV" | "TAX" | "JOB" | "TK" | "BL" | "CN" | "DBN" | "PB" | "ADV";

export interface ResolvedSequenceFormat {
  prefixPart: string; // ส่วนหน้าเลขลำดับ (ใช้เป็นเงื่อนไขรีเซ็ต: เปลี่ยนเมื่อขึ้นเดือน/ปีใหม่)
  suffixPart: string;
  padLength: number;
}

/**
 * แปลง format เช่น `QT-[YYMM]-[0000]` เป็นส่วนประกอบของเลขเอกสาร ณ เวลา `now`
 * ใช้ร่วมกันระหว่างหน้าจอ (แสดงตัวอย่างรูปแบบเลข) และ server (sequence-server.ts)
 */
export function resolveSequenceFormat(prefix: string, formatStr: string | undefined, now: Date = new Date()): ResolvedSequenceFormat {
  const format = formatStr || `${prefix}-[YYMM]-[0000]`; // Fallback default

  const YYYY = now.getFullYear().toString();
  const YY = YYYY.slice(-2);
  const BBBB = (now.getFullYear() + 543).toString();
  const BB = BBBB.slice(-2);
  const MM = (now.getMonth() + 1).toString().padStart(2, '0');
  const DD = now.getDate().toString().padStart(2, '0');

  // Parse Date Tokens (Case Insensitive) รวมถึงแบบผสมในวงเล็บเดียว เช่น [BBMM], [YYMM], [YYYYMMDD]
  const DATE_PARTS: Record<string, string> = { YYYY, YY, BBBB, BB, MM, DD };
  const resolvedFormat = format
    .replace(/\[PREFIX\]/gi, prefix)
    .replace(/\[((?:YYYY|YY|BBBB|BB|MM|DD)+)\]/gi, (_match, token: string) =>
      (token.toUpperCase().match(/YYYY|YY|BBBB|BB|MM|DD/g) || []).map((part) => DATE_PARTS[part]).join("")
    );

  // Extract Zero Pad Token (e.g. [0000] or 0000)
  const zeroMatch = resolvedFormat.match(/\[(0+)\]/) || resolvedFormat.match(/(0{3,})/);
  let padLength = 4;
  let zeroToken = '[0000]';

  if (zeroMatch) {
    zeroToken = zeroMatch[0];
    padLength = zeroMatch[1] ? zeroMatch[1].length : zeroToken.length;
  }

  const parts = resolvedFormat.split(zeroToken);
  return {
    prefixPart: parts[0],
    suffixPart: parts.length > 1 ? parts[1] : "",
    padLength
  };
}
