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
  downloadCsv,
  resetVenueCustomerDemo
} from '../lib/venueCustomerStore'
import {
  loadProfile,
  isTableBusiness,
  isLoggedIn
} from '../lib/profileStore'
import { apiListCheckins, apiListFeedback, apiVenueStats, getApiToken } from '../lib/api'
import { formatAnswersLine } from '../lib/venueForms'

const router = useRouter()
const profile = ref(loadProfile())
const tab = ref('checkins') // checkins | feedback
const query = ref('')
const checkins = ref([])
const feedback = ref([])
const stats = ref(getVenueCustomerStats())
const toast = ref('')
const loadingRemote = ref(false)

function flash(msg) {
  toast.value = msg
  setTimeout(() => { toast.value = '' }, 2200)
}

async function refresh() {
  profile.value = loadProfile()
  checkins.value = listCheckins()
  feedback.value = listFeedback()
  stats.value = getVenueCustomerStats()

  // Prefer live Supabase data when logged into the API
  if (!getApiToken()) return
  loadingRemote.value = true
  try {
    const [ci, fb, st] = await Promise.all([
      apiListCheckins(),
      apiListFeedback(),
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
        at: c.created_at
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
        at: f.created_at
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

const filteredCheckins = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return checkins.value
  return checkins.value.filter((c) =>
    [c.name, c.contact, c.event, c.venue].join(' ').toLowerCase().includes(q)
  )
})

const filteredFeedback = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return feedback.value
  return feedback.value.filter((f) =>
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

function removeCheckin(id) {
  if (!confirm('Delete this check-in?')) return
  deleteCheckin(id)
  refresh()
  flash('Check-in deleted')
}

function removeFeedback(id) {
  if (!confirm('Delete this feedback?')) return
  deleteFeedback(id)
  refresh()
  flash('Feedback deleted')
}

function reseeds() {
  resetVenueCustomerDemo()
  refresh()
  flash('Demo customer data restored')
}

onMounted(async () => {
  if (!isLoggedIn()) {
    router.replace({ path: '/login', query: { next: '/venue' } })
    return
  }
  await refresh()
  if (!isTableBusiness(profile.value)) {
    flash('This account is personal — venue dashboard is for business cards only')
  }
  document.title = 'Venue dashboard · ' + venueName.value
})
</script>

<template>
  <div class="min-h-screen flex flex-col items-center overflow-x-hidden">
    <main class="w-full max-w-3xl min-h-screen flex flex-col relative z-10 px-5 pt-16 pb-28">
      <header class="mb-6">
        <BrandMark size="sm" class="mb-3" />
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">{{ venueName }}</p>
        <h1 class="text-2xl font-bold tracking-tight mt-1">Venue dashboard</h1>
        <p class="text-gray-400 text-sm mt-1">
          View and export customer check-ins and feedback from your table cards
        </p>
        <div class="flex flex-wrap gap-2 mt-4">
          <RouterLink
            to="/business"
            class="px-4 py-2.5 rounded-full text-xs font-semibold border border-[var(--border)] no-underline text-inherit"
          >
            Public venue page
          </RouterLink>
          <RouterLink
            to="/profile"
            class="px-4 py-2.5 rounded-full text-xs font-semibold border border-[var(--border)] no-underline text-inherit"
          >
            Edit profile
          </RouterLink>
          <button
            type="button"
            class="px-4 py-2.5 rounded-full text-xs font-bold bg-white text-black"
            @click="exportAll"
          >
            Export all CSV
          </button>
        </div>
      </header>

      <section class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div class="card-item-bg rounded-2xl p-4">
          <p class="text-[11px] uppercase tracking-wide text-gray-500">Check-ins</p>
          <p class="text-2xl font-bold mt-1">{{ stats.checkins }}</p>
        </div>
        <div class="card-item-bg rounded-2xl p-4">
          <p class="text-[11px] uppercase tracking-wide text-gray-500">Guests</p>
          <p class="text-2xl font-bold mt-1">{{ stats.guests }}</p>
        </div>
        <div class="card-item-bg rounded-2xl p-4">
          <p class="text-[11px] uppercase tracking-wide text-gray-500">Feedback</p>
          <p class="text-2xl font-bold mt-1">{{ stats.feedback }}</p>
        </div>
        <div class="card-item-bg rounded-2xl p-4">
          <p class="text-[11px] uppercase tracking-wide text-gray-500">Avg rating</p>
          <p class="text-2xl font-bold mt-1">{{ stats.avgRating || '—' }}</p>
        </div>
      </section>

      <div class="flex gap-2 p-1 rounded-full card-item-bg w-fit mb-4">
        <button
          type="button"
          class="px-4 py-2 rounded-full text-xs font-semibold transition-colors"
          :class="tab === 'checkins' ? 'bg-white text-black' : 'text-gray-400'"
          @click="tab = 'checkins'; query = ''"
        >
          Check-ins
        </button>
        <button
          type="button"
          class="px-4 py-2 rounded-full text-xs font-semibold transition-colors"
          :class="tab === 'feedback' ? 'bg-white text-black' : 'text-gray-400'"
          @click="tab = 'feedback'; query = ''"
        >
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
        <button
          type="button"
          class="px-4 py-2.5 rounded-full text-xs font-bold bg-white text-black shrink-0"
          @click="exportCurrent"
        >
          Export this tab
        </button>
      </div>

      <section v-if="tab === 'checkins'" class="mb-8 space-y-2">
        <ul class="space-y-2">
          <li v-for="c in filteredCheckins" :key="c.id" class="card-item-bg rounded-2xl p-4 flex gap-3">
            <div class="w-10 h-10 rounded-full bg-emerald-500/15 text-emerald-300 flex items-center justify-center shrink-0">
              <span class="material-symbols-outlined text-[20px]">how_to_reg</span>
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold">{{ c.name }}</p>
              <p class="text-xs text-gray-400 mt-0.5">{{ c.contact || 'No contact' }}</p>
              <p class="text-[11px] text-gray-500 mt-1">
                {{ c.event }} · {{ c.guests }} guest{{ c.guests === 1 ? '' : 's' }} · {{ formatDate(c.at) }}
              </p>
              <p v-if="formatAnswersLine(c.answers)" class="text-[11px] text-gray-400 mt-1 leading-relaxed">
                {{ formatAnswersLine(c.answers) }}
              </p>
            </div>
            <button type="button" class="text-xs font-semibold text-red-400 shrink-0" @click="removeCheckin(c.id)">
              Delete
            </button>
          </li>
        </ul>
        <p v-if="!filteredCheckins.length" class="text-sm text-gray-500">No check-ins yet.</p>
      </section>

      <section v-else class="mb-8 space-y-2">
        <ul class="space-y-2">
          <li v-for="f in filteredFeedback" :key="f.id" class="card-item-bg rounded-2xl p-4 flex gap-3">
            <div class="w-10 h-10 rounded-full bg-amber-500/15 text-amber-300 flex items-center justify-center shrink-0 font-bold text-sm">
              {{ f.rating }}★
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold">{{ f.name }}</p>
              <p v-if="f.contact" class="text-xs text-gray-400 mt-0.5">{{ f.contact }}</p>
              <p class="text-xs text-gray-300 mt-1 leading-relaxed">{{ f.message || '—' }}</p>
              <p v-if="formatAnswersLine(f.answers)" class="text-[11px] text-gray-400 mt-1 leading-relaxed">
                {{ formatAnswersLine(f.answers) }}
              </p>
              <p class="text-[11px] text-gray-500 mt-1">{{ formatDate(f.at) }}</p>
            </div>
            <button type="button" class="text-xs font-semibold text-red-400 shrink-0" @click="removeFeedback(f.id)">
              Delete
            </button>
          </li>
        </ul>
        <p v-if="!filteredFeedback.length" class="text-sm text-gray-500">No feedback yet.</p>
      </section>

      <button type="button" class="text-xs font-semibold text-gray-500 hover:text-white underline underline-offset-2" @click="reseeds">
        Reset demo customer data
      </button>
    </main>

    <div
      v-if="toast"
      class="fixed left-1/2 -translate-x-1/2 bottom-8 z-[110] px-4 py-3 rounded-2xl bg-white text-black text-sm font-medium shadow-xl"
    >
      {{ toast }}
    </div>
  </div>
</template>
