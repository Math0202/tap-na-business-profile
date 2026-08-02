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
  CARD_KINDS,
  unlinkCard,
  deleteCard,
  restoreCard,
  updateCard,
  slugStats,
  kindLabel
} from '../lib/cardLinkStore'
import {
  apiProvisionCards,
  apiAdminOverview,
  apiUnlinkCard,
  apiDeleteCard,
  apiBulkDeleteCards,
  apiRestoreCard,
  apiUpdateCardKind
} from '../lib/api'
import { downloadSlugQrPng, downloadSlugsQrZip } from '../lib/qrExport'
import QRCode from 'qrcode'

const query = ref('')
const toast = ref('')
const allSlugs = ref([])
const slugQrMap = ref({})
const slugStatsSummary = ref({ total: 0, linked: 0, unlinked: 0, deleted: 0 })
const slugFilter = ref('all') // all | linked | unlinked | deleted
const slugKindFilter = ref('all')
const slugGenerating = ref(false)
const slugExporting = ref(false)
const slugDeleting = ref(false)
const slugForm = ref({ count: 10, kind: 'table' })
const dateFrom = ref('')
const dateTo = ref('')
const selected = ref(new Set())
const selectMode = ref(false)

const kindOptions = computed(() => Object.values(CARD_KINDS))

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
    return [c.serial, c.kind, c.productName, c.customerName, c.profileName, c.saleId, c.profileId]
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
    profileId: c.profileId || '',
    profileName: c.profileName || local[c.slug]?.profileName || '',
    productName: local[c.slug]?.productName || kindLabel(c.kind),
    createdAt: c.createdAt || local[c.slug]?.createdAt || '',
    linkedAt: c.linkedAt || '',
    deleted: c.deleted === true,
    deletedAt: c.deletedAt || '',
    deletedBy: c.deletedBy || '',
    status: c.deleted ? 'disabled' : (c.profileId ? 'linked' : 'unlinked')
  }))
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
  const count = Math.min(200, Math.max(1, Number(slugForm.value.count) || 1))
  const kind = slugForm.value.kind === 'personal' ? 'personal' : 'table'
  slugGenerating.value = true
  try {
    const remote = await apiProvisionCards({ count, kind })
    let created
    if (remote.ok && remote.data?.cards?.length) {
      created = provisionSlugs({ count, kind, remoteCards: remote.data.cards })
    } else {
      created = provisionSlugs({ count, kind })
      flash(remote.error ? `Saved locally (${remote.error})` : '')
    }
    refresh()
    await refreshSlugQrs(created)
    flash(`${created.length} slug${created.length === 1 ? '' : 's'} generated`)
  } finally {
    slugGenerating.value = false
  }
}

async function changeSlugKind(card, kind) {
  const next = kind === 'personal' ? 'personal' : 'table'
  updateCard(card.serial, { kind: next, productName: kindLabel(next) })
  const res = await apiUpdateCardKind(card.serial, next)
  // URLs stay on tapnam.com for both personal and table cards
  const map = { ...slugQrMap.value }
  delete map[card.serial]
  slugQrMap.value = map
  await refresh()
  flash(res.ok
    ? `Updated ${card.serial} → ${kindLabel(next)}`
    : `Updated locally (${res.error || 'offline'})`)
}

async function unlinkSlug(serial) {
  unlinkCard(serial)
  const res = await apiUnlinkCard(serial)
  await refresh()
  flash(res.ok ? 'Slug unlinked' : `Unlinked locally (${res.error || 'offline'})`)
}

async function removeSlug(serial) {
  if (!confirm(`Mark slug ${serial} as deleted? You can restore it later.`)) return
  deleteCard(serial)
  const res = await apiDeleteCard(serial)
  await refresh()
  flash(res.ok ? 'Slug marked deleted' : `Marked deleted locally (${res.error || 'offline'})`)
}

async function undeleteSlug(serial) {
  restoreCard(serial)
  const res = await apiRestoreCard(serial)
  await refresh()
  flash(res.ok ? 'Slug restored' : `Restored locally (${res.error || 'offline'})`)
}

async function removeSelectedSlugs() {
  const serials = [...selected.value]
  if (!serials.length) {
    flash('Select at least one slug to delete')
    return
  }
  const linked = filteredSlugs.value.filter((c) => selected.value.has(c.serial) && c.profileId).length
  const msg = linked
    ? `Mark ${serials.length} selected slug(s) as deleted? ${linked} are still linked to profiles. You can restore later.`
    : `Mark ${serials.length} selected slug(s) as deleted? You can restore them later.`
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
      flash(failed ? `Marked ${n} deleted; ${failed} failed` : `Marked ${n} slug(s) deleted`)
    } else {
      flash(`Marked deleted locally (${res.error || 'offline'})`)
    }
  } finally {
    slugDeleting.value = false
  }
}

function exportSlugsCsv() {
  const rows = exportRows.value
  if (!rows.length) {
    flash(selectMode.value ? 'Select at least one slug to export' : 'No slugs to export')
    return
  }
  const header = ['slug', 'kind', 'status', 'nfc_url', 'qr_url', 'profile', 'sale_id', 'created_at']
  const lines = [header.join(',')]
  for (const c of rows) {
    lines.push(
      [
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
  a.download = `tap-na-slugs-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
  flash(`Exported ${rows.length} slug(s)`)
}

async function downloadOneSlugQr(serial) {
  try {
    await downloadSlugQrPng(serial)
    flash(`Downloaded ${serial}.png`)
  } catch (err) {
    flash(err?.message || 'QR download failed')
  }
}

async function exportSlugsQrZip() {
  const rows = exportRows.value
  if (!rows.length) {
    flash(selectMode.value ? 'Select at least one slug to export' : 'No slugs to export')
    return
  }
  slugExporting.value = true
  try {
    const n = await downloadSlugsQrZip(rows, {
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
        <h1 class="text-2xl font-bold tracking-tight mt-1">Slugs</h1>
        <p class="text-gray-400 text-sm mt-1">
          Generate and manage NFC / QR slugs. Link them to profiles from setup or Link cards.
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
            <p class="text-sm font-semibold">Generate slugs</p>
            <p class="text-[11px] text-gray-500 mt-0.5">
              Pick the card type here — personal or business (menu, info, review, WiFi).
              That type is locked forever once the QR is printed.
            </p>
          </div>
          <div class="flex flex-col sm:flex-row gap-2">
            <div class="field-shell sm:w-28 !rounded-2xl">
              <input v-model="slugForm.count" type="number" min="1" max="200" class="field-input" aria-label="How many slugs">
            </div>
            <div class="field-shell flex-1 !rounded-2xl">
              <select v-model="slugForm.kind" class="field-input bg-transparent" aria-label="Card type">
                <option v-for="k in kindOptions" :key="k.id" :value="k.id">{{ k.label }}</option>
              </select>
            </div>
            <button
              type="button"
              class="px-5 py-3 rounded-full text-xs font-bold bg-white text-black shrink-0 disabled:opacity-50"
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
            <input v-model="query" type="search" class="field-input" placeholder="Search slug, type, profile…">
          </div>
          <button
            type="button"
            class="px-4 py-2.5 rounded-full text-xs font-semibold border border-[var(--border)] shrink-0"
            :class="selectMode ? 'bg-white text-black border-transparent' : ''"
            @click="toggleSelectMode"
          >
            {{ selectMode ? 'Selecting…' : 'Select' }}
          </button>
          <button
            type="button"
            class="px-4 py-2.5 rounded-full text-xs font-semibold border border-[var(--border)] shrink-0"
            :disabled="!exportRows.length"
            @click="exportSlugsCsv"
          >
            Export CSV{{ selectedCount ? ` (${selectedCount})` : '' }}
          </button>
          <button
            type="button"
            class="px-4 py-2.5 rounded-full text-xs font-bold bg-white text-black shrink-0 disabled:opacity-50"
            :disabled="!exportRows.length || slugExporting"
            @click="exportSlugsQrZip"
          >
            {{ slugExporting ? 'Packing…' : (selectedCount ? `Export QR ZIP (${selectedCount})` : 'Export QR ZIP') }}
          </button>
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

        <ul class="space-y-2">
          <li
            v-for="c in filteredSlugs"
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
              <div class="flex items-center gap-1.5 mt-1">
                <span class="material-symbols-outlined text-[15px] text-gray-400">{{ kindIcon(c.kind) }}</span>
                <select
                  :value="c.kind"
                  class="bg-transparent text-xs text-gray-300 border-none outline-none cursor-pointer"
                  aria-label="Change card type"
                  @change="changeSlugKind(c, $event.target.value)"
                >
                  <option v-for="k in kindOptions" :key="k.id" :value="k.id">{{ k.label }}</option>
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
        <p v-if="!filteredSlugs.length" class="text-sm text-gray-500">
          {{ allSlugs.length ? 'No slugs match these filters.' : 'No slugs yet. Generate a batch above to start writing tags.' }}
        </p>
      </section>
    </main>

    <AdminBottomNav />

    <div
      v-if="toast"
      class="fixed left-1/2 -translate-x-1/2 bottom-28 z-[110] px-4 py-3 rounded-2xl bg-white text-black text-sm font-medium shadow-xl"
    >
      {{ toast }}
    </div>
  </div>
</template>
