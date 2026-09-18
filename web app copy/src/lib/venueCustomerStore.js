/**
 * Venue (table) customer data — check-ins & feedback from localStorage.
 */

const CHECKINS_KEY = 'tapna_checkins'
const FEEDBACK_KEY = 'tapna_feedback'

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

function uid(prefix) {
  return prefix + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

function normalizeCheckin(c, i = 0) {
  return {
    id: c.id || 'checkin-' + i + '-' + String(c.at || '').slice(0, 10),
    type: 'checkin',
    venue: c.venue || '',
    name: c.name || '',
    contact: c.contact || '',
    event: c.event || 'General visit',
    guests: Math.max(1, Number(c.guests) || 1),
    at: c.at || new Date().toISOString()
  }
}

function normalizeFeedback(f, i = 0) {
  return {
    id: f.id || 'feedback-' + i + '-' + String(f.at || '').slice(0, 10),
    type: 'feedback',
    venue: f.venue || '',
    name: f.name || 'Anonymous',
    contact: f.contact || '',
    rating: Math.min(5, Math.max(0, Number(f.rating) || 0)),
    message: f.message || '',
    at: f.at || new Date().toISOString()
  }
}

const DEMO_CHECKINS = [
  {
    id: 'checkin-demo-1',
    venue: 'Harbour Kitchen',
    name: 'Nina K.',
    contact: '+264 81 555 0101',
    event: 'Friday live music',
    guests: 2,
    at: '2026-07-18T19:12:00.000Z'
  },
  {
    id: 'checkin-demo-2',
    venue: 'Harbour Kitchen',
    name: 'Tom Shipanga',
    contact: 'tom@mail.na',
    event: 'General visit',
    guests: 1,
    at: '2026-07-20T12:40:00.000Z'
  },
  {
    id: 'checkin-demo-3',
    venue: 'Harbour Kitchen',
    name: 'Lerato M.',
    contact: '+264 81 555 0202',
    event: 'Birthday table',
    guests: 4,
    at: '2026-07-22T18:05:00.000Z'
  }
]

const DEMO_FEEDBACK = [
  {
    id: 'feedback-demo-1',
    venue: 'Harbour Kitchen',
    name: 'Nina K.',
    contact: '',
    rating: 5,
    message: 'Great service and atmosphere',
    at: '2026-07-18T21:05:00.000Z'
  },
  {
    id: 'feedback-demo-2',
    venue: 'Harbour Kitchen',
    name: 'Anonymous',
    contact: '',
    rating: 4,
    message: 'Food was excellent, wait time a bit long',
    at: '2026-07-21T14:20:00.000Z'
  }
]

export function ensureVenueCustomerSeed() {
  if (!Array.isArray(readJson(CHECKINS_KEY, null))) {
    writeJson(CHECKINS_KEY, DEMO_CHECKINS.slice())
  }
  if (!Array.isArray(readJson(FEEDBACK_KEY, null))) {
    writeJson(FEEDBACK_KEY, DEMO_FEEDBACK.slice())
  }
}

export function listCheckins() {
  ensureVenueCustomerSeed()
  return readJson(CHECKINS_KEY, [])
    .map(normalizeCheckin)
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
}

export function listFeedback() {
  ensureVenueCustomerSeed()
  return readJson(FEEDBACK_KEY, [])
    .map(normalizeFeedback)
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
}

export function listAllCustomerRecords() {
  return [...listCheckins(), ...listFeedback()].sort((a, b) =>
    String(b.at).localeCompare(String(a.at))
  )
}

export function getVenueCustomerStats() {
  const checkins = listCheckins()
  const feedback = listFeedback()
  const guests = checkins.reduce((s, c) => s + c.guests, 0)
  const rated = feedback.filter((f) => f.rating > 0)
  const avgRating =
    rated.length
      ? Math.round((rated.reduce((s, f) => s + f.rating, 0) / rated.length) * 10) / 10
      : 0
  const contacts = new Set(
    [...checkins, ...feedback]
      .map((r) => String(r.contact || '').trim().toLowerCase())
      .filter(Boolean)
  )
  return {
    checkins: checkins.length,
    feedback: feedback.length,
    guests,
    avgRating,
    uniqueContacts: contacts.size
  }
}

export function deleteCheckin(id) {
  writeJson(
    CHECKINS_KEY,
    listCheckins().filter((c) => c.id !== id)
  )
}

export function deleteFeedback(id) {
  writeJson(
    FEEDBACK_KEY,
    listFeedback().filter((f) => f.id !== id)
  )
}

function csvEscape(value) {
  const s = String(value ?? '')
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
  return s
}

export function buildCheckinsCsv(rows = listCheckins()) {
  const header = ['Date', 'Name', 'Contact', 'Event', 'Guests', 'Venue']
  const lines = [header.join(',')]
  for (const r of rows) {
    lines.push(
      [
        r.at,
        r.name,
        r.contact,
        r.event,
        r.guests,
        r.venue
      ]
        .map(csvEscape)
        .join(',')
    )
  }
  return lines.join('\n')
}

export function buildFeedbackCsv(rows = listFeedback()) {
  const header = ['Date', 'Name', 'Contact', 'Rating', 'Message', 'Venue']
  const lines = [header.join(',')]
  for (const r of rows) {
    lines.push(
      [r.at, r.name, r.contact, r.rating, r.message, r.venue].map(csvEscape).join(',')
    )
  }
  return lines.join('\n')
}

export function buildAllCustomersCsv() {
  const header = ['Type', 'Date', 'Name', 'Contact', 'Detail', 'Guests/Rating', 'Venue']
  const lines = [header.join(',')]
  for (const r of listAllCustomerRecords()) {
    const detail = r.type === 'checkin' ? r.event : r.message
    const metric = r.type === 'checkin' ? r.guests : r.rating
    lines.push(
      [r.type, r.at, r.name, r.contact, detail, metric, r.venue].map(csvEscape).join(',')
    )
  }
  return lines.join('\n')
}

export function downloadCsv(filename, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function resetVenueCustomerDemo() {
  writeJson(CHECKINS_KEY, DEMO_CHECKINS.slice())
  writeJson(FEEDBACK_KEY, DEMO_FEEDBACK.slice())
}

/** Used when forms save — ensure records get stable ids */
export function appendCheckin(payload) {
  const list = listCheckins()
  const next = normalizeCheckin({ ...payload, id: uid('checkin') })
  list.unshift(next)
  writeJson(CHECKINS_KEY, list)
  return next
}

export function appendFeedback(payload) {
  const list = listFeedback()
  const next = normalizeFeedback({ ...payload, id: uid('feedback') })
  list.unshift(next)
  writeJson(FEEDBACK_KEY, list)
  return next
}
