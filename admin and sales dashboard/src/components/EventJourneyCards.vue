<script setup>
import { computed } from 'vue'

const props = defineProps({
  journeys: { type: Array, default: () => [] },
  activeId: { type: String, default: '' }
})

const emit = defineEmits(['select'])

const cards = computed(() => (Array.isArray(props.journeys) ? props.journeys : []))

function stepTone(step, index, steps) {
  if (!steps?.length) return 'muted'
  if (index === 0) return 'ok'
  if ((step.dropOffPct || 0) >= 60) return 'alert'
  if ((step.rateFromPrev || 0) < 40) return 'warn'
  return 'ok'
}

function onSelect(journey) {
  emit('select', journey)
}
</script>

<template>
  <section class="space-y-3">
    <div>
      <h3 class="text-sm font-semibold uppercase tracking-wide text-gray-400">User journeys</h3>
      <p class="text-xs text-gray-500 mt-1">
        Visual funnels for opens, saves, shares, logins, and hangups. Tap a card to filter the feed.
      </p>
    </div>
    <div class="grid gap-3 lg:grid-cols-2">
      <button
        v-for="journey in cards"
        :key="journey.id"
        type="button"
        class="text-left card-item-bg rounded-2xl p-4 border transition-colors"
        :class="activeId === journey.id
          ? 'border-white/40 bg-zinc-800/80'
          : 'border-transparent hover:border-zinc-700'"
        @click="onSelect(journey)"
      >
        <div class="flex items-center justify-between gap-2 mb-3">
          <p class="text-sm font-semibold">{{ journey.title }}</p>
          <span
            v-if="journey.channel"
            class="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-zinc-800 text-gray-400"
          >
            {{ journey.channel }}
          </span>
        </div>
        <div class="flex flex-wrap items-stretch gap-2">
          <template v-for="(step, index) in (journey.steps || [])" :key="step.id || index">
            <div
              class="min-w-[88px] flex-1 rounded-xl px-3 py-2 border"
              :class="{
                'border-emerald-500/30 bg-emerald-500/10': stepTone(step, index, journey.steps) === 'ok',
                'border-amber-500/30 bg-amber-500/10': stepTone(step, index, journey.steps) === 'warn',
                'border-red-500/40 bg-red-500/10': stepTone(step, index, journey.steps) === 'alert',
                'border-zinc-700 bg-zinc-900/50': stepTone(step, index, journey.steps) === 'muted'
              }"
            >
              <p class="text-[10px] uppercase tracking-wide text-gray-500">{{ step.label }}</p>
              <p class="text-lg font-bold mt-0.5">{{ step.count || 0 }}</p>
              <p v-if="index > 0" class="text-[10px] text-gray-400 mt-1">
                {{ step.rateFromPrev || 0 }}% of prev
                <span v-if="(step.dropOffPct || 0) >= 40" class="text-amber-300">
                  · −{{ step.dropOffPct }}%
                </span>
              </p>
            </div>
            <div
              v-if="index < (journey.steps || []).length - 1"
              class="flex items-center text-gray-600 self-center"
              aria-hidden="true"
            >
              <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
            </div>
          </template>
        </div>
      </button>
    </div>
  </section>
</template>