/**
 * Printable NFC business card fronts/backs from black templates + optional B&W logo.
 * Front: logo above Connect. Back: QR for slug in the bottom zone.
 */

import JSZip from 'jszip'
import { buildLabeledQrPng } from './qrExport'

export const CARD_TEMPLATE_FRONT =
  '/Card%20Templates/template%20front%20-%20black.png'
export const CARD_TEMPLATE_BACK =
  '/Card%20Templates/template%20back%20-%20black.png'

/** Default logo box as fractions of card (centre x, centre y, width). */
export const DEFAULT_LOGO_LAYOUT = Object.freeze({
  xPct: 0.5,
  yPct: 0.52,
  wPct: 0.42
})

/** Keep logo between NFC icon and Connect. */
export const LOGO_BOUNDS = Object.freeze({
  minYPct: 0.22,
  maxYPct: 0.62,
  minWPct: 0.12,
  maxWPct: 0.72,
  padXPct: 0.06
})

const QR_ZONE = Object.freeze({
  cyPct: 0.78,
  sizePct: 0.42
})

function safeSlugPart(slug) {
  return String(slug || 'slug').replace(/[^\w.-]+/g, '_')
}

function triggerDownload(blob, filename) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Image failed to load'))
    img.src = src
  })
}

export function normalizeLogoLayout(layout = {}) {
  const base = { ...DEFAULT_LOGO_LAYOUT, ...(layout || {}) }
  let wPct = Math.min(
    LOGO_BOUNDS.maxWPct,
    Math.max(LOGO_BOUNDS.minWPct, Number(base.wPct) || DEFAULT_LOGO_LAYOUT.wPct)
  )
  let xPct = Number(base.xPct)
  if (!Number.isFinite(xPct)) xPct = DEFAULT_LOGO_LAYOUT.xPct
  let yPct = Number(base.yPct)
  if (!Number.isFinite(yPct)) yPct = DEFAULT_LOGO_LAYOUT.yPct

  const half = wPct / 2
  const minX = LOGO_BOUNDS.padXPct + half
  const maxX = 1 - LOGO_BOUNDS.padXPct - half
  xPct = Math.min(maxX, Math.max(minX, xPct))
  yPct = Math.min(LOGO_BOUNDS.maxYPct, Math.max(LOGO_BOUNDS.minYPct, yPct))

  return { xPct, yPct, wPct }
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG failed'))), 'image/png')
  })
}

/**
 * Convert any image source to B&W (luma), preserving alpha. Returns a data URL PNG.
 */
export async function toBlackAndWhite(imageSource) {
  const img =
    imageSource instanceof HTMLImageElement
      ? imageSource
      : await loadImage(String(imageSource || ''))
  const w = img.naturalWidth || img.width
  const h = img.naturalHeight || img.height
  if (!w || !h) throw new Error('Invalid logo image')

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0)
  const imageData = ctx.getImageData(0, 0, w, h)
  const d = imageData.data
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue
    const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2])
    d[i] = g
    d[i + 1] = g
    d[i + 2] = g
  }
  ctx.putImageData(imageData, 0, 0)
  return canvas.toDataURL('image/png')
}

function logoRect(cardW, cardH, layout, logoImg) {
  const L = normalizeLogoLayout(layout)
  const targetW = cardW * L.wPct
  const aspect =
    (logoImg.naturalHeight || logoImg.height) /
    Math.max(1, logoImg.naturalWidth || logoImg.width)
  const targetH = targetW * aspect
  const cx = cardW * L.xPct
  const cy = cardH * L.yPct
  return {
    x: cx - targetW / 2,
    y: cy - targetH / 2,
    w: targetW,
    h: targetH
  }
}

let frontTplCache = null
let backTplCache = null

export async function getFrontTemplate() {
  if (!frontTplCache) frontTplCache = await loadImage(CARD_TEMPLATE_FRONT)
  return frontTplCache
}

export async function getBackTemplate() {
  if (!backTplCache) backTplCache = await loadImage(CARD_TEMPLATE_BACK)
  return backTplCache
}

export async function composeCardFront({ logoBw = null, layout } = {}) {
  const tpl = await getFrontTemplate()
  const canvas = document.createElement('canvas')
  canvas.width = tpl.naturalWidth || tpl.width
  canvas.height = tpl.naturalHeight || tpl.height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(tpl, 0, 0)

  if (logoBw) {
    const logo =
      logoBw instanceof HTMLImageElement ? logoBw : await loadImage(String(logoBw))
    const r = logoRect(canvas.width, canvas.height, layout, logo)
    ctx.drawImage(logo, r.x, r.y, r.w, r.h)
  }

  return canvasToBlob(canvas)
}

export async function composeCardBack({ serial, kind } = {}) {
  const code = String(serial || '').trim()
  if (!code) throw new Error('Missing slug')

  const tpl = await getBackTemplate()
  const canvas = document.createElement('canvas')
  canvas.width = tpl.naturalWidth || tpl.width
  canvas.height = tpl.naturalHeight || tpl.height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(tpl, 0, 0)

  // Labeled QR (slug in centre) — same as slug PNG export
  const qrSize = Math.round(canvas.width * QR_ZONE.sizePct)
  const qrBlob = await buildLabeledQrPng(code, { kind })
  const qrUrl = URL.createObjectURL(qrBlob)
  try {
    const qrImg = await loadImage(qrUrl)
    const cx = canvas.width / 2
    const cy = canvas.height * QR_ZONE.cyPct
    ctx.drawImage(qrImg, cx - qrSize / 2, cy - qrSize / 2, qrSize, qrSize)
  } finally {
    URL.revokeObjectURL(qrUrl)
  }

  return canvasToBlob(canvas)
}

export async function paintFrontPreview(canvasEl, { logoBw, layout } = {}) {
  const tpl = await getFrontTemplate()
  const cardW = tpl.naturalWidth || tpl.width
  const cardH = tpl.naturalHeight || tpl.height
  const cssW =
    canvasEl.parentElement?.clientWidth ||
    canvasEl.clientWidth ||
    canvasEl.width ||
    280
  const scale = cssW / cardW
  const cssH = Math.round(cardH * scale)
  canvasEl.width = Math.round(cardW * scale)
  canvasEl.height = cssH
  canvasEl.style.width = '100%'
  canvasEl.style.height = 'auto'
  const ctx = canvasEl.getContext('2d')
  ctx.clearRect(0, 0, canvasEl.width, canvasEl.height)
  ctx.drawImage(tpl, 0, 0, canvasEl.width, canvasEl.height)

  let logoRectCss = null
  if (logoBw) {
    const logo =
      logoBw instanceof HTMLImageElement ? logoBw : await loadImage(String(logoBw))
    const r = logoRect(cardW, cardH, layout, logo)
    logoRectCss = {
      x: r.x * scale,
      y: r.y * scale,
      w: r.w * scale,
      h: r.h * scale
    }
    ctx.drawImage(logo, logoRectCss.x, logoRectCss.y, logoRectCss.w, logoRectCss.h)
  }

  return { scale, cardW, cardH, logoRect: logoRectCss }
}

export async function paintBackPreview(canvasEl, { serial, kind } = {}) {
  const blob = await composeCardBack({ serial, kind })
  const url = URL.createObjectURL(blob)
  try {
    const img = await loadImage(url)
    const cssW =
      canvasEl.parentElement?.clientWidth ||
      canvasEl.clientWidth ||
      canvasEl.width ||
      280
    const scale = cssW / img.naturalWidth
    canvasEl.width = Math.round(img.naturalWidth * scale)
    canvasEl.height = Math.round(img.naturalHeight * scale)
    canvasEl.style.width = '100%'
    canvasEl.style.height = 'auto'
    const ctx = canvasEl.getContext('2d')
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height)
    ctx.drawImage(img, 0, 0, canvasEl.width, canvasEl.height)
    return { scale }
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function downloadCardsZip(
  cards,
  { logoBw = null, layout, zipName, onProgress } = {}
) {
  const list = (cards || []).filter((c) => c?.serial)
  if (!list.length) throw new Error('No slugs to export')

  let logoImg = null
  if (logoBw) {
    logoImg = await loadImage(String(logoBw))
  }
  const L = normalizeLogoLayout(layout)
  const frontBlob = await composeCardFront({ logoBw: logoImg, layout: L })

  const zip = new JSZip()
  const used = new Set()

  for (let i = 0; i < list.length; i++) {
    const slug = String(list[i].serial).trim()
    if (!slug) continue
    let base = safeSlugPart(slug)
    if (used.has(base.toLowerCase())) base = safeSlugPart(`${slug}-${i + 1}`)
    used.add(base.toLowerCase())

    zip.file(`${base}-front.png`, frontBlob)
    const backBlob = await composeCardBack({ serial: slug, kind: list[i].kind })
    zip.file(`${base}-back.png`, backBlob)
    onProgress?.(i + 1, list.length)
  }

  const out = await zip.generateAsync({ type: 'blob' })
  const file =
    zipName || `tap-na-cards-${new Date().toISOString().slice(0, 10)}.zip`
  triggerDownload(out, file)
  return list.length
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Could not read image'))
    reader.readAsDataURL(blob)
  })
}

/**
 * PDF: one card side per page, order front → back for each slug.
 */
export async function downloadCardsPdf(
  cards,
  { logoBw = null, layout, pdfName, onProgress } = {}
) {
  const list = (cards || []).filter((c) => c?.serial)
  if (!list.length) throw new Error('No slugs to export')

  let logoImg = null
  if (logoBw) {
    logoImg = await loadImage(String(logoBw))
  }
  const L = normalizeLogoLayout(layout)
  const frontBlob = await composeCardFront({ logoBw: logoImg, layout: L })
  const frontDataUrl = await blobToDataUrl(frontBlob)
  const frontImg = await loadImage(frontDataUrl)
  const pxW = frontImg.naturalWidth || frontImg.width
  const pxH = frontImg.naturalHeight || frontImg.height
  // ~300 DPI → mm (print-friendly page sized to the card art)
  const wMm = (pxW / 300) * 25.4
  const hMm = (pxH / 300) * 25.4

  const { jsPDF } = await import('jspdf')
  const orientation = hMm >= wMm ? 'portrait' : 'landscape'
  const doc = new jsPDF({
    unit: 'mm',
    format: [wMm, hMm],
    orientation
  })

  for (let i = 0; i < list.length; i++) {
    const slug = String(list[i].serial).trim()
    if (!slug) continue

    if (i > 0) doc.addPage([wMm, hMm], orientation)
    doc.addImage(frontDataUrl, 'PNG', 0, 0, wMm, hMm)

    doc.addPage([wMm, hMm], orientation)
    const backBlob = await composeCardBack({ serial: slug, kind: list[i].kind })
    const backDataUrl = await blobToDataUrl(backBlob)
    doc.addImage(backDataUrl, 'PNG', 0, 0, wMm, hMm)

    onProgress?.(i + 1, list.length)
  }

  const file =
    pdfName || `tap-na-cards-${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(file)
  return list.length
}
