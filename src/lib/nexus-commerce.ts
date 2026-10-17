import { collection, query, where, getDocs, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase-client";

export const getCompanyCustomers = async (companyId: string) => {
  return [];
};

export const getCompanyQuotations = async (companyId: string) => {
  return [];
};

export const getCompanySalesOrders = async (companyId: string) => {
  return [];
};

export const syncQuotationWithCustomer = async (companyId: string, quoteId: string) => {
  return true;
};

export const createCustomer = async (data: any) => {
  const { companyId, ...customerData } = data;
  if (!companyId) throw new Error("Company ID is required");
  const id = `CUS-${Date.now()}`;
  const ref = doc(db, "companies", companyId, "customers", id);
  await setDoc(ref, {
    ...customerData,
    companyId,
    id,
    createdAt: serverTimestamp()
  });
  return id;
};

export const generateDocumentNo = async (type: string, companyId: string) => {
  return `${type}-${Date.now()}`;
};
