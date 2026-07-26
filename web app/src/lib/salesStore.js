/**
 * Sales module store — agents, sales, quotes, invoices, and cash flow (localStorage).
 */

const AGENTS_KEY = 'tapna_sales_agents'
const SALES_KEY = 'tapna_sales_orders'
const QUOTES_KEY = 'tapna_sales_quotes'
const INVOICES_KEY = 'tapna_sales_invoices'
const PRODUCTS_KEY = 'tapna_sales_products'
const CASH_KEY = 'tapna_sales_cashflow'

export const DEFAULT_PRODUCTS = [
  { id: 'blue', name: 'Blue Edition', defaultPrice: 450, category: 'personal', active: true },
  { id: 'black', name: 'Black Edition', defaultPrice: 450, category: 'personal', active: true },
  { id: 'table-info', name: 'Business Info (Table)', defaultPrice: 650, category: 'table', active: true },
  { id: 'table-menu', name: 'Menu Card (Table)', defaultPrice: 650, category: 'table', active: true },
  { id: 'table-review', name: 'Google Review (Table)', defaultPrice: 550, category: 'table', active: true },
  { id: 'table-wifi', name: 'WiFi & Contact (Table)', defaultPrice: 550, category: 'table', active: true },
  { id: 'table-custom', name: 'Custom Menu (Table)', defaultPrice: 750, category: 'table', active: true },
  { id: 'other', name: 'Other / custom', defaultPrice: 0, category: 'other', active: true }
]

/** @deprecated use listProducts() — kept for callers that expect a static array at import time */
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
  legalName: 'AUCKMUND NFC',
  email: 'billing@tap-na.com',
  phone: '+264 81 000 0000',
  address: 'Windhoek, Namibia',
  currency: 'NAD'
}

const DEMO_AGENTS = [
  {
    id: 'ag-mira',
    name: 'Mira Shikongo',
    email: 'mira@tap-na.com',
    phone: '+264 81 700 1100',
    region: 'Windhoek',
    commissionRate: 10,
    active: true,
    notes: 'Top closer · personal cards',
    createdAt: '2026-01-10T09:00:00.000Z'
  },
  {
    id: 'ag-pete',
    name: 'Peter Angula',
    email: 'peter@tap-na.com',
    phone: '+264 81 700 2200',
    region: 'Swakopmund / Coast',
    commissionRate: 12,
    active: true,
    notes: 'Table / venue specialist',
    createdAt: '2026-02-01T11:00:00.000Z'
  },
  {
    id: 'ag-lara',
    name: 'Lara Botha',
    email: 'lara@tap-na.com',
    phone: '+264 81 700 3300',
    region: 'Walvis Bay',
    commissionRate: 8,
    active: false,
    notes: 'On leave',
    createdAt: '2026-03-15T08:30:00.000Z'
  }
]

const DEMO_SALES = [
  {
    id: 'sale-1001',
    agentId: 'ag-mira',
    customerName: 'Amina Nangolo',
    customerPhone: '+264 81 111 2200',
    customerEmail: 'amina@coastal.na',
    productId: 'blue',
    productName: 'Blue Edition',
    quantity: 1,
    unitPrice: 450,
    amount: 450,
    commission: 45,
    status: 'paid',
    paymentMethod: 'eft',
    soldAt: '2026-07-02T14:20:00.000Z',
    notes: 'Personal card · Windhoek',
    createdAt: '2026-07-02T14:20:00.000Z'
  },
  {
    id: 'sale-1002',
    agentId: 'ag-pete',
    customerName: 'Harbour Kitchen',
    customerPhone: '+264 64 555 010',
    customerEmail: 'hello@harbourkitchen.na',
    productId: 'table-menu',
    productName: 'Menu Card (Table)',
    quantity: 10,
    unitPrice: 650,
    amount: 6500,
    commission: 780,
    status: 'fulfilled',
    paymentMethod: 'eft',
    soldAt: '2026-07-08T10:00:00.000Z',
    notes: 'Bulk table order',
    createdAt: '2026-07-08T10:00:00.000Z'
  },
  {
    id: 'sale-1003',
    agentId: 'ag-mira',
    customerName: 'Jonas Shilongo',
    customerPhone: '+264 81 222 3300',
    customerEmail: 'jonas@studionorth.na',
    productId: 'black',
    productName: 'Black Edition',
    quantity: 2,
    unitPrice: 450,
    amount: 900,
    commission: 90,
    status: 'pending',
    paymentMethod: 'cash',
    soldAt: '2026-07-18T16:45:00.000Z',
    notes: 'Awaiting payment',
    createdAt: '2026-07-18T16:45:00.000Z'
  },
  {
    id: 'sale-1004',
    agentId: 'ag-pete',
    customerName: 'Desert Bean Café',
    customerPhone: '+264 61 555 220',
    customerEmail: 'hi@desertbean.na',
    productId: 'table-info',
    productName: 'Business Info (Table)',
    quantity: 4,
    unitPrice: 650,
    amount: 2600,
    commission: 312,
    status: 'paid',
    paymentMethod: 'card',
    soldAt: '2026-07-20T09:15:00.000Z',
    notes: '',
    createdAt: '2026-07-20T09:15:00.000Z'
  }
]

const DEMO_QUOTES = [
  {
    id: 'quote-2001',
    quoteNumber: 'Q-2026-001',
    agentId: 'ag-mira',
    customerName: 'Studio North',
    customerPhone: '+264 81 333 4400',
    customerEmail: 'hello@studionorth.na',
    productId: 'black',
    productName: 'Black Edition',
    quantity: 5,
    unitPrice: 450,
    amount: 2250,
    status: 'sent',
    validUntil: '2026-08-15T23:59:59.000Z',
    notes: 'Team cards for studio',
    saleId: '',
    createdAt: '2026-07-22T10:00:00.000Z'
  },
  {
    id: 'quote-2002',
    quoteNumber: 'Q-2026-002',
    agentId: 'ag-pete',
    customerName: 'Salt & Sand Lodge',
    customerPhone: '+264 64 555 900',
    customerEmail: 'ops@saltandsand.na',
    productId: 'table-review',
    productName: 'Google Review (Table)',
    quantity: 8,
    unitPrice: 550,
    amount: 4400,
    status: 'draft',
    validUntil: '2026-08-30T23:59:59.000Z',
    notes: 'Lobby + restaurant tables',
    saleId: '',
    createdAt: '2026-07-24T08:30:00.000Z'
  }
]

const DEMO_INVOICES = [
  {
    id: 'inv-3001',
    invoiceNumber: 'INV-2026-1001',
    saleId: 'sale-1001',
    quoteId: '',
    agentId: 'ag-mira',
    customerName: 'Amina Nangolo',
    customerPhone: '+264 81 111 2200',
    customerEmail: 'amina@coastal.na',
    productId: 'blue',
    productName: 'Blue Edition',
    quantity: 1,
    unitPrice: 450,
    amount: 450,
    status: 'paid',
    paymentMethod: 'eft',
    issuedAt: '2026-07-02T14:20:00.000Z',
    sentAt: '2026-07-02T14:30:00.000Z',
    emailStatus: 'sent',
    notes: '',
    createdAt: '2026-07-02T14:20:00.000Z'
  },
  {
    id: 'inv-3002',
    invoiceNumber: 'INV-2026-1002',
    saleId: 'sale-1002',
    quoteId: '',
    agentId: 'ag-pete',
    customerName: 'Harbour Kitchen',
    customerPhone: '+264 64 555 010',
    customerEmail: 'hello@harbourkitchen.na',
    productId: 'table-menu',
    productName: 'Menu Card (Table)',
    quantity: 10,
    unitPrice: 650,
    amount: 6500,
    status: 'sent',
    paymentMethod: 'eft',
    issuedAt: '2026-07-08T10:00:00.000Z',
    sentAt: '2026-07-08T10:10:00.000Z',
    emailStatus: 'sent',
    notes: 'Bulk table order',
    createdAt: '2026-07-08T10:00:00.000Z'
  }
]

const DEMO_CASH = [
  {
    id: 'cf-1',
    type: 'in',
    category: 'sale',
    amount: 450,
    method: 'eft',
    description: 'Sale #1001 · Blue Edition',
    saleId: 'sale-1001',
    agentId: 'ag-mira',
    at: '2026-07-02T14:25:00.000Z'
  },
  {
    id: 'cf-2',
    type: 'in',
    category: 'sale',
    amount: 6500,
    method: 'eft',
    description: 'Sale #1002 · Harbour Kitchen tables',
    saleId: 'sale-1002',
    agentId: 'ag-pete',
    at: '2026-07-08T10:05:00.000Z'
  },
  {
    id: 'cf-3',
    type: 'out',
    category: 'commission',
    amount: 780,
    method: 'eft',
    description: 'Commission · Peter Angula · Sale #1002',
    saleId: 'sale-1002',
    agentId: 'ag-pete',
    at: '2026-07-09T09:00:00.000Z'
  },
  {
    id: 'cf-4',
    type: 'out',
    category: 'stock',
    amount: 1200,
    method: 'eft',
    description: 'NFC blank card stock restock',
    saleId: '',
    agentId: '',
    at: '2026-07-12T11:30:00.000Z'
  },
  {
    id: 'cf-5',
    type: 'in',
    category: 'sale',
    amount: 2600,
    method: 'card',
    description: 'Sale #1004 · Desert Bean',
    saleId: 'sale-1004',
    agentId: 'ag-pete',
    at: '2026-07-20T09:20:00.000Z'
  },
  {
    id: 'cf-6',
    type: 'out',
    category: 'expense',
    amount: 350,
    method: 'cash',
    description: 'Courier · coastal deliveries',
    saleId: '',
    agentId: 'ag-pete',
    at: '2026-07-21T15:00:00.000Z'
  }
]

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
  if (!Array.isArray(readJson(AGENTS_KEY, null))) {
    writeJson(AGENTS_KEY, DEMO_AGENTS.slice())
  }
  if (!Array.isArray(readJson(SALES_KEY, null))) {
    writeJson(SALES_KEY, DEMO_SALES.slice())
  }
  if (!Array.isArray(readJson(QUOTES_KEY, null))) {
    writeJson(QUOTES_KEY, DEMO_QUOTES.slice())
  }
  if (!Array.isArray(readJson(INVOICES_KEY, null))) {
    writeJson(INVOICES_KEY, DEMO_INVOICES.slice())
  }
  if (!Array.isArray(readJson(PRODUCTS_KEY, null))) {
    writeJson(PRODUCTS_KEY, DEFAULT_PRODUCTS.map((p) => ({ ...p })))
  }
  if (!Array.isArray(readJson(CASH_KEY, null))) {
    writeJson(CASH_KEY, DEMO_CASH.slice())
  }
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
    createdAt: a.createdAt || new Date().toISOString()
  }
}

function normalizeSale(s) {
  const qty = Math.max(1, Number(s.quantity) || 1)
  const unit = Number(s.unitPrice) || 0
  const amount = s.amount != null ? Number(s.amount) : qty * unit
  const rate = Number(s.commissionRate)
  const commission =
    s.commission != null
      ? Number(s.commission)
      : Math.round(amount * ((Number.isFinite(rate) ? rate : 10) / 100) * 100) / 100
  return {
    id: s.id || uid('sale'),
    agentId: s.agentId || '',
    customerName: s.customerName || '',
    customerPhone: s.customerPhone || '',
    customerEmail: s.customerEmail || '',
    customerAddress: s.customerAddress || '',
    productId: s.productId || 'other',
    productName: s.productName || 'Other',
    quantity: qty,
    unitPrice: unit,
    amount,
    commission,
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
  const qty = Math.max(1, Number(q.quantity) || 1)
  const unit = Number(q.unitPrice) || 0
  const amount = q.amount != null ? Number(q.amount) : qty * unit
  return {
    id: q.id || uid('quote'),
    quoteNumber: q.quoteNumber || '',
    agentId: q.agentId || '',
    customerName: q.customerName || '',
    customerPhone: q.customerPhone || '',
    customerEmail: q.customerEmail || '',
    customerAddress: q.customerAddress || '',
    productId: q.productId || 'other',
    productName: q.productName || 'Other',
    quantity: qty,
    unitPrice: unit,
    amount,
    status: QUOTE_STATUSES.includes(q.status) ? q.status : 'draft',
    validUntil: q.validUntil || '',
    notes: q.notes || '',
    saleId: q.saleId || '',
    createdAt: q.createdAt || new Date().toISOString()
  }
}

function normalizeInvoice(inv) {
  const qty = Math.max(1, Number(inv.quantity) || 1)
  const unit = Number(inv.unitPrice) || 0
  const amount = inv.amount != null ? Number(inv.amount) : qty * unit
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
    productId: inv.productId || 'other',
    productName: inv.productName || 'Other',
    quantity: qty,
    unitPrice: unit,
    amount,
    status: INVOICE_STATUSES.includes(inv.status) ? inv.status : 'draft',
    paymentMethod: PAYMENT_METHODS.includes(inv.paymentMethod) ? inv.paymentMethod : 'eft',
    issuedAt: inv.issuedAt || new Date().toISOString(),
    sentAt: inv.sentAt || '',
    emailStatus: inv.emailStatus || 'pending',
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
  let list = readJson(PRODUCTS_KEY, []).map(normalizeProduct)
  if (activeOnly) list = list.filter((p) => p.active)
  return list.sort((a, b) => a.name.localeCompare(b.name))
}

export function getProduct(id) {
  return listProducts().find((p) => p.id === id) || null
}

export function saveProduct(payload) {
  const list = listProducts()
  const next = normalizeProduct(payload)
  const idx = list.findIndex((p) => p.id === next.id)
  if (idx >= 0) {
    list[idx] = {
      ...list[idx],
      ...next,
      id: list[idx].id,
      createdAt: list[idx].createdAt
    }
  } else {
    list.push(next)
  }
  writeJson(PRODUCTS_KEY, list)
  return next
}

export function deleteProduct(id) {
  writeJson(PRODUCTS_KEY, listProducts().filter((p) => p.id !== id))
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
  const product = getProduct(payload.productId)
  const qty = Math.max(1, Number(payload.quantity) || 1)
  const unit =
    payload.unitPrice != null
      ? Number(payload.unitPrice)
      : (product?.defaultPrice || 0)
  const amount = qty * unit
  const rate = agent ? Number(agent.commissionRate) : 10
  const commission = Math.round(amount * (rate / 100) * 100) / 100

  const next = normalizeSale({
    ...payload,
    productName: payload.productName || product?.name || 'Other',
    quantity: qty,
    unitPrice: unit,
    amount,
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
  const product = getProduct(payload.productId)
  const list = listQuotes()
  const qty = Math.max(1, Number(payload.quantity) || 1)
  const unit =
    payload.unitPrice != null
      ? Number(payload.unitPrice)
      : (product?.defaultPrice || 0)
  const next = normalizeQuote({
    ...payload,
    productName: payload.productName || product?.name || 'Other',
    quantity: qty,
    unitPrice: unit,
    amount: qty * unit,
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

export function buildInvoiceEmailPayload(invoice, { to } = {}) {
  const recipient = (to || invoice.customerEmail || '').trim()
  const subject = `Invoice ${invoice.invoiceNumber} from ${COMPANY.name}`
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
  <h1 style="font-size:20px;margin:0 0 4px;">${COMPANY.name}</h1>
  <p style="margin:0 0 20px;color:#555;font-size:13px;">${COMPANY.legalName} · ${COMPANY.address}</p>
  <h2 style="font-size:18px;margin:0 0 8px;">Invoice ${invoice.invoiceNumber}</h2>
  <p style="margin:0 0 16px;color:#555;font-size:13px;">Issued ${issued}</p>
  <p style="margin:0 0 4px;"><strong>Bill to</strong></p>
  <p style="margin:0 0 16px;">
    ${invoice.customerName}<br>
    ${invoice.customerEmail || ''}<br>
    ${invoice.customerPhone || ''}<br>
    ${invoice.customerAddress || ''}
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
      <tr style="border-bottom:1px solid #eee;">
        <td style="padding:10px 0;">${invoice.productName}</td>
        <td style="padding:10px 0;">${invoice.quantity}</td>
        <td style="padding:10px 0;">${formatMoney(invoice.unitPrice)}</td>
        <td style="padding:10px 0;text-align:right;">${formatMoney(invoice.amount)}</td>
      </tr>
    </tbody>
  </table>
  <p style="font-size:16px;font-weight:700;margin:0 0 16px;">Amount due: ${formatMoney(invoice.amount)}</p>
  <p style="font-size:12px;color:#777;margin:0;">Payment: ${invoice.paymentMethod || '—'}${invoice.notes ? ' · ' + invoice.notes : ''}</p>
  <p style="font-size:12px;color:#777;margin:16px 0 0;">Questions? ${COMPANY.email} · ${COMPANY.phone}</p>
</body>
</html>`.trim()

  const text = [
    `${COMPANY.name} — Invoice ${invoice.invoiceNumber}`,
    `Bill to: ${invoice.customerName}`,
    invoice.customerAddress || '',
    `${invoice.productName} × ${invoice.quantity} @ ${formatMoney(invoice.unitPrice)}`,
    `Total: ${formatMoney(invoice.amount)}`,
    `Payment: ${invoice.paymentMethod || '—'}`
  ].join('\n')

  // Shape matches Resend emails.send payload for a later API wiring
  return {
    from: `${COMPANY.name} <${COMPANY.email}>`,
    to: recipient ? [recipient] : [],
    subject,
    html,
    text
  }
}

/**
 * Send invoice email. Currently stubs locally and stores the Resend-ready payload.
 * Wire to Resend later: POST https://api.resend.com/emails with Authorization Bearer.
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

  // Stub until Resend API is connected
  const updated = updateInvoice({
    ...invoice,
    status: invoice.status === 'draft' ? 'sent' : invoice.status,
    sentAt: new Date().toISOString(),
    emailStatus: 'queued_for_resend',
    customerEmail: payload.to[0]
  })

  return {
    ok: true,
    mode: 'stub',
    message: 'Invoice queued for email (Resend not connected yet)',
    invoice: updated,
    resendPayload: payload
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

export function resetSalesDemo() {
  writeJson(AGENTS_KEY, DEMO_AGENTS.slice())
  writeJson(SALES_KEY, DEMO_SALES.slice())
  writeJson(QUOTES_KEY, DEMO_QUOTES.slice())
  writeJson(INVOICES_KEY, DEMO_INVOICES.slice())
  writeJson(PRODUCTS_KEY, DEFAULT_PRODUCTS.map((p) => ({ ...p })))
  writeJson(CASH_KEY, DEMO_CASH.slice())
}
