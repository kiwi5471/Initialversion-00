import { useState, useCallback } from "react";
import { RecognitionItem, OCRBlock } from "@/types/recognition";
import { RecognitionItemList } from "@/components/RecognitionItemList";
import { ReceiptPreview } from "@/components/ReceiptPreview";
import { Card } from "@/components/ui/card";

// Mock receipt image - using a placeholder
const MOCK_RECEIPT_IMAGE = "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&h=600&fit=crop";

// Mock OCR blocks with relative positions
const MOCK_OCR_BLOCKS: OCRBlock[] = [
  { id: "b1", page: 1, text: "台灣高鐵股份有限公司", bbox: { x: 0.15, y: 0.08, w: 0.7, h: 0.05 } },
  { id: "b2", page: 1, text: "2024/01/15", bbox: { x: 0.3, y: 0.15, w: 0.4, h: 0.04 } },
  { id: "b3", page: 1, text: "車票金額 NT$1,440", bbox: { x: 0.2, y: 0.25, w: 0.6, h: 0.05 } },
  { id: "b4", page: 1, text: "計程車資 NT$350", bbox: { x: 0.2, y: 0.35, w: 0.6, h: 0.05 } },
  { id: "b5", page: 1, text: "統一編號 12345678", bbox: { x: 0.25, y: 0.45, w: 0.5, h: 0.04 } },
  { id: "b6", page: 1, text: "辦公用品 NT$952", bbox: { x: 0.2, y: 0.55, w: 0.6, h: 0.05 } },
  { id: "b7", page: 1, text: "商務餐敘 NT$680", bbox: { x: 0.2, y: 0.65, w: 0.6, h: 0.05 } },
  { id: "b8", page: 1, text: "合計 NT$3,422", bbox: { x: 0.25, y: 0.8, w: 0.5, h: 0.06 } },
];

// Mock recognition items
const INITIAL_ITEMS: RecognitionItem[] = [
  { id: "i1", name: "高鐵交通費", amount: 1440, category: "transportation", confirmed: false, sourceBlockIds: ["b1", "b3"] },
  { id: "i2", name: "計程車資", amount: 350, category: "transportation", confirmed: false, sourceBlockIds: ["b4"] },
  { id: "i3", name: "辦公用品", amount: 952, category: "equipment", confirmed: false, sourceBlockIds: ["b6"] },
  { id: "i4", name: "商務餐敘", amount: 680, category: "meals", confirmed: false, sourceBlockIds: ["b7"] },
];

export default function ReceiptRecognition() {
  const [items, setItems] = useState<RecognitionItem[]>(INITIAL_ITEMS);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [highlightedItemIds, setHighlightedItemIds] = useState<string[]>([]);
  const [activeBlockIds, setActiveBlockIds] = useState<string[]>([]);

  const handleItemClick = useCallback((item: RecognitionItem) => {
    setActiveItemId(item.id);
    setActiveBlockIds(item.sourceBlockIds);
    setHighlightedItemIds([]);
  }, []);

  const handleBlockClick = useCallback((blockId: string) => {
    // Find all items that reference this block
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
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">
            票據憑證辨識系統
          </h1>
          <p className="text-muted-foreground">
            上傳憑證，自動擷取會計資料，點擊項目可查看對應的 OCR 識別區域
          </p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Panel: Recognition Results */}
          <Card className="lg:col-span-7 p-6 shadow-lg">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-foreground">
                  辨識結果
                </h2>
                <span className="text-sm text-muted-foreground">
                  共 {items.length} 筆項目
                </span>
              </div>
              
              <RecognitionItemList
                items={items}
                activeItemId={activeItemId}
                highlightedItemIds={highlightedItemIds}
                onItemClick={handleItemClick}
                onItemUpdate={handleItemUpdate}
                onItemDelete={handleItemDelete}
                onItemConfirm={handleItemConfirm}
              />
            </div>
          </Card>

          {/* Right Panel: Receipt Preview */}
          <Card className="lg:col-span-5 p-6 shadow-lg">
            <ReceiptPreview
              imageUrl={MOCK_RECEIPT_IMAGE}
              ocrBlocks={MOCK_OCR_BLOCKS}
              activeBlockIds={activeBlockIds}
              onBlockClick={handleBlockClick}
              onEmptyClick={handleEmptyClick}
              totalAmount={totalAmount}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
