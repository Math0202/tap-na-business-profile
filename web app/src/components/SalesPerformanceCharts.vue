<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import {
  buildSalesPerformanceData,
  destroyChart,
  makeCashFlowTrend,
  makeCashOverviewDoughnut,
  makeCategoryInflowBar
} from '../lib/salesCharts'

const props = defineProps({
  sales: { type: Array, default: () => [] },
  cash: { type: Array, default: () => [] },
  pendingAmount: { type: Number, default: 0 },
  days: { type: Number, default: 90 }
})

const trendCanvas = ref(null)
const overviewCanvas = ref(null)
const categoryCanvas = ref(null)
const charts = []

const data = computed(() =>
  buildSalesPerformanceData({
    sales: props.sales,
    cash: props.cash,
    pendingAmount: props.pendingAmount,
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

  if (trendCanvas.value && d.byDay.some((row) => row.cashIn > 0 || row.cashOut > 0)) {
    charts.push(makeCashFlowTrend(trendCanvas.value, d.byDay))
  }
  if (overviewCanvas.value) {
    charts.push(makeCashOverviewDoughnut(overviewCanvas.value, d.totals))
  }
  if (categoryCanvas.value && d.byIncomeCategory.length) {
    charts.push(makeCategoryInflowBar(categoryCanvas.value, d.byIncomeCategory))
  }
}

watch(
  () => [props.sales, props.cash, props.pendingAmount, props.days],
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
      <span class="text-[10px] uppercase tracking-wide text-gray-500">Synced with Cash</span>
    </div>

    <div
      v-if="!data.hasData"
      class="card-item-bg rounded-2xl p-6 text-sm text-gray-400 text-center"
    >
      No sales or cash activity to chart yet.
    </div>

    <template v-else>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="card-item-bg rounded-2xl p-4">
          <p class="text-[11px] uppercase tracking-wide text-gray-500">Cash in</p>
          <p class="text-xl font-bold mt-1 text-emerald-400">
            N$ {{ data.totals.inflow.toLocaleString(undefined, { maximumFractionDigits: 0 }) }}
          </p>
        </div>
        <div class="card-item-bg rounded-2xl p-4">
          <p class="text-[11px] uppercase tracking-wide text-gray-500">Cash out</p>
          <p class="text-xl font-bold mt-1 text-red-400">
            N$ {{ data.totals.outflow.toLocaleString(undefined, { maximumFractionDigits: 0 }) }}
          </p>
        </div>
        <div class="card-item-bg rounded-2xl p-4">
          <p class="text-[11px] uppercase tracking-wide text-gray-500">Balance</p>
          <p
            class="text-xl font-bold mt-1"
            :class="data.totals.balance >= 0 ? 'text-emerald-400' : 'text-red-400'"
          >
            N$ {{ data.totals.balance.toLocaleString(undefined, { maximumFractionDigits: 0 }) }}
          </p>
        </div>
        <div class="card-item-bg rounded-2xl p-4">
          <p class="text-[11px] uppercase tracking-wide text-gray-500">Pending</p>
          <p class="text-xl font-bold mt-1 text-amber-300">
            N$ {{ data.totals.pending.toLocaleString(undefined, { maximumFractionDigits: 0 }) }}
          </p>
        </div>
      </div>

      <section class="card-item-bg rounded-2xl p-4">
        <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
          Cash in &amp; out over time
          <span class="text-gray-600 font-normal normal-case">(last {{ data.days }} days)</span>
        </h3>
        <div class="h-56">
          <canvas ref="trendCanvas" />
        </div>
      </section>

      <section class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div class="card-item-bg rounded-2xl p-4">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
            Cash in · out · pending
          </h3>
          <div class="h-52">
            <canvas ref="overviewCanvas" />
          </div>
        </div>
        <div class="card-item-bg rounded-2xl p-4">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
            Cash in by category
          </h3>
          <div class="h-52">
            <canvas v-if="data.byIncomeCategory.length" ref="categoryCanvas" />
            <p v-else class="text-sm text-gray-500 pt-8 text-center">No category inflows yet.</p>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
