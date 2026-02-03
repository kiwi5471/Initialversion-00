<script setup lang="ts">
import { useRoute } from 'vue-router';
const route = useRoute();
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-100">
    <div class="text-center">
      <h1 class="text-4xl font-bold mb-4">404</h1>
      <p class="text-xl text-gray-600 mb-4">Oops! Page not found</p>
      <p class="text-gray-500 mb-8">The page {{ route.path }} does not exist.</p>
      <router-link to="/" class="text-blue-500 hover:text-blue-700 underline">
        Return to Home
      </router-link>
    </div>
  </div>
</template>
