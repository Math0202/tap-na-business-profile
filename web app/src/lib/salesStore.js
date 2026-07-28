/**
 * Sales module store — agents, sales, quotes, invoices, and cash flow (localStorage).
 */

const AGENTS_KEY = 'tapna_sales_agents'
const SALES_KEY = 'tapna_sales_orders'
const QUOTES_KEY = 'tapna_sales_quotes'
const INVOICES_KEY = 'tapna_sales_invoices'
const PRODUCTS_KEY = 'tapna_sales_products'
const CASH_KEY = 'tapna_sales_cashflow'

/** No seeded catalog — products live in Supabase `sales_products`. */
export const DEFAULT_PRODUCTS = []

/** @deprecated use listProducts() */
export const PRODUCT_OPTIONS = DEFAULT_PRODUCTS

export const PRODUCT_CATEGORIES = ['personal', 'table', 'other']

export const SALE_STATUSES = ['pending', 'paid', 'fulfilled', 'cancelled']
export const QUOTE_STATUSES = ['draft', 'sent', 'accepted', 'declined', 'converted', 'expired']
export const INVOICE_STATUSES = ['draft', 'sent', 'paid', 'void']
export const PAYMENT_METHODS = ['cash', 'eft', 'card', 'mobile', 'other']
export const CASH_CATEGORIES = [
  'sale',
  'commission',
  'refund',
  'expense',
  'stock',
  'salary',
  'other'
]

export const COMPANY = {
  name: 'tap-na',
  legalName: 'Auckmund Investment CC',
  email: 'auckmund@gmail.com',
  phone: '+264 85 792 7373',
  address: 'Erf: 62, Hosea Kutako Drive, Windhoek North',
  currency: 'NAD',
  fromName: 'tap-na',
  /** Verified Resend sender (domain no-reply.auckmund.com) */
  mailFrom: 'tap-na <noreply@no-reply.auckmund.com>'
}

const PRODUCT_FALLBACK_IMAGES = {
  blue: '/images/blue-card.png',
  black: '/images/black-card.png',
  'table-info': '/images/table/NFC%20business%20info%20card.png',
  'table-menu': '/images/table/NFC%20-%20Menu.png',
  'table-review': '/images/table/NFC%20business%20review%20card.png',
  'table-wifi': '/images/table/NFC%20wifi%20and%20conact%20card.png',
  'table-custom': '/images/table/NFC%20custom%20menu%20card.png'
}

/** Resolve the best product image URL for docs / email / PDF */
export function resolveProductImage(productId) {
  const product = productId ? getProduct(productId) : null
  const raw =
    (Array.isArray(product?.images) && product.images.find(Boolean)) ||
    PRODUCT_FALLBACK_IMAGES[productId] ||
    ''
  if (!raw) return { src: '', absolute: '', isData: false }
  const isData = raw.startsWith('data:')
  let absolute = raw
  if (!isData && !/^https?:\/\//i.test(raw)) {
    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'https://redirct.link'
    absolute = origin + (raw.startsWith('/') ? raw : '/' + raw)
  }
  return { src: raw, absolute, isData }
}

const DATA_VERSION_KEY = 'tapna_sales_data_v'
const DATA_VERSION = '3'

let productsCache = null

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
  return value
}

function uid(prefix) {
  return prefix + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

function ensureSeeded() {
  // v3: wipe legacy local dummy product catalogs; products come from Supabase
  if (localStorage.getItem(DATA_VERSION_KEY) !== DATA_VERSION) {
    writeJson(AGENTS_KEY, readJson(AGENTS_KEY, []) || [])
    writeJson(SALES_KEY, readJson(SALES_KEY, []) || [])
    writeJson(QUOTES_KEY, readJson(QUOTES_KEY, []) || [])
    writeJson(INVOICES_KEY, readJson(INVOICES_KEY, []) || [])
    writeJson(CASH_KEY, readJson(CASH_KEY, []) || [])
    writeJson(PRODUCTS_KEY, [])
    productsCache = []
    localStorage.setItem(DATA_VERSION_KEY, DATA_VERSION)
    return
  }

  if (!Array.isArray(readJson(AGENTS_KEY, null))) writeJson(AGENTS_KEY, [])
  if (!Array.isArray(readJson(SALES_KEY, null))) writeJson(SALES_KEY, [])
  if (!Array.isArray(readJson(QUOTES_KEY, null))) writeJson(QUOTES_KEY, [])
  if (!Array.isArray(readJson(INVOICES_KEY, null))) writeJson(INVOICES_KEY, [])
  if (!Array.isArray(readJson(PRODUCTS_KEY, null))) writeJson(PRODUCTS_KEY, [])
  if (!Array.isArray(readJson(CASH_KEY, null))) writeJson(CASH_KEY, [])
}

function normalizeAgent(a) {
  return {
    id: a.id || uid('ag'),
    name: a.name || '',
    email: a.email || '',
    phone: a.phone || '',
    region: a.region || '',
    commissionRate: Number(a.commissionRate) || 0,
    active: a.active !== false,
    notes: a.notes || '',
    authUserId: a.authUserId || '',
    loginEmail: a.loginEmail || a.email || '',
    createdAt: a.createdAt || new Date().toISOString()
  }
}

/** One product line on a sale / quote / invoice */
export function normalizeLine(line = {}) {
  const product = line.productId ? getProduct(line.productId) : null
  const qty = Math.max(1, Number(line.quantity) || 1)
  const unit =
    line.unitPrice != null && line.unitPrice !== ''
      ? Number(line.unitPrice)
      : Number(product?.defaultPrice) || 0
  return {
    productId: line.productId || product?.id || '',
    productName: String(line.productName || product?.name || 'Product').trim() || 'Product',
    quantity: qty,
    unitPrice: unit,
    amount: Math.round(qty * unit * 100) / 100
  }
}

export function emptyLine(productId = '') {
  const list = listProducts()
  const id = productId || list[0]?.id || ''
  return normalizeLine({ productId: id, quantity: 1 })
}

export function normalizeLines(raw, legacy = {}) {
  let lines = Array.isArray(raw) ? raw.map(normalizeLine) : []
  lines = lines.filter((l) => l.productId || l.productName)
  if (!lines.length && (legacy.productId || legacy.productName)) {
    lines = [
      normalizeLine({
        productId: legacy.productId,
        productName: legacy.productName,
        quantity: legacy.quantity,
        unitPrice: legacy.unitPrice
      })
    ]
  }
  if (!lines.length) lines = [emptyLine()]
  return lines
}

export function summarizeLines(lines, legacy = {}) {
  const list = normalizeLines(lines, legacy)
  const quantity = list.reduce((sum, l) => sum + l.quantity, 0)
  const amount = Math.round(list.reduce((sum, l) => sum + l.amount, 0) * 100) / 100
  const productName =
    list.length === 1
      ? list[0].productName
      : list.map((l) => `${l.productName} × ${l.quantity}`).join(', ')
  return {
    lines: list,
    productId: list[0].productId,
    productName,
    quantity,
    unitPrice: list.length === 1 ? list[0].unitPrice : 0,
    amount
  }
}

function normalizeSale(s) {
  const summary = summarizeLines(s.lines, s)
  const rate = Number(s.commissionRate)
  const commission =
    s.commission != null
      ? Number(s.commission)
      : Math.round(summary.amount * ((Number.isFinite(rate) ? rate : 10) / 100) * 100) / 100
  return {
    id: s.id || uid('sale'),
    agentId: s.agentId || '',
    customerName: s.customerName || '',
    customerPhone: s.customerPhone || '',
    customerEmail: s.customerEmail || '',
    customerAddress: s.customerAddress || '',
    lines: summary.lines,
    productId: summary.productId,
    productName: summary.productName,
    quantity: summary.quantity,
    unitPrice: summary.unitPrice,
    amount: summary.amount,
    commission,
    commissionRate: Number.isFinite(rate) ? rate : 10,
    status: SALE_STATUSES.includes(s.status) ? s.status : 'pending',
    paymentMethod: PAYMENT_METHODS.includes(s.paymentMethod) ? s.paymentMethod : 'cash',
    soldAt: s.soldAt || new Date().toISOString(),
    notes: s.notes || '',
    quoteId: s.quoteId || '',
    invoiceId: s.invoiceId || '',
    createdAt: s.createdAt || new Date().toISOString()
  }
}

function nextDocNumber(prefix, list, field) {
  const year = new Date().getFullYear()
  const re = new RegExp('^' + prefix + '-' + year + '-(\\d+)$')
  let max = 0
  for (const item of list) {
    const m = String(item[field] || '').match(re)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `${prefix}-${year}-${String(max + 1).padStart(3, '0')}`
}

function normalizeQuote(q) {
  const summary = summarizeLines(q.lines, q)
  return {
    id: q.id || uid('quote'),
    quoteNumber: q.quoteNumber || '',
    agentId: q.agentId || '',
    customerName: q.customerName || '',
    customerPhone: q.customerPhone || '',
    customerEmail: q.customerEmail || '',
    customerAddress: q.customerAddress || '',
    lines: summary.lines,
    productId: summary.productId,
    productName: summary.productName,
    quantity: summary.quantity,
    unitPrice: summary.unitPrice,
    amount: summary.amount,
    status: QUOTE_STATUSES.includes(q.status) ? q.status : 'draft',
    validUntil: q.validUntil || '',
    notes: q.notes || '',
    saleId: q.saleId || '',
    emailStatus: q.emailStatus || '',
    emailedAt: q.emailedAt || '',
    createdAt: q.createdAt || new Date().toISOString()
  }
}

function normalizeInvoice(inv) {
  const summary = summarizeLines(inv.lines, inv)
  return {
    id: inv.id || uid('inv'),
    invoiceNumber: inv.invoiceNumber || '',
    saleId: inv.saleId || '',
    quoteId: inv.quoteId || '',
    agentId: inv.agentId || '',
    customerName: inv.customerName || '',
    customerPhone: inv.customerPhone || '',
    customerEmail: inv.customerEmail || '',
    customerAddress: inv.customerAddress || '',
    lines: summary.lines,
    productId: summary.productId,
    productName: summary.productName,
    quantity: summary.quantity,
    unitPrice: summary.unitPrice,
    amount: summary.amount,
    status: INVOICE_STATUSES.includes(inv.status) ? inv.status : 'draft',
    paymentMethod: PAYMENT_METHODS.includes(inv.paymentMethod) ? inv.paymentMethod : 'eft',
    issuedAt: inv.issuedAt || new Date().toISOString(),
    sentAt: inv.sentAt || '',
    emailStatus: inv.emailStatus || 'pending',
    emailId: inv.emailId || '',
    notes: inv.notes || '',
    createdAt: inv.createdAt || new Date().toISOString()
  }
}

function normalizeCash(c) {
  return {
    id: c.id || uid('cf'),
    type: c.type === 'out' ? 'out' : 'in',
    category: CASH_CATEGORIES.includes(c.category) ? c.category : 'other',
    amount: Math.abs(Number(c.amount) || 0),
    method: PAYMENT_METHODS.includes(c.method) ? c.method : 'other',
    description: c.description || '',
    saleId: c.saleId || '',
    agentId: c.agentId || '',
    at: c.at || new Date().toISOString()
  }
}

/* ——— Agents ——— */

export function listAgents() {
  ensureSeeded()
  return readJson(AGENTS_KEY, []).map(normalizeAgent)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function getAgent(id) {
  return listAgents().find((a) => a.id === id) || null
}

export function saveAgent(payload) {
  const list = listAgents()
  const next = normalizeAgent(payload)
  const idx = list.findIndex((a) => a.id === next.id)
  if (idx >= 0) list[idx] = { ...list[idx], ...next, id: list[idx].id, createdAt: list[idx].createdAt }
  else list.push(next)
  writeJson(AGENTS_KEY, list)
  return next
}

export function deleteAgent(id) {
  writeJson(AGENTS_KEY, listAgents().filter((a) => a.id !== id))
}

/* ——— Products ——— */

function normalizeProduct(p) {
  const images = Array.isArray(p.images)
    ? p.images.filter((src) => typeof src === 'string' && src.trim()).map((src) => src.trim())
    : p.image
      ? [String(p.image)]
      : []
  return {
    id: p.id || uid('prod'),
    name: p.name || '',
    defaultPrice: Number(p.defaultPrice) || 0,
    category: PRODUCT_CATEGORIES.includes(p.category) ? p.category : 'other',
    active: p.active !== false,
    description: p.description || '',
    images,
    video: typeof p.video === 'string' ? p.video.trim() : '',
    createdAt: p.createdAt || new Date().toISOString()
  }
}

export function listProducts({ activeOnly = false } = {}) {
  ensureSeeded()
  const source = Array.isArray(productsCache) ? productsCache : readJson(PRODUCTS_KEY, [])
  let list = source.map(normalizeProduct)
  if (activeOnly) list = list.filter((p) => p.active)
  return list.sort((a, b) => a.name.localeCompare(b.name))
}

export function getProduct(id) {
  if (!id) return null
  return listProducts().find((p) => p.id === id) || null
}

function setProductsCache(list) {
  productsCache = list.map(normalizeProduct)
  writeJson(PRODUCTS_KEY, productsCache)
  return productsCache
}

/** Load products from Supabase (via Worker). Falls back to local cache offline. */
export async function refreshProductsFromApi({ includeInactive = true } = {}) {
  ensureSeeded()
  try {
    const { apiSalesProducts, apiShopProducts } = await import('./api.js')
    // Prefer staff catalog when logged in as staff; otherwise public shop list
    let res = await apiSalesProducts({ includeInactive })
    if (!res.ok) res = await apiShopProducts()
    if (res.ok && Array.isArray(res.data?.products)) {
      const mapped = res.data.products.map((p) =>
        normalizeProduct({
          id: p.id,
          name: p.name,
          defaultPrice: p.defaultPrice ?? p.price,
          category: p.category,
          active: p.active !== false,
          description: p.description || p.desc || '',
          images: p.images || (p.image ? [p.image] : []),
          video: p.video || '',
          createdAt: p.createdAt
        })
      )
      setProductsCache(mapped)
      return listProducts({ activeOnly: !includeInactive })
    }
  } catch {
    /* use cache */
  }
  if (!Array.isArray(productsCache)) {
    productsCache = readJson(PRODUCTS_KEY, []).map(normalizeProduct)
  }
  return listProducts({ activeOnly: !includeInactive })
}

export async function saveProduct(payload) {
  ensureSeeded()
  const next = normalizeProduct(payload)
  const { apiSaveSalesProduct } = await import('./api.js')
  const res = await apiSaveSalesProduct(next)
  if (!res.ok) throw new Error(res.error || 'Could not save product')
  const saved = normalizeProduct(res.data?.product || next)
  const list = listProducts()
  const idx = list.findIndex((p) => p.id === saved.id)
  if (idx >= 0) list[idx] = { ...list[idx], ...saved, id: list[idx].id, createdAt: list[idx].createdAt }
  else list.push(saved)
  setProductsCache(list)
  return saved
}

export async function deleteProduct(id) {
  ensureSeeded()
  const { apiDeleteSalesProduct } = await import('./api.js')
  const res = await apiDeleteSalesProduct(id)
  if (!res.ok) throw new Error(res.error || 'Could not delete product')
  setProductsCache(listProducts().filter((p) => p.id !== id))
}

/** Clears local product cache only — DB catalog is managed by admin CRUD. */
export function resetProductsToDefaults() {
  setProductsCache([])
  return listProducts()
}

/* ——— Sales ——— */

export function listSales() {
  ensureSeeded()
  return readJson(SALES_KEY, []).map(normalizeSale)
    .sort((a, b) => String(b.soldAt).localeCompare(String(a.soldAt)))
}

export function getSale(id) {
  return listSales().find((s) => s.id === id) || null
}

export function saveSale(payload, { recordCash = true, createInvoice = true } = {}) {
  const agents = listAgents()
  const agent = agents.find((a) => a.id === payload.agentId)
  const rate = agent ? Number(agent.commissionRate) : 10
  const summary = summarizeLines(payload.lines, payload)
  const commission = Math.round(summary.amount * (rate / 100) * 100) / 100

  const next = normalizeSale({
    ...payload,
    lines: summary.lines,
    productId: summary.productId,
    productName: summary.productName,
    quantity: summary.quantity,
    unitPrice: summary.unitPrice,
    amount: summary.amount,
    commission,
    commissionRate: rate
  })

  const list = listSales()
  const existing = list.find((s) => s.id === next.id)
  const idx = list.findIndex((s) => s.id === next.id)
  const isNew = idx < 0
  if (idx >= 0) {
    list[idx] = {
      ...list[idx],
      ...next,
      id: list[idx].id,
      createdAt: list[idx].createdAt,
      invoiceId: list[idx].invoiceId || next.invoiceId,
      quoteId: next.quoteId || list[idx].quoteId
    }
    next.invoiceId = list[idx].invoiceId
    next.quoteId = list[idx].quoteId
  } else {
    list.unshift(next)
  }
  writeJson(SALES_KEY, list)

  // Auto cash-in when newly marked paid / fulfilled
  if (recordCash && (next.status === 'paid' || next.status === 'fulfilled')) {
    const wasPaid = existing && (existing.status === 'paid' || existing.status === 'fulfilled')
    if (!wasPaid) {
      addCashEntry({
        type: 'in',
        category: 'sale',
        amount: next.amount,
        method: next.paymentMethod,
        description: `Sale · ${next.productName} · ${next.customerName}`,
        saleId: next.id,
        agentId: next.agentId,
        at: next.soldAt
      })
      if (next.commission > 0 && next.agentId) {
        addCashEntry({
          type: 'out',
          category: 'commission',
          amount: next.commission,
          method: 'eft',
          description: `Commission · ${agent?.name || 'Agent'} · ${next.productName}`,
          saleId: next.id,
          agentId: next.agentId,
          at: next.soldAt
        })
      }
    }
  }

  let invoice = null
  if (createInvoice && (isNew || !next.invoiceId)) {
    invoice = createInvoiceFromSale(next)
    const withInv = listSales()
    const i = withInv.findIndex((s) => s.id === next.id)
    if (i >= 0) {
      withInv[i] = { ...withInv[i], invoiceId: invoice.id }
      writeJson(SALES_KEY, withInv)
      next.invoiceId = invoice.id
    }
  } else if (next.invoiceId) {
    invoice = getInvoice(next.invoiceId)
    if (invoice) {
      invoice = updateInvoice({
        ...invoice,
        lines: next.lines,
        productId: next.productId,
        productName: next.productName,
        quantity: next.quantity,
        unitPrice: next.unitPrice,
        amount: next.amount,
        paymentMethod: next.paymentMethod,
        customerName: next.customerName,
        customerPhone: next.customerPhone,
        customerEmail: next.customerEmail,
        customerAddress: next.customerAddress,
        agentId: next.agentId,
        notes: next.notes
      })
    }
  }

  return { sale: next, invoice, isNew }
}

export function deleteSale(id) {
  writeJson(SALES_KEY, listSales().filter((s) => s.id !== id))
}

/* ——— Quotes ——— */

export function listQuotes() {
  ensureSeeded()
  return readJson(QUOTES_KEY, []).map(normalizeQuote)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
}

export function getQuote(id) {
  return listQuotes().find((q) => q.id === id) || null
}

export function saveQuote(payload) {
  const list = listQuotes()
  const summary = summarizeLines(payload.lines, payload)
  const next = normalizeQuote({
    ...payload,
    lines: summary.lines,
    productId: summary.productId,
    productName: summary.productName,
    quantity: summary.quantity,
    unitPrice: summary.unitPrice,
    amount: summary.amount,
    quoteNumber: payload.quoteNumber || nextDocNumber('Q', list, 'quoteNumber')
  })
  const idx = list.findIndex((q) => q.id === next.id)
  if (idx >= 0) list[idx] = { ...list[idx], ...next, id: list[idx].id, createdAt: list[idx].createdAt, quoteNumber: list[idx].quoteNumber }
  else list.unshift(next)
  writeJson(QUOTES_KEY, list)
  return next
}

export function deleteQuote(id) {
  writeJson(QUOTES_KEY, listQuotes().filter((q) => q.id !== id))
}

export function convertQuoteToSale(quoteId, overrides = {}) {
  const quote = getQuote(quoteId)
  if (!quote) throw new Error('Quote not found')
  if (quote.status === 'converted' && quote.saleId) {
    return { sale: getSale(quote.saleId), invoice: getInvoiceBySale(quote.saleId), isNew: false }
  }

  const result = saveSale({
    agentId: overrides.agentId || quote.agentId,
    customerName: quote.customerName,
    customerPhone: quote.customerPhone,
    customerEmail: quote.customerEmail,
    customerAddress: quote.customerAddress,
    lines: quote.lines,
    productId: quote.productId,
    productName: quote.productName,
    quantity: quote.quantity,
    unitPrice: quote.unitPrice,
    status: overrides.status || 'pending',
    paymentMethod: overrides.paymentMethod || 'eft',
    soldAt: overrides.soldAt || new Date().toISOString(),
    notes: overrides.notes || quote.notes || `From quote ${quote.quoteNumber}`,
    quoteId: quote.id
  })

  const list = listQuotes()
  const idx = list.findIndex((q) => q.id === quote.id)
  if (idx >= 0) {
    list[idx] = {
      ...list[idx],
      status: 'converted',
      saleId: result.sale.id
    }
    writeJson(QUOTES_KEY, list)
  }

  try {
    import('./cardLinkStore.js').then((m) => {
      if (result.sale) m.provisionCardsForSale(result.sale)
    })
  } catch {
    /* optional */
  }

  return result
}

/* ——— Invoices ——— */

export function listInvoices() {
  ensureSeeded()
  return readJson(INVOICES_KEY, []).map(normalizeInvoice)
    .sort((a, b) => String(b.issuedAt).localeCompare(String(a.issuedAt)))
}

export function getInvoice(id) {
  return listInvoices().find((inv) => inv.id === id) || null
}

export function getInvoiceBySale(saleId) {
  return listInvoices().find((inv) => inv.saleId === saleId) || null
}

export function createInvoiceFromSale(sale) {
  const existing = getInvoiceBySale(sale.id)
  if (existing) return existing

  const list = listInvoices()
  const shortId = String(sale.id).replace(/^sale-/, '')
  const invoice = normalizeInvoice({
    invoiceNumber: nextDocNumber('INV', list, 'invoiceNumber') || `INV-${shortId}`,
    saleId: sale.id,
    quoteId: sale.quoteId || '',
    agentId: sale.agentId,
    customerName: sale.customerName,
    customerPhone: sale.customerPhone,
    customerEmail: sale.customerEmail,
    customerAddress: sale.customerAddress,
    lines: sale.lines,
    productId: sale.productId,
    productName: sale.productName,
    quantity: sale.quantity,
    unitPrice: sale.unitPrice,
    amount: sale.amount,
    status: sale.status === 'paid' || sale.status === 'fulfilled' ? 'paid' : 'draft',
    paymentMethod: sale.paymentMethod,
    issuedAt: sale.soldAt || new Date().toISOString(),
    notes: sale.notes || '',
    emailStatus: 'pending'
  })
  list.unshift(invoice)
  writeJson(INVOICES_KEY, list)
  return invoice
}

export function updateInvoice(payload) {
  const list = listInvoices()
  const next = normalizeInvoice(payload)
  const idx = list.findIndex((inv) => inv.id === next.id)
  if (idx < 0) {
    list.unshift(next)
  } else {
    list[idx] = { ...list[idx], ...next, id: list[idx].id, createdAt: list[idx].createdAt, invoiceNumber: list[idx].invoiceNumber }
  }
  writeJson(INVOICES_KEY, list)
  return list[idx >= 0 ? idx : 0]
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function companyFromAddress() {
  return (
    COMPANY.mailFrom ||
    `${COMPANY.fromName || COMPANY.name} <noreply@no-reply.auckmund.com>`
  )
}

function companyContactBlockHtml() {
  return `
  <p style="font-size:12px;color:#777;margin:20px 0 0;line-height:1.5;">
    <strong>${escapeHtml(COMPANY.legalName)}</strong><br>
    ${escapeHtml(COMPANY.address)}<br>
    ${escapeHtml(COMPANY.phone)} · ${escapeHtml(COMPANY.email)}
  </p>`.trim()
}

function productImageHtml(productId) {
  const img = resolveProductImage(productId)
  if (!img.src && !img.absolute) return ''
  // Prefer CID for reliable inline display; public URLs also work for /images/*
  if (img.isData) {
    return `<img src="cid:product-image" alt="Product" width="180" style="display:block;max-width:180px;border-radius:12px;margin:0 0 16px;border:1px solid #eee;" />`
  }
  return `<img src="${escapeHtml(img.absolute)}" alt="Product" width="180" style="display:block;max-width:180px;border-radius:12px;margin:0 0 16px;border:1px solid #eee;" />`
}

function linesImageHtml(doc) {
  const lines = normalizeLines(doc.lines, doc)
  return productImageHtml(lines[0]?.productId)
}

function linesTableRowsHtml(doc) {
  const lines = normalizeLines(doc.lines, doc)
  return lines
    .map(
      (line) => `
      <tr style="border-bottom:1px solid #eee;">
        <td style="padding:10px 0;">${escapeHtml(line.productName)}</td>
        <td style="padding:10px 0;">${escapeHtml(line.quantity)}</td>
        <td style="padding:10px 0;">${escapeHtml(formatMoney(line.unitPrice))}</td>
        <td style="padding:10px 0;text-align:right;">${escapeHtml(formatMoney(line.amount))}</td>
      </tr>`
    )
    .join('')
}

function linesTextBlock(doc) {
  return normalizeLines(doc.lines, doc)
    .map((line) => `${line.productName} × ${line.quantity} @ ${formatMoney(line.unitPrice)} = ${formatMoney(line.amount)}`)
    .join('\n')
}

export function buildInvoiceEmailPayload(invoice, { to } = {}) {
  const recipient = (to || invoice.customerEmail || '').trim()
  const subject = `Invoice ${invoice.invoiceNumber} from ${COMPANY.legalName}`
  const issued = invoice.issuedAt
    ? new Date(invoice.issuedAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : ''
  const html = `
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;color:#111;line-height:1.5;max-width:560px;margin:0 auto;padding:24px;">
  <h1 style="font-size:20px;margin:0 0 4px;">${escapeHtml(COMPANY.name)}</h1>
  <p style="margin:0 0 4px;color:#555;font-size:13px;">${escapeHtml(COMPANY.legalName)}</p>
  <p style="margin:0 0 20px;color:#555;font-size:13px;">${escapeHtml(COMPANY.address)}<br>${escapeHtml(COMPANY.phone)} · ${escapeHtml(COMPANY.email)}</p>
  <h2 style="font-size:18px;margin:0 0 8px;">Invoice ${escapeHtml(invoice.invoiceNumber)}</h2>
  <p style="margin:0 0 16px;color:#555;font-size:13px;">Issued ${escapeHtml(issued)}</p>
  ${linesImageHtml(invoice)}
  <p style="margin:0 0 4px;"><strong>Bill to</strong></p>
  <p style="margin:0 0 16px;">
    ${escapeHtml(invoice.customerName)}<br>
    ${escapeHtml(invoice.customerEmail || '')}<br>
    ${escapeHtml(invoice.customerPhone || '')}<br>
    ${escapeHtml(invoice.customerAddress || '')}
  </p>
  <table style="width:100%;border-collapse:collapse;margin:0 0 16px;font-size:14px;">
    <thead>
      <tr style="border-bottom:1px solid #ddd;text-align:left;">
        <th style="padding:8px 0;">Item</th>
        <th style="padding:8px 0;">Qty</th>
        <th style="padding:8px 0;">Unit</th>
        <th style="padding:8px 0;text-align:right;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${linesTableRowsHtml(invoice)}
    </tbody>
  </table>
  <p style="font-size:16px;font-weight:700;margin:0 0 16px;">Amount due: ${escapeHtml(formatMoney(invoice.amount))}</p>
  <p style="font-size:12px;color:#777;margin:0;">Payment: ${escapeHtml(invoice.paymentMethod || '—')}${invoice.notes ? ' · ' + escapeHtml(invoice.notes) : ''}</p>
  <p style="font-size:12px;color:#777;margin:12px 0 0;">A PDF copy of this invoice is attached.</p>
  ${companyContactBlockHtml()}
</body>
</html>`.trim()

  const text = [
    `${COMPANY.name} — Invoice ${invoice.invoiceNumber}`,
    COMPANY.legalName,
    COMPANY.address,
    `${COMPANY.phone} · ${COMPANY.email}`,
    '',
    `Bill to: ${invoice.customerName}`,
    invoice.customerAddress || '',
    linesTextBlock(invoice),
    `Total: ${formatMoney(invoice.amount)}`,
    `Payment: ${invoice.paymentMethod || '—'}`,
    '',
    'A PDF copy of this invoice is attached.'
  ].join('\n')

  return {
    from: companyFromAddress(),
    to: recipient ? [recipient] : [],
    subject,
    html,
    text
  }
}

export function buildQuoteEmailPayload(quote, { to } = {}) {
  const recipient = (to || quote.customerEmail || '').trim()
  const subject = `Quote ${quote.quoteNumber} from ${COMPANY.legalName}`
  const valid = quote.validUntil
    ? new Date(quote.validUntil).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : '—'
  const html = `
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;color:#111;line-height:1.5;max-width:560px;margin:0 auto;padding:24px;">
  <h1 style="font-size:20px;margin:0 0 4px;">${escapeHtml(COMPANY.name)}</h1>
  <p style="margin:0 0 4px;color:#555;font-size:13px;">${escapeHtml(COMPANY.legalName)}</p>
  <p style="margin:0 0 20px;color:#555;font-size:13px;">${escapeHtml(COMPANY.address)}<br>${escapeHtml(COMPANY.phone)} · ${escapeHtml(COMPANY.email)}</p>
  <h2 style="font-size:18px;margin:0 0 8px;">Quote ${escapeHtml(quote.quoteNumber)}</h2>
  <p style="margin:0 0 16px;color:#555;font-size:13px;">Valid until ${escapeHtml(valid)}</p>
  ${linesImageHtml(quote)}
  <p style="margin:0 0 4px;"><strong>Prepared for</strong></p>
  <p style="margin:0 0 16px;">
    ${escapeHtml(quote.customerName)}<br>
    ${escapeHtml(quote.customerEmail || '')}<br>
    ${escapeHtml(quote.customerPhone || '')}<br>
    ${escapeHtml(quote.customerAddress || '')}
  </p>
  <table style="width:100%;border-collapse:collapse;margin:0 0 16px;font-size:14px;">
    <thead>
      <tr style="border-bottom:1px solid #ddd;text-align:left;">
        <th style="padding:8px 0;">Item</th>
        <th style="padding:8px 0;">Qty</th>
        <th style="padding:8px 0;">Unit</th>
        <th style="padding:8px 0;text-align:right;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${linesTableRowsHtml(quote)}
    </tbody>
  </table>
  <p style="font-size:16px;font-weight:700;margin:0 0 16px;">Quoted total: ${escapeHtml(formatMoney(quote.amount))}</p>
  <p style="font-size:12px;color:#777;margin:0;">${quote.notes ? escapeHtml(quote.notes) : 'Reply to this email to accept or ask questions.'}</p>
  <p style="font-size:12px;color:#777;margin:12px 0 0;">A PDF copy of this quote is attached.</p>
  ${companyContactBlockHtml()}
</body>
</html>`.trim()

  const text = [
    `${COMPANY.name} — Quote ${quote.quoteNumber}`,
    COMPANY.legalName,
    COMPANY.address,
    `${COMPANY.phone} · ${COMPANY.email}`,
    '',
    `Prepared for: ${quote.customerName}`,
    linesTextBlock(quote),
    `Total: ${formatMoney(quote.amount)}`,
    `Valid until: ${valid}`,
    '',
    'A PDF copy of this quote is attached.'
  ].join('\n')

  return {
    from: companyFromAddress(),
    to: recipient ? [recipient] : [],
    subject,
    html,
    text
  }
}

async function deliverViaResend(payload) {
  const { apiSendEmail } = await import('./api.js')
  const res = await apiSendEmail({
    from: payload.from,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
    attachments: payload.attachments || []
  })
  if (!res.ok) {
    return {
      ok: false,
      error: res.error || res.data?.error || 'Email send failed',
      status: res.status,
      data: res.data
    }
  }
  return {
    ok: true,
    id: res.data?.id || res.data?.emailId || '',
    data: res.data
  }
}

/**
 * Send invoice email via Resend with product image + PDF attachment.
 */
export async function sendInvoiceEmail(invoiceId, { to } = {}) {
  const invoice = getInvoice(invoiceId)
  if (!invoice) {
    return { ok: false, error: 'Invoice not found' }
  }
  const payload = buildInvoiceEmailPayload(invoice, { to })
  if (!payload.to.length) {
    return { ok: false, error: 'Customer email is required', payload }
  }

  try {
    const { generateInvoicePdf } = await import('./salesDocuments.js')
    const pdf = await generateInvoicePdf(invoice)
    payload.attachments = [
      {
        filename: pdf.filename,
        content: pdf.base64
      }
    ]
    if (pdf.imageAttachment) payload.attachments.push(pdf.imageAttachment)
  } catch (err) {
    return { ok: false, error: err?.message || 'Could not generate invoice PDF' }
  }

  const delivered = await deliverViaResend(payload)
  if (!delivered.ok) {
    updateInvoice({
      ...invoice,
      emailStatus: 'failed',
      customerEmail: payload.to[0]
    })
    return { ok: false, error: delivered.error || 'Email send failed', payload }
  }

  const updated = updateInvoice({
    ...invoice,
    status: invoice.status === 'draft' ? 'sent' : invoice.status,
    sentAt: new Date().toISOString(),
    emailStatus: 'sent',
    customerEmail: payload.to[0],
    emailId: delivered.id || ''
  })

  return {
    ok: true,
    mode: 'resend',
    message: `Invoice emailed to ${payload.to[0]} (PDF attached)`,
    invoice: updated,
    resendPayload: payload,
    emailId: delivered.id
  }
}

/**
 * Send quote email via Resend with product image + PDF attachment.
 */
export async function sendQuoteEmail(quoteId, { to } = {}) {
  const quote = getQuote(quoteId)
  if (!quote) {
    return { ok: false, error: 'Quote not found' }
  }
  const payload = buildQuoteEmailPayload(quote, { to })
  if (!payload.to.length) {
    return { ok: false, error: 'Customer email is required', payload }
  }

  try {
    const { generateQuotePdf } = await import('./salesDocuments.js')
    const pdf = await generateQuotePdf(quote)
    payload.attachments = [
      {
        filename: pdf.filename,
        content: pdf.base64
      }
    ]
    if (pdf.imageAttachment) payload.attachments.push(pdf.imageAttachment)
  } catch (err) {
    return { ok: false, error: err?.message || 'Could not generate quote PDF' }
  }

  const delivered = await deliverViaResend(payload)
  if (!delivered.ok) {
    return { ok: false, error: delivered.error || 'Email send failed', payload }
  }

  const updated = saveQuote({
    ...quote,
    status: quote.status === 'draft' ? 'sent' : quote.status,
    customerEmail: payload.to[0],
    emailStatus: 'sent',
    emailedAt: new Date().toISOString()
  })

  return {
    ok: true,
    mode: 'resend',
    message: `Quote emailed to ${payload.to[0]} (PDF attached)`,
    quote: updated,
    resendPayload: payload,
    emailId: delivered.id
  }
}

/* ——— Cash flow ——— */

export function listCashFlow() {
  ensureSeeded()
  return readJson(CASH_KEY, []).map(normalizeCash)
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
}

export function addCashEntry(payload) {
  const list = listCashFlow()
  const next = normalizeCash(payload)
  list.unshift(next)
  writeJson(CASH_KEY, list)
  return next
}

export function updateCashEntry(payload) {
  const list = listCashFlow()
  const next = normalizeCash(payload)
  const idx = list.findIndex((c) => c.id === next.id)
  if (idx < 0) {
    list.unshift(next)
  } else {
    list[idx] = { ...list[idx], ...next, id: list[idx].id }
  }
  writeJson(CASH_KEY, list)
  return next
}

export function deleteCashEntry(id) {
  writeJson(CASH_KEY, listCashFlow().filter((c) => c.id !== id))
}

/* ——— Stats ——— */

export function getSalesStats() {
  const sales = listSales().filter((s) => s.status !== 'cancelled')
  const paid = sales.filter((s) => s.status === 'paid' || s.status === 'fulfilled')
  const pending = sales.filter((s) => s.status === 'pending')
  const cash = listCashFlow()
  const inflow = cash.filter((c) => c.type === 'in').reduce((s, c) => s + c.amount, 0)
  const outflow = cash.filter((c) => c.type === 'out').reduce((s, c) => s + c.amount, 0)
  const agents = listAgents()

  return {
    salesCount: sales.length,
    revenue: paid.reduce((s, x) => s + x.amount, 0),
    pendingAmount: pending.reduce((s, x) => s + x.amount, 0),
    commissions: paid.reduce((s, x) => s + x.commission, 0),
    inflow,
    outflow,
    balance: inflow - outflow,
    agentsActive: agents.filter((a) => a.active).length,
    agentsTotal: agents.length
  }
}

export function agentPerformance(agentId) {
  const sales = listSales().filter((s) => s.agentId === agentId && s.status !== 'cancelled')
  const paid = sales.filter((s) => s.status === 'paid' || s.status === 'fulfilled')
  return {
    salesCount: sales.length,
    revenue: paid.reduce((s, x) => s + x.amount, 0),
    commission: paid.reduce((s, x) => s + x.commission, 0),
    pending: sales.filter((s) => s.status === 'pending').length
  }
}

export function formatMoney(amount) {
  const n = Number(amount) || 0
  return 'N$ ' + n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export function clearSalesData() {
  writeJson(AGENTS_KEY, [])
  writeJson(SALES_KEY, [])
  writeJson(QUOTES_KEY, [])
  writeJson(INVOICES_KEY, [])
  writeJson(CASH_KEY, [])
  // Keep products — they live in Supabase; only clear local sales ops data
  localStorage.setItem(DATA_VERSION_KEY, DATA_VERSION)
}

/** @deprecated use clearSalesData() */
export function resetSalesDemo() {
  clearSalesData()
}
