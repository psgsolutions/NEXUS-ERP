/**
 * Test Suite Runner for Configurable Numbering Engine
 */

function renderTemplate(template, vars) {
  const date = vars.serverDate || new Date();
  const yearBasis = vars.yearBasis || 'AD';
  
  let yearNum = date.getFullYear();
  if (yearBasis === 'BE') {
    yearNum += 543;
  }
  
  const yyyy = yearNum.toString();
  const yy = yyyy.slice(-2);
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');
  const dd = date.getDate().toString().padStart(2, '0');
  const prefix = vars.prefix || '';
  const brandCode = (vars.brandCode || 'GEN').toUpperCase();
  const categoryCode = (vars.categoryCode || 'GEN').toUpperCase();
  const mnemonic = (vars.mnemonic || 'GEN').toUpperCase();

  let rendered = template
    .replace(/\{PREFIX\}/g, prefix)
    .replace(/\{YYYY\}/g, yyyy)
    .replace(/\{YY\}/g, yy)
    .replace(/\{MM\}/g, mm)
    .replace(/\{DD\}/g, dd)
    .replace(/\{BRAND_CODE\}/g, brandCode)
    .replace(/\{CATEGORY_CODE\}/g, categoryCode)
    .replace(/\{MNEMONIC\}/g, mnemonic);

  rendered = rendered.replace(/\{SEQ(?::(\d+))?\}/g, (_, paddingStr) => {
    const padLength = paddingStr ? parseInt(paddingStr, 10) : (vars.seqPadding || 4);
    return vars.seq.toString().padStart(padLength, '0');
  });

  return rendered;
}

function computeResetKey(resetPolicy, date, yearBasis = 'AD') {
  let yearNum = date.getFullYear();
  if (yearBasis === 'BE') {
    yearNum += 543;
  }
  const yyyy = yearNum.toString();
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');
  const dd = date.getDate().toString().padStart(2, '0');

  switch (resetPolicy) {
    case 'daily':
      return `${yyyy}${mm}${dd}`;
    case 'monthly':
      return `${yyyy}${mm}`;
    case 'yearly':
      return yyyy;
    case 'never':
    default:
      return 'ALL';
  }
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  } else {
    console.log(`✓ PASS: ${message}`);
  }
}

console.log('--- Testing Configurable Numbering Engine Logic ---');

// Test 1: Standard QO template with AD year
const t1 = renderTemplate('{PREFIX}-{YY}{MM}-{SEQ:4}', {
  prefix: 'QO',
  seq: 42,
  seqPadding: 4,
  serverDate: new Date(2026, 5, 15), // June 15, 2026
  yearBasis: 'AD',
});
assert(t1 === 'QO-2606-0042', `T1 expected QO-2606-0042, got ${t1}`);

// Test 2: BE (Buddhist Era) year
const t2 = renderTemplate('{PREFIX}-{YYYY}-{SEQ:5}', {
  prefix: 'IV',
  seq: 7,
  seqPadding: 5,
  serverDate: new Date(2026, 5, 15), // June 15, 2026
  yearBasis: 'BE',
});
assert(t2 === 'IV-2569-00007', `T2 expected IV-2569-00007, got ${t2}`);

// Test 3: Product SKU template with BRAND_CODE and CATEGORY_CODE
const t3 = renderTemplate('{PREFIX}-{BRAND_CODE}-{CATEGORY_CODE}-{SEQ:5}', {
  prefix: 'PROD',
  seq: 123,
  brandCode: 'ARUBA',
  categoryCode: 'NETWORK',
});
assert(t3 === 'PROD-ARUBA-NETWORK-00123', `T3 expected PROD-ARUBA-NETWORK-00123, got ${t3}`);

// Test 4: ResetKey computation across month boundary
const keyMay = computeResetKey('monthly', new Date(2026, 4, 31, 23, 59, 59), 'AD'); // May 31
const keyJune = computeResetKey('monthly', new Date(2026, 5, 1, 0, 0, 1), 'AD');   // June 1
assert(keyMay === '202605', `May resetKey expected 202605, got ${keyMay}`);
assert(keyJune === '202606', `June resetKey expected 202606, got ${keyJune}`);
assert(keyMay !== keyJune, 'May and June resetKeys must differ');

// Test 5: Template validation for {SEQ} token
const hasSeqToken = (tpl) => /\{SEQ(?::\d+)?\}/.test(tpl);
assert(hasSeqToken('{PREFIX}-{YY}-{SEQ:4}') === true, 'Template with {SEQ:4} should pass validation');
assert(hasSeqToken('{PREFIX}-{YY}-INVALID') === false, 'Template without {SEQ} should fail validation');

console.log('🎉 All 5 core tests passed successfully!');
