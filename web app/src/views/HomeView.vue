<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import ShopHeader from '../components/ShopHeader.vue'
import ShopBottomNav from '../components/ShopBottomNav.vue'
import {
  businessCardsList,
  tableBrochuresList,
  formatPrice,
  loadShopProducts,
} from '../lib/shopCatalog'
import { addToCart } from '../lib/cartStore'

const route = useRoute()
const menuOpen = ref(false)
const subscribed = ref(false)
const email = ref('')
const toast = ref('')
const sections = ref([])
const catalogTick = ref(0)
const heroMenuIn = ref(false)
const heroCardIn = ref(false)
let observer = null
let toastTimer = null
let heroCardTimer = null

const cards = computed(() => {
  catalogTick.value
  return businessCardsList()
})
const brochures = computed(() => {
  catalogTick.value
  return tableBrochuresList()
})

async function refreshCatalog() {
  await loadShopProducts()
  catalogTick.value += 1
}

function scrollToShop() {
  menuOpen.value = false
  document.getElementById('business-cards')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function scrollToBrochures() {
  menuOpen.value = false
  document.getElementById('table-brochures')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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

function addProduct(id, name) {
  if (!addToCart(id)) return
  showToast(`${name} added to cart`)
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
    if (hash === '#business-cards') nextTick(() => scrollToShop())
    if (hash === '#table-brochures') nextTick(() => scrollToBrochures())
  }
)

onMounted(async () => {
  document.title = 'tap-na — Shop'
  document.documentElement.classList.add('shop-home')
  await refreshCatalog()
  await nextTick()
  requestAnimationFrame(() => {
    heroMenuIn.value = true
  })
  heroCardTimer = setTimeout(() => {
    heroCardIn.value = true
  }, 2000)
  if (route.hash === '#business-cards') scrollToShop()
  if (route.hash === '#table-brochures') scrollToBrochures()
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
  clearTimeout(heroCardTimer)
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
      <div class="flex flex-col w-full overflow-x-hidden max-w-6xl mx-auto">
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

            <!-- Product visuals -->
            <div
              class="relative z-[1] order-1 md:order-2 flex-1 min-h-[280px] md:min-h-full md:absolute md:inset-y-0 md:right-0 md:w-[58%] flex items-center justify-center px-6 pt-8 md:pt-0 md:pr-10"
            >
              <div class="relative w-full max-w-[420px] aspect-[4/5] md:max-w-none md:h-[86%] md:aspect-auto md:w-[92%]">
                <button
                  type="button"
                  class="hero-product absolute left-[-4%] top-[8%] w-[58%] rounded-lg shadow-[0_24px_60px_rgba(0,0,0,0.55)] overflow-hidden aspect-[3/4] p-0 border-0 bg-transparent cursor-pointer"
                  :class="{ 'hero-product--in': heroMenuIn }"
                  style="--hero-rot: -8deg"
                  aria-label="Shop custom menu cards"
                  @click="scrollToBrochures"
                >
                  <img
                    src="/images/table/NFC%20custom%20menu%20card.png"
                    alt="Custom menu NFC table card"
                    class="w-full h-full object-cover"
                  >
                </button>
                <button
                  type="button"
                  class="hero-product absolute right-[6%] bottom-[8%] w-[43%] md:w-[47%] p-0 border-0 bg-transparent cursor-pointer drop-shadow-[0_28px_70px_rgba(0,0,0,0.65)]"
                  :class="{ 'hero-product--in': heroCardIn }"
                  style="--hero-rot: 5deg"
                  aria-label="Shop Connect business cards"
                  @click="scrollToShop"
                >
                  <img
                    src="/images/business_charcoal.png"
                    alt="Business charcoal Connect NFC card"
                    class="w-full h-auto block"
                  >
                </button>
              </div>
            </div>

            <div class="relative z-10 order-2 md:order-1 flex flex-col gap-4 max-w-xl px-8 pb-10 pt-2 md:p-14 md:pr-8 md:pb-14 md:w-[48%]">
              <span
                class="font-label-caps text-label-caps text-secondary-fixed-dim uppercase tracking-[0.2em]"
              >
                Next-Gen Networking
              </span>
              <h1
                class="font-display-lg text-[42px] md:text-[64px] leading-[1.1] md:leading-[1.05] text-on-primary tracking-[-0.02em] font-semibold"
              >
                Anything NFC <br> You Want.
              </h1>
              <p class="text-on-tertiary-container max-w-[90%] md:max-w-md text-body-md">
                From personal Connect cards to table menu taps — professional NFC, ready to order.
              </p>
              <div class="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  class="bg-surface-container-lowest text-primary font-button-text text-button-text px-8 py-4 rounded-full uppercase tracking-widest hover:bg-primary-fixed transition-all active:scale-95"
                  @click="scrollToShop"
                >
                  Shop cards
                </button>
                <button
                  type="button"
                  class="border border-on-primary/40 text-on-primary font-button-text text-button-text px-8 py-4 rounded-full uppercase tracking-widest hover:bg-on-primary/10 transition-all"
                  @click="scrollToBrochures"
                >
                  Table top tap
                </button>
              </div>
              <div class="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[11px] uppercase tracking-[0.16em] text-on-primary/55">
                <span>Connect card</span>
                <span aria-hidden="true">·</span>
                <span>Custom menu</span>
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

        <!-- Business Cards -->
        <section
          id="business-cards"
          :ref="setSectionRef"
          class="px-margin-mobile md:px-margin-desktop pt-stack-lg flex flex-col gap-8 scroll-mt-20"
        >
          <div class="flex justify-between items-end">
            <div class="flex flex-col gap-1">
              <h2 class="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg uppercase">
                Business Cards
              </h2>
              <div class="h-1 w-12 bg-primary" />
            </div>
            <span class="font-label-caps text-label-caps text-ink-muted">{{ cards.length }} ITEMS</span>
          </div>

          <div class="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-12 md:gap-8">
            <article
              v-for="product in cards"
              :key="product.id"
              class="flex flex-col gap-4 group"
            >
              <RouterLink
                :to="`/product/${product.id}`"
                class="no-underline text-inherit flex flex-col gap-4"
              >
                <div class="aspect-[3/4] bg-surface-container overflow-hidden rounded-xl relative flex items-center justify-center p-4">
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
                <div class="flex flex-col gap-1">
                  <div class="flex justify-between items-start gap-3">
                    <h3 class="font-headline-lg-mobile text-[20px] font-medium">{{ product.name }}</h3>
                    <span class="font-label-caps text-label-caps shrink-0">{{ formatPrice(product.price) }}</span>
                  </div>
                  <p v-if="product.label" class="font-label-caps text-[11px] uppercase tracking-widest text-primary">
                    {{ product.label }}
                  </p>
                  <p class="text-on-surface-variant text-sm line-clamp-1">{{ product.desc }}</p>
                </div>
              </RouterLink>
              <button
                type="button"
                class="w-full border border-primary text-primary py-4 font-button-text uppercase tracking-widest hover:bg-primary hover:text-on-primary transition-colors"
                @click="addProduct(product.id, product.name)"
              >
                Add to Cart
              </button>
            </article>
          </div>
        </section>

        <!-- Table top tap  -->
        <section
          id="table-brochures"
          :ref="setSectionRef"
          class="px-margin-mobile md:px-margin-desktop pt-stack-lg flex flex-col gap-8 scroll-mt-20"
        >
          <div class="flex justify-between items-end gap-4">
            <div class="flex flex-col gap-1 min-w-0">
              <h2 class="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg uppercase">
                Table Top Tap
              </h2>
              <div class="h-1 w-12 bg-primary" />
              <p class="text-on-surface-variant text-sm mt-1">
                 — Business &amp; Restaurant
              </p>
            </div>
            <span class="font-label-caps text-label-caps text-ink-muted shrink-0">{{ brochures.length }} ITEMS</span>
          </div>

          <div class="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-12 md:gap-8">
            <article
              v-for="product in brochures"
              :key="product.id"
              class="flex flex-col gap-4 group"
            >
              <RouterLink
                :to="`/product/${product.id}`"
                class="no-underline text-inherit flex flex-col gap-4"
              >
                <div class="aspect-[3/4] bg-surface-container overflow-hidden rounded-xl relative flex items-center justify-center p-4">
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
                <div class="flex flex-col gap-1">
                  <div class="flex justify-between items-start gap-3">
                    <h3 class="font-headline-lg-mobile text-[20px] font-medium">{{ product.name }}</h3>
                    <span class="font-label-caps text-label-caps shrink-0">{{ formatPrice(product.price) }}</span>
                  </div>
                  <p v-if="product.label" class="font-label-caps text-[11px] uppercase tracking-widest text-primary">
                    {{ product.label }}
                  </p>
                  <p class="text-on-surface-variant text-sm line-clamp-1">{{ product.desc }}</p>
                </div>
              </RouterLink>
              <button
                type="button"
                class="w-full border border-primary text-primary py-4 font-button-text uppercase tracking-widest hover:bg-primary hover:text-on-primary transition-colors"
                @click="addProduct(product.id, product.name)"
              >
                Add to Cart
              </button>
            </article>
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
                Join the Lab
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
              Business Cards
            </button>
            <button
              type="button"
              class="text-left text-on-surface hover:opacity-70"
              @click="scrollToBrochures"
            >
              Table Brochures
            </button>
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

    <div
      v-if="toast"
      class="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-[60] bg-primary text-on-primary px-5 py-3 font-label-caps text-[11px] uppercase tracking-widest shadow-lg flex items-center gap-3"
      role="status"
    >
      <span>{{ toast }}</span>
      <RouterLink to="/cart" class="underline text-on-primary no-underline decoration-white underline-offset-2">
        View
      </RouterLink>
    </div>
  </div>
</template>

<style>
html.shop-home,
html.shop-home body {
  background-color: #f9f9f9 !important;
  color: #1a1c1c;
}

.hero-product {
  --hero-rot: 0deg;
  opacity: 0;
  transform: translateY(40px) scale(0.92) rotate(var(--hero-rot));
  transition:
    opacity 0.75s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.75s cubic-bezier(0.22, 1, 0.36, 1);
  will-change: opacity, transform;
}

.hero-product--in {
  opacity: 1;
  transform: translateY(0) scale(1) rotate(var(--hero-rot));
}

.hero-product--in:hover {
  transform: translateY(0) scale(1.03) rotate(var(--hero-rot));
}

@media (prefers-reduced-motion: reduce) {
  .hero-product {
    opacity: 1;
    transform: rotate(var(--hero-rot));
    transition: none;
  }
}
</style>
