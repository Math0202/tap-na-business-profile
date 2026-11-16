<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import BrandMark from '../components/BrandMark.vue'
import { apiResolveCard } from '../lib/api'
import { isTableBusiness, setViewedProfile } from '../lib/profileStore'
import { personalPagePath } from '../lib/profilePaths'
import {
  formatNad,
  monthlyVehiclePayment,
  normalizeVehicleFinance,
  vehicleFinanceEnabled
} from '../lib/vehicleFinance'

const route = useRoute()
const loading = ref(true)
const profile = ref(null)
const price = ref('')
const deposit = ref('')
const fees = ref('')
const balloon = ref('')
const rate = ref(12)
const term = ref(60)

const slug = computed(() => String(route.params.serial || profile.value?.shareSlug || '').trim())
const finance = computed(() => normalizeVehicleFinance(profile.value?.vehicleFinance))
const available = computed(() => vehicleFinanceEnabled(profile.value))
const backTo = computed(() => {
  if (!slug.value) return isTableBusiness(profile.value) ? '/business' : '/me'
  return personalPagePath(slug.value)
})

const principal = computed(() => {
  const amount = num(price.value) - num(deposit.value) + num(fees.value)
  return Math.max(0, amount)
})

const balloonAmount = computed(() => (finance.value.allowBalloon ? num(balloon.value) : 0))
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

function num(value) {
  const n = Number(String(value ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

async function load() {
  loading.value = true
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
      const settings = normalizeVehicleFinance(next.vehicleFinance)
      rate.value = settings.annualRatePercent
      term.value = settings.termMonths
    } else {
      profile.value = null
    }
  } catch {
    profile.value = null
  } finally {
    loading.value = false
  }
}

watch(() => route.params.serial, load)
onMounted(load)
</script>

<template>
  <main class="w-full max-w-md min-h-screen mx-auto flex flex-col relative px-5 pt-8 pb-32">
    <RouterLink :to="backTo" class="inline-flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-white mb-4 no-underline">
      <span class="material-symbols-outlined text-[16px]">arrow_back</span>
      Profile
    </RouterLink>

    <p v-if="loading" class="text-sm text-gray-400">Loading financing…</p>

    <template v-else-if="!profile || !available">
      <h1 class="text-2xl font-bold tracking-tight">Vehicle financing</h1>
      <p class="text-sm text-gray-400 mt-2">Vehicle financing is not turned on for this card.</p>
    </template>

    <template v-else>
      <h1 class="text-2xl font-bold tracking-tight">Vehicle financing</h1>

      <section class="mt-6 space-y-3">
        <label class="block">
          <span class="text-xs font-semibold uppercase tracking-wide text-gray-400">Vehicle price</span>
          <input v-model="price" inputmode="decimal" class="field-input mt-1 w-full rounded-2xl bg-zinc-900 border border-[var(--border)] px-4 py-3" placeholder="0">
        </label>
        <label class="block">
          <span class="text-xs font-semibold uppercase tracking-wide text-gray-400">Deposit</span>
          <input v-model="deposit" inputmode="decimal" class="field-input mt-1 w-full rounded-2xl bg-zinc-900 border border-[var(--border)] px-4 py-3" placeholder="0">
        </label>
        <label class="block">
          <span class="text-xs font-semibold uppercase tracking-wide text-gray-400">Financed fees</span>
          <input v-model="fees" inputmode="decimal" class="field-input mt-1 w-full rounded-2xl bg-zinc-900 border border-[var(--border)] px-4 py-3" placeholder="0">
        </label>
        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="text-xs font-semibold uppercase tracking-wide text-gray-400">Annual rate %</span>
            <input v-model="rate" inputmode="decimal" class="field-input mt-1 w-full rounded-2xl bg-zinc-900 border border-[var(--border)] px-4 py-3">
          </label>
          <label class="block">
            <span class="text-xs font-semibold uppercase tracking-wide text-gray-400">Term (months)</span>
            <input v-model="term" inputmode="numeric" class="field-input mt-1 w-full rounded-2xl bg-zinc-900 border border-[var(--border)] px-4 py-3">
          </label>
        </div>
        <label v-if="finance.allowBalloon" class="block">
          <span class="text-xs font-semibold uppercase tracking-wide text-gray-400">Balloon payment</span>
          <input v-model="balloon" inputmode="decimal" class="field-input mt-1 w-full rounded-2xl bg-zinc-900 border border-[var(--border)] px-4 py-3" placeholder="Optional">
        </label>
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

      <section class="mt-6">
        <h2 class="text-xs font-semibold uppercase tracking-wide text-gray-500">Applicant requirements</h2>
        <ul class="mt-3 space-y-2">
          <li
            v-for="line in finance.requirements"
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
