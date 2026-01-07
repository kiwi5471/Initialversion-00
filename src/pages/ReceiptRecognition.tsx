import { useState, useCallback, useMemo } from "react";
import { RecognitionItem, OCRBlock } from "@/types/recognition";
import { FileProcessingResult } from "@/types/batch";
import { UploadedFile, ReceiptUploader } from "@/components/ReceiptUploader";
import { RecognitionItemList } from "@/components/RecognitionItemList";
import { ReceiptPreview } from "@/components/ReceiptPreview";
import { BatchFileList } from "@/components/BatchFileList";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function ReceiptRecognition() {
  const { toast } = useToast();
  const [files, setFiles] = useState<FileProcessingResult[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [highlightedItemIds, setHighlightedItemIds] = useState<string[]>([]);
  const [activeBlockIds, setActiveBlockIds] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const activeFile = useMemo(
    () => files.find(f => f.id === activeFileId) || null,
    [files, activeFileId]
  );

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });
  };

  const processFile = async (fileResult: FileProcessingResult, file: File): Promise<FileProcessingResult> => {
    try {
      const imageData = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke('receipt-ocr', {
        body: { imageData, filename: fileResult.fileName }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || '辨識失敗');

      return {
        ...fileResult,
        status: 'success',
        items: data.data.items || [],
        ocrBlocks: data.data.ocrBlocks || [],
      };
    } catch (error) {
      console.error('OCR error:', error);
      return {
        ...fileResult,
        status: 'error',
        error: error instanceof Error ? error.message : '辨識失敗',
      };
    }
  };

  const handleFilesUpload = useCallback(async (uploadedFiles: UploadedFile[]) => {
    // Initialize file results
    const initialResults: FileProcessingResult[] = uploadedFiles.map(uf => ({
      id: uf.id,
      fileName: uf.fileName,
      imageUrl: uf.imageUrl,
      status: 'pending' as const,
      items: [],
      ocrBlocks: [],
    }));

    setFiles(initialResults);
    setActiveFileId(initialResults[0]?.id || null);
    setIsProcessing(true);

    // Process files one by one
    const processedResults = [...initialResults];
    
    for (let i = 0; i < uploadedFiles.length; i++) {
      // Update status to processing
      processedResults[i] = { ...processedResults[i], status: 'processing' };
      setFiles([...processedResults]);

      // Process the file
      const result = await processFile(processedResults[i], uploadedFiles[i].file);
      processedResults[i] = result;
      setFiles([...processedResults]);
    }

    setIsProcessing(false);

    const successCount = processedResults.filter(f => f.status === 'success').length;
    const totalItems = processedResults.reduce((sum, f) => sum + f.items.length, 0);

    toast({
      title: "批次辨識完成",
      description: `${successCount}/${processedResults.length} 個檔案成功，共識別 ${totalItems} 筆項目`,
    });
  }, [toast]);

  const handleReset = useCallback(() => {
    files.forEach(f => {
      if (f.imageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(f.imageUrl);
      }
    });
    setFiles([]);
    setActiveFileId(null);
    setActiveItemId(null);
    setActiveBlockIds([]);
    setHighlightedItemIds([]);
  }, [files]);

  const handleFileSelect = useCallback((fileId: string) => {
    setActiveFileId(fileId);
    setActiveItemId(null);
    setActiveBlockIds([]);
    setHighlightedItemIds([]);
  }, []);

  const handleItemClick = useCallback((item: RecognitionItem) => {
    setActiveItemId(item.id);
    setActiveBlockIds(item.sourceBlockIds);
    setHighlightedItemIds([]);
  }, []);

  const handleBlockClick = useCallback((blockId: string) => {
    if (!activeFile) return;
    const relatedItems = activeFile.items.filter((item) =>
      item.sourceBlockIds.includes(blockId)
    );
    const relatedItemIds = relatedItems.map((item) => item.id);
    
    setHighlightedItemIds(relatedItemIds);
    setActiveBlockIds([blockId]);
    setActiveItemId(null);
  }, [activeFile]);

  const handleEmptyClick = useCallback(() => {
    setActiveItemId(null);
    setActiveBlockIds([]);
    setHighlightedItemIds([]);
  }, []);

  const handleItemUpdate = useCallback(
    (id: string, updates: Partial<RecognitionItem>) => {
      setFiles((prev) =>
        prev.map((file) => ({
          ...file,
          items: file.items.map((item) =>
            item.id === id ? { ...item, ...updates } : item
          ),
        }))
      );
    },
    []
  );

  const handleItemDelete = useCallback((id: string) => {
    setFiles((prev) =>
      prev.map((file) => ({
        ...file,
        items: file.items.filter((item) => item.id !== id),
      }))
    );
    if (activeItemId === id) {
      setActiveItemId(null);
      setActiveBlockIds([]);
    }
  }, [activeItemId]);

  const handleItemConfirm = useCallback((id: string) => {
    setFiles((prev) =>
      prev.map((file) => ({
        ...file,
        items: file.items.map((item) =>
          item.id === id ? { ...item, confirmed: !item.confirmed } : item
        ),
      }))
    );
  }, []);

  const totalAmount = activeFile?.items.reduce((sum, item) => sum + item.amount, 0) || 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground">
              票據憑證辨識系統
            </h1>
            <p className="text-muted-foreground">
              上傳憑證圖片或 PDF，AI 自動批次擷取會計資料
            </p>
          </div>
          {files.length > 0 && (
            <Button variant="outline" onClick={handleReset} className="gap-2">
              <RotateCcw className="w-4 h-4" />
              重新上傳
            </Button>
          )}
        </div>

        {/* Upload Area - Show when no files */}
        {files.length === 0 && (
          <Card className="p-6 shadow-lg">
            <ReceiptUploader
              onFilesUpload={handleFilesUpload}
              isProcessing={isProcessing}
            />
          </Card>
        )}

        {/* Main Content - Show when files uploaded */}
        {files.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Panel: File List + Recognition Results */}
            <div className="lg:col-span-7 space-y-6">
              {/* Batch File List */}
              {files.length > 1 && (
                <Card className="p-4 shadow-lg">
                  <BatchFileList
                    files={files}
                    activeFileId={activeFileId}
                    onFileSelect={handleFileSelect}
                  />
                </Card>
              )}

              {/* Recognition Results */}
              <Card className="p-6 shadow-lg">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-foreground">
                      辨識結果
                    </h2>
                    <span className="text-sm text-muted-foreground">
                      {activeFile?.fileName} · 共 {activeFile?.items.length || 0} 筆項目
                    </span>
                  </div>

                  {activeFile?.status === 'processing' ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-center space-y-3">
                        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                        <p className="text-sm text-muted-foreground">AI 正在辨識中...</p>
                      </div>
                    </div>
                  ) : activeFile?.status === 'error' ? (
                    <div className="text-center py-12 text-destructive">
                      {activeFile.error || '辨識失敗'}
                    </div>
                  ) : activeFile && activeFile.items.length > 0 ? (
                    <RecognitionItemList
                      items={activeFile.items}
                      activeItemId={activeItemId}
                      highlightedItemIds={highlightedItemIds}
                      onItemClick={handleItemClick}
                      onItemUpdate={handleItemUpdate}
                      onItemDelete={handleItemDelete}
                      onItemConfirm={handleItemConfirm}
                    />
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      {activeFile ? '尚無辨識結果' : '請選擇檔案'}
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* Right Panel: Receipt Preview */}
            <Card className="lg:col-span-5 p-6 shadow-lg">
              {activeFile ? (
                <ReceiptPreview
                  imageUrl={activeFile.imageUrl}
                  ocrBlocks={activeFile.ocrBlocks}
                  activeBlockIds={activeBlockIds}
                  onBlockClick={handleBlockClick}
                  onEmptyClick={handleEmptyClick}
                  totalAmount={totalAmount}
                />
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  請選擇檔案查看預覽
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
