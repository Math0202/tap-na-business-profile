<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import {
  DEFAULT_LOGO_LAYOUT,
  downloadCardsPdf,
  downloadCardsZip,
  normalizeLogoLayout,
  paintBackPreview,
  paintFrontPreview,
  toBlackAndWhite
} from '../lib/cardPrintExport'

const props = defineProps({
  open: { type: Boolean, default: false },
  cards: { type: Array, default: () => [] },
  zipName: { type: String, default: '' }
})

const emit = defineEmits(['close', 'progress', 'done', 'error'])

const logoBw = ref(null)
const layout = reactive({ ...DEFAULT_LOGO_LAYOUT })
const exporting = ref(false)
const logoInput = ref(null)
const frontCanvas = ref(null)
const backCanvas = ref(null)
const frontMeta = ref(null)
const drag = reactive({
  mode: '', // 'move' | 'resize'
  startX: 0,
  startY: 0,
  startLayout: null
})

const sampleCard = computed(() => props.cards.find((c) => c?.serial) || null)
const cardCount = computed(() => props.cards.filter((c) => c?.serial).length)

const sampleTier = computed(() => {
  const c = sampleCard.value
  if (!c) return ''
  const raw = String(c.personalType || '').toLowerCase()
  if (raw.includes('exec')) return 'Executive'
  if (raw.includes('professional')) return 'Professional'
  return 'Business'
})

async function redraw() {
  await nextTick()
  if (!props.open) return
  if (frontCanvas.value) {
    frontMeta.value = await paintFrontPreview(frontCanvas.value, {
      logoBw: logoBw.value,
      layout: { ...layout },
      personalType: sampleCard.value
    })
    drawHandles()
  }
  if (backCanvas.value && sampleCard.value) {
    await paintBackPreview(backCanvas.value, {
      serial: sampleCard.value.serial,
      kind: sampleCard.value.kind,
      personalType: sampleCard.value
    })
  }
}

function drawHandles() {
  const canvas = frontCanvas.value
  const meta = frontMeta.value
  if (!canvas || !meta?.logoRect || !logoBw.value) return
  const ctx = canvas.getContext('2d')
  const r = meta.logoRect
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'
  ctx.lineWidth = 1.5
  ctx.setLineDash([5, 4])
  ctx.strokeRect(r.x, r.y, r.w, r.h)
  ctx.setLineDash([])
  const hs = 10
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(r.x + r.w - hs / 2, r.y + r.h - hs / 2, hs, hs)
  ctx.restore()
}

function resetLayout() {
  Object.assign(layout, DEFAULT_LOGO_LAYOUT)
  redraw()
}

function removeLogo() {
  logoBw.value = null
  if (logoInput.value) logoInput.value.value = ''
  redraw()
}

async function onLogoFile(e) {
  const file = e.target?.files?.[0]
  if (!file) return
  try {
    const url = URL.createObjectURL(file)
    try {
      logoBw.value = await toBlackAndWhite(url)
    } finally {
      URL.revokeObjectURL(url)
    }
    Object.assign(layout, normalizeLogoLayout(layout))
    await redraw()
  } catch (err) {
    emit('error', err?.message || 'Could not process logo')
  }
}

function pointerPos(e) {
  const canvas = frontCanvas.value
  const rect = canvas.getBoundingClientRect()
  const clientX = e.touches?.[0]?.clientX ?? e.clientX
  const clientY = e.touches?.[0]?.clientY ?? e.clientY
  return {
    x: ((clientX - rect.left) / rect.width) * canvas.width,
    y: ((clientY - rect.top) / rect.height) * canvas.height
  }
}

function hitTest(p) {
  const r = frontMeta.value?.logoRect
  if (!r || !logoBw.value) return ''
  const hs = 14
  if (
    p.x >= r.x + r.w - hs &&
    p.x <= r.x + r.w + hs / 2 &&
    p.y >= r.y + r.h - hs &&
    p.y <= r.y + r.h + hs / 2
  ) {
    return 'resize'
  }
  if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
    return 'move'
  }
  return ''
}

function onPointerDown(e) {
  if (!logoBw.value || !frontMeta.value) return
  const p = pointerPos(e)
  const mode = hitTest(p)
  if (!mode) return
  e.preventDefault()
  drag.mode = mode
  drag.startX = p.x
  drag.startY = p.y
  drag.startLayout = { ...layout }
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('touchmove', onPointerMove, { passive: false })
  window.addEventListener('touchend', onPointerUp)
}

function onPointerMove(e) {
  if (!drag.mode || !frontMeta.value) return
  e.preventDefault?.()
  const p = pointerPos(e)
  const { scale, cardW } = frontMeta.value
  const dx = (p.x - drag.startX) / scale
  const dy = (p.y - drag.startY) / scale
  const start = drag.startLayout

  if (drag.mode === 'move') {
    const next = normalizeLogoLayout({
      ...start,
      xPct: start.xPct + dx / cardW,
      yPct: start.yPct + dy / frontMeta.value.cardH
    })
    Object.assign(layout, next)
  } else if (drag.mode === 'resize') {
    const next = normalizeLogoLayout({
      ...start,
      wPct: start.wPct + (dx * 2) / cardW
    })
    Object.assign(layout, next)
  }
  redraw()
}

function onPointerUp() {
  drag.mode = ''
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('touchmove', onPointerMove)
  window.removeEventListener('touchend', onPointerUp)
}

async function exportZip() {
  if (!cardCount.value || exporting.value) return
  exporting.value = true
  try {
    const n = await downloadCardsZip(props.cards, {
      logoBw: logoBw.value,
      layout: { ...layout },
      zipName: props.zipName || undefined,
      onProgress: (done, total) => {
        if (done === total || done % 5 === 0) emit('progress', `Building cards ${done}/${total}…`)
      }
    })
    emit('done', n)
    emit('close')
  } catch (err) {
    emit('error', err?.message || 'Card export failed')
  } finally {
    exporting.value = false
  }
}

async function exportPdf() {
  if (!cardCount.value || exporting.value) return
  exporting.value = true
  try {
    const base = String(props.zipName || '')
      .replace(/\.zip$/i, '')
      .trim()
    const pdfName = base ? `${base}.pdf` : undefined
    const n = await downloadCardsPdf(props.cards, {
      logoBw: logoBw.value,
      layout: { ...layout },
      pdfName,
      onProgress: (done, total) => {
        if (done === total || done % 5 === 0) emit('progress', `Building PDF ${done}/${total}…`)
      }
    })
    emit('done', n)
    emit('close')
  } catch (err) {
    emit('error', err?.message || 'PDF export failed')
  } finally {
    exporting.value = false
  }
}

function close() {
  if (exporting.value) return
  emit('close')
}

watch(
  () => props.open,
  (v) => {
    if (v) {
      Object.assign(layout, DEFAULT_LOGO_LAYOUT)
      nextTick(() => redraw())
    }
  }
)

watch(sampleCard, () => {
  if (props.open) redraw()
})

onMounted(() => {
  if (props.open) redraw()
})

onBeforeUnmount(() => {
  onPointerUp()
})
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4"
  >
    <div class="absolute inset-0 bg-black/70" @click="close" />
    <div
      class="relative w-full max-w-3xl card-item-bg rounded-3xl p-5 shadow-2xl max-h-[92vh] overflow-y-auto space-y-4"
    >
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2 class="text-lg font-bold">Export cards</h2>
          <p class="text-[11px] text-gray-500 mt-0.5">
            {{ cardCount }} card{{ cardCount === 1 ? '' : 's' }}{{ sampleTier ? ' · ' + sampleTier : '' }} · optional logo (always black &amp; white) · drag to move, corner to resize
          </p>
        </div>
        <button
          type="button"
          class="text-gray-400 hover:text-white shrink-0"
          aria-label="Close"
          :disabled="exporting"
          @click="close"
        >
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <div class="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        <label class="flex-1">
          <span class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Logo (optional)</span>
          <input
            ref="logoInput"
            type="file"
            accept="image/*"
            class="block w-full text-xs text-gray-300 file:mr-3 file:py-2 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-white file:text-black"
            @change="onLogoFile"
          >
        </label>
        <div class="flex gap-2 sm:pt-5">
          <button
            type="button"
            class="px-3 py-2 rounded-full text-[11px] font-semibold border border-[var(--border)]"
            :disabled="!logoBw"
            @click="resetLayout"
          >
            Reset layout
          </button>
          <button
            type="button"
            class="px-3 py-2 rounded-full text-[11px] font-semibold border border-[var(--border)]"
            :disabled="!logoBw"
            @click="removeLogo"
          >
            Remove logo
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Front</p>
          <div class="rounded-2xl overflow-hidden border border-zinc-700 bg-black">
            <canvas
              ref="frontCanvas"
              class="w-full h-auto block touch-none cursor-grab active:cursor-grabbing"
              @pointerdown="onPointerDown"
              @touchstart.prevent="onPointerDown"
            />
          </div>
        </div>
        <div>
          <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">
            Back
            <span v-if="sampleCard" class="normal-case font-mono text-gray-500">· {{ sampleCard.serial }}</span>
          </p>
          <div class="rounded-2xl overflow-hidden border border-zinc-700 bg-black">
            <canvas ref="backCanvas" class="w-full h-auto block" />
          </div>
          <p class="text-[10px] text-gray-500 mt-1">Each card gets its own labeled QR (slug in the centre) on the back.</p>
        </div>
      </div>

      <div class="flex flex-col sm:flex-row gap-2 pt-1">
        <button
          type="button"
          class="sm:flex-1 py-3 rounded-full border border-[var(--border)] text-sm font-semibold"
          :disabled="exporting"
          @click="close"
        >
          Cancel
        </button>
        <button
          type="button"
          class="sm:flex-1 py-3 rounded-full border border-[var(--border)] text-sm font-semibold disabled:opacity-60"
          :disabled="!cardCount || exporting"
          @click="exportZip"
        >
          {{ exporting ? 'Packing…' : `Export ZIP (${cardCount})` }}
        </button>
        <button
          type="button"
          class="sm:flex-1 py-3 rounded-full bg-white text-black text-sm font-bold disabled:opacity-60"
          :disabled="!cardCount || exporting"
          @click="exportPdf"
        >
          {{ exporting ? 'Building…' : `Export PDF (${cardCount})` }}
        </button>
      </div>
    </div>
  </div>
</template>
