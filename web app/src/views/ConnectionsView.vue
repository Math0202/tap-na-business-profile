<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import BrandMark from '../components/BrandMark.vue'
import { apiGetMyTeam, apiListConnections } from '../lib/api'
import { addConnectionToCrm, saveConnectionContact } from '../lib/connectionHelpers'
import { displayName, loadProfile } from '../lib/profileStore'
import { crmProviderLabel } from '../lib/teamIntegrations'

const loading = ref(true)
const error = ref('')
const connections = ref([])
const usesCrm = ref(false)
const crmProvider = ref('')
const crmOther = ref('')

const ownerName = computed(() => displayName(loadProfile()) || 'Your profile')

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
      usesCrm.value = !!res.data.team.usesCrm
      crmProvider.value = res.data.team.crmProvider || ''
      crmOther.value = res.data.team.crmOther || ''
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
        People who shared their details with {{ ownerName }}
      </p>
    </header>

    <div class="px-6 space-y-3 flex-1">
      <p v-if="loading" class="text-sm text-gray-500 text-center py-8">Loading…</p>
      <p v-else-if="error" class="text-sm text-red-400 text-center py-8">{{ error }}</p>
      <p v-else-if="!connections.length" class="text-sm text-gray-500 text-center py-8">
        No contacts yet. When someone taps Connect on your card and shares their details, they will appear here.
      </p>
      <ul v-else class="space-y-2">
        <li
          v-for="c in connections"
          :key="c.id"
          class="card-item-bg rounded-2xl px-4 py-4"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="font-semibold truncate">{{ c.name || 'Unknown' }}</p>
              <p v-if="c.company" class="text-xs text-gray-400 mt-0.5 truncate">{{ c.company }}</p>
              <p class="text-xs text-gray-400 mt-1">{{ contactLine(c) }}</p>
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