/**
 * Admin directory of all personal + business profiles (localStorage).
 * Syncs the device's active profile, tracks activities, and supports management.
 */

import {
  loadProfile,
  isTableBusiness,
  isProfileDeleted,
  isProfileDisabled,
  avatarUrl,
  logoUrl,
  displayName
} from './profileStore'

const DIRECTORY_KEY = 'tapna_admin_directory'
const ACTIVITY_KEY = 'tapna_admin_activity'
const METRICS_KEY = 'tapna_admin_metrics'
export const LOCAL_ID = 'local-device'

export const CLICK_LABELS = {
  phone: 'Number',
  email: 'Email',
  whatsapp: 'WhatsApp',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  x: 'X',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  website: 'Website',
  menu: 'Menu',
  review: 'Google review',
  checkin: 'Events check-in',
  feedback: 'Feedback',
  download_qr: 'Download QR',
  share_open: 'Share / QR button',
  save_contact: 'Save contact',
  play_video: 'Play video',
  copy_link: 'Copy link'
}

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

function readRaw() {
  const parsed = readJson(DIRECTORY_KEY, null)
  return Array.isArray(parsed) ? parsed : null
}

function writeRaw(list) {
  return writeJson(DIRECTORY_KEY, list)
}

function normalizeEntry(entry) {
  const cardType = entry.cardType === 'table' ? 'table' : 'personal'
  return {
    id: entry.id || ('id-' + Math.random().toString(36).slice(2, 10)),
    cardType,
    name: entry.name || '',
    title: entry.title || '',
    company: entry.company || '',
    email: entry.email || entry.loginEmail || '',
    phone: entry.phone || entry.loginPhone || '',
    whatsapp: entry.whatsapp || '',
    linkedin: entry.linkedin || '',
    youtube: entry.youtube || '',
    x: entry.x || '',
    instagram: entry.instagram || '',
    tiktok: entry.tiktok || '',
    website: entry.website || '',
    address: entry.address || '',
    city: entry.city || '',
    menuUrl: entry.menuUrl || '',
    googleReview: entry.googleReview || '',
    checkInUrl: entry.checkInUrl || '',
    feedbackUrl: entry.feedbackUrl || '',
    avatar: entry.avatar || '',
    logo: entry.logo || '',
    notes: entry.notes || '',
    shareSlug: String(entry.shareSlug || '').trim(),
    remoteProfileId: entry.remoteProfileId || '',
    createdAt: entry.createdAt || new Date().toISOString(),
    updatedAt: entry.updatedAt || entry.createdAt || new Date().toISOString(),
    disabled: !!entry.disabled,
    deleted: !!entry.deleted,
    demo: !!entry.demo,
    local: !!entry.local
  }
}

function ensureDirectory() {
  let list = readRaw()
  if (!list) {
    list = []
    writeRaw(list)
  } else {
    // Purge legacy demo entries that were seeded into older browsers
    const next = list.filter((e) => !e.demo)
    if (next.length !== list.length) {
      list = next
      writeRaw(list)
    }
  }
  return list.map(normalizeEntry)
}

const LEGACY_DEMO_IDS = ['p-amina', 'p-jonas', 'p-lena', 'b-harbour', 'b-desert', 'b-savanna']

function ensureActivitiesSeeded() {
  const existing = readJson(ACTIVITY_KEY, null)
  if (!Array.isArray(existing)) {
    writeJson(ACTIVITY_KEY, [])
  } else {
    const next = existing.filter((a) => !LEGACY_DEMO_IDS.includes(a.profileId))
    if (next.length !== existing.length) writeJson(ACTIVITY_KEY, next)
  }
  ensureMetricsSeeded()
}

function ensureMetricsSeeded() {
  const existing = readJson(METRICS_KEY, null)
  if (!existing || typeof existing !== 'object') {
    writeJson(METRICS_KEY, {})
    return
  }
  let changed = false
  for (const id of LEGACY_DEMO_IDS) {
    if (id in existing) {
      delete existing[id]
      changed = true
    }
  }
  if (changed) writeJson(METRICS_KEY, existing)
}

function emptyMetrics() {
  return { visits: 0, shares: 0, clicks: {} }
}

export function getMetrics(profileId) {
  ensureMetricsSeeded()
  const all = readJson(METRICS_KEY, {})
  const row = all[profileId] || emptyMetrics()
  return {
    visits: Number(row.visits) || 0,
    shares: Number(row.shares) || 0,
    clicks: { ...(row.clicks || {}) }
  }
}

function saveMetrics(profileId, metrics) {
  const all = readJson(METRICS_KEY, {})
  all[profileId] = metrics
  writeJson(METRICS_KEY, all)
  return metrics
}

export function getClickBreakdown(profileId) {
  const metrics = getMetrics(profileId)
  return Object.entries(metrics.clicks)
    .map(([key, count]) => ({
      key,
      label: CLICK_LABELS[key] || key,
      count: Number(count) || 0
    }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count)
}

export function getEngagementStats(profileId, cardType = 'personal') {
  const metrics = getMetrics(profileId)
  const clickTotal = Object.values(metrics.clicks).reduce((sum, n) => sum + (Number(n) || 0), 0)
  const items = getActivitiesForProfile(profileId, cardType)
  const base = {
    visits: metrics.visits,
    shares: metrics.shares,
    clicks: clickTotal,
    total: items.length
  }
  if (cardType === 'table') {
    return {
      ...base,
      checkIns: items.filter((a) => a.type === 'checkin').length,
      feedback: items.filter((a) => a.type === 'feedback').length
    }
  }
  return base
}

/** Track a public-page visit once per browser session. */
export function trackVisit(profileId = LOCAL_ID) {
  const sessionKey = 'tapna_visit_' + profileId
  try {
    if (sessionStorage.getItem(sessionKey)) return getMetrics(profileId)
    sessionStorage.setItem(sessionKey, '1')
  } catch {
    /* ignore */
  }
  const metrics = getMetrics(profileId)
  metrics.visits += 1
  saveMetrics(profileId, metrics)
  logActivity({
    profileId,
    type: 'visit',
    title: 'Profile visit',
    detail: 'Public card opened'
  })
  return metrics
}

export function trackShare(profileId = LOCAL_ID, channel = '') {
  const metrics = getMetrics(profileId)
  metrics.shares += 1
  saveMetrics(profileId, metrics)
  logActivity({
    profileId,
    type: 'share',
    title: 'Profile shared',
    detail: channel ? 'Shared via ' + channel : 'Shared'
  })
  return metrics
}

export function trackClick(profileId = LOCAL_ID, key = 'unknown', label = '') {
  const metrics = getMetrics(profileId)
  if (!metrics.clicks[key]) metrics.clicks[key] = 0
  metrics.clicks[key] += 1
  saveMetrics(profileId, metrics)
  const nice = label || CLICK_LABELS[key] || key
  logActivity({
    profileId,
    type: 'click',
    title: key.startsWith('share') || key === 'copy_link' || key === 'download_qr' || key === 'save_contact' || key === 'play_video' || key === 'share_open'
      ? 'Button clicked'
      : 'Link clicked',
    detail: nice
  })
  return metrics
}

export function syncLocalProfileToDirectory(profile = loadProfile()) {
  const list = ensureDirectory()
  ensureActivitiesSeeded()
  const now = new Date().toISOString()
  const prev = list.find((p) => p.id === LOCAL_ID)
  const summary = normalizeEntry({
    id: LOCAL_ID,
    cardType: profile.cardType,
    name: profile.name,
    title: profile.title,
    company: profile.company,
    email: profile.email || profile.loginEmail,
    phone: profile.phone || profile.loginPhone,
    whatsapp: profile.whatsapp,
    linkedin: profile.linkedin,
    youtube: profile.youtube,
    x: profile.x,
    instagram: profile.instagram,
    tiktok: profile.tiktok,
    website: profile.website,
    address: profile.address,
    menuUrl: profile.menuUrl,
    googleReview: profile.googleReview,
    checkInUrl: profile.checkInUrl,
    feedbackUrl: profile.feedbackUrl,
    avatar: profile.avatar,
    logo: profile.logo,
    shareSlug: profile.shareSlug || prev?.shareSlug || '',
    remoteProfileId: profile.remoteProfileId || prev?.remoteProfileId || '',
    notes: prev?.notes || '',
    disabled: profile.disabled,
    deleted: profile.deleted,
    local: true,
    demo: false,
    updatedAt: now,
    createdAt: prev?.createdAt || now
  })

  const idx = list.findIndex((p) => p.id === LOCAL_ID)
  if (idx >= 0) list[idx] = { ...list[idx], ...summary }
  else {
    list.unshift(summary)
    logActivity({
      profileId: LOCAL_ID,
      type: 'profile_created',
      title: summary.cardType === 'table' ? 'Venue created' : 'Profile created',
      detail: 'Synced from this device'
    })
  }

  writeRaw(list)
  return list
}

export function loadDirectory() {
  syncLocalProfileToDirectory()
  return ensureDirectory().filter((p) => !p.deleted)
}

export function getEntryById(id) {
  ensureDirectory()
  ensureActivitiesSeeded()
  if (id === LOCAL_ID) syncLocalProfileToDirectory()
  const list = ensureDirectory()
  return list.find((p) => p.id === id) || null
}

export function getDirectoryStats(list = loadDirectory()) {
  const active = list.filter((p) => !p.deleted)
  const personal = active.filter((p) => p.cardType !== 'table')
  const business = active.filter((p) => p.cardType === 'table')
  const disabled = active.filter((p) => p.disabled)
  const live = active.filter((p) => !p.disabled)

  let visits = 0
  let shares = 0
  active.forEach((p) => {
    const m = getMetrics(p.id)
    visits += m.visits
    shares += m.shares
  })

  return {
    total: active.length,
    personal: personal.length,
    business: business.length,
    live: live.length,
    disabled: disabled.length,
    visits,
    shares,
    checkIns: countActivitiesByType('checkin'),
    feedback: countActivitiesByType('feedback')
  }
}

function countActivitiesByType(type) {
  return getAllActivities().filter((a) => a.type === type).length
}

export function listPersonalProfiles(list = loadDirectory()) {
  return list
    .filter((p) => !p.deleted && p.cardType !== 'table')
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
}

export function listBusinessProfiles(list = loadDirectory()) {
  return list
    .filter((p) => !p.deleted && p.cardType === 'table')
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
}

export function profileThumb(entry) {
  if (!entry) return avatarUrl({})
  if (entry.cardType === 'table') {
    return logoUrl(entry) || avatarUrl(entry)
  }
  return avatarUrl(entry)
}

export function profileLabel(entry) {
  if (!entry) return 'Unknown'
  if (entry.cardType === 'table') {
    return entry.company || entry.name || 'Unnamed venue'
  }
  return displayName(entry)
}

export function profileMeta(entry) {
  if (!entry) return ''
  if (entry.cardType === 'table') {
    return entry.title || entry.address || entry.city || 'Venue'
  }
  const parts = [entry.title, entry.company].filter(Boolean)
  return parts.join(' · ') || 'Personal card'
}

export function publicPathFor(entry) {
  return isTableBusiness(entry) ? '/business' : '/'
}

export function detailPathFor(entry) {
  return '/admin/profiles/' + encodeURIComponent(entry.id)
}

function readActivities() {
  ensureActivitiesSeeded()
  const list = readJson(ACTIVITY_KEY, [])
  return Array.isArray(list) ? list : []
}

export function getAllActivities() {
  const fromStore = readActivities()
  const merged = fromStore.slice()

  // Fold live check-ins / feedback for the local venue into activity stream
  const checkins = readJson('tapna_checkins', [])
  if (Array.isArray(checkins)) {
    checkins.forEach((c, i) => {
      const id = 'live-checkin-' + (c.at || i)
      if (merged.some((a) => a.id === id)) return
      merged.push({
        id,
        profileId: LOCAL_ID,
        type: 'checkin',
        title: 'Event check-in',
        detail: [c.name, c.event, c.guests ? c.guests + ' guest(s)' : ''].filter(Boolean).join(' · '),
        at: c.at || new Date().toISOString(),
        live: true
      })
    })
  }

  const feedback = readJson('tapna_feedback', [])
  if (Array.isArray(feedback)) {
    feedback.forEach((f, i) => {
      const id = 'live-feedback-' + (f.at || i)
      if (merged.some((a) => a.id === id)) return
      const stars = f.rating ? '★'.repeat(Number(f.rating) || 0) : ''
      merged.push({
        id,
        profileId: LOCAL_ID,
        type: 'feedback',
        title: 'Feedback received',
        detail: [stars, f.message || f.comment || f.name].filter(Boolean).join(' '),
        at: f.at || new Date().toISOString(),
        live: true
      })
    })
  }

  return merged.sort((a, b) => String(b.at).localeCompare(String(a.at)))
}

export function getActivitiesForProfile(profileId, cardType) {
  const entry = getEntryById(profileId)
  const type = cardType || entry?.cardType || 'personal'
  return getAllActivities()
    .filter((a) => a.profileId === profileId)
    .filter((a) => {
      if (type === 'personal' && (a.type === 'checkin' || a.type === 'feedback')) return false
      return true
    })
}

export function getActivityStats(profileId) {
  const entry = getEntryById(profileId)
  return getEngagementStats(profileId, entry?.cardType || 'personal')
}

export function logActivity({ profileId, type, title, detail }) {
  const list = readActivities()
  list.unshift({
    id: 'act-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    profileId,
    type: type || 'note',
    title: title || 'Activity',
    detail: detail || '',
    at: new Date().toISOString()
  })
  writeJson(ACTIVITY_KEY, list.slice(0, 500))
  return list
}

export function setEntryDisabled(id, disabled) {
  const list = ensureDirectory()
  const idx = list.findIndex((p) => p.id === id)
  if (idx < 0) return list
  list[idx] = {
    ...list[idx],
    disabled: !!disabled,
    updatedAt: new Date().toISOString()
  }
  writeRaw(list)

  logActivity({
    profileId: id,
    type: 'status',
    title: disabled ? 'Profile disabled' : 'Profile enabled',
    detail: disabled ? 'Public card hidden by admin' : 'Public card made live by admin'
  })

  if (id === LOCAL_ID) {
    const current = loadProfile()
    localStorage.setItem(
      'tapna_profile',
      JSON.stringify({ ...current, disabled: !!disabled })
    )
  }
  return list
}

export function updateEntry(id, patch) {
  const list = ensureDirectory()
  const idx = list.findIndex((p) => p.id === id)
  if (idx < 0) return null

  const next = normalizeEntry({
    ...list[idx],
    ...patch,
    id,
    local: list[idx].local,
    demo: list[idx].demo,
    createdAt: list[idx].createdAt,
    updatedAt: new Date().toISOString()
  })
  list[idx] = next
  writeRaw(list)

  logActivity({
    profileId: id,
    type: 'profile_updated',
    title: 'Profile updated',
    detail: 'Admin saved profile details'
  })

  if (id === LOCAL_ID) {
    const current = loadProfile()
    localStorage.setItem(
      'tapna_profile',
      JSON.stringify({
        ...current,
        cardType: next.cardType,
        name: next.name,
        title: next.title,
        company: next.company,
        email: next.email,
        phone: next.phone,
        whatsapp: next.whatsapp,
        linkedin: next.linkedin,
        youtube: next.youtube,
        x: next.x,
        instagram: next.instagram,
        tiktok: next.tiktok,
        website: next.website,
        address: next.address,
        menuUrl: next.menuUrl,
        googleReview: next.googleReview,
        checkInUrl: next.checkInUrl,
        feedbackUrl: next.feedbackUrl,
        disabled: next.disabled
      })
    )
  }

  return next
}

export function softDeleteEntry(id) {
  const list = ensureDirectory()
  const idx = list.findIndex((p) => p.id === id)
  if (idx < 0) return list
  list[idx] = {
    ...list[idx],
    deleted: true,
    updatedAt: new Date().toISOString()
  }
  writeRaw(list)

  logActivity({
    profileId: id,
    type: 'status',
    title: 'Profile deleted',
    detail: 'Removed from admin directory'
  })

  if (id === LOCAL_ID) {
    const current = loadProfile()
    localStorage.setItem(
      'tapna_profile',
      JSON.stringify({ ...current, deleted: true, name: '', company: '' })
    )
  }
  return list.filter((p) => !p.deleted)
}


export function activityIcon(type) {
  switch (type) {
    case 'visit': return 'visibility'
    case 'click': return 'touch_app'
    case 'checkin': return 'event_available'
    case 'feedback': return 'rate_review'
    case 'share': return 'ios_share'
    case 'qr_download': return 'download'
    case 'contact_save': return 'person_add'
    case 'menu_view': return 'restaurant_menu'
    case 'status': return 'toggle_on'
    case 'profile_created': return 'add_circle'
    case 'profile_updated': return 'edit'
    default: return 'history'
  }
}

export function isLocalDeleted() {
  return isProfileDeleted(loadProfile())
}

export function isLocalDisabled() {
  return isProfileDisabled(loadProfile())
}
