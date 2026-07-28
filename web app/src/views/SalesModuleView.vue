<script setup>
import { computed, ref, onMounted } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import BrandMark from '../components/BrandMark.vue'
import AdminBottomNav from '../components/AdminBottomNav.vue'
import {
  listAgents,
  saveAgent,
  deleteAgent,
  listSales,
  saveSale,
  deleteSale,
  listQuotes,
  saveQuote,
  deleteQuote,
  convertQuoteToSale,
  listInvoices,
  getInvoice,
  getInvoiceBySale,
  sendInvoiceEmail,
  sendQuoteEmail,
  updateInvoice,
  resolveProductImage,
  listProducts,
  saveProduct,
  deleteProduct,
  refreshProductsFromApi,
  listCashFlow,
  addCashEntry,
  updateCashEntry,
  deleteCashEntry,
  getSalesStats,
  agentPerformance,
  formatMoney,
  clearSalesData,
  emptyLine,
  PRODUCT_CATEGORIES,
  SALE_STATUSES,
  QUOTE_STATUSES,
  PAYMENT_METHODS,
  CASH_CATEGORIES,
  COMPANY
} from '../lib/salesStore'
import {
  provisionCardsForSale,
  provisionSlugs,
  listCardsForSale,
  cardsNeededForSale,
  assignSaleCardsToProfile,
  cardPublicUrl,
  cardQrUrl,
  kindLabel,
  kindIcon,
  kindFromProductId
} from '../lib/cardLinkStore'
import { apiProvisionCards } from '../lib/api'
import { LOCAL_ID } from '../lib/adminStore'
import { loadProfile } from '../lib/profileStore'
import { downloadInvoicePdf, downloadQuotePdf } from '../lib/salesDocuments'
import {
  isStaffAdmin,
  isStaffSales,
  staffAgentId,
  getStaffUser,
  staffLogout,
  upsertStaffSalesUser
} from '../lib/staffAuth'
import QRCode from 'qrcode'

const route = useRoute()
const router = useRouter()
const tab = ref('overview') // overview | sales | invoices | products | cash | agents
const salesListMode = ref('orders') // orders | quotes
const agents = ref([])
const sales = ref([])
const quotes = ref([])
const products = ref([])
const invoices = ref([])
const cash = ref([])
const stats = ref(getSalesStats())
const query = ref('')
const agentFilter = ref('')
const toast = ref('')

const canManageAgents = computed(() => isStaffAdmin())
const canManageProducts = computed(() => isStaffAdmin())
const isSalesScoped = computed(() => isStaffSales())
const myAgentId = computed(() => staffAgentId())
const staffLabel = computed(() => {
  const u = getStaffUser()
  if (!u) return ''
  if (u.role === 'admin') return 'Admin'
  return u.name || u.email || 'Sales'
})

const salesTabs = computed(() => {
  const tabs = [
    { id: 'overview', label: 'Overview', icon: 'dashboard' },
    { id: 'sales', label: 'Sales', icon: 'receipt_long' },
    { id: 'invoices', label: 'Invoices', icon: 'request_quote' },
    { id: 'products', label: 'Products', icon: 'inventory_2' },
    { id: 'cash', label: 'Cash', icon: 'account_balance_wallet' }
  ]
  if (canManageAgents.value) tabs.push({ id: 'agents', label: 'Agents', icon: 'group' })
  return tabs
})

const showSaleForm = ref(false)
const showQuoteForm = ref(false)
const showProductForm = ref(false)
const showCashForm = ref(false)
const showAgentForm = ref(false)
const showInvoice = ref(false)
const showQuoteEmail = ref(false)
const showCardsModal = ref(false)
const cardsSale = ref(null)
const saleCards = ref([])
const cardQrMap = ref({})
const activeInvoice = ref(null)
const activeQuote = ref(null)
const invoiceSending = ref(false)
const quoteSending = ref(false)
const invoicePdfBusy = ref(false)
const quotePdfBusy = ref(false)
const invoiceEmailTo = ref('')
const quoteEmailTo = ref('')
const editingSaleId = ref('')
const editingQuoteId = ref('')
const editingProductId = ref('')
const editingCashId = ref('')
const editingAgentId = ref('')

const saleForm = ref(emptySale())
const quoteForm = ref(emptyQuote())
const productForm = ref(emptyProduct())
const cashForm = ref(emptyCash())
const agentForm = ref(emptyAgent())

function emptySale() {
  return {
    id: '',
    agentId: '',
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    customerAddress: '',
    lines: [emptyLine()],
    status: 'pending',
    paymentMethod: 'eft',
    soldAt: new Date().toISOString().slice(0, 16),
    notes: '',
    quoteId: ''
  }
}

function emptyQuote() {
  const valid = new Date()
  valid.setDate(valid.getDate() + 30)
  return {
    id: '',
    agentId: '',
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    customerAddress: '',
    lines: [emptyLine()],
    status: 'draft',
    validUntil: valid.toISOString().slice(0, 10),
    notes: ''
  }
}

function cloneLines(lines, legacy = {}) {
  const raw = Array.isArray(lines) && lines.length
    ? lines
    : legacy.productId
      ? [{ productId: legacy.productId, productName: legacy.productName, quantity: legacy.quantity, unitPrice: legacy.unitPrice }]
      : [emptyLine()]
  return raw.map((line) => emptyLine(line.productId || '')).map((base, i) => ({
    ...base,
    productId: raw[i].productId || base.productId,
    productName: raw[i].productName || base.productName,
    quantity: Math.max(1, Number(raw[i].quantity) || 1),
    unitPrice: raw[i].unitPrice != null && raw[i].unitPrice !== ''
      ? Number(raw[i].unitPrice)
      : base.unitPrice
  }))
}

function linesTotal(lines) {
  return (lines || []).reduce(
    (sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0),
    0
  )
}

function docLinesLabel(doc) {
  if (Array.isArray(doc?.lines) && doc.lines.length > 1) return doc.productName
  return `${doc?.productName || 'Product'} × ${doc?.quantity || 1}`
}

function emptyProduct() {
  return {
    id: '',
    name: '',
    defaultPrice: 0,
    category: 'personal',
    active: true,
    description: '',
    images: [],
    video: ''
  }
}

function emptyCash() {
  return {
    id: '',
    type: 'in',
    category: 'sale',
    amount: 0,
    method: 'eft',
    description: '',
    agentId: '',
    at: new Date().toISOString().slice(0, 16)
  }
}

function emptyAgent() {
  return {
    id: '',
    name: '',
    email: '',
    phone: '',
    region: '',
    commissionRate: 10,
    active: true,
    notes: '',
    authUserId: '',
    loginEmail: '',
    loginPassword: ''
  }
}

async function refresh() {
  await refreshProductsFromApi({ includeInactive: true })
  const allAgents = listAgents()
  const allSales = listSales()
  const allQuotes = listQuotes()
  const allInvoices = listInvoices()
  const allCash = listCashFlow()
  products.value = listProducts()

  if (isSalesScoped.value) {
    const aid = myAgentId.value
    agents.value = allAgents.filter((a) => a.id === aid)
    sales.value = allSales.filter((s) => s.agentId === aid)
    quotes.value = allQuotes.filter((q) => q.agentId === aid)
    const saleIds = new Set(sales.value.map((s) => s.id))
    invoices.value = allInvoices.filter(
      (inv) => inv.agentId === aid || (inv.saleId && saleIds.has(inv.saleId))
    )
    cash.value = allCash.filter(
      (c) => c.agentId === aid || (c.saleId && saleIds.has(c.saleId))
    )
    const paid = sales.value.filter((s) => s.status === 'paid' || s.status === 'fulfilled')
    const pending = sales.value.filter((s) => s.status === 'pending')
    const inflow = cash.value.filter((c) => c.type === 'in').reduce((sum, c) => sum + (Number(c.amount) || 0), 0)
    const outflow = cash.value.filter((c) => c.type === 'out').reduce((sum, c) => sum + (Number(c.amount) || 0), 0)
    stats.value = {
      salesCount: sales.value.length,
      revenue: paid.reduce((sum, s) => sum + (Number(s.amount) || 0), 0),
      pendingAmount: pending.reduce((sum, s) => sum + (Number(s.amount) || 0), 0),
      commissions: paid.reduce((sum, s) => sum + (Number(s.commission) || 0), 0),
      inflow,
      outflow,
      balance: inflow - outflow,
      agentsActive: agents.value.filter((a) => a.active).length,
      agentsTotal: agents.value.length
    }
  } else {
    agents.value = allAgents
    sales.value = allSales
    quotes.value = allQuotes
    invoices.value = allInvoices
    cash.value = allCash
    stats.value = getSalesStats()
  }
}

function flash(msg) {
  toast.value = msg
  setTimeout(() => { toast.value = '' }, 2200)
}

function formatDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return '—'
  }
}

function formatDay(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  } catch {
    return '—'
  }
}

function agentName(id) {
  if (!id) return 'Unassigned'
  return (
    agents.value.find((a) => a.id === id)?.name ||
    listAgents().find((a) => a.id === id)?.name ||
    'Unassigned'
  )
}

const filteredSales = computed(() => {
  let list = sales.value
  if (!isSalesScoped.value && agentFilter.value) {
    list = list.filter((s) => s.agentId === agentFilter.value)
  }
  const q = query.value.trim().toLowerCase()
  if (!q) return list
  return list.filter((s) =>
    [s.customerName, s.productName, s.status, agentName(s.agentId), s.notes]
      .join(' ')
      .toLowerCase()
      .includes(q)
  )
})

/** Dashboard preview: admin sees every agent’s sales; sales sees own only (already scoped in refresh). */
const overviewSales = computed(() => sales.value.slice(0, 12))

const totalCommission = computed(() =>
  Number(stats.value?.commissions) ||
  sales.value
    .filter((s) => s.status === 'paid' || s.status === 'fulfilled')
    .reduce((sum, s) => sum + (Number(s.commission) || 0), 0)
)

const filteredQuotes = computed(() => {
  let list = quotes.value
  if (!isSalesScoped.value && agentFilter.value) {
    list = list.filter((item) => item.agentId === agentFilter.value)
  }
  const q = query.value.trim().toLowerCase()
  if (!q) return list
  return list.filter((item) =>
    [item.customerName, item.productName, item.status, item.quoteNumber, agentName(item.agentId), item.notes]
      .join(' ')
      .toLowerCase()
      .includes(q)
  )
})

const productOptions = computed(() => products.value.filter((p) => p.active))

const filteredProducts = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return products.value
  return products.value.filter((p) =>
    [p.name, p.category, p.description, String(p.defaultPrice)]
      .join(' ')
      .toLowerCase()
      .includes(q)
  )
})

const filteredCash = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return cash.value
  return cash.value.filter((c) =>
    [c.description, c.category, c.type, c.method, agentName(c.agentId)]
      .join(' ')
      .toLowerCase()
      .includes(q)
  )
})

const filteredInvoices = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return invoices.value
  return invoices.value.filter((inv) =>
    [inv.invoiceNumber, inv.customerName, inv.productName, inv.status, inv.customerEmail, inv.emailStatus]
      .join(' ')
      .toLowerCase()
      .includes(q)
  )
})

const agentRows = computed(() =>
  agents.value.map((a) => ({
    ...a,
    perf: agentPerformance(a.id)
  }))
)

const openQuotes = computed(() =>
  quotes.value.filter((q) => q.status === 'draft' || q.status === 'sent' || q.status === 'accepted')
)

const saleFormTotal = computed(() => linesTotal(saleForm.value.lines))
const quoteFormTotal = computed(() => linesTotal(quoteForm.value.lines))

function syncLineUnitPrice(lines, index) {
  const line = lines?.[index]
  if (!line) return
  const p =
    productOptions.value.find((x) => x.id === line.productId) ||
    products.value.find((x) => x.id === line.productId)
  if (p) line.unitPrice = p.defaultPrice
}

function onSaleLineProduct(index) {
  syncLineUnitPrice(saleForm.value.lines, index)
}

function onQuoteLineProduct(index) {
  syncLineUnitPrice(quoteForm.value.lines, index)
}

function addSaleLine() {
  saleForm.value.lines.push(emptyLine())
}

function removeSaleLine(index) {
  if (saleForm.value.lines.length <= 1) return
  saleForm.value.lines.splice(index, 1)
}

function addQuoteLine() {
  quoteForm.value.lines.push(emptyLine())
}

function removeQuoteLine(index) {
  if (quoteForm.value.lines.length <= 1) return
  quoteForm.value.lines.splice(index, 1)
}

function openNewSale() {
  editingSaleId.value = ''
  saleForm.value = emptySale()
  if (isSalesScoped.value && myAgentId.value) {
    saleForm.value.agentId = myAgentId.value
  } else {
    const active = agents.value.find((a) => a.active)
    if (active) saleForm.value.agentId = active.id
  }
  showSaleForm.value = true
}

function openEditSale(s) {
  editingSaleId.value = s.id
  saleForm.value = {
    id: s.id,
    agentId: s.agentId,
    customerName: s.customerName,
    customerPhone: s.customerPhone,
    customerEmail: s.customerEmail,
    customerAddress: s.customerAddress || '',
    lines: cloneLines(s.lines, s),
    status: s.status,
    paymentMethod: s.paymentMethod,
    soldAt: s.soldAt ? s.soldAt.slice(0, 16) : '',
    notes: s.notes,
    quoteId: s.quoteId || ''
  }
  showSaleForm.value = true
}

function openInvoiceModal(invoice) {
  if (!invoice) return
  activeInvoice.value = invoice
  invoiceEmailTo.value = invoice.customerEmail || ''
  showInvoice.value = true
}

function openInvoiceForSale(sale) {
  const inv = sale.invoiceId ? getInvoice(sale.invoiceId) : getInvoiceBySale(sale.id)
  if (!inv) {
    flash('No invoice for this sale yet')
    return
  }
  openInvoiceModal(inv)
}

async function refreshSaleCards(sale) {
  saleCards.value = listCardsForSale(sale.id)
  const map = {}
  await Promise.all(
    saleCards.value.map(async (c) => {
      try {
        map[c.serial] = await QRCode.toDataURL(cardQrUrl(c.serial, undefined, { kind: c.kind }), {
          width: 160,
          margin: 1,
          color: { dark: '#0a0a0a', light: '#ffffff' }
        })
      } catch {
        map[c.serial] = ''
      }
    })
  )
  cardQrMap.value = map
}

async function openCardsForSale(sale) {
  cardsSale.value = sale
  showCardsModal.value = true
  await refreshSaleCards(sale)
}

async function generateCardsForSale() {
  if (!cardsSale.value) return
  const needed = cardsNeededForSale(cardsSale.value)
  if (needed <= 0) {
    flash('All cards already provisioned')
    return
  }
  const kind = kindFromProductId(cardsSale.value.productId)
  const remote = await apiProvisionCards({ count: needed, kind })
  let created
  if (remote.ok && remote.data?.cards?.length) {
    created = provisionSlugs({
      count: needed,
      kind,
      productId: cardsSale.value.productId,
      productName: cardsSale.value.productName,
      saleId: cardsSale.value.id,
      customerName: cardsSale.value.customerName || '',
      remoteCards: remote.data.cards
    })
  } else {
    created = provisionCardsForSale(cardsSale.value)
  }
  refresh()
  await refreshSaleCards(cardsSale.value)
  flash(created.length ? `${created.length} card code(s) created` : 'All cards already provisioned')
}

function linkSaleCardsToLocal() {
  if (!cardsSale.value) return
  const profile = loadProfile()
  const results = assignSaleCardsToProfile(cardsSale.value.id, {
    profileId: LOCAL_ID,
    profileName: profile.company || profile.name || 'My profile',
    profile
  })
  const ok = results.filter((r) => r.ok).length
  refresh()
  refreshSaleCards(cardsSale.value)
  flash(`${ok} card(s) linked to this device profile`)
}

function copyCardUrl(serial, via) {
  const card = saleCards.value.find((c) => c.serial === serial)
  const kind = card?.kind
  const url = via === 'qr'
    ? cardQrUrl(serial, undefined, { kind })
    : cardPublicUrl(serial, undefined, { kind })
  navigator.clipboard?.writeText(url).then(
    () => flash(via === 'qr' ? 'QR URL copied' : 'NFC URL copied'),
    () => flash(url)
  )
}

function submitSale(e) {
  e.preventDefault()
  if (!saleForm.value.customerName.trim()) {
    flash('Customer name is required')
    return
  }
  const wasEdit = Boolean(editingSaleId.value)
  const payload = {
    ...saleForm.value,
    id: editingSaleId.value || undefined,
    agentId: isSalesScoped.value ? myAgentId.value : saleForm.value.agentId,
    soldAt: saleForm.value.soldAt
      ? new Date(saleForm.value.soldAt).toISOString()
      : new Date().toISOString()
  }
  const result = saveSale(payload)
  showSaleForm.value = false
  refresh()
  if (!wasEdit && result.sale) {
    provisionCardsForSale(result.sale)
    flash('Sale recorded · invoice & card codes ready')
    if (result.invoice) openInvoiceModal(result.invoice)
  } else {
    flash(wasEdit ? 'Sale updated' : 'Sale recorded')
  }
}

function removeSale(id) {
  if (!confirm('Delete this sale?')) return
  deleteSale(id)
  refresh()
  flash('Sale deleted')
}

function openNewQuote() {
  editingQuoteId.value = ''
  quoteForm.value = emptyQuote()
  if (isSalesScoped.value && myAgentId.value) {
    quoteForm.value.agentId = myAgentId.value
  } else {
    const active = agents.value.find((a) => a.active)
    if (active) quoteForm.value.agentId = active.id
  }
  salesListMode.value = 'quotes'
  tab.value = 'sales'
  showQuoteForm.value = true
}

function openEditQuote(q) {
  editingQuoteId.value = q.id
  quoteForm.value = {
    id: q.id,
    agentId: q.agentId,
    customerName: q.customerName,
    customerPhone: q.customerPhone,
    customerEmail: q.customerEmail,
    customerAddress: q.customerAddress || '',
    lines: cloneLines(q.lines, q),
    status: q.status,
    validUntil: q.validUntil ? q.validUntil.slice(0, 10) : '',
    notes: q.notes
  }
  showQuoteForm.value = true
}

function submitQuote(e) {
  e.preventDefault()
  if (!quoteForm.value.customerName.trim()) {
    flash('Customer name is required')
    return
  }
  saveQuote({
    ...quoteForm.value,
    id: editingQuoteId.value || undefined,
    agentId: isSalesScoped.value ? myAgentId.value : quoteForm.value.agentId,
    validUntil: quoteForm.value.validUntil
      ? new Date(quoteForm.value.validUntil + 'T23:59:59').toISOString()
      : ''
  })
  showQuoteForm.value = false
  refresh()
  flash(editingQuoteId.value ? 'Quote updated' : 'Quote created')
}

function removeQuote(id) {
  if (!confirm('Delete this quote?')) return
  deleteQuote(id)
  refresh()
  flash('Quote deleted')
}

function convertQuote(q) {
  if (!confirm(`Convert ${q.quoteNumber} to a sale and generate an invoice?`)) return
  const result = convertQuoteToSale(q.id)
  refresh()
  salesListMode.value = 'orders'
  flash('Quote converted · invoice ready')
  if (result.invoice) openInvoiceModal(result.invoice)
}

function openEditProduct(p) {
  if (!canManageProducts.value) {
    flash('Only admins can edit products')
    return
  }
  editingProductId.value = p.id
  productForm.value = {
    id: p.id,
    name: p.name,
    defaultPrice: p.defaultPrice,
    category: p.category,
    active: p.active,
    description: p.description || '',
    images: Array.isArray(p.images) ? p.images.slice() : [],
    video: p.video || ''
  }
  productVideoUrl.value = p.video && !String(p.video).startsWith('data:') ? p.video : ''
  productMediaFeedback.value = ''
  showProductForm.value = true
}

function openNewProduct() {
  if (!canManageProducts.value) {
    flash('Only admins can add products')
    return
  }
  editingProductId.value = ''
  productForm.value = emptyProduct()
  productVideoUrl.value = ''
  productMediaFeedback.value = ''
  showProductForm.value = true
}

const productImageInput = ref(null)
const productVideoInput = ref(null)
const productVideoUrl = ref('')
const productMediaFeedback = ref('')

const MAX_IMAGE_BYTES = 20 * 1024 * 1024
const MAX_VIDEO_BYTES = 20 * 1024 * 1024

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('read failed'))
    reader.readAsDataURL(file)
  })
}

async function onProductImagesChange(e) {
  const files = Array.from(e.target.files || [])
  e.target.value = ''
  if (!files.length) return
  let added = 0
  for (const file of files) {
    if (!file.type.startsWith('image/')) {
      productMediaFeedback.value = 'Only image files are allowed.'
      continue
    }
    if (file.size > MAX_IMAGE_BYTES) {
      productMediaFeedback.value = 'Each image must be under 20 MB.'
      continue
    }
    try {
      const dataUrl = await readFileAsDataUrl(file)
      productForm.value.images = [...(productForm.value.images || []), dataUrl]
      added += 1
    } catch {
      productMediaFeedback.value = 'Could not read that image.'
    }
  }
  if (added) {
    productMediaFeedback.value = added === 1 ? 'Image added.' : `${added} images added.`
  }
}

function removeProductImage(index) {
  productForm.value.images = (productForm.value.images || []).filter((_, i) => i !== index)
}

async function onProductVideoFileChange(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  if (!file.type.startsWith('video/')) {
    productMediaFeedback.value = 'Please choose a video file.'
    return
  }
  if (file.size > MAX_VIDEO_BYTES) {
    productMediaFeedback.value = 'Video must be under 20 MB (or paste a YouTube / video link).'
    return
  }
  try {
    productForm.value.video = await readFileAsDataUrl(file)
    productVideoUrl.value = ''
    productMediaFeedback.value = 'Video file ready to save.'
  } catch {
    productMediaFeedback.value = 'Could not read that video.'
  }
}

function applyProductVideoUrl() {
  const url = productVideoUrl.value.trim()
  if (!url) {
    if (!String(productForm.value.video || '').startsWith('data:')) {
      productForm.value.video = ''
    }
    return
  }
  productForm.value.video = url
  productMediaFeedback.value = 'Video link set.'
}

function clearProductVideo() {
  productForm.value.video = ''
  productVideoUrl.value = ''
  productMediaFeedback.value = 'Video removed.'
}

function isProductVideoData(src) {
  return String(src || '').startsWith('data:video')
}

function productThumb(p) {
  return (p.images && p.images[0]) || ''
}

async function submitProduct(e) {
  e.preventDefault()
  if (!canManageProducts.value) {
    flash('Only admins can edit products')
    return
  }
  if (!productForm.value.name.trim()) {
    flash('Product name is required')
    return
  }
  applyProductVideoUrl()
  try {
    await saveProduct({
      ...productForm.value,
      id: editingProductId.value || undefined,
      defaultPrice: Number(productForm.value.defaultPrice) || 0,
      images: productForm.value.images || [],
      video: productForm.value.video || ''
    })
    showProductForm.value = false
    await refresh()
    flash(editingProductId.value ? 'Product updated' : 'Product added')
  } catch (err) {
    flash(err?.message || 'Could not save product')
  }
}

async function removeProduct(id) {
  if (!canManageProducts.value) {
    flash('Only admins can delete products')
    return
  }
  if (!confirm('Delete this product?')) return
  try {
    await deleteProduct(id)
    await refresh()
    flash('Product deleted')
  } catch (err) {
    flash(err?.message || 'Could not delete product')
  }
}

function productThumbFor(productId) {
  return resolveProductImage(productId).src || resolveProductImage(productId).absolute || ''
}

async function downloadActiveInvoicePdf() {
  if (!activeInvoice.value) return
  invoicePdfBusy.value = true
  try {
    await downloadInvoicePdf(activeInvoice.value)
    flash('Invoice PDF downloaded')
  } catch (err) {
    flash(err?.message || 'Could not create PDF')
  } finally {
    invoicePdfBusy.value = false
  }
}

async function downloadActiveQuotePdf() {
  if (!activeQuote.value) return
  quotePdfBusy.value = true
  try {
    await downloadQuotePdf(activeQuote.value)
    flash('Quote PDF downloaded')
  } catch (err) {
    flash(err?.message || 'Could not create PDF')
  } finally {
    quotePdfBusy.value = false
  }
}

async function sendActiveInvoice() {
  if (!activeInvoice.value) return
  invoiceSending.value = true
  try {
    const result = await sendInvoiceEmail(activeInvoice.value.id, {
      to: invoiceEmailTo.value.trim()
    })
    if (!result.ok) {
      flash(result.error || 'Could not send invoice')
      return
    }
    activeInvoice.value = result.invoice
    refresh()
    flash(result.message || 'Invoice emailed')
  } finally {
    invoiceSending.value = false
  }
}

function markInvoicePaid() {
  if (!activeInvoice.value) return
  const updated = updateInvoice({
    ...activeInvoice.value,
    status: 'paid'
  })
  // Mirror sale status when linked
  if (updated.saleId) {
    const sale = sales.value.find((s) => s.id === updated.saleId)
    if (sale && sale.status !== 'paid' && sale.status !== 'fulfilled') {
      saveSale({ ...sale, status: 'paid' })
    }
  }
  activeInvoice.value = updated
  refresh()
  flash('Invoice marked paid')
}

function openQuoteEmail(q) {
  activeQuote.value = q
  quoteEmailTo.value = q.customerEmail || ''
  showQuoteEmail.value = true
}

async function sendActiveQuote() {
  if (!activeQuote.value) return
  quoteSending.value = true
  try {
    const result = await sendQuoteEmail(activeQuote.value.id, {
      to: quoteEmailTo.value.trim()
    })
    if (!result.ok) {
      flash(result.error || 'Could not send quote')
      return
    }
    activeQuote.value = result.quote
    refresh()
    flash(result.message || 'Quote emailed')
  } finally {
    quoteSending.value = false
  }
}

function openNewCash() {
  editingCashId.value = ''
  cashForm.value = emptyCash()
  if (isSalesScoped.value && myAgentId.value) {
    cashForm.value.agentId = myAgentId.value
  }
  showCashForm.value = true
}

function openEditCash(c) {
  editingCashId.value = c.id
  cashForm.value = {
    id: c.id,
    type: c.type,
    category: c.category,
    amount: c.amount,
    method: c.method,
    description: c.description,
    agentId: c.agentId,
    at: c.at ? c.at.slice(0, 16) : ''
  }
  showCashForm.value = true
}

function submitCash(e) {
  e.preventDefault()
  if (!cashForm.value.description.trim() || !(Number(cashForm.value.amount) > 0)) {
    flash('Description and amount are required')
    return
  }
  const payload = {
    ...cashForm.value,
    agentId: isSalesScoped.value ? myAgentId.value : cashForm.value.agentId,
    amount: Number(cashForm.value.amount),
    at: cashForm.value.at
      ? new Date(cashForm.value.at).toISOString()
      : new Date().toISOString()
  }
  if (editingCashId.value) updateCashEntry({ ...payload, id: editingCashId.value })
  else addCashEntry(payload)
  showCashForm.value = false
  refresh()
  flash(editingCashId.value ? 'Cash entry updated' : 'Cash entry added')
}

function removeCash(id) {
  if (!confirm('Delete this cash entry?')) return
  deleteCashEntry(id)
  refresh()
  flash('Cash entry deleted')
}

function openNewAgent() {
  if (!canManageAgents.value) return
  editingAgentId.value = ''
  agentForm.value = emptyAgent()
  showAgentForm.value = true
}

function openEditAgent(a) {
  if (!canManageAgents.value) return
  editingAgentId.value = a.id
  agentForm.value = {
    id: a.id,
    name: a.name,
    email: a.email,
    phone: a.phone,
    region: a.region,
    commissionRate: a.commissionRate,
    active: a.active,
    notes: a.notes,
    authUserId: a.authUserId || '',
    loginEmail: a.loginEmail || a.email || '',
    loginPassword: ''
  }
  showAgentForm.value = true
}

async function submitAgent(e) {
  e.preventDefault()
  if (!canManageAgents.value) return
  if (!agentForm.value.name.trim()) {
    flash('Agent name is required')
    return
  }
  const saved = saveAgent({
    ...agentForm.value,
    id: editingAgentId.value || undefined,
    commissionRate: Number(agentForm.value.commissionRate) || 0,
    loginEmail: (agentForm.value.loginEmail || agentForm.value.email || '').trim().toLowerCase()
  })

  const loginEmail = (agentForm.value.loginEmail || agentForm.value.email || '').trim().toLowerCase()
  const loginPassword = String(agentForm.value.loginPassword || '')
  if (loginEmail && (loginPassword || saved.authUserId)) {
    const result = await upsertStaffSalesUser({
      email: loginEmail,
      password: loginPassword || undefined,
      agentId: saved.id,
      name: saved.name,
      authUserId: saved.authUserId || undefined
    })
    if (!result.ok) {
      flash(result.error || 'Agent saved, but login could not be set')
      showAgentForm.value = false
      refresh()
      return
    }
    saveAgent({
      ...saved,
      authUserId: result.data?.user?.id || saved.authUserId,
      loginEmail
    })
  }

  showAgentForm.value = false
  refresh()
  flash(editingAgentId.value ? 'Agent updated' : 'Agent added')
}

function removeAgent(id) {
  if (!canManageAgents.value) return
  if (!confirm('Remove this sales agent?')) return
  deleteAgent(id)
  refresh()
  flash('Agent removed')
}

function statusClass(status) {
  if (status === 'paid' || status === 'fulfilled' || status === 'accepted' || status === 'converted') {
    return 'bg-emerald-500/15 text-emerald-300'
  }
  if (status === 'pending' || status === 'sent' || status === 'draft') {
    return 'bg-amber-500/15 text-amber-300'
  }
  return 'bg-red-500/15 text-red-300'
}

function reseeds() {
  if (!canManageAgents.value) {
    flash('Only admins can clear sales data')
    return
  }
  if (!confirm('Clear all sales, quotes, invoices, cash entries, and agents? Products in the database are kept.')) {
    return
  }
  clearSalesData()
  refresh()
  flash('Sales data cleared')
}

async function logoutStaff() {
  await staffLogout()
  router.replace('/admin/login')
}

onMounted(() => {
  const t = route.query.tab
  const allowed = salesTabs.value.map((x) => x.id)
  if (allowed.includes(t)) tab.value = t
  else if (t === 'agents' && !canManageAgents.value) tab.value = 'overview'
  if (route.query.mode === 'quotes') {
    tab.value = 'sales'
    salesListMode.value = 'quotes'
  }
  refresh()
})
</script>

<template>
  <div class="min-h-screen flex flex-col items-center overflow-x-hidden">
    <main class="w-full max-w-3xl min-h-screen flex flex-col relative z-10 px-5 pt-16 pb-36">
      <header class="mb-5">
        <div class="flex items-start justify-between gap-3">
          <div>
            <BrandMark size="sm" class="mb-2" />
            <h1 class="text-2xl font-bold tracking-tight mt-1">Sales</h1>
            <p class="text-gray-400 text-sm mt-1">
              {{ isSalesScoped
                ? 'Your quotes, sales, invoices, and cash'
                : 'Manage quotes, sales, invoices, cash flow, and agents' }}
            </p>
          </div>
          <div class="text-right shrink-0">
            <p class="text-[11px] uppercase tracking-wide text-gray-500">{{ staffLabel }}</p>
            <button type="button" class="text-xs font-semibold text-gray-300 hover:text-white mt-1" @click="logoutStaff">
              Log out
            </button>
          </div>
        </div>
      </header>

      <div class="flex gap-2 overflow-x-auto pb-1 mb-6 -mx-1 px-1">
        <button
          v-for="t in salesTabs"
          :key="t.id"
          type="button"
          class="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-full text-xs font-semibold border shrink-0 transition-colors"
          :class="tab === t.id
            ? 'bg-white text-black border-white'
            : 'bg-transparent text-gray-400 border-[var(--border)]'"
          @click="tab = t.id; query = ''"
        >
          <span class="material-symbols-outlined text-[16px]">{{ t.icon }}</span>
          {{ t.label }}
        </button>
      </div>

      <!-- Overview -->
      <section v-if="tab === 'overview'" class="space-y-6 mb-8">
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div class="card-item-bg rounded-2xl p-4">
            <p class="text-[11px] uppercase tracking-wide text-gray-500">Revenue (paid)</p>
            <p class="text-xl font-bold mt-1">{{ formatMoney(stats.revenue) }}</p>
          </div>
          <div class="card-item-bg rounded-2xl p-4">
            <p class="text-[11px] uppercase tracking-wide text-gray-500">
              {{ isSalesScoped ? 'Your commission' : 'Commissions (paid)' }}
            </p>
            <p class="text-xl font-bold mt-1 text-emerald-300">{{ formatMoney(totalCommission) }}</p>
          </div>
          <div class="card-item-bg rounded-2xl p-4">
            <p class="text-[11px] uppercase tracking-wide text-gray-500">Pending</p>
            <p class="text-xl font-bold mt-1 text-amber-300">{{ formatMoney(stats.pendingAmount) }}</p>
          </div>
          <div class="card-item-bg rounded-2xl p-4">
            <p class="text-[11px] uppercase tracking-wide text-gray-500">Cash balance</p>
            <p class="text-xl font-bold mt-1" :class="stats.balance >= 0 ? 'text-emerald-400' : 'text-red-400'">
              {{ formatMoney(stats.balance) }}
            </p>
          </div>
          <div class="card-item-bg rounded-2xl p-4">
            <p class="text-[11px] uppercase tracking-wide text-gray-500">Open quotes</p>
            <p class="text-xl font-bold mt-1">{{ openQuotes.length }}</p>
          </div>
          <div class="card-item-bg rounded-2xl p-4">
            <p class="text-[11px] uppercase tracking-wide text-gray-500">Invoices</p>
            <p class="text-xl font-bold mt-1">{{ invoices.length }}</p>
          </div>
          <div class="card-item-bg rounded-2xl p-4">
            <p class="text-[11px] uppercase tracking-wide text-gray-500">Products</p>
            <p class="text-xl font-bold mt-1">{{ products.filter((p) => p.active).length }}</p>
          </div>
          <div v-if="!isSalesScoped" class="card-item-bg rounded-2xl p-4">
            <p class="text-[11px] uppercase tracking-wide text-gray-500">Active agents</p>
            <p class="text-xl font-bold mt-1">{{ stats.agentsActive }} / {{ stats.agentsTotal }}</p>
          </div>
        </div>

        <div>
          <div class="flex items-center justify-between gap-3 mb-3">
            <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-400">
              {{ isSalesScoped ? 'Your sales' : 'All sales transactions' }}
            </h2>
            <button
              type="button"
              class="text-xs font-semibold text-gray-300 hover:text-white"
              @click="tab = 'sales'; salesListMode = 'orders'"
            >
              View all
            </button>
          </div>
          <ul v-if="overviewSales.length" class="space-y-2">
            <li
              v-for="s in overviewSales"
              :key="s.id"
              class="card-item-bg rounded-2xl p-4"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <p class="text-sm font-semibold truncate">{{ s.customerName }}</p>
                    <span
                      class="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                      :class="statusClass(s.status)"
                    >
                      {{ s.status }}
                    </span>
                  </div>
                  <p class="text-xs text-gray-400 mt-0.5">
                    {{ docLinesLabel(s) }}
                    <span v-if="!isSalesScoped"> · {{ agentName(s.agentId) }}</span>
                  </p>
                  <p class="text-[11px] text-gray-500 mt-1">
                    {{ formatMoney(s.amount) }} · commission {{ formatMoney(s.commission) }} · {{ formatDate(s.soldAt) }}
                  </p>
                </div>
                <button
                  type="button"
                  class="text-xs font-semibold text-gray-300 hover:text-white shrink-0"
                  @click="openEditSale(s)"
                >
                  Open
                </button>
              </div>
            </li>
          </ul>
          <p v-else class="text-sm text-gray-500">No sales recorded yet.</p>
        </div>

        <div v-if="!isSalesScoped || agentRows.length">
          <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-3">
            {{ isSalesScoped ? 'Your performance' : 'Agent performance' }}
          </h2>
          <ul class="space-y-2">
            <li
              v-for="a in agentRows"
              :key="a.id"
              class="card-item-bg rounded-2xl p-4 flex items-center gap-3"
            >
              <div class="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shrink-0 font-bold text-sm">
                {{ (a.name || '?').slice(0, 1) }}
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <p class="text-sm font-semibold truncate">{{ a.name }}</p>
                  <span
                    class="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                    :class="a.active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-zinc-500/20 text-gray-400'"
                  >
                    {{ a.active ? 'Active' : 'Inactive' }}
                  </span>
                </div>
                <p class="text-xs text-gray-400 mt-0.5">
                  {{ a.region || 'No region' }} · {{ a.commissionRate }}% commission
                </p>
                <p class="text-[11px] text-gray-500 mt-1">
                  {{ a.perf.salesCount }} sales · {{ formatMoney(a.perf.revenue) }} ·
                  earned {{ formatMoney(a.perf.commission) }}
                </p>
              </div>
            </li>
          </ul>
        </div>

        <div class="flex flex-wrap gap-2">
          <button type="button" class="px-4 py-2.5 rounded-full text-xs font-bold bg-white text-black" @click="tab = 'sales'; salesListMode = 'orders'; openNewSale()">
            New sale
          </button>
          <button type="button" class="px-4 py-2.5 rounded-full text-xs font-semibold border border-[var(--border)]" @click="openNewQuote">
            Quote
          </button>
          <RouterLink
            v-if="canManageAgents"
            to="/admin/slugs"
            class="px-4 py-2.5 rounded-full text-xs font-semibold border border-[var(--border)] no-underline text-inherit inline-flex items-center gap-1"
          >
            <span class="material-symbols-outlined text-[16px]">qr_code_2</span>
            Manage slugs
          </RouterLink>
          <button
            v-if="canManageProducts"
            type="button"
            class="px-4 py-2.5 rounded-full text-xs font-semibold border border-[var(--border)]"
            @click="tab = 'products'; openNewProduct()"
          >
            Add product
          </button>
          <button type="button" class="px-4 py-2.5 rounded-full text-xs font-semibold border border-[var(--border)]" @click="tab = 'cash'; openNewCash()">
            Cash entry
          </button>
          <button
            v-if="canManageAgents"
            type="button"
            class="px-4 py-2.5 rounded-full text-xs font-semibold border border-[var(--border)]"
            @click="tab = 'agents'; openNewAgent()"
          >
            Add agent
          </button>
        </div>
      </section>

      <!-- Sales / Quotes -->
      <section v-if="tab === 'sales'" class="mb-8 space-y-4">
        <div class="flex gap-2 p-1 rounded-full card-item-bg w-fit">
          <button
            type="button"
            class="px-4 py-2 rounded-full text-xs font-semibold transition-colors"
            :class="salesListMode === 'orders' ? 'bg-white text-black' : 'text-gray-400'"
            @click="salesListMode = 'orders'; query = ''"
          >
            Sales
          </button>
          <button
            type="button"
            class="px-4 py-2 rounded-full text-xs font-semibold transition-colors"
            :class="salesListMode === 'quotes' ? 'bg-white text-black' : 'text-gray-400'"
            @click="salesListMode = 'quotes'; query = ''"
          >
            Quotes
          </button>
        </div>

        <div class="flex flex-col sm:flex-row gap-3">
          <div class="field-shell flex-1 !rounded-2xl">
            <span class="material-symbols-outlined field-icon">search</span>
            <input
              v-model="query"
              type="search"
              class="field-input"
              :placeholder="salesListMode === 'quotes' ? 'Search quotes…' : 'Search sales…'"
            >
          </div>
          <select
            v-if="!isSalesScoped"
            v-model="agentFilter"
            class="field-shell field-input !py-3 shrink-0 sm:max-w-[200px]"
          >
            <option value="">All agents</option>
            <option v-for="a in agents" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
          <div class="flex gap-2 shrink-0">
            <button
              v-if="salesListMode === 'orders'"
              type="button"
              class="px-4 py-2.5 rounded-full text-xs font-bold bg-white text-black"
              @click="openNewSale"
            >
              New sale
            </button>
            <button
              type="button"
              class="px-4 py-2.5 rounded-full text-xs font-semibold border border-[var(--border)]"
              :class="salesListMode === 'quotes' ? 'bg-white text-black border-transparent font-bold' : ''"
              @click="openNewQuote"
            >
              Quote
            </button>
          </div>
        </div>

        <ul v-if="salesListMode === 'orders'" class="space-y-2">
          <li v-for="s in filteredSales" :key="s.id" class="card-item-bg rounded-2xl p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <p class="text-sm font-semibold truncate">{{ s.customerName }}</p>
                  <span class="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full" :class="statusClass(s.status)">
                    {{ s.status }}
                  </span>
                </div>
                <p class="text-xs text-gray-400 mt-0.5">
                  {{ docLinesLabel(s) }} · {{ agentName(s.agentId) }}
                </p>
                <p class="text-[11px] text-gray-500 mt-1">
                  {{ formatMoney(s.amount) }} · commission {{ formatMoney(s.commission) }} · {{ formatDate(s.soldAt) }}
                </p>
              </div>
              <div class="flex flex-col gap-1 shrink-0 text-right">
                <button type="button" class="text-xs font-semibold text-emerald-300 hover:text-emerald-200" @click="openCardsForSale(s)">Cards</button>
                <button type="button" class="text-xs font-semibold text-gray-300 hover:text-white" @click="openInvoiceForSale(s)">Invoice</button>
                <button type="button" class="text-xs font-semibold text-gray-300 hover:text-white" @click="openEditSale(s)">Edit</button>
                <button type="button" class="text-xs font-semibold text-red-400" @click="removeSale(s.id)">Delete</button>
              </div>
            </div>
          </li>
        </ul>
        <p v-if="salesListMode === 'orders' && !filteredSales.length" class="text-sm text-gray-500">No sales found.</p>

        <ul v-if="salesListMode === 'quotes'" class="space-y-2">
          <li v-for="q in filteredQuotes" :key="q.id" class="card-item-bg rounded-2xl p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <p class="text-sm font-semibold truncate">{{ q.quoteNumber }}</p>
                  <span class="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full" :class="statusClass(q.status)">
                    {{ q.status }}
                  </span>
                </div>
                <p class="text-xs text-gray-400 mt-0.5">
                  {{ q.customerName }} · {{ docLinesLabel(q) }}
                </p>
                <p class="text-[11px] text-gray-500 mt-1">
                  {{ formatMoney(q.amount) }} · {{ agentName(q.agentId) }} · valid {{ formatDay(q.validUntil) }}
                </p>
              </div>
              <div class="flex flex-col gap-1 shrink-0 text-right">
                <button
                  v-if="q.status !== 'converted'"
                  type="button"
                  class="text-xs font-semibold text-emerald-300 hover:text-emerald-200"
                  @click="convertQuote(q)"
                >
                  Convert
                </button>
                <button
                  v-if="q.status !== 'converted'"
                  type="button"
                  class="text-xs font-semibold text-gray-300 hover:text-white"
                  @click="openQuoteEmail(q)"
                >
                  Email
                </button>
                <button type="button" class="text-xs font-semibold text-gray-300 hover:text-white" @click="openEditQuote(q)">Edit</button>
                <button type="button" class="text-xs font-semibold text-red-400" @click="removeQuote(q.id)">Delete</button>
              </div>
            </div>
          </li>
        </ul>
        <p v-if="salesListMode === 'quotes' && !filteredQuotes.length" class="text-sm text-gray-500">No quotes found.</p>
      </section>

      <!-- Invoices -->
      <section v-if="tab === 'invoices'" class="mb-8 space-y-4">
        <div class="flex flex-col sm:flex-row gap-3">
          <div class="field-shell flex-1 !rounded-2xl">
            <span class="material-symbols-outlined field-icon">search</span>
            <input v-model="query" type="search" class="field-input" placeholder="Search invoices…">
          </div>
        </div>

        <ul class="space-y-2">
          <li v-for="inv in filteredInvoices" :key="inv.id" class="card-item-bg rounded-2xl p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <p class="text-sm font-semibold truncate">{{ inv.invoiceNumber }}</p>
                  <span class="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full" :class="statusClass(inv.status)">
                    {{ inv.status }}
                  </span>
                </div>
                <p class="text-xs text-gray-400 mt-0.5">
                  {{ inv.customerName }} · {{ docLinesLabel(inv) }}
                </p>
                <p class="text-[11px] text-gray-500 mt-1">
                  {{ formatMoney(inv.amount) }} · {{ formatDay(inv.issuedAt) }}
                  <span v-if="inv.emailStatus && inv.emailStatus !== 'pending'"> · email {{ inv.emailStatus }}</span>
                </p>
              </div>
              <div class="flex flex-col gap-1 shrink-0 text-right">
                <button type="button" class="text-xs font-semibold text-emerald-300 hover:text-emerald-200" @click="openInvoiceModal(inv)">
                  Open / Email
                </button>
              </div>
            </div>
          </li>
        </ul>
        <p v-if="!filteredInvoices.length" class="text-sm text-gray-500">No invoices yet. Save a sale to generate one.</p>
      </section>

      <!-- Products -->
      <section v-if="tab === 'products'" class="mb-8 space-y-4">
        <div class="flex flex-col sm:flex-row gap-3">
          <div class="field-shell flex-1 !rounded-2xl">
            <span class="material-symbols-outlined field-icon">search</span>
            <input v-model="query" type="search" class="field-input" placeholder="Search products…">
          </div>
          <button
            v-if="canManageProducts"
            type="button"
            class="px-4 py-2.5 rounded-full text-xs font-bold bg-white text-black shrink-0"
            @click="openNewProduct"
          >
            Add product
          </button>
        </div>

        <ul class="space-y-2">
          <li v-for="p in filteredProducts" :key="p.id" class="card-item-bg rounded-2xl p-4 flex items-start gap-3">
            <div class="w-14 h-14 rounded-2xl bg-white/10 overflow-hidden flex items-center justify-center shrink-0">
              <img v-if="productThumb(p)" :src="productThumb(p)" :alt="p.name" class="w-full h-full object-cover">
              <span v-else class="material-symbols-outlined text-[22px]">inventory_2</span>
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 flex-wrap">
                <p class="text-sm font-semibold">{{ p.name }}</p>
                <span
                  class="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                  :class="p.active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-zinc-500/20 text-gray-400'"
                >
                  {{ p.active ? 'Active' : 'Inactive' }}
                </span>
                <span class="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-white/5 text-gray-400">
                  {{ p.category }}
                </span>
              </div>
              <p class="text-xs text-gray-400 mt-0.5">{{ formatMoney(p.defaultPrice) }}</p>
              <p v-if="p.description" class="text-[11px] text-gray-500 mt-1">{{ p.description }}</p>
              <p class="text-[11px] text-gray-500 mt-1">
                {{ (p.images && p.images.length) || 0 }} image{{ (p.images && p.images.length) === 1 ? '' : 's' }}
                <span v-if="p.video"> · video</span>
              </p>
            </div>
            <div v-if="canManageProducts" class="flex flex-col gap-1 shrink-0">
              <button type="button" class="text-xs font-semibold text-gray-300 hover:text-white" @click="openEditProduct(p)">Edit</button>
              <button type="button" class="text-xs font-semibold text-red-400" @click="removeProduct(p.id)">Delete</button>
            </div>
          </li>
        </ul>
        <p v-if="!filteredProducts.length" class="text-sm text-gray-500">No products found.</p>
      </section>

      <!-- Cash flow -->
      <section v-if="tab === 'cash'" class="mb-8 space-y-4">
        <div class="grid grid-cols-3 gap-3">
          <div class="card-item-bg rounded-2xl p-3">
            <p class="text-[10px] uppercase tracking-wide text-gray-500">In</p>
            <p class="text-lg font-bold text-emerald-400">{{ formatMoney(stats.inflow) }}</p>
          </div>
          <div class="card-item-bg rounded-2xl p-3">
            <p class="text-[10px] uppercase tracking-wide text-gray-500">Out</p>
            <p class="text-lg font-bold text-red-400">{{ formatMoney(stats.outflow) }}</p>
          </div>
          <div class="card-item-bg rounded-2xl p-3">
            <p class="text-[10px] uppercase tracking-wide text-gray-500">Balance</p>
            <p class="text-lg font-bold">{{ formatMoney(stats.balance) }}</p>
          </div>
        </div>

        <div class="flex flex-col sm:flex-row gap-3">
          <div class="field-shell flex-1 !rounded-2xl">
            <span class="material-symbols-outlined field-icon">search</span>
            <input v-model="query" type="search" class="field-input" placeholder="Search cash flow…">
          </div>
          <button type="button" class="px-4 py-2.5 rounded-full text-xs font-bold bg-white text-black shrink-0" @click="openNewCash">
            Add entry
          </button>
        </div>

        <ul class="space-y-2">
          <li v-for="c in filteredCash" :key="c.id" class="card-item-bg rounded-2xl p-4 flex gap-3">
            <div
              class="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              :class="c.type === 'in' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'"
            >
              <span class="material-symbols-outlined text-[20px]">{{ c.type === 'in' ? 'south_west' : 'north_east' }}</span>
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold">{{ c.description }}</p>
              <p class="text-xs text-gray-400 mt-0.5 capitalize">
                {{ c.type }} · {{ c.category }} · {{ c.method }}
                <span v-if="c.agentId"> · {{ agentName(c.agentId) }}</span>
              </p>
              <p class="text-[11px] text-gray-500 mt-1">{{ formatDate(c.at) }}</p>
            </div>
            <div class="text-right shrink-0">
              <p class="text-sm font-bold" :class="c.type === 'in' ? 'text-emerald-400' : 'text-red-400'">
                {{ c.type === 'in' ? '+' : '−' }}{{ formatMoney(c.amount) }}
              </p>
              <div class="flex gap-2 justify-end mt-1">
                <button type="button" class="text-[11px] font-semibold text-gray-400 hover:text-white" @click="openEditCash(c)">Edit</button>
                <button type="button" class="text-[11px] font-semibold text-red-400" @click="removeCash(c.id)">Delete</button>
              </div>
            </div>
          </li>
        </ul>
        <p v-if="!filteredCash.length" class="text-sm text-gray-500">No cash entries found.</p>
      </section>

      <!-- Agents -->
      <section v-if="tab === 'agents' && canManageAgents" class="mb-8 space-y-4">
        <div class="flex justify-end">
          <button type="button" class="px-4 py-2.5 rounded-full text-xs font-bold bg-white text-black" @click="openNewAgent">
            Add agent
          </button>
        </div>

        <ul class="space-y-2">
          <li v-for="a in agentRows" :key="a.id" class="card-item-bg rounded-2xl p-4">
            <div class="flex items-start gap-3">
              <div class="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center shrink-0 font-bold">
                {{ (a.name || '?').slice(0, 1) }}
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <p class="text-sm font-semibold">{{ a.name }}</p>
                  <span
                    class="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                    :class="a.active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-zinc-500/20 text-gray-400'"
                  >
                    {{ a.active ? 'Active' : 'Inactive' }}
                  </span>
                </div>
                <p class="text-xs text-gray-400 mt-0.5">{{ a.email || 'No email' }} · {{ a.phone || 'No phone' }}</p>
                <p class="text-xs text-gray-500 mt-0.5">{{ a.region || 'No region' }} · {{ a.commissionRate }}% commission</p>
                <p class="text-[11px] text-gray-500 mt-1">
                  {{ a.perf.salesCount }} sales · {{ formatMoney(a.perf.revenue) }} revenue ·
                  {{ formatMoney(a.perf.commission) }} earned
                </p>
                <p v-if="a.notes" class="text-[11px] text-gray-500 mt-1 italic">{{ a.notes }}</p>
              </div>
              <div class="flex flex-col gap-1 shrink-0">
                <button type="button" class="text-xs font-semibold text-gray-300 hover:text-white" @click="openEditAgent(a)">Edit</button>
                <button type="button" class="text-xs font-semibold text-red-400" @click="removeAgent(a.id)">Delete</button>
              </div>
            </div>
          </li>
        </ul>
      </section>

      <button
        v-if="canManageAgents"
        type="button"
        class="text-xs font-semibold text-gray-500 hover:text-white underline underline-offset-2"
        @click="reseeds"
      >
        Clear all sales data
      </button>
    </main>

    <!-- Sale modal -->
    <div v-if="showSaleForm" class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/70" @click="showSaleForm = false" />
      <form class="relative w-full max-w-lg card-item-bg rounded-3xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto space-y-3" @submit="submitSale">
        <h2 class="text-lg font-bold">{{ editingSaleId ? 'Edit sale' : 'New sale' }}</h2>
        <div>
          <label class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Customer</label>
          <div class="field-shell"><input v-model="saleForm.customerName" class="field-input" required placeholder="Name"></div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Phone</label>
            <div class="field-shell"><input v-model="saleForm.customerPhone" class="field-input" placeholder="+264…"></div>
          </div>
          <div>
            <label class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Email</label>
            <div class="field-shell"><input v-model="saleForm.customerEmail" type="email" class="field-input" placeholder="email"></div>
          </div>
        </div>
        <div>
          <label class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Address</label>
          <div class="field-shell"><input v-model="saleForm.customerAddress" class="field-input" placeholder="Street, city"></div>
        </div>
        <div>
          <label class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Agent</label>
          <select
            v-model="saleForm.agentId"
            class="field-shell w-full field-input !py-3"
            :disabled="isSalesScoped"
          >
            <option value="">Unassigned</option>
            <option v-for="a in agents" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
        </div>

        <div class="space-y-2">
          <div class="flex items-center justify-between gap-2">
            <label class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400">Products</label>
            <button type="button" class="text-xs font-semibold text-gray-300 hover:text-white" @click="addSaleLine">
              + Add product
            </button>
          </div>
          <div
            v-for="(line, idx) in saleForm.lines"
            :key="'sale-line-' + idx"
            class="rounded-2xl border border-[var(--border)] p-3 space-y-2"
          >
            <div class="flex items-center justify-between gap-2">
              <p class="text-[11px] font-semibold text-gray-400">Item {{ idx + 1 }}</p>
              <button
                v-if="saleForm.lines.length > 1"
                type="button"
                class="text-xs font-semibold text-red-400"
                @click="removeSaleLine(idx)"
              >
                Remove
              </button>
            </div>
            <div>
              <label class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Product</label>
              <select
                v-model="line.productId"
                class="field-shell w-full field-input !py-3"
                @change="onSaleLineProduct(idx)"
              >
                <option v-for="p in productOptions" :key="p.id" :value="p.id">{{ p.name }} · {{ formatMoney(p.defaultPrice) }}</option>
              </select>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Qty</label>
                <div class="field-shell"><input v-model.number="line.quantity" type="number" min="1" class="field-input"></div>
              </div>
              <div>
                <label class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Unit price (N$)</label>
                <div class="field-shell"><input v-model.number="line.unitPrice" type="number" min="0" step="1" class="field-input"></div>
              </div>
            </div>
            <p class="text-[11px] text-gray-500 text-right">
              Line {{ formatMoney((line.quantity || 0) * (line.unitPrice || 0)) }}
            </p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Status</label>
            <select v-model="saleForm.status" class="field-shell w-full field-input !py-3">
              <option v-for="s in SALE_STATUSES" :key="s" :value="s">{{ s }}</option>
            </select>
          </div>
          <div>
            <label class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Payment</label>
            <select v-model="saleForm.paymentMethod" class="field-shell w-full field-input !py-3">
              <option v-for="m in PAYMENT_METHODS" :key="m" :value="m">{{ m }}</option>
            </select>
          </div>
        </div>
        <div>
          <label class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Sold at</label>
          <div class="field-shell"><input v-model="saleForm.soldAt" type="datetime-local" class="field-input"></div>
        </div>
        <div>
          <label class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Notes</label>
          <div class="field-shell"><input v-model="saleForm.notes" class="field-input" placeholder="Optional"></div>
        </div>
        <p class="text-xs text-gray-500">
          Total {{ formatMoney(saleFormTotal) }}
          · An invoice is generated when you save a new sale
        </p>
        <div class="flex gap-2 pt-1">
          <button type="button" class="flex-1 py-3 rounded-full border border-[var(--border)] text-sm font-semibold" @click="showSaleForm = false">Cancel</button>
          <button type="submit" class="flex-1 py-3 rounded-full bg-white text-black text-sm font-bold">Save</button>
        </div>
      </form>
    </div>

    <!-- Quote modal -->
    <div v-if="showQuoteForm" class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/70" @click="showQuoteForm = false" />
      <form class="relative w-full max-w-lg card-item-bg rounded-3xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto space-y-3" @submit="submitQuote">
        <h2 class="text-lg font-bold">{{ editingQuoteId ? 'Edit quote' : 'New quote' }}</h2>
        <div>
          <label class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Customer</label>
          <div class="field-shell"><input v-model="quoteForm.customerName" class="field-input" required placeholder="Name"></div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Phone</label>
            <div class="field-shell"><input v-model="quoteForm.customerPhone" class="field-input" placeholder="+264…"></div>
          </div>
          <div>
            <label class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Email</label>
            <div class="field-shell"><input v-model="quoteForm.customerEmail" type="email" class="field-input" placeholder="email"></div>
          </div>
        </div>
        <div>
          <label class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Address</label>
          <div class="field-shell"><input v-model="quoteForm.customerAddress" class="field-input" placeholder="Street, city"></div>
        </div>
        <div>
          <label class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Agent</label>
          <select
            v-model="quoteForm.agentId"
            class="field-shell w-full field-input !py-3"
            :disabled="isSalesScoped"
          >
            <option value="">Unassigned</option>
            <option v-for="a in agents" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
        </div>

        <div class="space-y-2">
          <div class="flex items-center justify-between gap-2">
            <label class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400">Products</label>
            <button type="button" class="text-xs font-semibold text-gray-300 hover:text-white" @click="addQuoteLine">
              + Add product
            </button>
          </div>
          <div
            v-for="(line, idx) in quoteForm.lines"
            :key="'quote-line-' + idx"
            class="rounded-2xl border border-[var(--border)] p-3 space-y-2"
          >
            <div class="flex items-center justify-between gap-2">
              <p class="text-[11px] font-semibold text-gray-400">Item {{ idx + 1 }}</p>
              <button
                v-if="quoteForm.lines.length > 1"
                type="button"
                class="text-xs font-semibold text-red-400"
                @click="removeQuoteLine(idx)"
              >
                Remove
              </button>
            </div>
            <div>
              <label class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Product</label>
              <select
                v-model="line.productId"
                class="field-shell w-full field-input !py-3"
                @change="onQuoteLineProduct(idx)"
              >
                <option v-for="p in productOptions" :key="p.id" :value="p.id">{{ p.name }} · {{ formatMoney(p.defaultPrice) }}</option>
              </select>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Qty</label>
                <div class="field-shell"><input v-model.number="line.quantity" type="number" min="1" class="field-input"></div>
              </div>
              <div>
                <label class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Unit price (N$)</label>
                <div class="field-shell"><input v-model.number="line.unitPrice" type="number" min="0" step="1" class="field-input"></div>
              </div>
            </div>
            <p class="text-[11px] text-gray-500 text-right">
              Line {{ formatMoney((line.quantity || 0) * (line.unitPrice || 0)) }}
            </p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Status</label>
            <select v-model="quoteForm.status" class="field-shell w-full field-input !py-3">
              <option v-for="s in QUOTE_STATUSES.filter((x) => x !== 'converted')" :key="s" :value="s">{{ s }}</option>
            </select>
          </div>
          <div>
            <label class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Valid until</label>
            <div class="field-shell"><input v-model="quoteForm.validUntil" type="date" class="field-input"></div>
          </div>
        </div>
        <div>
          <label class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Notes</label>
          <div class="field-shell"><input v-model="quoteForm.notes" class="field-input" placeholder="Optional"></div>
        </div>
        <p class="text-xs text-gray-500">
          Total {{ formatMoney(quoteFormTotal) }}
        </p>
        <div class="flex gap-2 pt-1">
          <button type="button" class="flex-1 py-3 rounded-full border border-[var(--border)] text-sm font-semibold" @click="showQuoteForm = false">Cancel</button>
          <button type="submit" class="flex-1 py-3 rounded-full bg-white text-black text-sm font-bold">Save quote</button>
        </div>
      </form>
    </div>

    <!-- Product modal -->
    <div v-if="showProductForm && canManageProducts" class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/70" @click="showProductForm = false" />
      <form class="relative w-full max-w-md card-item-bg rounded-3xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto space-y-3" @submit="submitProduct">
        <h2 class="text-lg font-bold">{{ editingProductId ? 'Edit product' : 'New product' }}</h2>
        <div>
          <label class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Name</label>
          <div class="field-shell"><input v-model="productForm.name" class="field-input" required placeholder="Product name"></div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Price (N$)</label>
            <div class="field-shell"><input v-model.number="productForm.defaultPrice" type="number" min="0" step="1" class="field-input"></div>
          </div>
          <div>
            <label class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Category</label>
            <select v-model="productForm.category" class="field-shell w-full field-input !py-3">
              <option v-for="c in PRODUCT_CATEGORIES" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
        </div>
        <div>
          <label class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Description</label>
          <div class="field-shell"><input v-model="productForm.description" class="field-input" placeholder="Optional"></div>
        </div>

        <div class="space-y-2">
          <div class="flex items-center justify-between gap-2">
            <label class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400">Images</label>
            <button
              type="button"
              class="text-xs font-semibold text-gray-300 hover:text-white inline-flex items-center gap-1"
              @click="productImageInput?.click()"
            >
              <span class="material-symbols-outlined text-[16px]">add_photo_alternate</span>
              Add images
            </button>
            <input
              ref="productImageInput"
              type="file"
              accept="image/*"
              multiple
              class="hidden"
              @change="onProductImagesChange"
            >
          </div>
          <div v-if="productForm.images?.length" class="grid grid-cols-3 gap-2">
            <div
              v-for="(src, idx) in productForm.images"
              :key="idx"
              class="relative aspect-square rounded-xl overflow-hidden bg-white/5 border border-[var(--border)]"
            >
              <img :src="src" alt="" class="w-full h-full object-cover">
              <button
                type="button"
                class="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center"
                aria-label="Remove image"
                @click="removeProductImage(idx)"
              >
                <span class="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          </div>
          <p v-else class="text-[11px] text-gray-500">Optional · add one or more photos (20 MB each)</p>
        </div>

        <div class="space-y-2">
          <label class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400">Video</label>
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="px-3 py-2 rounded-full text-xs font-semibold border border-[var(--border)] inline-flex items-center gap-1"
              @click="productVideoInput?.click()"
            >
              <span class="material-symbols-outlined text-[16px]">videocam</span>
              Upload video
            </button>
            <button
              v-if="productForm.video"
              type="button"
              class="px-3 py-2 rounded-full text-xs font-semibold text-red-400 border border-red-400/30"
              @click="clearProductVideo"
            >
              Remove video
            </button>
            <input
              ref="productVideoInput"
              type="file"
              accept="video/*"
              class="hidden"
              @change="onProductVideoFileChange"
            >
          </div>
          <div class="field-shell !rounded-2xl">
            <span class="material-symbols-outlined field-icon">link</span>
            <input
              v-model="productVideoUrl"
              type="url"
              class="field-input"
              placeholder="Or paste YouTube / video URL"
              @change="applyProductVideoUrl"
              @blur="applyProductVideoUrl"
            >
          </div>
          <div v-if="productForm.video" class="rounded-2xl overflow-hidden border border-[var(--border)] bg-black/40">
            <video
              v-if="isProductVideoData(productForm.video)"
              :src="productForm.video"
              class="w-full max-h-48 object-contain bg-black"
              controls
              playsinline
            />
            <p v-else class="text-xs text-gray-400 p-3 break-all">{{ productForm.video }}</p>
          </div>
          <p class="text-[11px] text-gray-500">Optional · file under 20 MB, or a link</p>
        </div>

        <p v-if="productMediaFeedback" class="text-xs text-amber-300">{{ productMediaFeedback }}</p>

        <label class="flex items-center gap-2 text-sm">
          <input v-model="productForm.active" type="checkbox" class="rounded">
          Active (shown in sale & quote forms)
        </label>
        <div class="flex gap-2 pt-1">
          <button type="button" class="flex-1 py-3 rounded-full border border-[var(--border)] text-sm font-semibold" @click="showProductForm = false">Cancel</button>
          <button type="submit" class="flex-1 py-3 rounded-full bg-white text-black text-sm font-bold">Save</button>
        </div>
      </form>
    </div>

    <!-- Cards provision modal -->
    <div v-if="showCardsModal && cardsSale" class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/70" @click="showCardsModal = false" />
      <div class="relative w-full max-w-md card-item-bg rounded-3xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
        <div>
          <h2 class="text-lg font-bold">Physical cards</h2>
          <p class="text-xs text-gray-400 mt-1">
            {{ cardsSale.customerName }} · {{ docLinesLabel(cardsSale) }}
          </p>
          <p class="text-[11px] text-gray-500 mt-2">
            Generate one QR/code per unit. Each opens its card page where the buyer
            creates a profile to claim it.
          </p>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="px-4 py-2.5 rounded-full text-xs font-bold bg-white text-black"
            @click="generateCardsForSale"
          >
            {{ cardsNeededForSale(cardsSale) > 0
              ? `Generate ${cardsNeededForSale(cardsSale)} code(s)`
              : 'Codes complete' }}
          </button>
          <button
            type="button"
            class="px-4 py-2.5 rounded-full text-xs font-semibold border border-[var(--border)]"
            :disabled="!saleCards.length"
            @click="linkSaleCardsToLocal"
          >
            Link all to my profile
          </button>
        </div>

        <ul v-if="saleCards.length" class="space-y-3">
          <li v-for="c in saleCards" :key="c.serial" class="rounded-2xl border border-[var(--border)] p-3 flex gap-3">
            <img
              v-if="cardQrMap[c.serial]"
              :src="cardQrMap[c.serial]"
              :alt="c.serial"
              class="w-20 h-20 rounded-lg bg-white p-1 shrink-0"
            >
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="material-symbols-outlined text-[16px] text-gray-400">{{ kindIcon(c.kind) }}</span>
                <p class="text-sm font-semibold">{{ kindLabel(c.kind) }}</p>
                <span
                  class="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                  :class="c.profileId ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'"
                >
                  {{ c.profileId ? 'Linked' : 'Unlinked' }}
                </span>
              </div>
              <p class="text-xs font-mono text-gray-400 mt-1">{{ c.serial }}</p>
              <p v-if="c.profileName" class="text-[11px] text-gray-500 mt-0.5">→ {{ c.profileName }}</p>
              <button type="button" class="text-[11px] font-semibold text-gray-300 mt-2" @click="copyCardUrl(c.serial)">
                Copy tap URL
              </button>
            </div>
          </li>
        </ul>
        <p v-else class="text-sm text-gray-500">No card codes yet. Generate codes for this order.</p>

        <button type="button" class="w-full py-3 rounded-full border border-[var(--border)] text-sm font-semibold" @click="showCardsModal = false">
          Close
        </button>
      </div>
    </div>

    <!-- Invoice modal -->
    <div v-if="showInvoice && activeInvoice" class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/70" @click="showInvoice = false" />
      <div class="relative w-full max-w-md card-item-bg rounded-3xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <BrandMark size="sm" to="" class="mb-1" />
            <h2 class="text-lg font-bold mt-0.5">{{ activeInvoice.invoiceNumber }}</h2>
            <p class="text-xs text-gray-400 mt-1">Issued {{ formatDay(activeInvoice.issuedAt) }}</p>
          </div>
          <span class="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full" :class="statusClass(activeInvoice.status)">
            {{ activeInvoice.status }}
          </span>
        </div>

        <div class="rounded-2xl border border-[var(--border)] p-4 space-y-3">
          <div v-if="productThumbFor(activeInvoice.productId)" class="flex justify-center">
            <img
              :src="productThumbFor(activeInvoice.productId)"
              :alt="activeInvoice.productName"
              class="w-28 h-28 object-contain rounded-2xl bg-white/5"
            >
          </div>
          <div>
            <p class="text-[10px] uppercase tracking-wide text-gray-500">Bill to</p>
            <p class="text-sm font-semibold mt-0.5">{{ activeInvoice.customerName }}</p>
            <p class="text-xs text-gray-400">{{ activeInvoice.customerEmail || 'No email' }}</p>
            <p class="text-xs text-gray-400">{{ activeInvoice.customerPhone || 'No phone' }}</p>
            <p v-if="activeInvoice.customerAddress" class="text-xs text-gray-400">{{ activeInvoice.customerAddress }}</p>
          </div>
          <div class="border-t border-[var(--border)] pt-3 space-y-2">
            <div
              v-for="(line, idx) in (activeInvoice.lines || [{ productName: activeInvoice.productName, quantity: activeInvoice.quantity, unitPrice: activeInvoice.unitPrice, amount: activeInvoice.amount }])"
              :key="'inv-line-' + idx"
              class="space-y-0.5"
            >
              <div class="flex justify-between gap-3 text-sm">
                <span>{{ line.productName }} × {{ line.quantity }}</span>
                <span class="font-semibold shrink-0">{{ formatMoney(line.amount ?? ((line.quantity || 0) * (line.unitPrice || 0))) }}</span>
              </div>
              <p class="text-xs text-gray-500">
                {{ formatMoney(line.unitPrice) }} each
              </p>
            </div>
            <p class="text-xs text-gray-500 pt-1">{{ activeInvoice.paymentMethod }}</p>
          </div>
          <div class="border-t border-[var(--border)] pt-3 flex justify-between items-center">
            <span class="text-xs uppercase tracking-wide text-gray-500">Amount due</span>
            <span class="text-lg font-bold">{{ formatMoney(activeInvoice.amount) }}</span>
          </div>
          <p class="text-[11px] text-gray-500 leading-relaxed">
            {{ COMPANY.legalName }} · {{ COMPANY.address }} · {{ COMPANY.phone }} · {{ COMPANY.email }}
          </p>
        </div>

        <div>
          <label class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Send invoice to</label>
          <div class="field-shell">
            <input v-model="invoiceEmailTo" type="email" class="field-input" placeholder="customer@email.com">
          </div>
          <p class="text-[11px] text-gray-500 mt-2">
            Email includes product image + PDF attachment.
            <span v-if="activeInvoice.emailStatus && activeInvoice.emailStatus !== 'pending'">
              · Status: {{ activeInvoice.emailStatus }}
            </span>
          </p>
        </div>

        <div class="flex flex-wrap gap-2">
          <button type="button" class="flex-1 py-3 rounded-full border border-[var(--border)] text-sm font-semibold" @click="showInvoice = false">
            Close
          </button>
          <button
            type="button"
            class="flex-1 py-3 rounded-full border border-[var(--border)] text-sm font-semibold disabled:opacity-60"
            :disabled="invoicePdfBusy"
            @click="downloadActiveInvoicePdf"
          >
            {{ invoicePdfBusy ? 'Preparing…' : 'Download PDF' }}
          </button>
          <button
            v-if="activeInvoice.status !== 'paid' && activeInvoice.status !== 'void'"
            type="button"
            class="flex-1 py-3 rounded-full border border-emerald-500/40 text-emerald-300 text-sm font-semibold"
            @click="markInvoicePaid"
          >
            Mark paid
          </button>
          <button
            type="button"
            class="flex-1 py-3 rounded-full bg-white text-black text-sm font-bold disabled:opacity-60"
            :disabled="invoiceSending"
            @click="sendActiveInvoice"
          >
            {{ invoiceSending ? 'Sending…' : 'Send via email' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Quote email modal -->
    <div v-if="showQuoteEmail && activeQuote" class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/70" @click="showQuoteEmail = false" />
      <div class="relative w-full max-w-md card-item-bg rounded-3xl p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div>
          <h2 class="text-lg font-bold">Email quote</h2>
          <p class="text-xs text-gray-400 mt-1">{{ activeQuote.quoteNumber }} · {{ formatMoney(activeQuote.amount) }}</p>
        </div>
        <div v-if="productThumbFor(activeQuote.productId)" class="flex justify-center">
          <img
            :src="productThumbFor(activeQuote.productId)"
            :alt="activeQuote.productName"
            class="w-28 h-28 object-contain rounded-2xl bg-white/5"
          >
        </div>
        <p class="text-[11px] text-gray-500 leading-relaxed">
          {{ COMPANY.legalName }} · {{ COMPANY.address }} · {{ COMPANY.phone }} · {{ COMPANY.email }}
        </p>
        <div>
          <label class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Send to</label>
          <div class="field-shell">
            <input v-model="quoteEmailTo" type="email" class="field-input" placeholder="customer@email.com">
          </div>
          <p class="text-[11px] text-gray-500 mt-2">Includes product image + PDF attachment</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="flex-1 py-3 rounded-full border border-[var(--border)] text-sm font-semibold" @click="showQuoteEmail = false">
            Cancel
          </button>
          <button
            type="button"
            class="flex-1 py-3 rounded-full border border-[var(--border)] text-sm font-semibold disabled:opacity-60"
            :disabled="quotePdfBusy"
            @click="downloadActiveQuotePdf"
          >
            {{ quotePdfBusy ? 'Preparing…' : 'Download PDF' }}
          </button>
          <button
            type="button"
            class="flex-1 py-3 rounded-full bg-white text-black text-sm font-bold disabled:opacity-60"
            :disabled="quoteSending"
            @click="sendActiveQuote"
          >
            {{ quoteSending ? 'Sending…' : 'Send quote' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Cash modal -->
    <div v-if="showCashForm" class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/70" @click="showCashForm = false" />
      <form class="relative w-full max-w-md card-item-bg rounded-3xl p-5 shadow-2xl space-y-3" @submit="submitCash">
        <h2 class="text-lg font-bold">{{ editingCashId ? 'Edit cash entry' : 'Cash entry' }}</h2>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Type</label>
            <select v-model="cashForm.type" class="field-shell w-full field-input !py-3">
              <option value="in">Inflow</option>
              <option value="out">Outflow</option>
            </select>
          </div>
          <div>
            <label class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Category</label>
            <select v-model="cashForm.category" class="field-shell w-full field-input !py-3">
              <option v-for="c in CASH_CATEGORIES" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
        </div>
        <div>
          <label class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Amount (N$)</label>
          <div class="field-shell"><input v-model.number="cashForm.amount" type="number" min="0" step="1" class="field-input" required></div>
        </div>
        <div>
          <label class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Description</label>
          <div class="field-shell"><input v-model="cashForm.description" class="field-input" required placeholder="What is this for?"></div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Method</label>
            <select v-model="cashForm.method" class="field-shell w-full field-input !py-3">
              <option v-for="m in PAYMENT_METHODS" :key="m" :value="m">{{ m }}</option>
            </select>
          </div>
          <div>
            <label class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Agent</label>
            <select
              v-model="cashForm.agentId"
              class="field-shell w-full field-input !py-3"
              :disabled="isSalesScoped"
            >
              <option value="">None</option>
              <option v-for="a in agents" :key="a.id" :value="a.id">{{ a.name }}</option>
            </select>
          </div>
        </div>
        <div>
          <label class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Date</label>
          <div class="field-shell"><input v-model="cashForm.at" type="datetime-local" class="field-input"></div>
        </div>
        <div class="flex gap-2 pt-1">
          <button type="button" class="flex-1 py-3 rounded-full border border-[var(--border)] text-sm font-semibold" @click="showCashForm = false">Cancel</button>
          <button type="submit" class="flex-1 py-3 rounded-full bg-white text-black text-sm font-bold">Save</button>
        </div>
      </form>
    </div>

    <!-- Agent modal -->
    <div v-if="showAgentForm && canManageAgents" class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/70" @click="showAgentForm = false" />
      <form class="relative w-full max-w-md card-item-bg rounded-3xl p-5 shadow-2xl space-y-3 max-h-[90vh] overflow-y-auto" @submit="submitAgent">
        <h2 class="text-lg font-bold">{{ editingAgentId ? 'Edit agent' : 'New agent' }}</h2>
        <div>
          <label class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Name</label>
          <div class="field-shell"><input v-model="agentForm.name" class="field-input" required placeholder="Full name"></div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Email</label>
            <div class="field-shell"><input v-model="agentForm.email" type="email" class="field-input"></div>
          </div>
          <div>
            <label class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Phone</label>
            <div class="field-shell"><input v-model="agentForm.phone" class="field-input"></div>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Region</label>
            <div class="field-shell"><input v-model="agentForm.region" class="field-input" placeholder="e.g. Windhoek"></div>
          </div>
          <div>
            <label class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Commission %</label>
            <div class="field-shell"><input v-model.number="agentForm.commissionRate" type="number" min="0" max="100" step="0.5" class="field-input"></div>
          </div>
        </div>
        <label class="flex items-center gap-2 text-sm">
          <input v-model="agentForm.active" type="checkbox" class="rounded">
          Active agent
        </label>
        <div>
          <label class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Notes</label>
          <div class="field-shell"><input v-model="agentForm.notes" class="field-input" placeholder="Optional"></div>
        </div>

        <div class="rounded-2xl border border-[var(--border)] p-3 space-y-2">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Sales login</p>
          <p class="text-[11px] text-gray-500">
            Creates a staff account that can only open Sales and see this agent’s records.
          </p>
          <div>
            <label class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Login email</label>
            <div class="field-shell">
              <input
                v-model="agentForm.loginEmail"
                type="email"
                class="field-input"
                placeholder="Defaults to contact email"
              >
            </div>
          </div>
          <div>
            <label class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
              {{ agentForm.authUserId ? 'New password (optional)' : 'Password' }}
            </label>
            <div class="field-shell">
              <input
                v-model="agentForm.loginPassword"
                type="password"
                class="field-input"
                :placeholder="agentForm.authUserId ? 'Leave blank to keep current' : 'Set a login password'"
              >
            </div>
          </div>
          <p v-if="agentForm.authUserId" class="text-[11px] text-emerald-300/80">Login linked</p>
        </div>

        <div class="flex gap-2 pt-1">
          <button type="button" class="flex-1 py-3 rounded-full border border-[var(--border)] text-sm font-semibold" @click="showAgentForm = false">Cancel</button>
          <button type="submit" class="flex-1 py-3 rounded-full bg-white text-black text-sm font-bold">Save</button>
        </div>
      </form>
    </div>

    <AdminBottomNav />

    <div
      v-if="toast"
      class="fixed left-1/2 -translate-x-1/2 bottom-28 z-[110] px-4 py-3 rounded-2xl bg-white text-black text-sm font-medium shadow-xl"
    >
      {{ toast }}
    </div>
  </div>
</template>
