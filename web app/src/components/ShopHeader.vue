<script setup>
import { RouterLink } from 'vue-router'
import { cartCount } from '../lib/cartStore'

defineProps({
  menuOpen: { type: Boolean, default: false },
})

const emit = defineEmits(['toggle-menu', 'close-menu', 'shop-all'])

const count = cartCount
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
        <button
          type="button"
          class="font-label-caps text-[11px] uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors"
          @click="emit('shop-all')"
        >
          Shop
        </button>
        <RouterLink
          to="/about/business-cards"
          class="font-label-caps text-[11px] uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors no-underline"
        >
          About cards
        </RouterLink>
        <RouterLink
          to="/support"
          class="font-label-caps text-[11px] uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors no-underline"
        >
          Support
        </RouterLink>
        <RouterLink
          to="/cart"
          class="font-label-caps text-[11px] uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors no-underline"
        >
          Cart
        </RouterLink>
        <RouterLink
          to="/login"
          class="font-label-caps text-[11px] uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors no-underline"
        >
          Login
        </RouterLink>
      </nav>
      <div class="flex items-center gap-2">
        <RouterLink
          to="/login"
          class="hidden sm:flex md:hidden font-label-caps text-[11px] uppercase tracking-widest text-on-surface-variant no-underline px-2"
        >
          Login
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
      <button
        type="button"
        class="text-left font-label-caps text-[12px] uppercase tracking-widest py-2"
        @click="emit('shop-all')"
      >
        Shop
      </button>
      <RouterLink
        to="/about/business-cards"
        class="font-label-caps text-[12px] uppercase tracking-widest py-2 no-underline text-inherit"
        @click="emit('close-menu')"
      >
        About cards
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
        to="/login"
        class="font-label-caps text-[12px] uppercase tracking-widest py-2 no-underline text-inherit"
        @click="emit('close-menu')"
      >
        Login
      </RouterLink>
      <RouterLink
        to="/signup"
        class="mt-2 bg-primary text-on-primary text-center py-3 font-button-text text-button-text uppercase tracking-widest no-underline"
        @click="emit('close-menu')"
      >
        Get Started
      </RouterLink>
    </div>
  </header>
</template>
