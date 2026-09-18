/**
 * Build printable QR PNGs: QR encodes ?via=qr URL, slug labelled in the centre.
 * Uses high error correction so the centre overlay stays scannable.
 * Filename is always `{slug}.png`.
 */

import QRCode from 'qrcode'
import JSZip from 'jszip'
import { cardQrUrl } from './cardLinkStore'

const QR_SIZE = 512
const PAD = 28
const FONT = '700 30px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'

function safeFileName(slug) {
  return String(slug || 'slug').replace(/[^\w.-]+/g, '_') + '.png'
}

function triggerDownload(blob, filename) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

/**
 * @returns {Promise<Blob>} PNG blob of QR with a centred slug label
 */
export async function buildLabeledQrPng(slug, { origin, kind } = {}) {
  const code = String(slug || '').trim()
  if (!code) throw new Error('Missing slug')

  const url = cardQrUrl(code, origin, { kind })
  const qrDataUrl = await QRCode.toDataURL(url, {
    width: QR_SIZE,
    margin: 2,
    errorCorrectionLevel: 'H',
    color: { dark: '#0a0a0a', light: '#ffffff' }
  })

  const canvas = document.createElement('canvas')
  canvas.width = QR_SIZE + PAD * 2
  canvas.height = QR_SIZE + PAD * 2
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const img = await loadImage(qrDataUrl)
  ctx.drawImage(img, PAD, PAD, QR_SIZE, QR_SIZE)

  // Centre label: white rounded plate + slug text over the QR centre.
  const cx = canvas.width / 2
  const cy = canvas.height / 2
  ctx.font = FONT
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const textW = ctx.measureText(code).width
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
  ctx.fillText(code, cx, cy + 1, plateW - 20)

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

/** Download a single `{slug}.png` */
export async function downloadSlugQrPng(slug, { kind } = {}) {
  const blob = await buildLabeledQrPng(slug, { kind })
  triggerDownload(blob, safeFileName(slug))
}

/**
 * Zip filtered cards as `{slug}.png` each.
 * @param {Array<{ serial: string, kind?: string }>} cards
 * @param {{ zipName?: string, onProgress?: (done: number, total: number) => void }} opts
 */
export async function downloadSlugsQrZip(cards, { zipName, onProgress } = {}) {
  const list = (cards || []).filter((c) => c?.serial)
  if (!list.length) throw new Error('No slugs to export')

  const zip = new JSZip()
  const used = new Set()

  for (let i = 0; i < list.length; i++) {
    const slug = list[i].serial
    let name = safeFileName(slug)
    if (used.has(name.toLowerCase())) {
      name = safeFileName(`${slug}-${i + 1}`)
    }
    used.add(name.toLowerCase())
    const blob = await buildLabeledQrPng(slug, { kind: list[i].kind })
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