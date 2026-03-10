import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';

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
      
      // 優化：檢測頁面大小，若頁面過大則調降 scale
      const initialViewport = page.getViewport({ scale: 1 });
      const maxDimension = Math.max(initialViewport.width, initialViewport.height);
      
      // 若原始尺寸超過 1000px，則降為 2x，否則維持 3x
      const scale = maxDimension > 1000 ? 2 : 3; 
      console.log(`[PDF] Page ${i} max dimension: ${maxDimension}px, using scale: ${scale}`);
      
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) {
        console.error('[PDF] Could not get canvas context for page', i);
        continue;
      }

      // 嚴格限制 Canvas 總像素（避免超出瀏覽器限制，約 16MP）
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

export interface PDFPageSplit {
  pageNumber: number;
  pdfBytes: Uint8Array;
}

/** 將多頁 PDF 拆成每頁各一個單頁 PDF */
export async function splitPDFIntoPages(file: File): Promise<PDFPageSplit[]> {
  const arrayBuffer = await file.arrayBuffer();
  const srcDoc = await PDFDocument.load(arrayBuffer);
  const results: PDFPageSplit[] = [];

  for (let i = 0; i < srcDoc.getPageCount(); i++) {
    const newDoc = await PDFDocument.create();
    const [copiedPage] = await newDoc.copyPages(srcDoc, [i]);
    newDoc.addPage(copiedPage);
    const pdfBytes = await newDoc.save();
    results.push({ pageNumber: i + 1, pdfBytes });
  }

  return results;
}
