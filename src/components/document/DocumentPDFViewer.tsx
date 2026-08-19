import React from "react";
import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";

// ลงทะเบียนฟอนต์ภาษาไทย (ตัวอย่างการฝังฟอนต์ Sarabun)
Font.register({
  family: "Sarabun",
  src: "https://cdn.jsdelivr.net/npm/@fontsource/sarabun@4.5.8/files/sarabun-thai-400-normal.woff",
});

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Sarabun", fontSize: 11, color: "#111" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  title: { fontSize: 18, fontWeight: "bold", color: "#008080" },
  table: { display: "flex", width: "auto", borderWidth: 1, borderColor: "#ccc", marginTop: 10 },
  tableRow: { flexDirection: "row" },
  tableColHeader: { width: "25%", backgroundColor: "#f0f0f0", padding: 6, fontWeight: "bold" },
  tableCol: { width: "25%", padding: 6 },
  amountCell: { textAlign: "right", fontFamily: "Courier" }, // Monospace equivalent for PDF
});

interface DocumentPDFProps {
  docNo: string;
  issueDate: string;
  customerName: string;
  items: Array<{ name: string; quantity: number; unitPrice: number; amount: number }>;
  grandTotal: number;
}

export function DocumentPDFTemplate({ docNo, issueDate, customerName, items, grandTotal }: DocumentPDFProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>NEXUS ERP (Intelligence OS)</Text>
            <Text>ลูกค้า: {customerName}</Text>
          </View>
          <View>
            <Text>เลขที่เอกสาร: {docNo}</Text>
            <Text>วันที่: {issueDate}</Text>
          </View>
        </View>

        {/* ตารางรายการ */}
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableColHeader}>รายละเอียดสินค้า</Text>
            <Text style={styles.tableColHeader}>จำนวน</Text>
            <Text style={styles.tableColHeader}>ราคาต่อหน่วย</Text>
            <Text style={styles.tableColHeader}>จำนวนเงิน</Text>
          </View>
          {items.map((item, index) => (
            <View style={styles.tableRow} key={index}>
              <Text style={styles.tableCol}>{item.name}</Text>
              <Text style={[styles.tableCol, styles.amountCell]}>{item.quantity}</Text>
              <Text style={[styles.tableCol, styles.amountCell]}>{item.unitPrice.toFixed(2)}</Text>
              <Text style={[styles.tableCol, styles.amountCell]}>{item.amount.toFixed(2)}</Text>
            </View>
          ))}
        </View>

        {/* ส่วนสรุปยอด */}
        <View style={{ marginTop: 20, alignItems: "flex-end" }}>
          <Text style={{ fontSize: 13, fontWeight: "bold", fontFamily: "Courier" }}>
            ยอดชำระสุทธิ: ฿ {grandTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
