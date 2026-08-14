<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import ShopHeader from '../components/ShopHeader.vue'
import { tableBrochuresList, formatPrice, loadShopProducts } from '../lib/shopCatalog'
import { addToCart } from '../lib/cartStore'
import { BRAND_SOCIAL_LINKS } from '../lib/brandLinks'
import { setPageSeo } from '../lib/seo'

const route = useRoute()
const router = useRouter()
const menuOpen = ref(false)
const toast = ref('')
const sections = ref([])
const catalogTick = ref(0)
const heroIn = ref(false)
let observer = null
let toastTimer = null

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
  document.getElementById('table-products')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function goConnect() {
  menuOpen.value = false
  router.push('/')
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
    if (hash === '#table-products' || hash === '#table-brochures') nextTick(() => scrollToShop())
  }
)

onMounted(async () => {
  document.documentElement.classList.add('shop-home')
  setPageSeo({
    title: 'Venue Display NFC cards — tap-na Windhoek',
    description:
      'NFC Venue Display cards in Namibia for restaurants and businesses. Menus, reviews, Wi-Fi, and guest check-in — tap once at the table. Free Windhoek delivery.',
    path: '/venue-display'
  })
  await refreshCatalog()
  await nextTick()
  requestAnimationFrame(() => {
    heroIn.value = true
  })
  if (route.hash === '#table-products' || route.hash === '#table-brochures') scrollToShop()
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

    <main class="pt-16 min-h-screen bg-surface pb-10">
      <div class="flex flex-col w-full overflow-x-clip max-w-6xl mx-auto">
        <section
          :ref="setSectionRef"
          class="px-margin-mobile md:px-margin-desktop pt-stack-md md:pt-10 flex flex-col gap-6"
        >
          <div
            class="relative overflow-hidden bg-surface-charcoal rounded-xl min-h-[480px] md:min-h-[520px] flex flex-col md:flex-row md:items-end"
          >
            <div
              class="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_40%,rgba(255,255,255,0.12)_0%,transparent_55%)]"
              aria-hidden="true"
            />
            <div
              class="absolute inset-0 bg-gradient-to-t from-surface-charcoal via-surface-charcoal/40 to-transparent md:bg-gradient-to-r md:from-surface-charcoal md:via-surface-charcoal/80 md:to-transparent"
              aria-hidden="true"
            />
            <div
              class="relative z-[1] order-1 md:order-2 flex-1 min-h-[260px] md:min-h-full md:absolute md:inset-y-0 md:right-0 md:w-[55%] flex items-center justify-center px-6 pt-8 md:pt-0 md:pr-10"
            >
              <button
                type="button"
                class="hero-product w-[70%] max-w-[320px] rounded-lg shadow-[0_24px_60px_rgba(0,0,0,0.55)] overflow-hidden aspect-[3/4] p-0 border-0 bg-transparent cursor-pointer"
                :class="{ 'hero-product--in': heroIn }"
                style="--hero-rot: -4deg"
                aria-label="Browse table top products"
                @click="scrollToShop"
              >
                <img
                  src="/images/table/NFC%20custom%20menu%20card.png"
                  alt="Custom menu NFC table card"
                  class="w-full h-full object-cover"
                >
              </button>
            </div>
            <div class="relative z-10 order-2 md:order-1 flex flex-col gap-4 max-w-xl px-8 pb-10 pt-2 md:p-14 md:pr-8 md:pb-14 md:w-[50%]">
              <span class="font-label-caps text-label-caps text-secondary-fixed-dim uppercase tracking-[0.2em]">
                Business &amp; Restaurant
              </span>
              <h1 class="font-display-lg text-[40px] md:text-[56px] leading-[1.1] text-on-primary tracking-[-0.02em] font-semibold">
                Venue Display
              </h1>
              <p class="text-on-tertiary-container max-w-[90%] md:max-w-md text-body-md">
                NFC cards for tables — menus, reviews, Wi-Fi, and guest check-in. Guests tap and go. No app required.
              </p>
              <div class="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  class="bg-surface-container-lowest text-primary font-button-text text-button-text px-8 py-4 rounded-full uppercase tracking-widest hover:bg-primary-fixed transition-all active:scale-95"
                  @click="scrollToShop"
                >
                  Shop table cards
                </button>
                <button
                  type="button"
                  class="border border-on-primary/40 text-on-primary font-button-text text-button-text px-8 py-4 rounded-full uppercase tracking-widest hover:bg-on-primary/10 transition-all"
                  @click="goConnect"
                >
                  Connect cards
                </button>
              </div>
            </div>
          </div>
        </section>

        <section
          id="table-products"
          :ref="setSectionRef"
          class="px-margin-mobile md:px-margin-desktop pt-stack-lg flex flex-col gap-8 scroll-mt-20"
        >
          <div class="flex justify-between items-end gap-4">
            <div class="flex flex-col gap-1 min-w-0">
              <h2 class="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg uppercase">
                Venue Display
              </h2>
              <div class="h-1 w-12 bg-primary" />
              <p class="text-on-surface-variant text-sm mt-1">Business &amp; restaurant NFC</p>
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
      </div>

      <footer class="mt-stack-lg px-margin-mobile md:px-margin-desktop pb-stack-lg flex flex-col gap-8 max-w-6xl mx-auto">
        <div class="grid grid-cols-2 md:grid-cols-3 gap-y-6 gap-x-8">
          <div class="flex flex-col gap-2">
            <span class="font-label-caps text-label-caps text-on-surface-variant uppercase">Shop</span>
            <RouterLink to="/" class="text-on-surface no-underline hover:opacity-70">Connect cards</RouterLink>
            <button type="button" class="text-left text-on-surface hover:opacity-70" @click="scrollToShop">
              Venue Display
            </button>
            <RouterLink to="/cart" class="text-on-surface no-underline hover:opacity-70">Cart</RouterLink>
          </div>
          <div class="flex flex-col gap-2">
            <span class="font-label-caps text-label-caps text-on-surface-variant uppercase">Info</span>
            <RouterLink to="/about/business-cards" class="text-on-surface no-underline hover:opacity-70">
              About Connect cards
            </RouterLink>
            <RouterLink to="/support" class="text-on-surface no-underline hover:opacity-70">Support</RouterLink>
          </div>
          <div class="flex flex-col gap-2">
            <span class="font-label-caps text-label-caps text-on-surface-variant uppercase">Social</span>
            <a
              v-for="link in BRAND_SOCIAL_LINKS"
              :key="link.id"
              :href="link.href"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-2 text-on-surface no-underline hover:opacity-70"
            >
              <span class="material-symbols-outlined text-[18px]" aria-hidden="true">{{ link.icon }}</span>
              <span class="text-sm">{{ link.label }}</span>
            </a>
          </div>
        </div>
        <div class="flex items-center justify-between pt-8 border-t border-border-subtle">
          <span class="text-[10px] uppercase font-label-caps text-ink-muted tracking-widest">
            © {{ new Date().getFullYear() }} TAP.NA
          </span>
        </div>
      </footer>
    </main>

    <div
      v-if="toast"
      class="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] bg-primary text-on-primary px-5 py-3 font-label-caps text-[11px] uppercase tracking-widest shadow-lg flex items-center gap-3"
      role="status"
    >
      <span>{{ toast }}</span>
      <RouterLink to="/cart" class="underline text-on-primary decoration-white underline-offset-2">View</RouterLink>
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
  opacity: 0;
  transform: translateY(40px) scale(0.92) rotate(var(--hero-rot));
  transition:
    opacity 0.75s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.75s cubic-bezier(0.22, 1, 0.36, 1);
}
.hero-product--in {
  opacity: 1;
  transform: translateY(0) scale(1) rotate(var(--hero-rot));
}
</style>