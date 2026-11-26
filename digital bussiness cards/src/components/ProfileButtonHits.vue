<script setup>
import { computed } from 'vue'

const props = defineProps({
  buttons: { type: Array, default: () => [] },
  compact: { type: Boolean, default: false }
})

const clicked = computed(() => (props.buttons || []).filter((b) => Number(b.clicks) > 0))
const unused = computed(() => (props.buttons || []).filter((b) => !Number(b.clicks)))
</script>

<template>
  <div class="space-y-3">
    <div v-if="clicked.length">
      <p
        v-if="!compact"
        class="text-[10px] uppercase tracking-wide text-emerald-400/80 mb-2"
      >
        Clicked
      </p>
      <ul class="card-item-bg rounded-2xl divide-y divide-[var(--border)] overflow-hidden">
        <li
          v-for="row in clicked"
          :key="row.key"
          class="flex items-center justify-between gap-3 px-4 py-2.5"
        >
          <p class="text-sm font-medium truncate">{{ row.label || row.key }}</p>
          <p class="text-sm font-bold tabular-nums shrink-0 text-emerald-300">{{ row.clicks }}</p>
        </li>
      </ul>
    </div>
    <div v-if="unused.length">
      <p
        v-if="!compact"
        class="text-[10px] uppercase tracking-wide text-amber-400/80 mb-2"
      >
        Not clicked
      </p>
      <ul class="card-item-bg rounded-2xl divide-y divide-[var(--border)] overflow-hidden">
        <li
          v-for="row in unused"
          :key="row.key"
          class="flex items-center justify-between gap-3 px-4 py-2.5"
        >
          <p class="text-sm text-gray-400 truncate">{{ row.label || row.key }}</p>
          <p class="text-sm font-bold tabular-nums shrink-0 text-gray-500">0</p>
        </li>
      </ul>
    </div>
    <p v-if="!(buttons || []).length" class="text-sm text-gray-500">No buttons on this profile.</p>
  </div>
</template>