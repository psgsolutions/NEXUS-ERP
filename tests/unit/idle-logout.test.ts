import { describe, expect, it } from "vitest";
import { IDLE_LIMIT, IDLE_WARN, idleRemaining } from "@/lib/session-guard";

describe("ปล่อยหน้าจอทิ้งไว้ 30 นาที → ออกจากระบบ", () => {
  it("30 นาที เตือนล่วงหน้า 2 นาที", () => {
    expect(IDLE_LIMIT).toBe(30 * 60_000);
    expect(IDLE_WARN).toBe(2 * 60_000);
  });
  it("เหลือเวลา = 30 นาที − เวลาที่ไม่มีการใช้งาน (ไม่ติดลบ) · ยังไม่เคยบันทึก = เต็มเวลา", () => {
    const now = 10_000_000_000;
    expect(idleRemaining(now, now - 10 * 60_000)).toBe(20 * 60_000);
    expect(idleRemaining(now, now - 29 * 60_000)).toBeLessThanOrEqual(IDLE_WARN);
    expect(idleRemaining(now, now - 31 * 60_000)).toBe(0);
    expect(idleRemaining(now, now - 5 * 3600_000)).toBe(0); // เครื่องหลับนาน
    expect(idleRemaining(now, 0)).toBe(IDLE_LIMIT);
  });
});

import { idleExempt } from "@/lib/session-guard";
describe("เครื่อง POS ไม่ออกอัตโนมัติ", () => {
  it("ยกเว้นเฉพาะหน้าขาย POS", () => {
    expect(idleExempt("/pos")).toBe(true);
    expect(idleExempt("/pos/x")).toBe(true);
    expect(idleExempt("/possible")).toBe(false);
    expect(idleExempt("/sales")).toBe(false);
    expect(idleExempt(null)).toBe(false);
  });
});
