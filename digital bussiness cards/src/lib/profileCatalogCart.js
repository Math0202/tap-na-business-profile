/**
 * Guest cart for a personal profile catalog (separate from shop cart).
 * Scoped per profileId in localStorage.
 */

import { computed, ref } from 'vue'

const KEY_PREFIX = 'tapna_profile_catalog_cart_'

const profileId = ref('')
const items = ref([])

function storageKey(id) {
  return KEY_PREFIX + String(id || '').trim()
}

function loadFor(id) {
  const pid = String(id || '').trim()
  if (!pid) return []
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey(pid)) || '[]')
    if (!Array.isArray(raw)) return []
    return raw
      .filter((row) => row && typeof row.id === 'string' && Number(row.qty) > 0)
      .map((row) => ({
        id: String(row.id).slice(0, 64),
        name: String(row.name || '').slice(0, 120),
        price: row.price === null || row.price === undefined || row.price === '' ? null : Number(row.price),
        qty: Math.min(99, Math.max(1, Math.floor(Number(row.qty) || 1)))
      }))
  } catch {
    return []
  }
}

function persist() {
  const pid = profileId.value
  if (!pid) return
  localStorage.setItem(storageKey(pid), JSON.stringify(items.value))
  window.dispatchEvent(new CustomEvent('tapna-profile-catalog-cart-changed'))
}

export function setCatalogCartProfile(id) {
  const next = String(id || '').trim()
  if (profileId.value === next) {
    items.value = loadFor(next)
    return
  }
  profileId.value = next
  items.value = loadFor(next)
}

export function getCatalogCartProfileId() {
  return profileId.value
}

export const catalogCartItems = computed(() => items.value)

export const catalogCartCount = computed(() =>
  items.value.reduce((sum, row) => sum + (Number(row.qty) || 0), 0)
)

export function catalogCartLines(catalogItems = []) {
  const byId = new Map(
    (Array.isArray(catalogItems) ? catalogItems : []).map((x) => [String(x.id), x])
  )
  return items.value.map((row) => {
    const live = byId.get(row.id)
    const name = live?.name || row.name || 'Item'
    const price =
      live?.price !== undefined && live?.price !== null && live?.price !== ''
        ? Number(live.price)
        : row.price
    const unit = Number.isFinite(Number(price)) ? Number(price) : 0
    return {
      id: row.id,
      name,
      price: price === null || price === undefined || price === '' ? null : unit,
      qty: row.qty,
      lineTotal: Math.round(unit * row.qty * 100) / 100,
      images: Array.isArray(live?.images) ? live.images : [],
      description: live?.description || ''
    }
  })
}

export function addCatalogCartItem(item, qty = 1) {
  if (!profileId.value || !item?.id) return false
  const amount = Math.min(99, Math.max(1, Math.floor(Number(qty) || 1)))
  const existing = items.value.find((row) => row.id === item.id)
  if (existing) {
    existing.qty = Math.min(99, existing.qty + amount)
    if (item.name) existing.name = String(item.name).slice(0, 120)
    if (item.price !== undefined) existing.price = item.price
  } else {
    items.value.push({
      id: String(item.id).slice(0, 64),
      name: String(item.name || '').slice(0, 120),
      price: item.price === null || item.price === undefined || item.price === '' ? null : Number(item.price),
      qty: amount
    })
  }
  persist()
  return true
}

export function setCatalogCartQty(itemId, qty) {
  const next = Math.floor(Number(qty) || 0)
  const idx = items.value.findIndex((row) => row.id === itemId)
  if (idx < 0) return
  if (next <= 0) items.value.splice(idx, 1)
  else items.value[idx].qty = Math.min(99, next)
  persist()
}

export function removeCatalogCartItem(itemId) {
  items.value = items.value.filter((row) => row.id !== itemId)
  persist()
}

export function clearCatalogCart() {
  items.value = []
  persist()
}

export function refreshCatalogCart() {
  items.value = loadFor(profileId.value)
}

/** Any guest cart across profiles (for nav badge when not on a specific catalog). */
export function anyCatalogCartCount() {
  try {
    let total = 0
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key || !key.startsWith(KEY_PREFIX)) continue
      const raw = JSON.parse(localStorage.getItem(key) || '[]')
      if (!Array.isArray(raw)) continue
      total += raw.reduce((s, row) => s + (Number(row?.qty) || 0), 0)
    }
    return total
  } catch {
    return 0
  }
}

export function loadAllCatalogCarts() {
  const out = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key || !key.startsWith(KEY_PREFIX)) continue
      const pid = key.slice(KEY_PREFIX.length)
      const rows = loadFor(pid)
      if (rows.length) out.push({ profileId: pid, items: rows })
    }
  } catch {
    /* ignore */
  }
  return out
}
