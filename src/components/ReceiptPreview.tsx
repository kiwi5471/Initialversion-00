import { useRef, useState, useEffect } from "react";
import { OCRBlock } from "@/types/recognition";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ReceiptPreviewProps {
  imageUrl: string;
  ocrBlocks: OCRBlock[];
  activeBlockIds: string[];
  onBlockClick: (blockId: string) => void;
  onEmptyClick: () => void;
  totalAmount: number;
}

export function ReceiptPreview({
  imageUrl,
  ocrBlocks,
  activeBlockIds,
  onBlockClick,
  onEmptyClick,
  totalAmount,
}: ReceiptPreviewProps) {
  const [showOCRBoxes, setShowOCRBoxes] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("zh-TW", {
      style: "currency",
      currency: "TWD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget || e.target === containerRef.current?.querySelector("img")) {
      onEmptyClick();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">收據預覽</h3>
        <div className="flex items-center gap-2">
          <Switch
            id="show-ocr"
            checked={showOCRBoxes}
            onCheckedChange={setShowOCRBoxes}
          />
          <Label htmlFor="show-ocr" className="text-sm text-muted-foreground">
            顯示 OCR 文字框
          </Label>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative w-full aspect-[3/4] bg-muted rounded-lg overflow-hidden cursor-pointer"
        onClick={handleContainerClick}
      >
        <img
          src={imageUrl}
          alt="Receipt"
          className="w-full h-full object-contain"
        />

        {showOCRBoxes && (
          <div className="absolute inset-0 pointer-events-none">
            {ocrBlocks.map((block) => {
              const isActive = activeBlockIds.includes(block.id);
              const left = block.bbox.x * dimensions.width;
              const top = block.bbox.y * dimensions.height;
              const width = block.bbox.w * dimensions.width;
              const height = block.bbox.h * dimensions.height;

              return (
                <Tooltip key={block.id}>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "absolute pointer-events-auto cursor-pointer transition-all",
                        "border rounded",
                        isActive
                          ? "border-primary border-2 bg-primary/20"
                          : "border-muted-foreground/30 bg-muted-foreground/5 hover:border-muted-foreground/50"
                      )}
                      style={{
                        left: `${left}px`,
                        top: `${top}px`,
                        width: `${width}px`,
                        height: `${height}px`,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onBlockClick(block.id);
                      }}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p className="text-sm">{block.text}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        )}
      </div>

      <div className="p-4 bg-primary/10 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">
            辨識總金額
          </span>
          <span className="text-xl font-bold text-primary">
            {formatAmount(totalAmount)}
          </span>
        </div>
      </div>
    </div>
  );
}
