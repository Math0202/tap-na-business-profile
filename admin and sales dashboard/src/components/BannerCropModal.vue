<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  src: { type: String, default: '' },
  title: { type: String, default: 'Adjust banner' },
  canReset: { type: Boolean, default: false }
})

const emit = defineEmits(['close', 'confirm', 'reset', 'replace'])

const activeSrc = ref(props.src || '')
const replaceInput = ref(null)

const fitMode = ref('width') // 'width' | 'height'
const zoom = ref(1)
const offsetX = ref(0)
const offsetY = ref(0)
const dragging = ref(false)
const dragStart = ref({ x: 0, y: 0, ox: 0, oy: 0 })
const imageEl = ref(null)

const viewportWidth = 320
const viewportHeight = 160
const outputWidth = 1200
const outputHeight = 600

const zoomPercent = computed({
  get: () => Math.round(zoom.value * 100),
  set: (v) => {
    zoom.value = Math.min(3, Math.max(1, Number(v) / 100))
  }
})

watch(
  () => [props.open, props.src],
  () => {
    if (!props.open) return
    activeSrc.value = props.src || ''
    fitMode.value = 'width'
    zoom.value = 1
    offsetX.value = 0
    offsetY.value = 0
  }
)

function triggerReplace() {
  replaceInput.value?.click()
}

function onFileSelect(e) {
  const file = e.target.files && e.target.files[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    alert('Please choose an image file.')
    e.target.value = ''
    return
  }
  const reader = new FileReader()
  reader.onload = (ev) => {
    activeSrc.value = ev.target.result
    fitMode.value = 'width'
    zoom.value = 1
    offsetX.value = 0
    offsetY.value = 0
    emit('replace', ev.target.result)
  }
  reader.readAsDataURL(file)
  e.target.value = ''
}

function setFitMode(mode) {
  if (fitMode.value === mode) return
  fitMode.value = mode
  zoom.value = 1
  offsetX.value = 0
  offsetY.value = 0
}

function onPointerDown(e) {
  dragging.value = true
  dragStart.value = {
    x: e.clientX,
    y: e.clientY,
    ox: offsetX.value,
    oy: offsetY.value
  }
}

function onPointerMove(e) {
  if (!dragging.value) return
  offsetX.value = dragStart.value.ox + (e.clientX - dragStart.value.x)
  offsetY.value = dragStart.value.oy + (e.clientY - dragStart.value.y)
}

function onPointerUp() {
  dragging.value = false
}

function imageStyle() {
  const el = imageEl.value
  if (!el || !el.naturalWidth) return {}
  const baseScale =
    fitMode.value === 'height'
      ? viewportHeight / el.naturalHeight
      : viewportWidth / el.naturalWidth
  const scale = baseScale * zoom.value
  const w = el.naturalWidth * scale
  const h = el.naturalHeight * scale
  return {
    width: `${w}px`,
    height: `${h}px`,
    transform: `translate(calc(-50% + ${offsetX.value}px), calc(-50% + ${offsetY.value}px))`
  }
}

async function confirmCrop() {
  const img = imageEl.value
  if (!img?.naturalWidth) return
  const canvas = document.createElement('canvas')
  canvas.width = outputWidth
  canvas.height = outputHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // Fill canvas with dark background in case image does not cover the full canvas
  ctx.fillStyle = '#18181b'
  ctx.fillRect(0, 0, outputWidth, outputHeight)

  const baseScale =
    fitMode.value === 'height'
      ? viewportHeight / img.naturalHeight
      : viewportWidth / img.naturalWidth
  const scale = baseScale * zoom.value
  const imgW = img.naturalWidth * scale
  const imgH = img.naturalHeight * scale
  const imgLeft = viewportWidth / 2 + offsetX.value - imgW / 2
  const imgTop = viewportHeight / 2 + offsetY.value - imgH / 2

  const factor = outputWidth / viewportWidth
  const destX = imgLeft * factor
  const destY = imgTop * factor
  const destW = imgW * factor
  const destH = imgH * factor

  ctx.drawImage(img, destX, destY, destW, destH)

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
  if (blob) emit('confirm', blob)
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="app-dialog-overlay fixed inset-0 z-[220] flex items-end sm:items-center justify-center p-4 sm:p-6"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <div class="absolute inset-0 bg-black/75" @click="emit('close')" />
      <div class="relative w-full max-w-sm card-item-bg rounded-3xl p-5 shadow-2xl space-y-4">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-lg font-bold">{{ title }}</h2>
          <button
            type="button"
            class="w-9 h-9 rounded-full bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center"
            aria-label="Close"
            @click="emit('close')"
          >
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <p class="text-xs text-gray-400 leading-relaxed">
          Choose whether to fit by width or height. Drag to reposition and use the slider to zoom.
        </p>

        <!-- Preview Viewport Frame (2:1 aspect ratio) -->
        <div
          class="relative mx-auto bg-zinc-900 border border-zinc-700 rounded-2xl overflow-hidden touch-none select-none shadow-inner"
          :style="{ width: `${viewportWidth}px`, height: `${viewportHeight}px` }"
          @pointerdown="onPointerDown"
        >
          <img
            v-if="activeSrc"
            ref="imageEl"
            :src="activeSrc"
            alt="Banner crop preview"
            class="absolute left-1/2 top-1/2 max-w-none pointer-events-none"
            :style="imageStyle()"
            draggable="false"
            @load="zoom = 1; offsetX = 0; offsetY = 0"
          >
        </div>

        <!-- Replace Image Button -->
        <div class="flex items-center justify-center -mt-1">
          <button
            type="button"
            class="py-1.5 px-3.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white flex items-center gap-1.5 border border-zinc-700 shadow-sm transition-all active:scale-95 cursor-pointer"
            @click="triggerReplace"
          >
            <span class="material-symbols-outlined text-[16px]">photo_camera</span>
            <span>Replace image</span>
          </button>
          <input
            ref="replaceInput"
            type="file"
            accept="image/*"
            class="hidden"
            @change="onFileSelect"
          >
        </div>

        <!-- Fit Mode Selector: Fit Width vs Fit Height -->
        <div class="space-y-1.5">
          <span class="block text-xs font-semibold uppercase tracking-wide text-gray-400">Fitting</span>
          <div class="grid grid-cols-2 gap-2 p-1 bg-zinc-800 rounded-xl">
            <button
              type="button"
              class="py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
              :class="fitMode === 'width' ? 'bg-white text-black shadow' : 'text-gray-400 hover:text-white'"
              @click="setFitMode('width')"
            >
              <span class="material-symbols-outlined text-[16px]">swap_horiz</span>
              Fit Width
            </button>
            <button
              type="button"
              class="py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
              :class="fitMode === 'height' ? 'bg-white text-black shadow' : 'text-gray-400 hover:text-white'"
              @click="setFitMode('height')"
            >
              <span class="material-symbols-outlined text-[16px]">swap_vert</span>
              Fit Height
            </button>
          </div>
        </div>

        <!-- Zoom Slider -->
        <label class="block text-xs font-semibold uppercase tracking-wide text-gray-400">
          <div class="flex items-center justify-between mb-1">
            <span>Zoom</span>
            <span class="text-[11px] text-gray-400 font-mono">{{ zoomPercent }}%</span>
          </div>
          <input
            v-model.number="zoomPercent"
            type="range"
            min="100"
            max="300"
            step="1"
            class="w-full accent-white"
          >
        </label>

        <!-- Actions -->
        <div class="flex gap-2 pt-1">
          <button
            v-if="canReset"
            type="button"
            class="py-3 px-3 rounded-full bg-zinc-800 hover:bg-zinc-700 text-red-400 hover:text-red-300 font-semibold text-xs flex items-center justify-center gap-1 shrink-0"
            title="Reset to default banner"
            @click="emit('reset')"
          >
            <span class="material-symbols-outlined text-[16px]">refresh</span>
            Reset
          </button>
          <button
            type="button"
            class="flex-1 py-3 rounded-full bg-zinc-700 hover:bg-zinc-600 font-semibold text-sm"
            @click="emit('close')"
          >
            Cancel
          </button>
          <button
            type="button"
            class="flex-1 py-3 rounded-full bg-white text-black hover:bg-gray-200 font-semibold text-sm"
            @click="confirmCrop"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
