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
  const cards = await sb(env, `cards?slug=eq.${encodeURIComponent(code)}&deleted=eq.false&select=id,profile_id`)
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
    const rows = await sb(env, `cards?slug=eq.${encodeURIComponent(slug)}&deleted=eq.false&select=id`)
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

function normalizeStaffRole(role) {
  const r = String(role || '').trim().toLowerCase()
  if (r === 'admin' || r === 'manager' || r === 'sales') return r
  return ''
}

/** Admin + manager can see/manage all sales data (not agent-scoped). */
function isSalesElevated(staff) {
  return staff?.role === 'admin' || staff?.role === 'manager'
}

function staffClaimsFromUser(user) {
  const meta = user?.app_metadata || {}
  const role = normalizeStaffRole(meta.role)
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
    await logAppError(env, {
      source: 'auth_admin',
      message: msg,
      stack: err.stack || '',
      path: String(path || '').split('?')[0],
      method,
      status: res.status,
      context: { kind: 'supabase_auth_admin' }
    })
    err._logged = true
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

async function requireStaff(env, request, { roles = ['admin', 'manager', 'sales'] } = {}) {
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
      label: row.shop_label || row.label || '',
      badge: row.shop_badge || row.badge || '',
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
    badge: mapped.badge || '',
    label: mapped.label || '',
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
    shop_label: String(body?.label || body?.shop_label || '').trim().slice(0, 80),
    shop_badge: String(body?.badge || body?.shop_badge || '').trim().slice(0, 40),
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
      accessRole: row.access_role === 'manager' ? 'manager' : 'sales',
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
    access_role: String(body?.accessRole || body?.access_role || 'sales').toLowerCase() === 'manager' ? 'manager' : 'sales',
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
      paidAmount: Number(row.paid_amount) || 0,
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
  const amount = Math.max(0, Number(body?.amount) || 0)
  const status = String(body?.status || 'draft')
  let paidAmount = Math.max(0, Number(body?.paidAmount) || 0)
  if (status === 'paid' && paidAmount <= 0) paidAmount = amount
  if (paidAmount > amount) paidAmount = amount
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
    amount,
    paid_amount: paidAmount,
    status,
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

function assertAgentAccess(staff, agentId) {
  if (isSalesElevated(staff)) return null
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
    deleted_by: String(staff?.email || staff?.id || '')
  }
  // sales_cashflow historically had no updated_at; only set when the table supports it
  if (table !== 'sales_cashflow') {
    patch.updated_at = new Date().toISOString()
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
    deleted_by: ''
  }
  if (table !== 'sales_cashflow') {
    patch.updated_at = new Date().toISOString()
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

const DELETED_SALES_TABLES = [
  ['sales_cashflow', 'cash'],
  ['sales_invoices', 'invoice'],
  ['sales_quotes', 'quote'],
  ['sales_orders', 'order'],
  ['sales_products', 'product'],
  ['sales_agents', 'agent']
]

async function purgeDeletedSalesRows(env, table) {
  const rows = await sb(env, `${table}?deleted=eq.true`, {
    method: 'DELETE',
    prefer: 'return=representation'
  })
  return Array.isArray(rows) ? rows.length : 0
}

/** Soft-delete live finance rows for agents about to be hard-purged (FK would otherwise SET NULL). */
async function softDeleteFinanceForDoomedAgents(env) {
  const doomed = await sb(env, 'sales_agents?deleted=eq.true&select=id')
  const ids = (doomed || []).map((r) => String(r.id || '').trim()).filter(Boolean)
  if (!ids.length) return
  const now = new Date().toISOString()
  const patch = {
    deleted: true,
    deleted_at: now,
    deleted_by: 'purge:agent-cascade'
  }
  for (const agentId of ids) {
    for (const table of ['sales_orders', 'sales_quotes', 'sales_invoices', 'sales_cashflow']) {
      const body = table === 'sales_cashflow'
        ? { deleted: true, deleted_at: now, deleted_by: 'purge:agent-cascade' }
        : { ...patch, updated_at: now }
      await sb(env, `${table}?agent_id=eq.${encodeURIComponent(agentId)}&deleted=eq.false`, {
        method: 'PATCH',
        body,
        prefer: 'return=minimal'
      })
    }
  }
}


async function softDeleteRow(env, {
  table,
  id,
  idField = 'id',
  staff = null,
  actor = '',
  extra = {}
} = {}) {
  const patch = {
    deleted: true,
    deleted_at: new Date().toISOString(),
    deleted_by: String(actor || staff?.email || staff?.id || 'system'),
    ...extra
  }
  if (table !== 'sales_cashflow' && table !== 'card_opens' && table !== 'sessions') {
    // many tables have updated_at; ignore if missing via prefer
    if (extra.updated_at === undefined && table !== 'cards') {
      // cards may not have updated_at
    }
  }
  await sb(env, `${table}?${idField}=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: patch,
    prefer: 'return=minimal'
  })
  return patch
}

async function restoreRow(env, {
  table,
  id,
  idField = 'id',
  extra = {}
} = {}) {
  const patch = {
    deleted: false,
    deleted_at: null,
    deleted_by: '',
    ...extra
  }
  await sb(env, `${table}?${idField}=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: patch,
    prefer: 'return=minimal'
  })
  return patch
}

/** Permanently remove a profile and related data. NFC cards are unlinked, not deleted. */
async function hardDeleteProfile(env, profileId, staff) {
  const id = String(profileId || '').trim()
  if (!id) throw new Error('Profile id required')

  const profiles = await sb(env, `profiles?id=eq.${encodeURIComponent(id)}&select=*`)
  const profile = profiles?.[0]
  if (!profile) return null

  const cards = await sb(
    env,
    `cards?profile_id=eq.${encodeURIComponent(id)}&select=id,slug`
  )
  const slugs = (cards || []).map((c) => c.slug).filter(Boolean)

  await sb(env, `cards?profile_id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: { profile_id: null, status: 'unlinked', linked_at: null },
    prefer: 'return=minimal'
  })

  await sb(env, `sessions?profile_id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' })
  await sb(env, `checkins?profile_id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' })
  await sb(env, `feedback?profile_id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' })

  // meetings, followups, profile_catalog_carts, and owned teams cascade on profile delete.
  await sb(env, `profiles?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' })

  await writeSalesChangeLog(env, {
    staff,
    action: 'delete',
    entityType: 'profile',
    entityId: id,
    entityLabel: profile.name || profile.company || id,
    summary: `Permanently deleted profile: ${profile.name || profile.company || id}`,
    before: {
      id,
      name: profile.name || '',
      company: profile.company || '',
      cardType: profile.card_type || '',
      slugs
    },
    after: {}
  })

  return { id, unlinkedSlugs: slugs }
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
    `cards?profile_id=eq.${encodeURIComponent(profileId)}&status=eq.linked&deleted=eq.false&select=slug,kind`
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

function mapPublicCardRow(c) {
  const kind = c?.kind === 'personal' ? 'personal' : 'table'
  return {
    slug: c.slug || '',
    kind,
    personalType: kind === 'personal' ? normalizePersonalType(c.personal_type || 'business') : '',
    productId: c.product_id || '',
    status: c.status || ''
  }
}

async function publicProfile(env, row, { includeCards = false } = {}) {
  if (!row) return null
  const cardRows =
    (await sb(
      env,
      `cards?profile_id=eq.${encodeURIComponent(row.id)}&deleted=eq.false&select=slug,kind,personal_type,product_id,status,linked_at&order=linked_at.desc.nullslast`
    )) || []
  const mapped = cardRows.map(mapPublicCardRow)
  const linked = mapped.filter((c) => !c.status || c.status === 'linked')
  const want = row.card_type === 'table' ? 'table' : 'personal'
  const shareHit = linked.find((c) => c.kind === want) || linked[0]
  const personalHit = linked.find((c) => c.kind === 'personal') || mapped.find((c) => c.kind === 'personal')
  const personalType = row.card_type === 'table' ? '' : personalHit?.personalType || 'business'
  return {
    id: row.id,
    cardType: row.card_type,
    personalType,
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
    shareSlug: shareHit?.slug || '',
    ...(includeCards ? { cards: mapped } : {})
  }
}

function isHttpUrl(value) {
  try {
    const u = new URL(String(value || '').trim())
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

function normalizeCatalogAttachments(item) {
  const images = (Array.isArray(item?.images) ? item.images : [])
    .map((u) => String(u || '').trim())
    .filter(isHttpUrl)
    .slice(0, 8)

  const pdfs = (Array.isArray(item?.pdfs) ? item.pdfs : [])
    .map((row) => {
      const url = String(row?.url || row || '').trim()
      if (!isHttpUrl(url)) return null
      const name = String(row?.name || 'Document').trim().slice(0, 120) || 'Document'
      return { name, url }
    })
    .filter(Boolean)
    .slice(0, 5)

  const links = (Array.isArray(item?.links) ? item.links : [])
    .map((row) => {
      const url = String(row?.url || '').trim()
      if (!isHttpUrl(url)) return null
      const label = String(row?.label || row?.name || url).trim().slice(0, 120) || url
      return { label, url }
    })
    .filter(Boolean)
    .slice(0, 10)

  return { images, pdfs, links }
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
      const attachments = normalizeCatalogAttachments(item)
      return {
        id: String(item?.id || `cat_${i + 1}`).trim().slice(0, 64) || `cat_${i + 1}`,
        name,
        description: String(item?.description || '').trim().slice(0, 400),
        price,
        active: item?.active !== false,
        images: attachments.images,
        pdfs: attachments.pdfs,
        links: attachments.links
      }
    })
    .filter(Boolean)
}

function normalizeCatalogCartItems(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .slice(0, 40)
    .map((item) => {
      const id = String(item?.id || '').trim().slice(0, 64)
      const name = String(item?.name || 'Item').trim().slice(0, 160) || 'Item'
      const qty = Math.max(1, Math.min(99, Math.floor(Number(item?.qty) || 1)))
      let price = null
      if (item?.price !== null && item?.price !== undefined && item?.price !== '') {
        const n = Number(item.price)
        if (Number.isFinite(n) && n >= 0) price = Math.round(n * 100) / 100
      }
      return { id: id || `item_${qty}`, name, qty, price }
    })
    .filter((x) => x.name)
}

function mapCatalogCartRow(row) {
  return {
    id: row.id,
    profileId: row.profile_id,
    visitorName: row.visitor_name || '',
    visitorEmail: row.visitor_email || '',
    visitorPhone: row.visitor_phone || '',
    items: Array.isArray(row.items) ? row.items : [],
    note: row.note || '',
    status: row.status || 'open',
    source: row.source || 'catalog',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deleted: !!row.deleted
  }
}

const PERSONAL_TYPE_RANKS = {
  executive_exclusive: 3,
  business: 2,
  professional: 1
}

function normalizePersonalType(raw, fallback = 'business') {
  const key = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
  if (key === 'executive' || key === 'exclusive' || key === 'exec') return 'executive_exclusive'
  if (PERSONAL_TYPE_RANKS[key]) return key
  return fallback || ''
}

function personalTypeRank(role) {
  return PERSONAL_TYPE_RANKS[normalizePersonalType(role)] || 2
}

function canManageTeamRole(actorRole, targetRole) {
  return personalTypeRank(actorRole) >= personalTypeRank(targetRole)
}

/** Roles allowed under a package ceiling (highest seat on the team). */
function assignableTeamRoles(packageCeiling) {
  const rank = personalTypeRank(packageCeiling)
  return Object.keys(PERSONAL_TYPE_RANKS).filter((id) => personalTypeRank(id) <= rank)
}

function packageCeilingFromRoles(roles) {
  let best = 'professional'
  for (const role of roles || []) {
    const id = normalizePersonalType(role, '')
    if (!id) continue
    if (personalTypeRank(id) > personalTypeRank(best)) best = id
  }
  return best
}

/** Effective package ceiling: stored value, raised by any higher seat role. */
function resolveTeamPackageCeiling(team, memberRows = []) {
  const stored = normalizePersonalType(team?.package_ceiling || '', '')
  const fromSeats = packageCeilingFromRoles((memberRows || []).map((m) => m.role))
  if (!stored) return fromSeats || 'business'
  return personalTypeRank(fromSeats) > personalTypeRank(stored) ? fromSeats : stored
}

function canAccessTeamFeatures(personalType, { hasTeam = false } = {}) {
  if (hasTeam) return true
  return personalTypeRank(personalType) >= personalTypeRank('business')
}

const SHOP_TEAM_PRODUCT_ROLES = {
  'black-card': 'business',
  'black-card-front': 'executive_exclusive'
}

async function getProfilePersonalType(env, profileId) {
  if (!profileId) return 'business'
  const cards = await sb(
    env,
    `cards?profile_id=eq.${encodeURIComponent(profileId)}&kind=eq.personal&deleted=eq.false&select=personal_type,status&order=linked_at.desc.nullslast&limit=1`
  )
  const card = cards?.[0]
  if (card) return normalizePersonalType(card.personal_type || 'business')
  return 'business'
}

/** Keep team_members.role aligned with cards.personal_type for a profile or card. */
async function syncPersonalTypeAcrossDb(env, { profileId = '', cardId = '', personalType = '' } = {}) {
  const role = normalizePersonalType(personalType)
  if (!role) return

  if (cardId) {
    await sb(env, `cards?id=eq.${encodeURIComponent(cardId)}&kind=eq.personal&deleted=eq.false`, {
      method: 'PATCH',
      body: { personal_type: role },
      prefer: 'return=minimal'
    })
  }

  if (profileId) {
    await sb(
      env,
      `cards?profile_id=eq.${encodeURIComponent(profileId)}&kind=eq.personal&deleted=eq.false`,
      {
        method: 'PATCH',
        body: { personal_type: role },
        prefer: 'return=minimal'
      }
    )
    await sb(
      env,
      `team_members?profile_id=eq.${encodeURIComponent(profileId)}&deleted=eq.false&status=eq.active`,
      {
        method: 'PATCH',
        body: { role, updated_at: new Date().toISOString() },
        prefer: 'return=minimal'
      }
    )
  }
}

function mapTeamRow(row) {
  return {
    id: row.id,
    name: row.name || '',
    ownerProfileId: row.owner_profile_id || '',
    ownerEmail: row.owner_email || '',
    packageCeiling: normalizePersonalType(row.package_ceiling || 'business'),
    shopQuoteRef: row.shop_quote_ref || '',
    shareCatalog: row.share_catalog === true,
    meetingTool: String(row.meeting_tool || '').trim().toLowerCase(),
    usesCrm: row.uses_crm === true,
    crmProvider: String(row.crm_provider || '').trim().toLowerCase(),
    crmOther: String(row.crm_other || '').trim(),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function mapTeamMemberRow(row) {
  return {
    id: row.id,
    teamId: row.team_id,
    profileId: row.profile_id || '',
    cardId: row.card_id || '',
    slug: row.slug || '',
    role: normalizePersonalType(row.role),
    status: row.status || 'pending_claim',
    inviteEmail: row.invite_email || '',
    invitedByProfileId: row.invited_by_profile_id || '',
    joinedAt: row.joined_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    memberName: row.member_name || '',
    memberEmail: row.member_email || '',
    deleted: row.deleted === true,
    deletedAt: row.deleted_at || '',
    deletedBy: row.deleted_by || ''
  }
}

async function getOrCreateOwnedTeam(env, profile) {
  const existing = await sb(
    env,
    `teams?owner_profile_id=eq.${encodeURIComponent(profile.id)}&deleted=eq.false&select=*&order=created_at.asc&limit=1`
  )
  const ownerRole = await getProfilePersonalType(env, profile.id)
  if (existing?.[0]) {
    // Keep owner membership role aligned with their card type
    await sb(
      env,
      `team_members?team_id=eq.${encodeURIComponent(existing[0].id)}&profile_id=eq.${encodeURIComponent(profile.id)}&deleted=eq.false&status=eq.active`,
      {
        method: 'PATCH',
        body: { role: ownerRole, updated_at: new Date().toISOString() },
        prefer: 'return=minimal'
      }
    )
    return existing[0]
  }
  const id = uid('team')
  const now = new Date().toISOString()
  const name =
    String(profile.company || profile.name || 'My team').trim().slice(0, 120) || 'My team'
  const packageCeiling =
    personalTypeRank(ownerRole) >= personalTypeRank('business') ? ownerRole : 'business'
  const ownerEmail = String(profile.login_email || profile.email || '')
    .trim()
    .toLowerCase()
  await sb(env, 'teams', {
    method: 'POST',
    body: {
      id,
      name,
      owner_profile_id: profile.id,
      owner_email: ownerEmail,
      package_ceiling: packageCeiling,
      created_at: now,
      updated_at: now
    },
    prefer: 'return=minimal'
  })
  // Owner role follows their personal card type (default business)
  await sb(env, 'team_members', {
    method: 'POST',
    body: {
      id: uid('tmem'),
      team_id: id,
      profile_id: profile.id,
      card_id: null,
      slug: '',
      role: ownerRole,
      status: 'active',
      invite_email: ownerEmail,
      invited_by_profile_id: profile.id,
      invite_token: '',
      joined_at: now,
      created_at: now,
      updated_at: now
    },
    prefer: 'return=minimal'
  })
  const rows = await sb(env, `teams?id=eq.${encodeURIComponent(id)}&select=*`)
  return rows?.[0]
}

/** Link provisional shop teams (owner_email set, no owner yet) to this profile. */
async function claimProvisionalTeamsForProfile(env, profile) {
  const email = String(profile?.login_email || profile?.email || '')
    .trim()
    .toLowerCase()
  if (!email || !email.includes('@')) return []
  const rows = await sb(
    env,
    `teams?owner_email=ilike.${encodeURIComponent(email)}&owner_profile_id=is.null&deleted=eq.false&select=*`
  )
  if (!rows?.length) return []
  const now = new Date().toISOString()
  const claimed = []
  for (const team of rows) {
    await sb(env, `teams?id=eq.${encodeURIComponent(team.id)}`, {
      method: 'PATCH',
      body: {
        owner_profile_id: profile.id,
        updated_at: now
      },
      prefer: 'return=minimal'
    })
    const role = normalizePersonalType(team.package_ceiling || 'business')
    const existingMem = await sb(
      env,
      `team_members?team_id=eq.${encodeURIComponent(team.id)}&profile_id=eq.${encodeURIComponent(profile.id)}&deleted=eq.false&select=id&limit=1`
    )
    if (!existingMem?.length) {
      await sb(env, 'team_members', {
        method: 'POST',
        body: {
          id: uid('tmem'),
          team_id: team.id,
          profile_id: profile.id,
          card_id: null,
          slug: '',
          role,
          status: 'active',
          invite_email: email,
          invited_by_profile_id: profile.id,
          invite_token: '',
          joined_at: now,
          created_at: now,
          updated_at: now
        },
        prefer: 'return=minimal'
      })
    }
    claimed.push({ ...team, owner_profile_id: profile.id })
  }
  return claimed
}

async function provisionTeamFromShopQuote(env, {
  name = '',
  company = '',
  email = '',
  quoteRef = '',
  lines = []
} = {}) {
  let businessQty = 0
  let executiveQty = 0
  for (const line of lines || []) {
    const role = SHOP_TEAM_PRODUCT_ROLES[String(line?.id || '')]
    if (!role) continue
    const qty = Math.max(0, Math.floor(Number(line?.qty) || 0))
    if (role === 'executive_exclusive') executiveQty += qty
    else if (role === 'business') businessQty += qty
  }
  const totalSeats = businessQty + executiveQty
  if (totalSeats <= 0) return null

  const ownerEmail = String(email || '')
    .trim()
    .toLowerCase()
  const packageCeiling = executiveQty > 0 ? 'executive_exclusive' : 'business'
  const teamName =
    String(company || name || 'Connect Teams')
      .trim()
      .slice(0, 120) || 'Connect Teams'
  const id = uid('team')
  const now = new Date().toISOString()

  // Prefer attaching to an existing profile with this email
  let ownerProfileId = null
  if (ownerEmail) {
    const profiles = await sb(
      env,
      `profiles?or=(login_email.ilike.${encodeURIComponent(ownerEmail)},email.ilike.${encodeURIComponent(ownerEmail)})&deleted=eq.false&select=id,card_type&limit=1`
    )
    const p = profiles?.[0]
    if (p && p.card_type !== 'table') ownerProfileId = p.id
  }

  await sb(env, 'teams', {
    method: 'POST',
    body: {
      id,
      name: teamName,
      owner_profile_id: ownerProfileId,
      owner_email: ownerEmail,
      package_ceiling: packageCeiling,
      shop_quote_ref: String(quoteRef || '').slice(0, 64),
      created_at: now,
      updated_at: now
    },
    prefer: 'return=minimal'
  })

  const seatRoles = [
    ...Array.from({ length: businessQty }, () => 'business'),
    ...Array.from({ length: executiveQty }, () => 'executive_exclusive')
  ]
  for (const role of seatRoles) {
    await sb(env, 'team_members', {
      method: 'POST',
      body: {
        id: uid('tmem'),
        team_id: id,
        profile_id: null,
        card_id: null,
        slug: '',
        role,
        status: 'pending_claim',
        invite_email: '',
        invited_by_profile_id: ownerProfileId || '',
        invite_token: uid('tinv'),
        created_at: now,
        updated_at: now
      },
      prefer: 'return=minimal'
    })
  }

  if (ownerProfileId) {
    await sb(env, 'team_members', {
      method: 'POST',
      body: {
        id: uid('tmem'),
        team_id: id,
        profile_id: ownerProfileId,
        card_id: null,
        slug: '',
        role: packageCeiling,
        status: 'active',
        invite_email: ownerEmail,
        invited_by_profile_id: ownerProfileId,
        invite_token: '',
        joined_at: now,
        created_at: now,
        updated_at: now
      },
      prefer: 'return=minimal'
    })
  }

  return {
    teamId: id,
    packageCeiling,
    businessQty,
    executiveQty,
    ownerProfileId: ownerProfileId || '',
    ownerEmail
  }
}

async function getActorTeamMembership(env, profileId, teamId) {
  const rows = await sb(
    env,
    `team_members?team_id=eq.${encodeURIComponent(teamId)}&profile_id=eq.${encodeURIComponent(profileId)}&deleted=eq.false&status=eq.active&select=*`
  )
  return rows?.[0] || null
}

async function enrichTeamMembers(env, members) {
  const profileIds = [...new Set(members.map((m) => m.profile_id).filter(Boolean))]
  const profilesById = {}
  if (profileIds.length) {
    const rows = await sb(
      env,
      `profiles?id=in.(${profileIds.map(encodeURIComponent).join(',')})&select=id,name,company,login_email,email`
    )
    for (const p of rows || []) profilesById[p.id] = p
  }
  return (members || []).map((m) => {
    const p = profilesById[m.profile_id]
    return mapTeamMemberRow({
      ...m,
      member_name: p ? String(p.name || p.company || '').trim() : '',
      member_email: p
        ? String(p.login_email || p.email || m.invite_email || '').trim()
        : String(m.invite_email || '')
    })
  })
}

/**
 * If profileId is an active member of a team with share_catalog, return the owner's catalog.
 * Owners always use their own catalog (not "shared").
 */
async function resolveSharedCatalogForProfile(env, profileId) {
  const id = String(profileId || '').trim()
  if (!id) return null
  const memberships = await sb(
    env,
    `team_members?profile_id=eq.${encodeURIComponent(id)}&deleted=eq.false&status=eq.active&select=team_id&limit=20`
  )
  const teamIds = [...new Set((memberships || []).map((m) => m.team_id).filter(Boolean))]
  if (!teamIds.length) return null
  const teams = await sb(
    env,
    `teams?id=in.(${teamIds.map(encodeURIComponent).join(',')})&deleted=eq.false&share_catalog=eq.true&select=*`
  )
  const team = (teams || []).find((t) => t.owner_profile_id && t.owner_profile_id !== id) || null
  if (!team) return null
  const owners = await sb(
    env,
    `profiles?id=eq.${encodeURIComponent(team.owner_profile_id)}&select=id,name,company,catalog_items,disabled`
  )
  const owner = owners?.[0]
  if (!owner || owner.disabled) return null
  const items = normalizeCatalogItems(owner.catalog_items).filter((x) => x.active !== false)
  return {
    teamId: team.id,
    teamName: team.name || 'Team',
    catalogOwnerId: owner.id,
    sharedFromName: String(owner.name || owner.company || 'Team owner').trim() || 'Team owner',
    catalogItems: items
  }
}

async function findPendingTeamInviteForCard(env, cardId, profileId = '') {
  let q =
    `team_members?deleted=eq.false&status=in.(pending_claim,invited)&select=*&order=created_at.desc&limit=5`
  if (cardId) q += `&card_id=eq.${encodeURIComponent(cardId)}`
  else if (profileId) q += `&profile_id=eq.${encodeURIComponent(profileId)}`
  else return null
  const rows = await sb(env, q)
  const row = rows?.[0]
  if (!row) return null
  const teams = await sb(
    env,
    `teams?id=eq.${encodeURIComponent(row.team_id)}&deleted=eq.false&select=*`
  )
  const team = teams?.[0]
  if (!team) return null
  let ownerName = ''
  const owners = await sb(
    env,
    `profiles?id=eq.${encodeURIComponent(team.owner_profile_id)}&select=name,company`
  )
  ownerName = String(owners?.[0]?.name || owners?.[0]?.company || 'Team owner').trim()
  return {
    memberId: row.id,
    teamId: team.id,
    teamName: team.name || 'Team',
    ownerName,
    role: normalizePersonalType(row.role),
    status: row.status
  }
}

async function sendTeamInviteEmail(env, {
  to,
  inviteeName = '',
  teamName,
  ownerName,
  role,
  slug,
  pendingClaim = false
}) {
  if (!to || !String(to).includes('@')) return
  const roleLabel =
    role === 'executive_exclusive'
      ? 'Executive Exclusive'
      : role === 'business'
        ? 'Business'
        : 'Professional'
  const subject = pendingClaim
    ? `You've been invited to join ${teamName} on tap-na`
    : `${ownerName} invited you to ${teamName} on tap-na`
  const bodyHtml = pendingClaim
    ? `<p style="margin:0 0 8px;">When you claim card <strong>${escapeHtml(slug)}</strong>, you'll be asked to join <strong>${escapeHtml(teamName)}</strong> as <strong>${escapeHtml(roleLabel)}</strong>.</p>
       <p style="margin:12px 0 0;">Open your card link and complete signup to accept or decline.</p>`
    : `<p style="margin:0 0 8px;"><strong>${escapeHtml(ownerName)}</strong> invited you to join <strong>${escapeHtml(teamName)}</strong> as <strong>${escapeHtml(roleLabel)}</strong>.</p>
       <p style="margin:12px 0 0;"><a href="https://tapnam.com/team">Open Team</a> to accept or decline.</p>`
  await sendCloudflareEmail(env, {
    to,
    subject,
    html: transactionalShell({
      title: pendingClaim ? 'Team invite waiting' : 'Team invitation',
      intro: `Hi ${inviteeName || 'there'},`,
      bodyHtml,
      footerNote: 'Sent via tap-na teams.'
    }),
    text: [
      subject,
      pendingClaim
        ? `Claim card ${slug} to join ${teamName} as ${roleLabel}.`
        : `Open https://tapnam.com/team to respond.`
    ].join('\n')
  })
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

/** Real mailbox only — rejects placeholders like admin@01 used for local staff login. */
function isDeliverableEmail(value) {
  const email = String(value || '').trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false
  // Internal / non-mailbox staff logins
  if (email === 'admin@01' || email.endsWith('@01') || email.endsWith('.local')) return false
  return true
}

function defaultEmailFrom(env) {
  return String(env.EMAIL_FROM || env.RESEND_FROM || 'tap-na <welcome@mail.tapnam.com>').trim()
}

function defaultEmailReplyTo(env) {
  return String(env.EMAIL_REPLY_TO || '').trim()
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

function pdfEscapeText(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

/** Minimal single-page PDF (Helvetica) for shop quotes without browser deps. */
function buildSimplePdfBase64(title, lines = []) {
  const allLines = [String(title || 'Document').slice(0, 80), '', ...(Array.isArray(lines) ? lines : [])]
    .map((l) => pdfEscapeText(l).slice(0, 95))
    .slice(0, 45)
  const ops = ['BT', '/F1 11 Tf', '50 750 Td']
  allLines.forEach((line, i) => {
    if (i === 0) {
      ops.push('/F1 16 Tf', `(${line}) Tj`, '/F1 10 Tf')
    } else if (i === 1 && line === '') {
      ops.push('0 -18 Td')
    } else {
      ops.push(`0 -14 Td (${line}) Tj`)
    }
  })
  ops.push('ET')
  const stream = ops.join('\n')
  const objs = []
  objs.push('1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n')
  objs.push('2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n')
  objs.push(
    '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>endobj\n'
  )
  objs.push('4 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n')
  objs.push(`5 0 obj<< /Length ${stream.length} >>stream\n${stream}\nendstream\nendobj\n`)
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  for (const o of objs) {
    offsets.push(pdf.length)
    pdf += o
  }
  const xrefStart = pdf.length
  pdf += `xref\n0 ${objs.length + 1}\n`
  pdf += '0000000000 65535 f \n'
  for (let i = 1; i < offsets.length; i++) {
    pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n'
  }
  pdf += `trailer<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`
  return utf8ToBase64(pdf)
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

function meetingWindow(startIso, durationMinutes = 30) {
  const start = new Date(startIso)
  if (Number.isNaN(start.getTime())) throw new Error('Invalid meeting start time')
  const minutes = Math.max(15, Number(durationMinutes) || 30)
  const end = new Date(start.getTime() + minutes * 60 * 1000)
  return { start, end, minutes }
}

function googleCalendarUrl({ title, details, location, startIso, durationMinutes = 30 }) {
  const { start, end } = meetingWindow(startIso, durationMinutes)
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: String(title || 'Meeting'),
    dates: `${formatIcsUtc(start)}/${formatIcsUtc(end)}`,
    details: String(details || ''),
    location: String(location || '')
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

const OUTLOOK_CALENDAR_URL =
  'https://outlook.cloud.microsoft/calendar/view/workweek?deeplink=mail%2F'

function outlookCalendarUrl() {
  return OUTLOOK_CALENDAR_URL
}

async function meetingInviteToken(env, meetingId) {
  const secret = String(env.SUPABASE_SERVICE_ROLE_KEY || env.EMAIL_API_TOKEN || 'tap-na-meeting-ics').slice(0, 80)
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`meeting-ics:${meetingId}`))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 20)
}

function tokensMatch(a, b) {
  const left = String(a || '')
  const right = String(b || '')
  if (!left || left.length !== right.length) return false
  let diff = 0
  for (let i = 0; i < left.length; i++) diff |= left.charCodeAt(i) ^ right.charCodeAt(i)
  return diff === 0
}

function meetingInviteIcsUrl(meetingId, token) {
  return `${CANONICAL_ORIGIN}/api/meetings/${encodeURIComponent(meetingId)}/invite.ics?t=${encodeURIComponent(token)}`
}

function uniqueEmails(...values) {
  const out = []
  for (const value of values) {
    const email = String(value || '').trim().toLowerCase()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue
    if (!out.includes(email)) out.push(email)
  }
  return out
}

function ownerNotifyEmails(owner) {
  return uniqueEmails(owner?.email, owner?.login_email)
}

const CRM_APP_URLS = {
  salesforce: 'https://login.salesforce.com',
  zoho: 'https://crm.zoho.com',
  hubspot: 'https://app.hubspot.com/contacts',
  odoo: 'https://www.odoo.com/app/crm',
  sage: 'https://www.sage.com'
}

const CRM_LOGOS = {
  salesforce: `${CANONICAL_ORIGIN}/images/email/crm-salesforce.png`,
  zoho: `${CANONICAL_ORIGIN}/images/email/crm-zoho.png`,
  hubspot: `${CANONICAL_ORIGIN}/images/email/crm-hubspot.png`,
  odoo: `${CANONICAL_ORIGIN}/images/email/crm-odoo.png`,
  sage: `${CANONICAL_ORIGIN}/images/email/crm-sage.png`,
  other: `${CANONICAL_ORIGIN}/images/email/crm-other.png`
}

const CRM_LABELS = {
  salesforce: 'Salesforce',
  zoho: 'Zoho',
  hubspot: 'HubSpot',
  odoo: 'Odoo',
  sage: 'Sage',
  other: 'Others'
}

function parseTeamIntegrationsFromBody(body) {
  const meetingTool = String(body?.meetingTool || body?.meeting_tool || '')
    .trim()
    .toLowerCase()
  const usesCrm = !!(body?.usesCrm ?? body?.uses_crm)
  const crmProvider = String(body?.crmProvider || body?.crm_provider || '')
    .trim()
    .toLowerCase()
  const crmOther = String(body?.crmOther || body?.crm_other || '').trim().slice(0, 80)
  const meetingOk = meetingTool === 'google' || meetingTool === 'microsoft'
  const crmOk = !usesCrm || ['salesforce', 'zoho', 'hubspot', 'odoo', 'sage', 'other'].includes(crmProvider)
  return {
    meetingTool: meetingOk ? meetingTool : '',
    usesCrm,
    crmProvider: usesCrm && crmOk ? crmProvider : '',
    crmOther: usesCrm && crmProvider === 'other' ? crmOther : '',
    meetingOk,
    crmOk
  }
}

async function applyTeamIntegrations(env, teamId, integrations) {
  if (!teamId) return
  await sb(env, `teams?id=eq.${encodeURIComponent(teamId)}`, {
    method: 'PATCH',
    body: {
      meeting_tool: integrations.meetingTool || '',
      uses_crm: !!integrations.usesCrm,
      crm_provider: integrations.crmProvider || '',
      crm_other: integrations.crmOther || '',
      updated_at: new Date().toISOString()
    },
    prefer: 'return=minimal'
  })
}

async function teamIntegrationsForProfile(env, profileId) {
  const id = String(profileId || '').trim()
  if (!id) return null
  const mems = await sb(
    env,
    `team_members?profile_id=eq.${encodeURIComponent(id)}&deleted=eq.false&status=eq.active&select=team_id&limit=10`
  )
  const teamIds = [...new Set((mems || []).map((m) => m.team_id).filter(Boolean))]
  if (!teamIds.length) {
    const owned = await sb(
      env,
      `teams?owner_profile_id=eq.${encodeURIComponent(id)}&deleted=eq.false&select=*&limit=1`
    )
    return owned?.[0] ? mapTeamRow(owned[0]) : null
  }
  const teams = await sb(
    env,
    `teams?id=in.(${teamIds.map(encodeURIComponent).join(',')})&deleted=eq.false&select=*`
  )
  const row = (teams || []).find((t) => t.owner_profile_id === id) || teams?.[0]
  return row ? mapTeamRow(row) : null
}

function calendarButtonRow(href, logoSrc, label) {
  const img = logoSrc
    ? `<img src="${escapeHtml(logoSrc)}" width="22" height="22" alt="" style="display:inline-block;width:22px;height:22px;vertical-align:middle;margin-right:10px;border:0;" />`
    : ''
  return `<p style="margin:0 0 10px;"><a href="${escapeHtml(href)}" style="display:inline-block;padding:10px 14px;border:1px solid #ddd;border-radius:10px;color:#111;text-decoration:none;font-size:14px;font-weight:700;line-height:22px;">${img}<span style="vertical-align:middle;">${escapeHtml(label)}</span></a></p>`
}

function calendarAddLinksHtml({ googleUrl, outlookUrl, icsUrl, meetingTool = '', isTeam = false }) {
  const gmailLogo = `${CANONICAL_ORIGIN}/images/email/gmail.png`
  const outlookLogo = `${CANONICAL_ORIGIN}/images/email/outlook.png`
  const rows = []
  if (isTeam && meetingTool === 'microsoft') {
    rows.push(calendarButtonRow(outlookUrl, outlookLogo, 'Outlook'))
  } else if (isTeam && meetingTool === 'google') {
    rows.push(calendarButtonRow(googleUrl, gmailLogo, 'Google Calendar'))
  } else if (isTeam) {
    rows.push(calendarButtonRow(googleUrl, gmailLogo, 'Google Calendar'))
    rows.push(calendarButtonRow(outlookUrl, outlookLogo, 'Outlook'))
  }
  rows.push(calendarButtonRow(icsUrl, '', 'Add to calendar'))
  return `
  <p style="margin:16px 0 10px;font-weight:700;">Add to your calendar</p>
  ${rows.join('')}`
}

function calendarAddLinksText({ googleUrl, outlookUrl, icsUrl, meetingTool = '', isTeam = false }) {
  const lines = ['Add to your calendar']
  if (isTeam && meetingTool === 'microsoft') lines.push(`Outlook: ${outlookUrl}`)
  else if (isTeam && meetingTool === 'google') lines.push(`Google Calendar: ${googleUrl}`)
  else if (isTeam) {
    lines.push(`Google Calendar: ${googleUrl}`)
    lines.push(`Outlook: ${outlookUrl}`)
  }
  lines.push(`Add to calendar: ${icsUrl}`)
  return lines.join('\n')
}

function crmAddLinksHtml({ usesCrm, crmProvider, crmOther, vcfUrl }) {
  if (!usesCrm || !crmProvider) return ''
  const label =
    crmProvider === 'other'
      ? String(crmOther || 'Others').trim() || 'Others'
      : CRM_LABELS[crmProvider] || 'CRM'
  const href = CRM_APP_URLS[crmProvider] || vcfUrl
  if (!href) return ''
  const logo = CRM_LOGOS[crmProvider] || CRM_LOGOS.other
  return `
  <p style="margin:16px 0 10px;font-weight:700;">Add to your CRM</p>
  ${calendarButtonRow(href, logo, label)}`
}

function crmAddLinksText({ usesCrm, crmProvider, crmOther, vcfUrl }) {
  if (!usesCrm || !crmProvider) return ''
  const label =
    crmProvider === 'other'
      ? String(crmOther || 'Others').trim() || 'Others'
      : CRM_LABELS[crmProvider] || 'CRM'
  const href = CRM_APP_URLS[crmProvider] || vcfUrl
  if (!href) return ''
  return ['Add to your CRM', `${label}: ${href}`].join('\n')
}

function contactAddLinkHtml(vcfUrl) {
  if (!vcfUrl) return ''
  return `
  <p style="margin:16px 0 10px;font-weight:700;">Guest contact</p>
  ${calendarButtonRow(vcfUrl, '', 'Add contact')}`
}

function contactAddLinkText(vcfUrl) {
  if (!vcfUrl) return ''
  return ['Guest contact', `Add contact: ${vcfUrl}`].join('\n')
}

function buildGuestVcard({ name, email, phone, note }) {
  const esc = (v) => String(v || '').replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n')
  return [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${esc(name)}`,
    name ? `N:${esc(name)};;;;` : '',
    email ? `EMAIL;TYPE=INTERNET:${esc(email)}` : '',
    phone ? `TEL;TYPE=CELL:${esc(phone)}` : '',
    note ? `NOTE:${esc(note)}` : '',
    'END:VCARD'
  ]
    .filter(Boolean)
    .join('\r\n') + '\r\n'
}

function meetingContactVcfUrl(meetingId, token) {
  return `${CANONICAL_ORIGIN}/api/meetings/${encodeURIComponent(meetingId)}/contact.vcf?t=${encodeURIComponent(token)}`
}

function meetingInvitePayload({
  id,
  owner,
  guestName,
  guestEmail,
  guestPhone,
  message,
  preferredAt
}) {
  const ownerName = String(owner?.name || owner?.company || 'tap-na host').trim() || 'tap-na host'
  const ownerEmails = ownerNotifyEmails(owner)
  const ownerEmail = ownerEmails[0] || ''
  const location = String(owner?.address || '').trim() || 'To be confirmed'
  const title = `Meeting with ${ownerName}`
  const description = [
    message ? `Message: ${message}` : '',
    guestPhone ? `Guest phone: ${guestPhone}` : '',
    guestName ? `Guest: ${guestName}` : '',
    guestEmail ? `Guest email: ${guestEmail}` : '',
    `Booked via tap-na · ${CANONICAL_ORIGIN}/meetings`
  ]
    .filter(Boolean)
    .join('\n')
  return {
    ownerName,
    ownerEmail,
    ownerEmails,
    location,
    title,
    description,
    ics: buildMeetingIcs({
      uid: id,
      title,
      description,
      startIso: preferredAt,
      durationMinutes: 30,
      organizerName: ownerName,
      organizerEmail: ownerEmail || 'welcome@tapnam.com',
      attendeeName: guestName,
      attendeeEmail: guestEmail,
      location
    })
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
  const replyToRaw = opts.replyTo || opts.reply_to || defaultEmailReplyTo(env)
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
  const to = String(email || '').trim().toLowerCase()
  if (!isDeliverableEmail(to)) {
    return { skipped: true, reason: 'undeliverable_email' }
  }
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
    to,
    subject: 'tap-na sign-in alert',
    html,
    text
  })
}

/** Must match web app/src/lib/profileStore.js hashPassword */
function hashPassword(password) {
  let str = 'tapna|' + String(password || '')
  let hash = 2166136261
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return ('00000000' + (hash >>> 0).toString(16)).slice(-8)
}

function generateTempPassword(length = 10) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length]
  return out
}

async function sendPasswordResetEmail(env, { email, name, password }) {
  const display = String(name || '').trim() || 'there'
  const loginEmail = String(email || '').trim().toLowerCase()
  const loginUrl = `https://tapnam.com/login?email=${encodeURIComponent(loginEmail)}`
  const html = transactionalShell({
    title: 'Password reset',
    intro: `Hi ${display}, use this temporary password to sign in, then change it in Edit profile.`,
    bodyHtml: `
      <p style="margin:0 0 12px;">Your previous password cannot be emailed (it is not stored in plain text). A temporary password is set for your account:</p>
      <p style="margin:0 0 8px;"><strong>Login email:</strong> ${escapeHtml(loginEmail)}</p>
      <p style="margin:0 0 16px;"><strong>Temporary password:</strong> ${escapeHtml(String(password || ''))}</p>
      <p style="margin:0 0 12px;"><strong>Login:</strong> <a href="${loginUrl}">${escapeHtml(loginUrl)}</a></p>
      <p style="margin:0;">After you log in, open <strong>Edit profile</strong> → <strong>Change password</strong> to set a new password.</p>`,
    footerNote: 'If you did not request this, sign in with the temporary password and change it immediately.'
  })
  const text = [
    'tap-na password reset',
    '',
    `Hi ${display},`,
    'Your previous password cannot be emailed. A temporary password is set for your account:',
    '',
    `Login email: ${loginEmail}`,
    `Temporary password: ${password || ''}`,
    '',
    `Login: ${loginUrl}`,
    '',
    'After you log in, open Edit profile → Change password to set a new password.'
  ].join('\n')
  return sendCloudflareEmail(env, {
    to: loginEmail,
    subject: 'tap-na password reset',
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

function ogHtml({
  title,
  description,
  url,
  image,
  site = 'tap-na',
  type = 'website',
  imageAlt = '',
  imageWidth = '1200',
  imageHeight = '1200'
}) {
  const t = escapeHtml(title)
  const d = escapeHtml(description)
  const u = escapeHtml(url)
  const img = escapeHtml(image)
  const alt = escapeHtml(imageAlt || title)
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${t}</title>
  <meta name="description" content="${d}">
  <link rel="canonical" href="${u}">
  <meta property="og:type" content="${escapeHtml(type)}">
  <meta property="og:site_name" content="${escapeHtml(site)}">
  <meta property="og:title" content="${t}">
  <meta property="og:description" content="${d}">
  <meta property="og:url" content="${u}">
  <meta property="og:image" content="${img}">
  <meta property="og:image:secure_url" content="${img}">
  <meta property="og:image:width" content="${escapeHtml(String(imageWidth))}">
  <meta property="og:image:height" content="${escapeHtml(String(imageHeight))}">
  <meta property="og:image:alt" content="${alt}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${t}">
  <meta name="twitter:description" content="${d}">
  <meta name="twitter:image" content="${img}">
  <meta http-equiv="refresh" content="0;url=${u}">
</head>
<body>
  <p><a href="${u}">${t}</a></p>
  <img src="${img}" alt="${alt}" width="600" style="max-width:100%;height:auto;">
</body>
</html>`
}

function absolutePublicUrl(origin, src) {
  const raw = String(src || '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  if (raw.startsWith('//')) return `https:${raw}`
  const base = String(origin || 'https://tapnam.com').replace(/\/$/, '')
  return raw.startsWith('/') ? `${base}${raw}` : `${base}/${raw}`
}

function shopProductFallbackImage(productId, origin) {
  const id = String(productId || '').trim()
  const map = {
    'black-card': '/images/business_charcoal.png',
    'blue-card': '/images/professional_cobalt_blue.png',
    'black-card-front': '/images/executive_black.png',
    'table-info': '/images/table/NFC%20business%20info%20card.png',
    'table-menu': '/images/table/NFC%20-%20Menu.png',
    'table-review': '/images/table/NFC%20business%20review%20card.png',
    'table-wifi': '/images/table/NFC%20wifi%20and%20conact%20card.png',
    'table-custom': '/images/table/NFC%20custom%20menu%20card.png'
  }
  return absolutePublicUrl(origin, map[id] || '/images/tap-na_logo.png')
}

async function loadShopProductOg(env, productId) {
  const id = String(productId || '').trim()
  if (!id) return null
  const rows = await sb(
    env,
    `sales_products?id=eq.${encodeURIComponent(id)}&deleted=eq.false&select=id,name,default_price,category,active,description,images,shop_label,shop_badge&limit=1`
  )
  const row = rows?.[0]
  if (!row || row.active === false) return null
  return mapSalesProductPublic(row)
}

async function serveOgImage(env, origin, slug) {
  const cards = await sb(env, `cards?slug=eq.${encodeURIComponent(slug)}&deleted=eq.false&select=*`)
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
      path: profile.card_type === 'table' ? '/business' : (card.slug ? `/c/${encodeURIComponent(card.slug)}` : '/me'),
      blocked: true
    }
  }
  // Personal cards stay on the slug URL; table cards use /business
  if (profile.card_type === 'personal' || card.kind === 'personal') {
    const slug = String(card.slug || '').trim()
    return { path: slug ? `/c/${encodeURIComponent(slug)}` : '/me', blocked: false }
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
    if (isDeliverableEmail(email)) {
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
    const gate = await requireStaff(env, request, { roles: ['admin', 'manager'] })
    if (gate.error) return gate.error
    const body = await readJson(request)
    const email = String(body?.email || '').trim().toLowerCase()
    const password = String(body?.password || '')
    const agentId = String(body?.agentId || '').trim()
    const name = String(body?.name || '').trim()
    let role = normalizeStaffRole(body?.role) || 'sales'
    if (role === 'admin' && !isSalesElevated(gate.staff)) {
      return bad('Only admins can create admin users', 403)
    }
    if (role === 'manager' && !isSalesElevated(gate.staff)) {
      return bad('Only admins can create managers', 403)
    }
    const sendCredentialsEmail = body?.sendCredentialsEmail !== false
    if (!email) return bad('Email required')
    if ((role === 'sales' || role === 'manager') && !agentId) return bad('agentId required for sales/manager users')
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
            agent_id: role === 'sales' || role === 'manager' ? agentId : ''
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
              agent_id: role === 'sales' || role === 'manager' ? agentId : ''
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
                agent_id: role === 'sales' || role === 'manager' ? agentId : ''
              },
              user_metadata: { name: name || email }
            }
          })
          wasCreated = true
          claims = staffClaimsFromUser(created?.user || created)
        }
      }

      if ((role === 'sales' || role === 'manager') && agentId && claims?.id) {
        try {
          await upsertSalesRow(env, 'sales_agents', {
            id: agentId,
            login_email: email,
            auth_user_id: claims.id,
            access_role: role === 'manager' ? 'manager' : 'sales',
            updated_at: new Date().toISOString()
          })
        } catch {
          /* agent row may be updated by client; login still works via app_metadata */
        }
      }

      let emailSent = false
      let emailError = ''
      if ((role === 'sales' || role === 'manager') && sendCredentialsEmail && password) {
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
    const gate = await requireStaff(env, request, { roles: ['admin', 'manager', 'sales'] })
    if (gate.error) return gate.error
    const body = await readJson(request)
    const count = Math.min(500, Math.max(1, Number(body?.count) || 1))
    const kind = body?.kind === 'personal' ? 'personal' : 'table'
    const personalType =
      kind === 'personal'
        ? normalizePersonalType(body?.personalType || body?.personal_type || 'business')
        : ''
    const batchName = String(body?.name || body?.batchName || '').trim().slice(0, 80)
    let batch = null
    if (batchName) {
      const batchId = uid('batch')
      const createdAt = new Date().toISOString()
      await sb(env, 'card_batches', {
        method: 'POST',
        body: {
          id: batchId,
          name: batchName,
          kind,
          personal_type: personalType,
          created_by: gate.staff?.email || gate.staff?.id || '',
          created_at: createdAt
        },
        prefer: 'return=minimal'
      })
      batch = {
        id: batchId,
        name: batchName,
        kind,
        personalType,
        createdBy: gate.staff?.email || '',
        createdAt
      }
    }
    const created = []
    for (let i = 0; i < count; i++) {
      const id = uid('card')
      const slug = await uniqueSlug(env)
      const cardBody = {
        id,
        slug,
        kind,
        personal_type: personalType,
        product_id: body?.productId || '',
        status: 'unlinked'
      }
      if (batch?.id) cardBody.batch_id = batch.id
      await sb(env, 'cards', {
        method: 'POST',
        body: cardBody,
        prefer: 'return=minimal'
      })
      created.push({
        id,
        slug,
        kind,
        personalType,
        batchId: batch?.id || '',
        batchName: batch?.name || '',
        nfcUrl: cardPageUrl(slug, kind, url.origin),
        qrUrl: `${cardPageUrl(slug, kind, url.origin)}?via=qr`
      })
    }
    return json({ ok: true, batch, cards: created })
  }

  const cardMatch = pathname.match(/^\/api\/cards\/([^/]+)$/)
  if (cardMatch && method === 'GET') {
    const slug = decodeURIComponent(cardMatch[1])
    const cards = await sb(env, `cards?slug=eq.${encodeURIComponent(slug)}&deleted=eq.false&select=*`)
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
        personalType: card.kind === 'personal' ? normalizePersonalType(card.personal_type || 'business') : '',
        status: card.status,
        profileId: card.profile_id
      },
      profile: await publicProfile(env, profile),
      destination: destinationFor(card, profile),
      pendingTeamInvite:
        card.status === 'unlinked'
          ? await findPendingTeamInviteForCard(env, card.id)
          : null
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

    const cards = await sb(env, `cards?slug=eq.${encodeURIComponent(slug)}&deleted=eq.false&select=*`)
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
      `cards?profile_id=eq.${encodeURIComponent(profileId)}&status=eq.linked&deleted=eq.false&select=slug,kind`
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
    const cards = await sb(env, `cards?slug=eq.${encodeURIComponent(slug)}&select=id,kind,profile_id`)
    if (!cards?.length) return bad('Card not found', 404)
    const cardRow = cards[0]
    const kind =
      body?.kind !== undefined
        ? body.kind === 'personal'
          ? 'personal'
          : 'table'
        : cardRow.kind === 'personal'
          ? 'personal'
          : 'table'
    const patch = { kind }
    if (kind === 'personal') {
      patch.personal_type = normalizePersonalType(
        body?.personalType || body?.personal_type || 'business'
      )
    } else {
      patch.personal_type = ''
    }
    await sb(env, `cards?slug=eq.${encodeURIComponent(slug)}`, {
      method: 'PATCH',
      body: patch,
      prefer: 'return=minimal'
    })
    if (kind === 'personal' && patch.personal_type) {
      await syncPersonalTypeAcrossDb(env, {
        profileId: cardRow.profile_id || '',
        cardId: cardRow.id,
        personalType: patch.personal_type
      })
    }
    return json({ ok: true, slug, kind, personalType: patch.personal_type || '' })
  }

  if (pathname === '/api/cards/bulk-delete' && method === 'POST') {
    const gate = await requireStaff(env, request, { roles: ['admin'] })
    if (gate.error) return gate.error
    const body = await readJson(request)
    const raw = Array.isArray(body?.slugs) ? body.slugs : []
    const slugs = [...new Set(raw.map((s) => String(s || '').trim()).filter(Boolean))].slice(0, 500)
    if (!slugs.length) return bad('slugs required')

    const deleted = []
    const failed = []
    for (const slug of slugs) {
      try {
        const cards = await sb(env, `cards?slug=eq.${encodeURIComponent(slug)}&deleted=eq.false&select=id,slug`)
        const card = cards?.[0]
        if (!card) {
          failed.push({ slug, error: 'not found' })
          continue
        }
        await softDeleteRow(env, {
          table: 'cards',
          id: card.id,
          staff: gate.staff,
          extra: { status: 'disabled' }
        })
        deleted.push(slug)
      } catch (err) {
        failed.push({ slug, error: err?.message || 'delete failed' })
        if (!err?._logged) {
          await logAppError(env, {
            source: 'api',
            message: err?.message || 'bulk card soft-delete failed',
            stack: err?.stack || '',
            path: pathname,
            method,
            context: { slug }
          })
        }
      }
    }
    return json({ ok: true, deleted, failed, deletedCount: deleted.length, failedCount: failed.length })
  }

  const deleteMatch = pathname.match(/^\/api\/cards\/([^/]+)$/)
  if (deleteMatch && method === 'DELETE') {
    const gate = await requireStaff(env, request, { roles: ['admin'] })
    if (gate.error) return gate.error
    const slug = decodeURIComponent(deleteMatch[1])
    const cards = await sb(env, `cards?slug=eq.${encodeURIComponent(slug)}&deleted=eq.false&select=id,slug`)
    const card = cards?.[0]
    if (!card) return bad('Card not found', 404)
    await softDeleteRow(env, {
      table: 'cards',
      id: card.id,
      staff: gate.staff,
      extra: { status: 'disabled' }
    })
    return json({ ok: true, slug, deleted: true })
  }

  const cardRestoreMatch = pathname.match(/^\/api\/cards\/([^/]+)\/restore$/)
  if (cardRestoreMatch && method === 'POST') {
    const gate = await requireStaff(env, request, { roles: ['admin'] })
    if (gate.error) return gate.error
    const slug = decodeURIComponent(cardRestoreMatch[1])
    const cards = await sb(env, `cards?slug=eq.${encodeURIComponent(slug)}&select=id,status,profile_id`)
    const card = cards?.[0]
    if (!card) return bad('Card not found', 404)
    const status = card.profile_id ? 'linked' : 'unlinked'
    await restoreRow(env, {
      table: 'cards',
      id: card.id,
      extra: { status }
    })
    return json({ ok: true, slug, deleted: false, status })
  }

  // ---- Personal card teams ----
  if (pathname === '/api/me/team' && method === 'GET') {
    const profile = await getSessionProfile(env, request)
    if (!profile) return bad('Unauthorized', 401)
    if (profile.card_type === 'table') return bad('Teams are for personal cards only', 403)

    const myCardType = await getProfilePersonalType(env, profile.id)
    await claimProvisionalTeamsForProfile(env, profile)

    const memberships = await sb(
      env,
      `team_members?profile_id=eq.${encodeURIComponent(profile.id)}&deleted=eq.false&status=in.(active,invited,pending_claim)&select=*`
    )
    const teamIds = [...new Set((memberships || []).map((m) => m.team_id).filter(Boolean))]
    let team = null
    if (teamIds.length) {
      const teams = await sb(
        env,
        `teams?id=in.(${teamIds.map(encodeURIComponent).join(',')})&deleted=eq.false&select=*`
      )
      team = (teams || []).find((t) => t.owner_profile_id === profile.id) || teams?.[0] || null
    }

    const hasTeam = !!team
    const canUseTeam = canAccessTeamFeatures(myCardType, { hasTeam })
    if (!canUseTeam) {
      return json({
        ok: true,
        team: null,
        members: [],
        myRole: myCardType,
        ownerRole: '',
        packageCeiling: '',
        allowedRoles: [],
        isOwner: false,
        canManage: false,
        canUseTeam: false,
        pendingInvites: []
      })
    }

    // Team-capable card holders without a team yet get a workspace (Business / Executive).
    if (!team) {
      team = await getOrCreateOwnedTeam(env, profile)
    }

    const includeDeleted = url.searchParams.get('deleted') === '1'
    const memberQ = includeDeleted
      ? `team_members?team_id=eq.${encodeURIComponent(team.id)}&select=*&order=created_at.asc`
      : `team_members?team_id=eq.${encodeURIComponent(team.id)}&deleted=eq.false&select=*&order=created_at.asc`
    const memberRows = await sb(env, memberQ)
    const packageCeiling = resolveTeamPackageCeiling(team, memberRows || [])
    if (normalizePersonalType(team.package_ceiling || '') !== packageCeiling) {
      await sb(env, `teams?id=eq.${encodeURIComponent(team.id)}`, {
        method: 'PATCH',
        body: { package_ceiling: packageCeiling, updated_at: new Date().toISOString() },
        prefer: 'return=minimal'
      })
      team = { ...team, package_ceiling: packageCeiling }
    }
    const members = await enrichTeamMembers(env, memberRows || [])
    const myMembership =
      members.find((m) => m.profileId === profile.id && !m.deleted && m.status === 'active') ||
      members.find((m) => m.profileId === profile.id && !m.deleted) ||
      null
    const isOwner = team.owner_profile_id === profile.id
    const myRole = normalizePersonalType(myMembership?.role || myCardType || 'business')

    const pendingInvites = (memberships || [])
      .filter((m) => m.status === 'invited' || m.status === 'pending_claim')
      .map((m) => mapTeamMemberRow(m))

    return json({
      ok: true,
      team: mapTeamRow(team),
      members,
      myRole,
      ownerRole: myRole,
      packageCeiling,
      allowedRoles: assignableTeamRoles(packageCeiling),
      isOwner,
      canManage: true,
      canUseTeam: true,
      pendingInvites
    })
  }

  if (pathname === '/api/me/team' && method === 'PUT') {
    const profile = await getSessionProfile(env, request)
    if (!profile) return bad('Unauthorized', 401)
    if (profile.card_type === 'table') return bad('Teams are for personal cards only', 403)
    const body = await readJson(request)
    const team = await getOrCreateOwnedTeam(env, profile)
    if (team.owner_profile_id !== profile.id) return bad('Only the team owner can update the team', 403)

    const patch = { updated_at: new Date().toISOString() }
    if (body?.name !== undefined) {
      const name = String(body.name || '').trim().slice(0, 120)
      if (!name) return bad('Team name is required')
      patch.name = name
    }
    if (body?.shareCatalog !== undefined || body?.share_catalog !== undefined) {
      patch.share_catalog = !!(body.shareCatalog ?? body.share_catalog)
    }
    if (
      body?.meetingTool !== undefined ||
      body?.meeting_tool !== undefined ||
      body?.usesCrm !== undefined ||
      body?.uses_crm !== undefined ||
      body?.crmProvider !== undefined ||
      body?.crm_provider !== undefined ||
      body?.crmOther !== undefined ||
      body?.crm_other !== undefined
    ) {
      const integ = parseTeamIntegrationsFromBody(body)
      const meetingSpecified = body?.meetingTool !== undefined || body?.meeting_tool !== undefined
      const crmSpecified =
        body?.usesCrm !== undefined ||
        body?.uses_crm !== undefined ||
        body?.crmProvider !== undefined ||
        body?.crm_provider !== undefined ||
        body?.crmOther !== undefined ||
        body?.crm_other !== undefined
      if (meetingSpecified) {
        if (!integ.meetingOk) return bad('Choose Google Meet or Microsoft')
        patch.meeting_tool = integ.meetingTool
      }
      if (crmSpecified) {
        if (integ.usesCrm && !integ.crmOk) return bad('Choose the CRM you use')
        patch.uses_crm = integ.usesCrm
        patch.crm_provider = integ.usesCrm ? integ.crmProvider : ''
        patch.crm_other = integ.usesCrm ? integ.crmOther : ''
      }
    }
    if (Object.keys(patch).length <= 1) return bad('No changes provided')

    await sb(env, `teams?id=eq.${encodeURIComponent(team.id)}`, {
      method: 'PATCH',
      body: patch,
      prefer: 'return=minimal'
    })
    const rows = await sb(env, `teams?id=eq.${encodeURIComponent(team.id)}&select=*`)
    return json({ ok: true, team: mapTeamRow(rows?.[0] || { ...team, ...patch }) })
  }

  if (pathname === '/api/me/team/members' && method === 'POST') {
    const profile = await getSessionProfile(env, request)
    if (!profile) return bad('Unauthorized', 401)
    if (profile.card_type === 'table') return bad('Teams are for personal cards only', 403)
    const body = await readJson(request)
    const slug = String(body?.slug || '').trim()
    if (!slug) return bad('Card slug is required')

    const team = await getOrCreateOwnedTeam(env, profile)
    const isOwner = team.owner_profile_id === profile.id
    const actorMembership = await getActorTeamMembership(env, profile.id, team.id)
    const memberRows = await sb(
      env,
      `team_members?team_id=eq.${encodeURIComponent(team.id)}&deleted=eq.false&select=role`
    )
    const packageCeiling = resolveTeamPackageCeiling(team, memberRows || [])
    const actorRole = isOwner
      ? normalizePersonalType(actorMembership?.role || packageCeiling)
      : normalizePersonalType(actorMembership?.role || '')
    if (!isOwner && !actorMembership) return bad('You are not an active team member', 403)

    const cards = await sb(
      env,
      `cards?slug=eq.${encodeURIComponent(slug)}&deleted=eq.false&select=*`
    )
    const card = cards?.[0]
    if (!card) return bad('Card not found', 404)
    if (card.kind !== 'personal') return bad('Only personal cards can join a team', 400)

    const existing = await sb(
      env,
      `team_members?team_id=eq.${encodeURIComponent(team.id)}&slug=eq.${encodeURIComponent(slug)}&deleted=eq.false&status=neq.rejected&select=id&limit=1`
    )
    if (existing?.length) return bad('This card is already on the team', 409)

    const defaultRole = normalizePersonalType(
      body?.role || card.personal_type || 'business'
    )
    // Cap by Connect Teams package ceiling (highest seat), not current owner's card
    if (!assignableTeamRoles(packageCeiling).includes(defaultRole)) {
      return bad(
        `This team package only includes ${assignableTeamRoles(packageCeiling).join(', ')} roles`,
        403
      )
    }
    if (!isOwner && !canManageTeamRole(actorRole, defaultRole)) {
      return bad('You cannot assign or add this role', 403)
    }

    let inviteEmail = String(body?.email || body?.inviteEmail || '').trim().toLowerCase()
    let memberProfileId = card.profile_id || null
    let status = 'pending_claim'
    if (memberProfileId) {
      const profiles = await sb(
        env,
        `profiles?id=eq.${encodeURIComponent(memberProfileId)}&select=id,login_email,email,name,card_type`
      )
      const memberProfile = profiles?.[0]
      if (!memberProfile || memberProfile.card_type === 'table') {
        return bad('Linked profile is not a personal card account', 400)
      }
      inviteEmail =
        inviteEmail ||
        String(memberProfile.login_email || memberProfile.email || '')
          .trim()
          .toLowerCase()
      status = 'invited'
    } else if (!inviteEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)) {
      return bad('Email is required when the card is not claimed yet')
    }

    // Sync card personal type to assigned role
    await sb(env, `cards?id=eq.${encodeURIComponent(card.id)}`, {
      method: 'PATCH',
      body: { personal_type: defaultRole },
      prefer: 'return=minimal'
    })

    const memberId = uid('tmem')
    const now = new Date().toISOString()
    await sb(env, 'team_members', {
      method: 'POST',
      body: {
        id: memberId,
        team_id: team.id,
        profile_id: memberProfileId,
        card_id: card.id,
        slug,
        role: defaultRole,
        status,
        invite_email: inviteEmail,
        invited_by_profile_id: profile.id,
        invite_token: uid('tinv'),
        created_at: now,
        updated_at: now
      },
      prefer: 'return=minimal'
    })

    const ownerName = String(profile.name || profile.company || 'Team owner').trim()
    try {
      await sendTeamInviteEmail(env, {
        to: inviteEmail,
        inviteeName: '',
        teamName: team.name || 'Team',
        ownerName,
        role: defaultRole,
        slug,
        pendingClaim: status === 'pending_claim'
      })
    } catch (err) {
      await logAppError(env, {
        source: 'email',
        message: err?.message || String(err),
        stack: err?.stack || '',
        path: pathname,
        method,
        context: { kind: 'team_invite_email', memberId }
      })
    }

    return json({
      ok: true,
      member: mapTeamMemberRow({
        id: memberId,
        team_id: team.id,
        profile_id: memberProfileId,
        card_id: card.id,
        slug,
        role: defaultRole,
        status,
        invite_email: inviteEmail,
        invited_by_profile_id: profile.id,
        created_at: now,
        updated_at: now
      })
    })
  }

  const teamMemberPatchMatch = pathname.match(/^\/api\/me\/team\/members\/([^/]+)$/)
  if (teamMemberPatchMatch && method === 'PATCH') {
    const profile = await getSessionProfile(env, request)
    if (!profile) return bad('Unauthorized', 401)
    const memberId = decodeURIComponent(teamMemberPatchMatch[1])
    const body = await readJson(request)
    const restoring = body?.deleted === false || body?.action === 'restore'
    const rows = await sb(
      env,
      restoring
        ? `team_members?id=eq.${encodeURIComponent(memberId)}&select=*`
        : `team_members?id=eq.${encodeURIComponent(memberId)}&deleted=eq.false&select=*`
    )
    const member = rows?.[0]
    if (!member) return bad('Member not found', 404)

    const teams = await sb(
      env,
      `teams?id=eq.${encodeURIComponent(member.team_id)}&deleted=eq.false&select=*`
    )
    const team = teams?.[0]
    if (!team) return bad('Team not found', 404)

    const isOwner = team.owner_profile_id === profile.id
    const isSelf = member.profile_id === profile.id
    const actorMembership = await getActorTeamMembership(env, profile.id, team.id)
    const allMemberRows = await sb(
      env,
      `team_members?team_id=eq.${encodeURIComponent(team.id)}&deleted=eq.false&select=role,status,profile_id`
    )
    const packageCeiling = resolveTeamPackageCeiling(team, allMemberRows || [])
    const actorRole = isOwner
      ? normalizePersonalType(actorMembership?.role || packageCeiling)
      : normalizePersonalType(actorMembership?.role || '')

    // Accept / reject invite (self only)
    if (body?.action === 'accept' || body?.action === 'reject') {
      if (!isSelf) return bad('Only the invited person can respond', 403)
      if (!['invited', 'pending_claim'].includes(member.status)) {
        return bad('This invite is no longer pending', 409)
      }
      if (body.action === 'reject') {
        await sb(env, `team_members?id=eq.${encodeURIComponent(memberId)}`, {
          method: 'PATCH',
          body: {
            status: 'rejected',
            updated_at: new Date().toISOString()
          },
          prefer: 'return=minimal'
        })
        return json({ ok: true, id: memberId, status: 'rejected' })
      }
      await sb(env, `team_members?id=eq.${encodeURIComponent(memberId)}`, {
        method: 'PATCH',
        body: {
          status: 'active',
          joined_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          profile_id: profile.id
        },
        prefer: 'return=minimal'
      })
      return json({ ok: true, id: memberId, status: 'active' })
    }

    // Transfer ownership to another active member (current owner only)
    if (body?.action === 'transfer_ownership' || body?.action === 'make_owner') {
      if (!isOwner) return bad('Only the current team owner can transfer ownership', 403)
      if (member.deleted) return bad('Cannot transfer ownership to a removed member', 400)
      if (member.status !== 'active' || !member.profile_id) {
        return bad('New owner must be an active claimed team member', 400)
      }
      if (member.profile_id === profile.id) {
        return bad('You are already the team owner', 400)
      }
      const now = new Date().toISOString()
      const newOwnerEmail = String(member.invite_email || '').trim().toLowerCase()
      await sb(env, `teams?id=eq.${encodeURIComponent(team.id)}`, {
        method: 'PATCH',
        body: {
          owner_profile_id: member.profile_id,
          owner_email: newOwnerEmail || team.owner_email || '',
          updated_at: now
        },
        prefer: 'return=minimal'
      })
      return json({
        ok: true,
        teamId: team.id,
        ownerProfileId: member.profile_id,
        previousOwnerProfileId: profile.id
      })
    }

    // Members cannot leave after accepting
    if (body?.action === 'leave') {
      return bad('Team members cannot leave after accepting an invite', 403)
    }

    // Soft-remove member (owner or higher-tier manager)
    if (body?.deleted === true || body?.action === 'remove') {
      if (member.profile_id === team.owner_profile_id) {
        return bad('Cannot remove the team owner. Transfer ownership first.', 403)
      }
      if (!isOwner && !canManageTeamRole(actorRole, member.role)) {
        return bad('You cannot manage this member', 403)
      }
      await softDeleteRow(env, {
        table: 'team_members',
        id: memberId,
        actor: profile.login_email || profile.id,
        extra: { updated_at: new Date().toISOString() }
      })
      return json({ ok: true, id: memberId, deleted: true })
    }

    // Restore soft-removed member
    if (body?.deleted === false || body?.action === 'restore') {
      if (!isOwner && !canManageTeamRole(actorRole, member.role)) {
        return bad('You cannot restore this member', 403)
      }
      await restoreRow(env, {
        table: 'team_members',
        id: memberId,
        extra: { updated_at: new Date().toISOString() }
      })
      return json({ ok: true, id: memberId, deleted: false })
    }

    // Assign role
    if (body?.role !== undefined) {
      const nextRole = normalizePersonalType(body.role)
      if (!assignableTeamRoles(packageCeiling).includes(nextRole)) {
        return bad(
          `This team package only includes ${assignableTeamRoles(packageCeiling).join(', ')} roles`,
          403
        )
      }
      if (!isOwner && !canManageTeamRole(actorRole, member.role)) {
        return bad('You cannot manage this member', 403)
      }
      if (!isOwner && !canManageTeamRole(actorRole, nextRole)) {
        return bad('You cannot assign this role', 403)
      }
      await sb(env, `team_members?id=eq.${encodeURIComponent(memberId)}`, {
        method: 'PATCH',
        body: { role: nextRole, updated_at: new Date().toISOString() },
        prefer: 'return=minimal'
      })
      await syncPersonalTypeAcrossDb(env, {
        profileId: member.profile_id || '',
        cardId: member.card_id || '',
        personalType: nextRole
      })
      const refreshed = await sb(
        env,
        `team_members?team_id=eq.${encodeURIComponent(team.id)}&deleted=eq.false&select=role`
      )
      const ceiling = resolveTeamPackageCeiling(team, refreshed || [])
      if (ceiling !== normalizePersonalType(team.package_ceiling || '')) {
        await sb(env, `teams?id=eq.${encodeURIComponent(team.id)}`, {
          method: 'PATCH',
          body: { package_ceiling: ceiling, updated_at: new Date().toISOString() },
          prefer: 'return=minimal'
        })
      }
      return json({ ok: true, id: memberId, role: nextRole, packageCeiling: ceiling })
    }

    return bad('No changes provided')
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
      const cards = await sb(env, `cards?slug=eq.${encodeURIComponent(slug)}&deleted=eq.false&select=*`)
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

    const pendingTeamInviteForClaim = claimCard
      ? await findPendingTeamInviteForCard(env, claimCard.id)
      : null
    const claimPersonalType =
      claimCard?.kind === 'personal'
        ? normalizePersonalType(claimCard.personal_type || 'business')
        : ''
    const isTeamOwnerClaim =
      !pendingTeamInviteForClaim &&
      (claimPersonalType === 'business' || claimPersonalType === 'executive_exclusive')
    let ownerIntegrations = null
    if (isTeamOwnerClaim) {
      ownerIntegrations = parseTeamIntegrationsFromBody(body || {})
      if (!ownerIntegrations.meetingOk) return bad('Choose Google Meet or Microsoft')
      if (ownerIntegrations.usesCrm && !ownerIntegrations.crmOk) return bad('Choose the CRM you use')
    }

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
        await softDeleteRow(env, {
          table: 'profiles',
          id,
          actor: 'signup_claim_conflict',
          extra: { updated_at: new Date().toISOString() }
        })
        return bad('Card was claimed by another profile', 409)
      }
      // Attach any pending team invites for this card to the new profile
      await sb(
        env,
        `team_members?card_id=eq.${encodeURIComponent(claimCard.id)}&deleted=eq.false&status=eq.pending_claim`,
        {
          method: 'PATCH',
          body: {
            profile_id: id,
            updated_at: new Date().toISOString()
          },
          prefer: 'return=minimal'
        }
      )
    }

    const profiles = await sb(env, `profiles?id=eq.${encodeURIComponent(id)}&select=*`)
    const newProfile = profiles?.[0]
    if (newProfile) {
      try {
        await claimProvisionalTeamsForProfile(env, newProfile)
      } catch (_) {
        /* non-fatal */
      }
    }

    const pendingTeamInvite = claimCard
      ? await findPendingTeamInviteForCard(env, claimCard.id, id)
      : pendingTeamInviteForClaim
    if (ownerIntegrations && newProfile) {
      try {
        const team = await getOrCreateOwnedTeam(env, newProfile)
        if (team?.id) await applyTeamIntegrations(env, team.id, ownerIntegrations)
      } catch (err) {
        await logAppError(env, {
          source: 'team_integrations',
          message: err?.message || String(err),
          stack: err?.stack || '',
          path: pathname,
          method,
          context: { kind: 'signup_team_integrations' }
        })
      }
    }

    const token = uid('tok')
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    await sb(env, 'sessions', {
      method: 'POST',
      body: { id: uid('sess'), profile_id: id, token, expires_at: expires },
      prefer: 'return=minimal'
    })

    const pub = await publicProfile(env, newProfile || profiles?.[0], { includeCards: true })
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
    return json({ ok: true, token, profile: pub, pendingTeamInvite })
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
    try {
      await claimProvisionalTeamsForProfile(env, profile)
    } catch (_) {
      /* non-fatal */
    }
    if (isDeliverableEmail(loginEmail)) {
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
    return json({ ok: true, token, profile: await publicProfile(env, profile, { includeCards: true }) })
  }

  if (pathname === '/api/auth/forgot-password' && method === 'POST') {
    const body = await readJson(request)
    const id = String(body?.identifier || body?.email || '').trim()
    const idLower = id.toLowerCase()
    // Always return the same message to avoid account enumeration.
    const okMsg =
      'If an account exists for that email, we sent a temporary password. Log in, then change your password from Edit profile.'
    if (!id || !id.includes('@')) {
      return json({ ok: true, message: okMsg })
    }
    let profiles = await sb(
      env,
      `profiles?or=(login_email.ilike.${encodeURIComponent(idLower)},email.ilike.${encodeURIComponent(idLower)})&select=*&limit=1`
    )
    const profile = profiles?.[0]
    const loginEmail = String(profile?.login_email || profile?.email || '').trim().toLowerCase()
    if (profile && loginEmail.includes('@')) {
      const tempPassword = generateTempPassword()
      const passwordHash = hashPassword(tempPassword)
      await sb(env, `profiles?id=eq.${encodeURIComponent(profile.id)}`, {
        method: 'PATCH',
        body: { password_hash: passwordHash },
        prefer: 'return=minimal'
      })
      sendPasswordResetEmail(env, {
        email: loginEmail,
        name: profile.name || '',
        password: tempPassword
      }).catch((err) => logAppError(env, {
        source: 'email',
        message: err?.message || String(err),
        stack: err?.stack || '',
        path: pathname,
        method,
        context: { kind: 'password_reset_email' }
      }))
    }
    return json({ ok: true, message: okMsg })
  }

  if (pathname === '/api/shop/products' && method === 'GET') {
    const rows = await sb(
      env,
      'sales_products?active=eq.true&deleted=eq.false&select=id,name,default_price,category,active,description,images,video,shop_label,shop_badge,created_at,updated_at&order=name.asc'
    )
    return json({
      ok: true,
      products: (rows || []).map((row) => mapSalesProductPublic(row))
    })
  }

  if (pathname === '/api/sales/products' && method === 'GET') {
  const gate = await requireStaff(env, request, { roles: ['admin', 'manager', 'sales'] })
  if (gate.error) return gate.error
  const includeInactive = url.searchParams.get('includeInactive') !== '0'
  const includeDeleted = isSalesElevated(gate.staff) && url.searchParams.get('includeDeleted') === '1'
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
  const gate = await requireStaff(env, request, { roles: ['admin', 'manager'] })
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
  const gate = await requireStaff(env, request, { roles: ['admin', 'manager'] })
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
      shop_label: row.shop_label,
      shop_badge: row.shop_badge,
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
  const gate = await requireStaff(env, request, { roles: ['admin', 'manager'] })
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
  const gate = await requireStaff(env, request, { roles: ['admin', 'manager'] })
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
  const gate = await requireStaff(env, request, { roles: ['admin', 'manager', 'sales'] })
  if (gate.error) return gate.error
  const staff = gate.staff
  const isElevated = isSalesElevated(staff)
  const agentId = String(staff.agentId || '').trim()
  if (!isElevated && !agentId) return bad('Sales account is not linked to an agent', 403)

  const agentQ = isElevated
    ? 'sales_agents?select=*&order=name.asc&limit=1000'
    : 'sales_agents?deleted=eq.false&id=eq.' + encodeURIComponent(agentId) + '&select=*&limit=1'
  const scope = isElevated
    ? ''
    : 'deleted=eq.false&agent_id=eq.' + encodeURIComponent(agentId) + '&'
  const [agents, orders, quotes, invoices, cash] = await Promise.all([
    sb(env, agentQ),
    sb(env, 'sales_orders?' + scope + 'select=*&order=sold_at.desc&limit=2000'),
    sb(env, 'sales_quotes?' + scope + 'select=*&order=created_at.desc&limit=2000'),
    sb(env, 'sales_invoices?' + scope + 'select=*&order=issued_at.desc&limit=2000'),
    sb(env, 'sales_cashflow?' + scope + 'select=*&order=occurred_at.desc&limit=2000')
  ])
  let cashflow = (cash || []).map(mapSalesCashRow)
  if (!isElevated) {
    const orderIds = new Set((orders || []).map((o) => o.id))
    cashflow = cashflow.filter((c) => c.saleId && orderIds.has(c.saleId))
  }
  return json({
    ok: true,
    scope: isElevated ? 'all' : 'agent',
    agents: (agents || []).map(mapSalesAgentRow),
    orders: (orders || []).map(mapSalesOrderRow),
    quotes: (quotes || []).map(mapSalesQuoteRow),
    invoices: (invoices || []).map(mapSalesInvoiceRow),
    cashflow
  })
  }

  if (pathname === '/api/sales/changelog' && method === 'GET') {
  const gate = await requireStaff(env, request, { roles: ['admin', 'manager'] })
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
    const gate = await requireStaff(env, request, { roles: ['admin', 'manager', 'sales'] })
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

  // Public client error sink (no auth) so every frontend failure can be logged.
  if (pathname === '/api/client-errors' && method === 'POST') {
    const body = await readJson(request)
    await logAppError(env, {
      source: 'client',
      message: String(body?.message || 'Client error').slice(0, 4000),
      stack: String(body?.stack || '').slice(0, 8000),
      path: String(body?.path || '').slice(0, 500),
      method: String(body?.method || '').slice(0, 16),
      status: body?.status == null ? null : Number(body.status) || null,
      context: body?.context && typeof body.context === 'object' ? body.context : {}
    })
    return json({ ok: true })
  }

  if (pathname === '/api/sales/agents' && method === 'PUT') {
  const gate = await requireStaff(env, request, { roles: ['admin', 'manager'] })
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
  const gate = await requireStaff(env, request, { roles: ['admin', 'manager'] })
  if (gate.error) return gate.error
  const id = decodeURIComponent(salesAgentMatch[1])
  const existing = await sb(env, 'sales_agents?id=eq.' + encodeURIComponent(id) + '&select=*')
  const beforeRow = existing?.[0]
  if (!beforeRow) return bad('Agent not found', 404)
  // Keep Overview in sync: soft-delete this agent's sales/quotes/invoices/cash with them
  const now = new Date().toISOString()
  for (const table of ['sales_orders', 'sales_quotes', 'sales_invoices', 'sales_cashflow']) {
    const body =
      table === 'sales_cashflow'
        ? { deleted: true, deleted_at: now, deleted_by: gate.staff?.email || gate.staff?.id || 'agent-delete' }
        : {
            deleted: true,
            deleted_at: now,
            deleted_by: gate.staff?.email || gate.staff?.id || 'agent-delete',
            updated_at: now
          }
    await sb(env, `${table}?agent_id=eq.${encodeURIComponent(id)}&deleted=eq.false`, {
      method: 'PATCH',
      body,
      prefer: 'return=minimal'
    })
  }
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
  const gate = await requireStaff(env, request, { roles: ['admin', 'manager'] })
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
  const gate = await requireStaff(env, request, { roles: ['admin', 'manager', 'sales'] })
  if (gate.error) return gate.error
  const body = await readJson(request)
  const existingId = String(body?.id || '').trim()
  const existing = existingId
    ? await sb(env, 'sales_orders?id=eq.' + encodeURIComponent(existingId) + '&select=*')
    : []
  const beforeRow = existing?.[0] || null
  if (beforeRow && beforeRow.deleted === true && !isSalesElevated(gate.staff)) {
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
  const gate = await requireStaff(env, request, { roles: ['admin', 'manager', 'sales'] })
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
  const gate = await requireStaff(env, request, { roles: ['admin', 'manager', 'sales'] })
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
  const gate = await requireStaff(env, request, { roles: ['admin', 'manager', 'sales'] })
  if (gate.error) return gate.error
  const body = await readJson(request)
  const existingId = String(body?.id || '').trim()
  const existing = existingId
    ? await sb(env, 'sales_quotes?id=eq.' + encodeURIComponent(existingId) + '&select=*')
    : []
  const beforeRow = existing?.[0] || null
  if (beforeRow && beforeRow.deleted === true && !isSalesElevated(gate.staff)) {
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
  const gate = await requireStaff(env, request, { roles: ['admin', 'manager', 'sales'] })
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
  const gate = await requireStaff(env, request, { roles: ['admin', 'manager', 'sales'] })
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
  const gate = await requireStaff(env, request, { roles: ['admin', 'manager', 'sales'] })
  if (gate.error) return gate.error
  const body = await readJson(request)
  const existingId = String(body?.id || '').trim()
  const existing = existingId
    ? await sb(env, 'sales_invoices?id=eq.' + encodeURIComponent(existingId) + '&select=*')
    : []
  const beforeRow = existing?.[0] || null
  if (beforeRow && beforeRow.deleted === true && !isSalesElevated(gate.staff)) {
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
  const gate = await requireStaff(env, request, { roles: ['admin', 'manager', 'sales'] })
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
  const gate = await requireStaff(env, request, { roles: ['admin', 'manager', 'sales'] })
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
  const gate = await requireStaff(env, request, { roles: ['admin', 'manager', 'sales'] })
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
  if (beforeRow && beforeRow.deleted === true && !isSalesElevated(gate.staff)) {
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
  const gate = await requireStaff(env, request, { roles: ['admin', 'manager', 'sales'] })
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
  const gate = await requireStaff(env, request, { roles: ['admin', 'manager'] })
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

  const batchRenameMatch = pathname.match(/^\/api\/admin\/card-batches\/([^/]+)$/)
  if (batchRenameMatch && method === 'PATCH') {
    const gate = await requireStaff(env, request, { roles: ['admin', 'manager', 'sales'] })
    if (gate.error) return gate.error
    const batchId = decodeURIComponent(batchRenameMatch[1])
    const body = await readJson(request)
    const name = String(body?.name || '').trim().slice(0, 80)
    if (!name) return bad('Batch name is required')
    const rows = await sb(env, `card_batches?id=eq.${encodeURIComponent(batchId)}&select=id`)
    if (!rows?.length) return bad('Batch not found', 404)
    const updated = await sb(env, `card_batches?id=eq.${encodeURIComponent(batchId)}`, {
      method: 'PATCH',
      body: { name },
      prefer: 'return=representation'
    })
    const row = updated?.[0] || { id: batchId, name }
    return json({
      ok: true,
      batch: {
        id: row.id,
        name: row.name || name,
        kind: row.kind === 'personal' ? 'personal' : 'table',
        personalType:
          row.kind === 'personal' ? normalizePersonalType(row.personal_type || '') : '',
        createdBy: row.created_by || '',
        createdAt: row.created_at || ''
      }
    })
  }

  if (pathname === '/api/admin/deleted/purge' && method === 'POST') {
    const gate = await requireStaff(env, request, { roles: ['admin'] })
    if (gate.error) return gate.error
    // Before hard-deleting agents, soft-delete any live sales still linked to them so
    // ON DELETE SET NULL cannot leave paid orphan sales inflating Overview revenue.
    await softDeleteFinanceForDoomedAgents(env)
    const counts = {}
    let total = 0
    for (const [table, key] of DELETED_SALES_TABLES) {
      const n = await purgeDeletedSalesRows(env, table)
      counts[key] = n
      total += n
    }
    await writeSalesChangeLog(env, {
      staff: gate.staff,
      action: 'delete',
      entityType: 'deleted_records',
      entityId: 'purge',
      entityLabel: 'Deleted records',
      summary: `Permanently cleared ${total} deleted sales record(s)`,
      before: counts,
      after: { purged: total }
    })
    return json({ ok: true, purged: total, counts })
  }

  if (pathname === '/api/admin/overview' && method === 'GET') {
    const gate = await requireStaff(env, request, { roles: ['admin'] })
    if (gate.error) return gate.error
    const [profiles, cards, batches] = await Promise.all([
      sb(env, 'profiles?deleted=eq.false&select=id,card_type,name,title,company,email,phone,address,avatar,logo,disabled,created_at,updated_at&order=created_at.desc&limit=500'),
      sb(env, 'cards?select=slug,kind,personal_type,product_id,status,profile_id,linked_at,created_at,deleted,deleted_at,deleted_by,batch_id&order=created_at.desc&limit=2000'),
      sb(env, 'card_batches?select=id,name,kind,personal_type,created_by,created_at&order=created_at.desc&limit=500')
    ])
    const cardsByProfile = {}
    for (const c of cards || []) {
      if (!c.profile_id || c.deleted === true) continue
      if (!cardsByProfile[c.profile_id]) cardsByProfile[c.profile_id] = []
      cardsByProfile[c.profile_id].push(c)
    }
    const nameByProfile = {}
    for (const p of profiles || []) nameByProfile[p.id] = p.name || p.company || ''
    const mappedBatches = (batches || []).map((b) => ({
      id: b.id,
      name: b.name || '',
      kind: b.kind === 'personal' ? 'personal' : 'table',
      personalType:
        b.kind === 'personal' ? normalizePersonalType(b.personal_type || '') : '',
      createdBy: b.created_by || '',
      createdAt: b.created_at || ''
    }))
    const batchNameById = Object.fromEntries(mappedBatches.map((b) => [b.id, b.name]))
    return json({
      ok: true,
      batches: mappedBatches,
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
          personalType:
            c.kind === 'personal'
              ? normalizePersonalType(c.personal_type || 'business')
              : '',
          productId: c.product_id || '',
          status: c.status
        }))
      })),
      cards: (cards || []).map((c) => ({
        slug: c.slug,
        kind: c.kind === 'personal' ? 'personal' : 'table',
        personalType:
          c.kind === 'personal'
            ? normalizePersonalType(c.personal_type || 'business')
            : '',
        productId: c.product_id || '',
        status: c.status,
        profileId: c.profile_id || '',
        profileName: c.profile_id ? nameByProfile[c.profile_id] || '' : '',
        linkedAt: c.linked_at,
        createdAt: c.created_at,
        deleted: c.deleted === true,
        deletedAt: c.deleted_at || '',
        deletedBy: c.deleted_by || '',
        batchId: c.batch_id || '',
        batchName: c.batch_id ? batchNameById[c.batch_id] || '' : ''
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
      `cards?profile_id=eq.${encodeURIComponent(profileId)}&select=id,slug,kind,personal_type,product_id,status`
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
        slugs: (cards || []).map((c) => ({
          slug: c.slug,
          kind: c.kind === 'personal' ? 'personal' : 'table',
          personalType:
            c.kind === 'personal'
              ? normalizePersonalType(c.personal_type || 'business')
              : '',
          productId: c.product_id || '',
          status: c.status
        }))
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
      `cards?profile_id=eq.${encodeURIComponent(profileId)}&select=slug,kind,personal_type,product_id,status,linked_at&order=slug.asc`
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
          personalType:
            c.kind === 'personal'
              ? normalizePersonalType(c.personal_type || 'business')
              : '',
          productId: c.product_id || '',
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
      `cards?profile_id=eq.${encodeURIComponent(profileId)}&select=slug,kind,personal_type,product_id,status,linked_at&order=slug.asc`
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
          personalType:
            c.kind === 'personal'
              ? normalizePersonalType(c.personal_type || 'business')
              : '',
          productId: c.product_id || '',
          status: c.status,
          linkedAt: c.linked_at || null
        }))
      }
    })
  }

  if (adminProfileMatch && method === 'DELETE') {
    const gate = await requireStaff(env, request, { roles: ['admin'] })
    if (gate.error) return gate.error
    const profileId = decodeURIComponent(adminProfileMatch[1])
    try {
      const result = await hardDeleteProfile(env, profileId, gate.staff)
      if (!result) return bad('Profile not found', 404)
      return json({ ok: true, id: result.id, unlinkedSlugs: result.unlinkedSlugs || [] })
    } catch (err) {
      await logAppError(env, {
        source: 'api',
        message: err?.message || 'profile hard-delete failed',
        stack: err?.stack || '',
        path: pathname,
        method,
        context: { profileId }
      })
      return bad(err?.message || 'Could not delete profile', 500)
    }
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
    const kind = ['avatar', 'logo', 'video', 'product', 'menu', 'catalog'].includes(kindRaw)
      ? kindRaw
      : 'avatar'
    if (staff && !profile && kind !== 'product') {
      return bad('Staff uploads are limited to product media', 403)
    }
    const contentType = file.type || 'application/octet-stream'
    if (kind === 'menu' || kind === 'catalog') {
      const okType =
        contentType === 'application/pdf' ||
        contentType.startsWith('image/') ||
        /\.pdf$/i.test(String(file.name || ''))
      if (!okType) {
        return bad(
          kind === 'catalog' ? 'Catalog uploads must be a PDF or image' : 'Menu uploads must be a PDF or image',
          400
        )
      }
    }
    const maxBytes =
      kind === 'product'
        ? 20 * 1024 * 1024
        : kind === 'menu' || kind === 'catalog'
          ? 15 * 1024 * 1024
          : kind === 'video'
            ? 8 * 1024 * 1024
            : kind === 'avatar'
              ? 0
              : 3 * 1024 * 1024
    if (maxBytes > 0 && file.size > maxBytes) {
      const limitLabel =
        kind === 'product'
          ? '20 MB'
          : kind === 'menu' || kind === 'catalog'
            ? '15 MB'
            : kind === 'video'
              ? '8 MB'
              : '3 MB'
      const label =
        kind === 'video'
          ? 'Video'
          : kind === 'menu'
            ? 'Menu file'
            : kind === 'catalog'
              ? 'Catalog file'
              : 'Image'
      return bad(`${label} must be under ${limitLabel}`, 413)
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
    return json({ ok: true, profile: await publicProfile(env, profile, { includeCards: true }) })
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
    const includeDeleted = url.searchParams.get('deleted') === '1'
    let q =
      `checkins?profile_id=eq.${encodeURIComponent(profile.id)}` +
      `&select=*&order=created_at.desc&limit=500`
    if (!includeDeleted) q += '&deleted=eq.false'
    const rows = await sb(env, q)
    return json({
      ok: true,
      checkins: (rows || []).map((c) => ({
        ...c,
        deleted: c.deleted === true,
        deletedAt: c.deleted_at || '',
        deletedBy: c.deleted_by || ''
      }))
    })
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

  const venueCheckinMatch = pathname.match(/^\/api\/venue\/checkins\/([^/]+)$/)
  if (venueCheckinMatch && method === 'DELETE') {
    const profile = await getSessionProfile(env, request)
    if (!profile) return bad('Unauthorized', 401)
    const id = decodeURIComponent(venueCheckinMatch[1])
    const rows = await sb(
      env,
      `checkins?id=eq.${encodeURIComponent(id)}&profile_id=eq.${encodeURIComponent(profile.id)}&deleted=eq.false&select=id`
    )
    if (!rows?.[0]) return bad('Check-in not found', 404)
    await softDeleteRow(env, {
      table: 'checkins',
      id,
      actor: profile.email || profile.id
    })
    return json({ ok: true, id, deleted: true })
  }

  const venueCheckinRestoreMatch = pathname.match(/^\/api\/venue\/checkins\/([^/]+)\/restore$/)
  if (venueCheckinRestoreMatch && method === 'POST') {
    const profile = await getSessionProfile(env, request)
    if (!profile) return bad('Unauthorized', 401)
    const id = decodeURIComponent(venueCheckinRestoreMatch[1])
    const rows = await sb(
      env,
      `checkins?id=eq.${encodeURIComponent(id)}&profile_id=eq.${encodeURIComponent(profile.id)}&select=id`
    )
    if (!rows?.[0]) return bad('Check-in not found', 404)
    await restoreRow(env, { table: 'checkins', id })
    return json({ ok: true, id, deleted: false })
  }

  if (pathname === '/api/venue/feedback' && method === 'GET') {
    const profile = await getSessionProfile(env, request)
    if (!profile) return bad('Unauthorized', 401)
    const includeDeleted = url.searchParams.get('deleted') === '1'
    let q =
      `feedback?profile_id=eq.${encodeURIComponent(profile.id)}` +
      `&select=*&order=created_at.desc&limit=500`
    if (!includeDeleted) q += '&deleted=eq.false'
    const rows = await sb(env, q)
    return json({
      ok: true,
      feedback: (rows || []).map((f) => ({
        ...f,
        deleted: f.deleted === true,
        deletedAt: f.deleted_at || '',
        deletedBy: f.deleted_by || ''
      }))
    })
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

  const venueFeedbackMatch = pathname.match(/^\/api\/venue\/feedback\/([^/]+)$/)
  if (venueFeedbackMatch && method === 'DELETE') {
    const profile = await getSessionProfile(env, request)
    if (!profile) return bad('Unauthorized', 401)
    const id = decodeURIComponent(venueFeedbackMatch[1])
    const rows = await sb(
      env,
      `feedback?id=eq.${encodeURIComponent(id)}&profile_id=eq.${encodeURIComponent(profile.id)}&deleted=eq.false&select=id`
    )
    if (!rows?.[0]) return bad('Feedback not found', 404)
    await softDeleteRow(env, {
      table: 'feedback',
      id,
      actor: profile.email || profile.id
    })
    return json({ ok: true, id, deleted: true })
  }

  const venueFeedbackRestoreMatch = pathname.match(/^\/api\/venue\/feedback\/([^/]+)\/restore$/)
  if (venueFeedbackRestoreMatch && method === 'POST') {
    const profile = await getSessionProfile(env, request)
    if (!profile) return bad('Unauthorized', 401)
    const id = decodeURIComponent(venueFeedbackRestoreMatch[1])
    const rows = await sb(
      env,
      `feedback?id=eq.${encodeURIComponent(id)}&profile_id=eq.${encodeURIComponent(profile.id)}&select=id`
    )
    if (!rows?.[0]) return bad('Feedback not found', 404)
    await restoreRow(env, { table: 'feedback', id })
    return json({ ok: true, id, deleted: false })
  }

  if (pathname === '/api/venue/stats' && method === 'GET') {
    const profile = await getSessionProfile(env, request)
    if (!profile) return bad('Unauthorized', 401)
    const checkins = await sb(
      env,
      `checkins?profile_id=eq.${encodeURIComponent(profile.id)}&deleted=eq.false&select=guests`
    )
    const fb = await sb(
      env,
      `feedback?profile_id=eq.${encodeURIComponent(profile.id)}&deleted=eq.false&select=rating`
    )
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
    const pageName = String(row.name || row.company || '').trim() || 'This person'
    const shared = await resolveSharedCatalogForProfile(env, profileId)
    if (shared) {
      return json({
        ok: true,
        profileId: row.id,
        catalogOwnerId: shared.catalogOwnerId,
        shared: true,
        sharedFromName: shared.sharedFromName,
        teamName: shared.teamName,
        ownerName: pageName,
        catalogItems: shared.catalogItems
      })
    }
    const items = normalizeCatalogItems(row.catalog_items).filter((x) => x.active !== false)
    return json({
      ok: true,
      profileId: row.id,
      catalogOwnerId: row.id,
      shared: false,
      ownerName: pageName,
      catalogItems: items
    })
  }

  const catalogCartSubmitMatch = pathname.match(/^\/api\/profiles\/([^/]+)\/catalog-cart$/)
  if (catalogCartSubmitMatch && method === 'POST') {
    const pageProfileId = decodeURIComponent(catalogCartSubmitMatch[1])
    const body = await readJson(request)
    const shared = await resolveSharedCatalogForProfile(env, pageProfileId)

    // Quotes always go to the scanned card's profile (team member), not the catalog owner.
    const pageRows = await sb(
      env,
      `profiles?id=eq.${encodeURIComponent(pageProfileId)}&select=id,name,company,email,login_email,disabled,catalog_items`
    )
    const recipient = pageRows?.[0]
    if (!recipient) return bad('Profile not found', 404)
    if (recipient.disabled) return bad('This profile is disabled', 403)

    const catalogItems = shared
      ? shared.catalogItems
      : normalizeCatalogItems(recipient.catalog_items).filter((x) => x.active !== false)

    const name = String(body?.name || '').trim().slice(0, 120)
    const email = String(body?.email || '').trim().toLowerCase().slice(0, 200)
    const phone = String(body?.phone || '').trim().slice(0, 40)
    const note = String(body?.note || '').trim().slice(0, 2000)
    const action = String(body?.action || 'quote').trim().toLowerCase()
    const status =
      action === 'meeting' ? 'meeting_booked' : action === 'interest' ? 'open' : 'quote_requested'
    const cartItems = normalizeCatalogCartItems(body?.items)

    if (!name) return bad('Name is required')
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad('Valid email is required')
    if (!cartItems.length) return bad('Cart is empty')

    const allowedIds = new Set(catalogItems.map((x) => x.id).filter(Boolean))
    if (allowedIds.size && cartItems.some((l) => l.id && !String(l.id).startsWith('item_') && !allowedIds.has(l.id))) {
      return bad('One or more cart items are not available', 400)
    }

    const id = uid('pcart')
    const now = new Date().toISOString()
    await sb(env, 'profile_catalog_carts', {
      method: 'POST',
      body: {
        id,
        profile_id: pageProfileId,
        visitor_name: name,
        visitor_email: email,
        visitor_phone: phone,
        items: cartItems,
        note,
        status,
        source: shared ? 'team_shared_catalog' : 'catalog',
        created_at: now,
        updated_at: now
      },
      prefer: 'return=minimal'
    })

    const recipientName =
      String(recipient.name || recipient.company || 'tap-na host').trim() || 'tap-na host'
    const recipientEmail = String(recipient.login_email || recipient.email || '')
      .trim()
      .toLowerCase()
    const money = (n) =>
      n === null || n === undefined
        ? 'Quote'
        : 'N$ ' + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    const subtotal = Math.round(
      cartItems.reduce((s, l) => s + (Number(l.price) || 0) * l.qty, 0) * 100
    ) / 100
    const linesHtml = cartItems
      .map(
        (l) =>
          `<tr style="border-bottom:1px solid #eee;"><td style="padding:8px 0;">${escapeHtml(l.name)}</td><td style="padding:8px 0;">${l.qty}</td><td style="padding:8px 0;text-align:right;">${escapeHtml(money(l.price))}</td></tr>`
      )
      .join('')
    const linesText = cartItems
      .map((l) => `${l.name} × ${l.qty}${l.price != null ? ` @ ${money(l.price)}` : ''}`)
      .join('\n')

    const quoteRef = id.replace('pcart_', 'CQ-').toUpperCase()
    const subject =
      status === 'meeting_booked'
        ? `Catalog meeting interest ${quoteRef} — ${name}`
        : `Catalog quote ${quoteRef} — ${name}`

    try {
      const sends = []
      sends.push(
        sendCloudflareEmail(env, {
          to: email,
          replyTo: recipientEmail.includes('@') ? recipientEmail : undefined,
          subject:
            status === 'meeting_booked'
              ? `Your interest with ${recipientName}`
              : `Your quote request for ${recipientName}`,
          html: transactionalShell({
            title: status === 'meeting_booked' ? 'Interest received' : 'Quote request sent',
            intro: `Hi ${name}, ${recipientName} has received your catalog request.`,
            bodyHtml: `
              <table style="width:100%;border-collapse:collapse;font-size:14px;margin:0 0 12px;">${linesHtml}</table>
              <p style="margin:0 0 8px;"><strong>Estimated total:</strong> ${escapeHtml(money(subtotal || null))}</p>
              ${note ? `<p style="margin:0 0 8px;"><strong>Your note:</strong> ${escapeHtml(note)}</p>` : ''}
              <p style="margin:12px 0 0;">They will follow up by email${phone ? ' or phone' : ''}.</p>`,
            footerNote: 'Sent via tap-na catalog.'
          }),
          text: [
            `Request for ${recipientName}`,
            linesText,
            `Estimated total: ${money(subtotal || null)}`,
            note ? `Note: ${note}` : ''
          ]
            .filter(Boolean)
            .join('\n')
        })
      )
      if (recipientEmail.includes('@')) {
        sends.push(
          sendCloudflareEmail(env, {
            to: recipientEmail,
            replyTo: email,
            subject,
            html: transactionalShell({
              title: status === 'meeting_booked' ? 'Catalog meeting interest' : 'New catalog quote request',
              intro: `${name} submitted items from your card catalog${shared ? ` (team catalog from ${shared.sharedFromName})` : ''}.`,
              bodyHtml: `
                <p style="margin:0 0 8px;"><strong>Guest:</strong> ${escapeHtml(name)}</p>
                <p style="margin:0 0 8px;"><strong>Email:</strong> ${escapeHtml(email)}</p>
                <p style="margin:0 0 8px;"><strong>Phone:</strong> ${escapeHtml(phone || '—')}</p>
                <table style="width:100%;border-collapse:collapse;font-size:14px;margin:12px 0;">${linesHtml}</table>
                <p style="margin:0 0 8px;"><strong>Estimated total:</strong> ${escapeHtml(money(subtotal || null))}</p>
                ${note ? `<p style="margin:0 0 8px;"><strong>Note:</strong> ${escapeHtml(note)}</p>` : ''}
                <p style="margin:12px 0 0;"><a href="https://tapnam.com/catalog-cart">Open catalog cart inbox</a></p>`,
              footerNote: 'Reply to this email to contact the guest.'
            }),
            text: [
              subject,
              `Guest: ${name}`,
              `Email: ${email}`,
              `Phone: ${phone || '—'}`,
              linesText,
              note ? `Note: ${note}` : '',
              'Open: https://tapnam.com/catalog-cart'
            ]
              .filter(Boolean)
              .join('\n')
          })
        )
      }
      await Promise.all(
        sends.map((p) =>
          p.catch((err) =>
            logAppError(env, {
              source: 'email',
              message: err?.message || String(err),
              stack: err?.stack || '',
              path: pathname,
              method,
              context: { kind: 'catalog_cart_email', cartId: id }
            })
          )
        )
      )
    } catch (err) {
      await logAppError(env, {
        source: 'email',
        message: err?.message || String(err),
        stack: err?.stack || '',
        path: pathname,
        method,
        context: { kind: 'catalog_cart_email_build', cartId: id }
      })
    }

    return json({ ok: true, id, status, quoteRef })
  }

  if (pathname === '/api/me/catalog-carts' && method === 'GET') {
    const profile = await getSessionProfile(env, request)
    if (!profile) return bad('Unauthorized', 401)
    const includeDeleted = url.searchParams.get('deleted') === '1'
    let q =
      `profile_catalog_carts?profile_id=eq.${encodeURIComponent(profile.id)}` +
      `&select=*&order=created_at.desc&limit=200`
    if (!includeDeleted) q += '&deleted=eq.false'
    const rows = await sb(env, q)
    return json({ ok: true, carts: (rows || []).map(mapCatalogCartRow) })
  }

  const catalogCartPatchMatch = pathname.match(/^\/api\/me\/catalog-carts\/([^/]+)$/)
  if (catalogCartPatchMatch && method === 'PATCH') {
    const profile = await getSessionProfile(env, request)
    if (!profile) return bad('Unauthorized', 401)
    const cartId = decodeURIComponent(catalogCartPatchMatch[1])
    const body = await readJson(request)
    const existing = await sb(
      env,
      `profile_catalog_carts?id=eq.${encodeURIComponent(cartId)}&profile_id=eq.${encodeURIComponent(profile.id)}&select=id,status,deleted`
    )
    if (!existing?.[0]) return bad('Not found', 404)
    const patch = { updated_at: new Date().toISOString() }
    if (body?.status !== undefined) {
      const st = String(body.status || '').trim().toLowerCase()
      if (!['open', 'quote_requested', 'meeting_booked', 'closed'].includes(st)) {
        return bad('Invalid status')
      }
      patch.status = st
    }
    if (body?.deleted === true) {
      patch.deleted = true
      patch.deleted_at = new Date().toISOString()
      patch.deleted_by = profile.email || profile.id || ''
    }
    if (body?.deleted === false) {
      patch.deleted = false
      patch.deleted_at = null
      patch.deleted_by = ''
    }
    await sb(env, `profile_catalog_carts?id=eq.${encodeURIComponent(cartId)}`, {
      method: 'PATCH',
      body: patch,
      prefer: 'return=minimal'
    })
    return json({ ok: true, id: cartId })
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
  if (pathname === '/api/connections' && method === 'POST') {
    const body = await readJson(request)
    const profileId = String(body?.profileId || body?.profile_id || '').trim()
    if (!profileId) return bad('profileId required')
    const connectionId = String(body?.connectionId || body?.connection_id || '').trim()
    const channelRaw = String(body?.shareChannel || body?.share_channel || '').trim().toLowerCase()
    const shareChannel = channelRaw === 'whatsapp' || channelRaw === 'sms' ? channelRaw : ''

    if (connectionId) {
      if (!shareChannel) return bad('shareChannel required')
      const rows = await sb(
        env,
        `profile_connections?id=eq.${encodeURIComponent(connectionId)}&profile_id=eq.${encodeURIComponent(profileId)}&deleted=eq.false&select=id,share_channel&limit=1`
      )
      if (!rows?.[0]) return bad('Connection not found', 404)
      await sb(env, `profile_connections?id=eq.${encodeURIComponent(connectionId)}`, {
        method: 'PATCH',
        body: { share_channel: shareChannel },
        prefer: 'return=minimal'
      })
      return json({ ok: true, connection: { id: connectionId, shareChannel } })
    }

    const guestName = String(body?.name || '').trim().slice(0, 160)
    if (!guestName) return bad('Name is required')
    const guestPhone = String(body?.phone || '').trim().slice(0, 80)
    const guestEmail = String(body?.email || '').trim().toLowerCase().slice(0, 160)
    const guestCompany = String(body?.company || '').trim().slice(0, 160)
    await ensureProfileStub(env, profileId, guestName)
    const id = uid('conn')
    const now = new Date().toISOString()
    await sb(env, 'profile_connections', {
      method: 'POST',
      body: {
        id,
        profile_id: profileId,
        name: guestName,
        phone: guestPhone,
        email: guestEmail,
        company: guestCompany,
        share_channel: shareChannel,
        created_at: now,
        deleted: false
      },
      prefer: 'return=minimal'
    })
    return json({
      ok: true,
      connection: {
        id,
        profileId,
        name: guestName,
        phone: guestPhone,
        email: guestEmail,
        company: guestCompany,
        shareChannel,
        createdAt: now
      }
    })
  }

  if (pathname === '/api/connections' && method === 'GET') {
    const profile = await getSessionProfile(env, request)
    if (!profile) return bad('Unauthorized', 401)
    const rows = await sb(
      env,
      'profile_connections?profile_id=eq.' +
        encodeURIComponent(profile.id) +
        '&deleted=eq.false&order=created_at.desc&limit=500'
    )
    const connections = (rows || []).map((row) => ({
      id: row.id,
      profileId: row.profile_id,
      name: row.name || '',
      phone: row.phone || '',
      email: row.email || '',
      company: row.company || '',
      shareChannel: row.share_channel || '',
      createdAt: row.created_at || ''
    }))
    return json({ ok: true, connections })
  }

  const connectionDeleteMatch = pathname.match(/^\/api\/connections\/([^/]+)$/)
  if (connectionDeleteMatch && method === 'DELETE') {
    const profile = await getSessionProfile(env, request)
    if (!profile) return bad('Unauthorized', 401)
    const connectionId = decodeURIComponent(connectionDeleteMatch[1])
    const rows = await sb(
      env,
      `profile_connections?id=eq.${encodeURIComponent(connectionId)}&profile_id=eq.${encodeURIComponent(profile.id)}&deleted=eq.false&select=id&limit=1`
    )
    if (!rows?.[0]) return bad('Contact not found', 404)
    await softDeleteRow(env, {
      table: 'profile_connections',
      id: connectionId,
      actor: profile.login_email || profile.email || profile.id
    })
    return json({ ok: true, id: connectionId, deleted: true })
  }

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
      const invite = meetingInvitePayload({
        id,
        owner,
        guestName: name,
        guestEmail: email,
        guestPhone: phone,
        message,
        preferredAt
      })
      const { ownerName, ownerEmail, ownerEmails, location, title, description } = invite
      const icsAttachment = meetingInviteAttachment(invite.ics)
      const whenLabel = new Date(preferredAt).toUTCString()
      const whenHtml = escapeHtml(whenLabel)
      const token = await meetingInviteToken(env, id)
      const teamInteg = await teamIntegrationsForProfile(env, profileId)
      const isTeam = !!teamInteg?.id
      const meetingTool = String(teamInteg?.meetingTool || '').trim().toLowerCase()
      const calendarLinks = {
        googleUrl: googleCalendarUrl({
          title,
          details: description,
          location,
          startIso: preferredAt
        }),
        outlookUrl: outlookCalendarUrl(),
        icsUrl: meetingInviteIcsUrl(id, token),
        isTeam,
        meetingTool
      }
      const calendarHtml = calendarAddLinksHtml(calendarLinks)
      const calendarText = calendarAddLinksText(calendarLinks)
      const vcfUrl = isTeam ? meetingContactVcfUrl(id, token) : ''
      const crmHtml = crmAddLinksHtml({
        usesCrm: !!teamInteg?.usesCrm,
        crmProvider: teamInteg?.crmProvider || '',
        crmOther: teamInteg?.crmOther || '',
        vcfUrl
      })
      const crmText = crmAddLinksText({
        usesCrm: !!teamInteg?.usesCrm,
        crmProvider: teamInteg?.crmProvider || '',
        crmOther: teamInteg?.crmOther || '',
        vcfUrl
      })
      const contactHtml = contactAddLinkHtml(vcfUrl)
      const contactText = contactAddLinkText(vcfUrl)
      const hostEmails = ownerEmails.length ? ownerEmails : uniqueEmails('welcome@tapnam.com')
      const guestReplyTo = ownerEmail || hostEmails[0]
      const sends = []

      // Guest confirmation + calendar invite
      sends.push(
        sendCloudflareEmail(env, {
          to: email,
          replyTo: guestReplyTo,
          subject: `Meeting request with ${ownerName}`,
          html: transactionalShell({
            title: 'Meeting request sent',
            intro: `Hi ${name}, your meeting request with ${ownerName} is in.`,
            bodyHtml: `
              <p style="margin:0 0 8px;"><strong>When (UTC):</strong> ${whenHtml}</p>
              <p style="margin:0 0 8px;"><strong>Host:</strong> ${escapeHtml(ownerName)}</p>
              ${message ? `<p style="margin:0 0 8px;"><strong>Your note:</strong> ${escapeHtml(message)}</p>` : ''}
              ${calendarHtml}`,
            footerNote: 'If the time does not work, reply to this email to reschedule.'
          }),
          text: [
            `Meeting request with ${ownerName}`,
            `When (UTC): ${whenLabel}`,
            message ? `Note: ${message}` : '',
            '',
            calendarText
          ]
            .filter((line, i, arr) => line !== '' || arr[i - 1] !== '')
            .join('\n'),
          attachments: [icsAttachment]
        })
      )

      // Host notification + calendar invite (profile email + login email)
      sends.push(
          sendCloudflareEmail(env, {
            to: hostEmails,
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
                ${calendarHtml}
                ${crmHtml}
                ${contactHtml}
                <p style="margin:12px 0 0;"><a href="${CANONICAL_ORIGIN}/meetings">Open Meetings</a></p>`,
              footerNote: 'Confirm or follow up from your Meetings tab.'
            }),
            text: [
              `New meeting request from ${name}`,
              `When (UTC): ${whenLabel}`,
              `Email: ${email}`,
              `Phone: ${phone || '—'}`,
              message ? `Message: ${message}` : '',
              '',
              calendarText,
              crmText ? `\n${crmText}` : '',
              contactText ? `\n${contactText}` : '',
              '',
              `Open: ${CANONICAL_ORIGIN}/meetings`
            ]
              .filter((line, i, arr) => line !== '' || arr[i - 1] !== '')
              .join('\n'),
            attachments: [icsAttachment]
          })
        )

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

  const meetingInviteMatch = pathname.match(/^\/api\/meetings\/([^/]+)\/invite\.ics$/)
  if (meetingInviteMatch && method === 'GET') {
    const meetingId = decodeURIComponent(meetingInviteMatch[1])
    const token = String(url.searchParams.get('t') || '').trim()
    const expected = await meetingInviteToken(env, meetingId)
    if (!tokensMatch(token, expected)) return bad('Invite not found', 404)

    const rows = await sb(env, 'meetings?id=eq.' + encodeURIComponent(meetingId) + '&select=*')
    const meeting = rows?.[0]
    if (!meeting || meeting.deleted === true) return bad('Invite not found', 404)
    if (String(meeting.status || '').toLowerCase() === 'cancelled') {
      return bad('This meeting was cancelled', 410)
    }
    if (!meeting.preferred_at) return bad('Invite not found', 404)

    const owners = await sb(
      env,
      'profiles?id=eq.' + encodeURIComponent(meeting.profile_id) + '&select=*'
    )
    const invite = meetingInvitePayload({
      id: meeting.id,
      owner: owners?.[0],
      guestName: meeting.name || '',
      guestEmail: meeting.email || '',
      guestPhone: meeting.phone || '',
      message: meeting.message || '',
      preferredAt: meeting.preferred_at
    })
    return new Response(invite.ics, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="meeting-invite.ics"',
        'Cache-Control': 'private, max-age=300',
        ...CORS_HEADERS
      }
    })
  }

  const meetingVcfMatch = pathname.match(/^\/api\/meetings\/([^/]+)\/contact\.vcf$/)
  if (meetingVcfMatch && method === 'GET') {
    const meetingId = decodeURIComponent(meetingVcfMatch[1])
    const token = String(url.searchParams.get('t') || '').trim()
    const expected = await meetingInviteToken(env, meetingId)
    if (!tokensMatch(token, expected)) return bad('Contact not found', 404)

    const rows = await sb(env, 'meetings?id=eq.' + encodeURIComponent(meetingId) + '&select=*')
    const meeting = rows?.[0]
    if (!meeting || meeting.deleted === true) return bad('Contact not found', 404)

    const vcf = buildGuestVcard({
      name: meeting.name || '',
      email: meeting.email || '',
      phone: meeting.phone || '',
      note: meeting.preferred_at
        ? `Meeting via tap-na · ${meeting.preferred_at}`
        : 'Meeting via tap-na'
    })
    return new Response(vcf, {
      status: 200,
      headers: {
        'Content-Type': 'text/vcard; charset=utf-8',
        'Content-Disposition': 'attachment; filename="contact.vcf"',
        'Cache-Control': 'private, max-age=300',
        ...CORS_HEADERS
      }
    })
  }

  if (pathname === '/api/meetings' && method === 'GET') {
    const profile = await getSessionProfile(env, request)
    if (!profile) return bad('Unauthorized', 401)
    const rows = await sb(
      env,
      'meetings?profile_id=eq.' + encodeURIComponent(profile.id) + '&deleted=eq.false&order=created_at.desc&limit=500'
    )
    return json({ ok: true, meetings: rows || [] })
  }

  if (pathname === '/api/meetings/stats' && method === 'GET') {
    const profile = await getSessionProfile(env, request)
    if (!profile) return bad('Unauthorized', 401)
    const meetings = await sb(
      env,
      'meetings?profile_id=eq.' + encodeURIComponent(profile.id) + '&deleted=eq.false&status=eq.new&select=id'
    )
    const followups = await sb(
      env,
      'followups?profile_id=eq.' + encodeURIComponent(profile.id) + '&deleted=eq.false&status=eq.open&select=id,due_at'
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
      'followups?profile_id=eq.' + encodeURIComponent(profile.id) + '&deleted=eq.false&order=due_at.asc.nullslast&limit=500'
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
      'followups?id=eq.' + encodeURIComponent(followupId) + '&profile_id=eq.' + encodeURIComponent(profile.id) + '&deleted=eq.false&select=id'
    )
    if (!existing?.length) return bad('Follow-up not found', 404)
    await softDeleteRow(env, {
      table: 'followups',
      id: followupId,
      actor: profile.email || profile.id,
      extra: { updated_at: new Date().toISOString() }
    })
    return json({ ok: true, id: followupId, deleted: true })
  }

  const followupRestoreMatch = pathname.match(/^\/api\/followups\/([^/]+)\/restore$/)
  if (followupRestoreMatch && method === 'POST') {
    const profile = await getSessionProfile(env, request)
    if (!profile) return bad('Unauthorized', 401)
    const followupId = decodeURIComponent(followupRestoreMatch[1])
    const existing = await sb(
      env,
      'followups?id=eq.' +
        encodeURIComponent(followupId) +
        '&profile_id=eq.' +
        encodeURIComponent(profile.id) +
        '&select=id'
    )
    if (!existing?.length) return bad('Follow-up not found', 404)
    await restoreRow(env, {
      table: 'followups',
      id: followupId,
      extra: { updated_at: new Date().toISOString() }
    })
    return json({ ok: true, id: followupId, deleted: false })
  }

  if (pathname === '/api/shop/order-quote' && method === 'POST') {
    const body = await readJson(request)
    const name = String(body?.name || '').trim()
    const company = String(body?.company || '').trim().slice(0, 160)
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

    const quoteRefRaw = String(body?.quoteRef || '').trim()
    const quoteRef = /^SQ-[A-Z0-9]+$/i.test(quoteRefRaw)
      ? quoteRefRaw.toUpperCase()
      : `SQ-${Date.now().toString(36).toUpperCase()}`
    const salesCopyTo = 'sales@tapnam.com'
    const from = defaultEmailFrom(env)
    const subject = `Quote ${quoteRef} — ${name}`
    const issued = new Date().toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
    let validUntilLabel = ''
    const validUntilRaw = body?.validUntil || body?.valid_until
    if (validUntilRaw) {
      const d = new Date(validUntilRaw)
      if (!Number.isNaN(d.getTime())) {
        validUntilLabel = d.toLocaleDateString('en-GB', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      }
    }
    if (!validUntilLabel) {
      validUntilLabel = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    }
    const origin = 'https://tapnam.com'
    const logoUrl = `${origin}/images/tap-na_logo.png`
    const banking = {
      accountHolder: 'AUCKMUND INVESTMENT CC',
      accountType: 'GOLD BUSINESS ACCOUNT',
      accountNumber: '64292796992',
      branchCode: '282273',
      swiftCode: 'FIRNNANX'
    }

    const uniqueIds = []
    for (const l of lines) {
      if (l.id && !uniqueIds.includes(l.id)) uniqueIds.push(l.id)
    }
    const imageUrls = []
    for (const id of uniqueIds.slice(0, 6)) {
      let src = ''
      try {
        const product = await loadShopProductOg(env, id)
        const first = Array.isArray(product?.images) ? product.images.find(Boolean) : ''
        src = absolutePublicUrl(origin, first || '') || shopProductFallbackImage(id, origin)
      } catch {
        src = shopProductFallbackImage(id, origin)
      }
      if (src) imageUrls.push(src)
    }
    const imagesHtml = imageUrls.length
      ? `<div style="margin:0 0 16px;line-height:0;">${imageUrls
          .map(
            (src) =>
              `<img src="${escapeHtml(src)}" alt="" width="72" height="72" style="display:inline-block;width:72px;height:72px;object-fit:cover;margin:0 8px 0 0;border:1px solid #eee;vertical-align:top;" />`
          )
          .join('')}</div>`
      : ''

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

    const billToAddress = [company, town].filter(Boolean).join(', ') || town
    const buddyAmt = (Math.round(subtotal * 100) / 100).toFixed(2)
    const buddyPayUrl =
      subtotal > 0
        ? `https://payment.buddy.na?business=3227&amount=${encodeURIComponent(buddyAmt)}&reference=${encodeURIComponent(quoteRef)}`
        : ''
    const buddyHtml = buddyPayUrl
      ? `<p style="margin:16px 0 0;font-size:14px;"><a href="${escapeHtml(buddyPayUrl)}" style="color:#0a7;font-weight:700;">Pay with Buddy</a></p>
  <p style="margin:4px 0 0;font-size:12px;color:#666;word-break:break-all;">${escapeHtml(buddyPayUrl)}</p>`
      : ''

    const bankingHtml = `
  <div style="margin:16px 0 0;font-size:13px;line-height:1.6;">
    <div><span style="color:#777;">Account Name</span> ${escapeHtml(banking.accountHolder)}</div>
    <div><span style="color:#777;">Account Type</span> ${escapeHtml(banking.accountType)}</div>
    <div><span style="color:#777;">Account Number</span> ${escapeHtml(banking.accountNumber)}</div>
    <div><span style="color:#777;">Branch Code</span> ${escapeHtml(banking.branchCode)}</div>
    <div><span style="color:#777;">Swift Code</span> ${escapeHtml(banking.swiftCode)}</div>
  </div>`.trim()

    const html = `
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;color:#111;line-height:1.5;max-width:560px;margin:0 auto;padding:24px;">
  <div style="text-align:right;margin:0 0 28px;">
    <img src="${escapeHtml(logoUrl)}" alt="tap-na" width="96" style="display:inline-block;max-width:96px;height:auto;margin:0 0 8px;" />
    <div style="font-size:13px;color:#555;line-height:1.45;">
      Auckmund Investment CC<br>
      Erf: 62, Hosea Kutako Drive, Windhoek North<br>
      +264 85 811 7337 | welcome@tapnam.com
    </div>
  </div>
  <h2 style="font-size:18px;margin:0 0 4px;font-weight:700;">Quote ${escapeHtml(quoteRef)}</h2>
  <p style="margin:0 0 4px;color:#555;font-size:13px;">Issued ${escapeHtml(issued)}</p>
  <p style="margin:0 0 16px;color:#555;font-size:13px;">Valid until ${escapeHtml(validUntilLabel)}</p>
  <p style="margin:0 0 4px;"><strong>Bill to</strong></p>
  <p style="margin:0 0 16px;">
    ${escapeHtml(name)}<br>
    ${escapeHtml(email)}<br>
    ${escapeHtml(billToAddress)}
  </p>
  ${imagesHtml}
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
  <p style="font-size:15px;font-weight:700;margin:0 0 6px;">Quoted total: ${escapeHtml(money(subtotal))}</p>
  <p style="font-size:13px;margin:0 0 16px;">Payment method: eft</p>
  ${bankingHtml}
  ${buddyHtml}
</body>
</html>`.trim()

    const text = [
      'tap-na',
      'Auckmund Investment CC',
      'Erf: 62, Hosea Kutako Drive, Windhoek North',
      '+264 85 811 7337 | welcome@tapnam.com',
      '',
      `Quote ${quoteRef}`,
      `Issued ${issued}`,
      `Valid until ${validUntilLabel}`,
      '',
      'Bill to',
      name,
      email,
      billToAddress,
      '',
      ...lines.map((l) => `${l.name} × ${l.qty} @ ${money(l.price)} = ${money(l.lineTotal)}`),
      '',
      `Quoted total: ${money(subtotal)}`,
      'Payment method: eft',
      '',
      `Account Name ${banking.accountHolder}`,
      `Account Type ${banking.accountType}`,
      `Account Number ${banking.accountNumber}`,
      `Branch Code ${banking.branchCode}`,
      `Swift Code ${banking.swiftCode}`,
      ...(buddyPayUrl ? ['', `Pay with Buddy: ${buddyPayUrl}`] : [])
    ]
      .filter((line, i, arr) => line !== '' || arr[i - 1] !== '')
      .join('\n')

    const pdfLines = [
      'Auckmund Investment CC',
      'Erf: 62, Hosea Kutako Drive, Windhoek North',
      '+264 85 811 7337 | welcome@tapnam.com',
      '',
      `Quote ${quoteRef}`,
      `Issued ${issued}`,
      `Valid until ${validUntilLabel}`,
      '',
      'Bill to',
      name,
      email,
      billToAddress,
      '',
      'Item / Qty / Unit / Total',
      ...lines.map((l) => `${l.name}  ${l.qty}  ${money(l.price)}  ${money(l.lineTotal)}`),
      '',
      `Quoted total: ${money(subtotal)}`,
      'Payment method: eft',
      '',
      `Account Name ${banking.accountHolder}`,
      `Account Type ${banking.accountType}`,
      `Account Number ${banking.accountNumber}`,
      `Branch Code ${banking.branchCode}`,
      `Swift Code ${banking.swiftCode}`,
      ...(buddyPayUrl ? ['', `Pay with Buddy: ${buddyPayUrl}`] : [])
    ].filter(Boolean)
    const clientPdf = body?.pdf || body?.pdfAttachment || null
    const clientPdfContent = String(clientPdf?.content || '').replace(/\s+/g, '')
    const clientPdfName = String(clientPdf?.filename || `${quoteRef}.pdf`)
      .trim()
      .slice(0, 120)
      .replace(/[^\w.\-]+/g, '_')
    const pdfAttachment =
      clientPdfContent.length > 100
        ? {
            filename: clientPdfName.endsWith('.pdf') ? clientPdfName : `${quoteRef}.pdf`,
            content: clientPdfContent,
            type: 'application/pdf',
            contentType: 'application/pdf'
          }
        : {
            filename: `${quoteRef}.pdf`,
            content: buildSimplePdfBase64(`Quote ${quoteRef}`, pdfLines),
            type: 'application/pdf',
            contentType: 'application/pdf'
          }

    const recipients = [email, salesCopyTo].filter((v, i, arr) => arr.indexOf(v) === i)

    // Persist into sales_quotes so admin Sales can assign agents, convert → invoice, etc.
    const salesLines = lines.map((l) => ({
      productId: '',
      productName: l.name,
      quantity: l.qty,
      unitPrice: l.price,
      amount: l.lineTotal
    }))
    const primary = salesLines[0] || {
      productId: '',
      productName: 'Shop order',
      quantity: 1,
      unitPrice: subtotal,
      amount: subtotal
    }
    const productNameSummary =
      salesLines.length === 1
        ? primary.productName
        : salesLines.map((l) => `${l.productName} × ${l.quantity}`).join(', ')
    const qtySummary = salesLines.reduce((s, l) => s + (Number(l.quantity) || 0), 0) || 1
    let validUntilIso = null
    if (validUntilRaw) {
      const d = new Date(validUntilRaw)
      if (!Number.isNaN(d.getTime())) validUntilIso = d.toISOString()
    }
    if (!validUntilIso) {
      validUntilIso = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    }
    const noteParts = [
      '[Shop checkout]',
      company ? `Company: ${company}` : '',
      town ? `Town: ${town}` : '',
      note || ''
    ].filter(Boolean)
    const quoteId = `quote-shop-${quoteRef}`
    const existingShopQuotes = await sb(
      env,
      'sales_quotes?quote_number=eq.' + encodeURIComponent(quoteRef) + '&select=id,created_at&limit=1'
    )
    const existingShop = existingShopQuotes?.[0] || null
    const salesQuoteRow = {
      id: existingShop?.id || quoteId,
      quote_number: quoteRef,
      agent_id: null,
      customer_name: name,
      customer_phone: phone,
      customer_email: email,
      customer_address: [company, town].filter(Boolean).join(', ') || town,
      product_id: null,
      product_name: productNameSummary.slice(0, 500),
      quantity: Math.max(1, qtySummary),
      unit_price: salesLines.length === 1 ? primary.unitPrice : 0,
      amount: subtotal,
      status: 'sent',
      valid_until: validUntilIso,
      notes: noteParts.join('\n').slice(0, 4000),
      sale_id: '',
      email_status: 'pending',
      emailed_at: null,
      lines: salesLines,
      updated_at: new Date().toISOString(),
      created_at: existingShop?.created_at || new Date().toISOString()
    }
    try {
      await upsertSalesRow(env, 'sales_quotes', salesQuoteRow)
      await writeSalesChangeLog(env, {
        staff: { id: 'shop', name: 'Shop checkout', email: email, role: 'system' },
        action: existingShop ? 'update' : 'create',
        entityType: 'quote',
        entityId: salesQuoteRow.id,
        entityLabel: quoteRef,
        summary: `${existingShop ? 'Updated' : 'Created'} shop quote: ${quoteRef} — ${name}`,
        before: existingShop,
        after: salesQuoteRow
      })
    } catch (err) {
      await logAppError(env, {
        source: 'shop_quote_persist',
        message: err?.message || String(err),
        stack: err?.stack || '',
        path: pathname,
        method,
        context: { kind: 'sales_quotes', quoteRef }
      })
    }

    let provisionedTeam = null
    try {
      provisionedTeam = await provisionTeamFromShopQuote(env, {
        name,
        company,
        email,
        quoteRef,
        lines
      })
    } catch (err) {
      await logAppError(env, {
        source: 'shop_team_provision',
        message: err?.message || String(err),
        stack: err?.stack || '',
        path: pathname,
        method,
        context: { kind: 'team_from_quote', quoteRef }
      })
    }
    try {
      const sent = await sendCloudflareEmail(env, {
        from,
        to: recipients,
        replyTo: email,
        subject,
        html,
        text,
        attachments: [pdfAttachment]
      })
      try {
        await upsertSalesRow(env, 'sales_quotes', {
          ...salesQuoteRow,
          email_status: 'sent',
          emailed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      } catch {
        /* best-effort email status */
      }
      return json({
        ok: true,
        id: sent.id || '',
        quoteRef,
        quoteId: salesQuoteRow.id,
        // Client-facing only — sales@ is also notified but not shown in the UI
        to: [email],
        email,
        provider: sent.provider,
        pdfAttached: true,
        team: provisionedTeam
          ? {
              id: provisionedTeam.teamId,
              packageCeiling: provisionedTeam.packageCeiling,
              businessQty: provisionedTeam.businessQty,
              executiveQty: provisionedTeam.executiveQty
            }
          : null
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

  if (pathname === '/api/shop/support' && method === 'POST') {
    const body = await readJson(request)
    const name = String(body?.name || '').trim().slice(0, 120)
    const email = String(body?.email || '').trim().toLowerCase().slice(0, 160)
    const phone = String(body?.phone || '').trim().slice(0, 40)
    const subjectIn = String(body?.subject || '').trim().slice(0, 160)
    const message = String(body?.message || '').trim().slice(0, 4000)

    if (!name) return bad('Name is required')
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad('Valid email is required')
    if (message.length < 10) return bad('Message is required')

    const companyTo = 'welcome@tapnam.com'
    const from = defaultEmailFrom(env)
    const subject = subjectIn
      ? `Support: ${subjectIn} — ${name}`
      : `Support message from ${name}`

    const html = `
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;color:#111;line-height:1.5;max-width:560px;margin:0 auto;padding:24px;">
  <h1 style="font-size:20px;margin:0 0 4px;">tap-na support</h1>
  <p style="margin:0 0 20px;color:#555;font-size:13px;">Submitted from the online shop support form</p>
  <p style="margin:0 0 4px;"><strong>From</strong></p>
  <p style="margin:0 0 16px;">
    ${escapeHtml(name)}<br>
    ${escapeHtml(email)}
    ${phone ? `<br>${escapeHtml(phone)}` : ''}
  </p>
  ${subjectIn ? `<p style="margin:0 0 8px;"><strong>Subject:</strong> ${escapeHtml(subjectIn)}</p>` : ''}
  <p style="margin:0 0 4px;"><strong>Message</strong></p>
  <p style="margin:0;white-space:pre-wrap;">${escapeHtml(message)}</p>
</body>
</html>`.trim()

    const text = [
      'tap-na support form',
      '',
      `Name: ${name}`,
      `Email: ${email}`,
      phone ? `Phone: ${phone}` : '',
      subjectIn ? `Subject: ${subjectIn}` : '',
      '',
      message
    ]
      .filter(Boolean)
      .join('\n')

    try {
      const sent = await sendCloudflareEmail(env, {
        from,
        to: [companyTo],
        replyTo: email,
        subject,
        html,
        text
      })
      return json({
        ok: true,
        id: sent.id || '',
        provider: sent.provider
      })
    } catch (err) {
      if (!err?._logged) {
        await logAppError(env, {
          source: 'email',
          message: err?.message || 'Support email send failed',
          stack: err?.stack || '',
          path: pathname,
          method,
          status: err?.status || 502,
          context: { kind: 'support_email' },
          actor: null
        })
      }
      return bad(err?.message || 'Email send failed', err?.status || 502)
    }
  }

  if (pathname === '/api/email/send' && method === 'POST') {
    const gate = await requireStaff(env, request, { roles: ['admin', 'manager', 'sales'] })
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
    const gate = await requireStaff(env, request, { roles: ['admin', 'manager', 'sales'] })
    // Allow unauthenticated test only when explicitly enabled via secret flag — skip; staff preferred
    // For deploy verification, also allow with matching internal test key
    const body = await readJson(request)
    const testKey = String(body?.testKey || '').trim()
    const expectedKey = String(env.EMAIL_TEST_KEY || '').trim()
    const allowed = !gate.error || (testKey && expectedKey && testKey === expectedKey)
    if (!allowed) return gate.error || bad('Unauthorized', 401)

    const to = String(body?.to || 'welcome@tapnam.com').trim().toLowerCase()
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

    const profileManifestMatch = url.pathname.match(/^\/c\/([^/]+)\/manifest\.webmanifest$/)
    if (
      profileManifestMatch &&
      request.method === 'GET' &&
      env.SUPABASE_URL &&
      env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      const slug = decodeURIComponent(profileManifestMatch[1])
      try {
        const cards = await sb(
          env,
          `cards?slug=eq.${encodeURIComponent(slug)}&deleted=eq.false&select=profile_id,kind,status`
        )
        const card = cards?.[0]
        if (!card?.profile_id || String(card.status || '').toLowerCase() === 'disabled') {
          return new Response('Not found', { status: 404 })
        }
        const profiles = await sb(
          env,
          `profiles?id=eq.${encodeURIComponent(card.profile_id)}&select=name,title,company,avatar,disabled,card_type`
        )
        const profile = profiles?.[0]
        if (!profile || profile.disabled || profile.card_type === 'table') {
          return new Response('Not found', { status: 404 })
        }
        const displayName = String(profile.name || 'Contact').trim() || 'Contact'
        const shortName = (displayName.split(/\s+/)[0] || displayName).slice(0, 12)
        const startUrl = `/c/${encodeURIComponent(slug)}`
        let iconUrl = absolutePublicUrl(url.origin, profile.avatar)
        if (!iconUrl || iconUrl.startsWith('data:')) {
          iconUrl = absolutePublicUrl(url.origin, '/personal.jpeg')
        }
        const manifest = {
          id: startUrl,
          name: displayName,
          short_name: shortName,
          description:
            [profile.title, profile.company].filter(Boolean).join(' · ') ||
            `${displayName} on tap-na`,
          start_url: startUrl,
          scope: startUrl,
          display: 'standalone',
          background_color: '#121212',
          theme_color: '#121212',
          icons: [
            { src: iconUrl, sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: iconUrl, sizes: '512x512', type: 'image/png', purpose: 'any' }
          ]
        }
        return new Response(JSON.stringify(manifest), {
          status: 200,
          headers: {
            'Content-Type': 'application/manifest+json; charset=utf-8',
            'Cache-Control': 'public, max-age=300',
            ...CORS_HEADERS
          }
        })
      } catch {
        return new Response('Not found', { status: 404 })
      }
    }

    const productTap = url.pathname.match(/^\/product\/([^/]+)\/?$/)
    if (
      productTap &&
      request.method === 'GET' &&
      isCrawler(request.headers.get('User-Agent') || '') &&
      env.SUPABASE_URL &&
      env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      const productId = decodeURIComponent(productTap[1])
      try {
        const product = await loadShopProductOg(env, productId)
        const shareUrl = `${url.origin}/product/${encodeURIComponent(productId)}`
        const title = product?.name
          ? `${product.name} — tap-na`
          : 'tap-na Connect card'
        const price =
          product && Number(product.price) > 0
            ? `N$ ${Number(product.price).toLocaleString(undefined, {
                maximumFractionDigits: 2
              })}`
            : ''
        const descBits = [
          product?.label || '',
          price,
          String(product?.desc || '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 140)
        ].filter(Boolean)
        const description =
          descBits.join(' · ') ||
          'NFC Connect business card on tap-na. Once-off purchase. Free delivery in Windhoek.'
        const image =
          absolutePublicUrl(url.origin, product?.image || product?.images?.[0] || '') ||
          shopProductFallbackImage(productId, url.origin)

        return new Response(
          ogHtml({
            title,
            description,
            url: shareUrl,
            image,
            type: 'product',
            imageAlt: product?.name || 'tap-na Connect card',
            imageWidth: '1200',
            imageHeight: '1600'
          }),
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
            context: { kind: 'product_crawler_og', productId }
          })
        }
        /* fall through to SPA */
      }
    }

    const tap = url.pathname.match(/^\/c\/([^/]+)\/?$/)
    if (tap && request.method === 'GET' && env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
      const slug = decodeURIComponent(tap[1])
      const ua = request.headers.get('User-Agent') || ''

      // Social crawlers get Open Graph HTML with the profile photo (WhatsApp, etc.)
      if (isCrawler(ua)) {
        try {
          const cards = await sb(env, `cards?slug=eq.${encodeURIComponent(slug)}&deleted=eq.false&select=*`)
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
            ogHtml({
              title,
              description,
              url: shareUrl,
              image,
              type: 'profile',
              imageAlt: `${title} profile picture`,
              imageWidth: '400',
              imageHeight: '400'
            }),
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
      } catch (err) {
        if (!err?._logged) {
          await logAppError(env, {
            source: 'card_open',
            message: err?.message || String(err),
            stack: err?.stack || '',
            path: url.pathname,
            method: 'GET',
            context: { kind: 'record_card_activity', slug }
          })
        }
      }
    }

    if (env.ASSETS) return serveStatic(request, env)
    return new Response('tap-na worker online', { status: 200 })
  }
}