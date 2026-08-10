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

/** Business + Executive are team packs — minimum order quantity. */
export const TEAM_CARD_IDS = new Set(['black-card', 'black-card-front'])

export function isTeamCard(productId) {
  return TEAM_CARD_IDS.has(String(productId || ''))
}

export function getMinQty(productId) {
  return isTeamCard(productId) ? 5 : 1
}

export function businessCards() {
  return loadShopCatalog().filter((p) => p.section === 'business-cards')
}

/** Professional / individual Connect cards (min 1). */
export function connectSoloCards() {
  return businessCards().filter((p) => !isTeamCard(p.id))
}

/** Business + Executive team packs (min 5). */
export function connectTeamCards() {
  return businessCards().filter((p) => isTeamCard(p.id))
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
