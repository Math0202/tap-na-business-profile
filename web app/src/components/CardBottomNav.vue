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

const route = useRoute()
const router = useRouter()
const loggedIn = ref(isLoggedIn())
const isTableOwner = ref(isTableBusiness(loadProfile()))
const viewedIsTable = ref(isTableBusiness(loadViewedProfile()))

function refreshAuth() {
  loggedIn.value = isLoggedIn()
  isTableOwner.value = isTableBusiness(loadProfile())
  viewedIsTable.value = isTableBusiness(loadViewedProfile())
}

/** Personal-card chrome — guests and owners. Never for business/table. */
const visible = computed(() => {
  if (loggedIn.value && isTableOwner.value) return false

  const p = route.path
  if (p === '/business' || p.startsWith('/venue') || p === '/table') return false
  if (p === '/me' || p === '/profile' || p === '/cards') {
    return true
  }
  if (p.startsWith('/c/')) {
    if (loadViewedProfile()) return !viewedIsTable.value
    return !isTableOwner.value
  }
  return false
})

/** Business/personal card nav — Meetings & Catalog are hidden. */
const navItems = computed(() => [
  {
    to: '/me',
    label: 'Profile',
    icon: 'badge',
    match: (p) => p === '/me' || p.startsWith('/c/')
  },
  {
    action: 'share',
    label: 'Share',
    icon: 'ios_share',
    match: () => false
  }
])

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
  window.addEventListener('storage', refreshAuth)
})

onUnmounted(() => {
  window.removeEventListener('tapna-view-profile-changed', refreshAuth)
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
        <span class="material-symbols-outlined">{{ item.icon }}</span>
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