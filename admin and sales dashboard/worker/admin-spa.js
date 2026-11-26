/**
 * tap-na-admin — static SPA for admin.tapnam.com only.
 * All /api calls should go to https://tapnam.com from the browser.
 * If a client still hits this host at /api, proxy (do not 302) so Authorization is kept.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const host = url.hostname.toLowerCase()

    if (host && host !== 'admin.tapnam.com' && !host.endsWith('.workers.dev')) {
      const next = new URL(request.url)
      next.protocol = 'https:'
      next.hostname = 'admin.tapnam.com'
      return Response.redirect(next.toString(), 302)
    }

    if (url.pathname === '/' || url.pathname === '') {
      const next = new URL(request.url)
      next.pathname = '/admin'
      return Response.redirect(next.toString(), 302)
    }

    if (url.pathname.startsWith('/api/')) {
      const next = new URL(request.url)
      next.protocol = 'https:'
      next.hostname = 'tapnam.com'
      const init = {
        method: request.method,
        headers: request.headers,
        redirect: 'follow'
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        init.body = request.body
      }
      return fetch(next.toString(), init)
    }

    const apexOnly =
      url.pathname.startsWith('/c/') ||
      url.pathname === '/c' ||
      url.pathname.startsWith('/shop') ||
      url.pathname === '/profile' ||
      url.pathname.startsWith('/profile/') ||
      url.pathname === '/venue' ||
      url.pathname.startsWith('/venue/')

    if (apexOnly) {
      const next = new URL(request.url)
      next.protocol = 'https:'
      next.hostname = 'tapnam.com'
      return Response.redirect(next.toString(), 302)
    }

    return env.ASSETS.fetch(request)
  }
}
