export interface LineItem {
  id: string;
  category: string; // 憑證種類
  vendor: string; // 廠商
  tax_id: string | null; // 統編
  date: string | null; // 年月日
  invoice_number: string | null; // 發票號碼
  amount_with_tax: string; // 含稅金額（字串格式）
  input_tax: string; // 進項稅額（字串格式）
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
  supplier_name?: string;
  supplier_tax_id?: string;
  invoice_date?: string;
}

export const DOCUMENT_CATEGORIES = [
  { value: "0", label: "0.電子發票" },
  { value: "1", label: "1.三聯式手開發票" },
  { value: "2", label: "2.三聯式收銀機發票" },
  { value: "3", label: "3.二聯式收銀機發票(含機票,車票,水電費收據...等)" },
  { value: "4", label: "4.進貨折讓證明單" },
  { value: "5", label: "5.海關進出口貨物稅費繳納證" },
  { value: "6", label: "6.三聯式零稅率發票" },
  { value: "7", label: "7.進貨零稅率折讓證明單" },
  { value: "8", label: "8.海關進口代徵退還溢繳營業稅" },
  { value: "9", label: "9.境外電商及不得扣抵之電子發票(僅勾稽使用)" },
] as const;
