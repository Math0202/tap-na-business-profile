<script setup>
import { ref, watch } from 'vue'
import { apiSubmitConnection } from '../lib/api'
import {
  buildConnectShareMessage,
  smsShareUrl,
  whatsAppShareUrl
} from '../lib/connectShare'

const props = defineProps({
  open: { type: Boolean, default: false },
  profileId: { type: String, default: '' },
  ownerName: { type: String, default: '' },
  ownerPhone: { type: String, default: '' }
})

const emit = defineEmits(['close', 'shared'])

const name = ref('')
const phone = ref('')
const email = ref('')
const company = ref('')
const error = ref('')
const step = ref('form')
const connectionId = ref('')

function reset() {
  name.value = ''
  phone.value = ''
  email.value = ''
  company.value = ''
  error.value = ''
  step.value = 'form'
  connectionId.value = ''
}

watch(() => props.open, (isOpen) => {
  if (isOpen) reset()
})

function guestPayload(shareChannel = '') {
  return {
    profileId: props.profileId,
    name: name.value.trim(),
    phone: phone.value.trim(),
    email: email.value.trim(),
    company: company.value.trim(),
    shareChannel
  }
}

function saveConnectionInBackground(shareChannel = '') {
  if (!props.profileId) return

  const payload = guestPayload(shareChannel)
  if (connectionId.value && shareChannel) {
    payload.connectionId = connectionId.value
  }

  apiSubmitConnection(payload)
    .then((res) => {
      if (!res?.ok) return
      const id = res.data?.connection?.id
      if (id && !connectionId.value) connectionId.value = id
      if (shareChannel) emit('shared', res.data)
    })
    .catch(() => {})
}

function goToChannel(e) {
  e.preventDefault()
  error.value = ''
  if (!name.value.trim()) {
    error.value = 'Please enter your name.'
    return
  }
  if (!props.ownerPhone) {
    error.value = 'This profile has no phone number to share with yet.'
    return
  }
  saveConnectionInBackground()
  step.value = 'channel'
}

function shareVia(channel) {
  error.value = ''
  const guestName = name.value.trim()
  if (!guestName) {
    error.value = 'Please enter your name.'
    step.value = 'form'
    return
  }
  if (!props.ownerPhone) {
    error.value = 'This profile has no phone number to share with yet.'
    return
  }

  const message = buildConnectShareMessage({
    guestName,
    guestPhone: phone.value.trim(),
    guestEmail: email.value.trim(),
    guestCompany: company.value.trim(),
    ownerName: props.ownerName
  })

  const url =
    channel === 'whatsapp'
      ? whatsAppShareUrl(props.ownerPhone, message)
      : smsShareUrl(props.ownerPhone, message)
  if (!url) {
    error.value = 'Could not open share — check the profile phone number.'
    return
  }

  saveConnectionInBackground(channel)
  window.location.href = url
  setTimeout(() => emit('close'), 400)
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="app-dialog-overlay fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4"
    >
      <div class="absolute inset-0 bg-black/70" @click="emit('close')" />
      <div class="relative w-full max-w-md card-item-bg rounded-3xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between mb-3">
          <div>
            <h2 class="text-lg font-bold">Connect</h2>
            <p class="text-gray-400 text-xs mt-0.5">
              Share your details with {{ ownerName || 'this person' }}
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

        <form v-if="step === 'form'" class="space-y-3" @submit="goToChannel">
          <div>
            <label class="field-label" for="connect-name">Name <span class="text-red-400">*</span></label>
            <input
              id="connect-name"
              v-model="name"
              type="text"
              class="field-input w-full"
              required
              autocomplete="name"
              placeholder="Your full name"
            />
          </div>
          <div>
            <label class="field-label" for="connect-phone">Phone number</label>
            <input
              id="connect-phone"
              v-model="phone"
              type="tel"
              class="field-input w-full"
              autocomplete="tel"
              placeholder="+264 81 000 0000"
            />
          </div>
          <div>
            <label class="field-label" for="connect-email">Email</label>
            <input
              id="connect-email"
              v-model="email"
              type="email"
              class="field-input w-full"
              autocomplete="email"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label class="field-label" for="connect-company">Company name</label>
            <input
              id="connect-company"
              v-model="company"
              type="text"
              class="field-input w-full"
              autocomplete="organization"
              placeholder="Optional"
            />
          </div>
          <p v-if="error" class="text-red-400 text-sm">{{ error }}</p>
          <button
            type="submit"
            class="w-full py-3.5 rounded-full bg-white text-black font-bold text-sm hover:bg-gray-200 transition-colors"
          >
            Share my details
          </button>
        </form>

        <div v-else class="space-y-3">
          <p class="text-sm text-gray-300">
            Choose how to send your details to {{ ownerName || 'the profile owner' }}.
          </p>
          <button
            type="button"
            class="w-full py-3.5 rounded-full bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-500 transition-colors flex items-center justify-center gap-2"
            @click="shareVia('whatsapp')"
          >
            <span class="material-symbols-outlined text-[20px]">chat</span>
            Share via WhatsApp
          </button>
          <button
            type="button"
            class="w-full py-3.5 rounded-full bg-zinc-800 text-white font-bold text-sm hover:bg-zinc-700 transition-colors border border-zinc-700 flex items-center justify-center gap-2"
            @click="shareVia('sms')"
          >
            <span class="material-symbols-outlined text-[20px]">sms</span>
            Share via SMS
          </button>
          <button
            type="button"
            class="w-full py-2.5 text-sm text-gray-400 hover:text-white"
            @click="step = 'form'"
          >
            Back
          </button>
          <p v-if="error" class="text-red-400 text-sm">{{ error }}</p>
        </div>
      </div>
    </div>
  </Teleport>
</template>