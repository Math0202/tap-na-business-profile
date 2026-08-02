<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import BrandMark from '../components/BrandMark.vue'
import BookMeetingPopup from '../components/BookMeetingPopup.vue'
import {
  loadPublicProfile,
  loadViewedProfile,
  loadProfile,
  saveProfile,
  isLoggedIn,
  isTableBusiness,
  displayName
} from '../lib/profileStore'
import {
  apiUpdateMe,
  apiPublicCatalog,
  apiUploadAsset,
  apiSubmitCatalogCart,
  getApiToken,
  ensureApiSession
} from '../lib/api'
import {
  setCatalogCartProfile,
  catalogCartCount,
  catalogCartLines,
  addCatalogCartItem,
  setCatalogCartQty,
  removeCatalogCartItem,
  clearCatalogCart,
  refreshCatalogCart
} from '../lib/profileCatalogCart'

const router = useRouter()
const publicProfile = ref(loadPublicProfile())
const items = ref([])
const toast = ref('')
const saving = ref(false)
const editing = ref(null)
const loading = ref(true)
const uploading = ref(false)
const cartOpen = ref(false)
const checkoutOpen = ref(false)
const meetingOpen = ref(false)
const submitting = ref(false)
const checkoutError = ref('')
const guestName = ref('')
const guestEmail = ref('')
const guestPhone = ref('')
const guestNote = ref('')
const linkDraft = ref({ label: '', url: '' })

const form = ref(emptyForm())

function emptyForm() {
  return {
    id: '',
    name: '',
    description: '',
    price: '',
    active: true,
    images: [],
    pdfs: [],
    links: []
  }
}

const loggedIn = computed(() => isLoggedIn())
const ownerName = computed(() => displayName(publicProfile.value) || 'This person')
const profileId = computed(() =>
  String(publicProfile.value.remoteProfileId || publicProfile.value.id || '').trim()
)
const isOwner = computed(() => {
  if (!loggedIn.value) return false
  const viewed = loadViewedProfile()
  if (!viewed) return true
  const mine = loadProfile()
  const myId = String(mine.remoteProfileId || '').trim()
  const theirId = String(viewed.remoteProfileId || viewed.id || '').trim()
  return !!(myId && theirId && myId === theirId)
})

const visibleItems = computed(() =>
  items.value.filter((x) => x && x.active !== false && String(x.name || '').trim())
)

const cartCount = catalogCartCount
const cartLines = computed(() => catalogCartLines(items.value))
const showGuestCart = computed(() => !isOwner.value)

function flash(msg) {
  toast.value = msg
  setTimeout(() => {
    toast.value = ''
  }, 2200)
}

function newId() {
  return 'cat_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

function formatPrice(price) {
  if (price === null || price === undefined || price === '') return ''
  return (
    'N$ ' +
    Number(price).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    })
  )
}

function parsePrice(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return null
  const n = Number(s.replace(/,/g, ''))
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100) / 100
}

function isHttpUrl(value) {
  try {
    const u = new URL(String(value || '').trim())
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

async function refresh() {
  loading.value = true
  publicProfile.value = loadPublicProfile()
  const local = Array.isArray(publicProfile.value.catalogItems)
    ? publicProfile.value.catalogItems.map((x) => ({ ...x }))
    : []
  items.value = local

  const id = profileId.value
  if (id) {
    setCatalogCartProfile(id)
    const res = await apiPublicCatalog(id)
    if (res.ok && Array.isArray(res.data?.catalogItems)) {
      items.value = res.data.catalogItems.map((x) => ({ ...x }))
      if (res.data.ownerName) {
        publicProfile.value = { ...publicProfile.value, name: res.data.ownerName }
      }
    }
  }
  refreshCatalogCart()
  loading.value = false
}

function openNew() {
  editing.value = 'new'
  form.value = { ...emptyForm(), id: newId() }
  linkDraft.value = { label: '', url: '' }
}

function openEdit(item) {
  editing.value = item.id
  form.value = {
    id: item.id,
    name: item.name || '',
    description: item.description || '',
    price: item.price === null || item.price === undefined ? '' : String(item.price),
    active: item.active !== false,
    images: Array.isArray(item.images) ? [...item.images] : [],
    pdfs: Array.isArray(item.pdfs) ? item.pdfs.map((p) => ({ ...p })) : [],
    links: Array.isArray(item.links) ? item.links.map((l) => ({ ...l })) : []
  }
  linkDraft.value = { label: '', url: '' }
}

function closeForm() {
  editing.value = null
}

function upsertLocal() {
  const name = form.value.name.trim()
  if (!name) {
    flash('Name is required')
    return false
  }
  const next = {
    id: form.value.id || newId(),
    name,
    description: form.value.description.trim(),
    price: parsePrice(form.value.price),
    active: form.value.active !== false,
    images: (form.value.images || []).filter(isHttpUrl).slice(0, 8),
    pdfs: (form.value.pdfs || [])
      .filter((p) => isHttpUrl(p.url))
      .map((p) => ({
        name: String(p.name || 'Document').slice(0, 120),
        url: p.url
      }))
      .slice(0, 5),
    links: (form.value.links || [])
      .filter((l) => isHttpUrl(l.url))
      .map((l) => ({
        label: String(l.label || l.url).slice(0, 120),
        url: l.url
      }))
      .slice(0, 10)
  }
  const idx = items.value.findIndex((x) => x.id === next.id)
  if (idx >= 0) items.value.splice(idx, 1, next)
  else items.value.push(next)
  return true
}

async function persist() {
  saving.value = true
  try {
    const catalogItems = items.value.map((x) => ({
      id: x.id,
      name: x.name,
      description: x.description || '',
      price: x.price,
      active: x.active !== false,
      images: Array.isArray(x.images) ? x.images : [],
      pdfs: Array.isArray(x.pdfs) ? x.pdfs : [],
      links: Array.isArray(x.links) ? x.links : []
    }))
    saveProfile({ catalogItems })
    let authed = await ensureApiSession()
    if (!authed) authed = await ensureApiSession({ force: true })
    if (authed && getApiToken()) {
      const sync = await apiUpdateMe({ catalogItems })
      if (!sync.ok) {
        flash(sync.error || 'Saved locally, cloud sync failed')
        return false
      }
      if (sync.data?.profile?.catalogItems) {
        items.value = sync.data.profile.catalogItems.map((x) => ({ ...x }))
        saveProfile({ catalogItems: items.value })
      }
    }
    return true
  } finally {
    saving.value = false
  }
}

async function saveItem() {
  if (!upsertLocal()) return
  const ok = await persist()
  if (ok) {
    closeForm()
    flash('Saved')
  }
}

async function removeItem(id) {
  if (!confirm('Remove this offering?')) return
  items.value = items.value.filter((x) => x.id !== id)
  const ok = await persist()
  if (ok) flash('Removed')
}

async function uploadCatalogFile(file, { asPdf = false } = {}) {
  uploading.value = true
  try {
    let uploaded = await apiUploadAsset(file, { kind: 'catalog' })
    if (!uploaded.ok && uploaded.status === 401 && (await ensureApiSession({ force: true }))) {
      uploaded = await apiUploadAsset(file, { kind: 'catalog' })
    }
    if (!uploaded.ok || !uploaded.data?.url) {
      throw new Error(uploaded.error || 'Upload failed')
    }
    const url = uploaded.data.url
    if (asPdf || file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '')) {
      form.value.pdfs = [
        ...(form.value.pdfs || []),
        { name: String(file.name || 'Document').slice(0, 120), url }
      ].slice(0, 5)
    } else {
      form.value.images = [...(form.value.images || []), url].slice(0, 8)
    }
    flash('Uploaded')
  } catch (err) {
    flash(err?.message || 'Upload failed')
  } finally {
    uploading.value = false
  }
}

function onImagePick(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (file) uploadCatalogFile(file)
}

function onPdfPick(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (file) uploadCatalogFile(file, { asPdf: true })
}

function removeImage(url) {
  form.value.images = (form.value.images || []).filter((u) => u !== url)
}

function removePdf(url) {
  form.value.pdfs = (form.value.pdfs || []).filter((p) => p.url !== url)
}

function addLink() {
  const url = linkDraft.value.url.trim()
  const label = linkDraft.value.label.trim() || url
  if (!isHttpUrl(url)) {
    flash('Enter a valid http(s) link')
    return
  }
  form.value.links = [...(form.value.links || []), { label: label.slice(0, 120), url }].slice(0, 10)
  linkDraft.value = { label: '', url: '' }
}

function removeLink(url) {
  form.value.links = (form.value.links || []).filter((l) => l.url !== url)
}

function addToCart(item) {
  if (!profileId.value) {
    flash('Catalog is not ready yet')
    return
  }
  setCatalogCartProfile(profileId.value)
  addCatalogCartItem(item, 1)
  flash('Added to cart')
}

function openCartPanel() {
  cartOpen.value = true
}

function openCheckout() {
  checkoutError.value = ''
  checkoutOpen.value = true
}

async function submitQuote() {
  if (!profileId.value || submitting.value) return
  const name = guestName.value.trim()
  const email = guestEmail.value.trim()
  const phone = guestPhone.value.trim()
  if (!name) {
    checkoutError.value = 'Please enter your name.'
    return
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    checkoutError.value = 'Please enter a valid email.'
    return
  }
  if (!cartLines.value.length) {
    checkoutError.value = 'Cart is empty.'
    return
  }
  submitting.value = true
  checkoutError.value = ''
  try {
    const res = await apiSubmitCatalogCart(profileId.value, {
      name,
      email,
      phone,
      note: guestNote.value.trim(),
      action: 'quote',
      items: cartLines.value.map((l) => ({
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
    cartOpen.value = false
    flash('Quote emailed to you and the owner')
  } finally {
    submitting.value = false
  }
}

async function onMeetingSubmitted() {
  if (!profileId.value || !cartLines.value.length) return
  const name = guestName.value.trim() || 'Guest'
  const email = guestEmail.value.trim()
  if (!email) return
  await apiSubmitCatalogCart(profileId.value, {
    name,
    email,
    phone: guestPhone.value.trim(),
    note: guestNote.value.trim() || 'Booked a meeting about cart items',
    action: 'meeting',
    items: cartLines.value.map((l) => ({
      id: l.id,
      name: l.name,
      qty: l.qty,
      price: l.price
    }))
  })
  clearCatalogCart()
  cartOpen.value = false
  checkoutOpen.value = false
  flash('Meeting booked — owner notified')
}

function openMeetingFromCart() {
  meetingOpen.value = true
}

watch(profileId, (id) => {
  if (id) setCatalogCartProfile(id)
})

onMounted(() => {
  document.title = 'Catalog - tap-na'
  if (isTableBusiness(loadProfile()) && isLoggedIn() && !loadPublicProfile()?.remoteProfileId) {
    router.replace('/venue')
    return
  }
  const mine = loadProfile()
  if (mine?.name) guestName.value = mine.name
  if (mine?.email) guestEmail.value = mine.email
  if (mine?.phone) guestPhone.value = mine.phone
  refresh()
  window.addEventListener('tapna-profile-catalog-cart-changed', refreshCatalogCart)
})

onUnmounted(() => {
  window.removeEventListener('tapna-profile-catalog-cart-changed', refreshCatalogCart)
})
</script>

<template>
  <div class="min-h-screen flex flex-col items-center overflow-x-hidden">
    <main class="w-full max-w-md min-h-screen flex flex-col relative z-10 pb-28 px-6 pt-8">
      <header class="pb-4">
        <BrandMark size="sm" class="mb-3" />
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h1 class="text-2xl font-bold tracking-tight">Catalog</h1>
            <p class="text-gray-400 text-sm mt-1">
              {{ isOwner ? 'Products and services you offer.' : 'Products and services from ' + ownerName }}
            </p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button
              v-if="showGuestCart"
              type="button"
              class="relative w-11 h-11 rounded-full bg-zinc-800 flex items-center justify-center hover:bg-zinc-700"
              aria-label="Open cart"
              @click="openCartPanel"
            >
              <span class="material-symbols-outlined text-[22px]">shopping_cart</span>
              <span
                v-if="cartCount > 0"
                class="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-[10px] font-bold text-black flex items-center justify-center"
              >
                {{ cartCount > 9 ? '9+' : cartCount }}
              </span>
            </button>
            <button
              v-if="isOwner"
              type="button"
              class="px-4 py-2 rounded-full bg-white text-black text-sm font-semibold hover:bg-gray-200 transition-colors"
              @click="openNew"
            >
              Add
            </button>
          </div>
        </div>
      </header>

      <p v-if="loading" class="text-sm text-gray-500 py-8 text-center">Loading…</p>

      <template v-else>
        <div
          v-if="!(isOwner ? items : visibleItems).length"
          class="card-item-bg rounded-2xl px-4 py-10 text-center"
        >
          <span class="material-symbols-outlined text-gray-500 text-[32px]">inventory_2</span>
          <p class="text-sm text-gray-300 mt-3 leading-relaxed">
            {{ ownerName }} has no products or services listed yet
          </p>
          <button
            v-if="isOwner"
            type="button"
            class="mt-4 px-4 py-2 rounded-full bg-white text-black text-sm font-semibold"
            @click="openNew"
          >
            Add your first offering
          </button>
        </div>

        <ul v-else class="space-y-3">
          <li
            v-for="item in (isOwner ? items : visibleItems)"
            :key="item.id"
            class="card-item-bg rounded-2xl p-4"
          >
            <div class="flex items-start gap-3">
              <div
                class="w-14 h-14 rounded-2xl bg-zinc-900 overflow-hidden flex items-center justify-center text-black shrink-0"
              >
                <img
                  v-if="item.images?.[0]"
                  :src="item.images[0]"
                  :alt="item.name"
                  class="w-full h-full object-cover"
                >
                <span v-else class="material-symbols-outlined text-[24px] text-white">inventory_2</span>
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-semibold text-gray-100 truncate">{{ item.name }}</p>
                <p v-if="item.description" class="text-xs text-gray-500 mt-0.5 line-clamp-2">
                  {{ item.description }}
                </p>
                <p class="text-xs text-gray-400 mt-1">
                  <span v-if="formatPrice(item.price)">{{ formatPrice(item.price) }}</span>
                  <span v-else class="text-gray-600">Ask for quote</span>
                  <template v-if="isOwner">
                    <span class="mx-1.5 text-gray-700">·</span>
                    <span :class="item.active !== false ? 'text-emerald-400' : 'text-gray-500'">
                      {{ item.active !== false ? 'Live' : 'Hidden' }}
                    </span>
                  </template>
                </p>
                <div
                  v-if="(item.pdfs?.length || item.links?.length)"
                  class="flex flex-wrap gap-2 mt-2"
                >
                  <a
                    v-for="pdf in (item.pdfs || [])"
                    :key="pdf.url"
                    :href="pdf.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-[11px] px-2 py-1 rounded-full bg-zinc-800 text-gray-300 no-underline"
                  >
                    PDF · {{ pdf.name }}
                  </a>
                  <a
                    v-for="link in (item.links || [])"
                    :key="link.url"
                    :href="link.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-[11px] px-2 py-1 rounded-full bg-zinc-800 text-gray-300 no-underline"
                  >
                    {{ link.label }}
                  </a>
                </div>
              </div>
            </div>
            <div v-if="isOwner" class="flex gap-2 mt-3">
              <button
                type="button"
                class="flex-1 py-2 rounded-xl bg-zinc-800 text-sm font-medium hover:bg-zinc-700"
                @click="openEdit(item)"
              >
                Edit
              </button>
              <button
                type="button"
                class="px-4 py-2 rounded-xl bg-zinc-800 text-sm font-medium text-red-300 hover:bg-zinc-700"
                @click="removeItem(item.id)"
              >
                Remove
              </button>
            </div>
            <div v-else class="mt-3">
              <button
                type="button"
                class="w-full py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-gray-200"
                @click="addToCart(item)"
              >
                Add to cart
              </button>
            </div>
          </li>
        </ul>
      </template>

      <!-- Owner edit modal -->
      <Teleport to="body">
        <div v-if="editing && isOwner" class="app-dialog-overlay fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/70" @click="closeForm" />
          <div class="relative w-full max-w-md card-item-bg rounded-3xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-lg font-bold">{{ editing === 'new' ? 'Add offering' : 'Edit offering' }}</h2>
              <button type="button" class="w-9 h-9 rounded-full bg-zinc-700 flex items-center justify-center" @click="closeForm">
                <span class="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div class="space-y-3">
              <div>
                <label class="field-label" for="cat-name">Name</label>
                <input id="cat-name" v-model="form.name" type="text" class="field-input w-full" placeholder="Consulting hour" maxlength="120">
              </div>
              <div>
                <label class="field-label" for="cat-desc">Description</label>
                <textarea id="cat-desc" v-model="form.description" rows="2" class="field-input w-full resize-none" placeholder="Optional details" maxlength="400" />
              </div>
              <div>
                <label class="field-label" for="cat-price">Price (optional)</label>
                <input id="cat-price" v-model="form.price" type="text" inputmode="decimal" class="field-input w-full" placeholder="e.g. 450">
              </div>

              <div>
                <p class="field-label">Images</p>
                <div class="flex flex-wrap gap-2 mb-2">
                  <div v-for="url in form.images" :key="url" class="relative w-16 h-16 rounded-xl overflow-hidden bg-zinc-900">
                    <img :src="url" alt="" class="w-full h-full object-cover">
                    <button type="button" class="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/70 text-[10px]" @click="removeImage(url)">×</button>
                  </div>
                </div>
                <label class="inline-flex px-3 py-2 rounded-xl bg-zinc-800 text-sm cursor-pointer">
                  {{ uploading ? 'Uploading…' : 'Attach image' }}
                  <input type="file" accept="image/*" class="hidden" :disabled="uploading" @change="onImagePick">
                </label>
              </div>

              <div>
                <p class="field-label">PDFs</p>
                <ul class="space-y-1 mb-2">
                  <li v-for="pdf in form.pdfs" :key="pdf.url" class="flex items-center gap-2 text-xs text-gray-300">
                    <span class="truncate flex-1">{{ pdf.name }}</span>
                    <button type="button" class="text-red-300" @click="removePdf(pdf.url)">Remove</button>
                  </li>
                </ul>
                <label class="inline-flex px-3 py-2 rounded-xl bg-zinc-800 text-sm cursor-pointer">
                  Attach PDF
                  <input type="file" accept="application/pdf,.pdf" class="hidden" :disabled="uploading" @change="onPdfPick">
                </label>
              </div>

              <div>
                <p class="field-label">Links</p>
                <ul class="space-y-1 mb-2">
                  <li v-for="link in form.links" :key="link.url" class="flex items-center gap-2 text-xs text-gray-300">
                    <span class="truncate flex-1">{{ link.label }}</span>
                    <button type="button" class="text-red-300" @click="removeLink(link.url)">Remove</button>
                  </li>
                </ul>
                <div class="flex flex-col gap-2">
                  <input v-model="linkDraft.label" type="text" class="field-input w-full" placeholder="Label (optional)" maxlength="120">
                  <input v-model="linkDraft.url" type="url" class="field-input w-full" placeholder="https://…">
                  <button type="button" class="py-2 rounded-xl bg-zinc-800 text-sm" @click="addLink">Add link</button>
                </div>
              </div>

              <label class="flex items-center gap-3 cursor-pointer">
                <input v-model="form.active" type="checkbox" class="rounded border-zinc-600">
                <span class="text-sm">Show on public card</span>
              </label>
              <button
                type="button"
                class="w-full py-3.5 rounded-full bg-white text-black font-bold text-sm hover:bg-gray-200 disabled:opacity-50"
                :disabled="saving || uploading"
                @click="saveItem"
              >
                {{ saving ? 'Saving…' : 'Save' }}
              </button>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- Guest cart sheet -->
      <Teleport to="body">
        <div v-if="cartOpen && showGuestCart" class="app-dialog-overlay fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/70" @click="cartOpen = false" />
          <div class="relative w-full max-w-md card-item-bg rounded-3xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-lg font-bold">Your cart</h2>
              <button type="button" class="w-9 h-9 rounded-full bg-zinc-700 flex items-center justify-center" @click="cartOpen = false">
                <span class="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <p v-if="!cartLines.length" class="text-sm text-gray-400 py-6 text-center">Cart is empty</p>
            <ul v-else class="space-y-3 mb-4">
              <li v-for="line in cartLines" :key="line.id" class="flex items-start gap-3">
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium">{{ line.name }}</p>
                  <p class="text-xs text-gray-500">
                    {{ formatPrice(line.price) || 'Ask for quote' }}
                  </p>
                </div>
                <div class="flex items-center gap-2">
                  <button type="button" class="w-8 h-8 rounded-full bg-zinc-800" @click="setCatalogCartQty(line.id, line.qty - 1)">−</button>
                  <span class="text-sm w-5 text-center">{{ line.qty }}</span>
                  <button type="button" class="w-8 h-8 rounded-full bg-zinc-800" @click="setCatalogCartQty(line.id, line.qty + 1)">+</button>
                  <button type="button" class="text-red-300 text-xs ml-1" @click="removeCatalogCartItem(line.id)">Remove</button>
                </div>
              </li>
            </ul>

            <div v-if="cartLines.length" class="space-y-2">
              <button
                type="button"
                class="w-full py-3 rounded-full bg-white text-black text-sm font-bold"
                @click="openCheckout"
              >
                Get quote on email
              </button>
              <button
                type="button"
                class="w-full py-3 rounded-full bg-zinc-800 text-sm font-semibold"
                @click="openMeetingFromCart"
              >
                Book a meeting
              </button>
              <RouterLink
                to="/catalog-cart"
                class="block w-full py-3 rounded-full bg-zinc-900 text-sm font-semibold text-center no-underline text-inherit"
                @click="cartOpen = false"
              >
                Open full cart
              </RouterLink>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- Quote checkout -->
      <Teleport to="body">
        <div v-if="checkoutOpen && showGuestCart" class="app-dialog-overlay fixed inset-0 z-[210] flex items-end sm:items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/70" @click="checkoutOpen = false" />
          <div class="relative w-full max-w-md card-item-bg rounded-3xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-lg font-bold">Request a quote</h2>
              <button type="button" class="w-9 h-9 rounded-full bg-zinc-700 flex items-center justify-center" @click="checkoutOpen = false">
                <span class="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <p class="text-xs text-gray-400 mb-3">
              We’ll email the quote details to you and {{ ownerName }}.
            </p>
            <div class="space-y-3">
              <div>
                <label class="field-label" for="guest-name">Name</label>
                <input id="guest-name" v-model="guestName" type="text" class="field-input w-full" autocomplete="name">
              </div>
              <div>
                <label class="field-label" for="guest-email">Email</label>
                <input id="guest-email" v-model="guestEmail" type="email" class="field-input w-full" autocomplete="email">
              </div>
              <div>
                <label class="field-label" for="guest-phone">Phone (optional)</label>
                <input id="guest-phone" v-model="guestPhone" type="tel" class="field-input w-full" autocomplete="tel">
              </div>
              <div>
                <label class="field-label" for="guest-note">Note (optional)</label>
                <textarea id="guest-note" v-model="guestNote" rows="2" class="field-input w-full resize-none" />
              </div>
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
        :profile-id="profileId"
        :owner-name="ownerName"
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
