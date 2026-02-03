<script setup lang="ts">
import { ref, computed } from 'vue';
import { Copy, Download, Check } from 'lucide-vue-next';
import type { ExportData } from '@/types/batch';

const props = defineProps<{
  exportData: ExportData;
}>();

const copied = ref(false);

const jsonString = computed(() => JSON.stringify(props.exportData, null, 2));

const handleCopy = async () => {
  try {
    await navigator.clipboard.writeText(jsonString.value);
    copied.value = true;
    setTimeout(() => copied.value = false, 2000);
    // Simple notification can be handled by parent or just omitted
  } catch (error) {
    console.error('Failed to copy', error);
  }
};

const handleDownload = () => {
  const blob = new Blob([jsonString.value], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ocr-result-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
</script>

<template>
  <div class="flex items-center gap-2">
    <button
      type="button"
      @click="handleCopy"
      class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 gap-2"
    >
      <Check v-if="copied" class="h-4 w-4" />
      <Copy v-else class="h-4 w-4" />
      {{ copied ? "已複製" : "Copy JSON" }}
    </button>
    <button
      type="button"
      @click="handleDownload"
      class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 gap-2"
    >
      <Download class="h-4 w-4" />
      Download JSON
    </button>
  </div>
</template>
