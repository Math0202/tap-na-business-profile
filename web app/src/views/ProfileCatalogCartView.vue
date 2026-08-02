<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import BrandMark from '../components/BrandMark.vue'
import BookMeetingPopup from '../components/BookMeetingPopup.vue'
import {
  displayName,
  isLoggedIn,
  isTableBusiness,
  loadProfile,
  loadPublicProfile
} from '../lib/profileStore'
import {
  apiListCatalogCarts,
  apiUpdateCatalogCart,
  apiSubmitCatalogCart,
  apiPublicCatalog,
  ensureApiSession,
  getApiToken
} from '../lib/api'
import {
  anyCatalogCartCount,
  catalogCartLines,
  clearCatalogCart,
  loadAllCatalogCarts,
  refreshCatalogCart,
  removeCatalogCartItem,
  setCatalogCartProfile,
  setCatalogCartQty
} from '../lib/profileCatalogCart'

const router = useRouter()
const loggedIn = ref(isLoggedIn())
const loading = ref(true)
const toast = ref('')
const ownerCarts = ref([])
const guestLines = ref([])
const guestProfileId = ref('')
const guestOwnerName = ref('')
const checkoutOpen = ref(false)
const meetingOpen = ref(false)
const submitting = ref(false)
const checkoutError = ref('')
const guestName = ref('')
const guestEmail = ref('')
const guestPhone = ref('')
const guestNote = ref('')
const guestCartBadge = ref(anyCatalogCartCount())

const isOwnerMode = computed(() => loggedIn.value && !isTableBusiness(loadProfile()))

function flash(msg) {
  toast.value = msg
  setTimeout(() => {
    toast.value = ''
  }, 2200)
}

function formatPrice(price) {
  if (price === null || price === undefined || price === '') return 'Ask for quote'
  return (
    'N$ ' +
    Number(price).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    })
  )
}

function formatWhen(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
}

function statusLabel(status) {
  const map = {
    open: 'Open',
    quote_requested: 'Quote requested',
    meeting_booked: 'Meeting booked',
    closed: 'Closed'
  }
  return map[status] || status || 'Open'
}

async function refreshOwner() {
  let authed = await ensureApiSession()
  if (!authed) authed = await ensureApiSession({ force: true })
  if (!authed || !getApiToken()) {
    ownerCarts.value = []
    return
  }
  const res = await apiListCatalogCarts()
  if (res.ok && Array.isArray(res.data?.carts)) {
    ownerCarts.value = res.data.carts
  }
}

async function refreshGuest() {
  const bags = loadAllCatalogCarts()
  guestCartBadge.value = anyCatalogCartCount()
  if (!bags.length) {
    guestLines.value = []
    guestProfileId.value = ''
    guestOwnerName.value = ''
    return
  }
  const bag = bags[0]
  guestProfileId.value = bag.profileId
  setCatalogCartProfile(bag.profileId)
  refreshCatalogCart()
  const res = await apiPublicCatalog(bag.profileId)
  const catalogItems = res.ok && Array.isArray(res.data?.catalogItems) ? res.data.catalogItems : []
  if (res.data?.ownerName) guestOwnerName.value = res.data.ownerName
  guestLines.value = catalogCartLines(catalogItems)
}

async function refresh() {
  loading.value = true
  loggedIn.value = isLoggedIn()
  if (isOwnerMode.value) await refreshOwner()
  else await refreshGuest()
  loading.value = false
}

async function markClosed(cart) {
  const res = await apiUpdateCatalogCart(cart.id, { status: 'closed' })
  if (res.ok) {
    flash('Marked closed')
    await refreshOwner()
  } else flash(res.error || 'Update failed')
}

async function softDelete(cart) {
  if (!confirm('Remove this cart entry?')) return
  const res = await apiUpdateCatalogCart(cart.id, { deleted: true })
  if (res.ok) {
    flash('Removed')
    await refreshOwner()
  } else flash(res.error || 'Remove failed')
}

async function submitQuote() {
  if (!guestProfileId.value || submitting.value) return
  const name = guestName.value.trim()
  const email = guestEmail.value.trim()
  if (!name) {
    checkoutError.value = 'Please enter your name.'
    return
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    checkoutError.value = 'Please enter a valid email.'
    return
  }
  if (!guestLines.value.length) {
    checkoutError.value = 'Cart is empty.'
    return
  }
  submitting.value = true
  checkoutError.value = ''
  try {
    const res = await apiSubmitCatalogCart(guestProfileId.value, {
      name,
      email,
      phone: guestPhone.value.trim(),
      note: guestNote.value.trim(),
      action: 'quote',
      items: guestLines.value.map((l) => ({
        id: l.id,
        name: l.name,
        qty: l.qty,
        price: l.price
      }))
    })
    if (!res.ok) {
      checkoutError.value = res.error || 'Could not send quote request.'
      return
    }
    clearCatalogCart()
    checkoutOpen.value = false
    await refreshGuest()
    flash('Quote emailed to you and the owner')
  } finally {
    submitting.value = false
  }
}

async function onMeetingSubmitted() {
  if (!guestProfileId.value || !guestLines.value.length) return
  const email = guestEmail.value.trim()
  if (!email) return
  await apiSubmitCatalogCart(guestProfileId.value, {
    name: guestName.value.trim() || 'Guest',
    email,
    phone: guestPhone.value.trim(),
    note: guestNote.value.trim() || 'Booked a meeting about cart items',
    action: 'meeting',
    items: guestLines.value.map((l) => ({
      id: l.id,
      name: l.name,
      qty: l.qty,
      price: l.price
    }))
  })
  clearCatalogCart()
  await refreshGuest()
  flash('Meeting booked — owner notified')
}

function onCartChanged() {
  guestCartBadge.value = anyCatalogCartCount()
  if (!isOwnerMode.value) refreshGuest()
}

onMounted(async () => {
  document.title = 'Catalog cart - tap-na'
  if (isTableBusiness(loadProfile()) && isLoggedIn()) {
    router.replace('/venue')
    return
  }
  const mine = loadProfile()
  const pub = loadPublicProfile()
  if (mine?.name || pub?.name) guestName.value = mine?.name || displayName(pub) || ''
  if (mine?.email) guestEmail.value = mine.email
  if (mine?.phone) guestPhone.value = mine.phone
  await refresh()
  window.addEventListener('tapna-profile-catalog-cart-changed', onCartChanged)
  window.addEventListener('storage', onCartChanged)
})

onUnmounted(() => {
  window.removeEventListener('tapna-profile-catalog-cart-changed', onCartChanged)
  window.removeEventListener('storage', onCartChanged)
})
</script>

<template>
  <div class="min-h-screen flex flex-col items-center overflow-x-hidden">
    <main class="w-full max-w-md min-h-screen flex flex-col relative z-10 pb-28 px-6 pt-8">
      <header class="pb-4">
        <BrandMark size="sm" class="mb-3" />
        <h1 class="text-2xl font-bold tracking-tight">
          {{ isOwnerMode ? 'Catalog cart' : 'Your cart' }}
        </h1>
        <p class="text-gray-400 text-sm mt-1">
          <template v-if="isOwnerMode">
            People who added your offerings and requested quotes or meetings.
          </template>
          <template v-else>
            Request a quote by email or book a meeting about these items.
          </template>
        </p>
      </header>

      <p v-if="loading" class="text-sm text-gray-500 py-8 text-center">Loading…</p>

      <!-- Owner inbox -->
      <template v-else-if="isOwnerMode">
        <div v-if="!ownerCarts.length" class="card-item-bg rounded-2xl px-4 py-10 text-center">
          <span class="material-symbols-outlined text-gray-500 text-[32px]">shopping_cart</span>
          <p class="text-sm text-gray-300 mt-3">No catalog cart activity yet</p>
          <RouterLink to="/catalog" class="inline-block mt-4 text-sm text-emerald-400 no-underline">
            Manage catalog
          </RouterLink>
        </div>
        <ul v-else class="space-y-3">
          <li v-for="cart in ownerCarts" :key="cart.id" class="card-item-bg rounded-2xl p-4">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="text-sm font-semibold truncate">{{ cart.visitorName || 'Guest' }}</p>
                <p class="text-xs text-gray-400 mt-0.5 truncate">{{ cart.visitorEmail }}</p>
                <p v-if="cart.visitorPhone" class="text-xs text-gray-500">{{ cart.visitorPhone }}</p>
              </div>
              <span class="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-zinc-800 text-gray-300 shrink-0">
                {{ statusLabel(cart.status) }}
              </span>
            </div>
            <p class="text-xs text-gray-500 mt-2">{{ formatWhen(cart.createdAt) }}</p>
            <ul class="mt-3 space-y-1">
              <li
                v-for="(item, idx) in (cart.items || [])"
                :key="item.id + '-' + idx"
                class="text-xs text-gray-300 flex justify-between gap-2"
              >
                <span class="truncate">{{ item.name }} × {{ item.qty }}</span>
                <span class="shrink-0 text-gray-500">{{ formatPrice(item.price) }}</span>
              </li>
            </ul>
            <p v-if="cart.note" class="text-xs text-gray-400 mt-2">Note: {{ cart.note }}</p>
            <div class="flex gap-2 mt-3">
              <a
                v-if="cart.visitorEmail"
                :href="'mailto:' + cart.visitorEmail"
                class="flex-1 py-2 rounded-xl bg-zinc-800 text-sm font-medium text-center no-underline text-inherit"
              >
                Email
              </a>
              <button
                v-if="cart.status !== 'closed'"
                type="button"
                class="px-3 py-2 rounded-xl bg-zinc-800 text-sm"
                @click="markClosed(cart)"
              >
                Close
              </button>
              <button
                type="button"
                class="px-3 py-2 rounded-xl bg-zinc-800 text-sm text-red-300"
                @click="softDelete(cart)"
              >
                Remove
              </button>
            </div>
          </li>
        </ul>
      </template>

      <!-- Guest cart -->
      <template v-else>
        <div v-if="!guestLines.length" class="card-item-bg rounded-2xl px-4 py-10 text-center">
          <span class="material-symbols-outlined text-gray-500 text-[32px]">shopping_cart</span>
          <p class="text-sm text-gray-300 mt-3">Your cart is empty</p>
          <RouterLink to="/catalog" class="inline-block mt-4 text-sm text-emerald-400 no-underline">
            Browse catalog
          </RouterLink>
        </div>
        <template v-else>
          <p v-if="guestOwnerName" class="text-xs text-gray-500 mb-3">
            Items from {{ guestOwnerName }}
          </p>
          <ul class="space-y-3 mb-4">
            <li v-for="line in guestLines" :key="line.id" class="card-item-bg rounded-2xl p-4">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-sm font-semibold">{{ line.name }}</p>
                  <p class="text-xs text-gray-500 mt-0.5">{{ formatPrice(line.price) }}</p>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <button type="button" class="w-8 h-8 rounded-full bg-zinc-800" @click="setCatalogCartQty(line.id, line.qty - 1); refreshGuest()">−</button>
                  <span class="text-sm w-5 text-center">{{ line.qty }}</span>
                  <button type="button" class="w-8 h-8 rounded-full bg-zinc-800" @click="setCatalogCartQty(line.id, line.qty + 1); refreshGuest()">+</button>
                </div>
              </div>
              <button type="button" class="mt-2 text-xs text-red-300" @click="removeCatalogCartItem(line.id); refreshGuest()">
                Remove
              </button>
            </li>
          </ul>
          <div class="space-y-2">
            <button
              type="button"
              class="w-full py-3 rounded-full bg-white text-black text-sm font-bold"
              @click="checkoutOpen = true"
            >
              Get quote on email
            </button>
            <button
              type="button"
              class="w-full py-3 rounded-full bg-zinc-800 text-sm font-semibold"
              @click="meetingOpen = true"
            >
              Book a meeting
            </button>
          </div>
        </template>
      </template>

            <Teleport to="body">
        <div v-if="checkoutOpen" class="app-dialog-overlay fixed inset-0 z-[210] flex items-end sm:items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/70" @click="checkoutOpen = false" />
          <div class="relative w-full max-w-md card-item-bg rounded-3xl p-5 shadow-2xl">
            <h2 class="text-lg font-bold mb-3">Request a quote</h2>
            <div class="space-y-3">
              <input v-model="guestName" type="text" class="field-input w-full" placeholder="Name" autocomplete="name">
              <input v-model="guestEmail" type="email" class="field-input w-full" placeholder="Email" autocomplete="email">
              <input v-model="guestPhone" type="tel" class="field-input w-full" placeholder="Phone (optional)" autocomplete="tel">
              <textarea v-model="guestNote" rows="2" class="field-input w-full resize-none" placeholder="Note (optional)" />
              <p v-if="checkoutError" class="text-sm text-red-300">{{ checkoutError }}</p>
              <button
                type="button"
                class="w-full py-3.5 rounded-full bg-white text-black font-bold text-sm disabled:opacity-50"
                :disabled="submitting"
                @click="submitQuote"
              >
                {{ submitting ? 'Sending…' : 'Email me a quote' }}
              </button>
            </div>
          </div>
        </div>
      </Teleport>

      <BookMeetingPopup
        :open="meetingOpen"
        :profile-id="guestProfileId"
        :owner-name="guestOwnerName"
        @close="meetingOpen = false"
        @submitted="onMeetingSubmitted"
      />

      <Teleport to="body">
        <p
          v-if="toast"
          class="fixed bottom-24 left-1/2 -translate-x-1/2 z-[220] px-4 py-2 rounded-full bg-zinc-800 text-sm shadow-lg"
        >
          {{ toast }}
        </p>
      </Teleport>
    </main>
  </div>
</template>
