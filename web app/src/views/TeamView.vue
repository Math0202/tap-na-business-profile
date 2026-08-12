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
  personalTypeLabel,
  personalTypeRank
} from '../lib/teamRoles'
import {
  apiAddTeamMember,
  apiGetMyTeam,
  apiResolveCard,
  apiTransferTeamOwnership,
  apiUpdateMyTeam,
  apiUpdateTeamMember,
  ensureApiSession,
  getApiToken
} from '../lib/api'
import { isLoggedIn, isTableBusiness, loadProfile } from '../lib/profileStore'
import { RouterLink, useRouter } from 'vue-router'

const router = useRouter()
const loading = ref(true)
const saving = ref(false)
const toast = ref('')
const team = ref(null)
const members = ref([])
const myRole = ref(DEFAULT_PERSONAL_TYPE)
const ownerRole = ref(DEFAULT_PERSONAL_TYPE)
const isOwner = ref(false)
const canUseTeam = ref(true)
const packageCeiling = ref('business')
const pendingInvites = ref([])

const teamName = ref('')
const shareCatalog = ref(false)
const addSlug = ref('')
const addEmail = ref('')
const addRole = ref(DEFAULT_PERSONAL_TYPE)
const showDeleted = ref(false)

const tierGateOpen = ref(false)
const tierGateTitle = ref('')
const tierGateMessage = ref('')
const transferConfirm = ref(null)

function flash(msg) {
  toast.value = msg
  setTimeout(() => { toast.value = '' }, 2400)
}

function openTierGate(neededRole) {
  const label = personalTypeLabel(neededRole)
  const article = /^[aeiou]/i.test(label) ? 'an' : 'a'
  tierGateTitle.value = `${label} required`
  tierGateMessage.value =
    `To add ${article} ${label} card to your team, you need to be ${label}. ` +
    `Upgrade your personal card type, then try again.`
  tierGateOpen.value = true
}

function canInviteCardType(type) {
  const id = normalizePersonalType(type)
  return roleOptions.value.some((r) => r.id === id)
}

const roleOptions = computed(() => {
  const byPackage = assignableRoles(packageCeiling.value)
  const byActor = isOwner.value
    ? byPackage
    : assignableRoles(myRole.value).filter((id) => byPackage.includes(id))
  return byActor.map((id) => PERSONAL_TYPES[id]).filter(Boolean)
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
    const res = await apiGetMyTeam({ includeDeleted: true })
    if (!res.ok) {
      flash(res.error || 'Could not load team')
      return
    }
    canUseTeam.value = res.data.canUseTeam !== false
    if (!canUseTeam.value) {
      team.value = null
      members.value = []
      return
    }
    team.value = res.data.team
    members.value = res.data.members || []
    myRole.value = normalizePersonalType(res.data.myRole || DEFAULT_PERSONAL_TYPE)
    packageCeiling.value = normalizePersonalType(
      res.data.packageCeiling || res.data.ownerRole || DEFAULT_PERSONAL_TYPE
    )
    ownerRole.value = packageCeiling.value
    if (!roleOptions.value.find((r) => r.id === addRole.value) && roleOptions.value[0]) {
      addRole.value = roleOptions.value[0].id
    }
    isOwner.value = !!res.data.isOwner
    pendingInvites.value = res.data.pendingInvites || []
    teamName.value = team.value?.name || ''
    shareCatalog.value = !!team.value?.shareCatalog
  } finally {
    loading.value = false
  }
}

const visibleMembers = computed(() => {
  if (showDeleted.value) return members.value
  return members.value.filter((m) => !m.deleted)
})

function canEditMember(member) {
  if (member.deleted) return false
  if (member.status !== 'active' && member.status !== 'invited' && member.status !== 'pending_claim') return false
  if (isOwner.value) return true
  return canManageRole(myRole.value, member.role)
}

async function saveTeamName() {
  const name = teamName.value.trim()
  if (!name || !isOwner.value) return
  saving.value = true
  try {
    const res = await apiUpdateMyTeam({ name, shareCatalog: shareCatalog.value })
    if (!res.ok) {
      flash(res.error || 'Could not rename team')
      return
    }
    team.value = res.data.team
    shareCatalog.value = !!res.data.team?.shareCatalog
    flash('Team name saved')
  } finally {
    saving.value = false
  }
}

async function saveShareCatalog() {
  if (!isOwner.value) return
  saving.value = true
  try {
    const res = await apiUpdateMyTeam({ shareCatalog: shareCatalog.value })
    if (!res.ok) {
      shareCatalog.value = !shareCatalog.value
      flash(res.error || 'Could not update catalog sharing')
      return
    }
    team.value = res.data.team
    shareCatalog.value = !!res.data.team?.shareCatalog
    flash(shareCatalog.value ? 'Catalog shared with your team' : 'Catalog sharing turned off')
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
    const resolved = await apiResolveCard(slug)
    if (!resolved?.card) {
      flash('Card not found for that slug')
      return
    }
    if (resolved.card.kind !== 'personal') {
      flash('Only personal cards can join a team')
      return
    }
    const cardType = normalizePersonalType(resolved.card.personalType || DEFAULT_PERSONAL_TYPE)
    if (!canInviteCardType(cardType)) {
      openTierGate(cardType)
      return
    }
    if (!canInviteCardType(addRole.value)) {
      openTierGate(addRole.value)
      return
    }
    // Invite at least at the card’s real type when that tier is allowed.
    const role =
      personalTypeRank(cardType) > personalTypeRank(addRole.value) && canInviteCardType(cardType)
        ? cardType
        : addRole.value

    const res = await apiAddTeamMember({
      slug,
      email: addEmail.value.trim(),
      role
    })
    if (!res.ok) {
      const err = String(res.error || '')
      if (/executive|business|professional|role|type/i.test(err)) {
        openTierGate(cardType)
        return
      }
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
  if (!confirm(`Remove ${member.memberName || member.slug || 'this member'} from the team? You can restore them later.`)) return
  const res = await apiUpdateTeamMember(member.id, { action: 'remove' })
  if (!res.ok) {
    flash(res.error || 'Could not remove member')
    return
  }
  flash('Member removed')
  await refresh()
}

async function restoreMember(member) {
  if (!isOwner.value && !canManageRole(myRole.value, member.role)) return
  const res = await apiUpdateTeamMember(member.id, { action: 'restore' })
  if (!res.ok) {
    flash(res.error || 'Could not restore member')
    return
  }
  flash('Member restored')
  await refresh()
}

async function transferOwnership(member) {
  if (!isOwner.value || !member?.profileId) return
  transferConfirm.value = member
}

async function confirmTransfer() {
  const member = transferConfirm.value
  if (!member?.id) return
  saving.value = true
  try {
    const res = await apiTransferTeamOwnership(member.id)
    if (!res.ok) {
      flash(res.error || 'Could not transfer ownership')
      return
    }
    transferConfirm.value = null
    flash('Ownership transferred')
    await refresh()
  } finally {
    saving.value = false
  }
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
          Connect Team seats, roles, and ownership. Members claim their cards to join.
        </p>
      </header>

      <p v-if="loading" class="text-sm text-gray-500 py-8 text-center">Loading…</p>

      <div v-else-if="!canUseTeam" class="card-item-bg rounded-2xl p-5 space-y-3">
        <h2 class="text-lg font-bold">Team is part of Connect Team</h2>
        <p class="text-sm text-gray-400 leading-relaxed">
          Professional (Connect Solo) cards are personal-only. Upgrade to Business or Executive for shared team profiles, catalog sharing, and ownership.
        </p>
        <RouterLink
          to="/#connect-team"
          class="inline-flex w-full items-center justify-center py-3 rounded-full bg-white text-black text-sm font-bold no-underline"
        >
          View Connect Team
        </RouterLink>
      </div>

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
          <label
            v-if="isOwner"
            class="flex items-start gap-3 pt-1 cursor-pointer"
          >
            <input
              v-model="shareCatalog"
              type="checkbox"
              class="mt-1 rounded border-zinc-600"
              :disabled="saving"
              @change="saveShareCatalog"
            >
            <span class="min-w-0">
              <span class="block text-sm font-semibold">Share my catalog with the team</span>
              <span class="block text-xs text-gray-500 mt-0.5 leading-relaxed">
                When on, active members show your catalog on their cards. Quote requests go to the member whose card was scanned.
              </span>
            </span>
          </label>
          <p
            v-else-if="shareCatalog"
            class="text-xs text-sky-300/90 leading-relaxed"
          >
            Your team owner is sharing their catalog with members. It appears on your Catalog page.
          </p>
          <p class="text-xs text-gray-500">
            Your role: <span class="text-gray-300">{{ personalTypeLabel(myRole) }}</span>
            <template v-if="isOwner"> · Owner</template>
            · Package: <span class="text-gray-300">{{ personalTypeLabel(packageCeiling) }}</span>
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

        <div class="flex items-center justify-between gap-3 mb-2">
          <p class="text-[10px] uppercase tracking-wide text-gray-500">Members</p>
          <label class="inline-flex items-center gap-2 text-[11px] text-gray-400">
            <input v-model="showDeleted" type="checkbox" class="rounded">
            Show removed
          </label>
        </div>
        <ul class="space-y-3">
          <li
            v-for="m in visibleMembers"
            :key="m.id"
            class="card-item-bg rounded-2xl p-4"
            :class="m.deleted ? 'opacity-60' : ''"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="text-sm font-semibold truncate">{{ m.memberName || m.slug || 'Member' }}</p>
                <p class="text-xs text-gray-400 truncate">{{ m.memberEmail || m.inviteEmail || '—' }}</p>
                <p v-if="m.slug" class="text-xs text-gray-500 mt-0.5">Slug {{ m.slug }}</p>
              </div>
              <span class="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-zinc-800 text-gray-300 shrink-0">
                {{ m.deleted ? 'Removed' : memberStatusLabel(m.status) }}
              </span>
            </div>
            <div class="mt-3 flex flex-col gap-2">
              <select
                class="field-input w-full bg-transparent text-sm"
                :value="m.role"
                :disabled="!canEditMember(m)"
                @change="changeRole(m, $event.target.value)"
              >
                <option v-for="r in roleOptions" :key="r.id" :value="r.id">{{ r.label }}</option>
                <option v-if="!roleOptions.find((x) => x.id === m.role)" :value="m.role">{{ personalTypeLabel(m.role) }}</option>
              </select>
              <button
                v-if="canEditMember(m) && m.profileId === team?.ownerProfileId"
                type="button"
                class="py-2 rounded-xl bg-zinc-800 text-sm text-gray-400"
                disabled
              >
                Team owner
              </button>
              <button
                v-else-if="isOwner && m.status === 'active' && m.profileId && m.profileId !== team?.ownerProfileId && !m.deleted"
                type="button"
                class="py-2 rounded-xl bg-zinc-800 text-sm text-sky-300"
                :disabled="saving"
                @click="transferOwnership(m)"
              >
                Make owner
              </button>
              <button
                v-if="canEditMember(m) && m.profileId !== team?.ownerProfileId"
                type="button"
                class="py-2 rounded-xl bg-zinc-800 text-sm text-red-300"
                @click="removeMember(m)"
              >
                Remove
              </button>
              <button
                v-else-if="m.deleted && (isOwner || canManageRole(myRole, m.role))"
                type="button"
                class="py-2 rounded-xl bg-zinc-800 text-sm text-emerald-300"
                @click="restoreMember(m)"
              >
                Restore
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

      <Teleport to="body">
        <div
          v-if="tierGateOpen"
          class="app-dialog-overlay fixed inset-0 z-[210] flex items-end sm:items-center justify-center p-4"
          @click.self="tierGateOpen = false"
        >
          <div class="w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-700 p-5 shadow-xl">
            <h2 class="text-lg font-bold tracking-tight">{{ tierGateTitle }}</h2>
            <p class="text-sm text-gray-400 mt-2 leading-relaxed">{{ tierGateMessage }}</p>
            <p class="text-xs text-gray-500 mt-3">
              Your role: {{ personalTypeLabel(myRole) }}
              · Package ceiling: {{ personalTypeLabel(packageCeiling) }}
            </p>
            <button
              type="button"
              class="mt-5 w-full py-3 rounded-full bg-white text-black text-sm font-bold"
              @click="tierGateOpen = false"
            >
              Got it
            </button>
          </div>
        </div>
      </Teleport>

      <Teleport to="body">
        <div
          v-if="transferConfirm"
          class="app-dialog-overlay fixed inset-0 z-[210] flex items-end sm:items-center justify-center p-4"
          @click.self="transferConfirm = null"
        >
          <div class="w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-700 p-5 shadow-xl">
            <h2 class="text-lg font-bold tracking-tight">Transfer ownership?</h2>
            <p class="text-sm text-gray-400 mt-2 leading-relaxed">
              Make
              <strong class="text-gray-200">{{ transferConfirm.memberName || transferConfirm.slug || 'this member' }}</strong>
              the team owner. You’ll keep your seat as a normal member and lose owner controls.
            </p>
            <div class="mt-5 flex gap-2">
              <button
                type="button"
                class="flex-1 py-3 rounded-full bg-zinc-800 text-sm font-semibold"
                :disabled="saving"
                @click="transferConfirm = null"
              >
                Cancel
              </button>
              <button
                type="button"
                class="flex-1 py-3 rounded-full bg-white text-black text-sm font-bold disabled:opacity-50"
                :disabled="saving"
                @click="confirmTransfer"
              >
                {{ saving ? 'Transferring…' : 'Transfer' }}
              </button>
            </div>
          </div>
        </div>
      </Teleport>
    </main>
  </div>
</template>
