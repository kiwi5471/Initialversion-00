<script setup lang="ts">
import { X } from 'lucide-vue-next';
import { cn } from '@/lib/utils';
import type { UploadedFileItem } from '@/types/batch';

defineProps<{
  files: UploadedFileItem[];
}>();

const emit = defineEmits<{
  (e: 'removeFile', fileId: string): void;
}>();
</script>

<template>
  <div v-if="files.length === 0" class="text-center py-8 text-muted-foreground">
    尚未上傳任何檔案
  </div>
  <div v-else class="space-y-3">
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-medium text-foreground">已上傳檔案</h3>
      <span class="text-xs text-muted-foreground">
        共 {{ files.length }} 個檔案
      </span>
    </div>
    
    <div class="h-[300px] rounded-md border overflow-y-auto">
      <div class="p-2 space-y-1">
        <div
          v-for="file in files"
          :key="file.id"
          :class="cn(
            'flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/30',
            'hover:bg-muted/50 transition-colors'
          )"
        >
          <div class="w-10 h-10 rounded overflow-hidden bg-muted flex-shrink-0">
            <img
              :src="file.imageUrl"
              :alt="file.fileName"
              class="w-full h-full object-cover"
            />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium truncate">{{ file.fileName }}</p>
            <p v-if="file.pageNumber" class="text-xs text-muted-foreground">
              PDF 第 {{ file.pageNumber }} 頁
            </p>
          </div>
          <button
            type="button"
            @click="emit('removeFile', file.id)"
            class="h-8 w-8 inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground text-muted-foreground hover:text-destructive"
          >
            <X class="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
