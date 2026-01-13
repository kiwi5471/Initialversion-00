import { useState } from "react";
import { LineItem, DOCUMENT_CATEGORIES } from "@/types/recognition";
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

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("zh-TW", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getCategoryLabel = (value: string) => {
    const cat = DOCUMENT_CATEGORIES.find(c => c.value === value);
    return cat ? cat.label : value;
  };

  const getCategoryShortLabel = (value: string) => {
    const cat = DOCUMENT_CATEGORIES.find(c => c.value === value);
    if (!cat) return value;
    // Get short version (e.g., "0.電子發票" -> "電子發票")
    const label = cat.label;
    const dotIndex = label.indexOf('.');
    return dotIndex >= 0 ? label.substring(dotIndex + 1) : label;
  };

  const startEditing = (item: LineItem) => {
    setEditingId(item.id);
    setEditForm({
      category: item.category,
      vendor: item.vendor,
      tax_id: item.tax_id,
      date: item.date,
      invoice_number: item.invoice_number,
      amount_with_tax: item.amount_with_tax,
      input_tax: item.input_tax,
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
                  {/* Row 1: Category */}
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">類別</label>
                    <Select
                      value={editForm.category || "0"}
                      onValueChange={(value) => setEditForm(prev => ({ ...prev, category: value }))}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DOCUMENT_CATEGORIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Row 2: Vendor + Tax ID */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">廠商</label>
                      <Input
                        value={editForm.vendor || ""}
                        onChange={(e) => setEditForm(prev => ({ ...prev, vendor: e.target.value }))}
                        placeholder="廠商名稱"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">統編</label>
                      <Input
                        value={editForm.tax_id || ""}
                        onChange={(e) => setEditForm(prev => ({ ...prev, tax_id: e.target.value || null }))}
                        placeholder="8碼數字"
                        maxLength={8}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  
                  {/* Row 3: Date + Invoice Number */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">年月日</label>
                      <Input
                        type="date"
                        value={editForm.date || ""}
                        onChange={(e) => setEditForm(prev => ({ ...prev, date: e.target.value || null }))}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">發票號碼</label>
                      <Input
                        value={editForm.invoice_number || ""}
                        onChange={(e) => setEditForm(prev => ({ ...prev, invoice_number: e.target.value || null }))}
                        placeholder="發票號碼"
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  
                  {/* Row 4: Amounts */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">含稅金額</label>
                      <Input
                        type="number"
                        value={editForm.amount_with_tax || 0}
                        onChange={(e) => setEditForm(prev => ({ ...prev, amount_with_tax: Number(e.target.value) }))}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">進項稅額</label>
                      <Input
                        type="number"
                        value={editForm.input_tax || 0}
                        onChange={(e) => setEditForm(prev => ({ ...prev, input_tax: Number(e.target.value) }))}
                        className="h-8 text-sm"
                      />
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
                  {/* Header: Confirmed + Category */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.confirmed && (
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-green-500 text-white flex-shrink-0">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {getCategoryShortLabel(item.category)}
                    </Badge>
                  </div>

                  {/* Vendor + Tax ID */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground">
                      {item.vendor || "未知廠商"}
                    </span>
                    {item.tax_id && (
                      <Badge variant="secondary" className="text-xs font-mono">
                        {item.tax_id}
                      </Badge>
                    )}
                  </div>

                  {/* Date + Invoice Number */}
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    {item.date && <span>{item.date}</span>}
                    {item.invoice_number && <span className="font-mono">{item.invoice_number}</span>}
                  </div>

                  {/* Amounts + Actions Row */}
                  <div className="flex items-center justify-between gap-4 pt-1">
                    <div className="flex items-center gap-4">
                      <div className="text-sm">
                        <span className="text-muted-foreground">含稅:</span>
                        <span className="ml-1 font-semibold text-primary">{formatAmount(item.amount_with_tax)}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">稅額:</span>
                        <span className="ml-1 font-medium">{formatAmount(item.input_tax)}</span>
                      </div>
                    </div>

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
