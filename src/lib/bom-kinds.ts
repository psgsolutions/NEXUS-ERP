/**
 * หมวดงาน BOM (เฟส 4) — LAN, ไฟเบอร์, CCTV, ไฟฟ้า, โซลาร์, ดาต้าเซ็นเตอร์, รางและโครงสร้าง + ขอบเขตงาน (SOW)
 * สูตรตามชีต "สูตร…" ใน Template_SOW_BOM (build_template.py) — จำนวนต่อ 1 หน่วยงาน (จุด / เส้นทาง / กล้อง / ระบบ / ตู้)
 * แต่ละรายการเป็นนิพจน์ต่อรูปแบบ (ช่องกรอก + ค่าตั้งค่า) · ปัดขึ้นทั้งงานเฉพาะรายการนับชิ้น
 */
import { LAN_INPUTS, PIPE_SIZES, lanBomSpec, type BomComp, type BomInputDef, type BomSettings, type BomSpec } from "./bom";
import { LAN_VARIANTS } from "./ref-prices";

export interface BomVariant { key: string; bomCode: string; name: string; desc: string }
export interface SowItem { no: string; th: string; /** รูปแบบที่ใช้ (ว่าง = ทุกรูปแบบ) */ only?: string[] }
export interface BomKind {
  kind: string; label: string; unit: string; variants: BomVariant[]; inputs: BomInputDef[];
  spec: (variant: string) => BomSpec;
  sow: SowItem[]; exclusions: string;
}

/** กลุ่มที่เป็นค่าแรง/บริการ (ไม่ตัดสต็อก) */
const SERVICE_GROUPS = new Set(["ค่าแรง", "ทดสอบ", "โยธา", "ขออนุญาต"]);
/** [รหัส, กลุ่ม, นิพจน์ต่อรูปแบบ (ค่าเดียว = ทุกรูปแบบ), ปัดขึ้นทั้งงาน] */
type Row = [string, string, string | number | (string | number)[], boolean];

function build(kind: string, variants: BomVariant[], inputs: BomInputDef[], rows: Row[]) {
  return (variant: string): BomSpec => {
    const vi = Math.max(0, variants.findIndex((v) => v.key === variant));
    const comps: BomComp[] = [];
    for (const [code, group, e, round] of rows) {
      const x = Array.isArray(e) ? e[vi] : e;
      if (x === 0 || x === "0" || x === "" || x === undefined) continue;
      comps.push({ code, group, expr: String(x), ...(round ? { roundJob: true } : {}), ...(SERVICE_GROUPS.has(group) ? { labor: true } : {}) });
    }
    return { kind, variant: variants[vi]?.key || variant, inputs, comps };
  };
}

const SIZE_INPUTS: BomInputDef[] = [
  { key: "flexSize", label: "ขนาดท่อ Flex", kind: "size", sizeSetting: "flexSize" },
  { key: "emtSize", label: "ขนาดท่อ EMT", kind: "size", sizeSetting: "emtSize" },
];
const EMT_SIZE_ONLY: BomInputDef[] = [SIZE_INPUTS[1]];
/** ท่อ EMT + ข้อต่อ/แคลมป์/ข้องอ + ค่าแรง (ตามระยะช่องกรอก m) */
const emtRows = (m = "emtM"): Row[] => [
  ["EMT-{emtSize}", "ท่อ EMT", m, false],
  ["EMTCOUP-{emtSize}", "ท่อ EMT", `${m} / emtLen`, true],
  ["EMTCON-{emtSize}", "ท่อ EMT", `gt(${m}, 0) * conduitEnds`, true],
  ["EMTSTRAP-{emtSize}", "ท่อ EMT", `${m} / emtStrapSpacing`, true],
  ["EMTELB-{emtSize}", "ท่อ EMT", `${m} / emtElbowPerM`, true],
  ["LAB-EMT-{emtSize}", "ค่าแรง", m, false],
];
const flexRows = (clipM = "flexM"): Row[] => [
  ["FLEX-{flexSize}", "ท่อ Flex", "flexM", false],
  ["FLEXCON-{flexSize}", "ท่อ Flex", "gt(flexM, 0) * conduitEnds", true],
  ["FLEXCLIP-{flexSize}", "ท่อ Flex", `${clipM} / flexClipSpacing`, true],
  ["LAB-FLEX-{flexSize}", "ค่าแรง", "flexM", false],
];

// ---------------------------------------------------------------------------
// ไฟเบอร์ (ต่อ 1 เส้นทาง)
// ---------------------------------------------------------------------------
const FO_V: BomVariant[] = [
  { key: "ODF2", bomCode: "SVC-FO-ODF2", name: "เดินสายไฟเบอร์ SM แบบ ODF ทั้ง 2 ฝั่ง", desc: "Splice เข้า ODF ทั้งต้นทางและปลายทาง" },
  { key: "FTB", bomCode: "SVC-FO-FTB", name: "เดินสายไฟเบอร์ SM แบบ ODF + กล่องพักสาย", desc: "ต้นทาง ODF ปลายทางกล่องพักสาย (เช่น ที่เสา)" },
  { key: "JOINT", bomCode: "SVC-FO-JOINT", name: "ต่อสายไฟเบอร์กลางทาง (Joint Closure)", desc: "ต่อเชื่อมสายในกล่อง Joint Closure" },
];
const FO_IN: BomInputDef[] = [
  { key: "cores", label: "จำนวน core", kind: "choice", options: [6, 12, 24], default: 12 },
  { key: "routeM", label: "ระยะสาย/เส้นทาง", unit: "ม." },
  { key: "emtM", label: "ท่อ EMT", unit: "ม." },
  { key: "flexM", label: "ท่อ Flex", unit: "ม." },
  { key: "hdpeM", label: "ท่อ HDPE ใต้ดิน", unit: "ม." },
  { key: "trenchM", label: "ขุดร่อง", unit: "ม." },
  ...SIZE_INPUTS,
];
const BLK = "ceil(cores / coresPerSnap)";
const FO_ROWS: Row[] = [
  ["FO-CABLE-{cores}C", "สาย", "2 * fiberCoilM + (1 + fiberWaste) * routeM", false],
  ["FO-ODF-1U", "ปลายสาย", [2, 1, 0], true],
  ["FO-FTB", "ปลายสาย", [0, 1, 0], true],
  ["FO-CLOSURE", "ปลายสาย", [0, 0, 1], true],
  ["FO-SNAP6", "ปลายสาย", [`2 * ${BLK}`, BLK, 0], true],
  ["FO-TRAY", "ปลายสาย", [`2 * ${BLK}`, BLK, 0], true],
  ["FO-PIGTAIL", "ปลายสาย", ["2 * cores", "2 * cores", 0], true],
  ["FO-SPLICE", "ค่าแรง", ["2 * cores", "2 * cores", "cores"], false],
  ["FO-SLEEVE", "ปลายสาย", ["2 * cores", "2 * cores", "cores"], true],
  ["FO-PC-SCLC2", "ปลายสาย", [2, 1, 0], true],
  ...emtRows(),
  ...flexRows(),
  ["ANCHOR", "สิ้นเปลือง", "emtM / emtStrapSpacing + flexM / flexClipSpacing", true],
  ["HDPE-20", "ท่อ HDPE", "hdpeM", false],
  ["LAB-HDPE-20", "ค่าแรง", "hdpeM", false],
  ["TRENCH", "โยธา", "trenchM", false],
  ["CONSUM", "สิ้นเปลือง", 1, true],
  ["LABEL", "สิ้นเปลือง", [4, 4, 2], true],
  ["LAB-FO", "ค่าแรง", "routeM", false],
  ["FO-OTDR", "ทดสอบ", "cores", false],
];

// ---------------------------------------------------------------------------
// CCTV (ต่อกล้อง 1 ตัว) — NVR/HDD/PoE Switch คิดสัดส่วนต่อกล้อง ปัดขึ้นทั้งงาน
// ---------------------------------------------------------------------------
const CC_V: BomVariant[] = [
  { key: "DOME", bomCode: "SVC-CCTV-DOME", name: "ติดตั้งกล้องวงจรปิด Dome ในอาคาร พร้อมสาย ท่อ และอุปกรณ์ส่วนกลาง", desc: "กล้อง IP Dome 2MP ในอาคาร" },
  { key: "BULLET", bomCode: "SVC-CCTV-BULLET", name: "ติดตั้งกล้องวงจรปิด Bullet ภายนอก พร้อมสาย ท่อ และอุปกรณ์ส่วนกลาง", desc: "กล้อง IP Bullet 2MP ภายนอก พร้อม Junction Box" },
  { key: "AI", bomCode: "SVC-CCTV-AI", name: "ติดตั้งกล้องวงจรปิด AI Bullet 4MP พร้อมสาย ท่อ และอุปกรณ์ส่วนกลาง", desc: "กล้อง AI Face Detection 4MP" },
  { key: "PTZ", bomCode: "SVC-CCTV-PTZ", name: "ติดตั้งกล้องวงจรปิด PTZ พร้อมสาย ท่อ และอุปกรณ์ส่วนกลาง", desc: "กล้อง IP PTZ พร้อมขายึด" },
  { key: "POLE", bomCode: "SVC-CCTV-POLE", name: "ติดตั้งกล้องวงจรปิด Bullet บนเสา พร้อมสาย ท่อ และอุปกรณ์ส่วนกลาง", desc: "กล้อง Bullet บนเสา พร้อมตู้ไฟและ Hardened PoE Switch (คิดเสาตามกล้องต่อเสา)" },
];
const CC_IN: BomInputDef[] = [
  { key: "routeM", label: "ระยะสาย/กล้อง", unit: "ม." },
  { key: "emtM", label: "ท่อ EMT/กล้อง", unit: "ม." },
  { key: "flexM", label: "ท่อ Flex/กล้อง", unit: "ม." },
  { key: "flexWpM", label: "Flex กันน้ำ/กล้อง", unit: "ม." },
  ...SIZE_INPUTS,
];
const PER_POLE = "1 / camsPerPole";
const CC_ROWS: Row[] = [
  ["CAM-DOME2", "กล้อง", [1, 0, 0, 0, 0], true],
  ["CAM-BULLET2", "กล้อง", [0, 1, 0, 0, 1], true],
  ["CAM-AI4", "กล้อง", [0, 0, 1, 0, 0], true],
  ["CAM-PTZ", "กล้อง", [0, 0, 0, 1, 0], true],
  ["JB-CAM", "ขายึด", [0, 1, 1, 0, 0], true],
  ["PTZ-MOUNT", "ขายึด", [0, 0, 0, 1, 0], true],
  ["POLE-CAM", "เสา", [0, 0, 0, 0, PER_POLE], true],
  ["PWRBOX", "เสา", [0, 0, 0, 0, PER_POLE], true],
  ["POE-HARD4", "เสา", [0, 0, 0, 0, PER_POLE], true],
  ["UTP-CAT6", "สาย", "(1 + cableWaste) * routeM", false],
  ["RJ45-PLUG", "สาย", 2, true],
  ["RJ45-BOOT", "สาย", 2, true],
  ...emtRows(),
  ...flexRows("(flexM + flexWpM)"),
  ['FLEXWP-3/4"', "ท่อ Flex กันน้ำ", "flexWpM", false],
  ['LAB-FLEXWP-3/4"', "ค่าแรง", "flexWpM", false],
  ["ANCHOR", "สิ้นเปลือง", "emtM / emtStrapSpacing + (flexM + flexWpM) / flexClipSpacing", true],
  ["POE-24P", "ส่วนกลาง", ["1 / poePorts", "1 / poePorts", "1 / poePorts", "1 / poePorts", 0], true],
  ["NVR-{nvrCh}CH", "ส่วนกลาง", "1 / nvrCh", true],
  // พื้นที่บันทึกต่อกล้อง (TB) = Mbps × 86400 วินาที × วัน ÷ 8 ÷ 1,000,000 → ÷ ขนาด HDD
  ["HDD-{hddTB}TB", "ส่วนกลาง", "camBitrate * 86400 * recordDays / 8 / 1000000 / hddTB", true],
  ["CONSUM", "สิ้นเปลือง", 1, true],
  ["LABEL", "สิ้นเปลือง", 2, true],
  ["LAB-UTP", "ค่าแรง", 1, false],
  ["LAB-CAM", "ค่าแรง", 1, false],
  ["TEST", "ทดสอบ", 1, false],
];

// ---------------------------------------------------------------------------
// ไฟฟ้า (ต่อ 1 จุด) — สายไฟ L+N+G = 3 เส้น · เบรกเกอร์ตามจำนวนจุดต่อวงจร
// ---------------------------------------------------------------------------
const EL_V: BomVariant[] = [
  { key: "OUT", bomCode: "SVC-EL-OUT", name: "งานไฟฟ้า เต้ารับคู่มีกราวด์ พร้อมสายไฟ ท่อ และเบรกเกอร์", desc: "เต้ารับคู่มีกราวด์ในอาคาร" },
  { key: "OUTWP", bomCode: "SVC-EL-OUTWP", name: "งานไฟฟ้า เต้ารับกันน้ำภายนอก พร้อมสายไฟ ท่อ และเบรกเกอร์", desc: "เต้ารับพร้อมหน้ากากกันน้ำ" },
  { key: "DEDIC", bomCode: "SVC-EL-DEDIC", name: "งานไฟฟ้า วงจรเฉพาะ (Rack/อุปกรณ์) พร้อมสายไฟ ท่อ และเบรกเกอร์", desc: "วงจรเฉพาะ สาย 4 ตร.มม. เบรกเกอร์ 1 ตัวต่อจุด" },
  { key: "LIGHT", bomCode: "SVC-EL-LIGHT", name: "งานไฟฟ้า สวิตช์ + โคม LED T8 พร้อมสายไฟ ท่อ และเบรกเกอร์", desc: "สวิตช์ 1 ทาง พร้อมโคม LED T8" },
];
const EL_IN: BomInputDef[] = [
  { key: "routeM", label: "ระยะเดินสาย/จุด", unit: "ม." },
  { key: "emtM", label: "ท่อ EMT/จุด", unit: "ม." },
  { key: "flexM", label: "ท่อ Flex/จุด", unit: "ม." },
  ...SIZE_INPUTS,
];
const W3 = "3 * (1 + cableWaste) * routeM";
const EL_ROWS: Row[] = [
  ["THW-2.5", "สายไฟ", [W3, W3, 0, W3], false],
  ["THW-4", "สายไฟ", [0, 0, W3, 0], false],
  ["BOX-2x4", "อุปกรณ์", [1, 1, 0, 1], true],
  ["BOX-4x4", "อุปกรณ์", [0, 0, 1, 0], true],
  ["OUTLET-2G", "อุปกรณ์", [1, 1, 1, 0], true],
  ["FP-3G", "อุปกรณ์", [1, 0, 1, 1], true],
  ["WP-COVER-3G", "อุปกรณ์", [0, 1, 0, 0], true],
  ["SWITCH-1W", "อุปกรณ์", [0, 0, 0, 1], true],
  ["LED-T8-18", "อุปกรณ์", [0, 0, 0, 1], true],
  ["CB-20A", "ตู้ไฟ", ["1 / outletsPerCircuit", "1 / outletsPerCircuit", 1, "1 / lightsPerCircuit"], true],
  ...emtRows(),
  ...flexRows(),
  ["ANCHOR", "สิ้นเปลือง", "2 + emtM / emtStrapSpacing + flexM / flexClipSpacing", true],
  ["CONSUM", "สิ้นเปลือง", 1, true],
  ["LAB-PWR", "ค่าแรง", 1, false],
];

// ---------------------------------------------------------------------------
// โซลาร์ (ต่อ 1 ระบบ) — แผง = ceil(kWp × 1000 ÷ วัตต์ต่อแผง) · String = ceil(แผง ÷ แผงต่อ String)
// ---------------------------------------------------------------------------
const PV_V: BomVariant[] = [
  { key: "METAL", bomCode: "SVC-PV-METAL", name: "ระบบโซลาร์เซลล์ On-grid หลังคาเมทัลชีท ติดตั้งพร้อมขออนุญาต", desc: "On-grid ขายึด L-Feet" },
  { key: "TILE", bomCode: "SVC-PV-TILE", name: "ระบบโซลาร์เซลล์ On-grid หลังคากระเบื้อง ติดตั้งพร้อมขออนุญาต", desc: "On-grid ขอยึดหลังคากระเบื้อง" },
  { key: "HYBRID", bomCode: "SVC-PV-HYBRID", name: "ระบบโซลาร์เซลล์ Hybrid + แบตเตอรี่ ติดตั้งพร้อมขออนุญาต", desc: "Hybrid inverter พร้อมแบตเตอรี่ LiFePO4" },
];
const PV_IN: BomInputDef[] = [
  { key: "kWp", label: "ขนาดระบบ", unit: "kWp" },
  { key: "battKWh", label: "แบตเตอรี่", unit: "kWh" },
  { key: "dcM", label: "สาย DC", unit: "ม." },
  { key: "acM", label: "สาย AC", unit: "ม." },
  { key: "emtM", label: "ท่อ EMT", unit: "ม." },
  ...EMT_SIZE_ONLY,
];
const PANELS = "ceil(kWp * 1000 / panelW)";
const STRINGS = `ceil(${PANELS} / panelsPerString)`;
const PV_ROWS: Row[] = [
  ["PV-PANEL-550", "แผง", PANELS, true],
  ["INV-ONGRID", "อินเวอร์เตอร์", ["kWp", "kWp", 0], false],
  ["INV-HYBRID", "อินเวอร์เตอร์", [0, 0, "kWp"], false],
  ["BATT-LFP", "แบตเตอรี่", "battKWh", false],
  ["PV-LFEET", "โครงยึด", [`4 * ${PANELS}`, 0, `4 * ${PANELS}`], true],
  ["PV-TILEHOOK", "โครงยึด", [0, `4 * ${PANELS}`, 0], true],
  ["PV-RAIL", "โครงยึด", `2.3 * ${PANELS}`, false],
  ["PV-RAILSPLICE", "โครงยึด", `0.5 * ${PANELS}`, true],
  ["PV-CLAMP", "โครงยึด", `2 * ${PANELS}`, true],
  ["PV-MC4", "สาย DC", `2 * ${STRINGS}`, true],
  ["PV-CABLE-4", "สาย DC", "2 * (1 + cableWaste) * dcM", false],
  ["PV-DCBOX", "ตู้ป้องกัน", 1, true],
  ["PV-ACBOX", "ตู้ป้องกัน", 1, true],
  ["PV-ZEROEXPORT", "ตู้ป้องกัน", 1, true],
  ["GROUND-ROD", "ตู้ป้องกัน", 1, true],
  ["THW-4", "สาย AC", "3 * (1 + cableWaste) * acM", false],
  ...emtRows(),
  ["ANCHOR", "สิ้นเปลือง", "emtM / emtStrapSpacing", true],
  ["CONSUM", "สิ้นเปลือง", 1, true],
  ["LAB-SOLAR", "ค่าแรง", "kWp", false],
  ["PV-PERMIT", "ขออนุญาต", 1, false],
];

// ---------------------------------------------------------------------------
// ดาต้าเซ็นเตอร์ / ตู้ Rack (ต่อ 1 ตู้) — Patch Panel = ceil(พอร์ต ÷ พอร์ตต่อแผง)
// ---------------------------------------------------------------------------
const DC_V: BomVariant[] = [
  { key: "R42S", bomCode: "SVC-DC-42S", name: "ติดตั้งตู้ Server 42U (ตั้งพื้น) พร้อม Patch Panel และระบบไฟเข้าตู้", desc: "ตู้ Server 42U PDU 2 ตัว" },
  { key: "R42N", bomCode: "SVC-DC-42N", name: "ติดตั้งตู้ Network 42U (ตั้งพื้น) พร้อม Patch Panel และระบบไฟเข้าตู้", desc: "ตู้ Network 42U" },
  { key: "R12", bomCode: "SVC-DC-12U", name: "ติดตั้งตู้ Network 12U (ติดผนัง) พร้อม Patch Panel และระบบไฟเข้าตู้", desc: "ตู้ติดผนัง 12U" },
  { key: "R9", bomCode: "SVC-DC-9U", name: "ติดตั้งตู้ Network 9U (ติดผนัง) พร้อม Patch Panel และระบบไฟเข้าตู้", desc: "ตู้ติดผนัง 9U พร้อมปลั๊กและพัดลม" },
];
const DC_IN: BomInputDef[] = [
  { key: "ports", label: "พอร์ต LAN/ตู้", unit: "พอร์ต" },
  { key: "foLinks", label: "ลิงก์ไฟเบอร์/ตู้", unit: "ลิงก์" },
  { key: "upsKVA", label: "UPS/ตู้ (0 = ไม่มี)", unit: "kVA" },
  { key: "pwrM", label: "สายไฟเข้าตู้ (0 = ไม่มี)", unit: "ม." },
  { key: "emtM", label: "ท่อ EMT", unit: "ม." },
  { key: "ladderM", label: "รางแลดเดอร์", unit: "ม." },
  ...EMT_SIZE_ONLY,
];
const PPN = "ceil(ports / patchPorts)";
const PWR = (k: number | string) => (k === 0 ? 0 : `gt(pwrM, 0) * ${k}`);
const DC_ROWS: Row[] = [
  ["RACK-42U", "ตู้ Rack", [1, 1, 0, 0], true],
  ["RACK-12U", "ตู้ Rack", [0, 0, 1, 0], true],
  ["RACK-9U", "ตู้ Rack", [0, 0, 0, 1], true],
  ["PDU-12", "ตู้ Rack", [2, 1, 0, 0], true],
  ["PDU-6", "ตู้ Rack", [0, 0, 1, 0], true],
  ["RACK-SHELF", "ตู้ Rack", [2, 1, 1, 1], true],
  ["BLANK-1U", "ตู้ Rack", [6, 4, 0, 0], true],
  ["RACK-GND", "ตู้ Rack", 1, true],
  ["PP-24", "สาย LAN", PPN, true],
  ["CM-1U", "สาย LAN", PPN, true],
  ["PC-1M", "สาย LAN", "ports", true],
  ["LABEL", "สาย LAN", "ports", true],
  ["FO-PC-SCLC2", "ไฟเบอร์", "foLinks", true],
  ["UPS-KVA", "UPS", "upsKVA", false],
  ["CB-20A", "ไฟฟ้า", PWR(1), true],
  ["IND-SOCKET-32A", "ไฟฟ้า", [PWR(1), PWR(1), 0, 0], true],
  ["OUTLET-2G", "ไฟฟ้า", [0, 0, PWR(1), PWR(1)], true],
  ["BOX-4x4", "ไฟฟ้า", [0, 0, PWR(1), PWR(1)], true],
  ["FP-3G", "ไฟฟ้า", [0, 0, PWR(1), PWR(1)], true],
  ["THW-4", "ไฟฟ้า", "3 * (1 + cableWaste) * pwrM", false],
  ...emtRows(),
  ["CABLE-LADDER", "รางแลดเดอร์", "ladderM", false],
  ["ANCHOR", "สิ้นเปลือง", "emtM / emtStrapSpacing", true],
  ["CONSUM", "สิ้นเปลือง", "ports", true],
  ["LAB-RACK", "ค่าแรง", 1, false],
  ["LAB-PATCH", "ค่าแรง", "ports + foLinks", false],
  ["LAB-PWR", "ค่าแรง", PWR(1), false],
  ["LAB-LADDER", "ค่าแรง", "ladderM", false],
];

// ---------------------------------------------------------------------------
// รางและโครงสร้าง (ต่อ 1 เส้นทาง) — ชุดแขวน = ceil(ระยะ ÷ ระยะชุดแขวน) + 1
// ---------------------------------------------------------------------------
const TR_V: BomVariant[] = [
  { key: "WW24", bomCode: "SVC-TRAY-WW24", name: 'ติดตั้ง Wireway 2"x4" ยึดผนัง พร้อมข้อต่อ ชุดยึด และค่าแรง', desc: "รางวายเวย์ 2x4 ยึดผนังด้วยขายึด" },
  { key: "WW44", bomCode: "SVC-TRAY-WW44", name: 'ติดตั้ง Wireway 4"x4" แขวนใต้ฝ้า/ใต้พื้น พร้อมข้อต่อ ชุดแขวน และค่าแรง', desc: "รางวายเวย์ 4x4 แขวนด้วยเหล็กเกลียวและ Strut" },
  { key: "WW46", bomCode: "SVC-TRAY-WW46", name: 'ติดตั้ง Wireway 4"x6" แขวนใต้ฝ้า/ใต้พื้น พร้อมข้อต่อ ชุดแขวน และค่าแรง', desc: "รางวายเวย์ 4x6 แขวนด้วยเหล็กเกลียวและ Strut" },
  { key: "LAD", bomCode: "SVC-TRAY-LAD", name: "ติดตั้ง Cable Ladder 300 มม. แขวน พร้อมข้อต่อ ชุดแขวน และค่าแรง", desc: "รางแลดเดอร์ 300 มม." },
];
const TR_IN: BomInputDef[] = [
  { key: "lenM", label: "ระยะ/เส้นทาง", unit: "ม." },
  { key: "penetrations", label: "จุดเจาะผนัง/พื้น", unit: "จุด" },
  { key: "ceilPanels", label: "แผ่นฝ้า", unit: "แผ่น" },
];
const HANG = "gt(lenM, 0) * (ceil(lenM / hangerSpacing) + 1)";
const ELB = "lenM / trayElbowPerM", TEE = "lenM / trayTeePerM";
const TR_ROWS: Row[] = [
  ["WW-2X4", "ราง", ["lenM", 0, 0, 0], false],
  ["WW-4X4-M", "ราง", [0, "lenM", 0, 0], false],
  ["WW-4X6", "ราง", [0, 0, "lenM", 0], false],
  ["CABLE-LADDER", "ราง", [0, 0, 0, "lenM"], false],
  ["WWELB-2X4", "ข้อต่อราง", [ELB, 0, 0, 0], true],
  ["WWELB-4X4", "ข้อต่อราง", [0, ELB, 0, 0], true],
  ["WWELB-4X6", "ข้อต่อราง", [0, 0, ELB, 0], true],
  ["LADDER-ELB", "ข้อต่อราง", [0, 0, 0, ELB], true],
  ["WWTEE-2X4", "ข้อต่อราง", [TEE, 0, 0, 0], true],
  ["WWTEE-4X4", "ข้อต่อราง", [0, TEE, 0, 0], true],
  ["WWTEE-4X6", "ข้อต่อราง", [0, 0, TEE, 0], true],
  ["WW-BRACKET", "โครงรองรับ", [HANG, 0, 0, 0], true],
  ["STRUT-HANGER", "โครงรองรับ", [0, HANG, HANG, HANG], true],
  ["STUD-3/8", "โครงรองรับ", [0, `2 * ${HANG}`, `2 * ${HANG}`, `2 * ${HANG}`], true],
  ["ANCHOR-DROPIN", "โครงรองรับ", [0, `2 * ${HANG}`, `2 * ${HANG}`, `2 * ${HANG}`], true],
  ["ANCHOR", "โครงรองรับ", [`2 * ${HANG}`, 0, 0, 0], true],
  ["CORE-DRILL", "เจาะ/ปิดช่อง", "penetrations", true],
  ["FIRESTOP", "เจาะ/ปิดช่อง", "penetrations", true],
  ["CEIL-PANEL", "งานฝ้า", "ceilPanels", true],
  ["CONSUM", "สิ้นเปลือง", 1, true],
  ["LAB-WW", "ค่าแรง", ["lenM", "lenM", "lenM", 0], false],
  ["LAB-LADDER", "ค่าแรง", [0, 0, 0, "lenM"], false],
];

// ---------------------------------------------------------------------------
// ทะเบียนหมวด + SOW (ชีต SOW) — {pct:key} = ค่าตั้งค่าเป็น % · {key} = ค่าตั้งค่า
// ---------------------------------------------------------------------------
const lanVariants: BomVariant[] = LAN_VARIANTS.map((v) => ({ key: v.key, bomCode: v.bomCode, name: v.name, desc: v.desc }));
export const BOM_KINDS: BomKind[] = [
  {
    kind: "LAN", label: "สาย LAN", unit: "จุด", variants: lanVariants, inputs: LAN_INPUTS, spec: (v) => lanBomSpec(v as any),
    sow: [
      { no: "1", th: "สำรวจหน้างาน กำหนดแนวเดินสาย ตำแหน่งจุด และตำแหน่งตู้ Rack ร่วมกับผู้ว่าจ้าง" },
      { no: "2", th: "เดินสาย UTP CAT6 ระยะไม่เกิน 90 ม. ต่อจุด เผื่อสาย {pct:cableWaste}" },
      { no: "3", th: "ร้อยสายในท่อ Flex {flexSize} และ/หรือท่อ EMT {emtSize} พร้อมข้อต่อ คอนเน็กเตอร์ และอุปกรณ์ยึดตามมาตรฐานช่าง" },
      { no: "4", th: "ต้นทาง: เข้าสายที่ Patch Panel CAT6 ในตู้ Rack พร้อมสาย Patch Cord 1 ม.", only: ["PB", "PPLUG"] },
      { no: "5", th: "ปลายทาง: ติดตั้งบล็อกลอย หน้ากาก และเต้ารับ CAT6 พร้อมสาย Patch Cord 2 ม.", only: ["PB"] },
      { no: "6", th: "เข้าหัว RJ45 ตัวผู้ พร้อมปลอกหุ้ม สำหรับต่อกับอุปกรณ์โดยตรง (กล้อง, AP, เครื่องสแกน)", only: ["PLUG2", "PPLUG"] },
      { no: "7", th: "ติดป้ายชื่อสายทั้ง 2 ปลาย ตามผังจุด" },
      { no: "8", th: "ทดสอบสายทุกจุดด้วยเครื่อง Fluke และส่งรายงานผลการทดสอบ" },
      { no: "9", th: "จัดทำแบบ As-built และส่งมอบงาน" },
    ],
    exclusions: "งานเจาะผนังทนไฟ/งานโครงสร้าง งานฝ้า งานไฟฟ้า และอุปกรณ์ Active (Switch) เว้นแต่ระบุไว้",
  },
  {
    kind: "FIBER", label: "ไฟเบอร์ออปติก", unit: "เส้นทาง", variants: FO_V, inputs: FO_IN, spec: build("FIBER", FO_V, FO_IN, FO_ROWS),
    sow: [
      { no: "F1", th: "สำรวจแนวเส้นทาง ตำแหน่งตู้ Rack / ODF / กล่องพักสาย และจุดต่อ ร่วมกับผู้ว่าจ้าง" },
      { no: "F2", th: "เดินสายไฟเบอร์ Single-mode ตามจำนวน core ที่ระบุ เผื่อสาย {pct:fiberWaste} และม้วนเก็บสายปลายละ {fiberCoilM} ม." },
      { no: "F3", th: "ร้อยสายในท่อ EMT / Flex / HDPE พร้อมข้อต่อและอุปกรณ์ยึด งานใต้ดินรวมขุดร่องและซ่อมผิว" },
      { no: "F4", th: "ติดตั้ง ODF 1U พร้อม Snap-in, ถาดต่อสาย, Pigtail และ Splice ทุก core", only: ["ODF2", "FTB"] },
      { no: "F5", th: "ติดตั้งกล่องพักสายไฟเบอร์ 4–8 core ที่ปลายทาง", only: ["FTB"] },
      { no: "F6", th: "ต่อเชื่อมสายใน Joint Closure พร้อมปลอกหุ้มจุดต่อ", only: ["JOINT"] },
      { no: "F7", th: "ทดสอบทุก core ด้วย OTDR / Power Meter และส่งรายงานผล" },
      { no: "F8", th: "ติดป้ายชื่อสายและจุดต่อ จัดทำ As-built" },
    ],
    exclusions: "",
  },
  {
    kind: "CCTV", label: "กล้องวงจรปิด", unit: "ชุด", variants: CC_V, inputs: CC_IN, spec: build("CCTV", CC_V, CC_IN, CC_ROWS),
    sow: [
      { no: "C1", th: "สำรวจและกำหนดตำแหน่ง มุมกล้อง และแนวเดินสาย ร่วมกับผู้ว่าจ้าง" },
      { no: "C2", th: "ติดตั้งกล้องตามรุ่นที่ระบุ พร้อมขายึด / Junction Box และปรับมุมกล้อง" },
      { no: "C3", th: "เดินสาย UTP CAT6 ในท่อ EMT / Flex / Flex กันน้ำ เข้าหัว RJ45 พร้อมปลอกหุ้ม ทั้ง 2 ปลาย" },
      { no: "C4", th: "ติดตั้ง NVR, HDD และ PoE Switch รองรับการบันทึก {recordDays} วัน" },
      { no: "C5", th: "ติดตั้งเสากล้อง ตู้กันน้ำพร้อมแหล่งจ่ายไฟ และ Hardened PoE Switch", only: ["POLE"] },
      { no: "C6", th: "ตั้งค่าระบบ IP / VLAN / บัญชีผู้ใช้ / ตารางบันทึก และทดสอบภาพทุกกล้อง" },
      { no: "C7", th: "ทดสอบสายทุกเส้นพร้อมรายงาน ติดป้ายชื่อ จัดทำ As-built และอบรมผู้ใช้งาน" },
    ],
    exclusions: "",
  },
  {
    kind: "ELEC", label: "ไฟฟ้า", unit: "จุด", variants: EL_V, inputs: EL_IN, spec: build("ELEC", EL_V, EL_IN, EL_ROWS),
    sow: [
      { no: "E1", th: "สำรวจโหลดและตู้ไฟเดิม กำหนดวงจรและตำแหน่งจุดร่วมกับผู้ว่าจ้าง" },
      { no: "E2", th: "เดินสายไฟ THW (L, N, G) ร้อยท่อ EMT / Flex พร้อมข้อต่อและอุปกรณ์ยึด" },
      { no: "E3", th: "ติดตั้งเต้ารับคู่มีกราวด์ บล็อก และหน้ากาก", only: ["OUT", "DEDIC"] },
      { no: "E4", th: "ติดตั้งเต้ารับพร้อมหน้ากากกันน้ำสำหรับภายนอก", only: ["OUTWP"] },
      { no: "E5", th: "ติดตั้งสวิตช์และโคม LED", only: ["LIGHT"] },
      { no: "E6", th: "ติดตั้งเบรกเกอร์ย่อยในตู้ไฟเดิม ติดป้ายวงจร และทดสอบการทำงาน" },
    ],
    exclusions: "งานเปลี่ยน/เพิ่มตู้ไฟหลัก งานขยายมิเตอร์ และงานโยธา เว้นแต่ระบุในรายการเหมา",
  },
  {
    kind: "SOLAR", label: "โซลาร์เซลล์", unit: "ระบบ", variants: PV_V, inputs: PV_IN, spec: build("SOLAR", PV_V, PV_IN, PV_ROWS),
    sow: [
      { no: "S1", th: "สำรวจหลังคา โครงสร้าง ทิศทางแดด และตู้ไฟเดิม ออกแบบระบบและผังแผง" },
      { no: "S2", th: "ติดตั้งแผงโซลาร์ {panelW} W บนรางอะลูมิเนียม พร้อมขายึดตามชนิดหลังคา" },
      { no: "S3", th: "ติดตั้งอินเวอร์เตอร์ ตู้ DC/AC พร้อมอุปกรณ์ป้องกันไฟกระชาก และระบบกันย้อน (Zero Export)" },
      { no: "S4", th: "ติดตั้งแบตเตอรี่ LiFePO4 และตั้งค่าโหมดสำรองไฟ", only: ["HYBRID"] },
      { no: "S5", th: "เดินสาย PV DC และสาย AC ในท่อ EMT ต่อหลักดินและทดสอบค่าความต้านทานดิน" },
      { no: "S6", th: "ยื่นขออนุญาตเชื่อมต่อขนานไฟกับ กฟภ./กฟน. พร้อมแบบและวิศวกรลงนาม" },
      { no: "S7", th: "ทดสอบระบบ ตั้งค่าแอปติดตามผล ส่งมอบคู่มือและอบรมการใช้งาน" },
    ],
    exclusions: "งานซ่อม/เสริมโครงหลังคา และค่าธรรมเนียมการไฟฟ้า (ถ้ามี) เว้นแต่ระบุ",
  },
  {
    kind: "DC", label: "ดาต้าเซ็นเตอร์ / ตู้ Rack", unit: "ตู้", variants: DC_V, inputs: DC_IN, spec: build("DC", DC_V, DC_IN, DC_ROWS),
    sow: [
      { no: "D1", th: "สำรวจห้อง ตำแหน่งตู้ แหล่งจ่ายไฟ และแนวรางสาย จัดทำผังตู้ (Rack Layout)" },
      { no: "D2", th: "ติดตั้งตู้ Rack ตามรุ่นที่ระบุ ยึดพื้น/ผนัง ปรับระดับ และต่อสายดินตู้ (Bonding)" },
      { no: "D3", th: "ติดตั้ง PDU ถาดวางอุปกรณ์ Blanking Panel และ Cable Management" },
      { no: "D4", th: "ติดตั้ง Patch Panel เข้าสาย Patch Cord จัดสายด้วย Velcro และติดป้ายชื่อทุกพอร์ต" },
      { no: "D5", th: "ติดตั้ง UPS ในตู้ ตั้งค่าและทดสอบการสำรองไฟ (เมื่อระบุ UPS)" },
      { no: "D6", th: "เดินสายไฟวงจรเฉพาะเข้าตู้ในท่อ EMT พร้อมเบรกเกอร์และเต้ารับ (เมื่อระบุสายไฟ)" },
      { no: "D7", th: "ติดตั้งรางแลดเดอร์ด้านบนตู้สำหรับจัดเส้นทางสาย (เมื่อระบุรางแลดเดอร์)" },
      { no: "D8", th: "ทดสอบ จัดทำ Rack Elevation / ตารางพอร์ต และแบบ As-built ส่งมอบ" },
    ],
    exclusions: "อุปกรณ์ Active (Switch, Server, Firewall) ระบบปรับอากาศ และระบบดับเพลิง เว้นแต่ระบุ",
  },
  {
    kind: "TRAY", label: "รางและโครงสร้าง", unit: "เส้นทาง", variants: TR_V, inputs: TR_IN, spec: build("TRAY", TR_V, TR_IN, TR_ROWS),
    sow: [
      { no: "T1", th: "สำรวจแนวราง ระดับฝ้า/พื้น จุดเจาะ และโครงสร้างอาคารที่ใช้ยึด" },
      { no: "T2", th: "ติดตั้งราง Wireway / Cable Ladder พร้อมข้องอ สามทาง และชุดแขวนทุกระยะ {hangerSpacing} ม." },
      { no: "T3", th: 'ชุดแขวนใช้เหล็กเกลียว 3/8" พุกตะกั่ว และเหล็กรางรับ (Strut) ยึดกับโครงสร้างอาคาร', only: ["WW44", "WW46", "LAD"] },
      { no: "T4", th: "เจาะผนัง/พื้นตามจำนวนที่ระบุ และอุดช่องด้วยวัสดุกันไฟ (Firestop) (เมื่อระบุจุดเจาะ)" },
      { no: "T5", th: "เปิด-ปิดฝ้า และเปลี่ยนแผ่นฝ้าที่เสียหายจากการติดตั้ง (เมื่อระบุแผ่นฝ้า)" },
      { no: "T6", th: "ทำความสะอาดพื้นที่ ส่งมอบแบบแนวราง As-built" },
    ],
    exclusions: "งานโครงสร้างหลัก (เสริมคาน/พื้น) งานก่ออิฐ ฉาบปูน และทาสีอาคาร เว้นแต่ระบุ",
  },
];
export const bomKind = (kind: string) => BOM_KINDS.find((k) => k.kind === kind);

/** รหัสราคากลางทั้งหมดของหมวด (ทุกรูปแบบ ทุกขนาดท่อ · core / NVR / HDD ตามตัวเลือกและค่าตั้งค่า) */
export function kindCodes(k: BomKind, s: BomSettings): string[] {
  const out = new Set<string>();
  const cores = k.inputs.find((d) => d.key === "cores")?.options || [];
  for (const v of k.variants) for (const c of k.spec(v.key).comps) {
    let codes = [c.code];
    if (c.code.includes("{flexSize}") || c.code.includes("{emtSize}")) codes = PIPE_SIZES.map((sz) => c.code.replace(/\{(flexSize|emtSize)\}/, sz));
    if (c.code.includes("{cores}")) codes = cores.map((n) => c.code.replace("{cores}", String(n)));
    for (const x of codes) out.add(x.replace(/\{(\w+)\}/g, (_, key) => String((s as any)[key] ?? "")));
  }
  return [...out];
}

/** แทนค่าตั้งค่าในข้อความ SOW */
export function sowText(t: string, s: BomSettings): string {
  return t.replace(/\{(pct:)?(\w+)\}/g, (_, pct, key) => {
    const v = (s as any)[key];
    return pct ? `${Math.round(Number(v) * 1000) / 10}%` : String(v ?? "");
  });
}

/**
 * ขอบเขตงาน + ข้อยกเว้น จากบรรทัด BOM ในใบเสนอราคา (เฉพาะหมวด/รูปแบบที่ใช้จริง เรียงตามทะเบียนหมวด)
 * lines: { kind, variant } จาก recipe.bom ของแต่ละบรรทัด
 */
export function sowForLines(lines: { kind?: string; variant?: string }[], s: BomSettings): { scope: string; exclusions: string; kinds: string[] } {
  const used = new Map<string, Set<string>>();
  for (const l of lines) if (l.kind && bomKind(l.kind)) { const set = used.get(l.kind) || new Set<string>(); if (l.variant) set.add(l.variant); used.set(l.kind, set); }
  const scope: string[] = [], excl: string[] = [], kinds: string[] = [];
  for (const k of BOM_KINDS) {
    const vs = used.get(k.kind);
    if (!vs) continue;
    kinds.push(k.label);
    const items = k.sow.filter((it) => !it.only || !vs.size || it.only.some((v) => vs.has(v)));
    if (scope.length) scope.push("");
    scope.push(`งาน${k.label}`);
    items.forEach((it, i) => scope.push(`${i + 1}. ${sowText(it.th, s)}`));
    if (k.exclusions) excl.push(`งาน${k.label}: ${k.exclusions}`);
  }
  return { scope: scope.join("\n"), exclusions: excl.join("\n"), kinds };
}
