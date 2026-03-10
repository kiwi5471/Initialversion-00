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
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

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
        
        if (field === "quantity" || field === "unit_price") {
          updated.amount = updated.quantity * updated.unit_price;
        }
        
        if (field === "output_type") {
          updated.payment_method = value === "員工" ? "電匯" : "外幣";
        }
        
        return updated;
      })
    );
  };

  const exportToCSV = () => {
    const headers = [
      "編號", "檔案名稱", "供應商統一編號", "供應商名稱", "憑證日期",
      "輸出", "付款方式", "日期", "內容", "數量", "單價", "幣別", "金額", "備註",
      "借方科目", "借方項目", "借方摘要", "貸方科目", "貸方項目", "貸方摘要",
    ];

    const rows = entries.map((entry, index) => [
      index + 1, entry.filename, entry.supplier_tax_id, entry.supplier_name, entry.invoice_date,
      entry.output_type, entry.payment_method, entry.expense_date, entry.content,
      entry.quantity, entry.unit_price, entry.currency, entry.amount, entry.notes,
      entry.debit_account, entry.debit_item, entry.debit_summary,
      entry.credit_account, entry.credit_item, entry.credit_summary,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `expense_report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    toast({ title: "匯出成功", description: "出差精算表已匯出為 CSV 檔案" });
  };

  const exportToJSON = () => {
    const jsonContent = JSON.stringify(entries, null, 2);
    const blob = new Blob([jsonContent], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `expense_report_${new Date().toISOString().split('T')[0]}.json`;
    link.click();

    toast({ title: "匯出成功", description: "出差精算表已匯出為 JSON 檔案" });
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

  // Field cell component with stacked layout (label on top, input below)
  const FieldCell = ({ 
    label, 
    children, 
    className = "" 
  }: { 
    label: string; 
    children: React.ReactNode;
    className?: string;
  }) => (
    <div className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </span>
      {children}
    </div>
  );

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
            CSV
          </Button>
          <Button onClick={exportToJSON} variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            JSON
          </Button>
        </div>
      </div>

      <ScrollArea className="w-full rounded-lg border bg-card">
        <div className="min-w-[1600px] p-4">
          {entries.map((entry, index) => (
            <div 
              key={entry.id} 
              className="mb-4 p-4 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              {/* Row Header */}
              <div className="flex items-center justify-between mb-3 pb-2 border-b">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-primary">#{index + 1}</span>
                  <span className="text-sm text-muted-foreground truncate max-w-[200px]">
                    {entry.filename || "新增項目"}
                  </span>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => moveEntry(entry.id, "up")} disabled={index === 0} className="h-7 w-7 p-0">
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => moveEntry(entry.id, "down")} disabled={index === entries.length - 1} className="h-7 w-7 p-0">
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => removeEntry(entry.id)} className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Fields Grid - Horizontal scroll with stacked labels */}
              <div className="flex gap-3">
                {/* 來源資料 */}
                <div className="flex-shrink-0 space-y-3 p-3 rounded-md bg-background/50 border">
                  <div className="text-xs font-semibold text-primary mb-2">來源資料</div>
                  <FieldCell label="統一編號">
                    <Input
                      value={entry.supplier_tax_id}
                      onChange={(e) => updateEntry(entry.id, "supplier_tax_id", e.target.value)}
                      className="h-8 text-xs w-28"
                    />
                  </FieldCell>
                  <FieldCell label="廠商名稱">
                    <Input
                      value={entry.supplier_name}
                      onChange={(e) => updateEntry(entry.id, "supplier_name", e.target.value)}
                      className="h-8 text-xs w-36"
                    />
                  </FieldCell>
                  <FieldCell label="憑證日期">
                    <Input
                      type="date"
                      value={entry.invoice_date}
                      onChange={(e) => updateEntry(entry.id, "invoice_date", e.target.value)}
                      className="h-8 text-xs w-32"
                    />
                  </FieldCell>
                </div>

                {/* 報支設定 */}
                <div className="flex-shrink-0 space-y-3 p-3 rounded-md bg-background/50 border">
                  <div className="text-xs font-semibold text-primary mb-2">報支設定</div>
                  <FieldCell label="輸出">
                    <Select value={entry.output_type} onValueChange={(value) => updateEntry(entry.id, "output_type", value)}>
                      <SelectTrigger className="h-8 text-xs w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="員工">員工</SelectItem>
                        <SelectItem value="廠商">廠商</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldCell>
                  <FieldCell label="付款方式">
                    <Select value={entry.payment_method} onValueChange={(value) => updateEntry(entry.id, "payment_method", value)} disabled={entry.output_type === "員工"}>
                      <SelectTrigger className="h-8 text-xs w-24">
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
                  </FieldCell>
                </div>

                {/* 報支內容 */}
                <div className="flex-shrink-0 space-y-3 p-3 rounded-md bg-background/50 border">
                  <div className="text-xs font-semibold text-primary mb-2">報支內容</div>
                  <div className="flex gap-3">
                    <FieldCell label="日期">
                      <Input
                        type="date"
                        value={entry.expense_date}
                        onChange={(e) => updateEntry(entry.id, "expense_date", e.target.value)}
                        className="h-8 text-xs w-32"
                      />
                    </FieldCell>
                    <FieldCell label="內容">
                      <Input
                        value={entry.content}
                        onChange={(e) => updateEntry(entry.id, "content", e.target.value)}
                        className="h-8 text-xs w-32"
                      />
                    </FieldCell>
                  </div>
                  <div className="flex gap-3">
                    <FieldCell label="數量">
                      <Input
                        type="number"
                        value={entry.quantity}
                        onChange={(e) => updateEntry(entry.id, "quantity", parseFloat(e.target.value) || 0)}
                        className="h-8 text-xs w-16"
                      />
                    </FieldCell>
                    <FieldCell label="單價">
                      <Input
                        type="number"
                        value={entry.unit_price}
                        onChange={(e) => updateEntry(entry.id, "unit_price", parseFloat(e.target.value) || 0)}
                        className="h-8 text-xs w-24"
                      />
                    </FieldCell>
                    <FieldCell label="幣別">
                      <Select value={entry.currency} onValueChange={(value) => updateEntry(entry.id, "currency", value)}>
                        <SelectTrigger className="h-8 text-xs w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FieldCell>
                  </div>
                  <div className="flex gap-3">
                    <FieldCell label="金額">
                      <Input
                        type="number"
                        value={entry.amount}
                        onChange={(e) => updateEntry(entry.id, "amount", parseFloat(e.target.value) || 0)}
                        className="h-8 text-xs w-24 font-semibold"
                      />
                    </FieldCell>
                    <FieldCell label="備註">
                      <Input
                        value={entry.notes}
                        onChange={(e) => updateEntry(entry.id, "notes", e.target.value)}
                        className="h-8 text-xs w-32"
                      />
                    </FieldCell>
                  </div>
                </div>

                {/* 借方會計 */}
                <div className="flex-shrink-0 space-y-3 p-3 rounded-md bg-background/50 border">
                  <div className="text-xs font-semibold text-amber-600 mb-2">借方 (Dr)</div>
                  <FieldCell label="科目">
                    <Select value={entry.debit_account} onValueChange={(value) => updateEntry(entry.id, "debit_account", value)}>
                      <SelectTrigger className="h-8 text-xs w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DEBIT_ACCOUNTS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FieldCell>
                  <FieldCell label="項目">
                    <Input
                      value={entry.debit_item}
                      onChange={(e) => updateEntry(entry.id, "debit_item", e.target.value)}
                      className="h-8 text-xs w-28"
                    />
                  </FieldCell>
                  <FieldCell label="摘要">
                    <Input
                      value={entry.debit_summary}
                      onChange={(e) => updateEntry(entry.id, "debit_summary", e.target.value)}
                      className="h-8 text-xs w-32"
                    />
                  </FieldCell>
                </div>

                {/* 貸方會計 */}
                <div className="flex-shrink-0 space-y-3 p-3 rounded-md bg-background/50 border">
                  <div className="text-xs font-semibold text-emerald-600 mb-2">貸方 (Cr)</div>
                  <FieldCell label="科目">
                    <Select value={entry.credit_account} onValueChange={(value) => updateEntry(entry.id, "credit_account", value)}>
                      <SelectTrigger className="h-8 text-xs w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CREDIT_ACCOUNTS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FieldCell>
                  <FieldCell label="項目">
                    <Input
                      value={entry.credit_item}
                      onChange={(e) => updateEntry(entry.id, "credit_item", e.target.value)}
                      className="h-8 text-xs w-28"
                    />
                  </FieldCell>
                  <FieldCell label="摘要">
                    <Input
                      value={entry.credit_summary}
                      onChange={(e) => updateEntry(entry.id, "credit_summary", e.target.value)}
                      className="h-8 text-xs w-32"
                    />
                  </FieldCell>
                </div>
              </div>
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
};
