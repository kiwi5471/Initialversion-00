import { useState } from "react";
import { RecognitionItem, CATEGORIES } from "@/types/recognition";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Check, Pencil, X, Crosshair } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface RecognitionItemListProps {
  items: RecognitionItem[];
  activeItemId: string | null;
  highlightedItemIds: string[];
  onItemClick: (item: RecognitionItem) => void;
  onItemUpdate: (id: string, updates: Partial<RecognitionItem>) => void;
  onItemDelete: (id: string) => void;
  onItemConfirm: (id: string) => void;
  onLocateItem: (item: RecognitionItem) => void;
}

export function RecognitionItemList({
  items,
  activeItemId,
  highlightedItemIds,
  onItemClick,
  onItemUpdate,
  onItemDelete,
  onItemConfirm,
  onLocateItem,
}: RecognitionItemListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("zh-TW", {
      style: "currency",
      currency: "TWD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        尚無辨識結果
      </div>
    );
  }

  return (
    <ScrollArea className="h-[calc(100vh-480px)] min-h-[200px]">
      <div className="space-y-3 pr-4">
        {items.map((item) => {
          const isActive = activeItemId === item.id;
          const isHighlighted = highlightedItemIds.includes(item.id);
          const isEditing = editingId === item.id;

          return (
            <div
              key={item.id}
              onClick={() => onItemClick(item)}
              className={cn(
                "p-4 rounded-lg border transition-all cursor-pointer",
                "hover:shadow-md",
                item.confirmed && "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800",
                isActive && !item.confirmed && "ring-2 ring-primary border-primary",
                isHighlighted && !isActive && "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800",
                !isActive && !isHighlighted && !item.confirmed && "bg-card border-border"
              )}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    {item.confirmed && (
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-green-500 text-white">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                    <span className="font-medium text-foreground truncate">
                      {item.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {isEditing ? (
                      <Input
                        type="number"
                        value={item.amount}
                        onChange={(e) =>
                          onItemUpdate(item.id, { amount: Number(e.target.value) })
                        }
                        onClick={(e) => e.stopPropagation()}
                        className="w-32 h-8 text-sm"
                      />
                    ) : (
                      <span className="text-lg font-semibold text-primary">
                        {formatAmount(item.amount)}
                      </span>
                    )}

                    <Select
                      value={item.category}
                      onValueChange={(value) =>
                        onItemUpdate(item.id, { category: value })
                      }
                    >
                      <SelectTrigger
                        className="w-28 h-8 text-sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                    title="定位來源"
                    onClick={(e) => {
                      e.stopPropagation();
                      onLocateItem(item);
                    }}
                  >
                    <Crosshair className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingId(isEditing ? null : item.id);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-green-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      onItemConfirm(item.id);
                    }}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onItemDelete(item.id);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
