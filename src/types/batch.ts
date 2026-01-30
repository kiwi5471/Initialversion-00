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
  error?: string;
}

// Exported LineItem without sourceBlockIds
export interface ExportedLineItem {
  id: string;
  category: string;
  vendor: string;
  tax_id: string | null;
  date: string | null;
  invoice_number: string | null;
  amount_with_tax: string;
  input_tax: string;
  editable: boolean;
  confirmed: boolean;
}

export interface ExportData {
  exportedAt: string;
  totalFiles: number;
  totalLineItems: number;
  files: {
    fileName: string;
    lineItems: ExportedLineItem[];
    ocrBlocks: OCRBlock[];
    metadata?: OCRMetadata;
  }[];
}
