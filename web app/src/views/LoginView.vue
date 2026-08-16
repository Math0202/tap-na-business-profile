<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import BrandMark from '../components/BrandMark.vue'
import {
  isLoggedIn,
  login,
  saveProfile,
  markLoggedIn,
  hashPassword,
  loadProfile,
  isTableBusiness
} from '../lib/profileStore'
import { apiForgotPassword, apiLogin, setApiToken } from '../lib/api'
import {
  isStaffLoggedIn,
  staffLogin
} from '../lib/staffAuth'
import { resolvePostLoginPath, profileHomePath, staffHomePath } from '../lib/authRedirect'
import { hydrateLinkedCardsFromApi } from '../lib/cardLinkStore'

const route = useRoute()
const router = useRouter()
const identifier = ref('')
const password = ref('')
const error = ref('')
const success = ref('')
const submitting = ref(false)
const resetMode = ref(false)

function currentHome() {
  if (isStaffLoggedIn()) return staffHomePath()
  if (isLoggedIn()) {
    const p = loadProfile()
    return profileHomePath(isTableBusiness(p) ? 'table' : 'personal')
  }
  return '/profile'
}

onMounted(() => {
  document.title = 'Login - tap-na'
  if (typeof route.query.email === 'string' && route.query.email) {
    identifier.value = route.query.email
  }
  if (route.query.reset === '1') {
    resetMode.value = true
  }
  if ((isLoggedIn() || isStaffLoggedIn()) && route.query.claimed !== '1') {
    router.replace(currentHome())
  }
})

function applyProfileSession(p, passwordHash, token) {
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
    showBooking: p.showBooking !== false,
    catalogItems: Array.isArray(p.catalogItems) ? p.catalogItems : [],
    checkinForm: p.checkinForm && typeof p.checkinForm === 'object' ? p.checkinForm : {},
    feedbackForm: p.feedbackForm && typeof p.feedbackForm === 'object' ? p.feedbackForm : {},
    checkInUrl: p.checkInUrl,
    feedbackUrl: p.feedbackUrl,
    linkOrder: Array.isArray(p.linkOrder) ? p.linkOrder : [],
    avatar: p.avatar || '',
    logo: p.logo || '',
    video: p.video || '',
    disabled: !!p.disabled,
    loginEmail: p.email || identifier.value.trim(),
    loginPhone: p.phone || '',
    passwordHash,
    remoteProfileId: p.id,
    shareSlug: p.shareSlug || '',
    personalType: p.personalType || p.personal_type || ''
  })
  markLoggedIn()
  if (token) setApiToken(token)
  if (p.id && Array.isArray(p.cards) && p.cards.length) {
    hydrateLinkedCardsFromApi(p.id, p.cards)
  }
}

async function onSubmit(e) {
  e.preventDefault()
  error.value = ''
  success.value = ''
  submitting.value = true
  try {
    const id = identifier.value.trim()
    const next = typeof route.query.next === 'string' ? route.query.next : ''

    if (resetMode.value) {
      if (!id.includes('@')) {
        error.value = 'Enter the email for your account.'
        return
      }
      const res = await apiForgotPassword({ identifier: id, email: id })
      if (!res.ok) {
        error.value = res.error || 'Could not send reset email.'
        return
      }
      success.value =
        res.data?.message ||
        'If an account exists for that email, we sent a temporary password. Log in, then change it from Edit profile.'
      resetMode.value = false
      return
    }

    const pw = password.value
    const passwordHash = hashPassword(pw)

    // 1) Card owner (personal / business)
    const remote = await apiLogin({ identifier: id, passwordHash })
    if (remote.ok && remote.data?.profile) {
      const p = remote.data.profile
      applyProfileSession(p, passwordHash, remote.data.token)
      router.push(resolvePostLoginPath('profile', { cardType: p.cardType, next }))
      return
    }

    // 2) Staff (admin / sales) — email + password via Supabase
    if (id.includes('@') && pw) {
      const staff = await staffLogin(id, pw)
      if (staff.ok) {
        router.push(resolvePostLoginPath('staff', { next }))
        return
      }
    }

    // 3) Offline / local profile fallback
    const result = login(id, pw)
    if (result.ok) {
      const p = loadProfile()
      router.push(
        resolvePostLoginPath('profile', {
          cardType: isTableBusiness(p) ? 'table' : 'personal',
          next
        })
      )
      return
    }

    error.value =
      remote.error ||
      result.error ||
      'Login failed. Check your email/phone and password.'
  } finally {
    submitting.value = false
  }
}

function openReset() {
  error.value = ''
  success.value = ''
  resetMode.value = true
}

function cancelReset() {
  error.value = ''
  success.value = ''
  resetMode.value = false
}
</script>

<template>
  <main class="w-full max-w-md min-h-screen mx-auto flex flex-col relative z-10 px-6 pt-16 pb-28">
    <BrandMark size="sm" class="mb-4" />
    <h1 class="text-2xl font-bold tracking-tight">{{ resetMode ? 'Reset password' : 'Login' }}</h1>
    <p class="text-gray-400 text-sm mt-1 mb-6">
      <template v-if="resetMode">
        Enter your account email. We’ll send a temporary password so you can log in and change it in Edit profile.
      </template>
      <template v-else-if="route.query.claimed === '1'">
        Your card is claimed. Log in to finish setting up your profile.
      </template>
      <template v-else>
        Sign in to your card, business dashboard, or staff account.
      </template>
    </p>

    <div v-if="route.query.claimed === '1' && !resetMode" class="card-item-bg rounded-2xl p-4 mb-6 text-sm text-gray-300">
      Card claimed successfully. Sign in with the email and password you just created to edit your profile.
    </div>

    <form class="space-y-4" @submit="onSubmit">
      <div>
        <label class="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5" for="login-id">
          {{ resetMode ? 'Email' : 'Email or phone' }}
        </label>
        <div class="field-shell">
          <span class="material-symbols-outlined text-gray-400 text-[20px]">person</span>
          <input
            id="login-id"
            v-model="identifier"
            type="text"
            class="field-input"
            :placeholder="resetMode ? 'you@example.com' : 'you@example.com'"
            autocomplete="username"
            required
          />
        </div>
      </div>
      <div v-if="!resetMode">
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
      <p v-if="error" class="text-xs text-red-400 min-h-[1rem]">{{ error }}</p>
      <p v-else-if="success" class="text-xs text-emerald-400 min-h-[1rem]">{{ success }}</p>
      <p v-else class="text-xs min-h-[1rem]" />
      <button
        type="submit"
        class="w-full py-4 rounded-full bg-white text-black font-bold text-base hover:bg-gray-200 transition-colors disabled:opacity-50"
        :disabled="submitting"
      >
        <template v-if="resetMode">{{ submitting ? 'Sending…' : 'Send temporary password' }}</template>
        <template v-else>{{ submitting ? 'Signing in…' : 'Login' }}</template>
      </button>
    </form>

    <div class="mt-4 text-center">
      <button
        v-if="!resetMode"
        type="button"
        class="text-sm text-gray-400 hover:text-white underline underline-offset-2"
        @click="openReset"
      >
        Reset password
      </button>
      <button
        v-else
        type="button"
        class="text-sm text-gray-400 hover:text-white underline underline-offset-2"
        @click="cancelReset"
      >
        Back to login
      </button>
    </div>

    <div class="mt-8 card-item-bg rounded-2xl p-4 space-y-3">
      <p class="text-sm font-semibold">New here?</p>
      <p class="text-xs text-gray-400 leading-relaxed">
        Scan a blank card QR to create an account, or
        <RouterLink to="/signup" class="underline underline-offset-2 font-semibold text-gray-300">sign up</RouterLink>
        to browse cards.
      </p>
    </div>
  </main>
</template>
