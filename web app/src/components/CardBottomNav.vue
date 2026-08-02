<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import {
  isLoggedIn,
  isTableBusiness,
  loadProfile,
  loadViewedProfile,
  logout
} from '../lib/profileStore'
import { setApiToken } from '../lib/api'
import { anyCatalogCartCount, catalogCartCount } from '../lib/profileCatalogCart'

const route = useRoute()
const router = useRouter()
const loggedIn = ref(isLoggedIn())
const isTableOwner = ref(isTableBusiness(loadProfile()))
const viewedIsTable = ref(isTableBusiness(loadViewedProfile()))
const guestCartCount = ref(anyCatalogCartCount())

function refreshAuth() {
  loggedIn.value = isLoggedIn()
  isTableOwner.value = isTableBusiness(loadProfile())
  viewedIsTable.value = isTableBusiness(loadViewedProfile())
  guestCartCount.value = anyCatalogCartCount()
}

/** Personal-card chrome — guests and owners. Never for business/table. */
const visible = computed(() => {
  if (loggedIn.value && isTableOwner.value) return false

  const p = route.path
  if (p === '/business' || p.startsWith('/venue') || p === '/table') return false
  if (
    p === '/me' ||
    p === '/profile' ||
    p === '/cards' ||
    p === '/catalog' ||
    p === '/catalog-cart'
  ) {
    return true
  }
  if (p.startsWith('/c/')) {
    if (loadViewedProfile()) return !viewedIsTable.value
    return !isTableOwner.value
  }
  return false
})

const showCartNav = computed(() => {
  if (loggedIn.value) return true
  return guestCartCount.value > 0 || catalogCartCount.value > 0
})

const navItems = computed(() => {
  const items = [
    {
      to: '/me',
      label: 'Profile',
      icon: 'badge',
      match: (p) => p === '/me' || p.startsWith('/c/')
    },
    {
      to: '/catalog',
      label: 'Catalog',
      icon: 'inventory_2',
      match: (p) => p === '/catalog'
    },
    {
      action: 'share',
      label: 'Share',
      icon: 'ios_share',
      match: () => false
    }
  ]
  if (showCartNav.value) {
    items.splice(2, 0, {
      to: '/catalog-cart',
      label: 'Cart',
      icon: 'shopping_cart',
      match: (p) => p === '/catalog-cart',
      badge: loggedIn.value ? 0 : guestCartCount.value || catalogCartCount.value
    })
  }
  return items
})

function isActive(item) {
  return item.match?.(route.path)
}

const activeLabel = computed(() => navItems.value.find((i) => isActive(i))?.label || 'Profile')

function onShare() {
  if (typeof window.openShareProfile === 'function') {
    window.openShareProfile()
    return
  }
  if (route.path.startsWith('/c/')) {
    router.push({ path: route.path, hash: '#share', query: route.query })
    return
  }
  router.push({ path: '/me', hash: '#share' })
}

function onLogout() {
  logout()
  setApiToken('')
  router.replace('/login')
}

watch(
  () => route.fullPath,
  () => {
    refreshAuth()
  }
)

onMounted(() => {
  refreshAuth()
  window.addEventListener('tapna-view-profile-changed', refreshAuth)
  window.addEventListener('tapna-profile-catalog-cart-changed', refreshAuth)
  window.addEventListener('storage', refreshAuth)
})

onUnmounted(() => {
  window.removeEventListener('tapna-view-profile-changed', refreshAuth)
  window.removeEventListener('tapna-profile-catalog-cart-changed', refreshAuth)
  window.removeEventListener('storage', refreshAuth)
})
</script>

<template>
  <nav
    v-if="visible"
    class="admin-bottom-nav card-bottom-nav"
    :aria-label="`Card navigation · ${activeLabel}`"
  >
    <template v-for="item in navItems" :key="item.to || item.action">
      <button
        v-if="item.action === 'share'"
        type="button"
        class="admin-nav-item"
        @click="onShare"
      >
        <span class="material-symbols-outlined">{{ item.icon }}</span>
        <span>{{ item.label }}</span>
      </button>
      <RouterLink
        v-else
        :to="item.to"
        class="admin-nav-item"
        :class="{ 'admin-nav-item--active': isActive(item) }"
      >
        <span class="relative inline-flex">
          <span class="material-symbols-outlined">{{ item.icon }}</span>
          <span
            v-if="item.badge > 0"
            class="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-emerald-500 text-[10px] font-bold text-black flex items-center justify-center"
          >
            {{ item.badge > 9 ? '9+' : item.badge }}
          </span>
        </span>
        <span>{{ item.label }}</span>
      </RouterLink>
    </template>
    <button v-if="loggedIn" type="button" class="admin-nav-item" @click="onLogout">
      <span class="material-symbols-outlined">logout</span>
      <span>Logout</span>
    </button>
    <RouterLink
      v-else
      to="/login"
      class="admin-nav-item"
      :class="{ 'admin-nav-item--active': route.path === '/login' }"
    >
      <span class="material-symbols-outlined">login</span>
      <span>Login</span>
    </RouterLink>
  </nav>
</template>
