/**
 * Post-login home paths for card owners and staff.
 * Everyone signs in at tapnam.com/login; role decides where they go next.
 */

import { isStaffAdmin, isStaffLoggedIn, isStaffSalesTeam } from './staffAuth'
import {
  ADMIN_ORIGIN,
  TABLE_ORIGIN,
  adminAppUrl,
  isAdminHost,
  isLocalHost,
  publicLoginUrl
} from './hosts'
import { isLoggedIn, isTableBusiness, loadProfile } from './profileStore'

export function profileHomePath(cardType) {
  return cardType === 'table' ? '/venue' : '/profile'
}

export function staffHomePath() {
  if (isStaffAdmin()) return '/admin'
  if (isStaffSalesTeam()) return '/admin/sales'
  return '/admin'
}

export function loginRedirectTarget(next = '') {
  return publicLoginUrl(next)
}

/** Send the browser to the shared public login page. */
export function goToLogin(next = '') {
  const url = publicLoginUrl(next)
  // #region agent log
  if (typeof window !== 'undefined') {
    fetch('http://127.0.0.1:7629/ingest/a3538da8-2f3f-4210-a162-410aee0f17a2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b5200b'},body:JSON.stringify({sessionId:'b5200b',runId:'post-fix',hypothesisId:'F',location:'authRedirect.js:goToLogin',message:'redirect to public login',data:{next:String(next||''),url,host:window.location.hostname},timestamp:Date.now()})}).catch(()=>{});
  }
  // #endregion
  if (typeof window === 'undefined') return url
  if (url.startsWith('http')) {
    window.location.assign(url)
    return url
  }
  window.location.assign(url)
  return url
}

/**
 * Navigate after login.
 * - Staff → admin.tapnam.com
 * - Profile / card owners → public apex
 */
export function navigateAfterLogin(router, kind, opts = {}) {
  const path = resolvePostLoginPath(kind, opts)
  // #region agent log
  if (typeof window !== 'undefined') {
    fetch('http://127.0.0.1:7629/ingest/a3538da8-2f3f-4210-a162-410aee0f17a2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b5200b'},body:JSON.stringify({sessionId:'b5200b',runId:'post-fix',hypothesisId:'F',location:'authRedirect.js:navigateAfterLogin',message:'role-based post-login nav',data:{kind,path,next:opts.next||'',host:window.location.hostname,adminHost:isAdminHost(),staff:isStaffLoggedIn(),profile:isLoggedIn()},timestamp:Date.now()})}).catch(()=>{});
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
  if (isAdminHost()) {
    window.location.assign(TABLE_ORIGIN + path)
    return
  }
  router.push(path)
}

/**
 * Pick a safe redirect after login based on role.
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
  if (
    next &&
    !next.startsWith('/admin') &&
    next !== '/login' &&
    next !== '/shop/login' &&
    next !== '/admin/login'
  ) {
    return next
  }
  return profileHomePath(opts.cardType)
}

/** If a session already exists on the login page, continue by role. */
export function continueIfAlreadyLoggedIn(router, next = '') {
  if (isStaffLoggedIn()) {
    navigateAfterLogin(router, 'staff', { next })
    return true
  }
  if (isLoggedIn()) {
    const p = loadProfile()
    navigateAfterLogin(router, 'profile', {
      cardType: isTableBusiness(p) ? 'table' : 'personal',
      next
    })
    return true
  }
  return false
}

export { ADMIN_ORIGIN, publicLoginUrl }
