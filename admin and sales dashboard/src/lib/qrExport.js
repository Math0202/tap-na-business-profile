/**
 * Build printable QR PNGs for admin Card IDs export / card backs.
 * - No contact details: encodes CardTap URL (?via=qr) on tapnam.com, centre label = slug
 * - With contact details: encodes vCard (name, company, phone, email, profile URL),
 *   no centre overlay (keeps dense vCards scannable when printed); filename/caption = first name
 */

import QRCode from 'qrcode'
import JSZip from 'jszip'
import { cardQrUrl } from './cardLinkStore'
import { buildShareVcardPayload, profileShareUrl } from './shareHelpers'
import { publicOriginForCardType } from './hosts'

const QR_SIZE = 512
const PAD = 28
const CAPTION_H = 64
const FONT = '700 30px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'

export function firstNameFromFullName(fullName) {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  return parts[0] || ''
}

export function cardHasContactDetails(card = {}) {
  return Boolean(
    String(card.contactName || card.contact_name || card.name || '').trim() ||
      String(card.contactCompany || card.contact_company || card.company || '').trim() ||
      String(card.contactPhone || card.contact_phone || card.phone || '').trim() ||
      String(card.contactEmail || card.contact_email || card.email || '').trim()
  )
}

function contactFieldsFromCard(card = {}) {
  return {
    name: String(card.contactName || card.contact_name || card.name || '').trim(),
    company: String(card.contactCompany || card.contact_company || card.company || '').trim(),
    phone: String(card.contactPhone || card.contact_phone || card.phone || '').trim(),
    email: String(card.contactEmail || card.contact_email || card.email || '').trim(),
    title: String(card.contactTitle || card.contact_title || card.title || '').trim()
  }
}

function resolvePublicOrigin(kind, origin) {
  if (origin) return origin
  return publicOriginForCardType(kind === 'table' ? 'table' : 'personal')
}

/** Payload for a slug QR: vCard when contact details exist, otherwise CardTap URL on public apex. */
export function cardQrPayload(card = {}, { origin } = {}) {
  const slug = String(card.serial || card.slug || '').trim()
  const kind = card.kind
  const publicOrigin = resolvePublicOrigin(kind, origin)
  const contact = contactFieldsFromCard(card)
  if (contact.name || contact.company || contact.phone || contact.email) {
    const profileUrl =
      String(card.profileUrl || '').trim() ||
      (slug ? profileShareUrl(slug, publicOrigin, { cardType: kind === 'table' ? 'table' : 'personal' }) : '')
    return buildShareVcardPayload({
      ...contact,
      profileUrl
    })
  }
  if (!slug) return ''
  return cardQrUrl(slug, publicOrigin, { kind })
}

/** Centre label / download basename preference: first name, else slug. */
export function cardQrLabel(card = {}) {
  const slug = String(card.serial || card.slug || '').trim()
  const first = firstNameFromFullName(contactFieldsFromCard(card).name)
  return first || slug || 'slug'
}

function safeFileName(label) {
  return String(label || 'slug').replace(/[^\w.-]+/g, '_').replace(/_+/g, '_').slice(0, 64) + '.png'
}

function triggerDownload(blob, filename) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

function drawCenterLabel(ctx, label, canvasW, canvasH) {
  const cx = canvasW / 2
  const cy = canvasH / 2
  ctx.font = FONT
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const textW = ctx.measureText(label).width
  const plateW = Math.min(QR_SIZE * 0.62, textW + 36)
  const plateH = 56
  const r = 14
  const x = cx - plateW / 2
  const y = cy - plateH / 2

  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + plateW, y, x + plateW, y + plateH, r)
  ctx.arcTo(x + plateW, y + plateH, x, y + plateH, r)
  ctx.arcTo(x, y + plateH, x, y, r)
  ctx.arcTo(x, y, x + plateW, y, r)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = '#0a0a0a'
  ctx.fillText(label, cx, cy + 1, plateW - 20)
}

function drawCaption(ctx, label, canvasW, qrBottom) {
  ctx.font = FONT
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#0a0a0a'
  ctx.fillText(label, canvasW / 2, qrBottom + CAPTION_H / 2, canvasW - PAD * 2)
}

/**
 * @param {string|{ serial?: string, slug?: string, kind?: string, contactName?: string }} cardOrSlug
 * @param {{ origin?: string, kind?: string, forPrint?: boolean }} opts
 *   forPrint: true for physical card backs — never overlay text on vCard modules
 * @returns {Promise<Blob>}
 */
export async function buildLabeledQrPng(cardOrSlug, { origin, kind, forPrint = false } = {}) {
  const card =
    typeof cardOrSlug === 'string'
      ? { serial: cardOrSlug, kind }
      : { ...(cardOrSlug || {}), kind: cardOrSlug?.kind || kind }

  const slug = String(card.serial || card.slug || '').trim()
  if (!slug) throw new Error('Missing slug')

  const payload = cardQrPayload(card, { origin })
  if (!payload) throw new Error('Missing QR payload')

  const label = cardQrLabel(card)
  const hasContact = cardHasContactDetails(card)
  // URL QRs use H + centre slug plate. Contact vCards stay clean for print scanning.
  const ec = hasContact ? 'M' : 'H'
  const withCenterLabel = !hasContact
  const withCaption = hasContact && !forPrint

  const qrDataUrl = await QRCode.toDataURL(payload, {
    width: QR_SIZE,
    margin: 2,
    errorCorrectionLevel: ec,
    color: { dark: '#0a0a0a', light: '#ffffff' }
  })

  const canvas = document.createElement('canvas')
  canvas.width = QR_SIZE + PAD * 2
  canvas.height = QR_SIZE + PAD * 2 + (withCaption ? CAPTION_H : 0)
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const img = await loadImage(qrDataUrl)
  ctx.drawImage(img, PAD, PAD, QR_SIZE, QR_SIZE)

  if (withCenterLabel) {
    drawCenterLabel(ctx, label, canvas.width, QR_SIZE + PAD * 2)
  } else if (withCaption) {
    drawCaption(ctx, label, canvas.width, PAD + QR_SIZE)
  }

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG failed'))), 'image/png')
  })
  return blob
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('QR image failed to load'))
    img.src = src
  })
}

/** Download a single PNG — filename uses first name when contact name is set. */
export async function downloadSlugQrPng(cardOrSlug, { kind } = {}) {
  const card =
    typeof cardOrSlug === 'string'
      ? { serial: cardOrSlug, kind }
      : { ...(cardOrSlug || {}), kind: cardOrSlug?.kind || kind }
  const blob = await buildLabeledQrPng(card, { kind: card.kind, forPrint: false })
  triggerDownload(blob, safeFileName(cardQrLabel(card)))
}

/**
 * Zip filtered cards as PNGs ready for print / sticker use.
 * Contact cards encode vCard + profile URL; blank cards encode CardTap URL.
 * @param {Array<{ serial: string, kind?: string, contactName?: string }>} cards
 */
export async function downloadSlugsQrZip(cards, { zipName, onProgress, forPrint = true } = {}) {
  const list = (cards || []).filter((c) => c?.serial)
  if (!list.length) throw new Error('No slugs to export')

  const zip = new JSZip()
  const used = new Set()

  for (let i = 0; i < list.length; i++) {
    const card = list[i]
    let name = safeFileName(cardQrLabel(card))
    if (used.has(name.toLowerCase())) {
      name = safeFileName(`${cardQrLabel(card)}-${card.serial || i + 1}`)
    }
    used.add(name.toLowerCase())
    const blob = await buildLabeledQrPng(card, { kind: card.kind, forPrint })
    zip.file(name, blob)
    onProgress?.(i + 1, list.length)
  }

  const out = await zip.generateAsync({ type: 'blob' })
  const file =
    zipName ||
    `tap-na-qr-${new Date().toISOString().slice(0, 10)}.zip`
  triggerDownload(out, file)
  return list.length
}
