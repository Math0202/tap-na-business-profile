/**
 * tap-na API client — talks to the Worker backend on redirct.link.
 * Same-origin in production; falls back to https://redirct.link in local dev.
 * All calls fail soft so the app keeps working offline (localStorage fallback).
 */

const TOKEN_KEY = 'tapna.apiToken'

export const API_BASE =
  typeof window !== 'undefined' && /redirct\.link$/i.test(window.location.hostname)
    ? ''
    : 'https://redirct.link'

export function getApiToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

export function setApiToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

async function request(path, { method = 'GET', body, timeoutMs = 8000 } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const headers = { 'Content-Type': 'application/json' }
    const token = getApiToken()
    if (token) headers.Authorization = `Bearer ${token}`
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, status: res.status, error: data?.error || `HTTP ${res.status}`, data }
    }
    return { ok: true, status: res.status, data }
  } catch (err) {
    return { ok: false, status: 0, error: err?.message || 'Network error' }
  } finally {
    clearTimeout(timer)
  }
}

// ---- Cards ----

/** Resolve a card slug: returns { card, profile, destination } or null */
export async function apiResolveCard(slug) {
  const res = await request(`/api/cards/${encodeURIComponent(slug)}`)
  return res.ok ? res.data : null
}

/** Log an open (tap/scan) for analytics */
export function apiLogCardOpen(slug, via = '') {
  return request(`/api/cards/${encodeURIComponent(slug)}/open`, {
    method: 'POST',
    body: { via }
  })
}

/** Link a card to a profile */
export function apiClaimCard(slug, { profileId, kind } = {}) {
  return request(`/api/cards/${encodeURIComponent(slug)}/claim`, {
    method: 'POST',
    body: { profileId, kind }
  })
}

/** Unlink a card from its profile (admin) */
export function apiUnlinkCard(slug) {
  return request(`/api/cards/${encodeURIComponent(slug)}/unlink`, { method: 'POST' })
}

/** Delete a card entirely (admin) */
export function apiDeleteCard(slug) {
  return request(`/api/cards/${encodeURIComponent(slug)}`, { method: 'DELETE' })
}

/** Change a card's kind (admin) */
export function apiUpdateCardKind(slug, kind) {
  return request(`/api/cards/${encodeURIComponent(slug)}`, {
    method: 'PATCH',
    body: { kind }
  })
}

/** Provision a batch of blank cards (admin) */
export function apiProvisionCards({ count = 1, kind = 'table', productId = '' } = {}) {
  return request('/api/cards/provision', {
    method: 'POST',
    body: { count, kind, productId }
  })
}

// ---- Auth / profile ----

export async function apiSignup(payload) {
  const res = await request('/api/auth/signup', { method: 'POST', body: payload })
  if (res.ok && res.data?.token) setApiToken(res.data.token)
  return res
}

export async function apiLogin(payload) {
  const res = await request('/api/auth/login', { method: 'POST', body: payload })
  if (res.ok && res.data?.token) setApiToken(res.data.token)
  return res
}

export function apiGetMe() {
  return request('/api/me')
}

/**
 * Ensure we have a live API session token. If the token is missing/stale but the
 * user has stored login credentials (email/phone + passwordHash), silently
 * re-authenticate so authenticated calls (uploads, profile save) keep working.
 * Returns true when a usable token is available afterwards.
 */
export async function ensureApiSession() {
  if (getApiToken()) return true
  let profile
  try {
    const mod = await import('./profileStore')
    profile = mod.loadProfile()
  } catch {
    return false
  }
  const identifier = profile?.loginEmail || profile?.email || profile?.loginPhone || profile?.phone
  const passwordHash = profile?.passwordHash
  if (!identifier || !passwordHash) return false
  const res = await apiLogin({ identifier, passwordHash })
  return !!(res.ok && getApiToken())
}

// ---- Shop ----

/** Public shop catalog from Supabase via Worker */
export function apiShopProducts() {
  return request('/api/shop/products', { timeoutMs: 10000 })
}

// ---- Admin ----

/** All profiles + all cards (slugs) straight from the backend */
export function apiAdminOverview() {
  return request('/api/admin/overview', { timeoutMs: 12000 })
}


/** Upload an image/video to the Supabase "assets bucket" via the Worker */
export async function apiUploadAsset(file, { kind = "avatar" } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30000)
  try {
    const form = new FormData()
    form.append("file", file)
    form.append("kind", kind)
    const headers = {}
    const token = getApiToken()
    if (token) headers.Authorization = `Bearer ${token}`
    const res = await fetch(`${API_BASE}/api/upload`, {
      method: "POST",
      headers,
      body: form,
      signal: controller.signal
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, status: res.status, error: data?.error || `HTTP ${res.status}`, data }
    }
    return { ok: true, status: res.status, data }
  } catch (err) {
    return { ok: false, status: 0, error: err?.message || "Network error" }
  } finally {
    clearTimeout(timer)
  }
}

export function apiUpdateMe(profile) {
  return request('/api/me', { method: 'PUT', body: profile })
}

// ---- Venue customer data ----

export function apiSubmitCheckin(payload) {
  return request('/api/venue/checkins', { method: 'POST', body: payload })
}

export function apiSubmitFeedback(payload) {
  return request('/api/venue/feedback', { method: 'POST', body: payload })
}

export function apiListCheckins() {
  return request('/api/venue/checkins')
}

export function apiListFeedback() {
  return request('/api/venue/feedback')
}

export function apiVenueStats() {
  return request('/api/venue/stats')
}
