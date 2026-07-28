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

/** Fold long vCard lines (RFC 2425) so phonebooks accept PHOTO payloads. */
function foldVcardLine(line) {
  const s = String(line || '')
  if (s.length <= 75) return s
  let out = s.slice(0, 75)
  let rest = s.slice(75)
  while (rest.length) {
    out += '\r\n ' + rest.slice(0, 74)
    rest = rest.slice(74)
  }
  return out
}

function mimeToVcardType(mime) {
  const m = String(mime || '').toLowerCase()
  if (m.includes('png')) return 'PNG'
  if (m.includes('gif')) return 'GIF'
  if (m.includes('webp')) return 'JPEG'
  return 'JPEG'
}

/**
 * Build a vCard 3.0 PHOTO line from an image URL or data URL.
 * Embeds base64 so the contact photo survives offline import into phonebooks.
 * Returns '' if the image cannot be loaded.
 */
export async function vcardPhotoLine(imageUrl, origin) {
  const raw = String(imageUrl || '').trim()
  if (!raw || raw.startsWith('data:image/svg')) return ''

  try {
    let mime = 'image/jpeg'
    let base64 = ''

    if (raw.startsWith('data:')) {
      const match = raw.match(/^data:([^;]+);base64,(.+)$/i)
      if (!match) return ''
      mime = match[1] || mime
      base64 = match[2]
    } else {
      const url = absoluteUrl(raw, origin)
      if (!url || !/^https?:\/\//i.test(url)) return ''
      const res = await fetch(url, { mode: 'cors' })
      if (!res.ok) return ''
      const blob = await res.blob()
      if (!blob.type.startsWith('image/') || blob.size < 32 || blob.size > 2.5 * 1024 * 1024) {
        return ''
      }
      mime = blob.type || mime
      base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const dataUrl = String(reader.result || '')
          const comma = dataUrl.indexOf(',')
          resolve(comma >= 0 ? dataUrl.slice(comma + 1) : '')
        }
        reader.onerror = () => reject(new Error('read failed'))
        reader.readAsDataURL(blob)
      })
    }

    if (!base64) return ''
    const type = mimeToVcardType(mime)
    return foldVcardLine(`PHOTO;ENCODING=b;TYPE=${type}:${base64}`)
  } catch {
    return ''
  }
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
