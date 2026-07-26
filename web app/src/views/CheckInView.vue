<script setup>
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import BrandMark from '../components/BrandMark.vue'
import { loadPublicProfile } from '../lib/profileStore'
import { appendCheckin } from '../lib/venueCustomerStore'
import { apiSubmitCheckin } from '../lib/api'
import { LOCAL_ID } from '../lib/adminStore'

const venue = ref('this venue')
const profileId = ref(LOCAL_ID)
const name = ref('')
const contact = ref('')
const eventName = ref('')
const guests = ref(1)
const error = ref('')
const success = ref(false)
const successCopy = ref('')

onMounted(() => {
  const profile = loadPublicProfile()
  venue.value = profile.company || profile.name || 'this venue'
  profileId.value = profile.id || profile.remoteProfileId || LOCAL_ID
  document.title = 'Check-in · ' + venue.value
})

function onSubmit(e) {
  e.preventDefault()
  if (!name.value.trim() || !contact.value.trim()) {
    error.value = 'Name and contact are required.'
    return
  }

  appendCheckin({
    venue: venue.value,
    name: name.value.trim(),
    contact: contact.value.trim(),
    event: eventName.value.trim() || 'General visit',
    guests: Number(guests.value) || 1,
    at: new Date().toISOString()
  })

  // Sync to backend (fire-and-forget, keeps working offline)
  apiSubmitCheckin({
    profileId: profileId.value,
    venue: venue.value,
    name: name.value.trim(),
    contact: contact.value.trim(),
    event: eventName.value.trim() || 'General visit',
    guests: Number(guests.value) || 1
  }).catch(() => {})

  import('../lib/adminStore.js').then((m) => {
    m.logActivity({
      profileId: m.LOCAL_ID,
      type: 'checkin',
      title: 'Event check-in',
      detail: [name.value.trim(), eventName.value.trim() || 'General visit', (Number(guests.value) || 1) + ' guest(s)'].join(' · ')
    })
  }).catch(() => {})

  successCopy.value =
    'Welcome, ' + name.value.trim() + (eventName.value.trim() ? ' · ' + eventName.value.trim() : '') + '.'
  success.value = true
}
</script>

<template>
  <main class="w-full max-w-md min-h-screen mx-auto flex flex-col relative z-10 px-6 pt-16 pb-28">
    <BrandMark size="sm" class="mb-3" />
    <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{{ venue }}</p>
    <h1 class="text-2xl font-bold tracking-tight">Events check-in</h1>
    <p class="text-gray-400 text-sm mt-1 mb-8">Confirm you’re here for today’s event</p>

    <form v-if="!success" class="space-y-4" @submit="onSubmit">
      <div>
        <label class="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5" for="checkin-name">Full name</label>
        <div class="field-shell">
          <span class="material-symbols-outlined text-gray-400 text-[20px]">badge</span>
          <input id="checkin-name" v-model="name" type="text" class="field-input" placeholder="Your name" autocomplete="name" required />
        </div>
      </div>
      <div>
        <label class="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5" for="checkin-contact">Email or cell</label>
        <div class="field-shell">
          <span class="material-symbols-outlined text-gray-400 text-[20px]">contact_mail</span>
          <input id="checkin-contact" v-model="contact" type="text" class="field-input" placeholder="you@example.com or +264…" required />
        </div>
      </div>
      <div>
        <label class="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5" for="checkin-event">Event name</label>
        <div class="field-shell">
          <span class="material-symbols-outlined text-gray-400 text-[20px]">event</span>
          <input id="checkin-event" v-model="eventName" type="text" class="field-input" placeholder="Optional — e.g. Friday live music" />
        </div>
      </div>
      <div>
        <label class="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5" for="checkin-guests">Guests</label>
        <div class="field-shell">
          <span class="material-symbols-outlined text-gray-400 text-[20px]">group</span>
          <input id="checkin-guests" v-model="guests" type="number" min="1" max="50" class="field-input" />
        </div>
      </div>
      <p class="text-xs text-red-400 min-h-[1rem]">{{ error }}</p>
      <button type="submit" class="w-full py-4 rounded-full bg-white text-black font-bold text-base hover:bg-gray-200 transition-colors">
        Check in
      </button>
    </form>

    <div v-else class="mt-6 card-item-bg rounded-2xl p-5 text-center">
      <span class="material-symbols-outlined text-4xl text-emerald-400" style="font-variation-settings: 'FILL' 1">check_circle</span>
      <p class="text-lg font-semibold mt-2">You’re checked in</p>
      <p class="text-sm text-gray-400 mt-1">{{ successCopy }}</p>
      <RouterLink to="/business" class="inline-block mt-4 text-sm font-semibold underline underline-offset-2">
        Back to venue
      </RouterLink>
    </div>
  </main>
</template>
