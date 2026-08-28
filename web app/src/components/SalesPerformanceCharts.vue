<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import {
  buildSalesPerformanceData,
  destroyChart,
  makeMonthlyPerformanceBar,
  makeRevenueCategoryBar
} from '../lib/salesCharts'

const props = defineProps({
  sales: { type: Array, default: () => [] },
  cash: { type: Array, default: () => [] },
  pendingAmount: { type: Number, default: 0 },
  months: { type: Number, default: 12 }
})

const monthlyCanvas = ref(null)
const revenueCanvas = ref(null)
const charts = []

const data = computed(() =>
  buildSalesPerformanceData({
    sales: props.sales,
    cash: props.cash,
    pendingAmount: props.pendingAmount,
    months: props.months
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

  if (monthlyCanvas.value && d.byMonth.length) {
    charts.push(makeMonthlyPerformanceBar(monthlyCanvas.value, d.byMonth))
  }
  if (revenueCanvas.value && d.revenueByCategory.length) {
    charts.push(makeRevenueCategoryBar(revenueCanvas.value, d.revenueByCategory))
  }
}

watch(
  () => [props.sales, props.cash, props.pendingAmount, props.months],
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
          Cash in · out · balance · pending
          <span class="text-gray-600 font-normal normal-case">(monthly)</span>
        </h3>
        <div class="h-72">
          <canvas ref="monthlyCanvas" />
        </div>
      </section>

      <section class="card-item-bg rounded-2xl p-4">
        <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
          Revenue by category
        </h3>
        <p class="text-[11px] text-gray-500 mb-3">Cash inflow — Sales vs Tech Services vs Investment</p>
        <div class="h-52">
          <canvas ref="revenueCanvas" />
        </div>
      </section>
    </template>
  </div>
</template>
