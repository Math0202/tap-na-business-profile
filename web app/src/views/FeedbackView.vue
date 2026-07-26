<script setup>
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import BrandMark from '../components/BrandMark.vue'
import { loadPublicProfile } from '../lib/profileStore'
import { appendFeedback } from '../lib/venueCustomerStore'
import { apiSubmitFeedback } from '../lib/api'
import { LOCAL_ID } from '../lib/adminStore'

const venue = ref('this venue')
const profileId = ref(LOCAL_ID)
const rating = ref(0)
const name = ref('')
const message = ref('')
const error = ref('')
const success = ref(false)

onMounted(() => {
  const profile = loadPublicProfile()
  venue.value = profile.company || profile.name || 'this venue'
  profileId.value = profile.id || profile.remoteProfileId || LOCAL_ID
  document.title = 'Feedback · ' + venue.value
})

function setRating(value) {
  rating.value = value
}

function onSubmit(e) {
  e.preventDefault()
  if (!rating.value) {
    error.value = 'Please choose a star rating.'
    return
  }
  if (!message.value.trim()) {
    error.value = 'Please write a short comment.'
    return
  }

  appendFeedback({
    venue: venue.value,
    name: name.value.trim() || 'Anonymous',
    rating: rating.value,
    message: message.value.trim(),
    at: new Date().toISOString()
  })

  // Sync to backend (fire-and-forget, keeps working offline)
  apiSubmitFeedback({
    profileId: profileId.value,
    venue: venue.value,
    name: name.value.trim() || 'Anonymous',
    rating: rating.value,
    message: message.value.trim()
  }).catch(() => {})

  import('../lib/adminStore.js').then((m) => {
    const stars = '★'.repeat(rating.value)
    m.logActivity({
      profileId: m.LOCAL_ID,
      type: 'feedback',
      title: 'Feedback received',
      detail: stars + ' “' + message.value.trim() + '”'
    })
  }).catch(() => {})

  success.value = true
}
</script>

<template>
  <main class="w-full max-w-md min-h-screen mx-auto flex flex-col relative z-10 px-6 pt-16 pb-28">
    <BrandMark size="sm" class="mb-3" />
    <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{{ venue }}</p>
    <h1 class="text-2xl font-bold tracking-tight">Feedback</h1>
    <p class="text-gray-400 text-sm mt-1 mb-8">Tell us how we did</p>

    <form v-if="!success" class="space-y-4" @submit="onSubmit">
      <div>
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Rating</p>
        <div class="flex items-center gap-1" role="radiogroup" aria-label="Rating">
          <button
            v-for="n in 5"
            :key="n"
            type="button"
            class="star-btn"
            :class="{ 'is-on': n <= rating }"
            :aria-label="n + ' star' + (n > 1 ? 's' : '')"
            @click="setRating(n)"
          >
            <span
              class="material-symbols-outlined text-[32px]"
              :style="{ fontVariationSettings: n <= rating ? `'FILL' 1` : `'FILL' 0` }"
            >star</span>
          </button>
        </div>
      </div>
      <div>
        <label class="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5" for="feedback-name">Name</label>
        <div class="field-shell">
          <span class="material-symbols-outlined text-gray-400 text-[20px]">person</span>
          <input id="feedback-name" v-model="name" type="text" class="field-input" placeholder="Optional" autocomplete="name" />
        </div>
      </div>
      <div>
        <label class="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5" for="feedback-message">Your feedback</label>
        <textarea id="feedback-message" v-model="message" class="field-textarea" placeholder="What did you enjoy? What can we improve?" required />
      </div>
      <p class="text-xs text-red-400 min-h-[1rem]">{{ error }}</p>
      <button type="submit" class="w-full py-4 rounded-full bg-white text-black font-bold text-base hover:bg-gray-200 transition-colors">
        Submit feedback
      </button>
    </form>

    <div v-else class="mt-6 card-item-bg rounded-2xl p-5 text-center">
      <span class="material-symbols-outlined text-4xl text-emerald-400" style="font-variation-settings: 'FILL' 1">favorite</span>
      <p class="text-lg font-semibold mt-2">Thanks for the feedback</p>
      <p class="text-sm text-gray-400 mt-1">We appreciate you taking the time.</p>
      <RouterLink to="/business" class="inline-block mt-4 text-sm font-semibold underline underline-offset-2">
        Back to venue
      </RouterLink>
    </div>
  </main>
</template>
