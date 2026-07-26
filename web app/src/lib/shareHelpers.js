/**
 * Shared helpers for public profile pages.
 */

import { publicOriginForCardType } from './hosts'

export function youtubeEmbedUrl(value) {
  const raw = String(value || '').trim()
  let id = ''
  const watch = raw.match(/[?&]v=([\w-]{6,})/)
  const short = raw.match(/youtu\.be\/([\w-]{6,})/)
  const embed = raw.match(/youtube\.com\/embed\/([\w-]{6,})/)
  const shorts = raw.match(/youtube\.com\/shorts\/([\w-]{6,})/)
  if (watch) id = watch[1]
  else if (short) id = short[1]
  else if (embed) id = embed[1]
  else if (shorts) id = shorts[1]
  return id ? 'https://www.youtube.com/embed/' + id : ''
}

export function downloadVcard(filename, lines) {
  const vcard = lines.filter(Boolean).join('\r\n')
  const blob = new Blob([vcard], { type: 'text/vcard;charset=utf-8' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)
}

export function pageUrl() {
  return window.location.href.split('#')[0]
}

/** Absolute share URL that always includes the card slug. */
export function profileShareUrl(slug, origin, { cardType = 'personal' } = {}) {
  const code = String(slug || '').trim()
  const base = origin || publicOriginForCardType(cardType)
  if (!code) return base || pageUrl()
  return `${base}/c/${encodeURIComponent(code)}`
}

/** Absolute URL for OG images / public assets. */
export function absoluteUrl(pathOrUrl, origin = typeof window !== 'undefined' ? window.location.origin : '') {
  const raw = String(pathOrUrl || '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  if (raw.startsWith('data:')) return raw
  if (raw.startsWith('/')) return `${origin}${raw}`
  return `${origin}/${raw}`
}
