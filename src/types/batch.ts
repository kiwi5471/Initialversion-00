import { RecognitionItem, OCRBlock, OCRMetadata } from './recognition';

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
  items: RecognitionItem[];
  ocrBlocks: OCRBlock[];
  metadata?: OCRMetadata;
  error?: string;
}

export interface ExportData {
  exportedAt: string;
  files: {
    fileName: string;
    imageUrl: string;
    items: RecognitionItem[];
    ocrBlocks: OCRBlock[];
    metadata?: OCRMetadata;
  }[];
}
