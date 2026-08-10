<script setup>
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import {
  BUSINESS_CARD_ID,
  EXECUTIVE_CARD_ID,
  TEAM_PACKAGE_MIN,
  TEAM_SUBDOMAIN_THRESHOLD,
  formatPrice,
  getProduct,
  initialTeamMix
} from '../lib/shopCatalog'
import { addToCart, setTeamPackage } from '../lib/cartStore'

const props = defineProps({
  open: { type: Boolean, default: false },
  mode: { type: String, default: 'solo' }, // 'solo' | 'team'
  focusId: { type: String, default: '' },
  soloProductId: { type: String, default: 'blue-card' }
})

const emit = defineEmits(['close', 'added'])

const soloQty = ref(1)
const businessQty = ref(2)
const executiveQty = ref(3)
const subdomain = ref('')
const error = ref('')

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

const title = computed(() => (isTeam.value ? 'Connect Team package' : 'Connect Solo'))

watch(
  () => [props.open, props.mode, props.focusId],
  ([open]) => {
    if (!open) return
    error.value = ''
    subdomain.value = ''
    if (props.mode === 'team') {
      const mix = initialTeamMix(props.focusId)
      businessQty.value = mix.businessQty
      executiveQty.value = mix.executiveQty
    } else {
      soloQty.value = 1
    }
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

function addPackage() {
  error.value = ''
  if (isTeam.value) {
    if (teamTotal.value < TEAM_PACKAGE_MIN) {
      error.value = `Team packages need at least ${TEAM_PACKAGE_MIN} cards total (any mix).`
      return
    }
    const ok = setTeamPackage({
      businessQty: businessQty.value,
      executiveQty: executiveQty.value,
      subdomain: subdomainEligible.value ? subdomain.value.trim() : ''
    })
    if (!ok) {
      error.value = 'Could not add team package.'
      return
    }
    emit('added', {
      mode: 'team',
      total: teamTotal.value,
      businessQty: businessQty.value,
      executiveQty: executiveQty.value
    })
    close()
    return
  }

  const product = soloProduct.value
  if (!product) {
    error.value = 'Product unavailable.'
    return
  }
  if (!addToCart(product.id, soloQty.value)) {
    error.value = 'Could not add to cart.'
    return
  }
  emit('added', { mode: 'solo', qty: soloQty.value, name: product.name })
  close()
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
      <div
        class="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-surface text-on-surface rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col"
      >
        <div class="sticky top-0 z-10 bg-surface/95 backdrop-blur-md border-b border-border-subtle px-5 py-4 flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 class="font-headline-lg-mobile text-[22px] font-medium uppercase tracking-tight">
              {{ title }}
            </h2>
            <p v-if="isTeam" class="text-on-surface-variant text-sm mt-1">
              Mix Business &amp; Executive. Min {{ TEAM_PACKAGE_MIN }} cards · logos print white.
            </p>
            <p v-else class="text-on-surface-variant text-sm mt-1">
              Professional Class — order any quantity from 1 up.
            </p>
          </div>
          <button
            type="button"
            class="w-10 h-10 shrink-0 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors"
            aria-label="Close"
            @click="close"
          >
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <div class="px-5 py-5 flex flex-col gap-5">
          <!-- Solo -->
          <template v-if="!isTeam && soloProduct">
            <div class="flex gap-4 py-2">
              <div class="w-24 h-24 shrink-0 bg-surface-container rounded-lg overflow-hidden flex items-center justify-center p-2">
                <img
                  v-if="soloProduct.image"
                  :src="soloProduct.image"
                  :alt="soloProduct.alt || soloProduct.name"
                  class="w-full h-full object-contain"
                >
              </div>
              <div class="flex-1 min-w-0 flex flex-col gap-3">
                <div class="flex justify-between gap-3 items-start">
                  <div class="min-w-0">
                    <h3 class="font-headline-lg-mobile text-[18px] font-medium truncate">
                      {{ soloProduct.name }}
                    </h3>
                    <p class="text-on-surface-variant text-sm line-clamp-2">{{ soloProduct.desc }}</p>
                  </div>
                  <span class="font-label-caps text-label-caps shrink-0">
                    {{ formatPrice(soloSubtotal) }}
                  </span>
                </div>
                <div class="inline-flex items-center border border-border-subtle rounded-full overflow-hidden self-start">
                  <button
                    type="button"
                    class="w-10 h-10 flex items-center justify-center hover:bg-surface-container"
                    aria-label="Decrease quantity"
                    @click="bumpSolo(-1)"
                  >
                    <span class="material-symbols-outlined text-[18px]">remove</span>
                  </button>
                  <span class="w-10 text-center font-label-caps text-[12px]">{{ soloQty }}</span>
                  <button
                    type="button"
                    class="w-10 h-10 flex items-center justify-center hover:bg-surface-container"
                    aria-label="Increase quantity"
                    @click="bumpSolo(1)"
                  >
                    <span class="material-symbols-outlined text-[18px]">add</span>
                  </button>
                </div>
              </div>
            </div>
          </template>

          <!-- Team mix -->
          <template v-else-if="isTeam">
            <ul class="flex flex-col divide-y divide-border-subtle border-y border-border-subtle list-none p-0 m-0">
              <li v-if="businessProduct" class="flex gap-4 py-5">
                <div class="w-20 h-20 shrink-0 bg-surface-container rounded-lg overflow-hidden flex items-center justify-center p-2">
                  <img
                    :src="businessProduct.image"
                    :alt="businessProduct.alt || businessProduct.name"
                    class="w-full h-full object-contain"
                  >
                </div>
                <div class="flex-1 min-w-0 flex flex-col gap-3">
                  <div class="flex justify-between gap-3 items-start">
                    <div class="min-w-0">
                      <h3 class="font-headline-lg-mobile text-[17px] font-medium truncate">
                        {{ businessProduct.name }}
                      </h3>
                      <p
                        v-if="businessProduct.label"
                        class="font-label-caps text-[10px] uppercase tracking-widest text-primary mt-1"
                      >
                        {{ businessProduct.label }}
                      </p>
                    </div>
                    <span class="font-label-caps text-label-caps shrink-0">
                      {{ formatPrice((businessProduct.price || 0) * businessQty) }}
                    </span>
                  </div>
                  <div class="inline-flex items-center border border-border-subtle rounded-full overflow-hidden self-start">
                    <button
                      type="button"
                      class="w-10 h-10 flex items-center justify-center hover:bg-surface-container"
                      aria-label="Decrease Business cards"
                      @click="bumpBusiness(-1)"
                    >
                      <span class="material-symbols-outlined text-[18px]">remove</span>
                    </button>
                    <span class="w-10 text-center font-label-caps text-[12px]">{{ businessQty }}</span>
                    <button
                      type="button"
                      class="w-10 h-10 flex items-center justify-center hover:bg-surface-container"
                      aria-label="Increase Business cards"
                      @click="bumpBusiness(1)"
                    >
                      <span class="material-symbols-outlined text-[18px]">add</span>
                    </button>
                  </div>
                </div>
              </li>
              <li v-if="executiveProduct" class="flex gap-4 py-5">
                <div class="w-20 h-20 shrink-0 bg-surface-container rounded-lg overflow-hidden flex items-center justify-center p-2">
                  <img
                    :src="executiveProduct.image"
                    :alt="executiveProduct.alt || executiveProduct.name"
                    class="w-full h-full object-contain"
                  >
                </div>
                <div class="flex-1 min-w-0 flex flex-col gap-3">
                  <div class="flex justify-between gap-3 items-start">
                    <div class="min-w-0">
                      <h3 class="font-headline-lg-mobile text-[17px] font-medium truncate">
                        {{ executiveProduct.name }}
                      </h3>
                      <p
                        v-if="executiveProduct.label"
                        class="font-label-caps text-[10px] uppercase tracking-widest text-primary mt-1"
                      >
                        {{ executiveProduct.label }}
                      </p>
                    </div>
                    <span class="font-label-caps text-label-caps shrink-0">
                      {{ formatPrice((executiveProduct.price || 0) * executiveQty) }}
                    </span>
                  </div>
                  <div class="inline-flex items-center border border-border-subtle rounded-full overflow-hidden self-start">
                    <button
                      type="button"
                      class="w-10 h-10 flex items-center justify-center hover:bg-surface-container"
                      aria-label="Decrease Executive cards"
                      @click="bumpExecutive(-1)"
                    >
                      <span class="material-symbols-outlined text-[18px]">remove</span>
                    </button>
                    <span class="w-10 text-center font-label-caps text-[12px]">{{ executiveQty }}</span>
                    <button
                      type="button"
                      class="w-10 h-10 flex items-center justify-center hover:bg-surface-container"
                      aria-label="Increase Executive cards"
                      @click="bumpExecutive(1)"
                    >
                      <span class="material-symbols-outlined text-[18px]">add</span>
                    </button>
                  </div>
                </div>
              </li>
            </ul>

            <div class="bg-surface-container rounded-xl p-4 flex flex-col gap-3">
              <div class="flex justify-between text-sm">
                <span class="text-on-surface-variant">Package total</span>
                <span class="font-label-caps text-label-caps">{{ teamTotal }} cards</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-on-surface-variant">Mix</span>
                <span class="font-label-caps text-[11px] uppercase tracking-widest">
                  {{ businessQty }} : {{ executiveQty }}
                </span>
              </div>
              <p class="text-[12px] text-on-surface-variant leading-relaxed">
                Combine freely (e.g. 1:4 or 0:12). Company logos print in white on both card classes.
              </p>
              <p
                v-if="!subdomainEligible"
                class="font-label-caps text-[10px] uppercase tracking-widest text-ink-muted"
              >
                Optional custom subdomain from {{ TEAM_SUBDOMAIN_THRESHOLD }}+ cards
              </p>
              <label v-else class="flex flex-col gap-2">
                <span class="font-label-caps text-[10px] uppercase tracking-widest text-primary">
                  Optional custom subdomain
                </span>
                <input
                  v-model="subdomain"
                  type="text"
                  class="bg-surface border border-border-subtle rounded-lg px-3 py-3 text-sm focus:outline-none focus:border-primary"
                  placeholder="cards.yourcompany.com"
                  autocomplete="off"
                >
                <span class="text-[11px] text-on-surface-variant">
                  Included as an option on packs of {{ TEAM_SUBDOMAIN_THRESHOLD }} or more.
                </span>
              </label>
            </div>
          </template>

          <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
        </div>

        <div class="sticky bottom-0 bg-surface border-t border-border-subtle px-5 py-4 flex flex-col gap-3">
          <div class="flex justify-between items-baseline">
            <span class="font-button-text text-button-text uppercase tracking-widest text-sm">Subtotal</span>
            <span class="font-display-lg text-[24px] font-semibold leading-none">
              {{ formatPrice(isTeam ? teamSubtotal : soloSubtotal) }}
            </span>
          </div>
          <button
            type="button"
            class="w-full bg-primary text-on-primary py-4 font-button-text uppercase tracking-widest hover:opacity-90 transition-opacity"
            @click="addPackage"
          >
            Add to cart
          </button>
          <RouterLink
            to="/cart"
            class="w-full text-center border border-primary text-primary py-3 font-button-text uppercase tracking-widest no-underline hover:bg-primary hover:text-on-primary transition-colors"
            @click="close"
          >
            View cart
          </RouterLink>
        </div>
      </div>
    </div>
  </Teleport>
</template>
