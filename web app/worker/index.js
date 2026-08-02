/**
 * tap-na Worker — API + SPA on tapnam.com
 * Legacy hosts (www / cards.* / redirct.link) redirect to https://tapnam.com
 * Database: Supabase Postgres (PostgREST via service_role)
 */

const SLUG_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const TABLE_ORIGIN = 'https://tapnam.com'
const PERSONAL_ORIGIN = 'https://tapnam.com'
const CANONICAL_ORIGIN = 'https://tapnam.com'
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
}

function brandOriginsFromRequestOrigin(_requestOrigin = TABLE_ORIGIN) {
  return { table: TABLE_ORIGIN, personal: PERSONAL_ORIGIN }
}

function publicOriginForKind(_kind, _requestOrigin = TABLE_ORIGIN) {
  return CANONICAL_ORIGIN
}

function cardPageUrl(slug, kind, requestOrigin) {
  const origin = publicOriginForKind(kind, requestOrigin)
  return `${origin}/c/${encodeURIComponent(slug)}`
}

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS, ...extra }
  })
}

function bad(message, status = 400) {
  return json({ ok: false, error: message }, status)
}

function uid(prefix = 'id') {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`
}

function randomSlug(len = 6) {
  const bytes = crypto.getRandomValues(new Uint8Array(len))
  let out = ''
  for (let i = 0; i < len; i++) out += SLUG_ALPHABET[bytes[i] % SLUG_ALPHABET.length]
  return out
}


function requestGeo(request) {
  const cf = request.cf || {}
  return {
    country: String(cf.country || '').trim(),
    city: String(cf.city || '').trim(),
    region: String(cf.region || cf.regionCode || '').trim()
  }
}

async function recordCardActivity(env, request, { slug, channel = 'nfc', action = 'open' }) {
  const code = String(slug || '').trim()
  if (!code) return null
  const cards = await sb(env, `cards?slug=eq.${encodeURIComponent(code)}&select=id,profile_id`)
  const card = cards?.[0]
  if (!card) return null
  const ua = request.headers.get('User-Agent') || ''
  const { device, browser } = parseUa(ua)
  const geo = requestGeo(request)
  const ch = channel === 'qr' ? 'qr' : channel === 'other' ? 'other' : 'nfc'
  const act = String(action || 'open').trim().slice(0, 64) || 'open'
  const openId = uid('open')
  await sb(env, 'card_opens', {
    method: 'POST',
    body: {
      id: openId,
      card_id: card.id,
      slug: code,
      channel: ch,
      action: act,
      user_agent: ua.slice(0, 400),
      device_type: device,
      browser,
      ip_country: geo.country,
      ip_city: geo.city,
      ip_region: geo.region
    },
    prefer: 'return=minimal'
  })
  return { openId, channel: ch, action: act, device, browser, ...geo, profileId: card.profile_id || '' }
}

function parseUa(ua = '') {
  const s = String(ua)
  let device = 'desktop'
  if (/iPad|Tablet/i.test(s)) device = 'tablet'
  else if (/Mobi|Android|iPhone/i.test(s)) device = 'phone'
  let browser = 'other'
  if (/Edg\//i.test(s)) browser = 'edge'
  else if (/Chrome\//i.test(s) && !/Edg\//i.test(s)) browser = 'chrome'
  else if (/Safari\//i.test(s) && !/Chrome\//i.test(s)) browser = 'safari'
  else if (/Firefox\//i.test(s)) browser = 'firefox'
  return { device, browser }
}

async function readJson(request) {
  try { return await request.json() } catch { return null }
}

function sbHeaders(env, extra = {}) {
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    ...extra
  }
}

function sbUrl(env, path) {
  return `${env.SUPABASE_URL}/rest/v1/${path}`
}

function sanitizeErrorContext(value, depth = 0) {
  if (value == null) return value
  if (depth > 4) return '[truncated]'
  if (typeof value === 'string') return value.length > 2000 ? value.slice(0, 2000) + '…' : value
  if (typeof value !== 'object') return value
  if (Array.isArray(value)) return value.slice(0, 40).map((item) => sanitizeErrorContext(item, depth + 1))
  const out = {}
  const secretRe = /pass(word)?|secret|token|authorization|apikey|api_key|service_role|refresh/i
  for (const [key, val] of Object.entries(value)) {
    if (secretRe.test(String(key))) {
      out[key] = '[redacted]'
      continue
    }
    out[key] = sanitizeErrorContext(val, depth + 1)
  }
  return out
}

async function logAppError(env, {
  source = 'worker',
  message = '',
  stack = '',
  path = '',
  method = '',
  status = null,
  context = null,
  actor = null
} = {}) {
  const safeMessage = String(message || 'Unknown error').slice(0, 4000)
  const safeStack = String(stack || '').slice(0, 8000)
  console.log('app error', source, safeMessage)
  try {
    if (!env?.SUPABASE_URL || !env?.SUPABASE_SERVICE_ROLE_KEY) return
    const headers = sbHeaders(env)
    headers.Prefer = 'return=minimal'
    const body = {
      id: uid('err'),
      occurred_at: new Date().toISOString(),
      source: String(source || 'worker').slice(0, 80),
      message: safeMessage,
      stack: safeStack,
      request_path: String(path || '').slice(0, 500),
      request_method: String(method || '').slice(0, 16),
      http_status: status == null || status === '' ? null : Number(status) || null,
      context: context && typeof context === 'object' ? sanitizeErrorContext(context) : {},
      actor_user_id: String(actor?.id || ''),
      actor_email: String(actor?.email || ''),
      actor_role: String(actor?.role || '')
    }
    const res = await fetch(sbUrl(env, 'app_error_log'), {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    })
    if (!res.ok) {
      const t = await res.text().catch(() => '')
      console.log('app error log persist failed', res.status, String(t || '').slice(0, 200))
    }
  } catch (err) {
    console.log('app error log persist failed', err?.message || err)
  }
}

function mapErrorLogRow(row = {}) {
  return {
    id: row.id,
    occurredAt: row.occurred_at || '',
    source: row.source || '',
    message: row.message || '',
    stack: row.stack || '',
    requestPath: row.request_path || '',
    requestMethod: row.request_method || '',
    httpStatus: row.http_status == null ? null : Number(row.http_status),
    context: row.context && typeof row.context === 'object' ? row.context : {},
    actorUserId: row.actor_user_id || '',
    actorEmail: row.actor_email || '',
    actorRole: row.actor_role || ''
  }
}

async function sb(env, path, { method = 'GET', body, prefer, skipErrorLog = false } = {}) {
  const headers = sbHeaders(env)
  if (prefer) headers.Prefer = prefer
  const res = await fetch(sbUrl(env, path), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  })
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  if (!res.ok) {
    const msg = data?.message || data?.error_description || data?.hint || text || `HTTP ${res.status}`
    const err = new Error(msg)
    err.status = res.status
    err.supabasePath = String(path || '').split('?')[0]
    if (!skipErrorLog) {
      await logAppError(env, {
        source: 'supabase',
        message: msg,
        stack: err.stack || '',
        path: err.supabasePath,
        method,
        status: res.status,
        context: {
          query: path.includes('?') ? String(path).slice(String(path).indexOf('?') + 1, String(path).indexOf('?') + 501) : '',
          details: data?.details || data?.code || null
        }
      })
      err._logged = true
    }
    throw err
  }
  return data
}

async function uniqueSlug(env) {
  for (let i = 0; i < 12; i++) {
    const slug = randomSlug(6)
    const rows = await sb(env, `cards?slug=eq.${encodeURIComponent(slug)}&select=id`)
    if (!rows?.length) return slug
  }
  throw new Error('Could not allocate slug')
}

async function ensureProfileStub(env, profileId, venueName = '') {
  await sb(env, 'profiles', {
    method: 'POST',
    body: {
      id: profileId,
      card_type: 'table',
      name: venueName || 'Venue',
      company: venueName || ''
    },
    prefer: 'resolution=ignore-duplicates,return=minimal'
  })
}

async function getSessionProfile(env, request) {
  const auth = request.headers.get('Authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token) return null
  const sessions = await sb(
    env,
    `sessions?token=eq.${encodeURIComponent(token)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=profile_id`
  )
  if (!sessions?.length) return null
  const profiles = await sb(env, `profiles?id=eq.${encodeURIComponent(sessions[0].profile_id)}&select=*`)
  return profiles?.[0] || null
}

/* ——— Staff auth (Supabase Auth: admin + sales) ——— */

const DEFAULT_STAFF_ADMIN_EMAIL = 'admin@01'
const DEFAULT_STAFF_ADMIN_PASSWORD = 'Math@@0202'

function bearerToken(request) {
  const auth = request.headers.get('Authorization') || ''
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
}

function staffClaimsFromUser(user) {
  const meta = user?.app_metadata || {}
  const role = meta.role === 'sales' ? 'sales' : meta.role === 'admin' ? 'admin' : ''
  return {
    id: user?.id || '',
    email: user?.email || '',
    role,
    agentId: String(meta.agent_id || meta.agentId || ''),
    name: user?.user_metadata?.name || meta.name || ''
  }
}

async function authAdminFetch(env, path, { method = 'GET', body } = {}) {
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { message: text }
  }
  if (!res.ok) {
    const msg =
      data?.msg ||
      data?.error_description ||
      data?.message ||
      data?.error ||
      text ||
      `HTTP ${res.status}`
    const err = new Error(msg)
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

async function ensureDefaultStaffAdmin(env) {
  const email = DEFAULT_STAFF_ADMIN_EMAIL
  let existing = null
  try {
    const listed = await authAdminFetch(env, '/admin/users?page=1&per_page=200')
    existing = (listed?.users || []).find(
      (u) => String(u.email || '').toLowerCase() === email.toLowerCase()
    )
  } catch {
    existing = null
  }

  if (existing?.id) {
    await authAdminFetch(env, `/admin/users/${existing.id}`, {
      method: 'PUT',
      body: {
        password: DEFAULT_STAFF_ADMIN_PASSWORD,
        email_confirm: true,
        app_metadata: { ...(existing.app_metadata || {}), role: 'admin' },
        user_metadata: {
          ...(existing.user_metadata || {}),
          name: existing.user_metadata?.name || 'System Admin'
        }
      }
    })
    return existing
  }

  return authAdminFetch(env, '/admin/users', {
    method: 'POST',
    body: {
      email,
      password: DEFAULT_STAFF_ADMIN_PASSWORD,
      email_confirm: true,
      app_metadata: { role: 'admin' },
      user_metadata: { name: 'System Admin' }
    }
  })
}

async function getStaffFromRequest(env, request) {
  const token = bearerToken(request)
  if (!token) return null
  try {
    const key = String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${token}`
      }
    })
    if (!res.ok) return null
    const user = await res.json()
    const claims = staffClaimsFromUser(user)
    if (!claims.role) return null
    return { ...claims, accessToken: token, user }
  } catch {
    return null
  }
}

async function requireStaff(env, request, { roles = ['admin', 'sales'] } = {}) {
  const staff = await getStaffFromRequest(env, request)
  if (!staff) return { error: bad('Staff login required', 401) }
  if (!roles.includes(staff.role)) return { error: bad('Forbidden', 403) }
  return { staff }
}

function staffSessionPayload(tokenData, user) {
  const claims = staffClaimsFromUser(user || tokenData?.user)
  return {
    ok: true,
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresIn: tokenData.expires_in,
    expiresAt: tokenData.expires_at || null,
    tokenType: tokenData.token_type || 'bearer',
    user: claims
  }
}

function mapSalesProductRow(row) {
  const images = Array.isArray(row?.images)
    ? row.images.filter((src) => typeof src === 'string' && src.trim())
    : []
  return withDeletedFields(
    {
      id: row.id,
      name: row.name || '',
      defaultPrice: Number(row.default_price) || 0,
      category: row.category === 'table' || row.category === 'personal' ? row.category : 'other',
      active: row.active !== false,
      description: row.description || '',
      images,
      video: row.video || '',
      createdAt: row.created_at || '',
      updatedAt: row.updated_at || ''
    },
    row
  )
}

function mapSalesProductPublic(row) {
  const mapped = mapSalesProductRow(row)
  const section = mapped.category === 'table' ? 'table-brochure' : 'business-cards'
  return {
    id: mapped.id,
    name: mapped.name,
    price: mapped.defaultPrice,
    desc: mapped.description,
    image: mapped.images[0] || '',
    images: mapped.images,
    video: mapped.video,
    alt: mapped.name,
    section,
    badge: '',
    label: '',
    active: mapped.active,
    category: mapped.category
  }
}

function salesProductToDb(body, { isNew = false } = {}) {
  const categoryRaw = String(body?.category || '').trim()
  const category =
    categoryRaw === 'table' || categoryRaw === 'personal' || categoryRaw === 'other'
      ? categoryRaw
      : body?.section === 'table-brochure'
        ? 'table'
        : 'personal'
  const images = Array.isArray(body?.images)
    ? body.images.filter((src) => typeof src === 'string' && src.trim()).map((src) => src.trim())
    : body?.image
      ? [String(body.image).trim()]
      : []
  return {
    id: String(body?.id || '').trim() || uid('prod'),
    name: String(body?.name || '').trim(),
    default_price: Math.max(0, Number(body?.defaultPrice ?? body?.price) || 0),
    category,
    active: body?.active !== false,
    description: String(body?.description || body?.desc || '').trim(),
    images,
    video: String(body?.video || '').trim(),
    ...(isNew ? { created_at: new Date().toISOString() } : {}),
    updated_at: new Date().toISOString()
  }
}

function mapSalesAgentRow(row) {
  return withDeletedFields(
    {
      id: row.id,
      name: row.name || '',
      email: row.email || '',
      phone: row.phone || '',
      region: row.region || '',
      commissionRate: Number(row.commission_rate) || 0,
      active: row.active !== false,
      notes: row.notes || '',
      loginEmail: row.login_email || '',
      authUserId: row.auth_user_id || '',
      createdAt: row.created_at || '',
      updatedAt: row.updated_at || ''
    },
    row
  )
}

function salesAgentToDb(body, { isNew = false } = {}) {
  const id = String(body?.id || '').trim() || (isNew ? uid('agent') : '')
  return {
    id,
    name: String(body?.name || '').trim(),
    email: String(body?.email || '').trim().toLowerCase(),
    phone: String(body?.phone || '').trim(),
    region: String(body?.region || '').trim(),
    commission_rate: Math.max(0, Number(body?.commissionRate) || 0),
    active: body?.active !== false,
    notes: String(body?.notes || '').trim(),
    login_email: String(body?.loginEmail || body?.email || '').trim().toLowerCase(),
    auth_user_id: String(body?.authUserId || '').trim(),
    updated_at: new Date().toISOString(),
    ...(isNew ? { created_at: body?.createdAt || new Date().toISOString() } : {})
  }
}

function mapSalesOrderRow(row) {
  return withDeletedFields(
    {
      id: row.id,
      agentId: row.agent_id || '',
      customerName: row.customer_name || '',
      customerPhone: row.customer_phone || '',
      customerEmail: row.customer_email || '',
      customerAddress: row.customer_address || '',
      productId: row.product_id || '',
      productName: row.product_name || '',
      quantity: Number(row.quantity) || 1,
      unitPrice: Number(row.unit_price) || 0,
      amount: Number(row.amount) || 0,
      commission: Number(row.commission) || 0,
      commissionRate: Number(row.commission_rate) || 0,
      status: row.status || 'pending',
      paymentMethod: row.payment_method || 'eft',
      soldAt: row.sold_at || '',
      notes: row.notes || '',
      quoteId: row.quote_id || '',
      invoiceId: row.invoice_id || '',
      lines: Array.isArray(row.lines) ? row.lines : [],
      createdAt: row.created_at || '',
      updatedAt: row.updated_at || ''
    },
    row
  )
}

function salesOrderToDb(body, { isNew = false } = {}) {
  const id = String(body?.id || '').trim() || (isNew ? uid('sale') : '')
  const agentId = String(body?.agentId || '').trim() || null
  const productId = String(body?.productId || '').trim() || null
  return {
    id,
    agent_id: agentId,
    customer_name: String(body?.customerName || '').trim(),
    customer_phone: String(body?.customerPhone || '').trim(),
    customer_email: String(body?.customerEmail || '').trim(),
    customer_address: String(body?.customerAddress || '').trim(),
    product_id: productId,
    product_name: String(body?.productName || '').trim(),
    quantity: Math.max(1, Number(body?.quantity) || 1),
    unit_price: Math.max(0, Number(body?.unitPrice) || 0),
    amount: Math.max(0, Number(body?.amount) || 0),
    commission: Math.max(0, Number(body?.commission) || 0),
    commission_rate: Math.max(0, Number(body?.commissionRate) || 0),
    status: String(body?.status || 'pending'),
    payment_method: String(body?.paymentMethod || 'eft'),
    sold_at: body?.soldAt || new Date().toISOString(),
    notes: String(body?.notes || '').trim(),
    quote_id: String(body?.quoteId || '').trim(),
    invoice_id: String(body?.invoiceId || '').trim(),
    lines: Array.isArray(body?.lines) ? body.lines : [],
    updated_at: new Date().toISOString(),
    ...(isNew ? { created_at: body?.createdAt || new Date().toISOString() } : {})
  }
}

function mapSalesQuoteRow(row) {
  return withDeletedFields(
    {
      id: row.id,
      quoteNumber: row.quote_number || '',
      agentId: row.agent_id || '',
      customerName: row.customer_name || '',
      customerPhone: row.customer_phone || '',
      customerEmail: row.customer_email || '',
      customerAddress: row.customer_address || '',
      productId: row.product_id || '',
      productName: row.product_name || '',
      quantity: Number(row.quantity) || 1,
      unitPrice: Number(row.unit_price) || 0,
      amount: Number(row.amount) || 0,
      status: row.status || 'draft',
      validUntil: row.valid_until || '',
      notes: row.notes || '',
      saleId: row.sale_id || '',
      emailStatus: row.email_status || '',
      emailedAt: row.emailed_at || '',
      lines: Array.isArray(row.lines) ? row.lines : [],
      createdAt: row.created_at || '',
      updatedAt: row.updated_at || ''
    },
    row
  )
}

function salesQuoteToDb(body, { isNew = false } = {}) {
  const id = String(body?.id || '').trim() || (isNew ? uid('quote') : '')
  const agentId = String(body?.agentId || '').trim() || null
  const productId = String(body?.productId || '').trim() || null
  return {
    id,
    quote_number: String(body?.quoteNumber || id).trim(),
    agent_id: agentId,
    customer_name: String(body?.customerName || '').trim(),
    customer_phone: String(body?.customerPhone || '').trim(),
    customer_email: String(body?.customerEmail || '').trim(),
    customer_address: String(body?.customerAddress || '').trim(),
    product_id: productId,
    product_name: String(body?.productName || '').trim(),
    quantity: Math.max(1, Number(body?.quantity) || 1),
    unit_price: Math.max(0, Number(body?.unitPrice) || 0),
    amount: Math.max(0, Number(body?.amount) || 0),
    status: String(body?.status || 'draft'),
    valid_until: body?.validUntil || null,
    notes: String(body?.notes || '').trim(),
    sale_id: String(body?.saleId || '').trim(),
    email_status: String(body?.emailStatus || '').trim(),
    emailed_at: body?.emailedAt || null,
    lines: Array.isArray(body?.lines) ? body.lines : [],
    updated_at: new Date().toISOString(),
    ...(isNew ? { created_at: body?.createdAt || new Date().toISOString() } : {})
  }
}

function mapSalesInvoiceRow(row) {
  return withDeletedFields(
    {
      id: row.id,
      invoiceNumber: row.invoice_number || '',
      saleId: row.sale_id || '',
      quoteId: row.quote_id || '',
      agentId: row.agent_id || '',
      customerName: row.customer_name || '',
      customerPhone: row.customer_phone || '',
      customerEmail: row.customer_email || '',
      customerAddress: row.customer_address || '',
      productId: row.product_id || '',
      productName: row.product_name || '',
      quantity: Number(row.quantity) || 1,
      unitPrice: Number(row.unit_price) || 0,
      amount: Number(row.amount) || 0,
      status: row.status || 'draft',
      paymentMethod: row.payment_method || 'eft',
      issuedAt: row.issued_at || '',
      sentAt: row.sent_at || '',
      emailStatus: row.email_status || '',
      emailId: row.email_id || '',
      notes: row.notes || '',
      lines: Array.isArray(row.lines) ? row.lines : [],
      createdAt: row.created_at || '',
      updatedAt: row.updated_at || ''
    },
    row
  )
}

function salesInvoiceToDb(body, { isNew = false } = {}) {
  const id = String(body?.id || '').trim() || (isNew ? uid('inv') : '')
  const agentId = String(body?.agentId || '').trim() || null
  const saleId = String(body?.saleId || '').trim() || null
  const productId = String(body?.productId || '').trim() || null
  return {
    id,
    invoice_number: String(body?.invoiceNumber || id).trim(),
    sale_id: saleId,
    quote_id: String(body?.quoteId || '').trim(),
    agent_id: agentId,
    customer_name: String(body?.customerName || '').trim(),
    customer_phone: String(body?.customerPhone || '').trim(),
    customer_email: String(body?.customerEmail || '').trim(),
    customer_address: String(body?.customerAddress || '').trim(),
    product_id: productId,
    product_name: String(body?.productName || '').trim(),
    quantity: Math.max(1, Number(body?.quantity) || 1),
    unit_price: Math.max(0, Number(body?.unitPrice) || 0),
    amount: Math.max(0, Number(body?.amount) || 0),
    status: String(body?.status || 'draft'),
    payment_method: String(body?.paymentMethod || 'eft'),
    issued_at: body?.issuedAt || new Date().toISOString(),
    sent_at: body?.sentAt || null,
    email_status: String(body?.emailStatus || 'pending'),
    email_id: String(body?.emailId || '').trim(),
    notes: String(body?.notes || '').trim(),
    lines: Array.isArray(body?.lines) ? body.lines : [],
    updated_at: new Date().toISOString(),
    ...(isNew ? { created_at: body?.createdAt || new Date().toISOString() } : {})
  }
}

function mapSalesCashRow(row) {
  return withDeletedFields(
    {
      id: row.id,
      type: row.type || 'in',
      category: row.category || 'other',
      amount: Number(row.amount) || 0,
      method: row.method || 'other',
      description: row.description || '',
      saleId: row.sale_id || '',
      agentId: row.agent_id || '',
      at: row.occurred_at || row.created_at || ''
    },
    row
  )
}

function salesCashToDb(body, { isNew = false } = {}) {
  const id = String(body?.id || '').trim() || (isNew ? uid('cash') : '')
  const agentId = String(body?.agentId || '').trim() || null
  const saleId = String(body?.saleId || '').trim() || null
  const allowedCategories = ['sale', 'commission', 'refund', 'expense', 'stock', 'salary', 'other']
  const allowedMethods = ['cash', 'eft', 'card', 'mobile', 'other']
  const category = String(body?.category || 'other')
  const method = String(body?.method || 'other')
  return {
    id,
    type: body?.type === 'out' ? 'out' : 'in',
    category: allowedCategories.includes(category) ? category : 'other',
    amount: Math.max(0, Number(body?.amount) || 0),
    method: allowedMethods.includes(method) ? method : 'other',
    description: String(body?.description || '').trim(),
    sale_id: saleId,
    agent_id: agentId,
    occurred_at: body?.at || new Date().toISOString(),
    ...(isNew ? { created_at: body?.createdAt || new Date().toISOString() } : {})
  }
}

async function upsertSalesRow(env, table, row) {
  await sb(env, `${table}?on_conflict=id`, {
    method: 'POST',
    body: row,
    prefer: 'resolution=merge-duplicates,return=minimal'
  })
}

async function ensureSalesAgentExists(env, agentId, staff = null) {
  const id = String(agentId || '').trim()
  if (!id) return null
  const hit = await sb(env, 'sales_agents?id=eq.' + encodeURIComponent(id) + '&select=id&limit=1')
  if (hit?.[0]) return id
  await upsertSalesRow(env, 'sales_agents', {
    id,
    name: String(staff?.name || staff?.email || 'Sales agent').trim() || 'Sales agent',
    email: String(staff?.email || '').trim().toLowerCase(),
    login_email: String(staff?.email || '').trim().toLowerCase(),
    auth_user_id: String(staff?.id || '').trim(),
    active: true,
    commission_rate: 0,
    phone: '',
    region: '',
    notes: 'Auto-created from finance sync',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  })
  return id
}

async function ensureSalesProductOrNull(env, productId) {
  const id = String(productId || '').trim()
  if (!id) return null
  const hit = await sb(env, 'sales_products?id=eq.' + encodeURIComponent(id) + '&select=id&limit=1')
  return hit?.[0] ? id : null
}

async function ensurePaidSaleCashRows(env, orderRow) {
  if (!orderRow?.id) return
  if (orderRow.status !== 'paid' && orderRow.status !== 'fulfilled') return
  const existing = await sb(
    env,
    'sales_cashflow?sale_id=eq.' + encodeURIComponent(orderRow.id) + '&select=id,category'
  )
  const cats = new Set((existing || []).map((c) => c.category))
  const at = orderRow.sold_at || new Date().toISOString()
  if (!cats.has('sale') && Number(orderRow.amount) > 0) {
    await upsertSalesRow(env, 'sales_cashflow', {
      id: uid('cash'),
      type: 'in',
      category: 'sale',
      amount: Number(orderRow.amount) || 0,
      method: orderRow.payment_method || 'other',
      description: `Sale · ${orderRow.product_name || 'Product'} · ${orderRow.customer_name || ''}`.trim(),
      sale_id: orderRow.id,
      agent_id: orderRow.agent_id || null,
      occurred_at: at,
      created_at: new Date().toISOString()
    })
  }
  if (!cats.has('commission') && Number(orderRow.commission) > 0 && orderRow.agent_id) {
    await upsertSalesRow(env, 'sales_cashflow', {
      id: uid('cash'),
      type: 'out',
      category: 'commission',
      amount: Number(orderRow.commission) || 0,
      method: 'eft',
      description: `Commission · ${orderRow.product_name || 'Sale'}`.trim(),
      sale_id: orderRow.id,
      agent_id: orderRow.agent_id,
      occurred_at: at,
      created_at: new Date().toISOString()
    })
  }
}

function assertAgentAccess(staff, agentId) {
  if (staff.role === 'admin') return null
  if (!staff.agentId) return bad('Sales account is not linked to an agent', 403)
  if (agentId && agentId !== staff.agentId) return bad('Forbidden: other agent data', 403)
  return null
}

function withDeletedFields(mapped, row) {
  return {
    ...mapped,
    deleted: row.deleted === true,
    deletedAt: row.deleted_at || '',
    deletedBy: row.deleted_by || ''
  }
}

async function writeSalesChangeLog(env, {
  staff,
  action,
  entityType,
  entityId,
  entityLabel = '',
  summary = '',
  before = null,
  after = null
}) {
  try {
    await sb(env, 'sales_change_log', {
      method: 'POST',
      body: {
        id: uid('log'),
        occurred_at: new Date().toISOString(),
        actor_user_id: String(staff?.id || ''),
        actor_email: String(staff?.email || ''),
        actor_name: String(staff?.name || ''),
        actor_role: String(staff?.role || ''),
        action: String(action || 'update'),
        entity_type: String(entityType || ''),
        entity_id: String(entityId || ''),
        entity_label: String(entityLabel || entityId || ''),
        summary: String(summary || `${action} ${entityType}`),
        before_data: before && typeof before === 'object' ? before : {},
        after_data: after && typeof after === 'object' ? after : {}
      },
      prefer: 'return=minimal'
    })
  } catch (err) {
    await logAppError(env, {
      source: 'sales_change_log',
      message: err?.message || String(err),
      stack: err?.stack || '',
      context: { note: 'Failed to persist sales change log' }
    })
  }
}

async function softDeleteSalesEntity(env, {
  table,
  id,
  staff,
  entityType,
  label,
  beforeRow
}) {
  const patch = {
    deleted: true,
    deleted_at: new Date().toISOString(),
    deleted_by: String(staff?.email || staff?.id || ''),
    updated_at: new Date().toISOString()
  }
  await sb(env, `${table}?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: patch,
    prefer: 'return=minimal'
  })
  await writeSalesChangeLog(env, {
    staff,
    action: 'delete',
    entityType,
    entityId: id,
    entityLabel: label || id,
    summary: `Marked ${entityType} as deleted: ${label || id}`,
    before: beforeRow || { id },
    after: { ...(beforeRow || { id }), ...patch }
  })
  return json({ ok: true, id, deleted: true })
}

async function restoreSalesEntity(env, {
  table,
  id,
  staff,
  entityType,
  label,
  beforeRow
}) {
  const patch = {
    deleted: false,
    deleted_at: null,
    deleted_by: '',
    updated_at: new Date().toISOString()
  }
  await sb(env, `${table}?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: patch,
    prefer: 'return=minimal'
  })
  await writeSalesChangeLog(env, {
    staff,
    action: 'restore',
    entityType,
    entityId: id,
    entityLabel: label || id,
    summary: `Restored ${entityType}: ${label || id}`,
    before: beforeRow || { id },
    after: { ...(beforeRow || { id }), deleted: false }
  })
  return json({ ok: true, id, deleted: false })
}

function mapChangeLogRow(row) {
  return {
    id: row.id,
    at: row.occurred_at || '',
    actorUserId: row.actor_user_id || '',
    actorEmail: row.actor_email || '',
    actorName: row.actor_name || '',
    actorRole: row.actor_role || '',
    action: row.action || '',
    entityType: row.entity_type || '',
    entityId: row.entity_id || '',
    entityLabel: row.entity_label || '',
    summary: row.summary || '',
    before: row.before_data || {},
    after: row.after_data || {}
  }
}


async function preferredShareSlug(env, profileId, cardType = 'personal') {
  if (!profileId) return ''
  const cards = await sb(
    env,
    `cards?profile_id=eq.${encodeURIComponent(profileId)}&status=eq.linked&select=slug,kind`
  )
  if (!cards?.length) return ''
  const want = cardType === 'table' ? 'table' : 'personal'
  const hit = cards.find((c) => {
    const k = c.kind === 'personal' ? 'personal' : 'table'
    return k === want
  })
  if (hit?.slug) return hit.slug
  return cards[0].slug || ''
}

async function publicProfile(env, row) {
  if (!row) return null
  const shareSlug = await preferredShareSlug(env, row.id, row.card_type)
  return {
    id: row.id,
    cardType: row.card_type,
    name: row.name,
    title: row.title,
    company: row.company,
    phone: row.phone,
    email: row.email,
    whatsapp: row.whatsapp,
    linkedin: row.linkedin,
    youtube: row.youtube,
    x: row.x,
    instagram: row.instagram,
    tiktok: row.tiktok,
    website: row.website,
    address: row.address,
    menuUrl: row.menu_url,
    menuPdf: row.menu_pdf || '',
    menuImages: Array.isArray(row.menu_images) ? row.menu_images : [],
    googleReview: row.google_review,
    checkInUrl: row.check_in_url,
    feedbackUrl: row.feedback_url,
    linkOrder: Array.isArray(row.link_order) ? row.link_order : [],
    showPhone: !!row.show_phone,
    showEmail: !!row.show_email,
    showCheckin: !!row.show_checkin,
    showFeedback: !!row.show_feedback,
    showBooking: row.show_booking !== false,
    checkinForm: row.checkin_form && typeof row.checkin_form === 'object' ? row.checkin_form : {},
    feedbackForm: row.feedback_form && typeof row.feedback_form === 'object' ? row.feedback_form : {},
    catalogItems: normalizeCatalogItems(row.catalog_items),
    avatar: row.avatar,
    logo: row.logo,
    video: row.video,
    disabled: !!row.disabled,
    shareSlug
  }
}

function normalizeCatalogItems(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .slice(0, 40)
    .map((item, i) => {
      const name = String(item?.name || '').trim().slice(0, 120)
      if (!name) return null
      const priceRaw = item?.price
      let price = null
      if (priceRaw !== null && priceRaw !== undefined && priceRaw !== '') {
        const n = Number(priceRaw)
        if (Number.isFinite(n) && n >= 0) price = Math.round(n * 100) / 100
      }
      return {
        id: String(item?.id || `cat_${i + 1}`).trim().slice(0, 64) || `cat_${i + 1}`,
        name,
        description: String(item?.description || '').trim().slice(0, 400),
        price,
        active: item?.active !== false
      }
    })
    .filter(Boolean)
}

function isCrawler(ua = '') {
  return /bot|crawler|spider|slurp|facebookexternalhit|Facebot|WhatsApp|Twitterbot|LinkedInBot|Slackbot|Discordbot|TelegramBot|SkypeUriPreview|Applebot|Google-InspectionTool|preview/i.test(
    String(ua)
  )
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function defaultEmailFrom(env) {
  return String(env.EMAIL_FROM || env.RESEND_FROM || 'tap-na <welcome@tapnam.com>').trim()
}

/** Parse "Name <addr@domain>" or plain address into CF Email Sending shapes. */
function parseEmailFrom(raw) {
  const s = String(raw || '').trim()
  const m = s.match(/^(.*)<([^>]+)>$/)
  if (m) {
    const name = m[1].trim().replace(/^"|"$/g, '')
    const address = m[2].trim()
    return {
      string: name ? `${name} <${address}>` : address,
      binding: name ? { email: address, name } : { email: address },
      rest: name ? { address, name } : { address }
    }
  }
  return {
    string: s,
    binding: { email: s },
    rest: { address: s }
  }
}

function guessMimeType(filename = '') {
  const lower = String(filename).toLowerCase()
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.csv')) return 'text/csv'
  if (lower.endsWith('.txt')) return 'text/plain'
  if (lower.endsWith('.ics')) return 'text/calendar'
  return 'application/octet-stream'
}

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(String(str || ''))
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function icsEscape(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

function formatIcsUtc(date) {
  const d = date instanceof Date ? date : new Date(date)
  const pad = (n) => String(n).padStart(2, '0')
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  )
}

/** Build a METHOD:REQUEST calendar invite (.ics) for both parties. */
function buildMeetingIcs({
  uid,
  title,
  description,
  startIso,
  durationMinutes = 30,
  organizerName,
  organizerEmail,
  attendeeName,
  attendeeEmail,
  location = ''
}) {
  const start = new Date(startIso)
  if (Number.isNaN(start.getTime())) throw new Error('Invalid meeting start time')
  const end = new Date(start.getTime() + Math.max(15, Number(durationMinutes) || 30) * 60 * 1000)
  const stamp = formatIcsUtc(new Date())
  const dtStart = formatIcsUtc(start)
  const dtEnd = formatIcsUtc(end)
  const orgMail = String(organizerEmail || '').trim().toLowerCase()
  const attMail = String(attendeeEmail || '').trim().toLowerCase()
  const lines = [
    'BEGIN:VCALENDAR',
    'PRODID:-//tap-na//Meetings//EN',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${icsEscape(uid)}@tapnam.com`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${icsEscape(title)}`,
    `DESCRIPTION:${icsEscape(description)}`,
    location ? `LOCATION:${icsEscape(location)}` : '',
    orgMail
      ? `ORGANIZER;CN=${icsEscape(organizerName || orgMail)}:mailto:${orgMail}`
      : '',
    orgMail
      ? `ATTENDEE;CN=${icsEscape(organizerName || orgMail)};ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=FALSE:mailto:${orgMail}`
      : '',
    attMail
      ? `ATTENDEE;CN=${icsEscape(attendeeName || attMail)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${attMail}`
      : '',
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR'
  ].filter(Boolean)
  return lines.join('\r\n') + '\r\n'
}

function meetingInviteAttachment(icsText) {
  return {
    filename: 'meeting-invite.ics',
    content: utf8ToBase64(icsText),
    type: 'text/calendar; method=REQUEST',
    contentType: 'text/calendar; method=REQUEST'
  }
}


function base64ToArrayBuffer(b64) {
  const cleaned = String(b64 || '').replace(/\s+/g, '')
  const bin = atob(cleaned)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes.buffer
}

function normalizeAttachmentList(rawAttachments) {
  const out = []
  for (const item of (Array.isArray(rawAttachments) ? rawAttachments : []).slice(0, 5)) {
    const filename = String(item?.filename || '').trim().slice(0, 120)
    const content = String(item?.content || '').replace(/\s+/g, '')
    if (!filename || !content) continue
    if (content.length > 6_000_000) {
      throw new Error(`Attachment too large: ${filename}`)
    }
    const type = String(item?.type || item?.contentType || guessMimeType(filename))
    const disposition = item?.content_id || item?.contentId ? 'inline' : 'attachment'
    const contentId = String(item?.content_id || item?.contentId || '').slice(0, 80)
    out.push({ filename, content, type, disposition, contentId })
  }
  return out
}

/**
 * Send transactional email via Cloudflare Email Sending.
 * Prefers Workers EMAIL binding; falls back to REST API with CLOUDFLARE_API_TOKEN.
 */
async function sendCloudflareEmail(env, opts = {}) {
  const toList = Array.isArray(opts.to)
    ? opts.to.map((x) => String(x || '').trim()).filter(Boolean)
    : String(opts.to || '')
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
  const subject = String(opts.subject || '').trim()
  const html = opts.html != null ? String(opts.html) : ''
  const text = opts.text != null ? String(opts.text) : ''
  if (!toList.length) throw new Error('to is required')
  if (!subject) throw new Error('subject is required')
  if (!html && !text) throw new Error('html or text is required')

  const fromParsed = parseEmailFrom(opts.from || defaultEmailFrom(env))
  const replyToRaw = opts.replyTo || opts.reply_to || ''
  const attachments = normalizeAttachmentList(opts.attachments)

  // 1) Workers binding
  if (env.EMAIL && typeof env.EMAIL.send === 'function') {
    const payload = {
      to: toList.length === 1 ? toList[0] : toList,
      from: fromParsed.binding,
      subject,
      ...(html ? { html } : {}),
      ...(text ? { text } : {})
    }
    if (replyToRaw) {
      const rt = parseEmailFrom(replyToRaw)
      payload.replyTo = rt.binding.email
    }
    if (attachments.length) {
      payload.attachments = attachments.map((a) => ({
        filename: a.filename,
        content: base64ToArrayBuffer(a.content),
        type: a.type,
        disposition: a.disposition,
        ...(a.contentId ? { contentId: a.contentId } : {})
      }))
    }
    const result = await env.EMAIL.send(payload)
    return {
      ok: true,
      id: result?.messageId || result?.id || '',
      provider: 'cloudflare-binding',
      raw: result
    }
  }

  // 2) REST API fallback
  const token = String(env.EMAIL_API_TOKEN || env.CLOUDFLARE_API_TOKEN || '').trim()
  const accountId = String(env.CLOUDFLARE_ACCOUNT_ID || '90cfcc1f7ec6362997f8b063c094c308').trim()
  if (!token) throw new Error('Email is not configured (missing EMAIL binding and EMAIL_API_TOKEN)')

  const body = {
    to: toList.length === 1 ? toList[0] : toList,
    from: fromParsed.rest,
    subject,
    ...(html ? { html } : {}),
    ...(text ? { text } : {})
  }
  if (replyToRaw) {
    const rt = parseEmailFrom(replyToRaw)
    body.reply_to = rt.rest.address
  }
  if (attachments.length) {
    body.attachments = attachments.map((a) => ({
      filename: a.filename,
      content: a.content,
      type: a.type,
      disposition: a.disposition,
      ...(a.contentId ? { content_id: a.contentId } : {})
    }))
  }

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/email/sending/send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    }
  )
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data?.success === false) {
    const err =
      data?.errors?.[0]?.message ||
      data?.messages?.[0]?.message ||
      data?.error ||
      `Cloudflare Email HTTP ${res.status}`
    const e = new Error(String(err))
    e.status = res.status
    e.data = data
    throw e
  }
  return {
    ok: true,
    id: data?.result?.message_id || data?.result?.id || '',
    provider: 'cloudflare-rest',
    delivered: data?.result?.delivered || [],
    queued: data?.result?.queued || [],
    permanent_bounces: data?.result?.permanent_bounces || [],
    raw: data
  }
}

function transactionalShell({ title, intro, bodyHtml, footerNote }) {
  return `
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;color:#111;line-height:1.5;max-width:560px;margin:0 auto;padding:24px;">
  <h1 style="font-size:20px;margin:0 0 4px;">tap-na</h1>
  <p style="margin:0 0 20px;color:#555;font-size:13px;">Powered by tapnam.com</p>
  <h2 style="font-size:18px;margin:0 0 8px;">${escapeHtml(title)}</h2>
  ${intro ? `<p style="margin:0 0 16px;color:#555;font-size:14px;">${escapeHtml(intro)}</p>` : ''}
  ${bodyHtml || ''}
  ${footerNote ? `<p style="font-size:12px;color:#777;margin:24px 0 0;">${escapeHtml(footerNote)}</p>` : ''}
</body>
</html>`.trim()
}

async function sendWelcomeEmail(env, { email, name, cardType }) {
  const display = String(name || '').trim() || 'there'
  const kind = cardType === 'table' ? 'business' : 'personal'
  const html = transactionalShell({
    title: 'Welcome to tap-na',
    intro: `Hi ${display}, your ${kind} account is ready.`,
    bodyHtml: `
      <p style="margin:0 0 12px;">You can log in anytime at <a href="https://tapnam.com/login">tapnam.com/login</a>.</p>
      <p style="margin:0;">Edit your profile, share your NFC link, and start connecting.</p>`,
    footerNote: 'If you did not create this account, you can ignore this email.'
  })
  const text = [
    `Welcome to tap-na`,
    ``,
    `Hi ${display}, your ${kind} account is ready.`,
    `Log in: https://tapnam.com/login`,
    ``,
    `If you did not create this account, ignore this email.`
  ].join('\n')
  return sendCloudflareEmail(env, {
    to: email,
    subject: 'Welcome to tap-na',
    html,
    text
  })
}

async function sendLoginAlertEmail(env, { email, name }) {
  const display = String(name || '').trim() || 'there'
  const when = new Date().toUTCString()
  const html = transactionalShell({
    title: 'New sign-in',
    intro: `Hi ${display}, someone just signed in to your tap-na account.`,
    bodyHtml: `<p style="margin:0;">Time (UTC): <strong>${escapeHtml(when)}</strong></p>`,
    footerNote: 'If this was not you, change your password from Profile after logging in.'
  })
  const text = `New sign-in to tap-na\n\nHi ${display},\nSomeone signed in at ${when} UTC.\nIf this was not you, change your password.`
  return sendCloudflareEmail(env, {
    to: email,
    subject: 'tap-na sign-in alert',
    html,
    text
  })
}

async function sendSalesAgentCredentialsEmail(env, { email, name, password }) {
  const display = String(name || '').trim() || 'there'
  const loginEmail = String(email || '').trim().toLowerCase()
  const loginUrl = 'https://tapnam.com/login?next=/admin/sales'
  const salesUrl = 'https://tapnam.com/admin/sales'
  const html = transactionalShell({
    title: 'Your sales agent login',
    intro: `Hi ${display}, your tap-na sales account is ready.`,
    bodyHtml: `
      <p style="margin:0 0 12px;">Use these details to sign in:</p>
      <p style="margin:0 0 8px;"><strong>Login email:</strong> ${escapeHtml(loginEmail)}</p>
      <p style="margin:0 0 16px;"><strong>Password:</strong> ${escapeHtml(String(password || ''))}</p>
      <p style="margin:0 0 8px;"><strong>Login:</strong> <a href="${loginUrl}">${escapeHtml(loginUrl)}</a></p>
      <p style="margin:0 0 16px;"><strong>Sales module:</strong> <a href="${salesUrl}">${escapeHtml(salesUrl)}</a></p>
      <p style="margin:0;">After logging in you will open the Sales workspace for your agent records.</p>`,
    footerNote: 'Keep this email private. Change your password after first login if needed.'
  })
  const text = [
    'Your tap-na sales agent login',
    '',
    `Hi ${display}, your sales account is ready.`,
    '',
    `Login email: ${loginEmail}`,
    `Password: ${password || ''}`,
    '',
    `Login: ${loginUrl}`,
    `Sales module: ${salesUrl}`,
    '',
    'Keep this email private.'
  ].join('\n')
  return sendCloudflareEmail(env, {
    to: loginEmail,
    subject: 'Your tap-na sales login',
    html,
    text
  })
}

function ogHtml({ title, description, url, image, site = 'tap-na' }) {
  const t = escapeHtml(title)
  const d = escapeHtml(description)
  const u = escapeHtml(url)
  const img = escapeHtml(image)
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${t}</title>
  <meta name="description" content="${d}">
  <link rel="canonical" href="${u}">
  <meta property="og:type" content="profile">
  <meta property="og:site_name" content="${escapeHtml(site)}">
  <meta property="og:title" content="${t}">
  <meta property="og:description" content="${d}">
  <meta property="og:url" content="${u}">
  <meta property="og:image" content="${img}">
  <meta property="og:image:secure_url" content="${img}">
  <meta property="og:image:width" content="400">
  <meta property="og:image:height" content="400">
  <meta property="og:image:alt" content="${t} profile picture">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${t}">
  <meta name="twitter:description" content="${d}">
  <meta name="twitter:image" content="${img}">
  <meta http-equiv="refresh" content="0;url=${u}">
</head>
<body>
  <p><a href="${u}">${t}</a></p>
</body>
</html>`
}

async function serveOgImage(env, origin, slug) {
  const cards = await sb(env, `cards?slug=eq.${encodeURIComponent(slug)}&select=*`)
  const card = cards?.[0]
  if (!card?.profile_id) {
    return Response.redirect(`${origin}/images/personal.png`, 302)
  }
  const profiles = await sb(env, `profiles?id=eq.${encodeURIComponent(card.profile_id)}&select=*`)
  const profile = profiles?.[0]
  if (!profile) return Response.redirect(`${origin}/images/personal.png`, 302)

  const raw =
    (profile.card_type === 'table' ? profile.logo || profile.avatar : profile.avatar || profile.logo) ||
    ''

  if (/^https?:\/\//i.test(raw)) {
    try {
      const upstream = await fetch(raw, {
        headers: { Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*' }
      })
      if (upstream.ok && upstream.body) {
        const headers = new Headers()
        headers.set('Content-Type', upstream.headers.get('Content-Type') || 'image/jpeg')
        headers.set('Cache-Control', 'public, max-age=3600, s-maxage=86400')
        headers.set('Content-Disposition', `inline; filename="${escapeHtml(slug)}-profile-image"`)
        headers.set('X-Content-Type-Options', 'nosniff')
        return new Response(upstream.body, { status: 200, headers })
      }
    } catch {
      /* fall through to the default profile image */
    }
  }
  if (raw.startsWith('data:image/')) {
    const m = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
    if (m) {
      const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0))
      return new Response(bytes, {
        headers: {
          'Content-Type': m[1],
          'Cache-Control': 'public, max-age=3600'
        }
      })
    }
  }
  const path = raw.startsWith('/') ? raw : '/images/personal.png'
  return Response.redirect(`${origin}${path}`, 302)
}

function destinationFor(card, profile) {
  if (!profile) return null
  if (profile.disabled) {
    return {
      path: profile.card_type === 'table' ? '/business' : '/me',
      blocked: true
    }
  }
  // Only two categories: personal → /me, table → /business (never redirect off-site)
  if (profile.card_type === 'personal' || card.kind === 'personal') {
    return { path: '/me', blocked: false }
  }
  return { path: '/business', blocked: false }
}

async function handleApi(request, env, url) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return bad('Supabase is not configured on this Worker', 500)
  }

  const { pathname } = url
  const method = request.method

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (pathname === '/api/health') {
    return json({ ok: true, service: 'tap-na', domain: 'tapnam.com', db: 'supabase' })
  }

  if (pathname === '/api/staff/login' && method === 'POST') {
    const body = await readJson(request)
    const email = String(body?.email || '').trim().toLowerCase()
    const password = String(body?.password || '')
    if (!email || !password) return bad('Email and password required')
    try {
      await ensureDefaultStaffAdmin(env)
    } catch (err) {
      if (!err?._logged) {
        await logAppError(env, {
          source: 'staff',
          message: err?.message || 'Could not ensure admin account',
          stack: err?.stack || '',
          path: '/api/staff/login',
          method: 'POST',
          status: 500,
          context: { kind: 'ensure_default_admin' }
        })
      }
      return bad(err.message || 'Could not ensure admin account', 500)
    }
    const key = String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return bad(data?.error_description || data?.msg || data?.error || 'Invalid login', 401)
    }
    const claims = staffClaimsFromUser(data.user)
    if (!claims.role) return bad('This account is not staff', 403)
    if (email.includes('@')) {
      sendLoginAlertEmail(env, {
        email,
        name: claims.name || data.user?.user_metadata?.full_name || ''
      }).catch((err) => logAppError(env, {
        source: 'email',
        message: err?.message || String(err),
        stack: err?.stack || '',
        path: '/api/staff/login',
        method: 'POST',
        context: { kind: 'staff_login_alert' }
      }))
    }
    return json(staffSessionPayload(data, data.user))
  }

  if (pathname === '/api/staff/refresh' && method === 'POST') {
    const body = await readJson(request)
    const refreshToken = String(body?.refreshToken || '').trim()
    if (!refreshToken) return bad('refreshToken required')
    const key = String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ refresh_token: refreshToken })
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return bad(data?.error_description || data?.msg || data?.error || 'Session expired', 401)
    }
    const claims = staffClaimsFromUser(data.user)
    if (!claims.role) return bad('This account is not staff', 403)
    return json(staffSessionPayload(data, data.user))
  }

  if (pathname === '/api/staff/me' && method === 'GET') {
    const gate = await requireStaff(env, request)
    if (gate.error) return gate.error
    return json({ ok: true, user: gate.staff })
  }

  if (pathname === '/api/staff/logout' && method === 'POST') {
    const token = bearerToken(request)
    if (token) {
      try {
        const key = String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
        await fetch(`${env.SUPABASE_URL}/auth/v1/logout`, {
          method: 'POST',
          headers: {
            apikey: key,
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
      } catch {
        /* ignore */
      }
    }
    return json({ ok: true })
  }

  if (pathname === '/api/staff/users' && method === 'POST') {
    const gate = await requireStaff(env, request, { roles: ['admin'] })
    if (gate.error) return gate.error
    const body = await readJson(request)
    const email = String(body?.email || '').trim().toLowerCase()
    const password = String(body?.password || '')
    const agentId = String(body?.agentId || '').trim()
    const name = String(body?.name || '').trim()
    const role = body?.role === 'admin' ? 'admin' : 'sales'
    const sendCredentialsEmail = body?.sendCredentialsEmail !== false
    if (!email) return bad('Email required')
    if (role === 'sales' && !agentId) return bad('agentId required for sales users')
    if (!password && !body?.authUserId) return bad('Password required for new login')

    try {
      let userId = String(body?.authUserId || '').trim()
      let wasCreated = false
      let claims = null

      if (userId) {
        const patch = {
          email,
          email_confirm: true,
          app_metadata: {
            role,
            agent_id: role === 'sales' ? agentId : ''
          },
          user_metadata: { name: name || email }
        }
        if (password) patch.password = password
        const updated = await authAdminFetch(env, `/admin/users/${userId}`, {
          method: 'PUT',
          body: patch
        })
        claims = staffClaimsFromUser(updated?.user || updated)
      } else {
        // Find existing by email first
        const listed = await authAdminFetch(env, '/admin/users?page=1&per_page=200')
        const existing = (listed?.users || []).find(
          (u) => String(u.email || '').toLowerCase() === email
        )
        if (existing?.id) {
          const patch = {
            email,
            email_confirm: true,
            app_metadata: {
              ...(existing.app_metadata || {}),
              role,
              agent_id: role === 'sales' ? agentId : ''
            },
            user_metadata: {
              ...(existing.user_metadata || {}),
              name: name || existing.user_metadata?.name || email
            }
          }
          if (password) patch.password = password
          const updated = await authAdminFetch(env, `/admin/users/${existing.id}`, {
            method: 'PUT',
            body: patch
          })
          claims = staffClaimsFromUser(
            updated?.user || { ...existing, ...patch, id: existing.id, email }
          )
        } else {
          if (!password) return bad('Password required for new login')
          const created = await authAdminFetch(env, '/admin/users', {
            method: 'POST',
            body: {
              email,
              password,
              email_confirm: true,
              app_metadata: {
                role,
                agent_id: role === 'sales' ? agentId : ''
              },
              user_metadata: { name: name || email }
            }
          })
          wasCreated = true
          claims = staffClaimsFromUser(created?.user || created)
        }
      }

      if (role === 'sales' && agentId && claims?.id) {
        try {
          await upsertSalesRow(env, 'sales_agents', {
            id: agentId,
            login_email: email,
            auth_user_id: claims.id,
            updated_at: new Date().toISOString()
          })
        } catch {
          /* agent row may be updated by client; login still works via app_metadata */
        }
      }

      let emailSent = false
      let emailError = ''
      if (role === 'sales' && sendCredentialsEmail && password) {
        try {
          const sent = await sendSalesAgentCredentialsEmail(env, {
            email,
            name: name || email,
            password
          })
          emailSent = Boolean(sent?.ok)
          if (!emailSent) emailError = sent?.error || 'Email send failed'
        } catch (err) {
          emailError = err?.message || 'Email send failed'
          await logAppError(env, {
            source: 'email',
            message: emailError,
            stack: err?.stack || '',
            path: pathname,
            method,
            context: { kind: 'sales_agent_credentials' },
            actor: gate.staff
          })
        }
      }

      return json({
        ok: true,
        user: claims,
        created: wasCreated,
        emailSent,
        emailError: emailError || undefined
      })
    } catch (err) {
      if (!err?._logged) {
        await logAppError(env, {
          source: 'staff',
          message: err?.message || 'Could not create staff user',
          stack: err?.stack || '',
          path: pathname,
          method,
          status: err?.status || 500,
          context: { kind: 'create_staff_user' }
        })
      }
      return bad(err.message || 'Could not create staff user', err.status || 500)
    }
  }

  if (pathname === '/api/cards/provision' && method === 'POST') {
    const gate = await requireStaff(env, request, { roles: ['admin', 'sales'] })
    if (gate.error) return gate.error
    const body = await readJson(request)
    const count = Math.min(500, Math.max(1, Number(body?.count) || 1))
    const kind = body?.kind === 'personal' ? 'personal' : 'table'
    const created = []
    for (let i = 0; i < count; i++) {
      const id = uid('card')
      const slug = await uniqueSlug(env)
      await sb(env, 'cards', {
        method: 'POST',
        body: {
          id,
          slug,
          kind,
          product_id: body?.productId || '',
          status: 'unlinked'
        },
        prefer: 'return=minimal'
      })
      created.push({
        id,
        slug,
        kind,
        nfcUrl: cardPageUrl(slug, kind, url.origin),
        qrUrl: `${cardPageUrl(slug, kind, url.origin)}?via=qr`
      })
    }
    return json({ ok: true, cards: created })
  }

  const cardMatch = pathname.match(/^\/api\/cards\/([^/]+)$/)
  if (cardMatch && method === 'GET') {
    const slug = decodeURIComponent(cardMatch[1])
    const cards = await sb(env, `cards?slug=eq.${encodeURIComponent(slug)}&select=*`)
    const card = cards?.[0]
    if (!card) return bad('Card not found', 404)
    let profile = null
    if (card.profile_id) {
      const profiles = await sb(env, `profiles?id=eq.${encodeURIComponent(card.profile_id)}&select=*`)
      profile = profiles?.[0] || null
    }
    return json({
      ok: true,
      card: {
        id: card.id,
        slug: card.slug,
        kind: card.kind,
        status: card.status,
        profileId: card.profile_id
      },
      profile: await publicProfile(env, profile),
      destination: destinationFor(card, profile)
    })
  }

  const ogMatch = pathname.match(/^\/api\/og\/([^/.]+)(?:\.(?:jpg|jpeg|png|webp))?$/i)
  if (ogMatch && method === 'GET') {
    const slug = decodeURIComponent(ogMatch[1])
    return serveOgImage(env, url.origin, slug)
  }

  const openMatch = pathname.match(/^\/api\/cards\/([^/]+)\/open$/)
  if (openMatch && method === 'POST') {
    const slug = decodeURIComponent(openMatch[1])
    const body = await readJson(request)
    const via = String(body?.via || url.searchParams.get('via') || '').toLowerCase()
    const channel = via === 'qr' ? 'qr' : 'nfc'
    const recorded = await recordCardActivity(env, request, { slug, channel, action: 'open' })
    if (!recorded) return bad('Card not found', 404)
    return json({ ok: true, ...recorded })
  }

  const eventMatch = pathname.match(/^\/api\/cards\/([^/]+)\/event$/)
  if (eventMatch && method === 'POST') {
    const slug = decodeURIComponent(eventMatch[1])
    const body = await readJson(request)
    const actionRaw = String(body?.action || body?.type || 'click').trim().toLowerCase()
    const action = actionRaw.replace(/[^a-z0-9_.:-]/g, '_').slice(0, 64) || 'click'
    const via = String(body?.via || url.searchParams.get('via') || '').toLowerCase()
    let channel = 'other'
    if (via === 'qr') channel = 'qr'
    else if (via === 'nfc') channel = 'nfc'
    else if (action.startsWith('share')) channel = 'other'
    const recorded = await recordCardActivity(env, request, { slug, channel, action })
    if (!recorded) return bad('Card not found', 404)
    return json({ ok: true, ...recorded })
  }

  const claimMatch = pathname.match(/^\/api\/cards\/([^/]+)\/claim$/)
  if (claimMatch && method === 'POST') {
    const slug = decodeURIComponent(claimMatch[1])
    const body = await readJson(request)
    const sessionProfile = await getSessionProfile(env, request)
    const profileId = body?.profileId || sessionProfile?.id
    if (!profileId) return bad('Login or provide profileId', 401)

    const cards = await sb(env, `cards?slug=eq.${encodeURIComponent(slug)}&select=*`)
    const card = cards?.[0]
    if (!card) return bad('Card not found', 404)
    if (card.profile_id && card.profile_id !== profileId) {
      return bad('Card already linked to another profile', 409)
    }

    let profile = sessionProfile
    if (!profile || profile.id !== profileId) {
      const rows = await sb(env, `profiles?id=eq.${encodeURIComponent(profileId)}&select=*`)
      profile = rows?.[0] || null
    }
    await ensureProfileStub(env, profileId, body?.profileName || '')
    if (!profile) {
      const rows = await sb(env, `profiles?id=eq.${encodeURIComponent(profileId)}&select=*`)
      profile = rows?.[0] || null
    }

    // Every profile may only link one card slug
    const linked = await sb(
      env,
      `cards?profile_id=eq.${encodeURIComponent(profileId)}&status=eq.linked&select=slug,kind`
    )
    const other = (linked || []).find((c) => c.slug !== slug)
    if (other) {
      return bad(
        `This profile already uses slug ${other.slug}. Each profile can only link one card.`,
        409
      )
    }

    const patch = {
      profile_id: profileId,
      status: 'linked',
      linked_at: new Date().toISOString()
    }
    if (body?.kind) patch.kind = body.kind === 'personal' ? 'personal' : 'table'

    await sb(env, `cards?slug=eq.${encodeURIComponent(slug)}`, {
      method: 'PATCH',
      body: patch,
      prefer: 'return=minimal'
    })

    return json({ ok: true, slug, profileId })
  }

  const unlinkMatch = pathname.match(/^\/api\/cards\/([^/]+)\/unlink$/)
  if (unlinkMatch && method === 'POST') {
    const gate = await requireStaff(env, request, { roles: ['admin'] })
    if (gate.error) return gate.error
    const slug = decodeURIComponent(unlinkMatch[1])
    const cards = await sb(env, `cards?slug=eq.${encodeURIComponent(slug)}&select=id`)
    if (!cards?.length) return bad('Card not found', 404)
    await sb(env, `cards?slug=eq.${encodeURIComponent(slug)}`, {
      method: 'PATCH',
      body: { profile_id: null, status: 'unlinked', linked_at: null },
      prefer: 'return=minimal'
    })
    return json({ ok: true, slug })
  }

  const kindMatch = pathname.match(/^\/api\/cards\/([^/]+)$/)
  if (kindMatch && method === 'PATCH') {
    const gate = await requireStaff(env, request, { roles: ['admin'] })
    if (gate.error) return gate.error
    const slug = decodeURIComponent(kindMatch[1])
    const body = await readJson(request)
    const cards = await sb(env, `cards?slug=eq.${encodeURIComponent(slug)}&select=id`)
    if (!cards?.length) return bad('Card not found', 404)
    const kind = body?.kind === 'personal' ? 'personal' : 'table'
    await sb(env, `cards?slug=eq.${encodeURIComponent(slug)}`, {
      method: 'PATCH',
      body: { kind },
      prefer: 'return=minimal'
    })
    return json({ ok: true, slug, kind })
  }

  const deleteMatch = pathname.match(/^\/api\/cards\/([^/]+)$/)
  if (deleteMatch && method === 'DELETE') {
    const gate = await requireStaff(env, request, { roles: ['admin'] })
    if (gate.error) return gate.error
    const slug = decodeURIComponent(deleteMatch[1])
    const cards = await sb(env, `cards?slug=eq.${encodeURIComponent(slug)}&select=id`)
    const card = cards?.[0]
    if (!card) return bad('Card not found', 404)
    await sb(env, `card_opens?card_id=eq.${encodeURIComponent(card.id)}`, {
      method: 'DELETE',
      prefer: 'return=minimal'
    })
    await sb(env, `cards?id=eq.${encodeURIComponent(card.id)}`, {
      method: 'DELETE',
      prefer: 'return=minimal'
    })
    return json({ ok: true, slug })
  }

  if (pathname === '/api/auth/signup' && method === 'POST') {
    const body = await readJson(request)
    const email = String(body?.loginEmail || body?.email || '').trim().toLowerCase()
    const passwordHash = String(body?.passwordHash || '').trim()
    const slug = String(body?.slug || '').trim()

    if (!email) return bad('Email is required')
    if (!passwordHash) return bad('Password is required')

    let claimCard = null
    if (slug) {
      const cards = await sb(env, `cards?slug=eq.${encodeURIComponent(slug)}&select=*`)
      claimCard = cards?.[0]
      if (!claimCard) return bad('Card not found', 404)
      if (claimCard.profile_id || claimCard.status === 'linked') {
        return bad('Card already linked to another profile', 409)
      }
    }

    const existing = await sb(
      env,
      `profiles?or=(login_email.ilike.${encodeURIComponent(email)},email.ilike.${encodeURIComponent(email)})&select=id&limit=1`
    )
    if (existing?.length) return bad('An account with this email already exists', 409)

    const id = uid('prof')
    const cardType = claimCard
      ? (claimCard.kind === 'personal' ? 'personal' : 'table')
      : (body.cardType === 'table' ? 'table' : 'personal')
    await sb(env, 'profiles', {
      method: 'POST',
      body: {
        id,
        card_type: cardType,
        name: String(body.name || '').trim(),
        company: body.company || '',
        email,
        phone: body.phone || '',
        login_email: email,
        login_phone: body.loginPhone || body.phone || '',
        password_hash: passwordHash
      },
      prefer: 'return=minimal'
    })

    if (claimCard) {
      const claimed = await sb(
        env,
        `cards?slug=eq.${encodeURIComponent(slug)}&profile_id=is.null`,
        {
          method: 'PATCH',
          body: {
            profile_id: id,
            status: 'linked',
            linked_at: new Date().toISOString()
          },
          prefer: 'return=representation'
        }
      )
      if (!claimed?.length) {
        await sb(env, `profiles?id=eq.${encodeURIComponent(id)}`, {
          method: 'DELETE',
          prefer: 'return=minimal'
        })
        return bad('Card was claimed by another profile', 409)
      }
    }

    const token = uid('tok')
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    await sb(env, 'sessions', {
      method: 'POST',
      body: { id: uid('sess'), profile_id: id, token, expires_at: expires },
      prefer: 'return=minimal'
    })

    const profiles = await sb(env, `profiles?id=eq.${encodeURIComponent(id)}&select=*`)
    const pub = await publicProfile(env, profiles?.[0])
    // Fire-and-forget welcome email
    sendWelcomeEmail(env, {
      email,
      name: pub?.name || body.name || '',
      cardType: pub?.cardType || cardType
    }).catch((err) => logAppError(env, {
      source: 'email',
      message: err?.message || String(err),
      stack: err?.stack || '',
      path: pathname,
      method,
      context: { kind: 'welcome_email' }
    }))
    return json({ ok: true, token, profile: pub })
  }

  if (pathname === '/api/auth/login' && method === 'POST') {
    const body = await readJson(request)
    const id = String(body?.identifier || '').trim().toLowerCase()
    if (!id) return bad('Identifier required')
    let profiles = await sb(
      env,
      `profiles?or=(login_email.ilike.${encodeURIComponent(id)},email.ilike.${encodeURIComponent(id)},login_phone.eq.${encodeURIComponent(body.identifier.trim())},phone.eq.${encodeURIComponent(body.identifier.trim())})&select=*&limit=1`
    )
    const profile = profiles?.[0]
    if (!profile) return bad('Account not found', 404)
    if (profile.password_hash && body.passwordHash && profile.password_hash !== body.passwordHash) {
      return bad('Invalid password', 401)
    }
    const token = uid('tok')
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    await sb(env, 'sessions', {
      method: 'POST',
      body: { id: uid('sess'), profile_id: profile.id, token, expires_at: expires },
      prefer: 'return=minimal'
    })
    const loginEmail = String(profile.login_email || profile.email || '').trim().toLowerCase()
    if (loginEmail.includes('@')) {
      sendLoginAlertEmail(env, {
        email: loginEmail,
        name: profile.name || ''
      }).catch((err) => logAppError(env, {
        source: 'email',
        message: err?.message || String(err),
        stack: err?.stack || '',
        path: pathname,
        method,
        context: { kind: 'login_alert_email' }
      }))
    }
    return json({ ok: true, token, profile: await publicProfile(env, profile) })
  }

  if (pathname === '/api/shop/products' && method === 'GET') {
    const rows = await sb(
      env,
      'sales_products?active=eq.true&deleted=eq.false&select=id,name,default_price,category,active,description,images,video,created_at,updated_at&order=name.asc'
    )
    return json({
      ok: true,
      products: (rows || []).map((row) => mapSalesProductPublic(row))
    })
  }

  if (pathname === '/api/sales/products' && method === 'GET') {
  const gate = await requireStaff(env, request, { roles: ['admin', 'sales'] })
  if (gate.error) return gate.error
  const includeInactive = url.searchParams.get('includeInactive') !== '0'
  const includeDeleted = gate.staff.role === 'admin' && url.searchParams.get('includeDeleted') === '1'
  const filters = []
  if (includeInactive) {
    // no active filter
  } else {
    filters.push('active=eq.true')
  }
  if (!includeDeleted) {
    filters.push('deleted=eq.false')
  }
  const filter = filters.length ? filters.join('&') + '&' : ''
  const rows = await sb(
    env,
    `sales_products?${filter}select=*&order=name.asc`
  )
  return json({
    ok: true,
    products: (rows || []).map((row) => mapSalesProductRow(row))
  })
  }

  if (pathname === '/api/sales/products' && method === 'POST') {
  const gate = await requireStaff(env, request, { roles: ['admin'] })
  if (gate.error) return gate.error
  const body = await readJson(request)
  const row = salesProductToDb(body, { isNew: true })
  if (!row.name) return bad('Product name is required')
  await upsertSalesRow(env, 'sales_products', row)
  const saved = await sb(
    env,
    `sales_products?id=eq.${encodeURIComponent(row.id)}&select=*`
  )
  const savedRow = saved?.[0] || row
  await writeSalesChangeLog(env, {
    staff: gate.staff,
    action: 'create',
    entityType: 'product',
    entityId: savedRow.id || row.id,
    entityLabel: savedRow.name || row.name,
    summary: `Created product: ${savedRow.name || row.name || row.id}`,
    before: null,
    after: savedRow
  })
  return json({ ok: true, product: mapSalesProductRow(savedRow) })
  }

  const salesProductMatch = pathname.match(/^\/api\/sales\/products\/([^/]+)$/)
  if (salesProductMatch && method === 'PUT') {
  const gate = await requireStaff(env, request, { roles: ['admin'] })
  if (gate.error) return gate.error
  const id = decodeURIComponent(salesProductMatch[1])
  const body = await readJson(request)
  const existing = await sb(env, `sales_products?id=eq.${encodeURIComponent(id)}&select=*`)
  const beforeRow = existing?.[0] || null
  const row = salesProductToDb({ ...body, id }, { isNew: false })
  if (!row.name) return bad('Product name is required')
  await sb(env, `sales_products?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: {
      name: row.name,
      default_price: row.default_price,
      category: row.category,
      active: row.active,
      description: row.description,
      images: row.images,
      video: row.video,
      updated_at: new Date().toISOString()
    },
    prefer: 'return=minimal'
  })
  const saved = await sb(
    env,
    `sales_products?id=eq.${encodeURIComponent(id)}&select=*`
  )
  const savedRow = saved?.[0]
  if (!savedRow) return bad('Product not found', 404)
  await writeSalesChangeLog(env, {
    staff: gate.staff,
    action: beforeRow ? 'update' : 'create',
    entityType: 'product',
    entityId: savedRow.id || id,
    entityLabel: savedRow.name || row.name,
    summary: `${beforeRow ? 'Updated' : 'Created'} product: ${savedRow.name || row.name || id}`,
    before: beforeRow,
    after: savedRow
  })
  return json({ ok: true, product: mapSalesProductRow(savedRow) })
  }

  if (salesProductMatch && method === 'DELETE') {
  const gate = await requireStaff(env, request, { roles: ['admin'] })
  if (gate.error) return gate.error
  const id = decodeURIComponent(salesProductMatch[1])
  const existing = await sb(env, `sales_products?id=eq.${encodeURIComponent(id)}&select=*`)
  const beforeRow = existing?.[0]
  if (!beforeRow) return bad('Product not found', 404)
  return await softDeleteSalesEntity(env, {
    table: 'sales_products',
    id,
    staff: gate.staff,
    entityType: 'product',
    label: beforeRow.name || id,
    beforeRow
  })
  }

  const salesProductRestoreMatch = pathname.match(/^\/api\/sales\/products\/([^/]+)\/restore$/)
  if (salesProductRestoreMatch && method === 'POST') {
  const gate = await requireStaff(env, request, { roles: ['admin'] })
  if (gate.error) return gate.error
  const id = decodeURIComponent(salesProductRestoreMatch[1])
  const existing = await sb(env, `sales_products?id=eq.${encodeURIComponent(id)}&select=*`)
  const beforeRow = existing?.[0]
  if (!beforeRow) return bad('Product not found', 404)
  return await restoreSalesEntity(env, {
    table: 'sales_products',
    id,
    staff: gate.staff,
    entityType: 'product',
    label: beforeRow.name || id,
    beforeRow
  })
  }

  if (pathname === '/api/sales/finance' && method === 'GET') {
  const gate = await requireStaff(env, request, { roles: ['admin', 'sales'] })
  if (gate.error) return gate.error
  const staff = gate.staff
  const isAdmin = staff.role === 'admin'
  const agentId = String(staff.agentId || '').trim()
  if (!isAdmin && !agentId) return bad('Sales account is not linked to an agent', 403)

  const agentQ = isAdmin
    ? 'sales_agents?select=*&order=name.asc&limit=1000'
    : 'sales_agents?deleted=eq.false&id=eq.' + encodeURIComponent(agentId) + '&select=*&limit=1'
  const scope = isAdmin
    ? ''
    : 'deleted=eq.false&agent_id=eq.' + encodeURIComponent(agentId) + '&'
  const [agents, orders, quotes, invoices, cash] = await Promise.all([
    sb(env, agentQ),
    sb(env, 'sales_orders?' + scope + 'select=*&order=sold_at.desc&limit=2000'),
    sb(env, 'sales_quotes?' + scope + 'select=*&order=created_at.desc&limit=2000'),
    sb(env, 'sales_invoices?' + scope + 'select=*&order=issued_at.desc&limit=2000'),
    sb(env, 'sales_cashflow?' + scope + 'select=*&order=occurred_at.desc&limit=2000')
  ])
  return json({
    ok: true,
    scope: isAdmin ? 'all' : 'agent',
    agents: (agents || []).map(mapSalesAgentRow),
    orders: (orders || []).map(mapSalesOrderRow),
    quotes: (quotes || []).map(mapSalesQuoteRow),
    invoices: (invoices || []).map(mapSalesInvoiceRow),
    cashflow: (cash || []).map(mapSalesCashRow)
  })
  }

  if (pathname === '/api/sales/changelog' && method === 'GET') {
  const gate = await requireStaff(env, request, { roles: ['admin'] })
  if (gate.error) return gate.error
  const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get('limit') || 200) || 200))
  const rows = await sb(
    env,
    'sales_change_log?select=*&order=occurred_at.desc&limit=' + limit
  )
  return json({
    ok: true,
    changes: (rows || []).map(mapChangeLogRow)
  })
  }

  if (pathname === '/api/admin/errors' && method === 'GET') {
    const gate = await requireStaff(env, request, { roles: ['admin'] })
    if (gate.error) return gate.error
    const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get('limit') || 200) || 200))
    const source = String(url.searchParams.get('source') || '').trim()
    let q = 'app_error_log?select=*&order=occurred_at.desc&limit=' + limit
    if (source) q += '&source=eq.' + encodeURIComponent(source)
    const rows = await sb(env, q)
    return json({
      ok: true,
      errors: (rows || []).map(mapErrorLogRow)
    })
  }

  if (pathname === '/api/admin/errors' && method === 'POST') {
    const gate = await requireStaff(env, request, { roles: ['admin', 'sales'] })
    if (gate.error) return gate.error
    const body = await readJson(request)
    await logAppError(env, {
      source: String(body?.source || 'client').slice(0, 80),
      message: String(body?.message || 'Client error'),
      stack: String(body?.stack || ''),
      path: String(body?.path || ''),
      method: String(body?.method || ''),
      status: body?.status == null ? null : Number(body.status) || null,
      context: body?.context && typeof body.context === 'object' ? body.context : {},
      actor: gate.staff
    })
    return json({ ok: true })
  }

  if (pathname === '/api/sales/agents' && method === 'PUT') {
  const gate = await requireStaff(env, request, { roles: ['admin'] })
  if (gate.error) return gate.error
  const body = await readJson(request)
  const existingId = String(body?.id || '').trim()
  const existing = existingId
    ? await sb(env, 'sales_agents?id=eq.' + encodeURIComponent(existingId) + '&select=*')
    : []
  const beforeRow = existing?.[0] || null
  const row = salesAgentToDb(body, { isNew: !beforeRow })
  if (!row.id) return bad('Agent id required')
  if (!row.name) return bad('Agent name is required')
  const payload = {
    ...row,
    created_at: beforeRow?.created_at || body?.createdAt || row.created_at || new Date().toISOString()
  }
  await upsertSalesRow(env, 'sales_agents', payload)
  const saved = await sb(env, 'sales_agents?id=eq.' + encodeURIComponent(row.id) + '&select=*')
  const savedRow = saved?.[0] || payload
  await writeSalesChangeLog(env, {
    staff: gate.staff,
    action: beforeRow ? 'update' : 'create',
    entityType: 'agent',
    entityId: savedRow.id || row.id,
    entityLabel: savedRow.name || row.name,
    summary: `${beforeRow ? 'Updated' : 'Created'} agent: ${savedRow.name || row.name || row.id}`,
    before: beforeRow,
    after: savedRow
  })
  return json({ ok: true, agent: mapSalesAgentRow(savedRow) })
  }

  const salesAgentMatch = pathname.match(/^\/api\/sales\/agents\/([^/]+)$/)
  if (salesAgentMatch && method === 'DELETE') {
  const gate = await requireStaff(env, request, { roles: ['admin'] })
  if (gate.error) return gate.error
  const id = decodeURIComponent(salesAgentMatch[1])
  const existing = await sb(env, 'sales_agents?id=eq.' + encodeURIComponent(id) + '&select=*')
  const beforeRow = existing?.[0]
  if (!beforeRow) return bad('Agent not found', 404)
  return await softDeleteSalesEntity(env, {
    table: 'sales_agents',
    id,
    staff: gate.staff,
    entityType: 'agent',
    label: beforeRow.name || id,
    beforeRow
  })
  }

  const salesAgentRestoreMatch = pathname.match(/^\/api\/sales\/agents\/([^/]+)\/restore$/)
  if (salesAgentRestoreMatch && method === 'POST') {
  const gate = await requireStaff(env, request, { roles: ['admin'] })
  if (gate.error) return gate.error
  const id = decodeURIComponent(salesAgentRestoreMatch[1])
  const existing = await sb(env, 'sales_agents?id=eq.' + encodeURIComponent(id) + '&select=*')
  const beforeRow = existing?.[0]
  if (!beforeRow) return bad('Agent not found', 404)
  return await restoreSalesEntity(env, {
    table: 'sales_agents',
    id,
    staff: gate.staff,
    entityType: 'agent',
    label: beforeRow.name || id,
    beforeRow
  })
  }

  if (pathname === '/api/sales/orders' && method === 'PUT') {
  const gate = await requireStaff(env, request, { roles: ['admin', 'sales'] })
  if (gate.error) return gate.error
  const body = await readJson(request)
  const existingId = String(body?.id || '').trim()
  const existing = existingId
    ? await sb(env, 'sales_orders?id=eq.' + encodeURIComponent(existingId) + '&select=*')
    : []
  const beforeRow = existing?.[0] || null
  if (beforeRow && beforeRow.deleted === true && gate.staff.role !== 'admin') {
    return bad('Cannot update deleted order', 403)
  }
  const row = salesOrderToDb(body, { isNew: !beforeRow })
  const effectiveAgentId = beforeRow?.agent_id || row.agent_id || ''
  const denied = assertAgentAccess(gate.staff, effectiveAgentId)
  if (denied) return denied
  if (gate.staff.role === 'sales') row.agent_id = gate.staff.agentId
  if (row.agent_id) await ensureSalesAgentExists(env, row.agent_id, gate.staff)
  row.product_id = await ensureSalesProductOrNull(env, row.product_id)
  const payload = {
    ...row,
    created_at: beforeRow?.created_at || body?.createdAt || row.created_at || new Date().toISOString()
  }
  await upsertSalesRow(env, 'sales_orders', payload)
  try {
    await ensurePaidSaleCashRows(env, {
      ...row,
      created_at: payload.created_at
    })
  } catch (err) {
    if (!err?._logged) {
      await logAppError(env, {
        source: 'sales_cash_sync',
        message: err?.message || String(err),
        stack: err?.stack || '',
        path: pathname,
        method,
        context: { orderId: row?.id || '', agentId: row?.agent_id || '' },
        actor: gate.staff
      })
    }
  }
  const saved = await sb(env, 'sales_orders?id=eq.' + encodeURIComponent(row.id) + '&select=*')
  const savedRow = saved?.[0] || payload
  await writeSalesChangeLog(env, {
    staff: gate.staff,
    action: beforeRow ? 'update' : 'create',
    entityType: 'order',
    entityId: savedRow.id || row.id,
    entityLabel: savedRow.customer_name || row.customer_name || row.id,
    summary: `${beforeRow ? 'Updated' : 'Created'} order: ${savedRow.customer_name || row.customer_name || row.id}`,
    before: beforeRow,
    after: savedRow
  })
  return json({ ok: true, order: mapSalesOrderRow(savedRow) })
  }

  const salesOrderMatch = pathname.match(/^\/api\/sales\/orders\/([^/]+)$/)
  if (salesOrderMatch && method === 'DELETE') {
  const gate = await requireStaff(env, request, { roles: ['admin', 'sales'] })
  if (gate.error) return gate.error
  const id = decodeURIComponent(salesOrderMatch[1])
  const existing = await sb(env, 'sales_orders?id=eq.' + encodeURIComponent(id) + '&select=*')
  const beforeRow = existing?.[0]
  if (!beforeRow) return bad('Order not found', 404)
  const denied = assertAgentAccess(gate.staff, beforeRow.agent_id || '')
  if (denied) return denied
  return await softDeleteSalesEntity(env, {
    table: 'sales_orders',
    id,
    staff: gate.staff,
    entityType: 'order',
    label: beforeRow.customer_name || id,
    beforeRow
  })
  }

  const salesOrderRestoreMatch = pathname.match(/^\/api\/sales\/orders\/([^/]+)\/restore$/)
  if (salesOrderRestoreMatch && method === 'POST') {
  const gate = await requireStaff(env, request, { roles: ['admin', 'sales'] })
  if (gate.error) return gate.error
  const id = decodeURIComponent(salesOrderRestoreMatch[1])
  const existing = await sb(env, 'sales_orders?id=eq.' + encodeURIComponent(id) + '&select=*')
  const beforeRow = existing?.[0]
  if (!beforeRow) return bad('Order not found', 404)
  const denied = assertAgentAccess(gate.staff, beforeRow.agent_id || '')
  if (denied) return denied
  return await restoreSalesEntity(env, {
    table: 'sales_orders',
    id,
    staff: gate.staff,
    entityType: 'order',
    label: beforeRow.customer_name || id,
    beforeRow
  })
  }

  if (pathname === '/api/sales/quotes' && method === 'PUT') {
  const gate = await requireStaff(env, request, { roles: ['admin', 'sales'] })
  if (gate.error) return gate.error
  const body = await readJson(request)
  const existingId = String(body?.id || '').trim()
  const existing = existingId
    ? await sb(env, 'sales_quotes?id=eq.' + encodeURIComponent(existingId) + '&select=*')
    : []
  const beforeRow = existing?.[0] || null
  if (beforeRow && beforeRow.deleted === true && gate.staff.role !== 'admin') {
    return bad('Cannot update deleted quote', 403)
  }
  const row = salesQuoteToDb(body, { isNew: !beforeRow })
  const effectiveAgentId = beforeRow?.agent_id || row.agent_id || ''
  const denied = assertAgentAccess(gate.staff, effectiveAgentId)
  if (denied) return denied
  if (gate.staff.role === 'sales') row.agent_id = gate.staff.agentId
  if (row.agent_id) await ensureSalesAgentExists(env, row.agent_id, gate.staff)
  row.product_id = await ensureSalesProductOrNull(env, row.product_id)
  const payload = {
    ...row,
    created_at: beforeRow?.created_at || body?.createdAt || row.created_at || new Date().toISOString()
  }
  await upsertSalesRow(env, 'sales_quotes', payload)
  const saved = await sb(env, 'sales_quotes?id=eq.' + encodeURIComponent(row.id) + '&select=*')
  const savedRow = saved?.[0] || payload
  await writeSalesChangeLog(env, {
    staff: gate.staff,
    action: beforeRow ? 'update' : 'create',
    entityType: 'quote',
    entityId: savedRow.id || row.id,
    entityLabel: savedRow.quote_number || row.quote_number || savedRow.customer_name || row.customer_name || row.id,
    summary: `${beforeRow ? 'Updated' : 'Created'} quote: ${savedRow.quote_number || row.quote_number || savedRow.customer_name || row.customer_name || row.id}`,
    before: beforeRow,
    after: savedRow
  })
  return json({ ok: true, quote: mapSalesQuoteRow(savedRow) })
  }

  const salesQuoteMatch = pathname.match(/^\/api\/sales\/quotes\/([^/]+)$/)
  if (salesQuoteMatch && method === 'DELETE') {
  const gate = await requireStaff(env, request, { roles: ['admin', 'sales'] })
  if (gate.error) return gate.error
  const id = decodeURIComponent(salesQuoteMatch[1])
  const existing = await sb(env, 'sales_quotes?id=eq.' + encodeURIComponent(id) + '&select=*')
  const beforeRow = existing?.[0]
  if (!beforeRow) return bad('Quote not found', 404)
  const denied = assertAgentAccess(gate.staff, beforeRow.agent_id || '')
  if (denied) return denied
  return await softDeleteSalesEntity(env, {
    table: 'sales_quotes',
    id,
    staff: gate.staff,
    entityType: 'quote',
    label: beforeRow.quote_number || beforeRow.customer_name || id,
    beforeRow
  })
  }

  const salesQuoteRestoreMatch = pathname.match(/^\/api\/sales\/quotes\/([^/]+)\/restore$/)
  if (salesQuoteRestoreMatch && method === 'POST') {
  const gate = await requireStaff(env, request, { roles: ['admin', 'sales'] })
  if (gate.error) return gate.error
  const id = decodeURIComponent(salesQuoteRestoreMatch[1])
  const existing = await sb(env, 'sales_quotes?id=eq.' + encodeURIComponent(id) + '&select=*')
  const beforeRow = existing?.[0]
  if (!beforeRow) return bad('Quote not found', 404)
  const denied = assertAgentAccess(gate.staff, beforeRow.agent_id || '')
  if (denied) return denied
  return await restoreSalesEntity(env, {
    table: 'sales_quotes',
    id,
    staff: gate.staff,
    entityType: 'quote',
    label: beforeRow.quote_number || beforeRow.customer_name || id,
    beforeRow
  })
  }

  if (pathname === '/api/sales/invoices' && method === 'PUT') {
  const gate = await requireStaff(env, request, { roles: ['admin', 'sales'] })
  if (gate.error) return gate.error
  const body = await readJson(request)
  const existingId = String(body?.id || '').trim()
  const existing = existingId
    ? await sb(env, 'sales_invoices?id=eq.' + encodeURIComponent(existingId) + '&select=*')
    : []
  const beforeRow = existing?.[0] || null
  if (beforeRow && beforeRow.deleted === true && gate.staff.role !== 'admin') {
    return bad('Cannot update deleted invoice', 403)
  }
  const row = salesInvoiceToDb(body, { isNew: !beforeRow })
  const effectiveAgentId = beforeRow?.agent_id || row.agent_id || ''
  const denied = assertAgentAccess(gate.staff, effectiveAgentId)
  if (denied) return denied
  if (gate.staff.role === 'sales') row.agent_id = gate.staff.agentId
  if (row.agent_id) await ensureSalesAgentExists(env, row.agent_id, gate.staff)
  row.product_id = await ensureSalesProductOrNull(env, row.product_id)
  const payload = {
    ...row,
    created_at: beforeRow?.created_at || body?.createdAt || row.created_at || new Date().toISOString()
  }
  await upsertSalesRow(env, 'sales_invoices', payload)
  const saved = await sb(env, 'sales_invoices?id=eq.' + encodeURIComponent(row.id) + '&select=*')
  const savedRow = saved?.[0] || payload
  await writeSalesChangeLog(env, {
    staff: gate.staff,
    action: beforeRow ? 'update' : 'create',
    entityType: 'invoice',
    entityId: savedRow.id || row.id,
    entityLabel: savedRow.invoice_number || row.invoice_number || savedRow.customer_name || row.customer_name || row.id,
    summary: `${beforeRow ? 'Updated' : 'Created'} invoice: ${savedRow.invoice_number || row.invoice_number || savedRow.customer_name || row.customer_name || row.id}`,
    before: beforeRow,
    after: savedRow
  })
  return json({ ok: true, invoice: mapSalesInvoiceRow(savedRow) })
  }

  const salesInvoiceMatch = pathname.match(/^\/api\/sales\/invoices\/([^/]+)$/)
  if (salesInvoiceMatch && method === 'DELETE') {
  const gate = await requireStaff(env, request, { roles: ['admin', 'sales'] })
  if (gate.error) return gate.error
  const id = decodeURIComponent(salesInvoiceMatch[1])
  const existing = await sb(env, 'sales_invoices?id=eq.' + encodeURIComponent(id) + '&select=*')
  const beforeRow = existing?.[0]
  if (!beforeRow) return bad('Invoice not found', 404)
  const denied = assertAgentAccess(gate.staff, beforeRow.agent_id || '')
  if (denied) return denied
  return await softDeleteSalesEntity(env, {
    table: 'sales_invoices',
    id,
    staff: gate.staff,
    entityType: 'invoice',
    label: beforeRow.invoice_number || beforeRow.customer_name || id,
    beforeRow
  })
  }

  const salesInvoiceRestoreMatch = pathname.match(/^\/api\/sales\/invoices\/([^/]+)\/restore$/)
  if (salesInvoiceRestoreMatch && method === 'POST') {
  const gate = await requireStaff(env, request, { roles: ['admin', 'sales'] })
  if (gate.error) return gate.error
  const id = decodeURIComponent(salesInvoiceRestoreMatch[1])
  const existing = await sb(env, 'sales_invoices?id=eq.' + encodeURIComponent(id) + '&select=*')
  const beforeRow = existing?.[0]
  if (!beforeRow) return bad('Invoice not found', 404)
  const denied = assertAgentAccess(gate.staff, beforeRow.agent_id || '')
  if (denied) return denied
  return await restoreSalesEntity(env, {
    table: 'sales_invoices',
    id,
    staff: gate.staff,
    entityType: 'invoice',
    label: beforeRow.invoice_number || beforeRow.customer_name || id,
    beforeRow
  })
  }

  if (pathname === '/api/sales/cashflow' && method === 'PUT') {
  const gate = await requireStaff(env, request, { roles: ['admin', 'sales'] })
  if (gate.error) return gate.error
  const body = await readJson(request)
  const existingId = String(body?.id || '').trim()
  const existing = existingId
    ? await sb(
        env,
        'sales_cashflow?id=eq.' + encodeURIComponent(existingId) + '&select=*'
      )
    : []
  const beforeRow = existing?.[0] || null
  if (beforeRow && beforeRow.deleted === true && gate.staff.role !== 'admin') {
    return bad('Cannot update deleted cash entry', 403)
  }
  const createdAt = beforeRow?.created_at || body?.createdAt || new Date().toISOString()
  const row = salesCashToDb(body, { isNew: !beforeRow })
  const effectiveAgentId = beforeRow?.agent_id || row.agent_id || ''
  const denied = assertAgentAccess(gate.staff, effectiveAgentId)
  if (denied) return denied
  if (gate.staff.role === 'sales') {
    row.agent_id = gate.staff.agentId || row.agent_id
    if (!row.agent_id) return bad('Sales account is not linked to an agent', 403)
  }
  if (!row.description) return bad('Description required')
  if (!(row.amount > 0)) return bad('Amount must be greater than 0')

  if (row.agent_id) {
    await ensureSalesAgentExists(env, row.agent_id, gate.staff)
  }

  if (row.sale_id) {
    const saleHit = await sb(
      env,
      'sales_orders?id=eq.' + encodeURIComponent(row.sale_id) + '&select=id&limit=1'
    )
    if (!saleHit?.[0]) row.sale_id = null
  }

  const payload = {
    ...row,
    created_at: createdAt
  }
  await upsertSalesRow(env, 'sales_cashflow', payload)
  const saved = await sb(env, 'sales_cashflow?id=eq.' + encodeURIComponent(row.id) + '&select=*')
  const savedRow = saved?.[0] || payload
  await writeSalesChangeLog(env, {
    staff: gate.staff,
    action: beforeRow ? 'update' : 'create',
    entityType: 'cashflow',
    entityId: savedRow.id || row.id,
    entityLabel: savedRow.description || row.description || row.id,
    summary: `${beforeRow ? 'Updated' : 'Created'} cashflow entry: ${savedRow.description || row.description || row.id}`,
    before: beforeRow,
    after: savedRow
  })
  return json({ ok: true, entry: mapSalesCashRow(savedRow) })
  }

  const salesCashMatch = pathname.match(/^\/api\/sales\/cashflow\/([^/]+)$/)
  if (salesCashMatch && method === 'DELETE') {
  const gate = await requireStaff(env, request, { roles: ['admin', 'sales'] })
  if (gate.error) return gate.error
  const id = decodeURIComponent(salesCashMatch[1])
  const existing = await sb(env, 'sales_cashflow?id=eq.' + encodeURIComponent(id) + '&select=*')
  const beforeRow = existing?.[0]
  if (!beforeRow) return bad('Cash entry not found', 404)
  const denied = assertAgentAccess(gate.staff, beforeRow.agent_id || '')
  if (denied) return denied
  return await softDeleteSalesEntity(env, {
    table: 'sales_cashflow',
    id,
    staff: gate.staff,
    entityType: 'cashflow',
    label: beforeRow.description || id,
    beforeRow
  })
  }

  const salesCashRestoreMatch = pathname.match(/^\/api\/sales\/cashflow\/([^/]+)\/restore$/)
  if (salesCashRestoreMatch && method === 'POST') {
  const gate = await requireStaff(env, request, { roles: ['admin'] })
  if (gate.error) return gate.error
  const id = decodeURIComponent(salesCashRestoreMatch[1])
  const existing = await sb(env, 'sales_cashflow?id=eq.' + encodeURIComponent(id) + '&select=*')
  const beforeRow = existing?.[0]
  if (!beforeRow) return bad('Cash entry not found', 404)
  return await restoreSalesEntity(env, {
    table: 'sales_cashflow',
    id,
    staff: gate.staff,
    entityType: 'cashflow',
    label: beforeRow.description || id,
    beforeRow
  })
  }

  if (pathname === '/api/admin/overview' && method === 'GET') {
    const gate = await requireStaff(env, request, { roles: ['admin'] })
    if (gate.error) return gate.error
    const [profiles, cards] = await Promise.all([
      sb(env, 'profiles?select=id,card_type,name,title,company,email,phone,address,avatar,logo,disabled,created_at,updated_at&order=created_at.desc&limit=500'),
      sb(env, 'cards?select=slug,kind,status,profile_id,linked_at,created_at&order=created_at.desc&limit=2000')
    ])
    const cardsByProfile = {}
    for (const c of cards || []) {
      if (!c.profile_id) continue
      if (!cardsByProfile[c.profile_id]) cardsByProfile[c.profile_id] = []
      cardsByProfile[c.profile_id].push(c)
    }
    const nameByProfile = {}
    for (const p of profiles || []) nameByProfile[p.id] = p.name || p.company || ''
    return json({
      ok: true,
      profiles: (profiles || []).map((p) => ({
        id: p.id,
        cardType: p.card_type === 'table' ? 'table' : 'personal',
        name: p.name || '',
        title: p.title || '',
        company: p.company || '',
        email: p.email || '',
        phone: p.phone || '',
        address: p.address || '',
        avatar: p.avatar || '',
        logo: p.logo || '',
        disabled: !!p.disabled,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        slugs: (cardsByProfile[p.id] || []).map((c) => ({
          slug: c.slug,
          kind: c.kind === 'personal' ? 'personal' : 'table',
          status: c.status
        }))
      })),
      cards: (cards || []).map((c) => ({
        slug: c.slug,
        kind: c.kind === 'personal' ? 'personal' : 'table',
        status: c.status,
        profileId: c.profile_id || '',
        profileName: c.profile_id ? nameByProfile[c.profile_id] || '' : '',
        linkedAt: c.linked_at,
        createdAt: c.created_at
      }))
    })
  }


  const adminActivitiesMatch = pathname.match(/^\/api\/admin\/profiles\/([^/]+)\/activities$/)
  if (adminActivitiesMatch && method === 'GET') {
    const gate = await requireStaff(env, request, { roles: ['admin'] })
    if (gate.error) return gate.error
    const profileId = decodeURIComponent(adminActivitiesMatch[1])
    const profiles = await sb(env, `profiles?id=eq.${encodeURIComponent(profileId)}&select=*`)
    const profile = profiles?.[0]
    if (!profile) return bad('Profile not found', 404)
    const cards = await sb(
      env,
      `cards?profile_id=eq.${encodeURIComponent(profileId)}&select=id,slug,kind,status`
    )
    const slugs = (cards || []).map((c) => c.slug).filter(Boolean)
    let opens = []
    if (slugs.length) {
      const orFilter = slugs.map((s) => `slug.eq.${encodeURIComponent(s)}`).join(',')
      opens = await sb(
        env,
        `card_opens?or=(${orFilter})&select=id,slug,channel,action,user_agent,device_type,browser,ip_country,ip_city,ip_region,opened_at&order=opened_at.desc&limit=500`
      )
    }
    const activities = (opens || []).map((o) => ({
      id: o.id,
      slug: o.slug || '',
      channel: o.channel || 'other',
      action: o.action || 'open',
      device: o.device_type || '',
      browser: o.browser || '',
      country: o.ip_country || '',
      city: o.ip_city || '',
      region: o.ip_region || '',
      userAgent: o.user_agent || '',
      at: o.opened_at
    }))
    const countBy = (key) => {
      const map = {}
      for (const a of activities) {
        const k = a[key] || 'unknown'
        map[k] = (map[k] || 0) + 1
      }
      return Object.entries(map)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
    }
    const opensCount = activities.filter((a) => a.action === 'open').length
    const sharesCount = activities.filter((a) => String(a.action).startsWith('share')).length
    const clicksCount = activities.filter((a) => String(a.action).startsWith('click')).length
    return json({
      ok: true,
      profile: {
        id: profile.id,
        cardType: profile.card_type === 'table' ? 'table' : 'personal',
        name: profile.name || '',
        company: profile.company || '',
        email: profile.email || '',
        avatar: profile.avatar || '',
        logo: profile.logo || '',
        slugs: (cards || []).map((c) => ({ slug: c.slug, kind: c.kind, status: c.status }))
      },
      stats: {
        total: activities.length,
        opens: opensCount,
        shares: sharesCount,
        clicks: clicksCount,
        byChannel: countBy('channel'),
        byDevice: countBy('device'),
        byBrowser: countBy('browser'),
        byCountry: countBy('country'),
        byAction: countBy('action'),
        byCity: countBy('city')
      },
      activities
    })
  }

  const adminProfileMatch = pathname.match(/^\/api\/admin\/profiles\/([^/]+)$/)
  if (adminProfileMatch && method === 'GET') {
    const gate = await requireStaff(env, request, { roles: ['admin'] })
    if (gate.error) return gate.error
    const profileId = decodeURIComponent(adminProfileMatch[1])
    const profiles = await sb(env, `profiles?id=eq.${encodeURIComponent(profileId)}&select=*`)
    const profile = profiles?.[0]
    if (!profile) return bad('Profile not found', 404)
    const cards = await sb(
      env,
      `cards?profile_id=eq.${encodeURIComponent(profileId)}&select=slug,kind,status,linked_at&order=slug.asc`
    )
    const pub = await publicProfile(env, profile)
    return json({
      ok: true,
      profile: {
        ...pub,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
        loginEmail: profile.login_email || '',
        loginPhone: profile.login_phone || '',
        slugs: (cards || []).map((c) => ({
          slug: c.slug,
          kind: c.kind === 'personal' ? 'personal' : 'table',
          status: c.status,
          linkedAt: c.linked_at || null
        }))
      }
    })
  }

  if (adminProfileMatch && method === 'PUT') {
    const gate = await requireStaff(env, request, { roles: ['admin'] })
    if (gate.error) return gate.error
    const profileId = decodeURIComponent(adminProfileMatch[1])
    const profiles = await sb(env, `profiles?id=eq.${encodeURIComponent(profileId)}&select=*`)
    const profile = profiles?.[0]
    if (!profile) return bad('Profile not found', 404)
    const body = await readJson(request)

    // Card type is fixed at claim/generation — never change via admin edit
    const patch = {
      name: body.name !== undefined ? String(body.name || '').trim() : profile.name,
      title: body.title !== undefined ? String(body.title || '').trim() : profile.title,
      company: body.company !== undefined ? String(body.company || '').trim() : profile.company,
      phone: body.phone !== undefined ? String(body.phone || '').trim() : profile.phone,
      email: body.email !== undefined ? String(body.email || '').trim().toLowerCase() : profile.email,
      whatsapp: body.whatsapp !== undefined ? String(body.whatsapp || '').trim() : profile.whatsapp,
      linkedin: body.linkedin !== undefined ? String(body.linkedin || '').trim() : profile.linkedin,
      youtube: body.youtube !== undefined ? String(body.youtube || '').trim() : profile.youtube,
      x: body.x !== undefined ? String(body.x || '').trim() : profile.x,
      instagram: body.instagram !== undefined ? String(body.instagram || '').trim() : profile.instagram,
      tiktok: body.tiktok !== undefined ? String(body.tiktok || '').trim() : profile.tiktok,
      website: body.website !== undefined ? String(body.website || '').trim() : profile.website,
      address: body.address !== undefined ? String(body.address || '').trim() : profile.address,
      menu_url: body.menuUrl !== undefined ? String(body.menuUrl || '').trim() : profile.menu_url,
      google_review:
        body.googleReview !== undefined ? String(body.googleReview || '').trim() : profile.google_review,
      check_in_url:
        body.checkInUrl !== undefined ? String(body.checkInUrl || '').trim() : profile.check_in_url,
      feedback_url:
        body.feedbackUrl !== undefined ? String(body.feedbackUrl || '').trim() : profile.feedback_url,
      avatar: body.avatar !== undefined ? String(body.avatar || '').trim() : profile.avatar,
      logo: body.logo !== undefined ? String(body.logo || '').trim() : profile.logo,
      video: body.video !== undefined ? String(body.video || '').trim() : profile.video,
      disabled: body.disabled !== undefined ? !!body.disabled : !!profile.disabled,
      updated_at: new Date().toISOString()
    }
    if (Array.isArray(body.linkOrder)) {
      patch.link_order = body.linkOrder.map((k) => String(k || '').trim()).filter(Boolean).slice(0, 32)
    }
    if (body.menuPdf !== undefined) patch.menu_pdf = String(body.menuPdf || '').trim()
    if (Array.isArray(body.menuImages)) {
      patch.menu_images = body.menuImages.map((u) => String(u || '').trim()).filter(Boolean).slice(0, 20)
    }
    if (body.showPhone !== undefined) patch.show_phone = !!body.showPhone
    if (body.showEmail !== undefined) patch.show_email = !!body.showEmail
    if (body.showCheckin !== undefined) patch.show_checkin = !!body.showCheckin
    if (body.showFeedback !== undefined) patch.show_feedback = !!body.showFeedback
    if (body.showBooking !== undefined) patch.show_booking = !!body.showBooking
    if (body.checkinForm !== undefined && body.checkinForm && typeof body.checkinForm === 'object') {
      patch.checkin_form = body.checkinForm
    }
    if (body.feedbackForm !== undefined && body.feedbackForm && typeof body.feedbackForm === 'object') {
      patch.feedback_form = body.feedbackForm
    }

    await sb(env, `profiles?id=eq.${encodeURIComponent(profileId)}`, {
      method: 'PATCH',
      body: patch,
      prefer: 'return=minimal'
    })
    const nextRows = await sb(env, `profiles?id=eq.${encodeURIComponent(profileId)}&select=*`)
    const next = nextRows?.[0]
    const cards = await sb(
      env,
      `cards?profile_id=eq.${encodeURIComponent(profileId)}&select=slug,kind,status,linked_at&order=slug.asc`
    )
    const pub = await publicProfile(env, next)
    return json({
      ok: true,
      profile: {
        ...pub,
        createdAt: next.created_at,
        updatedAt: next.updated_at,
        loginEmail: next.login_email || '',
        loginPhone: next.login_phone || '',
        slugs: (cards || []).map((c) => ({
          slug: c.slug,
          kind: c.kind === 'personal' ? 'personal' : 'table',
          status: c.status,
          linkedAt: c.linked_at || null
        }))
      }
    })
  }

  if (pathname === '/api/upload' && method === 'POST') {
    const profile = await getSessionProfile(env, request)
    const staff = profile ? null : await getStaffFromRequest(env, request)
    if (!profile && !staff) return bad('Unauthorized', 401)

    const serviceKey = String(env.SUPABASE_SERVICE_ROLE_KEY || '')
      .trim()
      .replace(/^["']|["']$/g, '')
    if (!serviceKey) return bad('Storage is not configured', 500)
    if (!serviceKey.startsWith('eyJ')) {
      return bad('Storage key is invalid (expected legacy service_role JWT)', 500)
    }

    const form = await request.formData()
    const file = form.get('file')
    if (!file || typeof file === 'string') return bad('file is required')

    const kindRaw = String(form.get('kind') || 'avatar').toLowerCase()
    const kind = ['avatar', 'logo', 'video', 'product', 'menu'].includes(kindRaw) ? kindRaw : 'avatar'
    if (staff && !profile && kind !== 'product') {
      return bad('Staff uploads are limited to product media', 403)
    }
    const contentType = file.type || 'application/octet-stream'
    if (kind === 'menu') {
      const okType =
        contentType === 'application/pdf' ||
        contentType.startsWith('image/') ||
        /\.pdf$/i.test(String(file.name || ''))
      if (!okType) return bad('Menu uploads must be a PDF or image', 400)
    }
    const maxBytes =
      kind === 'product'
        ? 20 * 1024 * 1024
        : kind === 'menu'
          ? 15 * 1024 * 1024
          : kind === 'video'
            ? 8 * 1024 * 1024
            : 3 * 1024 * 1024
    if (file.size > maxBytes) {
      const limitLabel =
        kind === 'product' ? '20 MB' : kind === 'menu' ? '15 MB' : kind === 'video' ? '8 MB' : '3 MB'
      return bad(`${kind === 'video' ? 'Video' : kind === 'menu' ? 'Menu file' : 'Image'} must be under ${limitLabel}`, 413)
    }

    const extFromName = String(file.name || '').split('.').pop() || ''
    const extFromType = contentType.includes('/') ? contentType.split('/')[1].split(';')[0] : ''
    const ext = (extFromName || extFromType || 'bin').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'bin'
    const ownerId = profile?.id || staff.id || 'staff'
    const path = `profiles/${ownerId}/${kind}-${Date.now()}.${ext}`
    const bucket = 'assets bucket'
    const bytes = new Uint8Array(await file.arrayBuffer())

    const uploadRes = await fetch(
      `${env.SUPABASE_URL}/storage/v1/object/${encodeURIComponent(bucket)}/${path}`,
      {
        method: 'POST',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': contentType,
          'x-upsert': 'true'
        },
        body: bytes
      }
    )
    if (!uploadRes.ok) {
      const errText = await uploadRes.text()
      let detail = errText || 'Upload failed'
      try {
        const parsed = JSON.parse(errText)
        detail = parsed.message || parsed.error || detail
      } catch {
        /* keep raw */
      }
      return bad(detail, uploadRes.status || 500)
    }

    const publicUrl = `${env.SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(bucket)}/${path}`
    return json({ ok: true, url: publicUrl, path, kind })
  }

  if (pathname === '/api/me' && method === 'GET') {
    const profile = await getSessionProfile(env, request)
    if (!profile) return bad('Unauthorized', 401)
    return json({ ok: true, profile: await publicProfile(env, profile) })
  }

  if (pathname === '/api/me' && method === 'PUT') {
    const profile = await getSessionProfile(env, request)
    if (!profile) return bad('Unauthorized', 401)
    const body = await readJson(request)
    await sb(env, `profiles?id=eq.${encodeURIComponent(profile.id)}`, {
      method: 'PATCH',
      body: {
        card_type:
          body.cardType !== undefined
            ? body.cardType === 'table'
              ? 'table'
              : 'personal'
            : profile.card_type,
        name: body.name ?? profile.name,
        title: body.title ?? profile.title,
        company: body.company ?? profile.company,
        phone: body.phone ?? profile.phone,
        email: body.email ?? profile.email,
        whatsapp: body.whatsapp ?? profile.whatsapp,
        linkedin: body.linkedin ?? profile.linkedin,
        youtube: body.youtube ?? profile.youtube,
        x: body.x ?? profile.x,
        instagram: body.instagram ?? profile.instagram,
        tiktok: body.tiktok ?? profile.tiktok,
        website: body.website ?? profile.website,
        address: body.address ?? profile.address,
        menu_url: body.menuUrl ?? profile.menu_url,
        menu_pdf: body.menuPdf !== undefined ? String(body.menuPdf || '').trim() : (profile.menu_pdf || ''),
        menu_images: Array.isArray(body.menuImages)
          ? body.menuImages.map((u) => String(u || '').trim()).filter(Boolean).slice(0, 20)
          : (Array.isArray(profile.menu_images) ? profile.menu_images : []),
        google_review: body.googleReview ?? profile.google_review,
        check_in_url: body.checkInUrl ?? profile.check_in_url,
        feedback_url: body.feedbackUrl ?? profile.feedback_url,
        link_order: Array.isArray(body.linkOrder)
          ? body.linkOrder.map((k) => String(k || '').trim()).filter(Boolean).slice(0, 32)
          : profile.link_order || [],
        show_phone: body.showPhone !== undefined ? !!body.showPhone : !!profile.show_phone,
        show_email: body.showEmail !== undefined ? !!body.showEmail : !!profile.show_email,
        show_checkin: body.showCheckin !== undefined ? !!body.showCheckin : !!profile.show_checkin,
        show_feedback: body.showFeedback !== undefined ? !!body.showFeedback : !!profile.show_feedback,
        show_booking: body.showBooking !== undefined ? !!body.showBooking : profile.show_booking !== false,
        checkin_form:
          body.checkinForm !== undefined && body.checkinForm && typeof body.checkinForm === 'object'
            ? body.checkinForm
            : profile.checkin_form || {},
        feedback_form:
          body.feedbackForm !== undefined && body.feedbackForm && typeof body.feedbackForm === 'object'
            ? body.feedbackForm
            : profile.feedback_form || {},
        catalog_items: Array.isArray(body.catalogItems)
          ? normalizeCatalogItems(body.catalogItems)
          : Array.isArray(profile.catalog_items)
            ? profile.catalog_items
            : [],
        avatar: body.avatar ?? profile.avatar,
        logo: body.logo ?? profile.logo,
        video: body.video ?? profile.video,
        disabled: body.disabled !== undefined ? !!body.disabled : !!profile.disabled,
        updated_at: new Date().toISOString()
      },
      prefer: 'return=minimal'
    })
    const next = await sb(env, `profiles?id=eq.${encodeURIComponent(profile.id)}&select=*`)
    return json({ ok: true, profile: await publicProfile(env, next?.[0]) })
  }

  if (pathname === '/api/venue/checkins' && method === 'GET') {
    const profile = await getSessionProfile(env, request)
    if (!profile) return bad('Unauthorized', 401)
    const rows = await sb(
      env,
      `checkins?profile_id=eq.${encodeURIComponent(profile.id)}&order=created_at.desc&limit=500`
    )
    return json({ ok: true, checkins: rows || [] })
  }

  if (pathname === '/api/venue/checkins' && method === 'POST') {
    const body = await readJson(request)
    const profileId = body?.profileId
    if (!profileId) return bad('profileId required')
    await ensureProfileStub(env, profileId, body?.venue)
    const id = uid('checkin')
    const answers =
      body.answers && typeof body.answers === 'object' && !Array.isArray(body.answers)
        ? body.answers
        : {}
    const phone = String(body.phone || '').trim()
    const email = String(body.email || '').trim()
    const contact =
      String(body.contact || '').trim() ||
      [phone, email].filter(Boolean).join(' · ')
    await sb(env, 'checkins', {
      method: 'POST',
      body: {
        id,
        profile_id: profileId,
        venue: body.venue || '',
        name: body.name || '',
        contact,
        phone,
        email,
        event: body.event || 'General visit',
        guests: Math.max(1, Number(body.guests) || 1),
        answers
      },
      prefer: 'return=minimal'
    })
    return json({ ok: true, id })
  }

  if (pathname === '/api/venue/feedback' && method === 'GET') {
    const profile = await getSessionProfile(env, request)
    if (!profile) return bad('Unauthorized', 401)
    const rows = await sb(
      env,
      `feedback?profile_id=eq.${encodeURIComponent(profile.id)}&order=created_at.desc&limit=500`
    )
    return json({ ok: true, feedback: rows || [] })
  }

  if (pathname === '/api/venue/feedback' && method === 'POST') {
    const body = await readJson(request)
    const profileId = body?.profileId
    if (!profileId) return bad('profileId required')
    await ensureProfileStub(env, profileId, body?.venue)
    const id = uid('feedback')
    const answers =
      body.answers && typeof body.answers === 'object' && !Array.isArray(body.answers)
        ? body.answers
        : {}
    const phone = String(body.phone || '').trim()
    const email = String(body.email || '').trim()
    const contact =
      String(body.contact || '').trim() ||
      [phone, email].filter(Boolean).join(' · ')
    await sb(env, 'feedback', {
      method: 'POST',
      body: {
        id,
        profile_id: profileId,
        venue: body.venue || '',
        name: body.name || 'Anonymous',
        contact,
        phone,
        email,
        rating: Math.min(5, Math.max(0, Number(body.rating) || 0)),
        message: body.message || '',
        answers
      },
      prefer: 'return=minimal'
    })
    return json({ ok: true, id })
  }

  if (pathname === '/api/venue/stats' && method === 'GET') {
    const profile = await getSessionProfile(env, request)
    if (!profile) return bad('Unauthorized', 401)
    const checkins = await sb(env, `checkins?profile_id=eq.${encodeURIComponent(profile.id)}&select=guests`)
    const fb = await sb(env, `feedback?profile_id=eq.${encodeURIComponent(profile.id)}&select=rating`)
    const guests = (checkins || []).reduce((s, r) => s + (Number(r.guests) || 0), 0)
    const ratings = (fb || []).map((r) => Number(r.rating) || 0)
    const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0
    return json({
      ok: true,
      stats: {
        checkins: checkins?.length || 0,
        guests,
        feedback: fb?.length || 0,
        avgRating: Math.round(avg * 10) / 10
      }
    })
  }


  // ---- Public profile catalog & meeting availability ----
  const publicCatalogMatch = pathname.match(/^\/api\/profiles\/([^/]+)\/catalog$/)
  if (publicCatalogMatch && method === 'GET') {
    const profileId = decodeURIComponent(publicCatalogMatch[1])
    const rows = await sb(env, `profiles?id=eq.${encodeURIComponent(profileId)}&select=id,name,company,catalog_items,disabled`)
    const row = rows?.[0]
    if (!row) return bad('Profile not found', 404)
    if (row.disabled) return bad('This profile is disabled', 403)
    const items = normalizeCatalogItems(row.catalog_items).filter((x) => x.active !== false)
    const ownerName = String(row.name || row.company || '').trim() || 'This person'
    return json({ ok: true, profileId: row.id, ownerName, catalogItems: items })
  }

  const availabilityMatch = pathname.match(/^\/api\/profiles\/([^/]+)\/availability$/)
  if (availabilityMatch && method === 'GET') {
    const profileId = decodeURIComponent(availabilityMatch[1])
    const rows = await sb(env, `profiles?id=eq.${encodeURIComponent(profileId)}&select=id,name,company,disabled,show_booking`)
    const row = rows?.[0]
    if (!row) return bad('Profile not found', 404)
    if (row.disabled) return bad('This profile is disabled', 403)

    const fromParam = String(url.searchParams.get('from') || '').trim()
    const toParam = String(url.searchParams.get('to') || '').trim()
    const fromDate = fromParam ? new Date(fromParam) : new Date()
    const toDate = toParam ? new Date(toParam) : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      return bad('Invalid from/to dates')
    }
    const fromIso = fromDate.toISOString()
    const toIso = toDate.toISOString()

    const meetings = await sb(
      env,
      'meetings?profile_id=eq.' +
        encodeURIComponent(profileId) +
        '&preferred_at=gte.' +
        encodeURIComponent(fromIso) +
        '&preferred_at=lte.' +
        encodeURIComponent(toIso) +
        '&status=neq.cancelled&select=id,name,email,phone,preferred_at,message,status,created_at&order=preferred_at.asc&limit=500'
    )

    const session = await getSessionProfile(env, request)
    const isOwner = !!(session && session.id === profileId)
    const taken = (meetings || [])
      .map((m) => m.preferred_at)
      .filter(Boolean)

    const payload = {
      ok: true,
      profileId: row.id,
      ownerName: String(row.name || row.company || '').trim() || 'This person',
      showBooking: row.show_booking !== false,
      slotMinutes: 30,
      dayStartHour: 9,
      dayEndHour: 17,
      taken,
      isOwner
    }
    if (isOwner) {
      payload.meetings = (meetings || []).map((m) => ({
        id: m.id,
        name: m.name || '',
        email: m.email || '',
        phone: m.phone || '',
        preferredAt: m.preferred_at || null,
        message: m.message || '',
        status: m.status || 'new',
        createdAt: m.created_at || null
      }))
    }
    return json(payload)
  }

  // ---- Personal card meetings & follow-ups ----
  if (pathname === '/api/meetings' && method === 'POST') {
    const body = await readJson(request)
    const profileId = String(body?.profileId || '').trim()
    if (!profileId) return bad('profileId required')
    const name = String(body?.name || '').trim()
    const email = String(body?.email || '').trim().toLowerCase()
    const phone = String(body?.phone || '').trim()
    const message = String(body?.message || '').trim().slice(0, 2000)
    if (!name) return bad('Name is required')
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return bad('A valid email is required for the calendar invite')
    }
    await ensureProfileStub(env, profileId, name)
    const preferredRaw = body?.preferredAt || body?.preferred_at || null
    let preferredAt = null
    if (preferredRaw) {
      const d = new Date(preferredRaw)
      if (!Number.isNaN(d.getTime())) preferredAt = d.toISOString()
    }
    if (!preferredAt) return bad('Preferred date and time is required for the calendar invite')

    // Block double-booking the same 30-minute window
    const slotMs = 30 * 60 * 1000
    const start = new Date(preferredAt).getTime()
    const windowFrom = new Date(start - slotMs + 1).toISOString()
    const windowTo = new Date(start + slotMs - 1).toISOString()
    const conflicts = await sb(
      env,
      'meetings?profile_id=eq.' +
        encodeURIComponent(profileId) +
        '&preferred_at=gte.' +
        encodeURIComponent(windowFrom) +
        '&preferred_at=lte.' +
        encodeURIComponent(windowTo) +
        '&status=neq.cancelled&select=id&limit=1'
    )
    if (conflicts?.length) return bad('That time slot is already taken', 409)

    const id = uid('meet')
    await sb(env, 'meetings', {
      method: 'POST',
      body: {
        id,
        profile_id: profileId,
        name,
        email,
        phone,
        preferred_at: preferredAt,
        message,
        status: 'new',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      prefer: 'return=minimal'
    })

    try {
      const owners = await sb(env, 'profiles?id=eq.' + encodeURIComponent(profileId) + '&select=*')
      const owner = owners?.[0]
      const ownerName = String(owner?.name || owner?.company || 'tap-na host').trim() || 'tap-na host'
      const ownerEmail = String(owner?.login_email || owner?.email || '')
        .trim()
        .toLowerCase()
      const whenLabel = new Date(preferredAt).toUTCString()
      const meetingTitle = `Meeting with ${ownerName}`
      const meetingDesc = [
        message ? `Message: ${message}` : '',
        phone ? `Guest phone: ${phone}` : '',
        `Booked via tap-na · https://tapnam.com/meetings`
      ]
        .filter(Boolean)
        .join('\n')

      const ics = buildMeetingIcs({
        uid: id,
        title: meetingTitle,
        description: meetingDesc,
        startIso: preferredAt,
        durationMinutes: 30,
        organizerName: ownerName,
        organizerEmail: ownerEmail.includes('@') ? ownerEmail : 'welcome@tapnam.com',
        attendeeName: name,
        attendeeEmail: email,
        location: String(owner?.address || '').trim() || 'To be confirmed'
      })
      const icsAttachment = meetingInviteAttachment(ics)
      const whenHtml = escapeHtml(whenLabel)
      const sends = []

      // Guest confirmation + calendar invite
      sends.push(
        sendCloudflareEmail(env, {
          to: email,
          replyTo: ownerEmail.includes('@') ? ownerEmail : undefined,
          subject: `Meeting request with ${ownerName}`,
          html: transactionalShell({
            title: 'Meeting request sent',
            intro: `Hi ${name}, your meeting request with ${ownerName} is in.`,
            bodyHtml: `
              <p style="margin:0 0 8px;"><strong>When (UTC):</strong> ${whenHtml}</p>
              <p style="margin:0 0 8px;"><strong>Host:</strong> ${escapeHtml(ownerName)}</p>
              ${message ? `<p style="margin:0 0 8px;"><strong>Your note:</strong> ${escapeHtml(message)}</p>` : ''}
              <p style="margin:16px 0 0;">A calendar invite (.ics) is attached — open it to add this to your calendar.</p>`,
            footerNote: 'If the time does not work, reply to this email to reschedule.'
          }),
          text: [
            `Meeting request with ${ownerName}`,
            `When (UTC): ${whenLabel}`,
            message ? `Note: ${message}` : '',
            'A calendar invite (.ics) is attached.'
          ]
            .filter(Boolean)
            .join('\n'),
          attachments: [icsAttachment]
        })
      )

      // Host notification + calendar invite
      if (ownerEmail.includes('@')) {
        sends.push(
          sendCloudflareEmail(env, {
            to: ownerEmail,
            replyTo: email,
            subject: `New meeting request from ${name}`,
            html: transactionalShell({
              title: 'New meeting request',
              intro: `${name} booked a meeting via your tap-na card.`,
              bodyHtml: `
                <p style="margin:0 0 8px;"><strong>When (UTC):</strong> ${whenHtml}</p>
                <p style="margin:0 0 8px;"><strong>Guest:</strong> ${escapeHtml(name)}</p>
                <p style="margin:0 0 8px;"><strong>Email:</strong> ${escapeHtml(email)}</p>
                <p style="margin:0 0 8px;"><strong>Phone:</strong> ${escapeHtml(phone || '—')}</p>
                ${message ? `<p style="margin:0 0 8px;"><strong>Message:</strong> ${escapeHtml(message)}</p>` : ''}
                <p style="margin:16px 0 0;">A calendar invite (.ics) is attached.</p>
                <p style="margin:12px 0 0;"><a href="https://tapnam.com/meetings">Open Meetings</a></p>`,
              footerNote: 'Confirm or follow up from your Meetings tab.'
            }),
            text: [
              `New meeting request from ${name}`,
              `When (UTC): ${whenLabel}`,
              `Email: ${email}`,
              `Phone: ${phone || '—'}`,
              message ? `Message: ${message}` : '',
              'A calendar invite (.ics) is attached.',
              'Open: https://tapnam.com/meetings'
            ]
              .filter(Boolean)
              .join('\n'),
            attachments: [icsAttachment]
          })
        )
      }

      await Promise.all(
        sends.map((p) => p.catch((err) => logAppError(env, {
          source: 'email',
          message: err?.message || String(err),
          stack: err?.stack || '',
          path: pathname,
          method,
          context: { kind: 'meeting_invite_email' }
        })))
      )
    } catch (err) {
      await logAppError(env, {
        source: 'email',
        message: err?.message || String(err),
        stack: err?.stack || '',
        path: pathname,
        method,
        context: { kind: 'meeting_invite_build' }
      })
    }
    return json({ ok: true, id })
  }

  if (pathname === '/api/meetings' && method === 'GET') {
    const profile = await getSessionProfile(env, request)
    if (!profile) return bad('Unauthorized', 401)
    const rows = await sb(
      env,
      'meetings?profile_id=eq.' + encodeURIComponent(profile.id) + '&order=created_at.desc&limit=500'
    )
    return json({ ok: true, meetings: rows || [] })
  }

  if (pathname === '/api/meetings/stats' && method === 'GET') {
    const profile = await getSessionProfile(env, request)
    if (!profile) return bad('Unauthorized', 401)
    const meetings = await sb(
      env,
      'meetings?profile_id=eq.' + encodeURIComponent(profile.id) + '&status=eq.new&select=id'
    )
    const followups = await sb(
      env,
      'followups?profile_id=eq.' + encodeURIComponent(profile.id) + '&status=eq.open&select=id,due_at'
    )
    const now = Date.now()
    const overdueFollowups = (followups || []).filter((f) => {
      if (!f.due_at) return false
      const t = new Date(f.due_at).getTime()
      return !Number.isNaN(t) && t < now
    }).length
    return json({
      ok: true,
      stats: {
        newMeetings: meetings?.length || 0,
        openFollowups: followups?.length || 0,
        overdueFollowups
      }
    })
  }

  const meetingPatchMatch = pathname.match(/^\/api\/meetings\/([^/]+)$/)
  if (meetingPatchMatch && method === 'PATCH') {
    const profile = await getSessionProfile(env, request)
    if (!profile) return bad('Unauthorized', 401)
    const meetingId = decodeURIComponent(meetingPatchMatch[1])
    const body = await readJson(request)
    const status = String(body?.status || '').trim().toLowerCase()
    const allowed = ['new', 'confirmed', 'done', 'cancelled']
    if (!allowed.includes(status)) return bad('Invalid status')
    const existing = await sb(
      env,
      'meetings?id=eq.' + encodeURIComponent(meetingId) + '&profile_id=eq.' + encodeURIComponent(profile.id) + '&select=id'
    )
    if (!existing?.length) return bad('Meeting not found', 404)
    await sb(env, 'meetings?id=eq.' + encodeURIComponent(meetingId), {
      method: 'PATCH',
      body: { status, updated_at: new Date().toISOString() },
      prefer: 'return=minimal'
    })
    return json({ ok: true, id: meetingId, status })
  }

  if (pathname === '/api/followups' && method === 'GET') {
    const profile = await getSessionProfile(env, request)
    if (!profile) return bad('Unauthorized', 401)
    const rows = await sb(
      env,
      'followups?profile_id=eq.' + encodeURIComponent(profile.id) + '&order=due_at.asc.nullslast&limit=500'
    )
    return json({ ok: true, followups: rows || [] })
  }

  if (pathname === '/api/followups' && method === 'POST') {
    const profile = await getSessionProfile(env, request)
    if (!profile) return bad('Unauthorized', 401)
    const body = await readJson(request)
    const id = uid('fup')
    const dueRaw = body?.dueAt || body?.due_at || null
    let dueAt = null
    if (dueRaw) {
      const d = new Date(dueRaw)
      if (!Number.isNaN(d.getTime())) dueAt = d.toISOString()
    }
    await sb(env, 'followups', {
      method: 'POST',
      body: {
        id,
        profile_id: profile.id,
        meeting_id: String(body?.meetingId || body?.meeting_id || '').trim(),
        contact_name: String(body?.contactName || body?.contact_name || '').trim().slice(0, 160),
        contact_email: String(body?.contactEmail || body?.contact_email || '').trim().toLowerCase().slice(0, 160),
        contact_phone: String(body?.contactPhone || body?.contact_phone || '').trim().slice(0, 80),
        note: String(body?.note || '').trim().slice(0, 4000),
        due_at: dueAt,
        status: body?.status === 'done' ? 'done' : 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      prefer: 'return=minimal'
    })
    return json({ ok: true, id })
  }

  const followupMatch = pathname.match(/^\/api\/followups\/([^/]+)$/)
  if (followupMatch && method === 'PATCH') {
    const profile = await getSessionProfile(env, request)
    if (!profile) return bad('Unauthorized', 401)
    const followupId = decodeURIComponent(followupMatch[1])
    const body = await readJson(request)
    const existing = await sb(
      env,
      'followups?id=eq.' + encodeURIComponent(followupId) + '&profile_id=eq.' + encodeURIComponent(profile.id) + '&select=*'
    )
    if (!existing?.length) return bad('Follow-up not found', 404)
    const cur = existing[0]
    const dueRaw = body?.dueAt !== undefined ? body.dueAt : body?.due_at !== undefined ? body.due_at : cur.due_at
    let dueAt = cur.due_at
    if (dueRaw === null || dueRaw === '') dueAt = null
    else if (dueRaw) {
      const d = new Date(dueRaw)
      if (!Number.isNaN(d.getTime())) dueAt = d.toISOString()
    }
    const status =
      body?.status !== undefined
        ? body.status === 'done'
          ? 'done'
          : 'open'
        : cur.status
    await sb(env, 'followups?id=eq.' + encodeURIComponent(followupId), {
      method: 'PATCH',
      body: {
        meeting_id:
          body?.meetingId !== undefined || body?.meeting_id !== undefined
            ? String(body.meetingId || body.meeting_id || '').trim()
            : cur.meeting_id,
        contact_name:
          body?.contactName !== undefined || body?.contact_name !== undefined
            ? String(body.contactName || body.contact_name || '').trim().slice(0, 160)
            : cur.contact_name,
        contact_email:
          body?.contactEmail !== undefined || body?.contact_email !== undefined
            ? String(body.contactEmail || body.contact_email || '').trim().toLowerCase().slice(0, 160)
            : cur.contact_email,
        contact_phone:
          body?.contactPhone !== undefined || body?.contact_phone !== undefined
            ? String(body.contactPhone || body.contact_phone || '').trim().slice(0, 80)
            : cur.contact_phone,
        note: body?.note !== undefined ? String(body.note || '').trim().slice(0, 4000) : cur.note,
        due_at: dueAt,
        status,
        updated_at: new Date().toISOString()
      },
      prefer: 'return=minimal'
    })
    return json({ ok: true, id: followupId })
  }

  if (followupMatch && method === 'DELETE') {
    const profile = await getSessionProfile(env, request)
    if (!profile) return bad('Unauthorized', 401)
    const followupId = decodeURIComponent(followupMatch[1])
    const existing = await sb(
      env,
      'followups?id=eq.' + encodeURIComponent(followupId) + '&profile_id=eq.' + encodeURIComponent(profile.id) + '&select=id'
    )
    if (!existing?.length) return bad('Follow-up not found', 404)
    await sb(env, 'followups?id=eq.' + encodeURIComponent(followupId), {
      method: 'DELETE',
      prefer: 'return=minimal'
    })
    return json({ ok: true, id: followupId })
  }

  if (pathname === '/api/shop/order-quote' && method === 'POST') {
    const body = await readJson(request)
    const name = String(body?.name || '').trim()
    const email = String(body?.email || '').trim().toLowerCase()
    const phone = String(body?.phone || '').trim()
    const town = String(body?.town || '').trim().slice(0, 120)
    const note = String(body?.note || body?.notes || '').trim()
    const items = Array.isArray(body?.items) ? body.items : []

    if (!name) return bad('Name is required')
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad('Valid email is required')
    if (!phone || phone.replace(/\D/g, '').length < 7) return bad('Valid phone is required')
    if (!town) return bad('Town is required')
    if (!items.length) return bad('Cart is empty')

    const lines = items.slice(0, 50).map((item) => {
      const qty = Math.max(1, Math.min(99, Math.floor(Number(item?.qty) || 1)))
      const unit = Math.max(0, Number(item?.price) || 0)
      const lineTotal = Math.round(qty * unit * 100) / 100
      return {
        id: String(item?.id || '').slice(0, 80),
        name: String(item?.name || 'Product').trim().slice(0, 160) || 'Product',
        qty,
        price: unit,
        lineTotal
      }
    })
    const subtotal = Math.round(lines.reduce((s, l) => s + l.lineTotal, 0) * 100) / 100
    const money = (n) =>
      'N$ ' + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })

    const quoteRef = `SQ-${Date.now().toString(36).toUpperCase()}`
    const companyTo = 'auckmund@gmail.com'
    const from = defaultEmailFrom(env)
    const subject = `Order quote ${quoteRef} — ${name}`

    const rowsHtml = lines
      .map(
        (l) => `
      <tr style="border-bottom:1px solid #eee;">
        <td style="padding:10px 0;">${escapeHtml(l.name)}</td>
        <td style="padding:10px 0;">${l.qty}</td>
        <td style="padding:10px 0;">${escapeHtml(money(l.price))}</td>
        <td style="padding:10px 0;text-align:right;">${escapeHtml(money(l.lineTotal))}</td>
      </tr>`
      )
      .join('')

    const html = `
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;color:#111;line-height:1.5;max-width:560px;margin:0 auto;padding:24px;">
  <h1 style="font-size:20px;margin:0 0 4px;">tap-na</h1>
  <p style="margin:0 0 4px;color:#555;font-size:13px;">Auckmund Investment CC</p>
  <p style="margin:0 0 20px;color:#555;font-size:13px;">Erf: 62, Hosea Kutako Drive, Windhoek North<br>+264 85 792 7373 · auckmund@gmail.com</p>
  <h2 style="font-size:18px;margin:0 0 8px;">Order quote ${escapeHtml(quoteRef)}</h2>
  <p style="margin:0 0 16px;color:#555;font-size:13px;">Requested from the online shop</p>
  <p style="margin:0 0 4px;"><strong>Customer</strong></p>
  <p style="margin:0 0 16px;">
    ${escapeHtml(name)}<br>
    ${escapeHtml(email)}<br>
    ${escapeHtml(phone)}<br>
    ${escapeHtml(town)}
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
    <tbody>${rowsHtml}</tbody>
  </table>
  <p style="font-size:16px;font-weight:700;margin:0 0 16px;">Quoted total: ${escapeHtml(money(subtotal))}</p>
  ${note ? `<p style="font-size:13px;color:#555;margin:0 0 16px;"><strong>Notes:</strong> ${escapeHtml(note)}</p>` : ''}
  <p style="font-size:12px;color:#777;margin:0;">This is a quote request from the tap-na shop. Reply to confirm stock, delivery, and payment.</p>
</body>
</html>`.trim()

    const text = [
      `tap-na — Order quote ${quoteRef}`,
      'Auckmund Investment CC',
      '',
      `Customer: ${name}`,
      `Email: ${email}`,
      `Phone: ${phone}`,
      `Town: ${town}`,
      '',
      ...lines.map((l) => `${l.name} × ${l.qty} @ ${money(l.price)} = ${money(l.lineTotal)}`),
      '',
      `Quoted total: ${money(subtotal)}`,
      note ? `Notes: ${note}` : '',
      '',
      'This is a quote request from the tap-na shop.'
    ]
      .filter(Boolean)
      .join('\n')

    const toList = [companyTo, email].filter((v, i, arr) => arr.indexOf(v) === i)
    try {
      const sent = await sendCloudflareEmail(env, {
        from,
        to: toList,
        replyTo: email,
        subject,
        html,
        text
      })
      return json({
        ok: true,
        id: sent.id || '',
        quoteRef,
        to: toList,
        provider: sent.provider
      })
    } catch (err) {
      if (!err?._logged) {
        await logAppError(env, {
          source: 'email',
          message: err?.message || 'Email send failed',
          stack: err?.stack || '',
          path: pathname,
          method,
          status: err?.status || 502,
          context: { kind: 'quote_email' },
          actor: null
        })
      }
      return bad(err?.message || 'Email send failed', err?.status || 502)
    }
  }

  if (pathname === '/api/email/send' && method === 'POST') {
    const gate = await requireStaff(env, request, { roles: ['admin', 'sales'] })
    if (gate.error) return gate.error

    const body = await request.json().catch(() => null)
    const toRaw = body?.to
    const toList = Array.isArray(toRaw)
      ? toRaw.map((x) => String(x || '').trim()).filter(Boolean)
      : String(toRaw || '')
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean)
    const subject = String(body?.subject || '').trim()
    const html = String(body?.html || '')
    const text = String(body?.text || '')
    const fromDefault = defaultEmailFrom(env)
    const from = String(body?.from || fromDefault).trim() || fromDefault

    if (!toList.length) return bad('to is required')
    if (!subject) return bad('subject is required')
    if (!html && !text) return bad('html or text is required')

    try {
      const sent = await sendCloudflareEmail(env, {
        from,
        to: toList,
        subject,
        html,
        text,
        replyTo: body?.replyTo || body?.reply_to || '',
        attachments: Array.isArray(body?.attachments) ? body.attachments : []
      })
      return json({
        ok: true,
        id: sent.id || '',
        emailId: sent.id || '',
        to: toList,
        provider: sent.provider,
        delivered: sent.delivered || [],
        queued: sent.queued || []
      })
    } catch (err) {
      if (!err?._logged) {
        await logAppError(env, {
          source: 'email',
          message: err?.message || 'Email send failed',
          stack: err?.stack || '',
          path: pathname,
          method,
          status: err?.status || 502,
          context: { kind: 'email_send' },
          actor: typeof gate !== 'undefined' ? gate.staff : null
        })
      }
      return bad(err?.message || 'Email send failed', err?.status || 502)
    }
  }

  if (pathname === '/api/email/test' && method === 'POST') {
    const gate = await requireStaff(env, request, { roles: ['admin', 'sales'] })
    // Allow unauthenticated test only when explicitly enabled via secret flag — skip; staff preferred
    // For deploy verification, also allow with matching internal test key
    const body = await readJson(request)
    const testKey = String(body?.testKey || '').trim()
    const expectedKey = String(env.EMAIL_TEST_KEY || '').trim()
    const allowed = !gate.error || (testKey && expectedKey && testKey === expectedKey)
    if (!allowed) return gate.error || bad('Unauthorized', 401)

    const to = String(body?.to || 'auckmund@gmail.com').trim().toLowerCase()
    const kind = String(body?.kind || 'ping').trim().toLowerCase()
    try {
      let sent
      if (kind === 'welcome') {
        sent = await sendWelcomeEmail(env, { email: to, name: 'Auckmund', cardType: 'personal' })
      } else if (kind === 'login') {
        sent = await sendLoginAlertEmail(env, { email: to, name: 'Auckmund' })
      } else {
        sent = await sendCloudflareEmail(env, {
          to,
          subject: 'tap-na Cloudflare email test',
          html: transactionalShell({
            title: 'Email test OK',
            intro: 'Cloudflare Email Sending is working for tapnam.com.',
            bodyHtml: '<p style="margin:0;">Sent from the tap-na Worker.</p>',
            footerNote: new Date().toISOString()
          }),
          text: `tap-na Cloudflare email test\n\nCloudflare Email Sending is working.\n${new Date().toISOString()}`
        })
      }
      return json({ ok: true, to, kind, id: sent.id || '', provider: sent.provider, raw: sent.raw || null })
    } catch (err) {
      return bad(err?.message || 'Email test failed', err?.status || 502)
    }
  }

  return bad('Not found', 404)
}

async function serveStatic(request, env) {
  const url = new URL(request.url)
  const path = url.pathname

  // Look up assets without cache-bust query params
  const assetUrl = new URL(request.url)
  assetUrl.search = ''
  const assetRequest =
    assetUrl.href === request.url ? request : new Request(assetUrl.toString(), request)
  const res = await env.ASSETS.fetch(assetRequest)
  const contentType = res.headers.get('Content-Type') || ''
  const isHtml = contentType.includes('text/html')

  // Vite hashed bundles must never fall back to index.html — that breaks dynamic imports
  // after deploys when an old tab requests a removed chunk.
  if (path.startsWith('/assets/')) {
    if (!res.ok || isHtml) {
      return new Response('Not found', {
        status: 404,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-store',
          'CDN-Cache-Control': 'no-store'
        }
      })
    }
    const headers = new Headers(res.headers)
    headers.set('Cache-Control', 'public, max-age=31536000, immutable')
    headers.set('CDN-Cache-Control', 'public, max-age=31536000, immutable')
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
  }

  // Keep the HTML shell fresh so clients pick up new chunk hashes after deploy
  if (isHtml || path === '/' || path === '/index.html') {
    const headers = new Headers(res.headers)
    headers.set('Cache-Control', 'public, max-age=0, must-revalidate')
    headers.set('CDN-Cache-Control', 'no-store')
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
  }

  return res
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // Canonicalize www / legacy hosts → tapnam.com
    const host = url.hostname.toLowerCase()
    if (host === 'www.tapnam.com' || host === 'www.redirct.link' || host === 'redirct.link') {
      const next = new URL(request.url)
      next.protocol = 'https:'
      next.hostname = 'tapnam.com'
      return Response.redirect(next.toString(), 301)
    }

    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(request, env, url)
      } catch (err) {
        if (!err?._logged) {
          await logAppError(env, {
            source: 'api',
            message: err?.message || 'Server error',
            stack: err?.stack || '',
            path: url.pathname,
            method: request.method,
            status: 500,
            context: { supabasePath: err?.supabasePath || '' }
          })
        }
        return json({ ok: false, error: err.message || 'Server error' }, 500)
      }
    }

    const tap = url.pathname.match(/^\/c\/([^/]+)\/?$/)
    if (tap && request.method === 'GET' && env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
      const slug = decodeURIComponent(tap[1])
      const ua = request.headers.get('User-Agent') || ''

      // Social crawlers get Open Graph HTML with the profile photo (WhatsApp, etc.)
      if (isCrawler(ua)) {
        try {
          const cards = await sb(env, `cards?slug=eq.${encodeURIComponent(slug)}&select=*`)
          const card = cards?.[0]
          let profile = null
          if (card?.profile_id) {
            const profiles = await sb(
              env,
              `profiles?id=eq.${encodeURIComponent(card.profile_id)}&select=*`
            )
            profile = profiles?.[0] || null
          }
          const shareUrl = cardPageUrl(slug, card?.kind || profile?.card_type, url.origin)
          const title = profile
            ? profile.card_type === 'table'
              ? profile.company || profile.name || 'tap-na venue'
              : profile.name || 'Digital business card'
            : 'tap-na card'
          const description = profile
            ? [profile.title, profile.company, profile.card_type === 'table' ? 'Venue on tap-na' : 'Digital business card on tap-na']
                .filter(Boolean)
                .join(' · ')
            : 'Open this NFC / QR card on tap-na'
          const imageVersion = profile?.updated_at
            ? `?v=${encodeURIComponent(profile.updated_at)}`
            : ''
          const image = `${url.origin}/api/og/${encodeURIComponent(slug)}.jpg${imageVersion}`
          return new Response(
            ogHtml({ title, description, url: shareUrl, image }),
            {
              status: 200,
              headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'public, max-age=300'
              }
            }
          )
        } catch (err) {
          if (!err?._logged) {
            await logAppError(env, {
              source: 'og',
              message: err?.message || String(err),
              stack: err?.stack || '',
              path: url.pathname,
              method: 'GET',
              context: { kind: 'crawler_og' }
            })
          }
          /* fall through to SPA */
        }
      }

      try {
        const via = String(url.searchParams.get('via') || '').toLowerCase()
        const channel = via === 'qr' ? 'qr' : 'nfc'
        await recordCardActivity(env, request, { slug, channel, action: 'open' })
      } catch {
        /* non-fatal */
      }
    }

    if (env.ASSETS) return serveStatic(request, env)
    return new Response('tap-na worker online', { status: 200 })
  }
}