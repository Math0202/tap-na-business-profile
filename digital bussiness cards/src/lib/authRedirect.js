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
 * Navigate after login.
 * - Staff: after successful staffLogin, land on admin.tapnam.com (except localhost).
 * - Profile / card owners: stay on (or return to) the public apex domain.
 */
export function navigateAfterLogin(router, kind, opts = {}) {
  const path = resolvePostLoginPath(kind, opts)
  // #region agent log
  if (typeof window !== 'undefined') {
    fetch('http://127.0.0.1:7629/ingest/a3538da8-2f3f-4210-a162-410aee0f17a2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'61b56f'},body:JSON.stringify({sessionId:'61b56f',runId:'pre-fix',hypothesisId:'E',location:'digital/authRedirect.js:navigateAfterLogin',message:'navigateAfterLogin',data:{kind,path,next:opts.next||'',host:window.location.hostname,href:window.location.href,adminHost:isAdminHost(),local:isLocalHost()},timestamp:Date.now()})}).catch(()=>{});
  }
  // #endregion
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
  // Profile / card owner — never stay on the staff host
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
