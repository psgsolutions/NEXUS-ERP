import { describe, expect, it } from "vitest";
import { addDays, checkPlan, defaultProfile, generatePlan, installmentsFromTimeline, methodCode, normalizeOverrides, normalizeProfile, timelineFromInstallments, type PlanContext, type PlanProfile } from "@/lib/project-plan";

const ctx = (x: Partial<PlanContext> = {}): PlanContext => ({
  sector: "Government", contracted: false, method: "e-bidding", planStart: "2027-01-04", contractStart: "2027-04-01",
  durationDays: 120, warrantyMonths: 24, installable: true, ...x,
});
const prof = (x: Partial<PlanProfile> = {}): PlanProfile => ({
  ...defaultProfile("Government"),
  systems: ["cctv"],
  sites: [{ name: "อาคาร A", env: "indoor", points: 40 }],
  installments: [{ no: 1, dueDay: 60, payPct: 40, points: 16, scope: "" }, { no: 2, dueDay: 120, payPct: 60, points: 24, scope: "" }],
  ...x,
});
const ids = (p: PlanProfile, c = ctx()) => generatePlan(p, c).tasks.map((t) => t.id);

describe("แผนงานโครงการจากแม่แบบ", () => {
  it("งานตามเงื่อนไข: ระบบเดิม / นอกอาคาร / ห้องควบคุม / งานไฟฟ้า / modules", () => {
    const base = ids(prof());
    expect(base).not.toContain("P1.3");
    expect(base).not.toContain("P1.5");
    expect(base).toContain("P4.5");
    expect(base).toContain("M.cctv.storage");
    const more = ids(prof({ legacySystem: "DSS Pro", sites: [{ name: "ลานจอด", env: "outdoor", points: 40 }], controlRoom: "new", electricalWork: false }));
    expect(more).toEqual(expect.arrayContaining(["P1.3", "P4.3", "P1.5", "P1.7", "P4.10", "P4.9", "P5.1.civil"]));
    expect(more).not.toContain("P4.5");
  });
  it("งวดติดตั้งสร้างงานย่อยต่องวด · เดินสาย = จุด ÷ จุดต่อวัน · เริ่มหลังอนุมัติแบบ", () => {
    const r = generatePlan(prof(), ctx());
    const cab1 = r.tasks.find((t) => t.id === "P5.1.cabling")!;
    const approve = r.tasks.find((t) => t.id === "P4.6")!;
    expect(cab1.days).toBe(2); // 16 จุด ÷ 8
    expect(cab1.start > approve.end).toBe(true);
    expect(r.tasks.find((t) => t.id === "P5.2.handover")!.deadline).toBe(addDays("2027-04-01", 120));
  });
  it("วันเริ่มประกัน = วันถัดจากตรวจรับงวดสุดท้าย · PM ทุก 6 เดือนตลอด 24 เดือน = 4 รอบ · คืนหลักประกันเมื่อพ้นประกัน", () => {
    const r = generatePlan(prof(), ctx());
    const last = r.tasks.find((t) => t.id === "P6.5")!;
    expect(r.warrantyStart).toBe(addDays(last.end, 1));
    expect(r.tasks.filter((t) => t.id.startsWith("P7.2.")).length).toBe(4);
    expect(r.tasks.find((t) => t.id === "P7.4")!.start).toBe(r.warrantyEnd);
  });
  it("เอกชน: ข้าม TOR/ประกาศ/ยื่นซอง/คืนหลักประกัน · เฉพาะเจาะจง: ไม่มียื่นซอง · ได้งานแล้ว: ไม่วางแผนก่อนสัญญา", () => {
    const pv = ids(prof(), ctx({ sector: "Private" }));
    expect(pv).not.toContain("P2.1");
    expect(pv.some((x) => x.startsWith("P3."))).toBe(false);
    expect(pv).not.toContain("P7.4");
    expect(ids(prof(), ctx({ method: "specific" }))).not.toContain("P3.2");
    expect(ids(prof(), ctx({ contracted: true })).some((x) => /^P[123]\./.test(x))).toBe(false);
  });
  it("วันทำงาน: ข้ามเสาร์-อาทิตย์", () => {
    expect(addDays("2027-01-08", 1, "working")).toBe("2027-01-11"); // ศ. → จ.
    const r = generatePlan(prof({ dayMode: "working" }), ctx({ contracted: true }));
    for (const t of r.tasks.filter((t) => !t.recurring && t.phase < 7)) expect([0, 6]).not.toContain(new Date(`${t.start}T00:00:00Z`).getUTCDay());
  });
  it("เช่า: SLA แทน PM + วางบิลรายเดือน + รื้อถอน · จ้างเหมา: รายงานผู้ควบคุมงาน", () => {
    const rent = generatePlan(prof({ procurement: "rent" }), ctx()).tasks;
    expect(rent.find((t) => t.id === "P7.2.1")!.name).toMatch(/SLA/);
    expect(rent.map((t) => t.id)).toEqual(expect.arrayContaining(["X.rent.bill.1", "X.rent.bill.12", "X.rent.removal"]));
    expect(rent.filter((t) => t.id.startsWith("X.rent.bill.")).length).toBe(12); // ระยะเช่าเริ่มต้น 12 เดือน (ไม่ใช่ระยะประกัน 24)
    expect(generatePlan(prof({ procurement: "hire" }), ctx()).tasks.map((t) => t.id)).toEqual(expect.arrayContaining(["X.hire.report.1", "X.hire.report.3"]));
  });
  it("ปรับแผนเอง: แก้จำนวนวัน ข้ามงาน เพิ่มงานเอง", () => {
    const ov = normalizeOverrides({ tasks: { "P4.2": { days: 2 }, "P4.7": { skip: true } }, custom: [{ id: "U1", name: "ขออนุญาตเข้าพื้นที่", phase: 4, after: ["P4.1"], days: 2, owner: "pm" }] });
    const r = generatePlan(prof(), ctx(), ov);
    expect(r.tasks.find((t) => t.id === "P4.2")!.days).toBe(2);
    expect(r.tasks.find((t) => t.id === "P4.7")!.skipped).toBe(true);
    expect(r.tasks.find((t) => t.id === "U1")!.custom).toBe(true);
  });
});

describe("กฎตรวจแผน", () => {
  const run = (p: PlanProfile, c = ctx(), x = {}) => checkPlan(p, c, generatePlan(p, c), x);
  it("แผนปกติไม่มีข้อหยุด", () => {
    expect(run(prof()).filter((r) => r.level === "stop")).toEqual([]);
  });
  it("R1 จุดไม่ตรงกัน · R2 งวดเงินไม่ครบ 100% = หยุด", () => {
    const r = run(prof({ installments: [{ no: 1, dueDay: 60, payPct: 50, points: 10, scope: "" }] }), ctx(), { boqPoints: 40 });
    expect(r.filter((x) => x.level === "stop").map((x) => x.id)).toEqual(expect.arrayContaining(["R1", "R2"]));
  });
  it("R5 ระบบเดิมแต่ข้ามงานสำรอง Config = หยุด · R8 ข้ามรอบ PM = หยุด", () => {
    const p = prof({ legacySystem: "DSS Pro" });
    const ov = normalizeOverrides({ tasks: { "P4.3": { skip: true }, "P7.2.2": { skip: true } } });
    const r = checkPlan(p, ctx(), generatePlan(p, ctx(), ov));
    expect(r.filter((x) => x.level === "stop").map((x) => x.id)).toEqual(expect.arrayContaining(["R5", "R8"]));
  });
  it("R9 คำถามไม่ระบุงาน · R10 งานนอกอาคารหน้าฝน · R3/R11 เตือน", () => {
    const p = prof({ sites: [{ name: "ลาน", env: "outdoor", points: 40 }], openQuestions: [{ text: "ใช้ห้อง Server เดิมได้ไหม", neededByTask: "" }] });
    const r = run(p, ctx({ contractStart: "2027-05-03" }), { missingDatasheets: ["กล้อง A"], hasPmCost: false });
    expect(r.map((x) => x.id)).toEqual(expect.arrayContaining(["R9", "R10", "R3", "R11"]));
    expect(r.filter((x) => ["R3", "R11", "R9", "R10"].includes(x.id)).every((x) => x.level === "warn")).toBe(true);
  });
});

describe("แปลงข้อมูล", () => {
  it("งวดงาน ⇄ ช่วงงานเดิม", () => {
    const t = timelineFromInstallments([{ no: 1, dueDay: 60, payPct: 40, points: 0, scope: "อาคาร A" }, { no: 2, dueDay: 120, payPct: 60, points: 0, scope: "" }], "2027-04-01");
    expect(t[0]).toMatchObject({ name: "งวดที่ 1 — อาคาร A", startDate: "2027-04-01", endDate: "2027-05-30", weight: 40 });
    expect(t[1].startDate).toBe("2027-05-31");
    expect(installmentsFromTimeline(t, "2027-04-01").map((i) => [i.dueDay, i.payPct, i.scope])).toEqual([[60, 40, "อาคาร A"], [120, 60, ""]]);
  });
  it("วิธีจัดซื้อ และค่าที่ไม่ถูกต้องถูกตัดทิ้ง", () => {
    expect(methodCode("วิธีเฉพาะเจาะจง")).toBe("specific");
    expect(methodCode("วิธีตลาดอิเล็กทรอนิกส์ (e-market)")).toBe("e-market");
    const n = normalizeProfile({ systems: ["cctv", "x"], procurement: "lease", sites: [{ env: "outdoor", points: -5 }], dayMode: "working" });
    expect(n.systems).toEqual(["cctv"]);
    expect(n.procurement).toBe("purchase");
    expect(n.sites[0]).toEqual({ name: "", env: "outdoor", points: 0 });
    expect(n.dayMode).toBe("working");
  });
});

import { isMyTask, planProgress, startedDependents, taskAction, taskBlockers, type SnapTask } from "@/lib/project-plan";
describe("ติดตามงานตามแผน (T4)", () => {
  const tasks: SnapTask[] = generatePlan(prof(), ctx({ contracted: true })).tasks.map((t) => ({ ...t }));
  const t = (id: string) => tasks.find((x) => x.id === id)!;
  it("เดินสายต้องรออนุมัติแบบ · อนุมัติแบบเสร็จแล้วจึงเริ่มได้", () => {
    expect(taskBlockers(t("P5.1.cabling"), tasks, {}).map((x) => x.id)).toContain("P4.6");
    expect(taskBlockers(t("P5.1.cabling"), tasks, { "P4.6": { status: "done" } })).toEqual([]);
  });
  it("ย้อนสถานะไม่ได้ถ้างานถัดไปเริ่มแล้ว", () => {
    expect(startedDependents("P4.1", tasks, { "P4.2": { status: "doing" } }).map((x) => x.id)).toContain("P4.2");
    expect(startedDependents("P4.1", tasks, {})).toEqual([]);
  });
  it("งานของใคร: มอบหมายตรง > ผู้จัดการ (งาน pm/รอหน่วยงาน) > ตามตำแหน่ง", () => {
    const p = { projectManagerUid: "PM" };
    expect(isMyTask(t("P4.1"), p, "PM", [], { status: "todo" })).toBe(true);
    expect(isMyTask(t("P4.6"), p, "PM", [], { status: "todo" })).toBe(true); // รอหน่วยงาน → ผู้จัดการติดตาม
    expect(isMyTask(t("P5.1.cabling"), p, "T1", ["TECHNICIAN"], { status: "todo" })).toBe(true);
    expect(isMyTask(t("P5.1.cabling"), p, "T1", ["TECHNICIAN"], { status: "todo", assigneeUid: "T2" })).toBe(false);
    expect(isMyTask(t("P4.8"), p, "X", ["SALES"], { status: "todo" })).toBe(false);
  });
  it("ลิงก์ทำต่อ: ขอซื้อ / งานติดตั้ง / วางบิล / นัด PM", () => {
    expect(taskAction(t("P4.8"), "D1")!.href).toBe("/projects/D1?tab=boq");
    expect(taskAction(t("P5.1.cabling"), "D1", "โครงการ A")!.href).toMatch(/^\/service\/dispatch\?new=1&type=INSTALL&project=D1/);
    expect(taskAction(t("P5.2.handover"), "D1")!.href).toBe("/projects/D1?tab=billing");
    expect(taskAction(t("P7.2.1"), "D1")!.label).toBe("นัด PM");
  });
  it("ความคืบหน้า: ไม่นับงานช่วงประกัน", () => {
    const p0 = planProgress(tasks, {}, "2099-01-01");
    expect(p0.total).toBe(tasks.filter((x) => x.phase < 7).length);
    expect(p0.overdue).toBe(p0.total);
    expect(planProgress(tasks, { "P4.1": { status: "done" } }, "2000-01-01")).toMatchObject({ done: 1, overdue: 0 });
  });
});

import { billingTimeline, libraryCatalog, normalizeTemplate } from "@/lib/project-plan";
describe("เช่า / จ้างเหมา (T5)", () => {
  it("เช่า: งวดติดตั้ง 30% + ค่าเช่า 70% แบ่ง 12 เดือนนับจากตรวจรับ · รวม 100%", () => {
    const p = prof({ procurement: "rent", installments: [{ no: 1, dueDay: 60, payPct: 30, points: 40, scope: "" }] });
    const r = generatePlan(p, ctx());
    const tl = billingTimeline(p, "2027-04-01", r.warrantyStart);
    expect(tl).toHaveLength(13);
    expect(tl[0].name).toMatch(/^งวดติดตั้งที่ 1/);
    expect(tl[1]).toMatchObject({ name: "ค่าเช่าเดือนที่ 1", startDate: r.warrantyStart });
    expect(Math.round(tl.reduce((s, x) => s + x.weight, 0) * 100) / 100).toBe(100);
    expect(checkPlan(p, ctx(), r).filter((x) => x.id === "R2")).toEqual([]);
  });
  it("เช่า: ไม่มี SLA = เตือน R13 · จ้างเหมา: ผลงานสะสมไม่ถึง 100% = เตือน R12", () => {
    const rent = prof({ procurement: "rent", sla: { responseHours: 0, fixHours: 0, uptimePct: 99 } });
    expect(checkPlan(rent, ctx(), generatePlan(rent, ctx())).map((x) => x.id)).toContain("R13");
    const hire = prof({ procurement: "hire", installments: [{ no: 1, dueDay: 60, payPct: 40, points: 16, scope: "", progressPct: 40 }, { no: 2, dueDay: 120, payPct: 60, points: 24, scope: "", progressPct: 90 }] });
    expect(checkPlan(hire, ctx(), generatePlan(hire, ctx())).find((x) => x.id === "R12")?.level).toBe("warn");
  });
});

describe("แม่แบบของบริษัท (T6)", () => {
  it("แก้ชื่อ/วัน/ผู้รับผิดชอบ ปิดงาน และเพิ่มงานเฉพาะระบบ", () => {
    const tpl = normalizeTemplate({
      tasks: { "P4.2": { name: "สำรวจยืนยันจุดร่วมกับหน่วยงาน", days: 4, owner: "engineer" }, "P4.7": { disabled: true }, "XX": { days: 9 } },
      extra: [{ id: "C1", name: "ขอใบอนุญาตเข้าพื้นที่", phase: 4, after: ["P4.1"], days: 2, owner: "pm" }, { id: "C2", name: "ตั้งค่า Door controller", phase: 6, after: ["P6.1"], days: 2, owner: "engineer", systems: ["access_control"] }],
      defaults: { pointsPerDay: 12 },
    });
    expect(Object.keys(tpl.tasks)).toEqual(["P4.2", "P4.7"]);
    expect(tpl.defaults?.pointsPerDay).toBe(12);
    const r = generatePlan(prof(), ctx({ contracted: true }), { tasks: {}, custom: [] }, tpl);
    const t = r.tasks.find((x) => x.id === "P4.2")!;
    expect([t.name, t.days, t.owner]).toEqual(["สำรวจยืนยันจุดร่วมกับหน่วยงาน", 4, "engineer"]);
    expect(r.tasks.map((x) => x.id)).not.toContain("P4.7");
    expect(r.tasks.map((x) => x.id)).toContain("C1");
    expect(r.tasks.map((x) => x.id)).not.toContain("C2"); // ไม่ได้เลือก Access Control
  });
  it("คลังงานมาตรฐานครบทั้งงานหลักและงานเฉพาะระบบ", () => {
    const cat = libraryCatalog();
    expect(cat.find((x) => x.id === "P4.6")?.owner).toBe("client");
    expect(cat.filter((x) => x.system === "cctv").length).toBe(4);
  });
});
