import { Document, Page, Font, StyleSheet } from '@react-pdf/renderer';
import * as XLSX from 'xlsx';

// ลงทะเบียนฟอนต์ภาษาไทย
Font.register({
  family: 'Sarabun',
  src: '/fonts/Sarabun-Regular.ttf',
});

// กำหนด Styles
const styles = StyleSheet.create({
  page: { padding: 30 },
  monospace: { fontFamily: 'Courier' }, // สำหรับตัวเลขและรหัสเอกสาร
});

// โครงสร้าง PDF Document
export const ExportPDF = () => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* TODO: Content implementation */}
    </Page>
  </Document>
);

// ฟังก์ชันสำหรับ Export Excel
export const exportToExcel = (data: any[], filename: string) => {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, `${filename}.xlsx`);
};
