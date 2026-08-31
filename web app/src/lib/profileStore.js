/**
 * Shared profile store (localStorage) — ESM port for Vue SPA.
 */

const STORAGE_KEY = 'tapna_profile'
const SESSION_KEY = 'tapna_session'

export const DEFAULT_PROFILE = {
  cardType: 'personal', // personal | table
  name: '',
  title: 'Job or Role',
  company: 'Company Name',
  phone: '',
  email: '',
  whatsapp: '',
  linkedin: '',
  youtube: '',
  x: '',
  facebook: '',
  instagram: '',
  tiktok: '',
  website: '',
  address: '',
  menuUrl: '',
  menuPdf: '',
  menuImages: [],
  googleReview: '',
  checkInUrl: '',
  feedbackUrl: '',
  linkOrder: [],
  showPhone: false,
  showEmail: false,
  showCheckin: false,
  showFeedback: false,
  showBooking: true,
  checkinForm: {},
  feedbackForm: {},
  catalogItems: [],
  avatar: '/images/personal.png',
  logo: '',
  video: '',
  disabled: false,
  deleted: false,
  loginEmail: '',
  loginPhone: '',
  passwordHash: '',
  shareSlug: '',
  remoteProfileId: '',
  personalType: ''
}

export function hashPassword(password) {
  let str = 'tapna|' + String(password || '')
  let hash = 2166136261
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return ('00000000' + (hash >>> 0).toString(16)).slice(-8)
}

export function loadProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return Object.assign({}, DEFAULT_PROFILE)
    const parsed = JSON.parse(raw)
    return Object.assign({}, DEFAULT_PROFILE, parsed)
  } catch {
    return Object.assign({}, DEFAULT_PROFILE)
  }
}

/**
 * "Viewed profile" — set when a card tap resolves someone else's profile
 * from the backend, so public pages render the card owner's data on any
 * device. Session-scoped and time-limited; falls back to the local profile.
 */
const VIEW_KEY = 'tapna_view_profile'
const VIEW_TTL_MS = 10 * 60 * 1000

export function setViewedProfile(profile) {
  try {
    sessionStorage.setItem(VIEW_KEY, JSON.stringify({ profile, at: Date.now() }))
  } catch {
    /* ignore */
  }
}

export function loadViewedProfile() {
  try {
    const raw = sessionStorage.getItem(VIEW_KEY)
    if (!raw) return null
    const { profile, at } = JSON.parse(raw)
    if (!profile || Date.now() - at > VIEW_TTL_MS) {
      sessionStorage.removeItem(VIEW_KEY)
      return null
    }
    return Object.assign({}, DEFAULT_PROFILE, profile)
  } catch {
    return null
  }
}

export function clearViewedProfile() {
  try {
    sessionStorage.removeItem(VIEW_KEY)
  } catch {
    /* ignore */
  }
}

/** Public pages: prefer a freshly tapped card's profile, else this device's. */
export function loadPublicProfile() {
  return loadViewedProfile() || loadProfile()
}

export function saveProfile(data) {
  const current = loadProfile()
  const next = Object.assign({}, current, data, { deleted: false })
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  import('./adminStore.js')
    .then((m) => m.syncLocalProfileToDirectory(next))
    .catch(() => {})
  return next
}

export function setDisabled(disabled) {
  return saveProfile({ disabled: !!disabled })
}

export function updateLoginCredentials(payload) {
  const current = loadProfile()
  const updates = {}

  if (typeof payload.loginEmail === 'string') {
    updates.loginEmail = payload.loginEmail.trim()
  }
  if (typeof payload.loginPhone === 'string') {
    updates.loginPhone = payload.loginPhone.trim()
  }

  if (payload.newPassword) {
    if (current.passwordHash) {
      if (!payload.currentPassword || hashPassword(payload.currentPassword) !== current.passwordHash) {
        return { ok: false, error: 'Current password is incorrect.' }
      }
    }
    if (String(payload.newPassword).length < 6) {
      return { ok: false, error: 'New password must be at least 6 characters.' }
    }
    if (payload.newPassword !== payload.confirmPassword) {
      return { ok: false, error: 'New passwords do not match.' }
    }
    updates.passwordHash = hashPassword(payload.newPassword)
  }

  saveProfile(updates)
  if (updates.passwordHash || updates.loginEmail || updates.loginPhone) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ loggedIn: true, at: Date.now() }))
  }
  return { ok: true }
}

export function verifyPassword(password) {
  const current = loadProfile()
  if (!current.passwordHash) return true
  return hashPassword(password) === current.passwordHash
}

export function isLoggedIn() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return false
    const session = JSON.parse(raw)
    return !!(session && session.loggedIn)
  } catch {
    return false
  }
}

export function hasCredentials() {
  const profile = loadProfile()
  return !!(profile.passwordHash && (profile.loginEmail || profile.loginPhone))
}

export function login(identifier, password) {
  const profile = loadProfile()
  const id = String(identifier || '').trim().toLowerCase()
  const email = String(profile.loginEmail || '').trim().toLowerCase()
  const phone = String(profile.loginPhone || '').replace(/\s+/g, '')
  const idPhone = id.replace(/\s+/g, '')

  if (!hasCredentials()) {
    return { ok: false, error: 'No account yet. Order an NFC card to sign up first.' }
  }
  if (id !== email && idPhone !== phone && id !== phone) {
    return { ok: false, error: 'Account not found.' }
  }
  if (!verifyPassword(password)) {
    return { ok: false, error: 'Incorrect password.' }
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify({ loggedIn: true, at: Date.now() }))
  import('./posthog.js')
    .then((m) => m.identifyOwner())
    .catch(() => {})
  return { ok: true }
}

export function markLoggedIn() {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ loggedIn: true, at: Date.now() }))
  import('./posthog.js')
    .then((m) => m.identifyOwner())
    .catch(() => {})
}

export function logout() {
  localStorage.removeItem(SESSION_KEY)
  import('./posthog.js')
    .then((m) => m.resetPosthog())
    .catch(() => {})
}

/**
 * Returns true if access is allowed. Does NOT navigate —
 * router guard handles redirects when this returns false.
 */
export function requireLogin() {
  if (isLoggedIn()) return true
  if (!hasCredentials()) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ loggedIn: true, at: Date.now(), setup: true }))
    return true
  }
  return false
}

export function deleteProfile() {
  logout()
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    cardType: 'personal',
    name: '',
    title: '',
    company: '',
    phone: '',
    email: '',
    whatsapp: '',
    linkedin: '',
    youtube: '',
    x: '',
    facebook: '',
    instagram: '',
    tiktok: '',
    website: '',
    address: '',
    menuUrl: '',
    menuPdf: '',
    menuImages: [],
    googleReview: '',
    checkInUrl: '',
    feedbackUrl: '',
    linkOrder: [],
    showPhone: false,
    showEmail: false,
    showCheckin: false,
    showFeedback: false,
    checkinForm: {},
    feedbackForm: {},
    avatar: '',
    logo: '',
    video: '',
    disabled: false,
    deleted: true,
    loginEmail: '',
    loginPhone: '',
    passwordHash: ''
  }))
  import('./adminStore.js')
    .then((m) => m.syncLocalProfileToDirectory(loadProfile()))
    .catch(() => {})
}

export function resetProfile() {
  localStorage.removeItem(STORAGE_KEY)
  return Object.assign({}, DEFAULT_PROFILE)
}

export function isProfileDeleted(profile) {
  return !!(profile && profile.deleted)
}

export function isProfileDisabled(profile) {
  return !!(profile && profile.disabled && !profile.deleted)
}

export function displayName(profile) {
  if (isProfileDeleted(profile) || !profile.name) return 'No profile'
  return profile.name
}

export function avatarUrl(profile) {
  if (isProfileDeleted(profile) || !profile.avatar) {
    return 'data:image/svg+xml,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="#2a2a2a" width="100" height="100"/><circle cx="50" cy="38" r="18" fill="#555"/><ellipse cx="50" cy="78" rx="28" ry="20" fill="#555"/></svg>'
    )
  }
  if (profile.avatar === 'personal.png') return '/images/personal.png'
  return profile.avatar
}

export function isTableBusiness(profile) {
  return !!(profile && profile.cardType === 'table')
}

export function logoUrl(profile) {
  if (isProfileDeleted(profile)) {
    return ''
  }
  if (profile.logo) return profile.logo
  if (isTableBusiness(profile) && profile.avatar) {
    if (profile.avatar === 'personal.png') return '/images/personal.png'
    return profile.avatar
  }
  return 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect fill="#2a2a2a" width="120" height="120" rx="24"/><text x="60" y="68" text-anchor="middle" fill="#888" font-family="sans-serif" font-size="28" font-weight="700">LOGO</text></svg>'
  )
}

export function publicPage(profile) {
  if (isTableBusiness(profile)) return '/business'
  const slug = String(profile?.shareSlug || '').trim()
  return slug ? `/c/${encodeURIComponent(slug)}` : '/me'
}

export function normalizeMenuImages(value) {
  if (!Array.isArray(value)) return []
  return value
    .map((u) => String(u || '').trim())
    .filter((u) => /^https?:\/\//i.test(u) || u.startsWith('/'))
    .slice(0, 20)
}

/** True when the business has any menu content (link, PDF, or images). */
export function hasMenuContent(profile) {
  if (!profile) return false
  if (String(profile.menuUrl || '').trim()) return true
  if (String(profile.menuPdf || '').trim()) return true
  return normalizeMenuImages(profile.menuImages).length > 0
}

/**
 * Prefer in-app menu viewer when PDF/images exist; otherwise external link.
 * Returns '' when there is nothing to show.
 */
export function menuPageHref(profile) {
  if (!profile) return ''
  const images = normalizeMenuImages(profile.menuImages)
  const pdf = String(profile.menuPdf || '').trim()
  if (pdf || images.length) return '/menu'
  const url = String(profile.menuUrl || '').trim()
  if (!url) return ''
  return resolveSocialUrl('website', url)
}

function cleanHandle(value) {
  return String(value || '')
    .trim()
    .replace(/^@+/, '')
    .replace(/^\/+/, '')
    .replace(/\s+/g, '')
}

function looksLikeUrl(value) {
  return /^(https?:\/\/|www\.)/i.test(String(value || '').trim())
}

export function resolveSocialUrl(network, value) {
  const raw = String(value || '').trim()
  if (!raw) return ''

  if (looksLikeUrl(raw)) {
    if (/^www\./i.test(raw)) return 'https://' + raw
    return raw
  }

  if (network === 'whatsapp') {
    if (/^(wa\.me\/|api\.whatsapp\.com)/i.test(raw)) {
      return 'https://' + raw.replace(/^https?:\/\//i, '')
    }
    const digits = raw.replace(/[^\d]/g, '')
    if (!digits) return ''
    return 'https://wa.me/' + digits
  }

  const handle = cleanHandle(raw)
  if (!handle) return ''

  switch (network) {
    case 'linkedin':
      if (/^in\//i.test(handle) || /^company\//i.test(handle)) {
        return 'https://www.linkedin.com/' + handle.replace(/^\/+/, '')
      }
      return 'https://www.linkedin.com/in/' + handle
    case 'youtube':
      if (/^(c\/|channel\/|user\/|@)/i.test(handle)) {
        return 'https://www.youtube.com/' + handle.replace(/^\/+/, '')
      }
      return 'https://www.youtube.com/@' + handle.replace(/^@/, '')
    case 'x':
      return 'https://x.com/' + handle
    case 'facebook':
      if (/facebook\.com/i.test(raw)) {
        return raw.startsWith('http') ? raw.replace(/^http:\/\//i, 'https://') : 'https://' + raw.replace(/^\/+/, '')
      }
      return 'https://www.facebook.com/' + handle.replace(/^@/, '')
    case 'instagram':
      return 'https://www.instagram.com/' + handle
    case 'tiktok':
      return 'https://www.tiktok.com/@' + handle.replace(/^@/, '')
    case 'website':
      return 'https://' + handle.replace(/^https?:\/\//i, '')
    default:
      return raw
  }
}

export function normalizeSocialFields(data) {
  const networks = ['whatsapp', 'linkedin', 'youtube', 'x', 'facebook', 'instagram', 'tiktok', 'website']
  const out = Object.assign({}, data)
  networks.forEach((key) => {
    if (typeof out[key] === 'string') {
      out[key] = resolveSocialUrl(key, out[key])
    }
  })
  return out
}

export const ProfileStore = {
  DEFAULT_PROFILE,
  load: loadProfile,
  save: saveProfile,
  setDisabled,
  updateLoginCredentials,
  verifyPassword,
  isLoggedIn,
  hasCredentials,
  login,
  logout,
  requireLogin,
  delete: deleteProfile,
  reset: resetProfile,
  isDeleted: isProfileDeleted,
  isDisabled: isProfileDisabled,
  displayName,
  avatarUrl,
  logoUrl,
  isTableBusiness,
  publicPage,
  resolveSocialUrl,
  normalizeSocialFields
}

export default ProfileStore
