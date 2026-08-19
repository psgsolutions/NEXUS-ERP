import React from 'react';
import { Page, Text, View, Document, StyleSheet, Font, Image } from '@react-pdf/renderer';

// Register custom fonts (Sarabun for Thai support)
Font.register({
  family: 'Sarabun',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/gh/praecursor/thai-fonts/Sarabun-Regular.ttf', fontWeight: 'normal' },
    { src: 'https://cdn.jsdelivr.net/gh/praecursor/thai-fonts/Sarabun-Bold.ttf', fontWeight: 'bold' }
  ]
});

// Sci-Fi Aesthetic Stylesheet
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Sarabun',
    fontSize: 10,
    backgroundColor: '#ffffff',
    color: '#111111',
    lineHeight: 1.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottom: '2px solid #00E5FF', // Nexus Teal
    paddingBottom: 10,
    marginBottom: 20,
  },
  companyInfo: {
    flexDirection: 'column',
    width: '60%',
  },
  companyName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#00E5FF',
    textTransform: 'uppercase',
  },
  docMeta: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    width: '40%',
  },
  docTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  metaGrid: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 5,
  },
  metaLabel: {
    color: '#666666',
    marginRight: 10,
    fontSize: 9,
  },
  metaValue: {
    fontWeight: 'bold',
    fontFamily: 'Helvetica', // Monospace-like for numbers
  },
  section: {
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  billTo: {
    width: '45%',
    backgroundColor: '#f8f9fa',
    padding: 10,
    borderRadius: 4,
    borderLeft: '4px solid #3B82F6', // Nexus Blue
  },
  shipTo: {
    width: '45%',
    backgroundColor: '#f8f9fa',
    padding: 10,
    borderRadius: 4,
    borderLeft: '4px solid #00E5FF',
  },
  sectionTitle: {
    fontSize: 9,
    color: '#666666',
    textTransform: 'uppercase',
    marginBottom: 5,
    fontWeight: 'bold',
  },
  table: {
    width: 'auto',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  tableRow: {
    margin: 'auto',
    flexDirection: 'row',
  },
  tableHeader: {
    backgroundColor: '#111111',
    color: '#ffffff',
    fontWeight: 'bold',
  },
  tableColHeader: {
    borderStyle: 'solid',
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: '#111111',
    padding: 5,
  },
  tableCol: {
    borderStyle: 'solid',
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: '#e5e7eb',
    padding: 5,
  },
  col1: { width: '10%', textAlign: 'center' },
  col2: { width: '40%' },
  col3: { width: '10%', textAlign: 'center' },
  col4: { width: '15%', textAlign: 'right' },
  col5: { width: '10%', textAlign: 'right' },
  col6: { width: '15%', textAlign: 'right' },
  textMono: {
    fontFamily: 'Helvetica', // using Helvetica for numbers since react-pdf has limited built-in monospace
  },
  summarySection: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
  },
  summaryBox: {
    width: '40%',
    border: '1px solid #e5e7eb',
    padding: 10,
    borderRadius: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  summaryLabel: {
    color: '#666666',
  },
  summaryValue: {
    fontWeight: 'bold',
    fontFamily: 'Helvetica',
  },
  summaryTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTop: '2px solid #111111',
    paddingTop: 5,
    marginTop: 5,
  },
  totalValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#00E5FF',
    fontFamily: 'Helvetica',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    color: '#999999',
    fontSize: 8,
    borderTop: '1px solid #e5e7eb',
    paddingTop: 10,
  }
});

interface NexusDocumentProps {
  title: string;
  docNo: string;
  date: string;
  companyName: string;
  companyAddress: string;
  companyTaxId: string;
  customerName: string;
  customerAddress: string;
  customerTaxId: string;
  items: Array<{
    id: string;
    description: string;
    qty: number;
    unitPrice: number;
    discount?: number;
    total: number;
  }>;
  summary: {
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
  };
}

export const NexusDocumentTemplate = ({ data }: { data: NexusDocumentProps }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.companyInfo}>
          <Text style={styles.companyName}>{data.companyName}</Text>
          <Text>{data.companyAddress}</Text>
          <Text>TAX ID: <Text style={styles.textMono}>{data.companyTaxId}</Text></Text>
        </View>
        <View style={styles.docMeta}>
          <Text style={styles.docTitle}>{data.title}</Text>
          <View style={styles.metaGrid}>
            <Text style={styles.metaLabel}>DOCUMENT NO.</Text>
            <Text style={[styles.metaValue, { color: '#00E5FF' }]}>{data.docNo}</Text>
          </View>
          <View style={styles.metaGrid}>
            <Text style={styles.metaLabel}>DATE</Text>
            <Text style={styles.metaValue}>{data.date}</Text>
          </View>
        </View>
      </View>

      {/* BILL TO */}
      <View style={styles.section}>
        <View style={styles.billTo}>
          <Text style={styles.sectionTitle}>ลูกค้า / CUSTOMER</Text>
          <Text style={{ fontWeight: 'bold', marginBottom: 3 }}>{data.customerName}</Text>
          <Text>{data.customerAddress}</Text>
          <Text style={{ marginTop: 5 }}>TAX ID: <Text style={styles.textMono}>{data.customerTaxId || '-'}</Text></Text>
        </View>
      </View>

      {/* TABLE */}
      <View style={styles.table}>
        <View style={[styles.tableRow, styles.tableHeader]}>
          <View style={[styles.tableColHeader, styles.col1]}><Text>No.</Text></View>
          <View style={[styles.tableColHeader, styles.col2]}><Text>Description</Text></View>
          <View style={[styles.tableColHeader, styles.col3]}><Text>Qty</Text></View>
          <View style={[styles.tableColHeader, styles.col4]}><Text>Unit Price</Text></View>
          <View style={[styles.tableColHeader, styles.col5]}><Text>Discount</Text></View>
          <View style={[styles.tableColHeader, styles.col6]}><Text>Total</Text></View>
        </View>

        {data.items.map((item, index) => (
          <View style={styles.tableRow} key={index}>
            <View style={[styles.tableCol, styles.col1]}><Text style={styles.textMono}>{index + 1}</Text></View>
            <View style={[styles.tableCol, styles.col2]}><Text>{item.description}</Text></View>
            <View style={[styles.tableCol, styles.col3]}><Text style={styles.textMono}>{item.qty}</Text></View>
            <View style={[styles.tableCol, styles.col4]}><Text style={styles.textMono}>{item.unitPrice.toLocaleString('th-TH', {minimumFractionDigits: 2})}</Text></View>
            <View style={[styles.tableCol, styles.col5]}><Text style={styles.textMono}>{item.discount ? item.discount.toLocaleString('th-TH', {minimumFractionDigits: 2}) : '-'}</Text></View>
            <View style={[styles.tableCol, styles.col6]}><Text style={styles.textMono}>{item.total.toLocaleString('th-TH', {minimumFractionDigits: 2})}</Text></View>
          </View>
        ))}
      </View>

      {/* SUMMARY */}
      <View style={styles.summarySection}>
        <View style={styles.summaryBox}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>{data.summary.subtotal.toLocaleString('th-TH', {minimumFractionDigits: 2})}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Discount</Text>
            <Text style={styles.summaryValue}>{data.summary.discount.toLocaleString('th-TH', {minimumFractionDigits: 2})}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>VAT (7%)</Text>
            <Text style={styles.summaryValue}>{data.summary.tax.toLocaleString('th-TH', {minimumFractionDigits: 2})}</Text>
          </View>
          <View style={styles.summaryTotal}>
            <Text style={[styles.summaryLabel, { fontWeight: 'bold', color: '#111111' }]}>Net Total</Text>
            <Text style={styles.totalValue}>{data.summary.total.toLocaleString('th-TH', {minimumFractionDigits: 2})} THB</Text>
          </View>
        </View>
      </View>

      <Text style={styles.footer}>
        เอกสารนี้สร้างโดยระบบ NEXUS ERP (Intelligence OS) • {new Date().toLocaleDateString('th-TH')}
      </Text>
    </Page>
  </Document>
);
