/** Personal card tiers and team role hierarchy */

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
 * Roles allowed on a team, capped by the team owner's card type.
 * Professional owner -> professional only
 * Business owner -> business + professional
 * Executive owner -> all
 */
export function assignableRoles(ownerOrActorRole) {
  const rank = personalTypeRank(ownerOrActorRole)
  return PERSONAL_TYPE_IDS.filter((id) => personalTypeRank(id) <= rank)
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
