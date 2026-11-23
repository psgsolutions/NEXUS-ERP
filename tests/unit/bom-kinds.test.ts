import { describe, expect, it } from "vitest";
import { DEFAULT_BOM_SETTINGS, expandBom, jobBom, normalizeBomSpec } from "@/lib/bom";
import { BOM_KINDS, bomKind, kindCodes, sowForLines } from "@/lib/bom-kinds";

/** ราคากลาง + ผลคำนวณจาก Excel จริง (Template_SOW_BOM คำนวณด้วย Excel: scratchpad excel-all.ps1) */
const PRICE: Record<string, [number, string, string]> = {"UTP-CAT6":[12.46,"ม.",""],"RJ45-PLUG":[6,"ตัว",""],"RJ45-BOOT":[6.31,"ตัว","WEB"],"PP-24":[1800,"ตัว",""],"PC-1M":[60,"เส้น",""],"BOX-2x4":[13,"ตัว","WEB"],"FLEX-3/4\"":[9,"ม.",""],"FLEXCON-3/4\"":[13.19,"ตัว","WEB"],"FLEXCLIP-3/4\"":[3,"ตัว","WEB"],"EMT-3/4\"":[50,"ม.",""],"EMTCOUP-3/4\"":[6.79,"ตัว","WEB"],"EMTCON-3/4\"":[5.96,"ตัว","WEB"],"EMTSTRAP-3/4\"":[0.94,"ตัว","WEB"],"EMTELB-3/4\"":[33.95,"ตัว","WEB"],"ANCHOR":[1.46,"ชุด","WEB"],"CONSUM":[10,"ชุด","Y"],"LABEL":[9.78,"ชิ้น",""],"LAB-UTP":[800,"จุด",""],"LAB-FLEX-3/4\"":[30,"ม.",""],"LAB-EMT-3/4\"":[60,"ม.",""],"TEST":[50,"จุด",""],"FLEXWP-3/4\"":[80,"ม.",""],"LAB-FLEXWP-3/4\"":[50,"ม.",""],"HDPE-20":[10,"ม.",""],"LAB-HDPE-20":[60,"ม.",""],"FO-CABLE-6C":[20,"ม.",""],"FO-CABLE-12C":[20,"ม.",""],"FO-CABLE-24C":[35,"ม.","Y"],"FO-ODF-1U":[1900,"ตัว",""],"FO-SNAP6":[500,"ตัว",""],"FO-TRAY":[200,"ตัว",""],"FO-SLEEVE":[11.81,"ชิ้น","WEB"],"FO-CLOSURE":[3500,"ตัว","Y"],"LAB-FO":[40,"ม.",""],"CAM-DOME2":[1000,"ตัว",""],"CAM-BULLET2":[1000,"ตัว",""],"CAM-AI4":[5000,"ตัว",""],"CAM-PTZ":[16700,"ตัว",""],"PTZ-MOUNT":[1500,"ชุด","Y"],"POE-24P":[6000,"ตัว",""],"NVR-32CH":[15000,"เครื่อง",""],"HDD-10TB":[9800,"ลูก",""],"LAB-CAM":[350,"ตัว",""],"THW-2.5":[16.29,"ม.","WEB"],"THW-4":[22.21,"ม.","WEB"],"BOX-4x4":[19,"ตัว","WEB"],"OUTLET-2G":[138.61,"ตัว","WEB"],"FP-3G":[23,"ตัว","WEB"],"WP-COVER-3G":[299,"ตัว","WEB"],"SWITCH-1W":[45,"ตัว","Y"],"LED-T8-18":[104.76,"ชุด","WEB"],"LAB-PWR":[600,"จุด",""],"PV-PANEL-550":[2477,"แผง","WEB"],"INV-ONGRID":[3500,"kW","Y"],"INV-HYBRID":[7000,"kW","Y"],"BATT-LFP":[8000,"kWh","Y"],"PV-LFEET":[53.35,"ตัว","WEB"],"PV-TILEHOOK":[140.65,"ตัว","WEB"],"PV-RAIL":[150,"ม.","Y"],"PV-RAILSPLICE":[53.35,"ตัว","WEB"],"PV-CLAMP":[40,"ตัว","Y"],"PV-MC4":[33.95,"คู่","WEB"],"PV-CABLE-4":[31.65,"ม.","WEB"],"PV-DCBOX":[2500,"ตู้","Y"],"PV-ACBOX":[1500,"ตู้","Y"],"PV-ZEROEXPORT":[3500,"ชุด","Y"],"LAB-SOLAR":[3000,"kWp","Y"],"PV-PERMIT":[15000,"ระบบ","Y"],"RACK-12U":[3600,"ตู้",""],"PDU-6":[952,"ตัว",""],"PDU-12":[1311,"ตัว","WEB"],"RACK-SHELF":[600,"ตัว","Y"],"BLANK-1U":[150,"ตัว","Y"],"RACK-GND":[800,"ชุด","Y"],"UPS-KVA":[8000,"kVA","Y"],"IND-SOCKET-32A":[650,"ชุด","Y"],"CABLE-LADDER":[450,"ม.","Y"],"LAB-LADDER":[150,"ม.","Y"],"LAB-RACK":[2500,"ตู้","Y"],"LAB-PATCH":[30,"พอร์ต","Y"],"WW-2X4":[97,"ม.",""],"WW-4X4-M":[125,"ม.","Y"],"WWELB-2X4":[150,"ตัว",""],"WWELB-4X4":[190,"ตัว",""],"WWTEE-2X4":[215,"ตัว",""],"WWTEE-4X4":[240,"ตัว",""],"LADDER-ELB":[1200,"ตัว","Y"],"WW-BRACKET":[25,"ตัว","Y"],"STRUT-HANGER":[120,"ชุด","Y"],"STUD-3/8":[45,"เส้น","Y"],"ANCHOR-DROPIN":[8,"ตัว","Y"],"CORE-DRILL":[500,"จุด","Y"],"FIRESTOP":[350,"จุด","Y"],"CEIL-PANEL":[120,"แผ่น","Y"],"LAB-WW":[40,"ม.",""],"CM-1U":[400,"ตัว",""],"RACK-42U":[28000,"ตู้",""],"JB-CAM":[450,"ตัว",""],"CB-20A":[300,"ตัว",""],"TRENCH":[350,"ม.",""],"GROUND-ROD":[1500,"ชุด",""],"FO-PIGTAIL":[60,"เส้น",""],"FO-PC-SCLC2":[160,"เส้น",""],"FO-SPLICE":[200,"Core",""],"FO-OTDR":[100,"Core",""],"FO-FTB":[1200,"ตัว",""]};
const EXCEL: Record<string, { groups: { v: string; units: number; inputs: Record<string, number>; costPerUnit: number }[]; qty: Record<string, number> }> = {"FIBER":{"groups":[{"v":"ODF2","units":2,"inputs":{"cores":12,"routeM":150,"emtM":100,"flexM":30,"hdpeM":0,"trenchM":0},"costPerUnit":35710.4933},{"v":"FTB","units":3,"inputs":{"cores":6,"routeM":250,"emtM":20,"flexM":10,"hdpeM":200,"trenchM":120},"costPerUnit":82138.9067},{"v":"JOINT","units":1,"inputs":{"cores":24,"routeM":80,"emtM":40,"flexM":10,"hdpeM":0,"trenchM":0},"costPerUnit":22666.2333}],"qty":{"FO-CABLE-6C":817.5,"FO-CABLE-12C":335,"FO-CABLE-24C":94,"FO-ODF-1U":7,"FO-FTB":3,"FO-CLOSURE":1,"FO-SNAP6":7,"FO-TRAY":7,"FO-PIGTAIL":84,"FO-SPLICE":108,"FO-SLEEVE":108,"FO-PC-SCLC2":7,"EMT-3/4\"":300,"EMTCOUP-3/4\"":100,"EMTCON-3/4\"":12,"EMTSTRAP-3/4\"":200,"EMTELB-3/4\"":30,"FLEX-3/4\"":100,"FLEXCON-3/4\"":12,"FLEXCLIP-3/4\"":100,"ANCHOR":300,"HDPE-20":600,"LAB-HDPE-20":600,"TRENCH":360,"CONSUM":6,"LABEL":22,"LAB-FO":1130,"LAB-EMT-3/4\"":300,"LAB-FLEX-3/4\"":100,"FO-OTDR":66}},"CCTV":{"groups":[{"v":"DOME","units":16,"inputs":{"routeM":40,"emtM":15,"flexM":5,"flexWpM":0},"costPerUnit":6828.4523},{"v":"BULLET","units":8,"inputs":{"routeM":50,"emtM":20,"flexM":3,"flexWpM":3},"costPerUnit":8318.2639},{"v":"AI","units":2,"inputs":{"routeM":45,"emtM":20,"flexM":3,"flexWpM":3},"costPerUnit":12249.7339},{"v":"PTZ","units":1,"inputs":{"routeM":60,"emtM":30,"flexM":3,"flexWpM":3},"costPerUnit":26377.9073}],"qty":{"CAM-DOME2":16,"CAM-BULLET2":8,"CAM-AI4":2,"CAM-PTZ":1,"JB-CAM":10,"PTZ-MOUNT":1,"UTP-CAT6":1309,"RJ45-PLUG":54,"RJ45-BOOT":54,"EMT-3/4\"":470,"EMTCOUP-3/4\"":157,"EMTCON-3/4\"":54,"EMTSTRAP-3/4\"":314,"EMTELB-3/4\"":47,"FLEX-3/4\"":113,"FLEXCON-3/4\"":54,"FLEXCLIP-3/4\"":146,"FLEXWP-3/4\"":33,"ANCHOR":460,"POE-24P":2,"NVR-32CH":1,"HDD-10TB":4,"CONSUM":27,"LABEL":54,"LAB-UTP":27,"LAB-CAM":27,"LAB-EMT-3/4\"":470,"LAB-FLEX-3/4\"":113,"LAB-FLEXWP-3/4\"":33,"TEST":27}},"ELEC":{"groups":[{"v":"OUT","units":24,"inputs":{"routeM":20,"emtM":12,"flexM":3},"costPerUnit":3488.45},{"v":"OUTWP","units":4,"inputs":{"routeM":30,"emtM":20,"flexM":3},"costPerUnit":5240.0867},{"v":"DEDIC","units":3,"inputs":{"routeM":25,"emtM":15,"flexM":3},"costPerUnit":4853.41},{"v":"LIGHT","units":10,"inputs":{"routeM":15,"emtM":8,"flexM":2},"costPerUnit":2698.3217}],"qty":{"THW-2.5":2475,"THW-4":247.5,"BOX-2x4":38,"BOX-4x4":3,"OUTLET-2G":31,"FP-3G":37,"WP-COVER-3G":4,"SWITCH-1W":10,"LED-T8-18":10,"CB-20A":9,"EMT-3/4\"":493,"EMTCOUP-3/4\"":165,"EMTCON-3/4\"":82,"EMTSTRAP-3/4\"":329,"EMTELB-3/4\"":50,"FLEX-3/4\"":113,"FLEXCON-3/4\"":82,"FLEXCLIP-3/4\"":113,"ANCHOR":524,"CONSUM":41,"LAB-PWR":41,"LAB-EMT-3/4\"":493,"LAB-FLEX-3/4\"":113}},"SOLAR":{"groups":[{"v":"METAL","units":1,"inputs":{"kWp":10,"battKWh":0,"dcM":40,"acM":30,"emtM":25},"costPerUnit":156772.5933},{"v":"TILE","units":2,"inputs":{"kWp":5,"battKWh":0,"dcM":25,"acM":20,"emtM":15},"costPerUnit":96468.055},{"v":"HYBRID","units":1,"inputs":{"kWp":5,"battKWh":10,"dcM":30,"acM":20,"emtM":15},"costPerUnit":190824.205}],"qty":{"PV-PANEL-550":49,"INV-ONGRID":20,"INV-HYBRID":5,"BATT-LFP":10,"PV-LFEET":116,"PV-TILEHOOK":80,"PV-RAIL":112.7,"PV-RAILSPLICE":25,"PV-CLAMP":98,"PV-MC4":10,"PV-CABLE-4":264,"PV-DCBOX":4,"PV-ACBOX":4,"PV-ZEROEXPORT":4,"GROUND-ROD":4,"THW-4":297,"EMT-3/4\"":70,"EMTCOUP-3/4\"":24,"EMTCON-3/4\"":8,"EMTSTRAP-3/4\"":47,"EMTELB-3/4\"":7,"ANCHOR":47,"CONSUM":4,"LAB-SOLAR":25,"LAB-EMT-3/4\"":70,"PV-PERMIT":4}},"DC":{"groups":[{"v":"R42S","units":2,"inputs":{"ports":24,"foLinks":4,"upsKVA":3,"pwrM":20,"emtM":15,"ladderM":6},"costPerUnit":74003.375},{"v":"R42N","units":1,"inputs":{"ports":96,"foLinks":12,"upsKVA":3,"pwrM":20,"emtM":15,"ladderM":6},"costPerUnit":87816.535},{"v":"R12","units":3,"inputs":{"ports":48,"foLinks":2,"upsKVA":1,"pwrM":10,"emtM":8,"ladderM":0},"costPerUnit":29264.9667}],"qty":{"RACK-42U":3,"RACK-12U":3,"PDU-12":5,"PDU-6":3,"RACK-SHELF":8,"BLANK-1U":16,"RACK-GND":6,"PP-24":12,"CM-1U":12,"PC-1M":288,"LABEL":288,"FO-PC-SCLC2":26,"UPS-KVA":12,"CB-20A":6,"IND-SOCKET-32A":3,"OUTLET-2G":3,"BOX-4x4":3,"FP-3G":3,"THW-4":297,"EMT-3/4\"":69,"EMTCOUP-3/4\"":23,"EMTCON-3/4\"":12,"EMTSTRAP-3/4\"":46,"EMTELB-3/4\"":7,"CABLE-LADDER":18,"ANCHOR":46,"CONSUM":288,"LAB-RACK":6,"LAB-PATCH":314,"LAB-PWR":6,"LAB-EMT-3/4\"":69,"LAB-LADDER":18}},"TRAY":{"groups":[{"v":"WW44","units":1,"inputs":{"lenM":36,"penetrations":2,"ceilPanels":12},"costPerUnit":15484},{"v":"WW24","units":3,"inputs":{"lenM":12,"penetrations":1,"ceilPanels":0},"costPerUnit":2961.28},{"v":"LAD","units":1,"inputs":{"lenM":15,"penetrations":1,"ceilPanels":0},"costPerUnit":13546}],"qty":{"WW-2X4":36,"WW-4X4-M":36,"CABLE-LADDER":15,"WWELB-2X4":3,"WWELB-4X4":3,"LADDER-ELB":1,"WWTEE-2X4":2,"WWTEE-4X4":2,"WW-BRACKET":27,"STRUT-HANGER":36,"STUD-3/8":72,"ANCHOR-DROPIN":72,"ANCHOR":54,"CORE-DRILL":6,"FIRESTOP":6,"CEIL-PANEL":12,"CONSUM":5,"LAB-WW":72,"LAB-LADDER":15}}};
const resolve = (code: string) => (code in PRICE ? { productId: code, name: code, unit: PRICE[code][1], cost: PRICE[code][0], status: PRICE[code][2] } : null);
const s = DEFAULT_BOM_SETTINGS;

describe.each(Object.keys(EXCEL))("BOM %s ตรง Excel", (kind) => {
  const k = bomKind(kind)!;
  const data = EXCEL[kind];
  const lines = data.groups.map((g) => {
    const spec = k.spec(g.v);
    const inputs = { flexSize: s.flexSize, emtSize: s.emtSize, ...g.inputs };
    return { g, res: expandBom(spec, inputs, s, resolve) };
  });
  it("ต้นทุนต่อหน่วยของทุกกลุ่มตัวอย่าง", () => {
    for (const { g, res } of lines) {
      expect(res.missing, g.v).toEqual([]);
      expect(res.costPerUnit, g.v).toBeCloseTo(g.costPerUnit, 2);
    }
  });
  it("จำนวนวัสดุ/ค่าแรงรวมทั้งงาน (ปัดขึ้นเฉพาะรายการนับชิ้น)", () => {
    const job = jobBom(lines.map(({ g, res }) => ({ units: g.units, items: res.items })));
    const got = Object.fromEntries(job.rows.filter((r) => r.qty > 0).map((r) => [r.code, r.qty]));
    expect(Object.keys(got).sort()).toEqual(Object.keys(data.qty).sort());
    for (const [code, q] of Object.entries(data.qty)) expect(got[code], code).toBeCloseTo(q, 2);
  });
  it("สูตรผ่านการทำความสะอาด (เก็บลงสูตรงานบริการ) แล้วผลเท่าเดิม", () => {
    const g = data.groups[0];
    const spec = normalizeBomSpec(JSON.parse(JSON.stringify(k.spec(g.v))))!;
    const inputs = { flexSize: s.flexSize, emtSize: s.emtSize, ...g.inputs };
    expect(expandBom(spec, inputs, s, resolve).costPerUnit).toBeCloseTo(g.costPerUnit, 2);
  });
});

describe("ทะเบียนหมวด", () => {
  it("ครบ 7 หมวด รหัสงานบริการไม่ซ้ำ", () => {
    expect(BOM_KINDS.map((k) => k.kind)).toEqual(["LAN", "FIBER", "CCTV", "ELEC", "SOLAR", "DC", "TRAY"]);
    const codes = BOM_KINDS.flatMap((k) => k.variants.map((v) => v.bomCode));
    expect(new Set(codes).size).toBe(codes.length);
  });
  it("รหัสราคากลางทุกหมวดมีในไฟล์ราคากลาง (ขนาดท่อ/core/NVR/HDD ตามตั้งค่า)", () => {
    const fiber = kindCodes(bomKind("FIBER")!, s);
    expect(fiber).toEqual(expect.arrayContaining(["FO-CABLE-6C", "FO-CABLE-12C", "FO-CABLE-24C", 'EMT-1"']));
    expect(kindCodes(bomKind("CCTV")!, s)).toEqual(expect.arrayContaining(["NVR-32CH", "HDD-10TB"]));
  });
});

describe("ขอบเขตงานจาก BOM", () => {
  it("เฉพาะหมวด/รูปแบบที่ใช้ + แทนค่าตั้งค่า + ข้อยกเว้น", () => {
    const r = sowForLines([{ kind: "LAN", variant: "PLUG2" }, { kind: "CCTV", variant: "DOME" }, { kind: "LAN", variant: "PLUG2" }], s);
    expect(r.kinds).toEqual(["สาย LAN", "กล้องวงจรปิด"]);
    expect(r.scope.startsWith("งานสาย LAN\n1. สำรวจหน้างาน")).toBe(true);
    expect(r.scope).toContain("เผื่อสาย 10%");
    expect(r.scope).toContain("เข้าหัว RJ45 ตัวผู้");
    expect(r.scope).not.toContain("บล็อกลอย");
    expect(r.scope).toContain("รองรับการบันทึก 30 วัน");
    expect(r.scope).not.toContain("เสากล้อง");
    expect(r.exclusions).toMatch(/^งานสาย LAN: งานเจาะผนัง/);
  });
});
