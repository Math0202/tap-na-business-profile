<script setup>
import { computed, ref, onMounted } from 'vue'
import BrandMark from '../components/BrandMark.vue'
import AdminBottomNav from '../components/AdminBottomNav.vue'
import {
  listShopProducts,
  saveShopProduct,
  deleteShopProduct,
  setShopProductActive,
  resetShopCatalog,
  formatPrice,
  SHOP_SECTIONS
} from '../lib/shopCatalog'

const products = ref([])
const query = ref('')
const sectionFilter = ref('all')
const toast = ref('')
const showForm = ref(false)
const form = ref(emptyForm())

function emptyForm() {
  return {
    id: '',
    name: '',
    price: 0,
    desc: '',
    image: '',
    alt: '',
    section: 'business-cards',
    label: '',
    badge: '',
    active: true
  }
}

function refresh() {
  products.value = listShopProducts({ includeInactive: true })
}

function flash(msg) {
  toast.value = msg
  setTimeout(() => { toast.value = '' }, 2200)
}

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return products.value.filter((p) => {
    if (sectionFilter.value !== 'all' && p.section !== sectionFilter.value) return false
    if (!q) return true
    return [p.name, p.desc, p.label, p.badge, p.id, p.section].join(' ').toLowerCase().includes(q)
  })
})

const stats = computed(() => ({
  total: products.value.length,
  live: products.value.filter((p) => p.active).length,
  cards: products.value.filter((p) => p.section === 'business-cards').length,
  table: products.value.filter((p) => p.section === 'table-brochure').length
}))

function sectionLabel(id) {
  return SHOP_SECTIONS.find((s) => s.id === id)?.label || id
}

function openNew() {
  form.value = emptyForm()
  form.value.id = 'prod-' + Math.random().toString(36).slice(2, 8)
  showForm.value = true
}

function openEdit(p) {
  form.value = { ...p }
  showForm.value = true
}

function submitForm(e) {
  e.preventDefault()
  if (!form.value.name.trim()) {
    flash('Name is required')
    return
  }
  saveShopProduct(form.value)
  showForm.value = false
  refresh()
  flash('Product saved — live on the storefront')
}

function toggleActive(p) {
  setShopProductActive(p.id, !p.active)
  refresh()
  flash(p.active ? 'Hidden from storefront' : 'Visible on storefront')
}

function removeProduct(p) {
  if (!confirm(`Remove “${p.name}” from the shop catalog?`)) return
  deleteShopProduct(p.id)
  refresh()
  flash('Product removed')
}

function resetDefaults() {
  if (!confirm('Reset shop catalog to default products? Your edits will be lost.')) return
  products.value = resetShopCatalog()
  flash('Catalog reset to defaults')
}

onMounted(() => {
  document.title = 'Shop management - tap-na'
  refresh()
})
</script>

<template>
  <div class="min-h-screen flex flex-col items-center overflow-x-hidden">
    <main class="w-full max-w-3xl min-h-screen flex flex-col relative z-10 px-5 pt-16 pb-36">
      <header class="mb-6">
        <BrandMark size="sm" class="mb-2" />
        <h1 class="text-2xl font-bold tracking-tight mt-1">Shop</h1>
        <p class="text-gray-400 text-sm mt-1">
          Manage storefront products shown on the public shop
        </p>
      </header>

      <section class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div class="card-item-bg rounded-2xl p-4">
          <p class="text-[11px] uppercase tracking-wide text-gray-500">Total</p>
          <p class="text-2xl font-bold mt-1">{{ stats.total }}</p>
        </div>
        <div class="card-item-bg rounded-2xl p-4">
          <p class="text-[11px] uppercase tracking-wide text-gray-500">Live</p>
          <p class="text-2xl font-bold mt-1 text-emerald-300">{{ stats.live }}</p>
        </div>
        <div class="card-item-bg rounded-2xl p-4">
          <p class="text-[11px] uppercase tracking-wide text-gray-500">Cards</p>
          <p class="text-2xl font-bold mt-1">{{ stats.cards }}</p>
        </div>
        <div class="card-item-bg rounded-2xl p-4">
          <p class="text-[11px] uppercase tracking-wide text-gray-500">Table</p>
          <p class="text-2xl font-bold mt-1">{{ stats.table }}</p>
        </div>
      </section>

      <div class="flex flex-col sm:flex-row gap-3 mb-4">
        <div class="field-shell flex-1 !rounded-2xl">
          <span class="material-symbols-outlined field-icon">search</span>
          <input v-model="query" type="search" class="field-input" placeholder="Search products…">
        </div>
        <button
          type="button"
          class="px-4 py-2.5 rounded-full text-xs font-bold bg-white text-black"
          @click="openNew"
        >
          Add product
        </button>
      </div>

      <div class="flex gap-2 flex-wrap mb-6">
        <button
          v-for="t in [{ id: 'all', label: 'All' }, ...SHOP_SECTIONS]"
          :key="t.id"
          type="button"
          class="px-3.5 py-2 rounded-full text-xs font-semibold border transition-colors"
          :class="sectionFilter === t.id
            ? 'bg-white text-black border-white'
            : 'bg-transparent text-gray-400 border-[var(--border)]'"
          @click="sectionFilter = t.id"
        >
          {{ t.label }}
        </button>
      </div>

      <div v-if="!filtered.length" class="card-item-bg rounded-2xl p-6 text-sm text-gray-400">
        No products match this filter.
      </div>

      <ul v-else class="space-y-3 mb-8">
        <li
          v-for="p in filtered"
          :key="p.id"
          class="card-item-bg rounded-2xl p-4 flex gap-3"
        >
          <div class="w-16 h-16 rounded-xl bg-zinc-800 overflow-hidden shrink-0 flex items-center justify-center">
            <img v-if="p.image" :src="p.image" :alt="p.alt || p.name" class="w-full h-full object-contain">
            <span v-else class="material-symbols-outlined text-gray-500">image</span>
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <p class="font-semibold text-sm truncate">{{ p.name }}</p>
              <span
                class="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                :class="p.active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-zinc-500/20 text-gray-400'"
              >
                {{ p.active ? 'Live' : 'Hidden' }}
              </span>
              <span v-if="p.badge" class="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300">
                {{ p.badge }}
              </span>
            </div>
            <p class="text-xs text-gray-400 mt-0.5">{{ sectionLabel(p.section) }} · {{ formatPrice(p.price) }}</p>
            <p class="text-[11px] text-gray-500 mt-1 line-clamp-2">{{ p.desc || 'No description' }}</p>
            <div class="flex flex-wrap gap-2 mt-3">
              <button type="button" class="text-xs font-semibold underline underline-offset-2" @click="openEdit(p)">Edit</button>
              <button type="button" class="text-xs font-semibold text-gray-400 hover:text-white" @click="toggleActive(p)">
                {{ p.active ? 'Hide' : 'Show' }}
              </button>
              <button type="button" class="text-xs font-semibold text-red-400" @click="removeProduct(p)">Delete</button>
            </div>
          </div>
        </li>
      </ul>

      <button
        type="button"
        class="text-xs font-semibold text-gray-400 hover:text-white underline underline-offset-2 self-start"
        @click="resetDefaults"
      >
        Reset to default catalog
      </button>
    </main>

    <!-- Form sheet -->
    <div
      v-if="showForm"
      class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 p-4"
      @click.self="showForm = false"
    >
      <form
        class="w-full max-w-md card-item-bg rounded-3xl p-5 space-y-3 max-h-[90vh] overflow-y-auto"
        @submit="submitForm"
      >
        <h2 class="text-lg font-bold">{{ form.id && products.some(p => p.id === form.id && p.name) ? 'Edit product' : 'New product' }}</h2>
        <div>
          <label class="text-[11px] uppercase tracking-wide text-gray-500">Name</label>
          <input v-model="form.name" class="field-input mt-1 w-full" required>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-[11px] uppercase tracking-wide text-gray-500">Price (USD)</label>
            <input v-model.number="form.price" type="number" min="0" step="0.01" class="field-input mt-1 w-full">
          </div>
          <div>
            <label class="text-[11px] uppercase tracking-wide text-gray-500">Section</label>
            <select v-model="form.section" class="field-input mt-1 w-full">
              <option v-for="s in SHOP_SECTIONS" :key="s.id" :value="s.id">{{ s.label }}</option>
            </select>
          </div>
        </div>
        <div>
          <label class="text-[11px] uppercase tracking-wide text-gray-500">Description</label>
          <textarea v-model="form.desc" rows="3" class="field-input mt-1 w-full"></textarea>
        </div>
        <div>
          <label class="text-[11px] uppercase tracking-wide text-gray-500">Image URL</label>
          <input v-model="form.image" class="field-input mt-1 w-full" placeholder="/images/…">
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-[11px] uppercase tracking-wide text-gray-500">Label</label>
            <input v-model="form.label" class="field-input mt-1 w-full" placeholder="e.g. Cobalt Blue">
          </div>
          <div>
            <label class="text-[11px] uppercase tracking-wide text-gray-500">Badge</label>
            <input v-model="form.badge" class="field-input mt-1 w-full" placeholder="e.g. Best Seller">
          </div>
        </div>
        <label class="flex items-center gap-2 text-sm">
          <input v-model="form.active" type="checkbox" class="rounded">
          Visible on storefront
        </label>
        <div class="flex gap-2 pt-1">
          <button type="button" class="flex-1 py-3 rounded-full border border-[var(--border)] text-sm font-semibold" @click="showForm = false">Cancel</button>
          <button type="submit" class="flex-1 py-3 rounded-full bg-white text-black text-sm font-bold">Save</button>
        </div>
      </form>
    </div>

    <AdminBottomNav />

    <div
      v-if="toast"
      class="fixed left-1/2 -translate-x-1/2 bottom-28 z-[110] px-4 py-3 rounded-2xl bg-white text-black text-sm font-medium shadow-xl"
    >
      {{ toast }}
    </div>
  </div>
</template>
