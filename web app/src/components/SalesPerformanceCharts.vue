<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import {
  buildSalesPerformanceData,
  destroyChart,
  makeAgentRevenueBar,
  makeSalesCashTrend,
  makeSalesStatusDoughnut
} from '../lib/salesCharts'

const props = defineProps({
  sales: { type: Array, default: () => [] },
  cash: { type: Array, default: () => [] },
  agents: { type: Array, default: () => [] },
  isSalesScoped: { type: Boolean, default: false },
  days: { type: Number, default: 90 }
})

const trendCanvas = ref(null)
const statusCanvas = ref(null)
const agentCanvas = ref(null)
const charts = []

const data = computed(() =>
  buildSalesPerformanceData({
    sales: props.sales,
    cash: props.cash,
    agents: props.agents,
    days: props.days
  })
)

function clearCharts() {
  while (charts.length) destroyChart(charts.pop())
}

async function render() {
  await nextTick()
  clearCharts()
  const d = data.value
  if (!d.hasData) return

  if (trendCanvas.value && d.byDay.some((row) => row.cashIn > 0 || row.commission > 0)) {
    charts.push(makeSalesCashTrend(trendCanvas.value, d.byDay))
  }
  if (statusCanvas.value && d.byStatus.length) {
    charts.push(makeSalesStatusDoughnut(statusCanvas.value, d.byStatus))
  }
  if (!props.isSalesScoped && agentCanvas.value && d.byAgent.length) {
    charts.push(makeAgentRevenueBar(agentCanvas.value, d.byAgent))
  }
}

watch(
  () => [props.sales, props.cash, props.agents, props.days, props.isSalesScoped],
  () => {
    render()
  },
  { deep: true, immediate: true }
)

onBeforeUnmount(() => clearCharts())
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between gap-3">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-400">
        Sales performance
      </h2>
      <span class="text-[10px] uppercase tracking-wide text-gray-500">Last {{ data.days }} days</span>
    </div>

    <div
      v-if="!data.hasData"
      class="card-item-bg rounded-2xl p-6 text-sm text-gray-400 text-center"
    >
      No sales or cash activity to chart yet.
    </div>

    <template v-else>
      <section class="card-item-bg rounded-2xl p-4">
        <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
          Cash in &amp; commission out
        </h3>
        <div class="h-56">
          <canvas ref="trendCanvas" />
        </div>
      </section>

      <section class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div class="card-item-bg rounded-2xl p-4">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
            Amounts due vs paid
          </h3>
          <div class="h-52">
            <canvas ref="statusCanvas" />
          </div>
        </div>
        <div v-if="!isSalesScoped" class="card-item-bg rounded-2xl p-4">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
            Cash in by agent
          </h3>
          <div class="h-52">
            <canvas v-if="data.byAgent.length" ref="agentCanvas" />
            <p v-else class="text-sm text-gray-500 pt-8 text-center">No agent cash in this period.</p>
          </div>
        </div>
        <div v-else class="card-item-bg rounded-2xl p-4 flex flex-col justify-center">
          <p class="text-[11px] uppercase tracking-wide text-gray-500">Period cash in</p>
          <p class="text-2xl font-bold mt-1 text-emerald-300">
            N$ {{ data.totals.cashIn.toLocaleString(undefined, { maximumFractionDigits: 0 }) }}
          </p>
          <p class="text-[11px] text-gray-500 mt-2">
            {{ data.totals.salesCount }} active sale{{ data.totals.salesCount === 1 ? '' : 's' }}
            · commission out N$
            {{ data.totals.commission.toLocaleString(undefined, { maximumFractionDigits: 0 }) }}
          </p>
        </div>
      </section>
    </template>
  </div>
</template>
