import { API_BASE } from './api'
import { absoluteUrl } from './shareHelpers'

let deferredInstallPrompt = null

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredInstallPrompt = event
  })
}

export function profileManifestUrl(slug) {
  const code = String(slug || '').trim()
  if (!code) return ''
  const base = API_BASE || (typeof window !== 'undefined' ? window.location.origin : '')
  return `${base}/c/${encodeURIComponent(code)}/manifest.webmanifest`
}

export async function installProfileApp({ slug, avatar, name }) {
  const manifestUrl = profileManifestUrl(slug)
  if (!manifestUrl) return { ok: false, error: 'Missing profile link.' }

  const iconHref = absoluteUrl(avatar, window.location.origin)
  const safeIcon =
    iconHref && !iconHref.startsWith('data:')
      ? iconHref
      : absoluteUrl('/personal.jpeg', window.location.origin)

  let manifestLink = document.querySelector('link[rel="manifest"]')
  if (!manifestLink) {
    manifestLink = document.createElement('link')
    manifestLink.rel = 'manifest'
    document.head.appendChild(manifestLink)
  }
  manifestLink.href = manifestUrl

  let appleIcon = document.querySelector('link[rel="apple-touch-icon"]')
  if (!appleIcon) {
    appleIcon = document.createElement('link')
    appleIcon.rel = 'apple-touch-icon'
    document.head.appendChild(appleIcon)
  }
  appleIcon.href = safeIcon

  if (name) document.title = `${name} — tap-na`

  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('/profile-sw.js', { scope: '/' })
    } catch {
      /* install may still work on some browsers */
    }
  }

  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt()
    const choice = await deferredInstallPrompt.userChoice
    deferredInstallPrompt = null
    return { ok: true, method: 'install', outcome: choice?.outcome || '' }
  }

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const isAndroid = /android/i.test(navigator.userAgent)
  return { ok: true, method: 'manual', isIos, isAndroid }
}
