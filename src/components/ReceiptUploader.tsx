import { useCallback, useState } from "react";
import { Loader2, FileText, Image as ImageIcon, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { isPDF, isImage, convertPDFToImages } from "@/lib/pdfUtils";
import { UploadedFileItem } from "@/types/batch";

interface ReceiptUploaderProps {
  onFilesAdd: (files: UploadedFileItem[]) => void;
  disabled?: boolean;
}

export function ReceiptUploader({ onFilesAdd, disabled }: ReceiptUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isConverting, setIsConverting] = useState(false);

  const processFiles = useCallback(
    async (fileList: FileList) => {
      setIsConverting(true);
      const uploadedFiles: UploadedFileItem[] = [];

      try {
        for (let i = 0; i < fileList.length; i++) {
          const file = fileList[i];
          
          if (isPDF(file)) {
            const pages = await convertPDFToImages(file);
            pages.forEach((page) => {
              uploadedFiles.push({
                id: `${file.name}-page-${page.pageNumber}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                fileName: `${file.name} (第 ${page.pageNumber} 頁)`,
                imageUrl: page.imageUrl,
                file: page.file,
                pageNumber: page.pageNumber,
              });
            });
          } else if (isImage(file)) {
            const url = URL.createObjectURL(file);
            uploadedFiles.push({
              id: `${file.name}-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
              fileName: file.name,
              imageUrl: url,
              file: file,
            });
          }
        }

        if (uploadedFiles.length > 0) {
          onFilesAdd(uploadedFiles);
        }
      } finally {
        setIsConverting(false);
      }
    },
    [onFilesAdd]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (!disabled && e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files);
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
        processFiles(e.target.files);
        e.target.value = '';
      }
    },
    [processFiles]
  );

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
        type="file"
        accept="image/*,.pdf,application/pdf"
        multiple
        onChange={handleInputChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        disabled={showLoading || disabled}
      />

      <div className="flex flex-col items-center gap-3">
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
