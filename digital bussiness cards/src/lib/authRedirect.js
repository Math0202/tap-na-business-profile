/**
 * Host-separated auth.
 * - Card owners: tapnam.com/login → stay on tapnam.com
 * - Staff: admin.tapnam.com/login → stay on admin.tapnam.com
 * No cross-host login redirects.
 */

import { isStaffAdmin, isStaffLoggedIn, isStaffSalesTeam } from './staffAuth'
import { ADMIN_ORIGIN, isAdminHost, isLocalHost } from './hosts'
import { isLoggedIn, isTableBusiness, loadProfile } from './profileStore'

export function profileHomePath(cardType) {
  return cardType === 'table' ? '/venue' : '/profile'
}

export function staffHomePath() {
  if (isStaffAdmin()) return '/admin'
  if (isStaffSalesTeam()) return '/admin/sales'
  return '/admin'
}

function loginPath(next = '') {
  const raw = String(next || '').trim()
  const safe =
    raw &&
    raw.startsWith('/') &&
    !raw.startsWith('//') &&
    raw !== '/login' &&
    raw !== '/shop/login' &&
    raw !== '/admin/login'
      ? raw
      : ''
  return safe ? { path: '/login', query: { next: safe } } : { path: '/login' }
}

/** Same-host login only — never bounce between tapnam.com and admin.tapnam.com. */
export function goToLogin(routerOrNext, maybeNext) {
  const hasRouter = routerOrNext && typeof routerOrNext.push === 'function'
  const router = hasRouter ? routerOrNext : null
  const next = hasRouter ? maybeNext : routerOrNext
  const target = loginPath(next)
  // #region agent log
  if (typeof window !== 'undefined') {
    fetch('http://127.0.0.1:7629/ingest/a3538da8-2f3f-4210-a162-410aee0f17a2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b5200b'},body:JSON.stringify({sessionId:'b5200b',runId:'post-fix',hypothesisId:'G',location:'authRedirect.js:goToLogin',message:'same-host login redirect',data:{next:String(next||''),target,host:window.location.hostname,adminHost:isAdminHost()},timestamp:Date.now()})}).catch(()=>{});
  }
  // #endregion
  if (router) {
    router.replace(target)
    return target
  }
  if (typeof window !== 'undefined') {
    const q = target.query?.next ? `?next=${encodeURIComponent(target.query.next)}` : ''
    window.location.assign(`/login${q}`)
  }
  return target
}

/**
 * Navigate after login on the same host.
 * Staff must already be on admin.tapnam.com; owners on tapnam.com.
 */
export function navigateAfterLogin(router, kind, opts = {}) {
  const path = resolvePostLoginPath(kind, opts)
  // #region agent log
  if (typeof window !== 'undefined') {
    fetch('http://127.0.0.1:7629/ingest/a3538da8-2f3f-4210-a162-410aee0f17a2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b5200b'},body:JSON.stringify({sessionId:'b5200b',runId:'post-fix',hypothesisId:'G',location:'authRedirect.js:navigateAfterLogin',message:'same-host post-login nav',data:{kind,path,next:opts.next||'',host:window.location.hostname,adminHost:isAdminHost()},timestamp:Date.now()})}).catch(()=>{});
  }
  // #endregion
  router.push(path)
}

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

/**
 * Continue only for the role that belongs on this host.
 * Public host ignores staff sessions; admin host ignores profile sessions.
 */
export function continueIfAlreadyLoggedIn(router, next = '') {
  if (isAdminHost() || (isLocalHost() && String(next || '').startsWith('/admin'))) {
    if (isStaffLoggedIn()) {
      navigateAfterLogin(router, 'staff', { next })
      return true
    }
    return false
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

export { ADMIN_ORIGIN }
