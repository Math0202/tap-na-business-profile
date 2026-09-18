<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import BrandMark from '../components/BrandMark.vue'

const SIGNUP_KEY = 'tapna_signup_lead'
const route = useRoute()
const router = useRouter()

const name = ref('')
const cell = ref('')
const email = ref('')
const error = ref('')

const isTable = computed(() => route.query.type === 'table')

onMounted(() => {
  document.title = isTable.value ? 'Sign up for my business - tap-na' : 'Sign up - tap-na'
  try {
    const existing = JSON.parse(sessionStorage.getItem(SIGNUP_KEY) || 'null')
    if (existing) {
      if (existing.name) name.value = existing.name
      if (existing.cell) cell.value = existing.cell
      if (existing.email) email.value = existing.email
    }
  } catch { /* ignore */ }
})

function onSubmit(e) {
  e.preventDefault()
  const n = name.value.trim()
  const c = cell.value.trim()
  const em = email.value.trim()

  if (!n || !c || !em) {
    error.value = 'Please fill in name, cell, and email.'
    return
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
    error.value = 'Enter a valid email address.'
    return
  }
  if (c.replace(/[^\d]/g, '').length < 8) {
    error.value = 'Enter a valid cell number.'
    return
  }

  const type = isTable.value ? 'table' : 'personal'
  sessionStorage.setItem(SIGNUP_KEY, JSON.stringify({ name: n, cell: c, email: em, type, at: Date.now() }))
  router.push(type === 'table' ? { path: '/table', query: { signup: '1' } } : { path: '/cards', query: { signup: '1' } })
}
</script>

<template>
  <main class="w-full max-w-md min-h-screen mx-auto flex flex-col relative z-10 px-6 pt-16 pb-28">
    <BrandMark size="sm" class="mb-4" />
    <h1 class="text-2xl font-bold tracking-tight">
      {{ isTable ? 'Sign up for my business' : 'Sign up' }}
    </h1>
    <p class="text-gray-400 text-sm mt-1 mb-2">
      {{ isTable ? 'Tell us how to reach your venue' : 'Tell us how to reach you' }}
    </p>
    <p class="text-xs text-gray-500 mb-8 leading-relaxed">
      {{
        isTable
          ? 'An NFC Table card is required for your venue profile. After this, you’ll choose a Table card to order.'
          : 'An NFC card is required to create your account. After this, you’ll choose a card to order.'
      }}
    </p>

    <form class="space-y-4" @submit="onSubmit">
      <div>
        <label class="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5" for="signup-name">
          Full name
        </label>
        <div class="field-shell">
          <span class="material-symbols-outlined text-gray-400 text-[20px]">badge</span>
          <input id="signup-name" v-model="name" type="text" class="field-input" placeholder="Your full name" autocomplete="name" required />
        </div>
      </div>
      <div>
        <label class="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5" for="signup-cell">
          Cell number
        </label>
        <div class="field-shell">
          <span class="material-symbols-outlined text-gray-400 text-[20px]">smartphone</span>
          <input id="signup-cell" v-model="cell" type="tel" class="field-input" placeholder="+264 81 000 0000" autocomplete="tel" inputmode="tel" required />
        </div>
      </div>
      <div>
        <label class="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5" for="signup-email">
          Email
        </label>
        <div class="field-shell">
          <span class="material-symbols-outlined text-gray-400 text-[20px]">mail</span>
          <input id="signup-email" v-model="email" type="email" class="field-input" placeholder="you@example.com" autocomplete="email" inputmode="email" required />
        </div>
      </div>
      <p class="text-xs text-red-400 min-h-[1rem]">{{ error }}</p>
      <button type="submit" class="w-full py-4 rounded-full bg-white text-black font-bold text-base hover:bg-gray-200 transition-colors">
        {{ isTable ? 'Continue to Table cards' : 'Continue to cards' }}
      </button>
    </form>

    <p class="mt-8 text-center text-sm text-gray-500">
      Already have an account?
      <RouterLink to="/login" class="font-semibold underline underline-offset-2">Login</RouterLink>
    </p>
  </main>
</template>
