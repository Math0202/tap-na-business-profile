/**
 * tap-na API client — talks to the Worker backend on tapnam.com.
 * Same-origin in production; falls back to https://tapnam.com in local dev.
 * All calls fail soft so the app keeps working offline (localStorage fallback).
 */

import { getStaffAccessToken } from './staffAuth'

const TOKEN_KEY = 'tapna.apiToken'

export const API_BASE =
  typeof window !== 'undefined' && /(^|\.)(tapnam\.com|redirct\.link)$/i.test(window.location.hostname)
    ? ''
    : 'https://tapnam.com'

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

function authTokenFor(path) {
  const staffPaths =
    path.startsWith('/api/staff') ||
    path.startsWith('/api/admin') ||
    path.startsWith('/api/sales/') ||
    path === '/api/cards/provision' ||
    path === '/api/cards/bulk-delete' ||
    path === '/api/email/send' ||
    /\/api\/cards\/[^/]+\/unlink$/.test(path) ||
    (path.startsWith('/api/cards/') && !path.includes('/open') && !path.includes('/event') && !path.includes('/claim'))
  if (staffPaths) {
    const staff = getStaffAccessToken()
    if (staff) return staff
  }
  return getApiToken()
}

function shouldReportClientError(path) {
  // Log every API failure path except error sinks (avoid recursion).
  if (!path) return false
  if (path.startsWith('/api/admin/errors') || path.startsWith('/api/client-errors')) return false
  return path.startsWith('/api/')
}

function fireClientErrorReport({ path, method, status, message, stack, context }) {
  try {
    const headers = { 'Content-Type': 'application/json' }
    const token = authTokenFor('/api/admin/errors')
    // Prefer authenticated admin errors when staff is logged in; otherwise public sink.
    const endpoint = token ? '/api/admin/errors' : '/api/client-errors'
    if (token) headers.Authorization = `Bearer ${token}`
    fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        source: 'client',
        message: String(message || 'Client request failed').slice(0, 4000),
        stack: String(stack || '').slice(0, 8000),
        path: String(path || ''),
        method: String(method || ''),
        status: status == null ? null : Number(status) || null,
        context: context && typeof context === 'object' ? context : {}
      })
    }).catch(() => {})
  } catch {
    /* ignore */
  }
}

async function request(path, { method = 'GET', body, timeoutMs = 8000 } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const headers = { 'Content-Type': 'application/json' }
    const token = authTokenFor(path)
    if (token) headers.Authorization = `Bearer ${token}`
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      const skipExpected =
        (res.status === 401 || res.status === 403 || res.status === 404) &&
        (path.startsWith('/api/staff/login') ||
          path.startsWith('/api/auth/login') ||
          path.startsWith('/api/cards/') && path.includes('/claim'))
      if (shouldReportClientError(path) && !skipExpected && res.status >= 400) {
        fireClientErrorReport({
          path,
          method,
          status: res.status,
          message: data?.error || `HTTP ${res.status}`,
          context: { kind: 'api_http_error' }
        })
      }
      return { ok: false, status: res.status, error: data?.error || `HTTP ${res.status}`, data }
    }
    return { ok: true, status: res.status, data }
  } catch (err) {
    if (shouldReportClientError(path)) {
      fireClientErrorReport({
        path,
        method,
        status: 0,
        message: err?.message || 'Network error',
        stack: err?.stack || '',
        context: { kind: 'api_network_error' }
      })
    }
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

/** Log a click / share / other profile event */
export function apiLogCardEvent(slug, action, via = '') {
  return request(`/api/cards/${encodeURIComponent(slug)}/event`, {
    method: 'POST',
    body: { action, via }
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

/** Soft-delete a card (admin) */
export function apiDeleteCard(slug) {
  return request(`/api/cards/${encodeURIComponent(slug)}`, { method: 'DELETE' })
}

/** Restore a soft-deleted card (admin) */
export function apiRestoreCard(slug) {
  return request(`/api/cards/${encodeURIComponent(slug)}/restore`, { method: 'POST', timeoutMs: 12000 })
}

/** Bulk-delete cards by slug (admin) */
export function apiBulkDeleteCards(slugs = []) {
  return request('/api/cards/bulk-delete', {
    method: 'POST',
    body: { slugs: Array.isArray(slugs) ? slugs : [] },
    timeoutMs: 120000
  })
}

/** Change a card's kind (admin) */
export function apiUpdateCardKind(slug, kind, { personalType } = {}) {
  const body = { kind }
  if (personalType) body.personalType = personalType
  return request(`/api/cards/${encodeURIComponent(slug)}`, {
    method: 'PATCH',
    body
  })
}

/** Provision a batch of blank cards (admin) */
export function apiProvisionCards({ count = 1, kind = 'table', productId = '', personalType = '' } = {}) {
  return request('/api/cards/provision', {
    method: 'POST',
    body: { count, kind, productId, personalType }
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

export function apiForgotPassword(payload) {
  return request('/api/auth/forgot-password', { method: 'POST', body: payload })
}

export function apiGetMe() {
  return request('/api/me')
}

/**
 * Ensure we have a live API session token. If the token is missing/stale but the
 * user has stored login credentials (email/phone + passwordHash), silently
 * re-authenticate so authenticated calls (uploads, profile save) keep working.
 * Pass `{ force: true }` after a 401 to clear a stale token and re-login.
 * Returns true when a usable token is available afterwards.
 */
export async function ensureApiSession({ force = false } = {}) {
  if (force) setApiToken('')
  if (!force && getApiToken()) return true
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

// ---- Shop / sales products (Supabase via Worker) ----

/** Public shop catalog from sales_products */
export function apiShopProducts() {
  return request('/api/shop/products', { timeoutMs: 10000 })
}

/** Staff catalog (includes inactive when requested) */
export function apiSalesProducts({ includeInactive = true, includeDeleted = false } = {}) {
  const params = new URLSearchParams()
  if (!includeInactive) params.set('includeInactive', '0')
  if (includeDeleted) params.set('includeDeleted', '1')
  const q = params.toString() ? `?${params}` : ''
  return request(`/api/sales/products${q}`, { timeoutMs: 12000 })
}

export function apiSaveSalesProduct(product) {
  const id = String(product?.id || '').trim()
  if (id) {
    return request(`/api/sales/products/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: product,
      timeoutMs: 20000
    })
  }
  return request('/api/sales/products', {
    method: 'POST',
    body: product,
    timeoutMs: 20000
  })
}

export function apiDeleteSalesProduct(id) {
  return request(`/api/sales/products/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    timeoutMs: 12000
  })
}

export function apiRestoreSalesProduct(id) {
  return request(`/api/sales/products/${encodeURIComponent(id)}/restore`, {
    method: 'POST',
    timeoutMs: 12000
  })
}

/** Full finance bundle — admin sees all agents; sales sees own agent only */
export function apiSalesFinance() {
  return request('/api/sales/finance', { timeoutMs: 20000 })
}

export function apiSalesChangelog({ limit = 150 } = {}) {
  return request(`/api/sales/changelog?limit=${encodeURIComponent(limit)}`, { timeoutMs: 15000 })
}

export function apiAdminErrors({ limit = 200, source = '' } = {}) {
  const q = new URLSearchParams({ limit: String(limit) })
  if (source) q.set('source', source)
  return request(`/api/admin/errors?${q.toString()}`, { timeoutMs: 15000 })
}

export function apiReportClientError(payload = {}) {
  const body = {
    source: payload.source || 'client',
    message: payload.message || 'Client error',
    stack: payload.stack || '',
    path: payload.path || (typeof window !== 'undefined' ? window.location.pathname : ''),
    method: payload.method || '',
    status: payload.status ?? null,
    context: payload.context && typeof payload.context === 'object' ? payload.context : {}
  }
  // Staff sessions use authenticated endpoint; everyone else uses public sink.
  const staff = authTokenFor('/api/admin/errors')
  return request(staff ? '/api/admin/errors' : '/api/client-errors', {
    method: 'POST',
    body,
    timeoutMs: 8000
  })
}


export function apiUpsertSalesAgent(agent) {
  return request('/api/sales/agents', { method: 'PUT', body: agent, timeoutMs: 12000 })
}

export function apiDeleteSalesAgent(id) {
  return request(`/api/sales/agents/${encodeURIComponent(id)}`, { method: 'DELETE', timeoutMs: 12000 })
}

export function apiRestoreSalesAgent(id) {
  return request(`/api/sales/agents/${encodeURIComponent(id)}/restore`, { method: 'POST', timeoutMs: 12000 })
}

export function apiUpsertSalesOrder(order) {
  return request('/api/sales/orders', { method: 'PUT', body: order, timeoutMs: 12000 })
}

export function apiDeleteSalesOrder(id) {
  return request(`/api/sales/orders/${encodeURIComponent(id)}`, { method: 'DELETE', timeoutMs: 12000 })
}

export function apiRestoreSalesOrder(id) {
  return request(`/api/sales/orders/${encodeURIComponent(id)}/restore`, { method: 'POST', timeoutMs: 12000 })
}

export function apiUpsertSalesQuote(quote) {
  return request('/api/sales/quotes', { method: 'PUT', body: quote, timeoutMs: 12000 })
}

export function apiDeleteSalesQuote(id) {
  return request(`/api/sales/quotes/${encodeURIComponent(id)}`, { method: 'DELETE', timeoutMs: 12000 })
}

export function apiRestoreSalesQuote(id) {
  return request(`/api/sales/quotes/${encodeURIComponent(id)}/restore`, { method: 'POST', timeoutMs: 12000 })
}

export function apiUpsertSalesInvoice(invoice) {
  return request('/api/sales/invoices', { method: 'PUT', body: invoice, timeoutMs: 12000 })
}

export function apiDeleteSalesInvoice(id) {
  return request(`/api/sales/invoices/${encodeURIComponent(id)}`, { method: 'DELETE', timeoutMs: 12000 })
}

export function apiRestoreSalesInvoice(id) {
  return request(`/api/sales/invoices/${encodeURIComponent(id)}/restore`, { method: 'POST', timeoutMs: 12000 })
}

export function apiUpsertSalesCash(entry) {
  return request('/api/sales/cashflow', { method: 'PUT', body: entry, timeoutMs: 12000 })
}

export function apiDeleteSalesCash(id) {
  return request(`/api/sales/cashflow/${encodeURIComponent(id)}`, { method: 'DELETE', timeoutMs: 12000 })
}

export function apiRestoreSalesCash(id) {
  return request(`/api/sales/cashflow/${encodeURIComponent(id)}/restore`, { method: 'POST', timeoutMs: 12000 })
}

// ---- Admin ----

/** All profiles + all cards (slugs) straight from the backend */
export function apiAdminOverview() {
  return request('/api/admin/overview', { timeoutMs: 12000 })
}

/** Live activity feed for one profile (opens, clicks, shares, device, location) */
export function apiAdminProfileActivities(profileId) {
  return request(`/api/admin/profiles/${encodeURIComponent(profileId)}/activities`, {
    timeoutMs: 15000
  })
}

/** Full profile for admin edit */
export function apiAdminGetProfile(profileId) {
  return request(`/api/admin/profiles/${encodeURIComponent(profileId)}`, {
    timeoutMs: 12000
  })
}

/** Admin update any profile fields (card type stays fixed) */
export function apiAdminUpdateProfile(profileId, payload) {
  return request(`/api/admin/profiles/${encodeURIComponent(profileId)}`, {
    method: 'PUT',
    body: payload,
    timeoutMs: 20000
  })
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
    const token = getStaffAccessToken() || getApiToken()
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

// ---- Personal card meetings & follow-ups ----

export function apiSubmitMeeting(payload) {
  return request('/api/meetings', { method: 'POST', body: payload })
}

export function apiListMeetings() {
  return request('/api/meetings')
}

export function apiUpdateMeeting(id, payload) {
  return request(`/api/meetings/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload })
}

export function apiMeetingStats() {
  return request('/api/meetings/stats')
}

/** Public catalog for a profile (active items only) */
export function apiPublicCatalog(profileId) {
  return request(`/api/profiles/${encodeURIComponent(profileId)}/catalog`, { timeoutMs: 10000 })
}

/** Personal card team — owner/member management */
export function apiGetMyTeam() {
  return request('/api/me/team', { timeoutMs: 15000 })
}

export function apiUpdateMyTeam(payload) {
  return request('/api/me/team', { method: 'PUT', body: payload })
}

export function apiAddTeamMember(payload) {
  return request('/api/me/team/members', { method: 'POST', body: payload, timeoutMs: 30000 })
}

export function apiUpdateTeamMember(id, payload) {
  return request(`/api/me/team/members/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: payload
  })
}

/** Guest submits catalog cart quote / interest (emails owner + guest, stores for owner inbox) */
export function apiSubmitCatalogCart(profileId, payload) {
  return request(`/api/profiles/${encodeURIComponent(profileId)}/catalog-cart`, {
    method: 'POST',
    body: payload,
    timeoutMs: 60000
  })
}

/** Owner inbox of visitor catalog carts */
export function apiListCatalogCarts({ includeDeleted = false } = {}) {
  const q = includeDeleted ? '?deleted=1' : ''
  return request(`/api/me/catalog-carts${q}`, { timeoutMs: 15000 })
}

export function apiUpdateCatalogCart(id, payload) {
  return request(`/api/me/catalog-carts/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: payload
  })
}

/** Public availability calendar — taken slots; owner also gets meeting details */
export function apiProfileAvailability(profileId, { from, to } = {}) {
  const q = new URLSearchParams()
  if (from) q.set('from', from)
  if (to) q.set('to', to)
  const suffix = q.toString() ? `?${q}` : ''
  return request(`/api/profiles/${encodeURIComponent(profileId)}/availability${suffix}`, {
    timeoutMs: 12000
  })
}

export function apiListFollowups() {
  return request('/api/followups')
}

export function apiCreateFollowup(payload) {
  return request('/api/followups', { method: 'POST', body: payload })
}

export function apiUpdateFollowup(id, payload) {
  return request(`/api/followups/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload })
}

export function apiDeleteFollowup(id) {
  return request(`/api/followups/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

/** Public shop checkout — emails order quote via Cloudflare Email Sending */
export function apiShopOrderQuote(payload) {
  return request('/api/shop/order-quote', {
    method: 'POST',
    body: payload,
    timeoutMs: 60000
  })
}

/** Send transactional email via Worker → Cloudflare Email Sending (staff only) */
export function apiSendEmail({ from, to, subject, html, text, attachments }) {
  return request('/api/email/send', {
    method: 'POST',
    body: { from, to, subject, html, text, attachments },
    timeoutMs: 60000
  })
}
