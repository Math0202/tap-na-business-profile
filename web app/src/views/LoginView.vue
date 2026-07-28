<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import BrandMark from '../components/BrandMark.vue'
import {
  isLoggedIn,
  login,
  saveProfile,
  markLoggedIn,
  hashPassword
} from '../lib/profileStore'
import { apiLogin, setApiToken } from '../lib/api'

const route = useRoute()
const router = useRouter()
const identifier = ref('')
const password = ref('')
const error = ref('')
const submitting = ref(false)

onMounted(() => {
  document.title = 'Login - tap-na'
  if (typeof route.query.email === 'string' && route.query.email) {
    identifier.value = route.query.email
  }
  if (isLoggedIn() && route.query.claimed !== '1') router.replace('/profile')
})

async function onSubmit(e) {
  e.preventDefault()
  error.value = ''
  submitting.value = true
  try {
    const id = identifier.value.trim()
    const pw = password.value
    const passwordHash = hashPassword(pw)

    // Prefer the live API (Supabase via Worker)
    const remote = await apiLogin({ identifier: id, passwordHash })
    if (remote.ok && remote.data?.profile) {
      const p = remote.data.profile
      saveProfile({
        cardType: p.cardType,
        name: p.name,
        title: p.title,
        company: p.company,
        phone: p.phone,
        email: p.email,
        whatsapp: p.whatsapp,
        linkedin: p.linkedin,
        youtube: p.youtube,
        x: p.x,
        instagram: p.instagram,
        tiktok: p.tiktok,
        website: p.website,
        address: p.address,
        menuUrl: p.menuUrl,
        menuPdf: p.menuPdf || '',
        menuImages: Array.isArray(p.menuImages) ? p.menuImages : [],
        googleReview: p.googleReview,
        showPhone: !!p.showPhone,
        showEmail: !!p.showEmail,
        showCheckin: !!p.showCheckin,
        showFeedback: !!p.showFeedback,
        checkInUrl: p.checkInUrl,
        feedbackUrl: p.feedbackUrl,
        linkOrder: Array.isArray(p.linkOrder) ? p.linkOrder : [],
        avatar: p.avatar || '',
        logo: p.logo || '',
        video: p.video || '',
        disabled: !!p.disabled,
        loginEmail: p.email || id,
        loginPhone: p.phone || '',
        passwordHash,
        remoteProfileId: p.id,
        shareSlug: p.shareSlug || ''
      })
      markLoggedIn()
      if (remote.data.token) setApiToken(remote.data.token)
      const next = typeof route.query.next === 'string' ? route.query.next : '/profile'
      router.push(next)
      return
    }

    // Offline / local fallback
    const result = login(id, pw)
    if (!result.ok) {
      error.value = remote.error || result.error || 'Login failed'
      return
    }
    const next = typeof route.query.next === 'string' ? route.query.next : '/profile'
    router.push(next)
  } finally {
    submitting.value = false
  }
}

</script>

<template>
  <main class="w-full max-w-md min-h-screen mx-auto flex flex-col relative z-10 px-6 pt-16 pb-28">
    <BrandMark size="sm" class="mb-4" />
    <h1 class="text-2xl font-bold tracking-tight">Login</h1>
    <p class="text-gray-400 text-sm mt-1 mb-6">
      {{ route.query.claimed === '1'
        ? 'Your card is claimed. Log in to finish setting up your profile.'
        : 'Access your digital card' }}
    </p>

    <div v-if="route.query.claimed === '1'" class="card-item-bg rounded-2xl p-4 mb-6 text-sm text-gray-300">
      Card claimed successfully. Sign in with the email and password you just created to edit your profile.
    </div>

    <form class="space-y-4" @submit="onSubmit">
      <div>
        <label class="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5" for="login-id">
          Email or phone
        </label>
        <div class="field-shell">
          <span class="material-symbols-outlined text-gray-400 text-[20px]">person</span>
          <input
            id="login-id"
            v-model="identifier"
            type="text"
            class="field-input"
            placeholder="you@example.com"
            autocomplete="username"
            required
          />
        </div>
      </div>
      <div>
        <label class="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5" for="login-password">
          Password
        </label>
        <div class="field-shell">
          <span class="material-symbols-outlined text-gray-400 text-[20px]">lock</span>
          <input
            id="login-password"
            v-model="password"
            type="password"
            class="field-input"
            placeholder="Your password"
            autocomplete="current-password"
          />
        </div>
      </div>
      <p class="text-xs text-red-400 min-h-[1rem]">{{ error }}</p>
      <button
        type="submit"
        class="w-full py-4 rounded-full bg-white text-black font-bold text-base hover:bg-gray-200 transition-colors disabled:opacity-50"
        :disabled="submitting"
      >
        {{ submitting ? 'Signing in…' : 'Login' }}
      </button>
    </form>

    <div class="mt-8 card-item-bg rounded-2xl p-4">
      <p class="text-sm font-semibold">New here?</p>
      <p class="text-xs text-gray-400 mt-1 leading-relaxed">
        Scan a blank card QR (try SetupA) to create an account, or
        <RouterLink to="/signup" class="underline underline-offset-2 font-semibold text-gray-300">sign up</RouterLink>
        to browse cards.
      </p>
    </div>
  </main>
</template>
