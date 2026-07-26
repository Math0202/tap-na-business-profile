<script setup>
import { computed, ref, watch, onMounted } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import BrandMark from '../components/BrandMark.vue'
import AdminBottomNav from '../components/AdminBottomNav.vue'
import {
  getEntryById,
  getActivitiesForProfile,
  getActivityStats,
  getClickBreakdown,
  profileThumb,
  profileLabel,
  profileMeta,
  publicPathFor,
  setEntryDisabled,
  updateEntry,
  softDeleteEntry,
  activityIcon,
  LOCAL_ID
} from '../lib/adminStore'
import {
  listCardsForAdminEntry,
  cardPublicUrl,
  kindLabel,
  kindIcon
} from '../lib/cardLinkStore'

const route = useRoute()
const router = useRouter()

const entry = ref(null)
const activities = ref([])
const clickRows = ref([])
const linkedCards = ref([])
const stats = ref({ visits: 0, shares: 0, clicks: 0, total: 0, checkIns: 0, feedback: 0 })
const tab = ref('activity') // activity | manage
const savedMsg = ref('')
const showDeleteConfirm = ref(false)
const toast = ref('')

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
  city: '',
  menuUrl: '',
  googleReview: '',
  notes: '',
  cardType: 'personal',
  disabled: false
})

const profileId = computed(() => String(route.params.id || ''))

const notFound = computed(() => !entry.value)

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

function load() {
  const id = profileId.value
  const found = getEntryById(id)
  entry.value = found
  if (!found) {
    activities.value = []
    clickRows.value = []
    linkedCards.value = []
    return
  }
  activities.value = getActivitiesForProfile(id, found.cardType)
  stats.value = getActivityStats(id)
  clickRows.value = getClickBreakdown(id)
  linkedCards.value = listCardsForAdminEntry(found)
  form.value = {
    name: found.name || '',
    title: found.title || '',
    company: found.company || '',
    email: found.email || '',
    phone: found.phone || '',
    whatsapp: found.whatsapp || '',
    website: found.website || '',
    address: found.address || '',
    city: found.city || '',
    menuUrl: found.menuUrl || '',
    googleReview: found.googleReview || '',
    notes: found.notes || '',
    cardType: found.cardType === 'table' ? 'table' : 'personal',
    disabled: !!found.disabled
  }
  document.title = profileLabel(found) + ' · Admin'
}

function refreshActivity() {
  if (!entry.value) return
  activities.value = getActivitiesForProfile(entry.value.id, entry.value.cardType)
  stats.value = getActivityStats(entry.value.id)
  clickRows.value = getClickBreakdown(entry.value.id)
}

function toggleStatus() {
  if (!entry.value) return
  setEntryDisabled(entry.value.id, !entry.value.disabled)
  load()
}

function saveManage(e) {
  e.preventDefault()
  if (!entry.value) return
  // Never allow changing personal ↔ business — type is fixed at card generation
  const next = updateEntry(entry.value.id, {
    ...form.value,
    cardType: entry.value.cardType
  })
  entry.value = next
  savedMsg.value = 'Changes saved'
  setTimeout(() => { savedMsg.value = '' }, 2000)
  refreshActivity()
}

function confirmDelete() {
  if (!entry.value) return
  softDeleteEntry(entry.value.id)
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
      <div v-if="notFound" class="card-item-bg rounded-2xl p-6 text-center">
        <span class="material-symbols-outlined text-4xl text-gray-500">person_off</span>
        <p class="font-semibold mt-2">Profile not found</p>
        <p class="text-sm text-gray-400 mt-1">It may have been deleted from the directory.</p>
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
                <label class="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">City</label>
                <div class="field-shell">
                  <input v-model="form.city" type="text" class="field-input" placeholder="City">
                </div>
              </div>
              <div>
                <label class="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Address</label>
                <div class="field-shell">
                  <input v-model="form.address" type="text" class="field-input" placeholder="Street address">
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

            <div>
              <label class="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Admin notes</label>
              <div class="field-shell !items-start !py-2">
                <textarea
                  v-model="form.notes"
                  rows="3"
                  class="field-input !py-2 resize-y"
                  placeholder="Internal notes about this profile…"
                />
              </div>
            </div>

            <p v-if="savedMsg" class="text-xs text-emerald-400">{{ savedMsg }}</p>

            <button type="submit" class="w-full py-3.5 rounded-full bg-white text-black font-bold text-sm hover:bg-gray-200 transition-colors">
              Save changes
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
        <h2 class="text-lg font-bold">Delete profile?</h2>
        <p class="text-sm text-gray-400 mt-2">
          This removes <strong class="text-white">{{ profileLabel(entry) }}</strong> from the admin directory.
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
            Delete
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
