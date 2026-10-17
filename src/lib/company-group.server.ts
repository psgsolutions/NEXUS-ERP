import { adminDb } from "@/lib/firebase-admin";
import { can, isSuperAdminRole } from "@/lib/permissions";
import type { ApiUser } from "@/lib/api-auth";
import { MASTER_SCHEMAS, groupIdOf, type MasterEntity } from "@/lib/master-data";

/**
 * เครือบริษัทฝั่ง server
 * - companies/{id}.groupId ระบุเครือ (ไม่มี = เครือของตัวเอง)
 * - groups/{groupId} { name, adminUids[] } มีเมื่อสร้างเครือที่มีหลายบริษัท
 */
export async function groupIdOfCompany(companyId: string): Promise<string> {
  const snap = await adminDb.doc(`companies/${companyId}`).get();
  return groupIdOf(snap.data() as any, companyId);
}

/** บริษัททั้งหมดในเครือ (รวมบริษัทที่ไม่มี groupId แต่ id = groupId) */
export async function companiesInGroup(groupId: string): Promise<string[]> {
  const [members, self] = await Promise.all([
    adminDb.collection("companies").where("groupId", "==", groupId).get(),
    adminDb.doc(`companies/${groupId}`).get(),
  ]);
  const ids = new Set(members.docs.map((d) => d.id));
  if (self.exists && groupIdOf(self.data() as any, self.id) === groupId) ids.add(self.id);
  return Array.from(ids);
}

/**
 * แก้ข้อมูลกลาง (ชั้นตัวตนและค่ากลาง) ได้หรือไม่
 * - เครือที่มีบริษัทเดียว: ผู้มีสิทธิ์แก้ประเภทนั้นของบริษัท (เหมือนเดิม)
 * - เครือที่มีหลายบริษัท: SUPERADMIN หรือผู้ดูแลเครือ (groups/{g}.adminUids)
 */
export async function canEditMaster(user: ApiUser, companyId: string, entity: MasterEntity, groupId?: string): Promise<boolean> {
  if (isSuperAdminRole(user.roles)) return true;
  const g = groupId || (await groupIdOfCompany(companyId));
  const companies = await companiesInGroup(g);
  if (companies.length <= 1) return can(user.roles, MASTER_SCHEMAS[entity].editPermission);
  const group = await adminDb.doc(`groups/${g}`).get();
  const admins: string[] = Array.isArray(group.data()?.adminUids) ? group.data()!.adminUids : [];
  return admins.includes(user.uid);
}
