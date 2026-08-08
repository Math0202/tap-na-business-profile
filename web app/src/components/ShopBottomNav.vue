<script setup>
import { RouterLink, useRoute } from 'vue-router'
import { cartCount } from '../lib/cartStore'

const route = useRoute()
const count = cartCount

function isActive(path) {
  if (path === '/') return route.path === '/' || route.path.startsWith('/product/')
  return route.path === path
}
</script>

<template>
  <nav
    class="fixed bottom-0 w-full z-50 pb-safe bg-surface/90 backdrop-blur-xl shadow-[0_-1px_8px_rgba(0,0,0,0.04)] md:hidden"
  >
    <div class="flex justify-around items-center h-20 px-4">
      <RouterLink
        to="/"
        class="flex flex-col items-center justify-center gap-1 w-16 h-16 transition-colors no-underline"
        :class="isActive('/') ? 'text-primary' : 'text-on-surface-variant'"
      >
        <span class="material-symbols-outlined">grid_view</span>
        <span class="font-label-caps text-[10px] uppercase">Shop</span>
      </RouterLink>
      <RouterLink
        to="/cart"
        class="relative flex flex-col items-center justify-center gap-1 w-16 h-16 transition-colors no-underline"
        :class="isActive('/cart') ? 'text-primary' : 'text-on-surface-variant'"
      >
        <span class="material-symbols-outlined">shopping_bag</span>
        <span
          v-if="count > 0"
          class="absolute top-1 right-2 min-w-[16px] h-4 px-1 rounded-full bg-primary text-on-primary font-label-caps text-[9px] leading-4 text-center"
        >
          {{ count > 99 ? '99+' : count }}
        </span>
        <span class="font-label-caps text-[10px] uppercase">Cart</span>
      </RouterLink>
    </div>
  </nav>
</template>
