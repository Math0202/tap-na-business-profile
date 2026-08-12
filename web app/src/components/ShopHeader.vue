<script setup>
import { computed } from 'vue'
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

function linkClass(active) {
  return active
    ? 'font-label-caps text-[11px] uppercase tracking-widest text-primary transition-colors no-underline'
    : 'font-label-caps text-[11px] uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors no-underline'
}

function isCardsActive() {
  const p = route.path
  return p === '/' || p.startsWith('/product/') || p.startsWith('/package/') || p.startsWith('/about/business-cards')
}
</script>

<template>
  <header
    class="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-xl pt-safe shadow-[0_1px_8px_rgba(0,0,0,0.04)]"
  >
    <div
      class="h-16 px-margin-mobile md:px-margin-desktop max-w-6xl mx-auto flex items-center justify-between"
    >
      <RouterLink to="/" class="flex items-center gap-4 no-underline" @click="emit('close-menu')">
        <img
          src="/images/tap-na_logo.png"
          alt="tap-na"
          class="h-8 w-auto object-contain"
          decoding="async"
        >
      </RouterLink>
      <nav class="hidden md:flex items-center gap-8">
        <RouterLink to="/" :class="linkClass(isCardsActive())">
          Cards
        </RouterLink>
        <RouterLink
          to="/table-top"
          :class="linkClass(route.path === '/table-top' || route.path.startsWith('/table'))"
        >
          Table Top
        </RouterLink>
        <RouterLink to="/support" :class="linkClass(route.path === '/support')">
          Support
        </RouterLink>
        <RouterLink to="/cart" :class="linkClass(route.path === '/cart')">
          Cart{{ count > 0 ? ` (${count})` : '' }}
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
      class="md:hidden border-t border-border-subtle bg-surface px-margin-mobile py-4 flex flex-col gap-3"
    >
      <RouterLink
        to="/"
        class="font-label-caps text-[12px] uppercase tracking-widest py-2 no-underline text-inherit"
        @click="emit('close-menu')"
      >
        Cards
      </RouterLink>
      <RouterLink
        to="/table-top"
        class="font-label-caps text-[12px] uppercase tracking-widest py-2 no-underline text-inherit"
        @click="emit('close-menu')"
      >
        Table Top
      </RouterLink>
      <RouterLink
        to="/support"
        class="font-label-caps text-[12px] uppercase tracking-widest py-2 no-underline text-inherit"
        @click="emit('close-menu')"
      >
        Support
      </RouterLink>
      <RouterLink
        to="/cart"
        class="font-label-caps text-[12px] uppercase tracking-widest py-2 no-underline text-inherit"
        @click="emit('close-menu')"
      >
        Cart{{ count > 0 ? ` (${count})` : '' }}
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
