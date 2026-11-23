<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  destroyChart,
  makeActivityTrend,
  makeBar,
  makeHourBars,
  makeLoginTrend
} from '../lib/activityCharts'

const props = defineProps({
  analytics: { type: Object, default: null },
  loginsByDay: { type: Array, default: () => [] },
  loginsByBucket: { type: Array, default: () => [] },
  logins: { type: Number, default: 0 },
  connections: { type: Number, default: 0 },
  topProfiles: { type: Array, default: () => [] },
  days: { type: [Number, String], default: 30 },
  rangeLabel: { type: String, default: '' },
  granularity: { type: String, default: 'day' },
  showLogins: { type: Boolean, default: false },
  showTopProfiles: { type: Boolean, default: false }
})

const emit = defineEmits(['update:granularity'])

const router = useRouter()

const trendCanvas = ref(null)
const countryCanvas = ref(null)
const deviceCanvas = ref(null)
const actionCanvas = ref(null)
const hourCanvas = ref(null)
const loginCanvas = ref(null)
const profileCanvas = ref(null)

const charts = []
const topVisibleCount = ref(10)

const funnel = computed(() => props.analytics?.funnel || null)
const hasData = computed(() => (props.analytics?.totals?.total || 0) > 0)
const windowLabel = computed(() => {
  if (props.rangeLabel) return props.rangeLabel
  if (props.days === 'all' || props.days == null) return 'All time'
  return `Last ${props.days} days`
})

const loginSeries = computed(() => {
  if (props.loginsByBucket?.length) return props.loginsByBucket
  return (props.loginsByDay || []).map((r) => ({
    date: r.date,
    owners: r.count || 0,
    staff: 0,
    count: r.count || 0
  }))
})

const visibleTopProfiles = computed(() =>
  (props.topProfiles || []).slice(0, topVisibleCount.value)
)

const canLoadMoreTop = computed(
  () => (props.topProfiles || []).length > topVisibleCount.value
)

function clearCharts() {
  while (charts.length) destroyChart(charts.pop())
}

function setGranularity(g) {
  emit('update:granularity', g)
}

function loadMoreTop() {
  topVisibleCount.value += 10
}

function openProfileActivities(profile) {
  if (!profile?.id) return
  router.push(`/admin/profiles/${encodeURIComponent(profile.id)}/activities`)
}

async function render() {
  await nextTick()
  clearCharts()
  const a = props.analytics
  if (!a) return

  if (trendCanvas.value && a.series?.byDay?.length) {
    charts.push(
      makeActivityTrend(trendCanvas.value, a.series.byDay, {
        granularity: props.granularity
      })
    )
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
  if (props.showLogins && loginCanvas.value && loginSeries.value.length) {
    charts.push(
      makeLoginTrend(loginCanvas.value, loginSeries.value, {
        granularity: props.granularity
      })
    )
  }
  if (props.showTopProfiles && profileCanvas.value && visibleTopProfiles.value.length) {
    charts.push(
      makeBar(
        profileCanvas.value,
        visibleTopProfiles.value.map((p) => ({ name: p.name, count: p.count, id: p.id })),
        {
          color: '#fbbf24',
          onClick: (_index, row) => {
            if (row?.id) openProfileActivities(row)
          }
        }
      )
    )
  }
}

watch(
  () => [
    props.analytics,
    props.loginsByDay,
    props.loginsByBucket,
    props.topProfiles,
    props.days,
    props.granularity,
    props.showLogins,
    props.showTopProfiles,
    topVisibleCount.value
  ],
  () => {
    render()
  },
  { deep: true, immediate: true }
)

watch(
  () => props.topProfiles,
  () => {
    topVisibleCount.value = 10
  }
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
        <p class="text-[10px] text-gray-500 mt-1">{{ windowLabel }}</p>
      </div>
      <div v-if="showLogins" class="card-item-bg rounded-2xl p-4">
        <p class="text-[11px] uppercase tracking-wide text-gray-500">Logins</p>
        <p class="text-2xl font-bold mt-1 text-amber-200">{{ logins }}</p>
        <p class="text-[10px] text-gray-500 mt-1">Session starts</p>
      </div>
      <div v-else class="card-item-bg rounded-2xl p-4">
        <p class="text-[11px] uppercase tracking-wide text-gray-500">Window</p>
        <p class="text-lg font-bold mt-1 leading-tight">{{ windowLabel }}</p>
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
      <section class="card-item-bg rounded-2xl p-4">
        <div class="flex items-center justify-between gap-2 flex-wrap mb-3">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Activity over time
          </h3>
          <div class="flex gap-1 flex-wrap">
            <button
              v-for="g in [
                { id: 'year', label: 'Year' },
                { id: 'month', label: 'Month' },
                { id: 'week', label: 'Week' },
                { id: 'day', label: 'Day' }
              ]"
              :key="g.id"
              type="button"
              class="px-2.5 py-1 rounded-full text-[10px] font-semibold border"
              :class="granularity === g.id
                ? 'bg-white text-black border-white'
                : 'border-[var(--border)] text-gray-400'"
              @click="setGranularity(g.id)"
            >
              {{ g.label }}
            </button>
          </div>
        </div>
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
        <div class="flex items-center justify-between gap-2 flex-wrap mb-3">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Owner / staff logins
          </h3>
          <div class="flex gap-1 flex-wrap">
            <button
              v-for="g in [
                { id: 'year', label: 'Year' },
                { id: 'month', label: 'Month' },
                { id: 'week', label: 'Week' },
                { id: 'day', label: 'Day' }
              ]"
              :key="'login-' + g.id"
              type="button"
              class="px-2.5 py-1 rounded-full text-[10px] font-semibold border"
              :class="granularity === g.id
                ? 'bg-white text-black border-white'
                : 'border-[var(--border)] text-gray-400'"
              @click="setGranularity(g.id)"
            >
              {{ g.label }}
            </button>
          </div>
        </div>
        <div class="h-52">
          <canvas ref="loginCanvas" />
        </div>
      </section>

      <section v-if="showTopProfiles" class="card-item-bg rounded-2xl p-4 space-y-3">
        <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Top profiles by activity
        </h3>
        <div class="h-64">
          <canvas ref="profileCanvas" />
        </div>
        <ul class="space-y-1.5">
          <li
            v-for="p in visibleTopProfiles"
            :key="p.id"
          >
            <button
              type="button"
              class="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-[var(--border)] text-left text-xs hover:bg-zinc-800/60 transition-colors cursor-pointer"
              @click="openProfileActivities(p)"
            >
              <span class="truncate font-medium text-[var(--text)]">{{ p.name }}</span>
              <span class="shrink-0 text-amber-300 font-semibold tabular-nums">{{ p.count }}</span>
            </button>
          </li>
        </ul>
        <div v-if="canLoadMoreTop" class="flex justify-center pt-1">
          <button
            type="button"
            class="px-4 py-2 rounded-full text-xs font-semibold border border-[var(--border)] text-gray-300 hover:text-white"
            @click="loadMoreTop"
          >
            Load more
          </button>
        </div>
        <p class="text-[10px] text-gray-500 text-center">
          Showing {{ visibleTopProfiles.length }} of {{ topProfiles.length }} · click a bar or row to open activities
        </p>
      </section>
    </template>
  </div>
</template>
