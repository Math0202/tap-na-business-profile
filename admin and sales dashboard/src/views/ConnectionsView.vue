<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import BrandMark from '../components/BrandMark.vue'
import { apiDeleteConnection, apiGetMyTeam, apiListConnections, apiUpdateMyTeam } from '../lib/api'
import { addConnectionToCrm, saveConnectionContact } from '../lib/connectionHelpers'
import { displayName, loadProfile } from '../lib/profileStore'
import { crmProviderLabel } from '../lib/teamIntegrations'

const loading = ref(true)
const error = ref('')
const connections = ref([])
const usesCrm = ref(false)
const crmProvider = ref('')
const crmOther = ref('')
const deletingId = ref('')

const isTeamOwner = ref(false)
const shareContacts = ref(false)
const teamName = ref('')
const activeFilter = ref('all') // 'all' | 'mine'
const togglingShare = ref(false)

const ownerName = computed(() => displayName(loadProfile()) || 'Your profile')

const hasTeamContext = computed(() => isTeamOwner.value || (shareContacts.value && connections.value.some((c) => !c.isMine)))

const myContactsCount = computed(() => connections.value.filter((c) => c.isMine).length)

const displayedConnections = computed(() => {
  if (activeFilter.value === 'mine') {
    return connections.value.filter((c) => c.isMine)
  }
  return connections.value
})

const crmLabel = computed(() =>
  usesCrm.value && crmProvider.value ? crmProviderLabel(crmProvider.value, crmOther.value) : ''
)

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

function channelLabel(channel) {
  if (channel === 'whatsapp') return 'WhatsApp'
  if (channel === 'sms') return 'SMS'
  return ''
}

function contactLine(c) {
  return [c.phone, c.email].filter(Boolean).join(' · ') || 'No phone or email'
}

async function loadTeamCrm() {
  try {
    const res = await apiGetMyTeam()
    if (res?.ok && res.data?.team) {
      const t = res.data.team
      const isOwner = !!res.data.isOwner
      const allowed = isOwner || t.shareCalendarCrm === true
      if (allowed) {
        usesCrm.value = !!t.usesCrm
        crmProvider.value = t.crmProvider || ''
        crmOther.value = t.crmOther || ''
      } else {
        usesCrm.value = false
        crmProvider.value = ''
        crmOther.value = ''
      }
    }
  } catch {
    usesCrm.value = false
    crmProvider.value = ''
    crmOther.value = ''
  }
}

async function refresh() {
  loading.value = true
  error.value = ''
  const res = await apiListConnections()
  loading.value = false
  if (!res?.ok) {
    error.value = res.error || 'Could not load contacts.'
    connections.value = []
    return
  }
  connections.value = res.data?.connections || []
  isTeamOwner.value = !!res.data?.isTeamOwner
  shareContacts.value = !!res.data?.shareContacts
  teamName.value = res.data?.teamName || ''
}

async function toggleShareContacts() {
  if (!isTeamOwner.value) return
  togglingShare.value = true
  const nextVal = !shareContacts.value
  try {
    const res = await apiUpdateMyTeam({ shareContacts: nextVal })
    if (res?.ok) {
      shareContacts.value = nextVal
    } else {
      alert(res?.error || 'Could not update contacts sharing setting')
    }
  } catch (err) {
    alert(err?.message || 'Error updating contacts sharing')
  } finally {
    togglingShare.value = false
  }
}

async function deleteContact(c) {
  const label = c.name || 'this contact'
  if (!confirm(`Permanently delete ${label}? This cannot be undone.`)) return
  deletingId.value = c.id
  error.value = ''
  const res = await apiDeleteConnection(c.id)
  deletingId.value = ''
  if (!res?.ok) {
    error.value = res.error || 'Could not delete contact.'
    return
  }
  connections.value = connections.value.filter((row) => row.id !== c.id)
}

onMounted(async () => {
  await Promise.all([refresh(), loadTeamCrm()])
})
</script>

<template>
  <main class="w-full max-w-md mx-auto min-h-screen flex flex-col pb-28 bg-b-112">
    <header class="px-6 pt-14 pb-4 text-center">
      <BrandMark size="sm" class="mb-3 mx-auto" />
      <h1 class="text-2xl font-bold tracking-tight">Contacts</h1>
      <p class="text-gray-400 text-sm mt-1">
        {{ isTeamOwner ? `Team & member connections for ${teamName || ownerName}` : `People who shared their details with ${ownerName}` }}
      </p>
    </header>

    <div class="px-6 space-y-3 flex-1">
      <!-- Team Owner Contacts Visibility Control -->
      <div v-if="isTeamOwner" class="card-item-bg rounded-2xl p-4 space-y-2 border border-zinc-800">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-xs font-bold text-white uppercase tracking-wider">Team Visibility</p>
            <p class="text-[11px] text-gray-400 mt-0.5">
              {{ shareContacts ? 'Public: All team members can see team contacts' : 'Private: Members can only see their own contacts' }}
            </p>
          </div>
          <button
            type="button"
            class="px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer"
            :class="shareContacts ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-700/60' : 'bg-zinc-800 text-gray-300 border border-zinc-700'"
            :disabled="togglingShare"
            @click="toggleShareContacts"
          >
            <span class="material-symbols-outlined text-[16px]">{{ shareContacts ? 'visibility' : 'visibility_off' }}</span>
            <span>{{ shareContacts ? 'Public to Team' : 'Private to Member' }}</span>
          </button>
        </div>
      </div>

      <!-- Filter tabs for team context -->
      <div v-if="hasTeamContext && connections.length" class="flex gap-2">
        <button
          type="button"
          class="flex-1 py-2 px-3 rounded-xl text-xs font-semibold border transition"
          :class="activeFilter === 'all' ? 'bg-white text-black border-white' : 'border-zinc-800 text-gray-400 hover:text-white'"
          @click="activeFilter = 'all'"
        >
          All Contacts ({{ connections.length }})
        </button>
        <button
          type="button"
          class="flex-1 py-2 px-3 rounded-xl text-xs font-semibold border transition"
          :class="activeFilter === 'mine' ? 'bg-white text-black border-white' : 'border-zinc-800 text-gray-400 hover:text-white'"
          @click="activeFilter = 'mine'"
        >
          My Contacts ({{ myContactsCount }})
        </button>
      </div>

      <p v-if="loading" class="text-sm text-gray-500 text-center py-8">Loading…</p>
      <p v-else-if="error" class="text-sm text-red-400 text-center py-8">{{ error }}</p>
      <p v-else-if="!displayedConnections.length" class="text-sm text-gray-500 text-center py-8">
        {{ activeFilter === 'mine' ? 'No personal contacts found.' : 'No contacts yet. When someone taps Connect on a card and shares their details, they will appear here.' }}
      </p>
      <ul v-else class="space-y-2">
        <li
          v-for="c in displayedConnections"
          :key="c.id"
          class="card-item-bg rounded-2xl px-4 py-4"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="font-semibold truncate">{{ c.name || 'Unknown' }}</p>
              <p v-if="c.company" class="text-xs text-gray-400 mt-0.5 truncate">{{ c.company }}</p>
              <p class="text-xs text-gray-400 mt-1">{{ contactLine(c) }}</p>

              <!-- Member badge -->
              <div v-if="!c.isMine && c.collectedByName" class="flex items-center gap-1 text-[11px] text-sky-400 font-medium mt-1.5">
                <span class="material-symbols-outlined text-[14px]">person</span>
                <span>Collected by {{ c.collectedByName }}</span>
              </div>
              <div v-else-if="c.isMine && hasTeamContext" class="flex items-center gap-1 text-[11px] text-emerald-400 font-medium mt-1.5">
                <span class="material-symbols-outlined text-[14px]">check</span>
                <span>My contact</span>
              </div>
            </div>
            <span
              v-if="c.shareChannel"
              class="text-[10px] uppercase tracking-wide text-emerald-400 shrink-0"
            >
              {{ channelLabel(c.shareChannel) }}
            </span>
          </div>
          <p class="text-[10px] text-gray-500 mt-2">{{ formatDate(c.createdAt) }}</p>
          <div class="flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              class="px-3 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 transition"
              @click="saveConnectionContact(c)"
            >
              Save Contact
            </button>
            <button
              v-if="usesCrm && crmProvider"
              type="button"
              class="px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition"
              @click="addConnectionToCrm(c, crmProvider)"
            >
              Add to {{ crmLabel }}
            </button>
            <button
              type="button"
              class="px-3 py-2 rounded-xl text-xs font-semibold bg-red-500/15 text-red-300 hover:bg-red-500/25 transition disabled:opacity-50"
              :disabled="deletingId === c.id"
              @click="deleteContact(c)"
            >
              {{ deletingId === c.id ? 'Deleting…' : 'Delete' }}
            </button>
          </div>
        </li>
      </ul>

      <RouterLink
        to="/profile"
        class="block text-center text-sm text-gray-400 hover:text-white pt-4 no-underline"
      >
        Back to profile
      </RouterLink>
    </div>
  </main>
</template>