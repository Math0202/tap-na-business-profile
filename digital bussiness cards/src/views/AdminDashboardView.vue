<script setup>
import { computed, ref, onMounted, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import BrandMark from '../components/BrandMark.vue'
import AdminBottomNav from '../components/AdminBottomNav.vue'
import {
  apiAdminOverview,
  apiAdminAnalytics,
  apiSalesChangelog,
  apiAdminErrors,
  apiSalesFinance,
  apiSalesProducts,
  apiRestoreSalesAgent,
  apiRestoreSalesOrder,
  apiRestoreSalesQuote,
  apiRestoreSalesInvoice,
  apiRestoreSalesCash,
  apiRestoreSalesProduct,
  apiAdminPurgeDeleted,
  apiAdminListTeams,
  apiAdminCreateTeam,
  apiAdminUpdateTeam,
  apiAdminDeleteTeam,
  apiAdminListTeamMembers,
  apiAdminAddTeamMember,
  apiAdminUpdateTeamMember,
  apiAdminDeleteTeamMember
} from '../lib/api'
import { personalTypeLabel, memberStatusLabel, PERSONAL_TYPES } from '../lib/teamRoles'
import { CARD_ID_LABEL, CARD_ID_HINT } from '../lib/cardLabels'
import { cardImageSrc } from '../lib/cardLinkStore'
import { purgeLocalDeletedRecords } from '../lib/salesStore'
import ActivityCharts from '../components/ActivityCharts.vue'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const loadError = ref('')
const profiles = ref([])
const cards = ref([])
const query = ref('')
const tab = ref('all') // all | personal | business
const panel = ref('profiles') // profiles | analytics | log | errors | deleted

const changeLog = ref([])
const errorLog = ref([])
const errorSourceFilter = ref('')
const deletedItems = ref([])
const restoringId = ref('')
const clearingDeleted = ref(false)
const deletedNotice = ref('')

const analyticsDays = ref(30)
const analyticsLoading = ref(false)
const analyticsError = ref('')
const analyticsData = ref(null)

const panels = [
  { id: 'profiles', label: 'Profiles', icon: 'group' },
  { id: 'teams', label: 'Groups', icon: 'groups' },
  { id: 'analytics', label: 'Analytics', icon: 'monitoring' },
  { id: 'log', label: 'Log', icon: 'history' },
  { id: 'errors', label: 'Errors', icon: 'bug_report' },
  { id: 'deleted', label: 'Deleted', icon: 'delete' }
]

const teams = ref([])
const teamsLoading = ref(false)
const teamModalOpen = ref(false)
const teamModalMode = ref('create') // 'create' | 'edit'
const teamForm = ref({
  id: '',
  name: '',
  ownerProfileId: '',
  packageCeiling: 'business',
  shareCatalog: false,
  shareBio: false,
  shareBanner: false,
  shareWebsite: false,
  shareSocialLinks: false,
  shareContacts: false,
  shareCalendarCrm: false
})
const teamSaving = ref(false)
const teamModalError = ref('')
const candidateProfiles = ref([])
const teamQuery = ref('')

// Group Members Management State
const membersModalOpen = ref(false)
const activeTeam = ref(null)
const teamMembers = ref([])
const membersLoading = ref(false)
const memberActionSaving = ref(false)
const memberModalError = ref('')
const memberModalToast = ref('')
const showRemovedMembers = ref(false)

const newMemberMode = ref('profile') // 'profile' | 'slug'
const newMemberProfileId = ref('')
const newMemberSlug = ref('')
const newMemberRole = ref('business')
const newMemberMyChoice = ref(false)
const newMemberSharing = ref({
  shareCatalog: true,
  shareBio: true,
  shareBanner: true,
  shareWebsite: true,
  shareSocialLinks: true,
  shareContacts: true,
  shareCalendarCrm: true
})

function panelFromRoute() {
  const p = String(route.query.panel || 'profiles').toLowerCase()
  return panels.some((x) => x.id === p) ? p : 'profiles'
}

async function setPanel(id) {
  panel.value = id
  const q = { ...route.query }
  if (id === 'profiles') delete q.panel
  else q.panel = id
  await router.replace({ query: q })
  await refresh()
}

async function refresh() {
  loading.value = true
  loadError.value = ''
  try {
    if (panel.value === 'profiles') {
      const res = await apiAdminOverview()
      if (res.ok && res.data?.ok) {
        profiles.value = res.data.profiles || []
        cards.value = res.data.cards || []
      } else {
        loadError.value = res.error || 'Could not load live data'
      }
    } else if (panel.value === 'teams') {
      teamsLoading.value = true
      const [tRes, pRes] = await Promise.all([
        apiAdminListTeams(),
        apiAdminOverview()
      ])
      if (tRes.ok && tRes.data?.teams) {
        teams.value = tRes.data.teams
      } else {
        loadError.value = tRes.error || 'Could not load teams'
      }
      if (pRes.ok && pRes.data?.profiles) {
        candidateProfiles.value = (pRes.data.profiles || []).filter(
          (p) => p.cardType === 'personal' && !p.disabled
        )
      }
      teamsLoading.value = false
    } else if (panel.value === 'analytics') {
      analyticsLoading.value = true
      analyticsError.value = ''
      const res = await apiAdminAnalytics({ days: analyticsDays.value })
      if (res.ok && res.data?.ok) {
        analyticsData.value = res.data
      } else {
        analyticsError.value = res.error || 'Could not load analytics'
        analyticsData.value = null
      }
      analyticsLoading.value = false
    } else if (panel.value === 'log') {
      const logRes = await apiSalesChangelog({ limit: 200 })
      changeLog.value = logRes.ok ? (logRes.data?.changes || []) : []
      if (!logRes.ok) loadError.value = logRes.error || 'Could not load change log'
    } else if (panel.value === 'errors') {
      const errRes = await apiAdminErrors({
        limit: 200,
        source: errorSourceFilter.value || ''
      })
      errorLog.value = errRes.ok ? (errRes.data?.errors || []) : []
      if (!errRes.ok) loadError.value = errRes.error || 'Could not load error log'
    } else if (panel.value === 'deleted') {
      const [finRes, prodRes] = await Promise.all([
        apiSalesFinance(),
        apiSalesProducts({ includeInactive: true, includeDeleted: true })
      ])
      if (!finRes.ok) {
        loadError.value = finRes.error || 'Could not load deleted items'
        deletedItems.value = []
      } else {
        const data = finRes.data || {}
        const products = prodRes.ok ? (prodRes.data?.products || []) : []
        const rows = []
        for (const a of data.agents || []) {
          if (!a.deleted) continue
          rows.push({
            id: a.id,
            entityType: 'agent',
            label: a.name || a.id,
            meta: [a.email, a.phone].filter(Boolean).join(' · ') || 'Sales agent',
            deletedAt: a.deletedAt || '',
            deletedBy: a.deletedBy || ''
          })
        }
        for (const o of data.orders || []) {
          if (!o.deleted) continue
          rows.push({
            id: o.id,
            entityType: 'order',
            label: o.customerName || o.id,
            meta: `Sale · ${o.status || 'order'}`,
            deletedAt: o.deletedAt || '',
            deletedBy: o.deletedBy || ''
          })
        }
        for (const q of data.quotes || []) {
          if (!q.deleted) continue
          rows.push({
            id: q.id,
            entityType: 'quote',
            label: q.customerName || q.id,
            meta: 'Quote',
            deletedAt: q.deletedAt || '',
            deletedBy: q.deletedBy || ''
          })
        }
        for (const inv of data.invoices || []) {
          if (!inv.deleted) continue
          rows.push({
            id: inv.id,
            entityType: 'invoice',
            label: inv.customerName || inv.number || inv.id,
            meta: 'Invoice',
            deletedAt: inv.deletedAt || '',
            deletedBy: inv.deletedBy || ''
          })
        }
        for (const c of data.cashflow || []) {
          if (!c.deleted) continue
          rows.push({
            id: c.id,
            entityType: 'cash',
            label: c.category || c.note || c.id,
            meta: `${c.type || 'cash'} · ${c.amount ?? ''}`,
            deletedAt: c.deletedAt || '',
            deletedBy: c.deletedBy || ''
          })
        }
        for (const p of products) {
          if (!p.deleted) continue
          rows.push({
            id: p.id,
            entityType: 'product',
            label: p.name || p.id,
            meta: p.category || 'Product',
            deletedAt: p.deletedAt || '',
            deletedBy: p.deletedBy || ''
          })
        }
        rows.sort((a, b) => String(b.deletedAt || '').localeCompare(String(a.deletedAt || '')))
        deletedItems.value = rows
      }
    }
  } catch (err) {
    loadError.value = err?.message || 'Could not load data'
  }
  loading.value = false
}

async function restoreDeleted(item) {
  if (!item?.id || !item?.entityType) return
  restoringId.value = item.id
  const map = {
    agent: apiRestoreSalesAgent,
    order: apiRestoreSalesOrder,
    quote: apiRestoreSalesQuote,
    invoice: apiRestoreSalesInvoice,
    cash: apiRestoreSalesCash,
    product: apiRestoreSalesProduct
  }
  const fn = map[item.entityType]
  try {
    if (fn) await fn(item.id)
  } finally {
    restoringId.value = ''
    await refresh()
  }
}

async function clearDeletedBox() {
  const n = deletedItems.value.length
  if (!n || clearingDeleted.value) return
  if (!confirm(`Permanently remove ${n} deleted record${n === 1 ? '' : 's'}? This cannot be undone.`)) {
    return
  }
  clearingDeleted.value = true
  deletedNotice.value = ''
  try {
    const res = await apiAdminPurgeDeleted()
    if (!res.ok) {
      deletedNotice.value = res.error || 'Could not clear deleted records'
      return
    }
    purgeLocalDeletedRecords()
    deletedItems.value = []
    deletedNotice.value = `Cleared ${res.data?.purged ?? n} deleted record${(res.data?.purged ?? n) === 1 ? '' : 's'}`
    await refresh()
  } finally {
    clearingDeleted.value = false
  }
}

const stats = computed(() => {
  const personal = profiles.value.filter((p) => p.cardType !== 'table')
  const business = profiles.value.filter((p) => p.cardType === 'table')
  const linked = cards.value.filter((c) => c.profileId)
  return {
    total: profiles.value.length,
    personal: personal.length,
    business: business.length,
    slugs: cards.value.length,
    linked: linked.length,
    unlinked: cards.value.length - linked.length
  }
})

function matchesQuery(p) {
  const q = query.value.trim().toLowerCase()
  if (!q) return true
  const hay = [
    p.name,
    p.company,
    p.title,
    p.email,
    p.phone,
    p.address,
    ...(p.slugs || []).map((s) => s.slug)
  ]
    .join(' ')
    .toLowerCase()
  return hay.includes(q)
}

const filtered = computed(() =>
  profiles.value.filter((p) => {
    if (tab.value === 'personal' && p.cardType === 'table') return false
    if (tab.value === 'business' && p.cardType !== 'table') return false
    return matchesQuery(p)
  })
)

function profileLabel(p) {
  if (p.cardType === 'table') return p.company || p.name || 'Unnamed venue'
  return p.name || 'Unnamed profile'
}

function profileMeta(p) {
  if (p.cardType === 'table') return p.title || p.address || 'Venue'
  return [p.title, p.company].filter(Boolean).join(' · ') || 'Personal card'
}

function profileThumb(p) {
  return (p.cardType === 'table' ? p.logo : p.avatar) || p.avatar || p.logo || ''
}

function profileCardImage(p) {
  const slug = p?.slugs?.[0]
  if (slug) return cardImageSrc(slug)
  return cardImageSrc({ kind: p?.cardType === 'table' ? 'table' : 'personal' })
}

function initials(p) {
  const label = profileLabel(p)
  return label
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase()
}

function firstSlug(p) {
  return p.slugs?.length ? p.slugs[0].slug : ''
}

function viewPath(p) {
  const s = firstSlug(p)
  return s ? `/c/${encodeURIComponent(s)}` : ''
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

function formatJson(value) {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value || '')
  }
}

const filteredTeams = computed(() => {
  const q = teamQuery.value.trim().toLowerCase()
  if (!q) return teams.value
  return teams.value.filter((t) => {
    return (
      (t.name && t.name.toLowerCase().includes(q)) ||
      (t.ownerName && t.ownerName.toLowerCase().includes(q)) ||
      (t.ownerEmail && t.ownerEmail.toLowerCase().includes(q)) ||
      (t.id && t.id.toLowerCase().includes(q))
    )
  })
})

function openCreateTeamModal() {
  teamModalMode.value = 'create'
  teamModalError.value = ''
  teamForm.value = {
    id: '',
    name: '',
    ownerProfileId: candidateProfiles.value[0]?.id || '',
    packageCeiling: 'business',
    shareCatalog: false,
    shareBio: false,
    shareBanner: false,
    shareWebsite: false,
    shareSocialLinks: false,
    shareContacts: false,
    shareCalendarCrm: false
  }
  teamModalOpen.value = true
}

function openEditTeamModal(t) {
  teamModalMode.value = 'edit'
  teamModalError.value = ''
  teamForm.value = {
    id: t.id,
    name: t.name || '',
    ownerProfileId: t.ownerProfileId || '',
    packageCeiling: t.packageCeiling || 'business',
    shareCatalog: !!t.shareCatalog,
    shareBio: !!t.shareBio,
    shareBanner: !!t.shareBanner,
    shareWebsite: !!t.shareWebsite,
    shareSocialLinks: !!t.shareSocialLinks,
    shareContacts: !!t.shareContacts,
    shareCalendarCrm: !!t.shareCalendarCrm
  }
  teamModalOpen.value = true
}

async function saveTeam() {
  const name = teamForm.value.name.trim()
  if (!name) {
    teamModalError.value = 'Team name is required'
    return
  }
  if (!teamForm.value.ownerProfileId) {
    teamModalError.value = 'Team leader / owner is required'
    return
  }
  teamSaving.value = true
  teamModalError.value = ''
  try {
    let res
    if (teamModalMode.value === 'create') {
      res = await apiAdminCreateTeam(teamForm.value)
    } else {
      res = await apiAdminUpdateTeam(teamForm.value.id, teamForm.value)
    }
    if (!res.ok) {
      teamModalError.value = res.error || 'Could not save team'
      return
    }
    teamModalOpen.value = false
    await refresh()
  } finally {
    teamSaving.value = false
  }
}

async function deleteTeam(t) {
  if (!confirm(`Are you sure you want to delete team "${t.name}"?`)) return
  try {
    const res = await apiAdminDeleteTeam(t.id)
    if (!res.ok) {
      alert(res.error || 'Could not delete team')
      return
    }
    await refresh()
  } catch (err) {
    alert(err?.message || 'Delete failed')
  }
}

function flashMemberToast(msg) {
  memberModalToast.value = msg
  setTimeout(() => { memberModalToast.value = '' }, 2500)
}

function openMembersModal(t) {
  activeTeam.value = t
  memberModalError.value = ''
  memberModalToast.value = ''
  newMemberMode.value = 'profile'
  newMemberProfileId.value = availableCandidateProfiles.value[0]?.id || ''
  newMemberSlug.value = ''
  newMemberRole.value = 'business'
  newMemberMyChoice.value = false
  newMemberSharing.value = {
    shareCatalog: !!t.shareCatalog,
    shareBio: !!t.shareBio,
    shareBanner: !!t.shareBanner,
    shareWebsite: !!t.shareWebsite,
    shareSocialLinks: !!t.shareSocialLinks,
    shareContacts: !!t.shareContacts,
    shareCalendarCrm: !!t.shareCalendarCrm
  }
  membersModalOpen.value = true
  loadTeamMembers(t.id)
}

async function loadTeamMembers(teamId) {
  membersLoading.value = true
  try {
    const res = await apiAdminListTeamMembers(teamId, { includeDeleted: true })
    if (res.ok && res.data?.members) {
      teamMembers.value = res.data.members
      const activeCount = res.data.members.filter((m) => !m.deleted).length
      if (activeTeam.value) activeTeam.value.memberCount = activeCount
      const found = teams.value.find((t) => t.id === teamId)
      if (found) found.memberCount = activeCount
    } else {
      memberModalError.value = res.error || 'Could not load group members'
    }
  } catch (err) {
    memberModalError.value = err?.message || 'Error loading group members'
  } finally {
    membersLoading.value = false
  }
}

const visibleTeamMembers = computed(() => {
  if (showRemovedMembers.value) return teamMembers.value
  return teamMembers.value.filter((m) => !m.deleted)
})

const availableCandidateProfiles = computed(() => {
  const existingProfileIds = new Set(
    teamMembers.value.filter((m) => !m.deleted).map((m) => m.profileId).filter(Boolean)
  )
  return candidateProfiles.value.filter((p) => !existingProfileIds.has(p.id))
})

async function addTeamMember() {
  if (!activeTeam.value) return
  memberModalError.value = ''
  let payload = {
    role: newMemberRole.value
  }
  if (newMemberMode.value === 'profile') {
    if (!newMemberProfileId.value) {
      memberModalError.value = 'Please select a profile to add'
      return
    }
    payload.profileId = newMemberProfileId.value
  } else {
    const slug = newMemberSlug.value.trim()
    if (!slug) {
      memberModalError.value = `Please enter a ${CARD_ID_LABEL}`
      return
    }
    payload.slug = slug
  }

  if (newMemberMyChoice.value) {
    Object.assign(payload, newMemberSharing.value)
  } else {
    payload.shareCatalog = !!activeTeam.value.shareCatalog
    payload.shareBio = !!activeTeam.value.shareBio
    payload.shareBanner = !!activeTeam.value.shareBanner
    payload.shareWebsite = !!activeTeam.value.shareWebsite
    payload.shareSocialLinks = !!activeTeam.value.shareSocialLinks
    payload.shareContacts = !!activeTeam.value.shareContacts
    payload.shareCalendarCrm = !!activeTeam.value.shareCalendarCrm
  }

  memberActionSaving.value = true
  try {
    const res = await apiAdminAddTeamMember(activeTeam.value.id, payload)
    if (!res.ok) {
      memberModalError.value = res.error || 'Could not add member to group'
      return
    }
    flashMemberToast('Member added to group')
    newMemberSlug.value = ''
    newMemberMyChoice.value = false
    await loadTeamMembers(activeTeam.value.id)
  } catch (err) {
    memberModalError.value = err?.message || 'Failed to add member'
  } finally {
    memberActionSaving.value = false
  }
}

async function updateMemberSharing(member) {
  if (!activeTeam.value) return
  memberActionSaving.value = true
  try {
    const res = await apiAdminUpdateTeamMember(activeTeam.value.id, member.id, {
      shareCatalog: !!member.shareCatalog,
      shareBio: !!member.shareBio,
      shareBanner: !!member.shareBanner,
      shareWebsite: !!member.shareWebsite,
      shareSocialLinks: !!member.shareSocialLinks,
      shareContacts: !!member.shareContacts,
      shareCalendarCrm: !!member.shareCalendarCrm
    })
    if (!res.ok) {
      flashMemberToast(res.error || 'Failed to update member sharing')
      await loadTeamMembers(activeTeam.value.id)
      return
    }
    flashMemberToast(`Updated sharing for ${member.memberName || member.slug || 'member'}`)
  } catch (err) {
    flashMemberToast('Failed to update member sharing')
  } finally {
    memberActionSaving.value = false
  }
}

function isMemberAllShared(m) {
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
  const nextVal = !isMemberAllShared(m)
  m.shareCatalog = nextVal
  m.shareBio = nextVal
  m.shareBanner = nextVal
  m.shareWebsite = nextVal
  m.shareSocialLinks = nextVal
  m.shareContacts = nextVal
  m.shareCalendarCrm = nextVal
  updateMemberSharing(m)
}

async function applyMemberSharingToAll(member) {
  if (!activeTeam.value) return
  const label = member.memberName || member.slug || 'this member'
  if (!confirm(`Apply ${label}'s sharing settings to all active group members?`)) return
  memberActionSaving.value = true
  try {
    const res = await apiAdminUpdateTeamMember(activeTeam.value.id, member.id, {
      action: 'apply_to_all',
      shareCatalog: !!member.shareCatalog,
      shareBio: !!member.shareBio,
      shareBanner: !!member.shareBanner,
      shareWebsite: !!member.shareWebsite,
      shareSocialLinks: !!member.shareSocialLinks,
      shareContacts: !!member.shareContacts,
      shareCalendarCrm: !!member.shareCalendarCrm
    })
    if (!res.ok) {
      flashMemberToast(res.error || 'Failed to apply sharing to all')
      return
    }
    flashMemberToast('Applied sharing to all members')
    await loadTeamMembers(activeTeam.value.id)
  } catch (err) {
    flashMemberToast('Error applying sharing to all')
  } finally {
    memberActionSaving.value = false
  }
}

async function changeMemberRole(member, role) {
  if (!activeTeam.value) return
  memberActionSaving.value = true
  try {
    const res = await apiAdminUpdateTeamMember(activeTeam.value.id, member.id, { role })
    if (!res.ok) {
      flashMemberToast(res.error || 'Could not update role')
      return
    }
    member.role = role
    flashMemberToast('Role updated')
  } catch (err) {
    flashMemberToast('Error updating role')
  } finally {
    memberActionSaving.value = false
  }
}

async function toggleMemberCardStatus(member) {
  if (!activeTeam.value) return
  const willDisable = member.cardStatus !== 'disabled'
  const actionText = willDisable ? 'Deactivate' : 'Activate'
  if (!confirm(`${actionText} card for ${member.memberName || member.slug || 'this member'}?`)) return
  memberActionSaving.value = true
  try {
    const res = await apiAdminUpdateTeamMember(activeTeam.value.id, member.id, {
      action: 'toggle_card_status',
      cardStatus: willDisable ? 'disabled' : 'linked'
    })
    if (!res.ok) {
      flashMemberToast(res.error || 'Could not update card status')
      return
    }
    member.cardStatus = willDisable ? 'disabled' : 'linked'
    flashMemberToast(`Card ${willDisable ? 'deactivated' : 'activated'}`)
  } catch (err) {
    flashMemberToast('Error updating card status')
  } finally {
    memberActionSaving.value = false
  }
}

async function transferGroupLeadership(member) {
  if (!activeTeam.value || !member.profileId) return
  const label = member.memberName || member.slug || 'this member'
  if (!confirm(`Make ${label} the new leader / owner of group "${activeTeam.value.name}"?`)) return
  memberActionSaving.value = true
  try {
    const res = await apiAdminUpdateTeamMember(activeTeam.value.id, member.id, {
      action: 'transfer_ownership'
    })
    if (!res.ok) {
      flashMemberToast(res.error || 'Could not transfer leadership')
      return
    }
    flashMemberToast(`Leadership transferred to ${label}`)
    activeTeam.value.ownerProfileId = member.profileId
    activeTeam.value.ownerName = member.memberName || ''
    activeTeam.value.ownerEmail = member.memberEmail || ''
    await Promise.all([loadTeamMembers(activeTeam.value.id), refresh()])
  } catch (err) {
    flashMemberToast('Error transferring leadership')
  } finally {
    memberActionSaving.value = false
  }
}

async function removeTeamMember(member) {
  if (!activeTeam.value) return
  const label = member.memberName || member.slug || 'this member'
  if (!confirm(`Remove ${label} from group "${activeTeam.value.name}"?`)) return
  memberActionSaving.value = true
  try {
    const res = await apiAdminDeleteTeamMember(activeTeam.value.id, member.id)
    if (!res.ok) {
      flashMemberToast(res.error || 'Could not remove member')
      return
    }
    flashMemberToast('Member removed from group')
    await Promise.all([loadTeamMembers(activeTeam.value.id), refresh()])
  } catch (err) {
    flashMemberToast('Error removing member')
  } finally {
    memberActionSaving.value = false
  }
}

async function restoreTeamMember(member) {
  if (!activeTeam.value) return
  memberActionSaving.value = true
  try {
    const res = await apiAdminUpdateTeamMember(activeTeam.value.id, member.id, { action: 'restore' })
    if (!res.ok) {
      flashMemberToast(res.error || 'Could not restore member')
      return
    }
    flashMemberToast('Member restored to group')
    await Promise.all([loadTeamMembers(activeTeam.value.id), refresh()])
  } catch (err) {
    flashMemberToast('Error restoring member')
  } finally {
    memberActionSaving.value = false
  }
}

watch(
  () => route.query.panel,
  () => {
    panel.value = panelFromRoute()
  }
)

watch(analyticsDays, () => {
  if (panel.value === 'analytics') refresh()
})

onMounted(() => {
  document.title = 'Admin dashboard - tap-na'
  panel.value = panelFromRoute()
  refresh()
})
</script>

<template>
  <div class="min-h-screen flex flex-col items-center overflow-x-hidden">
    <main class="w-full max-w-7xl min-h-screen flex flex-col relative z-10 px-5 pt-16 pb-36">
      <header class="mb-6">
        <BrandMark size="sm" class="mb-2" />
        <h1 class="text-2xl font-bold tracking-tight mt-1">Admin dashboard</h1>
        <p class="text-gray-400 text-sm mt-1">
          Live overview, audit log, errors, and deleted sales records
        </p>
        <div class="flex flex-wrap gap-2 mt-4">
          <button
            type="button"
            class="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-[var(--border)] text-xs font-semibold hover:text-white transition-colors"
            @click="refresh"
          >
            <span class="material-symbols-outlined text-[18px]">refresh</span>
            Refresh
          </button>
        </div>
      </header>

      <!-- Dashboard panels -->
      <div class="flex gap-2 overflow-x-auto pb-1 mb-6">
        <button
          v-for="p in panels"
          :key="p.id"
          type="button"
          class="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-full text-xs font-semibold border transition-colors shrink-0"
          :class="panel === p.id
            ? 'bg-white text-black border-white'
            : 'bg-transparent text-gray-400 border-[var(--border)] hover:text-white'"
          @click="setPanel(p.id)"
        >
          <span class="material-symbols-outlined text-[16px]">{{ p.icon }}</span>
          {{ p.label }}
        </button>
      </div>

      <!-- Profiles panel -->
      <template v-if="panel === 'profiles'">
        <section class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <div class="card-item-bg rounded-2xl p-4">
            <p class="text-[11px] uppercase tracking-wide text-gray-500">Profiles</p>
            <p class="text-2xl font-bold mt-1">{{ stats.total }}</p>
          </div>
          <div class="card-item-bg rounded-2xl p-4">
            <p class="text-[11px] uppercase tracking-wide text-gray-500">Personal</p>
            <p class="text-2xl font-bold mt-1">{{ stats.personal }}</p>
          </div>
          <div class="card-item-bg rounded-2xl p-4">
            <p class="text-[11px] uppercase tracking-wide text-gray-500">Businesses</p>
            <p class="text-2xl font-bold mt-1">{{ stats.business }}</p>
          </div>
          <div class="card-item-bg rounded-2xl p-4">
            <p class="text-[11px] uppercase tracking-wide text-gray-500">Card IDs</p>
            <p class="text-2xl font-bold mt-1">{{ stats.slugs }}</p>
          </div>
          <div class="card-item-bg rounded-2xl p-4">
            <p class="text-[11px] uppercase tracking-wide text-gray-500">Linked</p>
            <p class="text-2xl font-bold mt-1 text-emerald-300">{{ stats.linked }}</p>
          </div>
          <div class="card-item-bg rounded-2xl p-4">
            <p class="text-[11px] uppercase tracking-wide text-gray-500">Unlinked</p>
            <p class="text-2xl font-bold mt-1 text-amber-300">{{ stats.unlinked }}</p>
          </div>
        </section>

        <div class="flex flex-col sm:flex-row gap-3 mb-6">
          <div class="field-shell flex-1 !rounded-2xl">
            <span class="material-symbols-outlined field-icon">search</span>
            <input
              v-model="query"
              type="search"
              class="field-input"
              placeholder="Search name, company, email, card ID…"
            >
          </div>
          <div class="flex gap-2 shrink-0">
            <button
              v-for="t in [
                { id: 'all', label: 'All' },
                { id: 'personal', label: 'Personal' },
                { id: 'business', label: 'Business' }
              ]"
              :key="t.id"
              type="button"
              class="px-3.5 py-2.5 rounded-full text-xs font-semibold border transition-colors"
              :class="tab === t.id
                ? 'bg-white text-black border-white'
                : 'bg-transparent text-gray-400 border-[var(--border)] hover:text-white'"
              @click="tab = t.id"
            >
              {{ t.label }}
            </button>
          </div>
        </div>

        <div v-if="loading" class="card-item-bg rounded-2xl p-6 text-sm text-gray-400 text-center">
          Loading live data…
        </div>
        <div v-else-if="loadError" class="card-item-bg rounded-2xl p-6 text-sm text-amber-300">
          {{ loadError }}. Check your connection and hit Refresh.
        </div>
        <div v-else-if="!filtered.length" class="card-item-bg rounded-2xl p-6 text-sm text-gray-400">
          No profiles match this filter.
        </div>

        <section v-else class="grid grid-cols-3 lg:grid-cols-6 gap-3 mb-8 justify-items-center">
          <article
            v-for="p in filtered"
            :key="p.id"
            class="card-item-bg rounded-2xl p-3 w-full flex flex-col items-center text-center gap-2"
          >
            <img
              v-if="profileThumb(p)"
              :src="profileThumb(p)"
              alt=""
              class="w-14 h-14 lg:w-16 lg:h-16 object-cover shrink-0 bg-zinc-800"
              :class="p.cardType === 'table' ? 'rounded-2xl' : 'rounded-full'"
            >
            <div
              v-else
              class="w-14 h-14 lg:w-16 lg:h-16 shrink-0 bg-zinc-800 flex items-center justify-center text-sm font-bold text-gray-300"
              :class="p.cardType === 'table' ? 'rounded-2xl' : 'rounded-full'"
            >
              {{ initials(p) }}
            </div>

            <img
              :src="profileCardImage(p)"
              alt=""
              class="w-full max-w-[88px] h-12 object-contain"
            >

            <div class="min-w-0 w-full">
              <p class="font-semibold text-xs lg:text-sm leading-tight line-clamp-2 text-[var(--text)]">{{ profileLabel(p) }}</p>
              <p class="text-[10px] lg:text-xs text-gray-400 line-clamp-2 mt-0.5">{{ profileMeta(p) }}</p>
            </div>

            <div class="flex items-center justify-center gap-1 flex-wrap">
              <span
                class="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
                :class="p.cardType === 'table'
                  ? 'bg-sky-500/15 text-sky-300'
                  : 'bg-violet-500/15 text-violet-300'"
              >
                {{ p.cardType === 'table' ? 'Biz' : 'Personal' }}
              </span>
              <span
                class="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
                :class="p.disabled
                  ? 'bg-amber-500/15 text-amber-300'
                  : 'bg-emerald-500/15 text-emerald-300'"
              >
                {{ p.disabled ? 'Off' : 'Live' }}
              </span>
            </div>

            <div class="text-[10px] text-gray-500 space-y-0.5 w-full min-w-0">
              <p class="truncate">{{ p.email || 'No email' }}</p>
              <p class="font-mono text-sky-300/90 truncate">
                <template v-if="p.slugs?.length">
                  {{ p.slugs.map((s) => s.slug).join(' · ') }}
                </template>
                <template v-else>No card ID</template>
              </p>
            </div>

            <div class="mt-auto w-full pt-1 space-y-1.5">
              <RouterLink
                v-if="viewPath(p)"
                :to="viewPath(p)"
                class="inline-flex items-center gap-1 w-full justify-center px-2 py-2 rounded-full bg-white text-black text-[10px] lg:text-xs font-bold no-underline hover:bg-gray-200 transition-colors"
              >
                <span class="material-symbols-outlined text-[16px]">visibility</span>
                View
              </RouterLink>
              <span
                v-else
                class="inline-flex items-center gap-1 w-full justify-center px-2 py-2 rounded-full border border-[var(--border)] text-[10px] lg:text-xs font-semibold text-gray-500"
              >
                No page
              </span>
              <RouterLink
                :to="`/admin/profiles/${encodeURIComponent(p.id)}/activities`"
                class="inline-flex items-center gap-1 w-full justify-center px-2 py-2 rounded-full border border-[var(--border)] text-[10px] lg:text-xs font-semibold no-underline hover:text-white transition-colors"
              >
                <span class="material-symbols-outlined text-[16px]">monitoring</span>
                Activity
              </RouterLink>
              <RouterLink
                :to="`/admin/profiles/${encodeURIComponent(p.id)}`"
                class="inline-flex items-center gap-1 w-full justify-center px-2 py-2 rounded-full border border-[var(--border)] text-[10px] lg:text-xs font-semibold no-underline hover:text-white transition-colors"
              >
                <span class="material-symbols-outlined text-[16px]">edit</span>
                Edit
              </RouterLink>
            </div>
          </article>
        </section>
      </template>

      <!-- Groups / Teams panel -->
      <section v-else-if="panel === 'teams'" class="mb-8 space-y-4">
        <div class="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-400">Groups &amp; Teams Management</h2>
            <p class="text-xs text-gray-500 mt-1">
              Create groups, assign group leaders, configure tiers, control asset sharing, and manage group members
            </p>
          </div>
          <button
            type="button"
            class="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-white text-black text-xs font-bold hover:bg-gray-100 transition-colors cursor-pointer"
            @click="openCreateTeamModal"
          >
            <span class="material-symbols-outlined text-[16px]">add</span>
            Create group
          </button>
        </div>

        <div class="card-item-bg rounded-2xl p-3">
          <input
            v-model="teamQuery"
            type="search"
            class="field-input w-full"
            placeholder="Search groups by name, leader name, or email…"
          >
        </div>

        <div v-if="teamsLoading" class="card-item-bg rounded-2xl p-8 text-center text-sm text-gray-400">
          Loading groups…
        </div>
        <div v-else-if="loadError" class="card-item-bg rounded-2xl p-6 text-sm text-amber-300">
          {{ loadError }}
        </div>
        <div v-else-if="!filteredTeams.length" class="card-item-bg rounded-2xl p-8 text-center text-sm text-gray-500">
          No groups found.
        </div>
        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <article
            v-for="t in filteredTeams"
            :key="t.id"
            class="card-item-bg rounded-2xl p-5 flex flex-col justify-between border border-[var(--border)] space-y-4"
          >
            <div class="space-y-3">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <h3 class="text-base font-bold truncate text-white">{{ t.name }}</h3>
                  <p class="text-xs text-gray-500">Created {{ formatDate(t.createdAt) }}</p>
                </div>
                <span class="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 shrink-0">
                  {{ personalTypeLabel(t.packageCeiling) }}
                </span>
              </div>

              <!-- Leader info -->
              <div class="bg-zinc-900/60 rounded-xl p-3 border border-zinc-800 space-y-1">
                <p class="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Team Leader / Owner</p>
                <p class="text-sm font-semibold truncate text-gray-200">{{ t.ownerName || '—' }}</p>
                <p class="text-xs text-gray-400 truncate">{{ t.ownerEmail || '—' }}</p>
                <p class="text-[10px] text-gray-600 font-mono truncate">ID: {{ t.ownerProfileId }}</p>
              </div>

              <!-- Stats & sharing indicators -->
              <div class="space-y-2">
                <div class="flex items-center justify-between text-xs text-gray-400">
                  <span>Team Members:</span>
                  <span class="font-bold text-white px-2 py-0.5 bg-zinc-800 rounded-full text-[11px]">{{ t.memberCount }}</span>
                </div>

                <div class="pt-1">
                  <p class="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">Sharing Enabled</p>
                  <div class="flex flex-wrap gap-1.5">
                    <span
                      class="text-[10px] font-medium px-2 py-0.5 rounded-md border"
                      :class="t.shareCatalog ? 'bg-sky-950/50 border-sky-700/60 text-sky-300' : 'bg-zinc-800/40 border-zinc-700/30 text-gray-500'"
                    >
                      Catalog
                    </span>
                    <span
                      class="text-[10px] font-medium px-2 py-0.5 rounded-md border"
                      :class="t.shareBio ? 'bg-sky-950/50 border-sky-700/60 text-sky-300' : 'bg-zinc-800/40 border-zinc-700/30 text-gray-500'"
                    >
                      Bio
                    </span>
                    <span
                      class="text-[10px] font-medium px-2 py-0.5 rounded-md border"
                      :class="t.shareBanner ? 'bg-sky-950/50 border-sky-700/60 text-sky-300' : 'bg-zinc-800/40 border-zinc-700/30 text-gray-500'"
                    >
                      Banner
                    </span>
                    <span
                      class="text-[10px] font-medium px-2 py-0.5 rounded-md border"
                      :class="t.shareWebsite ? 'bg-sky-950/50 border-sky-700/60 text-sky-300' : 'bg-zinc-800/40 border-zinc-700/30 text-gray-500'"
                    >
                      Website
                    </span>
                    <span
                      class="text-[10px] font-medium px-2 py-0.5 rounded-md border"
                      :class="t.shareSocialLinks ? 'bg-sky-950/50 border-sky-700/60 text-sky-300' : 'bg-zinc-800/40 border-zinc-700/30 text-gray-500'"
                    >
                      Social Links
                    </span>
                    <span
                      class="text-[10px] font-medium px-2 py-0.5 rounded-md border"
                      :class="t.shareContacts ? 'bg-emerald-950/50 border-emerald-700/60 text-emerald-300' : 'bg-zinc-800/40 border-zinc-700/30 text-gray-500'"
                    >
                      Contacts
                    </span>
                    <span
                      class="text-[10px] font-medium px-2 py-0.5 rounded-md border"
                      :class="t.shareCalendarCrm ? 'bg-purple-950/50 border-purple-700/60 text-purple-300' : 'bg-zinc-800/40 border-zinc-700/30 text-gray-500'"
                    >
                      Calendar &amp; CRM
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-2 pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                class="flex-1 py-2 px-3 rounded-xl bg-sky-950/70 border border-sky-700/60 text-xs font-semibold text-sky-300 hover:bg-sky-900/60 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                @click="openMembersModal(t)"
              >
                <span class="material-symbols-outlined text-[16px]">group</span>
                <span>Members ({{ t.memberCount }})</span>
              </button>
              <button
                type="button"
                class="py-2 px-3 rounded-xl border border-[var(--border)] text-xs font-semibold text-gray-300 hover:text-white hover:bg-zinc-800 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                title="Edit group & leader"
                @click="openEditTeamModal(t)"
              >
                <span class="material-symbols-outlined text-[16px]">edit</span>
                <span>Edit</span>
              </button>
              <button
                type="button"
                class="py-2 px-3 rounded-xl border border-red-800/40 text-xs font-semibold text-red-400 hover:bg-red-950/40 flex items-center justify-center transition-colors cursor-pointer"
                title="Delete group"
                @click="deleteTeam(t)"
              >
                <span class="material-symbols-outlined text-[16px]">delete</span>
              </button>
            </div>
          </article>
        </div>
      </section>

      <!-- Analytics panel -->
      <section v-else-if="panel === 'analytics'" class="mb-8 space-y-4">
        <div class="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-400">Activity analytics</h2>
            <p class="text-xs text-gray-500 mt-1">
              Tap vs scan, opens, clicks, shares, logins, and top profiles
            </p>
          </div>
          <div class="flex gap-2 overflow-x-auto pb-1">
            <button
              v-for="d in [7, 30, 90]"
              :key="d"
              type="button"
              class="px-3.5 py-2 rounded-full text-xs font-semibold border shrink-0"
              :class="analyticsDays === d ? 'bg-white text-black border-white' : 'border-[var(--border)] text-gray-400'"
              @click="analyticsDays = d"
            >
              {{ d }} days
            </button>
          </div>
        </div>

        <div v-if="analyticsLoading || loading" class="card-item-bg rounded-2xl p-6 text-sm text-gray-400 text-center">
          Loading analytics…
        </div>
        <div v-else-if="analyticsError || loadError" class="card-item-bg rounded-2xl p-6 text-sm text-amber-300">
          {{ analyticsError || loadError }}
        </div>
        <template v-else-if="analyticsData">
          <section class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <div class="card-item-bg rounded-2xl p-4">
              <p class="text-[11px] uppercase tracking-wide text-gray-500">Events</p>
              <p class="text-2xl font-bold mt-1">{{ analyticsData.analytics?.totals?.total || 0 }}</p>
            </div>
            <div class="card-item-bg rounded-2xl p-4">
              <p class="text-[11px] uppercase tracking-wide text-gray-500">Opens</p>
              <p class="text-2xl font-bold mt-1 text-emerald-300">{{ analyticsData.analytics?.totals?.opens || 0 }}</p>
            </div>
            <div class="card-item-bg rounded-2xl p-4">
              <p class="text-[11px] uppercase tracking-wide text-gray-500">Clicks</p>
              <p class="text-2xl font-bold mt-1 text-sky-300">{{ analyticsData.analytics?.totals?.clicks || 0 }}</p>
            </div>
            <div class="card-item-bg rounded-2xl p-4">
              <p class="text-[11px] uppercase tracking-wide text-gray-500">Shares</p>
              <p class="text-2xl font-bold mt-1 text-violet-300">{{ analyticsData.analytics?.totals?.shares || 0 }}</p>
            </div>
            <div class="card-item-bg rounded-2xl p-4">
              <p class="text-[11px] uppercase tracking-wide text-gray-500">Logins</p>
              <p class="text-2xl font-bold mt-1 text-amber-200">{{ analyticsData.logins || 0 }}</p>
            </div>
            <div class="card-item-bg rounded-2xl p-4">
              <p class="text-[11px] uppercase tracking-wide text-gray-500">Connections</p>
              <p class="text-2xl font-bold mt-1 text-amber-300">{{ analyticsData.connections || 0 }}</p>
            </div>
          </section>

          <ActivityCharts
            :analytics="analyticsData.analytics"
            :logins="analyticsData.logins || 0"
            :logins-by-day="analyticsData.loginsByDay || []"
            :connections="analyticsData.connections || 0"
            :top-profiles="analyticsData.topProfiles || []"
            :days="analyticsDays"
            show-logins
            show-top-profiles
          />
        </template>
      </section>

      <!-- Change log panel -->
      <section v-else-if="panel === 'log'" class="mb-8 space-y-4">
        <div>
          <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-400">Change log</h2>
          <p class="text-xs text-gray-500 mt-1">Create, update, delete, and restore actions across sales data.</p>
        </div>
        <div v-if="loading" class="card-item-bg rounded-2xl p-6 text-sm text-gray-400 text-center">Loading…</div>
        <div v-else-if="loadError" class="card-item-bg rounded-2xl p-6 text-sm text-amber-300">{{ loadError }}</div>
        <ul v-else class="space-y-2">
          <li v-for="entry in changeLog" :key="entry.id" class="card-item-bg rounded-2xl p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span
                    class="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                    :class="{
                      'bg-emerald-500/15 text-emerald-300': entry.action === 'create' || entry.action === 'restore',
                      'bg-sky-500/15 text-sky-300': entry.action === 'update',
                      'bg-red-500/15 text-red-300': entry.action === 'delete'
                    }"
                  >
                    {{ entry.action }}
                  </span>
                  <span class="text-[10px] uppercase tracking-wide text-gray-500">{{ entry.entityType }}</span>
                </div>
                <p class="text-sm font-semibold mt-1">{{ entry.summary || entry.entityLabel || entry.entityId }}</p>
                <p class="text-xs text-gray-400 mt-1">
                  {{ entry.actorName || entry.actorEmail || 'Unknown user' }}
                  <span v-if="entry.actorRole"> · {{ entry.actorRole }}</span>
                  <span v-if="entry.actorEmail && entry.actorName"> · {{ entry.actorEmail }}</span>
                </p>
              </div>
              <p class="text-[11px] text-gray-500 shrink-0 text-right">{{ formatDate(entry.at) }}</p>
            </div>
          </li>
        </ul>
        <p v-if="!loading && !loadError && !changeLog.length" class="text-sm text-gray-500">No changes logged yet.</p>
      </section>

      <!-- Errors panel -->
      <section v-else-if="panel === 'errors'" class="mb-8 space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-400">Error log</h2>
            <p class="text-xs text-gray-500 mt-1">Exceptions from API, database, email, and client requests.</p>
          </div>
          <select
            v-model="errorSourceFilter"
            class="field-shell field-input !py-2 !text-xs"
            @change="refresh()"
          >
            <option value="">All sources</option>
            <option value="supabase">supabase</option>
            <option value="api">api</option>
            <option value="email">email</option>
            <option value="client">client</option>
            <option value="staff">staff</option>
            <option value="sales_cash_sync">sales_cash_sync</option>
            <option value="og">og</option>
          </select>
        </div>
        <div v-if="loading" class="card-item-bg rounded-2xl p-6 text-sm text-gray-400 text-center">Loading…</div>
        <div v-else-if="loadError" class="card-item-bg rounded-2xl p-6 text-sm text-amber-300">{{ loadError }}</div>
        <ul v-else class="space-y-2">
          <li v-for="entry in errorLog" :key="entry.id" class="card-item-bg rounded-2xl p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-red-500/15 text-red-300">
                    {{ entry.source || 'error' }}
                  </span>
                  <span v-if="entry.httpStatus" class="text-[10px] uppercase tracking-wide text-gray-500">
                    HTTP {{ entry.httpStatus }}
                  </span>
                  <span v-if="entry.requestMethod || entry.requestPath" class="text-[10px] text-gray-500 truncate">
                    {{ entry.requestMethod }} {{ entry.requestPath }}
                  </span>
                </div>
                <p class="text-sm font-semibold mt-1 break-words">{{ entry.message }}</p>
                <p class="text-xs text-gray-400 mt-1">
                  {{ entry.actorEmail || entry.actorRole || 'System' }}
                  <span v-if="entry.actorRole && entry.actorEmail"> · {{ entry.actorRole }}</span>
                </p>
                <details v-if="entry.stack || (entry.context && Object.keys(entry.context).length)" class="mt-2">
                  <summary class="text-[11px] text-gray-500 cursor-pointer">Details</summary>
                  <pre v-if="entry.stack" class="mt-2 text-[10px] text-gray-400 whitespace-pre-wrap break-words max-h-40 overflow-auto">{{ entry.stack }}</pre>
                  <pre v-if="entry.context && Object.keys(entry.context).length" class="mt-2 text-[10px] text-gray-400 whitespace-pre-wrap break-words max-h-40 overflow-auto">{{ formatJson(entry.context) }}</pre>
                </details>
              </div>
              <p class="text-[11px] text-gray-500 shrink-0 text-right">{{ formatDate(entry.occurredAt) }}</p>
            </div>
          </li>
        </ul>
        <p v-if="!loading && !loadError && !errorLog.length" class="text-sm text-gray-500">No errors logged yet.</p>
      </section>

      <!-- Deleted panel -->
      <section v-else-if="panel === 'deleted'" class="mb-8 space-y-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-400">Deleted records</h2>
            <p class="text-xs text-gray-500 mt-1">Soft-deleted sales agents, orders, quotes, invoices, cash, and products. Restore anytime.</p>
          </div>
          <button
            type="button"
            class="shrink-0 px-4 py-2 rounded-full text-xs font-semibold border border-red-500/40 text-red-300 hover:bg-red-500/10 disabled:opacity-40"
            :disabled="!deletedItems.length || clearingDeleted || loading"
            @click="clearDeletedBox"
          >
            {{ clearingDeleted ? 'Clearing…' : 'Clear all' }}
          </button>
        </div>
        <p v-if="deletedNotice" class="text-xs" :class="deletedNotice.startsWith('Cleared') ? 'text-emerald-300' : 'text-amber-300'">
          {{ deletedNotice }}
        </p>
        <div v-if="loading" class="card-item-bg rounded-2xl p-6 text-sm text-gray-400 text-center">Loading…</div>
        <div v-else-if="loadError" class="card-item-bg rounded-2xl p-6 text-sm text-amber-300">{{ loadError }}</div>
        <ul v-else class="space-y-2">
          <li
            v-for="item in deletedItems"
            :key="item.entityType + ':' + item.id"
            class="card-item-bg rounded-2xl p-4 opacity-90"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-red-500/15 text-red-300">
                    {{ item.entityType }}
                  </span>
                  <span class="text-[10px] uppercase tracking-wide text-gray-500">Deleted</span>
                </div>
                <p class="text-sm font-semibold mt-1">{{ item.label }}</p>
                <p class="text-xs text-gray-400 mt-1">{{ item.meta }}</p>
                <p class="text-[11px] text-gray-500 mt-1">
                  {{ formatDate(item.deletedAt) }}
                  <span v-if="item.deletedBy"> · by {{ item.deletedBy }}</span>
                </p>
              </div>
              <button
                type="button"
                class="shrink-0 px-3 py-2 rounded-full text-xs font-semibold border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50"
                :disabled="restoringId === item.id"
                @click="restoreDeleted(item)"
              >
                {{ restoringId === item.id ? 'Restoring…' : 'Restore' }}
              </button>
            </div>
          </li>
        </ul>
        <p v-if="!loading && !loadError && !deletedItems.length" class="text-sm text-gray-500">No deleted records.</p>
      </section>

      <div class="flex flex-wrap items-center gap-3 pt-2 border-t border-[var(--border)]">
        <RouterLink to="/about" class="text-xs font-semibold text-gray-500 hover:text-gray-300">
          About tap-na
        </RouterLink>
        <RouterLink to="/admin/sales" class="text-xs font-semibold text-gray-500 hover:text-gray-300">
          Sales module
        </RouterLink>
      </div>
    </main>

    <AdminBottomNav />

    <Teleport to="body">
      <div
        v-if="teamModalOpen"
        class="app-dialog-overlay fixed inset-0 z-[210] flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        @click.self="teamModalOpen = false"
      >
        <div class="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-700 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-bold tracking-tight text-white">
              {{ teamModalMode === 'create' ? 'Create New Group' : 'Edit Group & Leader' }}
            </h2>
            <button type="button" class="text-gray-400 hover:text-white" @click="teamModalOpen = false">
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <p v-if="teamModalError" class="text-xs text-red-400 bg-red-950/40 border border-red-800/60 rounded-xl p-2.5">
            {{ teamModalError }}
          </p>

          <div class="space-y-3">
            <div>
              <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Group Name</label>
              <input
                v-model="teamForm.name"
                type="text"
                class="field-input w-full"
                placeholder="e.g. Acme Corp Sales"
                maxlength="120"
              >
            </div>

            <div>
              <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                Group Leader / Owner
              </label>
              <select
                v-model="teamForm.ownerProfileId"
                class="field-input w-full bg-zinc-900 text-sm"
              >
                <option value="" disabled>Select a profile</option>
                <option
                  v-for="p in candidateProfiles"
                  :key="p.id"
                  :value="p.id"
                >
                  {{ p.name || p.company || 'Unnamed' }} ({{ p.email || p.loginEmail || p.id }})
                </option>
              </select>
              <p class="text-[11px] text-gray-500 mt-1">
                The selected profile will be designated as the group owner.
              </p>
            </div>

            <div>
              <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Package Tier</label>
              <select v-model="teamForm.packageCeiling" class="field-input w-full bg-zinc-900 text-sm">
                <option value="business">Business</option>
                <option value="executive_exclusive">Executive Exclusive</option>
              </select>
            </div>

            <div class="pt-2 border-t border-zinc-800 space-y-2">
              <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide">Sharing Defaults</p>
              <label class="flex items-center gap-2.5 cursor-pointer text-sm">
                <input v-model="teamForm.shareCatalog" type="checkbox" class="rounded border-zinc-700">
                <span>Share Catalog with group members</span>
              </label>
              <label class="flex items-center gap-2.5 cursor-pointer text-sm">
                <input v-model="teamForm.shareBio" type="checkbox" class="rounded border-zinc-700">
                <span>Share Company Bio with group members</span>
              </label>
              <label class="flex items-center gap-2.5 cursor-pointer text-sm">
                <input v-model="teamForm.shareBanner" type="checkbox" class="rounded border-zinc-700">
                <span>Share Profile Banner with group members</span>
              </label>
              <label class="flex items-center gap-2.5 cursor-pointer text-sm">
                <input v-model="teamForm.shareWebsite" type="checkbox" class="rounded border-zinc-700">
                <span>Share Website with group members</span>
              </label>
              <label class="flex items-center gap-2.5 cursor-pointer text-sm">
                <input v-model="teamForm.shareSocialLinks" type="checkbox" class="rounded border-zinc-700">
                <span>Share Social Links with group members</span>
              </label>
              <label class="flex items-center gap-2.5 cursor-pointer text-sm">
                <input v-model="teamForm.shareContacts" type="checkbox" class="rounded border-zinc-700">
                <span>Share Contacts across group</span>
              </label>
              <label class="flex items-center gap-2.5 cursor-pointer text-sm">
                <input v-model="teamForm.shareCalendarCrm" type="checkbox" class="rounded border-zinc-700">
                <span>Share Calendar &amp; CRM with group members</span>
              </label>
            </div>
          </div>

          <div class="flex gap-3 pt-3">
            <button
              type="button"
              class="flex-1 py-2.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-sm font-semibold text-gray-300"
              @click="teamModalOpen = false"
            >
              Cancel
            </button>
            <button
              type="button"
              class="flex-1 py-2.5 rounded-full bg-white hover:bg-gray-100 text-black text-sm font-bold disabled:opacity-50"
              :disabled="teamSaving"
              @click="saveTeam"
            >
              {{ teamSaving ? 'Saving…' : (teamModalMode === 'create' ? 'Create Group' : 'Save Changes') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Group Members Management Modal -->
    <Teleport to="body">
      <div
        v-if="membersModalOpen"
        class="app-dialog-overlay fixed inset-0 z-[210] flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm"
        @click.self="membersModalOpen = false"
      >
        <div class="w-full max-w-2xl rounded-2xl bg-zinc-900 border border-zinc-700 p-5 sm:p-6 shadow-2xl flex flex-col max-h-[92vh] space-y-4">
          <!-- Header -->
          <div class="flex items-start justify-between gap-3 border-b border-zinc-800 pb-3.5">
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h2 class="text-lg font-bold tracking-tight text-white truncate">
                  {{ activeTeam?.name || 'Group' }} — Members
                </h2>
                <span class="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300">
                  {{ personalTypeLabel(activeTeam?.packageCeiling) }}
                </span>
              </div>
              <p class="text-xs text-gray-400 mt-1 flex items-center gap-1.5 flex-wrap">
                <span class="font-semibold text-gray-300">Leader:</span>
                <span>{{ activeTeam?.ownerName || '—' }}</span>
                <span v-if="activeTeam?.ownerEmail" class="text-gray-500">({{ activeTeam.ownerEmail }})</span>
              </p>
            </div>
            <button
              type="button"
              class="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors"
              @click="membersModalOpen = false"
            >
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <!-- Toast & Error Banners -->
          <p
            v-if="memberModalToast"
            class="text-xs text-emerald-300 bg-emerald-950/60 border border-emerald-700/60 rounded-xl p-2.5 transition-all"
          >
            {{ memberModalToast }}
          </p>
          <p
            v-if="memberModalError"
            class="text-xs text-red-400 bg-red-950/60 border border-red-700/60 rounded-xl p-2.5"
          >
            {{ memberModalError }}
          </p>

          <!-- Modal Scrollable Content -->
          <div class="flex-1 overflow-y-auto space-y-5 pr-1">
            <!-- Add Member Section -->
            <div class="bg-zinc-950/60 border border-zinc-800 rounded-2xl p-4 space-y-3">
              <div class="flex items-center justify-between gap-2 flex-wrap">
                <h3 class="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-[16px] text-sky-400">person_add</span>
                  <span>Add Member to Group</span>
                </h3>
                <!-- Mode Switcher -->
                <div class="flex rounded-lg bg-zinc-900 p-0.5 border border-zinc-800 text-[11px]">
                  <button
                    type="button"
                    class="px-2.5 py-1 rounded-md font-medium transition cursor-pointer"
                    :class="newMemberMode === 'profile' ? 'bg-zinc-800 text-white font-semibold' : 'text-gray-400 hover:text-gray-200'"
                    @click="newMemberMode = 'profile'"
                  >
                    Select Profile
                  </button>
                  <button
                    type="button"
                    class="px-2.5 py-1 rounded-md font-medium transition cursor-pointer"
                    :class="newMemberMode === 'slug' ? 'bg-zinc-800 text-white font-semibold' : 'text-gray-400 hover:text-gray-200'"
                    @click="newMemberMode = 'slug'"
                  >
                    Enter {{ CARD_ID_LABEL }}
                  </button>
                </div>
              </div>

              <!-- Profile Picker Mode -->
              <div v-if="newMemberMode === 'profile'" class="space-y-1">
                <label class="block text-[11px] font-semibold text-gray-400">Select Existing Profile</label>
                <select
                  v-model="newMemberProfileId"
                  class="field-input w-full bg-zinc-900 text-xs"
                >
                  <option value="" disabled>Choose a profile to add</option>
                  <option
                    v-for="p in availableCandidateProfiles"
                    :key="p.id"
                    :value="p.id"
                  >
                    {{ p.name || p.company || 'Unnamed' }} — {{ p.email || p.loginEmail || p.id }}
                  </option>
                </select>
                <p v-if="!availableCandidateProfiles.length" class="text-[11px] text-amber-300/90 pt-0.5">
                  All active personal profiles are already in this group.
                </p>
              </div>

              <!-- Card ID Slug Mode -->
              <div v-else class="space-y-1">
                <label class="block text-[11px] font-semibold text-gray-400">{{ CARD_ID_LABEL }}</label>
                <input
                  v-model="newMemberSlug"
                  type="text"
                  class="field-input w-full text-xs"
                  :placeholder="CARD_ID_LABEL"
                >
                <p class="text-[10px] text-gray-500">{{ CARD_ID_HINT }}</p>
              </div>

              <!-- Role Selector -->
              <div class="space-y-1">
                <label class="block text-[11px] font-semibold text-gray-400">Assigned Role</label>
                <select v-model="newMemberRole" class="field-input w-full bg-zinc-900 text-xs">
                  <option value="professional">Professional</option>
                  <option value="business">Business</option>
                  <option value="executive_exclusive">Executive Exclusive</option>
                </select>
              </div>

              <!-- Member My Choice Toggle -->
              <div class="pt-1">
                <button
                  type="button"
                  class="w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-between border transition cursor-pointer"
                  :class="newMemberMyChoice ? 'bg-zinc-800 text-sky-300 border-zinc-700' : 'bg-zinc-900/60 text-gray-400 border-zinc-800 hover:text-gray-200'"
                  @click="newMemberMyChoice = !newMemberMyChoice"
                >
                  <span class="flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-[15px]">tune</span>
                    <span>Member sharing: {{ newMemberMyChoice ? 'My choice (custom)' : 'Group defaults' }}</span>
                  </span>
                  <span class="material-symbols-outlined text-[15px]">{{ newMemberMyChoice ? 'expand_less' : 'expand_more' }}</span>
                </button>
                <div v-if="newMemberMyChoice" class="mt-2 p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-2">
                  <p class="text-[11px] text-gray-400">Choose what to share with this member:</p>
                  <div class="grid grid-cols-2 gap-1.5 text-xs">
                    <label class="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-zinc-800/60 border border-zinc-700/60">
                      <input v-model="newMemberSharing.shareCatalog" type="checkbox" class="rounded border-zinc-600 text-sky-500">
                      <span class="text-gray-200">Catalog</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-zinc-800/60 border border-zinc-700/60">
                      <input v-model="newMemberSharing.shareBio" type="checkbox" class="rounded border-zinc-600 text-sky-500">
                      <span class="text-gray-200">Company Bio</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-zinc-800/60 border border-zinc-700/60">
                      <input v-model="newMemberSharing.shareBanner" type="checkbox" class="rounded border-zinc-600 text-sky-500">
                      <span class="text-gray-200">Profile Banner</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-zinc-800/60 border border-zinc-700/60">
                      <input v-model="newMemberSharing.shareWebsite" type="checkbox" class="rounded border-zinc-600 text-sky-500">
                      <span class="text-gray-200">Website</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-zinc-800/60 border border-zinc-700/60">
                      <input v-model="newMemberSharing.shareSocialLinks" type="checkbox" class="rounded border-zinc-600 text-sky-500">
                      <span class="text-gray-200">Social Links</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-zinc-800/60 border border-zinc-700/60">
                      <input v-model="newMemberSharing.shareContacts" type="checkbox" class="rounded border-zinc-600 text-sky-500">
                      <span class="text-gray-200">Team Contacts</span>
                    </label>
                    <label class="col-span-2 flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-zinc-800/60 border border-zinc-700/60">
                      <input v-model="newMemberSharing.shareCalendarCrm" type="checkbox" class="rounded border-zinc-600 text-sky-500">
                      <span class="text-gray-200">Calendar &amp; CRM</span>
                    </label>
                  </div>
                </div>
              </div>

              <button
                type="button"
                class="w-full py-2.5 rounded-full bg-white hover:bg-gray-100 text-black text-xs font-bold transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                :disabled="memberActionSaving"
                @click="addTeamMember"
              >
                <span class="material-symbols-outlined text-[16px]">add</span>
                <span>{{ memberActionSaving ? 'Adding…' : 'Add to Group' }}</span>
              </button>
            </div>

            <!-- Members List Header -->
            <div class="flex items-center justify-between gap-2 pt-2">
              <h3 class="text-xs font-bold uppercase tracking-wider text-gray-400">
                Current Members ({{ visibleTeamMembers.length }})
              </h3>
              <label class="inline-flex items-center gap-2 text-[11px] text-gray-400 cursor-pointer">
                <input v-model="showRemovedMembers" type="checkbox" class="rounded border-zinc-700">
                <span>Show removed</span>
              </label>
            </div>

            <!-- Loading indicator -->
            <div v-if="membersLoading" class="text-center py-8 text-sm text-gray-400">
              Loading members…
            </div>

            <!-- Empty state -->
            <div v-else-if="!visibleTeamMembers.length" class="text-center py-6 text-xs text-gray-500 border border-dashed border-zinc-800 rounded-2xl">
              No members found for this group.
            </div>

            <!-- Members Cards -->
            <div v-else class="space-y-3">
              <div
                v-for="m in visibleTeamMembers"
                :key="m.id"
                class="bg-zinc-950/70 border border-zinc-800 rounded-2xl p-4 space-y-3"
                :class="m.deleted ? 'opacity-60' : ''"
              >
                <!-- Member Summary Row -->
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <p class="text-sm font-bold text-white truncate">{{ m.memberName || m.slug || 'Member' }}</p>
                      <span
                        v-if="m.profileId === activeTeam?.ownerProfileId"
                        class="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-700/40"
                      >
                        Group Leader
                      </span>
                    </div>
                    <p class="text-xs text-gray-400 truncate mt-0.5">{{ m.memberEmail || m.inviteEmail || '—' }}</p>
                    <p v-if="m.slug" class="text-[11px] text-gray-500 mt-0.5">{{ CARD_ID_LABEL }}: <span class="font-mono text-sky-400">{{ m.slug }}</span></p>
                  </div>

                  <!-- Status badges -->
                  <div class="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                    <span
                      v-if="m.cardStatus === 'disabled'"
                      class="text-[10px] uppercase font-bold tracking-wide px-2 py-0.5 rounded-full bg-red-950 border border-red-700/60 text-red-300"
                    >
                      Card Deactivated
                    </span>
                    <span
                      v-else-if="!m.deleted"
                      class="text-[10px] uppercase font-semibold tracking-wide px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-700/40 text-emerald-300"
                    >
                      Card Live
                    </span>
                    <span class="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-zinc-800 text-gray-300">
                      {{ m.deleted ? 'Removed' : memberStatusLabel(m.status) }}
                    </span>
                  </div>
                </div>

                <!-- Controls for active members -->
                <div v-if="!m.deleted" class="space-y-3 pt-2 border-t border-zinc-800/80">
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <!-- Role dropdown -->
                    <div>
                      <label class="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Role</label>
                      <select
                        class="field-input w-full bg-zinc-900 text-xs py-1.5"
                        :value="m.role"
                        :disabled="memberActionSaving"
                        @change="changeMemberRole(m, $event.target.value)"
                      >
                        <option value="professional">Professional</option>
                        <option value="business">Business</option>
                        <option value="executive_exclusive">Executive Exclusive</option>
                      </select>
                    </div>

                    <!-- Activate / Deactivate card -->
                    <div class="flex flex-col justify-end">
                      <button
                        type="button"
                        class="py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        :class="m.cardStatus === 'disabled' ? 'bg-emerald-950/70 border border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/60' : 'bg-zinc-800/90 border border-zinc-700 text-amber-300 hover:bg-zinc-700'"
                        :disabled="memberActionSaving"
                        @click="toggleMemberCardStatus(m)"
                      >
                        <span class="material-symbols-outlined text-[16px]">{{ m.cardStatus === 'disabled' ? 'check_circle' : 'block' }}</span>
                        <span>{{ m.cardStatus === 'disabled' ? 'Activate Card' : 'Deactivate Card' }}</span>
                      </button>
                    </div>
                  </div>

                  <!-- Independent Sharing Checkboxes -->
                  <div class="pt-2 border-t border-zinc-800/60 space-y-2">
                    <div class="flex items-center justify-between">
                      <span class="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                        Shared with this member
                      </span>
                      <button
                        type="button"
                        class="text-[11px] font-semibold px-2 py-0.5 rounded-full border transition flex items-center gap-1 cursor-pointer"
                        :class="isMemberAllShared(m) ? 'bg-sky-950 text-sky-300 border-sky-700/60' : 'bg-zinc-800 text-gray-300 border-zinc-700'"
                        :disabled="memberActionSaving"
                        @click="toggleMemberMyChoice(m)"
                      >
                        <span class="material-symbols-outlined text-[13px]">{{ isMemberAllShared(m) ? 'select_all' : 'tune' }}</span>
                        <span>{{ isMemberAllShared(m) ? 'All Shared' : 'My Choice' }}</span>
                      </button>
                    </div>

                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs">
                      <label class="flex items-center gap-2 cursor-pointer bg-zinc-900/80 hover:bg-zinc-800/80 p-2 rounded-xl border border-zinc-800/80 transition-colors">
                        <input
                          v-model="m.shareCatalog"
                          type="checkbox"
                          class="rounded border-zinc-600 text-sky-500"
                          :disabled="memberActionSaving"
                          @change="updateMemberSharing(m)"
                        >
                        <span class="text-gray-200 text-[11px]">Catalog</span>
                      </label>
                      <label class="flex items-center gap-2 cursor-pointer bg-zinc-900/80 hover:bg-zinc-800/80 p-2 rounded-xl border border-zinc-800/80 transition-colors">
                        <input
                          v-model="m.shareBio"
                          type="checkbox"
                          class="rounded border-zinc-600 text-sky-500"
                          :disabled="memberActionSaving"
                          @change="updateMemberSharing(m)"
                        >
                        <span class="text-gray-200 text-[11px]">Bio</span>
                      </label>
                      <label class="flex items-center gap-2 cursor-pointer bg-zinc-900/80 hover:bg-zinc-800/80 p-2 rounded-xl border border-zinc-800/80 transition-colors">
                        <input
                          v-model="m.shareBanner"
                          type="checkbox"
                          class="rounded border-zinc-600 text-sky-500"
                          :disabled="memberActionSaving"
                          @change="updateMemberSharing(m)"
                        >
                        <span class="text-gray-200 text-[11px]">Banner</span>
                      </label>
                      <label class="flex items-center gap-2 cursor-pointer bg-zinc-900/80 hover:bg-zinc-800/80 p-2 rounded-xl border border-zinc-800/80 transition-colors">
                        <input
                          v-model="m.shareWebsite"
                          type="checkbox"
                          class="rounded border-zinc-600 text-sky-500"
                          :disabled="memberActionSaving"
                          @change="updateMemberSharing(m)"
                        >
                        <span class="text-gray-200 text-[11px]">Website</span>
                      </label>
                      <label class="flex items-center gap-2 cursor-pointer bg-zinc-900/80 hover:bg-zinc-800/80 p-2 rounded-xl border border-zinc-800/80 transition-colors">
                        <input
                          v-model="m.shareSocialLinks"
                          type="checkbox"
                          class="rounded border-zinc-600 text-sky-500"
                          :disabled="memberActionSaving"
                          @change="updateMemberSharing(m)"
                        >
                        <span class="text-gray-200 text-[11px]">Social</span>
                      </label>
                      <label class="flex items-center gap-2 cursor-pointer bg-zinc-900/80 hover:bg-zinc-800/80 p-2 rounded-xl border border-zinc-800/80 transition-colors">
                        <input
                          v-model="m.shareContacts"
                          type="checkbox"
                          class="rounded border-zinc-600 text-sky-500"
                          :disabled="memberActionSaving"
                          @change="updateMemberSharing(m)"
                        >
                        <span class="text-gray-200 text-[11px]">Contacts</span>
                      </label>
                      <label class="col-span-2 flex items-center gap-2 cursor-pointer bg-zinc-900/80 hover:bg-zinc-800/80 p-2 rounded-xl border border-zinc-800/80 transition-colors">
                        <input
                          v-model="m.shareCalendarCrm"
                          type="checkbox"
                          class="rounded border-zinc-600 text-sky-500"
                          :disabled="memberActionSaving"
                          @change="updateMemberSharing(m)"
                        >
                        <span class="text-gray-200 text-[11px]">Calendar &amp; CRM</span>
                      </label>
                    </div>
                  </div>

                  <!-- Bottom Actions for Member -->
                  <div class="flex items-center gap-2 pt-2 border-t border-zinc-800/60 flex-wrap">
                    <button
                      type="button"
                      class="py-1.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-[11px] font-semibold text-sky-300 border border-zinc-700 flex items-center gap-1 transition cursor-pointer"
                      :disabled="memberActionSaving"
                      @click="applyMemberSharingToAll(m)"
                    >
                      <span class="material-symbols-outlined text-[14px]">sync</span>
                      <span>Apply to all members</span>
                    </button>

                    <button
                      v-if="m.profileId && m.profileId !== activeTeam?.ownerProfileId"
                      type="button"
                      class="py-1.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-[11px] font-semibold text-amber-300 border border-zinc-700 flex items-center gap-1 transition cursor-pointer"
                      :disabled="memberActionSaving"
                      @click="transferGroupLeadership(m)"
                    >
                      <span class="material-symbols-outlined text-[14px]">star</span>
                      <span>Make Leader</span>
                    </button>

                    <button
                      v-if="m.profileId !== activeTeam?.ownerProfileId"
                      type="button"
                      class="py-1.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-[11px] font-semibold text-red-400 border border-zinc-700 flex items-center gap-1 transition cursor-pointer ml-auto"
                      :disabled="memberActionSaving"
                      @click="removeTeamMember(m)"
                    >
                      <span class="material-symbols-outlined text-[14px]">person_remove</span>
                      <span>Remove</span>
                    </button>
                  </div>
                </div>

                <!-- Restore control for removed members -->
                <div v-else class="pt-2 border-t border-zinc-800/80 flex items-center justify-between">
                  <span class="text-xs text-gray-500">Member was removed from this group.</span>
                  <button
                    type="button"
                    class="py-1.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-emerald-300 border border-zinc-700 flex items-center gap-1 transition cursor-pointer"
                    :disabled="memberActionSaving"
                    @click="restoreTeamMember(m)"
                  >
                    <span class="material-symbols-outlined text-[15px]">restore</span>
                    <span>Restore Member</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Modal Footer -->
          <div class="pt-3 border-t border-zinc-800 flex justify-end">
            <button
              type="button"
              class="py-2.5 px-6 rounded-full bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white transition cursor-pointer"
              @click="membersModalOpen = false"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
