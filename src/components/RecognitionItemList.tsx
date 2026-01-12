import { useState } from "react";
import { LineItem, CURRENCIES } from "@/types/recognition";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Check, Pencil, X, Save, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
interface RecognitionItemListProps {
  items: LineItem[];
  activeItemId: string | null;
  highlightedItemIds: string[];
  onItemClick: (item: LineItem) => void;
  onItemUpdate: (id: string, updates: Partial<LineItem>) => void;
  onItemDelete: (id: string) => void;
  onItemConfirm: (id: string) => void;
  onItemAdd: () => void;
}

export function RecognitionItemList({
  items,
  activeItemId,
  highlightedItemIds,
  onItemClick,
  onItemUpdate,
  onItemDelete,
  onItemConfirm,
  onItemAdd,
}: RecognitionItemListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<LineItem>>({});

  const formatAmount = (amount: number, unit: string) => {
    const formatted = new Intl.NumberFormat("zh-TW", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
    return `${formatted} ${unit}`;
  };

  const startEditing = (item: LineItem) => {
    setEditingId(item.id);
    setEditForm({
      vendor: item.vendor,
      tax_id: item.tax_id,
      description: item.description,
      amount: item.amount,
      unit: item.unit,
    });
  };

  const saveEdit = (id: string) => {
    onItemUpdate(id, editForm);
    setEditingId(null);
    setEditForm({});
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground mb-4">尚無辨識結果</p>
        <Button variant="outline" size="sm" onClick={onItemAdd}>
          <Plus className="h-4 w-4 mr-1" />
          新增明細
        </Button>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[calc(100vh-480px)] min-h-[200px]">
      <div className="space-y-3 pr-4">
        {/* Add New Button */}
        <Button
          variant="outline"
          className="w-full border-dashed"
          onClick={onItemAdd}
        >
          <Plus className="h-4 w-4 mr-2" />
          新增明細
        </Button>

        {items.map((item) => {
          const isActive = activeItemId === item.id;
          const isHighlighted = highlightedItemIds.includes(item.id);
          const isEditing = editingId === item.id;

          return (
            <div
              key={item.id}
              onClick={() => !isEditing && onItemClick(item)}
              className={cn(
                "p-4 rounded-lg border transition-all",
                !isEditing && "cursor-pointer hover:shadow-md",
                item.confirmed && "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800",
                isActive && !item.confirmed && "ring-2 ring-primary border-primary",
                isHighlighted && !isActive && "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800",
                !isActive && !isHighlighted && !item.confirmed && "bg-card border-border"
              )}
            >
              {isEditing ? (
                // Edit Mode
                <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">廠商名稱</label>
                      <Input
                        value={editForm.vendor || ""}
                        onChange={(e) => setEditForm(prev => ({ ...prev, vendor: e.target.value }))}
                        placeholder="廠商名稱"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">統一編號</label>
                      <Input
                        value={editForm.tax_id || ""}
                        onChange={(e) => setEditForm(prev => ({ ...prev, tax_id: e.target.value || null }))}
                        placeholder="8碼數字"
                        maxLength={8}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">明細說明</label>
                    <Input
                      value={editForm.description || ""}
                      onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="品名或明細說明"
                      className="h-8 text-sm"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">金額</label>
                      <Input
                        type="number"
                        value={editForm.amount || 0}
                        onChange={(e) => setEditForm(prev => ({ ...prev, amount: Number(e.target.value) }))}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">幣值</label>
                      <Select
                        value={editForm.unit || "NT"}
                        onValueChange={(value) => setEditForm(prev => ({ ...prev, unit: value }))}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CURRENCIES.map((c) => (
                            <SelectItem key={c.value} value={c.value}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={cancelEdit}
                    >
                      <X className="h-4 w-4 mr-1" />
                      取消
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => saveEdit(item.id)}
                    >
                      <Save className="h-4 w-4 mr-1" />
                      儲存
                    </Button>
                  </div>
                </div>
              ) : (
                // Display Mode
                <div className="space-y-2">
                  {/* Header: Vendor + Tax ID */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.confirmed && (
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-green-500 text-white flex-shrink-0">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                    <span className="font-medium text-foreground">
                      {item.vendor || "未知廠商"}
                    </span>
                    {item.tax_id && (
                      <Badge variant="secondary" className="text-xs font-mono">
                        {item.tax_id}
                      </Badge>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {item.description || "無明細說明"}
                  </p>

                  {/* Amount + Actions Row */}
                  <div className="flex items-center justify-between gap-4 pt-1">
                    <span className="text-lg font-semibold text-primary">
                      {formatAmount(item.amount, item.unit)}
                    </span>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        title="編輯"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditing(item);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {!item.confirmed && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-green-600"
                          title="確認"
                          onClick={(e) => {
                            e.stopPropagation();
                            onItemConfirm(item.id);
                          }}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        title="刪除"
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
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
