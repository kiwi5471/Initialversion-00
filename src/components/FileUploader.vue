<script setup lang="ts">
import { ref } from 'vue';
import { Upload, FileText, X, Loader2 } from 'lucide-vue-next';
import type { ExpenseEntry } from '@/types/invoice';
import { isPDF, convertPDFToImages } from '@/lib/pdfUtils';

const props = defineProps<{
  isProcessing: boolean
}>();

const emit = defineEmits<{
  (e: 'filesProcessed', entries: ExpenseEntry[]): void,
  (e: 'update:isProcessing', value: boolean): void
}>();

const dragActive = ref(false);
const selectedFiles = ref<{ file: File, preview: string }[]>([]);
const isConvertingPDF = ref(false);

const handleDrag = (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  if (e.type === "dragenter" || e.type === "dragover") {
    dragActive.value = true;
  } else if (e.type === "dragleave") {
    dragActive.value = false;
  }
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

const recognizeWithGPT = async (file: File): Promise<ExpenseEntry> => {
  const apiKey = import.meta.env.VITE_GPT_API_KEY;
  if (!apiKey) {
    throw new Error("找不到 API Key，請檢查環境變數 VITE_GPT_API_KEY");
  }

  const base64Image = await fileToBase64(file);
  const base64Data = base64Image.split(',')[1];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "你是一個專業的財務助理。請辨識發票/收據圖片中的資訊，並嚴格以 JSON 格式回傳以下欄位：supplier_tax_id (統一編號), supplier_name (廠商名稱), invoice_date (格式 YYYY-MM-DD), item_description (品項描述), amount_exclusive_tax (未稅金額), tax_amount (稅額), amount_inclusive_tax (總金額)。請只回傳 JSON 字串，不要有任何其他解釋文字。"
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "請辨識這張收據："
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Data}`
              }
            }
          ]
        }
      ],
      response_format: { type: "json_object" }
    })
  });

  const result = await response.json();
  if (result.error) throw new Error(result.error.message);
  
  const content = JSON.parse(result.choices[0].message.content);
  const today = new Date().toISOString().split('T')[0];

  return {
    id: crypto.randomUUID(),
    filename: file.name,
    supplier_tax_id: content.supplier_tax_id || "",
    supplier_name: content.supplier_name || "",
    invoice_date: content.invoice_date || today,
    item_description: content.item_description || "",
    amount_exclusive_tax: Number(content.amount_exclusive_tax) || 0,
    tax_amount: Number(content.tax_amount) || 0,
    amount_inclusive_tax: Number(content.amount_inclusive_tax) || 0,
    page_number: 1,
    output_type: "員工",
    payment_method: "電匯",
    expense_date: today,
    content: content.item_description || "",
    quantity: 1,
    unit_price: Number(content.amount_inclusive_tax) || 0,
    currency: "TWD",
    amount: Number(content.amount_inclusive_tax) || 0,
    notes: "",
    debit_account: "旅費",
    debit_item: "",
    debit_summary: content.item_description || "",
    credit_account: "應付帳款",
    credit_item: "",
    credit_summary: "",
  };
};

const validateFiles = async (files: FileList | File[]) => {
  const validFiles: { file: File, preview: string }[] = [];
  const fileArray = Array.from(files);

  for (const file of fileArray) {
    if (isPDF(file)) {
      isConvertingPDF.value = true;
      try {
        const pages = await convertPDFToImages(file);
        pages.forEach(page => {
          validFiles.push({
            file: page.file,
            preview: page.imageUrl
          });
        });
      } catch (err) {
        console.error("PDF conversion error:", err);
        alert(`無法轉換 PDF 檔案: ${file.name}`);
      } finally {
        isConvertingPDF.value = false;
      }
      continue;
    }

    if (!file.type.match(/^image\/(png|jpg|jpeg|gif|webp)$/)) {
      alert(`檔案 ${file.name} 格式不支援。請上傳 PDF 或圖片格式。`);
      continue;
    }

    if (file.size > 20 * 1024 * 1024) {
      alert(`檔案 ${file.name} 超過 20MB 限制。`);
      continue;
    }

    validFiles.push({
      file,
      preview: URL.createObjectURL(file)
    });
  }

  return validFiles;
};

const handleDrop = async (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  dragActive.value = false;

  const files = await validateFiles(e.dataTransfer?.files || []);
  if (files.length > 0) {
    selectedFiles.value = [...selectedFiles.value, ...files];
  }
};

const handleChange = async (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files) {
    const files = await validateFiles(target.files);
    if (files.length > 0) {
      selectedFiles.value = [...selectedFiles.value, ...files];
    }
    target.value = ''; // Reset input
  }
};

const removeFile = (index: number) => {
  const file = selectedFiles.value[index];
  if (file.preview.startsWith('blob:')) {
    URL.revokeObjectURL(file.preview);
  }
  selectedFiles.value = selectedFiles.value.filter((_, i) => i !== index);
};

const handleUpload = async () => {
  if (selectedFiles.value.length === 0) {
    alert("請先選擇要上傳的票據檔案");
    return;
  }
  
  emit('update:isProcessing', true);
  
  try {
    const results: ExpenseEntry[] = [];
    for (const item of selectedFiles.value) {
      const entry = await recognizeWithGPT(item.file);
      results.push(entry);
    }
    
    emit('filesProcessed', results);
    selectedFiles.value.forEach(f => {
       if (f.preview.startsWith('blob:')) URL.revokeObjectURL(f.preview);
    });
    selectedFiles.value = [];
    alert(`辨識完成！已成功透過 GPT-4o 處理 ${results.length} 筆資料。`);
  } catch (error: any) {
    console.error("OCR Error:", error);
    alert(`辨識失敗: ${error.message}`);
  } finally {
    emit('update:isProcessing', false);
  }
};
</script>

<template>
  <div class="space-y-4">
    <div v-if="isConvertingPDF" class="flex items-center justify-center p-8 border-2 border-dashed rounded-lg bg-muted/20">
      <div class="flex flex-col items-center gap-2">
        <Loader2 class="h-8 w-8 animate-spin text-primary" />
        <p class="text-sm font-medium">PDF 頁面解析中...</p>
      </div>
    </div>
    <div
      v-else
      :class="[
        'border-2 border-dashed transition-all duration-200 rounded-lg p-8',
        dragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
      ]"
      @dragenter="handleDrag"
      @dragleave="handleDrag"
      @dragover.prevent="handleDrag"
      @drop="handleDrop"
    >
      <div class="flex flex-col items-center justify-center space-y-4 text-center">
        <div class="rounded-full bg-primary/10 p-4">
          <Upload class="h-8 w-8 text-primary" />
        </div>
        <div class="space-y-2">
          <h3 class="text-lg font-semibold">上傳票據憑證</h3>
          <p class="text-sm text-muted-foreground">
            拖曳檔案至此處，或點擊下方按鈕選擇檔案
          </p>
          <p class="text-xs text-muted-foreground">
            支援格式：PDF、JPG、PNG（單檔最大 20MB）
          </p>
        </div>
        <label for="file-upload" class="cursor-pointer">
          <span class="inline-flex items-center px-4 py-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md text-sm font-medium transition-colors">
            選擇檔案
          </span>
          <input
            id="file-upload"
            type="file"
            class="hidden"
            multiple
            accept="image/*,application/pdf"
            @change="handleChange"
          />
        </label>
      </div>
    </div>

    <div v-if="selectedFiles.length > 0" class="p-4 bg-card rounded-lg border">
      <div class="space-y-2">
        <h4 class="font-semibold text-sm">已選擇的檔案 ({{ selectedFiles.length }})</h4>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div
            v-for="(item, index) in selectedFiles"
            :key="index"
            class="flex items-center justify-between rounded-md border bg-muted/50 p-2 text-sm"
          >
            <div class="flex items-center gap-3 overflow-hidden">
              <div class="w-12 h-12 rounded bg-white flex-shrink-0 border overflow-hidden">
                <img :src="item.preview" class="w-full h-full object-cover" />
              </div>
              <div class="flex flex-col min-w-0">
                <span class="truncate font-medium">{{ item.file.name }}</span>
                <span class="text-[10px] text-muted-foreground whitespace-nowrap">
                  {{ (item.file.size / 1024).toFixed(1) }} KB
                </span>
              </div>
            </div>
            <button
              @click="removeFile(index)"
              class="h-8 w-8 p-0 hover:bg-accent hover:text-destructive rounded flex items-center justify-center flex-shrink-0"
            >
              <X class="h-4 w-4" />
            </button>
          </div>
        </div>
        <button
          @click="handleUpload"
          :disabled="isProcessing"
          class="w-full mt-4 bg-primary text-primary-foreground hover:bg-primary/90 py-2 rounded-md font-medium disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Loader2 v-if="isProcessing" class="h-4 w-4 animate-spin" />
          {{ isProcessing ? "正在辨識中..." : `開始辨識 (${selectedFiles.length} 個附件)` }}
        </button>
      </div>
    </div>
  </div>
</template>
