/**
 * NEXUS ERP: Type Definitions
 * Following Data Models V2.5
 */

export interface Company {
  id: string;
  name: string;
  tax_id: string;
  theme?: {
    primaryColor?: string;
    logoUrl?: string;
  };
  bank_info?: {
    bank_name: string;
    account_number: string;
    account_name: string;
  };
}

export interface Product {
  product_id: string;
  sku: string;
  name: string;
  category_id: string;
  currentQty: number;
  stock_status: {
    qty_on_hand: number;
    qty_reserved: number;
    qty_available: number;
  };
  pricing: {
    avg_cost: number;
    price_pos: number;
    price_project: number;
  };
}

export interface JournalItem {
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
}

export interface JournalEntry {
  entry_id: string;
  company_id: string;
  date: string; // ISO Format or Firestore Timestamp
  description: string;
  reference: string;
  items: JournalItem[];
  total_amount: number;
}

export type UserRole = "ADMIN" | "MANAGER" | "USER";

export interface UserProfile {
  uid: string;
  email: string;
  display_name: string;
  company_id: string;
  role: UserRole;
}
