import { FileProcessingResult } from "@/types/batch";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, Loader2, FileText, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface BatchFileListProps {
  files: FileProcessingResult[];
  activeFileId: string | null;
  onFileSelect: (fileId: string) => void;
  disabled?: boolean;
}

export function BatchFileList({ files, activeFileId, onFileSelect, disabled = false }: BatchFileListProps) {
  const getStatusIcon = (status: FileProcessingResult['status']) => {
    switch (status) {
      case 'pending':
        return <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/50" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-destructive" />;
    }
  };

  const completedCount = files.filter(f => f.status === 'success').length;
  const totalItems = files.reduce((sum, f) => sum + (f.lineItems?.length || 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">檔案列表</h3>
        <span className="text-xs text-muted-foreground">
          已完成 {completedCount}/{files.length} · 共 {totalItems} 筆項目
        </span>
      </div>
      
      <ScrollArea className="h-[200px] rounded-md border">
        <div className="p-2 space-y-1">
          {files.map((file) => (
            <button
              key={file.id}
              onClick={() => !disabled && onFileSelect(file.id)}
              disabled={disabled}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors",
                disabled && "opacity-50 cursor-not-allowed",
                activeFileId === file.id
                  ? "bg-primary/10 border border-primary/30"
                  : !disabled && "hover:bg-muted/50"
              )}
            >
              {getStatusIcon(file.status)}
              <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.fileName}</p>
                {file.status === 'success' && (
                  <p className="text-xs text-muted-foreground">
                    {file.lineItems.length} 筆項目
                  </p>
                )}
                {file.status === 'error' && (
                  <p className="text-xs text-destructive truncate">
                    {file.error || '辨識失敗'}
                  </p>
                )}
              </div>
              {file.status === 'success' && (
                <Eye className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
