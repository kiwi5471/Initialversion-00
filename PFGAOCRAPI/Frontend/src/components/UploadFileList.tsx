import { UploadedFileItem } from "@/types/batch";
import { cn } from "@/lib/utils";
import { FileText, X, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface UploadFileListProps {
  files: UploadedFileItem[];
  onRemoveFile: (fileId: string) => void;
}

export function UploadFileList({ files, onRemoveFile }: UploadFileListProps) {
  if (files.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        尚未上傳任何檔案
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">已上傳檔案</h3>
        <span className="text-xs text-muted-foreground">
          共 {files.length} 個檔案
        </span>
      </div>
      
      <ScrollArea className="h-[300px] rounded-md border">
        <div className="p-2 space-y-1">
          {files.map((file) => (
            <div
              key={file.id}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/30",
                "hover:bg-muted/50 transition-colors"
              )}
            >
              <div className="w-10 h-10 rounded overflow-hidden bg-muted flex-shrink-0">
                <img
                  src={file.imageUrl}
                  alt={file.fileName}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.fileName}</p>
                {file.pageNumber && (
                  <p className="text-xs text-muted-foreground">
                    PDF 第 {file.pageNumber} 頁
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => onRemoveFile(file.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
