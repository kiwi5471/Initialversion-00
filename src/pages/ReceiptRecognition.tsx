import { useState, useCallback } from "react";
import { RecognitionItem, OCRBlock } from "@/types/recognition";
import { RecognitionItemList } from "@/components/RecognitionItemList";
import { ReceiptPreview } from "@/components/ReceiptPreview";
import { ReceiptUploader } from "@/components/ReceiptUploader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

// Generate random mock data for uploaded images
const generateMockData = (fileName: string) => {
  const timestamp = Date.now();
  
  const ocrBlocks: OCRBlock[] = [
    { id: `b${timestamp}_1`, page: 1, text: "統一發票", bbox: { x: 0.25, y: 0.05, w: 0.5, h: 0.06 } },
    { id: `b${timestamp}_2`, page: 1, text: "2024/01/20", bbox: { x: 0.3, y: 0.14, w: 0.4, h: 0.04 } },
    { id: `b${timestamp}_3`, page: 1, text: "高鐵車票 NT$1,490", bbox: { x: 0.15, y: 0.24, w: 0.7, h: 0.05 } },
    { id: `b${timestamp}_4`, page: 1, text: "計程車 NT$285", bbox: { x: 0.15, y: 0.34, w: 0.7, h: 0.05 } },
    { id: `b${timestamp}_5`, page: 1, text: "統一編號 87654321", bbox: { x: 0.2, y: 0.44, w: 0.6, h: 0.04 } },
    { id: `b${timestamp}_6`, page: 1, text: "文具用品 NT$456", bbox: { x: 0.15, y: 0.54, w: 0.7, h: 0.05 } },
    { id: `b${timestamp}_7`, page: 1, text: "午餐便當 NT$120", bbox: { x: 0.15, y: 0.64, w: 0.7, h: 0.05 } },
    { id: `b${timestamp}_8`, page: 1, text: "總計 NT$2,351", bbox: { x: 0.25, y: 0.78, w: 0.5, h: 0.06 } },
  ];

  const items: RecognitionItem[] = [
    { id: `i${timestamp}_1`, name: "高鐵車票", amount: 1490, category: "transportation", confirmed: false, sourceBlockIds: [`b${timestamp}_1`, `b${timestamp}_3`] },
    { id: `i${timestamp}_2`, name: "計程車", amount: 285, category: "transportation", confirmed: false, sourceBlockIds: [`b${timestamp}_4`] },
    { id: `i${timestamp}_3`, name: "文具用品", amount: 456, category: "equipment", confirmed: false, sourceBlockIds: [`b${timestamp}_6`] },
    { id: `i${timestamp}_4`, name: "午餐便當", amount: 120, category: "meals", confirmed: false, sourceBlockIds: [`b${timestamp}_7`] },
  ];

  return { ocrBlocks, items };
};

export default function ReceiptRecognition() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [items, setItems] = useState<RecognitionItem[]>([]);
  const [ocrBlocks, setOcrBlocks] = useState<OCRBlock[]>([]);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [highlightedItemIds, setHighlightedItemIds] = useState<string[]>([]);
  const [activeBlockIds, setActiveBlockIds] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleImageUpload = useCallback((url: string, name: string) => {
    setIsProcessing(true);
    setImageUrl(url);
    setFileName(name);

    // Simulate processing delay
    setTimeout(() => {
      const mockData = generateMockData(name);
      setOcrBlocks(mockData.ocrBlocks);
      setItems(mockData.items);
      setActiveItemId(null);
      setActiveBlockIds([]);
      setHighlightedItemIds([]);
      setIsProcessing(false);
    }, 1500);
  }, []);

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
              上傳憑證，自動擷取會計資料，點擊項目可查看對應的 OCR 識別區域
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
                      <p className="text-sm text-muted-foreground">正在辨識中...</p>
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
