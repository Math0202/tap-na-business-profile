<script setup>
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { isStaffLoggedIn } from '../lib/staffAuth'
import { goToLogin, staffHomePath } from '../lib/authRedirect'

const route = useRoute()
const router = useRouter()

onMounted(() => {
  if (isStaffLoggedIn()) {
    router.replace(staffHomePath())
    return
  }
  goToLogin(typeof route.query.next === 'string' ? route.query.next : '')
})
</script>

<template>
  <main class="min-h-screen flex items-center justify-center px-6">
    <p class="text-sm text-gray-400">Redirecting to login…</p>
  </main>
</template>