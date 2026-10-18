import React from "react";
import { Document, Page, StyleSheet, View } from "@react-pdf/renderer";
import type { CopyMode, DocumentModel, Wht50Form, Wht50Party } from "@/lib/documents/model";
import { amountInWords, money, toDateStr } from "@/lib/documents/format";
import { T } from "./StandardDocument";

/**
 * หนังสือรับรองการหักภาษี ณ ที่จ่าย ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร (พิมพ์ตามแบบของกรมสรรพากร)
 * ต้นฉบับ = ฉบับที่ 1 (แนบแบบแสดงรายการ), สำเนา = ฉบับที่ 2 (ผู้ถูกหักเก็บเป็นหลักฐาน)
 */

const ink = "#111111", muted = "#555555", line = "#333333";
const s = StyleSheet.create({
  page: { paddingTop: 26, paddingBottom: 26, paddingHorizontal: 30, fontFamily: "Sarabun", fontSize: 9, color: ink, lineHeight: 1.35 },
  copyNote: { textAlign: "right", fontSize: 8, color: muted },
  frame: { marginTop: 4, borderWidth: 1, borderColor: line },
  titleRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 1, borderColor: line },
  title: { fontSize: 14, fontWeight: "bold", textAlign: "center", lineHeight: 1.6 },
  section: { paddingVertical: 5, paddingHorizontal: 8, borderBottomWidth: 1, borderColor: line },
  label: { fontWeight: "bold" },
  row: { flexDirection: "row", alignItems: "center" },
  taxBox: { width: 12, height: 14, borderWidth: 0.7, borderColor: line, alignItems: "center", justifyContent: "center" },
  taxDigit: { fontSize: 9, fontWeight: "bold", lineHeight: 1.2 },
  dash: { width: 5, textAlign: "center" },
  check: { width: 9, height: 9, borderWidth: 0.7, borderColor: line, marginRight: 3, alignItems: "center", justifyContent: "center" },
  checkMark: { width: 5, height: 5, backgroundColor: ink },
  th: { flexDirection: "row", borderBottomWidth: 1, borderColor: line, backgroundColor: "#f2f2f2" },
  thText: { fontWeight: "bold", textAlign: "center", paddingVertical: 3, paddingHorizontal: 3 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: "#999999", minHeight: 18 },
  cDesc: { flex: 1, paddingHorizontal: 4, paddingVertical: 2, borderRightWidth: 0.5, borderColor: "#999999" },
  cDate: { width: "15%", paddingHorizontal: 3, paddingVertical: 2, textAlign: "center", borderRightWidth: 0.5, borderColor: "#999999" },
  cAmt: { width: "16%", paddingHorizontal: 4, paddingVertical: 2, textAlign: "right", borderRightWidth: 0.5, borderColor: "#999999" },
  cTax: { width: "16%", paddingHorizontal: 4, paddingVertical: 2, textAlign: "right" },
  small: { fontSize: 7.5, color: muted },
  bottom: { flexDirection: "row" },
  warn: { width: "38%", padding: 8, borderRightWidth: 1, borderColor: line, justifyContent: "center" },
  sign: { flex: 1, padding: 8, alignItems: "center" },
  stamp: { position: "absolute", right: 14, top: 22, width: 56, height: 56, borderRadius: 28, borderWidth: 0.7, borderColor: "#999999", alignItems: "center", justifyContent: "center" },
  watermark: { position: "absolute", top: 300, left: 0, right: 0, textAlign: "center", fontSize: 90, fontWeight: "bold", color: "#d32f2f", opacity: 0.12, transform: "rotate(-30deg)" },
});

const ROWS: { row: 1 | 2 | 3 | 4 | 5 | 6; text: string }[] = [
  { row: 1, text: "1. เงินเดือน ค่าจ้าง เบี้ยเลี้ยง โบนัส ฯลฯ ตามมาตรา 40 (1)" },
  { row: 2, text: "2. ค่าธรรมเนียม ค่านายหน้า ฯลฯ ตามมาตรา 40 (2)" },
  { row: 3, text: "3. ค่าแห่งลิขสิทธิ์ ฯลฯ ตามมาตรา 40 (3)" },
  { row: 4, text: "4. ดอกเบี้ย เงินปันผล เงินส่วนแบ่งกำไร ฯลฯ ตามมาตรา 40 (4)" },
  { row: 5, text: "5. การจ่ายเงินได้ที่ต้องหักภาษี ณ ที่จ่าย ตามคำสั่งกรมสรรพากรที่ออกตามมาตรา 3 เตรส เช่น รางวัล ส่วนลดหรือประโยชน์ใด ๆ เนื่องจากการส่งเสริมการขาย รางวัลในการประกวด การแข่งขัน การชิงโชค ค่าแสดงของนักแสดงสาธารณะ ค่าจ้างทำของ ค่าโฆษณา ค่าเช่า ค่าขนส่ง ค่าบริการ ค่าเบี้ยประกันวินาศภัย ฯลฯ" },
  { row: 6, text: "6. อื่น ๆ (ระบุ)" },
];

const FORMS: { key: Wht50Form["form"]; label: string }[] = [
  { key: "PND1A", label: "(1) ภ.ง.ด.1ก" },
  { key: "PND1A_SPECIAL", label: "(2) ภ.ง.ด.1ก พิเศษ" },
  { key: "PND2", label: "(3) ภ.ง.ด.2" },
  { key: "PND3", label: "(4) ภ.ง.ด.3" },
  { key: "PND2A", label: "(5) ภ.ง.ด.2ก" },
  { key: "PND3A", label: "(6) ภ.ง.ด.3ก" },
  { key: "PND53", label: "(7) ภ.ง.ด.53" },
];

/** วว/ดด/ปปปป (พ.ศ.) */
function shortThaiDate(v: any) {
  const d = toDateStr(v);
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${Number(y) + 543}`;
}

function Check({ on, label }: { on: boolean; label: string }) {
  return (
    <View style={[s.row, { marginRight: 10, marginBottom: 2 }]}>
      <View style={s.check}>{on ? <View style={s.checkMark} /> : null}</View>
      <T>{label}</T>
    </View>
  );
}

/** เลขประจำตัวผู้เสียภาษี 13 หลักในช่อง (X-XXXX-XXXXX-XX-X) */
function TaxIdBoxes({ value }: { value: string }) {
  const d = String(value || "").replace(/\D/g, "").padEnd(13, " ").slice(0, 13).split("");
  const groups = [[0, 1], [1, 5], [5, 10], [10, 12], [12, 13]];
  return (
    <View style={s.row}>
      {groups.map(([a, b], gi) => (
        <View key={gi} style={s.row}>
          {gi > 0 ? <T style={s.dash}>-</T> : null}
          {d.slice(a, b).map((c, i) => <View key={i} style={s.taxBox}><T style={s.taxDigit}>{c.trim()}</T></View>)}
        </View>
      ))}
    </View>
  );
}

function PartyBlock({ title, p, note }: { title: string; p: Wht50Party; note: string }) {
  return (
    <View style={s.section}>
      <View style={[s.row, { justifyContent: "space-between" }]}>
        <T style={s.label}>{title}</T>
        <View style={s.row}><T style={{ marginRight: 6 }}>เลขประจำตัวผู้เสียภาษีอากร (13 หลัก)*</T><TaxIdBoxes value={p.taxId} /></View>
      </View>
      <View style={[s.row, { marginTop: 3 }]}>
        <T style={{ width: 28 }}>ชื่อ</T>
        <T style={{ flex: 1, fontWeight: "bold" }}>{p.name || "-"}{p.branchCode && !/^0+$/.test(p.branchCode) ? `  (สาขาที่ ${p.branchCode.padStart(5, "0")})` : ""}</T>
      </View>
      <T style={s.small}>{note}</T>
      <View style={[s.row, { marginTop: 2, alignItems: "flex-start" }]}>
        <T style={{ width: 28 }}>ที่อยู่</T>
        <T style={{ flex: 1 }}>{p.address || "-"}</T>
      </View>
    </View>
  );
}

export function Wht50Document({ doc, copy = "original" }: { doc: DocumentModel; copy?: CopyMode }) {
  const f = doc.wht50!;
  const total = f.rows.reduce((a, r) => a + r.amount, 0);
  const tax = f.rows.reduce((a, r) => a + r.tax, 0);
  const issue = toDateStr(f.issueDate);
  const [iy, im, id] = issue ? issue.split("-") : ["", "", ""];
  return (
    <Document title={`${doc.title} ${doc.number}`} author={f.payer.name} creator="NEXUS ERP">
      <Page size="A4" style={s.page}>
        {doc.watermark ? <T style={s.watermark} fixed>{doc.watermark}</T> : null}
        <T style={s.copyNote}>
          {copy === "copy" ? "ฉบับที่ 2 (สำหรับผู้ถูกหักภาษี ณ ที่จ่าย เก็บไว้เป็นหลักฐาน)" : "ฉบับที่ 1 (สำหรับผู้ถูกหักภาษี ณ ที่จ่าย ใช้แนบพร้อมกับแบบแสดงรายการภาษี)"}
        </T>
        <View style={s.frame}>
          <View style={s.titleRow}>
            <View style={{ width: "22%" }} />
            <View style={{ flex: 1 }}>
              <T style={s.title}>หนังสือรับรองการหักภาษี ณ ที่จ่าย</T>
              <T style={{ textAlign: "center" }}>ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร</T>
            </View>
            <View style={{ width: "22%", alignItems: "flex-end" }}>
              <T>เล่มที่  {f.bookNo || "-"}</T>
              <T>เลขที่  <T style={{ fontWeight: "bold" }}>{doc.number}</T></T>
            </View>
          </View>

          <PartyBlock title="ผู้มีหน้าที่หักภาษี ณ ที่จ่าย :" p={f.payer} note="(ให้ระบุว่าเป็น บุคคล นิติบุคคล บริษัท สมาคม หรือคณะบุคคล)" />
          <PartyBlock title="ผู้ถูกหักภาษี ณ ที่จ่าย :" p={f.payee} note="(ให้ระบุว่าเป็น บุคคล นิติบุคคล บริษัท สมาคม หรือคณะบุคคล)" />

          <View style={[s.section, { flexDirection: "row", flexWrap: "wrap", alignItems: "center" }]}>
            <T style={{ marginRight: 8 }}>ลำดับที่  {f.sequenceInForm || "......"}  ในแบบ</T>
            {FORMS.map((x) => <Check key={x.key} on={f.form === x.key} label={x.label} />)}
          </View>

          <View style={s.th}>
            <T style={[s.thText, { flex: 1, borderRightWidth: 0.5, borderColor: "#999999" }]}>ประเภทเงินได้พึงประเมินที่จ่าย</T>
            <T style={[s.thText, { width: "15%", borderRightWidth: 0.5, borderColor: "#999999" }]}>วัน เดือน หรือปีภาษี ที่จ่าย</T>
            <T style={[s.thText, { width: "16%", borderRightWidth: 0.5, borderColor: "#999999" }]}>จำนวนเงินที่จ่าย</T>
            <T style={[s.thText, { width: "16%" }]}>ภาษีที่หัก และนำส่งไว้</T>
          </View>
          {ROWS.map((r) => {
            const hits = f.rows.filter((x) => x.row === r.row);
            const amt = hits.reduce((a, x) => a + x.amount, 0);
            const t = hits.reduce((a, x) => a + x.tax, 0);
            const dates = Array.from(new Set(hits.map((x) => shortThaiDate(x.date)).filter(Boolean)));
            const labels = Array.from(new Set(hits.map((x) => x.label).filter(Boolean)));
            return (
              <View key={r.row} style={s.tr} wrap={false}>
                <View style={s.cDesc}>
                  <T>{r.text}</T>
                  {labels.length ? <T style={{ fontWeight: "bold" }}>    ({labels.join(", ")})</T> : null}
                </View>
                <T style={s.cDate}>{dates.join(", ")}</T>
                <T style={s.cAmt}>{hits.length ? money(amt) : ""}</T>
                <T style={s.cTax}>{hits.length ? money(t) : ""}</T>
              </View>
            );
          })}
          <View style={[s.tr, { borderBottomWidth: 1, borderColor: line }]}>
            <T style={[s.cDesc, { fontWeight: "bold", textAlign: "right" }]}>รวมเงินที่จ่ายและภาษีที่หักนำส่ง</T>
            <T style={s.cDate}>{""}</T>
            <T style={[s.cAmt, { fontWeight: "bold" }]}>{money(total)}</T>
            <T style={[s.cTax, { fontWeight: "bold" }]}>{money(tax)}</T>
          </View>
          <View style={[s.section, s.row]}>
            <T style={{ marginRight: 8 }}>รวมเงินภาษีที่หักนำส่ง (ตัวอักษร)</T>
            <T style={{ flex: 1, fontWeight: "bold", textAlign: "center", backgroundColor: "#f2f2f2", paddingVertical: 2 }}>({amountInWords(tax)})</T>
          </View>

          <View style={[s.section, s.row, { flexWrap: "wrap" }]}>
            <T style={{ marginRight: 12 }}>เงินที่จ่ายเข้า  กบข./กสจ./กองทุนสงเคราะห์ครูโรงเรียนเอกชน ........ บาท</T>
            <T style={{ marginRight: 12 }}>กองทุนประกันสังคม {f.sso ? money(f.sso) : "........"} บาท</T>
            <T>กองทุนสำรองเลี้ยงชีพ {f.providentFund ? money(f.providentFund) : "........"} บาท</T>
          </View>

          <View style={[s.section, s.row, { flexWrap: "wrap" }]}>
            <T style={{ marginRight: 8, fontWeight: "bold" }}>ผู้จ่ายเงิน</T>
            <Check on={f.payCondition === 1} label="(1) หัก ณ ที่จ่าย" />
            <Check on={f.payCondition === 2} label="(2) ออกให้ตลอดไป" />
            <Check on={f.payCondition === 3} label="(3) ออกให้ครั้งเดียว" />
            <Check on={f.payCondition === 4} label="(4) อื่น ๆ (ระบุ) ................" />
          </View>

          <View style={s.bottom} wrap={false}>
            <View style={s.warn}>
              <T style={{ fontWeight: "bold" }}>คำเตือน</T>
              <T style={s.small}>ผู้มีหน้าที่ออกหนังสือรับรองการหักภาษี ณ ที่จ่าย ฝ่าฝืนไม่ปฏิบัติตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร ต้องรับโทษทางอาญาตามมาตรา 35 แห่งประมวลรัษฎากร</T>
            </View>
            <View style={s.sign}>
              <T>ขอรับรองว่าข้อความและตัวเลขดังกล่าวข้างต้นถูกต้องตรงกับความจริงทุกประการ</T>
              <T style={{ marginTop: 22 }}>ลงชื่อ ............................................................ ผู้จ่ายเงิน</T>
              <T style={{ marginTop: 6 }}>{id ? `${Number(id)} / ${Number(im)} / ${Number(iy) + 543}` : "........ / ........ / ........"}</T>
              <T style={s.small}>(วัน เดือน ปี ที่ออกหนังสือรับรองฯ)</T>
              <View style={s.stamp}><T style={[s.small, { textAlign: "center" }]}>ประทับตรา{"\n"}นิติบุคคล{"\n"}(ถ้ามี)</T></View>
            </View>
          </View>
        </View>
        <T style={[s.small, { marginTop: 4 }]}>
          หมายเหตุ  เลขประจำตัวผู้เสียภาษีอากร (13 หลัก)* หมายถึง 1. กรณีบุคคลธรรมดาไทย ให้ใช้เลขประจำตัวประชาชนของกรมการปกครอง 2. กรณีนิติบุคคล ให้ใช้เลขทะเบียนนิติบุคคลของกรมพัฒนาธุรกิจการค้า 3. กรณีอื่น ๆ นอกเหนือจาก 1. และ 2. ให้ใช้เลขประจำตัวผู้เสียภาษีอากร (13 หลัก) ของกรมสรรพากร
        </T>
        {f.references || (doc.notes || []).length ? <T style={[s.small, { marginTop: 4 }]}>{[f.references, ...(doc.notes || [])].filter(Boolean).join("  ·  ")}</T> : null}
      </Page>
    </Document>
  );
}
