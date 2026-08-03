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

export function normalizePersonalType(raw, { fallback = 'professional' } = {}) {
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
  return PERSONAL_TYPES[normalizePersonalType(id, { fallback: '' })]?.label || 'Professional'
}

export function personalTypeRank(id) {
  return PERSONAL_TYPES[normalizePersonalType(id, { fallback: 'professional' })]?.rank || 1
}

/** Actor can manage target if their tier is equal or higher. */
export function canManageRole(actorRole, targetRole) {
  return personalTypeRank(actorRole) >= personalTypeRank(targetRole)
}

/** Roles an actor is allowed to assign. */
export function assignableRoles(actorRole) {
  const rank = personalTypeRank(actorRole)
  return PERSONAL_TYPE_IDS.filter((id) => personalTypeRank(id) <= rank)
}

export function memberStatusLabel(status) {
  const map = {
    pending_claim: 'Awaiting claim',
    invited: 'Invite sent',
    active: 'Active',
    rejected: 'Declined'
  }
  return map[status] || status || '—'
}
