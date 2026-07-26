/**
 * Shop catalog — defaults + local admin overrides (localStorage).
 */

const OVERRIDES_KEY = 'tapna_shop_catalog'

export const SHOP_SECTIONS = [
  { id: 'business-cards', label: 'Business cards' },
  { id: 'table-brochure', label: 'Table / venue' }
]

export const DEFAULT_SHOP_PRODUCTS = [
  {
    id: 'blue-card',
    name: 'Blue Business Card',
    price: 49.99,
    desc: 'Premium NFC business card in cobalt blue.',
    image: '/images/blue-card.png',
    alt: 'Blue NFC business card',
    section: 'business-cards',
    label: 'Cobalt Blue',
    active: true
  },
  {
    id: 'black-card',
    name: 'Black Business Card',
    price: 49.99,
    desc: 'Premium NFC business card in matte black.',
    image: '/images/black-card.png',
    alt: 'Black NFC business card',
    section: 'business-cards',
    label: 'Matte Black',
    active: true
  },
  {
    id: 'black-card-front',
    name: 'Black Card Front',
    price: 49.99,
    desc: 'Matte black NFC business card — front design.',
    image: '/images/business-card-black-front.png',
    alt: 'Black NFC business card front',
    section: 'business-cards',
    label: 'Black Front',
    active: true
  },
  {
    id: 'standard-menu',
    name: 'Standard Menu',
    price: 34.99,
    desc: 'Tap phone to view menu — for restaurants & cafes.',
    image: '/images/table/NFC%20-%20Menu.png',
    alt: 'Standard Menu ',
    section: 'table-brochure',
    badge: 'Best Seller',
    active: true
  },
  {
    id: 'custom-menu',
    name: 'Custom Menu',
    price: 39.99,
    desc: 'Branded custom menu design for your venue.',
    image: '/images/table/NFC%20custom%20menu%20card.png',
    alt: 'Custom Menu ',
    section: 'table-brochure',
    active: true
  },
  {
    id: 'info-card',
    name: 'Tap for Information',
    price: 24.99,
    desc: 'Share business info, contact & socials in one tap.',
    image: '/images/table/NFC%20business%20info%20card.png',
    alt: 'Business Information ',
    section: 'table-brochure',
    active: true
  },
  {
    id: 'review-google',
    name: 'Review us on Google',
    price: 29.99,
    desc: 'Tap to leave a Google review in seconds.',
    image: '/images/table/NFC%20business%20review%20card.png',
    alt: 'Google Review ',
    section: 'table-brochure',
    active: true
  },
  {
    id: 'wifi-connect',
    name: 'Tap to Connect WiFi',
    price: 29.99,
    desc: 'Guests connect to WiFi and contact details instantly.',
    image: '/images/table/NFC%20wifi%20and%20conact%20card.png',
    alt: 'WiFi and Contact ',
    section: 'table-brochure',
    active: true
  }
]

/** @deprecated use DEFAULT_SHOP_PRODUCTS — kept for older imports */
export const SHOP_PRODUCTS = DEFAULT_SHOP_PRODUCTS

function readOverrides() {
  try {
    const raw = localStorage.getItem(OVERRIDES_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function writeOverrides(list) {
  localStorage.setItem(OVERRIDES_KEY, JSON.stringify(list))
}

function normalizeProduct(p = {}) {
  return {
    id: String(p.id || '').trim() || ('prod-' + Math.random().toString(36).slice(2, 8)),
    name: String(p.name || '').trim() || 'Untitled product',
    price: Number(p.price) || 0,
    desc: String(p.desc || '').trim(),
    image: String(p.image || '').trim(),
    alt: String(p.alt || p.name || '').trim(),
    section: p.section === 'table-brochure' ? 'table-brochure' : 'business-cards',
    label: String(p.label || '').trim(),
    badge: String(p.badge || '').trim(),
    active: p.active !== false
  }
}

/** Full catalog for admin (includes inactive). */
export function listShopProducts({ includeInactive = true } = {}) {
  const overrides = readOverrides()
  const list = (overrides || DEFAULT_SHOP_PRODUCTS).map(normalizeProduct)
  if (includeInactive) return list
  return list.filter((p) => p.active)
}

/** Public storefront catalog (active only). */
export function loadShopCatalog() {
  return listShopProducts({ includeInactive: false })
}

export function saveShopProduct(payload) {
  const list = listShopProducts({ includeInactive: true })
  const next = normalizeProduct(payload)
  const idx = list.findIndex((p) => p.id === next.id)
  if (idx >= 0) list[idx] = { ...list[idx], ...next }
  else list.push(next)
  writeOverrides(list)
  return next
}

export function deleteShopProduct(id) {
  const list = listShopProducts({ includeInactive: true }).filter((p) => p.id !== id)
  writeOverrides(list)
  return list
}

export function setShopProductActive(id, active) {
  const list = listShopProducts({ includeInactive: true })
  const row = list.find((p) => p.id === id)
  if (!row) return null
  row.active = !!active
  writeOverrides(list)
  return row
}

export function resetShopCatalog() {
  localStorage.removeItem(OVERRIDES_KEY)
  return listShopProducts({ includeInactive: true })
}

export function formatPrice(amount) {
  const n = Number(amount) || 0
  return '$' + n.toFixed(2)
}

export function getProduct(id) {
  return listShopProducts({ includeInactive: true }).find((p) => p.id === id) || null
}

export function businessCards() {
  return loadShopCatalog().filter((p) => p.section === 'business-cards')
}

export function tableBrochures() {
  return loadShopCatalog().filter((p) => p.section === 'table-brochure')
}

export function productsBySection(section) {
  return loadShopCatalog().filter((p) => p.section === section)
}

/** Compat aliases used by HomeView / CartView */
export function loadShopProducts() {
  return loadShopCatalog()
}

export function businessCardsList() {
  return businessCards()
}

export function tableBrochuresList() {
  return tableBrochures()
}
