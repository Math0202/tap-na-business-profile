<script setup>
import { computed } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { isStaffAdmin, isStaffSalesTeam, staffLogout } from '../lib/staffAuth'

const route = useRoute()

const allItems = [
  { to: '/admin', label: 'Dashboard', icon: 'dashboard', adminOnly: true, match: (p) => p === '/admin' || p.startsWith('/admin/profiles') },
  { to: '/admin/slugs', label: 'Card IDs', icon: 'qr_code_2', adminOnly: true, match: (p) => p.startsWith('/admin/slugs') },
  { to: '/admin/sales', label: 'Sales', icon: 'point_of_sale', adminOnly: false, match: (p) => p.startsWith('/admin/sales') },
  { to: '/admin/shop', label: 'Shop', icon: 'storefront', adminOnly: true, match: (p) => p.startsWith('/admin/shop') },
  { to: '/', label: 'Storefront', icon: 'shopping_bag', adminOnly: false, match: (p) => p === '/' || p === '/cart' }
]

const items = computed(() => {
  if (isStaffSalesTeam()) return allItems.filter((i) => !i.adminOnly)
  return allItems
})

function isActive(item) {
  return item.match(route.path)
}

const activeLabel = computed(() => items.value.find((i) => isActive(i))?.label || 'Admin')

async function onLogout() {
  await staffLogout()
  window.location.href = '/login'
}
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
    <button
      v-if="isStaffAdmin() || isStaffSalesTeam()"
      type="button"
      class="admin-nav-item"
      @click="onLogout"
    >
      <span class="material-symbols-outlined">logout</span>
      <span>Logout</span>
    </button>
  </nav>
</template>
