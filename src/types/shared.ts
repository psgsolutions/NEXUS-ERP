export interface DocumentItem {
  id: string; // Used for unique key in lists, usually Date.now().toString()
  productId: string; // The SKU or unique ID of the product
  description: string; // The name or description of the item
  quantity: number;
  unit: string;
  unitPrice: number;
  discount: number;
  totalAmount: number; // (quantity * unitPrice) - discount
  cost?: number; // Cost per unit for margin calculation
  isLabor?: boolean;
  subjectToWHT?: boolean;
  remarks?: string; // Additional long text details (accordion)
}
