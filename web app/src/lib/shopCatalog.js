/**
 * Shop catalog — public storefront view of sales products (Supabase).
 * Source of truth: sales_products via Worker API / salesStore cache.
 */

import {
  listProducts,
  saveProduct as saveSalesProduct,
  deleteProduct as deleteSalesProduct,
  restoreProduct as restoreSalesProduct,
  getProduct as getSalesProduct,
  refreshProductsFromApi,
  resetProductsToDefaults
} from './salesStore'

export const SHOP_SECTIONS = [
  { id: 'business-cards', label: 'Business cards' },
  { id: 'table-brochure', label: 'Table / venue' }
]

/** @deprecated no seeded shop products */
export const DEFAULT_SHOP_PRODUCTS = []

/** @deprecated use listShopProducts() */
export const SHOP_PRODUCTS = DEFAULT_SHOP_PRODUCTS

function categoryToSection(category) {
  return category === 'table' ? 'table-brochure' : 'business-cards'
}

function sectionToCategory(section) {
  return section === 'table-brochure' ? 'table' : 'personal'
}

function salesToShop(p) {
  const images = Array.isArray(p.images) ? p.images.filter(Boolean) : []
  const image = images[0] || ''
  return {
    id: p.id,
    name: p.name || 'Untitled product',
    price: Number(p.defaultPrice) || 0,
    desc: String(p.description || '').trim(),
    image,
    images,
    video: p.video || '',
    alt: p.name || '',
    section: categoryToSection(p.category),
    label: String(p.label || '').trim(),
    badge: String(p.badge || '').trim(),
    active: p.active !== false,
    category: p.category,
    deleted: p.deleted === true,
    deletedAt: p.deletedAt || '',
    deletedBy: p.deletedBy || ''
  }
}

function shopToSales(payload, existing) {
  const image = String(payload.image || '').trim()
  let images = Array.isArray(payload.images)
    ? payload.images.filter((src) => typeof src === 'string' && src.trim())
    : existing?.images
      ? [...existing.images]
      : []
  if (image) {
    images = [image, ...images.filter((src) => src !== image)]
  }
  return {
    id: payload.id,
    name: payload.name,
    defaultPrice: Number(payload.price) || 0,
    category: payload.category || sectionToCategory(payload.section),
    active: payload.active !== false,
    description: payload.desc || payload.description || '',
    images,
    video: payload.video || existing?.video || '',
    label: String(payload.label || '').trim(),
    badge: String(payload.badge || '').trim()
  }
}

/** Full catalog for admin (includes inactive). Sync after refreshProducts(). */
export function listShopProducts({ includeInactive = true, includeDeleted = false } = {}) {
  const list = listProducts({ includeDeleted: true }).map(salesToShop)
  return list.filter((p) => {
    if (!includeDeleted && p.deleted) return false
    if (!includeInactive && !p.active) return false
    return true
  })
}

/** Fetch latest products from DB into local cache. */
export async function refreshProducts({ includeInactive = true, includeDeleted = false } = {}) {
  await refreshProductsFromApi({ includeInactive: true })
  return listShopProducts({ includeInactive, includeDeleted })
}

/** Public storefront catalog (active only). */
export function loadShopCatalog() {
  return listShopProducts({ includeInactive: false })
}

export async function saveShopProduct(payload) {
  const existing = payload.id ? getSalesProduct(payload.id) : null
  const next = await saveSalesProduct(shopToSales(payload, existing))
  return salesToShop(next)
}

export async function deleteShopProduct(id) {
  await deleteSalesProduct(id)
  return listShopProducts({ includeInactive: true, includeDeleted: true })
}

export async function restoreShopProduct(id) {
  await restoreSalesProduct(id)
  return listShopProducts({ includeInactive: true, includeDeleted: true })
}

export async function setShopProductActive(id, active) {
  const existing = getSalesProduct(id)
  if (!existing) return null
  const next = await saveSalesProduct({ ...existing, active: !!active })
  return salesToShop(next)
}

export async function resetShopCatalog() {
  resetProductsToDefaults()
  await refreshProductsFromApi({ includeInactive: true })
  return listShopProducts({ includeInactive: true })
}

export function formatPrice(amount) {
  const n = Number(amount) || 0
  return (
    'N$ ' +
    n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  )
}

export function getProduct(id) {
  return listShopProducts({ includeInactive: true }).find((p) => p.id === id) || null
}

/** Business + Executive form one Connect Team package (mix allowed). */
export const BUSINESS_CARD_ID = 'black-card'
export const EXECUTIVE_CARD_ID = 'black-card-front'
export const TEAM_CARD_IDS = new Set([BUSINESS_CARD_ID, EXECUTIVE_CARD_ID])
export const TEAM_PACKAGE_MIN = 5
/** Business alone (0 Executive) cannot exceed this. */
export const TEAM_BUSINESS_ALONE_MAX = 10
/** Total size at which Executive cards become required to scale further. */
export const TEAM_SCALE_THRESHOLD = 10
/** Executive cards required to unlock optional custom subdomain. */
export const TEAM_EXEC_SUBDOMAIN_MIN = 5
/** Executive cards required to scale a team past TEAM_SCALE_THRESHOLD. */
export const TEAM_EXEC_SCALE_MIN = 5
/** @deprecated use TEAM_EXEC_SUBDOMAIN_MIN / isTeamSubdomainEligible */
export const TEAM_SUBDOMAIN_THRESHOLD = TEAM_EXEC_SUBDOMAIN_MIN

export function isTeamCard(productId) {
  return TEAM_CARD_IDS.has(String(productId || ''))
}

/**
 * Min Executive cards for a team total.
 * <=10: 0 required (Business alone allowed up to 10).
 * >10: need TEAM_EXEC_SCALE_MIN Executive cards in the mix.
 */
export function minExecutiveForTeamTotal(total) {
  const t = Math.max(0, Math.floor(Number(total) || 0))
  if (t <= TEAM_SCALE_THRESHOLD) return 0
  return TEAM_EXEC_SCALE_MIN
}

export function isTeamSubdomainEligible(executiveQty) {
  return Math.max(0, Math.floor(Number(executiveQty) || 0)) >= TEAM_EXEC_SUBDOMAIN_MIN
}

/** Validate a Business + Executive mix. Returns { ok, error }. */
export function validateTeamMix(businessQty, executiveQty) {
  const business = Math.max(0, Math.floor(Number(businessQty) || 0))
  const executive = Math.max(0, Math.floor(Number(executiveQty) || 0))
  const total = business + executive
  if (total < TEAM_PACKAGE_MIN) {
    return {
      ok: false,
      error: `Team packages need at least ${TEAM_PACKAGE_MIN} cards total.`
    }
  }
  if (executive === 0 && business > TEAM_BUSINESS_ALONE_MAX) {
    return {
      ok: false,
      error: `Business Class alone is limited to ${TEAM_BUSINESS_ALONE_MAX} cards. Add Executive cards to go beyond 10.`
    }
  }
  const needed = minExecutiveForTeamTotal(total)
  if (executive < needed) {
    return {
      ok: false,
      error: `Teams over ${TEAM_SCALE_THRESHOLD} need at least ${needed} Executive cards (you have ${executive}).`
    }
  }
  return { ok: true, error: '', total, business, executive, needed }
}

/** Per-line min. Team lines may be 0 inside a mix; package total is enforced separately. */
export function getMinQty(productId) {
  return isTeamCard(productId) ? 0 : 1
}

export function initialTeamMix(focusId) {
  const focus = String(focusId || '')
  if (focus === EXECUTIVE_CARD_ID) {
    return { businessQty: 3, executiveQty: 2 }
  }
  // Default / Business focus → 2 Business : 3 Executive
  return { businessQty: 2, executiveQty: 3 }
}

export function businessCards() {
  return loadShopCatalog().filter((p) => p.section === 'business-cards')
}

/** Professional / individual Connect cards (min 1, unlimited). */
export function connectSoloCards() {
  return businessCards().filter((p) => !isTeamCard(p.id))
}

/** Business + Executive team cards (combined package, min 5 total). */
export function connectTeamCards() {
  const list = businessCards().filter((p) => isTeamCard(p.id))
  const order = [BUSINESS_CARD_ID, EXECUTIVE_CARD_ID]
  return [...list].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
}

export function tableBrochures() {
  return loadShopCatalog().filter((p) => p.section === 'table-brochure')
}

export function productsBySection(section) {
  return loadShopCatalog().filter((p) => p.section === section)
}

/** Compat aliases used by HomeView / CartView */
export async function loadShopProducts() {
  await refreshProducts({ includeInactive: false })
  return loadShopCatalog()
}

export function businessCardsList() {
  return businessCards()
}

export function tableBrochuresList() {
  return tableBrochures()
}
