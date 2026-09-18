/**
 * Customizable venue check-in / feedback form configs.
 */

function uid(prefix = 'cf') {
  return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7)
}

function asBool(v, fallback = false) {
  if (v === undefined || v === null) return fallback
  return !!v
}

function cleanText(v, max = 200) {
  return String(v || '').trim().slice(0, max)
}

function normalizeCustomFields(list) {
  if (!Array.isArray(list)) return []
  const out = []
  for (const raw of list.slice(0, 12)) {
    if (!raw || typeof raw !== 'object') continue
    const type = ['text', 'textarea', 'select'].includes(raw.type) ? raw.type : 'text'
    const options = Array.isArray(raw.options)
      ? raw.options.map((o) => cleanText(o, 80)).filter(Boolean).slice(0, 20)
      : []
    out.push({
      id: cleanText(raw.id, 40) || uid(),
      label: cleanText(raw.label, 80) || 'Custom field',
      type,
      required: !!raw.required,
      options: type === 'select' ? options : []
    })
  }
  return out
}

export const DEFAULT_FEEDBACK_FORM = {
  title: 'Share your feedback',
  intro: '',
  askStars: true,
  starsRequired: true,
  askMessage: true,
  messageLabel: 'Your feedback',
  messageRequired: false,
  askName: false,
  askPhone: false,
  askEmail: false,
  customFields: []
}

export const DEFAULT_CHECKIN_FORM = {
  title: 'Check in',
  intro: '',
  eventMode: 'text',
  eventName: 'General visit',
  events: [],
  askName: true,
  askPhone: false,
  askEmail: false,
  askGuests: true,
  customFields: []
}

export function normalizeFeedbackForm(raw) {
  const src = raw && typeof raw === 'object' ? raw : {}
  return {
    title: cleanText(src.title, 80) || DEFAULT_FEEDBACK_FORM.title,
    intro: cleanText(src.intro, 240),
    askStars: asBool(src.askStars, true),
    starsRequired: asBool(src.starsRequired, true),
    askMessage: asBool(src.askMessage, true),
    messageLabel: cleanText(src.messageLabel, 80) || DEFAULT_FEEDBACK_FORM.messageLabel,
    messageRequired: asBool(src.messageRequired, false),
    askName: asBool(src.askName, false),
    askPhone: asBool(src.askPhone, false),
    askEmail: asBool(src.askEmail, false),
    customFields: normalizeCustomFields(src.customFields)
  }
}

export function normalizeCheckinForm(raw) {
  const src = raw && typeof raw === 'object' ? raw : {}
  const mode = ['fixed', 'text', 'dropdown'].includes(src.eventMode) ? src.eventMode : 'text'
  const events = Array.isArray(src.events)
    ? src.events.map((e) => cleanText(e, 80)).filter(Boolean).slice(0, 30)
    : []
  return {
    title: cleanText(src.title, 80) || DEFAULT_CHECKIN_FORM.title,
    intro: cleanText(src.intro, 240),
    eventMode: mode,
    eventName: cleanText(src.eventName, 80) || DEFAULT_CHECKIN_FORM.eventName,
    events,
    askName: asBool(src.askName, true),
    askPhone: asBool(src.askPhone, false),
    askEmail: asBool(src.askEmail, false),
    askGuests: asBool(src.askGuests, true),
    customFields: normalizeCustomFields(src.customFields)
  }
}

export function newCustomField(partial = {}) {
  return {
    id: uid(),
    label: cleanText(partial.label, 80) || 'Custom field',
    type: ['text', 'textarea', 'select'].includes(partial.type) ? partial.type : 'text',
    required: !!partial.required,
    options: Array.isArray(partial.options) ? partial.options : []
  }
}

export function contactFromParts(phone, email) {
  const parts = [cleanText(phone, 80), cleanText(email, 120)].filter(Boolean)
  return parts.join(' · ')
}

export function answersFromCustomFields(fields, values) {
  const map = values && typeof values === 'object' ? values : {}
  const out = {}
  for (const field of fields || []) {
    const key = field.id
    const val = cleanText(map[key], 500)
    if (val) out[key] = { label: field.label, value: val }
  }
  return out
}

export function formatAnswersLine(answers) {
  if (!answers || typeof answers !== 'object') return ''
  return Object.values(answers)
    .map((a) => (a && a.label ? a.label + ': ' + (a.value || '') : ''))
    .filter(Boolean)
    .join(' · ')
}