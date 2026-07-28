/**
 * tap-na Worker — API + SPA on redirct.link
 * Database: Supabase Postgres (PostgREST via service_role)
 */

const SLUG_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const TABLE_ORIGIN = 'https://redirct.link'
const PERSONAL_ORIGIN = 'https://cards.redirct.link'
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
}

function publicOriginForKind(kind, requestOrigin = TABLE_ORIGIN) {
  if (kind === 'personal') return PERSONAL_ORIGIN
  // Prefer the request origin for table so www/apex stay consistent
  try {
    const host = new URL(requestOrigin).hostname
    if (host === 'cards.redirct.link') return TABLE_ORIGIN
  } catch {
    /* ignore */
  }
  return requestOrigin || TABLE_ORIGIN
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

async function sb(env, path, { method = 'GET', body, prefer } = {}) {
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
    throw new Error(msg)
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
  return {
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
  }
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
    avatar: row.avatar,
    logo: row.logo,
    video: row.video,
    disabled: !!row.disabled,
    shareSlug
  }
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
    return json({ ok: true, service: 'tap-na', domain: 'redirct.link', db: 'supabase' })
  }

  if (pathname === '/api/staff/login' && method === 'POST') {
    const body = await readJson(request)
    const email = String(body?.email || '').trim().toLowerCase()
    const password = String(body?.password || '')
    if (!email || !password) return bad('Email and password required')
    try {
      await ensureDefaultStaffAdmin(env)
    } catch (err) {
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
    if (!email) return bad('Email required')
    if (role === 'sales' && !agentId) return bad('agentId required for sales users')
    if (!password && !body?.authUserId) return bad('Password required for new login')

    try {
      let userId = String(body?.authUserId || '').trim()
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
        return json({
          ok: true,
          user: staffClaimsFromUser(updated?.user || updated)
        })
      }

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
        return json({
          ok: true,
          user: staffClaimsFromUser(updated?.user || { ...existing, ...patch, id: existing.id, email })
        })
      }

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
      return json({
        ok: true,
        user: staffClaimsFromUser(created?.user || created)
      })
    } catch (err) {
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
    return json({ ok: true, token, profile: await publicProfile(env, profiles?.[0]) })
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
    return json({ ok: true, token, profile: await publicProfile(env, profile) })
  }

  if (pathname === '/api/shop/products' && method === 'GET') {
    const rows = await sb(
      env,
      'sales_products?active=eq.true&select=id,name,default_price,category,active,description,images,video,created_at,updated_at&order=name.asc'
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
    const filter = includeInactive ? '' : 'active=eq.true&'
    const rows = await sb(
      env,
      `sales_products?${filter}select=id,name,default_price,category,active,description,images,video,created_at,updated_at&order=name.asc`
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
    await sb(env, 'sales_products', {
      method: 'POST',
      body: row,
      prefer: 'return=representation'
    })
    const saved = await sb(
      env,
      `sales_products?id=eq.${encodeURIComponent(row.id)}&select=id,name,default_price,category,active,description,images,video,created_at,updated_at`
    )
    return json({ ok: true, product: mapSalesProductRow(saved?.[0] || row) })
  }

  const salesProductMatch = pathname.match(/^\/api\/sales\/products\/([^/]+)$/)
  if (salesProductMatch && method === 'PUT') {
    const gate = await requireStaff(env, request, { roles: ['admin'] })
    if (gate.error) return gate.error
    const id = decodeURIComponent(salesProductMatch[1])
    const body = await readJson(request)
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
      `sales_products?id=eq.${encodeURIComponent(id)}&select=id,name,default_price,category,active,description,images,video,created_at,updated_at`
    )
    if (!saved?.[0]) return bad('Product not found', 404)
    return json({ ok: true, product: mapSalesProductRow(saved[0]) })
  }

  if (salesProductMatch && method === 'DELETE') {
    const gate = await requireStaff(env, request, { roles: ['admin'] })
    if (gate.error) return gate.error
    const id = decodeURIComponent(salesProductMatch[1])
    await sb(env, `sales_products?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      prefer: 'return=minimal'
    })
    return json({ ok: true, id })
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
    await sb(env, 'checkins', {
      method: 'POST',
      body: {
        id,
        profile_id: profileId,
        venue: body.venue || '',
        name: body.name || '',
        contact: body.contact || '',
        event: body.event || 'General visit',
        guests: Math.max(1, Number(body.guests) || 1)
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
    await sb(env, 'feedback', {
      method: 'POST',
      body: {
        id,
        profile_id: profileId,
        venue: body.venue || '',
        name: body.name || 'Anonymous',
        contact: body.contact || '',
        rating: Math.min(5, Math.max(0, Number(body.rating) || 0)),
        message: body.message || ''
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

  if (pathname === '/api/shop/order-quote' && method === 'POST') {
    const apiKey = env.RESEND_API_KEY
    if (!apiKey) return bad('Email is not configured (missing RESEND_API_KEY)', 500)

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
    const from = env.RESEND_FROM || 'tap-na <noreply@no-reply.auckmund.com>'
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
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to: toList,
        reply_to: email,
        subject,
        html,
        text
      })
    })
    const resendData = await resendRes.json().catch(() => ({}))
    if (!resendRes.ok) {
      const detail =
        resendData?.message ||
        resendData?.error?.message ||
        (typeof resendData?.error === 'string' ? resendData.error : null) ||
        `Resend HTTP ${resendRes.status}`
      return bad(detail, resendRes.status >= 400 && resendRes.status < 600 ? resendRes.status : 502)
    }

    return json({
      ok: true,
      id: resendData?.id || '',
      quoteRef,
      to: toList
    })
  }

  if (pathname === '/api/email/send' && method === 'POST') {
    const gate = await requireStaff(env, request, { roles: ['admin', 'sales'] })
    if (gate.error) return gate.error
    const apiKey = env.RESEND_API_KEY
    if (!apiKey) return bad('Email is not configured (missing RESEND_API_KEY)', 500)

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
    const fromDefault = env.RESEND_FROM || 'tap-na <noreply@no-reply.auckmund.com>'
    const from = String(body?.from || fromDefault).trim() || fromDefault

    if (!toList.length) return bad('to is required')
    if (!subject) return bad('subject is required')
    if (!html && !text) return bad('html or text is required')

    const rawAttachments = Array.isArray(body?.attachments) ? body.attachments : []
    const attachments = []
    for (const item of rawAttachments.slice(0, 5)) {
      const filename = String(item?.filename || '').trim().slice(0, 120)
      const content = String(item?.content || '').replace(/\s+/g, '')
      if (!filename || !content) continue
      // ~4.5MB base64 ≈ 3.3MB binary — keep Worker payloads bounded
      if (content.length > 6_000_000) {
        return bad(`Attachment too large: ${filename}`, 413)
      }
      const att = { filename, content }
      if (item?.content_id) att.content_id = String(item.content_id).slice(0, 80)
      attachments.push(att)
    }

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to: toList,
        subject,
        ...(html ? { html } : {}),
        ...(text ? { text } : {}),
        ...(attachments.length ? { attachments } : {})
      })
    })
    const resendData = await resendRes.json().catch(() => ({}))
    if (!resendRes.ok) {
      const detail =
        resendData?.message ||
        resendData?.error?.message ||
        (typeof resendData?.error === 'string' ? resendData.error : null) ||
        `Resend HTTP ${resendRes.status}`
      return bad(detail, resendRes.status >= 400 && resendRes.status < 600 ? resendRes.status : 502)
    }
    return json({
      ok: true,
      id: resendData?.id || '',
      emailId: resendData?.id || '',
      to: toList
    })
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

    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(request, env, url)
      } catch (err) {
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