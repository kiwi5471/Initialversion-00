export interface RecognitionItem {
  id: string;
  name: string;
  amount: number;
  category: string;
  confirmed: boolean;
  sourceBlockIds: string[];
}

export interface OCRBlock {
  id: string;
  page: number;
  text: string;
  bbox: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

export const CATEGORIES = [
  { value: "transportation", label: "交通費" },
  { value: "meals", label: "餐飲費" },
  { value: "accommodation", label: "住宿費" },
  { value: "equipment", label: "設備費" },
  { value: "misc", label: "雜費" },
  { value: "other", label: "其他" },
] as const;
