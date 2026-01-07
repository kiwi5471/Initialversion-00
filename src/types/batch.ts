import { RecognitionItem, OCRBlock } from './recognition';

export interface FileProcessingResult {
  id: string;
  fileName: string;
  imageUrl: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  items: RecognitionItem[];
  ocrBlocks: OCRBlock[];
  error?: string;
}

export interface BatchProcessingState {
  files: FileProcessingResult[];
  currentIndex: number;
  isProcessing: boolean;
}
