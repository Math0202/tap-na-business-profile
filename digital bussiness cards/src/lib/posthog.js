import posthog from 'posthog-js'
import { isLoggedIn, loadProfile, loadViewedProfile } from './profileStore'
import { getStaffUser, isStaffLoggedIn } from './staffAuth'

const TOKEN = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN || 'phc_oAL5bj9u0qzdOKkGE89lvWAFaRcXxpG9DPmD8K2n0i5'
const HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com'

let started = false

export function initPosthog() {
  if (started || typeof window === 'undefined') return
  if (!TOKEN || !String(TOKEN).startsWith('phc_')) return
  started = true
  posthog.init(TOKEN, {
    api_host: HOST,
    defaults: '2026-05-30',
    capture_pageview: false,
    capture_pageleave: true,
    session_recording: {
      maskAllInputs: true
    },
    loaded() {
      syncPosthogIdentity()
      applyAudience(audienceForPath(window.location.pathname, window.location.search))
    }
  })
}

export function audienceForPath(path, searchOrQuery = '') {
  const p = String(path || '/')
  if (isStaffLoggedIn() || p.startsWith('/admin')) return 'staff'

  let next = ''
  if (searchOrQuery && typeof searchOrQuery === 'object') {
    next = String(searchOrQuery.next || '')
  } else {
    const q = String(searchOrQuery || '')
    const query = q.startsWith('?') ? q.slice(1) : q.includes('?') ? q.slice(q.indexOf('?') + 1) : q
    next = new URLSearchParams(query).get('next') || ''
  }

  if (p === '/login' || p === '/shop/login') {
    if (next.startsWith('/admin')) return 'staff'
    if (isLoggedIn()) return 'owner'
    return 'shop'
  }

  if (
    p === '/' ||
    p === '/cart' ||
    p === '/venue-display' ||
    p === '/cards' ||
    p === '/about' ||
    p === '/support' ||
    p === '/signup' ||
    p === '/table' ||
    p.startsWith('/product/') ||
    p.startsWith('/package/') ||
    p.startsWith('/venue-display') ||
    p.startsWith('/cards') ||
    p.startsWith('/about/')
  ) {
    return 'shop'
  }

  if (p === '/setup') return 'guest'

  if (p.startsWith('/c/')) {
    if (isLoggedIn()) {
      const viewed = loadViewedProfile()
      const mine = loadProfile()
      const viewedId = String(viewed?.id || viewed?.remoteProfileId || '')
      const myId = String(mine.remoteProfileId || '')
      if (viewedId && myId && viewedId === myId) return 'owner'
    }
    return 'guest'
  }

  if (isLoggedIn()) {
    const viewed = loadViewedProfile()
    const mine = loadProfile()
    const viewedId = String(viewed?.id || viewed?.remoteProfileId || '')
    const myId = String(mine.remoteProfileId || '')
    const publicCard =
      p === '/me' || p === '/business' || p.startsWith('/catalog') || p.startsWith('/checkin') || p.startsWith('/feedback') || p.startsWith('/menu')
    if (publicCard && viewedId && myId && viewedId !== myId) return 'guest'
    return 'owner'
  }

  return 'guest'
}

function applyAudience(audience) {
  const staff = getStaffUser()
  const props = {
    audience,
    staff_role: audience === 'staff' ? String(staff?.role || '') : ''
  }
  posthog.register(props)
  posthog.register_for_session(props)
}

export function syncPosthogIdentity() {
  if (!started) return
  try {
    if (isStaffLoggedIn()) {
      const u = getStaffUser()
      const id = String(u?.id || u?.agentId || '').trim()
      if (!id) return
      posthog.identify(`staff:${id}`, {
        audience: 'staff',
        staff_role: u.role || '',
        staff_agent_id: u.agentId || ''
      })
      return
    }
    if (isLoggedIn()) {
      const p = loadProfile()
      const id = String(p.remoteProfileId || '').trim()
      if (!id) return
      posthog.identify(`owner:${id}`, {
        audience: 'owner',
        card_type: p.cardType || ''
      })
    }
  } catch {
    /* ignore */
  }
}

export function syncPosthogForRoute(to) {
  if (!started) return
  try {
    syncPosthogIdentity()
    const audience = audienceForPath(to.path, to.query)
    applyAudience(audience)
    posthog.capture('$pageview', { audience })
  } catch {
    /* ignore */
  }
}

export function identifyOwner() {
  if (!started) return
  syncPosthogIdentity()
  applyAudience('owner')
}

export function identifyStaff() {
  if (!started) return
  syncPosthogIdentity()
  applyAudience('staff')
}

export function resetPosthog() {
  if (!started) return
  try {
    posthog.reset()
  } catch {
    /* ignore */
  }
}

export function capturePosthogException(err) {
  if (!started) return
  try {
    posthog.captureException(err)
  } catch {
    /* ignore */
  }
}

export { posthog }
