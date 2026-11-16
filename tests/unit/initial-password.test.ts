import { describe, expect, it } from "vitest";
import { authPassword, INITIAL_PASSWORD, INITIAL_PASSWORD_AUTH } from "@/lib/initial-password";

describe("รหัสผ่านเริ่มต้น 0000", () => {
  it("หน้าล็อกอินแปลง 0000 เป็นรหัสที่เก็บใน Firebase (อย่างน้อย 6 ตัว) · รหัสอื่นส่งตามเดิม", () => {
    expect(INITIAL_PASSWORD).toBe("0000");
    expect(INITIAL_PASSWORD_AUTH.length).toBeGreaterThanOrEqual(6);
    expect(authPassword("0000")).toBe(INITIAL_PASSWORD_AUTH);
    expect(authPassword("Nexus2026x")).toBe("Nexus2026x");
    expect(authPassword("00000")).toBe("00000");
  });
});
