<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import ShopHeader from '../components/ShopHeader.vue'
import ShopBottomNav from '../components/ShopBottomNav.vue'
import ConnectPackageDialog from '../components/ConnectPackageDialog.vue'
import {
  connectSoloCards,
  connectTeamCards,
  formatPrice,
  isTeamCard,
  loadShopProducts,
} from '../lib/shopCatalog'

const route = useRoute()
const router = useRouter()
const menuOpen = ref(false)
const subscribed = ref(false)
const email = ref('')
const toast = ref('')
const sections = ref([])
const catalogTick = ref(0)
const heroCardsIn = ref(0)
const packageOpen = ref(false)
const packageMode = ref('solo')
const packageFocusId = ref('')
let observer = null
let toastTimer = null
let heroStaggerTimers = []

const HERO_CARDS = [
  {
    id: 'blue-card',
    image: '/images/professional_cobalt_blue.png',
    alt: 'Professional cobalt blue Connect card',
    label: 'View Professional package',
    rot: -16,
    slot: 'left'
  },
  {
    id: 'black-card',
    image: '/images/business_charcoal.png',
    alt: 'Business charcoal Connect card',
    label: 'View Business team package',
    rot: 0,
    slot: 'center'
  },
  {
    id: 'black-card-front',
    image: '/images/executive_black.png',
    alt: 'Executive black Connect card',
    label: 'View Executive team package',
    rot: 14,
    slot: 'right'
  }
]

const soloCards = computed(() => {
  catalogTick.value
  return connectSoloCards()
})

const teamCards = computed(() => {
  catalogTick.value
  return connectTeamCards()
})

async function refreshCatalog() {
  await loadShopProducts()
  catalogTick.value += 1
}

function scrollToShop() {
  menuOpen.value = false
  document.getElementById('connect-solo')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function scrollToTeam() {
  menuOpen.value = false
  document.getElementById('connect-team')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function handleSubscribe() {
  if (!email.value.includes('@')) return
  subscribed.value = true
}

function showToast(msg) {
  toast.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.value = ''
  }, 2200)
}

function openPackage(mode, focusId = '') {
  packageMode.value = mode
  packageFocusId.value = focusId
  packageOpen.value = true
}

/** Image / name → product or team package info page */
function openProductInfo(productId) {
  if (isTeamCard(productId)) {
    router.push({ path: '/package/team', query: { focus: productId } })
    return
  }
  router.push(`/product/${productId}`)
}

function openHeroCard(cardId) {
  openProductInfo(cardId)
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

function setSectionRef(el) {
  if (el && !sections.value.includes(el)) sections.value.push(el)
}

function revealSection(el) {
  el.classList.add('opacity-100')
  el.classList.remove('opacity-0', 'translate-y-4')
}

watch(
  () => route.hash,
  (hash) => {
    if (hash === '#business-cards' || hash === '#connect-solo') nextTick(() => scrollToShop())
    if (hash === '#connect-team') nextTick(() => scrollToTeam())
    if (hash === '#table-brochures') router.replace('/table-top')
  }
)

onMounted(async () => {
  document.title = 'tap-na — Connect business cards'
  document.documentElement.classList.add('shop-home')
  if (route.hash === '#table-brochures') {
    router.replace('/table-top')
    return
  }
  await refreshCatalog()
  await nextTick()
  HERO_CARDS.forEach((_, index) => {
    const timer = setTimeout(() => {
      heroCardsIn.value = index + 1
    }, 120 + index * 180)
    heroStaggerTimers.push(timer)
  })
  if (route.hash === '#connect-team') scrollToTeam()
  else if (route.hash === '#business-cards' || route.hash === '#connect-solo') scrollToShop()
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) revealSection(entry.target)
      })
    },
    { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
  )
  sections.value.forEach((section, index) => {
    section.classList.add('transition-all', 'duration-700', 'ease-out')
    if (index === 0) {
      revealSection(section)
      return
    }
    section.classList.add('opacity-0', 'translate-y-4')
    observer.observe(section)
  })
})

onUnmounted(() => {
  document.documentElement.classList.remove('shop-home')
  observer?.disconnect()
  clearTimeout(toastTimer)
  heroStaggerTimers.forEach((timer) => clearTimeout(timer))
  heroStaggerTimers = []
})
</script>

<template>
  <div class="shop-page bg-surface text-on-surface font-body-md text-body-md min-h-screen">
    <ShopHeader
      :menu-open="menuOpen"
      @toggle-menu="menuOpen = !menuOpen"
      @close-menu="menuOpen = false"
      @shop-all="scrollToShop"
    />

    <main class="pt-16 min-h-screen bg-surface pb-24 md:pb-0">
      <div class="flex flex-col w-full overflow-x-clip max-w-6xl mx-auto">
        <!-- Hero -->
        <section
          :ref="setSectionRef"
          class="px-margin-mobile md:px-margin-desktop pt-stack-md md:pt-10 flex flex-col gap-6"
        >
          <div
            class="relative overflow-hidden bg-surface-charcoal rounded-xl min-h-[520px] md:min-h-[560px] flex flex-col md:flex-row md:items-end"
          >
            <div
              class="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_40%,rgba(255,255,255,0.12)_0%,transparent_55%)]"
              aria-hidden="true"
            />
            <div
              class="absolute inset-0 bg-gradient-to-t from-surface-charcoal via-surface-charcoal/40 to-transparent md:bg-gradient-to-r md:from-surface-charcoal md:via-surface-charcoal/80 md:to-transparent"
              aria-hidden="true"
            />

            <!-- Product visuals — all 3 Connect card types -->
            <div
              class="relative z-[1] order-1 md:order-2 flex-1 min-h-[300px] md:min-h-full md:absolute md:inset-y-0 md:right-0 md:w-[58%] flex items-center justify-center px-4 pt-8 md:pt-0 md:pr-6"
            >
              <div class="hero-fan relative w-full max-w-[420px] aspect-[5/4] md:max-w-none md:h-[86%] md:aspect-auto md:w-[96%]">
                <button
                  v-for="(card, index) in HERO_CARDS"
                  :key="card.id"
                  type="button"
                  class="hero-product absolute p-0 border-0 bg-transparent cursor-pointer drop-shadow-[0_22px_50px_rgba(0,0,0,0.55)]"
                  :class="[
                    `hero-product--${card.slot}`,
                    { 'hero-product--in': heroCardsIn > index }
                  ]"
                  :style="{ '--hero-rot': `${card.rot}deg`, zIndex: card.slot === 'center' ? 3 : card.slot === 'right' ? 2 : 1 }"
                  :aria-label="card.label"
                  @click="openHeroCard(card.id)"
                >
                  <img
                    :src="card.image"
                    :alt="card.alt"
                    class="w-full h-auto block pointer-events-none"
                    decoding="async"
                  >
          </button>
        </div>
            </div>

            <div class="relative z-10 order-2 md:order-1 flex flex-col gap-4 max-w-xl px-8 pb-10 pt-2 md:p-14 md:pr-8 md:pb-14 md:w-[48%]">
              <span
                class="font-label-caps text-label-caps text-secondary-fixed-dim uppercase tracking-[0.2em]"
              >
                Connect business cards
              </span>
              <h1
                class="font-display-lg text-[42px] md:text-[64px] leading-[1.1] md:leading-[1.05] text-on-primary tracking-[-0.02em] font-semibold"
              >
                Tap. Connect. <br> Share.
              </h1>
              <p class="text-on-tertiary-container max-w-[90%] md:max-w-md text-body-md">
                Premium NFC Connect cards that open your digital profile with one tap — for professionals, founders, and teams.
              </p>
              <div class="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  class="bg-surface-container-lowest text-primary font-button-text text-button-text px-8 py-4 rounded-full uppercase tracking-widest hover:bg-primary-fixed transition-all active:scale-95"
                  @click="scrollToShop"
                >
                  Shop cards
                </button>
                <RouterLink
                  to="/about/business-cards"
                  class="border border-on-primary/40 text-on-primary font-button-text text-button-text px-8 py-4 rounded-full uppercase tracking-widest hover:bg-on-primary/10 transition-all no-underline inline-flex items-center"
                >
                  How it works
                </RouterLink>
              </div>
              <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] uppercase tracking-[0.16em] text-on-primary/55">
                <button type="button" class="hover:text-on-primary transition-colors bg-transparent border-0 p-0 text-inherit uppercase tracking-[0.16em] cursor-pointer" @click="scrollToShop">
                  Connect Solo
                </button>
                <span aria-hidden="true">·</span>
                <button type="button" class="hover:text-on-primary transition-colors bg-transparent border-0 p-0 text-inherit uppercase tracking-[0.16em] cursor-pointer" @click="scrollToTeam">
                  Connect Team
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- Feature Quick Bar -->
        <section :ref="setSectionRef" class="px-margin-mobile md:px-margin-desktop pt-stack-md">
          <div class="grid grid-cols-3 gap-2 py-6 border-y border-border-subtle max-w-2xl mx-auto md:max-w-none">
            <div class="flex flex-col items-center text-center gap-1">
              <span class="material-symbols-outlined text-primary text-[20px]">bolt</span>
              <span class="font-label-caps text-[10px] uppercase">Instant</span>
            </div>
            <div class="flex flex-col items-center text-center gap-1">
              <span class="material-symbols-outlined text-primary text-[20px]">install_mobile</span>
              <span class="font-label-caps text-[10px] uppercase">No App</span>
            </div>
            <div class="flex flex-col items-center text-center gap-1">
              <span class="material-symbols-outlined text-primary text-[20px]">eco</span>
              <span class="font-label-caps text-[10px] uppercase">Eco Friendly</span>
            </div>
          </div>
        </section>

        <!-- Connect Solo -->
        <section
          id="connect-solo"
          :ref="setSectionRef"
          class="px-margin-mobile md:px-margin-desktop pt-stack-lg flex flex-col gap-8 scroll-mt-20"
        >
          <div class="flex justify-between items-end gap-4">
            <div class="flex flex-col gap-1 min-w-0">
              <h2 class="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg uppercase">
                Connect Solo
              </h2>
              <div class="h-1 w-12 bg-primary" />
              <p class="text-on-surface-variant text-sm mt-1">
                Professional Class — one card type. Buy 1–4. For 5+ cards, choose Connect Team.
              </p>
            </div>
            <span class="font-label-caps text-label-caps text-ink-muted shrink-0">{{ soloCards.length }} ITEMS</span>
          </div>

          <div class="flex flex-col gap-0 divide-y divide-border-subtle border-y border-border-subtle md:border-0 md:divide-y-0 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-x-8 md:gap-y-12">
            <article
              v-for="product in soloCards"
              :key="product.id"
              class="flex flex-col gap-3 py-5 md:py-0 md:gap-4 group"
            >
              <button
                type="button"
                class="text-left no-underline text-inherit flex flex-col gap-4 bg-transparent border-0 p-0 cursor-pointer w-full"
                @click="openProductInfo(product.id)"
              >
                <div class="w-full aspect-[3/4] bg-surface-container overflow-hidden rounded-xl relative flex items-center justify-center p-4">
                  <img
                    v-if="product.image"
                    :alt="product.alt"
                    class="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                    :src="product.image"
                  >
                  <span
                    v-else
                    class="material-symbols-outlined text-on-surface-variant text-[48px] opacity-40"
                    aria-hidden="true"
                  >image</span>
                </div>
                <div class="flex flex-1 min-w-0 flex-col gap-1">
                  <div class="flex justify-between items-start gap-3">
                    <h3 class="font-headline-lg-mobile text-[18px] md:text-[20px] font-medium">{{ product.name }}</h3>
                    <span class="font-label-caps text-label-caps shrink-0">{{ formatPrice(product.price) }}</span>
                  </div>
                  <p
                    v-if="product.label"
                    class="font-label-caps text-[11px] uppercase tracking-widest text-primary"
                  >
                    {{ product.label }}
                  </p>
                  <p class="text-on-surface-variant text-sm line-clamp-2 md:line-clamp-2">
                    {{ product.desc }}
                  </p>
                </div>
              </button>
              <button
                type="button"
                class="w-full border border-primary text-primary py-3 md:py-4 font-button-text uppercase tracking-widest hover:bg-primary hover:text-on-primary transition-colors"
                @click="openPackage('solo', product.id)"
              >
                View package | Order now
              </button>
            </article>
        </div>
      </section>

        <!-- Connect Team -->
        <section
          id="connect-team"
          :ref="setSectionRef"
          class="px-margin-mobile md:px-margin-desktop pt-stack-lg flex flex-col gap-8 scroll-mt-20"
        >
          <div class="flex justify-between items-end gap-4">
            <div class="flex flex-col gap-1 min-w-0">
              <h2 class="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg uppercase">
                Connect Team
              </h2>
              <div class="h-1 w-12 bg-primary" />
              <p class="text-on-surface-variant text-sm mt-1">
                Business &amp; Executive in one package (min 5). Business alone max 10. Cards 11–15 must be Executive, then free mix. Subdomain from 5 Executive.
              </p>
            </div>
            <span class="font-label-caps text-label-caps text-ink-muted shrink-0">{{ teamCards.length }} ITEMS</span>
          </div>

          <div class="flex flex-col gap-0 divide-y divide-border-subtle border-y border-border-subtle md:border-0 md:divide-y-0 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-x-8 md:gap-y-12">
            <article
              v-for="product in teamCards"
              :key="product.id"
              class="flex flex-col gap-3 py-5 md:py-0 md:gap-4 group"
            >
              <button
                type="button"
                class="text-left no-underline text-inherit flex flex-col gap-4 bg-transparent border-0 p-0 cursor-pointer w-full"
                @click="openProductInfo(product.id)"
              >
                <div class="w-full aspect-[3/4] bg-surface-container overflow-hidden rounded-xl relative flex items-center justify-center p-4">
                  <img
                    v-if="product.image"
                    :alt="product.alt"
                    class="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                    :src="product.image"
                  >
                  <span
                    v-else
                    class="material-symbols-outlined text-on-surface-variant text-[48px] opacity-40"
                    aria-hidden="true"
                  >image</span>
                  <div
                    v-if="product.badge"
                    class="absolute top-4 left-4 bg-primary text-on-primary px-3 py-1 font-label-caps text-[10px] uppercase tracking-widest"
                  >
                    {{ product.badge }}
                  </div>
                </div>
                <div class="flex flex-1 min-w-0 flex-col gap-1">
                  <div class="flex justify-between items-start gap-3">
                    <h3 class="font-headline-lg-mobile text-[18px] md:text-[20px] font-medium">{{ product.name }}</h3>
                    <span class="font-label-caps text-label-caps shrink-0">{{ formatPrice(product.price) }}</span>
                  </div>
                  <p
                    v-if="product.label"
                    class="font-label-caps text-[11px] uppercase tracking-widest text-primary"
                  >
                    {{ product.label }}
                  </p>
                  <p class="text-on-surface-variant text-sm line-clamp-2">
                    {{ product.desc }}
                  </p>
                </div>
              </button>
              <button
                type="button"
                class="w-full border border-primary text-primary py-3 md:py-4 font-button-text uppercase tracking-widest hover:bg-primary hover:text-on-primary transition-colors"
                @click="openPackage('team', product.id)"
              >
                View package | Order now
              </button>
            </article>
          </div>
        </section>

        <!-- Feature matrix -->
        <section
          :ref="setSectionRef"
          class="px-margin-mobile md:px-margin-desktop pt-stack-lg flex flex-col gap-6 scroll-mt-20"
        >
          <div class="flex flex-col gap-1 max-w-2xl">
            <h2 class="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg uppercase">
              Feature matrix
            </h2>
            <div class="h-1 w-12 bg-primary" />
            <p class="text-on-surface-variant text-sm mt-1">
              Solo vs Connect Team finishes — Business and Executive differences.
            </p>
          </div>
          <div class="overflow-x-auto -mx-1 px-1">
            <table class="w-full min-w-[560px] text-left text-sm border-collapse">
              <thead>
                <tr class="border-b border-border-subtle">
                  <th class="py-3 pr-4 font-label-caps text-[10px] uppercase tracking-widest text-ink-muted font-medium">
                    Feature
                  </th>
                  <th class="py-3 px-2 font-label-caps text-[10px] uppercase tracking-widest text-ink-muted font-medium text-center">
                    Solo
                  </th>
                  <th class="py-3 px-2 font-label-caps text-[10px] uppercase tracking-widest text-ink-muted font-medium text-center">
                    Business
                  </th>
                  <th class="py-3 pl-2 font-label-caps text-[10px] uppercase tracking-widest text-ink-muted font-medium text-center">
                    Executive
                  </th>
                </tr>
              </thead>
              <tbody class="text-on-surface-variant">
                <tr class="border-b border-border-subtle/70">
                  <td class="py-3 pr-4 text-on-surface">NFC + QR → live profile</td>
                  <td class="py-3 px-2 text-center text-primary">✓</td>
                  <td class="py-3 px-2 text-center text-primary">✓</td>
                  <td class="py-3 pl-2 text-center text-primary">✓</td>
                </tr>
                <tr class="border-b border-border-subtle/70">
                  <td class="py-3 pr-4 text-on-surface">Once-off (no monthly fee)</td>
                  <td class="py-3 px-2 text-center text-primary">✓</td>
                  <td class="py-3 px-2 text-center text-primary">✓</td>
                  <td class="py-3 pl-2 text-center text-primary">✓</td>
                </tr>
                <tr class="border-b border-border-subtle/70">
                  <td class="py-3 pr-4 text-on-surface">Catalogue &amp; book meeting</td>
                  <td class="py-3 px-2 text-center text-primary">✓</td>
                  <td class="py-3 px-2 text-center text-primary">✓</td>
                  <td class="py-3 pl-2 text-center text-primary">✓</td>
                </tr>
                <tr class="border-b border-border-subtle/70">
                  <td class="py-3 pr-4 text-on-surface">Custom logo on card</td>
                  <td class="py-3 px-2 text-center">—</td>
                  <td class="py-3 px-2 text-center text-primary text-xs">Black &amp; White</td>
                  <td class="py-3 pl-2 text-center text-primary text-xs">Black &amp; White</td>
                </tr>
                <tr class="border-b border-border-subtle/70">
                  <td class="py-3 pr-4 text-on-surface">Team profiles + owner block</td>
                  <td class="py-3 px-2 text-center">—</td>
                  <td class="py-3 px-2 text-center text-primary">✓</td>
                  <td class="py-3 pl-2 text-center text-primary">✓</td>
                </tr>
                <tr class="border-b border-border-subtle/70">
                  <td class="py-3 pr-4 text-on-surface">Buy alone</td>
                  <td class="py-3 px-2 text-center text-xs">Up to 4</td>
                  <td class="py-3 px-2 text-center text-xs leading-snug">Up to 10</td>
                  <td class="py-3 pl-2 text-center text-xs leading-snug">Min 5</td>
                </tr>
                <tr class="border-b border-border-subtle/70">
                  <td class="py-3 pr-4 text-on-surface">Scale past 10</td>
                  <td class="py-3 px-2 text-center">—</td>
                  <td class="py-3 px-2 text-center text-xs leading-snug">Free mix to 10</td>
                  <td class="py-3 pl-2 text-center text-primary text-xs leading-snug">11–15 Executive only,<br>then free mix</td>
                </tr>
                <tr>
                  <td class="py-3 pr-4 text-on-surface">Custom subdomain</td>
                  <td class="py-3 px-2 text-center">—</td>
                  <td class="py-3 px-2 text-center">—</td>
                  <td class="py-3 pl-2 text-center text-primary text-xs leading-snug">From 5 Executive</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- Testimonial -->
        <section :ref="setSectionRef" class="px-margin-mobile md:px-margin-desktop pt-stack-lg">
          <div class="bg-surface-container p-10 md:p-14 rounded-xl relative overflow-hidden max-w-3xl">
            <span
              class="material-symbols-outlined absolute top-4 left-4 text-surface-variant text-[64px] opacity-30"
              aria-hidden="true"
            >
              format_quote
            </span>
            <div class="relative z-10 flex flex-col gap-6">
              <p class="font-body-md text-headline-lg-mobile italic text-on-surface-variant leading-relaxed">
                "The friction in networking is gone. I tap their phone, and I'm in their contacts forever. It's
                the ultimate professional edge."
              </p>
              <div class="flex items-center gap-4">
                <div
                  class="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center font-label-caps"
                >
                  JD
                </div>
                <div class="flex flex-col">
                  <span class="font-label-caps text-[12px] uppercase font-bold">Julian Draxler</span>
                  <span class="text-[10px] text-ink-muted uppercase tracking-widest">
                    Architect &amp; Designer
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Why TAPna -->
        <section
          :ref="setSectionRef"
          class="px-margin-mobile md:px-margin-desktop pt-stack-lg pb-stack-md flex flex-col gap-8"
        >
          <div class="flex flex-col gap-2 max-w-xl">
            <h2 class="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg uppercase">
              Why TAPna?
            </h2>
            <p class="text-on-surface-variant">
              Elevating standard interaction into a premium experience.
            </p>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
            <div class="flex gap-4 items-start">
              <div
                class="w-12 h-12 bg-surface-container-high rounded flex items-center justify-center shrink-0"
              >
                <span class="material-symbols-outlined">qr_code_2</span>
              </div>
              <div class="flex flex-col gap-1">
                <h4 class="font-label-caps text-[14px] uppercase font-bold">Universal Backup</h4>
                <p class="text-[13px] text-on-tertiary-container">
                  Every card comes with a laser-etched QR code for older devices without NFC.
                </p>
              </div>
            </div>
            <div class="flex gap-4 items-start">
              <div
                class="w-12 h-12 bg-surface-container-high rounded flex items-center justify-center shrink-0"
              >
                <span class="material-symbols-outlined">security</span>
              </div>
              <div class="flex flex-col gap-1">
                <h4 class="font-label-caps text-[14px] uppercase font-bold">Encrypted Tech</h4>
                <p class="text-[13px] text-on-tertiary-container">
                  Your data is safe. We use high-security NTAG215 chips for reliable performance.
                </p>
              </div>
            </div>
          </div>
        </section>

        <!-- Newsletter -->
        <section :ref="setSectionRef" class="px-margin-mobile md:px-margin-desktop pt-stack-md pb-stack-lg">
          <div class="flex flex-col gap-4 border-t border-border-subtle pt-8 max-w-md">
            <h3 class="font-label-caps text-[10px] uppercase tracking-[0.3em] text-ink-muted">
              Stay Synced
            </h3>
            <div v-if="!subscribed" class="flex flex-col gap-4">
              <input
                v-model="email"
                class="bg-transparent border-b border-primary py-3 font-label-caps text-[12px] focus:outline-none focus:border-on-tertiary-container transition-colors uppercase placeholder:text-ink-muted"
                placeholder="ENTER YOUR EMAIL"
                type="email"
                autocomplete="email"
                @keydown.enter.prevent="handleSubscribe"
              >
          <button
            type="button"
                class="bg-primary text-on-primary py-4 font-button-text uppercase tracking-widest text-sm hover:opacity-90 transition-opacity"
                @click="handleSubscribe"
              >
                Lets Connect
          </button>
        </div>
            <div v-else class="flex flex-col items-center gap-2 py-4">
              <span class="material-symbols-outlined text-primary text-[48px]">check_circle</span>
              <span class="font-label-caps text-label-caps">Welcome to the future.</span>
            </div>
          </div>
        </section>
      </div>

      <footer
        class="mt-stack-lg px-margin-mobile md:px-margin-desktop pb-stack-lg flex flex-col gap-8 max-w-6xl mx-auto"
      >
        <div class="grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-8">
          <div class="flex flex-col gap-2">
            <span class="font-label-caps text-label-caps text-on-surface-variant uppercase">Shop</span>
            <button
              type="button"
              class="text-left text-on-surface hover:opacity-70"
              @click="scrollToShop"
            >
              Connect Solo
            </button>
            <button
              type="button"
              class="text-left text-on-surface hover:opacity-70"
              @click="scrollToTeam"
            >
              Connect Team
            </button>
            <RouterLink to="/table-top" class="text-on-surface no-underline hover:opacity-70">
              Table Top Tap
            </RouterLink>
            <RouterLink to="/cart" class="text-on-surface no-underline hover:opacity-70">
              Cart
            </RouterLink>
          </div>
          <div class="flex flex-col gap-2">
            <span class="font-label-caps text-label-caps text-on-surface-variant uppercase">Info</span>
            <RouterLink to="/about/business-cards" class="text-on-surface no-underline hover:opacity-70">
              About Connect cards
            </RouterLink>
            <RouterLink to="/support" class="text-on-surface no-underline hover:opacity-70">
              Support
            </RouterLink>
          </div>
          <div class="flex flex-col gap-2">
            <span class="font-label-caps text-label-caps text-on-surface-variant uppercase">Legal</span>
            <span class="text-on-surface opacity-50">Privacy</span>
            <span class="text-on-surface opacity-50">Terms</span>
          </div>
          <div class="flex flex-col gap-2">
            <span class="font-label-caps text-label-caps text-on-surface-variant uppercase">Social</span>
            <div class="flex gap-4 mt-1">
              <span class="material-symbols-outlined text-[20px]">share</span>
              <span class="material-symbols-outlined text-[20px]">public</span>
            </div>
          </div>
        </div>
        <div class="flex items-center justify-between pt-8 border-t border-border-subtle">
          <span class="text-[10px] uppercase font-label-caps text-ink-muted tracking-widest">
            © {{ new Date().getFullYear() }} TAP.NA
          </span>
        </div>
      </footer>
    </main>

    <ShopBottomNav />

    <ConnectPackageDialog
      :open="packageOpen"
      :mode="packageMode"
      :focus-id="packageFocusId"
      :solo-product-id="packageFocusId || 'blue-card'"
      @close="packageOpen = false"
      @switch-to-team="openPackage('team', packageFocusId || 'black-card')"
      @ordered="onPackageOrdered"
    />

    <div
      v-if="toast"
      class="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-[60] bg-primary text-on-primary px-5 py-3 font-label-caps text-[11px] uppercase tracking-widest shadow-lg"
      role="status"
    >
      <span>{{ toast }}</span>
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

@media (prefers-reduced-motion: reduce) {
  html.shop-home {
    scroll-behavior: auto;
  }
}

.hero-product {
  --hero-rot: 0deg;
  width: 42%;
  opacity: 0;
  transform: translateY(40px) scale(0.92) rotate(var(--hero-rot));
  transition:
    opacity 0.75s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.75s cubic-bezier(0.22, 1, 0.36, 1);
  will-change: opacity, transform;
}

.hero-product--left {
  left: 2%;
  top: 14%;
}

.hero-product--center {
  left: 29%;
  top: 4%;
  width: 46%;
}

.hero-product--right {
  right: 2%;
  left: auto;
  top: 18%;
}

.hero-product--in {
  opacity: 1;
  transform: translateY(0) scale(1) rotate(var(--hero-rot));
}

.hero-product--in:hover {
  transform: translateY(-4px) scale(1.04) rotate(var(--hero-rot));
}

@media (min-width: 768px) {
  .hero-product {
    width: 40%;
  }

  .hero-product--left {
    left: 0;
    top: 12%;
  }

  .hero-product--center {
    left: 28%;
    top: 2%;
    width: 44%;
  }

  .hero-product--right {
    right: 0;
    top: 16%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-product {
    opacity: 1;
    transform: rotate(var(--hero-rot));
    transition: none;
  }
}
</style>
