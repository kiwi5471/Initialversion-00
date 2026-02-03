<script setup lang="ts">
import { ref } from 'vue';
import { Loader2, Image as ImageIcon, FileText, Upload } from 'lucide-vue-next';
import { cn } from '@/lib/utils';
import { isPDF, isImage, convertPDFToImages } from '@/lib/pdfUtils';
import type { UploadedFileItem } from '@/types/batch';

const props = defineProps<{
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: 'filesAdd', files: UploadedFileItem[]): void;
}>();

const isDragOver = ref(false);
const isConverting = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);

const processFiles = async (files: File[]) => {
  if (files.length === 0) return;
  
  isConverting.value = true;
  const uploadedFiles: UploadedFileItem[] = [];

  console.log('[Upload] Processing', files.length, 'files');

  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log('[Upload] Processing file:', file.name, 'type:', file.type);
      
      if (isPDF(file)) {
        console.log('[Upload] Detected PDF, converting...');
        const pages = await convertPDFToImages(file);
        console.log('[Upload] PDF converted, pages:', pages.length);
        pages.forEach((page) => {
          uploadedFiles.push({
            id: `${file.name}-page-${page.pageNumber}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            fileName: `${file.name} (第 ${page.pageNumber} 頁)`,
            imageUrl: page.imageUrl,
            file: page.file,
            pageNumber: page.pageNumber,
          });
        });
      } else if (isImage(file)) {
        console.log('[Upload] Detected image');
        const url = URL.createObjectURL(file);
        uploadedFiles.push({
          id: `${file.name}-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
          fileName: file.name,
          imageUrl: url,
          file: file,
        });
      }
    }

    console.log('[Upload] Total files processed:', uploadedFiles.length);
    
    if (uploadedFiles.length > 0) {
      emit('filesAdd', uploadedFiles);
    }
  } catch (error) {
    console.error('[Upload] Error processing files:', error);
  } finally {
    isConverting.value = false;
  }
};

const handleDrop = (e: DragEvent) => {
  e.preventDefault();
  isDragOver.value = false;
  if (!props.disabled && e.dataTransfer?.files.length) {
    processFiles(Array.from(e.dataTransfer.files));
  }
};

const handleDragOver = (e: DragEvent) => {
  e.preventDefault();
  isDragOver.value = true;
};

const handleDragLeave = (e: DragEvent) => {
  e.preventDefault();
  isDragOver.value = false;
};

const handleInputChange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files?.length) {
    const files = Array.from(target.files);
    console.log('[Upload] Files selected:', files.length, files.map(f => f.name));
    target.value = '';
    processFiles(files);
  }
};

const handleButtonClick = () => {
  fileInputRef.value?.click();
};
</script>

<template>
  <div
    @drop="handleDrop"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    :class="cn(
      'relative border-2 border-dashed rounded-xl p-8 text-center transition-all',
      isDragOver
        ? 'border-primary bg-primary/5'
        : 'border-muted-foreground/25 hover:border-primary/50',
      (isConverting || disabled) && 'pointer-events-none opacity-60'
    )"
  >
    <input
      ref="fileInputRef"
      type="file"
      accept="image/*,.pdf,application/pdf"
      multiple
      @change="handleInputChange"
      class="hidden"
      :disabled="isConverting || disabled"
    />

    <div class="flex flex-col items-center gap-4">
      <template v-if="isConverting">
        <Loader2 class="w-10 h-10 text-primary animate-spin" />
        <p class="text-sm font-medium text-foreground">
          PDF 轉換中...
        </p>
      </template>
      <template v-else>
        <div class="flex items-center justify-center gap-3">
          <div class="flex items-center justify-center w-14 h-14 rounded-full bg-primary/10">
            <ImageIcon class="w-7 h-7 text-primary" />
          </div>
          <div class="flex items-center justify-center w-14 h-14 rounded-full bg-primary/10">
            <FileText class="w-7 h-7 text-primary" />
          </div>
        </div>

        <div class="space-y-2">
          <h3 class="text-xl font-bold tracking-tight">拖放憑證或點擊上傳</h3>
          <p class="text-sm text-muted-foreground max-w-xs mx-auto">
            支援多張圖檔 (JPG, PNG) 或 PDF 檔案
            <br />
            (PDF 將自動拆分為分頁圖片進行辨識)
          </p>
        </div>

        <button
          type="button"
          @click="handleButtonClick"
          :disabled="disabled"
          class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 mt-2 gap-2"
        >
          <Upload class="w-4 h-4" />
          選擇檔案
        </button>
      </template>
    </div>
  </div>
</template>
