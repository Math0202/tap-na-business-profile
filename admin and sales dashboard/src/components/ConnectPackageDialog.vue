<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import {
  BUSINESS_CARD_ID,
  EXECUTIVE_CARD_ID,
  TEAM_BUSINESS_ALONE_MAX,
  TEAM_PACKAGE_MIN,
  TEAM_FREE_MIX_AFTER,
  isTeamExecutiveBridge,
  formatPrice,
  getProduct,
  initialTeamMix,
  minExecutiveForTeamTotal,
  canApplyTeamMix,
  isTeamMixOrderReady,
  validateTeamMix
} from '../lib/shopCatalog'
import { setTeamPackage } from '../lib/cartStore'
import {
  CONNECT_FEATURE_MATRIX,
  featureMarkLabel
} from '../lib/featureMatrix'

const props = defineProps({
  open: { type: Boolean, default: false },
  mode: { type: String, default: 'team' },
  focusId: { type: String, default: '' },
  initialBusinessQty: { type: Number, default: null },
  initialExecutiveQty: { type: Number, default: null },
  initialSubdomain: { type: String, default: '' }
})

const emit = defineEmits(['close', 'ordered', 'added-to-cart'])

const featureMatrix = CONNECT_FEATURE_MATRIX
const markLabel = featureMarkLabel

const businessQty = ref(2)
const executiveQty = ref(3)
const error = ref('')
const notice = ref('')
let noticeTimer = null
const submitting = ref(false)

const businessProduct = computed(() => getProduct(BUSINESS_CARD_ID))
const executiveProduct = computed(() => getProduct(EXECUTIVE_CARD_ID))
const teamTotal = computed(() => businessQty.value + executiveQty.value)
const teamMixCheck = computed(() => validateTeamMix(businessQty.value, executiveQty.value))
const teamOrderReady = computed(() => isTeamMixOrderReady(businessQty.value, executiveQty.value))
const inExecutiveBridge = computed(() => isTeamExecutiveBridge(teamTotal.value))
const minExecutiveNeeded = computed(() => minExecutiveForTeamTotal(teamTotal.value))
const teamSubtotal = computed(
  () =>
    (businessProduct.value?.price || 0) * businessQty.value +
    (executiveProduct.value?.price || 0) * executiveQty.value
)
const subtotal = computed(() => teamSubtotal.value)
const title = computed(() => 'Business & Executive')
const itemCount = computed(() => teamTotal.value)
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
  if (!teamOrderReady.value) return true
  return false
})
const placeOrderLabel = computed(() => {
  if (submitting.value) return 'Adding…'
  if (teamTotal.value < TEAM_PACKAGE_MIN) {
    const n = cardsNeededForMin.value
    return `Add ${n} more card${n === 1 ? '' : 's'} to cart`
  }
  if (!teamOrderReady.value) return 'Fix mix to add'
  return 'Add to cart'
})
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
    submitting.value = false
    const mix = initialTeamMix(props.focusId)
    businessQty.value =
      props.initialBusinessQty != null ? Math.max(0, Math.floor(props.initialBusinessQty)) : mix.businessQty
    executiveQty.value =
      props.initialExecutiveQty != null ? Math.max(0, Math.floor(props.initialExecutiveQty)) : mix.executiveQty
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
  const check = validateTeamMix(businessQty.value, executiveQty.value)
  if (!check.ok) {
    error.value = check.error
    showNotice(check.error)
    return
  }

  submitting.value = true
  try {
    const ok = setTeamPackage({
      businessQty: businessQty.value,
      executiveQty: executiveQty.value,
      subdomain: ''
    })
    if (!ok) {
      error.value = 'Could not add to cart. Check quantities and try again.'
      showNotice(error.value)
      return
    }
    emit('added-to-cart', {
      mode: 'team',
      total: itemCount.value
    })
    emit('ordered', {
      mode: 'team',
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
              Mix Business Tier and Executive Tier · min {{ TEAM_PACKAGE_MIN }} cards
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
            <div class="bg-surface-container rounded-xl p-4 flex flex-col gap-3">
              <h3 class="font-label-caps text-[11px] uppercase tracking-widest text-ink-muted">Features</h3>
              <table class="w-full text-left text-[12px] border-collapse">
                <thead>
                  <tr class="border-b border-border-subtle">
                    <th class="py-2 pr-2 font-label-caps text-[9px] uppercase tracking-widest text-ink-muted font-medium">Feature</th>
                    <th class="py-2 px-1 font-label-caps text-[9px] uppercase tracking-widest text-ink-muted font-medium text-center whitespace-nowrap">Business</th>
                    <th class="py-2 pl-1 font-label-caps text-[9px] uppercase tracking-widest text-ink-muted font-medium text-center whitespace-nowrap">Executive</th>
                  </tr>
                </thead>
                <tbody class="text-on-surface-variant">
                  <tr
                    v-for="(row, idx) in featureMatrix"
                    :key="'team-' + row.feature"
                    :class="idx < featureMatrix.length - 1 ? 'border-b border-border-subtle/60' : ''"
                  >
                    <td class="py-2 pr-2 text-on-surface">{{ row.feature }}</td>
                    <td
                      class="py-2 px-1 text-center"
                      :class="row.business === 'yes' ? 'text-primary' : ''"
                    >{{ markLabel(row.business) }}</td>
                    <td
                      class="py-2 pl-1 text-center"
                      :class="row.executive === 'yes' ? 'text-primary' : ''"
                    >{{ markLabel(row.executive) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

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
              </div>

              <ul class="flex flex-col gap-3 list-none p-0 m-0">
                <li v-if="businessProduct" class="rounded-xl border border-border-subtle bg-surface-container-lowest p-3.5 flex gap-3">
                  <div class="w-16 h-16 shrink-0 bg-surface-container rounded-lg overflow-hidden flex items-center justify-center p-1.5" aria-hidden="true">
                    <img :src="businessProduct.image" alt="" class="w-full h-full object-contain">
                  </div>
                  <div class="flex-1 min-w-0 flex flex-col gap-3">
                    <div class="flex justify-between gap-3 items-start">
                      <div class="min-w-0">
                        <p class="text-[15px] font-medium leading-tight">Business Tier</p>
                        <p class="text-[12px] text-on-surface-variant mt-0.5">External NFC sticker · charcoal · logo black &amp; white</p>
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
                        <p class="text-[15px] font-medium leading-tight">Executive Tier</p>
                        <p class="text-[12px] text-on-surface-variant mt-0.5">Internal NFC · matte black · logo black &amp; white</p>
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

          <p class="text-sm text-on-surface-variant leading-snug">
            
          </p>

          <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
        </form>

        <div class="shrink-0 bg-surface border-t border-border-subtle px-5 py-4 flex flex-col gap-3">
          <div class="flex justify-between items-baseline">
            <span class="font-button-text text-button-text uppercase tracking-widest text-sm">Total</span>
            <span class="font-display-lg text-[24px] font-semibold leading-none">{{ formatPrice(subtotal) }}</span>
          </div>
          <p v-if="!teamOrderReady" class="text-[12px] text-amber-800 leading-snug -mt-1">
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
