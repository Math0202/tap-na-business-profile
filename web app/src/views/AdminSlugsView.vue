<script setup>
import { computed, ref, onMounted, watch } from 'vue'
import { RouterLink } from 'vue-router'
import BrandMark from '../components/BrandMark.vue'
import AdminBottomNav from '../components/AdminBottomNav.vue'
import {
  provisionSlugs,
  listCards,
  cardPublicUrl,
  cardQrUrl,
  kindIcon,
  cardImageSrc,
  CARD_KINDS,
  unlinkCard,
  deleteCard,
  restoreCard,
  updateCard,
  slugStats,
  kindLabel,
  PERSONAL_TYPES,
  personalTypeLabel
} from '../lib/cardLinkStore'
import {
  apiProvisionCards,
  apiAdminOverview,
  apiUnlinkCard,
  apiDeleteCard,
  apiBulkDeleteCards,
  apiRestoreCard,
  apiUpdateCardKind,
  apiRenameCardBatch
} from '../lib/api'
import { downloadSlugQrPng, downloadSlugsQrZip } from '../lib/qrExport'
import CardExportPreviewModal from '../components/CardExportPreviewModal.vue'
import { CARD_ID_HINT, CARD_ID_LABEL } from '../lib/cardLabels'
import QRCode from 'qrcode'

const query = ref('')
const toast = ref('')
const allSlugs = ref([])
const allBatches = ref([])
const slugQrMap = ref({})
const slugStatsSummary = ref({ total: 0, linked: 0, unlinked: 0, deleted: 0 })
const slugFilter = ref('all') // all | linked | unlinked | deleted
const slugKindFilter = ref('all')
const slugGenerating = ref(false)
const slugExporting = ref(false)
const slugDeleting = ref(false)
const exportMenuOpen = ref(false)
const cardExportOpen = ref(false)
const cardExportRows = ref([])
const cardExportZipName = ref('')
const slugForm = ref({ count: 10, kind: 'table', personalType: 'business', name: '' })
const dateFrom = ref('')
const dateTo = ref('')
const selected = ref(new Set())
const selectMode = ref(false)
const expandedFolders = ref(new Set())
const renamingId = ref('')
const renameDraft = ref('')

const UNGROUPED_KEY = '__ungrouped__'
const kindOptions = computed(() => Object.values(CARD_KINDS))
const personalTypeOptions = computed(() => Object.values(PERSONAL_TYPES))

function dayStamp(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function formatSlugDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

const filteredSlugs = computed(() => {
  const q = query.value.trim().toLowerCase()
  const from = dateFrom.value
  const to = dateTo.value
  return allSlugs.value.filter((c) => {
    if (slugFilter.value === 'deleted') {
      if (!c.deleted) return false
    } else {
      if (c.deleted) return false
      if (slugFilter.value === 'linked' && !c.profileId) return false
      if (slugFilter.value === 'unlinked' && c.profileId) return false
    }
    if (slugKindFilter.value !== 'all' && c.kind !== slugKindFilter.value) return false
    const created = dayStamp(c.createdAt || c.linkedAt)
    if (from && (!created || created < from)) return false
    if (to && (!created || created > to)) return false
    if (!q) return true
    return [c.serial, c.kind, c.productName, c.customerName, c.profileName, c.saleId, c.profileId, c.batchName]
      .join(' ')
      .toLowerCase()
      .includes(q)
  })
})

const selectedCount = computed(() => selected.value.size)

const exportRows = computed(() => {
  if (selected.value.size) {
    return filteredSlugs.value.filter((c) => selected.value.has(c.serial))
  }
  return filteredSlugs.value
})

function folderKey(id) {
  return id || UNGROUPED_KEY
}

function groupTypeLabel(group) {
  if (!group?.kind) return ''
  const kind = kindLabel(group.kind)
  if (group.kind !== 'personal') return kind
  return `${kind} · ${personalTypeLabel(group.personalType)}`
}

const slugGroups = computed(() => {
  const metaById = Object.fromEntries((allBatches.value || []).map((b) => [b.id, b]))
  const buckets = new Map()
  for (const card of filteredSlugs.value) {
    const id = card.batchId || ''
    if (!buckets.has(id)) buckets.set(id, [])
    buckets.get(id).push(card)
  }
  const named = []
  let ungrouped = null
  for (const [id, slugs] of buckets) {
    if (!id) {
      ungrouped = {
        id: '',
        name: 'Ungrouped',
        kind: '',
        personalType: '',
        createdAt: '',
        slugs
      }
      continue
    }
    const meta = metaById[id] || {}
    named.push({
      id,
      name: meta.name || slugs[0]?.batchName || 'Untitled batch',
      kind: meta.kind || slugs[0]?.kind || 'table',
      personalType: meta.personalType || slugs[0]?.personalType || '',
      createdAt: meta.createdAt || slugs[0]?.createdAt || '',
      slugs
    })
  }
  named.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  return ungrouped ? [...named, ungrouped] : named
})

function isFolderExpanded(id) {
  return expandedFolders.value.has(folderKey(id))
}

function toggleFolder(id) {
  const key = folderKey(id)
  const next = new Set(expandedFolders.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expandedFolders.value = next
}

function expandFolder(id) {
  const key = folderKey(id)
  const next = new Set(expandedFolders.value)
  next.add(key)
  expandedFolders.value = next
}

function selectedInGroup(group) {
  return (group?.slugs || []).filter((c) => selected.value.has(c.serial)).length
}

function selectAllInGroup(group) {
  const next = new Set(selected.value)
  for (const c of group?.slugs || []) next.add(c.serial)
  selected.value = next
  selectMode.value = next.size > 0
}

function startRename(group) {
  if (!group?.id) return
  renamingId.value = group.id
  renameDraft.value = group.name || ''
  expandFolder(group.id)
}

function cancelRename() {
  renamingId.value = ''
  renameDraft.value = ''
}

function safeFilePart(name) {
  return String(name || 'slugs').replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').slice(0, 48) || 'slugs'
}

function isSelected(serial) {
  return selected.value.has(serial)
}

function toggleSelect(serial) {
  const next = new Set(selected.value)
  if (next.has(serial)) next.delete(serial)
  else next.add(serial)
  selected.value = next
  selectMode.value = next.size > 0
}

function selectAllFiltered() {
  selected.value = new Set(filteredSlugs.value.map((c) => c.serial))
  selectMode.value = true
}

function clearSelection() {
  selected.value = new Set()
}

function toggleSelectMode() {
  selectMode.value = !selectMode.value
  if (!selectMode.value) clearSelection()
}

function applyStats(list) {
  const active = list.filter((c) => !c.deleted)
  slugStatsSummary.value = {
    total: active.length,
    linked: active.filter((c) => c.profileId).length,
    unlinked: active.filter((c) => !c.profileId).length,
    deleted: list.filter((c) => c.deleted).length
  }
}

async function refresh() {
  // Render local cache instantly, then replace with backend truth
  allSlugs.value = listCards()
  slugStatsSummary.value = slugStats(allSlugs.value)

  const res = await apiAdminOverview()
  if (!res.ok || !Array.isArray(res.data?.cards)) return
  const local = Object.fromEntries(listCards().map((c) => [c.serial, c]))
  allSlugs.value = res.data.cards.map((c) => ({
    ...(local[c.slug] || {}),
    serial: c.slug,
    kind: c.kind,
    personalType: c.personalType || local[c.slug]?.personalType || '',
    productId: c.productId || local[c.slug]?.productId || '',
    profileId: c.profileId || '',
    profileName: c.profileName || local[c.slug]?.profileName || '',
    productName: local[c.slug]?.productName || kindLabel(c.kind),
    createdAt: c.createdAt || local[c.slug]?.createdAt || '',
    linkedAt: c.linkedAt || '',
    deleted: c.deleted === true,
    deletedAt: c.deletedAt || '',
    deletedBy: c.deletedBy || '',
    batchId: c.batchId || local[c.slug]?.batchId || '',
    batchName: c.batchName || local[c.slug]?.batchName || '',
    status: c.deleted ? 'disabled' : (c.profileId ? 'linked' : 'unlinked')
  }))
  allBatches.value = Array.isArray(res.data.batches) ? res.data.batches : []
  applyStats(allSlugs.value)
}

function flash(msg) {
  if (!msg) return
  toast.value = msg
  setTimeout(() => { toast.value = '' }, 2200)
}

async function refreshSlugQrs(cards = filteredSlugs.value.slice(0, 60)) {
  const map = { ...slugQrMap.value }
  await Promise.all(
    cards.map(async (c) => {
      if (map[c.serial]) return
      try {
        map[c.serial] = await QRCode.toDataURL(cardQrUrl(c.serial, undefined, { kind: c.kind }), {
          width: 160,
          margin: 1,
          color: { dark: '#0a0a0a', light: '#ffffff' }
        })
      } catch {
        map[c.serial] = ''
      }
    })
  )
  slugQrMap.value = map
}

function copyCardUrl(serial, via) {
  const card = allSlugs.value.find((c) => c.serial === serial)
  const kind = card?.kind
  const url = via === 'qr'
    ? cardQrUrl(serial, undefined, { kind })
    : cardPublicUrl(serial, undefined, { kind })
  navigator.clipboard?.writeText(url).then(
    () => flash(via === 'qr' ? 'QR URL copied' : 'NFC URL copied'),
    () => flash(url)
  )
}

async function generateSlugs() {
  const name = String(slugForm.value.name || '').trim().slice(0, 80)
  if (!name) {
    flash('Name this batch first')
    return
  }
  const count = Math.min(200, Math.max(1, Number(slugForm.value.count) || 1))
  const kind = slugForm.value.kind === 'personal' ? 'personal' : 'table'
  const personalType = kind === 'personal' ? slugForm.value.personalType || 'business' : ''
  slugGenerating.value = true
  try {
    const remote = await apiProvisionCards({ count, kind, personalType, name })
    const batchId = remote.data?.batch?.id || ''
    const batchName = remote.data?.batch?.name || name
    let created
    if (remote.ok && remote.data?.cards?.length) {
      created = provisionSlugs({
        count,
        kind,
        personalType,
        batchId,
        batchName,
        remoteCards: remote.data.cards
      })
    } else {
      created = provisionSlugs({
        count,
        kind,
        personalType,
        batchId: batchId || `local-${Date.now().toString(36)}`,
        batchName
      })
      flash(remote.error ? `Saved locally (${remote.error})` : '')
    }
    expandFolder(created[0]?.batchId || batchId)
    await refresh()
    await refreshSlugQrs(created)
    flash(`${created.length} ${CARD_ID_LABEL.toLowerCase()}${created.length === 1 ? '' : 's'} in “${batchName}”`)
  } finally {
    slugGenerating.value = false
  }
}

async function saveRename(group) {
  const name = String(renameDraft.value || '').trim().slice(0, 80)
  if (!group?.id) return
  if (!name) {
    flash('Name this batch')
    return
  }
  const res = await apiRenameCardBatch(group.id, name)
  for (const card of allSlugs.value.filter((c) => c.batchId === group.id)) {
    updateCard(card.serial, { batchName: name })
  }
  cancelRename()
  await refresh()
  flash(res.ok ? 'Batch renamed' : `Renamed locally (${res.error || 'offline'})`)
}

async function changeSlugKind(card, kind) {
  const next = kind === 'personal' ? 'personal' : 'table'
  const personalType =
    next === 'personal' ? card.personalType || slugForm.value.personalType || 'business' : ''
  updateCard(card.serial, { kind: next, personalType, productName: kindLabel(next) })
  const res = await apiUpdateCardKind(card.serial, next, { personalType })
  // URLs stay on tapnam.com for both personal and table cards
  const map = { ...slugQrMap.value }
  delete map[card.serial]
  slugQrMap.value = map
  await refresh()
  flash(res.ok
    ? `Updated ${card.serial} → ${kindLabel(next)}`
    : `Updated locally (${res.error || 'offline'})`)
}

async function changeSlugPersonalType(card, personalType) {
  if (card.kind !== 'personal') return
  updateCard(card.serial, { personalType })
  const res = await apiUpdateCardKind(card.serial, 'personal', { personalType })
  await refresh()
  flash(res.ok
    ? `Updated ${card.serial} → ${personalTypeLabel(personalType)}`
    : `Updated locally (${res.error || 'offline'})`)
}

async function unlinkSlug(serial) {
  unlinkCard(serial)
  const res = await apiUnlinkCard(serial)
  await refresh()
  flash(res.ok ? `${CARD_ID_LABEL} unlinked` : `Unlinked locally (${res.error || 'offline'})`)
}

async function removeSlug(serial) {
  if (!confirm(`Mark ${CARD_ID_LABEL.toLowerCase()} ${serial} as deleted? You can restore it later.`)) return
  deleteCard(serial)
  const res = await apiDeleteCard(serial)
  await refresh()
  flash(res.ok ? `${CARD_ID_LABEL} marked deleted` : `Marked deleted locally (${res.error || 'offline'})`)
}

async function undeleteSlug(serial) {
  restoreCard(serial)
  const res = await apiRestoreCard(serial)
  await refresh()
  flash(res.ok ? `${CARD_ID_LABEL} restored` : `Restored locally (${res.error || 'offline'})`)
}

async function removeSelectedSlugs() {
  const serials = [...selected.value]
  if (!serials.length) {
    flash(`Select at least one ${CARD_ID_LABEL.toLowerCase()} to delete`)
    return
  }
  const linked = filteredSlugs.value.filter((c) => selected.value.has(c.serial) && c.profileId).length
  const msg = linked
    ? `Mark ${serials.length} selected ${CARD_ID_LABEL.toLowerCase()}(s) as deleted? ${linked} are still linked to profiles. You can restore later.`
    : `Mark ${serials.length} selected ${CARD_ID_LABEL.toLowerCase()}(s) as deleted? You can restore them later.`
  if (!confirm(msg)) return

  slugDeleting.value = true
  try {
    for (const serial of serials) deleteCard(serial)
    const res = await apiBulkDeleteCards(serials)
    clearSelection()
    selectMode.value = false
    await refresh()
    if (res.ok) {
      const failed = Number(res.data?.failedCount || 0)
      const n = res.data?.deletedCount || serials.length
      flash(failed ? `Marked ${n} deleted; ${failed} failed` : `Marked ${n} ${CARD_ID_LABEL.toLowerCase()}(s) deleted`)
    } else {
      flash(`Marked deleted locally (${res.error || 'offline'})`)
    }
  } finally {
    slugDeleting.value = false
  }
}

function downloadCsv(rows, filename) {
  if (!rows.length) {
    flash(`No ${CARD_ID_LABEL.toLowerCase()}s to export`)
    return
  }
  const header = ['batch', 'card_id', 'kind', 'status', 'nfc_url', 'qr_url', 'profile', 'sale_id', 'created_at']
  const lines = [header.join(',')]
  for (const c of rows) {
    lines.push(
      [
        c.batchName || '',
        c.serial,
        c.kind,
        c.profileId ? 'linked' : 'unlinked',
        cardPublicUrl(c.serial, undefined, { kind: c.kind }),
        cardQrUrl(c.serial, undefined, { kind: c.kind }),
        c.profileName || '',
        c.saleId || '',
        c.createdAt || ''
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    )
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
  flash(`Exported ${rows.length} ${CARD_ID_LABEL.toLowerCase()}(s)`)
}

function exportSlugsCsv() {
  const rows = exportRows.value
  if (!rows.length) {
    flash(selectMode.value ? `Select at least one ${CARD_ID_LABEL.toLowerCase()} to export` : `No ${CARD_ID_LABEL.toLowerCase()}s to export`)
    return
  }
  downloadCsv(rows, `tap-na-slugs-${new Date().toISOString().slice(0, 10)}.csv`)
}

function exportGroupCsv(group) {
  downloadCsv(group?.slugs || [], `tap-na-slugs-${safeFilePart(group?.name)}-${new Date().toISOString().slice(0, 10)}.csv`)
}

async function downloadOneSlugQr(serial) {
  try {
    await downloadSlugQrPng(serial)
    flash(`Downloaded ${serial}.png`)
  } catch (err) {
    flash(err?.message || 'QR download failed')
  }
}

async function exportSlugsQrZip(rows, zipName) {
  const list = Array.isArray(rows) ? rows : exportRows.value
  if (!list.length) {
    flash(selectMode.value ? `Select at least one ${CARD_ID_LABEL.toLowerCase()} to export` : `No ${CARD_ID_LABEL.toLowerCase()}s to export`)
    return
  }
  slugExporting.value = true
  try {
    const n = await downloadSlugsQrZip(list, {
      zipName,
      onProgress: (done, total) => {
        if (done === total || done % 5 === 0) flash(`Building QR ${done}/${total}…`)
      }
    })
    flash(`Downloaded ${n} QR PNG(s) as ZIP`)
  } catch (err) {
    flash(err?.message || 'ZIP export failed')
  } finally {
    slugExporting.value = false
  }
}

async function exportGroupQrZip(group) {
  await exportSlugsQrZip(
    group?.slugs || [],
    `tap-na-qr-${safeFilePart(group?.name)}-${new Date().toISOString().slice(0, 10)}.zip`
  )
}

function openCardExport(rows, zipName = '') {
  const list = Array.isArray(rows) ? rows.filter((c) => c?.serial) : []
  if (!list.length) {
    flash(selectMode.value ? `Select at least one ${CARD_ID_LABEL.toLowerCase()} to export` : `No ${CARD_ID_LABEL.toLowerCase()}s to export`)
    return
  }
  exportMenuOpen.value = false
  cardExportRows.value = list
  cardExportZipName.value = zipName || ''
  cardExportOpen.value = true
}

function openCardExportFromSelection() {
  openCardExport(
    exportRows.value,
    `tap-na-cards-${new Date().toISOString().slice(0, 10)}.zip`
  )
}

function openCardExportFromGroup(group) {
  openCardExport(
    group?.slugs || [],
    `tap-na-cards-${safeFilePart(group?.name)}-${new Date().toISOString().slice(0, 10)}.zip`
  )
}

function closeCardExport() {
  cardExportOpen.value = false
  cardExportRows.value = []
  cardExportZipName.value = ''
}

function onCardExportDone(n) {
  flash(`Downloaded ${n} card set(s)`)
}

onMounted(() => {
  refresh()
  refreshSlugQrs()
})

watch(filteredSlugs, (rows) => {
  refreshSlugQrs()
  if (!selected.value.size) return
  const keep = new Set(rows.map((c) => c.serial))
  const next = new Set([...selected.value].filter((s) => keep.has(s)))
  if (next.size !== selected.value.size) selected.value = next
})
</script>

<template>
  <div class="min-h-screen flex flex-col items-center overflow-x-hidden">
    <main class="w-full max-w-3xl min-h-screen flex flex-col relative z-10 px-5 pt-16 pb-36">
      <header class="mb-6">
        <BrandMark size="sm" class="mb-2" />
        <RouterLink to="/admin" class="inline-flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-white mb-3">
          <span class="material-symbols-outlined text-[16px]">arrow_back</span>
          Dashboard
        </RouterLink>
        <h1 class="text-2xl font-bold tracking-tight mt-1">{{ CARD_ID_LABEL }}s</h1>
        <p class="text-gray-400 text-sm mt-1">
          Generate and manage NFC / QR card IDs. {{ CARD_ID_HINT }} Link them to profiles from setup or Link cards.
        </p>
      </header>

      <section class="mb-8 space-y-4">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div class="card-item-bg rounded-2xl p-3">
            <p class="text-[10px] uppercase tracking-wide text-gray-500">Total</p>
            <p class="text-lg font-bold">{{ slugStatsSummary.total }}</p>
          </div>
          <div class="card-item-bg rounded-2xl p-3">
            <p class="text-[10px] uppercase tracking-wide text-gray-500">Linked</p>
            <p class="text-lg font-bold text-emerald-400">{{ slugStatsSummary.linked }}</p>
          </div>
          <div class="card-item-bg rounded-2xl p-3">
            <p class="text-[10px] uppercase tracking-wide text-gray-500">Blank</p>
            <p class="text-lg font-bold text-amber-300">{{ slugStatsSummary.unlinked }}</p>
          </div>
          <div class="card-item-bg rounded-2xl p-3">
            <p class="text-[10px] uppercase tracking-wide text-gray-500">Deleted</p>
            <p class="text-lg font-bold text-red-300">{{ slugStatsSummary.deleted || 0 }}</p>
          </div>
        </div>

        <div class="card-item-bg rounded-2xl p-4 space-y-3">
          <div>
            <p class="text-sm font-semibold">Generate {{ CARD_ID_LABEL.toLowerCase() }}s</p>
            <p class="text-[11px] text-gray-500 mt-0.5">
              Name the batch, then pick personal or table. For personal cards, choose the tier.
            </p>
          </div>
          <div class="field-shell !rounded-2xl">
            <input
              v-model="slugForm.name"
              type="text"
              maxlength="80"
              class="field-input"
              placeholder="Windhoek Aug 16 — 20 Professional"
              aria-label="Batch name"
            >
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="k in kindOptions"
              :key="k.id"
              type="button"
              class="px-3 py-2 rounded-full text-xs font-semibold border transition-colors"
              :class="slugForm.kind === k.id
                ? 'bg-white text-black border-transparent'
                : 'border-[var(--border)] text-gray-300 hover:border-zinc-500'"
              @click="slugForm.kind = k.id"
            >
              {{ k.label }}
            </button>
          </div>
          <div v-if="slugForm.kind === 'personal'" class="flex flex-wrap gap-2">
            <button
              v-for="t in personalTypeOptions"
              :key="t.id"
              type="button"
              class="px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-colors"
              :class="slugForm.personalType === t.id
                ? 'bg-white text-black border-transparent'
                : 'border-[var(--border)] text-gray-400 hover:border-zinc-500'"
              @click="slugForm.personalType = t.id"
            >
              {{ t.label }}
            </button>
          </div>
          <div class="flex flex-col sm:flex-row gap-2">
            <div class="field-shell sm:w-28 !rounded-2xl">
              <input v-model="slugForm.count" type="number" min="1" max="200" class="field-input" :aria-label="`How many ${CARD_ID_LABEL.toLowerCase()}s`">
            </div>
            <button
              type="button"
              class="px-5 py-3 rounded-full text-xs font-bold bg-white text-black shrink-0 disabled:opacity-50 flex-1 sm:flex-none"
              :disabled="slugGenerating"
              @click="generateSlugs"
            >
              {{ slugGenerating ? 'Generating…' : 'Generate' }}
            </button>
          </div>
        </div>

        <div class="flex flex-col sm:flex-row gap-3">
          <div class="field-shell flex-1 !rounded-2xl">
            <span class="material-symbols-outlined field-icon">search</span>
            <input v-model="query" type="search" class="field-input" placeholder="Search card ID, type, profile…">
          </div>
          <button
            type="button"
            class="px-4 py-2.5 rounded-full text-xs font-semibold border border-[var(--border)] shrink-0"
            :class="selectMode ? 'bg-white text-black border-transparent' : ''"
            @click="toggleSelectMode"
          >
            {{ selectMode ? 'Selecting…' : 'Select' }}
          </button>
          <div class="relative shrink-0 z-30">
            <button
              type="button"
              class="px-4 py-2.5 rounded-full text-xs font-bold bg-white text-black disabled:opacity-50 w-full sm:w-auto"
              :disabled="!exportRows.length || slugExporting"
              @click="exportMenuOpen = !exportMenuOpen"
            >
              Export{{ selectedCount ? ` (${selectedCount})` : '' }}
            </button>
            <div
              v-if="exportMenuOpen"
              class="absolute right-0 top-full mt-2 z-40 min-w-[200px] rounded-2xl border border-[var(--border)] bg-zinc-950 shadow-xl p-2 space-y-1"
            >
              <p class="px-3 pt-1 text-[10px] uppercase tracking-wide text-gray-500">Card IDs only</p>
              <button
                type="button"
                class="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-gray-200 hover:bg-white/10"
                @click="exportMenuOpen = false; exportSlugsCsv()"
              >
                Export CSV
              </button>
              <button
                type="button"
                class="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-gray-200 hover:bg-white/10 disabled:opacity-50"
                :disabled="slugExporting"
                @click="exportMenuOpen = false; exportSlugsQrZip()"
              >
                Export QR ZIP
              </button>
              <div class="border-t border-[var(--border)] my-1" />
              <p class="px-3 pt-1 text-[10px] uppercase tracking-wide text-gray-500">Cards</p>
              <button
                type="button"
                class="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-gray-200 hover:bg-white/10"
                @click="openCardExportFromSelection"
              >
                Export cards…
              </button>
            </div>
          </div>
        </div>

        <div class="flex flex-col sm:flex-row gap-2">
          <div class="field-shell flex-1 !rounded-2xl">
            <span class="material-symbols-outlined field-icon">event</span>
            <input v-model="dateFrom" type="date" class="field-input" aria-label="Created from">
          </div>
          <div class="field-shell flex-1 !rounded-2xl">
            <span class="material-symbols-outlined field-icon">event</span>
            <input v-model="dateTo" type="date" class="field-input" aria-label="Created to">
          </div>
          <button
            v-if="dateFrom || dateTo"
            type="button"
            class="px-4 py-2.5 rounded-full text-xs font-semibold border border-[var(--border)] shrink-0"
            @click="dateFrom = ''; dateTo = ''"
          >
            Clear dates
          </button>
        </div>

        <div class="flex flex-wrap gap-2 items-center">
          <button
            v-for="f in [{ id: 'all', label: 'All' }, { id: 'unlinked', label: 'Blank' }, { id: 'linked', label: 'Linked' }, { id: 'deleted', label: 'Deleted' }]"
            :key="f.id"
            type="button"
            class="px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors"
            :class="slugFilter === f.id ? 'bg-white text-black' : 'border border-[var(--border)] text-gray-400'"
            @click="slugFilter = f.id"
          >
            {{ f.label }}
          </button>
          <div class="field-shell !rounded-full !py-1 !px-3">
            <select v-model="slugKindFilter" class="field-input bg-transparent text-[11px]" aria-label="Filter by type">
              <option value="all">All types</option>
              <option v-for="k in kindOptions" :key="k.id" :value="k.id">{{ k.label }}</option>
            </select>
          </div>
          <template v-if="selectMode || selectedCount">
            <button
              type="button"
              class="px-3 py-1.5 rounded-full text-[11px] font-semibold border border-[var(--border)] text-gray-300"
              :disabled="!filteredSlugs.length"
              @click="selectAllFiltered"
            >
              Select all ({{ filteredSlugs.length }})
            </button>
            <button
              type="button"
              class="px-3 py-1.5 rounded-full text-[11px] font-semibold border border-[var(--border)] text-gray-300"
              :disabled="!selectedCount"
              @click="clearSelection"
            >
              Clear ({{ selectedCount }})
            </button>
            <button
              type="button"
              class="px-3 py-1.5 rounded-full text-[11px] font-semibold border border-red-500/40 text-red-300 disabled:opacity-50"
              :disabled="!selectedCount || slugDeleting"
              @click="removeSelectedSlugs"
            >
              {{ slugDeleting ? 'Deleting…' : `Delete selected (${selectedCount})` }}
            </button>
          </template>
        </div>

        <div class="space-y-3">
          <div
            v-for="group in slugGroups"
            :key="folderKey(group.id)"
            class="rounded-2xl border border-[var(--border)] overflow-hidden"
          >
            <div class="card-item-bg px-4 py-3 flex items-start gap-3">
              <button
                type="button"
                class="mt-0.5 text-gray-400 hover:text-white"
                :aria-expanded="isFolderExpanded(group.id)"
                :aria-label="(isFolderExpanded(group.id) ? 'Collapse ' : 'Expand ') + group.name"
                @click="toggleFolder(group.id)"
              >
                <span class="material-symbols-outlined text-[22px]">{{ isFolderExpanded(group.id) ? 'folder_open' : 'folder' }}</span>
              </button>
              <div class="min-w-0 flex-1">
                <div v-if="renamingId === group.id" class="flex gap-2">
                  <div class="field-shell !rounded-xl flex-1">
                    <input
                      v-model="renameDraft"
                      type="text"
                      maxlength="80"
                      class="field-input"
                      aria-label="Batch name"
                      @keydown.enter.prevent="saveRename(group)"
                      @keydown.esc.prevent="cancelRename"
                    >
                  </div>
                  <button type="button" class="text-[11px] font-semibold text-emerald-300" @click="saveRename(group)">Save</button>
                  <button type="button" class="text-[11px] font-semibold text-gray-400" @click="cancelRename">Cancel</button>
                </div>
                <template v-else>
                  <button type="button" class="text-left w-full" @click="toggleFolder(group.id)">
                    <p class="text-sm font-semibold truncate">{{ group.name }}</p>
                    <p class="text-[11px] text-gray-500 mt-0.5">
                      {{ group.slugs.length }} {{ CARD_ID_LABEL.toLowerCase() }}{{ group.slugs.length === 1 ? '' : 's' }}
                      <template v-if="groupTypeLabel(group)"> · {{ groupTypeLabel(group) }}</template>
                      <template v-if="formatSlugDate(group.createdAt)"> · {{ formatSlugDate(group.createdAt) }}</template>
                      <template v-if="selectedInGroup(group)"> · {{ selectedInGroup(group) }} selected</template>
                    </p>
                  </button>
                  <div class="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                    <button
                      v-if="group.id"
                      type="button"
                      class="text-[11px] font-semibold text-gray-300 hover:text-white"
                      @click="startRename(group)"
                    >
                      Rename
                    </button>
                    <button type="button" class="text-[11px] font-semibold text-gray-300 hover:text-white" @click="selectAllInGroup(group)">
                      Select all
                    </button>
                    <button type="button" class="text-[11px] font-semibold text-gray-300 hover:text-white" @click="exportGroupCsv(group)">
                      Export CSV
                    </button>
                    <button
                      type="button"
                      class="text-[11px] font-semibold text-gray-300 hover:text-white disabled:opacity-50"
                      :disabled="slugExporting"
                      @click="exportGroupQrZip(group)"
                    >
                      Export QR ZIP
                    </button>
                    <button
                      type="button"
                      class="text-[11px] font-semibold text-sky-300 hover:text-sky-200"
                      @click="openCardExportFromGroup(group)"
                    >
                      Export cards
                    </button>
                  </div>
                </template>
              </div>
            </div>
            <ul v-if="isFolderExpanded(group.id)" class="space-y-2 p-2 pt-0">
          <li
            v-for="c in group.slugs"
            :key="c.serial"
            class="card-item-bg rounded-2xl p-4 flex items-start gap-3"
            :class="isSelected(c.serial) ? 'ring-1 ring-white/40' : ''"
          >
            <button
              type="button"
              class="mt-1 w-5 h-5 rounded border shrink-0 flex items-center justify-center transition-colors"
              :class="isSelected(c.serial) ? 'bg-white border-white text-black' : 'border-zinc-500 text-transparent hover:border-zinc-300'"
              :aria-label="(isSelected(c.serial) ? 'Deselect ' : 'Select ') + c.serial"
              :aria-pressed="isSelected(c.serial)"
              @click="toggleSelect(c.serial)"
            >
              <span class="material-symbols-outlined text-[16px]">check</span>
            </button>
            <img
              :src="cardImageSrc(c)"
              :alt="kindLabel(c.kind)"
              class="w-14 h-14 rounded-lg object-contain bg-zinc-900/80 p-1 shrink-0 border border-zinc-700"
            >
            <img
              v-if="slugQrMap[c.serial]"
              :src="slugQrMap[c.serial]"
              :alt="c.serial"
              class="w-16 h-16 rounded-lg bg-white p-1 shrink-0"
            >
            <button
              v-else
              type="button"
              class="w-16 h-16 rounded-lg bg-white/10 flex items-center justify-center shrink-0"
              aria-label="Show QR"
              @click="refreshSlugQrs([c])"
            >
              <span class="material-symbols-outlined text-[22px]">qr_code_2</span>
            </button>

            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 flex-wrap">
                <p class="text-sm font-mono font-semibold">{{ c.serial }}</p>
                <span
                  class="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                  :class="c.deleted
                    ? 'bg-red-500/15 text-red-300'
                    : c.profileId ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'"
                >
                  {{ c.deleted ? 'Deleted' : (c.profileId ? 'Linked' : 'Blank') }}
                </span>
              </div>
              <div class="flex items-center gap-1.5 mt-1 flex-wrap">
                <span class="material-symbols-outlined text-[15px] text-gray-400">{{ kindIcon(c.kind) }}</span>
                <select
                  :value="c.kind"
                  class="bg-transparent text-xs text-gray-300 border-none outline-none cursor-pointer"
                  aria-label="Change card type"
                  @change="changeSlugKind(c, $event.target.value)"
                >
                  <option v-for="k in kindOptions" :key="k.id" :value="k.id">{{ k.label }}</option>
                </select>
                <select
                  v-if="c.kind === 'personal'"
                  :value="c.personalType || 'business'"
                  class="bg-transparent text-xs text-gray-300 border-none outline-none cursor-pointer"
                  aria-label="Change personal tier"
                  @change="changeSlugPersonalType(c, $event.target.value)"
                >
                  <option v-for="t in personalTypeOptions" :key="t.id" :value="t.id">{{ t.label }}</option>
                </select>
              </div>
              <p class="text-[11px] text-gray-500 mt-1">
                Created {{ formatSlugDate(c.createdAt) || '—' }}
                <template v-if="c.linkedAt">
                  <span class="text-gray-700 mx-1">·</span>
                  Linked {{ formatSlugDate(c.linkedAt) }}
                </template>
              </p>
              <p v-if="c.profileName" class="text-[11px] text-gray-500 mt-0.5">→ {{ c.profileName }}</p>
              <p v-if="c.customerName" class="text-[11px] text-gray-500">{{ c.customerName }}</p>
              <div class="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                <button
                  type="button"
                  class="text-[11px] font-semibold hover:text-white"
                  :class="isSelected(c.serial) ? 'text-emerald-300' : 'text-gray-300'"
                  @click="toggleSelect(c.serial)"
                >
                  {{ isSelected(c.serial) ? 'Selected' : 'Select' }}
                </button>
                <button type="button" class="text-[11px] font-semibold text-gray-300 hover:text-white" @click="downloadOneSlugQr(c.serial)">
                  Download PNG
                </button>
                <button type="button" class="text-[11px] font-semibold text-gray-300 hover:text-white" @click="copyCardUrl(c.serial)">
                  Copy NFC URL
                </button>
                <button type="button" class="text-[11px] font-semibold text-gray-300 hover:text-white" @click="copyCardUrl(c.serial, 'qr')">
                  Copy QR URL
                </button>
                <button v-if="c.profileId" type="button" class="text-[11px] font-semibold text-amber-300" @click="unlinkSlug(c.serial)">
                  Unlink
                </button>
                <button
                  v-if="!c.deleted"
                  type="button"
                  class="text-[11px] font-semibold text-red-400"
                  @click="removeSlug(c.serial)"
                >
                  Delete
                </button>
                <button
                  v-else
                  type="button"
                  class="text-[11px] font-semibold text-emerald-300"
                  @click="undeleteSlug(c.serial)"
                >
                  Restore
                </button>
              </div>
            </div>
          </li>
            </ul>
          </div>
        </div>
        <p v-if="!filteredSlugs.length" class="text-sm text-gray-500">
          {{ allSlugs.length ? `No ${CARD_ID_LABEL.toLowerCase()}s match these filters.` : `No ${CARD_ID_LABEL.toLowerCase()}s yet. Generate a batch above to start writing tags.` }}
        </p>
      </section>
    </main>

    <AdminBottomNav />

    <CardExportPreviewModal
      :open="cardExportOpen"
      :cards="cardExportRows"
      :zip-name="cardExportZipName"
      @close="closeCardExport"
      @progress="flash"
      @done="onCardExportDone"
      @error="flash"
    />

    <div
      v-if="exportMenuOpen"
      class="fixed inset-0 z-20"
      aria-hidden="true"
      @click="exportMenuOpen = false"
    />

    <div
      v-if="toast"
      class="fixed left-1/2 -translate-x-1/2 bottom-28 z-[110] px-4 py-3 rounded-2xl bg-white text-black text-sm font-medium shadow-xl"
    >
      {{ toast }}
    </div>
  </div>
</template>
