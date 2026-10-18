import { describe, expect, it } from "vitest";
import { invoiceReminders, milestoneReminders } from "@/lib/reminders";

const inv = (id: string, dueDate: string, extra: any = {}) => ({ id, data: { invoiceNo: id, customerName: "ลูกค้า", dueDate, grandTotal: 1000, balance: 1000, paymentStatus: "unpaid", status: "issued", ...extra } });

describe("invoice reminders", () => {
  const today = "2026-10-18";
  it("due within 3 days and overdue buckets", () => {
    const r = invoiceReminders([
      inv("A", "2026-10-20"),             // ใกล้ครบ
      inv("B", "2026-10-25"),             // ยังไกล
      inv("C", "2026-10-17"),             // เลย 1 วัน
      inv("D", "2026-10-11"),             // เลย 7 วัน
      inv("E", "2026-10-14"),             // เลย 4 วัน -> อยู่ในช่วง 1 (key เดิม ไม่แจ้งซ้ำ)
      inv("F", "2026-09-01"),             // เลย 47 วัน -> ช่วง 30
      inv("G", "2026-10-10", { paymentStatus: "paid", balance: 0 }),
      inv("H", "2026-10-10", { status: "cancelled" }),
    ], today);
    expect(r.map((x) => [x.invoiceId, x.kind, x.key])).toEqual([
      ["A", "due_soon", "due-2026-10-20"], ["C", "overdue", "od1-2026-10-17"], ["D", "overdue", "od7-2026-10-11"],
      ["E", "overdue", "od1-2026-10-14"], ["F", "overdue", "od30-2026-09-01"],
    ]);
  });
});

describe("milestone reminders", () => {
  const project = { status: "In Progress", projectId: "PRJ-1", projectName: "งาน", milestones: [
    { id: "m1", name: "งวด 1", amount: 1000, endDate: "2026-10-01", progress: 50 },   // เลยกำหนด
    { id: "m2", name: "งวด 2", amount: 1000, endDate: "2026-12-01", progress: 100 },  // เสร็จแล้ว
    { id: "m3", name: "งวด 3", amount: 1000, endDate: "2026-12-31", progress: 20 },   // ยังไม่ถึง
    { id: "m4", name: "งวด 4", amount: 1000, endDate: "2026-10-01", progress: 100 },  // เรียกเก็บแล้ว
  ] };
  it("lists unbilled milestones that are due or complete", () => {
    const r = milestoneReminders("doc1", project, new Set(["m4"]), "2026-10-18");
    expect(r.map((x) => [x.milestoneId, x.reason])).toEqual([["m1", "due"], ["m2", "completed"]]);
  });
  it("ignores draft projects", () => {
    expect(milestoneReminders("doc1", { ...project, status: "Draft" }, new Set(), "2026-10-18")).toEqual([]);
  });
});
