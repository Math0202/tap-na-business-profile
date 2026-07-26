<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { isLoggedIn, loadProfile, isTableBusiness } from '../lib/profileStore'
import { hideFloatingChrome } from '../lib/uiChrome'

const route = useRoute()
const router = useRouter()
const open = ref(false)
const loggedIn = ref(isLoggedIn())
const isTable = ref(isTableBusiness(loadProfile()))

const isHome = computed(() => route.path === '/' || route.path === '/me' || route.path === '/business')
const isShopHome = computed(() => route.path === '/' || route.path === '/cart')
const isBusiness = computed(() => route.path === '/business')
const isAdminArea = computed(() => route.path.startsWith('/admin'))
const isLogin = computed(
  () => route.path === '/login' || route.path === '/shop/login'
)
const hideChrome = computed(
  () =>
    isShopHome.value ||
    isLogin.value ||
    isAdminArea.value ||
    route.path.startsWith('/venue') ||
    hideFloatingChrome.value
)

const signupTo = computed(() =>
  isBusiness.value ? { path: '/signup', query: { type: 'table' } } : '/signup'
)
const signupLabel = computed(() =>
  isBusiness.value ? 'Sign up for my business' : 'Sign up'
)
const signupIcon = computed(() => (isBusiness.value ? 'storefront' : 'person_add'))

function refreshAuth() {
  loggedIn.value = isLoggedIn()
  isTable.value = isTableBusiness(loadProfile())
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
  router.push({ path: '/me', hash: '#share' })
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
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.classList.remove('fab-open')
})
</script>

<template>
  <template v-if="!hideChrome">
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
        <RouterLink v-if="!loggedIn" :to="signupTo" role="menuitem" @click="setOpen(false)">
          <span class="material-symbols-outlined">{{ signupIcon }}</span>
          {{ signupLabel }}
        </RouterLink>
        <RouterLink
          v-if="loggedIn"
          to="/profile"
          role="menuitem"
          @click="setOpen(false)"
        >
          <span class="material-symbols-outlined">person</span>
          Profile
        </RouterLink>
        <RouterLink
          v-if="loggedIn && isTable && isBusiness"
          to="/venue"
          role="menuitem"
          @click="setOpen(false)"
        >
          <span class="material-symbols-outlined">analytics</span>
          Venue dashboard
        </RouterLink>
        <RouterLink
          v-if="!loggedIn"
          to="/login"
          role="menuitem"
          @click="setOpen(false)"
        >
          <span class="material-symbols-outlined">login</span>
          Login
        </RouterLink>
        <RouterLink v-if="isBusiness || isAdminArea" to="/admin" role="menuitem" @click="setOpen(false)">
          <span class="material-symbols-outlined">dashboard</span>
          Admin
        </RouterLink>
        <RouterLink v-if="isBusiness || isAdminArea" to="/admin/slugs" role="menuitem" @click="setOpen(false)">
          <span class="material-symbols-outlined">qr_code_2</span>
          Slugs
        </RouterLink>
        <RouterLink v-if="isBusiness || isAdminArea" to="/admin/sales" role="menuitem" @click="setOpen(false)">
          <span class="material-symbols-outlined">point_of_sale</span>
          Sales
        </RouterLink>
        <RouterLink v-if="isBusiness || isAdminArea" to="/admin/shop" role="menuitem" @click="setOpen(false)">
          <span class="material-symbols-outlined">storefront</span>
          Shop
        </RouterLink>
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
