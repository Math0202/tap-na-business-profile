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
  /** Cloudflare Email Sending (tapnam.com) */
  mailFrom: 'tap-na <welcome@tapnam.com>'
}

/** Bank details for EFT on quotes and unpaid invoices */
export const BANKING_DETAILS = {
  accountHolder: 'Tangeni Matheus',
  accountType: 'FUTURE FORWARD',
  accountNumber: '62272845812',
  branchCode: '280873',
  swiftCode: 'FIRNNANX'
}

/** Show banking block on invoices only when not yet paid (and not void). */
export function shouldIncludeBankingDetails(doc, { kind } = {}) {
  if (kind === 'quote') return true
  if (kind === 'invoice') {
    const status = String(doc?.status || '').toLowerCase()
    return status !== 'paid' && status !== 'void'
  }
  return false
}

export function bankingReferenceAdvice(docNumber, { kind } = {}) {
  const label = kind === 'quote' ? 'quote' : 'invoice'
  const num = String(docNumber || '').trim() || `your ${label} number`
  return `Please use your ${label} number as the payment reference: ${num}`
}

export function bankingDetailsLines(docNumber, { kind } = {}) {
  const b = BANKING_DETAILS
  return [
    bankingReferenceAdvice(docNumber, { kind }),
    `Reference: ${String(docNumber || '').trim() || (kind === 'quote' ? 'Quote number' : 'Invoice number')}`,
    `Account holder: ${b.accountHolder}`,
    `Account type: ${b.accountType}`,
    `Account number: ${b.accountNumber}`,
    `Branch code: ${b.branchCode}`,
    `Swift code: ${b.swiftCode}`
  ]
}

export function bankingDetailsHtml(docNumber, { kind } = {}) {
  const lines = bankingDetailsLines(docNumber, { kind })
  const advice = escapeHtml(lines[0])
  const rows = lines
    .slice(1)
    .map((line) => {
      const idx = line.indexOf(':')
      if (idx < 0) return `<div>${escapeHtml(line)}</div>`
      const label = escapeHtml(line.slice(0, idx + 1))
      const value = escapeHtml(line.slice(idx + 1).trim())
      return `<div><span style="color:#777;">${label}</span> ${value}</div>`
    })
    .join('')
  return `
  <div style="margin:16px 0;padding:14px 16px;border:1px solid #e5e5e5;border-radius:12px;background:#fafafa;font-size:13px;line-height:1.55;">
    <p style="margin:0 0 8px;font-weight:700;font-size:14px;">Banking details</p>
    <p style="margin:0 0 10px;color:#444;">${advice}</p>
    ${rows}
  </div>`.trim()
}

export function bankingDetailsText(docNumber, { kind } = {}) {
  return ['Banking details', ...bankingDetailsLines(docNumber, { kind })].join('\n')
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
        : 'https://tapnam.com'
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
    accessRole: a.accessRole === 'manager' ? 'manager' : 'sales',
    deleted: a.deleted === true,
    deletedAt: a.deletedAt || '',
    deletedBy: a.deletedBy || '',
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
    deleted: s.deleted === true,
    deletedAt: s.deletedAt || '',
    deletedBy: s.deletedBy || '',
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
    deleted: q.deleted === true,
    deletedAt: q.deletedAt || '',
    deletedBy: q.deletedBy || '',
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
    deleted: inv.deleted === true,
    deletedAt: inv.deletedAt || '',
    deletedBy: inv.deletedBy || '',
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
    deleted: c.deleted === true,
    deletedAt: c.deletedAt || '',
    deletedBy: c.deletedBy || '',
    at: c.at || new Date().toISOString()
  }
}

/* ——— Agents ——— */

export function listAgents({ includeDeleted = false } = {}) {
  ensureSeeded()
  let list = readJson(AGENTS_KEY, []).map(normalizeAgent)
  if (!includeDeleted) list = list.filter((a) => !a.deleted)
  return list.sort((a, b) => a.name.localeCompare(b.name))
}

export function getAgent(id) {
  return listAgents().find((a) => a.id === id) || null
}

export function saveAgent(payload) {
  const list = listAgents({ includeDeleted: true })
  const next = normalizeAgent(payload)
  const idx = list.findIndex((a) => a.id === next.id)
  if (idx >= 0) list[idx] = { ...list[idx], ...next, id: list[idx].id, createdAt: list[idx].createdAt }
  else list.push(next)
  writeJson(AGENTS_KEY, list)
  syncFinanceQuiet(async () => {
    const { apiUpsertSalesAgent } = await import('./api.js')
    await apiUpsertSalesAgent(next)
  })
  return next
}

/** Persist agent locally and wait for cloud upsert (admin create/edit path). */
export async function saveAgentToCloud(payload) {
  const next = saveAgent(payload)
  const { apiUpsertSalesAgent } = await import('./api.js')
  const res = await apiUpsertSalesAgent(next)
  if (!res.ok) {
    return { ok: false, error: res.error || 'Could not save agent to database', agent: next }
  }
  const remote = res.data?.agent
  if (remote) {
    const merged = normalizeAgent({ ...next, ...remote, id: next.id })
    const list = listAgents()
    const idx = list.findIndex((a) => a.id === merged.id)
    if (idx >= 0) list[idx] = merged
    else list.push(merged)
    writeJson(AGENTS_KEY, list)
    return { ok: true, agent: merged }
  }
  return { ok: true, agent: next }
}

function markLocalDeleted(key, id, normalize) {
  const list = readJson(key, []).map(normalize)
  const idx = list.findIndex((item) => item.id === id)
  if (idx < 0) return
  list[idx] = {
    ...list[idx],
    deleted: true,
    deletedAt: new Date().toISOString()
  }
  writeJson(key, list)
}

function markLocalRestored(key, id, normalize, remote = null) {
  const list = readJson(key, []).map(normalize)
  const idx = list.findIndex((item) => item.id === id)
  if (idx < 0 && remote) {
    list.unshift(normalize({ ...remote, deleted: false }))
  } else if (idx >= 0) {
    list[idx] = normalize({
      ...list[idx],
      ...(remote || {}),
      deleted: false,
      deletedAt: '',
      deletedBy: ''
    })
  }
  writeJson(key, list)
}

export function deleteAgent(id) {
  markLocalDeleted(AGENTS_KEY, id, normalizeAgent)
  syncFinanceQuiet(async () => {
    const { apiDeleteSalesAgent } = await import('./api.js')
    await apiDeleteSalesAgent(id)
  })
}

export async function restoreAgent(id) {
  const { apiRestoreSalesAgent } = await import('./api.js')
  const res = await apiRestoreSalesAgent(id)
  if (!res.ok) return { ok: false, error: res.error || 'Could not restore agent' }
  markLocalRestored(AGENTS_KEY, id, normalizeAgent, res.data?.agent)
  return { ok: true, agent: res.data?.agent }
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
    label: String(p.label || p.shop_label || '').trim(),
    badge: String(p.badge || p.shop_badge || '').trim(),
    deleted: p.deleted === true,
    deletedAt: p.deletedAt || '',
    deletedBy: p.deletedBy || '',
    createdAt: p.createdAt || new Date().toISOString()
  }
}

export function listProducts({ activeOnly = false, includeDeleted = false } = {}) {
  ensureSeeded()
  const source = Array.isArray(productsCache) ? productsCache : readJson(PRODUCTS_KEY, [])
  let list = source.map(normalizeProduct)
  if (!includeDeleted) list = list.filter((p) => !p.deleted)
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
    let res = await apiSalesProducts({ includeInactive, includeDeleted: true })
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
          label: p.label || p.shop_label || '',
          badge: p.badge || p.shop_badge || '',
          deleted: p.deleted === true,
          deletedAt: p.deletedAt || '',
          deletedBy: p.deletedBy || '',
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
  const list = listProducts({ includeDeleted: true }).map((p) =>
    p.id === id ? { ...p, deleted: true, deletedAt: new Date().toISOString() } : p
  )
  setProductsCache(list)
}

export async function restoreProduct(id) {
  ensureSeeded()
  const { apiRestoreSalesProduct } = await import('./api.js')
  const res = await apiRestoreSalesProduct(id)
  if (!res.ok) throw new Error(res.error || 'Could not restore product')
  const remote = res.data?.product
  const list = listProducts({ includeDeleted: true })
  const idx = list.findIndex((p) => p.id === id)
  const restored = normalizeProduct({ ...(list[idx] || {}), ...(remote || {}), deleted: false, deletedAt: '', deletedBy: '' })
  if (idx >= 0) list[idx] = restored
  else list.push(restored)
  setProductsCache(list)
  return restored
}

/** Clears local product cache only — DB catalog is managed by admin CRUD. */
export function resetProductsToDefaults() {
  setProductsCache([])
  return listProducts()
}

async function syncFinanceQuiet(fn) {
  try {
    await fn()
  } catch {
    /* offline / non-staff — keep local */
  }
}

function mergeById(localList, remoteList, normalize) {
  const map = new Map()
  for (const item of localList || []) {
    const n = normalize(item)
    if (n?.id) map.set(n.id, n)
  }
  for (const item of remoteList || []) {
    const n = normalize(item)
    if (!n?.id) continue
    const prev = map.get(n.id)
    // Remote wins on shared ids (cloud is source of truth once synced)
    map.set(n.id, prev ? normalize({ ...prev, ...n, id: n.id }) : n)
  }
  return [...map.values()]
}

async function pushAllLocalFinance() {
  const {
    apiUpsertSalesAgent,
    apiUpsertSalesOrder,
    apiUpsertSalesQuote,
    apiUpsertSalesInvoice,
    apiUpsertSalesCash
  } = await import('./api.js')
  for (const a of listAgents()) await apiUpsertSalesAgent(a)
  for (const s of listSales()) await apiUpsertSalesOrder(s)
  for (const q of listQuotes()) await apiUpsertSalesQuote(q)
  for (const inv of listInvoices()) await apiUpsertSalesInvoice(inv)
  for (const c of listCashFlow()) await apiUpsertSalesCash(c)
}

async function pushMissingFinance(remote) {
  const {
    apiUpsertSalesAgent,
    apiUpsertSalesOrder,
    apiUpsertSalesQuote,
    apiUpsertSalesInvoice,
    apiUpsertSalesCash
  } = await import('./api.js')
  const remoteAgentIds = new Set((remote.agents || []).map((a) => a.id))
  const remoteOrderIds = new Set((remote.orders || []).map((o) => o.id))
  const remoteQuoteIds = new Set((remote.quotes || []).map((q) => q.id))
  const remoteInvoiceIds = new Set((remote.invoices || []).map((i) => i.id))
  const remoteCashIds = new Set((remote.cashflow || []).map((c) => c.id))

  for (const a of listAgents()) {
    if (!remoteAgentIds.has(a.id)) await apiUpsertSalesAgent(a)
  }
  for (const s of listSales()) {
    if (!remoteOrderIds.has(s.id)) await apiUpsertSalesOrder(s)
  }
  for (const q of listQuotes()) {
    if (!remoteQuoteIds.has(q.id)) await apiUpsertSalesQuote(q)
  }
  for (const inv of listInvoices()) {
    if (!remoteInvoiceIds.has(inv.id)) await apiUpsertSalesInvoice(inv)
  }
  for (const c of listCashFlow()) {
    if (!remoteCashIds.has(c.id)) await apiUpsertSalesCash(c)
  }
}

/** Pull agents/orders/quotes/invoices/cash from Worker (admin = all agents). */
export async function refreshFinanceFromApi() {
  ensureSeeded()
  try {
    const { apiSalesFinance } = await import('./api.js')
    const { refreshStaffSession, getStaffAccessToken } = await import('./staffAuth.js')
    if (!getStaffAccessToken()) {
      await refreshStaffSession()
    }
    let res = await apiSalesFinance()
    if (res.status === 401) {
      const refreshed = await refreshStaffSession()
      if (refreshed) res = await apiSalesFinance()
    }
    if (!res.ok || !res.data) return false
    let data = res.data

    const localBefore = {
      agents: listAgents({ includeDeleted: true }),
      orders: listSales({ includeDeleted: true }),
      quotes: listQuotes({ includeDeleted: true }),
      invoices: listInvoices({ includeDeleted: true }),
      cashflow: listCashFlow({ includeDeleted: true })
    }

    const remoteEmpty = !(
      (data.agents && data.agents.length) ||
      (data.orders && data.orders.length) ||
      (data.quotes && data.quotes.length) ||
      (data.invoices && data.invoices.length) ||
      (data.cashflow && data.cashflow.length)
    )

    if (remoteEmpty) {
      const hasLocal =
        localBefore.agents.length ||
        localBefore.orders.length ||
        localBefore.quotes.length ||
        localBefore.invoices.length ||
        localBefore.cashflow.length
      if (hasLocal) {
        await pushAllLocalFinance()
        const again = await apiSalesFinance()
        if (again.ok && again.data) data = again.data
      }
    }

    // Merge so device-local rows are not wiped before they sync up
    const mergedAgents = mergeById(localBefore.agents, data.agents || [], normalizeAgent)
    const mergedOrders = mergeById(localBefore.orders, data.orders || [], normalizeSale)
    const mergedQuotes = mergeById(localBefore.quotes, data.quotes || [], normalizeQuote)
    const mergedInvoices = mergeById(localBefore.invoices, data.invoices || [], normalizeInvoice)
    const mergedCash = mergeById(localBefore.cashflow, data.cashflow || [], normalizeCash)

    writeJson(AGENTS_KEY, mergedAgents)
    writeJson(SALES_KEY, mergedOrders)
    writeJson(QUOTES_KEY, mergedQuotes)
    writeJson(INVOICES_KEY, mergedInvoices)
    writeJson(CASH_KEY, mergedCash)

    // Upload anything that still only exists on this device
    await pushMissingFinance({
      agents: data.agents || [],
      orders: data.orders || [],
      quotes: data.quotes || [],
      invoices: data.invoices || [],
      cashflow: data.cashflow || []
    })

    return true
  } catch {
    return false
  }
}

/* ——— Sales ——— */

export function listSales({ includeDeleted = false } = {}) {
  ensureSeeded()
  let list = readJson(SALES_KEY, []).map(normalizeSale)
  if (!includeDeleted) list = list.filter((s) => !s.deleted)
  return list.sort((a, b) => String(b.soldAt).localeCompare(String(a.soldAt)))
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

  const list = listSales({ includeDeleted: true })
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
  syncFinanceQuiet(async () => {
    const { apiUpsertSalesOrder } = await import('./api.js')
    const latest = listSales().find((s) => s.id === next.id) || next
    await apiUpsertSalesOrder(latest)
  })

  const cashCreated = []
  // Auto cash-in when newly marked paid / fulfilled (idempotent per sale)
  if (recordCash && (next.status === 'paid' || next.status === 'fulfilled')) {
    const wasPaid = existing && (existing.status === 'paid' || existing.status === 'fulfilled')
    if (!wasPaid || !cashForSale(next.id, 'sale')) {
      if (!cashForSale(next.id, 'sale')) {
        cashCreated.push(
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
        )
      }
      if (next.commission > 0 && next.agentId && !cashForSale(next.id, 'commission')) {
        cashCreated.push(
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
        )
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
      const paidNow = next.status === 'paid' || next.status === 'fulfilled'
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
        notes: next.notes,
        status: paidNow ? 'paid' : invoice.status
      })
    }
  }

  return { sale: next, invoice, isNew, cashCreated }
}

/** Persist sale (+ invoice/cash side effects) and wait for cloud upserts. */
export async function saveSaleToCloud(payload, opts = {}) {
  const result = saveSale(payload, opts)
  const { apiUpsertSalesOrder, apiUpsertSalesInvoice, apiUpsertSalesCash } = await import('./api.js')

  const orderRes = await apiUpsertSalesOrder(result.sale)
  if (!orderRes.ok) {
    return { ok: false, error: orderRes.error || 'Could not save sale to database', ...result }
  }

  // Cash must follow the order so sale_id FK succeeds
  for (const entry of result.cashCreated || []) {
    const cashRes = await apiUpsertSalesCash(entry)
    if (!cashRes.ok) {
      // Retry without sale link rather than losing the entry
      await apiUpsertSalesCash({ ...entry, saleId: '' })
    }
  }

  if (result.invoice) {
    await apiUpsertSalesInvoice(result.invoice)
  }

  const remote = orderRes.data?.order
  if (remote) {
    const merged = normalizeSale({ ...result.sale, ...remote, id: result.sale.id })
    const list = listSales()
    const idx = list.findIndex((s) => s.id === merged.id)
    if (idx >= 0) list[idx] = { ...list[idx], ...merged }
    else list.unshift(merged)
    writeJson(SALES_KEY, list)
    return { ok: true, ...result, sale: merged }
  }
  return { ok: true, ...result }
}

export function deleteSale(id) {
  markLocalDeleted(SALES_KEY, id, normalizeSale)
  syncFinanceQuiet(async () => {
    const { apiDeleteSalesOrder } = await import('./api.js')
    await apiDeleteSalesOrder(id)
  })
}

export async function restoreSale(id) {
  const { apiRestoreSalesOrder } = await import('./api.js')
  const res = await apiRestoreSalesOrder(id)
  if (!res.ok) return { ok: false, error: res.error || 'Could not restore sale' }
  markLocalRestored(SALES_KEY, id, normalizeSale, res.data?.order)
  return { ok: true, sale: res.data?.order }
}

/* ——— Quotes ——— */

export function listQuotes({ includeDeleted = false } = {}) {
  ensureSeeded()
  let list = readJson(QUOTES_KEY, []).map(normalizeQuote)
  if (!includeDeleted) list = list.filter((q) => !q.deleted)
  return list.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
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
  syncFinanceQuiet(async () => {
    const { apiUpsertSalesQuote } = await import('./api.js')
    await apiUpsertSalesQuote(next)
  })
  return next
}

export function deleteQuote(id) {
  markLocalDeleted(QUOTES_KEY, id, normalizeQuote)
  syncFinanceQuiet(async () => {
    const { apiDeleteSalesQuote } = await import('./api.js')
    await apiDeleteSalesQuote(id)
  })
}

export async function restoreQuote(id) {
  const { apiRestoreSalesQuote } = await import('./api.js')
  const res = await apiRestoreSalesQuote(id)
  if (!res.ok) return { ok: false, error: res.error || 'Could not restore quote' }
  markLocalRestored(QUOTES_KEY, id, normalizeQuote, res.data?.quote)
  return { ok: true, quote: res.data?.quote }
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

export function listInvoices({ includeDeleted = false } = {}) {
  ensureSeeded()
  let list = readJson(INVOICES_KEY, []).map(normalizeInvoice)
  if (!includeDeleted) list = list.filter((inv) => !inv.deleted)
  return list.sort((a, b) => String(b.issuedAt).localeCompare(String(a.issuedAt)))
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
  syncFinanceQuiet(async () => {
    const { apiUpsertSalesInvoice } = await import('./api.js')
    await apiUpsertSalesInvoice(invoice)
  })
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
  const saved = list[idx >= 0 ? idx : 0]
  syncFinanceQuiet(async () => {
    const { apiUpsertSalesInvoice } = await import('./api.js')
    await apiUpsertSalesInvoice(saved)
  })
  return saved
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
    `${COMPANY.fromName || COMPANY.name} <welcome@tapnam.com>`
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
  ${
    shouldIncludeBankingDetails(invoice, { kind: 'invoice' })
      ? bankingDetailsHtml(invoice.invoiceNumber, { kind: 'invoice' })
      : ''
  }
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
    ...(shouldIncludeBankingDetails(invoice, { kind: 'invoice' })
      ? [bankingDetailsText(invoice.invoiceNumber, { kind: 'invoice' }), '']
      : []),
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
  ${bankingDetailsHtml(quote.quoteNumber, { kind: 'quote' })}
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
    bankingDetailsText(quote.quoteNumber, { kind: 'quote' }),
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

async function deliverViaCloudflare(payload) {
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
 * Send invoice email via Cloudflare with product image + PDF attachment.
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

  const delivered = await deliverViaCloudflare(payload)
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
    mode: 'cloudflare',
    message: `Invoice emailed to ${payload.to[0]} (PDF attached)`,
    invoice: updated,
    emailPayload: payload,
    emailId: delivered.id
  }
}

/**
 * Send quote email via Cloudflare with product image + PDF attachment.
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

  const delivered = await deliverViaCloudflare(payload)
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
    mode: 'cloudflare',
    message: `Quote emailed to ${payload.to[0]} (PDF attached)`,
    quote: updated,
    emailPayload: payload,
    emailId: delivered.id
  }
}

/* ——— Cash flow ——— */

export function listCashFlow({ includeDeleted = false } = {}) {
  ensureSeeded()
  let list = readJson(CASH_KEY, []).map(normalizeCash)
  if (!includeDeleted) list = list.filter((c) => !c.deleted)
  return list.sort((a, b) => String(b.at).localeCompare(String(a.at)))
}

function cashForSale(saleId, category) {
  if (!saleId) return null
  return listCashFlow().find(
    (c) => c.saleId === saleId && (!category || c.category === category)
  )
}

export function addCashEntry(payload) {
  const list = listCashFlow()
  const next = normalizeCash(payload)
  list.unshift(next)
  writeJson(CASH_KEY, list)
  syncFinanceQuiet(async () => {
    const { apiUpsertSalesCash } = await import('./api.js')
    await apiUpsertSalesCash(next)
  })
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
  syncFinanceQuiet(async () => {
    const { apiUpsertSalesCash } = await import('./api.js')
    await apiUpsertSalesCash(list[idx >= 0 ? idx : 0])
  })
  return list[idx >= 0 ? idx : 0]
}

/** Persist cash entry locally and wait for cloud upsert. */
export async function saveCashEntryToCloud(payload) {
  const existingId = String(payload?.id || '').trim()
  const next = existingId
    ? updateCashEntry({ ...payload, id: existingId })
    : addCashEntry(payload)
  const { apiUpsertSalesCash } = await import('./api.js')
  const res = await apiUpsertSalesCash(next)
  if (!res.ok) {
    return { ok: false, error: res.error || 'Could not save cash entry', entry: next }
  }
  const remote = res.data?.entry
  if (remote) {
    const merged = normalizeCash({ ...next, ...remote, id: next.id })
    const list = listCashFlow()
    const idx = list.findIndex((c) => c.id === merged.id)
    if (idx >= 0) list[idx] = merged
    else list.unshift(merged)
    writeJson(CASH_KEY, list)
    return { ok: true, entry: merged }
  }
  return { ok: true, entry: next }
}

export function deleteCashEntry(id) {
  markLocalDeleted(CASH_KEY, id, normalizeCash)
  syncFinanceQuiet(async () => {
    const { apiDeleteSalesCash } = await import('./api.js')
    await apiDeleteSalesCash(id)
  })
}

export async function deleteCashEntryFromCloud(id) {
  markLocalDeleted(CASH_KEY, id, normalizeCash)
  const { apiDeleteSalesCash } = await import('./api.js')
  const res = await apiDeleteSalesCash(id)
  if (!res.ok) {
    return { ok: false, error: res.error || 'Could not delete cash entry' }
  }
  return { ok: true, id }
}

export async function restoreCashEntry(id) {
  const { apiRestoreSalesCash } = await import('./api.js')
  const res = await apiRestoreSalesCash(id)
  if (!res.ok) return { ok: false, error: res.error || 'Could not restore cash entry' }
  markLocalRestored(CASH_KEY, id, normalizeCash, res.data?.entry)
  return { ok: true, entry: res.data?.entry }
}

/** Summary helpers for the Cash tab (optionally scoped to a list). */
export function summarizeCashFlow(entries = listCashFlow()) {
  const list = (entries || []).map(normalizeCash)
  const inflow = list.filter((c) => c.type === 'in').reduce((s, c) => s + c.amount, 0)
  const outflow = list.filter((c) => c.type === 'out').reduce((s, c) => s + c.amount, 0)
  const byCategory = {}
  for (const c of list) {
    if (!byCategory[c.category]) byCategory[c.category] = { in: 0, out: 0 }
    byCategory[c.category][c.type === 'out' ? 'out' : 'in'] += c.amount
  }
  return {
    inflow,
    outflow,
    balance: inflow - outflow,
    count: list.length,
    byCategory
  }
}

/** Chronological list with running balance (newest first for display). */
export function cashEntriesWithRunningBalance(entries = listCashFlow()) {
  const asc = [...entries].map(normalizeCash).sort((a, b) => String(a.at).localeCompare(String(b.at)))
  let running = 0
  const withBal = asc.map((c) => {
    running += c.type === 'out' ? -c.amount : c.amount
    return { ...c, runningBalance: Math.round(running * 100) / 100 }
  })
  return withBal.reverse()
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
