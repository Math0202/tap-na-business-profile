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
import TeamIntegrationsFields from '../components/TeamIntegrationsFields.vue'
import { validateTeamIntegrations } from '../lib/teamIntegrations'
import { CARD_ID_HINT, CARD_ID_LABEL } from '../lib/cardLabels'

const router = useRouter()
const loading = ref(true)
const saving = ref(false)
const toast = ref('')
const team = ref(null)
const members = ref([])
const myRole = ref(DEFAULT_PERSONAL_TYPE)
const ownerRole = ref(DEFAULT_PERSONAL_TYPE)
const isOwner = ref(false)
const currentProfileId = computed(() => loadProfile()?.id || '')
const canUseTeam = ref(true)
const packageCeiling = ref('business')
const pendingInvites = ref([])

const teamName = ref('')
const meetingTool = ref('')
const usesCrm = ref(false)
const crmProvider = ref('')
const crmOther = ref('')
const addSlug = ref('')
const addEmail = ref('')
const addRole = ref(DEFAULT_PERSONAL_TYPE)
const showDeleted = ref(false)

const addMyChoiceOpen = ref(false)
const addSharing = ref({
  shareCatalog: true,
  shareBio: true,
  shareBanner: true,
  shareWebsite: true,
  shareSocialLinks: true,
  shareContacts: true,
  shareCalendarCrm: true
})

const confirmModal = ref({
  isOpen: false,
  title: '',
  message: '',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  confirmClass: 'bg-red-600 hover:bg-red-700 text-white',
  onConfirm: null
})

function openConfirmModal({
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmClass = 'bg-red-600 hover:bg-red-700 text-white',
  onConfirm
}) {
  confirmModal.value = {
    isOpen: true,
    title,
    message,
    confirmText,
    cancelText,
    confirmClass,
    onConfirm
  }
}

function handleConfirmModalAction() {
  const fn = confirmModal.value.onConfirm
  confirmModal.value.isOpen = false
  if (typeof fn === 'function') {
    fn()
  }
}

const tierGateOpen = ref(false)
const tierGateTitle = ref('')
const tierGateMessage = ref('')

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
    meetingTool.value = team.value?.meetingTool || ''
    usesCrm.value = !!team.value?.usesCrm
    crmProvider.value = team.value?.crmProvider || ''
    crmOther.value = team.value?.crmOther || ''
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

async function saveIntegrations() {
  if (!isOwner.value) return
  const check = validateTeamIntegrations({
    meetingTool: meetingTool.value,
    usesCrm: usesCrm.value,
    crmProvider: crmProvider.value,
    crmOther: crmOther.value
  })
  if (!check.ok) {
    flash(check.error)
    return
  }
  saving.value = true
  try {
    const res = await apiUpdateMyTeam(check.value)
    if (!res.ok) {
      flash(res.error || 'Could not save calendar and CRM settings')
      return
    }
    team.value = res.data.team
    meetingTool.value = team.value?.meetingTool || ''
    usesCrm.value = !!team.value?.usesCrm
    crmProvider.value = team.value?.crmProvider || ''
    crmOther.value = team.value?.crmOther || ''
    flash('Calendar and CRM settings saved')
  } finally {
    saving.value = false
  }
}

function isAllShared(m) {
  return (
    !!m.shareCatalog &&
    !!m.shareBio &&
    !!m.shareBanner &&
    !!m.shareWebsite &&
    !!m.shareSocialLinks &&
    !!m.shareContacts &&
    !!m.shareCalendarCrm
  )
}

function toggleMemberMyChoice(m) {
  if (!isOwner.value) return
  const nextVal = !isAllShared(m)
  m.shareCatalog = nextVal
  m.shareBio = nextVal
  m.shareBanner = nextVal
  m.shareWebsite = nextVal
  m.shareSocialLinks = nextVal
  m.shareContacts = nextVal
  m.shareCalendarCrm = nextVal
  updateMemberSharing(m)
}

async function updateMemberSharing(member) {
  if (!isOwner.value) return
  saving.value = true
  try {
    const res = await apiUpdateTeamMember(member.id, {
      shareCatalog: !!member.shareCatalog,
      shareBio: !!member.shareBio,
      shareBanner: !!member.shareBanner,
      shareWebsite: !!member.shareWebsite,
      shareSocialLinks: !!member.shareSocialLinks,
      shareContacts: !!member.shareContacts,
      shareCalendarCrm: !!member.shareCalendarCrm
    })
    if (!res.ok) {
      flash(res.error || 'Could not update member sharing')
      await refresh()
      return
    }
    flash(`Updated sharing for ${member.memberName || member.slug || 'member'}`)
  } catch (err) {
    flash('Failed to update member sharing')
    await refresh()
  } finally {
    saving.value = false
  }
}

function promptApplySharingToAll(sourceMember) {
  if (!isOwner.value) return
  const label = sourceMember.memberName || sourceMember.slug || 'this member'
  const activeOpts = []
  if (sourceMember.shareCatalog) activeOpts.push('Catalog')
  if (sourceMember.shareBio) activeOpts.push('Bio')
  if (sourceMember.shareBanner) activeOpts.push('Banner')
  if (sourceMember.shareWebsite) activeOpts.push('Website')
  if (sourceMember.shareSocialLinks) activeOpts.push('Social Links')
  if (sourceMember.shareContacts) activeOpts.push('Contacts')
  if (sourceMember.shareCalendarCrm) activeOpts.push('Calendar & CRM')

  const optsDesc = activeOpts.length ? activeOpts.join(', ') : 'No shared assets'

  openConfirmModal({
    title: 'Apply to All Members',
    message: `Apply ${label}'s sharing settings (${optsDesc}) to all other active team members?`,
    confirmText: 'Apply to All',
    confirmClass: 'bg-sky-600 hover:bg-sky-700 text-white',
    onConfirm: () => executeApplySharingToAll(sourceMember)
  })
}

async function executeApplySharingToAll(sourceMember) {
  if (!isOwner.value) return
  saving.value = true
  try {
    const res = await apiUpdateTeamMember(sourceMember.id, {
      action: 'apply_to_all',
      shareCatalog: !!sourceMember.shareCatalog,
      shareBio: !!sourceMember.shareBio,
      shareBanner: !!sourceMember.shareBanner,
      shareWebsite: !!sourceMember.shareWebsite,
      shareSocialLinks: !!sourceMember.shareSocialLinks,
      shareContacts: !!sourceMember.shareContacts,
      shareCalendarCrm: !!sourceMember.shareCalendarCrm
    })
    if (!res.ok) {
      flash(res.error || 'Could not apply sharing to all members')
      return
    }
    flash('Sharing settings applied to all members')
    await refresh()
  } catch (err) {
    flash('Error applying sharing to all members')
  } finally {
    saving.value = false
  }
}

function promptToggleCardStatus(member) {
  if (!isOwner.value) return
  const willDisable = member.cardStatus !== 'disabled'
  const label = member.memberName || member.slug || 'this member'
  openConfirmModal({
    title: willDisable ? 'Deactivate Card' : 'Activate Card',
    message: willDisable
      ? `Deactivate card for ${label}?\nVisitors tapping this card will see it as deactivated.`
      : `Activate card for ${label}? Visitors tapping this card will see the public profile.`,
    confirmText: willDisable ? 'Deactivate Card' : 'Activate Card',
    confirmClass: willDisable
      ? 'bg-amber-600 hover:bg-amber-700 text-white'
      : 'bg-emerald-600 hover:bg-emerald-700 text-white',
    onConfirm: () => executeToggleCardStatus(member, willDisable)
  })
}

async function executeToggleCardStatus(member, willDisable) {
  saving.value = true
  try {
    const res = await apiUpdateTeamMember(member.id, {
      action: 'toggle_card_status',
      cardStatus: willDisable ? 'disabled' : 'linked'
    })
    if (!res.ok) {
      flash(res.error || 'Could not update card status')
      return
    }
    member.cardStatus = willDisable ? 'disabled' : 'linked'
    flash(willDisable ? 'Card deactivated' : 'Card activated')
    await refresh()
  } finally {
    saving.value = false
  }
}

async function addMember() {
  const slug = addSlug.value.trim()
  if (!slug) {
    flash(`Enter a ${CARD_ID_LABEL.toLowerCase()}`)
    return
  }
  saving.value = true
  try {
    const resolved = await apiResolveCard(slug)
    if (!resolved?.card) {
      flash(`Card not found for that ${CARD_ID_LABEL.toLowerCase()}`)
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

    const payload = {
      slug,
      email: addEmail.value.trim(),
      role
    }
    if (addMyChoiceOpen.value) {
      Object.assign(payload, addSharing.value)
    }

    const res = await apiAddTeamMember(payload)
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

function promptRemoveMember(member) {
  if (!canEditMember(member)) return
  const label = member.memberName || member.slug || 'this member'
  openConfirmModal({
    title: 'Remove Member',
    message: `Remove ${label} from the team?\nYou can restore them later from the removed list.`,
    confirmText: 'Remove',
    confirmClass: 'bg-red-600 hover:bg-red-700 text-white',
    onConfirm: () => executeRemoveMember(member)
  })
}

async function executeRemoveMember(member) {
  saving.value = true
  try {
    const res = await apiUpdateTeamMember(member.id, { action: 'remove' })
    if (!res.ok) {
      flash(res.error || 'Could not remove member')
      return
    }
    flash('Member removed')
    await refresh()
  } finally {
    saving.value = false
  }
}

function promptRestoreMember(member) {
  if (!isOwner.value && !canManageRole(myRole.value, member.role)) return
  const label = member.memberName || member.slug || 'this member'
  openConfirmModal({
    title: 'Restore Member',
    message: `Restore ${label} to the active team list?`,
    confirmText: 'Restore',
    confirmClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    onConfirm: () => executeRestoreMember(member)
  })
}

async function executeRestoreMember(member) {
  saving.value = true
  try {
    const res = await apiUpdateTeamMember(member.id, { action: 'restore' })
    if (!res.ok) {
      flash(res.error || 'Could not restore member')
      return
    }
    flash('Member restored')
    await refresh()
  } finally {
    saving.value = false
  }
}

function promptTransferOwnership(member) {
  if (!isOwner.value || !member?.profileId) return
  const label = member.memberName || member.slug || 'this member'
  openConfirmModal({
    title: 'Transfer Team Ownership',
    message: `Make ${label} the team leader?\nYou will transfer ownership and become a regular team member.`,
    confirmText: 'Transfer Ownership',
    confirmClass: 'bg-sky-600 hover:bg-sky-700 text-white',
    onConfirm: () => executeTransferOwnership(member)
  })
}

async function executeTransferOwnership(member) {
  saving.value = true
  try {
    const res = await apiTransferTeamOwnership(member.id)
    if (!res.ok) {
      flash(res.error || 'Could not transfer ownership')
      return
    }
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
          Connect Teams seats, roles, and ownership. Members claim their cards to join.
        </p>
      </header>

      <p v-if="loading" class="text-sm text-gray-500 py-8 text-center">Loading…</p>

      <div v-else-if="!canUseTeam" class="card-item-bg rounded-2xl p-5 space-y-3">
        <h2 class="text-lg font-bold">Team is part of Connect Teams</h2>
        <p class="text-sm text-gray-400 leading-relaxed">
          Professional (Connect Solo) cards are personal-only. Upgrade to Business or Executive for shared team profiles, catalog sharing, and ownership.
        </p>
        <RouterLink
          to="/#connect-team"
          class="inline-flex w-full items-center justify-center py-3 rounded-full bg-white text-black text-sm font-bold no-underline"
        >
          View Connect Teams
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
            <p class="text-xs text-gray-400 mt-1">{{ CARD_ID_LABEL }} {{ inv.slug || '—' }} · {{ memberStatusLabel(inv.status) }}</p>
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

          <p v-if="isOwner" class="text-xs text-gray-300 font-medium pt-1">
            You are the team leader.
          </p>
          <p v-else class="text-xs text-gray-500 pt-1">
            Your role: <span class="text-gray-300">{{ personalTypeLabel(myRole) }}</span>
            · Package: <span class="text-gray-300">{{ personalTypeLabel(packageCeiling) }}</span>
          </p>
        </div>

        <div class="card-item-bg rounded-2xl p-4 mb-4 space-y-3">
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <h2 class="text-sm font-semibold">Meeting calendar &amp; CRM</h2>
          </div>

          <template v-if="isOwner">
            <p v-if="!meetingTool" class="text-xs text-amber-300/90 leading-relaxed">
              Choose a meeting calendar so booking emails include your calendar button.
            </p>
            <p v-else class="text-xs text-gray-400 leading-relaxed">
              Manage calendar and CRM access for each member individually below.
            </p>
          </template>
          <template v-else>
            <p class="text-xs text-emerald-400 leading-relaxed">
              Inherited from the team leader when enabled for your card.
            </p>
          </template>
          <TeamIntegrationsFields
            :meeting-tool="meetingTool"
            :uses-crm="usesCrm"
            :crm-provider="crmProvider"
            :crm-other="crmOther"
            :disabled="!isOwner || saving"
            @update:meetingTool="meetingTool = $event"
            @update:usesCrm="usesCrm = $event"
            @update:crmProvider="crmProvider = $event"
            @update:crmOther="crmOther = $event"
          />
          <button
            v-if="isOwner"
            type="button"
            class="w-full py-2.5 rounded-full bg-zinc-800 text-sm font-semibold disabled:opacity-50"
            :disabled="saving"
            @click="saveIntegrations"
          >
            Save calendar &amp; CRM
          </button>
        </div>

        <div class="card-item-bg rounded-2xl p-4 mb-6 space-y-3">
          <h2 class="text-sm font-semibold">Add member by {{ CARD_ID_LABEL.toLowerCase() }}</h2>
          <p class="text-xs text-gray-500">{{ CARD_ID_HINT }}</p>
          <input v-model="addSlug" type="text" class="field-input w-full" :placeholder="CARD_ID_LABEL" autocomplete="off">
          <input v-model="addEmail" type="email" class="field-input w-full" placeholder="Email (required if unclaimed)">
          <select v-model="addRole" class="field-input w-full bg-transparent">
            <option v-for="r in roleOptions" :key="r.id" :value="r.id">{{ r.label }}</option>
          </select>

          <!-- Member My Choice Toggle Button for Add Member -->
          <div class="pt-1">
            <button
              type="button"
              class="w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-between border transition"
              :class="addMyChoiceOpen ? 'bg-zinc-800 text-sky-300 border-zinc-700' : 'bg-zinc-900/60 text-gray-400 border-zinc-800 hover:text-gray-200'"
              @click="addMyChoiceOpen = !addMyChoiceOpen"
            >
              <span class="flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[16px]">tune</span>
                <span>Member sharing: {{ addMyChoiceOpen ? 'My choice (custom)' : 'All shared (default)' }}</span>
              </span>
              <span class="material-symbols-outlined text-[16px]">{{ addMyChoiceOpen ? 'expand_less' : 'expand_more' }}</span>
            </button>
            <div v-if="addMyChoiceOpen" class="mt-2.5 p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-2">
              <p class="text-[11px] text-gray-400">Choose what to share with this new member:</p>
              <div class="grid grid-cols-2 gap-1.5 text-xs">
                <label class="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-zinc-800/60 border border-zinc-700/60">
                  <input v-model="addSharing.shareCatalog" type="checkbox" class="rounded border-zinc-600 text-sky-500">
                  <span class="text-gray-200">Catalog</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-zinc-800/60 border border-zinc-700/60">
                  <input v-model="addSharing.shareBio" type="checkbox" class="rounded border-zinc-600 text-sky-500">
                  <span class="text-gray-200">Company Bio</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-zinc-800/60 border border-zinc-700/60">
                  <input v-model="addSharing.shareBanner" type="checkbox" class="rounded border-zinc-600 text-sky-500">
                  <span class="text-gray-200">Profile Banner</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-zinc-800/60 border border-zinc-700/60">
                  <input v-model="addSharing.shareWebsite" type="checkbox" class="rounded border-zinc-600 text-sky-500">
                  <span class="text-gray-200">Website</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-zinc-800/60 border border-zinc-700/60">
                  <input v-model="addSharing.shareSocialLinks" type="checkbox" class="rounded border-zinc-600 text-sky-500">
                  <span class="text-gray-200">Social Links</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-zinc-800/60 border border-zinc-700/60">
                  <input v-model="addSharing.shareContacts" type="checkbox" class="rounded border-zinc-600 text-sky-500">
                  <span class="text-gray-200">Team Contacts</span>
                </label>
                <label class="col-span-2 flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-zinc-800/60 border border-zinc-700/60">
                  <input v-model="addSharing.shareCalendarCrm" type="checkbox" class="rounded border-zinc-600 text-sky-500">
                  <span class="text-gray-200">Calendar &amp; CRM</span>
                </label>
              </div>
            </div>
          </div>

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
                <p v-if="m.slug" class="text-xs text-gray-500 mt-0.5">{{ CARD_ID_LABEL }} {{ m.slug }}</p>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <span
                  v-if="m.cardStatus === 'disabled'"
                  class="text-[10px] uppercase font-bold tracking-wide px-2 py-0.5 rounded-full bg-red-950 border border-red-700/60 text-red-300"
                >
                  Deactivated
                </span>
                <span class="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-zinc-800 text-gray-300">
                  {{ m.deleted ? 'Removed' : memberStatusLabel(m.status) }}
                </span>
              </div>
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

              <!-- Card Activate/Deactivate Control (Team Owner) -->
              <button
                v-if="isOwner && m.profileId !== team?.ownerProfileId && !m.deleted"
                type="button"
                class="py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                :class="m.cardStatus === 'disabled' ? 'bg-emerald-950/70 border border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/60' : 'bg-zinc-800/90 border border-zinc-700 text-amber-300 hover:bg-zinc-700'"
                :disabled="saving"
                @click="promptToggleCardStatus(m)"
              >
                <span class="material-symbols-outlined text-[16px]">{{ m.cardStatus === 'disabled' ? 'check_circle' : 'block' }}</span>
                <span>{{ m.cardStatus === 'disabled' ? 'Activate Card' : 'Deactivate Card' }}</span>
              </button>

              <!-- Individual Member Sharing Checkboxes (Team Owner) -->
              <div
                v-if="isOwner && m.profileId !== team?.ownerProfileId && !m.deleted"
                class="pt-3 pb-1 border-t border-zinc-800 space-y-2"
              >
                <div class="flex items-center justify-between">
                  <span class="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    Shared with this member
                  </span>
                  <button
                    type="button"
                    class="text-[11px] font-semibold px-2 py-0.5 rounded-full border transition flex items-center gap-1"
                    :class="isAllShared(m) ? 'bg-sky-950 text-sky-300 border-sky-700/60' : 'bg-zinc-800 text-gray-300 border-zinc-700'"
                    :disabled="saving"
                    @click="toggleMemberMyChoice(m)"
                  >
                    <span class="material-symbols-outlined text-[13px]">{{ isAllShared(m) ? 'select_all' : 'tune' }}</span>
                    <span>{{ isAllShared(m) ? 'All Shared' : 'My Choice' }}</span>
                  </button>
                </div>
                <div class="grid grid-cols-2 gap-1.5 text-xs">
                  <label class="flex items-center gap-2 cursor-pointer bg-zinc-900/80 hover:bg-zinc-800/80 p-2.5 rounded-xl border border-zinc-800/80 transition-colors">
                    <input
                      v-model="m.shareCatalog"
                      type="checkbox"
                      class="rounded border-zinc-600 text-sky-500 focus:ring-0 focus:ring-offset-0"
                      :disabled="saving"
                      @change="updateMemberSharing(m)"
                    >
                    <span class="text-gray-200">Catalog</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer bg-zinc-900/80 hover:bg-zinc-800/80 p-2.5 rounded-xl border border-zinc-800/80 transition-colors">
                    <input
                      v-model="m.shareBio"
                      type="checkbox"
                      class="rounded border-zinc-600 text-sky-500 focus:ring-0 focus:ring-offset-0"
                      :disabled="saving"
                      @change="updateMemberSharing(m)"
                    >
                    <span class="text-gray-200">Company Bio</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer bg-zinc-900/80 hover:bg-zinc-800/80 p-2.5 rounded-xl border border-zinc-800/80 transition-colors">
                    <input
                      v-model="m.shareBanner"
                      type="checkbox"
                      class="rounded border-zinc-600 text-sky-500 focus:ring-0 focus:ring-offset-0"
                      :disabled="saving"
                      @change="updateMemberSharing(m)"
                    >
                    <span class="text-gray-200">Profile Banner</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer bg-zinc-900/80 hover:bg-zinc-800/80 p-2.5 rounded-xl border border-zinc-800/80 transition-colors">
                    <input
                      v-model="m.shareWebsite"
                      type="checkbox"
                      class="rounded border-zinc-600 text-sky-500 focus:ring-0 focus:ring-offset-0"
                      :disabled="saving"
                      @change="updateMemberSharing(m)"
                    >
                    <span class="text-gray-200">Website</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer bg-zinc-900/80 hover:bg-zinc-800/80 p-2.5 rounded-xl border border-zinc-800/80 transition-colors">
                    <input
                      v-model="m.shareSocialLinks"
                      type="checkbox"
                      class="rounded border-zinc-600 text-sky-500 focus:ring-0 focus:ring-offset-0"
                      :disabled="saving"
                      @change="updateMemberSharing(m)"
                    >
                    <span class="text-gray-200">Social Links</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer bg-zinc-900/80 hover:bg-zinc-800/80 p-2.5 rounded-xl border border-zinc-800/80 transition-colors">
                    <input
                      v-model="m.shareContacts"
                      type="checkbox"
                      class="rounded border-zinc-600 text-sky-500 focus:ring-0 focus:ring-offset-0"
                      :disabled="saving"
                      @change="updateMemberSharing(m)"
                    >
                    <span class="text-gray-200">Team Contacts</span>
                  </label>
                  <label class="col-span-2 flex items-center gap-2 cursor-pointer bg-zinc-900/80 hover:bg-zinc-800/80 p-2.5 rounded-xl border border-zinc-800/80 transition-colors">
                    <input
                      v-model="m.shareCalendarCrm"
                      type="checkbox"
                      class="rounded border-zinc-600 text-sky-500 focus:ring-0 focus:ring-offset-0"
                      :disabled="saving"
                      @change="updateMemberSharing(m)"
                    >
                    <span class="text-gray-200">Calendar &amp; CRM</span>
                  </label>
                </div>
              </div>

              <!-- Member's own view of shared assets (when non-owner views their own entry) -->
              <div
                v-else-if="!isOwner && m.profileId === currentProfileId && !m.deleted"
                class="pt-2.5 border-t border-zinc-800 text-[11px] space-y-1.5"
              >
                <span class="text-gray-400 font-medium">Shared with you:</span>
                <div class="flex flex-wrap gap-1.5">
                  <span v-if="m.shareCatalog" class="px-2 py-0.5 rounded-full bg-sky-950/70 border border-sky-800/50 text-sky-300">Catalog</span>
                  <span v-if="m.shareBio" class="px-2 py-0.5 rounded-full bg-sky-950/70 border border-sky-800/50 text-sky-300">Bio</span>
                  <span v-if="m.shareBanner" class="px-2 py-0.5 rounded-full bg-sky-950/70 border border-sky-800/50 text-sky-300">Banner</span>
                  <span v-if="m.shareWebsite" class="px-2 py-0.5 rounded-full bg-sky-950/70 border border-sky-800/50 text-sky-300">Website</span>
                  <span v-if="m.shareSocialLinks" class="px-2 py-0.5 rounded-full bg-sky-950/70 border border-sky-800/50 text-sky-300">Social Links</span>
                  <span v-if="m.shareContacts" class="px-2 py-0.5 rounded-full bg-sky-950/70 border border-sky-800/50 text-sky-300">Contacts</span>
                  <span v-if="m.shareCalendarCrm" class="px-2 py-0.5 rounded-full bg-sky-950/70 border border-sky-800/50 text-sky-300">Calendar &amp; CRM</span>
                  <span v-if="!m.shareCatalog && !m.shareBio && !m.shareBanner && !m.shareWebsite && !m.shareSocialLinks && !m.shareContacts && !m.shareCalendarCrm" class="text-gray-500">None</span>
                </div>
              </div>

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
                class="py-2 rounded-xl bg-zinc-800 text-sm text-sky-300 hover:bg-zinc-700 transition"
                :disabled="saving"
                @click="promptTransferOwnership(m)"
              >
                Make owner
              </button>

              <!-- Apply to all members button next to Remove -->
              <div v-if="canEditMember(m) && m.profileId !== team?.ownerProfileId && !m.deleted" class="flex gap-2">
                <button
                  v-if="isOwner"
                  type="button"
                  class="flex-1 py-2 px-3 rounded-xl bg-zinc-800 text-xs font-semibold text-sky-300 hover:bg-zinc-700 border border-zinc-700 flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                  :disabled="saving"
                  @click="promptApplySharingToAll(m)"
                >
                  <span class="material-symbols-outlined text-[15px]">sync</span>
                  <span>Apply to all members</span>
                </button>
                <button
                  type="button"
                  class="py-2 px-3 rounded-xl bg-zinc-800 text-xs font-semibold text-red-300 hover:bg-zinc-700 border border-zinc-700 flex items-center justify-center gap-1 transition shrink-0 disabled:opacity-50"
                  :disabled="saving"
                  @click="promptRemoveMember(m)"
                >
                  <span class="material-symbols-outlined text-[15px]">person_remove</span>
                  <span>Remove</span>
                </button>
              </div>

              <button
                v-else-if="m.deleted && (isOwner || canManageRole(myRole, m.role))"
                type="button"
                class="py-2 rounded-xl bg-zinc-800 text-sm text-emerald-300 hover:bg-zinc-700 transition"
                :disabled="saving"
                @click="promptRestoreMember(m)"
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

      <!-- Normalized Popup Confirmation Dialog -->
      <Teleport to="body">
        <div
          v-if="confirmModal.isOpen"
          class="app-dialog-overlay fixed inset-0 z-[230] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          @click.self="confirmModal.isOpen = false"
        >
          <div class="w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-700 p-5 shadow-2xl space-y-4">
            <h3 class="text-base font-bold text-white tracking-tight">
              {{ confirmModal.title }}
            </h3>
            <p class="text-xs text-gray-300 leading-relaxed whitespace-pre-line">
              {{ confirmModal.message }}
            </p>
            <div class="flex gap-2 pt-2">
              <button
                type="button"
                class="flex-1 py-2.5 rounded-xl bg-zinc-800 text-xs font-semibold text-gray-300 hover:bg-zinc-700 transition"
                @click="confirmModal.isOpen = false"
              >
                {{ confirmModal.cancelText }}
              </button>
              <button
                type="button"
                class="flex-1 py-2.5 rounded-xl text-xs font-bold transition disabled:opacity-50"
                :class="confirmModal.confirmClass"
                :disabled="saving"
                @click="handleConfirmModalAction"
              >
                {{ confirmModal.confirmText }}
              </button>
            </div>
          </div>
        </div>
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
            <p v-if="isOwner" class="text-xs text-gray-400 mt-3 font-medium">
              You are the team leader · Package: {{ personalTypeLabel(packageCeiling) }}
            </p>
            <p v-else class="text-xs text-gray-500 mt-3">
              Your role: {{ personalTypeLabel(myRole) }}
              · Package: {{ personalTypeLabel(packageCeiling) }}
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
    </main>
  </div>
</template>
