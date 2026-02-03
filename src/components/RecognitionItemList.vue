<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { Check, Pencil, X, Save, Plus, Trash2, AlertCircle } from 'lucide-vue-next';
import { cn } from '@/lib/utils';
import { DOCUMENT_CATEGORIES, type LineItem } from '@/types/recognition';

const props = defineProps<{
  items: LineItem[];
  activeItemId: string | null;
  highlightedItemIds: string[];
}>();

const emit = defineEmits<{
  (e: 'itemClick', item: LineItem): void;
  (e: 'itemUpdate', id: string, updates: Partial<LineItem>): void;
  (e: 'itemDelete', id: string): void;
  (e: 'itemConfirm', id: string): void;
  (e: 'itemAdd'): void;
  (e: 'editingChange', isEditing: boolean): void;
}>();

const editingId = ref<string | null>(null);
const editForm = ref<Partial<LineItem>>({});
const editAmountStrings = ref({ amount_with_tax: "", input_tax: "" });
const deleteWarningItem = ref<LineItem | null>(null);
const deleteFormAmounts = ref({ amount_with_tax: "", input_tax: "" });
const validationErrors = ref<{ tax_id?: string; invoice_number?: string }>({});

watch(() => props.items, () => {
  editingId.value = null;
  editForm.value = {};
  validationErrors.value = {};
  emit('editingChange', false);
}, { deep: true });

const updateEditingId = (id: string | null) => {
  editingId.value = id;
  emit('editingChange', id !== null);
};

const formatAmount = (amount: string) => {
  const num = parseFloat(amount) || 0;
  return new Intl.NumberFormat("zh-TW", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
};

const getCategoryShortLabel = (value: string) => {
  const cat = DOCUMENT_CATEGORIES.find(c => c.value === value);
  if (!cat) return value;
  const label = cat.label;
  const dotIndex = label.indexOf('.');
  return dotIndex >= 0 ? label.substring(dotIndex + 1) : label;
};

const validateTaxId = (value: string | null): string | undefined => {
  if (!value || value === "") return undefined;
  if (!/^\d{8}$/.test(value)) return "統編必須為 8 位純數字";
  return undefined;
};

const validateInvoiceNumber = (value: string | null): string | undefined => {
  if (!value || value === "") return undefined;
  if (!/^[A-Za-z]{2}\d{8}$/.test(value)) return "發票號碼格式：2碼英文 + 8碼數字";
  return undefined;
};

const handleTaxIdChange = (e: Event) => {
  const value = (e.target as HTMLInputElement).value;
  const cleanValue = value.replace(/\D/g, '').slice(0, 8);
  editForm.value.tax_id = cleanValue || null;
  validationErrors.value.tax_id = validateTaxId(cleanValue);
};

const handleInvoiceNumberChange = (e: Event) => {
  const value = (e.target as HTMLInputElement).value;
  const upper = value.toUpperCase();
  let result = '';
  for (let i = 0; i < upper.length && result.length < 10; i++) {
    const char = upper[i];
    if (result.length < 2) {
      if (/[A-Z]/.test(char)) result += char;
    } else {
      if (/\d/.test(char)) result += char;
    }
  }
  editForm.value.invoice_number = result || null;
  validationErrors.value.invoice_number = validateInvoiceNumber(result);
};

const startEditing = (item: LineItem) => {
  updateEditingId(item.id);
  editForm.value = {
    category: item.category,
    vendor: item.vendor,
    tax_id: item.tax_id,
    date: item.date,
    invoice_number: item.invoice_number,
    amount_with_tax: item.amount_with_tax,
    input_tax: item.input_tax,
  };
  editAmountStrings.value = {
    amount_with_tax: String(item.amount_with_tax),
    input_tax: String(item.input_tax),
  };
  validationErrors.value = {
    tax_id: validateTaxId(item.tax_id),
    invoice_number: validateInvoiceNumber(item.invoice_number),
  };
};

const saveEdit = (id: string) => {
  const taxIdError = validateTaxId(editForm.value.tax_id as string | null);
  const invoiceError = validateInvoiceNumber(editForm.value.invoice_number as string | null);
  
  if (taxIdError || invoiceError) {
    validationErrors.value = { tax_id: taxIdError, invoice_number: invoiceError };
    return;
  }
  
  const updatedForm = {
    ...editForm.value,
    amount_with_tax: editAmountStrings.value.amount_with_tax || "0",
    input_tax: editAmountStrings.value.input_tax || "0",
  };
  
  emit('itemUpdate', id, updatedForm);
  updateEditingId(null);
  editForm.value = {};
  editAmountStrings.value = { amount_with_tax: "", input_tax: "" };
  validationErrors.value = {};
};

const cancelEdit = () => {
  updateEditingId(null);
  editForm.value = {};
  validationErrors.value = {};
};

const handleDeleteClick = (item: LineItem) => {
  const amountNum = parseFloat(item.amount_with_tax) || 0;
  const taxNum = parseFloat(item.input_tax) || 0;
  if (amountNum !== 0 || taxNum !== 0) {
    deleteWarningItem.value = item;
    deleteFormAmounts.value = {
      amount_with_tax: item.amount_with_tax,
      input_tax: item.input_tax,
    };
  } else {
    emit('itemDelete', item.id);
  }
};

const canDeleteNow = computed(() => {
  const amountWithTax = parseFloat(deleteFormAmounts.value.amount_with_tax) || 0;
  const inputTax = parseFloat(deleteFormAmounts.value.input_tax) || 0;
  return amountWithTax === 0 && inputTax === 0;
});

const handleConfirmDelete = () => {
  if (deleteWarningItem.value) {
    emit('itemUpdate', deleteWarningItem.value.id, { amount_with_tax: "0", input_tax: "0" });
    emit('itemDelete', deleteWarningItem.value.id);
    deleteWarningItem.value = null;
  }
};
</script>

<template>
  <div class="flex flex-col h-[calc(100vh-320px)] min-h-[300px]">
    <button
      type="button"
      class="w-full border-dashed mb-3 flex-shrink-0 inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 gap-2"
      @click="emit('itemAdd')"
    >
      <Plus class="h-4 w-4" />
      新增明細
    </button>

    <div v-if="items.length === 0" class="text-center py-8">
      <p class="text-muted-foreground mb-4">尚無辨識結果</p>
    </div>
    
    <div v-else class="flex-1 overflow-auto border rounded-md">
      <div class="min-w-[1200px]">
        <table class="w-full caption-bottom text-sm">
          <thead class="[&_tr]:border-b">
            <tr class="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
              <th class="h-10 px-4 text-left align-middle font-medium text-muted-foreground w-[120px]">類別</th>
              <th class="h-10 px-4 text-left align-middle font-medium text-muted-foreground min-w-[200px]">廠商</th>
              <th class="h-10 px-4 text-left align-middle font-medium text-muted-foreground w-[160px]">統編</th>
              <th class="h-10 px-4 text-left align-middle font-medium text-muted-foreground w-[160px]">日期</th>
              <th class="h-10 px-4 text-left align-middle font-medium text-muted-foreground w-[180px]">發票號碼</th>
              <th class="h-10 px-4 text-right align-middle font-medium text-muted-foreground w-[140px]">含稅金額</th>
              <th class="h-10 px-4 text-right align-middle font-medium text-muted-foreground w-[120px]">稅額</th>
              <th class="h-10 px-4 text-center align-middle font-medium text-muted-foreground w-[120px]">操作</th>
            </tr>
          </thead>
          <tbody class="[&_tr:last-child]:border-0">
            <template v-for="item in items" :key="item.id">
              <tr 
                v-if="editingId === item.id"
                class="bg-muted/50 border-b transition-colors"
              >
                <td class="p-2 align-middle">
                  <select 
                    v-model="editForm.category"
                    class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option v-for="c in DOCUMENT_CATEGORIES" :key="c.value" :value="c.value">
                      {{ c.label }}
                    </option>
                  </select>
                </td>
                <td class="p-2 align-middle">
                  <input 
                    v-model="editForm.vendor"
                    class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </td>
                <td class="p-2 align-middle">
                  <div class="relative">
                    <input 
                      :value="editForm.tax_id"
                      @input="handleTaxIdChange"
                      class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      :class="validationErrors.tax_id && 'border-destructive'"
                    />
                    <div v-if="validationErrors.tax_id" class="absolute -bottom-5 left-0 text-[10px] text-destructive">
                      {{ validationErrors.tax_id }}
                    </div>
                  </div>
                </td>
                <td class="p-2 align-middle">
                  <input 
                    v-model="editForm.date"
                    type="date"
                    class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </td>
                <td class="p-2 align-middle">
                  <div class="relative">
                    <input 
                      :value="editForm.invoice_number"
                      @input="handleInvoiceNumberChange"
                      class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      :class="validationErrors.invoice_number && 'border-destructive'"
                    />
                    <div v-if="validationErrors.invoice_number" class="absolute -bottom-5 left-0 text-[10px] text-destructive">
                      {{ validationErrors.invoice_number }}
                    </div>
                  </div>
                </td>
                <td class="p-2 align-middle">
                  <input 
                    v-model="editAmountStrings.amount_with_tax"
                    type="number"
                    class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-right"
                  />
                </td>
                <td class="p-2 align-middle">
                  <input 
                    v-model="editAmountStrings.input_tax"
                    type="number"
                    class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-right"
                  />
                </td>
                <td class="p-2 align-middle">
                  <div class="flex items-center justify-center gap-1">
                    <button
                      type="button"
                      @click="saveEdit(item.id)"
                      class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-8 w-8"
                    >
                      <Save class="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      @click="cancelEdit"
                      class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 w-8"
                    >
                      <X class="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
              <tr 
                v-else
                @click="emit('itemClick', item)"
                class="border-b transition-colors hover:bg-muted/50 cursor-pointer"
                :class="[
                  activeItemId === item.id ? 'bg-primary/5' : '',
                  highlightedItemIds.includes(item.id) ? 'bg-yellow-50/50' : ''
                ]"
              >
                <td class="p-4 align-middle">
                  <span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
                    {{ getCategoryShortLabel(item.category) }}
                  </span>
                </td>
                <td class="p-4 align-middle font-medium truncate">{{ item.vendor || '(未知)' }}</td>
                <td class="p-4 align-middle font-mono text-xs">{{ item.tax_id || '-' }}</td>
                <td class="p-4 align-middle text-muted-foreground">{{ item.date || '-' }}</td>
                <td class="p-4 align-middle">{{ item.invoice_number || '-' }}</td>
                <td class="p-4 align-middle text-right font-semibold">{{ formatAmount(item.amount_with_tax) }}</td>
                <td class="p-4 align-middle text-right text-muted-foreground">{{ formatAmount(item.input_tax) }}</td>
                <td class="p-4 align-middle">
                  <div class="flex items-center justify-center gap-1" @click.stop>
                    <button
                      v-if="!item.confirmed"
                      type="button"
                      @click="emit('itemConfirm', item.id)"
                      class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-8 w-8"
                    >
                      <Check class="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      @click="startEditing(item)"
                      class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 w-8"
                    >
                      <Pencil class="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      @click="handleDeleteClick(item)"
                      class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 w-8 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 class="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Delete Warning Dialog (Custom implementation) -->
    <div v-if="deleteWarningItem" class="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div class="bg-background rounded-lg border shadow-lg max-w-lg w-full p-6 space-y-4">
        <div class="space-y-2">
          <h2 class="text-lg font-semibold flex items-center gap-2">
            <AlertCircle class="h-5 w-5 text-destructive" />
            確定要刪除這筆項目嗎？
          </h2>
          <p class="text-sm text-muted-foreground">
            這筆項目含有金額 ({{ formatAmount(deleteWarningItem.amount_with_tax) }})。
            為了確保資料正確性，請先將金額清零後再刪除。
          </p>
        </div>
        
        <div class="grid grid-cols-2 gap-4 border p-4 rounded-md bg-muted/20">
          <div class="space-y-2">
            <label class="text-xs font-medium uppercase text-muted-foreground">含稅金額</label>
            <input 
              v-model="deleteFormAmounts.amount_with_tax"
              type="number"
              class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
          <div class="space-y-2">
            <label class="text-xs font-medium uppercase text-muted-foreground">稅額</label>
            <input 
              v-model="deleteFormAmounts.input_tax"
              type="number"
              class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <button 
            @click="deleteWarningItem = null"
            class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
          >
            取消
          </button>
          <button 
            @click="handleConfirmDelete"
            :disabled="!canDeleteNow"
            class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-destructive text-destructive-foreground hover:bg-destructive/90 h-10 px-4 py-2"
          >
            確認刪除
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
