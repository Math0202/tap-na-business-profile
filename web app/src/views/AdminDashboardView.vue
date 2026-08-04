<script setup>
import { computed, ref, onMounted, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import BrandMark from '../components/BrandMark.vue'
import AdminBottomNav from '../components/AdminBottomNav.vue'
import {
  apiAdminOverview,
  apiSalesChangelog,
  apiAdminErrors,
  apiSalesFinance,
  apiSalesProducts,
  apiRestoreSalesAgent,
  apiRestoreSalesOrder,
  apiRestoreSalesQuote,
  apiRestoreSalesInvoice,
  apiRestoreSalesCash,
  apiRestoreSalesProduct
} from '../lib/api'
import { cardImageSrc } from '../lib/cardLinkStore'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const loadError = ref('')
const profiles = ref([])
const cards = ref([])
const query = ref('')
const tab = ref('all') // all | personal | business
const panel = ref('profiles') // profiles | log | errors | deleted

const changeLog = ref([])
const errorLog = ref([])
const errorSourceFilter = ref('')
const deletedItems = ref([])
const restoringId = ref('')

const panels = [
  { id: 'profiles', label: 'Profiles', icon: 'group' },
  { id: 'log', label: 'Log', icon: 'history' },
  { id: 'errors', label: 'Errors', icon: 'bug_report' },
  { id: 'deleted', label: 'Deleted', icon: 'delete' }
]

function panelFromRoute() {
  const p = String(route.query.panel || 'profiles').toLowerCase()
  return panels.some((x) => x.id === p) ? p : 'profiles'
}

async function setPanel(id) {
  panel.value = id
  const q = { ...route.query }
  if (id === 'profiles') delete q.panel
  else q.panel = id
  await router.replace({ query: q })
  await refresh()
}

async function refresh() {
  loading.value = true
  loadError.value = ''
  try {
    if (panel.value === 'profiles') {
      const res = await apiAdminOverview()
      if (res.ok && res.data?.ok) {
        profiles.value = res.data.profiles || []
        cards.value = res.data.cards || []
      } else {
        loadError.value = res.error || 'Could not load live data'
      }
    } else if (panel.value === 'log') {
      const logRes = await apiSalesChangelog({ limit: 200 })
      changeLog.value = logRes.ok ? (logRes.data?.changes || []) : []
      if (!logRes.ok) loadError.value = logRes.error || 'Could not load change log'
    } else if (panel.value === 'errors') {
      const errRes = await apiAdminErrors({
        limit: 200,
        source: errorSourceFilter.value || ''
      })
      errorLog.value = errRes.ok ? (errRes.data?.errors || []) : []
      if (!errRes.ok) loadError.value = errRes.error || 'Could not load error log'
    } else if (panel.value === 'deleted') {
      const [finRes, prodRes] = await Promise.all([
        apiSalesFinance(),
        apiSalesProducts({ includeInactive: true, includeDeleted: true })
      ])
      if (!finRes.ok) {
        loadError.value = finRes.error || 'Could not load deleted items'
        deletedItems.value = []
      } else {
        const data = finRes.data || {}
        const products = prodRes.ok ? (prodRes.data?.products || []) : []
        const rows = []
        for (const a of data.agents || []) {
          if (!a.deleted) continue
          rows.push({
            id: a.id,
            entityType: 'agent',
            label: a.name || a.id,
            meta: [a.email, a.phone].filter(Boolean).join(' · ') || 'Sales agent',
            deletedAt: a.deletedAt || '',
            deletedBy: a.deletedBy || ''
          })
        }
        for (const o of data.orders || []) {
          if (!o.deleted) continue
          rows.push({
            id: o.id,
            entityType: 'order',
            label: o.customerName || o.id,
            meta: `Sale · ${o.status || 'order'}`,
            deletedAt: o.deletedAt || '',
            deletedBy: o.deletedBy || ''
          })
        }
        for (const q of data.quotes || []) {
          if (!q.deleted) continue
          rows.push({
            id: q.id,
            entityType: 'quote',
            label: q.customerName || q.id,
            meta: 'Quote',
            deletedAt: q.deletedAt || '',
            deletedBy: q.deletedBy || ''
          })
        }
        for (const inv of data.invoices || []) {
          if (!inv.deleted) continue
          rows.push({
            id: inv.id,
            entityType: 'invoice',
            label: inv.customerName || inv.number || inv.id,
            meta: 'Invoice',
            deletedAt: inv.deletedAt || '',
            deletedBy: inv.deletedBy || ''
          })
        }
        for (const c of data.cashflow || []) {
          if (!c.deleted) continue
          rows.push({
            id: c.id,
            entityType: 'cash',
            label: c.category || c.note || c.id,
            meta: `${c.type || 'cash'} · ${c.amount ?? ''}`,
            deletedAt: c.deletedAt || '',
            deletedBy: c.deletedBy || ''
          })
        }
        for (const p of products) {
          if (!p.deleted) continue
          rows.push({
            id: p.id,
            entityType: 'product',
            label: p.name || p.id,
            meta: p.category || 'Product',
            deletedAt: p.deletedAt || '',
            deletedBy: p.deletedBy || ''
          })
        }
        rows.sort((a, b) => String(b.deletedAt || '').localeCompare(String(a.deletedAt || '')))
        deletedItems.value = rows
      }
    }
  } catch (err) {
    loadError.value = err?.message || 'Could not load data'
  }
  loading.value = false
}

async function restoreDeleted(item) {
  if (!item?.id || !item?.entityType) return
  restoringId.value = item.id
  const map = {
    agent: apiRestoreSalesAgent,
    order: apiRestoreSalesOrder,
    quote: apiRestoreSalesQuote,
    invoice: apiRestoreSalesInvoice,
    cash: apiRestoreSalesCash,
    product: apiRestoreSalesProduct
  }
  const fn = map[item.entityType]
  try {
    if (fn) await fn(item.id)
  } finally {
    restoringId.value = ''
    await refresh()
  }
}

const stats = computed(() => {
  const personal = profiles.value.filter((p) => p.cardType !== 'table')
  const business = profiles.value.filter((p) => p.cardType === 'table')
  const linked = cards.value.filter((c) => c.profileId)
  return {
    total: profiles.value.length,
    personal: personal.length,
    business: business.length,
    slugs: cards.value.length,
    linked: linked.length,
    unlinked: cards.value.length - linked.length
  }
})

function matchesQuery(p) {
  const q = query.value.trim().toLowerCase()
  if (!q) return true
  const hay = [
    p.name,
    p.company,
    p.title,
    p.email,
    p.phone,
    p.address,
    ...(p.slugs || []).map((s) => s.slug)
  ]
    .join(' ')
    .toLowerCase()
  return hay.includes(q)
}

const filtered = computed(() =>
  profiles.value.filter((p) => {
    if (tab.value === 'personal' && p.cardType === 'table') return false
    if (tab.value === 'business' && p.cardType !== 'table') return false
    return matchesQuery(p)
  })
)

function profileLabel(p) {
  if (p.cardType === 'table') return p.company || p.name || 'Unnamed venue'
  return p.name || 'Unnamed profile'
}

function profileMeta(p) {
  if (p.cardType === 'table') return p.title || p.address || 'Venue'
  return [p.title, p.company].filter(Boolean).join(' · ') || 'Personal card'
}

function profileThumb(p) {
  return (p.cardType === 'table' ? p.logo : p.avatar) || p.avatar || p.logo || ''
}

function profileCardImage(p) {
  const slug = p?.slugs?.[0]
  if (slug) return cardImageSrc(slug)
  return cardImageSrc({ kind: p?.cardType === 'table' ? 'table' : 'personal' })
}

function initials(p) {
  const label = profileLabel(p)
  return label
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase()
}

function firstSlug(p) {
  return p.slugs?.length ? p.slugs[0].slug : ''
}

function viewPath(p) {
  const s = firstSlug(p)
  return s ? `/c/${encodeURIComponent(s)}` : ''
}

function formatDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return '—'
  }
}

function formatJson(value) {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value || '')
  }
}

watch(
  () => route.query.panel,
  () => {
    panel.value = panelFromRoute()
  }
)

onMounted(() => {
  document.title = 'Admin dashboard - tap-na'
  panel.value = panelFromRoute()
  refresh()
})
</script>

<template>
  <div class="min-h-screen flex flex-col items-center overflow-x-hidden">
    <main class="w-full max-w-7xl min-h-screen flex flex-col relative z-10 px-5 pt-16 pb-36">
      <header class="mb-6">
        <BrandMark size="sm" class="mb-2" />
        <h1 class="text-2xl font-bold tracking-tight mt-1">Admin dashboard</h1>
        <p class="text-gray-400 text-sm mt-1">
          Live overview, audit log, errors, and deleted sales records
        </p>
        <div class="flex flex-wrap gap-2 mt-4">
          <button
            type="button"
            class="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-[var(--border)] text-xs font-semibold hover:text-white transition-colors"
            @click="refresh"
          >
            <span class="material-symbols-outlined text-[18px]">refresh</span>
            Refresh
          </button>
        </div>
      </header>

      <!-- Dashboard panels -->
      <div class="flex gap-2 overflow-x-auto pb-1 mb-6">
        <button
          v-for="p in panels"
          :key="p.id"
          type="button"
          class="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-full text-xs font-semibold border transition-colors shrink-0"
          :class="panel === p.id
            ? 'bg-white text-black border-white'
            : 'bg-transparent text-gray-400 border-[var(--border)] hover:text-white'"
          @click="setPanel(p.id)"
        >
          <span class="material-symbols-outlined text-[16px]">{{ p.icon }}</span>
          {{ p.label }}
        </button>
      </div>

      <!-- Profiles panel -->
      <template v-if="panel === 'profiles'">
        <section class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <div class="card-item-bg rounded-2xl p-4">
            <p class="text-[11px] uppercase tracking-wide text-gray-500">Profiles</p>
            <p class="text-2xl font-bold mt-1">{{ stats.total }}</p>
          </div>
          <div class="card-item-bg rounded-2xl p-4">
            <p class="text-[11px] uppercase tracking-wide text-gray-500">Personal</p>
            <p class="text-2xl font-bold mt-1">{{ stats.personal }}</p>
          </div>
          <div class="card-item-bg rounded-2xl p-4">
            <p class="text-[11px] uppercase tracking-wide text-gray-500">Businesses</p>
            <p class="text-2xl font-bold mt-1">{{ stats.business }}</p>
          </div>
          <div class="card-item-bg rounded-2xl p-4">
            <p class="text-[11px] uppercase tracking-wide text-gray-500">Slugs</p>
            <p class="text-2xl font-bold mt-1">{{ stats.slugs }}</p>
          </div>
          <div class="card-item-bg rounded-2xl p-4">
            <p class="text-[11px] uppercase tracking-wide text-gray-500">Linked</p>
            <p class="text-2xl font-bold mt-1 text-emerald-300">{{ stats.linked }}</p>
          </div>
          <div class="card-item-bg rounded-2xl p-4">
            <p class="text-[11px] uppercase tracking-wide text-gray-500">Unlinked</p>
            <p class="text-2xl font-bold mt-1 text-amber-300">{{ stats.unlinked }}</p>
          </div>
        </section>

        <div class="flex flex-col sm:flex-row gap-3 mb-6">
          <div class="field-shell flex-1 !rounded-2xl">
            <span class="material-symbols-outlined field-icon">search</span>
            <input
              v-model="query"
              type="search"
              class="field-input"
              placeholder="Search name, company, email, slug…"
            >
          </div>
          <div class="flex gap-2 shrink-0">
            <button
              v-for="t in [
                { id: 'all', label: 'All' },
                { id: 'personal', label: 'Personal' },
                { id: 'business', label: 'Business' }
              ]"
              :key="t.id"
              type="button"
              class="px-3.5 py-2.5 rounded-full text-xs font-semibold border transition-colors"
              :class="tab === t.id
                ? 'bg-white text-black border-white'
                : 'bg-transparent text-gray-400 border-[var(--border)] hover:text-white'"
              @click="tab = t.id"
            >
              {{ t.label }}
            </button>
          </div>
        </div>

        <div v-if="loading" class="card-item-bg rounded-2xl p-6 text-sm text-gray-400 text-center">
          Loading live data…
        </div>
        <div v-else-if="loadError" class="card-item-bg rounded-2xl p-6 text-sm text-amber-300">
          {{ loadError }}. Check your connection and hit Refresh.
        </div>
        <div v-else-if="!filtered.length" class="card-item-bg rounded-2xl p-6 text-sm text-gray-400">
          No profiles match this filter.
        </div>

        <section v-else class="grid grid-cols-3 lg:grid-cols-6 gap-3 mb-8 justify-items-center">
          <article
            v-for="p in filtered"
            :key="p.id"
            class="card-item-bg rounded-2xl p-3 w-full flex flex-col items-center text-center gap-2"
          >
            <img
              v-if="profileThumb(p)"
              :src="profileThumb(p)"
              alt=""
              class="w-14 h-14 lg:w-16 lg:h-16 object-cover shrink-0 bg-zinc-800"
              :class="p.cardType === 'table' ? 'rounded-2xl' : 'rounded-full'"
            >
            <div
              v-else
              class="w-14 h-14 lg:w-16 lg:h-16 shrink-0 bg-zinc-800 flex items-center justify-center text-sm font-bold text-gray-300"
              :class="p.cardType === 'table' ? 'rounded-2xl' : 'rounded-full'"
            >
              {{ initials(p) }}
            </div>

            <img
              :src="profileCardImage(p)"
              alt=""
              class="w-full max-w-[88px] h-12 object-contain"
            >

            <div class="min-w-0 w-full">
              <p class="font-semibold text-xs lg:text-sm leading-tight line-clamp-2 text-[var(--text)]">{{ profileLabel(p) }}</p>
              <p class="text-[10px] lg:text-xs text-gray-400 line-clamp-2 mt-0.5">{{ profileMeta(p) }}</p>
            </div>

            <div class="flex items-center justify-center gap-1 flex-wrap">
              <span
                class="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
                :class="p.cardType === 'table'
                  ? 'bg-sky-500/15 text-sky-300'
                  : 'bg-violet-500/15 text-violet-300'"
              >
                {{ p.cardType === 'table' ? 'Biz' : 'Personal' }}
              </span>
              <span
                class="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
                :class="p.disabled
                  ? 'bg-amber-500/15 text-amber-300'
                  : 'bg-emerald-500/15 text-emerald-300'"
              >
                {{ p.disabled ? 'Off' : 'Live' }}
              </span>
            </div>

            <div class="text-[10px] text-gray-500 space-y-0.5 w-full min-w-0">
              <p class="truncate">{{ p.email || 'No email' }}</p>
              <p class="font-mono text-sky-300/90 truncate">
                <template v-if="p.slugs?.length">
                  {{ p.slugs.map((s) => s.slug).join(' · ') }}
                </template>
                <template v-else>No slug</template>
              </p>
            </div>

            <div class="mt-auto w-full pt-1 space-y-1.5">
              <RouterLink
                v-if="viewPath(p)"
                :to="viewPath(p)"
                class="inline-flex items-center gap-1 w-full justify-center px-2 py-2 rounded-full bg-white text-black text-[10px] lg:text-xs font-bold no-underline hover:bg-gray-200 transition-colors"
              >
                <span class="material-symbols-outlined text-[16px]">visibility</span>
                View
              </RouterLink>
              <span
                v-else
                class="inline-flex items-center gap-1 w-full justify-center px-2 py-2 rounded-full border border-[var(--border)] text-[10px] lg:text-xs font-semibold text-gray-500"
              >
                No page
              </span>
              <RouterLink
                :to="`/admin/profiles/${encodeURIComponent(p.id)}/activities`"
                class="inline-flex items-center gap-1 w-full justify-center px-2 py-2 rounded-full border border-[var(--border)] text-[10px] lg:text-xs font-semibold no-underline hover:text-white transition-colors"
              >
                <span class="material-symbols-outlined text-[16px]">monitoring</span>
                Activity
              </RouterLink>
              <RouterLink
                :to="`/admin/profiles/${encodeURIComponent(p.id)}`"
                class="inline-flex items-center gap-1 w-full justify-center px-2 py-2 rounded-full border border-[var(--border)] text-[10px] lg:text-xs font-semibold no-underline hover:text-white transition-colors"
              >
                <span class="material-symbols-outlined text-[16px]">edit</span>
                Edit
              </RouterLink>
            </div>
          </article>
        </section>
      </template>

      <!-- Change log panel -->
      <section v-else-if="panel === 'log'" class="mb-8 space-y-4">
        <div>
          <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-400">Change log</h2>
          <p class="text-xs text-gray-500 mt-1">Create, update, delete, and restore actions across sales data.</p>
        </div>
        <div v-if="loading" class="card-item-bg rounded-2xl p-6 text-sm text-gray-400 text-center">Loading…</div>
        <div v-else-if="loadError" class="card-item-bg rounded-2xl p-6 text-sm text-amber-300">{{ loadError }}</div>
        <ul v-else class="space-y-2">
          <li v-for="entry in changeLog" :key="entry.id" class="card-item-bg rounded-2xl p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span
                    class="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                    :class="{
                      'bg-emerald-500/15 text-emerald-300': entry.action === 'create' || entry.action === 'restore',
                      'bg-sky-500/15 text-sky-300': entry.action === 'update',
                      'bg-red-500/15 text-red-300': entry.action === 'delete'
                    }"
                  >
                    {{ entry.action }}
                  </span>
                  <span class="text-[10px] uppercase tracking-wide text-gray-500">{{ entry.entityType }}</span>
                </div>
                <p class="text-sm font-semibold mt-1">{{ entry.summary || entry.entityLabel || entry.entityId }}</p>
                <p class="text-xs text-gray-400 mt-1">
                  {{ entry.actorName || entry.actorEmail || 'Unknown user' }}
                  <span v-if="entry.actorRole"> · {{ entry.actorRole }}</span>
                  <span v-if="entry.actorEmail && entry.actorName"> · {{ entry.actorEmail }}</span>
                </p>
              </div>
              <p class="text-[11px] text-gray-500 shrink-0 text-right">{{ formatDate(entry.at) }}</p>
            </div>
          </li>
        </ul>
        <p v-if="!loading && !loadError && !changeLog.length" class="text-sm text-gray-500">No changes logged yet.</p>
      </section>

      <!-- Errors panel -->
      <section v-else-if="panel === 'errors'" class="mb-8 space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-400">Error log</h2>
            <p class="text-xs text-gray-500 mt-1">Exceptions from API, database, email, and client requests.</p>
          </div>
          <select
            v-model="errorSourceFilter"
            class="field-shell field-input !py-2 !text-xs"
            @change="refresh()"
          >
            <option value="">All sources</option>
            <option value="supabase">supabase</option>
            <option value="api">api</option>
            <option value="email">email</option>
            <option value="client">client</option>
            <option value="staff">staff</option>
            <option value="sales_cash_sync">sales_cash_sync</option>
            <option value="og">og</option>
          </select>
        </div>
        <div v-if="loading" class="card-item-bg rounded-2xl p-6 text-sm text-gray-400 text-center">Loading…</div>
        <div v-else-if="loadError" class="card-item-bg rounded-2xl p-6 text-sm text-amber-300">{{ loadError }}</div>
        <ul v-else class="space-y-2">
          <li v-for="entry in errorLog" :key="entry.id" class="card-item-bg rounded-2xl p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-red-500/15 text-red-300">
                    {{ entry.source || 'error' }}
                  </span>
                  <span v-if="entry.httpStatus" class="text-[10px] uppercase tracking-wide text-gray-500">
                    HTTP {{ entry.httpStatus }}
                  </span>
                  <span v-if="entry.requestMethod || entry.requestPath" class="text-[10px] text-gray-500 truncate">
                    {{ entry.requestMethod }} {{ entry.requestPath }}
                  </span>
                </div>
                <p class="text-sm font-semibold mt-1 break-words">{{ entry.message }}</p>
                <p class="text-xs text-gray-400 mt-1">
                  {{ entry.actorEmail || entry.actorRole || 'System' }}
                  <span v-if="entry.actorRole && entry.actorEmail"> · {{ entry.actorRole }}</span>
                </p>
                <details v-if="entry.stack || (entry.context && Object.keys(entry.context).length)" class="mt-2">
                  <summary class="text-[11px] text-gray-500 cursor-pointer">Details</summary>
                  <pre v-if="entry.stack" class="mt-2 text-[10px] text-gray-400 whitespace-pre-wrap break-words max-h-40 overflow-auto">{{ entry.stack }}</pre>
                  <pre v-if="entry.context && Object.keys(entry.context).length" class="mt-2 text-[10px] text-gray-400 whitespace-pre-wrap break-words max-h-40 overflow-auto">{{ formatJson(entry.context) }}</pre>
                </details>
              </div>
              <p class="text-[11px] text-gray-500 shrink-0 text-right">{{ formatDate(entry.occurredAt) }}</p>
            </div>
          </li>
        </ul>
        <p v-if="!loading && !loadError && !errorLog.length" class="text-sm text-gray-500">No errors logged yet.</p>
      </section>

      <!-- Deleted panel -->
      <section v-else-if="panel === 'deleted'" class="mb-8 space-y-4">
        <div>
          <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-400">Deleted records</h2>
          <p class="text-xs text-gray-500 mt-1">Soft-deleted sales agents, orders, quotes, invoices, cash, and products. Restore anytime.</p>
        </div>
        <div v-if="loading" class="card-item-bg rounded-2xl p-6 text-sm text-gray-400 text-center">Loading…</div>
        <div v-else-if="loadError" class="card-item-bg rounded-2xl p-6 text-sm text-amber-300">{{ loadError }}</div>
        <ul v-else class="space-y-2">
          <li
            v-for="item in deletedItems"
            :key="item.entityType + ':' + item.id"
            class="card-item-bg rounded-2xl p-4 opacity-90"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-red-500/15 text-red-300">
                    {{ item.entityType }}
                  </span>
                  <span class="text-[10px] uppercase tracking-wide text-gray-500">Deleted</span>
                </div>
                <p class="text-sm font-semibold mt-1">{{ item.label }}</p>
                <p class="text-xs text-gray-400 mt-1">{{ item.meta }}</p>
                <p class="text-[11px] text-gray-500 mt-1">
                  {{ formatDate(item.deletedAt) }}
                  <span v-if="item.deletedBy"> · by {{ item.deletedBy }}</span>
                </p>
              </div>
              <button
                type="button"
                class="shrink-0 px-3 py-2 rounded-full text-xs font-semibold border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50"
                :disabled="restoringId === item.id"
                @click="restoreDeleted(item)"
              >
                {{ restoringId === item.id ? 'Restoring…' : 'Restore' }}
              </button>
            </div>
          </li>
        </ul>
        <p v-if="!loading && !loadError && !deletedItems.length" class="text-sm text-gray-500">No deleted records.</p>
      </section>

      <div class="flex flex-wrap items-center gap-3 pt-2 border-t border-[var(--border)]">
        <RouterLink to="/about" class="text-xs font-semibold text-gray-500 hover:text-gray-300">
          About tap-na
        </RouterLink>
        <RouterLink to="/admin/sales" class="text-xs font-semibold text-gray-500 hover:text-gray-300">
          Sales module
        </RouterLink>
      </div>
    </main>

    <AdminBottomNav />
  </div>
</template>
