/**
 * Business / table profile link tile order.
 * Check-in and feedback are popups (not tiles).
 */

import { resolveSocialUrl, hasMenuContent, menuPageHref } from './profileStore'

export const BUSINESS_LINK_DEFS = [
  { key: 'phone', icon: 'phone', label: 'Number', trackKey: 'phone' },
  { key: 'email', icon: 'email', label: 'Email', trackKey: 'email' },
  { key: 'whatsapp', icon: 'whatsapp', label: 'WhatsApp', trackKey: 'whatsapp', external: true },
  { key: 'website', icon: 'website', label: 'Website', trackKey: 'website', external: true },
  { key: 'menu', icon: 'menu', label: 'Menu', trackKey: 'menu', external: true },
  { key: 'review', icon: 'review', label: 'Google review', trackKey: 'review', external: true },
  { key: 'x', icon: 'x', label: 'X', trackKey: 'x', external: true },
  { key: 'instagram', icon: 'instagram', label: 'Instagram', trackKey: 'instagram', external: true },
  { key: 'tiktok', icon: 'tiktok', label: 'TikTok', trackKey: 'tiktok', external: true }
]

export const DEFAULT_BUSINESS_LINK_ORDER = BUSINESS_LINK_DEFS.map((d) => d.key)

const DEF_BY_KEY = Object.fromEntries(BUSINESS_LINK_DEFS.map((d) => [d.key, d]))

function filled(value) {
  return !!String(value || '').trim()
}

export function normalizeLinkOrder(order) {
  const incoming = Array.isArray(order) ? order.map((k) => String(k || '').trim()).filter(Boolean) : []
  const known = new Set(DEFAULT_BUSINESS_LINK_ORDER)
  const seen = new Set()
  const out = []
  for (const key of incoming) {
    if (!known.has(key) || seen.has(key)) continue
    out.push(key)
    seen.add(key)
  }
  for (const key of DEFAULT_BUSINESS_LINK_ORDER) {
    if (!seen.has(key)) out.push(key)
  }
  return out
}

export function businessLinkDef(key) {
  return DEF_BY_KEY[key] || null
}

export function moveLinkOrder(order, key, direction) {
  const next = normalizeLinkOrder(order)
  const i = next.indexOf(key)
  if (i < 0) return next
  const j = direction < 0 ? i - 1 : i + 1
  if (j < 0 || j >= next.length) return next
  const tmp = next[i]
  next[i] = next[j]
  next[j] = tmp
  return next
}

/**
 * Configured destinations only (opt-in phone/email). Check-in/feedback are popups.
 */
export function listConfiguredBusinessDestinations(profile) {
  if (!profile || profile.disabled) return []
  const items = []
  const add = (key, href) => {
    const url = String(href || '').trim()
    if (!url) return
    items.push({ key, href: url })
  }

  if (profile.showPhone && filled(profile.phone)) add('phone', 'tel:' + String(profile.phone).trim())
  if (profile.showEmail && filled(profile.email)) add('email', 'mailto:' + String(profile.email).trim())
  if (filled(profile.whatsapp)) add('whatsapp', resolveSocialUrl('whatsapp', profile.whatsapp))
  if (filled(profile.website)) add('website', resolveSocialUrl('website', profile.website))
  if (hasMenuContent(profile)) add('menu', menuPageHref(profile))
  if (filled(profile.googleReview)) add('review', resolveSocialUrl('website', profile.googleReview))
  if (filled(profile.x)) add('x', resolveSocialUrl('x', profile.x))
  if (filled(profile.instagram)) add('instagram', resolveSocialUrl('instagram', profile.instagram))
  if (filled(profile.tiktok)) add('tiktok', resolveSocialUrl('tiktok', profile.tiktok))

  const order = normalizeLinkOrder(profile.linkOrder)
  items.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
  return items
}

/** If exactly one destination is configured, return its href; otherwise ''. */
export function singleBusinessDestinationHref(profile) {
  // Guest popups need the full page — never skip to a single link.
  if (profile?.showCheckin || profile?.showFeedback) return ''
  const list = listConfiguredBusinessDestinations(profile)
  return list.length === 1 ? list[0].href : ''
}