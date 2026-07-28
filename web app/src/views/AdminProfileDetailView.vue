<script setup>
import { computed, ref, watch, onMounted } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import BrandMark from '../components/BrandMark.vue'
import AdminBottomNav from '../components/AdminBottomNav.vue'
import {
  profileThumb,
  profileLabel,
  profileMeta,
  activityIcon,
  CLICK_LABELS
} from '../lib/adminStore'
import {
  cardPublicUrl,
  kindLabel,
  kindIcon
} from '../lib/cardLinkStore'
import {
  apiAdminGetProfile,
  apiAdminUpdateProfile,
  apiAdminProfileActivities
} from '../lib/api'

const route = useRoute()
const router = useRouter()

const entry = ref(null)
const activities = ref([])
const clickRows = ref([])
const linkedCards = ref([])
const stats = ref({ visits: 0, shares: 0, clicks: 0, total: 0, checkIns: 0, feedback: 0 })
const tab = ref('activity') // activity | manage
const savedMsg = ref('')
const saveError = ref('')
const showDeleteConfirm = ref(false)
const toast = ref('')
const loading = ref(true)
const loadError = ref('')
const saving = ref(false)

const isBusiness = computed(() => entry.value?.cardType === 'table')

const form = ref({
  name: '',
  title: '',
  company: '',
  email: '',
  phone: '',
  whatsapp: '',
  website: '',
  address: '',
  menuUrl: '',
  googleReview: '',
  x: '',
  instagram: '',
  tiktok: '',
  linkedin: '',
  youtube: '',
  cardType: 'personal',
  disabled: false
})

const profileId = computed(() => String(route.params.id || ''))

const notFound = computed(() => !loading.value && !entry.value)

function formatDate(iso, withTime = false) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (withTime) {
      return d.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  } catch {
    return '—'
  }
}

function applyProfile(p) {
  entry.value = {
    id: p.id,
    cardType: p.cardType === 'table' ? 'table' : 'personal',
    name: p.name || '',
    title: p.title || '',
    company: p.company || '',
    email: p.email || '',
    phone: p.phone || '',
    whatsapp: p.whatsapp || '',
    linkedin: p.linkedin || '',
    youtube: p.youtube || '',
    x: p.x || '',
    instagram: p.instagram || '',
    tiktok: p.tiktok || '',
    website: p.website || '',
    address: p.address || '',
    menuUrl: p.menuUrl || '',
    googleReview: p.googleReview || '',
    checkInUrl: p.checkInUrl || '',
    feedbackUrl: p.feedbackUrl || '',
    avatar: p.avatar || '',
    logo: p.logo || '',
    shareSlug: p.shareSlug || '',
    remoteProfileId: p.id,
    createdAt: p.createdAt || '',
    updatedAt: p.updatedAt || '',
    disabled: !!p.disabled,
    deleted: false,
    local: false
  }
  linkedCards.value = (p.slugs || []).map((s) => ({
    serial: s.slug,
    kind: s.kind === 'personal' ? 'personal' : 'table',
    status: s.status || 'linked'
  }))
  form.value = {
    name: p.name || '',
    title: p.title || '',
    company: p.company || '',
    email: p.email || '',
    phone: p.phone || '',
    whatsapp: p.whatsapp || '',
    website: p.website || '',
    address: p.address || '',
    menuUrl: p.menuUrl || '',
    googleReview: p.googleReview || '',
    x: p.x || '',
    instagram: p.instagram || '',
    tiktok: p.tiktok || '',
    linkedin: p.linkedin || '',
    youtube: p.youtube || '',
    cardType: p.cardType === 'table' ? 'table' : 'personal',
    disabled: !!p.disabled
  }
  document.title = profileLabel(entry.value) + ' · Admin'
}

async function loadActivities() {
  const id = profileId.value
  if (!id) return
  const act = await apiAdminProfileActivities(id)
  if (!act.ok || !act.data) {
    activities.value = []
    clickRows.value = []
    stats.value = { visits: 0, shares: 0, clicks: 0, total: 0, checkIns: 0, feedback: 0 }
    return
  }
  const list = act.data.activities || []
  activities.value = list.slice(0, 40).map((a) => ({
    id: a.id,
    type: String(a.action || 'open').startsWith('click')
      ? 'click'
      : String(a.action || '').startsWith('share')
        ? 'share'
        : 'visit',
    label: a.action || 'open',
    detail: [a.slug, a.channel, a.device, a.city].filter(Boolean).join(' · '),
    at: a.at
  }))
  const clickMap = {}
  for (const a of list) {
    const action = String(a.action || '')
    if (!action.startsWith('click')) continue
    const key = action.includes(':') ? action.slice(action.indexOf(':') + 1) : action
    clickMap[key] = (clickMap[key] || 0) + 1
  }
  clickRows.value = Object.entries(clickMap)
    .map(([key, count]) => ({
      key,
      label: CLICK_LABELS[key] || key,
      count
    }))
    .sort((a, b) => b.count - a.count)
  const s = act.data.stats || {}
  stats.value = {
    visits: s.opens || 0,
    shares: s.shares || 0,
    clicks: s.clicks || 0,
    total: s.total || 0,
    checkIns: 0,
    feedback: 0
  }
}

async function load() {
  const id = profileId.value
  loading.value = true
  loadError.value = ''
  entry.value = null
  if (!id) {
    loading.value = false
    return
  }
  const res = await apiAdminGetProfile(id)
  if (!res.ok || !res.data?.profile) {
    loadError.value = res.error || 'Profile not found'
    loading.value = false
    return
  }
  applyProfile(res.data.profile)
  await loadActivities()
  loading.value = false
}

function refreshActivity() {
  loadActivities()
}

async function toggleStatus() {
  if (!entry.value || saving.value) return
  saving.value = true
  saveError.value = ''
  const res = await apiAdminUpdateProfile(entry.value.id, {
    disabled: !entry.value.disabled
  })
  saving.value = false
  if (!res.ok || !res.data?.profile) {
    saveError.value = res.error || 'Could not update status'
    return
  }
  applyProfile(res.data.profile)
  toast.value = entry.value.disabled ? 'Profile disabled' : 'Profile enabled'
  setTimeout(() => { toast.value = '' }, 2000)
}

async function saveManage(e) {
  e.preventDefault()
  if (!entry.value || saving.value) return
  saving.value = true
  savedMsg.value = ''
  saveError.value = ''
  const res = await apiAdminUpdateProfile(entry.value.id, {
    name: form.value.name,
    title: form.value.title,
    company: form.value.company,
    email: form.value.email,
    phone: form.value.phone,
    whatsapp: form.value.whatsapp,
    website: form.value.website,
    address: form.value.address,
    menuUrl: form.value.menuUrl,
    googleReview: form.value.googleReview,
    x: form.value.x,
    instagram: form.value.instagram,
    tiktok: form.value.tiktok,
    linkedin: form.value.linkedin,
    youtube: form.value.youtube,
    disabled: form.value.disabled
  })
  saving.value = false
  if (!res.ok || !res.data?.profile) {
    saveError.value = res.error || 'Could not save changes'
    return
  }
  applyProfile(res.data.profile)
  savedMsg.value = 'Changes saved'
  setTimeout(() => { savedMsg.value = '' }, 2000)
}

async function confirmDelete() {
  if (!entry.value || saving.value) return
  saving.value = true
  const res = await apiAdminUpdateProfile(entry.value.id, { disabled: true })
  saving.value = false
  showDeleteConfirm.value = false
  if (!res.ok) {
    saveError.value = res.error || 'Could not disable profile'
    return
  }
  router.replace('/admin')
}

function copySlugUrl(serial) {
  const card = linkedCards.value.find((c) => c.serial === serial)
  const url = cardPublicUrl(serial, undefined, { kind: card?.kind || (entry.value?.cardType === 'table' ? 'table' : 'personal') })
  navigator.clipboard?.writeText(url).then(
    () => {
      toast.value = 'Slug URL copied'
      setTimeout(() => { toast.value = '' }, 2000)
    },
    () => {
      toast.value = url
      setTimeout(() => { toast.value = '' }, 2000)
    }
  )
}

watch(profileId, load)
onMounted(load)
</script>

<template>
  <div class="min-h-screen flex flex-col items-center overflow-x-hidden">
    <main class="w-full max-w-3xl min-h-screen flex flex-col relative z-10 px-5 pt-16 pb-36">
      <div v-if="loading" class="card-item-bg rounded-2xl p-6 text-center text-sm text-gray-400">
        Loading profile…
      </div>

      <div v-else-if="notFound" class="card-item-bg rounded-2xl p-6 text-center">
        <span class="material-symbols-outlined text-4xl text-gray-500">person_off</span>
        <p class="font-semibold mt-2">Profile not found</p>
        <p class="text-sm text-gray-400 mt-1">{{ loadError || 'It may have been deleted.' }}</p>
        <RouterLink to="/admin" class="inline-block mt-4 text-sm font-semibold underline underline-offset-2">
          Back to dashboard
        </RouterLink>
      </div>

      <template v-else>
        <header class="mb-6">
          <BrandMark size="sm" class="mb-3" />
          <RouterLink to="/admin" class="inline-flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-white mb-3">
            <span class="material-symbols-outlined text-[16px]">arrow_back</span>
            Dashboard
          </RouterLink>

          <div class="flex items-start gap-4">
            <img
              :src="profileThumb(entry)"
              alt=""
              class="w-16 h-16 object-cover shrink-0 bg-zinc-800"
              :class="entry.cardType === 'table' ? 'rounded-2xl' : 'rounded-full'"
            >
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 flex-wrap">
                <h1 class="text-2xl font-bold tracking-tight truncate">{{ profileLabel(entry) }}</h1>
                <span
                  class="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                  :class="entry.disabled ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'"
                >
                  {{ entry.disabled ? 'Disabled' : 'Live' }}
                </span>
                <span
                  class="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-zinc-500/20 text-gray-300"
                >
                  {{ entry.cardType === 'table' ? 'Business' : 'Personal' }}
                </span>
                <span
                  v-if="entry.local"
                  class="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300"
                >
                  This device
                </span>
              </div>
              <p class="text-sm text-gray-400 mt-1">{{ profileMeta(entry) }}</p>
              <p class="text-xs text-gray-500 mt-1">
                Created {{ formatDate(entry.createdAt) }} · Updated {{ formatDate(entry.updatedAt) }}
              </p>
              <p v-if="linkedCards.length" class="text-xs font-mono text-sky-300/90 mt-2">
                Slug{{ linkedCards.length === 1 ? '' : 's' }}:
                {{ linkedCards.map((c) => c.serial).join(' · ') }}
              </p>
              <p v-else-if="entry.shareSlug" class="text-xs font-mono text-sky-300/90 mt-2">
                Slug: {{ entry.shareSlug }}
              </p>
              <p v-else class="text-xs text-amber-300/80 mt-2">No slug linked yet</p>
            </div>
          </div>
        </header>

        <!-- Associated slugs -->
        <section class="mb-6">
          <div class="flex items-center justify-between gap-3 mb-3">
            <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-400">Associated slugs</h2>
            <RouterLink to="/admin/slugs" class="text-xs font-semibold text-gray-400 hover:text-white underline underline-offset-2">
              Manage all
            </RouterLink>
          </div>
          <ul v-if="linkedCards.length" class="space-y-2">
            <li
              v-for="c in linkedCards"
              :key="c.serial"
              class="card-item-bg rounded-2xl p-4 flex items-center gap-3"
            >
              <div class="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                <span class="material-symbols-outlined text-[20px]">{{ kindIcon(c.kind) }}</span>
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-mono font-semibold">{{ c.serial }}</p>
                <p class="text-[11px] text-gray-500 mt-0.5">{{ kindLabel(c.kind) }}</p>
              </div>
              <button
                type="button"
                class="text-xs font-semibold text-gray-300 hover:text-white shrink-0"
                @click="copySlugUrl(c.serial)"
              >
                Copy URL
              </button>
            </li>
          </ul>
          <div v-else class="card-item-bg rounded-2xl p-4 text-sm text-gray-400">
            No slug linked to this profile yet.
          </div>
        </section>

        <!-- Quick stats -->
        <section class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div class="card-item-bg rounded-2xl p-3">
            <p class="text-[10px] uppercase tracking-wide text-gray-500">Visits</p>
            <p class="text-xl font-bold mt-0.5">{{ stats.visits }}</p>
          </div>
          <div class="card-item-bg rounded-2xl p-3">
            <p class="text-[10px] uppercase tracking-wide text-gray-500">Shares</p>
            <p class="text-xl font-bold mt-0.5">{{ stats.shares }}</p>
          </div>
          <div class="card-item-bg rounded-2xl p-3">
            <p class="text-[10px] uppercase tracking-wide text-gray-500">Link / button clicks</p>
            <p class="text-xl font-bold mt-0.5">{{ stats.clicks }}</p>
          </div>
          <div v-if="isBusiness" class="card-item-bg rounded-2xl p-3">
            <p class="text-[10px] uppercase tracking-wide text-gray-500">Check-ins / Feedback</p>
            <p class="text-xl font-bold mt-0.5">{{ stats.checkIns || 0 }} / {{ stats.feedback || 0 }}</p>
          </div>
          <div v-else class="card-item-bg rounded-2xl p-3">
            <p class="text-[10px] uppercase tracking-wide text-gray-500">Events logged</p>
            <p class="text-xl font-bold mt-0.5">{{ stats.total }}</p>
          </div>
        </section>

        <!-- Tabs -->
        <div class="flex gap-2 mb-5">
          <button
            type="button"
            class="px-4 py-2 rounded-full text-xs font-semibold border transition-colors"
            :class="tab === 'activity'
              ? 'bg-white text-black border-white'
              : 'border-[var(--border)] text-gray-400 hover:text-white'"
            @click="tab = 'activity'"
          >
            Engagement
          </button>
          <button
            type="button"
            class="px-4 py-2 rounded-full text-xs font-semibold border transition-colors"
            :class="tab === 'manage'
              ? 'bg-white text-black border-white'
              : 'border-[var(--border)] text-gray-400 hover:text-white'"
            @click="tab = 'manage'"
          >
            Manage
          </button>
        </div>

        <!-- Engagement -->
        <section v-if="tab === 'activity'" class="space-y-6 mb-8">
          <div>
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-400">Clicks by link / button</h2>
              <button type="button" class="text-xs text-gray-500 hover:text-white" @click="refreshActivity">
                Refresh
              </button>
            </div>

            <div v-if="!clickRows.length" class="card-item-bg rounded-2xl p-5 text-sm text-gray-400">
              No link or button clicks recorded yet.
            </div>

            <ul v-else class="card-item-bg rounded-2xl divide-y divide-[var(--border)] overflow-hidden">
              <li
                v-for="row in clickRows"
                :key="row.key"
                class="flex items-center justify-between gap-3 px-4 py-3"
              >
                <p class="text-sm font-medium truncate">{{ row.label }}</p>
                <p class="text-sm font-bold tabular-nums shrink-0">{{ row.count }}</p>
              </li>
            </ul>
          </div>

          <div>
            <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-3">
              {{ isBusiness ? 'Recent activity' : 'Recent visits, shares & clicks' }}
            </h2>

            <div v-if="!activities.length" class="card-item-bg rounded-2xl p-5 text-sm text-gray-400">
              No activity recorded for this profile yet.
            </div>

            <ul v-else class="space-y-2">
              <li
                v-for="act in activities"
                :key="act.id"
                class="card-item-bg rounded-2xl p-4 flex gap-3"
              >
                <div class="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shrink-0 shadow-sm">
                  <span class="material-symbols-outlined text-[20px]">{{ activityIcon(act.type) }}</span>
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-semibold">{{ act.title }}</p>
                  <p v-if="act.detail" class="text-xs text-gray-400 mt-0.5 leading-relaxed">{{ act.detail }}</p>
                  <p class="text-[11px] text-gray-500 mt-1">{{ formatDate(act.at, true) }}</p>
                </div>
              </li>
            </ul>
          </div>
        </section>

        <!-- Manage -->
        <section v-else class="mb-8 space-y-5">
          <div class="card-item-bg rounded-2xl p-4 flex flex-wrap gap-2">
            <button
              type="button"
              class="px-4 py-2.5 rounded-full text-xs font-bold transition-colors"
              :class="entry.disabled ? 'bg-emerald-500 text-black' : 'bg-amber-400 text-black'"
              @click="toggleStatus"
            >
              {{ entry.disabled ? 'Enable profile' : 'Disable profile' }}
            </button>
            <RouterLink
              v-if="entry.local || entry.id === LOCAL_ID"
              :to="publicPathFor(entry)"
              class="px-4 py-2.5 rounded-full text-xs font-bold bg-white text-black no-underline"
            >
              Open public page
            </RouterLink>
            <RouterLink
              v-if="entry.local"
              to="/profile"
              class="px-4 py-2.5 rounded-full text-xs font-semibold border border-[var(--border)] text-gray-300 no-underline"
            >
              Full profile editor
            </RouterLink>
            <button
              type="button"
              class="px-4 py-2.5 rounded-full text-xs font-semibold border border-red-500/40 text-red-400"
              @click="showDeleteConfirm = true"
            >
              Delete
            </button>
          </div>

          <form class="space-y-4" @submit="saveManage">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Type</label>
                <p class="field-shell w-full field-input !py-3 text-sm">
                  {{ form.cardType === 'table' ? 'Business' : 'Personal' }}
                  <span class="text-gray-500 text-xs"> · set when the card was generated</span>
                </p>
              </div>
              <div>
                <label class="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Name</label>
                <div class="field-shell">
                  <input v-model="form.name" type="text" class="field-input" placeholder="Full name">
                </div>
              </div>
              <div>
                <label class="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Title / tagline</label>
                <div class="field-shell">
                  <input v-model="form.title" type="text" class="field-input" placeholder="Title">
                </div>
              </div>
              <div>
                <label class="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Company / venue</label>
                <div class="field-shell">
                  <input v-model="form.company" type="text" class="field-input" placeholder="Company">
                </div>
              </div>
              <div>
                <label class="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Email</label>
                <div class="field-shell">
                  <input v-model="form.email" type="email" class="field-input" placeholder="email@example.com">
                </div>
              </div>
              <div>
                <label class="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Phone</label>
                <div class="field-shell">
                  <input v-model="form.phone" type="tel" class="field-input" placeholder="+264…">
                </div>
              </div>
              <div>
                <label class="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">WhatsApp</label>
                <div class="field-shell">
                  <input v-model="form.whatsapp" type="text" class="field-input" placeholder="Number or link">
                </div>
              </div>
              <div>
                <label class="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Website</label>
                <div class="field-shell">
                  <input v-model="form.website" type="url" class="field-input" placeholder="https://">
                </div>
              </div>
              <div>
                <label class="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Address</label>
                <div class="field-shell">
                  <input v-model="form.address" type="text" class="field-input" placeholder="Street address">
                </div>
              </div>
              <div>
                <label class="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">X</label>
                <div class="field-shell">
                  <input v-model="form.x" type="text" class="field-input" placeholder="@handle or link">
                </div>
              </div>
              <div>
                <label class="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Instagram</label>
                <div class="field-shell">
                  <input v-model="form.instagram" type="text" class="field-input" placeholder="@handle or link">
                </div>
              </div>
              <div>
                <label class="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">TikTok</label>
                <div class="field-shell">
                  <input v-model="form.tiktok" type="text" class="field-input" placeholder="@handle or link">
                </div>
              </div>
              <div>
                <label class="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">LinkedIn</label>
                <div class="field-shell">
                  <input v-model="form.linkedin" type="text" class="field-input" placeholder="Profile link">
                </div>
              </div>
              <div>
                <label class="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">YouTube</label>
                <div class="field-shell">
                  <input v-model="form.youtube" type="text" class="field-input" placeholder="@channel or link">
                </div>
              </div>
            </div>

            <template v-if="form.cardType === 'table'">
              <div>
                <label class="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Menu URL</label>
                <div class="field-shell">
                  <input v-model="form.menuUrl" type="url" class="field-input" placeholder="https://">
                </div>
              </div>
              <div>
                <label class="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Google review URL</label>
                <div class="field-shell">
                  <input v-model="form.googleReview" type="url" class="field-input" placeholder="https://">
                </div>
              </div>
            </template>

            <p v-if="saveError" class="text-xs text-red-400">{{ saveError }}</p>
            <p v-if="savedMsg" class="text-xs text-emerald-400">{{ savedMsg }}</p>

            <button
              type="submit"
              class="w-full py-3.5 rounded-full bg-white text-black font-bold text-sm hover:bg-gray-200 transition-colors disabled:opacity-60"
              :disabled="saving"
            >
              {{ saving ? 'Saving…' : 'Save changes' }}
            </button>
          </form>
        </section>
      </template>
    </main>

    <div
      v-if="showDeleteConfirm"
      class="fixed inset-0 z-[100] flex items-center justify-center p-6"
    >
      <div class="absolute inset-0 bg-black/70" @click="showDeleteConfirm = false" />
      <div class="relative w-full max-w-sm card-item-bg rounded-3xl p-6 shadow-2xl">
        <h2 class="text-lg font-bold">Disable profile?</h2>
        <p class="text-sm text-gray-400 mt-2">
          This disables <strong class="text-white">{{ profileLabel(entry) }}</strong> so their card no longer shows as live.
        </p>
        <div class="flex gap-2 mt-5">
          <button
            type="button"
            class="flex-1 py-3 rounded-full border border-[var(--border)] text-sm font-semibold"
            @click="showDeleteConfirm = false"
          >
            Cancel
          </button>
          <button
            type="button"
            class="flex-1 py-3 rounded-full bg-red-500 text-white text-sm font-bold"
            @click="confirmDelete"
          >
            Disable
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="toast"
      class="fixed left-1/2 -translate-x-1/2 bottom-28 z-[110] px-4 py-3 rounded-2xl bg-white text-black text-sm font-medium shadow-xl"
    >
      {{ toast }}
    </div>

    <AdminBottomNav />
  </div>
</template>
