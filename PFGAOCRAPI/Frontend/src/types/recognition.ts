export interface LineItem {
  id: string;
  category: string; // 憑證種類
  vendor: string; // 廠商
  tax_id: string | null; // 統編
  date: string | null; // 年月日
  invoice_number: string | null; // 發票號碼
  amount_with_tax: string; // 含稅金額（字串格式）
  input_tax: string; // 進項稅額（字串格式）
  tax_type?: string; // 稅額類型: "0"應稅 | "1"零稅 | "2"免稅
  buyer_name?: string; // 買受人名稱
  buyer_tax_id?: string; // 買受人統編
  is_remodified?: boolean; // 是否修改
  is_reused?: boolean; // 是否重複使用
  pageNumber?: number; // 頁碼
  editable: boolean;
  confirmed: boolean;
  sourceBlockIds: string[];
}

export const TAX_TYPE_OPTIONS = [
  { value: "0", label: "0 應稅" },
  { value: "1", label: "1 零稅" },
  { value: "2", label: "2 免稅" },
] as const;

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
{ value: "00", label: "00.電子發票" },
{ value: "01", label: "01.三聯式手開發票" },
{ value: "02", label: "02.三聯式收銀機發票" },
{ value: "03", label: "03.二聯式收銀機發票(含機票,車票,水電費收據...等)" },
{ value: "04", label: "04.進貨折讓證明單" },
{ value: "05", label: "05.海關進出口貨物稅費繳納證" },
{ value: "06", label: "06.三聯式零稅率發票" },
{ value: "07", label: "07.進貨零稅率折讓證明單" },
{ value: "08", label: "08.海關進口代徵退還溢繳營業稅" },
{ value: "09", label: "09.境外電商及不得扣抵之電子發票(僅勾稽使用)" },
{ value: "10", label: "10.交通票(高鐵)" },
{ value: "11", label: "11.交通票(機票)" },
{ value: "12", label: "12.交通票(客運)" },
{ value: "13", label: "13.交通票(台鐵)" },
] as const;
