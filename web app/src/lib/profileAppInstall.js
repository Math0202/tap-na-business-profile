import { API_BASE } from './api'
import { absoluteUrl } from './shareHelpers'

let deferredInstallPrompt = null
const installPromptWaiters = []

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredInstallPrompt = event
    // #region agent log
    fetch('http://127.0.0.1:7629/ingest/a3538da8-2f3f-4210-a162-410aee0f17a2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'61b56f'},body:JSON.stringify({sessionId:'61b56f',runId:'pre-fix',hypothesisId:'A',location:'profileAppInstall.js:beforeinstallprompt',message:'beforeinstallprompt fired',data:{path:window.location.pathname,hasPrompt:!!event},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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
export async function prepareProfileAppInstall({ slug, avatar, name, company }) {
  const manifestUrl = profileManifestUrl(slug)
  if (!manifestUrl) {
    // #region agent log
    fetch('http://127.0.0.1:7629/ingest/a3538da8-2f3f-4210-a162-410aee0f17a2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'61b56f'},body:JSON.stringify({sessionId:'61b56f',runId:'pre-fix',hypothesisId:'B',location:'profileAppInstall.js:prepare',message:'prepare missing slug',data:{slug:String(slug||'')},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return { ok: false, error: 'Missing profile link.' }
  }

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

  const appTitle = String(company || name || '').trim()
  if (appTitle) document.title = `${appTitle} — tap-na`

  let swOk = false
  let swError = ''
  let manifestStatus = 0
  let manifestBody = null
  try {
    const mfRes = await fetch(manifestUrl, { credentials: 'omit' })
    manifestStatus = mfRes.status
    if (mfRes.ok) {
      manifestBody = await mfRes.json().catch(() => null)
    }
  } catch (err) {
    manifestStatus = -1
    // #region agent log
    fetch('http://127.0.0.1:7629/ingest/a3538da8-2f3f-4210-a162-410aee0f17a2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'61b56f'},body:JSON.stringify({sessionId:'61b56f',runId:'pre-fix',hypothesisId:'E',location:'profileAppInstall.js:prepare',message:'manifest fetch threw',data:{manifestUrl,error:String(err&&err.message||err)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }

  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('/profile-sw.js', { scope: '/' })
      await navigator.serviceWorker.ready
      swOk = !!reg
      // Nudge Chrome to re-check installability after SW is ready.
      if (manifestLink?.href) {
        const url = new URL(manifestUrl, window.location.origin)
        url.searchParams.set('v', String(Date.now()))
        manifestLink.href = url.toString()
      }
    } catch (err) {
      swError = String(err && err.message ? err.message : err)
      /* install may still work on some browsers */
    }
  }

  // #region agent log
  fetch('http://127.0.0.1:7629/ingest/a3538da8-2f3f-4210-a162-410aee0f17a2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'61b56f'},body:JSON.stringify({sessionId:'61b56f',runId:'post-fix',hypothesisId:'A,B,E',location:'profileAppInstall.js:prepare',message:'prepare done',data:{slug:String(slug||''),path:window.location.pathname,manifestUrl,manifestStatus,manifestScope:manifestBody&&manifestBody.scope,manifestStart:manifestBody&&manifestBody.start_url,icon0:manifestBody&&manifestBody.icons&&manifestBody.icons[0]&&manifestBody.icons[0].src,safeIcon,swOk,swError,hasDeferredPrompt:!!deferredInstallPrompt,displayMode:window.matchMedia('(display-mode: standalone)').matches,controller:!!(navigator.serviceWorker&&navigator.serviceWorker.controller)},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  return { ok: true }
}

/** Show the native Install / Cancel dialog when Chrome has made it available. */
export async function promptProfileAppInstall(opts = {}) {
  const timeoutMs = Number(opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : 2500
  let prompt = deferredInstallPrompt
  // #region agent log
  fetch('http://127.0.0.1:7629/ingest/a3538da8-2f3f-4210-a162-410aee0f17a2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'61b56f'},body:JSON.stringify({sessionId:'61b56f',runId:'post-fix',hypothesisId:'A,C',location:'profileAppInstall.js:prompt:start',message:'prompt start',data:{hadDeferred:!!prompt,timeoutMs,ua:navigator.userAgent.slice(0,120),path:window.location.pathname,android:isAndroidDevice()},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (!prompt) {
    prompt = await waitForInstallPrompt(timeoutMs)
  }

  if (prompt) {
    prompt.prompt()
    const choice = await prompt.userChoice
    deferredInstallPrompt = null
    // #region agent log
    fetch('http://127.0.0.1:7629/ingest/a3538da8-2f3f-4210-a162-410aee0f17a2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'61b56f'},body:JSON.stringify({sessionId:'61b56f',runId:'post-fix',hypothesisId:'A',location:'profileAppInstall.js:prompt:native',message:'native prompt completed',data:{outcome:choice&&choice.outcome},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return { ok: true, method: 'install', outcome: choice?.outcome || '' }
  }

  if (isIosDevice()) {
    // #region agent log
    fetch('http://127.0.0.1:7629/ingest/a3538da8-2f3f-4210-a162-410aee0f17a2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'61b56f'},body:JSON.stringify({sessionId:'61b56f',runId:'post-fix',hypothesisId:'C',location:'profileAppInstall.js:prompt:ios',message:'fallback ios manual',data:{},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return { ok: true, method: 'manual', isIos: true, isAndroid: false }
  }

  // #region agent log
  fetch('http://127.0.0.1:7629/ingest/a3538da8-2f3f-4210-a162-410aee0f17a2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'61b56f'},body:JSON.stringify({sessionId:'61b56f',runId:'post-fix',hypothesisId:'C',location:'profileAppInstall.js:prompt:unavailable',message:'install unavailable no dialog',data:{isAndroid:isAndroidDevice()},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  return { ok: true, method: 'unavailable', isIos: false, isAndroid: isAndroidDevice() }
}

/** @deprecated Use prepareProfileAppInstall + promptProfileAppInstall */
export async function installProfileApp(opts) {
  await prepareProfileAppInstall(opts)
  return promptProfileAppInstall()
}
