<script setup>
import { computed, reactive, ref, watch } from 'vue'
import {
  normalizeFeedbackForm,
  contactFromParts,
  answersFromCustomFields
} from '../lib/venueForms'
import { appendFeedback } from '../lib/venueCustomerStore'
import { apiSubmitFeedback } from '../lib/api'
import { LOCAL_ID } from '../lib/adminStore'

const props = defineProps({
  open: { type: Boolean, default: false },
  form: { type: Object, default: () => ({}) },
  venueName: { type: String, default: 'this venue' },
  profileId: { type: String, default: '' }
})

const emit = defineEmits(['close', 'submitted'])

const cfg = computed(() => normalizeFeedbackForm(props.form))
const rating = ref(0)
const name = ref('')
const phone = ref('')
const email = ref('')
const message = ref('')
const custom = reactive({})
const error = ref('')
const success = ref(false)
const submitting = ref(false)

function reset() {
  rating.value = 0
  name.value = ''
  phone.value = ''
  email.value = ''
  message.value = ''
  error.value = ''
  success.value = false
  submitting.value = false
  Object.keys(custom).forEach((k) => delete custom[k])
  for (const field of cfg.value.customFields) {
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

function setRating(n) {
  rating.value = n
}

async function onSubmit(e) {
  e.preventDefault()
  error.value = ''
  const form = cfg.value

  if (form.askStars && form.starsRequired && rating.value < 1) {
    error.value = 'Please choose a star rating.'
    return
  }
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
  if (form.askMessage && form.messageRequired && !message.value.trim()) {
    error.value = 'Please enter your feedback.'
    return
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
    name: name.value.trim() || (form.askName ? '' : 'Anonymous'),
    contact,
    phone: phone.value.trim(),
    email: email.value.trim(),
    rating: form.askStars ? rating.value : 0,
    message: form.askMessage ? message.value.trim() : '',
    answers,
    at: new Date().toISOString()
  }

  submitting.value = true
  try {
    appendFeedback(payload)
    const profileId = props.profileId || LOCAL_ID
    apiSubmitFeedback({
      profileId,
      ...payload
    }).catch(() => {})

    import('../lib/adminStore.js')
      .then((m) => {
        m.logActivity({
          profileId: m.LOCAL_ID,
          type: 'feedback',
          title: 'Feedback',
          detail: [
            payload.name,
            payload.rating ? payload.rating + '★' : '',
            payload.message
          ]
            .filter(Boolean)
            .join(' · ')
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
        <p class="text-base font-semibold mt-2">Thanks for your feedback</p>
      </div>

      <form v-else class="px-5 pb-6 space-y-4" @submit="onSubmit">
        <div v-if="cfg.askStars">
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
            Rating{{ cfg.starsRequired ? '' : ' (optional)' }}
          </p>
          <div class="flex items-center gap-1">
            <button
              v-for="n in 5"
              :key="n"
              type="button"
              class="w-10 h-10 rounded-full flex items-center justify-center transition"
              :class="n <= rating ? 'text-amber-400' : 'text-zinc-600 hover:text-zinc-400'"
              :aria-label="n + ' stars'"
              @click="setRating(n)"
            >
              <span class="material-symbols-outlined text-[28px]">star</span>
            </button>
          </div>
        </div>

        <div v-if="cfg.askName" class="field-group">
          <label class="field-label">Name</label>
          <div class="field-shell">
            <input v-model="name" type="text" class="field-input" placeholder="Your name" autocomplete="name" />
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

        <div v-if="cfg.askMessage" class="field-group">
          <label class="field-label">
            {{ cfg.messageLabel }}{{ cfg.messageRequired ? '' : ' (optional)' }}
          </label>
          <div class="field-shell !items-start">
            <textarea
              v-model="message"
              class="field-textarea"
              rows="3"
              :placeholder="cfg.messageLabel"
            />
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
            {{ submitting ? 'Sending…' : 'Submit' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>