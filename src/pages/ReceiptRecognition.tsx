import { useState, useCallback } from "react";
import { RecognitionItem, OCRBlock } from "@/types/recognition";
import { RecognitionItemList } from "@/components/RecognitionItemList";
import { ReceiptPreview } from "@/components/ReceiptPreview";
import { ReceiptUploader } from "@/components/ReceiptUploader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function ReceiptRecognition() {
  const { toast } = useToast();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [items, setItems] = useState<RecognitionItem[]>([]);
  const [ocrBlocks, setOcrBlocks] = useState<OCRBlock[]>([]);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [highlightedItemIds, setHighlightedItemIds] = useState<string[]>([]);
  const [activeBlockIds, setActiveBlockIds] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });
  };

  const handleImageUpload = useCallback(async (url: string, name: string, file: File) => {
    setIsProcessing(true);
    setImageUrl(url);
    setFileName(name);
    setItems([]);
    setOcrBlocks([]);

    try {
      // Convert file to base64
      const imageData = await fileToBase64(file);

      // Call OCR edge function
      const { data, error } = await supabase.functions.invoke('receipt-ocr', {
        body: { imageData, filename: name }
      });

      if (error) {
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || '辨識失敗');
      }

      // Set the extracted data
      setItems(data.data.items || []);
      setOcrBlocks(data.data.ocrBlocks || []);

      toast({
        title: "辨識完成",
        description: `成功識別 ${data.data.items?.length || 0} 筆費用項目`,
      });

    } catch (error) {
      console.error('OCR error:', error);
      toast({
        title: "辨識失敗",
        description: error instanceof Error ? error.message : "無法處理圖片",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setActiveItemId(null);
      setActiveBlockIds([]);
      setHighlightedItemIds([]);
    }
  }, [toast]);

  const handleReset = useCallback(() => {
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }
    setImageUrl(null);
    setFileName("");
    setItems([]);
    setOcrBlocks([]);
    setActiveItemId(null);
    setActiveBlockIds([]);
    setHighlightedItemIds([]);
  }, [imageUrl]);

  const handleItemClick = useCallback((item: RecognitionItem) => {
    setActiveItemId(item.id);
    setActiveBlockIds(item.sourceBlockIds);
    setHighlightedItemIds([]);
  }, []);

  const handleBlockClick = useCallback((blockId: string) => {
    const relatedItems = items.filter((item) =>
      item.sourceBlockIds.includes(blockId)
    );
    const relatedItemIds = relatedItems.map((item) => item.id);
    
    setHighlightedItemIds(relatedItemIds);
    setActiveBlockIds([blockId]);
    setActiveItemId(null);
  }, [items]);

  const handleEmptyClick = useCallback(() => {
    setActiveItemId(null);
    setActiveBlockIds([]);
    setHighlightedItemIds([]);
  }, []);

  const handleItemUpdate = useCallback(
    (id: string, updates: Partial<RecognitionItem>) => {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
      );
    },
    []
  );

  const handleItemDelete = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    if (activeItemId === id) {
      setActiveItemId(null);
      setActiveBlockIds([]);
    }
  }, [activeItemId]);

  const handleItemConfirm = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, confirmed: !item.confirmed } : item
      )
    );
  }, []);

  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

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
              上傳憑證，AI 自動擷取會計資料，點擊項目可查看對應的 OCR 識別區域
            </p>
          </div>
          {imageUrl && (
            <Button variant="outline" onClick={handleReset} className="gap-2">
              <RotateCcw className="w-4 h-4" />
              重新上傳
            </Button>
          )}
        </div>

        {/* Upload Area - Show when no image */}
        {!imageUrl && (
          <Card className="p-6 shadow-lg">
            <ReceiptUploader
              onImageUpload={handleImageUpload}
              isProcessing={isProcessing}
            />
          </Card>
        )}

        {/* Main Content - Show when image uploaded */}
        {imageUrl && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Panel: Recognition Results */}
            <Card className="lg:col-span-7 p-6 shadow-lg">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-foreground">
                    辨識結果
                  </h2>
                  <span className="text-sm text-muted-foreground">
                    {fileName} · 共 {items.length} 筆項目
                  </span>
                </div>

                {isProcessing ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center space-y-3">
                      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                      <p className="text-sm text-muted-foreground">AI 正在辨識中...</p>
                    </div>
                  </div>
                ) : items.length > 0 ? (
                  <RecognitionItemList
                    items={items}
                    activeItemId={activeItemId}
                    highlightedItemIds={highlightedItemIds}
                    onItemClick={handleItemClick}
                    onItemUpdate={handleItemUpdate}
                    onItemDelete={handleItemDelete}
                    onItemConfirm={handleItemConfirm}
                  />
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    尚無辨識結果
                  </div>
                )}
              </div>
            </Card>

            {/* Right Panel: Receipt Preview */}
            <Card className="lg:col-span-5 p-6 shadow-lg">
              <ReceiptPreview
                imageUrl={imageUrl}
                ocrBlocks={ocrBlocks}
                activeBlockIds={activeBlockIds}
                onBlockClick={handleBlockClick}
                onEmptyClick={handleEmptyClick}
                totalAmount={totalAmount}
              />
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
