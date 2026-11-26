<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import BrandMark from '../components/BrandMark.vue'
import { apiLogCardEvent, apiResolveCard, apiUpdateMe, ensureApiSession, getApiToken } from '../lib/api'
import { isLoggedIn, isTableBusiness, loadProfile, saveProfile, setViewedProfile } from '../lib/profileStore'
import { personalPagePath } from '../lib/profilePaths'
import {
  formatNad,
  monthlyVehiclePayment,
  normalizeIndustry,
  normalizeVehicleFinance,
  vehicleFinanceEnabled
} from '../lib/vehicleFinance'

const route = useRoute()
const loading = ref(true)
const saving = ref(false)
const saveNote = ref('')
const profile = ref(null)
const price = ref('')
const deposit = ref('')
const fees = ref('')
const balloon = ref('')
const rate = ref(12)
const term = ref(60)
const publishEnabled = ref(false)
const allowBalloon = ref(true)
const requirements = ref([])

const slug = computed(() => String(route.params.serial || profile.value?.shareSlug || '').trim())
const finance = computed(() => normalizeVehicleFinance(profile.value?.vehicleFinance))
const available = computed(() => vehicleFinanceEnabled(profile.value))
const isOwner = computed(() => {
  if (!isLoggedIn() || !profile.value) return false
  const mine = loadProfile()
  const myId = String(mine.remoteProfileId || '').trim()
  const theirId = String(profile.value.remoteProfileId || profile.value.id || '').trim()
  if (myId && theirId && myId === theirId) return true
  const mySlug = String(mine.shareSlug || '').trim().toLowerCase()
  return !!(mySlug && slug.value && mySlug === slug.value.toLowerCase())
})
const canEdit = computed(() => isOwner.value && normalizeIndustry(profile.value?.industry) === 'auto_dealer')
const showPage = computed(() => available.value || canEdit.value)
const showBalloon = computed(() => canEdit.value || finance.value.allowBalloon)
const backTo = computed(() => {
  if (!slug.value) return isTableBusiness(profile.value) ? '/business' : '/me'
  return personalPagePath(slug.value)
})

const principal = computed(() => {
  const amount = num(price.value) - num(deposit.value) + num(fees.value)
  return Math.max(0, amount)
})

const balloonAmount = computed(() => (showBalloon.value ? num(balloon.value) : 0))
const paymentCount = computed(() => Math.max(1, Math.round(num(term.value))))

const monthly = computed(() =>
  monthlyVehiclePayment({
    principal: principal.value,
    annualRatePercent: num(rate.value),
    termMonths: paymentCount.value,
    balloon: balloonAmount.value
  })
)

const totalRepayment = computed(() => {
  if (principal.value <= 0) return 0
  return monthly.value * paymentCount.value + balloonAmount.value
})

const totalInterest = computed(() => {
  if (principal.value <= 0) return 0
  return Math.max(0, totalRepayment.value - principal.value)
})

const shownRequirements = computed(() =>
  canEdit.value ? requirements.value : finance.value.requirements
)

function num(value) {
  const n = Number(String(value ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

function applySettings(settings) {
  rate.value = settings.annualRatePercent
  term.value = settings.termMonths
  publishEnabled.value = settings.enabled
  allowBalloon.value = settings.allowBalloon
  requirements.value = [...settings.requirements]
}

function addRequirement() {
  requirements.value = [...requirements.value, '']
}

function removeRequirement(index) {
  requirements.value = requirements.value.filter((_, i) => i !== index)
}

async function saveDefaults() {
  if (!canEdit.value || saving.value) return
  const payload = normalizeVehicleFinance({
    enabled: publishEnabled.value,
    annualRatePercent: num(rate.value),
    termMonths: num(term.value),
    allowBalloon: allowBalloon.value,
    requirements: requirements.value
  })
  saving.value = true
  saveNote.value = ''
  try {
    let authed = await ensureApiSession()
    if (!authed) authed = await ensureApiSession({ force: true })
    if (!authed || !getApiToken()) {
      saveNote.value = 'Sign in again to save.'
      return
    }
    const res = await apiUpdateMe({ vehicleFinance: payload })
    if (!res.ok) {
      saveNote.value = res.error || 'Could not save'
      return
    }
    const nextFinance = normalizeVehicleFinance(res.data?.vehicleFinance || payload)
    const next = { ...profile.value, vehicleFinance: nextFinance }
    profile.value = next
    saveProfile({ industry: next.industry, vehicleFinance: nextFinance })
    setViewedProfile(next)
    applySettings(nextFinance)
    saveNote.value = 'Saved'
  } finally {
    saving.value = false
  }
}

async function load() {
  loading.value = true
  saveNote.value = ''
  const code = String(route.params.serial || '').trim()
  if (!code) {
    profile.value = null
    loading.value = false
    return
  }
  try {
    const remote = await apiResolveCard(code)
    if (remote?.profile) {
      const next = {
        ...remote.profile,
        shareSlug: remote.card?.slug || code,
        industry: remote.profile.industry || remote.card?.industry || ''
      }
      profile.value = next
      setViewedProfile(next)
      applySettings(normalizeVehicleFinance(next.vehicleFinance))
    } else {
      profile.value = null
    }
  } catch {
    profile.value = null
  } finally {
    loading.value = false
  }
}

let financeVisitLogged = false
let financeCalcLogged = false

function logFinance(action) {
  const code = slug.value
  if (!code || isOwner.value) return
  apiLogCardEvent(code, action, '').catch?.(() => {})
}

watch([price, deposit, fees, balloon, rate, term], () => {
  if (loading.value || isOwner.value || !available.value) return
  if (num(price.value) <= 0) return
  if (financeCalcLogged) return
  financeCalcLogged = true
  logFinance('click:finance_calculate')
})

watch(
  () => [loading.value, available.value, slug.value, isOwner.value],
  () => {
    if (loading.value || !available.value || !slug.value || isOwner.value) return
    if (financeVisitLogged) return
    financeVisitLogged = true
    logFinance('click:finance')
  }
)

watch(() => route.params.serial, () => {
  financeVisitLogged = false
  financeCalcLogged = false
  load()
})
onMounted(load)
</script>

<template>
  <main class="w-full max-w-md min-h-screen mx-auto flex flex-col relative px-5 pt-6 pb-32">
    <RouterLink :to="backTo" class="inline-flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-white mb-4 no-underline">
      <span class="material-symbols-outlined text-[16px]">arrow_back</span>
      Profile
    </RouterLink>

    <p v-if="loading" class="text-sm text-gray-400">Loading financing…</p>

    <template v-else-if="!profile || !showPage">
      <h1 class="text-2xl font-bold tracking-tight">Vehicle financing</h1>
      <p class="text-sm text-gray-400 mt-2">Vehicle financing is not turned on for this card.</p>
    </template>

    <template v-else>
      <h1 class="text-2xl font-bold tracking-tight">Vehicle financing</h1>

      <section class="mt-6 space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <label class="block min-w-0">
            <span class="text-xs font-semibold uppercase tracking-wide text-gray-400">Vehicle price</span>
            <input v-model="price" inputmode="decimal" class="finance-input mt-1" placeholder="0">
          </label>
          <label class="block min-w-0">
            <span class="text-xs font-semibold uppercase tracking-wide text-gray-400">Deposit</span>
            <input v-model="deposit" inputmode="decimal" class="finance-input mt-1" placeholder="0">
          </label>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <label class="block min-w-0">
            <span class="text-xs font-semibold uppercase tracking-wide text-gray-400">Financed fees</span>
            <input v-model="fees" inputmode="decimal" class="finance-input mt-1" placeholder="0">
          </label>
          <label class="block min-w-0">
            <span class="text-xs font-semibold uppercase tracking-wide text-gray-400">Annual rate %</span>
            <input v-model="rate" inputmode="decimal" class="finance-input mt-1">
          </label>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <label class="block min-w-0">
            <span class="text-xs font-semibold uppercase tracking-wide text-gray-400">Term (months)</span>
            <input v-model="term" inputmode="numeric" class="finance-input mt-1">
          </label>
          <label v-if="showBalloon" class="block min-w-0">
            <span class="text-xs font-semibold uppercase tracking-wide text-gray-400">Balloon payment</span>
            <input v-model="balloon" inputmode="decimal" class="finance-input mt-1" placeholder="Optional">
          </label>
        </div>
      </section>

      <section class="mt-6 card-item-bg rounded-2xl p-4">
        <p class="text-[11px] uppercase tracking-wide text-gray-500">Amount financed</p>
        <p class="text-lg font-semibold mt-1">{{ formatNad(principal) }}</p>
        <p class="text-[11px] uppercase tracking-wide text-gray-500 mt-4">Monthly payment</p>
        <p class="text-3xl font-bold tracking-tight mt-1">{{ formatNad(monthly) }}</p>
        <div class="grid grid-cols-2 gap-3 mt-4">
          <div>
            <p class="text-[11px] uppercase tracking-wide text-gray-500">Total repayment</p>
            <p class="text-lg font-semibold mt-1">{{ formatNad(totalRepayment) }}</p>
          </div>
          <div>
            <p class="text-[11px] uppercase tracking-wide text-gray-500">Total interest</p>
            <p class="text-lg font-semibold mt-1">{{ formatNad(totalInterest) }}</p>
          </div>
        </div>
        <p class="text-xs text-gray-500 mt-2">
          {{ num(rate) }}% per year for {{ paymentCount }} months
          <template v-if="balloonAmount"> · balloon {{ formatNad(balloonAmount) }}</template>
        </p>
      </section>

      <section v-if="canEdit" class="mt-8 space-y-3">
        <h2 class="text-xs font-semibold uppercase tracking-wide text-gray-500">Your published settings</h2>
        <label class="flex items-center gap-3 card-item-bg rounded-2xl px-4 py-3 cursor-pointer">
          <input v-model="publishEnabled" type="checkbox" class="rounded border-zinc-600">
          <span class="text-sm font-semibold">Show vehicle financing</span>
        </label>
        <label class="flex items-center gap-3 card-item-bg rounded-2xl px-4 py-3 cursor-pointer">
          <input v-model="allowBalloon" type="checkbox" class="rounded border-zinc-600">
          <span class="min-w-0">
            <span class="block text-sm font-semibold">Allow a balloon payment</span>
            <span class="block text-xs text-gray-500 mt-0.5">Visitors can enter a residual lump sum</span>
          </span>
        </label>
        <div class="space-y-2">
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Applicant requirements</p>
          <div v-for="(line, index) in requirements" :key="'req-' + index" class="flex gap-2">
            <input
              v-model="requirements[index]"
              type="text"
              class="finance-input"
              :aria-label="`Requirement ${index + 1}`"
            >
            <button type="button" class="px-3 rounded-xl border border-[var(--border-strong)] text-xs text-gray-300" @click="removeRequirement(index)">
              Remove
            </button>
          </div>
          <button type="button" class="text-xs font-semibold text-sky-300" @click="addRequirement">
            Add requirement
          </button>
        </div>
        <button
          type="button"
          class="w-full py-3 rounded-full bg-white text-black text-sm font-bold disabled:opacity-50"
          :disabled="saving"
          @click="saveDefaults"
        >
          {{ saving ? 'Saving…' : 'Save financing' }}
        </button>
        <p v-if="saveNote" class="text-xs text-gray-400 text-center">{{ saveNote }}</p>
      </section>

      <section v-else class="mt-8">
        <h2 class="text-xs font-semibold uppercase tracking-wide text-gray-500">Applicant requirements</h2>
        <ul class="mt-3 space-y-2">
          <li
            v-for="line in shownRequirements"
            :key="line"
            class="card-item-bg rounded-2xl px-4 py-3 text-sm text-gray-200"
          >
            {{ line }}
          </li>
        </ul>
      </section>
    </template>

    <div class="mt-10 flex justify-center">
      <BrandMark size="sm" to="/" />
    </div>
  </main>
</template>
