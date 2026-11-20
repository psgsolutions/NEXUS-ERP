import { NextResponse } from "next/server";
import YAML from "yaml";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { auditServer } from "@/services/audit.server";
import { OWNERS, libraryCatalog, normalizeTemplate, type OwnerKey, type TemplateConfig } from "@/lib/project-plan";

/**
 * แม่แบบแผนงานโครงการของบริษัท — POST /api/settings/project-template { companyId, action, ... }
 *  get                   ค่าที่บริษัทแก้ + คลังงานมาตรฐาน (ทุกคนในบริษัทอ่านได้ — หน้าสร้างโครงการใช้)
 *  save { template }     บันทึก (settings:manage)
 *  exportYaml            ไฟล์ YAML: คลังงานพร้อมค่าที่แก้ + งานที่เพิ่ม + ค่าเริ่มต้น
 *  importYaml { text, apply? }  อ่านไฟล์ YAML (รูปแบบที่ส่งออก หรือ nexus_project_template.yaml เดิม)
 *                        apply = false → ดูผลก่อน · true → บันทึก
 * เก็บที่ companies/{companyId}/settings/project_template (เขียนผ่าน server เท่านั้น)
 */
const str = (v: any, max = 200) => String(v ?? "").trim().slice(0, max);

/** YAML → แม่แบบ: library (id ตรงคลัง = แก้ค่า · id ใหม่ที่มีชื่อ+จำนวนวัน = เพิ่มงาน) · extra · defaults */
function fromYaml(text: string): { template: TemplateConfig; notes: string[] } {
  let doc: any;
  try { doc = YAML.parse(text, { maxAliasCount: 50 }); } catch (e: any) { throw new ApiAuthError(400, `อ่านไฟล์ YAML ไม่ได้: ${String(e?.message || "").slice(0, 160)}`); }
  if (!doc || typeof doc !== "object") throw new ApiAuthError(400, "ไฟล์ไม่มีข้อมูลแม่แบบ");
  const cat = new Map(libraryCatalog().map((t) => [t.id, t]));
  const owners = Object.keys(OWNERS);
  const tasks: Record<string, any> = {};
  const extra: any[] = Array.isArray(doc.extra) ? [...doc.extra] : [];
  const notes: string[] = [];
  let changed = 0, added = 0, skipped = 0;
  for (const it of Array.isArray(doc.library) ? doc.library : []) {
    const id = str(it?.id, 40);
    if (!id) continue;
    const base = cat.get(id);
    if (base) {
      const o: any = {};
      if (str(it.name) && str(it.name) !== base.name) o.name = str(it.name);
      if (typeof it.days === "number" && base.days !== null && it.days !== base.days) o.days = it.days;
      if (owners.includes(it.owner) && it.owner !== base.owner) o.owner = it.owner;
      if (it.disabled === true) o.disabled = true;
      if (Object.keys(o).length) { tasks[id] = o; changed++; }
    } else if (str(it.name) && typeof it.days === "number" && !/[{*]/.test(id)) {
      const m = id.match(/^P(\d)/);
      extra.push({ id: `C${extra.length + 1}`, name: str(it.name), phase: m ? Number(m[1]) : 4, after: (Array.isArray(it.after) ? it.after : []).map((x: any) => str(x, 40)), days: it.days, owner: owners.includes(it.owner) ? it.owner : "pm" });
      added++;
      if (it.when && it.when !== "always") notes.push(`งาน ${id} มีเงื่อนไข "${str(it.when, 80)}" — นำเข้าเป็นงานที่ใช้ทุกโครงการ (ปิด/แก้ได้ในหน้าตั้งค่า)`);
    } else skipped++;
  }
  const template = normalizeTemplate({ tasks, extra, defaults: doc.defaults });
  notes.unshift(`แก้ค่างานมาตรฐาน ${changed} งาน · เพิ่มงานใหม่ ${template.extra.length} งาน${skipped ? ` · ข้าม ${skipped} รายการ (งานที่ระบบสร้างเอง เช่น P5.{n}, P7.2 หรือข้อมูลไม่ครบ)` : ""}`);
  if (doc.rules || doc.procurement_overrides || doc.modules) notes.push("กฎตรวจแผน (rules) รูปแบบการจัดหา และรายการ modules ใช้ตามที่ระบบกำหนดไว้ — ไม่ได้นำเข้าจากไฟล์");
  void added;
  return { template, notes };
}

function toYaml(t: TemplateConfig): string {
  const library = libraryCatalog().map((b) => {
    const o = t.tasks[b.id] || {};
    return {
      id: b.id, phase: b.phase, name: o.name || b.name, ...(b.days !== null ? { days: o.days || b.days } : {}),
      owner: (o.owner || b.owner) as OwnerKey, ...(o.disabled ? { disabled: true } : {}), ...(b.system ? { system: b.system } : {}),
      ...(b.after.length ? { after: b.after } : {}), ...(b.when !== "always" ? { when: b.when } : {}),
    };
  });
  const doc = { nexus_template: 1, defaults: t.defaults || undefined, library, extra: t.extra };
  return `# แม่แบบแผนงานโครงการ NEXUS — แก้ name/days/owner/disabled ในคลัง หรือเพิ่มงานใน extra แล้วนำเข้าที่ ตั้งค่า › แม่แบบโครงการ\n# owner: ${Object.entries(OWNERS).map(([k, v]) => `${k}=${v.label}`).join(", ")}\n${YAML.stringify(doc, { lineWidth: 0 })}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const companyId = str(body.companyId, 80);
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const user = await requireApiUser(request, companyId);
    const ref = adminDb.doc(`companies/${companyId}/settings/project_template`);
    const action = str(body.action, 20);
    const current = async () => normalizeTemplate((await ref.get()).data() || {});
    const manage = () => { if (!can(user.roles, "settings:manage")) throw new ApiAuthError(403, "ต้องมีสิทธิ์ตั้งค่าระบบ"); };
    const save = async (t: TemplateConfig) => {
      await ref.set({ ...t, defaults: t.defaults ?? null, updatedAt: new Date().toISOString(), updatedBy: user.email || user.uid });
      await auditServer.logUpdate(user.uid, companyId, "PROJECT_TEMPLATE", "project_template", {}, { tasks: Object.keys(t.tasks).length, extra: t.extra.length });
    };

    if (action === "get") {
      const snap = await ref.get();
      return NextResponse.json({ success: true, template: normalizeTemplate(snap.data() || {}), updatedAt: snap.get("updatedAt") || "", updatedBy: snap.get("updatedBy") || "", catalog: libraryCatalog() });
    }
    if (action === "save") { manage(); const t = normalizeTemplate(body.template); await save(t); return NextResponse.json({ success: true, template: t }); }
    if (action === "exportYaml") return NextResponse.json({ success: true, yaml: toYaml(await current()) });
    if (action === "importYaml") {
      manage();
      const text = String(body.text || "");
      if (!text.trim() || text.length > 300_000) throw new ApiAuthError(400, "ไฟล์ว่างหรือใหญ่เกินไป");
      const { template, notes } = fromYaml(text);
      if (body.apply === true) await save(template);
      return NextResponse.json({ success: true, template, notes, applied: body.apply === true });
    }
    throw new ApiAuthError(400, "ไม่รู้จักคำสั่ง");
  } catch (err: any) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    console.error("[PROJECT_TEMPLATE_API_ERROR]", err);
    return NextResponse.json({ success: false, error: "ดำเนินการแม่แบบโครงการไม่สำเร็จ" }, { status: 500 });
  }
}
