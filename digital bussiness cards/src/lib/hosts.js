/**
 * Public hosts for tap-na.
 * Public cards / shop stay on https://tapnam.com.
 * Staff admin + sales live on https://admin.tapnam.com.
 */

export const TABLE_ORIGIN = 'https://tapnam.com'
export const PERSONAL_ORIGIN = 'https://tapnam.com'
/** Staff dashboard (admin + sales) origin */
export const ADMIN_ORIGIN = 'https://admin.tapnam.com'

export const LEGACY_TABLE_ORIGIN = 'https://redirct.link'
export const LEGACY_PERSONAL_ORIGIN = 'https://redirct.link'

export function currentHostname() {
  return typeof window !== 'undefined' ? String(window.location.hostname || '').toLowerCase() : ''
}

export function isLocalHost(hostname = currentHostname()) {
  return hostname === 'localhost' || hostname === '127.0.0.1'
}

export function isAdminHost(hostname = currentHostname()) {
  return String(hostname || '').toLowerCase() === 'admin.tapnam.com'
}

export function isAppHost(hostname = currentHostname()) {
  return /(^|\.)(tapnam\.com|redirct\.link)$/i.test(String(hostname || ''))
}

/**
 * Worker API origin. admin.tapnam.com is a static SPA — /api lives on tapnam.com.
 * Same-origin empty base only on the public apex (and legacy card hosts).
 */
export function apiBaseUrl(hostname = currentHostname()) {
  const host = String(hostname || '').toLowerCase()
  if (!host || isAdminHost(host) || isLocalHost(host)) return TABLE_ORIGIN
  if (host === 'tapnam.com' || host === 'www.tapnam.com') return ''
  if (host === 'redirct.link' || host === 'www.redirct.link') return ''
  return TABLE_ORIGIN
}

/** Absolute staff URL on the admin subdomain (path must start with /). */
export function adminAppUrl(path = '/admin') {
  const p = String(path || '/admin')
  return ADMIN_ORIGIN + (p.startsWith('/') ? p : `/${p}`)
}

/** Owner login URL on the public apex (staff use admin.tapnam.com/login). */
export function publicLoginUrl(next = '') {
  const raw = String(next || '').trim()
  const safe =
    raw &&
    raw.startsWith('/') &&
    !raw.startsWith('//') &&
    raw !== '/login' &&
    raw !== '/shop/login' &&
    raw !== '/admin/login'
      ? raw
      : ''
  const q = safe ? `?next=${encodeURIComponent(safe)}` : ''
  if (typeof window !== 'undefined' && isLocalHost()) return `/login${q}`
  return `${TABLE_ORIGIN}/login${q}`
}

/** @deprecated Subdomains are no longer used for cards — always false. */
export function isPersonalHost(_hostname = currentHostname()) {
  return false
}

/** Brand origins — both card kinds use the same apex. */
export function brandOrigins(hostname = currentHostname()) {
  const host = String(hostname || '').toLowerCase()
  if (host.endsWith('redirct.link')) {
    // Legacy host still resolves, but shares prefer tapnam.com
    return { table: TABLE_ORIGIN, personal: PERSONAL_ORIGIN }
  }
  return { table: TABLE_ORIGIN, personal: PERSONAL_ORIGIN }
}

/**
 * Canonical public origin for any card kind.
 * Localhost keeps the current origin so local QR tests still work.
 */
export function publicOriginForKind(_kind) {
  if (typeof window !== 'undefined' && isLocalHost()) {
    return window.location.origin
  }
  return TABLE_ORIGIN
}

export function publicOriginForCardType(cardType) {
  return publicOriginForKind(cardType === 'personal' ? 'personal' : 'table')
}

