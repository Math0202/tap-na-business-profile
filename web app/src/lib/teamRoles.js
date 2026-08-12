/** Personal card tiers and team role hierarchy */

/** Physical card artwork by personal tier */
export const PERSONAL_CARD_IMAGES = {
  executive_exclusive: '/images/executive_black.png',
  business: '/images/business_charcoal.png',
  professional: '/images/professional_cobalt_blue.png'
}

/** Legacy sales / shop product ids for each personal tier */
export const PERSONAL_TYPE_PRODUCT_IDS = {
  executive_exclusive: 'black-card-front',
  business: 'black-card',
  professional: 'blue-card'
}

export function personalCardImageSrc(personalType) {
  const key = normalizePersonalType(personalType, { fallback: DEFAULT_PERSONAL_TYPE })
  return PERSONAL_CARD_IMAGES[key] || PERSONAL_CARD_IMAGES[DEFAULT_PERSONAL_TYPE]
}

export const PERSONAL_TYPES = {
  executive_exclusive: {
    id: 'executive_exclusive',
    label: 'Executive Exclusive',
    short: 'Executive',
    rank: 3
  },
  business: {
    id: 'business',
    label: 'Business',
    short: 'Business',
    rank: 2
  },
  professional: {
    id: 'professional',
    label: 'Professional',
    short: 'Professional',
    rank: 1
  }
}

export const PERSONAL_TYPE_IDS = Object.keys(PERSONAL_TYPES)

/** Default personal / team role */
export const DEFAULT_PERSONAL_TYPE = 'business'

export function normalizePersonalType(raw, { fallback = DEFAULT_PERSONAL_TYPE } = {}) {
  const key = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
  if (key === 'executive' || key === 'exclusive' || key === 'exec') {
    return 'executive_exclusive'
  }
  if (PERSONAL_TYPES[key]) return key
  return fallback || ''
}

export function personalTypeLabel(id) {
  return PERSONAL_TYPES[normalizePersonalType(id, { fallback: '' })]?.label || 'Business'
}

export function personalTypeRank(id) {
  return PERSONAL_TYPES[normalizePersonalType(id, { fallback: DEFAULT_PERSONAL_TYPE })]?.rank || 2
}

/** Actor can manage target if their tier is equal or higher. */
export function canManageRole(actorRole, targetRole) {
  return personalTypeRank(actorRole) >= personalTypeRank(targetRole)
}

/**
 * Roles allowed on a team, capped by package / highest seat (Option A).
 * Professional ceiling -> professional only
 * Business ceiling -> business + professional
 * Executive ceiling -> all
 */
export function assignableRoles(packageCeilingOrRole) {
  const rank = personalTypeRank(packageCeilingOrRole)
  return PERSONAL_TYPE_IDS.filter((id) => personalTypeRank(id) <= rank)
}

/** Highest role among a list of seat/member roles. */
export function packageCeilingFromRoles(roles) {
  let best = 'professional'
  for (const role of roles || []) {
    const id = normalizePersonalType(role, { fallback: '' })
    if (!id) continue
    if (personalTypeRank(id) > personalTypeRank(best)) best = id
  }
  return best
}

/**
 * Solo (Professional) hides Team. Business / Executive seats (or an existing team) unlock it.
 */
export function canAccessTeamFeatures(personalType, { hasTeam = false } = {}) {
  if (hasTeam) return true
  return personalTypeRank(personalType) >= personalTypeRank('business')
}

export function memberStatusLabel(status) {
  const map = {
    pending_claim: 'Awaiting claim',
    invited: 'Invite sent',
    active: 'Active',
    rejected: 'Declined'
  }
  return map[status] || status || '?'
}
