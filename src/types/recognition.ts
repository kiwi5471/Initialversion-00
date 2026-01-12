export interface LineItem {
  id: string;
  vendor: string;
  tax_id: string | null;
  description: string;
  amount: number;
  unit: string;
  editable: boolean;
  confirmed: boolean;
  sourceBlockIds: string[];
}

export interface OCRBlock {
  id: string;
  page: number;
  text: string;
  type: string;
  confidence: number;
  bbox: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

export interface OCRMetadata {
  vendor?: string;
  tax_id?: string;
  date?: string;
  total_amount?: number;
}

export const UNITS = [
  { value: "元", label: "元" },
  { value: "份", label: "份" },
  { value: "個", label: "個" },
  { value: "張", label: "張" },
  { value: "次", label: "次" },
  { value: "趟", label: "趟" },
] as const;
