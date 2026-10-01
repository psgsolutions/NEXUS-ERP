import { adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { 
  NumberingScheme, 
  GeneratedNumberResult, 
  DEFAULT_NUMBERING_SCHEMES, 
  computeResetKey, 
  renderTemplate 
} from '@/types/numbering';

export * from '@/types/numbering';

export class NumberingService {
  /**
   * Fetches numbering scheme for a company & docType from Firestore, with fallback defaults.
   */
  static async getScheme(
    companyId: string,
    docType: string,
    tx?: admin.firestore.Transaction
  ): Promise<NumberingScheme> {
    const docRef = adminDb.collection('companies').doc(companyId).collection('numberingSchemes').doc(docType);
    const snap = tx ? await tx.get(docRef) : await docRef.get();

    const defaultConfig = DEFAULT_NUMBERING_SCHEMES[docType] || {
      docType,
      template: '{PREFIX}-{YY}{MM}-{SEQ:4}',
      prefix: docType,
      resetPolicy: 'yearly',
      seqPadding: 4,
      yearBasis: 'AD',
      reserveOn: 'draft',
      allowManualOverride: true,
      startingValue: 1,
      overflowPolicy: 'expand',
      fiscalYearStartMonth: 1,
    };

    if (!snap.exists) {
      return defaultConfig as NumberingScheme;
    }

    const data = snap.data() || {};
    const taxMode = Boolean(data.taxCompliantMode);

    return {
      docType,
      template: data.template || defaultConfig.template || '{PREFIX}-{YY}{MM}-{SEQ:4}',
      prefix: data.prefix !== undefined ? data.prefix : defaultConfig.prefix || docType,
      resetPolicy: data.resetPolicy || defaultConfig.resetPolicy || 'yearly',
      seqPadding: typeof data.seqPadding === 'number' ? data.seqPadding : defaultConfig.seqPadding || 4,
      yearBasis: data.yearBasis || defaultConfig.yearBasis || 'AD',
      // Tax Compliant Mode Enforcement: Force reserveOn='approve' & allowManualOverride=false
      reserveOn: taxMode ? 'approve' : (data.reserveOn || defaultConfig.reserveOn || 'draft'),
      allowManualOverride: taxMode ? false : (typeof data.allowManualOverride === 'boolean' ? data.allowManualOverride : true),
      taxCompliantMode: taxMode,
      startingValue: typeof data.startingValue === 'number' ? data.startingValue : 1,
      overflowPolicy: data.overflowPolicy || 'expand',
      fiscalYearStartMonth: typeof data.fiscalYearStartMonth === 'number' ? data.fiscalYearStartMonth : 1,
      branchCode: data.branchCode || 'HQ',
      productSeqScope: data.productSeqScope || 'company_wide',
      useSupplierPartNumber: Boolean(data.useSupplierPartNumber),
      blacklistedNumbers: data.blacklistedNumbers || [],
      updatedAt: data.updatedAt,
      updatedBy: data.updatedBy,
    };
  }

  /**
   * Fetches all numbering schemes configured for a company.
   */
  static async getAllSchemes(companyId: string): Promise<Record<string, NumberingScheme>> {
    const snapshot = await adminDb.collection('companies').doc(companyId).collection('numberingSchemes').get();
    const result: Record<string, NumberingScheme> = {};

    // Start with defaults
    Object.keys(DEFAULT_NUMBERING_SCHEMES).forEach((docType) => {
      result[docType] = DEFAULT_NUMBERING_SCHEMES[docType] as NumberingScheme;
    });

    snapshot.forEach((doc) => {
      const data = doc.data() as NumberingScheme;
      const taxMode = Boolean(data.taxCompliantMode);

      result[doc.id] = {
        ...result[doc.id],
        ...data,
        docType: doc.id,
        reserveOn: taxMode ? 'approve' : (data.reserveOn || 'draft'),
        allowManualOverride: taxMode ? false : (data.allowManualOverride ?? true),
      };
    });

    return result;
  }

  /**
   * Saves or updates a numbering scheme for a company.
   */
  static async saveScheme(
    companyId: string,
    docType: string,
    schemeData: Partial<NumberingScheme>,
    userId: string
  ): Promise<NumberingScheme> {
    if (!schemeData.template || !/\{SEQ(?::\d+)?\}/.test(schemeData.template)) {
      throw new Error('Template must contain at least one {SEQ} or {SEQ:n} token to prevent duplicate document numbers.');
    }

    const isTaxCompliant = Boolean(schemeData.taxCompliantMode || docType === 'TIV');

    const schemeRef = adminDb.collection('companies').doc(companyId).collection('numberingSchemes').doc(docType);
    
    const existing = await this.getScheme(companyId, docType);
    const updated: NumberingScheme = {
      ...existing,
      ...schemeData,
      docType,
      taxCompliantMode: isTaxCompliant,
      // Enforce tax compliance constraints
      reserveOn: isTaxCompliant ? 'approve' : (schemeData.reserveOn || existing.reserveOn || 'draft'),
      allowManualOverride: isTaxCompliant ? false : (schemeData.allowManualOverride ?? existing.allowManualOverride ?? true),
      updatedAt: admin.firestore.Timestamp.now(),
      updatedBy: userId,
    };

    await schemeRef.set(updated, { merge: true });
    return updated;
  }

  /**
   * Atomically generate the next document number inside a transaction.
   */
  static async generateDocumentNumber(
    companyId: string,
    docType: string,
    tx: admin.firestore.Transaction,
    contextOpts?: { brandCode?: string; categoryCode?: string; mnemonic?: string; branchCode?: string }
  ): Promise<GeneratedNumberResult> {
    if (!companyId) {
      throw new Error('Company ID is strictly required for document number generation.');
    }

    // 1. Read scheme inside transaction
    const scheme = await this.getScheme(companyId, docType, tx);

    // 2. Compute resetKey strictly from server timestamp and fiscalYearStartMonth
    const nowServerTimestamp = admin.firestore.Timestamp.now();
    const resetKey = computeResetKey(
      scheme.resetPolicy,
      nowServerTimestamp,
      scheme.yearBasis,
      scheme.fiscalYearStartMonth || 1
    );

    // 3. Counter ID generation (Product scope support)
    let counterScopeSuffix = resetKey;
    if (docType === 'PRODUCT' && scheme.productSeqScope === 'per_brand_category') {
      const brand = (contextOpts?.brandCode || 'GEN').toUpperCase();
      const cat = (contextOpts?.categoryCode || 'GEN').toUpperCase();
      counterScopeSuffix = `${brand}_${cat}_${resetKey}`;
    }

    const counterId = `${companyId}_${docType}_${counterScopeSuffix}`;
    const counterRef = adminDb.collection('counters').doc(counterId);

    // 4. Read counter within transaction
    const counterSnap = await tx.get(counterRef);
    let currentValue = (scheme.startingValue || 1) - 1; // Default startingValue seed

    if (counterSnap.exists) {
      const data = counterSnap.data();
      currentValue = typeof data?.currentValue === 'number' ? data.currentValue : (data?.seq || currentValue);
    }

    const nextValue = currentValue + 1;

    // 5. Update counter inside transaction
    tx.set(
      counterRef,
      {
        companyId,
        docType,
        resetKey,
        currentValue: nextValue,
        seq: nextValue,        // dual-write for legacy compatibility
        lastUpdated: nowServerTimestamp,
        updatedAt: nowServerTimestamp,
      },
      { merge: true }
    );

    // 6. Render template
    const documentNumber = renderTemplate(scheme.template, {
      prefix: scheme.prefix,
      seq: nextValue,
      seqPadding: scheme.seqPadding,
      serverDate: nowServerTimestamp.toDate(),
      yearBasis: scheme.yearBasis,
      brandCode: contextOpts?.brandCode,
      categoryCode: contextOpts?.categoryCode,
      mnemonic: contextOpts?.mnemonic,
      branchCode: contextOpts?.branchCode || scheme.branchCode || 'HQ',
      overflowPolicy: scheme.overflowPolicy || 'expand',
    });

    const snapshot = {
      template: scheme.template,
      resetPolicy: scheme.resetPolicy,
      yearBasis: scheme.yearBasis,
      prefix: scheme.prefix,
      seqPadding: scheme.seqPadding,
      taxCompliantMode: scheme.taxCompliantMode,
    };

    return {
      documentNumber,
      counterId,
      snapshot,
    };
  }

  /**
   * Validate uniqueness before manual override save.
   */
  static async validateManualNumber(
    companyId: string,
    docType: string,
    documentNumber: string
  ): Promise<boolean> {
    if (!companyId || !docType || !documentNumber) {
      return false;
    }

    const collectionMap: Record<string, string> = {
      QO: 'quotations',
      IV: 'invoices',
      RE: 'receipts',
      TIV: 'tax_invoices',
      DR: 'delivery_notes',
      PRJ: 'projects',
      PO: 'purchase_orders',
      SO: 'sales_orders',
      PRODUCT: 'products',
    };

    const targetCollection = collectionMap[docType] || docType.toLowerCase() + 's';
    const collRef = adminDb.collection('companies').doc(companyId).collection(targetCollection);

    const snapshot = await collRef
      .where('documentNumber', '==', documentNumber)
      .where('isDeleted', '==', false)
      .get();

    return snapshot.empty;
  }

  /**
   * Record a void reason log for tax compliance audit.
   */
  static async voidDocumentNumber(
    companyId: string,
    docType: string,
    documentNumber: string,
    voidReason: string,
    userId: string
  ): Promise<void> {
    if (!companyId || !documentNumber || !voidReason) {
      throw new Error('companyId, documentNumber, and voidReason are required for void audit log.');
    }

    const voidLogRef = adminDb.collection('companies').doc(companyId).collection('voidAuditLogs').doc();
    await voidLogRef.set({
      docType,
      documentNumber,
      voidReason,
      voidedBy: userId,
      voidedAt: admin.firestore.Timestamp.now(),
    });
  }

  /**
   * Suggest product code from brand + category code prefixes without locking counter.
   */
  static async suggestProductCode(
    companyId: string,
    brandId?: string,
    categoryId?: string
  ): Promise<string> {
    if (!companyId) {
      throw new Error('Company ID is required to suggest product code.');
    }

    let brandPrefix = 'GEN';
    let catPrefix = 'GEN';

    if (brandId) {
      const brandSnap = await adminDb
        .collection('companies')
        .doc(companyId)
        .collection('brands')
        .doc(brandId)
        .get();
      if (brandSnap.exists) {
        brandPrefix = brandSnap.data()?.codePrefix || brandSnap.data()?.name?.substring(0, 3)?.toUpperCase() || 'GEN';
      }
    }

    if (categoryId) {
      const catSnap = await adminDb
        .collection('companies')
        .doc(companyId)
        .collection('categories')
        .doc(categoryId)
        .get();
      if (catSnap.exists) {
        catPrefix = catSnap.data()?.codePrefix || catSnap.data()?.name?.substring(0, 3)?.toUpperCase() || 'GEN';
      }
    }

    const scheme = await this.getScheme(companyId, 'PRODUCT');
    const now = new Date();

    return renderTemplate(scheme.template, {
      prefix: scheme.prefix,
      seq: scheme.startingValue || 1,
      seqPadding: scheme.seqPadding,
      serverDate: now,
      yearBasis: scheme.yearBasis,
      brandCode: brandPrefix,
      categoryCode: catPrefix,
      overflowPolicy: scheme.overflowPolicy || 'expand',
    });
  }
}
