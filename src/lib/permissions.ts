/**
 * [SEC-V4.0] สิทธิ์ตามตำแหน่ง (Role-Based Access Control)
 * - ผู้ใช้ 1 คนมีได้หลายตำแหน่ง (users/{uid}.roles) สิทธิ์ = รวมสิทธิ์ของทุกตำแหน่ง
 * - กำหนดตำแหน่งได้เฉพาะ SUPERADMIN
 * - บัญชีรุ่นเก่าที่มีแค่ role เดียว แปลงเป็นตำแหน่งใหม่อัตโนมัติ (LEGACY_ROLE_MAP)
 */

export type Role =
  | "SUPERADMIN" | "EXECUTIVE" | "ADMIN" | "ACCOUNTANT" | "PURCHASING"
  | "SALES" | "ENGINEER" | "WAREHOUSE" | "HR" | "TECHNICIAN" | "CUSTOMER";

export type Permission =
  | "dashboard:executive"
  | "sales:view" | "sales:edit" | "sales:delete" | "sales:approve" | "sales:cost"
  // sales:billing = ออกใบกำกับภาษี/ใบแจ้งหนี้ ใบวางบิล ใบเสร็จ ใบลดหนี้/เพิ่มหนี้ ขายหน้าร้าน (แยกจากการทำใบเสนอราคา)
  // sales:quote_approve = อนุมัติใบเสนอราคาได้ไม่เกินวงเงินของตำแหน่ง (quotationApprovalLimit)
  | "sales:billing" | "sales:quote_approve"
  | "inventory:view" | "inventory:edit" | "inventory:delete"
  | "procurement:view" | "procurement:edit" | "procurement:approve"
  | "projects:view" | "projects:edit" | "projects:delete" | "projects:approve"
  | "finance:view" | "finance:edit" | "finance:delete" | "finance:post"
  | "hr:view" | "hr:edit"
  | "service:field"
  | "users:manage"
  | "settings:manage"
  | "logs:view";

export const ALL_PERMISSIONS: Permission[] = [
  "dashboard:executive",
  "sales:view", "sales:edit", "sales:delete", "sales:approve", "sales:cost", "sales:billing", "sales:quote_approve",
  "inventory:view", "inventory:edit", "inventory:delete",
  "procurement:view", "procurement:edit", "procurement:approve",
  "projects:view", "projects:edit", "projects:delete", "projects:approve",
  "finance:view", "finance:edit", "finance:delete", "finance:post",
  "hr:view", "hr:edit",
  "service:field",
  "users:manage", "settings:manage", "logs:view",
];

const VIEW_ALL: Permission[] = ["sales:view", "inventory:view", "procurement:view", "projects:view", "finance:view", "hr:view"];

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPERADMIN: ALL_PERMISSIONS,
  // ผู้บริหาร: ดูได้ทุกโมดูล + แดชบอร์ดผู้บริหาร + อนุมัติ (ซื้อทุกวงเงิน ใบเสนอราคา โครงการ)
  EXECUTIVE: [...VIEW_ALL, "dashboard:executive", "sales:cost", "sales:approve", "procurement:approve", "projects:approve", "logs:view"],
  // ผู้ดูแลระบบ: งานจัดการระบบเท่านั้น (ไม่เห็นตัวเลขการเงิน)
  ADMIN: ["users:manage", "settings:manage", "logs:view"],
  // บัญชี: เอกสารบัญชีทั้งหมด ลงบัญชี ยื่นภาษี อนุมัติซื้อ (ไม่เกินวงเงินบัญชี)
  ACCOUNTANT: ["finance:view", "finance:edit", "finance:delete", "finance:post", "sales:view", "sales:cost", "procurement:view", "procurement:approve", "inventory:view", "hr:view", "logs:view"],
  // จัดซื้อ: ใบขอซื้อ/ใบสั่งซื้อ คู่ค้า รับสินค้า (อนุมัติไม่ได้)
  PURCHASING: ["procurement:view", "procurement:edit", "inventory:view", "inventory:edit"],
  // ฝ่ายขาย: ลูกค้า ใบเสนอราคา ใบสั่งขาย ออกใบกำกับ/วางบิล/รับชำระ ดูสต็อก (ไม่เห็นต้นทุน)
  SALES: ["sales:view", "sales:edit", "sales:delete", "sales:billing", "projects:view", "inventory:view"],
  // วิศวกร/โครงการ: ทำทุกอย่างของงาน (ลูกค้า ใบเสนอราคา+ต้นทุน อนุมัติใบเสนอราคาไม่เกินวงเงิน โครงการ ขอซื้อ งานบริการ/MA เบิกของ)
  // ยกเว้นงานบัญชี การออกใบสั่งซื้อ และการออกใบกำกับ/วางบิล/รับเงิน (ให้แอดมินการเงินทำ)
  ENGINEER: ["projects:view", "projects:edit", "sales:view", "sales:edit", "sales:cost", "sales:quote_approve", "procurement:view", "inventory:view", "inventory:edit"],
  // คลังสินค้า: รับ/เบิก/โอน ตรวจนับ ดูใบสั่งซื้อ
  WAREHOUSE: ["inventory:view", "inventory:edit", "procurement:view"],
  // บุคคล: พนักงาน เวลาทำงาน เงินเดือน
  HR: ["hr:view", "hr:edit"],
  // ช่างเทคนิค: แอปช่างหน้างาน
  TECHNICIAN: ["service:field"],
  CUSTOMER: [],
};

/** ตำแหน่งที่ SUPERADMIN กำหนดให้ผู้ใช้ได้ (เรียงตามที่แสดงในหน้าจอ) */
export const ASSIGNABLE_ROLES: { value: Role; label: string; description: string }[] = [
  { value: "EXECUTIVE", label: "ผู้บริหาร", description: "ดูทุกโมดูล แดชบอร์ดผู้บริหาร อนุมัติซื้อทุกวงเงิน" },
  { value: "ADMIN", label: "ผู้ดูแลระบบ", description: "จัดการผู้ใช้และตั้งค่าระบบ" },
  { value: "ACCOUNTANT", label: "บัญชี", description: "เอกสารบัญชี รับ-จ่ายเงิน ลงบัญชี ยื่นภาษี อนุมัติซื้อ" },
  { value: "PURCHASING", label: "จัดซื้อ", description: "ใบขอซื้อ ใบสั่งซื้อ คู่ค้า รับสินค้า" },
  { value: "SALES", label: "ฝ่ายขาย", description: "ลูกค้า ใบเสนอราคา ใบสั่งขาย ออกใบกำกับ/วางบิล/รับชำระ" },
  { value: "ENGINEER", label: "วิศวกร/โครงการ", description: "ลูกค้า ใบเสนอราคา (เห็นต้นทุน อนุมัติไม่เกิน 1 ล้าน) โครงการ ขอซื้อ งานบริการ/MA — ไม่ออก PO/วางบิล/บัญชี" },
  { value: "WAREHOUSE", label: "คลังสินค้า", description: "รับ เบิก โอนสินค้า ตรวจนับ" },
  { value: "HR", label: "บุคคล", description: "พนักงาน เวลาทำงาน เงินเดือน" },
  { value: "TECHNICIAN", label: "ช่างเทคนิค", description: "แอปช่างหน้างาน" },
  { value: "CUSTOMER", label: "ลูกค้า", description: "ไม่มีสิทธิ์ในระบบหลังบ้าน" },
];

export const ROLE_LABELS: Record<string, string> = {
  SUPERADMIN: "ผู้ดูแลสูงสุด",
  ...Object.fromEntries(ASSIGNABLE_ROLES.map((r) => [r.value, r.label])),
};
export const roleLabel = (r: string) => ROLE_LABELS[String(r || "").toUpperCase()] || r;

/** ทุกตำแหน่งงาน (ไม่รวมช่าง/ลูกค้า) — ให้เจ้าของกิจการและ ADMIN รุ่นเก่าทำงานได้ครบเหมือนเดิม */
export const FULL_ACCESS_ROLES: Role[] = ["ADMIN", "EXECUTIVE", "ACCOUNTANT", "PURCHASING", "SALES", "ENGINEER", "WAREHOUSE", "HR"];

/** บัญชีรุ่นเก่า (มี role เดียว ยังไม่มี roles) แปลงเป็นตำแหน่งใหม่ให้ทำงานได้เท่าเดิม */
const LEGACY_ROLE_MAP: Record<string, Role[]> = {
  ADMIN: FULL_ACCESS_ROLES,
  MANAGER: ["EXECUTIVE"],
  ACCOUNTANT: ["ACCOUNTANT", "HR"],
};

const KNOWN = new Set<string>(Object.keys(ROLE_PERMISSIONS));

/** ตำแหน่งทั้งหมดของผู้ใช้จากโปรไฟล์ (roles[] ใหม่ หรือ role เดียวแบบเก่า) */
export function resolveRoles(profile: { role?: any; roles?: any } | null | undefined): Role[] {
  const list = Array.isArray(profile?.roles) && profile!.roles.length
    ? profile!.roles.map((r: any) => String(r || "").toUpperCase())
    : (() => {
        const r = String(profile?.role || "").toUpperCase();
        return r ? LEGACY_ROLE_MAP[r] || [r] : [];
      })();
  return Array.from(new Set(list.filter((r: string) => KNOWN.has(r)))) as Role[];
}

/** ตำแหน่งหลัก (ใช้แสดงผล/เข้ากันได้กับโค้ดที่อ่าน role เดียว) */
export function primaryRole(roles: string[]): string {
  const order: string[] = ["SUPERADMIN", ...ASSIGNABLE_ROLES.map((r) => r.value)];
  return order.find((r) => roles.includes(r)) || roles[0] || "";
}

type RoleInput = string | string[] | null | undefined;
const toRoles = (input: RoleInput): string[] =>
  (Array.isArray(input) ? input : input ? [input] : []).map((r) => String(r || "").toUpperCase());

/** ผู้ใช้ (ตำแหน่งเดียวหรือหลายตำแหน่ง) มีสิทธิ์นี้หรือไม่ */
export function can(roles: RoleInput, permission: Permission): boolean {
  return toRoles(roles).some((r) => (ROLE_PERMISSIONS[r as Role] || []).includes(permission));
}

/** มีสิทธิ์อย่างน้อยหนึ่งข้อ */
export function canAny(roles: RoleInput, permissions: Permission[]): boolean {
  return permissions.some((p) => can(roles, p));
}

export function getPermissions(roles: RoleInput): Permission[] {
  const set = new Set<Permission>();
  toRoles(roles).forEach((r) => (ROLE_PERMISSIONS[r as Role] || []).forEach((p) => set.add(p)));
  return Array.from(set);
}

export function isSuperAdminRole(roles: RoleInput): boolean {
  return toRoles(roles).includes("SUPERADMIN");
}

/** เห็นต้นทุนและกำไรขั้นต้นรายรายการ (ฝ่ายขายไม่เห็น) */
export function canViewCost(roles: RoleInput): boolean {
  return can(roles, "sales:cost");
}

/** วงเงินอนุมัติใบสั่งซื้อ (บาท): ผู้บริหาร/SUPERADMIN ไม่จำกัด, บัญชีไม่เกิน 500,000 */
export const ACCOUNTANT_PO_LIMIT = 500_000;
export function purchaseApprovalLimit(roles: RoleInput): number {
  const r = toRoles(roles);
  if (r.includes("SUPERADMIN") || r.includes("EXECUTIVE")) return Infinity;
  if (r.includes("ACCOUNTANT")) return ACCOUNTANT_PO_LIMIT;
  return 0;
}

/** วงเงินอนุมัติใบเสนอราคา (ยอดรวม VAT): ผู้บริหาร/SUPERADMIN ไม่จำกัด, วิศวกรไม่เกิน 1,000,000 */
export const ENGINEER_QUOTATION_LIMIT = 1_000_000;
export function quotationApprovalLimit(roles: RoleInput): number {
  if (can(roles, "sales:approve")) return Infinity;
  if (can(roles, "sales:quote_approve")) return ENGINEER_QUOTATION_LIMIT;
  return 0;
}
export function canApproveQuotation(roles: RoleInput, grandTotal: number): boolean {
  return (Number(grandTotal) || 0) <= quotationApprovalLimit(roles);
}

/** สิทธิ์ที่ต้องมีเพื่อเปิดหน้า (มีข้อใดข้อหนึ่งก็พอ) — prefix ยาวกว่ามาก่อน */
export const ROUTE_PERMISSIONS: { prefix: string; any: Permission[] }[] = [
  { prefix: "/executive", any: ["dashboard:executive"] },
  { prefix: "/documents/accounting", any: ["finance:view"] },
  { prefix: "/finance/expense-claims", any: ["finance:edit", "projects:edit", "inventory:edit", "sales:edit", "hr:edit", "procurement:edit"] },
  { prefix: "/finance/receipts", any: ["finance:view", "sales:billing"] },
  { prefix: "/finance/payouts", any: ["finance:edit", "projects:edit"] },
  { prefix: "/finance/advances", any: ["finance:edit", "projects:edit", "inventory:edit", "sales:edit", "hr:edit"] },
  { prefix: "/finance", any: ["finance:view"] },
  { prefix: "/procurement", any: ["procurement:view", "finance:view"] },
  { prefix: "/inventory", any: ["inventory:view"] },
  { prefix: "/customers", any: ["sales:view"] },
  { prefix: "/sales", any: ["sales:view"] },
  { prefix: "/pos", any: ["sales:billing"] },
  { prefix: "/projects", any: ["projects:view"] },
  { prefix: "/service", any: ["projects:edit", "sales:edit", "inventory:edit", "procurement:edit", "projects:approve"] },
  // งานของฉัน: ทุกตำแหน่งที่อาจได้รับมอบหมายงาน (ช่าง คลัง จัดซื้อ ขาย โครงการ บุคคล)
  { prefix: "/mobile/technician", any: ["service:field", "projects:view", "inventory:view", "procurement:view", "sales:view", "hr:view"] },
  { prefix: "/support", any: ["sales:view", "projects:view", "service:field"] },
  { prefix: "/hr", any: ["hr:view"] },
  { prefix: "/ai", any: ["finance:view"] },
  { prefix: "/data-import", any: ["sales:edit", "procurement:edit", "inventory:edit", "finance:edit"] },
  { prefix: "/settings/users", any: ["users:manage"] },
  { prefix: "/settings", any: ["settings:manage", "users:manage"] },
];

/** เปิดหน้านี้ได้หรือไม่ (หน้าที่ไม่อยู่ในรายการ เช่น ภาพรวม เปิดได้ทุกคน) */
export function canAccessRoute(roles: RoleInput, pathname: string): boolean {
  if (isSuperAdminRole(roles)) return true;
  const rule = ROUTE_PERMISSIONS.find((r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/"));
  return !rule || canAny(roles, rule.any);
}
