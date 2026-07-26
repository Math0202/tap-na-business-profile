/**
 * Shopping cart - reactive, persisted in localStorage.
 */

import { computed, ref } from 'vue'
import { getProduct } from './shopCatalog'

const CART_KEY = 'tapna_shop_cart'

const items = ref(load())

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(CART_KEY) || '[]')
    if (!Array.isArray(raw)) return []
    return raw
      .filter((row) => row && typeof row.id === 'string' && Number(row.qty) > 0)
      .filter((row) => getProduct(row.id))
      .map((row) => ({ id: row.id, qty: Math.min(99, Math.max(1, Math.floor(Number(row.qty) || 1))) }))
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

export function addToCart(productId, qty = 1) {
  const product = getProduct(productId)
  if (!product) return false
  const amount = Math.min(99, Math.max(1, Math.floor(Number(qty) || 1)))
  const existing = items.value.find((row) => row.id === productId)
  if (existing) {
    existing.qty = Math.min(99, existing.qty + amount)
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
  if (next <= 0) {
    items.value.splice(idx, 1)
  } else {
    items.value[idx].qty = Math.min(99, next)
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
