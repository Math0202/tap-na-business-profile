<script setup>
import { computed, ref, watch } from 'vue'
import {
  BUSINESS_CARD_ID,
  EXECUTIVE_CARD_ID,
  TEAM_PACKAGE_MIN,
  TEAM_SUBDOMAIN_THRESHOLD,
  formatPrice,
  getProduct,
  initialTeamMix
} from '../lib/shopCatalog'
import { apiShopOrderQuote } from '../lib/api'
import { loadProfile } from '../lib/profileStore'

const props = defineProps({
  open: { type: Boolean, default: false },
  mode: { type: String, default: 'solo' },
  focusId: { type: String, default: '' },
  soloProductId: { type: String, default: 'blue-card' },
  initialBusinessQty: { type: Number, default: null },
  initialExecutiveQty: { type: Number, default: null },
  initialSubdomain: { type: String, default: '' },
  initialSoloQty: { type: Number, default: 1 }
})

const emit = defineEmits(['close', 'ordered'])

const soloQty = ref(1)
const businessQty = ref(2)
const executiveQty = ref(3)
const subdomain = ref('')
const error = ref('')
const submitting = ref(false)
const customerName = ref('')
const customerCompany = ref('')
const customerEmail = ref('')
const customerPhone = ref('')
const customerTown = ref('')

const isTeam = computed(() => props.mode === 'team')
const soloProduct = computed(() => getProduct(props.soloProductId || props.focusId || 'blue-card'))
const businessProduct = computed(() => getProduct(BUSINESS_CARD_ID))
const executiveProduct = computed(() => getProduct(EXECUTIVE_CARD_ID))
const teamTotal = computed(() => businessQty.value + executiveQty.value)
const subdomainEligible = computed(() => teamTotal.value >= TEAM_SUBDOMAIN_THRESHOLD)
const soloSubtotal = computed(() => (soloProduct.value?.price || 0) * soloQty.value)
const teamSubtotal = computed(
  () =>
    (businessProduct.value?.price || 0) * businessQty.value +
    (executiveProduct.value?.price || 0) * executiveQty.value
)
const subtotal = computed(() => (isTeam.value ? teamSubtotal.value : soloSubtotal.value))
const title = computed(() => (isTeam.value ? 'Connect Team package' : 'Connect Solo'))
const itemCount = computed(() => (isTeam.value ? teamTotal.value : soloQty.value))

watch(
  () => [props.open, props.mode, props.focusId],
  ([open]) => {
    if (!open) return
    error.value = ''
    subdomain.value = ''
    submitting.value = false
    if (props.mode === 'team') {
      const mix = initialTeamMix(props.focusId)
      businessQty.value =
        props.initialBusinessQty != null ? Math.max(0, Math.floor(props.initialBusinessQty)) : mix.businessQty
      executiveQty.value =
        props.initialExecutiveQty != null ? Math.max(0, Math.floor(props.initialExecutiveQty)) : mix.executiveQty
      subdomain.value = String(props.initialSubdomain || '').trim()
    } else {
      soloQty.value = Math.max(1, Math.floor(Number(props.initialSoloQty) || 1))
    }
    const profile = loadProfile()
    const name = String(profile?.name || '').trim()
    const company = String(profile?.company || '').trim()
    // Skip profile defaults that are only placeholder copy.
    if (name && name !== 'Name and Surname' && !customerName.value) customerName.value = name
    if (company && company !== 'Company Name' && !customerCompany.value) customerCompany.value = company
    if (profile?.email && !customerEmail.value) customerEmail.value = profile.email
    if (profile?.phone && !customerPhone.value) customerPhone.value = profile.phone
  }
)

function bumpSolo(delta) {
  soloQty.value = Math.min(99, Math.max(1, soloQty.value + delta))
}
function bumpBusiness(delta) {
  businessQty.value = Math.min(99, Math.max(0, businessQty.value + delta))
  error.value = ''
}
function bumpExecutive(delta) {
  executiveQty.value = Math.min(99, Math.max(0, executiveQty.value + delta))
  error.value = ''
}
function close() {
  emit('close')
}

function buildItems() {
  if (isTeam.value) {
    const items = []
    if (businessQty.value > 0 && businessProduct.value) {
      items.push({
        id: businessProduct.value.id,
        name: businessProduct.value.name,
        qty: businessQty.value,
        price: businessProduct.value.price
      })
    }
    if (executiveQty.value > 0 && executiveProduct.value) {
      items.push({
        id: executiveProduct.value.id,
        name: executiveProduct.value.name,
        qty: executiveQty.value,
        price: executiveProduct.value.price
      })
    }
    return items
  }
  const p = soloProduct.value
  if (!p) return []
  return [{ id: p.id, name: p.name, qty: soloQty.value, price: p.price }]
}

async function requestQuote() {
  error.value = ''
  if (isTeam.value && teamTotal.value < TEAM_PACKAGE_MIN) {
    error.value = `Team packages need at least ${TEAM_PACKAGE_MIN} cards total (any mix).`
    return
  }
  const name = customerName.value.trim()
  const company = customerCompany.value.trim()
  const email = customerEmail.value.trim()
  const phone = customerPhone.value.trim()
  const town = customerTown.value.trim()
  if (!name) {
    error.value = 'Please enter your full name.'
    return
  }
  if (!company) {
    error.value = 'Please enter your company name.'
    return
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    error.value = 'Please enter a valid email address.'
    return
  }
  if (!phone || phone.replace(/\D/g, '').length < 7) {
    error.value = 'Please enter a valid cellphone number.'
    return
  }
  if (!town) {
    error.value = 'Please enter your town.'
    return
  }
  const items = buildItems()
  if (!items.length) {
    error.value = 'Add at least one card to continue.'
    return
  }

  const noteParts = [
    `Company: ${company}`,
    isTeam.value
      ? `Team mix ${businessQty.value}:${executiveQty.value} (${teamTotal.value} cards)`
      : `Solo package × ${soloQty.value}`,
    subdomainEligible.value && subdomain.value.trim()
      ? `Custom subdomain request: ${subdomain.value.trim()}`
      : isTeam.value && teamTotal.value >= TEAM_SUBDOMAIN_THRESHOLD
        ? 'Team pack 10+ (subdomain optional — not specified)'
        : ''
  ].filter(Boolean)

  submitting.value = true
  try {
    const res = await apiShopOrderQuote({
      name,
      company,
      email,
      phone,
      town,
      note: noteParts.join('\n'),
      items
    })
    if (!res.ok) {
      error.value = res.error || 'Could not send quote. Please try again.'
      return
    }
    emit('ordered', {
      mode: isTeam.value ? 'team' : 'solo',
      total: itemCount.value,
      quoteRef: res.quoteRef || ''
    })
    close()
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
    >
      <button
        type="button"
        class="absolute inset-0 bg-black/45 border-0 cursor-pointer"
        aria-label="Close package dialog"
        @click="close"
      />
      <div class="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-surface text-on-surface rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col">
        <div class="sticky top-0 z-10 bg-surface/95 backdrop-blur-md border-b border-border-subtle px-5 py-4 flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 class="font-headline-lg-mobile text-[22px] font-medium uppercase tracking-tight">{{ title }}</h2>
            <p class="text-on-surface-variant text-sm mt-1">
              {{ isTeam ? `Mix Business & Executive · min ${TEAM_PACKAGE_MIN} cards` : 'Professional Class · from 1 card' }}
            </p>
          </div>
          <button
            type="button"
            class="w-10 h-10 shrink-0 flex items-center justify-center rounded-full hover:bg-surface-container"
            aria-label="Close"
            @click="close"
          >
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <form class="px-5 py-5 flex flex-col gap-5" @submit.prevent="requestQuote">
          <!-- Solo line -->
          <template v-if="!isTeam && soloProduct">
            <div class="flex gap-4 py-1">
              <div class="w-20 h-20 shrink-0 bg-surface-container rounded-lg overflow-hidden flex items-center justify-center p-2">
                <img v-if="soloProduct.image" :src="soloProduct.image" :alt="soloProduct.name" class="w-full h-full object-contain">
              </div>
              <div class="flex-1 min-w-0 flex flex-col gap-2">
                <div class="flex justify-between gap-3 items-start">
                  <h3 class="font-headline-lg-mobile text-[17px] font-medium truncate">{{ soloProduct.name }}</h3>
                  <span class="font-label-caps text-label-caps shrink-0">{{ formatPrice(soloSubtotal) }}</span>
                </div>
                <div class="inline-flex items-center border border-border-subtle rounded-full overflow-hidden self-start">
                  <button type="button" class="w-10 h-10 flex items-center justify-center" aria-label="Decrease" @click="bumpSolo(-1)">
                    <span class="material-symbols-outlined text-[18px]">remove</span>
                  </button>
                  <span class="w-10 text-center font-label-caps text-[12px]">{{ soloQty }}</span>
                  <button type="button" class="w-10 h-10 flex items-center justify-center" aria-label="Increase" @click="bumpSolo(1)">
                    <span class="material-symbols-outlined text-[18px]">add</span>
                  </button>
                </div>
              </div>
            </div>
          </template>

          <!-- Team lines -->
          <template v-else-if="isTeam">
            <ul class="flex flex-col divide-y divide-border-subtle border-y border-border-subtle list-none p-0 m-0">
              <li v-if="businessProduct" class="flex gap-3 py-4">
                <div class="w-16 h-16 shrink-0 bg-surface-container rounded-lg overflow-hidden flex items-center justify-center p-1.5">
                  <img :src="businessProduct.image" :alt="businessProduct.name" class="w-full h-full object-contain">
                </div>
                <div class="flex-1 min-w-0 flex flex-col gap-2">
                  <div class="flex justify-between gap-2">
                    <h3 class="text-[15px] font-medium truncate">{{ businessProduct.name }}</h3>
                    <span class="font-label-caps text-[11px] shrink-0">{{ formatPrice((businessProduct.price || 0) * businessQty) }}</span>
                  </div>
                  <div class="inline-flex items-center border border-border-subtle rounded-full overflow-hidden self-start">
                    <button type="button" class="w-9 h-9 flex items-center justify-center" @click="bumpBusiness(-1)">
                      <span class="material-symbols-outlined text-[16px]">remove</span>
                    </button>
                    <span class="w-8 text-center font-label-caps text-[11px]">{{ businessQty }}</span>
                    <button type="button" class="w-9 h-9 flex items-center justify-center" @click="bumpBusiness(1)">
                      <span class="material-symbols-outlined text-[16px]">add</span>
                    </button>
                  </div>
                </div>
              </li>
              <li v-if="executiveProduct" class="flex gap-3 py-4">
                <div class="w-16 h-16 shrink-0 bg-surface-container rounded-lg overflow-hidden flex items-center justify-center p-1.5">
                  <img :src="executiveProduct.image" :alt="executiveProduct.name" class="w-full h-full object-contain">
                </div>
                <div class="flex-1 min-w-0 flex flex-col gap-2">
                  <div class="flex justify-between gap-2">
                    <h3 class="text-[15px] font-medium truncate">{{ executiveProduct.name }}</h3>
                    <span class="font-label-caps text-[11px] shrink-0">{{ formatPrice((executiveProduct.price || 0) * executiveQty) }}</span>
                  </div>
                  <div class="inline-flex items-center border border-border-subtle rounded-full overflow-hidden self-start">
                    <button type="button" class="w-9 h-9 flex items-center justify-center" @click="bumpExecutive(-1)">
                      <span class="material-symbols-outlined text-[16px]">remove</span>
                    </button>
                    <span class="w-8 text-center font-label-caps text-[11px]">{{ executiveQty }}</span>
                    <button type="button" class="w-9 h-9 flex items-center justify-center" @click="bumpExecutive(1)">
                      <span class="material-symbols-outlined text-[16px]">add</span>
                    </button>
                  </div>
                </div>
              </li>
            </ul>
            <div class="bg-surface-container rounded-xl p-4 flex flex-col gap-2 text-sm">
              <div class="flex justify-between">
                <span class="text-on-surface-variant">Package total</span>
                <span class="font-label-caps text-label-caps">{{ teamTotal }} cards · {{ businessQty }}:{{ executiveQty }}</span>
              </div>
              <label v-if="subdomainEligible" class="flex flex-col gap-2 mt-1">
                <span class="font-label-caps text-[10px] uppercase tracking-widest text-primary">Optional custom subdomain</span>
                <input
                  v-model="subdomain"
                  type="text"
                  class="bg-surface border border-border-subtle rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
                  placeholder="cards.yourcompany.com"
                >
              </label>
              <p v-else class="font-label-caps text-[10px] uppercase tracking-widest text-ink-muted">
                Optional subdomain from {{ TEAM_SUBDOMAIN_THRESHOLD }}+ cards
              </p>
            </div>
          </template>

          <!-- Contact details (always shown) -->
          <div class="flex flex-col gap-3 border-t border-border-subtle pt-5">
            <h3 class="font-label-caps text-[11px] uppercase tracking-widest text-ink-muted">Your details</h3>
            <label class="flex flex-col gap-1.5">
              <span class="font-label-caps text-[10px] uppercase tracking-[0.2em] text-ink-muted">Full name</span>
              <input
                v-model="customerName"
                type="text"
                autocomplete="name"
                required
                class="w-full bg-surface-container-lowest border border-border-subtle rounded-lg px-3 py-3 text-sm focus:outline-none focus:border-primary"
              >
            </label>
            <label class="flex flex-col gap-1.5">
              <span class="font-label-caps text-[10px] uppercase tracking-[0.2em] text-ink-muted">Company name</span>
              <input
                v-model="customerCompany"
                type="text"
                autocomplete="organization"
                required
                class="w-full bg-surface-container-lowest border border-border-subtle rounded-lg px-3 py-3 text-sm focus:outline-none focus:border-primary"
              >
            </label>
            <label class="flex flex-col gap-1.5">
              <span class="font-label-caps text-[10px] uppercase tracking-[0.2em] text-ink-muted">Email</span>
              <input
                v-model="customerEmail"
                type="email"
                autocomplete="email"
                required
                class="w-full bg-surface-container-lowest border border-border-subtle rounded-lg px-3 py-3 text-sm focus:outline-none focus:border-primary"
                placeholder="you@example.com"
              >
            </label>
            <label class="flex flex-col gap-1.5">
              <span class="font-label-caps text-[10px] uppercase tracking-[0.2em] text-ink-muted">Cellphone number</span>
              <input
                v-model="customerPhone"
                type="tel"
                autocomplete="tel"
                required
                class="w-full bg-surface-container-lowest border border-border-subtle rounded-lg px-3 py-3 text-sm focus:outline-none focus:border-primary"
                placeholder="+264 81 000 0000"
              >
            </label>
            <label class="flex flex-col gap-1.5">
              <span class="font-label-caps text-[10px] uppercase tracking-[0.2em] text-ink-muted">Town</span>
              <input
                v-model="customerTown"
                type="text"
                autocomplete="address-level2"
                required
                class="w-full bg-surface-container-lowest border border-border-subtle rounded-lg px-3 py-3 text-sm focus:outline-none focus:border-primary"
              >
            </label>
          </div>

          <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
        </form>

        <div class="sticky bottom-0 bg-surface border-t border-border-subtle px-5 py-4 flex flex-col gap-3">
          <div class="flex justify-between items-baseline">
            <span class="font-button-text text-button-text uppercase tracking-widest text-sm">Total</span>
            <span class="font-display-lg text-[24px] font-semibold leading-none">{{ formatPrice(subtotal) }}</span>
          </div>
          <button
            type="button"
            class="w-full bg-primary text-on-primary py-4 font-button-text uppercase tracking-widest hover:opacity-90 disabled:opacity-60"
            :disabled="submitting"
            @click="requestQuote"
          >
            {{ submitting ? 'Sending quote…' : 'Place order' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
