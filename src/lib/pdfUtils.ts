import * as pdfjsLib from 'pdfjs-dist';

// Use a more reliable way to set the worker in a Vite project
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface PDFPage {
  pageNumber: number;
  imageUrl: string;
  file: File;
}

export function isPDF(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

export function isImage(file: File): boolean {
  return file.type.startsWith('image/');
}

export async function convertPDFToImages(file: File): Promise<PDFPage[]> {
  console.log('[PDF] Starting conversion for:', file.name);
  const pages: PDFPage[] = [];

  try {
    const arrayBuffer = await file.arrayBuffer();
    console.log('[PDF] File loaded, size:', arrayBuffer.byteLength);

    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    console.log('[PDF] Loading task created');

    const pdf = await loadingTask.promise;
    console.log('[PDF] Document loaded, pages:', pdf.numPages);

    for (let i = 1; i <= pdf.numPages; i++) {
      console.log('[PDF] Processing page', i);
      const page = await pdf.getPage(i);
      const scale = 3; // Higher scale (3x) for better OCR quality
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) {
        console.error('[PDF] Could not get canvas context for page', i);
        continue;
      }

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;

      console.log('[PDF] Page', i, 'rendered');

      const imageUrl = canvas.toDataURL('image/png');
      
      // Convert data URL to File for consistent handling
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const pageFile = new File([blob], `${file.name}_page_${i}.png`, { type: 'image/png' });

      pages.push({
        pageNumber: i,
        imageUrl,
        file: pageFile,
      });

      console.log('[PDF] Page', i, 'completed');
    }

    console.log('[PDF] Conversion complete, total pages:', pages.length);
  } catch (error) {
    console.error('[PDF] Conversion error:', error);
    throw error;
  }

  return pages;
}
