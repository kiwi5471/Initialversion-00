<script setup lang="ts">
import { ref, computed } from 'vue';
import { 
  Plus, 
  Trash2, 
  ChevronUp, 
  ChevronDown, 
  Download,
  FileText
} from 'lucide-vue-next';
import type { ExpenseEntry } from '@/types/invoice';

const props = defineProps<{
  entries: ExpenseEntry[]
}>();

const emit = defineEmits<{
  (e: 'update:entries', entries: ExpenseEntry[]): void
}>();

const CURRENCIES = ["TWD", "USD", "JPY", "EUR", "CNY"];
const DEBIT_ACCOUNTS = ["旅費", "交通費", "住宿費", "餐飲費", "雜費"];
const CREDIT_ACCOUNTS = ["應付帳款", "現金", "銀行存款"];

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
  emit('update:entries', [...props.entries, newEntry]);
};

const removeEntry = (id: string) => {
  emit('update:entries', props.entries.filter((entry) => entry.id !== id));
};

const moveEntry = (id: string, direction: "up" | "down") => {
  const index = props.entries.findIndex((entry) => entry.id === id);
  if (
    (direction === "up" && index === 0) ||
    (direction === "down" && index === props.entries.length - 1)
  ) {
    return;
  }

  const newEntries = [...props.entries];
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  [newEntries[index], newEntries[targetIndex]] = [
    newEntries[targetIndex],
    newEntries[index],
  ];
  emit('update:entries', newEntries);
};

const updateEntry = (id: string, field: keyof ExpenseEntry, value: any) => {
  const newEntries = props.entries.map((entry) => {
    if (entry.id !== id) return entry;
    
    const updated = { ...entry, [field]: value };
    
    if (field === "quantity" || field === "unit_price") {
      updated.amount = (updated.quantity || 0) * (updated.unit_price || 0);
    }
    
    if (field === "output_type") {
      updated.payment_method = value === "員工" ? "電匯" : "外幣";
    }
    
    return updated;
  });
  emit('update:entries', newEntries);
};

const exportToCSV = () => {
  const headers = [
    "編號", "檔案名稱", "供應商統一編號", "供應商名稱", "憑證日期",
    "輸出", "付款方式", "日期", "內容", "數量", "單價", "幣別", "金額", "備註",
    "借方科目", "借方項目", "借方摘要", "貸方科目", "貸方項目", "貸方摘要",
  ];

  const rows = props.entries.map((entry, index) => [
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
};

const exportToJSON = () => {
  const jsonContent = JSON.stringify(props.entries, null, 2);
  const blob = new Blob([jsonContent], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `expense_report_${new Date().toISOString().split('T')[0]}.json`;
  link.click();
};
</script>

<template>
  <div class="space-y-4">
    <div v-if="entries.length === 0" class="flex flex-col items-center justify-center py-12 text-center">
      <p class="text-muted-foreground mb-4">尚無資料，請先上傳票據進行辨識</p>
      <button @click="addEntry" class="inline-flex items-center px-4 py-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md text-sm font-medium transition-colors">
        <Plus class="mr-2 h-4 w-4" />
        手動新增
      </button>
    </div>

    <div v-else class="space-y-4">
      <div class="flex justify-between items-center">
        <h3 class="text-lg font-semibold">出差精算表 ({{ entries.length }} 筆)</h3>
        <div class="flex gap-2">
          <button @click="addEntry" class="inline-flex items-center px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md text-sm font-medium transition-colors">
            <Plus class="mr-2 h-4 w-4" />
            新增
          </button>
          <button @click="exportToCSV" class="inline-flex items-center px-3 py-1.5 border border-input bg-background hover:bg-accent rounded-md text-sm font-medium transition-colors">
            <Download class="mr-2 h-4 w-4" />
            CSV
          </button>
          <button @click="exportToJSON" class="inline-flex items-center px-3 py-1.5 border border-input bg-background hover:bg-accent rounded-md text-sm font-medium transition-colors">
            <Download class="mr-2 h-4 w-4" />
            JSON
          </button>
        </div>
      </div>

      <div class="w-full rounded-lg border bg-card overflow-x-auto">
        <div class="min-w-[1200px] p-4">
          <div v-for="(entry, index) in entries" :key="entry.id" class="mb-4 p-4 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
            <!-- Row Header -->
            <div class="flex items-center justify-between mb-3 pb-2 border-b">
              <div class="flex items-center gap-3">
                <span class="text-lg font-bold text-primary">#{{ index + 1 }}</span>
                <span class="text-sm text-muted-foreground truncate max-w-[200px]">
                  {{ entry.filename || "新增項目" }}
                </span>
              </div>
              <div class="flex gap-1">
                <button @click="moveEntry(entry.id, 'up')" :disabled="index === 0" class="p-1 hover:bg-accent rounded disabled:opacity-50">
                  <ChevronUp class="h-4 w-4" />
                </button>
                <button @click="moveEntry(entry.id, 'down')" :disabled="index === entries.length - 1" class="p-1 hover:bg-accent rounded disabled:opacity-50">
                  <ChevronDown class="h-4 w-4" />
                </button>
                <button @click="removeEntry(entry.id)" class="p-1 hover:bg-destructive/10 text-destructive rounded">
                  <Trash2 class="h-4 w-4" />
                </button>
              </div>
            </div>

            <!-- Fields Grid (Simplified for Migration) -->
            <div class="grid grid-cols-4 lg:grid-cols-6 gap-4">
              <div class="flex flex-col gap-1">
                <span class="text-[10px] font-medium text-muted-foreground uppercase">統一編號</span>
                <input v-model="entry.supplier_tax_id" class="h-8 text-xs border rounded px-2 bg-background w-full" />
              </div>
              <div class="flex flex-col gap-1">
                <span class="text-[10px] font-medium text-muted-foreground uppercase">廠商名稱</span>
                <input v-model="entry.supplier_name" class="h-8 text-xs border rounded px-2 bg-background w-full" />
              </div>
              <div class="flex flex-col gap-1">
                <span class="text-[10px] font-medium text-muted-foreground uppercase">憑證日期</span>
                <input type="date" v-model="entry.invoice_date" class="h-8 text-xs border rounded px-2 bg-background w-full" />
              </div>
              <div class="flex flex-col gap-1">
                <span class="text-[10px] font-medium text-muted-foreground uppercase">金額</span>
                <input type="number" v-model.number="entry.amount" class="h-8 text-xs border rounded px-2 bg-background w-full" />
              </div>
              <div class="flex flex-col gap-1">
                <span class="text-[10px] font-medium text-muted-foreground uppercase">幣別</span>
                <select v-model="entry.currency" class="h-8 text-xs border rounded px-1 bg-background w-full">
                  <option v-for="c in CURRENCIES" :key="c" :value="c">{{ c }}</option>
                </select>
              </div>
              <div class="flex flex-col gap-1">
                <span class="text-[10px] font-medium text-muted-foreground uppercase">借方科目</span>
                <select v-model="entry.debit_account" class="h-8 text-xs border rounded px-1 bg-background w-full">
                  <option v-for="a in DEBIT_ACCOUNTS" :key="a" :value="a">{{ a }}</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
