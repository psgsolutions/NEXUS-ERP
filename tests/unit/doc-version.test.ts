import { describe, expect, it } from "vitest";
import { isStaleVersion, versionOf } from "@/lib/doc-version";

describe("doc-version (C-13)", () => {
  it("reads Timestamp-like, ISO, Date, number and {seconds}", () => {
    expect(versionOf({ toMillis: () => 1234 })).toBe(1234);
    expect(versionOf("2026-10-30T00:00:00.000Z")).toBe(Date.parse("2026-10-30T00:00:00.000Z"));
    expect(versionOf(new Date(5000))).toBe(5000);
    expect(versionOf(42)).toBe(42);
    expect(versionOf({ seconds: 2, nanoseconds: 5_000_000 })).toBe(2005);
    expect(versionOf(null)).toBe(0);
    expect(versionOf("not a date")).toBe(0);
  });

  it("flags only a real mismatch", () => {
    expect(isStaleVersion(1000, { toMillis: () => 1000 })).toBe(false);
    expect(isStaleVersion(1000, { toMillis: () => 2000 })).toBe(true);
    // หน้าจอเก่าไม่ส่งเวอร์ชัน / เอกสารเก่าไม่มี updatedAt = ไม่ตรวจ
    expect(isStaleVersion(undefined, { toMillis: () => 2000 })).toBe(false);
    expect(isStaleVersion(1000, undefined)).toBe(false);
  });
});
