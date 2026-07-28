<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import BrandMark from '../components/BrandMark.vue'
import {
  staffLogin,
  isStaffLoggedIn,
  isStaffAdmin,
  isStaffSales
} from '../lib/staffAuth'

const route = useRoute()
const router = useRouter()
const email = ref('')
const password = ref('')
const error = ref('')
const submitting = ref(false)

function redirectAfterLogin() {
  const next = typeof route.query.next === 'string' ? route.query.next : ''
  if (next.startsWith('/admin') && next !== '/admin/login') {
    if (isStaffSales() && !next.startsWith('/admin/sales')) {
      router.replace('/admin/sales')
      return
    }
    router.replace(next)
    return
  }
  router.replace(isStaffAdmin() ? '/admin' : '/admin/sales')
}

onMounted(() => {
  document.title = 'Staff login - tap-na'
  if (isStaffLoggedIn()) redirectAfterLogin()
})

async function onSubmit(e) {
  e.preventDefault()
  error.value = ''
  submitting.value = true
  try {
    const result = await staffLogin(email.value, password.value)
    if (!result.ok) {
      error.value = result.error || 'Login failed'
      return
    }
    redirectAfterLogin()
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="w-full max-w-md min-h-screen mx-auto flex flex-col relative z-10 px-6 pt-16 pb-28">
    <BrandMark size="sm" class="mb-4" />
    <h1 class="text-2xl font-bold tracking-tight">Staff login</h1>
    <p class="text-gray-400 text-sm mt-1 mb-6">
      Admin and sales access to the control panel
    </p>

    <form class="space-y-4" @submit="onSubmit">
      <div>
        <label class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Email</label>
        <div class="field-shell">
          <input
            v-model="email"
            type="text"
            autocomplete="username"
            class="field-input"
            required
            placeholder="admin@01"
          >
        </div>
      </div>
      <div>
        <label class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Password</label>
        <div class="field-shell">
          <input
            v-model="password"
            type="password"
            autocomplete="current-password"
            class="field-input"
            required
            placeholder="••••••••"
          >
        </div>
      </div>

      <p v-if="error" class="text-sm text-red-400">{{ error }}</p>

      <button
        type="submit"
        class="w-full py-3.5 rounded-full bg-white text-black text-sm font-bold disabled:opacity-60"
        :disabled="submitting"
      >
        {{ submitting ? 'Signing in…' : 'Sign in' }}
      </button>
    </form>

    <p class="text-xs text-gray-500 mt-6">
      Card owners use
      <RouterLink to="/login" class="text-gray-300 underline underline-offset-2">profile login</RouterLink>
      instead.
    </p>
  </main>
</template>
