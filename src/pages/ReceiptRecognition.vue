<script setup lang="ts">
import { ref, computed } from 'vue';
import type { LineItem, OCRBlock } from '@/types/recognition';
import type { FileProcessingResult, UploadedFileItem, ExportData, ExportedLineItem } from '@/types/batch';
import ReceiptUploader from '@/components/ReceiptUploader.vue';
import UploadFileList from '@/components/UploadFileList.vue';
import RecognitionItemList from '@/components/RecognitionItemList.vue';
import ReceiptPreview from '@/components/ReceiptPreview.vue';
import BatchFileList from '@/components/BatchFileList.vue';
import ExportButtons from '@/components/ExportButtons.vue';
import { RotateCcw, Play, Loader2 } from 'lucide-vue-next';

type Step = 'upload' | 'result';

const step = ref<Step>('upload');

// Step 1 state
const uploadedFiles = ref<UploadedFileItem[]>([]);

// Step 2 state
const processedFiles = ref<FileProcessingResult[]>([]);
const activeFileId = ref<string | null>(null);
const activeItemId = ref<string | null>(null);
const highlightedItemIds = ref<string[]>([]);
const activeBlockIds = ref<string[]>([]);
const isProcessing = ref(false);
const isEditing = ref(false);

const activeFile = computed(() => 
  processedFiles.value.find(f => f.id === activeFileId.value) || null
);

const totalRecognitionAmount = computed(() => {
  return processedFiles.value.reduce((sum, file) => {
    return sum + file.lineItems.reduce((fileSum, item) => {
      return fileSum + (parseFloat(item.amount_with_tax) || 0);
    }, 0);
  }, 0);
});

const exportData = computed<ExportData>(() => {
  const allItems: ExportedLineItem[] = [];
  
  processedFiles.value.forEach(file => {
    file.lineItems.forEach(item => {
      allItems.push({
        name: item.invoice_number,
        category: item.category,
        tax_id: item.tax_id,
        vendor: item.vendor,
        date: item.date,
        amount_without_tax: String(parseFloat(item.amount_with_tax) - parseFloat(item.input_tax)),
        tax_amount: item.input_tax,
        amount_with_tax: item.amount_with_tax,
        scanned_filename: file.fileName,
        file_path: "",
        user_id: "",
        username: "",
      });
    });
  });

  return {
    exportedAt: new Date().toISOString(),
    totalItems: allItems.length,
    items: allItems,
  };
});

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
  });
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const recognizeWithGPT = async (base64Image: string) => {
  const apiKey = import.meta.env.VITE_GPT_API_KEY;
  if (!apiKey) {
    throw new Error('未設定 API Key');
  }

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
          content: "你是一個專業的收據辨識助手。請辨識圖片中的所有收據/發票項目。請嚴格遵守以下 JSON 格式輸出：\n{\n  \"lineItems\": [\n    {\n      \"category\": \"類別代碼 (0: 差旅費, 1: 交際費, 2: 辦公用品...)\",\n      \"vendor\": \"廠商名稱\",\n      \"tax_id\": \"統編 (8位數字)\",\n      \"date\": \"日期 (YYYY-MM-DD)\",\n      \"invoice_number\": \"發票號碼 (2位英文+8位數字)\",\n      \"amount_with_tax\": \"含稅金額\",\n      \"input_tax\": \"稅額\"\n    }\n  ]\n}\n類別代碼參考：\n0: 差旅費\n1: 交際費\n2: 辦公用品\n3: 維修費及其他\n4: 電信費、水電費、瓦斯費\n5: 資產類 (電腦、設備)\n6: 進貨、原料、運費\n7: 保險費\n9: 其他"
        },
        {
          role: "user",
          content: [
            { type: "text", text: "請辨識這張收據" },
            { type: "image_url", image_url: { url: `data:image/png;base64,${base64Image}` } }
          ]
        }
      ],
      response_format: { type: "json_object" }
    })
  });

  const result = await response.json();
  if (result.error) throw new Error(result.error.message);
  return JSON.parse(result.choices[0].message.content);
};

const processFile = async (fileResult: FileProcessingResult, file: File): Promise<FileProcessingResult> => {
  try {
    const base64 = await fileToBase64(file);
    const data = await recognizeWithGPT(base64);

    const lineItems = (data.lineItems || []).map((item: any, index: number) => ({
      ...item,
      id: `line_${fileResult.id}_${index}_${Date.now()}`,
      confirmed: false,
      sourceBlockIds: [],
    }));

    return {
      ...fileResult,
      status: 'success',
      lineItems,
      ocrBlocks: [], // Blocks are not supported in basic GPT-4o vision yet
      metadata: {},
    };
  } catch (error: any) {
    console.error('OCR error:', error);
    return {
      ...fileResult,
      status: 'error',
      error: error.message || '辨識失敗',
    };
  }
};

const handleFilesAdd = (files: UploadedFileItem[]) => {
  uploadedFiles.value = [...uploadedFiles.value, ...files];
};

const handleRemoveFile = (fileId: string) => {
  const file = uploadedFiles.value.find(f => f.id === fileId);
  if (file?.imageUrl.startsWith('blob:')) {
    URL.revokeObjectURL(file.imageUrl);
  }
  uploadedFiles.value = uploadedFiles.value.filter(f => f.id !== fileId);
};

const handleStartRecognition = async () => {
  if (uploadedFiles.value.length === 0) return;

  const initialResults: FileProcessingResult[] = uploadedFiles.value.map(uf => ({
    id: uf.id,
    fileName: uf.fileName,
    imageUrl: uf.imageUrl,
    status: 'pending',
    lineItems: [],
    ocrBlocks: [],
  }));

  processedFiles.value = initialResults;
  activeFileId.value = initialResults[0]?.id || null;
  step.value = 'result';
  isProcessing.value = true;

  const results = [...initialResults];
  const REQUEST_DELAY_MS = 1000;
    
  for (let i = 0; i < uploadedFiles.value.length; i++) {
    results[i] = { ...results[i], status: 'processing' };
    processedFiles.value = [...results];

    if (i > 0) await delay(REQUEST_DELAY_MS);

    const result = await processFile(results[i], uploadedFiles.value[i].file);
    results[i] = result;
    processedFiles.value = [...results];
  }

  isProcessing.value = false;
};

const handleReset = () => {
  uploadedFiles.value.forEach(f => {
    if (f.imageUrl.startsWith('blob:')) URL.revokeObjectURL(f.imageUrl);
  });
  processedFiles.value.forEach(f => {
    if (f.imageUrl.startsWith('blob:')) URL.revokeObjectURL(f.imageUrl);
  });

  uploadedFiles.value = [];
  processedFiles.value = [];
  activeFileId.value = null;
  activeItemId.value = null;
  activeBlockIds.value = [];
  highlightedItemIds.value = [];
  step.value = 'upload';
};

const handleFileSelect = (fileId: string) => {
  if (isEditing.value) return;
  activeFileId.value = fileId;
  activeItemId.value = null;
  activeBlockIds.value = [];
  highlightedItemIds.value = [];
};

const handleItemClick = (item: LineItem) => {
  activeItemId.value = item.id;
  activeBlockIds.value = item.sourceBlockIds;
  highlightedItemIds.value = [];
};

const handleItemAdd = () => {
  if (!activeFileId.value) return;
  
  const newItem: LineItem = {
    id: `line_new_${Date.now()}`,
    category: "0",
    vendor: "",
    tax_id: null,
    date: null,
    invoice_number: null,
    amount_with_tax: "0",
    input_tax: "0",
    editable: true,
    confirmed: false,
    sourceBlockIds: [],
  };

  processedFiles.value = processedFiles.value.map((file) =>
    file.id === activeFileId.value
      ? { ...file, lineItems: [newItem, ...file.lineItems] }
      : file
  );
};

const handleBlockClick = (blockId: string) => {
  if (!activeFile.value) return;
  const relatedItems = activeFile.value.lineItems.filter((item) =>
    item.sourceBlockIds.includes(blockId)
  );
  highlightedItemIds.value = relatedItems.map((item) => item.id);
  activeBlockIds.value = [blockId];
  activeItemId.value = null;
};

const handleEmptyClick = () => {
  activeItemId.value = null;
  activeBlockIds.value = [];
  highlightedItemIds.value = [];
};

const handleItemUpdate = (id: string, updates: Partial<LineItem>) => {
  if (!activeFileId.value) return;
  processedFiles.value = processedFiles.value.map((file) => 
    file.id === activeFileId.value
      ? {
          ...file,
          lineItems: file.lineItems.map((item) =>
            item.id === id ? { ...item, ...updates } : item
          ),
        }
      : file
  );
};

const handleItemDelete = (id: string) => {
  if (!activeFileId.value) return;
  processedFiles.value = processedFiles.value.map((file) =>
    file.id === activeFileId.value
      ? {
          ...file,
          lineItems: file.lineItems.filter((item) => item.id !== id),
        }
      : file
  );
};

const handleItemConfirm = (id: string) => {
  handleItemUpdate(id, { confirmed: true });
};
</script>

<template>
  <div class="container mx-auto py-8 px-4 max-w-7xl animate-fade-in">
    <div v-if="step === 'upload'">
      <div class="max-w-2xl mx-auto space-y-8">
        <div class="text-center space-y-2">
          <h1 class="text-3xl font-bold tracking-tight">進階憑證批量辨識</h1>
          <p class="text-muted-foreground">
            一次上傳多張憑證或 PDF，自動拆分並進行批量辨識
          </p>
        </div>

        <ReceiptUploader 
          @filesAdd="handleFilesAdd" 
          :disabled="isProcessing" 
        />

        <UploadFileList 
          :files="uploadedFiles" 
          @removeFile="handleRemoveFile" 
        />

        <div v-if="uploadedFiles.length > 0" class="flex justify-center pt-4">
          <button
            @click="handleStartRecognition"
            :disabled="isProcessing"
            class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-8 min-w-[200px] gap-2"
          >
            <Play class="w-4 h-4 fill-current" />
            開始辨識
          </button>
        </div>
      </div>
    </div>

    <div v-else-if="step === 'result'" class="space-y-6">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold flex items-center gap-2">
            進階辨識結果
            <span v-if="isProcessing" class="inline-flex items-center text-sm font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded animate-pulse">
              <Loader2 class="w-3 h-3 mr-1 animate-spin" />
              處理中...
            </span>
          </h1>
          <p class="text-sm text-muted-foreground">
            總辨識金額: <span class="text-primary font-bold">{{ new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD", minimumFractionDigits: 0 }).format(totalRecognitionAmount) }}</span>
          </p>
        </div>
        
        <div class="flex items-center gap-2">
          <button
            @click="handleReset"
            :disabled="isProcessing"
            class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 gap-2"
          >
            <RotateCcw class="w-4 h-4" />
            重新開始
          </button>
          
          <ExportButtons :exportData="exportData" />
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <!-- Sidebar -->
        <div class="lg:col-span-3 space-y-6">
          <div class="rounded-xl border bg-card text-card-foreground shadow p-4">
            <BatchFileList
              :files="processedFiles"
              :activeFileId="activeFileId"
              @fileSelect="handleFileSelect"
              :disabled="isEditing"
            />
          </div>
          
          <div class="rounded-xl border bg-card text-card-foreground shadow p-4 flex-1">
            <ReceiptPreview
              v-if="activeFile"
              :imageUrl="activeFile.imageUrl"
              :ocrBlocks="activeFile.ocrBlocks"
              :activeBlockIds="activeBlockIds"
              :totalAmount="activeFile.lineItems.reduce((sum, i) => sum + parseFloat(i.amount_with_tax), 0)"
              @blockClick="handleBlockClick"
              @emptyClick="handleEmptyClick"
            />
          </div>
        </div>

        <!-- Main Content (Table) -->
        <div class="lg:col-span-9">
          <div class="rounded-xl border bg-card text-card-foreground shadow p-4 h-full">
            <div class="mb-4">
              <h3 class="text-lg font-semibold flex items-center gap-2">
                辨識明細編輯
                <span v-if="activeFile" class="text-sm font-normal text-muted-foreground">
                  － {{ activeFile.fileName }}
                </span>
              </h3>
            </div>
            
            <RecognitionItemList
              v-if="activeFile"
              :items="activeFile.lineItems"
              :activeItemId="activeItemId"
              :highlightedItemIds="highlightedItemIds"
              @itemClick="handleItemClick"
              @itemUpdate="handleItemUpdate"
              @itemDelete="handleItemDelete"
              @itemConfirm="handleItemConfirm"
              @itemAdd="handleItemAdd"
              @editingChange="(val) => isEditing = val"
            />
            <div v-else class="flex items-center justify-center h-64 text-muted-foreground">
              請從左側選擇檔案
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
