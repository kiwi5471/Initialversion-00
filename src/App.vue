<script setup lang="ts">
// No need to import RouterView/RouterLink as they are global
</script>

<template>
  <div class="min-h-screen bg-gray-100 text-gray-900 font-sans">
    <div class="bg-blue-600 text-white p-4 shadow-md">
      <div class="container mx-auto flex justify-between items-center">
        <h1 class="text-xl font-bold">憑證辨識系統 (Vue 版)</h1>
        <nav class="flex gap-4">
          <router-link to="/" class="hover:underline" active-class="font-bold border-b-2">
            首頁
          </router-link>
          <router-link to="/recognition" class="hover:underline" active-class="font-bold border-b-2">
            進階辨識
          </router-link>
        </nav>
      </div>
    </div>
    
    <main class="container mx-auto p-4">
      <div v-if="!$route" class="p-4 text-center">Router Loading...</div>
      <router-view />
    </main>
  </div>
</template>

<style>
body {
  margin: 0;
  padding: 0;
}
</style>
