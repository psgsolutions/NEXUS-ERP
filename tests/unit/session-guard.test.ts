import { describe, expect, it } from "vitest";
import { otherTabsAlive } from "@/lib/session-guard";

describe("นโยบายปิดทุกแท็บแล้วต้องล็อกอินใหม่", () => {
  const now = 1_000_000;
  it("นับเฉพาะแท็บอื่นที่ยังเปิดอยู่ (ไม่เกิน 2 นาที)", () => {
    expect(otherTabsAlive("me", now, {})).toBe(0);
    expect(otherTabsAlive("me", now, { me: now })).toBe(0);
    expect(otherTabsAlive("me", now, { me: now, a: now - 5_000 })).toBe(1);
    expect(otherTabsAlive("me", now, { a: now - 119_000, b: now - 121_000 })).toBe(1);
  });
});
