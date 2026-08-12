<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import ShopHeader from '../components/ShopHeader.vue'
import ConnectPackageDialog from '../components/ConnectPackageDialog.vue'
import {
  BUSINESS_CARD_ID,
  EXECUTIVE_CARD_ID,
  TEAM_BUSINESS_ALONE_MAX,
  TEAM_EXEC_SUBDOMAIN_MIN,
  TEAM_FREE_MIX_AFTER,
  TEAM_PACKAGE_MIN,
  isTeamExecutiveBridge,
  formatPrice,
  getProduct,
  initialTeamMix,
  isTeamSubdomainEligible,
  loadShopProducts,
  canApplyTeamMix,
  isTeamMixOrderReady,
  validateTeamMix
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
const subdomainEligible = computed(() => isTeamSubdomainEligible(executiveQty.value))
const teamOrderReady = computed(() => isTeamMixOrderReady(businessQty.value, executiveQty.value))
const inExecutiveBridge = computed(() => isTeamExecutiveBridge(teamTotal.value))
const cardsNeededForMin = computed(() => Math.max(0, TEAM_PACKAGE_MIN - teamTotal.value))
const mixStatusLabel = computed(() => {
  if (teamTotal.value < TEAM_PACKAGE_MIN) {
    const n = cardsNeededForMin.value
    return `Add ${n} more card${n === 1 ? '' : 's'} to reach the ${TEAM_PACKAGE_MIN}-card minimum`
  }
  if (!teamOrderReady.value) return 'Adjust the mix to continue'
  return `${teamTotal.value} cards · ready to order`
})
const mixHint = computed(() => {
  if (teamTotal.value < TEAM_PACKAGE_MIN) {
    return `Team packages start at ${TEAM_PACKAGE_MIN} cards. Use +/− or a quick start below.`
  }
  if (inExecutiveBridge.value) {
    return `Next cards through ${TEAM_FREE_MIX_AFTER} must be Executive. Business + is paused until then.`
  }
  if (executiveQty.value === 0 && businessQty.value >= TEAM_BUSINESS_ALONE_MAX) {
    return `Business alone tops out at ${TEAM_BUSINESS_ALONE_MAX}. Add Executive to grow further.`
  }
  if (!subdomainEligible.value) {
    const need = TEAM_EXEC_SUBDOMAIN_MIN - executiveQty.value
    return `Add ${need} more Executive card${need === 1 ? '' : 's'} to unlock an optional company subdomain.`
  }
  return 'Optional company subdomain unlocked below.'
})
const canAddBusiness = computed(() => {
  if (inExecutiveBridge.value) return false
  return canApplyTeamMix(businessQty.value + 1, executiveQty.value)
})
const canRemoveBusiness = computed(() => businessQty.value > 0)
const canAddExecutive = computed(() => canApplyTeamMix(businessQty.value, executiveQty.value + 1))
const canRemoveExecutive = computed(
  () => executiveQty.value > 0 && canApplyTeamMix(businessQty.value, executiveQty.value - 1)
)
const businessAddTitle = computed(() => {
  if (inExecutiveBridge.value) {
    return `Cards 11–${TEAM_FREE_MIX_AFTER} must be Executive — use + on Executive`
  }
  if (!canAddBusiness.value) {
    return validateTeamMix(businessQty.value + 1, executiveQty.value, { enforceMin: false }).error || 'Cannot add Business'
  }
  return 'Add one Business card'
})
const executiveRemoveTitle = computed(() => {
  if (executiveQty.value <= 0) return 'No Executive cards to remove'
  if (!canRemoveExecutive.value) {
    return (
      validateTeamMix(businessQty.value, executiveQty.value - 1, { enforceMin: false }).error ||
      'Cannot remove Executive'
    )
  }
  return 'Remove one Executive card'
})
const placeOrderLabel = computed(() => {
  if (teamTotal.value < TEAM_PACKAGE_MIN) {
    const n = cardsNeededForMin.value
    return `Add ${n} more card${n === 1 ? '' : 's'} to order`
  }
  if (!teamOrderReady.value) return 'Fix mix to order'
  return 'Place order'
})
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

const businessCopy = computed(() => parseCopy(businessProduct.value?.desc))
const executiveCopy = computed(() => parseCopy(executiveProduct.value?.desc))

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

function showToast(msg, ms = 4500) {
  toast.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.value = ''
  }, ms)
}

function bumpBusiness(delta) {
  const next = Math.min(99, Math.max(0, businessQty.value + delta))
  if (next === businessQty.value) return
  if (delta > 0 && inExecutiveBridge.value) {
    showToast(`Cards 11–${TEAM_FREE_MIX_AFTER} must be Executive. Use + on Executive instead.`)
    return
  }
  const check = validateTeamMix(next, executiveQty.value, { enforceMin: false })
  if (!check.ok) {
    error.value = check.error
    showToast(check.error)
    return
  }
  businessQty.value = next
  error.value = ''
}

function bumpExecutive(delta) {
  const next = Math.min(99, Math.max(0, executiveQty.value + delta))
  if (next === executiveQty.value) return
  const check = validateTeamMix(businessQty.value, next, { enforceMin: false })
  if (!check.ok) {
    error.value = check.error
    showToast(check.error)
    return
  }
  executiveQty.value = next
  error.value = ''
}

function setTeamMix(business, executive) {
  const b = Math.max(0, Math.floor(Number(business) || 0))
  const e = Math.max(0, Math.floor(Number(executive) || 0))
  const check = validateTeamMix(b, e, { enforceMin: true })
  if (!check.ok) {
    error.value = check.error
    showToast(check.error)
    return
  }
  businessQty.value = b
  executiveQty.value = e
  error.value = ''
}

function openCheckout() {
  error.value = ''
  const check = validateTeamMix(businessQty.value, executiveQty.value)
  if (!check.ok) {
    error.value = check.error
    showToast(check.error)
    return
  }
  checkoutOpen.value = true
}

function onPackageOrdered(payload) {
  if (payload?.addedToCart) {
    showToast('Added to cart')
    router.push('/cart')
    return
  }
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
      'Combine Business and Executive Connect cards. Business alone max 10. Free mix to 10. Cards 11–15 must be Executive, then mix freely. Subdomain from 5 Executive.',
    path: '/package/team'
  })
  await nextTick()
  if (focus === EXECUTIVE_CARD_ID) {
    document.getElementById('exec-block')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  } else if (focus === BUSINESS_CARD_ID) {
    document.getElementById('business-block')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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

    <main class="pt-16 min-h-screen bg-surface pb-12">
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
            Business and Executive in one mixable pack. Min {{ TEAM_PACKAGE_MIN }} combined.
            Business alone max {{ TEAM_BUSINESS_ALONE_MAX }}. Cards 11–{{ TEAM_FREE_MIX_AFTER }} must be Executive, then free mix. Subdomain from {{ TEAM_EXEC_SUBDOMAIN_MIN }} Executive.
          </p>
        </div>

        <p v-if="loading" class="text-on-surface-variant py-10 text-center">Loading…</p>

        <template v-else>
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14">
            <!-- Business -->
            <section
              id="business-block"
              class="flex flex-col gap-5 scroll-mt-24"
              :class="{ 'ring-2 ring-primary rounded-xl p-4 -m-4': highlighted === BUSINESS_CARD_ID }"
            >
              <div class="aspect-[3/4] max-h-[420px] bg-surface-container rounded-xl overflow-hidden flex items-center justify-center p-6">
                <img
                  v-if="businessProduct?.image"
                  :src="businessProduct.image"
                  :alt="businessProduct.alt || businessProduct.name"
                  class="w-full h-full object-contain"
                >
              </div>
              <div class="flex flex-col gap-2">
                <p v-if="businessProduct?.label" class="font-label-caps text-[11px] uppercase tracking-widest text-primary">
                  {{ businessProduct.label }}
                </p>
                <div class="flex justify-between items-start gap-3">
                  <h2 class="font-headline-lg-mobile text-[28px] font-semibold">
                    {{ businessProduct?.name || 'Business' }}
                  </h2>
                  <span class="font-label-caps text-label-caps shrink-0">
                    {{ formatPrice(businessProduct?.price || 0) }}
                  </span>
                </div>
              </div>
              <div v-if="businessCopy.about" class="flex flex-col gap-2">
                <h3 class="font-label-caps text-[11px] uppercase tracking-widest text-ink-muted">About</h3>
                <p class="text-on-surface-variant text-sm leading-relaxed whitespace-pre-wrap">{{ businessCopy.about }}</p>
              </div>
              <div v-if="businessCopy.features.length" class="flex flex-col gap-2">
                <h3 class="font-label-caps text-[11px] uppercase tracking-widest text-ink-muted">Features</h3>
                <ul class="list-none p-0 m-0 flex flex-col gap-2">
                  <li
                    v-for="(item, i) in businessCopy.features"
                    :key="'b-' + i"
                    class="text-sm text-on-surface-variant flex gap-2"
                  >
                    <span class="text-primary shrink-0">•</span>
                    <span>{{ item }}</span>
                  </li>
                </ul>
              </div>
              <p v-if="businessCopy.footer" class="text-sm text-on-surface italic">{{ businessCopy.footer }}</p>
              <div v-if="!businessCopy.about && businessProduct?.desc" class="text-on-surface-variant text-sm whitespace-pre-wrap">
                {{ businessProduct.desc }}
              </div>
            </section>

            <!-- Executive -->
            <section
              id="exec-block"
              class="flex flex-col gap-5 scroll-mt-24"
              :class="{ 'ring-2 ring-primary rounded-xl p-4 -m-4': highlighted === EXECUTIVE_CARD_ID }"
            >
              <div class="aspect-[3/4] max-h-[420px] bg-surface-container rounded-xl overflow-hidden flex items-center justify-center p-6">
                <img
                  v-if="executiveProduct?.image"
                  :src="executiveProduct.image"
                  :alt="executiveProduct.alt || executiveProduct.name"
                  class="w-full h-full object-contain"
                >
              </div>
              <div class="flex flex-col gap-2">
                <p v-if="executiveProduct?.label" class="font-label-caps text-[11px] uppercase tracking-widest text-primary">
                  {{ executiveProduct.label }}
                </p>
                <div class="flex justify-between items-start gap-3">
                  <h2 class="font-headline-lg-mobile text-[28px] font-semibold">
                    {{ executiveProduct?.name || 'Executive' }}
                  </h2>
                  <span class="font-label-caps text-label-caps shrink-0">
                    {{ formatPrice(executiveProduct?.price || 0) }}
                  </span>
                </div>
              </div>
              <div v-if="executiveCopy.about" class="flex flex-col gap-2">
                <h3 class="font-label-caps text-[11px] uppercase tracking-widest text-ink-muted">About</h3>
                <p class="text-on-surface-variant text-sm leading-relaxed whitespace-pre-wrap">{{ executiveCopy.about }}</p>
              </div>
              <div v-if="executiveCopy.features.length" class="flex flex-col gap-2">
                <h3 class="font-label-caps text-[11px] uppercase tracking-widest text-ink-muted">Features</h3>
                <ul class="list-none p-0 m-0 flex flex-col gap-2">
                  <li
                    v-for="(item, i) in executiveCopy.features"
                    :key="'e-' + i"
                    class="text-sm text-on-surface-variant flex gap-2"
                  >
                    <span class="text-primary shrink-0">•</span>
                    <span>{{ item }}</span>
                  </li>
                </ul>
              </div>
              <p v-if="executiveCopy.footer" class="text-sm text-on-surface italic">{{ executiveCopy.footer }}</p>
              <div v-if="!executiveCopy.about && executiveProduct?.desc" class="text-on-surface-variant text-sm whitespace-pre-wrap">
                {{ executiveProduct.desc }}
              </div>
            </section>
          </div>

          <!-- Mix builder -->
          <section class="bg-surface-container rounded-xl p-6 md:p-8 flex flex-col gap-6 max-w-3xl">
            <div class="flex flex-col gap-1">
              <h2 class="font-label-caps text-label-caps uppercase tracking-widest">Choose your cards</h2>
              <p
                class="text-sm font-medium leading-snug"
                :class="teamOrderReady ? 'text-on-surface' : 'text-amber-800'"
                aria-live="polite"
              >
                {{ mixStatusLabel }}
              </p>
              <p class="text-on-surface-variant text-sm">{{ mixHint }}</p>
            </div>

            <div class="flex flex-wrap gap-2" role="group" aria-label="Quick start mixes">
              <button
                type="button"
                class="px-3 py-2 rounded-full border text-[11px] font-medium transition-colors"
                :class="businessQty === 5 && executiveQty === 0 ? 'border-primary bg-primary text-on-primary' : 'border-border-subtle bg-surface hover:border-primary'"
                @click="setTeamMix(5, 0)"
              >
                5 Business
              </button>
              <button
                type="button"
                class="px-3 py-2 rounded-full border text-[11px] font-medium transition-colors"
                :class="businessQty === 0 && executiveQty === 5 ? 'border-primary bg-primary text-on-primary' : 'border-border-subtle bg-surface hover:border-primary'"
                @click="setTeamMix(0, 5)"
              >
                5 Executive
              </button>
              <button
                type="button"
                class="px-3 py-2 rounded-full border text-[11px] font-medium transition-colors"
                :class="businessQty === 2 && executiveQty === 3 ? 'border-primary bg-primary text-on-primary' : 'border-border-subtle bg-surface hover:border-primary'"
                @click="setTeamMix(2, 3)"
              >
                2 Business + 3 Executive
              </button>
            </div>

            <div class="flex flex-col gap-3">
              <div class="rounded-xl border border-border-subtle bg-surface p-4 flex flex-col gap-3">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="font-medium text-[15px]">Business</p>
                    <p class="text-[12px] text-on-surface-variant mt-0.5">Charcoal · logo black &amp; white</p>
                    <p class="text-[12px] text-on-surface mt-1">{{ formatPrice(businessProduct?.price || 0) }} each</p>
                  </div>
                  <div class="text-right shrink-0">
                    <p class="font-label-caps text-[9px] uppercase tracking-widest text-ink-muted">Line total</p>
                    <p class="text-[14px] font-medium mt-0.5">{{ formatPrice((businessProduct?.price || 0) * businessQty) }}</p>
                  </div>
                </div>
                <div class="flex items-center justify-between gap-3">
                  <span class="text-[12px] text-on-surface-variant">How many?</span>
                  <div class="inline-flex items-center border border-border-subtle rounded-full overflow-hidden bg-surface-container">
                    <button
                      type="button"
                      class="w-10 h-10 flex items-center justify-center disabled:opacity-35"
                      aria-label="Remove one Business card"
                      :disabled="!canRemoveBusiness"
                      @click="bumpBusiness(-1)"
                    >
                      <span class="material-symbols-outlined text-[18px]" aria-hidden="true">remove</span>
                    </button>
                    <span class="min-w-[4.25rem] px-1 text-center text-[13px] font-medium tabular-nums" aria-live="polite">
                      {{ businessQty }}
                      <span class="block text-[9px] font-label-caps uppercase tracking-widest text-ink-muted font-normal -mt-0.5">{{ businessQty === 1 ? 'card' : 'cards' }}</span>
                    </span>
                    <button
                      type="button"
                      class="w-10 h-10 flex items-center justify-center disabled:opacity-35"
                      :aria-label="businessAddTitle"
                      :title="businessAddTitle"
                      :disabled="!canAddBusiness"
                      @click="bumpBusiness(1)"
                    >
                      <span class="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
                    </button>
                  </div>
                </div>
              </div>

              <div class="rounded-xl border border-border-subtle bg-surface p-4 flex flex-col gap-3">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="font-medium text-[15px]">Executive</p>
                    <p class="text-[12px] text-on-surface-variant mt-0.5">Matte black · logo black &amp; white</p>
                    <p class="text-[12px] text-on-surface mt-1">{{ formatPrice(executiveProduct?.price || 0) }} each</p>
                  </div>
                  <div class="text-right shrink-0">
                    <p class="font-label-caps text-[9px] uppercase tracking-widest text-ink-muted">Line total</p>
                    <p class="text-[14px] font-medium mt-0.5">{{ formatPrice((executiveProduct?.price || 0) * executiveQty) }}</p>
                  </div>
                </div>
                <div class="flex items-center justify-between gap-3">
                  <span class="text-[12px] text-on-surface-variant">How many?</span>
                  <div
                    class="inline-flex items-center border rounded-full overflow-hidden bg-surface-container"
                    :class="inExecutiveBridge ? 'border-primary' : 'border-border-subtle'"
                  >
                    <button
                      type="button"
                      class="w-10 h-10 flex items-center justify-center disabled:opacity-35"
                      :aria-label="executiveRemoveTitle"
                      :title="executiveRemoveTitle"
                      :disabled="!canRemoveExecutive"
                      @click="bumpExecutive(-1)"
                    >
                      <span class="material-symbols-outlined text-[18px]" aria-hidden="true">remove</span>
                    </button>
                    <span class="min-w-[4.25rem] px-1 text-center text-[13px] font-medium tabular-nums" aria-live="polite">
                      {{ executiveQty }}
                      <span class="block text-[9px] font-label-caps uppercase tracking-widest text-ink-muted font-normal -mt-0.5">{{ executiveQty === 1 ? 'card' : 'cards' }}</span>
                    </span>
                    <button
                      type="button"
                      class="w-10 h-10 flex items-center justify-center disabled:opacity-35"
                      aria-label="Add one Executive card"
                      :disabled="!canAddExecutive"
                      @click="bumpExecutive(1)"
                    >
                      <span class="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="flex flex-col gap-2 text-sm">
              <div class="flex justify-between">
                <span class="text-on-surface-variant">Mix</span>
                <span class="font-label-caps text-[11px] uppercase tracking-widest">{{ businessQty }} Business · {{ executiveQty }} Executive</span>
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
              Optional custom subdomain from {{ TEAM_EXEC_SUBDOMAIN_MIN }}+ Executive cards
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

            <div class="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                class="flex-1 bg-primary text-on-primary py-4 font-button-text uppercase tracking-widest hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="!teamOrderReady"
                @click="openCheckout"
              >
                {{ placeOrderLabel }}
              </button>
              <RouterLink
                to="/cart"
                class="flex-1 text-center border border-primary text-primary py-4 font-button-text uppercase tracking-widest no-underline hover:bg-primary hover:text-on-primary transition-colors"
              >
                View cart
              </RouterLink>
            </div>
          </section>
        </template>
      </div>
    </main>

    <ConnectPackageDialog
      :open="checkoutOpen"
      mode="team"
      :focus-id="highlighted"
      :initial-business-qty="businessQty"
      :initial-executive-qty="executiveQty"
      :initial-subdomain="subdomain"
      @close="checkoutOpen = false"
      @ordered="onPackageOrdered"
    />

    <div
      v-if="toast"
      class="fixed left-1/2 top-6 z-[120] w-[min(92vw,28rem)] -translate-x-1/2 rounded-xl bg-primary text-on-primary px-5 py-4 shadow-2xl"
      role="alert"
      aria-live="assertive"
    >
      <div class="flex items-start gap-3">
        <span class="material-symbols-outlined shrink-0 mt-0.5" aria-hidden="true">error</span>
        <p class="flex-1 text-sm font-medium leading-snug normal-case tracking-normal">{{ toast }}</p>
        <button
          type="button"
          class="shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/15 border-0 bg-transparent text-on-primary cursor-pointer"
          aria-label="Dismiss"
          @click="toast = ''"
        >
          <span class="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>
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