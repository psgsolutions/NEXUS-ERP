import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { registerSarabunFont } from './SarabunFont';

// Register font
registerSarabunFont();

// Base styles for A4 Document
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Sarabun',
    fontSize: 12,
    padding: 30,
    color: '#333333',
    backgroundColor: '#ffffff'
  },
  row: {
    flexDirection: 'row',
  },
  col: {
    flexDirection: 'column',
  },
  bold: {
    fontWeight: 'bold',
  },
  textRight: {
    textAlign: 'right',
  },
  textCenter: {
    textAlign: 'center',
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
    paddingBottom: 5,
    marginBottom: 5,
  },
  // Table styles
  table: {
    display: 'flex',
    flexDirection: 'column',
    width: 'auto',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#cccccc',
    borderBottomWidth: 0,
    borderRightWidth: 0,
  },
  tableRow: {
    margin: 'auto',
    flexDirection: 'row',
  },
  tableHeader: {
    backgroundColor: '#f1f5f9',
    fontWeight: 'bold',
  },
  tableHeaderDark: {
    backgroundColor: '#1e293b',
    color: '#ffffff',
    fontWeight: 'bold',
  },
  tableCol: {
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#cccccc',
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  tableCell: {
    margin: 5,
    fontSize: 10,
  }
});

// Types
type BlockType = 'HEADER' | 'CUSTOMER_INFO' | 'ITEMS_TABLE' | 'SUMMARY' | 'SIGNATURE' | 'TEXT';
interface FormBlock {
  id: string;
  type: BlockType;
  props: any;
}

interface DocumentRendererProps {
  blocks: FormBlock[];
  data: any;
}

// Helper to replace {{variables}}
const bindData = (text: string, data: any) => {
  if (!text) return '';
  return text.replace(/\{\{([\w.]+)\}\}/g, (match, path) => {
    const keys = path.split('.');
    let value = data;
    for (const key of keys) {
      if (value === undefined || value === null) return '';
      value = value[key];
    }
    return value !== undefined && value !== null ? String(value) : '';
  });
};

export const DocumentRenderer = ({ blocks, data }: DocumentRendererProps) => {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {blocks.map((block) => (
          <BlockRenderer key={block.id} block={block} data={data} />
        ))}
      </Page>
    </Document>
  );
};

const BlockRenderer = ({ block, data }: { block: FormBlock, data: any }) => {
  const p = block.props;

  if (block.type === 'HEADER') {
    return (
      <View style={[styles.row, { justifyContent: p.align === 'center' ? 'center' : 'space-between', alignItems: 'flex-start', marginBottom: 20 }]}>
        {p.showLogo && (
          <View style={{ width: 100, height: 50, backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontSize: 16, color: '#94a3b8', fontWeight: 'bold' }}>LOGO</Text>
          </View>
        )}
        <View style={[styles.col, p.align === 'center' ? styles.textCenter : styles.textRight, { flex: 1, marginLeft: p.showLogo && p.align !== 'center' ? 20 : 0 }]}>
          <Text style={[styles.bold, { fontSize: p.titleSize === 'xl' ? 16 : p.titleSize === '4xl' ? 24 : 20, marginBottom: 5 }]}>
            {bindData(p.titleText, data) || 'DOCUMENT TITLE'}
          </Text>
          <Text>{bindData(p.companyName, data) || 'บริษัท เน็กซัส จำกัด'}</Text>
          <Text style={{ fontSize: 10, color: '#64748b' }}>{bindData(p.address, data) || '123 ถนนวิทยุ แขวงลุมพินี เขตปทุมวัน กรุงเทพฯ 10330'}</Text>
          <Text style={{ fontSize: 10, marginTop: 5 }}>DOC: {data?.documentCode || 'N/A'} | DATE: {data?.documentDate || 'N/A'}</Text>
        </View>
      </View>
    );
  }

  if (block.type === 'CUSTOMER_INFO') {
    return (
      <View style={[styles.borderBottom, { marginBottom: 15 }]}>
        <Text style={[styles.bold, { marginBottom: 5 }]}>{p.sectionTitle || 'ลูกค้า (Customer)'}</Text>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 10 }}>นามลูกค้า: {data?.customerName || '________________________'}</Text>
            <Text style={{ fontSize: 10, marginTop: 2 }}>เลขผู้เสียภาษี: {data?.customerTaxId || '________________________'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 10 }}>ที่อยู่: {data?.customerAddress || '________________________'}</Text>
          </View>
        </View>
      </View>
    );
  }

  if (block.type === 'ITEMS_TABLE') {
    const items = data?.items && data.items.length > 0 ? data.items : [
      { name: 'สินค้าตัวอย่าง 1', qty: 2, unit: 'ชิ้น', price: 1500, total: 3000 },
      { name: 'สินค้าตัวอย่าง 2', qty: 1, unit: 'งาน', price: 2500, total: 2500 }
    ];

    const showUnit = p.showUnit;

    return (
      <View style={styles.table}>
        {/* Table Header */}
        <View style={[styles.tableRow, p.headerColor === 'dark' ? styles.tableHeaderDark : styles.tableHeader]}>
          <View style={[styles.tableCol, { width: '10%' }]}><Text style={[styles.tableCell, styles.textCenter]}>ลำดับ</Text></View>
          <View style={[styles.tableCol, { width: showUnit ? '40%' : '50%' }]}><Text style={styles.tableCell}>รายการ</Text></View>
          <View style={[styles.tableCol, { width: '15%' }]}><Text style={[styles.tableCell, styles.textRight]}>จำนวน</Text></View>
          {showUnit && <View style={[styles.tableCol, { width: '10%' }]}><Text style={[styles.tableCell, styles.textCenter]}>หน่วย</Text></View>}
          <View style={[styles.tableCol, { width: '15%' }]}><Text style={[styles.tableCell, styles.textRight]}>ราคา/หน่วย</Text></View>
          <View style={[styles.tableCol, { width: '20%' }]}><Text style={[styles.tableCell, styles.textRight]}>ยอดรวม</Text></View>
        </View>
        {/* Table Body */}
        {items.map((item: any, i: number) => (
          <View style={styles.tableRow} key={i}>
            <View style={[styles.tableCol, { width: '10%' }]}><Text style={[styles.tableCell, styles.textCenter]}>{i + 1}</Text></View>
            <View style={[styles.tableCol, { width: showUnit ? '40%' : '50%' }]}><Text style={styles.tableCell}>{item.name}</Text></View>
            <View style={[styles.tableCol, { width: '15%' }]}><Text style={[styles.tableCell, styles.textRight]}>{item.qty}</Text></View>
            {showUnit && <View style={[styles.tableCol, { width: '10%' }]}><Text style={[styles.tableCell, styles.textCenter]}>{item.unit}</Text></View>}
            <View style={[styles.tableCol, { width: '15%' }]}><Text style={[styles.tableCell, styles.textRight]}>{Number(item.price).toLocaleString('th-TH', {minimumFractionDigits:2})}</Text></View>
            <View style={[styles.tableCol, { width: '20%' }]}><Text style={[styles.tableCell, styles.textRight]}>{Number(item.total).toLocaleString('th-TH', {minimumFractionDigits:2})}</Text></View>
          </View>
        ))}
      </View>
    );
  }

  if (block.type === 'SUMMARY') {
    const subTotal = data?.subTotal || 5500;
    const vatAmount = data?.vatAmount || 385;
    const whtAmount = data?.whtAmount || 165;
    const grandTotal = data?.grandTotal || 5885;

    return (
      <View style={[styles.row, { justifyContent: 'flex-end', marginTop: 10 }]}>
        <View style={{ width: '40%', borderStyle: 'solid', borderWidth: 1, borderColor: '#cccccc' }}>
          <View style={[styles.row, styles.borderBottom, { padding: 5, marginBottom: 0, borderBottomWidth: 1 }]}>
            <Text style={{ flex: 1, fontSize: 10 }}>มูลค่าสินค้า (Sub Total)</Text>
            <Text style={[styles.bold, { fontSize: 10 }]}>{Number(subTotal).toLocaleString('th-TH', {minimumFractionDigits:2})}</Text>
          </View>
          
          {p.showVat && (
            <View style={[styles.row, styles.borderBottom, { padding: 5, marginBottom: 0, borderBottomWidth: 1 }]}>
              <Text style={{ flex: 1, fontSize: 10 }}>ภาษีมูลค่าเพิ่ม 7% (VAT)</Text>
              <Text style={{ fontSize: 10 }}>{Number(vatAmount).toLocaleString('th-TH', {minimumFractionDigits:2})}</Text>
            </View>
          )}

          {p.showWht && (
            <View style={[styles.row, styles.borderBottom, { padding: 5, marginBottom: 0, borderBottomWidth: 1 }]}>
              <Text style={{ flex: 1, fontSize: 10, color: '#ef4444' }}>หัก ณ ที่จ่าย (WHT)</Text>
              <Text style={{ fontSize: 10, color: '#ef4444' }}>-{Number(whtAmount).toLocaleString('th-TH', {minimumFractionDigits:2})}</Text>
            </View>
          )}

          <View style={[styles.row, { padding: 5, backgroundColor: '#f1f5f9' }]}>
            <Text style={[styles.bold, { flex: 1 }]}>ยอดรวมทั้งสิ้น (Grand Total)</Text>
            <Text style={[styles.bold]}>{Number(grandTotal).toLocaleString('th-TH', {minimumFractionDigits:2})}</Text>
          </View>
        </View>
      </View>
    );
  }

  if (block.type === 'SIGNATURE') {
    return (
      <View style={[styles.row, { justifyContent: 'space-around', marginTop: 50 }]}>
        <View style={[styles.col, styles.textCenter]}>
          <Text style={{ borderBottomWidth: 1, borderBottomStyle: 'dashed', borderBottomColor: '#64748b', width: 150, marginBottom: 5 }}> </Text>
          <Text style={{ fontSize: 10 }}>{p.leftLabel || 'ลายเซ็นลูกค้า'}</Text>
          <Text style={{ fontSize: 8, color: '#64748b', marginTop: 3 }}>วันที่: ____/____/____</Text>
        </View>
        <View style={[styles.col, styles.textCenter]}>
          <Text style={{ borderBottomWidth: 1, borderBottomStyle: 'dashed', borderBottomColor: '#64748b', width: 150, marginBottom: 5 }}> </Text>
          <Text style={{ fontSize: 10 }}>{p.rightLabel || 'ผู้มีอำนาจลงนาม'}</Text>
          <Text style={{ fontSize: 8, color: '#64748b', marginTop: 3 }}>วันที่: ____/____/____</Text>
        </View>
      </View>
    );
  }

  if (block.type === 'TEXT') {
    return (
      <View style={{ marginTop: 15, marginBottom: 15 }}>
        <Text style={[
          p.bold && styles.bold,
          p.align === 'center' ? styles.textCenter : p.align === 'right' ? styles.textRight : {},
          { fontSize: p.size === 'sm' ? 10 : p.size === 'lg' ? 14 : 12 }
        ]}>
          {bindData(p.content, data)}
        </Text>
      </View>
    );
  }

  return null;
};
