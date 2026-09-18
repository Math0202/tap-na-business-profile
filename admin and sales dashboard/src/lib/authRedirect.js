/**
 * Post-login home paths for card owners and staff.
 */

import { isStaffAdmin, isStaffSalesTeam } from './staffAuth'

export function profileHomePath(cardType) {
  return cardType === 'table' ? '/venue' : '/profile'
}

export function staffHomePath() {
  if (isStaffAdmin()) return '/admin'
  if (isStaffSalesTeam()) return '/admin/sales'
  return '/admin'
}

/**
 * Pick a safe redirect after login.
 * @param {'profile'|'staff'} kind
 * @param {{ cardType?: string, next?: string }} opts
 */
export function resolvePostLoginPath(kind, opts = {}) {
  const next = typeof opts.next === 'string' ? opts.next.trim() : ''

  if (kind === 'staff') {
    if (next.startsWith('/admin') && next !== '/admin/login' && next !== '/login') {
      if (isStaffSalesTeam() && !next.startsWith('/admin/sales')) {
        return '/admin/sales'
      }
      return next
    }
    return staffHomePath()
  }

  // Card owner — never send to staff area
  if (next && !next.startsWith('/admin') && next !== '/login' && next !== '/shop/login') {
    return next
  }
  return profileHomePath(opts.cardType)
}