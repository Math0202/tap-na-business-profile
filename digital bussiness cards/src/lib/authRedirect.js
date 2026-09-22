/**
 * Post-login home paths for card owners and staff.
 */

import { isStaffAdmin, isStaffSalesTeam } from './staffAuth'
import { ADMIN_ORIGIN, TABLE_ORIGIN, adminAppUrl, isAdminHost, isLocalHost } from './hosts'

export function profileHomePath(cardType) {
  return cardType === 'table' ? '/venue' : '/profile'
}

export function staffHomePath() {
  if (isStaffAdmin()) return '/admin'
  if (isStaffSalesTeam()) return '/admin/sales'
  return '/admin'
}

/**
 * Navigate after login — staff always end on admin.tapnam.com (except localhost).
 * Card owners on the admin host are bounced back to apex.
 */
export function navigateAfterLogin(router, kind, opts = {}) {
  const path = resolvePostLoginPath(kind, opts)
  if (typeof window === 'undefined') {
    router.push(path)
    return
  }
  if (isLocalHost()) {
    router.push(path)
    return
  }
  if (kind === 'staff') {
    if (isAdminHost()) {
      router.push(path)
      return
    }
    window.location.assign(adminAppUrl(path))
    return
  }
  // Profile / card owner
  if (isAdminHost()) {
    window.location.assign(TABLE_ORIGIN + path)
    return
  }
  router.push(path)
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

export { ADMIN_ORIGIN }
