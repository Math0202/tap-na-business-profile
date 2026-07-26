/** Public hosts for the two card categories. */
export const TABLE_ORIGIN = 'https://redirct.link'
export const PERSONAL_ORIGIN = 'https://cards.redirct.link'

export function currentHostname() {
  return typeof window !== 'undefined' ? String(window.location.hostname || '').toLowerCase() : ''
}

export function isLocalHost(hostname = currentHostname()) {
  return hostname === 'localhost' || hostname === '127.0.0.1'
}

/** True when the app is served from the personal-cards subdomain. */
export function isPersonalHost(hostname = currentHostname()) {
  return hostname === 'cards.redirct.link' || hostname.startsWith('cards.')
}

/**
 * Canonical public origin for a card kind / profile type.
 * Localhost keeps the current origin so local QR tests still work.
 */
export function publicOriginForKind(kind) {
  if (typeof window !== 'undefined' && isLocalHost()) {
    return window.location.origin
  }
  return kind === 'personal' ? PERSONAL_ORIGIN : TABLE_ORIGIN
}

export function publicOriginForCardType(cardType) {
  return publicOriginForKind(cardType === 'personal' ? 'personal' : 'table')
}
