<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import ShopHeader from '../components/ShopHeader.vue'
import ShopBottomNav from '../components/ShopBottomNav.vue'
import ConnectPackageDialog from '../components/ConnectPackageDialog.vue'
import {
  BUSINESS_CARD_ID,
  EXECUTIVE_CARD_ID,
  TEAM_PACKAGE_MIN,
  TEAM_SUBDOMAIN_THRESHOLD,
  formatPrice,
  getProduct,
  initialTeamMix,
  loadShopProducts
} from '../lib/shopCatalog'
import { setPageSeo } from '../lib/seo'

const route = useRoute()
const router = useRouter()
const menuOpen = ref(false)
const loading = ref(true)
const toast = ref('')
const checkoutOpen = ref(false)
const error = ref('')
const businessQty = ref(2)
const executiveQty = ref(3)
const subdomain = ref('')
const highlighted = ref('')
let toastTimer = null

const businessProduct = computed(() => getProduct(BUSINESS_CARD_ID))
const executiveProduct = computed(() => getProduct(EXECUTIVE_CARD_ID))
const teamTotal = computed(() => businessQty.value + executiveQty.value)
const subdomainEligible = computed(() => teamTotal.value >= TEAM_SUBDOMAIN_THRESHOLD)
const subtotal = computed(
  () =>
    (businessProduct.value?.price || 0) * businessQty.value +
    (executiveProduct.value?.price || 0) * executiveQty.value
)

function parseCopy(desc) {
  const raw = String(desc || '').replace(/\r\n/g, '\n').trim()
  if (!raw) return { about: '', features: [], footer: '' }

  const aboutMatch = raw.match(/ABOUT\s*([\s\S]*?)(?=FEATURES|$)/i)
  const featuresMatch = raw.match(/FEATURES\s*([\s\S]*?)$/i)
  let about = aboutMatch ? aboutMatch[1].trim() : ''
  let featuresBlock = featuresMatch ? featuresMatch[1].trim() : ''
  let footer = ''

  if (!aboutMatch && !featuresMatch) {
    about = raw
  }

  const featureLines = featuresBlock
    .split('\n')
    .map((line) => line.replace(/^[•\-\*]\s*/, '').trim())
    .filter(Boolean)

  // Trailing non-bullet line after features becomes footer tagline
  if (featureLines.length > 1 && !featuresBlock.split('\n').pop()?.trim().startsWith('•')) {
    const last = featureLines[featureLines.length - 1]
    if (last && !/^•/.test(last) && last.length > 20 && !last.toLowerCase().includes('min')) {
      // keep as feature unless it looks like a closing sentence without bullet in original
    }
  }

  const bullets = []
  const lines = (featuresBlock || '').split('\n').map((l) => l.trim()).filter(Boolean)
  for (const line of lines) {
    if (/^[•\-\*]/.test(line)) bullets.push(line.replace(/^[•\-\*]\s*/, ''))
    else if (bullets.length) footer = footer ? `${footer} ${line}` : line
    else about = about ? `${about}\n\n${line}` : line
  }

  return { about: about.trim(), features: bullets, footer: footer.trim() }
}

/** One package story — shared features; drop old size-range marketing lines. */
const packageCopy = computed(() => {
  const skip = /teams of\s*5|5\s*[–-]\s*10|5\s*[–-]\s*20|ideal for teams|built for larger teams/i
  const parts = [businessProduct.value, executiveProduct.value].map((p) => parseCopy(p?.desc))
  const about = `Business Class and Executive Class are one Connect Team package — mix any ratio, minimum ${TEAM_PACKAGE_MIN} cards total. Everyday charcoal for the floor team, matte black for leaders; shared catalogue, meeting booking, and linked profiles under one company. Logos print white on Business; Executive can carry colour. Optional custom subdomain from ${TEAM_SUBDOMAIN_THRESHOLD}+ cards.`

  const seen = new Set()
  const features = []
  for (const part of parts) {
    for (const line of part.features) {
      const key = line.toLowerCase()
      if (skip.test(line) || seen.has(key)) continue
      seen.add(key)
      features.push(line)
    }
  }
  if (!features.length) {
    features.push(
      `Mix Business & Executive freely (min ${TEAM_PACKAGE_MIN} total)`,
      'Shared products & services catalogue',
      'Meeting booking on every profile',
      'Team profiles linked under one company',
      `Optional custom subdomain from ${TEAM_SUBDOMAIN_THRESHOLD}+ cards`,
      'Once-off NFC cards that last like a bank card'
    )
  }
  const footer = parts.map((p) => p.footer).find(Boolean) || ''
  return { about, features, footer }
})

function applyFocus(focusId) {
  const mix = initialTeamMix(focusId)
  businessQty.value = mix.businessQty
  executiveQty.value = mix.executiveQty
  highlighted.value = focusId === EXECUTIVE_CARD_ID ? EXECUTIVE_CARD_ID : BUSINESS_CARD_ID
}

function shopAll() {
  menuOpen.value = false
  router.push({ path: '/', hash: '#connect-team' })
}

function showToast(msg) {
  toast.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.value = ''
  }, 2200)
}

function bumpBusiness(delta) {
  businessQty.value = Math.min(99, Math.max(0, businessQty.value + delta))
  error.value = ''
}

function bumpExecutive(delta) {
  executiveQty.value = Math.min(99, Math.max(0, executiveQty.value + delta))
  error.value = ''
}

function openCheckout() {
  error.value = ''
  if (teamTotal.value < TEAM_PACKAGE_MIN) {
    error.value = `Team packages need at least ${TEAM_PACKAGE_MIN} cards total (any mix).`
    return
  }
  checkoutOpen.value = true
}

function onPackageOrdered(payload) {
  showToast(
    payload?.quoteRef
      ? `Quote ${payload.quoteRef} emailed`
      : 'Quote emailed to you and auckmund@gmail.com'
  )
}

async function refresh() {
  loading.value = true
  await loadShopProducts()
  loading.value = false
  const focus = String(route.query.focus || '').trim()
  applyFocus(focus)
  setPageSeo({
    title: 'Connect Team package — tap-na',
    description:
      'Combine Business and Executive Connect cards in one team package. Minimum 5 cards total. Optional custom subdomain from 10+.',
    path: '/package/team'
  })
  await nextTick()
  if (focus === EXECUTIVE_CARD_ID || focus === BUSINESS_CARD_ID) {
    document.getElementById('package-hero')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

watch(
  () => route.query.focus,
  (focus) => applyFocus(String(focus || '').trim())
)

onMounted(async () => {
  document.documentElement.classList.add('shop-home')
  await refresh()
})

onUnmounted(() => {
  document.documentElement.classList.remove('shop-home')
  clearTimeout(toastTimer)
})
</script>

<template>
  <div class="shop-page bg-surface text-on-surface font-body-md text-body-md min-h-screen">
    <ShopHeader
      :menu-open="menuOpen"
      @toggle-menu="menuOpen = !menuOpen"
      @close-menu="menuOpen = false"
      @shop-all="shopAll"
    />

    <main class="pt-16 min-h-screen bg-surface pb-28 md:pb-12">
      <div class="max-w-6xl mx-auto px-margin-mobile md:px-margin-desktop pt-stack-md md:pt-10 flex flex-col gap-10">
        <button
          type="button"
          class="inline-flex items-center gap-1 text-on-surface-variant hover:text-primary mb-0 font-label-caps text-[11px] uppercase tracking-widest self-start"
          @click="router.push('/')"
        >
          <span class="material-symbols-outlined text-[18px]">arrow_back</span>
          Back to shop
        </button>

        <div class="flex flex-col gap-2 max-w-2xl">
          <p class="font-label-caps text-[11px] uppercase tracking-widest text-primary">Connect Team</p>
          <h1 class="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg uppercase">
            Team package
          </h1>
          <div class="h-1 w-12 bg-primary" />
          <p class="text-on-surface-variant text-sm mt-1">
            Business and Executive in one mixable pack. Minimum {{ TEAM_PACKAGE_MIN }} cards combined.
            Logos print white. Optional custom subdomain from {{ TEAM_SUBDOMAIN_THRESHOLD }}+ cards.
          </p>
        </div>

        <p v-if="loading" class="text-on-surface-variant py-10 text-center">Loading…</p>

        <template v-else>
          <section id="package-hero" class="flex flex-col gap-8 scroll-mt-24 max-w-4xl">
            <div class="grid grid-cols-2 gap-3 md:gap-6">
              <div
                class="aspect-[3/4] bg-surface-container rounded-xl overflow-hidden flex flex-col items-center justify-center p-4 md:p-6 transition-shadow"
                :class="{ 'ring-2 ring-primary': highlighted === BUSINESS_CARD_ID }"
              >
                <img
                  v-if="businessProduct?.image"
                  :src="businessProduct.image"
                  :alt="businessProduct.alt || businessProduct.name"
                  class="w-full h-full object-contain"
                >
                <p class="mt-2 font-label-caps text-[10px] md:text-[11px] uppercase tracking-widest text-ink-muted text-center">
                  {{ businessProduct?.name || 'Business' }}
                </p>
              </div>
              <div
                class="aspect-[3/4] bg-surface-container rounded-xl overflow-hidden flex flex-col items-center justify-center p-4 md:p-6 transition-shadow"
                :class="{ 'ring-2 ring-primary': highlighted === EXECUTIVE_CARD_ID }"
              >
                <img
                  v-if="executiveProduct?.image"
                  :src="executiveProduct.image"
                  :alt="executiveProduct.alt || executiveProduct.name"
                  class="w-full h-full object-contain"
                >
                <p class="mt-2 font-label-caps text-[10px] md:text-[11px] uppercase tracking-widest text-ink-muted text-center">
                  {{ executiveProduct?.name || 'Executive' }}
                </p>
              </div>
            </div>

            <div class="flex flex-col gap-4">
              <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div class="min-w-0">
                  <h2 class="font-headline-lg-mobile text-[28px] font-semibold">Connect Team package</h2>
                  <p class="text-on-surface-variant text-sm mt-1">
                    {{ businessProduct?.name || 'Business' }} + {{ executiveProduct?.name || 'Executive' }} · mix freely · min
                    {{ TEAM_PACKAGE_MIN }}
                  </p>
                </div>
                <div class="flex flex-col sm:items-end gap-0.5 shrink-0">
                  <span class="font-label-caps text-[11px] uppercase tracking-widest text-ink-muted">From</span>
                  <span class="font-label-caps text-label-caps">
                    {{
                      formatPrice(
                        Math.min(businessProduct?.price || 0, executiveProduct?.price || 0) ||
                          businessProduct?.price ||
                          executiveProduct?.price ||
                          0
                      )
                    }}
                    / card
                  </span>
                </div>
              </div>

              <div class="flex flex-col gap-2">
                <h3 class="font-label-caps text-[11px] uppercase tracking-widest text-ink-muted">About</h3>
                <p class="text-on-surface-variant text-sm leading-relaxed whitespace-pre-wrap">{{ packageCopy.about }}</p>
              </div>
              <div v-if="packageCopy.features.length" class="flex flex-col gap-2">
                <h3 class="font-label-caps text-[11px] uppercase tracking-widest text-ink-muted">Features</h3>
                <ul class="list-none p-0 m-0 flex flex-col gap-2">
                  <li
                    v-for="(item, i) in packageCopy.features"
                    :key="'f-' + i"
                    class="text-sm text-on-surface-variant flex gap-2"
                  >
                    <span class="text-primary shrink-0">•</span>
                    <span>{{ item }}</span>
                  </li>
                </ul>
              </div>
              <p v-if="packageCopy.footer" class="text-sm text-on-surface italic">{{ packageCopy.footer }}</p>
            </div>
          </section>

          <!-- Mix builder -->
          <section class="bg-surface-container rounded-xl p-6 md:p-8 flex flex-col gap-6 max-w-3xl">
            <div class="flex flex-col gap-1">
              <h2 class="font-label-caps text-label-caps uppercase tracking-widest">Build your mix</h2>
              <p class="text-on-surface-variant text-sm">
                Combine freely (e.g. 2:3, 1:4, 0:12). Total must be at least {{ TEAM_PACKAGE_MIN }}.
              </p>
            </div>

            <div class="flex flex-col gap-5 divide-y divide-border-subtle">
              <div class="flex items-center justify-between gap-4 pt-0">
                <div class="min-w-0">
                  <p class="font-medium">{{ businessProduct?.name || 'Business' }}</p>
                  <p class="font-label-caps text-[10px] uppercase tracking-widest text-ink-muted">
                    {{ formatPrice(businessProduct?.price || 0) }} each
                  </p>
                </div>
                <div class="inline-flex items-center border border-border-subtle rounded-full overflow-hidden bg-surface">
                  <button type="button" class="w-10 h-10 flex items-center justify-center" aria-label="Decrease Business" @click="bumpBusiness(-1)">
                    <span class="material-symbols-outlined text-[18px]">remove</span>
                  </button>
                  <span class="w-10 text-center font-label-caps text-[12px]">{{ businessQty }}</span>
                  <button type="button" class="w-10 h-10 flex items-center justify-center" aria-label="Increase Business" @click="bumpBusiness(1)">
                    <span class="material-symbols-outlined text-[18px]">add</span>
                  </button>
                </div>
              </div>
              <div class="flex items-center justify-between gap-4 pt-5">
                <div class="min-w-0">
                  <p class="font-medium">{{ executiveProduct?.name || 'Executive' }}</p>
                  <p class="font-label-caps text-[10px] uppercase tracking-widest text-ink-muted">
                    {{ formatPrice(executiveProduct?.price || 0) }} each
                  </p>
                </div>
                <div class="inline-flex items-center border border-border-subtle rounded-full overflow-hidden bg-surface">
                  <button type="button" class="w-10 h-10 flex items-center justify-center" aria-label="Decrease Executive" @click="bumpExecutive(-1)">
                    <span class="material-symbols-outlined text-[18px]">remove</span>
                  </button>
                  <span class="w-10 text-center font-label-caps text-[12px]">{{ executiveQty }}</span>
                  <button type="button" class="w-10 h-10 flex items-center justify-center" aria-label="Increase Executive" @click="bumpExecutive(1)">
                    <span class="material-symbols-outlined text-[18px]">add</span>
                  </button>
                </div>
              </div>
            </div>

            <div class="flex flex-col gap-2 text-sm">
              <div class="flex justify-between">
                <span class="text-on-surface-variant">Mix</span>
                <span class="font-label-caps text-[11px] uppercase tracking-widest">{{ businessQty }} : {{ executiveQty }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-on-surface-variant">Total cards</span>
                <span class="font-label-caps text-label-caps">{{ teamTotal }} <span class="text-ink-muted font-normal">(min {{ TEAM_PACKAGE_MIN }})</span></span>
              </div>
              <div class="flex justify-between items-baseline">
                <span class="font-button-text text-button-text uppercase tracking-widest text-sm">Subtotal</span>
                <span class="font-display-lg text-[28px] font-semibold leading-none">{{ formatPrice(subtotal) }}</span>
              </div>
            </div>

            <p v-if="!subdomainEligible" class="font-label-caps text-[10px] uppercase tracking-widest text-ink-muted">
              Optional custom subdomain from {{ TEAM_SUBDOMAIN_THRESHOLD }}+ cards
            </p>
            <label v-else class="flex flex-col gap-2">
              <span class="font-label-caps text-[10px] uppercase tracking-widest text-primary">Optional custom subdomain</span>
              <input
                v-model="subdomain"
                type="text"
                class="bg-surface border border-border-subtle rounded-lg px-3 py-3 text-sm focus:outline-none focus:border-primary"
                placeholder="cards.yourcompany.com"
                autocomplete="off"
              >
            </label>

            <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

            <div class="flex flex-col gap-3">
              <button
                type="button"
                class="w-full bg-primary text-on-primary py-4 font-button-text uppercase tracking-widest hover:opacity-90"
                @click="openCheckout"
              >
                Request quote
              </button>
            </div>
          </section>
        </template>
      </div>
    </main>

    <ShopBottomNav />

    <ConnectPackageDialog
      :open="checkoutOpen"
      mode="team"
      :focus-id="highlighted"
      :initial-business-qty="businessQty"
      :initial-executive-qty="executiveQty"
      @close="checkoutOpen = false"
      @ordered="onPackageOrdered"
    />

    <div
      v-if="toast"
      class="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-[60] bg-primary text-on-primary px-5 py-3 font-label-caps text-[11px] uppercase tracking-widest shadow-lg"
      role="status"
    >
      {{ toast }}
    </div>
  </div>
</template>

<style>
html.shop-home {
  scroll-behavior: smooth;
  scroll-padding-top: 5.5rem;
}
html.shop-home,
html.shop-home body {
  background-color: #f9f9f9 !important;
  color: #1a1c1c;
}
</style>