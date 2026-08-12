<script setup>
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { cartCount } from '../lib/cartStore'
import { isLoggedIn } from '../lib/profileStore'

const route = useRoute()
const count = cartCount
const loggedIn = computed(() => isLoggedIn())

const items = computed(() => [
  { to: '/', label: 'Cards', icon: 'style', match: (p) => p === '/' || p.startsWith('/product/') || p.startsWith('/package/') || p.startsWith('/about/business-cards') },
  { to: '/table-top', label: 'Table Top', icon: 'table_restaurant', match: (p) => p === '/table-top' || p.startsWith('/table') },
  { to: '/support', label: 'Support', icon: 'support_agent', match: (p) => p === '/support' },
  { to: '/cart', label: 'Cart', icon: 'shopping_bag', match: (p) => p === '/cart', badge: true },
  {
    to: loggedIn.value ? '/profile' : '/login',
    label: loggedIn.value ? 'Account' : 'Login',
    icon: loggedIn.value ? 'person' : 'login',
    match: (p) => p === '/login' || p === '/signup' || p === '/profile' || p.startsWith('/my-card')
  }
])

function isActive(item) {
  return item.match(route.path)
}
</script>

<template>
  <nav
    class="fixed bottom-0 w-full z-50 pb-safe bg-surface/90 backdrop-blur-xl shadow-[0_-1px_8px_rgba(0,0,0,0.04)] md:hidden"
    aria-label="Shop navigation"
  >
    <div class="flex justify-around items-center h-20 px-1">
      <RouterLink
        v-for="item in items"
        :key="item.label"
        :to="item.to"
        class="relative flex flex-col items-center justify-center gap-1 flex-1 max-w-[4.5rem] h-16 transition-colors no-underline"
        :class="isActive(item) ? 'text-primary' : 'text-on-surface-variant'"
      >
        <span class="material-symbols-outlined text-[22px]">{{ item.icon }}</span>
        <span
          v-if="item.badge && count > 0"
          class="absolute top-1 right-[calc(50%-18px)] min-w-[16px] h-4 px-1 rounded-full bg-primary text-on-primary font-label-caps text-[9px] leading-4 text-center"
        >
          {{ count > 99 ? '99+' : count }}
        </span>
        <span class="font-label-caps text-[9px] uppercase tracking-wide">{{ item.label }}</span>
      </RouterLink>
    </div>
  </nav>
</template>
