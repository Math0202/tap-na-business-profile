<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  src: { type: String, default: '' },
  title: { type: String, default: 'Adjust banner' }
})

const emit = defineEmits(['close', 'confirm'])

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
    zoom.value = 1
    offsetX.value = 0
    offsetY.value = 0
  }
)

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
  const base = Math.max(viewportWidth / el.naturalWidth, viewportHeight / el.naturalHeight)
  const scale = base * zoom.value
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

  const base = Math.max(viewportWidth / img.naturalWidth, viewportHeight / img.naturalHeight)
  const scale = base * zoom.value
  const imgW = img.naturalWidth * scale
  const imgH = img.naturalHeight * scale
  const imgLeft = viewportWidth / 2 + offsetX.value - imgW / 2
  const imgTop = viewportHeight / 2 + offsetY.value - imgH / 2
  const sx = (0 - imgLeft) / scale
  const sy = (0 - imgTop) / scale
  const sw = viewportWidth / scale
  const sh = viewportHeight / scale

  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outputWidth, outputHeight)

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
          Drag to reposition your banner. Use the slider to zoom. This header banner displays on top of your public profile.
        </p>

        <div
          class="relative mx-auto bg-zinc-900 border border-zinc-700 rounded-2xl overflow-hidden touch-none select-none"
          :style="{ width: `${viewportWidth}px`, height: `${viewportHeight}px` }"
          @pointerdown="onPointerDown"
        >
          <img
            v-if="src"
            ref="imageEl"
            :src="src"
            alt="Banner crop preview"
            class="absolute left-1/2 top-1/2 max-w-none pointer-events-none"
            :style="imageStyle()"
            draggable="false"
            @load="zoom = 1; offsetX = 0; offsetY = 0"
          >
        </div>

        <label class="block text-xs font-semibold uppercase tracking-wide text-gray-400">
          Zoom
          <input
            v-model.number="zoomPercent"
            type="range"
            min="100"
            max="300"
            step="1"
            class="w-full mt-2 accent-white"
          >
        </label>

        <div class="flex gap-3 pt-1">
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
