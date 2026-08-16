/**
 * Invoice / quote PDF generation for tap-na sales docs.
 */

import { jsPDF } from 'jspdf'
import {
  COMPANY,
  formatMoney,
  normalizeLines,
  resolveProductImage,
  BANKING_DETAILS,
  shouldIncludeBankingDetails,
  invoicePaidAmount,
  invoiceRemaining,
  formatSalesStatus
} from './salesStore'

const LOGO_SRC = '/images/tap-na_logo.png'

function formatDay(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  } catch {
    return '—'
  }
}

function loadImageAsDataUrl(src) {
  return new Promise((resolve) => {
    if (!src) {
      resolve('')
      return
    }
    if (src.startsWith('data:')) {
      resolve(src)
      return
    }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const max = 900
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        canvas.width = Math.max(1, Math.round(img.width * scale))
        canvas.height = Math.max(1, Math.round(img.height * scale))
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      } catch {
        resolve('')
      }
    }
    img.onerror = () => resolve('')
    img.src = src
  })
}

function dataUrlParts(dataUrl) {
  const m = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/)
  if (!m) return null
  return { mime: m[1], base64: m[2] }
}

function imageFormat(dataUrl) {
  return String(dataUrl || '').includes('image/png') ? 'PNG' : 'JPEG'
}

function ensureSpace(doc, y, need = 24) {
  if (y + need <= 280) return y
  doc.addPage()
  return 20
}

function drawCompanyBlockTopRight(doc, logoDataUrl) {
  const right = 190
  let y = 18

  let showedLogo = false
  if (logoDataUrl) {
    try {
      const w = 28
      const h = 12
      doc.addImage(logoDataUrl, imageFormat(logoDataUrl), right - w, y - 4, w, h, undefined, 'FAST')
      y += 12
      showedLogo = true
    } catch {
      /* skip logo */
    }
  }

  if (!showedLogo) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(17, 17, 17)
    doc.text(COMPANY.name, right, y, { align: 'right' })
    y += 5
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(70, 70, 70)
  doc.text(COMPANY.legalName, right, y, { align: 'right' })
  y += 4
  doc.text(COMPANY.address, right, y, { align: 'right' })
  y += 4
  doc.text(`${COMPANY.phone} | ${COMPANY.email}`, right, y, { align: 'right' })
  return y + 10
}

function drawBillTo(doc, row, y) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(17, 17, 17)
  doc.text('Bill to', 20, y)
  y += 5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(40, 40, 40)
  const lines = [row.customerName, row.customerEmail, row.customerAddress].filter(
    (v) => String(v || '').trim()
  )
  for (const line of lines) {
    const wrapped = doc.splitTextToSize(String(line), 110)
    doc.text(wrapped, 20, y)
    y += wrapped.length * 4.5
  }
  return y + 6
}

function drawProductImageRow(doc, imageDataUrls, y) {
  const images = (imageDataUrls || []).filter(Boolean).slice(0, 6)
  if (!images.length) return y

  y = ensureSpace(doc, y, 42)
  const size = 32
  const gap = 4
  let x = 20
  for (const dataUrl of images) {
    try {
      doc.addImage(dataUrl, imageFormat(dataUrl), x, y, size, size, undefined, 'FAST')
      x += size + gap
      if (x + size > 190) break
    } catch {
      /* skip broken image */
    }
  }
  return y + size + 8
}

function drawMinimalTable(doc, lines, y) {
  y = ensureSpace(doc, y, 28)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(17, 17, 17)
  doc.text('Item', 20, y)
  doc.text('Qty', 112, y)
  doc.text('Unit', 132, y)
  doc.text('Total', 190, y, { align: 'right' })
  y += 2
  doc.setDrawColor(210, 210, 210)
  doc.setLineWidth(0.3)
  doc.line(20, y, 190, y)
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(30, 30, 30)
  for (const line of lines) {
    y = ensureSpace(doc, y, 12)
    const nameLines = doc.splitTextToSize(String(line.productName || 'Product'), 88)
    doc.text(nameLines, 20, y)
    doc.text(String(line.quantity || 1), 112, y)
    doc.text(formatMoney(line.unitPrice), 132, y)
    doc.text(formatMoney(line.amount), 190, y, { align: 'right' })
    y += Math.max(7, nameLines.length * 4.5) + 2
  }
  doc.setDrawColor(210, 210, 210)
  doc.line(20, y, 190, y)
  return y + 8
}

function drawTotals(doc, row, isInvoice, y) {
  const paid = isInvoice ? invoicePaidAmount(row) : 0
  const due = isInvoice ? invoiceRemaining(row) : 0
  y = ensureSpace(doc, y, paid > 0.004 ? 32 : 18)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(17, 17, 17)
  if (!isInvoice) {
    doc.text(`Quoted total: ${formatMoney(row.amount)}`, 20, y)
    y += 7
  } else {
    doc.text(`Invoice total: ${formatMoney(row.amount)}`, 20, y)
    y += 6
    if (paid > 0.004) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(11)
      doc.text(`Paid: ${formatMoney(paid)}`, 20, y)
      y += 6
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
    }
    doc.text(`Amount due: ${formatMoney(due)}`, 20, y)
    y += 7
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(50, 50, 50)
  if (isInvoice) {
    doc.text(`Status: ${formatSalesStatus(row.status)}`, 20, y)
    y += 6
  }
  const method = String(row.paymentMethod || 'eft').trim() || 'eft'
  doc.text(`Payment method: ${method}`, 20, y)
  y += 8
  return y
}

function drawBanking(doc, y) {
  y = ensureSpace(doc, y, 36)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const rows = [
    ['Account Name', BANKING_DETAILS.accountHolder],
    ['Account Type', BANKING_DETAILS.accountType],
    ['Account Number', BANKING_DETAILS.accountNumber],
    ['Branch Code', BANKING_DETAILS.branchCode],
    ['Swift Code', BANKING_DETAILS.swiftCode]
  ]
  for (const [label, value] of rows) {
    y = ensureSpace(doc, y, 6)
    doc.setTextColor(110, 110, 110)
    doc.text(label, 20, y)
    doc.setTextColor(25, 25, 25)
    doc.text(String(value || ''), 68, y)
    y += 5.2
  }
  return y
}

async function buildPdfBytes({ kind, row, logoDataUrl, lineImageDataUrls }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const isInvoice = kind === 'invoice'
  const number = isInvoice ? row.invoiceNumber : row.quoteNumber
  const lines = normalizeLines(row.lines, row)

  let y = drawCompanyBlockTopRight(doc, logoDataUrl)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(17, 17, 17)
  doc.text(isInvoice ? `Invoice ${number || ''}` : `Quote ${number || ''}`, 20, y)
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(80, 80, 80)
  if (isInvoice) {
    doc.text(`Issued ${formatDay(row.issuedAt)}`, 20, y)
    y += 10
  } else {
    const issued = formatDay(row.issuedAt || row.createdAt)
    if (issued && issued !== '—') {
      doc.text(`Issued ${issued}`, 20, y)
      y += 5
    }
    doc.text(`Valid until ${formatDay(row.validUntil)}`, 20, y)
    y += 10
  }

  y = drawBillTo(doc, row, y)
  y = drawProductImageRow(doc, lineImageDataUrls, y)
  y = drawMinimalTable(doc, lines, y)
  y = drawTotals(doc, row, isInvoice, y)

  if (shouldIncludeBankingDetails(row, { kind })) {
    y = drawBanking(doc, y)
  }

  return doc.output('arraybuffer')
}

function bytesToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function triggerDownload(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

async function loadLineImages(doc) {
  const lines = normalizeLines(doc?.lines, doc || {})
  const ids = []
  for (const line of lines) {
    const id = String(line.productId || '').trim()
    if (id && !ids.includes(id)) ids.push(id)
  }
  if (!ids.length) {
    const fallback = String(doc?.productId || '').trim()
    if (fallback) ids.push(fallback)
  }
  const urls = await Promise.all(
    ids.map(async (id) => {
      const resolved = resolveProductImage(id)
      return loadImageAsDataUrl(resolved.src || resolved.absolute)
    })
  )
  return urls.filter(Boolean)
}

export async function prepareDocumentMedia(productId) {
  const resolved = resolveProductImage(productId)
  const dataUrl = await loadImageAsDataUrl(resolved.src || resolved.absolute)
  const parts = dataUrlParts(dataUrl)
  return {
    resolved,
    imageDataUrl: dataUrl,
    imageAttachment: parts
      ? {
          filename: 'product.' + (parts.mime.includes('png') ? 'png' : 'jpg'),
          content: parts.base64,
          content_id: 'product-image'
        }
      : null
  }
}

function primaryProductId(doc) {
  const lines = normalizeLines(doc?.lines, doc || {})
  return lines[0]?.productId || doc?.productId || ''
}

async function generateDocPdf(kind, row) {
  const [logoDataUrl, lineImageDataUrls, media] = await Promise.all([
    loadImageAsDataUrl(LOGO_SRC),
    loadLineImages(row),
    prepareDocumentMedia(primaryProductId(row))
  ])
  const bytes = await buildPdfBytes({
    kind,
    row,
    logoDataUrl,
    lineImageDataUrls: lineImageDataUrls.length ? lineImageDataUrls : [media.imageDataUrl].filter(Boolean)
  })
  const number = kind === 'invoice' ? row.invoiceNumber : row.quoteNumber
  return {
    ...media,
    bytes,
    base64: bytesToBase64(bytes),
    filename: (number || kind) + '.pdf'
  }
}

export async function generateInvoicePdf(invoice) {
  return generateDocPdf('invoice', invoice)
}

export async function generateQuotePdf(quote) {
  return generateDocPdf('quote', quote)
}

export async function downloadInvoicePdf(invoice) {
  const pdf = await generateInvoicePdf(invoice)
  triggerDownload(pdf.bytes, pdf.filename)
  return pdf
}

export async function downloadQuotePdf(quote) {
  const pdf = await generateQuotePdf(quote)
  triggerDownload(pdf.bytes, pdf.filename)
  return pdf
}
