/**
 * tap-na-admin — static SPA for admin.tapnam.com only.
 * All /api calls go to https://tapnam.com from the browser (see src/lib/api.js).
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const host = url.hostname.toLowerCase()

    // #region agent log
    try {
      fetch('http://127.0.0.1:7629/ingest/a3538da8-2f3f-4210-a162-410aee0f17a2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '61b56f' },
        body: JSON.stringify({
          sessionId: '61b56f',
          runId: 'pre-fix',
          hypothesisId: 'A',
          location: 'admin-spa.js:fetch',
          message: 'admin worker request',
          data: { host, path: url.pathname, search: url.search },
          timestamp: Date.now()
        })
      }).catch(() => {})
    } catch (_) {}
    // #endregion

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

    const apexOnly =
      url.pathname.startsWith('/c/') ||
      url.pathname === '/c' ||
      url.pathname.startsWith('/shop') ||
      url.pathname === '/profile' ||
      url.pathname.startsWith('/profile/') ||
      url.pathname === '/venue' ||
      url.pathname.startsWith('/venue/') ||
      url.pathname.startsWith('/api/')

    if (apexOnly) {
      const next = new URL(request.url)
      next.protocol = 'https:'
      next.hostname = 'tapnam.com'
      return Response.redirect(next.toString(), 302)
    }

    return env.ASSETS.fetch(request)
  }
}
