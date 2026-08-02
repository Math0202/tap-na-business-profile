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
import { setApiToken, apiMeetingStats, getApiToken } from '../lib/api'

const route = useRoute()
const router = useRouter()
const badge = ref(0)
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
  if (
    p === '/me' ||
    p === '/profile' ||
    p === '/meetings' ||
    p.startsWith('/meetings/') ||
    p === '/catalog' ||
    p === '/cards'
  ) {
    return true
  }
  if (p.startsWith('/c/')) {
    if (loadViewedProfile()) return !viewedIsTable.value
    return !isTableOwner.value
  }
  return false
})

/** Same items for guests and owners — auth routes redirect to login when needed. */
const navItems = computed(() => [
  {
    to: '/me',
    label: 'Profile',
    icon: 'badge',
    match: (p) => p === '/me' || p.startsWith('/c/')
  },
  {
    to: '/meetings',
    label: 'Meetings',
    icon: 'event',
    match: (p) => p === '/meetings' || p.startsWith('/meetings/')
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

async function refreshBadge() {
  if (!visible.value || !loggedIn.value || !getApiToken()) {
    badge.value = 0
    return
  }
  const res = await apiMeetingStats()
  if (res.ok && res.data?.stats) {
    const s = res.data.stats
    badge.value = Number(s.newMeetings || 0) + Number(s.overdueFollowups || 0)
  }
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
    refreshBadge()
  }
)

onMounted(() => {
  refreshAuth()
  refreshBadge()
  window.addEventListener('tapna-meetings-changed', refreshBadge)
  window.addEventListener('tapna-view-profile-changed', refreshAuth)
  window.addEventListener('storage', refreshAuth)
})

onUnmounted(() => {
  window.removeEventListener('tapna-meetings-changed', refreshBadge)
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
        <span class="relative inline-flex">
          <span class="material-symbols-outlined">{{ item.icon }}</span>
          <span
            v-if="item.to === '/meetings' && badge > 0"
            class="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-emerald-500 text-[10px] font-bold text-black flex items-center justify-center"
          >
            {{ badge > 9 ? '9+' : badge }}
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