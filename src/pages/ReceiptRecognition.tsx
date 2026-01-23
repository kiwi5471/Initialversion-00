import { useState, useCallback, useMemo } from "react";
import { LineItem, OCRBlock } from "@/types/recognition";
import { FileProcessingResult, UploadedFileItem, ExportData } from "@/types/batch";
import { ReceiptUploader } from "@/components/ReceiptUploader";
import { UploadFileList } from "@/components/UploadFileList";
import { RecognitionItemList } from "@/components/RecognitionItemList";
import { ReceiptPreview } from "@/components/ReceiptPreview";
import { BatchFileList } from "@/components/BatchFileList";
import { ExportButtons } from "@/components/ExportButtons";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RotateCcw, Play, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Step = 'upload' | 'result';

export default function ReceiptRecognition() {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('upload');
  
  // Step 1 state
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileItem[]>([]);
  
  // Step 2 state
  const [processedFiles, setProcessedFiles] = useState<FileProcessingResult[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [highlightedItemIds, setHighlightedItemIds] = useState<string[]>([]);
  const [activeBlockIds, setActiveBlockIds] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const activeFile = useMemo(
    () => processedFiles.find(f => f.id === activeFileId) || null,
    [processedFiles, activeFileId]
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

      // Add confirmed: false to all lineItems
      const lineItems = (data.data.lineItems || []).map((item: any) => ({
        ...item,
        confirmed: false,
      }));

      return {
        ...fileResult,
        status: 'success',
        lineItems,
        ocrBlocks: data.data.ocrBlocks || [],
        metadata: data.data.metadata || {},
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

  // Step 1 handlers
  const handleFilesAdd = useCallback((files: UploadedFileItem[]) => {
    setUploadedFiles(prev => [...prev, ...files]);
  }, []);

  const handleRemoveFile = useCallback((fileId: string) => {
    setUploadedFiles(prev => {
      const file = prev.find(f => f.id === fileId);
      if (file?.imageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(file.imageUrl);
      }
      return prev.filter(f => f.id !== fileId);
    });
  }, []);

  const handleStartRecognition = useCallback(async () => {
    if (uploadedFiles.length === 0) return;

    // Initialize file results
    const initialResults: FileProcessingResult[] = uploadedFiles.map(uf => ({
      id: uf.id,
      fileName: uf.fileName,
      imageUrl: uf.imageUrl,
      status: 'pending' as const,
      lineItems: [],
      ocrBlocks: [],
    }));

    setProcessedFiles(initialResults);
    setActiveFileId(initialResults[0]?.id || null);
    setStep('result');
    setIsProcessing(true);

    // Process files one by one
    const results = [...initialResults];
    
    for (let i = 0; i < uploadedFiles.length; i++) {
      // Update status to processing
      results[i] = { ...results[i], status: 'processing' };
      setProcessedFiles([...results]);

      // Process the file
      const result = await processFile(results[i], uploadedFiles[i].file);
      results[i] = result;
      setProcessedFiles([...results]);
    }

    setIsProcessing(false);

    const successCount = results.filter(f => f.status === 'success').length;
    const totalItems = results.reduce((sum, f) => sum + f.lineItems.length, 0);

    toast({
      title: "批次辨識完成",
      description: `${successCount}/${results.length} 個檔案成功，共識別 ${totalItems} 筆項目`,
    });
  }, [uploadedFiles, toast]);

  // Step 2 handlers
  const handleReset = useCallback(() => {
    // Cleanup blob URLs
    uploadedFiles.forEach(f => {
      if (f.imageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(f.imageUrl);
      }
    });
    processedFiles.forEach(f => {
      if (f.imageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(f.imageUrl);
      }
    });

    setUploadedFiles([]);
    setProcessedFiles([]);
    setActiveFileId(null);
    setActiveItemId(null);
    setActiveBlockIds([]);
    setHighlightedItemIds([]);
    setStep('upload');
  }, [uploadedFiles, processedFiles]);

  const handleFileSelect = useCallback((fileId: string) => {
    // Reset editing state when switching files
    setIsEditing(false);
    setActiveFileId(fileId);
    setActiveItemId(null);
    setActiveBlockIds([]);
    setHighlightedItemIds([]);
  }, []);

  const handleItemClick = useCallback((item: LineItem) => {
    setActiveItemId(item.id);
    setActiveBlockIds(item.sourceBlockIds);
    setHighlightedItemIds([]);
  }, []);

  const handleItemAdd = useCallback(() => {
    if (!activeFileId) return;
    
    const newItem: LineItem = {
      id: `line_new_${Date.now()}`,
      category: "0",
      vendor: "",
      tax_id: null,
      date: null,
      invoice_number: null,
      amount_with_tax: 0,
      input_tax: 0,
      editable: true,
      confirmed: false,
      sourceBlockIds: [],
    };

    setProcessedFiles((prev) =>
      prev.map((file) =>
        file.id === activeFileId
          ? { ...file, lineItems: [newItem, ...file.lineItems] }
          : file
      )
    );
  }, [activeFileId]);

  const handleBlockClick = useCallback((blockId: string) => {
    if (!activeFile) return;
    const relatedItems = activeFile.lineItems.filter((item) =>
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
    (id: string, updates: Partial<LineItem>) => {
      if (!activeFileId) return;
      setProcessedFiles((prev) =>
        prev.map((file) => 
          file.id === activeFileId
            ? {
                ...file,
                lineItems: file.lineItems.map((item) =>
                  item.id === id ? { ...item, ...updates } : item
                ),
              }
            : file
        )
      );
    },
    [activeFileId]
  );

  const handleItemDelete = useCallback((id: string) => {
    if (!activeFileId) return;
    setProcessedFiles((prev) =>
      prev.map((file) =>
        file.id === activeFileId
          ? {
              ...file,
              lineItems: file.lineItems.filter((item) => item.id !== id),
            }
          : file
      )
    );
    if (activeItemId === id) {
      setActiveItemId(null);
      setActiveBlockIds([]);
    }
  }, [activeFileId, activeItemId]);

  const handleItemConfirm = useCallback((id: string) => {
    if (!activeFileId) return;
    setProcessedFiles((prev) =>
      prev.map((file) =>
        file.id === activeFileId
          ? {
              ...file,
              lineItems: file.lineItems.map((item) =>
                item.id === id ? { ...item, confirmed: !item.confirmed } : item
              ),
            }
          : file
      )
    );
  }, [activeFileId]);

  const totalAmount = activeFile?.lineItems.reduce((sum, item) => sum + item.amount_with_tax, 0) || 0;

  // Export data
  const exportData: ExportData = useMemo(() => ({
    exportedAt: new Date().toISOString(),
    files: processedFiles
      .filter(f => f.status === 'success')
      .map(f => ({
        fileName: f.fileName,
        imageUrl: f.imageUrl,
        lineItems: f.lineItems,
        ocrBlocks: f.ocrBlocks,
        metadata: f.metadata,
      })),
  }), [processedFiles]);

  // Step 1: Upload Page
  if (step === 'upload') {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8 space-y-6 max-w-2xl">
          <div className="space-y-2 text-center">
            <h1 className="text-3xl font-bold text-foreground">
              票據憑證辨識系統
            </h1>
            <p className="text-muted-foreground">
              上傳憑證圖片或 PDF，AI 自動批次擷取會計資料
            </p>
          </div>

          <Card className="p-6 shadow-lg">
            <ReceiptUploader onFilesAdd={handleFilesAdd} />
          </Card>

          <Card className="p-6 shadow-lg">
            <UploadFileList
              files={uploadedFiles}
              onRemoveFile={handleRemoveFile}
            />
          </Card>

          {uploadedFiles.length > 0 && (
            <div className="flex justify-center">
              <Button
                size="lg"
                onClick={handleStartRecognition}
                className="gap-2 px-8"
              >
                <Play className="w-5 h-5" />
                開始辨識 ({uploadedFiles.length} 個檔案)
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Step 2: Result Page
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-foreground">
              辨識結果
            </h1>
            <p className="text-sm text-muted-foreground">
              {processedFiles.filter(f => f.status === 'success').length}/{processedFiles.length} 個檔案已辨識
            </p>
          </div>
          <Button variant="outline" onClick={handleReset} className="gap-2">
            <RotateCcw className="w-4 h-4" />
            重新上傳
          </Button>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-160px)]">
          {/* Left Panel */}
          <div className="lg:col-span-5 flex flex-col gap-4 overflow-hidden">
            {/* Top: File List */}
            <Card className="p-4 shadow-lg flex-shrink-0">
              <BatchFileList
                files={processedFiles}
                activeFileId={activeFileId}
                onFileSelect={handleFileSelect}
                disabled={false}
              />
            </Card>

            {/* Bottom: Recognition Results */}
            <Card className="p-4 shadow-lg flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">
                  費用明細
                </h2>
                <span className="text-sm text-muted-foreground">
                  {activeFile?.lineItems.length || 0} 筆
                </span>
              </div>

              {activeFile?.status === 'processing' ? (
                <div className="flex items-center justify-center py-12 flex-1">
                  <div className="text-center space-y-3">
                    <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
                    <p className="text-sm text-muted-foreground">AI 正在辨識中...</p>
                  </div>
                </div>
              ) : activeFile?.status === 'error' ? (
                <div className="text-center py-12 text-destructive flex-1">
                  {activeFile.error || '辨識失敗'}
                </div>
              ) : activeFile ? (
              <RecognitionItemList
                  items={activeFile.lineItems}
                  activeItemId={activeItemId}
                  highlightedItemIds={highlightedItemIds}
                  onItemClick={handleItemClick}
                  onItemUpdate={handleItemUpdate}
                  onItemDelete={handleItemDelete}
                  onItemConfirm={handleItemConfirm}
                  onItemAdd={handleItemAdd}
                  onEditingChange={setIsEditing}
                />
              ) : (
                <div className="text-center py-12 text-muted-foreground flex-1">
                  請選擇檔案
                </div>
              )}
            </Card>
          </div>

          {/* Right Panel: Receipt Preview */}
          <Card className="lg:col-span-7 p-4 shadow-lg flex flex-col">
            {activeFile ? (
              <>
                <div className="flex-1 overflow-hidden">
                  <ReceiptPreview
                    imageUrl={activeFile.imageUrl}
                    ocrBlocks={activeFile.ocrBlocks}
                    activeBlockIds={activeBlockIds}
                    onBlockClick={handleBlockClick}
                    onEmptyClick={handleEmptyClick}
                    totalAmount={totalAmount}
                  />
                </div>
                
                {/* Export Buttons */}
                <div className="pt-4 border-t mt-4 flex justify-end">
                  <ExportButtons exportData={exportData} />
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                請選擇檔案查看預覽
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
