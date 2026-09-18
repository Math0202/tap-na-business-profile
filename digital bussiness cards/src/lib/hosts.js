/**
 * Public hosts for tap-na.
 * Everything lives on https://tapnam.com (no card-type subdomains).
 * Legacy redirct.link / cards.* hosts redirect to tapnam.com in the Worker.
 */

export const TABLE_ORIGIN = 'https://tapnam.com'
export const PERSONAL_ORIGIN = 'https://tapnam.com'

export const LEGACY_TABLE_ORIGIN = 'https://redirct.link'
export const LEGACY_PERSONAL_ORIGIN = 'https://redirct.link'

export function currentHostname() {
  return typeof window !== 'undefined' ? String(window.location.hostname || '').toLowerCase() : ''
}

export function isLocalHost(hostname = currentHostname()) {
  return hostname === 'localhost' || hostname === '127.0.0.1'
}

export function isAppHost(hostname = currentHostname()) {
  return /(^|\.)(tapnam\.com|redirct\.link)$/i.test(String(hostname || ''))
}

/** @deprecated Subdomains are no longer used — always false. */
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
