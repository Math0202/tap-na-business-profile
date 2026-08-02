<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import BrandMark from '../components/BrandMark.vue'
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
  getApiToken,
  ensureApiSession
} from '../lib/api'

const router = useRouter()
const publicProfile = ref(loadPublicProfile())
const items = ref([])
const toast = ref('')
const saving = ref(false)
const editing = ref(null)
const loading = ref(true)

const form = ref({
  id: '',
  name: '',
  description: '',
  price: '',
  active: true
})

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

function flash(msg) {
  toast.value = msg
  setTimeout(() => { toast.value = '' }, 2200)
}

function newId() {
  return 'cat_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

function formatPrice(price) {
  if (price === null || price === undefined || price === '') return ''
  return 'N$ ' + Number(price).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })
}

function parsePrice(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return null
  const n = Number(s.replace(/,/g, ''))
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100) / 100
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
    const res = await apiPublicCatalog(id)
    if (res.ok && Array.isArray(res.data?.catalogItems)) {
      items.value = res.data.catalogItems.map((x) => ({ ...x }))
      if (res.data.ownerName) {
        publicProfile.value = { ...publicProfile.value, name: res.data.ownerName }
      }
    }
  }
  loading.value = false
}

function openNew() {
  editing.value = 'new'
  form.value = { id: newId(), name: '', description: '', price: '', active: true }
}

function openEdit(item) {
  editing.value = item.id
  form.value = {
    id: item.id,
    name: item.name || '',
    description: item.description || '',
    price: item.price === null || item.price === undefined ? '' : String(item.price),
    active: item.active !== false
  }
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
    active: form.value.active !== false
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
      active: x.active !== false
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

onMounted(() => {
  document.title = 'Catalog - tap-na'
  if (isTableBusiness(loadProfile()) && isLoggedIn() && !loadPublicProfile()?.remoteProfileId) {
    router.replace('/venue')
    return
  }
  refresh()
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
          <button
            v-if="isOwner"
            type="button"
            class="shrink-0 px-4 py-2 rounded-full bg-white text-black text-sm font-semibold hover:bg-gray-200 transition-colors"
            @click="openNew"
          >
            Add
          </button>
        </div>
      </header>

      <p v-if="loading" class="text-sm text-gray-500 py-8 text-center">Loading…</p>

      <template v-else>
        <div
          v-if="!visibleItems.length"
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
              <div class="w-12 h-12 rounded-full bg-white flex items-center justify-center text-black shrink-0">
                <span class="material-symbols-outlined text-[24px]">inventory_2</span>
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-semibold text-gray-100 truncate">{{ item.name }}</p>
                <p v-if="item.description" class="text-xs text-gray-500 mt-0.5 line-clamp-2">{{ item.description }}</p>
                <p class="text-xs text-gray-400 mt-1">
                  <span v-if="formatPrice(item.price)">{{ formatPrice(item.price) }}</span>
                  <span v-else class="text-gray-600">No price</span>
                  <template v-if="isOwner">
                    <span class="mx-1.5 text-gray-700">·</span>
                    <span :class="item.active !== false ? 'text-emerald-400' : 'text-gray-500'">
                      {{ item.active !== false ? 'Live' : 'Hidden' }}
                    </span>
                  </template>
                </p>
              </div>
            </div>
            <div v-if="isOwner" class="flex gap-2 mt-3">
              <button type="button" class="flex-1 py-2 rounded-xl bg-zinc-800 text-sm font-medium hover:bg-zinc-700" @click="openEdit(item)">Edit</button>
              <button type="button" class="px-4 py-2 rounded-xl bg-zinc-800 text-sm font-medium text-red-300 hover:bg-zinc-700" @click="removeItem(item.id)">Remove</button>
            </div>
          </li>
        </ul>
      </template>

      <div v-if="editing && isOwner" class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/70" @click="closeForm" />
        <div class="relative w-full max-w-md card-item-bg rounded-3xl p-5 shadow-2xl">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-lg font-bold">{{ editing === 'new' ? 'Add offering' : 'Edit offering' }}</h2>
            <button type="button" class="w-9 h-9 rounded-full bg-zinc-700 flex items-center justify-center" @click="closeForm">
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
          <div class="space-y-3">
            <div>
              <label class="field-label" for="cat-name">Name</label>
              <input id="cat-name" v-model="form.name" type="text" class="field-input w-full" placeholder="Consulting hour" maxlength="120" />
            </div>
            <div>
              <label class="field-label" for="cat-desc">Description</label>
              <textarea id="cat-desc" v-model="form.description" rows="2" class="field-input w-full resize-none" placeholder="Optional details" maxlength="400" />
            </div>
            <div>
              <label class="field-label" for="cat-price">Price (optional)</label>
              <input id="cat-price" v-model="form.price" type="text" inputmode="decimal" class="field-input w-full" placeholder="e.g. 450" />
            </div>
            <label class="flex items-center gap-3 cursor-pointer">
              <input v-model="form.active" type="checkbox" class="rounded border-zinc-600" />
              <span class="text-sm">Show on public card</span>
            </label>
            <button
              type="button"
              class="w-full py-3.5 rounded-full bg-white text-black font-bold text-sm hover:bg-gray-200 disabled:opacity-50"
              :disabled="saving"
              @click="saveItem"
            >
              {{ saving ? 'Saving…' : 'Save' }}
            </button>
          </div>
        </div>
      </div>

      <p
        v-if="toast"
        class="fixed bottom-24 left-1/2 -translate-x-1/2 z-[110] px-4 py-2 rounded-full bg-zinc-800 text-sm shadow-lg"
      >
        {{ toast }}
      </p>
    </main>
  </div>
</template>