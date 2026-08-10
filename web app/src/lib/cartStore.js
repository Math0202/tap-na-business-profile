/**
 * Shopping cart - reactive, persisted in localStorage.
 */

import { computed, ref } from 'vue'
import { getMinQty, getProduct } from './shopCatalog'

const CART_KEY = 'tapna_shop_cart'

const items = ref(load())

function clampQty(productId, qty) {
  const min = getMinQty(productId)
  const n = Math.floor(Number(qty) || 0)
  if (n <= 0) return 0
  return Math.min(99, Math.max(min, n))
}

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(CART_KEY) || '[]')
    if (!Array.isArray(raw)) return []
    return raw
      .filter((row) => row && typeof row.id === 'string' && Number(row.qty) > 0)
      .filter((row) => getProduct(row.id))
      .map((row) => ({ id: row.id, qty: clampQty(row.id, row.qty) || getMinQty(row.id) }))
  } catch {
    return []
  }
}

function persist() {
  localStorage.setItem(CART_KEY, JSON.stringify(items.value))
}

export function getCartItems() {
  return items.value
}

export const cartLines = computed(() =>
  items.value
    .map((row) => {
      const product = getProduct(row.id)
      if (!product) return null
      return {
        ...product,
        qty: row.qty,
        minQty: getMinQty(row.id),
        lineTotal: product.price * row.qty,
      }
    })
    .filter(Boolean)
)

export const cartCount = computed(() =>
  items.value.reduce((sum, row) => sum + (Number(row.qty) || 0), 0)
)

export const cartSubtotal = computed(() =>
  cartLines.value.reduce((sum, line) => sum + line.lineTotal, 0)
)

export function addToCart(productId, qty) {
  const product = getProduct(productId)
  if (!product) return false
  const min = getMinQty(productId)
  const requested = qty == null ? min : Math.floor(Number(qty) || 0)
  const amount = clampQty(productId, Math.max(min, requested))
  if (!amount) return false
  const existing = items.value.find((row) => row.id === productId)
  if (existing) {
    existing.qty = clampQty(productId, existing.qty + amount)
  } else {
    items.value.push({ id: productId, qty: amount })
  }
  persist()
  return true
}

export function setCartQty(productId, qty) {
  const next = Math.floor(Number(qty) || 0)
  const idx = items.value.findIndex((row) => row.id === productId)
  if (idx < 0) return
  const min = getMinQty(productId)
  if (next <= 0 || next < min) {
    items.value.splice(idx, 1)
  } else {
    items.value[idx].qty = clampQty(productId, next)
  }
  persist()
}

export function removeFromCart(productId) {
  items.value = items.value.filter((row) => row.id !== productId)
  persist()
}

export function clearCart() {
  items.value = []
  persist()
}

export function refreshCart() {
  items.value = load()
}
