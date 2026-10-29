import { describe, expect, it } from "vitest";
import { assertPeriodOpen } from "@/lib/period-close-service";

// ตัวอ่านงวดจำลองการตอบของ Firestore (ฟังก์ชันจริงทั้งหมด ยกเว้นแหล่งข้อมูล)
const closed = (...rows: any[]) => async () => rows;

describe("period lock (C-04: fail closed)", () => {
  it("rejects posting into a closed month", async () => {
    await expect(assertPeriodOpen("C1", "2026-09-15", closed({ companyId: "C1", status: "closed", periodYear: 2026, periodMonth: 9 })))
      .rejects.toThrow("ปิดงบแล้ว: กันยายน 2569");
  });

  it("allows posting into an open month", async () => {
    await expect(assertPeriodOpen("C1", "2026-10-01", closed({ periodYear: 2026, periodMonth: 9 }))).resolves.toBe(true);
  });

  it("recognises legacy period records (Thai/English month names, string year)", async () => {
    await expect(assertPeriodOpen("C1", "2026-08-31", closed({ year: "2026", month: "สิงหาคม" }))).rejects.toThrow("ปิดงบแล้ว");
    await expect(assertPeriodOpen("C1", "2026-07-02", closed({ year: 2026, month: "July" }))).rejects.toThrow("ปิดงบแล้ว");
    await expect(assertPeriodOpen("C1", "2026-06-02", closed({ year: 2026, month: "06" }))).rejects.toThrow("ปิดงบแล้ว");
  });

  it("uses Thai time for the period (late-night UTC still counts as the Thai day)", async () => {
    // 2026-09-30T18:00Z = 1 ต.ค. 01:00 เวลาไทย → งวดตุลาคม (เปิด) แม้กันยายนปิดแล้ว
    await expect(assertPeriodOpen("C1", new Date("2026-09-30T18:00:00Z"), closed({ periodYear: 2026, periodMonth: 9 }))).resolves.toBe(true);
  });

  it("refuses to post when the period records cannot be read", async () => {
    const failing = async () => { throw new Error("DEADLINE_EXCEEDED"); };
    await expect(assertPeriodOpen("C1", "2026-10-01", failing)).rejects.toThrow("ตรวจสอบงวดบัญชีไม่สำเร็จ");
  });

  it("refuses to post without a company", async () => {
    await expect(assertPeriodOpen("", "2026-10-01", closed())).rejects.toThrow("ไม่พบรหัสบริษัท");
  });
});
