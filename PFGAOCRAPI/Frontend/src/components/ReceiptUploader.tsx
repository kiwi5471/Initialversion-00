import { useCallback, useState, useRef } from "react";
import { Loader2, FileText, Image as ImageIcon, Upload } from "lucide-react";
import { cn, getURLUserInfo, getApiBase } from "@/lib/utils";
import { isPDF, isImage, convertPDFToImages, splitPDFIntoPages } from "@/lib/pdfUtils";
import { UploadedFileItem } from "@/types/batch";
import { Button } from "@/components/ui/button";

interface ReceiptUploaderProps {
  onFilesAdd: (files: UploadedFileItem[]) => void;
  disabled?: boolean;
  model?: string;
}

// Convert Uint8Array to base64 string (chunked to avoid stack overflow on large files)
const uint8ArrayToBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
};

export function ReceiptUploader({ onFilesAdd, disabled, model }: ReceiptUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      
      setIsConverting(true);
      const uploadedFiles: UploadedFileItem[] = [];

      console.log('[Upload] Processing', files.length, 'files');

      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          console.log('[Upload] Processing file:', file.name, 'type:', file.type);
          
          if (isPDF(file)) {
            console.log('[Upload] Detected PDF, converting...');

            // 將 PDF 拆頁，每頁各自上傳一個單頁 PDF 到伺服器
            splitPDFIntoPages(file).then(pages => {
              const apiBase = getApiBase();
              const endpoint = import.meta.env.DEV ? `${apiBase}/save-file` : `${apiBase}/save_ocr.asp`;
              const userInfo = getURLUserInfo();
              const ext = '.pdf';
              const baseName = file.name.toLowerCase().endsWith('.pdf')
                ? file.name.slice(0, -4)
                : file.name;
              pages.forEach(({ pageNumber, pdfBytes }) => {
                const pageFileName = `${baseName} (第 ${pageNumber} 頁)${ext}`;
                const rawBase64 = uint8ArrayToBase64(pdfBytes);
                fetch(endpoint, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ fileName: pageFileName, base64Data: rawBase64, ...userInfo, model: model || '' }),
                }).catch(err => console.error(`PDF page ${pageNumber} upload failed:`, err));
              });
            }).catch(err => console.error('PDF split failed:', err));

            const pages = await convertPDFToImages(file);
            console.log('[Upload] PDF converted, pages:', pages.length);
            pages.forEach((page) => {
              const ext = file.name.includes('.') ? '.' + file.name.split('.').pop() : '';
              const baseName = ext ? file.name.slice(0, -ext.length) : file.name;
              uploadedFiles.push({
                id: `${file.name}-page-${page.pageNumber}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                fileName: `${baseName} (第 ${page.pageNumber} 頁)${ext}`,
                imageUrl: page.imageUrl,
                file: page.file,
                pageNumber: page.pageNumber,
              });
            });
          } else if (isImage(file)) {
            console.log('[Upload] Detected image');
            const url = URL.createObjectURL(file);
            uploadedFiles.push({
              id: `${file.name}-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
              fileName: file.name,
              imageUrl: url,
              file: file,
            });
          }
        }

        console.log('[Upload] Total files processed:', uploadedFiles.length);
        
        if (uploadedFiles.length > 0) {
          onFilesAdd(uploadedFiles);
        }
      } catch (error) {
        console.error('[Upload] Error processing files:', error);
      } finally {
        setIsConverting(false);
      }
    },
    [onFilesAdd, model]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (!disabled && e.dataTransfer.files.length > 0) {
        // Copy FileList immediately; some browsers may mutate FileList after input reset.
        processFiles(Array.from(e.dataTransfer.files));
      }
    },
    [processFiles, disabled]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        // IMPORTANT: Copy FileList BEFORE clearing input value, otherwise only the first file
        // may be processed in some environments.
        const files = Array.from(e.target.files);
        console.log('[Upload] Files selected:', files.length, files.map(f => f.name));
        e.target.value = '';
        processFiles(files);
      }
    },
    [processFiles]
  );

  const handleButtonClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const showLoading = isConverting;

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={cn(
        "relative border-2 border-dashed rounded-xl p-8 text-center transition-all",
        isDragOver
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-primary/50",
        (showLoading || disabled) && "pointer-events-none opacity-60"
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,application/pdf"
        multiple
        onChange={handleInputChange}
        className="hidden"
        disabled={showLoading || disabled}
      />

      <div className="flex flex-col items-center gap-4">
        {showLoading ? (
          <>
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <p className="text-sm font-medium text-foreground">
              PDF 轉換中...
            </p>
          </>
        ) : (
          <>
            <div className="flex items-center justify-center gap-3">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-primary/10">
                <ImageIcon className="w-7 h-7 text-primary" />
              </div>
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-primary/10">
                <FileText className="w-7 h-7 text-primary" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                拖放收據圖片或 PDF 至此處
              </p>
              <p className="text-xs text-muted-foreground">
                支援多選檔案（JPG、PNG、WEBP、PDF）
              </p>
            </div>
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleButtonClick}
              className="gap-2"
            >
              <Upload className="w-4 h-4" />
              選擇多個檔案
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
