<script setup>
import { computed } from 'vue'
import { useRoute, RouterLink } from 'vue-router'

const route = useRoute()

const items = [
  { to: '/admin', label: 'Dashboard', icon: 'dashboard', match: (p) => p === '/admin' || p.startsWith('/admin/profiles') },
  { to: '/admin/slugs', label: 'Slugs', icon: 'qr_code_2', match: (p) => p.startsWith('/admin/slugs') },
  { to: '/admin/sales', label: 'Sales', icon: 'point_of_sale', match: (p) => p.startsWith('/admin/sales') },
  { to: '/admin/shop', label: 'Shop', icon: 'storefront', match: (p) => p.startsWith('/admin/shop') },
  { to: '/', label: 'Storefront', icon: 'shopping_bag', match: (p) => p === '/' || p === '/cart' }
]

function isActive(item) {
  return item.match(route.path)
}

const activeLabel = computed(() => items.find((i) => isActive(i))?.label || 'Admin')
</script>

<template>
  <nav class="admin-bottom-nav" :aria-label="`Admin navigation · ${activeLabel}`">
    <RouterLink
      v-for="item in items"
      :key="item.to"
      :to="item.to"
      class="admin-nav-item"
      :class="{ 'admin-nav-item--active': isActive(item) }"
    >
      <span class="material-symbols-outlined">{{ item.icon }}</span>
      <span>{{ item.label }}</span>
    </RouterLink>
  </nav>
</template>
