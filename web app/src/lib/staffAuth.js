/**
 * Staff auth (admin + sales) via Supabase Auth through the Worker.
 * Public storefront and /c/:serial pages do not use this.
 */

const STAFF_KEY = 'tapna_staff_session'

const API_BASE =
  typeof window !== 'undefined' && /(^|\.)(tapnam\.com|redirct\.link)$/i.test(window.location.hostname)
    ? ''
    : 'https://tapnam.com'

function readSession() {
  try {
    const raw = localStorage.getItem(STAFF_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data?.accessToken || !data?.user?.role) return null
    return data
  } catch {
    return null
  }
}

function writeSession(session) {
  try {
    if (!session) localStorage.removeItem(STAFF_KEY)
    else localStorage.setItem(STAFF_KEY, JSON.stringify(session))
  } catch {
    /* ignore */
  }
}

export function getStaffSession() {
  return readSession()
}

export function getStaffAccessToken() {
  return readSession()?.accessToken || ''
}

export function getStaffUser() {
  return readSession()?.user || null
}

export function isStaffLoggedIn() {
  return Boolean(getStaffUser()?.role)
}

export function isStaffAdmin() {
  return getStaffUser()?.role === 'admin'
}

export function isStaffSales() {
  return getStaffUser()?.role === 'sales'
}

export function isStaffManager() {
  return getStaffUser()?.role === 'manager'
}

/** Sales agents + managers (staff who use the sales module). */
export function isStaffSalesTeam() {
  const role = getStaffUser()?.role
  return role === 'sales' || role === 'manager'
}

/** Admin or manager — full sales data + agent management. */
export function canManageSalesOrg() {
  return isStaffAdmin() || isStaffManager()
}

export function staffAgentId() {
  return String(getStaffUser()?.agentId || '')
}

export function staffCanAccessAdminPath(path) {
  if (!isStaffLoggedIn()) return false
  if (isStaffAdmin()) return true
  if (isStaffSalesTeam()) {
    return path === '/admin/sales' || path.startsWith('/admin/sales/')
  }
  return false
}

async function staffRequest(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  const access = token || getStaffAccessToken()
  if (access) headers.Authorization = `Bearer ${access}`
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    return { ok: false, status: res.status, error: data?.error || `HTTP ${res.status}`, data }
  }
  return { ok: true, status: res.status, data }
}

function saveFromResponse(data) {
  const session = {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresIn: data.expiresIn,
    expiresAt: data.expiresAt,
    user: data.user
  }
  writeSession(session)
  return session
}

export async function staffLogin(email, password) {
  const res = await staffRequest('/api/staff/login', {
    method: 'POST',
    body: { email: String(email || '').trim(), password: String(password || '') },
    token: ''
  })
  if (!res.ok || !res.data?.accessToken) {
    return { ok: false, error: res.error || 'Login failed' }
  }
  const session = saveFromResponse(res.data)
  import('./posthog.js')
    .then((m) => m.identifyStaff())
    .catch(() => {})
  return { ok: true, session, user: session.user }
}

export async function staffLogout() {
  try {
    await staffRequest('/api/staff/logout', { method: 'POST' })
  } catch {
    /* ignore */
  }
  writeSession(null)
  import('./posthog.js')
    .then((m) => m.resetPosthog())
    .catch(() => {})
}

export async function refreshStaffSession() {
  const current = readSession()
  if (!current?.refreshToken) return null
  const res = await staffRequest('/api/staff/refresh', {
    method: 'POST',
    body: { refreshToken: current.refreshToken },
    token: ''
  })
  if (!res.ok || !res.data?.accessToken) {
    writeSession(null)
    return null
  }
  return saveFromResponse(res.data)
}

export async function fetchStaffMe() {
  let res = await staffRequest('/api/staff/me')
  if (res.status === 401) {
    const refreshed = await refreshStaffSession()
    if (!refreshed) return null
    res = await staffRequest('/api/staff/me')
  }
  if (!res.ok) return null
  const current = readSession()
  if (current && res.data?.user) {
    writeSession({ ...current, user: res.data.user })
  }
  return res.data?.user || null
}

/** Admin-only: create/update a sales login linked to an agent */
export async function upsertStaffSalesUser({
  email,
  password,
  agentId,
  name,
  authUserId,
  sendCredentialsEmail,
  role = 'sales'
}) {
  const staffRole = role === 'manager' ? 'manager' : 'sales'
  return staffRequest('/api/staff/users', {
    method: 'POST',
    body: {
      email,
      password: password || undefined,
      agentId,
      name,
      role: staffRole,
      authUserId: authUserId || undefined,
      sendCredentialsEmail: sendCredentialsEmail !== false
    }
  })
}
