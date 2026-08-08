<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  isLoggedIn,
  loadProfile,
  isTableBusiness,
  loadViewedProfile
} from '../lib/profileStore'
import { hideFloatingChrome } from '../lib/uiChrome'

const route = useRoute()
const router = useRouter()
const open = ref(false)
const loggedIn = ref(isLoggedIn())
const isTable = ref(isTableBusiness(loadProfile()))
const viewedIsTable = ref(isTableBusiness(loadViewedProfile()))

const isHome = computed(() => route.path === '/' || route.path === '/me' || route.path === '/business')
const isShopHome = computed(() => route.path === '/' || route.path === '/cart')
const isAdminArea = computed(() => route.path.startsWith('/admin'))
const isLogin = computed(
  () => route.path === '/login' || route.path === '/shop/login' || route.path === '/admin/login'
)

/** Floating menu is for business profiles only — never personal bottom-nav surfaces. */
const onBusinessSurface = computed(() => {
  const p = route.path
  if (p === '/business' || p === '/table') return true
  if (p.startsWith('/venue')) return true
  // Table owners editing profile use FAB (no business bottom nav)
  if (p === '/profile' && (isTable.value || viewedIsTable.value)) return true
  if (p.startsWith('/c/')) {
    if (loadViewedProfile()) return viewedIsTable.value
    return isTable.value
  }
  return false
})

const showFab = computed(() => {
  if (hideFloatingChrome.value) return false
  if (isShopHome.value || isLogin.value || isAdminArea.value) return false
  return onBusinessSurface.value
})

function refreshAuth() {
  loggedIn.value = isLoggedIn()
  isTable.value = isTableBusiness(loadProfile())
  viewedIsTable.value = isTableBusiness(loadViewedProfile())
}

function setOpen(value) {
  open.value = value
  document.body.classList.toggle('fab-open', value)
}

function toggle() {
  setOpen(!open.value)
}

function goBack() {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/')
  }
}

function shareProfile() {
  setOpen(false)
  if (typeof window.openShareProfile === 'function') {
    window.openShareProfile()
    return
  }
  router.push({ path: '/business', hash: '#share' })
}

function onKeydown(e) {
  if (e.key === 'Escape') setOpen(false)
}

watch(() => route.fullPath, () => {
  setOpen(false)
  refreshAuth()
  if (isAdminArea.value) {
    document.body.classList.remove('fab-open')
  }
})

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  refreshAuth()
  window.addEventListener('tapna-view-profile-changed', refreshAuth)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('tapna-view-profile-changed', refreshAuth)
  document.body.classList.remove('fab-open')
})
</script>

<template>
  <template v-if="showFab">
    <button
      v-if="!isHome && route.path !== '/profile'"
      type="button"
      class="page-back-btn"
      aria-label="Go back"
      @click="goBack"
    >
      <span class="material-symbols-outlined">arrow_back</span>
    </button>

    <div class="fab-root" :class="{ 'is-open': open }" id="fab-root">
      <div class="fab-menu" id="fab-menu" role="menu" :aria-hidden="(!open).toString()">
        <button type="button" id="fab-share" role="menuitem" @click="shareProfile">
          <span class="material-symbols-outlined">ios_share</span>
          Share profile
        </button>
      </div>
      <button
        type="button"
        class="fab-toggle"
        id="fab-toggle"
        :aria-label="open ? 'Close menu' : 'Open menu'"
        :aria-expanded="open.toString()"
        aria-controls="fab-menu"
        @click="toggle"
      >
        <span class="material-symbols-outlined">more_vert</span>
      </button>
    </div>
    <div class="fab-backdrop" id="fab-backdrop" @click="setOpen(false)" />
  </template>
</template>