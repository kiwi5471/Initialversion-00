import { useCallback, useState } from "react";
import { Upload, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface FileUploaderProps {
  onFilesSelected: (files: File[]) => void;
  isProcessing: boolean;
}

export const FileUploader = ({ onFilesSelected, isProcessing }: FileUploaderProps) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const { toast } = useToast();

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const validateFiles = (files: FileList | File[]) => {
    const validFiles: File[] = [];
    const fileArray = Array.from(files);

    for (const file of fileArray) {
      if (!file.type.match(/^image\/(png|jpg|jpeg|gif|webp)|application\/pdf$/)) {
        toast({
          title: "不支援的檔案格式",
          description: `檔案 ${file.name} 格式不支援。請上傳 PDF、JPG、PNG 或其他圖片格式。`,
          variant: "destructive",
        });
        continue;
      }

      if (file.size > 20 * 1024 * 1024) {
        toast({
          title: "檔案過大",
          description: `檔案 ${file.name} 超過 20MB 限制。`,
          variant: "destructive",
        });
        continue;
      }

      validFiles.push(file);
    }

    return validFiles;
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = validateFiles(e.dataTransfer.files);
    if (files.length > 0) {
      setSelectedFiles((prev) => [...prev, ...files]);
    }
  }, [toast]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files) {
      const files = validateFiles(e.target.files);
      if (files.length > 0) {
        setSelectedFiles((prev) => [...prev, ...files]);
      }
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = () => {
    if (selectedFiles.length === 0) {
      toast({
        title: "請選擇檔案",
        description: "請先選擇要上傳的票據檔案",
        variant: "destructive",
      });
      return;
    }
    onFilesSelected(selectedFiles);
    setSelectedFiles([]);
  };

  return (
    <div className="space-y-4">
      <Card
        className={cn(
          "border-2 border-dashed transition-all duration-200",
          dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
          "p-8"
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          <div className="rounded-full bg-primary/10 p-4">
            <Upload className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">上傳票據憑證</h3>
            <p className="text-sm text-muted-foreground">
              拖曳檔案至此處，或點擊下方按鈕選擇檔案
            </p>
            <p className="text-xs text-muted-foreground">
              支援格式：PDF、JPG、PNG（單檔最大 20MB）
            </p>
          </div>
          <label htmlFor="file-upload">
            <Button type="button" variant="outline" className="cursor-pointer" asChild>
              <span>選擇檔案</span>
            </Button>
            <input
              id="file-upload"
              type="file"
              className="hidden"
              multiple
              accept="image/*,application/pdf"
              onChange={handleChange}
            />
          </label>
        </div>
      </Card>

      {selectedFiles.length > 0 && (
        <Card className="p-4">
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">已選擇的檔案 ({selectedFiles.length})</h4>
            <div className="space-y-2">
              {selectedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-md border bg-muted/50 p-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate max-w-[300px]">{file.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(index)}
                    className="h-6 w-6 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              onClick={handleUpload}
              disabled={isProcessing}
              className="w-full"
            >
              {isProcessing ? "處理中..." : `開始辨識 (${selectedFiles.length} 個檔案)`}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};
