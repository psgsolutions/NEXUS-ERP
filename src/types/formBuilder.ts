export type ElementType = 'label' | 'textbox' | 'text' | 'table' | 'image' | 'rectangle' | 'line';

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number | string;
  height: number | string;
}

export interface FormElement {
  id: string;
  type: ElementType;
  position: Position;
  size: Size;
  content?: string; // HTML string or plain text
  style?: {
    fontFamily?: string;
    fontSize?: number;
    color?: string;
    backgroundColor?: string;
    borderColor?: string;
    borderWidth?: number;
    borderStyle?: 'solid' | 'dashed' | 'dotted';
    textAlign?: 'left' | 'center' | 'right' | 'justify';
    fontWeight?: 'normal' | 'bold';
    fontStyle?: 'normal' | 'italic';
    borderRadius?: number | string;
    padding?: number;
    objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  };
  properties?: {
    controlSource?: string;
    visible?: boolean;
    imageUrl?: string;
    [key: string]: any;
  };
}

export interface FormTemplate {
  id: string;
  companyId: string; // Tenant Isolation Constraint
  isDeleted: boolean; // Soft Delete Constraint
  name: string;
  description?: string;
  paperSize: 'A4' | 'Letter' | 'Custom';
  orientation: 'portrait' | 'landscape';
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  elements: FormElement[];
  createdAt: Date | string;
  updatedAt: Date | string;
}
