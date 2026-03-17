import { LineItem, OCRBlock, OCRMetadata } from './recognition';

export interface UploadedFileItem {
  id: string;
  fileName: string;
  imageUrl: string;
  file: File;
  pageNumber?: number;
}

export interface FileProcessingResult {
  id: string;
  fileName: string;
  imageUrl: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  lineItems: LineItem[];
  ocrBlocks: OCRBlock[];
  metadata?: OCRMetadata;
  usage?: any;
  error?: string;
}

// Exported LineItem - 欄位名稱對齊 TFGAOCRV 資料表
export interface ExportedLineItem {
  name: string | null;           // INVOICE_NO 發票號碼
  category: string;              // VOUCHER_TYPE 憑證類型
  tax_id: string | null;         // SELLER_TAX_ID 賣方統編
  vendor: string;                // SELLER_NAME 賣方名稱
  buyer_name: string;            // BUYER_NAME 買受人名稱
  buyer_tax_id: string;          // BUYER_TAX_ID 買受人統編
  date: string | null;           // INVOICE_DATE 發票日期
  amount_before_tax: string;     // AMT_BEFORE_TAX 未稅金額
  tax_type: string;              // TAX_TYPE 稅額類型 (0應稅, 1零稅, 2免稅)
  tax_amount: string;            // TAX_AMT 稅額
  amount_with_tax: string;       // AMT_TOTAL 含稅總額
  modify_note: string;           // MODIFY_NOTE 是否修改 (Y/N)
  is_reused: string;             // IS_REUSED 是否重複使用 (Y/N)
  scanned_filename: string;      // FILE_NAME 掃描檔案名稱
  file_path: string;             // FILE_PATH 檔案路徑
  page_number?: number;          // 頁碼 (PAGE_NUM)
  user_id: string;               // UPLOAD_USER (系統用)
  username: string;              // USERNAME
  model: string;                 // 所使用的模型
}

export interface ExportData {
  exportedAt: string;
  totalItems: number;
  items: ExportedLineItem[];
}
