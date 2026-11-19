<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import {
  isLoggedIn,
  isTableBusiness,
  loadProfile,
  loadPublicProfile,
  loadViewedProfile,
  logout
} from '../lib/profileStore'
import { apiGetMyTeam, apiPublicCatalog, setApiToken } from '../lib/api'
import { anyCatalogCartCount, catalogCartCount } from '../lib/profileCatalogCart'
import { hideFloatingChrome } from '../lib/uiChrome'
import { browsingPersonalSlug, personalPagePath } from '../lib/profilePaths'
import { normalizeIndustry, vehicleFinanceEnabled } from '../lib/vehicleFinance'

const route = useRoute()
const router = useRouter()
const loggedIn = ref(isLoggedIn())
const isTableOwner = ref(isTableBusiness(loadProfile()))
const viewedIsTable = ref(isTableBusiness(loadViewedProfile()))
const guestCartCount = ref(anyCatalogCartCount())
const canUseTeam = ref(false)
const hasCatalog = ref(false)
const financeOn = ref(false)
let catalogCheckSeq = 0

function activeCatalogItems(list) {
  return (Array.isArray(list) ? list : []).filter(
    (item) => item && item.active !== false && String(item.name || '').trim()
  )
}

function profileIdForCatalog() {
  const p = loadPublicProfile()
  return String(p?.remoteProfileId || p?.id || '').trim()
}

async function refreshCatalogVisibility() {
  const seq = ++catalogCheckSeq
  const local = activeCatalogItems(loadPublicProfile()?.catalogItems)
  if (local.length > 0) hasCatalog.value = true

  const id = profileIdForCatalog()
  if (!id) {
    hasCatalog.value = local.length > 0
    return
  }
  try {
    const res = await apiPublicCatalog(id)
    if (seq !== catalogCheckSeq) return
    if (res.ok && Array.isArray(res.data?.catalogItems)) {
      hasCatalog.value = activeCatalogItems(res.data.catalogItems).length > 0
    } else if (local.length > 0) {
      hasCatalog.value = true
    }
  } catch {
    if (local.length > 0) hasCatalog.value = true
  }
}

async function refreshTeamAccess() {
  if (!isLoggedIn() || isTableBusiness(loadProfile())) {
    canUseTeam.value = false
    return
  }
  try {
    const res = await apiGetMyTeam()
    canUseTeam.value = !!(res?.ok && res.data?.canUseTeam)
  } catch {
    canUseTeam.value = false
  }
}

function ownsViewedCard() {
  if (!isLoggedIn()) return false
  const mine = loadProfile()
  const slug = browsingPersonalSlug(route)
  const mineSlug = String(mine.shareSlug || '').trim()
  if (slug && mineSlug && slug.toLowerCase() === mineSlug.toLowerCase()) return true
  if (
    !slug &&
    ['/me', '/profile', '/catalog', '/catalog-cart', '/connections', '/team', '/finance', '/cards'].includes(route.path)
  ) {
    return true
  }
  const source = loadPublicProfile()
  const myId = String(mine.remoteProfileId || '').trim()
  const theirId = String(source?.remoteProfileId || source?.id || '').trim()
  return !!(myId && theirId && myId === theirId)
}

function refreshAuth() {
  loggedIn.value = isLoggedIn()
  isTableOwner.value = isTableBusiness(loadProfile())
  viewedIsTable.value = isTableBusiness(loadViewedProfile())
  guestCartCount.value = anyCatalogCartCount()
  const source = route.path === '/profile' ? loadProfile() : loadPublicProfile()
  const ownIndustry = normalizeIndustry(loadProfile()?.industry) === 'auto_dealer'
  financeOn.value = vehicleFinanceEnabled(source) || (ownsViewedCard() && ownIndustry)
  refreshCatalogVisibility()
}

watch(
  () => route.fullPath,
  () => {
    refreshAuth()
  }
)

watch(loggedIn, (v) => {
  if (v) refreshTeamAccess()
  else canUseTeam.value = false
})

onMounted(() => {
  refreshAuth()
  refreshTeamAccess()
  window.addEventListener('tapna-view-profile-changed', refreshAuth)
  window.addEventListener('tapna-profile-catalog-cart-changed', refreshAuth)
  window.addEventListener('storage', refreshAuth)
})

/** Personal-card chrome — guests and owners. Never for business/table or claim UI. */
const visible = computed(() => {
  if (hideFloatingChrome.value) return false
  if (loggedIn.value && isTableOwner.value) return false

  const p = route.path
  if (p === '/business' || p.startsWith('/venue') || p === '/table') return false
  if (
    p === '/me' ||
    p === '/profile' ||
    p === '/cards' ||
    p === '/catalog' ||
    p === '/catalog-cart' ||
    p === '/connections' ||
    p === '/team' ||
    /^\/c\/[^/]+(\/catalog(-cart)?)?$/.test(p)
  ) {
    return true
  }
  if (p === '/finance') {
    if (loadViewedProfile()) return !viewedIsTable.value
    return !isTableOwner.value
  }
  if (p.startsWith('/c/')) {
    if (loadViewedProfile()) return !viewedIsTable.value
    return !isTableOwner.value
  }
  return false
})

const showCartNav = computed(() => {
  if (loggedIn.value) return false
  return guestCartCount.value > 0 || catalogCartCount.value > 0
})

/** Logged-in owner of the personal card currently on screen (empty catalog still needs a nav link). */
const isOwnPersonalNav = computed(() => {
  if (!loggedIn.value || isTableOwner.value) return false
  const p = route.path
  if (
    p === '/me' ||
    p === '/profile' ||
    p === '/catalog' ||
    p === '/catalog-cart' ||
    p === '/connections' ||
    p === '/team' ||
    p === '/finance'
  ) {
    return true
  }
  const slug = browsingPersonalSlug(route)
  const mine = String(loadProfile().shareSlug || '').trim()
  return !!(mine && slug && mine.toLowerCase() === slug.toLowerCase())
})

const showCatalogNav = computed(() => hasCatalog.value || isOwnPersonalNav.value)

const showFinanceNav = computed(() => financeOn.value)

const navItems = computed(() => {
  const slug = browsingPersonalSlug(route)
  const profileTo = personalPagePath(slug)
  const catalogTo = personalPagePath(slug, 'catalog')
  const cartTo = personalPagePath(slug, 'catalog-cart')
  const items = [
    {
      to: profileTo,
      label: 'Profile',
      icon: 'badge',
      match: (p) => p === '/me' || /^\/c\/[^/]+$/.test(p)
    }
  ]

  if (showCatalogNav.value) {
    items.push({
      to: catalogTo,
      label: 'Catalog',
      icon: 'inventory_2',
      match: (p) => p === '/catalog' || /\/c\/[^/]+\/catalog$/.test(p)
    })
  }

  if (showFinanceNav.value) {
    items.push({
      to: personalPagePath(slug, 'finance'),
      label: 'Finance',
      icon: 'payments',
      match: (p) => p === '/finance' || /\/c\/[^/]+\/finance$/.test(p)
    })
  }

  if (loggedIn.value) {
    if (canUseTeam.value) {
      items.push({
        to: '/team',
        label: 'Settings',
        icon: 'settings',
        match: (p) => p === '/team'
      })
    }
  } else {
    if (showCartNav.value) {
      const cartIndex = items.findIndex((i) => i.label === 'Catalog')
      items.splice(cartIndex >= 0 ? cartIndex + 1 : items.length, 0, {
        to: cartTo,
        label: 'Cart',
        icon: 'shopping_cart',
        match: (p) => p === '/catalog-cart' || /\/c\/[^/]+\/catalog-cart$/.test(p),
        badge: guestCartCount.value || catalogCartCount.value
      })
    }
    items.push({
      action: 'share',
      label: 'Share',
      icon: 'ios_share',
      match: () => false
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
  const slug = browsingPersonalSlug(route)
  router.push({ path: personalPagePath(slug), hash: '#share', query: route.query })
}

function onLogout() {
  logout()
  setApiToken('')
  canUseTeam.value = false
  import('../lib/authRedirect').then((m) => m.goToLogin())
}

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
  </nav>
</template>
