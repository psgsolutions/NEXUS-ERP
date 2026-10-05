const fs = require('fs');
const path = require('path');

const occurrences = JSON.parse(fs.readFileSync(path.join(__dirname, 'font_black_matches.json'), 'utf8'));

const groupA = [];
const groupB = [];
const ambiguous = [];

// Keywords that clearly indicate Group B (numbers, totals, financial metrics, badges, KPI numbers)
const numberKeywords = [
  'mono-numbers', 'font-mono', 'total', 'grandTotal', 'subTotal', 'amount', 'price',
  'vat', 'wht', 'kpi', 'number', 'count', 'qty', 'percent', 'balance', 'value',
  'cost', 'rate', 'revenue', 'profit', 'margin', 'gpPercent', 'formatted', 'sum',
  'nettotal', 'net_total', 'due', 'paid', 'credit', 'debit', 'metric', 'value', 'sku', 'docno', 'code'
];

// Patterns for Group A vs Group B
occurrences.forEach((occ) => {
  const line = occ.snippet.toLowerCase();
  
  // Check if line contains clear numeric or metric elements (Group B)
  const isNumberOrMetric = numberKeywords.some(kw => line.includes(kw)) ||
    /\{.*(total|amount|price|qty|num|count|value|sum|balance|val|rate|percent|gp|cost|price|metric|formatted|badge).*\}/i.test(occ.snippet) ||
    /mono-numbers|font-mono/i.test(occ.snippet);

  // Check if line is clearly a UI label, header, tab, button title, or field label (Group A)
  const isLabelOrHeader = 
    /<(th|h1|h2|h3|h4|h5|h6|label|span|p|div|button)\b[^>]*className="[^"]*font-black[^"]*"[^>]*>/i.test(occ.snippet) &&
    !isNumberOrMetric &&
    (
      line.includes('label') || line.includes('header') || line.includes('title') ||
      line.includes('placeholder') || line.includes('th ') || line.includes('uppercase') ||
      line.includes('tracking-') || line.includes('text-white/20') || line.includes('text-white/30') ||
      line.includes('text-white/40') || line.includes('text-white/50') || line.includes('text-white/60') ||
      line.includes('text-slate') || line.includes('text-zinc') || line.includes('tab') ||
      line.includes('button') || line.includes('pilltab') || line.includes('tactical') ||
      line.includes('ค้นหา') || line.includes('สถานะ') || line.includes('ข้อมูล') || line.includes('รายการ')
    );

  if (isNumberOrMetric && !line.includes('header') && !line.includes('th ')) {
    groupB.push({ ...occ, reason: 'ตัวเลข/ยอดเงิน/ราคา/KPI/Monospace/GrandTotal' });
  } else if (isLabelOrHeader || line.includes('header') || line.includes('label') || line.includes('th ')) {
    groupA.push({ ...occ, reason: 'Label/Header/หัวข้อตาราง/ชื่อฟิลด์' });
  } else {
    // Check if it's text vs number in context
    if (/[\u0E00-\u0E7F]/.test(occ.snippet) && !/\d/.test(occ.snippet)) {
      groupA.push({ ...occ, reason: 'ข้อความภาษาไทย/หัวข้อ' });
    } else if (/\d/.test(occ.snippet) || line.includes('number') || line.includes('count')) {
      groupB.push({ ...occ, reason: 'มีตัวเลข/จำนวน' });
    } else {
      ambiguous.push({ ...occ, reason: 'ต้องพิจารณาบริบทเฉพาะจุด' });
    }
  }
});

console.log(`Group A (Labels / Table Headers / Field Titles): ${groupA.length}`);
console.log(`Group B (Key Numbers / Grand Totals / KPIs / Monospace): ${groupB.length}`);
console.log(`Ambiguous / Needs Review: ${ambiguous.length}`);

fs.writeFileSync(path.join(__dirname, 'audit_summary.json'), JSON.stringify({
  summary: {
    groupACount: groupA.length,
    groupBCount: groupB.length,
    ambiguousCount: ambiguous.length
  },
  groupA,
  groupB,
  ambiguous
}, null, 2));
