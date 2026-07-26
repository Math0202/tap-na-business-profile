<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import BrandMark from '../components/BrandMark.vue'
import { apiSignup, apiResolveCard } from '../lib/api'
import { saveProfile, hashPassword, markLoggedIn } from '../lib/profileStore'
import { linkCardToProfile, extractSerialFromScan, kindLabel } from '../lib/cardLinkStore'
import { LOCAL_ID } from '../lib/adminStore'

const route = useRoute()
const router = useRouter()

const slug = computed(() => {
  const raw = String(route.query.code || '')
  return extractSerialFromScan(raw) || raw
})

const step = ref('account') // account | done
const cardType = ref('personal') // personal | table — locked from slug kind at generation
const cardKind = ref('personal')
const cardState = ref('checking') // checking | ok | linked | missing
const name = ref('')
const company = ref('')
const cell = ref('')
const email = ref('')
const password = ref('')
const confirm = ref('')
const error = ref('')
const submitting = ref(false)
const offlineNote = ref('')

function profileTypeFromKind(kind) {
  return kind === 'personal' ? 'personal' : 'table'
}

onMounted(async () => {
  document.title = 'Set up your card - tap-na'
  if (!slug.value) {
    cardState.value = 'missing'
    return
  }
  const remote = await apiResolveCard(slug.value)
  if (!remote?.ok || !remote.card) {
    // Unknown offline — treat as personal so we never ask the user to pick a type
    cardKind.value = 'personal'
    cardType.value = 'personal'
    cardState.value = 'ok'
    return
  }
  if (remote.card.status === 'linked') {
    cardState.value = 'linked'
    return
  }
  cardKind.value = remote.card.kind === 'personal' ? 'personal' : 'table'
  cardType.value = profileTypeFromKind(cardKind.value)
  cardState.value = 'ok'
})

async function onSubmit(e) {
  e.preventDefault()
  error.value = ''
  const n = name.value.trim()
  const em = email.value.trim()
  const c = cell.value.trim()

  if (!n) { error.value = 'Please enter your name.'; return }
  if (cardType.value === 'table' && !company.value.trim()) {
    error.value = 'Please enter your business name.'
    return
  }
  if (!em && !c) { error.value = 'Enter an email or cell number to log in with.'; return }
  if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { error.value = 'Enter a valid email address.'; return }
  if (String(password.value).length < 6) { error.value = 'Password must be at least 6 characters.'; return }
  if (password.value !== confirm.value) { error.value = 'Passwords do not match.'; return }

  submitting.value = true
  const passwordHash = hashPassword(password.value)

  try {
    const res = await apiSignup({
      name: n,
      company: company.value.trim(),
      email: em,
      phone: c,
      loginEmail: em,
      loginPhone: c,
      passwordHash,
      cardType: cardType.value,
      slug: slug.value
    })

    let remoteProfileId = ''
    if (res.ok && res.data?.profile?.id) {
      remoteProfileId = res.data.profile.id
    } else {
      offlineNote.value = 'Saved on this device — will sync when back online.'
    }

    saveProfile({
      cardType: cardType.value,
      name: n,
      company: company.value.trim(),
      phone: c,
      email: em,
      loginEmail: em,
      loginPhone: c,
      passwordHash,
      remoteProfileId,
      shareSlug: slug.value
    })
    markLoggedIn()

    if (slug.value) {
      linkCardToProfile(slug.value, {
        profileId: LOCAL_ID,
        profileName: company.value.trim() || n
      })
    }

    step.value = 'done'
  } finally {
    submitting.value = false
  }
}

function finish() {
  router.push('/profile')
}
</script>

<template>
  <main class="w-full max-w-md min-h-screen mx-auto flex flex-col relative z-10 px-6 pt-16 pb-28">
    <BrandMark size="sm" class="mb-4" />

    <div v-if="cardState === 'linked'" class="card-item-bg rounded-3xl p-6 text-center space-y-4 mt-8">
      <span class="material-symbols-outlined text-4xl text-amber-300">link</span>
      <h1 class="text-xl font-bold">Card already set up</h1>
      <p class="text-sm text-gray-400">
        This card is already linked to a profile. Tap it again to open that profile,
        or log in if it belongs to you.
      </p>
      <RouterLink to="/login" class="block py-3 rounded-full bg-white text-black text-sm font-bold no-underline">
        Log in
      </RouterLink>
    </div>

    <div v-else-if="cardState === 'missing'" class="card-item-bg rounded-3xl p-6 text-center space-y-4 mt-8">
      <span class="material-symbols-outlined text-4xl text-gray-400">qr_code_scanner</span>
      <h1 class="text-xl font-bold">No card code</h1>
      <p class="text-sm text-gray-400">Scan your card's QR code or tap the card to start set-up.</p>
      <RouterLink to="/" class="block py-3 rounded-full border border-[var(--border)] text-sm font-semibold no-underline text-inherit">
        Home
      </RouterLink>
    </div>

    <template v-else>
      <form v-if="step === 'account'" class="space-y-4" @submit="onSubmit">
        <div>
          <h1 class="text-2xl font-bold tracking-tight">
            {{ cardType === 'table' ? 'Business account' : 'Your account' }}
          </h1>
          <p class="text-gray-400 text-sm mt-1">
            {{ cardType === 'table' ? 'Create the account for this venue card' : 'Create the account for your personal card' }}
          </p>
          <p v-if="slug" class="text-xs font-mono text-gray-500 mt-2">
            {{ slug }} · {{ kindLabel(cardKind) }}
          </p>
          <p class="text-[11px] text-gray-500 mt-1 mb-4">
            Profile type is fixed by how this QR was generated — it cannot be changed later.
          </p>
        </div>

        <div>
          <label class="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5" for="setup-name">Full name</label>
          <div class="field-shell">
            <span class="material-symbols-outlined text-gray-400 text-[20px]">badge</span>
            <input id="setup-name" v-model="name" type="text" class="field-input" placeholder="Your full name" autocomplete="name" required />
          </div>
        </div>

        <div v-if="cardType === 'table'">
          <label class="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5" for="setup-company">Business name</label>
          <div class="field-shell">
            <span class="material-symbols-outlined text-gray-400 text-[20px]">storefront</span>
            <input id="setup-company" v-model="company" type="text" class="field-input" placeholder="Your venue or business" required />
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5" for="setup-cell">Cell number</label>
          <div class="field-shell">
            <span class="material-symbols-outlined text-gray-400 text-[20px]">smartphone</span>
            <input id="setup-cell" v-model="cell" type="tel" class="field-input" placeholder="+264 81 000 0000" autocomplete="tel" inputmode="tel" />
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5" for="setup-email">Email</label>
          <div class="field-shell">
            <span class="material-symbols-outlined text-gray-400 text-[20px]">mail</span>
            <input id="setup-email" v-model="email" type="email" class="field-input" placeholder="you@example.com" autocomplete="email" inputmode="email" />
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5" for="setup-password">Password</label>
          <div class="field-shell">
            <span class="material-symbols-outlined text-gray-400 text-[20px]">lock</span>
            <input id="setup-password" v-model="password" type="password" class="field-input" placeholder="Min 6 characters" autocomplete="new-password" required />
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5" for="setup-confirm">Confirm password</label>
          <div class="field-shell">
            <span class="material-symbols-outlined text-gray-400 text-[20px]">lock</span>
            <input id="setup-confirm" v-model="confirm" type="password" class="field-input" placeholder="Repeat password" autocomplete="new-password" required />
          </div>
        </div>

        <p class="text-xs text-red-400 min-h-[1rem]">{{ error }}</p>

        <button
          type="submit"
          class="w-full py-4 rounded-full bg-white text-black font-bold text-base hover:bg-gray-200 transition-colors disabled:opacity-50"
          :disabled="submitting"
        >
          {{ submitting ? 'Creating account…' : 'Create account & link card' }}
        </button>

        <p class="text-center text-sm text-gray-500 pt-2">
          Already have a profile?
          <RouterLink
            :to="{ path: '/login', query: { next: `/c/${encodeURIComponent(slug)}` } }"
            class="font-semibold underline underline-offset-2"
          >
            Log in to link this card
          </RouterLink>
        </p>
      </form>

      <div v-else class="card-item-bg rounded-3xl p-6 text-center space-y-4 mt-8">
        <span class="material-symbols-outlined text-5xl text-emerald-400" style="font-variation-settings: 'FILL' 1">check_circle</span>
        <h1 class="text-xl font-bold">Card linked</h1>
        <p class="text-sm text-gray-400">
          Your {{ cardType === 'table' ? 'business' : 'personal' }} account is ready and card
          <span class="font-mono">{{ slug }}</span> now opens your profile.
        </p>
        <p v-if="offlineNote" class="text-xs text-amber-300">{{ offlineNote }}</p>
        <button type="button" class="w-full py-3 rounded-full bg-white text-black text-sm font-bold" @click="finish">
          Complete your profile
        </button>
      </div>
    </template>
  </main>
</template>