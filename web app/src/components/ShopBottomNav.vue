<script setup>
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { cartCount } from '../lib/cartStore'
import { isLoggedIn } from '../lib/profileStore'

const route = useRoute()
const count = cartCount
const loggedIn = computed(() => isLoggedIn())
const productsOpen = ref(false)

const productLinks = [
  { to: '/', label: 'Digital Business Cards', icon: 'style' },
  { to: '/table-top', label: 'Table Tops', icon: 'table_restaurant' }
]

function isProductsActive() {
  const p = route.path
  return (
    p === '/' ||
    p.startsWith('/product/') ||
    p.startsWith('/package/') ||
    p.startsWith('/about/business-cards') ||
    p === '/table-top' ||
    p.startsWith('/table')
  )
}

const items = computed(() => [
  { id: 'products', label: 'Products', icon: 'inventory_2', action: 'products', active: isProductsActive() },
  { id: 'support', to: '/support', label: 'Support', icon: 'support_agent', match: (p) => p === '/support' },
  { id: 'cart', to: '/cart', label: 'Cart', icon: 'shopping_bag', match: (p) => p === '/cart', badge: true },
  {
    id: 'auth',
    to: loggedIn.value ? '/profile' : '/login',
    label: loggedIn.value ? 'Account' : 'Login',
    icon: loggedIn.value ? 'person' : 'login',
    match: (p) => p === '/login' || p === '/signup' || p === '/profile' || p.startsWith('/my-card')
  }
])

function isActive(item) {
  if (item.action === 'products') return item.active
  return item.match?.(route.path)
}

function onItemClick(item) {
  if (item.action === 'products') {
    productsOpen.value = !productsOpen.value
  }
}

function closeProducts() {
  productsOpen.value = false
}

watch(
  () => route.fullPath,
  () => {
    productsOpen.value = false
  }
)
</script>

<template>
  <nav
    class="fixed bottom-0 w-full z-50 pb-safe bg-surface/90 backdrop-blur-xl shadow-[0_-1px_8px_rgba(0,0,0,0.04)] md:hidden"
    aria-label="Shop navigation"
  >
    <div
      v-if="productsOpen"
      class="absolute bottom-full left-0 right-0 mb-0 px-3 pb-2"
    >
      <div class="rounded-2xl border border-border-subtle bg-surface shadow-lg overflow-hidden">
        <p class="px-4 pt-3 pb-1 font-label-caps text-[10px] uppercase tracking-widest text-ink-muted">
          Products
        </p>
        <RouterLink
          v-for="link in productLinks"
          :key="link.to"
          :to="link.to"
          class="flex items-center gap-3 px-4 py-3.5 no-underline text-on-surface hover:bg-surface-container transition-colors border-t border-border-subtle/70"
          @click="closeProducts"
        >
          <span class="material-symbols-outlined text-[22px] text-primary">{{ link.icon }}</span>
          <span class="font-label-caps text-[11px] uppercase tracking-widest">{{ link.label }}</span>
        </RouterLink>
      </div>
    </div>

    <div class="flex justify-around items-center h-20 px-1">
      <template v-for="item in items" :key="item.id">
        <button
          v-if="item.action === 'products'"
          type="button"
          class="relative flex flex-col items-center justify-center gap-1 flex-1 max-w-[4.5rem] h-16 transition-colors bg-transparent border-0 cursor-pointer"
          :class="isActive(item) || productsOpen ? 'text-primary' : 'text-on-surface-variant'"
          :aria-expanded="productsOpen.toString()"
          aria-haspopup="true"
          @click="onItemClick(item)"
        >
          <span class="material-symbols-outlined text-[22px]">{{ item.icon }}</span>
          <span class="font-label-caps text-[9px] uppercase tracking-wide">{{ item.label }}</span>
        </button>
        <RouterLink
          v-else
          :to="item.to"
          class="relative flex flex-col items-center justify-center gap-1 flex-1 max-w-[4.5rem] h-16 transition-colors no-underline"
          :class="isActive(item) ? 'text-primary' : 'text-on-surface-variant'"
          @click="closeProducts"
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
      </template>
    </div>
  </nav>
</template>
