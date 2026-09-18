<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import BrandMark from '../components/BrandMark.vue'
import {
  listCheckins,
  listFeedback,
  getVenueCustomerStats,
  deleteCheckin,
  deleteFeedback,
  buildCheckinsCsv,
  buildFeedbackCsv,
  buildAllCustomersCsv,
  downloadCsv
} from '../lib/venueCustomerStore'
import {
  loadProfile,
  isTableBusiness,
  isLoggedIn,
  logoUrl
} from '../lib/profileStore'
import {
  apiListCheckins,
  apiListFeedback,
  apiVenueStats,
  apiDeleteCheckin,
  apiRestoreCheckin,
  apiDeleteFeedback,
  apiRestoreFeedback,
  getApiToken
} from '../lib/api'
import { formatAnswersLine } from '../lib/venueForms'

const router = useRouter()
const profile = ref(loadProfile())
const tab = ref('checkins')
const query = ref('')
const checkins = ref([])
const feedback = ref([])
const stats = ref(getVenueCustomerStats())
const toast = ref('')
const loadingRemote = ref(false)
const showDeleted = ref(false)

function flash(msg) {
  toast.value = msg
  setTimeout(() => { toast.value = '' }, 2200)
}

async function refresh() {
  profile.value = loadProfile()
  if (!getApiToken()) {
    checkins.value = listCheckins().map((c) => ({ ...c, deleted: false }))
    feedback.value = listFeedback().map((f) => ({ ...f, deleted: false }))
    stats.value = getVenueCustomerStats()
    return
  }
  loadingRemote.value = true
  try {
    const [ci, fb, st] = await Promise.all([
      apiListCheckins({ includeDeleted: true }),
      apiListFeedback({ includeDeleted: true }),
      apiVenueStats()
    ])
    if (ci.ok && ci.data?.checkins) {
      checkins.value = ci.data.checkins.map((c) => ({
        id: c.id,
        venue: c.venue,
        name: c.name,
        contact: c.contact || [c.phone, c.email].filter(Boolean).join(' · '),
        phone: c.phone || '',
        email: c.email || '',
        event: c.event,
        guests: c.guests,
        answers: c.answers || {},
        at: c.created_at,
        deleted: c.deleted === true,
        deletedAt: c.deletedAt || c.deleted_at || ''
      }))
    }
    if (fb.ok && fb.data?.feedback) {
      feedback.value = fb.data.feedback.map((f) => ({
        id: f.id,
        venue: f.venue,
        name: f.name,
        contact: f.contact || [f.phone, f.email].filter(Boolean).join(' · '),
        phone: f.phone || '',
        email: f.email || '',
        rating: f.rating,
        message: f.message,
        answers: f.answers || {},
        at: f.created_at,
        deleted: f.deleted === true,
        deletedAt: f.deletedAt || f.deleted_at || ''
      }))
    }
    if (st.ok && st.data?.stats) {
      stats.value = st.data.stats
    }
  } finally {
    loadingRemote.value = false
  }
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

const venueName = computed(
  () => profile.value.company || profile.value.name || 'Your venue'
)
const logo = computed(() => logoUrl(profile.value))

const filteredCheckins = computed(() => {
  const list = showDeleted.value
    ? checkins.value
    : checkins.value.filter((c) => !c.deleted)
  const q = query.value.trim().toLowerCase()
  if (!q) return list
  return list.filter((c) =>
    [c.name, c.contact, c.event, c.venue].join(' ').toLowerCase().includes(q)
  )
})

const filteredFeedback = computed(() => {
  const list = showDeleted.value
    ? feedback.value
    : feedback.value.filter((f) => !f.deleted)
  const q = query.value.trim().toLowerCase()
  if (!q) return list
  return list.filter((f) =>
    [f.name, f.contact, f.message, f.venue, String(f.rating)].join(' ').toLowerCase().includes(q)
  )
})

function exportCurrent() {
  const stamp = new Date().toISOString().slice(0, 10)
  if (tab.value === 'checkins') {
    downloadCsv(`tap-na-checkins-${stamp}.csv`, buildCheckinsCsv(filteredCheckins.value))
  } else {
    downloadCsv(`tap-na-feedback-${stamp}.csv`, buildFeedbackCsv(filteredFeedback.value))
  }
  flash('CSV downloaded')
}

function exportAll() {
  const stamp = new Date().toISOString().slice(0, 10)
  downloadCsv(`tap-na-customers-${stamp}.csv`, buildAllCustomersCsv())
  flash('All customer data exported')
}

async function removeCheckin(id) {
  if (!confirm('Mark this check-in as deleted? You can restore it later.')) return
  if (getApiToken()) {
    const res = await apiDeleteCheckin(id)
    if (!res.ok) {
      flash(res.error || 'Could not delete check-in')
      return
    }
  } else {
    deleteCheckin(id)
  }
  await refresh()
  flash('Check-in marked deleted')
}

async function restoreCheckin(id) {
  if (getApiToken()) {
    const res = await apiRestoreCheckin(id)
    if (!res.ok) {
      flash(res.error || 'Could not restore check-in')
      return
    }
  }
  await refresh()
  flash('Check-in restored')
}

async function removeFeedback(id) {
  if (!confirm('Mark this feedback as deleted? You can restore it later.')) return
  if (getApiToken()) {
    const res = await apiDeleteFeedback(id)
    if (!res.ok) {
      flash(res.error || 'Could not delete feedback')
      return
    }
  } else {
    deleteFeedback(id)
  }
  await refresh()
  flash('Feedback marked deleted')
}

async function restoreFeedback(id) {
  if (getApiToken()) {
    const res = await apiRestoreFeedback(id)
    if (!res.ok) {
      flash(res.error || 'Could not restore feedback')
      return
    }
  }
  await refresh()
  flash('Feedback restored')
}

onMounted(async () => {
  if (!isLoggedIn()) {
    router.replace({ path: '/login', query: { next: '/venue' } })
    return
  }
  await refresh()
  if (!isTableBusiness(profile.value)) {
    flash('This account is personal — switch to a business card to use this dashboard')
  }
  document.title = 'Dashboard · ' + venueName.value
})
</script>

<template>
  <div class="min-h-screen flex flex-col items-center overflow-x-hidden">
    <main class="w-full max-w-3xl min-h-screen flex flex-col relative z-10 px-5 pt-10 pb-32">
      <header class="mb-6">
        <div class="flex items-start gap-4">
          <div
            class="w-14 h-14 rounded-2xl overflow-hidden bg-zinc-800 border border-zinc-700 shrink-0 flex items-center justify-center"
          >
            <img v-if="logo" :src="logo" alt="" class="w-full h-full object-cover" />
            <span v-else class="material-symbols-outlined text-zinc-500 text-[28px]">storefront</span>
          </div>
          <div class="min-w-0 flex-1">
            <BrandMark size="sm" class="mb-2" />
            <p class="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-400/90">Business dashboard</p>
            <h1 class="text-2xl font-bold tracking-tight mt-0.5 truncate" :title="venueName">{{ venueName }}</h1>
            <p class="text-gray-400 text-sm mt-1">
              Guest check-ins, feedback, and exports — all in one place.
            </p>
          </div>
        </div>

        <div class="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            class="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-white text-black text-xs font-bold"
            @click="exportAll"
          >
            <span class="material-symbols-outlined text-[18px]">download</span>
            Export all CSV
          </button>
          <RouterLink
            to="/profile"
            class="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-zinc-600 text-xs font-semibold no-underline text-inherit"
          >
            <span class="material-symbols-outlined text-[18px]">tune</span>
            Guest popups
          </RouterLink>
        </div>
      </header>

      <section class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div class="rounded-2xl p-4 bg-gradient-to-br from-emerald-500/20 to-zinc-900 border border-emerald-500/20">
          <div class="flex items-center gap-2 text-emerald-300">
            <span class="material-symbols-outlined text-[18px]">how_to_reg</span>
            <p class="text-[11px] uppercase tracking-wide">Check-ins</p>
          </div>
          <p class="text-2xl font-bold mt-2">{{ stats.checkins }}</p>
        </div>
        <div class="rounded-2xl p-4 bg-gradient-to-br from-sky-500/20 to-zinc-900 border border-sky-500/20">
          <div class="flex items-center gap-2 text-sky-300">
            <span class="material-symbols-outlined text-[18px]">groups</span>
            <p class="text-[11px] uppercase tracking-wide">Guests</p>
          </div>
          <p class="text-2xl font-bold mt-2">{{ stats.guests }}</p>
        </div>
        <div class="rounded-2xl p-4 bg-gradient-to-br from-amber-500/20 to-zinc-900 border border-amber-500/20">
          <div class="flex items-center gap-2 text-amber-300">
            <span class="material-symbols-outlined text-[18px]">rate_review</span>
            <p class="text-[11px] uppercase tracking-wide">Feedback</p>
          </div>
          <p class="text-2xl font-bold mt-2">{{ stats.feedback }}</p>
        </div>
        <div class="rounded-2xl p-4 bg-gradient-to-br from-violet-500/15 to-zinc-900 border border-violet-500/20">
          <div class="flex items-center gap-2 text-violet-300">
            <span class="material-symbols-outlined text-[18px]">star</span>
            <p class="text-[11px] uppercase tracking-wide">Avg rating</p>
          </div>
          <p class="text-2xl font-bold mt-2">{{ stats.avgRating || '—' }}</p>
        </div>
      </section>

      <p v-if="loadingRemote" class="text-xs text-gray-500 mb-3 flex items-center gap-2">
        <span class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
        Syncing latest guest data…
      </p>

      <div class="flex gap-2 p-1 rounded-2xl card-item-bg mb-4">
        <button
          type="button"
          class="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors"
          :class="tab === 'checkins' ? 'bg-white text-black' : 'text-gray-400'"
          @click="tab = 'checkins'; query = ''"
        >
          <span class="material-symbols-outlined text-[16px]">how_to_reg</span>
          Check-ins
        </button>
        <button
          type="button"
          class="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors"
          :class="tab === 'feedback' ? 'bg-white text-black' : 'text-gray-400'"
          @click="tab = 'feedback'; query = ''"
        >
          <span class="material-symbols-outlined text-[16px]">rate_review</span>
          Feedback
        </button>
      </div>

      <div class="flex flex-col sm:flex-row gap-3 mb-4">
        <div class="field-shell flex-1 !rounded-2xl">
          <span class="material-symbols-outlined field-icon">search</span>
          <input
            v-model="query"
            type="search"
            class="field-input"
            :placeholder="tab === 'checkins' ? 'Search check-ins…' : 'Search feedback…'"
          >
        </div>
        <label class="inline-flex items-center gap-2 px-3 py-2.5 rounded-2xl text-xs text-gray-400 bg-zinc-900 border border-zinc-700 shrink-0">
          <input v-model="showDeleted" type="checkbox" class="rounded">
          Show deleted
        </label>
        <button
          type="button"
          class="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-bold bg-zinc-800 border border-zinc-600 shrink-0"
          @click="exportCurrent"
        >
          <span class="material-symbols-outlined text-[16px]">table</span>
          Export tab
        </button>
      </div>

      <section v-if="tab === 'checkins'" class="mb-8 space-y-2">
        <ul class="space-y-2">
          <li
            v-for="c in filteredCheckins"
            :key="c.id"
            class="card-item-bg rounded-2xl p-4 flex gap-3"
            :class="c.deleted ? 'opacity-60' : ''"
          >
            <div class="w-11 h-11 rounded-2xl bg-emerald-500/15 text-emerald-300 flex items-center justify-center shrink-0">
              <span class="material-symbols-outlined text-[22px]">how_to_reg</span>
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold">
                {{ c.name }}
                <span v-if="c.deleted" class="ml-2 text-[10px] uppercase tracking-wide text-red-300">Deleted</span>
              </p>
              <p class="text-xs text-gray-400 mt-0.5">{{ c.contact || 'No contact' }}</p>
              <p class="text-[11px] text-gray-500 mt-1">
                {{ c.event }} · {{ c.guests }} guest{{ c.guests === 1 ? '' : 's' }} · {{ formatDate(c.at) }}
              </p>
              <p v-if="formatAnswersLine(c.answers)" class="text-[11px] text-gray-400 mt-1 leading-relaxed">
                {{ formatAnswersLine(c.answers) }}
              </p>
            </div>
            <button
              v-if="!c.deleted"
              type="button"
              class="text-xs font-semibold text-red-400 shrink-0"
              @click="removeCheckin(c.id)"
            >
              Delete
            </button>
            <button
              v-else
              type="button"
              class="text-xs font-semibold text-emerald-300 shrink-0"
              @click="restoreCheckin(c.id)"
            >
              Restore
            </button>
          </li>
        </ul>
        <div v-if="!filteredCheckins.length" class="rounded-2xl border border-dashed border-zinc-700 px-6 py-10 text-center">
          <span class="material-symbols-outlined text-4xl text-zinc-600">event_available</span>
          <p class="text-sm font-semibold mt-3">No check-ins yet</p>
          <p class="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
            Turn on the check-in popup in Edit profile — it opens when guests visit your page.
          </p>
          <RouterLink to="/profile" class="inline-block mt-4 text-xs font-semibold underline underline-offset-2 text-gray-300">
            Configure check-in
          </RouterLink>
        </div>
      </section>

      <section v-else class="mb-8 space-y-2">
        <ul class="space-y-2">
          <li
            v-for="f in filteredFeedback"
            :key="f.id"
            class="card-item-bg rounded-2xl p-4 flex gap-3"
            :class="f.deleted ? 'opacity-60' : ''"
          >
            <div class="w-11 h-11 rounded-2xl bg-amber-500/15 text-amber-300 flex items-center justify-center shrink-0 font-bold text-sm">
              {{ f.rating || '—' }}★
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold">
                {{ f.name }}
                <span v-if="f.deleted" class="ml-2 text-[10px] uppercase tracking-wide text-red-300">Deleted</span>
              </p>
              <p v-if="f.contact" class="text-xs text-gray-400 mt-0.5">{{ f.contact }}</p>
              <p class="text-xs text-gray-300 mt-1 leading-relaxed">{{ f.message || '—' }}</p>
              <p v-if="formatAnswersLine(f.answers)" class="text-[11px] text-gray-400 mt-1 leading-relaxed">
                {{ formatAnswersLine(f.answers) }}
              </p>
              <p class="text-[11px] text-gray-500 mt-1">{{ formatDate(f.at) }}</p>
            </div>
            <button
              v-if="!f.deleted"
              type="button"
              class="text-xs font-semibold text-red-400 shrink-0"
              @click="removeFeedback(f.id)"
            >
              Delete
            </button>
            <button
              v-else
              type="button"
              class="text-xs font-semibold text-emerald-300 shrink-0"
              @click="restoreFeedback(f.id)"
            >
              Restore
            </button>
          </li>
        </ul>
        <div v-if="!filteredFeedback.length" class="rounded-2xl border border-dashed border-zinc-700 px-6 py-10 text-center">
          <span class="material-symbols-outlined text-4xl text-zinc-600">reviews</span>
          <p class="text-sm font-semibold mt-3">No feedback yet</p>
          <p class="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
            Enable the feedback popup so guests can rate their visit when they open your page.
          </p>
          <RouterLink to="/profile" class="inline-block mt-4 text-xs font-semibold underline underline-offset-2 text-gray-300">
            Configure feedback
          </RouterLink>
        </div>
      </section>
    </main>

    <div
      v-if="toast"
      class="fixed left-1/2 -translate-x-1/2 bottom-24 z-[110] px-4 py-3 rounded-2xl bg-white text-black text-sm font-medium shadow-xl"
    >
      {{ toast }}
    </div>
  </div>
</template>