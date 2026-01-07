import * as pdfjsLib from 'pdfjs-dist';

// Set the worker source for pdfjs-dist v3.x
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

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
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: PDFPage[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const scale = 2; // Higher scale for better OCR quality
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) continue;

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;

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
  }

  return pages;
}
