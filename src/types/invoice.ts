import { DocumentItem } from '@/types/shared';

export interface InvoiceDocument {
  id?: string;
  companyId: string;           // Tenant Isolation
  invoiceNo: string;           
  referenceSoId: string;       
  referencePoNo: string;       
  
  customerId: string;          
  customerName: string;
  customerTaxId: string;
  billingAddress: string;

  issueDate: Date | any;             
  dueDate: Date | any;               
  paymentTerms: string;        
  
  items: DocumentItem[];        
  
  vatType: 'EXCLUDE' | 'INCLUDE' | 'NO_VAT';
  whtRate: number; // 0, 1, 3, 5

  // Financial Summary
  subTotal: number;            
  discountTotal: number;       
  vatAmount: number;           
  whtAmount: number;           
  grandTotal: number;          
  
  status: 'DRAFT' | 'WAITING_PAYMENT' | 'PAID' | 'VOID'; 
  
  createdBy: string;           
  createdAt: Date | any;
  isDeleted: boolean;          
}
