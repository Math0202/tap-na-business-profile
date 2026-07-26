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
    googleReview: row.google_review,
    checkInUrl: row.check_in_url,
    feedbackUrl: row.feedback_url,
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
    return Response.redirect(raw, 302)
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

  if (pathname === '/api/cards/provision' && method === 'POST') {
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
    const cards = await sb(env, `cards?slug=eq.${encodeURIComponent(slug)}&select=id`)
    const card = cards?.[0]
    if (!card) return bad('Card not found', 404)
    const body = await readJson(request)
    const via = String(body?.via || url.searchParams.get('via') || '').toLowerCase()
    const channel = via === 'qr' ? 'qr' : 'nfc'
    const ua = request.headers.get('User-Agent') || ''
    const { device, browser } = parseUa(ua)
    const openId = uid('open')
    await sb(env, 'card_opens', {
      method: 'POST',
      body: {
        id: openId,
        card_id: card.id,
        slug,
        channel,
        user_agent: ua.slice(0, 400),
        device_type: device,
        browser,
        ip_country: request.cf?.country || ''
      },
      prefer: 'return=minimal'
    })
    return json({ ok: true, openId, channel, device, browser })
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
      'shop_products?active=eq.true&select=id,name,price,description,image_path,image_url,alt,section,badge,label,sort_order&order=section.asc,sort_order.asc'
    )
    return json({
      ok: true,
      products: (rows || []).map((row) => ({
        id: row.id,
        name: row.name,
        price: Number(row.price),
        desc: row.description || '',
        image: row.image_url || '',
        alt: row.alt || row.name || '',
        section: row.section,
        badge: row.badge || '',
        label: row.label || '',
        sortOrder: row.sort_order ?? 0
      }))
    })
  }

  if (pathname === '/api/admin/overview' && method === 'GET') {
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

  if (pathname === '/api/upload' && method === 'POST') {
    const profile = await getSessionProfile(env, request)
    if (!profile) return bad('Unauthorized', 401)

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
    const kind = ['avatar', 'logo', 'video'].includes(kindRaw) ? kindRaw : 'avatar'
    const contentType = file.type || 'application/octet-stream'
    const maxBytes = kind === 'video' ? 8 * 1024 * 1024 : 3 * 1024 * 1024
    if (file.size > maxBytes) {
      return bad(kind === 'video' ? 'Video must be under 8 MB' : 'Image must be under 3 MB', 413)
    }

    const extFromName = String(file.name || '').split('.').pop() || ''
    const extFromType = contentType.includes('/') ? contentType.split('/')[1].split(';')[0] : ''
    const ext = (extFromName || extFromType || 'bin').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'bin'
    const path = `profiles/${profile.id}/${kind}-${Date.now()}.${ext}`
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
        card_type: body.cardType === 'table' ? 'table' : 'personal',
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
        google_review: body.googleReview ?? profile.google_review,
        check_in_url: body.checkInUrl ?? profile.check_in_url,
        feedback_url: body.feedbackUrl ?? profile.feedback_url,
        avatar: body.avatar ?? profile.avatar,
        logo: body.logo ?? profile.logo,
        video: body.video ?? profile.video,
        disabled: body.disabled ? true : false,
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

  return bad('Not found', 404)
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
          const image = `${url.origin}/api/og/${encodeURIComponent(slug)}.jpg`
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
        const cards = await sb(env, `cards?slug=eq.${encodeURIComponent(slug)}&select=id`)
        const card = cards?.[0]
        if (card) {
          const via = String(url.searchParams.get('via') || '').toLowerCase()
          const channel = via === 'qr' ? 'qr' : 'nfc'
          const { device, browser } = parseUa(ua)
          await sb(env, 'card_opens', {
            method: 'POST',
            body: {
              id: uid('open'),
              card_id: card.id,
              slug,
              channel,
              user_agent: ua.slice(0, 400),
              device_type: device,
              browser,
              ip_country: request.cf?.country || ''
            },
            prefer: 'return=minimal'
          })
        }
      } catch {
        /* non-fatal */
      }
    }

    if (env.ASSETS) return env.ASSETS.fetch(request)
    return new Response('tap-na worker online', { status: 200 })
  }
}