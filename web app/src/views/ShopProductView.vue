<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import ShopHeader from '../components/ShopHeader.vue'
import ShopBottomNav from '../components/ShopBottomNav.vue'
import { formatPrice, getProduct, loadShopProducts } from '../lib/shopCatalog'
import { addToCart } from '../lib/cartStore'
import { youtubeEmbedUrl } from '../lib/shareHelpers'
import { setPageSeo } from '../lib/seo'

const route = useRoute()
const router = useRouter()
const menuOpen = ref(false)
const loading = ref(true)
const toast = ref('')
const activeImage = ref(0)
let toastTimer = null

const productId = computed(() => String(route.params.id || '').trim())
const product = computed(() => {
  const id = productId.value
  if (!id) return null
  const p = getProduct(id)
  if (!p || p.deleted || p.active === false) return null
  return p
})

const gallery = computed(() => {
  const p = product.value
  if (!p) return []
  const images = Array.isArray(p.images) ? p.images.filter(Boolean) : []
  if (images.length) return images
  return p.image ? [p.image] : []
})

const videoEmbed = computed(() => youtubeEmbedUrl(product.value?.video || ''))
const videoDirect = computed(() => {
  const raw = String(product.value?.video || '').trim()
  if (!raw || videoEmbed.value) return ''
  if (/^https?:\/\//i.test(raw) || raw.startsWith('data:video')) return raw
  return ''
})

watch(gallery, () => {
  activeImage.value = 0
})

async function refresh() {
  loading.value = true
  await loadShopProducts()
  loading.value = false
  if (!product.value) {
    setPageSeo({
      title: 'Product not found — tap-na',
      description: 'This Tap-Na shop product is unavailable.',
      path: route.fullPath,
      noindex: true
    })
    return
  }
  const p = product.value
  setPageSeo({
    title: `${p.name} — tap-na`,
    description:
      String(p.desc || '').trim().slice(0, 160) ||
      `${p.name} NFC Connect card on tap-na. Once-off purchase.`,
    path: `/product/${p.id}`,
    image: p.image || p.images?.[0] || ''
  })
}

function shopAll() {
  menuOpen.value = false
  router.push({ path: '/', hash: '#business-cards' })
}

function showToast(msg) {
  toast.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.value = ''
  }, 2200)
}

function addProduct() {
  const p = product.value
  if (!p) return
  if (!addToCart(p.id)) return
  showToast(`${p.name} added to cart`)
}

watch(productId, () => {
  refresh()
})

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

    <main class="pt-16 min-h-screen bg-surface pb-24 md:pb-10">
      <div class="max-w-6xl mx-auto px-margin-mobile md:px-margin-desktop py-8">
        <button
          type="button"
          class="inline-flex items-center gap-1 text-on-surface-variant hover:text-primary mb-6 font-label-caps text-[11px] uppercase tracking-widest"
          @click="router.push('/')"
        >
          <span class="material-symbols-outlined text-[18px]">arrow_back</span>
          Back to shop
        </button>

        <p v-if="loading" class="text-on-surface-variant py-16 text-center">Loading…</p>

        <div
          v-else-if="!product"
          class="py-16 text-center flex flex-col items-center gap-4"
        >
          <span class="material-symbols-outlined text-[48px] text-on-surface-variant opacity-40">inventory_2</span>
          <p class="text-on-surface-variant">This product is unavailable.</p>
          <RouterLink
            to="/"
            class="border border-primary text-primary px-8 py-3 font-button-text uppercase tracking-widest no-underline hover:bg-primary hover:text-on-primary transition-colors"
          >
            Browse shop
          </RouterLink>
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-14">
          <div class="flex flex-col gap-3">
            <div
              class="aspect-[3/4] bg-surface-container overflow-hidden rounded-xl relative flex items-center justify-center p-6"
            >
              <img
                v-if="gallery[activeImage]"
                :src="gallery[activeImage]"
                :alt="product.alt || product.name"
                class="w-full h-full object-contain"
              >
              <span
                v-else
                class="material-symbols-outlined text-on-surface-variant text-[64px] opacity-40"
                aria-hidden="true"
              >image</span>
              <div
                v-if="product.badge"
                class="absolute top-4 left-4 bg-primary text-on-primary px-3 py-1 font-label-caps text-[10px] uppercase tracking-widest"
              >
                {{ product.badge }}
              </div>
            </div>
            <div v-if="gallery.length > 1" class="flex gap-2 overflow-x-auto pb-1">
              <button
                v-for="(src, i) in gallery"
                :key="src + i"
                type="button"
                class="w-16 h-16 rounded-lg overflow-hidden bg-surface-container shrink-0 border-2 transition-colors"
                :class="i === activeImage ? 'border-primary' : 'border-transparent'"
                @click="activeImage = i"
              >
                <img :src="src" alt="" class="w-full h-full object-contain p-1">
              </button>
            </div>
          </div>

          <div class="flex flex-col gap-5 md:pt-2">
            <div class="flex flex-col gap-2">
              <p
                v-if="product.label"
                class="font-label-caps text-[11px] uppercase tracking-widest text-primary"
              >
                {{ product.label }}
              </p>
              <h1 class="font-headline-lg-mobile md:font-headline-lg text-[32px] md:text-[40px] font-semibold leading-tight">
                {{ product.name }}
              </h1>
              <p class="font-label-caps text-label-caps text-lg">
                {{ formatPrice(product.price) }}
              </p>
            </div>

            <p
              v-if="product.desc"
              class="text-on-surface-variant text-base leading-relaxed whitespace-pre-wrap"
            >
              {{ product.desc }}
            </p>
            <p v-else class="text-on-surface-variant text-sm opacity-60">
              No description yet.
            </p>

            <div v-if="videoEmbed" class="rounded-xl overflow-hidden bg-surface-container aspect-video">
              <iframe
                :src="videoEmbed"
                class="w-full h-full border-0"
                title="Product video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen
              />
            </div>
            <video
              v-else-if="videoDirect"
              :src="videoDirect"
              class="w-full rounded-xl bg-surface-container"
              controls
              playsinline
            />

            <div class="flex flex-col sm:flex-row gap-3 mt-2">
              <button
                type="button"
                class="flex-1 bg-primary text-on-primary py-4 font-button-text uppercase tracking-widest hover:opacity-90 transition-opacity"
                @click="addProduct"
              >
                Add to cart
              </button>
              <RouterLink
                to="/cart"
                class="flex-1 border border-primary text-primary py-4 font-button-text uppercase tracking-widest text-center no-underline hover:bg-primary hover:text-on-primary transition-colors"
              >
                View cart
              </RouterLink>
            </div>
          </div>
        </div>
      </div>
    </main>

    <ShopBottomNav />

    <div
      v-if="toast"
      class="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-[60] bg-primary text-on-primary px-5 py-3 font-label-caps text-[11px] uppercase tracking-widest shadow-lg flex items-center gap-3"
      role="status"
    >
      <span>{{ toast }}</span>
      <RouterLink to="/cart" class="underline text-on-primary decoration-white underline-offset-2">
        View
      </RouterLink>
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
