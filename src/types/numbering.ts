export type ResetPolicy = 'never' | 'yearly' | 'monthly' | 'daily';
export type YearBasis = 'AD' | 'BE';
export type ReserveOn = 'draft' | 'approve';
export type OverflowPolicy = 'expand' | 'warn' | 'block';
export type ProductSeqScope = 'company_wide' | 'per_brand_category';

export interface NumberingScheme {
  docType: string;
  template: string;
  prefix: string;
  resetPolicy: ResetPolicy;
  seqPadding: number;
  yearBasis: YearBasis;
  reserveOn: ReserveOn;
  allowManualOverride: boolean;
  // สรรพากร Compliance & Extensions
  taxCompliantMode?: boolean;
  startingValue?: number;
  overflowPolicy?: OverflowPolicy;
  fiscalYearStartMonth?: number; // 1-12 ( default = 1 )
  branchCode?: string;
  productSeqScope?: ProductSeqScope;
  useSupplierPartNumber?: boolean;
  blacklistedNumbers?: string[];
  updatedAt?: any;
  updatedBy?: string;
}

export interface NumberingSchemeSnapshot {
  template: string;
  resetPolicy: ResetPolicy;
  yearBasis: YearBasis;
  prefix: string;
  seqPadding: number;
  taxCompliantMode?: boolean;
}

export interface GeneratedNumberResult {
  documentNumber: string;
  counterId: string;
  snapshot: NumberingSchemeSnapshot;
}

export const DEFAULT_NUMBERING_SCHEMES: Record<string, Partial<NumberingScheme>> = {
  QO: {
    docType: 'QO',
    template: '{PREFIX}-{YY}{MM}-{SEQ:4}',
    prefix: 'QO',
    resetPolicy: 'yearly',
    seqPadding: 4,
    yearBasis: 'AD',
    reserveOn: 'draft',
    allowManualOverride: true,
    taxCompliantMode: false,
    startingValue: 1,
    overflowPolicy: 'expand',
    fiscalYearStartMonth: 1,
    branchCode: 'HQ',
  },
  IV: {
    docType: 'IV',
    template: '{PREFIX}-{YY}{MM}-{SEQ:4}',
    prefix: 'IV',
    resetPolicy: 'yearly',
    seqPadding: 4,
    yearBasis: 'AD',
    reserveOn: 'draft',
    allowManualOverride: true,
    taxCompliantMode: false,
    startingValue: 1,
    overflowPolicy: 'expand',
    fiscalYearStartMonth: 1,
  },
  RE: {
    docType: 'RE',
    template: '{PREFIX}-{YY}{MM}-{SEQ:4}',
    prefix: 'RE',
    resetPolicy: 'yearly',
    seqPadding: 4,
    yearBasis: 'AD',
    reserveOn: 'approve',
    allowManualOverride: false,
    taxCompliantMode: true,
    startingValue: 1,
    overflowPolicy: 'expand',
    fiscalYearStartMonth: 1,
  },
  TIV: {
    docType: 'TIV',
    template: '{PREFIX}-{YY}{MM}-{SEQ:4}',
    prefix: 'TIV',
    resetPolicy: 'yearly',
    seqPadding: 4,
    yearBasis: 'AD',
    reserveOn: 'approve',
    allowManualOverride: false,
    taxCompliantMode: true,
    startingValue: 1,
    overflowPolicy: 'expand',
    fiscalYearStartMonth: 1,
  },
  DR: {
    docType: 'DR',
    template: '{PREFIX}-{YY}{MM}-{SEQ:4}',
    prefix: 'DR',
    resetPolicy: 'yearly',
    seqPadding: 4,
    yearBasis: 'AD',
    reserveOn: 'draft',
    allowManualOverride: true,
    taxCompliantMode: false,
    startingValue: 1,
    overflowPolicy: 'expand',
    fiscalYearStartMonth: 1,
  },
  PRJ: {
    docType: 'PRJ',
    template: '{PREFIX}-{YY}-{SEQ:4}',
    prefix: 'PRJ',
    resetPolicy: 'yearly',
    seqPadding: 4,
    yearBasis: 'AD',
    reserveOn: 'draft',
    allowManualOverride: true,
    taxCompliantMode: false,
    startingValue: 1,
    overflowPolicy: 'expand',
    fiscalYearStartMonth: 1,
  },
  PO: {
    docType: 'PO',
    template: '{PREFIX}-{YY}{MM}-{SEQ:4}',
    prefix: 'PO',
    resetPolicy: 'yearly',
    seqPadding: 4,
    yearBasis: 'AD',
    reserveOn: 'draft',
    allowManualOverride: true,
    taxCompliantMode: false,
    startingValue: 1,
    overflowPolicy: 'expand',
    fiscalYearStartMonth: 1,
  },
  SO: {
    docType: 'SO',
    template: '{PREFIX}-{YY}{MM}-{SEQ:4}',
    prefix: 'SO',
    resetPolicy: 'yearly',
    seqPadding: 4,
    yearBasis: 'AD',
    reserveOn: 'draft',
    allowManualOverride: true,
    taxCompliantMode: false,
    startingValue: 1,
    overflowPolicy: 'expand',
    fiscalYearStartMonth: 1,
  },
  PRODUCT: {
    docType: 'PRODUCT',
    template: '{PREFIX}-{BRAND_CODE}-{CATEGORY_CODE}-{SEQ:5}',
    prefix: 'PROD',
    resetPolicy: 'never',
    seqPadding: 5,
    yearBasis: 'AD',
    reserveOn: 'draft',
    allowManualOverride: true,
    taxCompliantMode: false,
    startingValue: 1,
    overflowPolicy: 'expand',
    productSeqScope: 'company_wide',
    useSupplierPartNumber: false,
  },
};

/**
 * Computes resetKey taking fiscalYearStartMonth and timestamp into account.
 */
export function computeResetKey(
  resetPolicy: ResetPolicy,
  dateInput: Date | any,
  yearBasis: YearBasis = 'AD',
  fiscalYearStartMonth: number = 1
): string {
  const date = dateInput instanceof Date ? dateInput : (dateInput && typeof dateInput.toDate === 'function' ? dateInput.toDate() : new Date());
  
  let yearNum = date.getFullYear();
  const monthNum = date.getMonth() + 1; // 1-12

  // Fiscal Year adjustment: if current month is before fiscalYearStartMonth, fiscal year is previous year
  if (fiscalYearStartMonth > 1 && monthNum < fiscalYearStartMonth) {
    yearNum -= 1;
  }

  if (yearBasis === 'BE') {
    yearNum += 543;
  }

  const yyyy = yearNum.toString();
  const mm = monthNum.toString().padStart(2, '0');
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

/**
 * Renders document number template with tokens:
 * {PREFIX}, {YY}, {YYYY}, {MM}, {DD}, {SEQ:n}, {BRAND_CODE}, {CATEGORY_CODE}, {MNEMONIC}, {BRANCH}
 */
export function renderTemplate(
  template: string,
  vars: {
    prefix?: string;
    seq: number;
    seqPadding?: number;
    serverDate?: Date;
    yearBasis?: YearBasis;
    brandCode?: string;
    categoryCode?: string;
    mnemonic?: string;
    branchCode?: string;
    overflowPolicy?: OverflowPolicy;
  }
): string {
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
  const branchCode = (vars.branchCode || 'HQ').toUpperCase();

  let rendered = template
    .replace(/\{PREFIX\}/g, prefix)
    .replace(/\{YYYY\}/g, yyyy)
    .replace(/\{YY\}/g, yy)
    .replace(/\{MM\}/g, mm)
    .replace(/\{DD\}/g, dd)
    .replace(/\{BRAND_CODE\}/g, brandCode)
    .replace(/\{CATEGORY_CODE\}/g, categoryCode)
    .replace(/\{MNEMONIC\}/g, mnemonic)
    .replace(/\{BRANCH\}/g, branchCode);

  // Replace {SEQ:n} or {SEQ}
  rendered = rendered.replace(/\{SEQ(?::(\d+))?\}/g, (_, paddingStr) => {
    const padLength = paddingStr ? parseInt(paddingStr, 10) : (vars.seqPadding || 4);
    const seqStr = vars.seq.toString();
    
    // Overflow Policy: if sequence length exceeds padLength
    if (seqStr.length > padLength) {
      if (vars.overflowPolicy === 'warn' || vars.overflowPolicy === 'block') {
        console.warn(`Sequence overflow: sequence ${seqStr} exceeds padding ${padLength}`);
      }
      // 'expand' automatically uses full sequence length without truncation
      return seqStr;
    }
    
    return seqStr.padStart(padLength, '0');
  });

  return rendered;
}
