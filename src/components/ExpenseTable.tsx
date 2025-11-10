import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, ChevronUp, ChevronDown, Download } from "lucide-react";
import { ExpenseEntry } from "@/types/invoice";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ExpenseTableProps {
  entries: ExpenseEntry[];
  onEntriesChange: (entries: ExpenseEntry[]) => void;
}

const CURRENCIES = ["TWD", "USD", "JPY", "EUR", "CNY"];
const DEBIT_ACCOUNTS = ["旅費", "交通費", "住宿費", "餐飲費", "雜費"];
const CREDIT_ACCOUNTS = ["應付帳款", "現金", "銀行存款"];

export const ExpenseTable = ({ entries, onEntriesChange }: ExpenseTableProps) => {
  const { toast } = useToast();

  const addEntry = () => {
    const newEntry: ExpenseEntry = {
      id: crypto.randomUUID(),
      filename: "",
      supplier_tax_id: "",
      supplier_name: "",
      invoice_date: new Date().toISOString().split('T')[0],
      item_description: "",
      amount_exclusive_tax: 0,
      tax_amount: 0,
      amount_inclusive_tax: 0,
      page_number: 1,
      output_type: "員工",
      payment_method: "電匯",
      expense_date: new Date().toISOString().split('T')[0],
      content: "",
      quantity: 1,
      unit_price: 0,
      currency: "TWD",
      amount: 0,
      notes: "",
      debit_account: "旅費",
      debit_item: "",
      debit_summary: "",
      credit_account: "應付帳款",
      credit_item: "",
      credit_summary: "",
    };
    onEntriesChange([...entries, newEntry]);
  };

  const removeEntry = (id: string) => {
    onEntriesChange(entries.filter((entry) => entry.id !== id));
  };

  const moveEntry = (id: string, direction: "up" | "down") => {
    const index = entries.findIndex((entry) => entry.id === id);
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === entries.length - 1)
    ) {
      return;
    }

    const newEntries = [...entries];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    [newEntries[index], newEntries[targetIndex]] = [
      newEntries[targetIndex],
      newEntries[index],
    ];
    onEntriesChange(newEntries);
  };

  const updateEntry = (id: string, field: keyof ExpenseEntry, value: any) => {
    onEntriesChange(
      entries.map((entry) => {
        if (entry.id !== id) return entry;
        
        const updated = { ...entry, [field]: value };
        
        // Auto-calculate amount if quantity or unit_price changes
        if (field === "quantity" || field === "unit_price") {
          updated.amount = updated.quantity * updated.unit_price;
        }
        
        // Reset payment_method if output_type changes
        if (field === "output_type") {
          updated.payment_method = value === "員工" ? "電匯" : "外幣";
        }
        
        return updated;
      })
    );
  };

  const exportToCSV = () => {
    const headers = [
      "編號",
      "檔案名稱",
      "供應商統一編號",
      "供應商名稱",
      "憑證日期",
      "輸出",
      "付款方式",
      "日期",
      "內容",
      "數量",
      "單價",
      "幣別",
      "金額",
      "備註",
      "借方科目",
      "借方項目",
      "借方摘要",
      "貸方科目",
      "貸方項目",
      "貸方摘要",
    ];

    const rows = entries.map((entry, index) => [
      index + 1,
      entry.filename,
      entry.supplier_tax_id,
      entry.supplier_name,
      entry.invoice_date,
      entry.output_type,
      entry.payment_method,
      entry.expense_date,
      entry.content,
      entry.quantity,
      entry.unit_price,
      entry.currency,
      entry.amount,
      entry.notes,
      entry.debit_account,
      entry.debit_item,
      entry.debit_summary,
      entry.credit_account,
      entry.credit_item,
      entry.credit_summary,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `expense_report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    toast({
      title: "匯出成功",
      description: "出差精算表已匯出為 CSV 檔案",
    });
  };

  const exportToJSON = () => {
    const jsonContent = JSON.stringify(entries, null, 2);
    const blob = new Blob([jsonContent], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `expense_report_${new Date().toISOString().split('T')[0]}.json`;
    link.click();

    toast({
      title: "匯出成功",
      description: "出差精算表已匯出為 JSON 檔案",
    });
  };

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground mb-4">尚無資料，請先上傳票據進行辨識</p>
        <Button onClick={addEntry} variant="outline">
          <Plus className="mr-2 h-4 w-4" />
          手動新增
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">出差精算表 ({entries.length} 筆)</h3>
        <div className="flex gap-2">
          <Button onClick={addEntry} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            新增
          </Button>
          <Button onClick={exportToCSV} variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            匯出 CSV
          </Button>
          <Button onClick={exportToJSON} variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            匯出 JSON
          </Button>
        </div>
      </div>

      <ScrollArea className="w-full rounded-md border">
        <div className="min-w-[1800px]">
          <table className="w-full">
            <thead className="bg-table-header text-table-header-foreground sticky top-0 z-10">
              <tr>
                <th className="p-2 text-left text-xs font-medium">編號</th>
                <th className="p-2 text-left text-xs font-medium">檔案名稱</th>
                <th className="p-2 text-left text-xs font-medium">統一編號</th>
                <th className="p-2 text-left text-xs font-medium">廠商名稱</th>
                <th className="p-2 text-left text-xs font-medium">憑證日期</th>
                <th className="p-2 text-left text-xs font-medium">輸出</th>
                <th className="p-2 text-left text-xs font-medium">付款方式</th>
                <th className="p-2 text-left text-xs font-medium">日期</th>
                <th className="p-2 text-left text-xs font-medium">內容</th>
                <th className="p-2 text-left text-xs font-medium">數量</th>
                <th className="p-2 text-left text-xs font-medium">單價</th>
                <th className="p-2 text-left text-xs font-medium">幣別</th>
                <th className="p-2 text-left text-xs font-medium">金額</th>
                <th className="p-2 text-left text-xs font-medium">備註</th>
                <th className="p-2 text-left text-xs font-medium">借方科目</th>
                <th className="p-2 text-left text-xs font-medium">借方項目</th>
                <th className="p-2 text-left text-xs font-medium">借方摘要</th>
                <th className="p-2 text-left text-xs font-medium">貸方科目</th>
                <th className="p-2 text-left text-xs font-medium">貸方項目</th>
                <th className="p-2 text-left text-xs font-medium">貸方摘要</th>
                <th className="p-2 text-left text-xs font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => (
                <tr key={entry.id} className="border-b hover:bg-muted/50">
                  <td className="p-2 text-sm">{index + 1}</td>
                  <td className="p-2">
                    <Input
                      value={entry.filename}
                      onChange={(e) => updateEntry(entry.id, "filename", e.target.value)}
                      className="h-8 text-xs"
                      readOnly
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      value={entry.supplier_tax_id}
                      onChange={(e) => updateEntry(entry.id, "supplier_tax_id", e.target.value)}
                      className="h-8 text-xs"
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      value={entry.supplier_name}
                      onChange={(e) => updateEntry(entry.id, "supplier_name", e.target.value)}
                      className="h-8 text-xs"
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      type="date"
                      value={entry.invoice_date}
                      onChange={(e) => updateEntry(entry.id, "invoice_date", e.target.value)}
                      className="h-8 text-xs"
                    />
                  </td>
                  <td className="p-2">
                    <Select
                      value={entry.output_type}
                      onValueChange={(value) => updateEntry(entry.id, "output_type", value)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="員工">員工</SelectItem>
                        <SelectItem value="廠商">廠商</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-2">
                    <Select
                      value={entry.payment_method}
                      onValueChange={(value) => updateEntry(entry.id, "payment_method", value)}
                      disabled={entry.output_type === "員工"}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="電匯">電匯</SelectItem>
                        {entry.output_type === "廠商" && (
                          <>
                            <SelectItem value="外幣">外幣</SelectItem>
                            <SelectItem value="票據">票據</SelectItem>
                            <SelectItem value="業者">業者</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-2">
                    <Input
                      type="date"
                      value={entry.expense_date}
                      onChange={(e) => updateEntry(entry.id, "expense_date", e.target.value)}
                      className="h-8 text-xs"
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      value={entry.content}
                      onChange={(e) => updateEntry(entry.id, "content", e.target.value)}
                      className="h-8 text-xs"
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      type="number"
                      value={entry.quantity}
                      onChange={(e) => updateEntry(entry.id, "quantity", parseFloat(e.target.value) || 0)}
                      className="h-8 text-xs w-20"
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      type="number"
                      value={entry.unit_price}
                      onChange={(e) => updateEntry(entry.id, "unit_price", parseFloat(e.target.value) || 0)}
                      className="h-8 text-xs w-24"
                    />
                  </td>
                  <td className="p-2">
                    <Select
                      value={entry.currency}
                      onValueChange={(value) => updateEntry(entry.id, "currency", value)}
                    >
                      <SelectTrigger className="h-8 text-xs w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((currency) => (
                          <SelectItem key={currency} value={currency}>
                            {currency}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-2">
                    <Input
                      type="number"
                      value={entry.amount}
                      onChange={(e) => updateEntry(entry.id, "amount", parseFloat(e.target.value) || 0)}
                      className="h-8 text-xs w-24"
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      value={entry.notes}
                      onChange={(e) => updateEntry(entry.id, "notes", e.target.value)}
                      className="h-8 text-xs"
                    />
                  </td>
                  <td className="p-2">
                    <Select
                      value={entry.debit_account}
                      onValueChange={(value) => updateEntry(entry.id, "debit_account", value)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DEBIT_ACCOUNTS.map((account) => (
                          <SelectItem key={account} value={account}>
                            {account}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-2">
                    <Input
                      value={entry.debit_item}
                      onChange={(e) => updateEntry(entry.id, "debit_item", e.target.value)}
                      className="h-8 text-xs"
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      value={entry.debit_summary}
                      onChange={(e) => updateEntry(entry.id, "debit_summary", e.target.value)}
                      className="h-8 text-xs"
                    />
                  </td>
                  <td className="p-2">
                    <Select
                      value={entry.credit_account}
                      onValueChange={(value) => updateEntry(entry.id, "credit_account", value)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CREDIT_ACCOUNTS.map((account) => (
                          <SelectItem key={account} value={account}>
                            {account}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-2">
                    <Input
                      value={entry.credit_item}
                      onChange={(e) => updateEntry(entry.id, "credit_item", e.target.value)}
                      className="h-8 text-xs"
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      value={entry.credit_summary}
                      onChange={(e) => updateEntry(entry.id, "credit_summary", e.target.value)}
                      className="h-8 text-xs"
                    />
                  </td>
                  <td className="p-2">
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveEntry(entry.id, "up")}
                        disabled={index === 0}
                        className="h-7 w-7 p-0"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveEntry(entry.id, "down")}
                        disabled={index === entries.length - 1}
                        className="h-7 w-7 p-0"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeEntry(entry.id)}
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ScrollArea>
    </div>
  );
};
