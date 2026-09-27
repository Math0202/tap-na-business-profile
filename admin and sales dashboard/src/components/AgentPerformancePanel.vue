<script setup>
import { computed, ref } from 'vue'
import { buildAgentFunnel, rankAgents } from '../lib/agentFunnel'
import { formatMoney } from '../lib/salesStore'

const props = defineProps({
  clients: { type: Array, default: () => [] },
  quotes: { type: Array, default: () => [] },
  invoices: { type: Array, default: () => [] },
  meetings: { type: Array, default: () => [] },
  agents: { type: Array, default: () => [] },
  salesScoped: { type: Boolean, default: false },
  lockedAgentId: { type: String, default: '' },
  canFilter: { type: Boolean, default: false }
})

const emit = defineEmits(['open-client'])

const periodDays = ref(90)
const selectedAgentId = ref('')

const periods = [
  { id: 30, label: '30 days' },
  { id: 90, label: '90 days' },
  { id: 0, label: 'All time' }
]

const agentChoices = computed(() =>
  props.agents.filter((a) => a && !a.deleted).slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
)

const activeAgentId = computed(() => {
  if (props.salesScoped) return String(props.lockedAgentId || '')
  return String(selectedAgentId.value || '')
})

const source = computed(() => ({
  clients: props.clients,
  quotes: props.quotes,
  invoices: props.invoices,
  meetings: props.meetings,
  agents: agentChoices.value,
  periodDays: periodDays.value
}))

const funnel = computed(() =>
  buildAgentFunnel({
    ...source.value,
    agentId: activeAgentId.value
  })
)

const ranking = computed(() => {
  if (props.salesScoped || activeAgentId.value) return []
  return rankAgents(source.value)
})

const maxCount = computed(() => Math.max(funnel.value.counts.prospects, 1))

function rateLabel(value) {
  return value == null ? '—' : `${value}%`
}

function barWidth(count) {
  return Math.max(8, Math.round((count / maxCount.value) * 100))
}

function onAction(action) {
  const client = props.clients.find((c) => c.id === action.clientId)
  if (client) emit('open-client', client)
}

function selectAgent(id) {
  selectedAgentId.value = id
}

const stageTone = {
  prospects: 'bg-zinc-400',
  visited: 'bg-sky-400',
  quoted: 'bg-violet-400',
  invoiced: 'bg-amber-400',
  closed: 'bg-emerald-400'
}
</script>

<template>
  <section class="space-y-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-400">Agent performance</h2>
        <p class="text-xs text-gray-500 mt-1">
          Visit, quote, invoice, and close — so the next step is the one that moves revenue.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <div class="flex gap-1 p-1 rounded-full card-item-bg">
          <button
            v-for="p in periods"
            :key="p.id"
            type="button"
            class="px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors"
            :class="periodDays === p.id ? 'bg-white text-black' : 'text-gray-400'"
            @click="periodDays = p.id"
          >
            {{ p.label }}
          </button>
        </div>
        <select
          v-if="canFilter && !salesScoped"
          v-model="selectedAgentId"
          class="field-input bg-zinc-900 text-xs rounded-2xl min-w-[10rem]"
          aria-label="Filter by agent"
        >
          <option value="">All agents</option>
          <option v-for="a in agentChoices" :key="a.id" :value="a.id">{{ a.name }}</option>
        </select>
      </div>
    </div>

    <div v-if="!funnel.counts.prospects" class="card-item-bg rounded-2xl p-6 text-sm text-gray-400 text-center">
      No prospects in this period yet.
    </div>

    <template v-else>
      <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div class="card-item-bg rounded-2xl p-4">
          <p class="text-[11px] uppercase tracking-wide text-gray-500">Visit rate</p>
          <p class="text-xl font-bold mt-1">{{ rateLabel(funnel.rates.visit) }}</p>
        </div>
        <div class="card-item-bg rounded-2xl p-4">
          <p class="text-[11px] uppercase tracking-wide text-gray-500">Quote rate</p>
          <p class="text-xl font-bold mt-1">{{ rateLabel(funnel.rates.quote) }}</p>
          <p class="text-[10px] text-gray-500 mt-1">of visits</p>
        </div>
        <div class="card-item-bg rounded-2xl p-4">
          <p class="text-[11px] uppercase tracking-wide text-gray-500">Invoice rate</p>
          <p class="text-xl font-bold mt-1">{{ rateLabel(funnel.rates.invoice) }}</p>
          <p class="text-[10px] text-gray-500 mt-1">of quotes</p>
        </div>
        <div class="card-item-bg rounded-2xl p-4">
          <p class="text-[11px] uppercase tracking-wide text-gray-500">Close rate</p>
          <p class="text-xl font-bold mt-1 text-emerald-300">{{ rateLabel(funnel.rates.close) }}</p>
          <p class="text-[10px] text-gray-500 mt-1">of prospects</p>
        </div>
        <div class="card-item-bg rounded-2xl p-4 col-span-2 sm:col-span-1">
          <p class="text-[11px] uppercase tracking-wide text-gray-500">Open pipeline</p>
          <p class="text-xl font-bold mt-1">{{ formatMoney(funnel.pipelineValue) }}</p>
        </div>
      </div>

      <div
        v-if="funnel.weakest"
        class="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
      >
        Biggest leak is <span class="font-semibold">{{ funnel.weakest.label }}</span>
        — {{ funnel.weakest.drop }} prospect{{ funnel.weakest.drop === 1 ? '' : 's' }} drop off there.
      </div>

      <div class="card-item-bg rounded-2xl p-4 space-y-3">
        <div v-for="stage in funnel.stages" :key="stage.id" class="space-y-1">
          <div class="flex items-baseline justify-between gap-3 text-xs">
            <span class="font-semibold" :class="stage.weak ? 'text-amber-200' : 'text-gray-200'">
              {{ stage.label }}
            </span>
            <span class="text-gray-400 tabular-nums">
              {{ stage.count }}
              <template v-if="stage.conversion != null"> · {{ rateLabel(stage.conversion) }} from previous</template>
              <template v-else-if="stage.share != null"> · {{ rateLabel(stage.share) }}</template>
            </span>
          </div>
          <div class="h-3 rounded-full bg-zinc-800 overflow-hidden">
            <div
              class="h-full rounded-full transition-all"
              :class="[stageTone[stage.id], stage.weak ? 'ring-2 ring-amber-300/80' : '']"
              :style="{ width: barWidth(stage.count) + '%' }"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">What to do next</h3>
        <ul v-if="funnel.actions.length" class="space-y-2">
          <li v-for="action in funnel.actions" :key="action.id">
            <button
              type="button"
              class="w-full text-left card-item-bg rounded-2xl px-4 py-3 flex items-center gap-3 hover:bg-white/[0.03] transition"
              @click="onAction(action)"
            >
              <span
                class="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-black"
                :class="{
                  'bg-emerald-300': action.kind === 'collect',
                  'bg-amber-300': action.kind === 'invoice',
                  'bg-violet-300': action.kind === 'followup',
                  'bg-sky-300': action.kind === 'quote',
                  'bg-zinc-200': action.kind === 'visit'
                }"
              >
                <span class="material-symbols-outlined text-[18px]">
                  {{
                    action.kind === 'collect'
                      ? 'payments'
                      : action.kind === 'invoice'
                        ? 'request_quote'
                        : action.kind === 'followup'
                          ? 'forum'
                          : action.kind === 'quote'
                            ? 'edit_document'
                            : 'directions_walk'
                  }}
                </span>
              </span>
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-semibold truncate">{{ action.title }}</span>
                <span class="block text-xs text-gray-400 truncate">
                  {{ action.clientName }}
                  <template v-if="action.amount > 0"> · {{ formatMoney(action.amount) }}</template>
                </span>
              </span>
              <span class="material-symbols-outlined text-gray-500 text-[18px]">chevron_right</span>
            </button>
          </li>
        </ul>
        <p v-else class="text-sm text-gray-500">Nothing waiting — keep adding prospects and logging visits.</p>
      </div>
    </template>

    <div v-if="ranking.length">
      <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">All agents</h3>
      <ul class="space-y-2">
        <li v-for="row in ranking" :key="row.agentId">
          <button
            type="button"
            class="w-full text-left card-item-bg rounded-2xl p-4 flex items-center gap-3 hover:bg-white/[0.03] transition"
            @click="selectAgent(row.agentId)"
          >
            <div class="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shrink-0 font-bold text-sm">
              {{ (row.name || '?').slice(0, 1) }}
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 flex-wrap">
                <p class="text-sm font-semibold truncate">{{ row.name }}</p>
                <span
                  class="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                  :class="row.active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-zinc-500/20 text-gray-400'"
                >
                  {{ row.active ? 'Active' : 'Inactive' }}
                </span>
              </div>
              <p class="text-xs text-gray-400 mt-0.5">
                Close {{ rateLabel(row.closeRate) }} · {{ row.closed }} closed · {{ formatMoney(row.revenue) }} collected
              </p>
              <p v-if="row.weakest" class="text-[11px] text-amber-200/90 mt-1">Leak: {{ row.weakest }}</p>
            </div>
            <span class="material-symbols-outlined text-gray-500 text-[18px]">chevron_right</span>
          </button>
        </li>
      </ul>
    </div>
  </section>
</template>
