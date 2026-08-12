<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import {
  BUSINESS_CARD_ID,
  EXECUTIVE_CARD_ID,
  TEAM_BUSINESS_ALONE_MAX,
  TEAM_EXEC_SUBDOMAIN_MIN,
  TEAM_PACKAGE_MIN,
  SOLO_PACKAGE_MAX,
  TEAM_FREE_MIX_AFTER,
  TEAM_SCALE_THRESHOLD,
  isTeamExecutiveBridge,
  formatPrice,
  getProduct,
  initialTeamMix,
  isTeamSubdomainEligible,
  minExecutiveForTeamTotal,
  canApplyTeamMix,
  isTeamMixOrderReady,
  validateTeamMix
} from '../lib/shopCatalog'
import { addToCart, removeFromCart, setTeamPackage } from '../lib/cartStore'

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

const emit = defineEmits(['close', 'ordered', 'added-to-cart', 'switch-to-team'])

const soloQty = ref(1)
const businessQty = ref(2)
const executiveQty = ref(3)
const subdomain = ref('')
const error = ref('')
const notice = ref('')
const soloLimitOpen = ref(false)
let noticeTimer = null
const submitting = ref(false)

const isTeam = computed(() => props.mode === 'team')
const soloProduct = computed(() => getProduct(props.soloProductId || props.focusId || 'blue-card'))
const businessProduct = computed(() => getProduct(BUSINESS_CARD_ID))
const executiveProduct = computed(() => getProduct(EXECUTIVE_CARD_ID))
const teamTotal = computed(() => businessQty.value + executiveQty.value)
const teamMixCheck = computed(() => validateTeamMix(businessQty.value, executiveQty.value))
const teamOrderReady = computed(() => isTeamMixOrderReady(businessQty.value, executiveQty.value))
const inExecutiveBridge = computed(() => isTeamExecutiveBridge(teamTotal.value))
const minExecutiveNeeded = computed(() => minExecutiveForTeamTotal(teamTotal.value))
const subdomainEligible = computed(() => isTeamSubdomainEligible(executiveQty.value))
const soloSubtotal = computed(() => (soloProduct.value?.price || 0) * soloQty.value)
const teamSubtotal = computed(
  () =>
    (businessProduct.value?.price || 0) * businessQty.value +
    (executiveProduct.value?.price || 0) * executiveQty.value
)
const subtotal = computed(() => (isTeam.value ? teamSubtotal.value : soloSubtotal.value))
const title = computed(() => (isTeam.value ? 'Connect Teams package' : 'Connect Solo'))
const itemCount = computed(() => (isTeam.value ? teamTotal.value : soloQty.value))
const cardsNeededForMin = computed(() => Math.max(0, TEAM_PACKAGE_MIN - teamTotal.value))
const mixStatusLabel = computed(() => {
  if (teamTotal.value < TEAM_PACKAGE_MIN) {
    const n = cardsNeededForMin.value
    return `Add ${n} more card${n === 1 ? '' : 's'} to reach the ${TEAM_PACKAGE_MIN}-card minimum`
  }
  if (!teamOrderReady.value) return 'Adjust the mix to continue'
  return `Minimum order ${TEAM_PACKAGE_MIN} cards (Mix)`
})
const mixHint = computed(() => {
  if (teamTotal.value < TEAM_PACKAGE_MIN) {
    return `Team packages start at ${TEAM_PACKAGE_MIN} cards.`
  }
  if (inExecutiveBridge.value) {
    return `Next cards through ${TEAM_FREE_MIX_AFTER} must be Executive. Business + is paused until then.`
  }
  if (executiveQty.value === 0 && businessQty.value >= TEAM_BUSINESS_ALONE_MAX) {
    return `Business alone tops out at ${TEAM_BUSINESS_ALONE_MAX}. Add Executive to grow further.`
  }
  return ''
})
const businessLineTotal = computed(() => (businessProduct.value?.price || 0) * businessQty.value)
const executiveLineTotal = computed(() => (executiveProduct.value?.price || 0) * executiveQty.value)
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
const placeOrderDisabled = computed(() => {
  if (submitting.value) return true
  if (isTeam.value && !teamOrderReady.value) return true
  return false
})
const placeOrderLabel = computed(() => {
  if (submitting.value) return 'Adding…'
  if (isTeam.value && teamTotal.value < TEAM_PACKAGE_MIN) {
    const n = cardsNeededForMin.value
    return `Add ${n} more card${n === 1 ? '' : 's'} to cart`
  }
  if (isTeam.value && !teamOrderReady.value) return 'Fix mix to add'
  return 'Add to cart'
})
const compareOpen = ref(false)


let previousHtmlOverflow = ''
let previousBodyOverflow = ''

function lockPageScroll(lock) {
  if (typeof document === 'undefined') return
  const html = document.documentElement
  const body = document.body
  if (lock) {
    previousHtmlOverflow = html.style.overflow
    previousBodyOverflow = body.style.overflow
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
  } else {
    html.style.overflow = previousHtmlOverflow
    body.style.overflow = previousBodyOverflow
  }
}

watch(
  () => props.open,
  (open) => {
    lockPageScroll(!!open)
  },
  { immediate: true }
)

onUnmounted(() => {
  lockPageScroll(false)
  clearTimeout(noticeTimer)
})

watch(
  () => [props.open, props.mode, props.focusId],
  ([open]) => {
    if (!open) return
    error.value = ''
    notice.value = ''
    soloLimitOpen.value = false
    compareOpen.value = false
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
      soloQty.value = Math.min(SOLO_PACKAGE_MAX, Math.max(1, Math.floor(Number(props.initialSoloQty) || 1)))
    }
  }
)

function showNotice(msg) {
  notice.value = String(msg || '').trim()
  clearTimeout(noticeTimer)
  if (!notice.value) return
  noticeTimer = setTimeout(() => {
    notice.value = ''
  }, 4500)
}

function bumpSolo(delta) {
  const next = Math.min(SOLO_PACKAGE_MAX, Math.max(1, soloQty.value + delta))
  if (delta > 0 && soloQty.value >= SOLO_PACKAGE_MAX) {
    soloLimitOpen.value = true
    return
  }
  soloQty.value = next
  error.value = ''
  soloLimitOpen.value = false
}
function closeSoloLimit() {
  soloLimitOpen.value = false
}
function switchToTeam() {
  soloLimitOpen.value = false
  emit('switch-to-team')
}
function bumpBusiness(delta) {
  const next = Math.min(99, Math.max(0, businessQty.value + delta))
  if (next === businessQty.value) return
  if (delta > 0 && inExecutiveBridge.value) {
    showNotice(`Cards 11–${TEAM_FREE_MIX_AFTER} must be Executive. Use + on Executive instead.`)
    return
  }
  const check = validateTeamMix(next, executiveQty.value, { enforceMin: false })
  if (!check.ok) {
    error.value = check.error
    showNotice(check.error)
    return
  }
  businessQty.value = next
  error.value = ''
  notice.value = ''
}
function bumpExecutive(delta) {
  const next = Math.min(99, Math.max(0, executiveQty.value + delta))
  if (next === executiveQty.value) return
  const check = validateTeamMix(businessQty.value, next, { enforceMin: false })
  if (!check.ok) {
    error.value = check.error
    showNotice(check.error)
    return
  }
  executiveQty.value = next
  error.value = ''
  notice.value = ''
}
function setTeamMix(business, executive) {
  const b = Math.max(0, Math.floor(Number(business) || 0))
  const e = Math.max(0, Math.floor(Number(executive) || 0))
  const check = validateTeamMix(b, e, { enforceMin: true })
  if (!check.ok) {
    error.value = check.error
    showNotice(check.error)
    return
  }
  businessQty.value = b
  executiveQty.value = e
  error.value = ''
  notice.value = ''
}
function close() {
  emit('close')
}

async function addPackageToCart() {
  error.value = ''
  if (isTeam.value) {
    const check = validateTeamMix(businessQty.value, executiveQty.value)
    if (!check.ok) {
      error.value = check.error
      showNotice(check.error)
      return
    }
  } else if (soloQty.value > SOLO_PACKAGE_MAX) {
    soloLimitOpen.value = true
    return
  }

  submitting.value = true
  try {
    let ok = false
    if (isTeam.value) {
      ok = setTeamPackage({
        businessQty: businessQty.value,
        executiveQty: executiveQty.value,
        subdomain: subdomainEligible.value ? subdomain.value.trim() : ''
      })
    } else {
      const id = soloProduct.value?.id
      if (!id) {
        error.value = 'Product unavailable.'
        return
      }
      removeFromCart(id)
      ok = addToCart(id, soloQty.value)
    }
    if (!ok) {
      error.value = 'Could not add to cart. Check quantities and try again.'
      showNotice(error.value)
      return
    }
    emit('added-to-cart', {
      mode: isTeam.value ? 'team' : 'solo',
      total: itemCount.value
    })
    // Keep ordered for older listeners
    emit('ordered', {
      mode: isTeam.value ? 'team' : 'solo',
      total: itemCount.value,
      addedToCart: true
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
      <div class="relative w-full sm:max-w-lg max-h-[92vh] bg-surface text-on-surface rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div class="shrink-0 z-10 bg-surface/95 backdrop-blur-md border-b border-border-subtle px-5 py-4 flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 class="font-headline-lg-mobile text-[22px] font-medium uppercase tracking-tight">{{ title }}</h2>
            <p class="text-on-surface-variant text-sm mt-1">
              {{ isTeam ? 'Pick how many Business and Executive cards you need (min 5 total)' : `Professional · 1–${SOLO_PACKAGE_MAX} cards` }}
            </p>
          </div>
          <button
            type="button"
            class="w-10 h-10 shrink-0 flex items-center justify-center rounded-full hover:bg-surface-container"
            aria-label="Close"
            @click="close"
          >
            <span class="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
        </div>

        <form class="px-5 py-5 flex flex-col gap-5 overflow-y-auto flex-1 min-h-0" @submit.prevent="addPackageToCart">
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
                  <button type="button" class="w-10 h-10 flex items-center justify-center" aria-label="Decrease quantity" @click="bumpSolo(-1)">
                    <span class="material-symbols-outlined text-[18px]" aria-hidden="true">remove</span>
                  </button>
                  <span class="min-w-[3.5rem] px-1 text-center text-[13px] font-medium tabular-nums" aria-live="polite">
                    {{ soloQty }}
                    <span class="block text-[9px] font-label-caps uppercase tracking-widest text-ink-muted font-normal -mt-0.5">cards</span>
                  </span>
                  <button type="button" class="w-10 h-10 flex items-center justify-center" aria-label="Increase quantity" @click="bumpSolo(1)">
                    <span class="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
                  </button>
                </div>
              </div>
            </div>

          <!-- Solo summary -->
          <div v-if="!isTeam" class="bg-surface-container rounded-xl p-4 flex flex-col gap-3">
            <div class="flex items-baseline justify-between gap-3">
              <h3 class="font-label-caps text-[11px] uppercase tracking-widest text-ink-muted">Summary</h3>
              <span class="font-label-caps text-[10px] uppercase tracking-widest text-on-surface">{{ soloQty }} / {{ SOLO_PACKAGE_MAX }} cards</span>
            </div>
            <table class="w-full text-left text-[12px] border-collapse">
              <thead>
                <tr class="border-b border-border-subtle">
                  <th class="py-2 pr-2 font-label-caps text-[9px] uppercase tracking-widest text-ink-muted font-medium">Feature</th>
                  <th class="py-2 px-1 font-label-caps text-[9px] uppercase tracking-widest text-ink-muted font-medium text-center whitespace-nowrap">Solo</th>
                  <th class="py-2 pl-1 font-label-caps text-[9px] uppercase tracking-widest text-ink-muted font-medium text-center whitespace-nowrap">Connect Team</th>
                </tr>
              </thead>
              <tbody class="text-on-surface-variant">
                <tr class="border-b border-border-subtle/60">
                  <td class="py-2 pr-2 text-on-surface">NFC + QR → live digital profile</td>
                  <td class="py-2 px-1 text-center text-primary">✓</td>
                  <td class="py-2 pl-1 text-center text-primary">✓</td>
                </tr>
                <tr class="border-b border-border-subtle/60">
                  <td class="py-2 pr-2 text-on-surface">Once-off (no monthly fee)</td>
                  <td class="py-2 px-1 text-center text-primary">✓</td>
                  <td class="py-2 pl-1 text-center text-primary">✓</td>
                </tr>
                <tr class="border-b border-border-subtle/60">
                  <td class="py-2 pr-2 text-on-surface">Catalogue &amp; book meeting</td>
                  <td class="py-2 px-1 text-center text-primary">✓</td>
                  <td class="py-2 pl-1 text-center text-primary">✓</td>
                </tr>
                <tr class="border-b border-border-subtle/60">
                  <td class="py-2 pr-2 text-on-surface">Custom logo on card</td>
                  <td class="py-2 px-1 text-center">—</td>
                  <td class="py-2 pl-1 text-center text-primary text-[11px] leading-snug">Black &amp; White</td>
                </tr>
                <tr class="border-b border-border-subtle/60">
                  <td class="py-2 pr-2 text-on-surface">Team profiles </td>
                  <td class="py-2 px-1 text-center">—</td>
                  <td class="py-2 pl-1 text-center text-primary">✓</td>
                </tr>
                <tr class="border-b border-border-subtle/60">
                  <td class="py-2 pr-2 text-on-surface">Quantity</td>
                  <td class="py-2 px-1 text-center text-primary text-[11px] leading-snug">Up to {{ SOLO_PACKAGE_MAX }}</td>
                  <td class="py-2 pl-1 text-center text-primary text-[11px] leading-snug">Min {{ TEAM_PACKAGE_MIN }}</td>
                </tr>
                <tr>
                  <td class="py-2 pr-2 text-on-surface">Custom subdomain</td>
                  <td class="py-2 px-1 text-center">—</td>
                  <td class="py-2 pl-1 text-center text-primary text-[11px] leading-snug">From {{ TEAM_EXEC_SUBDOMAIN_MIN }} Executive</td>
                </tr>
              </tbody>
            </table>
            <p class="text-[11px] text-on-surface-variant leading-snug">
              Need {{ TEAM_PACKAGE_MIN }}+ cards or a shared team? Choose Connect Team (Business package).
            </p>
            <button
              type="button"
              class="w-full border border-primary text-primary py-3 font-button-text text-[11px] uppercase tracking-widest hover:bg-primary hover:text-on-primary transition-colors"
              @click="switchToTeam"
            >
              View Connect Team
            </button>
          </div>

          </template>

          <!-- Team lines -->
          <template v-else-if="isTeam">
            <section class="flex flex-col gap-4" aria-labelledby="team-mix-heading">
              <div class="flex flex-col gap-1">
                <h3 id="team-mix-heading" class="font-label-caps text-[11px] uppercase tracking-widest text-ink-muted">
                  Choose your cards
                </h3>
                <p
                  class="text-sm font-medium leading-snug"
                  :class="teamOrderReady ? 'text-on-surface' : 'text-amber-800'"
                  aria-live="polite"
                >
                  {{ mixStatusLabel }}
                </p>
                <p v-if="mixHint" class="text-[12px] text-on-surface-variant leading-snug">{{ mixHint }}</p>
              </div>

              <ul class="flex flex-col gap-3 list-none p-0 m-0">
                <li v-if="businessProduct" class="rounded-xl border border-border-subtle bg-surface-container-lowest p-3.5 flex gap-3">
                  <div class="w-16 h-16 shrink-0 bg-surface-container rounded-lg overflow-hidden flex items-center justify-center p-1.5" aria-hidden="true">
                    <img :src="businessProduct.image" alt="" class="w-full h-full object-contain">
                  </div>
                  <div class="flex-1 min-w-0 flex flex-col gap-3">
                    <div class="flex justify-between gap-3 items-start">
                      <div class="min-w-0">
                        <p class="text-[15px] font-medium leading-tight">Business</p>
                        <p class="text-[12px] text-on-surface-variant mt-0.5">Charcoal · logo black &amp; white</p>
                        <p class="text-[12px] text-on-surface mt-1">{{ formatPrice(businessProduct.price || 0) }} each</p>
                      </div>
                      <div class="text-right shrink-0">
                        <p class="font-label-caps text-[9px] uppercase tracking-widest text-ink-muted">Line total</p>
                        <p class="text-[14px] font-medium mt-0.5">{{ formatPrice(businessLineTotal) }}</p>
                      </div>
                    </div>
                    <div class="flex items-center justify-between gap-3">
                      <span class="text-[12px] text-on-surface-variant">Number of cards</span>
                      <div class="inline-flex items-center border border-border-subtle rounded-full overflow-hidden bg-surface">
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
                </li>
                <li v-if="executiveProduct" class="rounded-xl border border-border-subtle bg-surface-container-lowest p-3.5 flex gap-3">
                  <div class="w-16 h-16 shrink-0 bg-surface-container rounded-lg overflow-hidden flex items-center justify-center p-1.5" aria-hidden="true">
                    <img :src="executiveProduct.image" alt="" class="w-full h-full object-contain">
                  </div>
                  <div class="flex-1 min-w-0 flex flex-col gap-3">
                    <div class="flex justify-between gap-3 items-start">
                      <div class="min-w-0">
                        <p class="text-[15px] font-medium leading-tight">Executive</p>
                        <p class="text-[12px] text-on-surface-variant mt-0.5">Matte black · logo black &amp; white</p>
                        <p class="text-[12px] text-on-surface mt-1">{{ formatPrice(executiveProduct.price || 0) }} each</p>
                      </div>
                      <div class="text-right shrink-0">
                        <p class="font-label-caps text-[9px] uppercase tracking-widest text-ink-muted">Line total</p>
                        <p class="text-[14px] font-medium mt-0.5">{{ formatPrice(executiveLineTotal) }}</p>
                      </div>
                    </div>
                    <div class="flex items-center justify-between gap-3">
                      <span class="text-[12px] text-on-surface-variant">Number of cards</span>
                      <div
                        class="inline-flex items-center border rounded-full overflow-hidden bg-surface"
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
                </li>
              </ul>
            </section>
            <div class="bg-surface-container rounded-xl p-4 flex flex-col gap-3">
              <div class="flex items-baseline justify-between gap-3">
                <h3 class="font-label-caps text-[11px] uppercase tracking-widest text-ink-muted">Package</h3>
                <span class="text-[12px] text-on-surface font-medium">{{ teamTotal }} cards · {{ businessQty }} Business · {{ executiveQty }} Executive</span>
              </div>
              <button
                type="button"
                class="w-full flex items-center justify-between gap-2 text-left py-1 border-0 bg-transparent cursor-pointer"
                :aria-expanded="compareOpen ? 'true' : 'false'"
                @click="compareOpen = !compareOpen"
              >
                <span class="font-label-caps text-[10px] uppercase tracking-widest text-ink-muted">Compare finishes</span>
                <span class="material-symbols-outlined text-[18px] text-ink-muted" aria-hidden="true">{{ compareOpen ? 'expand_less' : 'expand_more' }}</span>
              </button>
              <table v-if="compareOpen" class="w-full text-left text-[12px] border-collapse">
                <thead>
                  <tr class="border-b border-border-subtle">
                    <th class="py-2 pr-2 font-label-caps text-[9px] uppercase tracking-widest text-ink-muted font-medium">Feature</th>
                    <th class="py-2 px-1 font-label-caps text-[9px] uppercase tracking-widest text-ink-muted font-medium text-center whitespace-nowrap">Business</th>
                    <th class="py-2 pl-1 font-label-caps text-[9px] uppercase tracking-widest text-ink-muted font-medium text-center whitespace-nowrap">Executive</th>
                  </tr>
                </thead>
                <tbody class="text-on-surface-variant">
                  <tr class="border-b border-border-subtle/60">
                    <td class="py-2 pr-2 text-on-surface">NFC + QR → live digital profile</td>
                    <td class="py-2 px-1 text-center text-primary">✓</td>
                    <td class="py-2 pl-1 text-center text-primary">✓</td>
                  </tr>
                  <tr class="border-b border-border-subtle/60">
                    <td class="py-2 pr-2 text-on-surface">Once-off (no monthly fee)</td>
                    <td class="py-2 px-1 text-center text-primary">✓</td>
                    <td class="py-2 pl-1 text-center text-primary">✓</td>
                  </tr>
                  <tr class="border-b border-border-subtle/60">
                    <td class="py-2 pr-2 text-on-surface">Catalogue &amp; book meeting</td>
                    <td class="py-2 px-1 text-center text-primary">✓</td>
                    <td class="py-2 pl-1 text-center text-primary">✓</td>
                  </tr>
                  <tr class="border-b border-border-subtle/60">
                    <td class="py-2 pr-2 text-on-surface">Custom logo on card</td>
                    <td class="py-2 px-1 text-center text-primary text-[11px]">Black &amp; White</td>
                    <td class="py-2 pl-1 text-center text-primary text-[11px]">Black &amp; White</td>
                  </tr>
                  <tr class="border-b border-border-subtle/60">
                    <td class="py-2 pr-2 text-on-surface">Team profiles </td>
                    <td class="py-2 px-1 text-center text-primary">✓</td>
                    <td class="py-2 pl-1 text-center text-primary">✓</td>
                  </tr>
                  <tr class="border-b border-border-subtle/60">
                    <td class="py-2 pr-2 text-on-surface">Buy alone</td>
                    <td class="py-2 px-1 text-center text-primary text-[11px] leading-snug">Up to {{ TEAM_BUSINESS_ALONE_MAX }}</td>
                    <td class="py-2 pl-1 text-center text-primary text-[11px] leading-snug">Min {{ TEAM_PACKAGE_MIN }}</td>
                  </tr>
                  <tr class="border-b border-border-subtle/60">
                    <td class="py-2 pr-2 text-on-surface">Scale past {{ TEAM_SCALE_THRESHOLD }}</td>
                    <td class="py-2 px-1 text-center text-[11px] leading-snug">Free mix to 10</td>
                    <td class="py-2 pl-1 text-center text-primary text-[11px] leading-snug">11–{{ TEAM_FREE_MIX_AFTER }} Executive only, then free mix</td>
                  </tr>
                  <tr>
                    <td class="py-2 pr-2 text-on-surface">Custom subdomain</td>
                    <td class="py-2 px-1 text-center">—</td>
                    <td class="py-2 pl-1 text-center text-primary text-[11px] leading-snug">From {{ TEAM_EXEC_SUBDOMAIN_MIN }} Executive</td>
                  </tr>
                </tbody>
              </table>
              <p v-if="inExecutiveBridge" class="text-[11px] text-on-surface-variant leading-snug">
                Cards 11–{{ TEAM_FREE_MIX_AFTER }} must be Executive
                ({{ minExecutiveNeeded }} needed · you have {{ executiveQty }}).
                After {{ TEAM_FREE_MIX_AFTER }}, mix Business or Executive freely.
              </p>
              <p v-else-if="minExecutiveNeeded > 0" class="text-[11px] text-on-surface-variant leading-snug">
                Keep at least <span class="text-on-surface font-medium">{{ minExecutiveNeeded }} Executive</span>
                for {{ teamTotal }} cards.
                <span v-if="!teamOrderReady" class="text-red-600"> {{ teamMixCheck.error }}</span>
              </p>
              <label v-if="subdomainEligible" class="flex flex-col gap-2 pt-1 border-t border-border-subtle">
                <span class="font-label-caps text-[10px] uppercase tracking-widest text-primary">Optional custom subdomain</span>
                <input
                  v-model="subdomain"
                  type="text"
                  class="bg-surface border border-border-subtle rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
                  placeholder="cards.yourcompany.com"
                >
              </label>
              <p v-else class="font-label-caps text-[10px] uppercase tracking-widest text-ink-muted pt-1 border-t border-border-subtle">
                Optional subdomain from {{ TEAM_EXEC_SUBDOMAIN_MIN }}+ Executive cards
              </p>
            </div>
          </template>

          <p class="text-sm text-on-surface-variant leading-snug">
            Review quantities here, then check out from Cart with your delivery details.
          </p>

          <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
        </form>

        <div class="shrink-0 bg-surface border-t border-border-subtle px-5 py-4 flex flex-col gap-3">
          <div class="flex justify-between items-baseline">
            <span class="font-button-text text-button-text uppercase tracking-widest text-sm">Total</span>
            <span class="font-display-lg text-[24px] font-semibold leading-none">{{ formatPrice(subtotal) }}</span>
          </div>
          <p v-if="isTeam && !teamOrderReady" class="text-[12px] text-amber-800 leading-snug -mt-1">
            {{ mixStatusLabel }}
          </p>
          <button
            type="button"
            class="w-full bg-primary text-on-primary py-4 font-button-text uppercase tracking-widest hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="placeOrderDisabled"
            @click="addPackageToCart"
          >
            {{ placeOrderLabel }}
          </button>
        </div>
      </div>
    </div>


    <!-- Solo limit dialog -->
    <div
      v-if="open && soloLimitOpen"
      class="fixed inset-0 z-[130] flex items-center justify-center p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="solo-limit-title"
    >
      <button
        type="button"
        class="absolute inset-0 bg-black/55 border-0 cursor-pointer"
        aria-label="Dismiss"
        @click="closeSoloLimit"
      />
      <div class="relative w-full max-w-sm bg-surface text-on-surface rounded-2xl shadow-2xl p-6 flex flex-col gap-4">
        <div class="flex items-start gap-3">
          <span class="material-symbols-outlined text-primary text-[28px] shrink-0" aria-hidden="true">groups</span>
          <div class="min-w-0 flex flex-col gap-2">
            <h3 id="solo-limit-title" class="font-headline-lg-mobile text-[18px] font-medium">
              Need {{ TEAM_PACKAGE_MIN }}+ cards?
            </h3>
            <p class="text-sm text-on-surface-variant leading-relaxed">
              Connect Solo is limited to {{ SOLO_PACKAGE_MAX }} cards.
              For {{ TEAM_PACKAGE_MIN }} or more cards — or a shared team — view the Connect Team package instead.
            </p>
          </div>
        </div>
        <div class="flex flex-col gap-2 pt-1">
          <button
            type="button"
            class="w-full bg-primary text-on-primary py-3.5 font-button-text text-[12px] uppercase tracking-widest hover:opacity-90"
            @click="switchToTeam"
          >
            View Connect Team
          </button>
          <button
            type="button"
            class="w-full border border-border-subtle text-on-surface py-3.5 font-button-text text-[12px] uppercase tracking-widest hover:bg-surface-container"
            @click="closeSoloLimit"
          >
            Stay on Solo
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="open && notice"
      class="fixed left-1/2 top-6 z-[120] w-[min(92vw,28rem)] -translate-x-1/2 rounded-xl bg-primary text-on-primary px-5 py-4 shadow-2xl"
      role="alert"
      aria-live="assertive"
    >
      <div class="flex items-start gap-3">
        <span class="material-symbols-outlined shrink-0 mt-0.5" aria-hidden="true">error</span>
        <p class="flex-1 text-sm font-medium leading-snug">{{ notice }}</p>
        <button
          type="button"
          class="shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/15 border-0 bg-transparent text-on-primary cursor-pointer"
          aria-label="Dismiss"
          @click="notice = ''"
        >
          <span class="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>
    </div>
  </Teleport>
</template>
