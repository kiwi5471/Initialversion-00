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
import { Check, Pencil, X, Save, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface RecognitionItemListProps {
  items: LineItem[];
  activeItemId: string | null;
  highlightedItemIds: string[];
  onItemClick: (item: LineItem) => void;
  onItemUpdate: (id: string, updates: Partial<LineItem>) => void;
  onItemDelete: (id: string) => void;
  onItemConfirm: (id: string) => void;
  onItemAdd: () => void;
  onEditingChange?: (isEditing: boolean) => void;
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
  onEditingChange,
}: RecognitionItemListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<LineItem>>({});
  const [deleteWarningItem, setDeleteWarningItem] = useState<LineItem | null>(null);

  const updateEditingId = (id: string | null) => {
    setEditingId(id);
    onEditingChange?.(id !== null);
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("zh-TW", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getCategoryShortLabel = (value: string) => {
    const cat = DOCUMENT_CATEGORIES.find(c => c.value === value);
    if (!cat) return value;
    const label = cat.label;
    const dotIndex = label.indexOf('.');
    return dotIndex >= 0 ? label.substring(dotIndex + 1) : label;
  };

  const startEditing = (item: LineItem) => {
    updateEditingId(item.id);
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
    updateEditingId(null);
    setEditForm({});
  };

  const cancelEdit = () => {
    updateEditingId(null);
    setEditForm({});
  };

  const handleDeleteClick = (item: LineItem) => {
    if (item.amount_with_tax !== 0 || item.input_tax !== 0) {
      setDeleteWarningItem(item);
    } else {
      onItemDelete(item.id);
    }
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
    <div className="flex flex-col h-[calc(100vh-320px)] min-h-[300px]">
      {/* Add New Button */}
      <Button
        variant="outline"
        className="w-full border-dashed mb-3 flex-shrink-0"
        onClick={onItemAdd}
      >
        <Plus className="h-4 w-4 mr-2" />
        新增明細
      </Button>

      <div className="flex-1 overflow-auto border rounded-md">
        <div className="min-w-[1200px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">類別</TableHead>
                <TableHead className="min-w-[200px]">廠商</TableHead>
                <TableHead className="w-[160px]">統編</TableHead>
                <TableHead className="w-[160px]">日期</TableHead>
                <TableHead className="w-[180px]">發票號碼</TableHead>
                <TableHead className="w-[140px] text-right">含稅金額</TableHead>
                <TableHead className="w-[120px] text-right">稅額</TableHead>
                <TableHead className="w-[120px] text-center">操作</TableHead>
              </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const isActive = activeItemId === item.id;
              const isHighlighted = highlightedItemIds.includes(item.id);
              const isEditing = editingId === item.id;

              if (isEditing) {
                return (
                  <TableRow key={item.id} className="bg-muted/50">
                    <TableCell>
                      <Select
                        value={editForm.category || "0"}
                        onValueChange={(value) => setEditForm(prev => ({ ...prev, category: value }))}
                      >
                        <SelectTrigger className="h-10 text-sm w-full">
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
                    </TableCell>
                    <TableCell>
                      <Input
                        value={editForm.vendor || ""}
                        onChange={(e) => setEditForm(prev => ({ ...prev, vendor: e.target.value }))}
                        placeholder="廠商"
                        className="h-10 text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={editForm.tax_id || ""}
                        onChange={(e) => setEditForm(prev => ({ ...prev, tax_id: e.target.value || null }))}
                        placeholder="統編"
                        maxLength={8}
                        className="h-10 text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="date"
                        value={editForm.date || ""}
                        onChange={(e) => setEditForm(prev => ({ ...prev, date: e.target.value || null }))}
                        className="h-10 text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={editForm.invoice_number || ""}
                        onChange={(e) => setEditForm(prev => ({ ...prev, invoice_number: e.target.value || null }))}
                        placeholder="發票號碼"
                        className="h-10 text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={editForm.amount_with_tax || 0}
                        onChange={(e) => setEditForm(prev => ({ ...prev, amount_with_tax: Number(e.target.value) }))}
                        className="h-10 text-sm text-right"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={editForm.input_tax || 0}
                        onChange={(e) => setEditForm(prev => ({ ...prev, input_tax: Number(e.target.value) }))}
                        className="h-10 text-sm text-right"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-primary hover:text-primary"
                          title="儲存"
                          onClick={() => saveEdit(item.id)}
                        >
                          <Save className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          title="取消"
                          onClick={cancelEdit}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              }

              return (
                <TableRow
                  key={item.id}
                  onClick={() => onItemClick(item)}
                  className={cn(
                    "cursor-pointer transition-colors",
                    item.confirmed && "bg-green-50 dark:bg-green-950/20",
                    isActive && !item.confirmed && "bg-primary/10",
                    isHighlighted && !isActive && "bg-blue-50 dark:bg-blue-950/20"
                  )}
                >
                  <TableCell className="text-xs py-2">
                    {getCategoryShortLabel(item.category)}
                  </TableCell>
                  <TableCell className="text-xs py-2 font-medium">
                    {item.vendor || "-"}
                  </TableCell>
                  <TableCell className="text-xs py-2 font-mono">
                    {item.tax_id || "-"}
                  </TableCell>
                  <TableCell className="text-xs py-2">
                    {item.date || "-"}
                  </TableCell>
                  <TableCell className="text-xs py-2 font-mono">
                    {item.invoice_number || "-"}
                  </TableCell>
                  <TableCell className="text-xs py-2 text-right font-semibold text-primary">
                    {formatAmount(item.amount_with_tax)}
                  </TableCell>
                  <TableCell className="text-xs py-2 text-right">
                    {formatAmount(item.input_tax)}
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex items-center justify-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-7 w-7",
                          item.confirmed 
                            ? "text-green-600 hover:text-muted-foreground" 
                            : "text-muted-foreground hover:text-green-600"
                        )}
                        title={item.confirmed ? "取消確認" : "確認"}
                        onClick={(e) => {
                          e.stopPropagation();
                          onItemConfirm(item.id);
                        }}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-primary"
                        title="編輯"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditing(item);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        title="刪除"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(item);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Delete Warning Dialog */}
      <AlertDialog open={!!deleteWarningItem} onOpenChange={(open) => !open && setDeleteWarningItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>無法刪除</AlertDialogTitle>
            <AlertDialogDescription>
              此明細的含稅金額或稅額欄位有值，請先清空這些欄位後再刪除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (deleteWarningItem) {
                startEditing(deleteWarningItem);
                setDeleteWarningItem(null);
              }
            }}>
              前往編輯
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
