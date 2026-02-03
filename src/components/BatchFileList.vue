<script setup lang="ts">
import { CheckCircle2, XCircle, Loader2, FileText, Eye } from 'lucide-vue-next';
import { cn } from '@/lib/utils';
import type { FileProcessingResult } from '@/types/batch';
import { computed } from 'vue';

const props = defineProps<{
  files: FileProcessingResult[];
  activeFileId: string | null;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: 'fileSelect', fileId: string): void;
}>();

const completedCount = computed(() => props.files.filter(f => f.status === 'success').length);
const totalItems = computed(() => props.files.reduce((sum, f) => sum + (f.lineItems?.length || 0), 0));

const handleSelect = (id: string) => {
  if (!props.disabled) {
    emit('fileSelect', id);
  }
};
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-medium text-foreground">檔案列表</h3>
      <span class="text-xs text-muted-foreground">
        已完成 {{ completedCount }}/{{ files.length }} · 共 {{ totalItems }} 筆項目
      </span>
    </div>
    
    <div class="h-[200px] rounded-md border overflow-y-auto">
      <div class="p-2 space-y-1">
        <button
          v-for="file in files"
          :key="file.id"
          @click="handleSelect(file.id)"
          :disabled="disabled"
          :class="cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors',
            disabled && 'opacity-50 cursor-not-allowed',
            activeFileId === file.id
              ? 'bg-primary/10 border border-primary/30'
              : !disabled && 'hover:bg-muted/50'
          )"
        >
          <!-- Status Icon -->
          <div v-if="file.status === 'pending'" class="w-4 h-4 rounded-full border-2 border-muted-foreground/50"></div>
          <Loader2 v-else-if="file.status === 'processing'" class="w-4 h-4 text-primary animate-spin" />
          <CheckCircle2 v-else-if="file.status === 'success'" class="w-4 h-4 text-green-500" />
          <XCircle v-else-if="file.status === 'error'" class="w-4 h-4 text-destructive" />

          <FileText class="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium truncate">{{ file.fileName }}</p>
            <template v-if="file.status === 'success'">
              <p class="text-xs text-muted-foreground flex items-center gap-2">
                <span>{{ file.lineItems.length }} 筆項目</span>
                <span class="text-green-600">
                  ✓ {{ file.lineItems.filter(item => item.confirmed).length }}/{{ file.lineItems.length }}
                </span>
              </p>
            </template>
            <p v-else-if="file.status === 'error'" class="text-xs text-destructive truncate">
              {{ file.error || '辨識失敗' }}
            </p>
          </div>
          <Eye v-if="file.status === 'success'" class="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  </div>
</template>
