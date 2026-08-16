<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  getCardTapAction,
  extractSerialFromScan,
  kindLabel,
  cardImageSrc,
  linkCardToProfile,
  hydrateLinkedCardsFromApi
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
import { singleBusinessDestinationHref } from '../lib/businessLinks'
import { personalTypeLabel, normalizePersonalType, DEFAULT_PERSONAL_TYPE } from '../lib/teamRoles'
import {
  isConnectTeamPersonalType,
  validateTeamIntegrations
} from '../lib/teamIntegrations'
import BusinessView from './BusinessView.vue'
import MyCardView from './MyCardView.vue'
import JoinTeamPopup from '../components/JoinTeamPopup.vue'
import TeamIntegrationsFields from '../components/TeamIntegrationsFields.vue'

const route = useRoute()
const router = useRouter()

// mode: '' (loading) | 'linked' | 'unlinked' | 'disabled' | 'missing'
const mode = ref('')
const cardKind = ref('table')
const personalType = ref(DEFAULT_PERSONAL_TYPE)
const linkedType = ref('table')
const pendingTeamInvite = ref(null)
const joinTeamOpen = ref(false)

const firstName = ref('')
const surname = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const meetingTool = ref('')
const usesCrm = ref(false)
const crmProvider = ref('')
const crmOther = ref('')
const error = ref('')
const submitting = ref(false)

const serial = computed(() => {
  const fromParam = route.params.serial
  return extractSerialFromScan(String(fromParam || '')) || String(fromParam || '')
})

const isPersonalCard = computed(() => cardKind.value === 'personal')

const showTeamIntegrations = computed(
  () =>
    isPersonalCard.value &&
    isConnectTeamPersonalType(personalType.value) &&
    !pendingTeamInvite.value
)

const claimCardImage = computed(() =>
  cardImageSrc({
    kind: cardKind.value,
    personalType: isPersonalCard.value ? personalType.value : ''
  })
)

const claimTypeLabel = computed(() => {
  if (isPersonalCard.value) return personalTypeLabel(personalType.value)
  return kindLabel('table')
})

/** Claiming a card always starts a fresh account for that slug — kick any other session out. */
function forceClaimLogout() {
  logout()
  setApiToken('')
}

/** Business cards with exactly one configured destination skip the profile grid. */
function redirectIfSingleBusinessDestination(profile) {
  if (!profile || profile.cardType === 'personal') return false
  const forceFull =
    String(route.query.full || '') === '1' || String(route.query.profile || '') === '1'
  if (forceFull) return false
  const href = singleBusinessDestinationHref(profile)
  if (!href) return false
  if (href.startsWith('/') && !href.startsWith('//')) {
    router.replace(href)
  } else {
    window.location.replace(href)
  }
  return true
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

  let integrations = null
  if (showTeamIntegrations.value) {
    const check = validateTeamIntegrations({
      meetingTool: meetingTool.value,
      usesCrm: usesCrm.value,
      crmProvider: crmProvider.value,
      crmOther: crmOther.value
    })
    if (!check.ok) {
      error.value = check.error
      return
    }
    integrations = check.value
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
      name: fullName || loginEmail,
      ...(integrations || {})
    })

    if (!response.ok || !response.data?.profile?.id) {
      error.value = response.error || 'Could not create your profile. Please try again.'
      return
    }

    const profile = response.data.profile
    linkCardToProfile(serial.value, {
      profileId: LOCAL_ID,
      profileName: fullName || loginEmail,
      personalType: personalType.value
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
      shareSlug: serial.value,
      personalType: personalType.value || ''
    })
    if (response.data.token) setApiToken(response.data.token)
    markLoggedIn()
    if (profile.id && Array.isArray(profile.cards) && profile.cards.length) {
      hydrateLinkedCardsFromApi(profile.id, profile.cards)
    }
    if (response.data.pendingTeamInvite) {
      pendingTeamInvite.value = response.data.pendingTeamInvite
      joinTeamOpen.value = true
      return
    }
    router.replace('/profile')
  } finally {
    submitting.value = false
  }
}

function onJoinTeamDone() {
  joinTeamOpen.value = false
  router.replace('/profile')
}

function onJoinTeamClose() {
  joinTeamOpen.value = false
  router.replace('/profile')
}

function setClaimChrome(active) {
  hideFloatingChrome.value = !!active
  document.body.classList.toggle('card-claim-ui', !!active)
}

onMounted(async () => {
  // Hide nav/FAB immediately while resolving — claim & loading must not show chrome
  setClaimChrome(true)
  const via = String(route.query.via || '').toLowerCase()

  const remote = await apiResolveCard(serial.value)
  if (remote?.ok && remote.card) {
    apiLogCardOpen(serial.value, via).catch?.(() => {})
    cardKind.value = remote.card.kind === 'personal' ? 'personal' : 'table'
    personalType.value =
      remote.card.kind === 'personal'
        ? normalizePersonalType(remote.card.personalType || remote.card.personal_type || DEFAULT_PERSONAL_TYPE)
        : ''
    if (remote.pendingTeamInvite) pendingTeamInvite.value = remote.pendingTeamInvite

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
        if (remote.profile.id && (mine.remoteProfileId === remote.profile.id || !mine.remoteProfileId)) {
          const patch = {}
          if (!mine.shareSlug) patch.shareSlug = remote.card.slug || serial.value
          if (remote.profile.personalType || personalType.value) {
            patch.personalType = remote.profile.personalType || personalType.value
          }
          if (Object.keys(patch).length) saveProfile(patch)
        }
      } catch {
        /* ignore */
      }
      if (redirectIfSingleBusinessDestination(remote.profile)) {
        mode.value = 'redirect'
        setClaimChrome(false)
        return
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
  personalType.value =
    action.card?.kind === 'personal'
      ? normalizePersonalType(action.card?.personalType || action.card?.personal_type || DEFAULT_PERSONAL_TYPE)
      : ''
  if (action.ok && action.status === 'linked') {
    const mine = loadProfile()
    linkedType.value = mine.cardType === 'personal' ? 'personal' : 'table'
    setViewedProfile({ ...mine, shareSlug: serial.value })
    if (redirectIfSingleBusinessDestination({ ...mine, cardType: linkedType.value })) {
      mode.value = 'redirect'
      setClaimChrome(false)
      return
    }
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
  <div v-if="!mode" class="min-h-screen flex flex-col items-center overflow-x-hidden" aria-busy="true" aria-label="Loading profile">
    <div class="w-full h-40 bg-zinc-800/80 animate-pulse" aria-hidden="true" />
    <main class="w-full max-w-md flex-1 flex flex-col relative z-10 pb-20 -mt-10">
      <section class="px-6">
        <div class="flex items-end gap-4">
          <div class="w-36 h-36 rounded-full shrink-0 border-[3px] border-zinc-700 bg-zinc-800 animate-pulse" />
          <div class="pb-2 flex-1 min-w-0 space-y-2">
            <div class="h-5 w-40 max-w-full rounded-md bg-zinc-800 animate-pulse" />
            <div class="h-3.5 w-28 max-w-full rounded-md bg-zinc-800/80 animate-pulse" />
            <div class="h-3 w-24 max-w-full rounded-md bg-zinc-800/60 animate-pulse" />
            <div class="mt-2 flex items-center gap-2">
              <div class="w-9 h-9 rounded-full bg-zinc-800 animate-pulse" />
              <div class="w-9 h-9 rounded-full bg-zinc-800 animate-pulse" />
              <div class="w-9 h-9 rounded-full bg-zinc-800 animate-pulse" />
            </div>
          </div>
        </div>
      </section>

      <div class="page-sheet flex-1 mt-6 px-6 pt-6 space-y-3">
        <div
          v-for="n in 5"
          :key="n"
          class="card-item-bg rounded-2xl flex items-center p-4"
        >
          <div class="w-12 h-12 rounded-full bg-zinc-700/80 animate-pulse mr-4 shrink-0" />
          <div class="h-3.5 rounded-md bg-zinc-700/60 animate-pulse" :class="n % 2 ? 'w-24' : 'w-32'" />
        </div>
        <div class="pt-4 pb-2">
          <div class="w-full h-12 rounded-full bg-zinc-700/70 animate-pulse" />
        </div>
      </div>
    </main>
  </div>

  <!-- Linked & active: render the owner's profile in place (never redirect) -->
  <BusinessView v-else-if="mode === 'linked' && linkedType === 'table'" />
  <MyCardView v-else-if="mode === 'linked'" />
  <div
    v-else-if="mode === 'redirect'"
    class="min-h-screen flex flex-col items-center justify-center px-5"
    aria-busy="true"
    aria-label="Opening link"
  >
    <span class="material-symbols-outlined text-4xl text-gray-500 animate-pulse">open_in_new</span>
    <p class="text-sm text-gray-400 mt-3">Opening…</p>
  </div>

  <!-- Not found / disabled / claim -->
  <div v-else class="min-h-screen flex flex-col items-center justify-center px-5">
    <div class="w-full max-w-md card-item-bg rounded-3xl p-6 text-center space-y-4">
      <template v-if="mode === 'missing' || mode === 'disabled'">
        <div class="w-14 h-14 mx-auto rounded-full bg-white/10 flex items-center justify-center">
          <span class="material-symbols-outlined text-[28px]">
            {{ mode === 'disabled' ? 'lock' : 'search_off' }}
          </span>
        </div>
        <div v-if="mode === 'missing'">
          <h1 class="text-xl font-bold">Profile not found</h1>
          <p class="text-sm text-gray-400 mt-2">
            This card code doesn’t match any profile. Check the code and try again.
          </p>
        </div>
        <div v-else>
          <h1 class="text-xl font-bold">Disabled by owner</h1>
          <p class="text-sm text-gray-400 mt-2">
            This profile has been disabled by its owner and isn’t available right now.
          </p>
        </div>
      </template>

      <template v-else>
        <h1 class="text-2xl font-bold tracking-tight">Claim card</h1>

        <div class="mx-auto w-full max-w-[220px] rounded-2xl bg-zinc-900/80 px-3 py-4 flex items-center justify-center">
          <img
            :src="claimCardImage"
            :alt="claimTypeLabel + ' NFC card'"
            class="w-full h-auto object-contain drop-shadow-xl"
          >
        </div>

        <p class="text-sm font-semibold text-gray-200">{{ claimTypeLabel }}</p>

        <form class="text-left space-y-3" @submit="createProfile">
          <div v-if="isPersonalCard" class="grid grid-cols-2 gap-3">
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
          </div>

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
          <div v-if="showTeamIntegrations" class="pt-2">
            <TeamIntegrationsFields
              :meeting-tool="meetingTool"
              :uses-crm="usesCrm"
              :crm-provider="crmProvider"
              :crm-other="crmOther"
              :disabled="submitting"
              @update:meetingTool="meetingTool = $event"
              @update:usesCrm="usesCrm = $event"
              @update:crmProvider="crmProvider = $event"
              @update:crmOther="crmOther = $event"
            />
          </div>
          <p class="text-xs text-red-400 min-h-[1rem]">{{ error }}</p>
          <button
            type="submit"
            class="claim-cta w-full py-4 rounded-2xl bg-white text-black text-base font-bold tracking-wide shadow-lg hover:bg-gray-100 active:scale-[0.98] transition disabled:opacity-50"
            :disabled="submitting"
          >
            {{ submitting ? 'Claiming card…' : 'Claim this card' }}
          </button>
        </form>
      </template>

      <p
        v-if="mode === 'unlinked' && pendingTeamInvite"
        class="text-xs text-emerald-400/90 text-center leading-relaxed"
      >
        After claiming, you'll be invited to join {{ pendingTeamInvite.teamName }} as
        {{ personalTypeLabel(pendingTeamInvite.role) }}.
      </p>
    </div>
  </div>

  <JoinTeamPopup
    :open="joinTeamOpen"
    :invite="pendingTeamInvite"
    @close="onJoinTeamClose"
    @done="onJoinTeamDone"
  />
</template>
