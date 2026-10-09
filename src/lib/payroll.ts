/**
 * การคำนวณเงินเดือน (ใช้ร่วมกันทั้งหน้าจอและ API — เซิร์ฟเวอร์คำนวณซ้ำเสมอ)
 * ค่าคงที่ด้านกฎหมายรวมไว้ที่นี่เพื่อปรับได้ที่เดียว
 */

/** ประกันสังคม: อัตราลูกจ้าง = นายจ้าง, ฐานค่าจ้างต่ำสุด/สูงสุด (ปี 2569-2571 เพดาน 17,500) */
export const SSO_RATE = 0.05;
export const SSO_MIN_WAGE = 1650;
export const SSO_MAX_WAGE = 17500;

/** ภาษีเงินได้บุคคลธรรมดา (ภ.ง.ด.1): ค่าใช้จ่าย 50% ไม่เกิน 100,000, ลดหย่อนส่วนตัว 60,000 */
const TAX_BRACKETS: [number, number][] = [
  [150000, 0], [300000, 0.05], [500000, 0.1], [750000, 0.15], [1000000, 0.2], [2000000, 0.25], [5000000, 0.3], [Infinity, 0.35],
];

const r2 = (n: number) => Math.round(n * 100) / 100;

export function ssoContribution(wage: number, enrolled = true): number {
  if (!enrolled || wage <= 0) return 0;
  const base = Math.min(Math.max(wage, SSO_MIN_WAGE), SSO_MAX_WAGE);
  return Math.round(base * SSO_RATE); // ประกันสังคมปัดเป็นบาท
}

/** ภาษีหัก ณ ที่จ่ายรายเดือน: คำนวณทั้งปีจากเงินได้เดือนนี้ x 12 แล้วหาร 12 */
export function monthlyWithholding(monthlyIncome: number, monthlySso: number): number {
  const annual = monthlyIncome * 12;
  const expense = Math.min(annual * 0.5, 100000);
  const taxable = Math.max(0, annual - expense - 60000 - monthlySso * 12);
  let tax = 0;
  let lower = 0;
  for (const [upper, rate] of TAX_BRACKETS) {
    if (taxable > lower) tax += (Math.min(taxable, upper) - lower) * rate;
    lower = upper;
  }
  return r2(tax / 12);
}

export interface PayrollInput {
  employeeDocId: string;
  workDays?: number; // รายวัน
  allowance?: number;
  overtime?: number;
  otherIncome?: number;
  otherDeduction?: number;
  whtOverride?: number | null; // กำหนดภาษีเองแทนการคำนวณ
}

export interface PayrollLine extends Required<Omit<PayrollInput, "whtOverride">> {
  whtOverride: number | null;
  employeeId: string;
  name: string;
  position: string;
  employmentType: string;
  rate: number; // เงินเดือน หรือ ค่าจ้างต่อวัน
  base: number;
  gross: number;
  sso: number;
  employerSso: number;
  wht: number;
  net: number;
  bankName: string;
  bankAccount: string;
}

export function computeLine(emp: any, input: PayrollInput, nameOf: (e: any) => string): PayrollLine {
  const num = (v: any) => Math.max(0, r2(Number(v) || 0));
  const daily = emp.employmentType === "daily";
  const rate = num(emp.salary);
  const workDays = daily ? Math.min(31, num(input.workDays)) : 0;
  const base = r2(daily ? rate * workDays : rate);
  const allowance = num(input.allowance);
  const overtime = num(input.overtime);
  const otherIncome = num(input.otherIncome);
  const otherDeduction = num(input.otherDeduction);
  const gross = r2(base + allowance + overtime + otherIncome);
  // ฐานประกันสังคม = ค่าจ้าง (เงินเดือน/ค่าจ้างรายวัน + ค่าล่วงเวลา) ไม่รวมสวัสดิการ
  const sso = ssoContribution(base + overtime, emp.socialSecurity !== false);
  const override = input.whtOverride === null || input.whtOverride === undefined || (input.whtOverride as any) === "" ? null : num(input.whtOverride);
  const wht = override ?? monthlyWithholding(gross, sso);
  return {
    employeeDocId: input.employeeDocId,
    employeeId: emp.employeeId || input.employeeDocId,
    name: nameOf(emp),
    position: emp.position || "",
    employmentType: emp.employmentType || "permanent",
    rate, workDays, base, allowance, overtime, otherIncome, otherDeduction,
    whtOverride: override,
    gross, sso, employerSso: sso, wht,
    net: r2(gross - sso - wht - otherDeduction),
    bankName: emp.bankName || "",
    bankAccount: emp.bankAccount || "",
  };
}

export function payrollTotals(lines: PayrollLine[]) {
  const sum = (k: keyof PayrollLine) => r2(lines.reduce((s, l) => s + (Number(l[k]) || 0), 0));
  return { gross: sum("gross"), sso: sum("sso"), employerSso: sum("employerSso"), wht: sum("wht"), otherDeduction: sum("otherDeduction"), net: sum("net") };
}

/** วันสุดท้ายของงวด YYYY-MM */
export function periodEnd(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

const TH_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
export function periodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return `${TH_MONTHS[m - 1]} ${y + 543}`;
}
