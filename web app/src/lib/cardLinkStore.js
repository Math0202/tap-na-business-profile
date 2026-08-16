/**
 * Physical NFC/QR card registry — provision from admin, link to a profile via scan.
 */

import { LOCAL_ID } from './adminStore'
import { loadProfile, saveProfile, isTableBusiness } from './profileStore'
import { publicOriginForKind } from './hosts'
import { PERSONAL_CARD_IMAGES, personalCardImageSrc } from './teamRoles'

const CARDS_KEY = 'tapna_linked_cards'

/** Only two slug categories: Personal cards and Table cards. */
export const CARD_KINDS = {
  personal: { id: 'personal', label: 'Personal card', icon: 'badge' },
  table: { id: 'table', label: 'Table card', icon: 'storefront' }
}

export {
  PERSONAL_TYPES,
  PERSONAL_CARD_IMAGES,
  personalTypeLabel,
  normalizePersonalType,
  personalCardImageSrc,
  DEFAULT_PERSONAL_TYPE
} from './teamRoles'

const PRODUCT_TO_KIND = {
  blue: 'personal',
  black: 'personal',
  'table-info': 'table',
  'table-menu': 'table',
  'table-custom': 'table',
  'table-review': 'table',
  'table-wifi': 'table',
  other: 'table'
}

/** Physical card artwork by product / kind */
export const CARD_IMAGES = {
  'blue-card': PERSONAL_CARD_IMAGES.professional,
  'black-card': PERSONAL_CARD_IMAGES.business,
  'black-card-front': PERSONAL_CARD_IMAGES.executive_exclusive,
  blue: PERSONAL_CARD_IMAGES.professional,
  black: PERSONAL_CARD_IMAGES.business,
  executive_exclusive: PERSONAL_CARD_IMAGES.executive_exclusive,
  business: PERSONAL_CARD_IMAGES.business,
  professional: PERSONAL_CARD_IMAGES.professional,
  'table-info': '/images/table/NFC%20business%20info%20card.png',
  'table-menu': '/images/table/NFC%20-%20Menu.png',
  'table-review': '/images/table/NFC%20business%20review%20card.png',
  'table-wifi': '/images/table/NFC%20wifi%20and%20conact%20card.png',
  'table-custom': '/images/table/NFC%20custom%20menu%20card.png',
  personal: PERSONAL_CARD_IMAGES.business,
  table: '/images/table/NFC%20business%20info%20card.png'
}

/**
 * Resolve the NFC card product image for lists.
 * Accepts a card object, productId string, or { kind, productId, personalType }.
 */
export function cardImageSrc(cardOrOpts = {}) {
  if (typeof cardOrOpts === 'string') {
    if (CARD_IMAGES[cardOrOpts]) return CARD_IMAGES[cardOrOpts]
    return cardOrOpts === 'personal' ? CARD_IMAGES.personal : CARD_IMAGES.table
  }
  const productId = String(cardOrOpts?.productId || cardOrOpts?.product_id || '').trim()
  if (productId && CARD_IMAGES[productId]) return CARD_IMAGES[productId]
  const kind = normalizeKind(cardOrOpts?.kind || kindFromProductId(productId))
  if (kind === 'personal') {
    return personalCardImageSrc(cardOrOpts?.personalType || cardOrOpts?.personal_type || '')
  }
  return CARD_IMAGES.table
}

/** Map legacy kinds (info/menu/review/…) onto personal | table. */
export function normalizeKind(kind) {
  return kind === 'personal' ? 'personal' : 'table'
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
  return value
}

function uid(prefix) {
  return prefix + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

/** Random slug alphabet — no ambiguous 0/O/1/I; matches Worker backend. */
const SLUG_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

function randomToken(len = 6) {
  let out = ''
  for (let i = 0; i < len; i++) {
    out += SLUG_ALPHABET[Math.floor(Math.random() * SLUG_ALPHABET.length)]
  }
  return out
}

export function kindFromProductId(productId) {
  return PRODUCT_TO_KIND[productId] || 'table'
}

export function kindLabel(kind) {
  return CARD_KINDS[normalizeKind(kind)]?.label || 'Card'
}

export function kindIcon(kind) {
  return CARD_KINDS[normalizeKind(kind)]?.icon || 'nfc'
}

export function cardPublicUrl(serial, origin, { via, kind } = {}) {
  const code = String(serial || '').trim()
  const baseOrigin = origin || publicOriginForKind(kind === 'personal' ? 'personal' : 'table')
  const base = `${baseOrigin}/c/${encodeURIComponent(code)}`
  if (via === 'qr') return `${base}?via=qr`
  return base
}

export function cardQrUrl(serial, origin, { kind } = {}) {
  return cardPublicUrl(serial, origin, { via: 'qr', kind })
}

export function extractSerialFromScan(raw) {
  const text = String(raw || '').trim()
  if (!text) return ''
  try {
    const url = new URL(text)
    const m = url.pathname.match(/\/c\/([^/]+)/i)
    if (m) return decodeURIComponent(m[1])
    if (url.searchParams.get('card')) return url.searchParams.get('card')
  } catch {
    /* not a URL */
  }
  const pathMatch = text.match(/\/c\/([A-Za-z0-9_-]+)/i)
  if (pathMatch) return pathMatch[1]
  const codeMatch = text.match(/\b(TN-[A-Z0-9]+-[A-Z0-9]+)\b/i)
  if (codeMatch) return codeMatch[1]
  if (/^[A-Za-z0-9_-]{6,24}$/.test(text)) return text
  return ''
}

function normalizeCard(c) {
  const kind = normalizeKind(
    CARD_KINDS[c.kind] ? c.kind : kindFromProductId(c.productId)
  )
  const deleted = c.deleted === true
  const personalType =
    kind === 'personal'
      ? String(c.personalType || c.personal_type || 'business')
      : ''
  return {
    id: c.id || uid('card'),
    serial: String(c.serial || '').trim(),
    kind,
    personalType,
    productId: c.productId || '',
    productName: c.productName || kindLabel(kind),
    saleId: c.saleId || '',
    customerName: c.customerName || '',
    profileId: c.profileId || '',
    profileName: c.profileName || '',
    destinationUrl: c.destinationUrl || '',
    status: deleted ? 'disabled' : (c.profileId ? 'linked' : 'unlinked'),
    linkedAt: c.linkedAt || '',
    createdAt: c.createdAt || new Date().toISOString(),
    deleted,
    deletedAt: c.deletedAt || '',
    deletedBy: c.deletedBy || '',
    batchId: String(c.batchId || c.batch_id || '').trim(),
    batchName: String(c.batchName || c.batch_name || '').trim()
  }
}

export function listCards() {
  return readJson(CARDS_KEY, []).map(normalizeCard)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
}

export function getCard(serialOrId) {
  const key = String(serialOrId || '').trim()
  const lower = key.toLowerCase()
  return listCards().find((c) => c.serial.toLowerCase() === lower || c.id === serialOrId) || null
}

export function listCardsForSale(saleId) {
  return listCards().filter((c) => c.saleId === saleId)
}

export function listCardsForProfile(profileId) {
  return listCards().filter((c) => c.profileId === profileId)
}

/** Cards linked to this device profile and/or the signed-in remote account. */
export function accountProfileIds(profile = loadProfile()) {
  return [...new Set([LOCAL_ID, profile.remoteProfileId, profile.id].filter(Boolean).map(String))]
}

export function listCardsForAccount(profile = loadProfile()) {
  const ids = new Set(accountProfileIds(profile))
  const seen = new Set()
  return listCards().filter((c) => {
    if (!ids.has(String(c.profileId || ''))) return false
    const key = String(c.serial || '').toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * After login, write the server's linked cards (and their colour/tier) into local storage.
 */
export function hydrateLinkedCardsFromApi(profileId, remoteCards = []) {
  const pid = String(profileId || '').trim()
  if (!pid || !Array.isArray(remoteCards) || !remoteCards.length) return []
  const list = listCards()
  const updated = []
  for (const remote of remoteCards) {
    const serial = String(remote.slug || remote.serial || '').trim()
    if (!serial) continue
    const idx = list.findIndex((c) => c.serial.toLowerCase() === serial.toLowerCase())
    const prev = idx >= 0 ? list[idx] : {}
    const next = normalizeCard({
      ...prev,
      serial,
      kind: remote.kind || prev.kind || 'personal',
      personalType: remote.personalType || remote.personal_type || prev.personalType || '',
      productId: remote.productId || remote.product_id || prev.productId || '',
      profileId: pid,
      status: 'linked',
      linkedAt: prev.linkedAt || new Date().toISOString()
    })
    if (idx >= 0) list[idx] = next
    else list.unshift(next)
    updated.push(next)
  }
  saveAll(list)
  return updated
}

function saleLineItems(sale) {
  if (Array.isArray(sale?.lines) && sale.lines.length) {
    return sale.lines.map((line) => ({
      productId: line.productId || '',
      productName: line.productName || '',
      quantity: Math.max(0, Number(line.quantity) || 0)
    }))
  }
  return [
    {
      productId: sale?.productId || '',
      productName: sale?.productName || '',
      quantity: Math.max(0, Number(sale?.quantity) || 0)
    }
  ]
}

export function cardsNeededForSale(sale) {
  const qty = saleLineItems(sale).reduce((sum, line) => sum + line.quantity, 0)
  const existing = listCardsForSale(sale?.id).length
  return Math.max(0, qty - existing)
}

function saveAll(list) {
  writeJson(CARDS_KEY, list)
  return list
}

/** Fresh random 6-char slug (no type keywords). */
export function createCardSerial(_kind = 'table') {
  return randomToken(6)
}

function allocateUniqueSerial(existing) {
  let serial = createCardSerial()
  let guard = 0
  while (existing.has(serial) && guard < 40) {
    serial = createCardSerial()
    guard += 1
  }
  return serial
}

/**
 * Create physical card units for a sale (one serial per quantity unit, per product line).
 */
export function provisionCardsForSale(sale, { count } = {}) {
  if (!sale?.id) return []
  const lines = saleLineItems(sale)

  if (count != null) {
    const needed = Math.max(0, Number(count))
    if (needed <= 0) return listCardsForSale(sale.id)
    const first = lines[0] || {}
    return provisionSlugs({
      count: needed,
      kind: kindFromProductId(first.productId || sale.productId),
      productId: first.productId || sale.productId,
      productName: first.productName || sale.productName,
      saleId: sale.id,
      customerName: sale.customerName || ''
    })
  }

  const existing = listCardsForSale(sale.id)
  for (const line of lines) {
    if (line.quantity <= 0) continue
    const have = existing.filter((c) => c.productId === line.productId).length
    const need = Math.max(0, line.quantity - have)
    if (need <= 0) continue
    provisionSlugs({
      count: need,
      kind: kindFromProductId(line.productId),
      productId: line.productId,
      productName: line.productName,
      saleId: sale.id,
      customerName: sale.customerName || ''
    })
  }
  return listCardsForSale(sale.id)
}

/**
 * Generate blank QR/NFC slugs for stock (not tied to a sale).
 * Optionally pass remoteCards from the API to mirror server-issued slugs.
 */
export function provisionSlugs({
  count = 1,
  kind = 'table',
  personalType = '',
  productId = '',
  productName = '',
  saleId = '',
  customerName = '',
  batchId = '',
  batchName = '',
  remoteCards = null
} = {}) {
  const list = listCards()
  const used = new Set(list.map((c) => c.serial.toLowerCase()))
  const created = []
  const n = Math.min(500, Math.max(0, Number(count) || 0))

  if (Array.isArray(remoteCards) && remoteCards.length) {
    for (const remote of remoteCards) {
      const serial = String(remote.slug || remote.serial || '').trim()
      if (!serial || used.has(serial.toLowerCase())) continue
      const card = normalizeCard({
        id: remote.id,
        serial,
        kind: remote.kind || kind,
        personalType: remote.personalType || personalType || '',
        productId: productId || remote.productId || '',
        productName: productName || kindLabel(remote.kind || kind),
        saleId,
        customerName,
        batchId: remote.batchId || batchId || '',
        batchName: remote.batchName || batchName || ''
      })
      created.push(card)
      list.unshift(card)
      used.add(serial.toLowerCase())
    }
  } else {
    for (let i = 0; i < n; i++) {
      const serial = allocateUniqueSerial(used)
      used.add(serial.toLowerCase())
      const card = normalizeCard({
        serial,
        kind,
        personalType: kind === 'personal' ? personalType || 'business' : '',
        productId,
        productName: productName || kindLabel(kind),
        saleId,
        customerName,
        batchId,
        batchName
      })
      created.push(card)
      list.unshift(card)
    }
  }

  saveAll(list)
  return created
}

export function updateCard(serial, patch = {}) {
  const code = String(serial || '').trim()
  const list = listCards()
  const idx = list.findIndex((c) => c.serial.toLowerCase() === code.toLowerCase())
  if (idx < 0) return null
  const next = normalizeCard({ ...list[idx], ...patch, serial: list[idx].serial })
  list[idx] = next
  saveAll(list)
  return next
}

export function slugStats(cards = listCards()) {
  const active = cards.filter((c) => !c.deleted)
  return {
    total: active.length,
    linked: active.filter((c) => c.profileId).length,
    unlinked: active.filter((c) => !c.profileId).length,
    deleted: cards.filter((c) => c.deleted).length
  }
}

export function resolveDestinationForKind(kind, profile = loadProfile(), serial = '') {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  if (normalizeKind(kind) === 'personal') {
    const slug = String(serial || profile?.shareSlug || '').trim()
    return slug ? origin + `/c/${encodeURIComponent(slug)}` : origin + '/me'
  }
  return origin + '/business'
}

/**
 * Link a card serial to a profile (defaults to the local device profile).
 */
export function linkCardToProfile(serial, {
  profileId = LOCAL_ID,
  profileName,
  profile,
  personalType = ''
} = {}) {
  const code = String(serial || '').trim()
  if (!code) return { ok: false, error: 'Enter or scan a card code' }

  const list = listCards()
  let card = list.find((c) => c.serial.toLowerCase() === code.toLowerCase())
  const p = profile || loadProfile()
  const name =
    profileName ||
    (profileId === LOCAL_ID
      ? p.company || p.name || 'My profile'
      : profileName) ||
    'Profile'

  if (!card) {
    // Allow claiming an unknown printed serial by creating it on first link
    card = normalizeCard({
      serial: code,
      kind: isTableBusiness(p) ? 'table' : 'personal',
      personalType: personalType || '',
      productName: 'Claimed card'
    })
    list.unshift(card)
  }

  if (card.profileId && card.profileId !== profileId) {
    return {
      ok: false,
      error: `This card is already linked to ${card.profileName || 'another profile'}`,
      card
    }
  }

  // Each profile may only link one card slug
  const already = listCardsForProfile(profileId).find(
    (c) => c.serial.toLowerCase() !== code.toLowerCase()
  )
  if (already) {
    return {
      ok: false,
      error: `This profile already uses slug ${already.serial}. Each profile can only link one card.`,
      card: already
    }
  }

  const destinationUrl = resolveDestinationForKind(card.kind, p, code)
  const next = normalizeCard({
    ...card,
    personalType: personalType || card.personalType || '',
    profileId,
    profileName: name,
    destinationUrl,
    linkedAt: new Date().toISOString(),
    status: 'linked'
  })

  const idx = list.findIndex((c) => c.serial === next.serial)
  if (idx >= 0) list[idx] = next
  else list.unshift(next)
  saveAll(list)

  // Remember this slug as the profile's public share link
  try {
    if (profileId === LOCAL_ID) {
      const current = loadProfile()
      if (!current.shareSlug) {
        saveProfile({ shareSlug: next.serial })
      }
    }
  } catch {
    /* ignore */
  }

  return { ok: true, card: next }
}

export function unlinkCard(serial) {
  const list = listCards()
  const idx = list.findIndex((c) => c.serial.toLowerCase() === String(serial || '').trim().toLowerCase())
  if (idx < 0) return null
  list[idx] = normalizeCard({
    ...list[idx],
    profileId: '',
    profileName: '',
    destinationUrl: '',
    linkedAt: '',
    status: 'unlinked'
  })
  saveAll(list)
  return list[idx]
}

export function deleteCard(serial) {
  const code = String(serial || '').trim().toLowerCase()
  const list = listCards()
  const idx = list.findIndex((c) => c.serial.toLowerCase() === code)
  if (idx < 0) return null
  list[idx] = {
    ...list[idx],
    deleted: true,
    deletedAt: new Date().toISOString(),
    status: 'disabled'
  }
  saveAll(list)
  return list[idx]
}

export function restoreCard(serial) {
  const code = String(serial || '').trim().toLowerCase()
  const list = listCards()
  const idx = list.findIndex((c) => c.serial.toLowerCase() === code)
  if (idx < 0) return null
  list[idx] = {
    ...list[idx],
    deleted: false,
    deletedAt: '',
    deletedBy: '',
    status: list[idx].profileId ? 'linked' : 'unlinked'
  }
  saveAll(list)
  return list[idx]
}

export function assignSaleCardsToProfile(saleId, profileOpts) {
  const cards = listCardsForSale(saleId)
  const existing = listCardsForProfile(profileOpts?.profileId || LOCAL_ID)
  if (existing.length) {
    return [{
      ok: false,
      error: `This profile already uses slug ${existing[0].serial}. Each profile can only link one card.`
    }]
  }
  if (!cards.length) return []
  // One profile ↔ one card: only link the first unit from the sale
  return [linkCardToProfile(cards[0].serial, profileOpts)]
}

export function getCardTapAction(serial) {
  const card = getCard(serial)
  if (!card || card.deleted) {
    return { ok: false, status: 'missing', message: 'Unknown card code' }
  }
  if (!card.profileId) {
    return {
      ok: false,
      status: 'unlinked',
      message: 'This card is not linked to a profile yet',
      card
    }
  }
  let url = card.destinationUrl
  if (!url) {
    const p = loadProfile()
    url = resolveDestinationForKind(card.kind, p)
  }
  return { ok: true, status: 'linked', card, url }
}

export function summarizeCardsByKind(cards) {
  const map = {}
  for (const c of cards) {
    const k = normalizeKind(c.kind)
    if (!map[k]) map[k] = { kind: k, label: kindLabel(k), total: 0, linked: 0 }
    map[k].total += 1
    if (c.profileId) map[k].linked += 1
  }
  return Object.values(map)
}

/**
 * Best slug to share for a profile.
 * Prefer matching category (personal vs table), else any linked card.
 */
export function preferredShareSlug(profileId, { cardType } = {}) {
  const cards = listCardsForProfile(profileId).filter((c) => c.profileId && c.serial)
  if (!cards.length) return ''
  const want = cardType === 'table' ? 'table' : 'personal'
  const hit = cards.find((c) => normalizeKind(c.kind) === want)
  if (hit) return hit.serial
  return cards[0].serial
}

/**
 * All slugs associated with an admin directory entry (or any profile-like object).
 * Matches by entry id, local device id, remoteProfileId, and shareSlug.
 */
export function listCardsForAdminEntry(entry) {
  if (!entry) return []
  const ids = new Set()
  if (entry.id) ids.add(String(entry.id))
  if (entry.remoteProfileId) ids.add(String(entry.remoteProfileId))
  if (entry.local || entry.id === LOCAL_ID) ids.add(LOCAL_ID)

  const seen = new Set()
  const out = []

  for (const c of listCards()) {
    if (!c.serial) continue
    const key = c.serial.toLowerCase()
    if (seen.has(key)) continue
    if (c.profileId && ids.has(String(c.profileId))) {
      seen.add(key)
      out.push(c)
    }
  }

  const share = String(entry.shareSlug || '').trim()
  if (share && !seen.has(share.toLowerCase())) {
    const card = getCard(share)
    if (card) {
      out.unshift(card)
    } else {
      out.unshift({
        serial: share,
        kind: entry.cardType === 'table' ? 'table' : 'personal',
        profileId: entry.id || '',
        profileName: entry.name || entry.company || '',
        status: 'linked'
      })
    }
  }

  return out
}

/** Primary share slug for an admin/profile entry. */
export function primarySlugForEntry(entry) {
  if (!entry) return ''
  const share = String(entry.shareSlug || '').trim()
  if (share) return share
  const cards = listCardsForAdminEntry(entry)
  if (!cards.length) return ''
  return (
    preferredShareSlug(entry.id, { cardType: entry.cardType }) ||
    preferredShareSlug(LOCAL_ID, { cardType: entry.cardType }) ||
    cards[0].serial ||
    ''
  )
}
