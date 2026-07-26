<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import {
  getCardTapAction,
  extractSerialFromScan,
  kindLabel,
  kindIcon,
  cardPublicUrl,
  linkCardToProfile
} from '../lib/cardLinkStore'
import {
  setViewedProfile,
  loadProfile,
  saveProfile,
  hashPassword,
  markLoggedIn,
  logout
} from '../lib/profileStore'
import { apiResolveCard, apiLogCardOpen, apiSignup, setApiToken } from '../lib/api'
import { LOCAL_ID } from '../lib/adminStore'
import { hideFloatingChrome } from '../lib/uiChrome'
import BusinessView from './BusinessView.vue'
import MyCardView from './MyCardView.vue'

const route = useRoute()
const router = useRouter()

// mode: '' (loading) | 'linked' | 'unlinked' | 'disabled' | 'missing'
const mode = ref('')
const cardKind = ref('table')
const linkedType = ref('table')

const firstName = ref('')
const surname = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const submitting = ref(false)

const serial = computed(() => {
  const fromParam = route.params.serial
  return extractSerialFromScan(String(fromParam || '')) || String(fromParam || '')
})

const isPersonalCard = computed(() => cardKind.value === 'personal')

const publicUrl = computed(() => cardPublicUrl(serial.value, undefined, { kind: cardKind.value }))

/** Claiming a card always starts a fresh account for that slug — kick any other session out. */
function forceClaimLogout() {
  logout()
  setApiToken('')
}

async function createProfile(e) {
  e.preventDefault()
  error.value = ''
  forceClaimLogout()

  const given = firstName.value.trim()
  const family = surname.value.trim()
  const loginEmail = email.value.trim().toLowerCase()
  const fullName = [given, family].filter(Boolean).join(' ')

  if (isPersonalCard.value) {
    if (!given) {
      error.value = 'Enter your name.'
      return
    }
    if (!family) {
      error.value = 'Enter your surname.'
      return
    }
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail)) {
    error.value = 'Enter a valid email address.'
    return
  }
  if (password.value.length < 6) {
    error.value = 'Password must be at least 6 characters.'
    return
  }
  if (password.value !== confirmPassword.value) {
    error.value = 'Passwords do not match.'
    return
  }

  submitting.value = true
  try {
    const cardType = isPersonalCard.value ? 'personal' : 'table'
    const passwordHash = hashPassword(password.value)
    const response = await apiSignup({
      email: loginEmail,
      loginEmail,
      passwordHash,
      cardType,
      slug: serial.value,
      name: fullName || loginEmail
    })

    if (!response.ok || !response.data?.profile?.id) {
      error.value = response.error || 'Could not create your profile. Please try again.'
      return
    }

    const profile = response.data.profile
    linkCardToProfile(serial.value, {
      profileId: LOCAL_ID,
      profileName: fullName || loginEmail
    })

    // Log into THIS card's new account (never keep a previous session)
    saveProfile({
      cardType,
      name: fullName,
      title: '',
      company: '',
      phone: '',
      email: loginEmail,
      whatsapp: '',
      linkedin: '',
      youtube: '',
      x: '',
      instagram: '',
      tiktok: '',
      website: '',
      address: '',
      menuUrl: '',
      googleReview: '',
      checkInUrl: '',
      feedbackUrl: '',
      avatar: '',
      logo: '',
      video: '',
      loginEmail,
      loginPhone: '',
      passwordHash,
      remoteProfileId: profile.id,
      shareSlug: serial.value
    })
    if (response.data.token) setApiToken(response.data.token)
    markLoggedIn()
    router.replace('/profile')
  } finally {
    submitting.value = false
  }
}

function setClaimChrome(active) {
  hideFloatingChrome.value = !!active
  document.body.classList.toggle('card-claim-ui', !!active)
}

onMounted(async () => {
  const via = String(route.query.via || '').toLowerCase()

  const remote = await apiResolveCard(serial.value)
  if (remote?.ok && remote.card) {
    apiLogCardOpen(serial.value, via).catch?.(() => {})
    cardKind.value = remote.card.kind === 'personal' ? 'personal' : 'table'

    if (remote.card.status === 'linked' && remote.profile) {
      linkedType.value = remote.profile.cardType === 'personal' ? 'personal' : 'table'
      if (remote.profile.disabled) {
        mode.value = 'disabled'
        setClaimChrome(true)
        return
      }
      setViewedProfile({ ...remote.profile, shareSlug: remote.card.slug || serial.value })
      try {
        const mine = loadProfile()
        if (
          remote.profile.id &&
          (mine.remoteProfileId === remote.profile.id || !mine.remoteProfileId) &&
          !mine.shareSlug
        ) {
          saveProfile({ shareSlug: remote.card.slug || serial.value })
        }
      } catch {
        /* ignore */
      }
      mode.value = 'linked'
      setClaimChrome(false)
      return
    }

    // Unlinked: never claim onto a currently logged-in account
    forceClaimLogout()
    mode.value = 'unlinked'
    setClaimChrome(true)
    return
  }

  const action = getCardTapAction(serial.value)
  cardKind.value = action.card?.kind === 'personal' ? 'personal' : 'table'
  if (action.ok && action.status === 'linked') {
    const mine = loadProfile()
    linkedType.value = mine.cardType === 'personal' ? 'personal' : 'table'
    setViewedProfile({ ...mine, shareSlug: serial.value })
    mode.value = 'linked'
    setClaimChrome(false)
    return
  }
  if (action.status === 'unlinked') {
    forceClaimLogout()
    mode.value = 'unlinked'
    setClaimChrome(true)
    return
  }
  mode.value = 'missing'
  setClaimChrome(true)
})

onUnmounted(() => setClaimChrome(false))
</script>

<template>
  <div v-if="!mode" class="min-h-screen flex items-center justify-center px-5">
    <div class="text-sm text-gray-400">Opening card…</div>
  </div>

  <!-- Linked & active: render the owner's profile in place (never redirect) -->
  <BusinessView v-else-if="mode === 'linked' && linkedType === 'table'" />
  <MyCardView v-else-if="mode === 'linked'" />

  <!-- Not found / disabled / claim -->
  <div v-else class="min-h-screen flex flex-col items-center justify-center px-5">
    <div class="w-full max-w-md card-item-bg rounded-3xl p-6 text-center space-y-4">
      <div class="w-14 h-14 mx-auto rounded-full bg-white/10 flex items-center justify-center">
        <span class="material-symbols-outlined text-[28px]">
          {{ mode === 'disabled' ? 'lock' : mode === 'missing' ? 'search_off' : kindIcon(cardKind) }}
        </span>
      </div>

      <div v-if="mode === 'missing'">
        <h1 class="text-xl font-bold">Profile not found</h1>
        <p class="text-sm text-gray-400 mt-2">
          This card code doesn’t match any profile. Check the code and try again.
        </p>
      </div>

      <div v-else-if="mode === 'disabled'">
        <h1 class="text-xl font-bold">Disabled by owner</h1>
        <p class="text-sm text-gray-400 mt-2">
          This profile has been disabled by its owner and isn’t available right now.
        </p>
      </div>

      <template v-else>
        <div>
          <h1 class="text-xl font-bold">Claim card</h1>
          <p class="text-sm text-gray-400 mt-2">
            <template v-if="isPersonalCard">
              Enter your name, surname, email and password to claim this card. Each card gets its own profile.
            </template>
            <template v-else>
              Create your profile with an email and password to activate this card. Each card gets its own profile.
            </template>
          </p>
          <p class="text-xs text-gray-500 mt-1">{{ kindLabel(cardKind) }}</p>
        </div>

        <form class="text-left space-y-3" @submit="createProfile">
          <template v-if="isPersonalCard">
            <div>
              <label class="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5" for="claim-first">
                Name
              </label>
              <div class="field-shell">
                <span class="material-symbols-outlined text-gray-400 text-[20px]">person</span>
                <input
                  id="claim-first"
                  v-model="firstName"
                  type="text"
                  class="field-input"
                  placeholder="First name"
                  autocomplete="given-name"
                  required
                >
              </div>
            </div>
            <div>
              <label class="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5" for="claim-surname">
                Surname
              </label>
              <div class="field-shell">
                <span class="material-symbols-outlined text-gray-400 text-[20px]">badge</span>
                <input
                  id="claim-surname"
                  v-model="surname"
                  type="text"
                  class="field-input"
                  placeholder="Last name"
                  autocomplete="family-name"
                  required
                >
              </div>
            </div>
          </template>

          <div>
            <label class="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5" for="claim-email">
              Email
            </label>
            <div class="field-shell">
              <span class="material-symbols-outlined text-gray-400 text-[20px]">mail</span>
              <input
                id="claim-email"
                v-model="email"
                type="email"
                class="field-input"
                placeholder="you@example.com"
                autocomplete="email"
                required
              >
            </div>
          </div>
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5" for="claim-password">
              Password
            </label>
            <div class="field-shell">
              <span class="material-symbols-outlined text-gray-400 text-[20px]">lock</span>
              <input
                id="claim-password"
                v-model="password"
                type="password"
                class="field-input"
                placeholder="Minimum 6 characters"
                autocomplete="new-password"
                minlength="6"
                required
              >
            </div>
          </div>
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5" for="claim-confirm">
              Confirm password
            </label>
            <div class="field-shell">
              <span class="material-symbols-outlined text-gray-400 text-[20px]">lock</span>
              <input
                id="claim-confirm"
                v-model="confirmPassword"
                type="password"
                class="field-input"
                placeholder="Repeat password"
                autocomplete="new-password"
                required
              >
            </div>
          </div>
          <p class="text-xs text-red-400 min-h-[1rem]">{{ error }}</p>
          <button
            type="submit"
            class="claim-cta w-full py-4 rounded-2xl bg-white text-black text-base font-bold tracking-wide shadow-lg hover:bg-gray-100 active:scale-[0.98] transition disabled:opacity-50"
            :disabled="submitting"
          >
            {{ submitting ? 'Claiming card…' : 'Claim this card' }}
          </button>
          <p class="text-center text-xs text-gray-500">
            Already claimed this card?
            <RouterLink
              :to="{ path: '/login', query: { email: email || undefined, next: '/profile' } }"
              class="font-semibold underline underline-offset-2 text-gray-300"
            >
              Login
            </RouterLink>
          </p>
        </form>

      </template>

      <p v-if="serial" class="text-xs font-mono text-gray-500 pt-1">{{ serial }}</p>
      <p v-if="mode === 'unlinked' && publicUrl" class="text-[10px] text-gray-600 break-all">{{ publicUrl }}</p>
    </div>
  </div>
</template>
