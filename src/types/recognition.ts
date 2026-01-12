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

export const CURRENCIES = [
  { value: "NT", label: "NT" },
  { value: "JP", label: "JP" },
  { value: "USD", label: "USD" },
] as const;
