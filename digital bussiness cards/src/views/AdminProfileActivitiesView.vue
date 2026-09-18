<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import BrandMark from '../components/BrandMark.vue'
import AdminBottomNav from '../components/AdminBottomNav.vue'
import ActivityCharts from '../components/ActivityCharts.vue'
import { apiAdminProfileActivities } from '../lib/api'

const route = useRoute()
const loading = ref(true)
const error = ref('')
const profile = ref(null)
const stats = ref(null)
const analytics = ref(null)
const activities = ref([])
const connections = ref(0)
const filter = ref('all') // all | open | click | share
const days = ref(30)

const profileId = computed(() => String(route.params.id || ''))

const label = computed(() => {
  const p = profile.value
  if (!p) return 'Profile'
  if (p.cardType === 'table') return p.company || p.name || 'Venue'
  return p.name || 'Profile'
})

const filtered = computed(() => {
  const list = activities.value || []
  if (filter.value === 'open') return list.filter((a) => a.action === 'open')
  if (filter.value === 'share') return list.filter((a) => String(a.action).startsWith('share'))
  if (filter.value === 'click') return list.filter((a) => String(a.action).startsWith('click'))
  return list
})

function formatWhen(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  } catch {
    return '—'
  }
}

function actionLabel(action) {
  const a = String(action || 'open')
  if (a === 'open') return 'Card open'
  if (a.startsWith('share:')) return 'Share · ' + a.slice(6)
  if (a.startsWith('share')) return 'Share'
  if (a.startsWith('click:')) return 'Click · ' + a.slice(6)
  if (a.startsWith('click')) return 'Click'
  return a
}

function actionIcon(action) {
  const a = String(action || '')
  if (a === 'open') return 'touch_app'
  if (a.startsWith('share')) return 'ios_share'
  if (a.includes('phone')) return 'call'
  if (a.includes('email') || a.includes('mail')) return 'mail'
  if (a.includes('whatsapp')) return 'chat'
  if (a.includes('instagram')) return 'photo_camera'
  if (a.includes('tiktok')) return 'music_note'
  if (a.includes('website') || a.includes('menu') || a.includes('review')) return 'link'
  return 'ads_click'
}

function channelLabel(ch) {
  if (ch === 'qr') return 'QR'
  if (ch === 'nfc') return 'NFC tap'
  return 'Web / other'
}

function place(a) {
  return [a.city, a.region, a.country].filter(Boolean).join(', ') || 'Unknown location'
}

async function refresh() {
  loading.value = true
  error.value = ''
  const res = await apiAdminProfileActivities(profileId.value, { days: days.value })
  if (res.ok && res.data?.ok) {
    profile.value = res.data.profile
    stats.value = res.data.stats
    analytics.value = res.data.analytics || null
    activities.value = res.data.activities || []
    connections.value = Number(res.data.connections || 0)
  } else {
    error.value = res.error || 'Could not load activities'
  }
  loading.value = false
}

watch(days, () => {
  refresh()
})

onMounted(() => {
  document.title = 'Profile activities - Admin'
  refresh()
})
</script>

<template>
  <div class="min-h-screen flex flex-col items-center overflow-x-hidden">
    <main class="w-full max-w-3xl min-h-screen flex flex-col relative z-10 px-5 pt-16 pb-36">
      <header class="mb-5">
        <BrandMark size="sm" class="mb-2" />
        <div class="flex items-start justify-between gap-3 flex-wrap">
          <div class="min-w-0">
            <p class="text-xs text-gray-500 uppercase tracking-wide">Admin · Activities</p>
            <h1 class="text-2xl font-bold tracking-tight mt-1 truncate">{{ label }}</h1>
            <p class="text-gray-400 text-sm mt-1">
              Charts for taps, scans, clicks, shares &amp; location
            </p>
          </div>
          <div class="flex gap-2 flex-wrap">
            <RouterLink
              :to="`/admin/profiles/${encodeURIComponent(profileId)}`"
              class="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-[var(--border)] text-xs font-semibold no-underline hover:text-white"
            >
              <span class="material-symbols-outlined text-[16px]">edit</span>
              Edit
            </RouterLink>
            <button
              type="button"
              class="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-[var(--border)] text-xs font-semibold hover:text-white"
              @click="refresh"
            >
              <span class="material-symbols-outlined text-[16px]">refresh</span>
              Refresh
            </button>
          </div>
        </div>
      </header>

      <div class="flex gap-2 mb-5 overflow-x-auto pb-1">
        <button
          v-for="d in [7, 30, 90]"
          :key="d"
          type="button"
          class="px-3.5 py-2 rounded-full text-xs font-semibold border shrink-0"
          :class="days === d ? 'bg-white text-black border-white' : 'border-[var(--border)] text-gray-400'"
          @click="days = d"
        >
          {{ d }} days
        </button>
      </div>

      <div v-if="loading" class="card-item-bg rounded-2xl p-6 text-sm text-gray-400 text-center">
        Loading activities…
      </div>
      <div v-else-if="error" class="card-item-bg rounded-2xl p-6 text-sm text-amber-300">
        {{ error }}
      </div>
      <template v-else>
        <section class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div class="card-item-bg rounded-2xl p-4">
            <p class="text-[11px] uppercase tracking-wide text-gray-500">Total</p>
            <p class="text-2xl font-bold mt-1">{{ stats?.total || 0 }}</p>
          </div>
          <div class="card-item-bg rounded-2xl p-4">
            <p class="text-[11px] uppercase tracking-wide text-gray-500">Opens</p>
            <p class="text-2xl font-bold mt-1 text-emerald-300">{{ stats?.opens || 0 }}</p>
          </div>
          <div class="card-item-bg rounded-2xl p-4">
            <p class="text-[11px] uppercase tracking-wide text-gray-500">Clicks</p>
            <p class="text-2xl font-bold mt-1 text-sky-300">{{ stats?.clicks || 0 }}</p>
          </div>
          <div class="card-item-bg rounded-2xl p-4">
            <p class="text-[11px] uppercase tracking-wide text-gray-500">Shares</p>
            <p class="text-2xl font-bold mt-1 text-violet-300">{{ stats?.shares || 0 }}</p>
          </div>
        </section>

        <ActivityCharts
          class="mb-6"
          :analytics="analytics"
          :connections="connections"
          :days="days"
        />

        <p class="text-xs text-gray-500 font-mono mb-4">
          Card IDs: {{ (profile?.slugs || []).map((s) => s.slug).join(' · ') || 'None' }}
        </p>

        <div class="flex gap-2 mb-4 overflow-x-auto pb-1">
          <button
            v-for="t in [
              { id: 'all', label: 'All' },
              { id: 'open', label: 'Opens' },
              { id: 'click', label: 'Clicks' },
              { id: 'share', label: 'Shares' }
            ]"
            :key="t.id"
            type="button"
            class="px-3.5 py-2 rounded-full text-xs font-semibold border shrink-0"
            :class="filter === t.id ? 'bg-white text-black border-white' : 'border-[var(--border)] text-gray-400'"
            @click="filter = t.id"
          >
            {{ t.label }}
          </button>
        </div>

        <section v-if="!filtered.length" class="card-item-bg rounded-2xl p-6 text-sm text-gray-400">
          No activity recorded yet for this profile in the selected period.
        </section>
        <section v-else class="space-y-2 mb-8">
          <article
            v-for="a in filtered"
            :key="a.id"
            class="card-item-bg rounded-2xl p-4 flex gap-3"
          >
            <div class="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
              <span class="material-symbols-outlined text-[20px]">{{ actionIcon(a.action) }}</span>
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-start justify-between gap-2">
                <p class="font-semibold text-sm">{{ actionLabel(a.action) }}</p>
                <p class="text-[11px] text-gray-500 shrink-0">{{ formatWhen(a.at) }}</p>
              </div>
              <p class="text-xs text-gray-400 mt-1">
                {{ channelLabel(a.channel) }}
                · {{ a.device || 'device?' }}
                · {{ a.browser || 'browser?' }}
              </p>
              <p class="text-xs text-gray-500 mt-0.5">{{ place(a) }}</p>
              <p class="text-[11px] font-mono text-sky-300/80 mt-1 truncate">Card ID {{ a.slug || '—' }}</p>
            </div>
          </article>
        </section>

        <RouterLink to="/admin?panel=analytics" class="text-xs font-semibold text-gray-500 hover:text-gray-300">
          ← Analytics overview
        </RouterLink>
      </template>
    </main>
    <AdminBottomNav />
  </div>
</template>
