import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './style.css'
import { apiReportClientError } from './lib/api'
import { capturePosthogException, initPosthog } from './lib/posthog'

initPosthog()

function reportUnhandled(message, stack, context = {}) {
  try {
    apiReportClientError({
      source: 'client',
      message: String(message || 'Unhandled client error').slice(0, 4000),
      stack: String(stack || '').slice(0, 8000),
      path: typeof window !== 'undefined' ? window.location.pathname : '',
      context: { kind: 'unhandled', ...context }
    }).catch(() => {})
  } catch {
    /* ignore */
  }
}

const app = createApp(App)

app.config.errorHandler = (err, instance, info) => {
  console.error(err)
  capturePosthogException(err)
  reportUnhandled(err?.message || String(err), err?.stack || '', {
    vueInfo: String(info || ''),
    component: instance?.$options?.name || instance?.type?.name || ''
  })
}

if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    reportUnhandled(event?.message || 'window.error', event?.error?.stack || '', {
      filename: event?.filename || '',
      lineno: event?.lineno || 0,
      colno: event?.colno || 0
    })
  })
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason
    reportUnhandled(
      reason?.message || String(reason || 'unhandledrejection'),
      reason?.stack || '',
      { kind: 'unhandledrejection' }
    )
  })
}

app.use(router).mount('#app')
