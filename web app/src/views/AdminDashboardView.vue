<script setup>
import { computed, ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import BrandMark from '../components/BrandMark.vue'
import AdminBottomNav from '../components/AdminBottomNav.vue'
import { apiAdminOverview } from '../lib/api'

const loading = ref(true)
const loadError = ref('')
const profiles = ref([])
const cards = ref([])
const query = ref('')
const tab = ref('all') // all | personal | business

async function refresh() {
  loading.value = true
  loadError.value = ''
  const res = await apiAdminOverview()
  if (res.ok && res.data?.ok) {
    profiles.value = res.data.profiles || []
    cards.value = res.data.cards || []
  } else {
    loadError.value = res.error || 'Could not load live data'
  }
  loading.value = false
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
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  } catch {
    return '—'
  }
}

onMounted(() => {
  document.title = 'Admin dashboard - tap-na'
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
          Live overview of every profile and slug on the platform
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

      <!-- KPI strip -->
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

      <!-- Filters -->
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

      <!-- States -->
      <div v-if="loading" class="card-item-bg rounded-2xl p-6 text-sm text-gray-400 text-center">
        Loading live data…
      </div>
      <div v-else-if="loadError" class="card-item-bg rounded-2xl p-6 text-sm text-amber-300">
        {{ loadError }}. Check your connection and hit Refresh.
      </div>
      <div v-else-if="!filtered.length" class="card-item-bg rounded-2xl p-6 text-sm text-gray-400">
        No profiles match this filter.
      </div>

      <!-- Profiles grid: 3 cols mobile, 6 cols desktop; tiles centered -->
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

      <div class="flex flex-wrap items-center gap-3 pt-2 border-t border-[var(--border)]">
        <RouterLink to="/about" class="text-xs font-semibold text-gray-500 hover:text-gray-300">
          About tap-na
        </RouterLink>
      </div>
    </main>

    <AdminBottomNav />
  </div>
</template>
