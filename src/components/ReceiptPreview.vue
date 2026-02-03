<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  imageUrl: string;
  ocrBlocks: unknown[];
  activeBlockIds: string[];
  totalAmount: number;
}>();

const emit = defineEmits<{
  (e: 'blockClick', blockId: string): void;
  (e: 'emptyClick'): void;
}>();

const containerRef = ref<HTMLDivElement | null>(null);

const formatAmount = (amount: number) => {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const handleContainerClick = (e: MouseEvent) => {
  if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'IMG') {
    emit('emptyClick');
  }
};
</script>

<template>
  <div class="space-y-4 h-full flex flex-col">
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-semibold text-foreground">收據預覽</h3>
    </div>

    <div
      ref="containerRef"
      @click="handleContainerClick"
      class="relative flex-1 min-h-[400px] bg-muted rounded-lg overflow-hidden cursor-pointer"
    >
      <img
        :src="imageUrl"
        alt="Receipt"
        class="w-full h-full object-contain"
      />
    </div>

    <div class="p-4 bg-primary/10 rounded-lg">
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium text-muted-foreground">
          辨識總金額
        </span>
        <span class="text-xl font-bold text-primary">
          {{ formatAmount(totalAmount) }}
        </span>
      </div>
    </div>
  </div>
</template>
