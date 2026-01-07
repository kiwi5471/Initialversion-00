import { useCallback, useState } from "react";
import { Upload, Loader2, FileText, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { isPDF, isImage, convertPDFToImages } from "@/lib/pdfUtils";

export interface UploadedFile {
  id: string;
  fileName: string;
  imageUrl: string;
  file: File;
  pageNumber?: number;
}

interface ReceiptUploaderProps {
  onFilesUpload: (files: UploadedFile[]) => void;
  isProcessing: boolean;
}

export function ReceiptUploader({ onFilesUpload, isProcessing }: ReceiptUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isConverting, setIsConverting] = useState(false);

  const processFiles = useCallback(
    async (fileList: FileList) => {
      setIsConverting(true);
      const uploadedFiles: UploadedFile[] = [];

      try {
        for (let i = 0; i < fileList.length; i++) {
          const file = fileList[i];
          
          if (isPDF(file)) {
            // Convert PDF pages to images
            const pages = await convertPDFToImages(file);
            pages.forEach((page) => {
              uploadedFiles.push({
                id: `${file.name}-page-${page.pageNumber}-${Date.now()}`,
                fileName: `${file.name} (第 ${page.pageNumber} 頁)`,
                imageUrl: page.imageUrl,
                file: page.file,
                pageNumber: page.pageNumber,
              });
            });
          } else if (isImage(file)) {
            const url = URL.createObjectURL(file);
            uploadedFiles.push({
              id: `${file.name}-${Date.now()}-${i}`,
              fileName: file.name,
              imageUrl: url,
              file: file,
            });
          }
        }

        if (uploadedFiles.length > 0) {
          onFilesUpload(uploadedFiles);
        }
      } finally {
        setIsConverting(false);
      }
    },
    [onFilesUpload]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files);
      }
    },
    [processFiles]
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
        processFiles(e.target.files);
      }
    },
    [processFiles]
  );

  const showLoading = isProcessing || isConverting;

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
        showLoading && "pointer-events-none opacity-60"
      )}
    >
      <input
        type="file"
        accept="image/*,.pdf,application/pdf"
        multiple
        onChange={handleInputChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        disabled={showLoading}
      />

      <div className="flex flex-col items-center gap-3">
        {showLoading ? (
          <>
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <p className="text-sm font-medium text-foreground">
              {isConverting ? "PDF 轉換中..." : "AI 辨識處理中..."}
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
            <div>
              <p className="text-sm font-medium text-foreground">
                拖放收據圖片或 PDF 至此處
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                支援多選檔案（JPG、PNG、WEBP、PDF）
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
