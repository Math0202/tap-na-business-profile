/**
 * Printable NFC card fronts/backs from tier templates + optional B&W logo.
 * Front: logo above Connect. Back: labeled QR (slug in centre) in the bottom zone.
 * Templates: business | executive | professional
 */

import JSZip from 'jszip'
import { buildLabeledQrPng } from './qrExport'
import { normalizePersonalType, DEFAULT_PERSONAL_TYPE } from './teamRoles'

export const CARD_TEMPLATE_VARIANTS = ['business', 'executive', 'professional']

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
  sizePct: 0.42,
  /** Corner radius (px) for the QR block on the card back */
  cornerRadius: 7
})

function roundRectPath(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function drawRoundedImage(ctx, img, x, y, w, h, r) {
  ctx.save()
  roundRectPath(ctx, x, y, w, h, r)
  ctx.clip()
  ctx.drawImage(img, x, y, w, h)
  ctx.restore()
}

const frontTplCache = new Map()
const backTplCache = new Map()

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

/**
 * Map personalType / product to template file stem: business | executive | professional
 */
export function resolveCardTemplateVariant(personalTypeOrCard = '') {
  const raw =
    typeof personalTypeOrCard === 'object' && personalTypeOrCard
      ? personalTypeOrCard.personalType || personalTypeOrCard.productId || ''
      : personalTypeOrCard
  const key = normalizePersonalType(raw, { fallback: DEFAULT_PERSONAL_TYPE })
  if (key === 'executive_exclusive') return 'executive'
  if (key === 'professional') return 'professional'
  return 'business'
}

export function cardTemplateUrl(side, variant) {
  const v = CARD_TEMPLATE_VARIANTS.includes(variant) ? variant : 'business'
  const face = side === 'back' ? 'back' : 'front'
  return `/Card%20Templates/template%20${face}%20-%20${encodeURIComponent(v)}.png`
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

export async function getFrontTemplate(personalTypeOrCard) {
  const variant = resolveCardTemplateVariant(personalTypeOrCard)
  if (!frontTplCache.has(variant)) {
    frontTplCache.set(variant, await loadImage(cardTemplateUrl('front', variant)))
  }
  return frontTplCache.get(variant)
}

export async function getBackTemplate(personalTypeOrCard) {
  const variant = resolveCardTemplateVariant(personalTypeOrCard)
  if (!backTplCache.has(variant)) {
    backTplCache.set(variant, await loadImage(cardTemplateUrl('back', variant)))
  }
  return backTplCache.get(variant)
}

export async function composeCardFront({ logoBw = null, layout, personalType } = {}) {
  const tpl = await getFrontTemplate(personalType)
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

export async function composeCardBack({ serial, kind, personalType } = {}) {
  const code = String(serial || '').trim()
  if (!code) throw new Error('Missing slug')

  const tpl = await getBackTemplate(personalType)
  const canvas = document.createElement('canvas')
  canvas.width = tpl.naturalWidth || tpl.width
  canvas.height = tpl.naturalHeight || tpl.height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(tpl, 0, 0)

  const qrSize = Math.round(canvas.width * QR_ZONE.sizePct)
  const qrBlob = await buildLabeledQrPng(code, { kind })
  const qrUrl = URL.createObjectURL(qrBlob)
  try {
    const qrImg = await loadImage(qrUrl)
    const cx = canvas.width / 2
    const cy = canvas.height * QR_ZONE.cyPct
    const qx = cx - qrSize / 2
    const qy = cy - qrSize / 2
    drawRoundedImage(ctx, qrImg, qx, qy, qrSize, qrSize, QR_ZONE.cornerRadius)
  } finally {
    URL.revokeObjectURL(qrUrl)
  }

  return canvasToBlob(canvas)
}

export async function paintFrontPreview(canvasEl, { logoBw, layout, personalType } = {}) {
  const tpl = await getFrontTemplate(personalType)
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

export async function paintBackPreview(canvasEl, { serial, kind, personalType } = {}) {
  const blob = await composeCardBack({ serial, kind, personalType })
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

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Could not read image'))
    reader.readAsDataURL(blob)
  })
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
  const frontByVariant = new Map()

  const zip = new JSZip()
  const used = new Set()

  for (let i = 0; i < list.length; i++) {
    const slug = String(list[i].serial).trim()
    if (!slug) continue
    let base = safeSlugPart(slug)
    if (used.has(base.toLowerCase())) base = safeSlugPart(`${slug}-${i + 1}`)
    used.add(base.toLowerCase())

    const personalType = list[i].personalType || ''
    const variant = resolveCardTemplateVariant(personalType || list[i])
    if (!frontByVariant.has(variant)) {
      frontByVariant.set(
        variant,
        await composeCardFront({ logoBw: logoImg, layout: L, personalType: variant })
      )
    }
    zip.file(`${base}-front.png`, frontByVariant.get(variant))
    const backBlob = await composeCardBack({
      serial: slug,
      kind: list[i].kind,
      personalType: variant
    })
    zip.file(`${base}-back.png`, backBlob)
    onProgress?.(i + 1, list.length)
  }

  const out = await zip.generateAsync({ type: 'blob' })
  const file =
    zipName || `tap-na-cards-${new Date().toISOString().slice(0, 10)}.zip`
  triggerDownload(out, file)
  return list.length
}

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
  const frontByVariant = new Map()

  const firstVariant = resolveCardTemplateVariant(list[0])
  const firstFront = await composeCardFront({
    logoBw: logoImg,
    layout: L,
    personalType: firstVariant
  })
  frontByVariant.set(firstVariant, firstFront)
  const frontDataUrl = await blobToDataUrl(firstFront)
  const frontImg = await loadImage(frontDataUrl)
  const pxW = frontImg.naturalWidth || frontImg.width
  const pxH = frontImg.naturalHeight || frontImg.height
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

    const variant = resolveCardTemplateVariant(list[i])
    if (!frontByVariant.has(variant)) {
      frontByVariant.set(
        variant,
        await composeCardFront({ logoBw: logoImg, layout: L, personalType: variant })
      )
    }
    const frontUrl = await blobToDataUrl(frontByVariant.get(variant))

    if (i > 0) doc.addPage([wMm, hMm], orientation)
    doc.addImage(frontUrl, 'PNG', 0, 0, wMm, hMm)

    doc.addPage([wMm, hMm], orientation)
    const backBlob = await composeCardBack({
      serial: slug,
      kind: list[i].kind,
      personalType: variant
    })
    const backDataUrl = await blobToDataUrl(backBlob)
    doc.addImage(backDataUrl, 'PNG', 0, 0, wMm, hMm)

    onProgress?.(i + 1, list.length)
  }

  const file =
    pdfName || `tap-na-cards-${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(file)
  return list.length
}
