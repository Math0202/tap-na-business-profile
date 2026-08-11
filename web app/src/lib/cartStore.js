/**
 * Shopping cart - reactive, persisted in localStorage.
 */

import { computed, ref } from 'vue'
import {
  BUSINESS_CARD_ID,
  EXECUTIVE_CARD_ID,
  TEAM_PACKAGE_MIN,
  isTeamSubdomainEligible,
  validateTeamMix,
  getMinQty,
  getMaxQty,
  getProduct,
  isTeamCard
} from './shopCatalog'

const CART_KEY = 'tapna_shop_cart'
const CART_META_KEY = 'tapna_shop_cart_meta'

const items = ref(load())
const meta = ref(loadMeta())

function clampQty(productId, qty) {
  const min = getMinQty(productId)
  const n = Math.floor(Number(qty) || 0)
  if (n <= 0) return 0
  return Math.min(getMaxQty(productId), Math.max(min, n))
}

function loadMeta() {
  try {
    const raw = JSON.parse(localStorage.getItem(CART_META_KEY) || '{}')
    return {
      teamSubdomain: String(raw.teamSubdomain || '').trim()
    }
  } catch {
    return { teamSubdomain: '' }
  }
}

function persistMeta() {
  localStorage.setItem(CART_META_KEY, JSON.stringify(meta.value))
}

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(CART_KEY) || '[]')
    if (!Array.isArray(raw)) return []
    return raw
      .filter((row) => row && typeof row.id === 'string' && Number(row.qty) > 0)
      .filter((row) => getProduct(row.id))
      .map((row) => {
        const qty = clampQty(row.id, row.qty)
        return qty > 0 ? { id: row.id, qty } : null
      })
      .filter(Boolean)
  } catch {
    return []
  }
}

function persist() {
  localStorage.setItem(CART_KEY, JSON.stringify(items.value))
}

function teamQtyInCart() {
  return items.value.reduce((sum, row) => (isTeamCard(row.id) ? sum + row.qty : sum), 0)
}

export function getCartItems() {
  return items.value
}

export const cartMeta = computed(() => meta.value)

export const cartTeamSubdomain = computed(() => meta.value.teamSubdomain || '')

export const cartLines = computed(() =>
  items.value
    .map((row) => {
      const product = getProduct(row.id)
      if (!product) return null
      return {
        ...product,
        qty: row.qty,
        minQty: getMinQty(row.id),
        isTeam: isTeamCard(row.id),
        lineTotal: product.price * row.qty
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

export const cartTeamCount = computed(() => teamQtyInCart())

export function setTeamSubdomain(value) {
  const executive = items.value.find((row) => row.id === EXECUTIVE_CARD_ID)?.qty || 0
  meta.value = {
    ...meta.value,
    teamSubdomain: isTeamSubdomainEligible(executive) ? String(value || '').trim() : ''
  }
  persistMeta()
}

export function addToCart(productId, qty = 1) {
  const product = getProduct(productId)
  if (!product) return false
  if (isTeamCard(productId)) {
    // Team cards should go through setTeamPackage for mix rules.
    const amount = Math.max(0, Math.floor(Number(qty) || 0))
    if (amount <= 0) return false
    const otherId = productId === BUSINESS_CARD_ID ? EXECUTIVE_CARD_ID : BUSINESS_CARD_ID
    const other = items.value.find((row) => row.id === otherId)
    const otherQty = other?.qty || 0
    return setTeamPackage({
      businessQty: productId === BUSINESS_CARD_ID ? amount : otherQty,
      executiveQty: productId === EXECUTIVE_CARD_ID ? amount : otherQty,
      subdomain: meta.value.teamSubdomain
    })
  }
  const min = getMinQty(productId)
  const amount = clampQty(productId, Math.max(min, Math.floor(Number(qty) || min)))
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

/** Replace Connect Team mix in the cart. Total must be >= TEAM_PACKAGE_MIN. Either line may be 0. */
export function setTeamPackage({ businessQty = 0, executiveQty = 0, subdomain = '' } = {}) {
  const business = Math.min(99, Math.max(0, Math.floor(Number(businessQty) || 0)))
  const executive = Math.min(99, Math.max(0, Math.floor(Number(executiveQty) || 0)))
  const check = validateTeamMix(business, executive)
  if (!check.ok) return false

  items.value = items.value.filter((row) => !isTeamCard(row.id))
  if (business > 0) items.value.push({ id: BUSINESS_CARD_ID, qty: business })
  if (executive > 0) items.value.push({ id: EXECUTIVE_CARD_ID, qty: executive })
  persist()

  meta.value = {
    ...meta.value,
    teamSubdomain: isTeamSubdomainEligible(executive) ? String(subdomain || '').trim() : ''
  }
  persistMeta()
  return true
}

export function setCartQty(productId, qty) {
  const next = Math.floor(Number(qty) || 0)
  const idx = items.value.findIndex((row) => row.id === productId)

  if (isTeamCard(productId)) {
    const business =
      productId === BUSINESS_CARD_ID
        ? next
        : items.value.find((row) => row.id === BUSINESS_CARD_ID)?.qty || 0
    const executive =
      productId === EXECUTIVE_CARD_ID
        ? next
        : items.value.find((row) => row.id === EXECUTIVE_CARD_ID)?.qty || 0
    const total = Math.max(0, business) + Math.max(0, executive)
    if (total > 0 && total < TEAM_PACKAGE_MIN) return false
    if (total <= 0) {
      items.value = items.value.filter((row) => !isTeamCard(row.id))
      meta.value = { ...meta.value, teamSubdomain: '' }
      persist()
      persistMeta()
      return true
    }
    return setTeamPackage({
      businessQty: Math.max(0, business),
      executiveQty: Math.max(0, executive),
      subdomain: meta.value.teamSubdomain
    })
  }

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
  if (isTeamCard(productId)) {
    const remaining = items.value.filter((row) => isTeamCard(row.id) && row.id !== productId)
    const total = remaining.reduce((sum, row) => sum + row.qty, 0)
    if (total > 0 && total < TEAM_PACKAGE_MIN) {
      // Removing one side would break the package — clear both.
      items.value = items.value.filter((row) => !isTeamCard(row.id))
      meta.value = { ...meta.value, teamSubdomain: '' }
      persistMeta()
    } else {
      items.value = items.value.filter((row) => row.id !== productId)
      const executiveLeft =
        remaining.find((row) => row.id === EXECUTIVE_CARD_ID)?.qty || 0
      if (!isTeamSubdomainEligible(executiveLeft)) {
        meta.value = { ...meta.value, teamSubdomain: '' }
        persistMeta()
      }
    }
  } else {
    items.value = items.value.filter((row) => row.id !== productId)
  }
  persist()
}

export function clearCart() {
  items.value = []
  meta.value = { teamSubdomain: '' }
  persist()
  persistMeta()
}

export function refreshCart() {
  items.value = load()
  meta.value = loadMeta()
}
