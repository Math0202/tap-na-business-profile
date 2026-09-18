<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { cartCount } from '../lib/cartStore'
import { isLoggedIn } from '../lib/profileStore'

defineProps({
  menuOpen: { type: Boolean, default: false },
})

const emit = defineEmits(['toggle-menu', 'close-menu', 'shop-all'])

const route = useRoute()
const count = cartCount
const loggedIn = computed(() => isLoggedIn())
const authTo = computed(() => (loggedIn.value ? '/profile' : '/login'))
const authLabel = computed(() => (loggedIn.value ? 'Account' : 'Login'))

const productsOpen = ref(false)
const mobileProductsOpen = ref(false)
const productsWrap = ref(null)

const productLinks = [
  { to: '/', label: 'Digital Business Cards' },
  { to: '/venue-display', label: 'Venue Display' }
]

function linkClass(active) {
  return active
    ? 'font-label-caps text-[11px] uppercase tracking-widest text-primary transition-colors no-underline'
    : 'font-label-caps text-[11px] uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors no-underline'
}

function isCardsActive() {
  const p = route.path
  return p === '/' || p.startsWith('/product/') || p.startsWith('/package/') || p.startsWith('/about/business-cards')
}

function isTableActive() {
  const p = route.path
  return p === '/venue-display' || p.startsWith('/table')
}

function isProductsActive() {
  return isCardsActive() || isTableActive()
}

function closeProducts() {
  productsOpen.value = false
}

function toggleProducts() {
  productsOpen.value = !productsOpen.value
}

function onDocClick(e) {
  if (!productsOpen.value) return
  if (productsWrap.value && !productsWrap.value.contains(e.target)) {
    closeProducts()
  }
}

function onKey(e) {
  if (e.key === 'Escape') closeProducts()
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKey)
})

onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKey)
})
</script>

<template>
  <header
    class="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-xl pt-safe shadow-[0_1px_8px_rgba(0,0,0,0.04)]"
  >
    <div
      class="h-16 px-margin-mobile md:px-margin-desktop max-w-6xl mx-auto flex items-center justify-between"
    >
      <RouterLink to="/" class="flex items-center gap-4 no-underline" @click="emit('close-menu'); closeProducts()">
        <img
          src="/images/tap-na_logo.png"
          alt="tap-na"
          class="h-8 w-auto object-contain"
          decoding="async"
        >
      </RouterLink>
      <nav class="hidden md:flex items-center gap-8">
        <div ref="productsWrap" class="relative">
          <button
            type="button"
            class="inline-flex items-center gap-1 bg-transparent border-0 p-0 cursor-pointer"
            :class="linkClass(isProductsActive())"
            :aria-expanded="productsOpen.toString()"
            aria-haspopup="true"
            @click.stop="toggleProducts"
          >
            Products
            <span
              class="material-symbols-outlined text-[16px] transition-transform"
              :class="productsOpen ? 'rotate-180' : ''"
              aria-hidden="true"
            >expand_more</span>
          </button>
          <div
            v-if="productsOpen"
            class="absolute left-0 top-full mt-3 min-w-[15rem] rounded-xl border border-border-subtle bg-surface shadow-lg py-2"
            role="menu"
          >
            <RouterLink
              v-for="item in productLinks"
              :key="item.to"
              :to="item.to"
              role="menuitem"
              class="block px-4 py-2.5 font-label-caps text-[11px] uppercase tracking-widest no-underline text-on-surface hover:bg-surface-container hover:text-primary transition-colors"
              @click="closeProducts"
            >
              {{ item.label }}
            </RouterLink>
          </div>
        </div>
        <RouterLink to="/support" :class="linkClass(route.path === '/support')">
          Support
        </RouterLink>
        <RouterLink
          :to="authTo"
          :class="linkClass(route.path === '/login' || route.path === '/profile')"
        >
          {{ authLabel }}
        </RouterLink>
      </nav>
      <div class="flex items-center gap-2">
        <RouterLink
          :to="authTo"
          class="hidden sm:flex md:hidden font-label-caps text-[11px] uppercase tracking-widest text-on-surface-variant no-underline px-2"
        >
          {{ authLabel }}
        </RouterLink>
        <RouterLink
          to="/cart"
          class="relative w-11 h-11 flex items-center justify-center text-on-surface"
          aria-label="Shopping cart"
        >
          <span class="material-symbols-outlined">shopping_bag</span>
          <span
            v-if="count > 0"
            class="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-on-primary font-label-caps text-[10px] leading-[18px] text-center"
          >
            {{ count > 99 ? '99+' : count }}
          </span>
        </RouterLink>
        <button
          type="button"
          class="w-11 h-11 flex items-center justify-center md:hidden"
          aria-label="Open menu"
          :aria-expanded="menuOpen.toString()"
          @click="emit('toggle-menu')"
        >
          <span class="material-symbols-outlined text-on-surface">{{ menuOpen ? 'close' : 'menu' }}</span>
        </button>
      </div>
    </div>
    <div
      v-if="menuOpen"
      class="md:hidden border-t border-border-subtle bg-surface px-margin-mobile py-4 flex flex-col gap-1"
    >
      <button
        type="button"
        class="w-full flex items-center justify-between font-label-caps text-[12px] uppercase tracking-widest py-2 bg-transparent border-0 text-left cursor-pointer text-inherit"
        :aria-expanded="mobileProductsOpen.toString()"
        @click="mobileProductsOpen = !mobileProductsOpen"
      >
        Products
        <span
          class="material-symbols-outlined text-[18px] transition-transform"
          :class="mobileProductsOpen ? 'rotate-180' : ''"
          aria-hidden="true"
        >expand_more</span>
      </button>
      <div v-if="mobileProductsOpen" class="flex flex-col pl-3 border-l border-border-subtle ml-1 mb-1">
        <RouterLink
          v-for="item in productLinks"
          :key="item.to"
          :to="item.to"
          class="font-label-caps text-[12px] uppercase tracking-widest py-2.5 no-underline text-on-surface-variant"
          @click="emit('close-menu'); mobileProductsOpen = false"
        >
          {{ item.label }}
        </RouterLink>
      </div>
      <RouterLink
        to="/support"
        class="font-label-caps text-[12px] uppercase tracking-widest py-2 no-underline text-inherit"
        @click="emit('close-menu')"
      >
        Support
      </RouterLink>
      <RouterLink
        :to="authTo"
        class="font-label-caps text-[12px] uppercase tracking-widest py-2 no-underline text-inherit"
        @click="emit('close-menu')"
      >
        {{ authLabel }}
      </RouterLink>
      <RouterLink
        v-if="!loggedIn"
        to="/signup"
        class="mt-2 bg-primary text-on-primary text-center py-3 font-button-text text-button-text uppercase tracking-widest no-underline"
        @click="emit('close-menu')"
      >
        Get Started
      </RouterLink>
    </div>
  </header>
</template>
