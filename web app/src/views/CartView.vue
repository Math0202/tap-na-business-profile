<script setup>
/** Cart storefront — prices in N$ */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import ShopHeader from '../components/ShopHeader.vue'
import ShopBottomNav from '../components/ShopBottomNav.vue'
import { formatPrice, loadShopProducts, TEAM_PACKAGE_MIN } from '../lib/shopCatalog'
import {
  cartLines,
  cartCount,
  cartSubtotal,
  cartTeamCount,
  cartTeamSubdomain,
  setCartQty,
  removeFromCart,
  clearCart,
  refreshCart,
} from '../lib/cartStore'
import { loadProfile } from '../lib/profileStore'
import { apiShopOrderQuote } from '../lib/api'

const router = useRouter()
const menuOpen = ref(false)
const checkoutNote = ref('')
const toast = ref('')
const checkoutOpen = ref(false)
const customerName = ref('')
const customerEmail = ref('')
const customerPhone = ref('')
const customerTown = ref('')
const checkoutError = ref('')
const submitting = ref(false)
let toastTimer = null

const lines = cartLines
const count = cartCount
const subtotal = cartSubtotal
const teamCount = cartTeamCount
const teamSubdomain = cartTeamSubdomain
const isEmpty = computed(() => lines.value.length === 0)

onMounted(async () => {
  document.title = 'Cart — tap-na'
  document.documentElement.classList.add('shop-home')
  await loadShopProducts()
  refreshCart()
  const profile = loadProfile()
  if (profile?.name) customerName.value = profile.name
  if (profile?.email) customerEmail.value = profile.email
  if (profile?.phone) customerPhone.value = profile.phone
})

onUnmounted(() => {
  document.documentElement.classList.remove('shop-home')
  clearTimeout(toastTimer)
})

function showToast(msg) {
  toast.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.value = ''
  }, 2200)
}

function shopAll() {
  menuOpen.value = false
  router.push({ path: '/', hash: '#connect-solo' })
}

function bump(id, delta) {
  const line = lines.value.find((l) => l.id === id)
  if (!line) return
  const next = line.qty + delta
  if (line.isTeam) {
    if (next < 0) return
    const ok = setCartQty(id, next)
    if (ok === false) {
      showToast(`Team mix must total at least ${TEAM_PACKAGE_MIN} cards`)
    }
    return
  }
  if (delta < 0 && next < 1) {
    removeFromCart(id)
    return
  }
  setCartQty(id, next)
}

function openCheckout() {
  if (isEmpty.value) return
  checkoutError.value = ''
  checkoutOpen.value = true
}

function closeCheckout() {
  checkoutOpen.value = false
  checkoutError.value = ''
}

async function placeOrder() {
  if (isEmpty.value || submitting.value) return

  const name = customerName.value.trim()
  const email = customerEmail.value.trim()
  const phone = customerPhone.value.trim()
  const town = customerTown.value.trim()

  if (!name) {
    checkoutError.value = 'Please enter your full name.'
    return
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    checkoutError.value = 'Please enter a valid email address.'
    return
  }
  if (!phone || phone.replace(/\D/g, '').length < 7) {
    checkoutError.value = 'Please enter a valid cellphone number.'
    return
  }
  if (!town) {
    checkoutError.value = 'Please enter your town.'
    return
  }

  checkoutError.value = ''
  submitting.value = true
  try {
    const subdomainNote = teamSubdomain.value
      ? `Custom subdomain request: ${teamSubdomain.value}`
      : teamCount.value >= 10
        ? 'Team pack 10+ (subdomain optional — not specified)'
        : ''
    const combinedNote = [checkoutNote.value.trim(), subdomainNote].filter(Boolean).join('\n')
    const res = await apiShopOrderQuote({
      name,
      email,
      phone,
      town,
      note: combinedNote,
      items: lines.value.map((l) => ({
        id: l.id,
        name: l.name,
        qty: l.qty,
        price: l.price
      }))
    })
    if (!res.ok) {
      checkoutError.value = res.error || 'Could not send quote. Please try again.'
      return
    }
    clearCart()
    checkoutOpen.value = false
    checkoutNote.value = ''
    showToast('Quote emailed to you and auckmund@gmail.com')
  } finally {
    submitting.value = false
  }
}
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
      <div class="max-w-6xl mx-auto px-margin-mobile md:px-margin-desktop pt-stack-md md:pt-10">
        <div class="flex items-end justify-between gap-4 mb-8">
          <div class="flex flex-col gap-1">
            <h1 class="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg uppercase">
              Your Cart
            </h1>
            <div class="h-1 w-12 bg-primary" />
          </div>
          <span class="font-label-caps text-label-caps text-ink-muted">
            {{ count }} {{ count === 1 ? 'ITEM' : 'ITEMS' }}
          </span>
        </div>

        <!-- Empty state -->
        <div
          v-if="isEmpty"
          class="flex flex-col items-center text-center gap-6 py-16 px-4"
        >
          <div
            class="w-20 h-20 rounded-full bg-surface-container flex items-center justify-center"
          >
            <span class="material-symbols-outlined text-[36px] text-ink-muted">shopping_bag</span>
          </div>
          <div class="flex flex-col gap-2 max-w-sm">
            <h2 class="font-headline-lg-mobile text-[22px] font-medium">Cart is empty</h2>
            <p class="text-on-surface-variant text-sm">
              Add NFC tap cards for your business, restaurant, or personal profile — then check out here.
            </p>
          </div>
          <RouterLink
            to="/"
            class="bg-primary text-on-primary px-8 py-4 font-button-text text-button-text uppercase tracking-widest rounded-full no-underline"
          >
            Continue Shopping
          </RouterLink>
        </div>

        <!-- Cart lines -->
        <div v-else class="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-10 items-start">
          <ul class="flex flex-col gap-0 divide-y divide-border-subtle border-y border-border-subtle list-none p-0 m-0">
            <li
              v-for="line in lines"
              :key="line.id"
              class="flex gap-4 py-6"
            >
              <div class="w-24 h-24 md:w-28 md:h-28 shrink-0 bg-surface-container rounded-lg overflow-hidden flex items-center justify-center p-2">
                <img
                  :src="line.image"
                  :alt="line.alt"
                  class="w-full h-full object-contain"
                >
              </div>
              <div class="flex-1 min-w-0 flex flex-col gap-3">
                <div class="flex justify-between gap-3 items-start">
                  <div class="min-w-0">
                    <h3 class="font-headline-lg-mobile text-[18px] font-medium truncate">
                      {{ line.name }}
                    </h3>
                    <p class="text-on-surface-variant text-sm line-clamp-1">{{ line.desc }}</p>
                    <p
                      v-if="line.label"
                      class="font-label-caps text-[11px] text-primary uppercase mt-1"
                    >
                      {{ line.label }}
                    </p>
                    <p
                      v-else-if="line.isTeam"
                      class="font-label-caps text-[11px] text-ink-muted uppercase mt-1"
                    >
                      Team
                    </p>
                    <p v-else class="font-label-caps text-[11px] text-ink-muted uppercase mt-1">
                      Solo
                    </p>
                  </div>
                  <span class="font-label-caps text-label-caps shrink-0">
                    {{ formatPrice(line.lineTotal) }}
                  </span>
                </div>
                <div class="flex items-center justify-between gap-3">
                  <div class="inline-flex items-center border border-border-subtle rounded-full overflow-hidden">
                    <button
                      type="button"
                      class="w-10 h-10 flex items-center justify-center hover:bg-surface-container transition-colors"
                      aria-label="Decrease quantity"
                      @click="bump(line.id, -1)"
                    >
                      <span class="material-symbols-outlined text-[18px]">remove</span>
                    </button>
                    <span class="w-10 text-center font-label-caps text-[12px]">{{ line.qty }}</span>
                    <button
                      type="button"
                      class="w-10 h-10 flex items-center justify-center hover:bg-surface-container transition-colors"
                      aria-label="Increase quantity"
                      @click="bump(line.id, 1)"
                    >
                      <span class="material-symbols-outlined text-[18px]">add</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    class="font-label-caps text-[11px] uppercase tracking-widest text-ink-muted hover:text-primary transition-colors"
                    @click="removeFromCart(line.id)"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          </ul>

          <!-- Summary -->
          <aside class="bg-surface-container rounded-xl p-6 md:p-8 flex flex-col gap-6 lg:sticky lg:top-24">
            <h2 class="font-label-caps text-label-caps uppercase tracking-widest">Order Summary</h2>
            <div class="flex flex-col gap-3 text-sm">
              <div class="flex justify-between">
                <span class="text-on-surface-variant">Subtotal</span>
                <span class="font-label-caps text-label-caps">{{ formatPrice(subtotal) }}</span>
              </div>
              <div v-if="teamCount > 0" class="flex justify-between">
                <span class="text-on-surface-variant">Team cards</span>
                <span class="font-label-caps text-[11px] uppercase tracking-widest">{{ teamCount }}</span>
              </div>
              <div v-if="teamSubdomain" class="flex flex-col gap-1">
                <span class="text-on-surface-variant">Custom subdomain</span>
                <span class="font-label-caps text-[11px] uppercase tracking-widest break-all">
                  {{ teamSubdomain }}
                </span>
              </div>
              <div class="flex justify-between">
                <span class="text-on-surface-variant">Shipping</span>
                <span class="font-label-caps text-[11px] text-ink-muted uppercase">Calculated later</span>
              </div>
              <div class="h-px bg-border-subtle my-1" />
              <div class="flex justify-between items-baseline">
                <span class="font-button-text text-button-text uppercase tracking-widest">Total</span>
                <span class="font-display-lg text-[28px] font-semibold leading-none">
                  {{ formatPrice(subtotal) }}
                </span>
              </div>
            </div>

            <label class="flex flex-col gap-2">
              <span class="font-label-caps text-[10px] uppercase tracking-[0.2em] text-ink-muted">
                Order notes
              </span>
              <textarea
                v-model="checkoutNote"
                rows="3"
                class="w-full bg-surface-container-lowest border border-border-subtle rounded-lg px-3 py-3 text-sm text-on-surface focus:outline-none focus:border-primary resize-y"
                placeholder="Delivery address, branding notes, quantity details…"
              />
            </label>

            <button
              type="button"
              class="w-full bg-primary text-on-primary py-4 font-button-text text-button-text uppercase tracking-widest hover:opacity-90 transition-opacity"
              @click="openCheckout"
            >
              Place Order
            </button>
            <button
              type="button"
              class="w-full border border-primary text-primary py-3 font-button-text text-[12px] uppercase tracking-widest hover:bg-primary hover:text-on-primary transition-colors"
              @click="shopAll"
            >
              Keep Shopping
            </button>
            <button
              type="button"
              class="font-label-caps text-[10px] uppercase tracking-widest text-ink-muted hover:text-primary transition-colors"
              @click="clearCart(); showToast('Cart cleared')"
            >
              Clear cart
            </button>
          </aside>
        </div>
      </div>
    </main>

    <ShopBottomNav />

    <!-- Checkout contact prompt -->
    <div
      v-if="checkoutOpen"
      class="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-title"
    >
      <button
        type="button"
        class="absolute inset-0 bg-black/40 border-0 cursor-pointer"
        aria-label="Close checkout"
        @click="closeCheckout"
      />
      <div class="relative w-full max-w-md bg-surface rounded-t-2xl sm:rounded-2xl p-6 md:p-8 flex flex-col gap-5 shadow-xl">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h2 id="checkout-title" class="font-headline-lg-mobile text-[22px] font-medium">
              Request a quote
            </h2>
            <p class="text-on-surface-variant text-sm mt-1">
              We’ll email your order quote to you and to auckmund@gmail.com.
            </p>
          </div>
          <button
            type="button"
            class="w-10 h-10 flex items-center justify-center text-on-surface-variant hover:text-primary"
            aria-label="Close"
            @click="closeCheckout"
          >
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <form class="flex flex-col gap-4" @submit.prevent="placeOrder">
          <label class="flex flex-col gap-1.5">
            <span class="font-label-caps text-[10px] uppercase tracking-[0.2em] text-ink-muted">
              Full name
            </span>
            <input
              v-model="customerName"
              type="text"
              autocomplete="name"
              required
              class="w-full bg-surface-container-lowest border border-border-subtle rounded-lg px-3 py-3 text-sm text-on-surface focus:outline-none focus:border-primary"
              placeholder="Jane Doe"
            >
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="font-label-caps text-[10px] uppercase tracking-[0.2em] text-ink-muted">
              Email
            </span>
            <input
              v-model="customerEmail"
              type="email"
              autocomplete="email"
              required
              class="w-full bg-surface-container-lowest border border-border-subtle rounded-lg px-3 py-3 text-sm text-on-surface focus:outline-none focus:border-primary"
              placeholder="you@example.com"
            >
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="font-label-caps text-[10px] uppercase tracking-[0.2em] text-ink-muted">
              Cellphone number
            </span>
            <input
              v-model="customerPhone"
              type="tel"
              autocomplete="tel"
              required
              class="w-full bg-surface-container-lowest border border-border-subtle rounded-lg px-3 py-3 text-sm text-on-surface focus:outline-none focus:border-primary"
              placeholder="+264 81 000 0000"
            >
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="font-label-caps text-[10px] uppercase tracking-[0.2em] text-ink-muted">
              Town
            </span>
            <input
              v-model="customerTown"
              type="text"
              autocomplete="address-level2"
              required
              class="w-full bg-surface-container-lowest border border-border-subtle rounded-lg px-3 py-3 text-sm text-on-surface focus:outline-none focus:border-primary"
              placeholder="Windhoek"
            >
          </label>

          <p v-if="checkoutError" class="text-sm text-red-600 min-h-[1.25rem]">{{ checkoutError }}</p>

          <button
            type="submit"
            class="w-full bg-primary text-on-primary py-4 font-button-text text-button-text uppercase tracking-widest hover:opacity-90 transition-opacity disabled:opacity-60"
            :disabled="submitting"
          >
            {{ submitting ? 'Sending quote…' : 'Email quote' }}
          </button>
        </form>
      </div>
    </div>

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