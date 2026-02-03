<script setup lang="ts">
import { ref } from 'vue'
import ExpenseTable from '../components/ExpenseTable.vue'
import FileUploader from '../components/FileUploader.vue'
import type { ExpenseEntry } from '../types/invoice'
import { Loader2, FileCheck } from 'lucide-vue-next'

const isProcessing = ref(false)
const progress = ref(0)
const entries = ref<ExpenseEntry[]>([])

const handleFilesProcessed = (newEntries: ExpenseEntry[]) => {
  entries.value = [...entries.value, ...newEntries]
}
</script>

<template>
  <div class="container mx-auto py-8 space-y-8">
    <div class="space-y-2">
      <h1 class="text-3xl font-bold">
        票據憑證辨識與出差精算系統
      </h1>
      <p class="text-muted-foreground">
        上傳票據憑證，自動辨識財務資訊，快速產生出差精算表
      </p>
    </div>

    <!-- 上傳組件 -->
    <div class="p-6 shadow-lg bg-card rounded-lg border">
      <FileUploader 
        v-model:isProcessing="isProcessing"
        @filesProcessed="handleFilesProcessed"
      />
      
      <div v-if="isProcessing" class="mt-4 space-y-2">
        <div class="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 class="h-4 w-4 animate-spin" />
          <span>處理中...</span>
        </div>
        <div class="h-2 w-full bg-secondary rounded-full overflow-hidden">
          <div :style="{ width: progress + '%' }" class="h-full bg-primary transition-all duration-300"></div>
        </div>
      </div>
    </div>

    <!-- 資料表格組件 -->
    <div class="p-6 shadow-lg bg-card rounded-lg border">
      <ExpenseTable :entries="entries" @update:entries="entries = $event" />
    </div>

    <!-- 成功提示 -->
    <div v-if="entries.length > 0" class="p-4 bg-green-500/10 border border-green-500/50 rounded-lg">
      <div class="flex items-center gap-2 text-green-600">
        <FileCheck class="h-5 w-5" />
        <p class="text-sm font-medium">
          已辨識 {{ entries.length }} 筆資料，可進行編輯或匯出
        </p>
      </div>
    </div>
  </div>
</template>
