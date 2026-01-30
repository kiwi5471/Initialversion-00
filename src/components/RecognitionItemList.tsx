import { useState, useEffect } from "react";
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
  const [editAmountStrings, setEditAmountStrings] = useState({ amount_with_tax: "", input_tax: "" });
  const [deleteWarningItem, setDeleteWarningItem] = useState<LineItem | null>(null);
  const [deleteFormAmounts, setDeleteFormAmounts] = useState({ amount_with_tax: "", input_tax: "" });
  const [validationErrors, setValidationErrors] = useState<{ tax_id?: string; invoice_number?: string }>({});

  // Reset editing state when items change (e.g., switching files)
  useEffect(() => {
    setEditingId(null);
    setEditForm({});
    setValidationErrors({});
    onEditingChange?.(false);
  }, [items]);

  const updateEditingId = (id: string | null) => {
    setEditingId(id);
    onEditingChange?.(id !== null);
  };

  // Prevent keyboard events from bubbling up when editing inputs
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
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

  // Validation functions
  const validateTaxId = (value: string | null): string | undefined => {
    if (!value || value === "") return undefined; // Allow empty
    if (!/^\d{8}$/.test(value)) {
      return "統編必須為 8 位純數字";
    }
    return undefined;
  };

  const validateInvoiceNumber = (value: string | null): string | undefined => {
    if (!value || value === "") return undefined; // Allow empty
    if (!/^[A-Za-z]{2}\d{8}$/.test(value)) {
      return "發票號碼格式：2碼英文 + 8碼數字";
    }
    return undefined;
  };

  const handleTaxIdChange = (value: string) => {
    // Only allow digits, max 8 characters
    const cleanValue = value.replace(/\D/g, '').slice(0, 8);
    setEditForm(prev => ({ ...prev, tax_id: cleanValue || null }));
    setValidationErrors(prev => ({ ...prev, tax_id: validateTaxId(cleanValue) }));
  };

  const handleInvoiceNumberChange = (value: string) => {
    // Force format: first 2 chars must be letters, remaining 8 must be digits
    const upper = value.toUpperCase();
    let result = '';
    
    for (let i = 0; i < upper.length && result.length < 10; i++) {
      const char = upper[i];
      if (result.length < 2) {
        // First 2 positions: only allow A-Z
        if (/[A-Z]/.test(char)) {
          result += char;
        }
      } else {
        // Positions 3-10: only allow 0-9
        if (/\d/.test(char)) {
          result += char;
        }
      }
    }
    
    setEditForm(prev => ({ ...prev, invoice_number: result || null }));
    setValidationErrors(prev => ({ ...prev, invoice_number: validateInvoiceNumber(result) }));
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
    setEditAmountStrings({
      amount_with_tax: String(item.amount_with_tax),
      input_tax: String(item.input_tax),
    });
    setValidationErrors({
      tax_id: validateTaxId(item.tax_id),
      invoice_number: validateInvoiceNumber(item.invoice_number),
    });
  };

  const saveEdit = (id: string) => {
    // Validate before saving
    const taxIdError = validateTaxId(editForm.tax_id as string | null);
    const invoiceError = validateInvoiceNumber(editForm.invoice_number as string | null);
    
    if (taxIdError || invoiceError) {
      setValidationErrors({ tax_id: taxIdError, invoice_number: invoiceError });
      return;
    }
    
    // Convert string amounts to numbers when saving
    const updatedForm = {
      ...editForm,
      amount_with_tax: parseFloat(editAmountStrings.amount_with_tax) || 0,
      input_tax: parseFloat(editAmountStrings.input_tax) || 0,
    };
    
    onItemUpdate(id, updatedForm);
    updateEditingId(null);
    setEditForm({});
    setEditAmountStrings({ amount_with_tax: "", input_tax: "" });
    setValidationErrors({});
  };

  const cancelEdit = () => {
    updateEditingId(null);
    setEditForm({});
    setValidationErrors({});
  };

  const handleDeleteClick = (item: LineItem) => {
    if (item.amount_with_tax !== 0 || item.input_tax !== 0) {
      setDeleteWarningItem(item);
      setDeleteFormAmounts({
        amount_with_tax: String(item.amount_with_tax),
        input_tax: String(item.input_tax),
      });
    } else {
      onItemDelete(item.id);
    }
  };

  const handleDeleteFormChange = (field: 'amount_with_tax' | 'input_tax', value: string) => {
    // Only allow numeric input (including empty string)
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setDeleteFormAmounts(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleConfirmDelete = () => {
    if (deleteWarningItem) {
      const amountWithTax = parseFloat(deleteFormAmounts.amount_with_tax) || 0;
      const inputTax = parseFloat(deleteFormAmounts.input_tax) || 0;
      
      if (amountWithTax === 0 && inputTax === 0) {
        // Update the item with zero values first, then delete
        onItemUpdate(deleteWarningItem.id, { amount_with_tax: 0, input_tax: 0 });
        onItemDelete(deleteWarningItem.id);
        setDeleteWarningItem(null);
      }
    }
  };

  const canDeleteNow = () => {
    const amountWithTax = parseFloat(deleteFormAmounts.amount_with_tax) || 0;
    const inputTax = parseFloat(deleteFormAmounts.input_tax) || 0;
    return amountWithTax === 0 && inputTax === 0;
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
                        onKeyDown={handleInputKeyDown}
                        placeholder="廠商"
                        className="h-10 text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Input
                          value={editForm.tax_id || ""}
                          onChange={(e) => handleTaxIdChange(e.target.value)}
                          onKeyDown={handleInputKeyDown}
                          placeholder="8位數字"
                          maxLength={8}
                          inputMode="numeric"
                          className={cn("h-10 text-sm font-mono", validationErrors.tax_id && "border-destructive")}
                        />
                        {validationErrors.tax_id && (
                          <p className="text-[10px] text-destructive">{validationErrors.tax_id}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="date"
                        value={editForm.date || ""}
                        onChange={(e) => setEditForm(prev => ({ ...prev, date: e.target.value || null }))}
                        onKeyDown={handleInputKeyDown}
                        className="h-10 text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Input
                          value={editForm.invoice_number || ""}
                          onChange={(e) => handleInvoiceNumberChange(e.target.value)}
                          onKeyDown={handleInputKeyDown}
                          placeholder="AB12345678"
                          maxLength={10}
                          className={cn("h-10 text-sm font-mono uppercase", validationErrors.invoice_number && "border-destructive")}
                        />
                        {validationErrors.invoice_number && (
                          <p className="text-[10px] text-destructive">{validationErrors.invoice_number}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={editAmountStrings.amount_with_tax}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '' || /^\d*\.?\d*$/.test(val)) {
                            setEditAmountStrings(prev => ({ ...prev, amount_with_tax: val }));
                          }
                        }}
                        onKeyDown={handleInputKeyDown}
                        className="h-10 text-sm text-right font-mono"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={editAmountStrings.input_tax}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '' || /^\d*\.?\d*$/.test(val)) {
                            setEditAmountStrings(prev => ({ ...prev, input_tax: val }));
                          }
                        }}
                        onKeyDown={handleInputKeyDown}
                        className="h-10 text-sm text-right font-mono"
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
            <AlertDialogTitle>刪除明細</AlertDialogTitle>
            <AlertDialogDescription>
              請將含稅金額及稅額調整為 0 後才能刪除此明細。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">含稅金額</label>
              <Input
                type="text"
                inputMode="decimal"
                value={deleteFormAmounts.amount_with_tax}
                onChange={(e) => handleDeleteFormChange('amount_with_tax', e.target.value)}
                placeholder="0"
                className="text-right"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">稅額</label>
              <Input
                type="text"
                inputMode="decimal"
                value={deleteFormAmounts.input_tax}
                onChange={(e) => handleDeleteFormChange('input_tax', e.target.value)}
                placeholder="0"
                className="text-right"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              disabled={!canDeleteNow()}
              className={!canDeleteNow() ? "opacity-50 cursor-not-allowed" : ""}
            >
              確認刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
