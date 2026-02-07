import { LineItem, OCRBlock, OCRMetadata } from './recognition';

export interface UploadedFileItem {
  id: string;
  fileName: string;
  imageUrl: string;
  file: File;
  pageNumber?: number;
  serverPath?: string;
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
  serverPath?: string;
}

// Exported LineItem with simplified fields
export interface ExportedLineItem {
  name: string | null;           // 名稱 (發票號碼)
  category: string;              // 類別
  tax_id: string | null;         // 統編
  vendor: string;                // 廠商名稱
  date: string | null;           // 日期
  amount_without_tax: string;    // 未稅
  tax_amount: string;            // 稅額
  amount_with_tax: string;       // 金額
  scanned_filename: string;      // 掃描檔案名稱
  file_path: string;             // 檔案路徑
  user_id: string;               // USERID
  username: string;              // USERNAME
}

export interface ExportData {
  exportedAt: string;
  totalItems: number;
  items: ExportedLineItem[];
}
