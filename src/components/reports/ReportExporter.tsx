"use client";

import React, { useState, useEffect } from "react";
import { FileDown, FileSpreadsheet, Sparkles } from "lucide-react";
import { PillButton, Toast } from "@/components/ui/Base";
import { FormTemplate } from "@/types/database";

// Dynamic imports to prevent SSR errors in Next.js
let PDFDownloadLink: any = null;
let Document: any = null;
let Page: any = null;
let Text: any = null;
let View: any = null;
let StyleSheet: any = null;
let Font: any = null;
let xlsx: any = null;

try {
  // We will dynamically import these on the client side inside useEffect
} catch (e) {
  console.error("PDF/Excel library load error", e);
}

interface ReportExporterProps {
  template: FormTemplate;
  data: any[]; // List of transactions or form submissions
  dateRange: { start: string; end: string };
  companyName: string;
}

export default function ReportExporter({ template, data, dateRange, companyName }: ReportExporterProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [isLibrariesLoaded, setIsLibrariesLoaded] = useState(false);
  const [toast, setToast] = useState({ message: "", isVisible: false, type: "success" as "success" | "error" });

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, isVisible: true, type });
  };

  useEffect(() => {
    setIsMounted(true);

    // Dynamically load libraries to avoid Next.js SSR crashes
    Promise.all([
      import("@react-pdf/renderer"),
      import("xlsx")
    ]).then(([pdfLib, xlsxLib]) => {
      PDFDownloadLink = pdfLib.PDFDownloadLink;
      Document = pdfLib.Document;
      Page = pdfLib.Page;
      Text = pdfLib.Text;
      View = pdfLib.View;
      StyleSheet = pdfLib.StyleSheet;
      Font = pdfLib.Font;
      xlsx = xlsxLib;

      // Register beautiful Thai font (Sarabun) via Google Fonts CDN for @react-pdf/renderer
      try {
        Font.register({
          family: "Sarabun",
          fonts: [
            {
              src: "https://fonts.gstatic.com/s/sarabun/v12/DtVkJx26TKEU37197D1wKmM.ttf", // Regular
              fontWeight: "normal"
            },
            {
              src: "https://fonts.gstatic.com/s/sarabun/v12/DtV4Jx26TKEU37197C5yFmWY2Q.ttf", // Bold
              fontWeight: "bold"
            }
          ]
        });
      } catch (err) {
        console.error("Font registration failed:", err);
      }

      setIsLibrariesLoaded(true);
    }).catch(err => {
      console.error("Failed to load PDF or Excel libraries:", err);
    });
  }, []);

  if (!isMounted || !isLibrariesLoaded) {
    return (
      <div className="flex gap-3">
        <PillButton variant="glass" disabled className="text-white/20 h-9 rounded-full px-6">
          กำลังเตรียมระบบส่งออกรายงาน...
        </PillButton>
      </div>
    );
  }

  // --- EXCEL GENERATION LOGIC ---
  const handleExportExcel = () => {
    try {
      if (!xlsx) {
        showToast("ไลบรารี Excel กำลังโหลด กรุณาลองอีกครั้ง", "error");
        return;
      }

      // 1. Flatten the data for Excel sheet
      const worksheetData = data.map((item, index) => {
        const row: Record<string, any> = {
          "ลำดับ (No.)": index + 1,
          "รหัสเอกสาร (Doc ID)": item.id || item.submissionId || "-",
          "โมดูล (Module)": item.module || template.module,
          "วันที่สร้าง (Date)": item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleDateString("th-TH") : "-"
        };

        // Add dynamic template fields values
        template.fields.forEach((field) => {
          const val = item.values?.[field.id] || item[field.id] || "";
          if (field.type === "table") {
            // If it's a dynamic table, flatten the details as summary string
            const tableRows = Array.isArray(val) ? val : [];
            row[field.label] = tableRows.map(r => `${r.detail} (${r.quantity}x${r.amountPerUnit})`).join(", ");
          } else {
            row[field.label] = val;
          }
        });

        // Add numerical total if present (e.g. for Quote or Table total sums)
        let totalAmount = 0;
        template.fields.forEach((field) => {
          if (field.type === "table") {
            const tableRows = Array.isArray(item.values?.[field.id]) ? item.values[field.id] : [];
            totalAmount += tableRows.reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
          } else if (field.type === "number") {
            totalAmount += Number(item.values?.[field.id] || item[field.id] || 0);
          }
        });

        if (totalAmount > 0) {
          row["ยอดรวมสุทธิ (Grand Total)"] = totalAmount;
        }

        return row;
      });

      // 2. Create SheetJS objects
      const worksheet = xlsx.utils.json_to_sheet(worksheetData);
      const workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, worksheet, "รายงานสรุป");

      // 3. Write and Save File
      const filename = `NEXUS_REPORT_${template.module}_${dateRange.start || "ALL"}_TO_${dateRange.end || "ALL"}.xlsx`;
      xlsx.writeFile(workbook, filename);
      showToast("ดาวน์โหลดรายงาน Excel สำเร็จ!");
    } catch (error) {
      console.error("Excel generation error:", error);
      showToast("ไม่สามารถสร้างไฟล์ Excel ได้", "error");
    }
  };

  // --- PDF REPORT STYLESHEET ---
  const styles = StyleSheet.create({
    page: {
      padding: 30,
      fontFamily: "Sarabun",
      fontSize: 10,
      color: "#333333",
      backgroundColor: "#ffffff"
    },
    headerContainer: {
      borderBottomWidth: 2,
      borderBottomColor: "#14a3cc",
      paddingBottom: 15,
      marginBottom: 20
    },
    companyName: {
      fontSize: 16,
      fontWeight: "bold",
      color: "#111111",
      marginBottom: 3
    },
    reportTitle: {
      fontSize: 12,
      fontWeight: "bold",
      color: "#14a3cc",
      textTransform: "uppercase",
      marginBottom: 8
    },
    metaGrid: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 5,
      color: "#666666",
      fontSize: 8
    },
    summaryGrid: {
      flexDirection: "row",
      justifyContent: "space-between",
      backgroundColor: "#f4f9fb",
      borderRadius: 6,
      padding: 10,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: "#e1eff2"
    },
    summaryItem: {
      alignItems: "center",
      flex: 1
    },
    summaryLabel: {
      fontSize: 8,
      color: "#777777",
      marginBottom: 3
    },
    summaryValue: {
      fontSize: 12,
      fontWeight: "bold",
      color: "#111111"
    },
    table: {
      width: "auto",
      borderStyle: "solid",
      borderWidth: 1,
      borderColor: "#dddddd",
      borderRightWidth: 0,
      borderBottomWidth: 0,
      marginBottom: 25
    },
    tableRow: {
      margin: "auto",
      flexDirection: "row"
    },
    tableRowHeader: {
      backgroundColor: "#f5f5f5",
      borderBottomWidth: 1,
      borderBottomColor: "#cccccc"
    },
    tableColIndex: {
      width: "8%",
      borderStyle: "solid",
      borderWidth: 1,
      borderColor: "#dddddd",
      borderLeftWidth: 0,
      borderTopWidth: 0,
      padding: 5,
      alignItems: "center"
    },
    tableColId: {
      width: "18%",
      borderStyle: "solid",
      borderWidth: 1,
      borderColor: "#dddddd",
      borderLeftWidth: 0,
      borderTopWidth: 0,
      padding: 5,
      fontFamily: "Courier"
    },
    tableColValue: {
      width: "23%",
      borderStyle: "solid",
      borderWidth: 1,
      borderColor: "#dddddd",
      borderLeftWidth: 0,
      borderTopWidth: 0,
      padding: 5
    },
    tableColDate: {
      width: "15%",
      borderStyle: "solid",
      borderWidth: 1,
      borderColor: "#dddddd",
      borderLeftWidth: 0,
      borderTopWidth: 0,
      padding: 5,
      alignItems: "center"
    },
    tableColTotal: {
      width: "15%",
      borderStyle: "solid",
      borderWidth: 1,
      borderColor: "#dddddd",
      borderLeftWidth: 0,
      borderTopWidth: 0,
      padding: 5,
      alignItems: "flex-end"
    },
    tableCellHeader: {
      fontSize: 8,
      fontWeight: "bold",
      color: "#333333"
    },
    tableCellText: {
      fontSize: 8,
      color: "#444444"
    },
    tableCellNumber: {
      fontSize: 9,
      fontFamily: "Courier" // Strictly force Monospace for numbers
    },
    footer: {
      position: "absolute",
      bottom: 25,
      left: 30,
      right: 30,
      borderTopWidth: 1,
      borderTopColor: "#eeeeee",
      paddingTop: 8,
      flexDirection: "row",
      justifyContent: "space-between",
      color: "#999999",
      fontSize: 7
    }
  });

  // Calculate sum of total amounts across retrieved list
  const calculateTotalValue = () => {
    let grandTotal = 0;
    data.forEach((item) => {
      template.fields.forEach((field) => {
        if (field.type === "table") {
          const tableRows = Array.isArray(item.values?.[field.id]) ? item.values[field.id] : [];
          grandTotal += tableRows.reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
        } else if (field.type === "number") {
          grandTotal += Number(item.values?.[field.id] || item[field.id] || 0);
        }
      });
    });
    return grandTotal;
  };

  // --- PDF DOCUMENT COMPONENT ---
  const PDFReportDocument = () => (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Company and Doc Header */}
        <View style={styles.headerContainer}>
          <Text style={styles.companyName}>{companyName}</Text>
          <Text style={styles.reportTitle}>รายงานสรุปเอกสาร: {template.title}</Text>
          <View style={styles.metaGrid}>
            <Text>ช่วงเวลาการสืบค้น: {dateRange.start || "เริ่มต้น"} ถึง {dateRange.end || "ปัจจุบัน"}</Text>
            <Text>ระบบประมวลผล: NEXUS Report Engine V3.1</Text>
          </View>
        </View>

        {/* Statistical Summary Row */}
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>จำนวนรายการรวม</Text>
            <Text style={styles.summaryValue}>{data.length} รายการ</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>มูลค่ารวมเอกสารในงวด</Text>
            <Text style={[styles.summaryValue, { fontFamily: "Courier" }]}>
              ฿{calculateTotalValue().toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>โมดูลเป้าหมาย</Text>
            <Text style={styles.summaryValue}>{template.module}</Text>
          </View>
        </View>

        {/* Main Data Table */}
        <View style={styles.table}>
          {/* Header Row */}
          <View style={[styles.tableRow, styles.tableRowHeader]}>
            <View style={styles.tableColIndex}>
              <Text style={styles.tableCellHeader}>ลำดับ</Text>
            </View>
            <View style={styles.tableColId}>
              <Text style={styles.tableCellHeader}>เลขที่เอกสาร</Text>
            </View>
            <View style={styles.tableColValue}>
              <Text style={styles.tableCellHeader}>{template.fields[0]?.label || "ฟิลด์ข้อมูล"}</Text>
            </View>
            <View style={styles.tableColValue}>
              <Text style={styles.tableCellHeader}>{template.fields[1]?.label || "ฟิลด์ข้อมูล"}</Text>
            </View>
            <View style={styles.tableColDate}>
              <Text style={styles.tableCellHeader}>วันที่บันทึก</Text>
            </View>
            <View style={styles.tableColTotal}>
              <Text style={styles.tableCellHeader}>ยอดเงินรวม</Text>
            </View>
          </View>

          {/* Body Rows */}
          {data.map((item, index) => {
            const val1 = item.values?.[template.fields[0]?.id] || item[template.fields[0]?.id] || "-";
            const val2 = item.values?.[template.fields[1]?.id] || item[template.fields[1]?.id] || "-";
            const displayVal1 = typeof val1 === "object" ? "[ตารางย่อย]" : String(val1);
            const displayVal2 = typeof val2 === "object" ? "[ตารางย่อย]" : String(val2);

            let rowTotal = 0;
            template.fields.forEach((field) => {
              if (field.type === "table") {
                const tableRows = Array.isArray(item.values?.[field.id]) ? item.values[field.id] : [];
                rowTotal += tableRows.reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
              } else if (field.type === "number") {
                rowTotal += Number(item.values?.[field.id] || item[field.id] || 0);
              }
            });

            return (
              <View key={item.id || index} style={styles.tableRow}>
                <View style={styles.tableColIndex}>
                  <Text style={styles.tableCellText}>{index + 1}</Text>
                </View>
                <View style={styles.tableColId}>
                  {/* Courier font strictly prevents italicization and forces monospace alignment */}
                  <Text style={[styles.tableCellText, styles.tableCellNumber]}>{item.id || item.submissionId || "-"}</Text>
                </View>
                <View style={styles.tableColValue}>
                  <Text style={styles.tableCellText}>{displayVal1}</Text>
                </View>
                <View style={styles.tableColValue}>
                  <Text style={styles.tableCellText}>{displayVal2}</Text>
                </View>
                <View style={styles.tableColDate}>
                  <Text style={styles.tableCellText}>
                    {item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleDateString("th-TH") : "-"}
                  </Text>
                </View>
                <View style={styles.tableColTotal}>
                  <Text style={[styles.tableCellText, styles.tableCellNumber]}>
                    ฿{rowTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Secure Ledger Footer */}
        <View style={styles.footer}>
          <Text>รับรองข้อมูลโดยฝ่ายเทคโนโลยีสารสนเทศ | CONFIDENTIAL & PROPRIETARY</Text>
          <Text>พิมพ์วันที่: {new Date().toLocaleDateString("th-TH")} (หน้า 1/1)</Text>
        </View>
      </Page>
    </Document>
  );

  return (
    <div className="flex gap-3">
      {/* 1. Export Excel Button */}
      <PillButton 
        type="button"
        variant="glass" 
        onClick={handleExportExcel}
        className="h-9 px-6 rounded-full font-black text-[11px] tracking-widest flex items-center gap-2 text-white/70 hover:text-white"
      >
        <FileSpreadsheet size={16} className="text-nexus-blue animate-pulse-glow" />
        ดาวน์โหลด EXCEL (XLSX)
      </PillButton>

      {/* 2. Export PDF Button using client-side react-pdf */}
      <PDFDownloadLink
        document={<PDFReportDocument />}
        fileName={`NEXUS_REPORT_${template.module}_${Date.now()}.pdf`}
      >
        {({ blob, url, loading, error }: any) => (
          <PillButton
            variant="primary"
            disabled={loading}
            className="h-9 px-6 rounded-full font-black text-[11px] tracking-widest flex items-center gap-2 shadow-neon-teal text-black"
          >
            <FileDown size={16} />
            {loading ? "กำลังสร้าง PDF..." : "ดาวน์โหลดรายงาน PDF"}
          </PillButton>
        )}
      </PDFDownloadLink>

      <Toast message={toast.message} isVisible={toast.isVisible} onClose={() => setToast(prev => ({ ...prev, isVisible: false }))} type={toast.type} />
    </div>
  );
}
