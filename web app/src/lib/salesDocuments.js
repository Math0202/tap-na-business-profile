/**
 * Invoice / quote PDF generation for tap-na sales docs.
 */

import { jsPDF } from 'jspdf'
import {
  COMPANY,
  formatMoney,
  normalizeLines,
  resolveProductImage
} from './salesStore'

function formatDay(iso) {
  if (!iso) return '-'
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  } catch {
    return '-'
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
        resolve(canvas.toDataURL('image/jpeg', 0.82))
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

function drawHeader(doc, title, subtitle) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(17, 17, 17)
  doc.text(COMPANY.name, 20, 22)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(80, 80, 80)
  doc.text(COMPANY.legalName, 20, 28)
  doc.text(COMPANY.address, 20, 33)
  doc.text(COMPANY.phone + '  |  ' + COMPANY.email, 20, 38)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(17, 17, 17)
  doc.text(title, 20, 52)

  if (subtitle) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(90, 90, 90)
    doc.text(subtitle, 20, 58)
  }
}

function drawCustomer(doc, label, docRow, y) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(17, 17, 17)
  doc.text(label, 20, y)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(50, 50, 50)
  const lines = [
    docRow.customerName,
    docRow.customerEmail,
    docRow.customerPhone,
    docRow.customerAddress
  ].filter(Boolean)
  let yy = y + 5
  for (const line of lines) {
    doc.text(String(line), 20, yy)
    yy += 5
  }
  return yy + 4
}

async function buildPdfBytes({ kind, row, imageDataUrl }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const isInvoice = kind === 'invoice'
  const number = isInvoice ? row.invoiceNumber : row.quoteNumber
  const title = isInvoice ? ('Invoice ' + number) : ('Quote ' + number)
  const subtitle = isInvoice
    ? ('Issued ' + formatDay(row.issuedAt))
    : ('Valid until ' + formatDay(row.validUntil))
  const lines = normalizeLines(row.lines, row)

  drawHeader(doc, title, subtitle)
  let y = drawCustomer(doc, isInvoice ? 'Bill to' : 'Prepared for', row, 68)

  if (imageDataUrl) {
    try {
      const fmt = imageDataUrl.includes('image/png') ? 'PNG' : 'JPEG'
      doc.addImage(imageDataUrl, fmt, 130, 64, 55, 55, undefined, 'FAST')
    } catch {
      /* skip image if unsupported */
    }
  }

  y = Math.max(y, 128)
  doc.setDrawColor(220, 220, 220)
  doc.line(20, y, 190, y)
  y += 8

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(17, 17, 17)
  doc.text('Item', 20, y)
  doc.text('Qty', 110, y)
  doc.text('Unit', 130, y)
  doc.text('Total', 170, y, { align: 'right' })
  y += 3
  doc.line(20, y, 190, y)
  y += 8

  doc.setFont('helvetica', 'normal')
  for (const line of lines) {
    if (y > 265) {
      doc.addPage()
      y = 20
    }
    const nameLines = doc.splitTextToSize(String(line.productName || 'Product'), 85)
    doc.text(nameLines, 20, y)
    doc.text(String(line.quantity || 1), 110, y)
    doc.text(formatMoney(line.unitPrice), 130, y)
    doc.text(formatMoney(line.amount), 190, y, { align: 'right' })
    y += Math.max(8, nameLines.length * 5)
  }
  doc.line(20, y, 190, y)
  y += 10

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(17, 17, 17)
  doc.text(
    isInvoice ? ('Amount due: ' + formatMoney(row.amount)) : ('Quoted total: ' + formatMoney(row.amount)),
    20,
    y
  )
  y += 8

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(90, 90, 90)
  if (isInvoice) {
    doc.text('Payment method: ' + (row.paymentMethod || '-'), 20, y)
    y += 5
  }
  if (row.notes) {
    const notes = doc.splitTextToSize('Notes: ' + row.notes, 170)
    doc.text(notes, 20, y)
    y += notes.length * 5
  }

  y = Math.max(y + 16, 250)
  doc.setFontSize(9)
  doc.setTextColor(120, 120, 120)
  doc.text(COMPANY.legalName + ' | ' + COMPANY.address, 20, y)
  doc.text(COMPANY.phone + ' | ' + COMPANY.email, 20, y + 5)

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

export async function generateInvoicePdf(invoice) {
  const media = await prepareDocumentMedia(primaryProductId(invoice))
  const bytes = await buildPdfBytes({
    kind: 'invoice',
    row: invoice,
    imageDataUrl: media.imageDataUrl
  })
  return {
    ...media,
    bytes,
    base64: bytesToBase64(bytes),
    filename: (invoice.invoiceNumber || 'invoice') + '.pdf'
  }
}

export async function generateQuotePdf(quote) {
  const media = await prepareDocumentMedia(primaryProductId(quote))
  const bytes = await buildPdfBytes({
    kind: 'quote',
    row: quote,
    imageDataUrl: media.imageDataUrl
  })
  return {
    ...media,
    bytes,
    base64: bytesToBase64(bytes),
    filename: (quote.quoteNumber || 'quote') + '.pdf'
  }
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
