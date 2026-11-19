<script setup>
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { isStaffLoggedIn } from '../lib/staffAuth'
import { staffHomePath } from '../lib/authRedirect'

const route = useRoute()
const router = useRouter()

onMounted(() => {
  if (isStaffLoggedIn()) {
    router.replace(staffHomePath())
    return
  }
  const q = { ...route.query }
  router.replace({ path: '/login', query: q })
})
</script>

<template>
  <main class="min-h-screen flex items-center justify-center px-6">
    <p class="text-sm text-gray-400">Redirecting to login…</p>
  </main>
</template>