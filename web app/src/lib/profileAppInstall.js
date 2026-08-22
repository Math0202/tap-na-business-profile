import { API_BASE } from './api'
import { absoluteUrl } from './shareHelpers'

let deferredInstallPrompt = null
const installPromptWaiters = []

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredInstallPrompt = event
    while (installPromptWaiters.length) {
      const resolve = installPromptWaiters.shift()
      resolve(event)
    }
  })
}

export function profileManifestUrl(slug) {
  const code = String(slug || '').trim()
  if (!code) return ''
  const base = API_BASE || (typeof window !== 'undefined' ? window.location.origin : '')
  return `${base}/c/${encodeURIComponent(code)}/manifest.webmanifest`
}

export function isIosDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export function isAndroidDevice() {
  return /android/i.test(navigator.userAgent)
}

export function canInstallProfileApp() {
  return !!deferredInstallPrompt
}

function waitForInstallPrompt(timeoutMs = 2500) {
  if (deferredInstallPrompt) return Promise.resolve(deferredInstallPrompt)
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      const idx = installPromptWaiters.indexOf(done)
      if (idx >= 0) installPromptWaiters.splice(idx, 1)
      resolve(null)
    }, timeoutMs)
    function done(event) {
      clearTimeout(timer)
      resolve(event)
    }
    installPromptWaiters.push(done)
  })
}

/** Register manifest, icons, and service worker as early as possible (page load). */
export async function prepareProfileAppInstall({ slug, avatar, name }) {
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

  return { ok: true }
}

/** Show the native Install / Cancel dialog when Chrome has made it available. */
export async function promptProfileAppInstall() {
  let prompt = deferredInstallPrompt
  if (!prompt) {
    prompt = await waitForInstallPrompt(2500)
  }

  if (prompt) {
    prompt.prompt()
    const choice = await prompt.userChoice
    deferredInstallPrompt = null
    return { ok: true, method: 'install', outcome: choice?.outcome || '' }
  }

  if (isIosDevice()) {
    return { ok: true, method: 'manual', isIos: true, isAndroid: false }
  }

  return { ok: true, method: 'unavailable', isIos: false, isAndroid: isAndroidDevice() }
}

/** @deprecated Use prepareProfileAppInstall + promptProfileAppInstall */
export async function installProfileApp(opts) {
  await prepareProfileAppInstall(opts)
  return promptProfileAppInstall()
}
