/**
 * เจ้าหนี้ / ค่าใช้จ่ายค้างจ่าย — ใช้ร่วมกันทั้งหน้าจอและ server
 */

/** กลุ่มผู้รับเงิน: ผู้จำหน่าย (supplierId) / พนักงาน (เบิกค่าใช้จ่าย) / ชื่อผู้รับ */
export function payeeKeyOf(e: any): string {
  if (e.supplierId) return `SUP:${e.supplierId}`;
  if (e.employeeId) return `EMP:${e.employeeId}`;
  return `NAME:${String(e.supplierName || e.vendor || "-").trim()}`;
}

export const EXPENSE_ACCOUNTS = [
  { code: "5300-00", name: "ค่าใช้จ่ายเบ็ดเตล็ดทั่วไป" },
  { code: "5301-00", name: "ค่าเดินทางและพาหนะ" },
  { code: "5302-00", name: "ค่ารับรองลูกค้า" },
  { code: "5303-00", name: "ค่าวัสดุสิ้นเปลืองสำนักงาน" },
];

// รหัสรูปแบบเก่า 53000-0X (5 หลัก) -> 530X-00 ให้ตรงผังบัญชีของระบบ
const LEGACY_CODE = /^53000-0(\d)$/;

/** บัญชีค่าใช้จ่ายของรายการ (กรณียังไม่ได้ตั้งเจ้าหนี้ไว้) */
export function expenseAccountOf(e: any): { code: string; name: string } {
  const raw = String(e.expenseAccountCode || "").trim();
  const m = raw.match(LEGACY_CODE);
  const code = m ? `530${m[1]}-00` : raw;
  return EXPENSE_ACCOUNTS.find((a) => a.code === code) || (code ? { code, name: "ค่าใช้จ่าย" } : EXPENSE_ACCOUNTS[0]);
}

/**
 * แนะนำรหัสบัญชีค่าใช้จ่ายจากประวัติของบริษัท (ฟังก์ชันล้วน)
 * ให้คะแนนรายการเดิม: ผู้รับเงิน/ร้านเดียวกัน +5 · คำในรายละเอียดตรงกัน +1 ต่อคำ (ตัดคำไทยด้วย Intl.Segmenter)
 * รวมคะแนนตามรหัสบัญชี เลือกสูงสุด — ไม่มีอะไรตรง = ไม่แนะนำ
 */
export function suggestExpenseAccount(history: { expenseAccountCode?: string; description?: string; vendor?: string; supplierName?: string }[], input: { description?: string; vendor?: string }): { code: string; name: string; matches: number } | null {
  const seg = typeof Intl !== "undefined" && (Intl as any).Segmenter ? new (Intl as any).Segmenter("th", { granularity: "word" }) : null;
  const words = (s?: string) => new Set<string>(
    (seg ? Array.from(seg.segment(String(s || "").toLowerCase()), (x: any) => (x.isWordLike ? x.segment : "")) : String(s || "").toLowerCase().split(/\s+/))
      .map((w) => w.trim()).filter((w) => w.length >= 2),
  );
  const want = words(input.description), vendor = String(input.vendor || "").trim().toLowerCase();
  const score = new Map<string, { s: number; n: number }>();
  for (const h of history) {
    const code = String(h.expenseAccountCode || "");
    if (!EXPENSE_ACCOUNTS.some((a) => a.code === code)) continue;
    let s = 0;
    const hv = String(h.vendor || h.supplierName || "").trim().toLowerCase();
    if (vendor && hv && hv === vendor) s += 5;
    for (const w of words(h.description)) if (want.has(w)) s += 1;
    if (!s) continue;
    const cur = score.get(code) || { s: 0, n: 0 };
    score.set(code, { s: cur.s + s, n: cur.n + 1 });
  }
  const best = [...score.entries()].sort((a, b) => b[1].s - a[1].s)[0];
  if (!best) return null;
  return { code: best[0], name: EXPENSE_ACCOUNTS.find((a) => a.code === best[0])!.name, matches: best[1].n };
}
