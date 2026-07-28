<script setup>
import { computed, reactive, ref, watch } from 'vue'
import {
  normalizeCheckinForm,
  contactFromParts,
  answersFromCustomFields
} from '../lib/venueForms'
import { appendCheckin } from '../lib/venueCustomerStore'
import { apiSubmitCheckin } from '../lib/api'
import { LOCAL_ID } from '../lib/adminStore'

const props = defineProps({
  open: { type: Boolean, default: false },
  form: { type: Object, default: () => ({}) },
  venueName: { type: String, default: 'this venue' },
  profileId: { type: String, default: '' }
})

const emit = defineEmits(['close', 'submitted'])

const cfg = computed(() => normalizeCheckinForm(props.form))
const name = ref('')
const phone = ref('')
const email = ref('')
const eventName = ref('')
const guests = ref(1)
const custom = reactive({})
const error = ref('')
const success = ref(false)
const submitting = ref(false)

function reset() {
  const form = cfg.value
  name.value = ''
  phone.value = ''
  email.value = ''
  guests.value = 1
  error.value = ''
  success.value = false
  submitting.value = false
  if (form.eventMode === 'fixed') {
    eventName.value = form.eventName || 'General visit'
  } else if (form.eventMode === 'dropdown' && form.events.length) {
    eventName.value = form.events[0]
  } else {
    eventName.value = ''
  }
  Object.keys(custom).forEach((k) => delete custom[k])
  for (const field of form.customFields) {
    custom[field.id] = ''
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) reset()
  }
)

watch(
  () => cfg.value.customFields.map((f) => f.id).join(','),
  () => {
    for (const field of cfg.value.customFields) {
      if (custom[field.id] === undefined) custom[field.id] = ''
    }
  },
  { immediate: true }
)

async function onSubmit(e) {
  e.preventDefault()
  error.value = ''
  const form = cfg.value

  if (form.askName && !name.value.trim()) {
    error.value = 'Please enter your name.'
    return
  }
  if (form.askPhone && !phone.value.trim()) {
    error.value = 'Please enter your phone number.'
    return
  }
  if (form.askEmail && !email.value.trim()) {
    error.value = 'Please enter your email.'
    return
  }

  let event = ''
  if (form.eventMode === 'fixed') {
    event = form.eventName || 'General visit'
  } else if (form.eventMode === 'dropdown') {
    event = eventName.value.trim()
    if (!event) {
      error.value = 'Please select an event.'
      return
    }
  } else {
    event = eventName.value.trim() || form.eventName || 'General visit'
  }

  for (const field of form.customFields) {
    if (field.required && !String(custom[field.id] || '').trim()) {
      error.value = 'Please fill in: ' + field.label
      return
    }
  }

  const answers = answersFromCustomFields(form.customFields, custom)
  const contact = contactFromParts(phone.value, email.value)
  const payload = {
    venue: props.venueName,
    name: name.value.trim() || 'Guest',
    contact,
    phone: phone.value.trim(),
    email: email.value.trim(),
    event,
    guests: form.askGuests ? Math.max(1, Number(guests.value) || 1) : 1,
    answers,
    at: new Date().toISOString()
  }

  submitting.value = true
  try {
    appendCheckin(payload)
    const profileId = props.profileId || LOCAL_ID
    apiSubmitCheckin({
      profileId,
      ...payload
    }).catch(() => {})

    import('../lib/adminStore.js')
      .then((m) => {
        m.logActivity({
          profileId: m.LOCAL_ID,
          type: 'checkin',
          title: 'Event check-in',
          detail: [payload.name, payload.event, payload.guests + ' guest(s)'].join(' · ')
        })
      })
      .catch(() => {})

    success.value = true
    emit('submitted')
    setTimeout(() => emit('close'), 1400)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-4 bg-black/55"
    @click.self="emit('close')"
  >
    <div
      class="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl bg-zinc-900 border border-zinc-700 shadow-2xl"
      role="dialog"
      aria-modal="true"
      :aria-label="cfg.title"
    >
      <div class="sticky top-0 z-10 flex items-start justify-between gap-3 px-5 pt-5 pb-3 bg-zinc-900/95 backdrop-blur">
        <div class="min-w-0">
          <h2 class="text-lg font-bold tracking-tight">{{ cfg.title }}</h2>
          <p v-if="cfg.intro" class="text-xs text-gray-400 mt-1 leading-relaxed">{{ cfg.intro }}</p>
          <p v-else class="text-xs text-gray-500 mt-1">{{ venueName }}</p>
        </div>
        <button
          type="button"
          class="w-9 h-9 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center shrink-0"
          aria-label="Close"
          @click="emit('close')"
        >
          <span class="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      <div v-if="success" class="px-5 pb-6 pt-2 text-center">
        <span class="material-symbols-outlined text-4xl text-emerald-400">check_circle</span>
        <p class="text-base font-semibold mt-2">You're checked in</p>
        <p class="text-xs text-gray-400 mt-1">Welcome!</p>
      </div>

      <form v-else class="px-5 pb-6 space-y-4" @submit="onSubmit">
        <div v-if="cfg.askName" class="field-group">
          <label class="field-label">Name</label>
          <div class="field-shell">
            <input v-model="name" type="text" class="field-input" placeholder="Your name" autocomplete="name" />
          </div>
        </div>

        <div v-if="cfg.eventMode === 'fixed'" class="rounded-2xl bg-zinc-800/60 px-4 py-3">
          <p class="text-[11px] uppercase tracking-wide text-gray-500">Event</p>
          <p class="text-sm font-medium mt-0.5">{{ cfg.eventName }}</p>
        </div>

        <div v-else-if="cfg.eventMode === 'dropdown'" class="field-group">
          <label class="field-label">Event</label>
          <div class="field-shell">
            <select v-model="eventName" class="field-input">
              <option v-for="ev in cfg.events" :key="ev" :value="ev">{{ ev }}</option>
            </select>
          </div>
          <p v-if="!cfg.events.length" class="text-xs text-amber-400 mt-1">
            No events configured yet — add them in Profile.
          </p>
        </div>

        <div v-else class="field-group">
          <label class="field-label">Event name</label>
          <div class="field-shell">
            <input
              v-model="eventName"
              type="text"
              class="field-input"
              :placeholder="cfg.eventName || 'e.g. Friday live music'"
            />
          </div>
        </div>

        <div v-if="cfg.askPhone" class="field-group">
          <label class="field-label">Phone</label>
          <div class="field-shell">
            <input v-model="phone" type="tel" class="field-input" placeholder="+264…" autocomplete="tel" />
          </div>
        </div>

        <div v-if="cfg.askEmail" class="field-group">
          <label class="field-label">Email</label>
          <div class="field-shell">
            <input v-model="email" type="email" class="field-input" placeholder="you@example.com" autocomplete="email" />
          </div>
        </div>

        <div v-if="cfg.askGuests" class="field-group">
          <label class="field-label">Guests</label>
          <div class="field-shell">
            <input v-model="guests" type="number" min="1" max="50" class="field-input" />
          </div>
        </div>

        <div v-for="field in cfg.customFields" :key="field.id" class="field-group">
          <label class="field-label">
            {{ field.label }}{{ field.required ? '' : ' (optional)' }}
          </label>
          <div v-if="field.type === 'textarea'" class="field-shell !items-start">
            <textarea v-model="custom[field.id]" class="field-textarea" rows="3" />
          </div>
          <div v-else-if="field.type === 'select'" class="field-shell">
            <select v-model="custom[field.id]" class="field-input">
              <option value="">Select…</option>
              <option v-for="opt in field.options" :key="opt" :value="opt">{{ opt }}</option>
            </select>
          </div>
          <div v-else class="field-shell">
            <input v-model="custom[field.id]" type="text" class="field-input" />
          </div>
        </div>

        <p v-if="error" class="text-xs text-red-400">{{ error }}</p>

        <div class="flex gap-2 pt-1">
          <button
            type="button"
            class="flex-1 py-3 rounded-2xl bg-zinc-800 text-sm font-semibold"
            @click="emit('close')"
          >
            Close
          </button>
          <button
            type="submit"
            class="flex-1 py-3 rounded-2xl bg-white text-black text-sm font-bold disabled:opacity-50"
            :disabled="submitting"
          >
            {{ submitting ? 'Saving…' : 'Check in' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>