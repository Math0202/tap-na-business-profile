<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import BrandMark from '../components/BrandMark.vue'
import BookMeetingPopup from '../components/BookMeetingPopup.vue'
import {
  loadPublicProfile,
  loadProfile,
  loadViewedProfile,
  isLoggedIn,
  displayName
} from '../lib/profileStore'
import {
  apiProfileAvailability,
  apiUpdateMeeting,
  getApiToken
} from '../lib/api'

const publicProfile = ref(loadPublicProfile())
const loading = ref(false)
const toast = ref('')
const taken = ref([])
const ownerMeetings = ref([])
const isOwnerFlag = ref(false)
const ownerName = ref(displayName(publicProfile.value) || 'This person')
const showBooking = ref(true)
const slotMinutes = ref(30)
const dayStartHour = ref(9)
const dayEndHour = ref(17)

const cursor = ref(startOfMonth(new Date()))
const selectedDay = ref(startOfDay(new Date()))
const bookOpen = ref(false)
const bookAt = ref('')
const detail = ref(null)

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function flash(msg) {
  toast.value = msg
  setTimeout(() => { toast.value = '' }, 2200)
}

function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function pad(n) {
  return String(n).padStart(2, '0')
}

function toDayKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function profileId() {
  const p = publicProfile.value
  return String(p.remoteProfileId || p.id || '').trim()
}

const isOwner = computed(() => {
  if (isOwnerFlag.value) return true
  if (!isLoggedIn()) return false
  const viewed = loadViewedProfile()
  if (!viewed) return true
  const mine = loadProfile()
  const myId = String(mine.remoteProfileId || '').trim()
  const theirId = String(viewed.remoteProfileId || viewed.id || '').trim()
  return !!(myId && theirId && myId === theirId)
})

const monthLabel = computed(() =>
  cursor.value.toLocaleString(undefined, { month: 'long', year: 'numeric' })
)

const selectedLabel = computed(() =>
  selectedDay.value.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  })
)

const calendarCells = computed(() => {
  const first = startOfMonth(cursor.value)
  // Monday-first offset
  const jsDay = first.getDay() // 0 Sun
  const offset = jsDay === 0 ? 6 : jsDay - 1
  const start = new Date(first)
  start.setDate(first.getDate() - offset)
  const cells = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    cells.push({
      date: d,
      key: toDayKey(d),
      inMonth: d.getMonth() === cursor.value.getMonth(),
      isToday: toDayKey(d) === toDayKey(new Date()),
      isSelected: toDayKey(d) === toDayKey(selectedDay.value),
      hasTaken: takenOnDay(d).length > 0
    })
  }
  return cells
})

function takenOnDay(day) {
  const key = toDayKey(day)
  return taken.value.filter((iso) => {
    const d = new Date(iso)
    return !Number.isNaN(d.getTime()) && toDayKey(d) === key
  })
}

function isSlotTaken(iso) {
  const t = new Date(iso).getTime()
  const window = (slotMinutes.value || 30) * 60 * 1000
  return taken.value.some((x) => Math.abs(new Date(x).getTime() - t) < window - 1000)
}

function meetingForSlot(iso) {
  const t = new Date(iso).getTime()
  const window = (slotMinutes.value || 30) * 60 * 1000
  return ownerMeetings.value.find((m) => {
    if (!m.preferredAt) return false
    return Math.abs(new Date(m.preferredAt).getTime() - t) < window - 1000
  }) || null
}

const daySlots = computed(() => {
  const day = selectedDay.value
  const startH = dayStartHour.value
  const endH = dayEndHour.value
  const step = slotMinutes.value || 30
  const slots = []
  const now = Date.now()
  for (let h = startH; h < endH; h++) {
    for (let m = 0; m < 60; m += step) {
      const d = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m, 0, 0)
      const iso = d.toISOString()
      const takenSlot = isSlotTaken(iso)
      const past = d.getTime() < now - 60 * 1000
      slots.push({
        iso,
        label: d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
        status: past ? 'past' : takenSlot ? 'taken' : 'available',
        meeting: takenSlot ? meetingForSlot(iso) : null
      })
    }
  }
  return slots
})

function prevMonth() {
  cursor.value = new Date(cursor.value.getFullYear(), cursor.value.getMonth() - 1, 1)
}

function nextMonth() {
  cursor.value = new Date(cursor.value.getFullYear(), cursor.value.getMonth() + 1, 1)
}

function selectDay(cell) {
  selectedDay.value = startOfDay(cell.date)
  detail.value = null
}

async function loadAvailability() {
  const id = profileId()
  if (!id) {
    taken.value = []
    ownerMeetings.value = []
    return
  }
  loading.value = true
  try {
    const from = new Date(cursor.value.getFullYear(), cursor.value.getMonth(), 1)
    const to = new Date(cursor.value.getFullYear(), cursor.value.getMonth() + 2, 0, 23, 59, 59)
    const res = await apiProfileAvailability(id, {
      from: from.toISOString(),
      to: to.toISOString()
    })
    if (!res.ok) {
      flash(res.error || 'Could not load calendar')
      return
    }
    const data = res.data || {}
    taken.value = Array.isArray(data.taken) ? data.taken : []
    ownerMeetings.value = Array.isArray(data.meetings) ? data.meetings : []
    isOwnerFlag.value = !!data.isOwner
    if (data.ownerName) ownerName.value = data.ownerName
    if (data.showBooking !== undefined) showBooking.value = data.showBooking !== false
    if (data.slotMinutes) slotMinutes.value = data.slotMinutes
    if (data.dayStartHour !== undefined) dayStartHour.value = data.dayStartHour
    if (data.dayEndHour !== undefined) dayEndHour.value = data.dayEndHour
  } finally {
    loading.value = false
  }
}

function onSlotClick(slot) {
  if (slot.status === 'past') return
  if (slot.status === 'taken') {
    if (isOwner.value && slot.meeting) {
      detail.value = slot.meeting
      return
    }
    flash('This slot is taken')
    return
  }
  // available
  if (!showBooking.value && !isOwner.value) {
    flash('Booking is currently closed')
    return
  }
  bookAt.value = slot.iso
  bookOpen.value = true
}

async function setStatus(meeting, status) {
  if (!getApiToken()) return
  const res = await apiUpdateMeeting(meeting.id, { status })
  if (!res.ok) {
    flash(res.error || 'Update failed')
    return
  }
  detail.value = { ...meeting, status }
  flash('Updated')
  await loadAvailability()
  window.dispatchEvent(new Event('tapna-meetings-changed'))
}

function onBooked() {
  bookOpen.value = false
  loadAvailability()
  window.dispatchEvent(new Event('tapna-meetings-changed'))
}

watch(cursor, () => loadAvailability())

onMounted(() => {
  document.title = 'Meetings · tap-na'
  publicProfile.value = loadPublicProfile()
  ownerName.value = displayName(publicProfile.value) || 'This person'
  loadAvailability()
})
</script>

<template>
  <div class="min-h-screen flex flex-col items-center overflow-x-hidden">
    <main class="w-full max-w-md min-h-screen flex flex-col relative z-10 pb-28 px-5 pt-8">
      <header class="pb-4">
        <BrandMark size="sm" class="mb-3" />
        <h1 class="text-2xl font-bold tracking-tight">Meetings</h1>
        <p class="text-gray-400 text-sm mt-1">
          {{ isOwner ? 'Your booking calendar' : 'Book time with ' + ownerName }}
        </p>
      </header>

      <section class="card-item-bg rounded-3xl p-4 mb-4">
        <div class="flex items-center justify-between mb-4">
          <button type="button" class="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center" aria-label="Previous month" @click="prevMonth">
            <span class="material-symbols-outlined text-[20px]">chevron_left</span>
          </button>
          <p class="text-sm font-semibold tracking-wide">{{ monthLabel }}</p>
          <button type="button" class="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center" aria-label="Next month" @click="nextMonth">
            <span class="material-symbols-outlined text-[20px]">chevron_right</span>
          </button>
        </div>

        <div class="grid grid-cols-7 gap-1 mb-2">
          <span
            v-for="w in WEEKDAYS"
            :key="w"
            class="text-[10px] uppercase tracking-wide text-gray-500 text-center py-1"
          >{{ w }}</span>
        </div>

        <div class="grid grid-cols-7 gap-1">
          <button
            v-for="cell in calendarCells"
            :key="cell.key"
            type="button"
            class="aspect-square rounded-xl text-sm font-medium transition-colors relative"
            :class="[
              cell.isSelected
                ? 'bg-white text-black'
                : cell.isToday
                  ? 'bg-zinc-700 text-white'
                  : cell.inMonth
                    ? 'text-gray-200 hover:bg-zinc-800'
                    : 'text-gray-600'
            ]"
            @click="selectDay(cell)"
          >
            {{ cell.date.getDate() }}
            <span
              v-if="cell.hasTaken"
              class="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
              :class="cell.isSelected ? 'bg-emerald-600' : 'bg-emerald-400'"
            />
          </button>
        </div>
      </section>

      <section>
        <div class="flex items-center justify-between mb-3 px-1">
          <div>
            <p class="text-sm font-semibold">{{ selectedLabel }}</p>
            <p class="text-[11px] text-gray-500 mt-0.5">
              {{ slotMinutes }}-min slots · {{ dayStartHour }}:00–{{ dayEndHour }}:00
            </p>
          </div>
          <p v-if="loading" class="text-xs text-gray-500">Loading…</p>
        </div>

        <div class="space-y-2">
          <button
            v-for="slot in daySlots"
            :key="slot.iso"
            type="button"
            class="w-full card-item-bg rounded-2xl px-4 py-3 flex items-center justify-between text-left transition-colors"
            :class="{
              'opacity-40 cursor-not-allowed': slot.status === 'past',
              'hover:bg-zinc-800': slot.status !== 'past'
            }"
            :disabled="slot.status === 'past'"
            @click="onSlotClick(slot)"
          >
            <div class="min-w-0">
              <p class="text-sm font-medium text-gray-100">{{ slot.label }}</p>
              <p
                class="text-[11px] mt-0.5"
                :class="{
                  'text-gray-500': slot.status === 'past',
                  'text-emerald-400': slot.status === 'available',
                  'text-amber-400': slot.status === 'taken'
                }"
              >
                <template v-if="slot.status === 'past'">Past</template>
                <template v-else-if="slot.status === 'available'">Available</template>
                <template v-else-if="isOwner && slot.meeting">
                  Taken · tap for details
                </template>
                <template v-else>Taken</template>
              </p>
            </div>
            <span
              class="material-symbols-outlined text-[20px] shrink-0"
              :class="slot.status === 'taken' ? 'text-amber-400' : 'text-gray-500'"
            >
              {{ slot.status === 'taken' ? 'event_busy' : slot.status === 'available' ? 'event_available' : 'schedule' }}
            </span>
          </button>
        </div>
      </section>

      <!-- Owner meeting detail -->
      <div v-if="detail && isOwner" class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/70" @click="detail = null" />
        <div class="relative w-full max-w-md card-item-bg rounded-3xl p-5 shadow-2xl">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-lg font-bold">Meeting details</h2>
            <button type="button" class="w-9 h-9 rounded-full bg-zinc-700 flex items-center justify-center" @click="detail = null">
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
          <div class="space-y-2 text-sm">
            <p><span class="text-gray-500">Guest</span><br /><span class="font-medium">{{ detail.name }}</span></p>
            <p v-if="detail.email"><span class="text-gray-500">Email</span><br /><a :href="'mailto:' + detail.email" class="text-sky-300">{{ detail.email }}</a></p>
            <p v-if="detail.phone"><span class="text-gray-500">Phone</span><br /><a :href="'tel:' + detail.phone" class="text-sky-300">{{ detail.phone }}</a></p>
            <p>
              <span class="text-gray-500">When</span><br />
              <span>{{ detail.preferredAt ? new Date(detail.preferredAt).toLocaleString() : '—' }}</span>
            </p>
            <p v-if="detail.message"><span class="text-gray-500">Message</span><br />{{ detail.message }}</p>
            <p><span class="text-gray-500">Status</span><br /><span class="capitalize">{{ detail.status }}</span></p>
          </div>
          <div class="flex flex-wrap gap-2 mt-4">
            <button type="button" class="px-3 py-2 rounded-xl bg-zinc-800 text-xs font-semibold" @click="setStatus(detail, 'confirmed')">Confirm</button>
            <button type="button" class="px-3 py-2 rounded-xl bg-zinc-800 text-xs font-semibold" @click="setStatus(detail, 'done')">Done</button>
            <button type="button" class="px-3 py-2 rounded-xl bg-zinc-800 text-xs font-semibold text-red-300" @click="setStatus(detail, 'cancelled')">Cancel</button>
          </div>
        </div>
      </div>

      <BookMeetingPopup
        :open="bookOpen"
        :profile-id="profileId()"
        :owner-name="ownerName"
        :preferred-at-initial="bookAt"
        @close="bookOpen = false"
        @submitted="onBooked"
      />

      <p
        v-if="toast"
        class="fixed bottom-24 left-1/2 -translate-x-1/2 z-[110] px-4 py-2 rounded-full bg-zinc-800 text-sm shadow-lg"
      >
        {{ toast }}
      </p>
    </main>
  </div>
</template>