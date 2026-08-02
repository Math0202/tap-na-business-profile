<script setup>
import { ref, watch } from 'vue'
import { apiSubmitMeeting } from '../lib/api'

const props = defineProps({
  open: { type: Boolean, default: false },
  profileId: { type: String, default: '' },
  ownerName: { type: String, default: '' },
  preferredAtInitial: { type: String, default: '' }
})

const emit = defineEmits(['close', 'submitted'])

const name = ref('')
const email = ref('')
const phone = ref('')
const preferredAt = ref('')
const message = ref('')
const error = ref('')
const success = ref(false)
const submitting = ref(false)

function reset() {
  name.value = ''
  email.value = ''
  phone.value = ''
  preferredAt.value = ''
  message.value = ''
  error.value = ''
  success.value = false
  submitting.value = false
}

watch(() => props.open, (isOpen) => {
  if (!isOpen) return
  reset()
  if (props.preferredAtInitial) {
    const d = new Date(props.preferredAtInitial)
    if (!Number.isNaN(d.getTime())) {
      const pad = (n) => String(n).padStart(2, '0')
      preferredAt.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    }
  }
})

async function onSubmit(e) {
  e.preventDefault()
  error.value = ''
  if (!name.value.trim()) {
    error.value = 'Please enter your name.'
    return
  }
  const mail = email.value.trim()
  if (!mail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
    error.value = 'A valid email is required so we can send the calendar invite.'
    return
  }
  if (!preferredAt.value) {
    error.value = 'Pick a preferred date and time for the calendar invite.'
    return
  }
  if (!props.profileId) {
    error.value = 'This card is not ready for bookings yet.'
    return
  }

  submitting.value = true
  const payload = {
    profileId: props.profileId,
    name: name.value.trim(),
    email: mail,
    phone: phone.value.trim(),
    preferredAt: new Date(preferredAt.value).toISOString(),
    message: message.value.trim()
  }
  const res = await apiSubmitMeeting(payload)
  submitting.value = false
  if (!res.ok) {
    error.value = res.error || 'Could not send meeting request.'
    return
  }
  success.value = true
  emit('submitted', res.data)
  setTimeout(() => emit('close'), 1600)
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
    <div class="absolute inset-0 bg-black/70" @click="emit('close')" />
    <div class="relative w-full max-w-md card-item-bg rounded-3xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between mb-3">
        <div>
          <h2 class="text-lg font-bold">Book a meeting</h2>
          <p class="text-gray-400 text-xs mt-0.5">
            Request time with {{ ownerName || 'this person' }}
          </p>
        </div>
        <button
          type="button"
          aria-label="Close"
          class="w-9 h-9 rounded-full bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center"
          @click="emit('close')"
        >
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>

      <div
        v-if="success"
        class="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-emerald-300 text-sm"
      >
        Request sent. Check your email for the calendar invite — they got one too.
      </div>

      <form v-else class="space-y-3" @submit="onSubmit">
        <div>
          <label class="field-label" for="meet-name">Your name</label>
          <input id="meet-name" v-model="name" type="text" class="field-input w-full" required autocomplete="name" />
        </div>
        <div>
          <label class="field-label" for="meet-email">Email</label>
          <input id="meet-email" v-model="email" type="email" class="field-input w-full" required autocomplete="email" />
          <p class="field-hint mt-1">Required — we send the calendar invite here</p>
        </div>
        <div>
          <label class="field-label" for="meet-phone">Phone</label>
          <input id="meet-phone" v-model="phone" type="tel" class="field-input w-full" autocomplete="tel" />
        </div>
        <div>
          <label class="field-label" for="meet-when">Preferred date &amp; time</label>
          <input id="meet-when" v-model="preferredAt" type="datetime-local" class="field-input w-full" required />
          <p class="field-hint mt-1">Used for the calendar invite (30 minutes)</p>
        </div>
        <div>
          <label class="field-label" for="meet-msg">Message</label>
          <textarea
            id="meet-msg"
            v-model="message"
            rows="3"
            class="field-input w-full resize-none"
            placeholder="What would you like to discuss?"
          />
        </div>
        <p v-if="error" class="text-red-400 text-sm">{{ error }}</p>
        <button
          type="submit"
          class="w-full py-3.5 rounded-full bg-white text-black font-bold text-sm hover:bg-gray-200 transition-colors disabled:opacity-50"
          :disabled="submitting"
        >
          {{ submitting ? 'Sending…' : 'Send request' }}
        </button>
      </form>
    </div>
  </div>
</template>
