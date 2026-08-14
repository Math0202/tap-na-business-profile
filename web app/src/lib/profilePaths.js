import { apiResolveCard } from './api'
import {
  isLoggedIn,
  isTableBusiness,
  loadProfile,
  loadPublicProfile,
  loadViewedProfile,
  setViewedProfile
} from './profileStore'

/** Public personal-card URLs stay on the slug the visitor is browsing. */
export function personalPagePath(slug, page = 'profile') {
  const code = String(slug || '').trim()
  const suffix = page === 'catalog' ? '/catalog' : page === 'catalog-cart' ? '/catalog-cart' : ''
  if (!code) {
    if (page === 'catalog') return '/catalog'
    if (page === 'catalog-cart') return '/catalog-cart'
    return '/me'
  }
  return `/c/${encodeURIComponent(code)}${suffix}`
}

/** Slug for the personal card currently on screen (route first, then session). */
export function browsingPersonalSlug(route) {
  const fromRoute = String(route?.params?.serial || '').trim()
  if (fromRoute) return fromRoute
  if (isLoggedIn()) {
    const mine = loadProfile()
    if (!isTableBusiness(mine)) {
      const own = String(mine.shareSlug || '').trim()
      if (own) return own
    }
  }
  const viewed = loadViewedProfile()
  if (viewed && !isTableBusiness(viewed)) {
    const share = String(viewed.shareSlug || '').trim()
    if (share) return share
  }
  return String(loadProfile().shareSlug || '').trim()
}

/** Map leftover /me and /catalog links onto the slug being browsed. */
export function slugForLegacyPersonalRedirect(path) {
  if (path === '/me' && isLoggedIn()) {
    const mine = loadProfile()
    if (!isTableBusiness(mine)) return String(mine.shareSlug || '').trim()
    return ''
  }
  const viewed = loadViewedProfile()
  if (viewed && !isTableBusiness(viewed)) {
    const share = String(viewed.shareSlug || '').trim()
    if (share) return share
  }
  if (isLoggedIn()) {
    const mine = loadProfile()
    if (!isTableBusiness(mine)) return String(mine.shareSlug || '').trim()
  }
  return ''
}

export async function ensureViewedProfileFromSlug(serial) {
  const code = String(serial || '').trim()
  if (!code) return loadPublicProfile()
  const viewed = loadViewedProfile()
  if (viewed && String(viewed.shareSlug || '').toLowerCase() === code.toLowerCase()) {
    return viewed
  }
  try {
    const remote = await apiResolveCard(code)
    if (remote?.ok && remote.profile && !isTableBusiness(remote.profile)) {
      setViewedProfile({ ...remote.profile, shareSlug: remote.card?.slug || code })
    }
  } catch {
    /* keep whatever is already in session */
  }
  return loadPublicProfile()
}
