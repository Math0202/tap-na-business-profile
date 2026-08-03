<script setup>
import { computed, onMounted, ref } from 'vue'
import BrandMark from '../components/BrandMark.vue'
import {
  assignableRoles,
  canManageRole,
  DEFAULT_PERSONAL_TYPE,
  memberStatusLabel,
  normalizePersonalType,
  PERSONAL_TYPES,
  personalTypeLabel
} from '../lib/teamRoles'
import {
  apiAddTeamMember,
  apiGetMyTeam,
  apiUpdateMyTeam,
  apiUpdateTeamMember,
  ensureApiSession,
  getApiToken
} from '../lib/api'
import { isLoggedIn, isTableBusiness, loadProfile } from '../lib/profileStore'
import { useRouter } from 'vue-router'

const router = useRouter()
const loading = ref(true)
const saving = ref(false)
const toast = ref('')
const team = ref(null)
const members = ref([])
const myRole = ref(DEFAULT_PERSONAL_TYPE)
const ownerRole = ref(DEFAULT_PERSONAL_TYPE)
const isOwner = ref(false)
const pendingInvites = ref([])

const teamName = ref('')
const addSlug = ref('')
const addEmail = ref('')
const addRole = ref(DEFAULT_PERSONAL_TYPE)

function flash(msg) {
  toast.value = msg
  setTimeout(() => { toast.value = '' }, 2400)
}

const roleOptions = computed(() => {
  const byOwner = assignableRoles(ownerRole.value)
  const byActor = assignableRoles(myRole.value)
  return byOwner.filter((id) => byActor.includes(id)).map((id) => PERSONAL_TYPES[id])
})

async function refresh() {
  loading.value = true
  try {
    let authed = await ensureApiSession()
    if (!authed) authed = await ensureApiSession({ force: true })
    if (!authed || !getApiToken()) {
      router.replace('/login')
      return
    }
    const res = await apiGetMyTeam()
    if (!res.ok) {
      flash(res.error || 'Could not load team')
      return
    }
    team.value = res.data.team
    members.value = res.data.members || []
    myRole.value = normalizePersonalType(res.data.myRole || DEFAULT_PERSONAL_TYPE)
    ownerRole.value = normalizePersonalType(res.data.ownerRole || res.data.myRole || DEFAULT_PERSONAL_TYPE)
    if (!roleOptions.value.find((r) => r.id === addRole.value) && roleOptions.value[0]) {
      addRole.value = roleOptions.value[0].id
    }
    isOwner.value = !!res.data.isOwner
    pendingInvites.value = res.data.pendingInvites || []
    teamName.value = team.value?.name || ''
  } finally {
    loading.value = false
  }
}

function canEditMember(member) {
  if (member.status !== 'active' && member.status !== 'invited' && member.status !== 'pending_claim') return false
  if (isOwner.value) return true
  return canManageRole(myRole.value, member.role)
}

async function saveTeamName() {
  const name = teamName.value.trim()
  if (!name || !isOwner.value) return
  saving.value = true
  try {
    const res = await apiUpdateMyTeam({ name })
    if (!res.ok) {
      flash(res.error || 'Could not rename team')
      return
    }
    team.value = res.data.team
    flash('Team name saved')
  } finally {
    saving.value = false
  }
}

async function addMember() {
  const slug = addSlug.value.trim()
  if (!slug) {
    flash('Enter a card slug')
    return
  }
  saving.value = true
  try {
    const res = await apiAddTeamMember({
      slug,
      email: addEmail.value.trim(),
      role: addRole.value
    })
    if (!res.ok) {
      flash(res.error || 'Could not add member')
      return
    }
    addSlug.value = ''
    addEmail.value = ''
    flash('Invite sent')
    await refresh()
  } finally {
    saving.value = false
  }
}

async function changeRole(member, role) {
  if (!canEditMember(member)) return
  const res = await apiUpdateTeamMember(member.id, { role })
  if (!res.ok) {
    flash(res.error || 'Could not update role')
    return
  }
  flash('Role updated')
  await refresh()
}

async function removeMember(member) {
  if (!canEditMember(member)) return
  if (!confirm(`Remove ${member.memberName || member.slug || 'this member'} from the team?`)) return
  const res = await apiUpdateTeamMember(member.id, { action: 'remove' })
  if (!res.ok) {
    flash(res.error || 'Could not remove member')
    return
  }
  flash('Member removed')
  await refresh()
}

async function respondInvite(member, action) {
  const res = await apiUpdateTeamMember(member.id, { action })
  if (!res.ok) {
    flash(res.error || 'Could not update invite')
    return
  }
  flash(action === 'accept' ? 'You joined the team' : 'Invite declined')
  await refresh()
}

onMounted(() => {
  document.title = 'Team - tap-na'
  if (!isLoggedIn()) {
    router.replace('/login')
    return
  }
  if (isTableBusiness(loadProfile())) {
    router.replace('/venue')
    return
  }
  refresh()
})
</script>

<template>
  <div class="min-h-screen flex flex-col items-center overflow-x-hidden">
    <main class="w-full max-w-md min-h-screen flex flex-col relative z-10 pb-28 px-6 pt-8">
      <header class="pb-4">
        <BrandMark size="sm" class="mb-3" />
        <h1 class="text-2xl font-bold tracking-tight">Team</h1>
        <p class="text-gray-400 text-sm mt-1">
          Manage members by card slug. Roles: Executive Exclusive, Business, Professional.
        </p>
      </header>

      <p v-if="loading" class="text-sm text-gray-500 py-8 text-center">Loading…</p>

      <template v-else>
        <div v-if="pendingInvites.length" class="space-y-3 mb-6">
          <p class="text-[10px] uppercase tracking-wide text-gray-500">Pending invites for you</p>
          <div
            v-for="inv in pendingInvites"
            :key="inv.id"
            class="card-item-bg rounded-2xl p-4"
          >
            <p class="text-sm font-semibold">{{ personalTypeLabel(inv.role) }}</p>
            <p class="text-xs text-gray-400 mt-1">Slug {{ inv.slug || '—' }} · {{ memberStatusLabel(inv.status) }}</p>
            <div class="flex gap-2 mt-3">
              <button type="button" class="flex-1 py-2 rounded-xl bg-white text-black text-sm font-semibold" @click="respondInvite(inv, 'accept')">Accept</button>
              <button type="button" class="flex-1 py-2 rounded-xl bg-zinc-800 text-sm" @click="respondInvite(inv, 'reject')">Reject</button>
            </div>
            <p class="text-[11px] text-gray-500 mt-2">After you accept, you cannot leave the team yourself.</p>
          </div>
        </div>

        <div class="card-item-bg rounded-2xl p-4 mb-4 space-y-3">
          <label class="field-label" for="team-name">Team name</label>
          <input
            id="team-name"
            v-model="teamName"
            type="text"
            class="field-input w-full"
            :disabled="!isOwner || saving"
            maxlength="120"
          >
          <button
            v-if="isOwner"
            type="button"
            class="w-full py-2.5 rounded-full bg-zinc-800 text-sm font-semibold disabled:opacity-50"
            :disabled="saving"
            @click="saveTeamName"
          >
            Save name
          </button>
          <p class="text-xs text-gray-500">
            Your role: <span class="text-gray-300">{{ personalTypeLabel(myRole) }}</span>
            <template v-if="isOwner"> · Owner</template>
          </p>
        </div>

        <div class="card-item-bg rounded-2xl p-4 mb-6 space-y-3">
          <h2 class="text-sm font-semibold">Add member by slug</h2>
          <input v-model="addSlug" type="text" class="field-input w-full" placeholder="Card slug" autocomplete="off">
          <input v-model="addEmail" type="email" class="field-input w-full" placeholder="Email (required if unclaimed)">
          <select v-model="addRole" class="field-input w-full bg-transparent">
            <option v-for="r in roleOptions" :key="r.id" :value="r.id">{{ r.label }}</option>
          </select>
          <button
            type="button"
            class="w-full py-3 rounded-full bg-white text-black text-sm font-bold disabled:opacity-50"
            :disabled="saving"
            @click="addMember"
          >
            Add to team
          </button>
        </div>

        <p class="text-[10px] uppercase tracking-wide text-gray-500 mb-2">Members</p>
        <ul class="space-y-3">
          <li v-for="m in members" :key="m.id" class="card-item-bg rounded-2xl p-4">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="text-sm font-semibold truncate">{{ m.memberName || m.slug || 'Member' }}</p>
                <p class="text-xs text-gray-400 truncate">{{ m.memberEmail || m.inviteEmail || '—' }}</p>
                <p v-if="m.slug" class="text-xs text-gray-500 mt-0.5">Slug {{ m.slug }}</p>
              </div>
              <span class="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-zinc-800 text-gray-300 shrink-0">
                {{ memberStatusLabel(m.status) }}
              </span>
            </div>
            <div class="mt-3 flex flex-col gap-2">
              <select
                class="field-input w-full bg-transparent text-sm"
                :value="m.role"
                :disabled="!canEditMember(m) || m.profileId === team?.ownerProfileId"
                @change="changeRole(m, $event.target.value)"
              >
                <option v-for="r in roleOptions" :key="r.id" :value="r.id">{{ r.label }}</option>
                <option v-if="!roleOptions.find((x) => x.id === m.role)" :value="m.role">{{ personalTypeLabel(m.role) }}</option>
              </select>
              <button
                v-if="canEditMember(m) && m.profileId !== team?.ownerProfileId"
                type="button"
                class="py-2 rounded-xl bg-zinc-800 text-sm text-red-300"
                @click="removeMember(m)"
              >
                Remove
              </button>
            </div>
          </li>
        </ul>
      </template>

      <Teleport to="body">
        <p
          v-if="toast"
          class="fixed bottom-24 left-1/2 -translate-x-1/2 z-[220] px-4 py-2 rounded-full bg-zinc-800 text-sm shadow-lg"
        >
          {{ toast }}
        </p>
      </Teleport>
    </main>
  </div>
</template>
