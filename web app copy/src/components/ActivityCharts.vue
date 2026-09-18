<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import {
  channelDisplayName,
  destroyChart,
  makeActivityTrend,
  makeBar,
  makeDoughnut,
  makeHourBars,
  makeLoginTrend,
  makePie
} from '../lib/activityCharts'

const props = defineProps({
  analytics: { type: Object, default: null },
  loginsByDay: { type: Array, default: () => [] },
  logins: { type: Number, default: 0 },
  connections: { type: Number, default: 0 },
  topProfiles: { type: Array, default: () => [] },
  days: { type: Number, default: 30 },
  showLogins: { type: Boolean, default: false },
  showTopProfiles: { type: Boolean, default: false }
})

const channelCanvas = ref(null)
const kindCanvas = ref(null)
const trendCanvas = ref(null)
const countryCanvas = ref(null)
const deviceCanvas = ref(null)
const actionCanvas = ref(null)
const hourCanvas = ref(null)
const loginCanvas = ref(null)
const profileCanvas = ref(null)

const charts = []

const funnel = computed(() => props.analytics?.funnel || null)
const hasData = computed(() => (props.analytics?.totals?.total || 0) > 0)

function clearCharts() {
  while (charts.length) destroyChart(charts.pop())
}

async function render() {
  await nextTick()
  clearCharts()
  const a = props.analytics
  if (!a) return

  if (channelCanvas.value && a.byChannelOpens?.length) {
    charts.push(
      makeDoughnut(channelCanvas.value, a.byChannelOpens, {
        labelMap: channelDisplayName
      })
    )
  }
  if (kindCanvas.value && a.byKind?.length) {
    charts.push(makePie(kindCanvas.value, a.byKind))
  }
  if (trendCanvas.value && a.series?.byDay?.length) {
    charts.push(makeActivityTrend(trendCanvas.value, a.series.byDay))
  }
  if (countryCanvas.value && a.byCountry?.length) {
    charts.push(
      makeBar(countryCanvas.value, a.byCountry.slice(0, 8), {
        color: '#34d399'
      })
    )
  }
  if (deviceCanvas.value && a.byDevice?.length) {
    charts.push(
      makeBar(deviceCanvas.value, a.byDevice.slice(0, 6), { color: '#38bdf8' })
    )
  }
  if (actionCanvas.value && a.byAction?.length) {
    const actions = a.byAction
      .filter((r) => r.name !== 'open')
      .slice(0, 8)
    if (actions.length) {
      charts.push(makeBar(actionCanvas.value, actions, { color: '#a78bfa' }))
    }
  }
  if (hourCanvas.value && a.series?.byHour?.length) {
    charts.push(makeHourBars(hourCanvas.value, a.series.byHour))
  }
  if (props.showLogins && loginCanvas.value && props.loginsByDay?.length) {
    charts.push(makeLoginTrend(loginCanvas.value, props.loginsByDay))
  }
  if (props.showTopProfiles && profileCanvas.value && props.topProfiles?.length) {
    charts.push(
      makeBar(
        profileCanvas.value,
        props.topProfiles.map((p) => ({ name: p.name, count: p.count })),
        { color: '#fbbf24' }
      )
    )
  }
}

watch(
  () => [
    props.analytics,
    props.loginsByDay,
    props.topProfiles,
    props.days,
    props.showLogins,
    props.showTopProfiles
  ],
  () => {
    render()
  },
  { deep: true, immediate: true }
)

onBeforeUnmount(() => clearCharts())
</script>

<template>
  <div class="space-y-4">
    <section
      v-if="funnel"
      class="grid grid-cols-2 sm:grid-cols-4 gap-3"
    >
      <div class="card-item-bg rounded-2xl p-4">
        <p class="text-[11px] uppercase tracking-wide text-gray-500">Click rate</p>
        <p class="text-2xl font-bold mt-1 text-sky-300">{{ funnel.clickRate }}%</p>
        <p class="text-[10px] text-gray-500 mt-1">Clicks ÷ opens</p>
      </div>
      <div class="card-item-bg rounded-2xl p-4">
        <p class="text-[11px] uppercase tracking-wide text-gray-500">Share rate</p>
        <p class="text-2xl font-bold mt-1 text-violet-300">{{ funnel.shareRate }}%</p>
        <p class="text-[10px] text-gray-500 mt-1">Shares ÷ opens</p>
      </div>
      <div class="card-item-bg rounded-2xl p-4">
        <p class="text-[11px] uppercase tracking-wide text-gray-500">Connections</p>
        <p class="text-2xl font-bold mt-1 text-amber-300">{{ connections }}</p>
        <p class="text-[10px] text-gray-500 mt-1">Last {{ days }} days</p>
      </div>
      <div v-if="showLogins" class="card-item-bg rounded-2xl p-4">
        <p class="text-[11px] uppercase tracking-wide text-gray-500">Logins</p>
        <p class="text-2xl font-bold mt-1 text-amber-200">{{ logins }}</p>
        <p class="text-[10px] text-gray-500 mt-1">Session starts</p>
      </div>
      <div v-else class="card-item-bg rounded-2xl p-4">
        <p class="text-[11px] uppercase tracking-wide text-gray-500">Window</p>
        <p class="text-2xl font-bold mt-1">{{ days }}d</p>
        <p class="text-[10px] text-gray-500 mt-1">Analytics range</p>
      </div>
    </section>

    <div
      v-if="!hasData"
      class="card-item-bg rounded-2xl p-6 text-sm text-gray-400 text-center"
    >
      No activity in the selected period to chart yet.
    </div>

    <template v-else>
      <section class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div class="card-item-bg rounded-2xl p-4">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
            Tap vs scan (opens)
          </h3>
          <div class="h-52">
            <canvas ref="channelCanvas" />
          </div>
        </div>
        <div class="card-item-bg rounded-2xl p-4">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
            Opens · clicks · shares
          </h3>
          <div class="h-52">
            <canvas ref="kindCanvas" />
          </div>
        </div>
      </section>

      <section class="card-item-bg rounded-2xl p-4">
        <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
          Activity over time
        </h3>
        <div class="h-56">
          <canvas ref="trendCanvas" />
        </div>
      </section>

      <section class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div class="card-item-bg rounded-2xl p-4">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
            Top countries
          </h3>
          <div class="h-56">
            <canvas ref="countryCanvas" />
          </div>
        </div>
        <div class="card-item-bg rounded-2xl p-4">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
            Devices
          </h3>
          <div class="h-56">
            <canvas ref="deviceCanvas" />
          </div>
        </div>
      </section>

      <section class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div class="card-item-bg rounded-2xl p-4">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
            Clicks &amp; shares
          </h3>
          <div class="h-56">
            <canvas ref="actionCanvas" />
          </div>
        </div>
        <div class="card-item-bg rounded-2xl p-4">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
            Opens by hour (UTC)
          </h3>
          <div class="h-56">
            <canvas ref="hourCanvas" />
          </div>
        </div>
      </section>

      <section v-if="showLogins" class="card-item-bg rounded-2xl p-4">
        <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
          Owner / staff logins
        </h3>
        <div class="h-52">
          <canvas ref="loginCanvas" />
        </div>
      </section>

      <section v-if="showTopProfiles" class="card-item-bg rounded-2xl p-4">
        <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
          Top profiles by activity
        </h3>
        <div class="h-64">
          <canvas ref="profileCanvas" />
        </div>
      </section>
    </template>
  </div>
</template>
