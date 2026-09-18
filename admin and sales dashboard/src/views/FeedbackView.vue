<script setup>
import { onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

onMounted(() => {
  router.replace({ path: '/business', query: { ...route.query } })
})
</script>

<template>
  <main class="min-h-screen flex items-center justify-center px-6">
    <p class="text-sm text-gray-400">Opening feedback…</p>
  </main>
</template>