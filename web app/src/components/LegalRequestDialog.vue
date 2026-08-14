<script setup>
import { computed, ref, watch } from 'vue'
import { apiShopSupport } from '../lib/api'
import {
  legalRequestKind,
  legalRequestOpen,
  closeLegalRequest
} from '../lib/legalRequest'

const name = ref('')
const email = ref('')
const submitting = ref(false)
const error = ref('')
const sent = ref(false)

const isTerms = computed(() => legalRequestKind.value === 'terms')
const title = computed(() => (isTerms.value ? 'Terms of use' : 'Privacy policy'))
const docLabel = computed(() => (isTerms.value ? 'terms of use' : 'privacy policy'))
const mailtoHref = computed(() => {
  const subject = encodeURIComponent(`Please send the tap-na ${docLabel.value}`)
  return `mailto:welcome@tapnam.com?subject=${subject}`
})

watch(legalRequestOpen, (open) => {
  if (!open) return
  error.value = ''
  sent.value = false
  submitting.value = false
})

function close() {
  closeLegalRequest()
}

async function onSubmit() {
  if (submitting.value || sent.value) return
  error.value = ''
  const n = name.value.trim()
  const e = email.value.trim()
  if (!n) {
    error.value = 'Please enter your name.'
    return
  }
  if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
    error.value = 'Please enter a valid email.'
    return
  }
  submitting.value = true
  try {
    const res = await apiShopSupport({
      name: n,
      email: e,
      subject: `Request: ${title.value}`,
      message: `Please email me the tap-na ${docLabel.value}.`
    })
    if (!res.ok) {
      error.value = res.error || 'Could not send. Try emailing us instead.'
      return
    }
    sent.value = true
  } catch (err) {
    error.value = err?.message || 'Could not send. Try emailing us instead.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="legalRequestOpen"
      class="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
    >
      <button
        type="button"
        class="absolute inset-0 bg-black/45 border-0 cursor-pointer"
        aria-label="Close"
        @click="close"
      />
      <div class="relative w-full sm:max-w-lg bg-surface text-on-surface rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div class="shrink-0 bg-surface border-b border-border-subtle px-5 py-4 flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 class="font-headline-lg-mobile text-[22px] font-medium uppercase tracking-tight">
              {{ title }}
            </h2>
            <p class="text-on-surface-variant text-sm mt-1">Request a copy by email</p>
          </div>
          <button
            type="button"
            class="w-10 h-10 shrink-0 flex items-center justify-center rounded-full hover:bg-surface-container"
            aria-label="Close"
            @click="close"
          >
            <span class="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
        </div>

        <div class="px-5 py-5 flex flex-col gap-4">
          <p class="text-on-surface-variant text-sm leading-relaxed">
            This document is not on the site yet. Leave your name and email and we will send the
            {{ docLabel }} to you.
          </p>

          <p
            v-if="sent"
            class="rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 px-4 py-3 text-sm"
          >
            Thanks — we will email the {{ docLabel }} to you shortly.
          </p>
          <p v-if="error" class="rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 px-4 py-3 text-sm">
            {{ error }}
          </p>

          <form v-if="!sent" class="flex flex-col gap-4" @submit.prevent="onSubmit">
            <div>
              <label class="field-label" for="legal-request-name">Name</label>
              <input
                id="legal-request-name"
                v-model="name"
                type="text"
                class="field-input w-full bg-surface-container border-0"
                autocomplete="name"
                maxlength="120"
                required
              >
            </div>
            <div>
              <label class="field-label" for="legal-request-email">Email</label>
              <input
                id="legal-request-email"
                v-model="email"
                type="email"
                class="field-input w-full bg-surface-container border-0"
                autocomplete="email"
                maxlength="160"
                required
              >
            </div>
            <button
              type="submit"
              class="bg-primary text-on-primary py-4 font-button-text uppercase tracking-widest hover:opacity-90 transition-opacity disabled:opacity-50"
              :disabled="submitting"
            >
              {{ submitting ? 'Sending…' : 'Request by email' }}
            </button>
          </form>

          <p class="text-sm text-on-surface-variant">
            Or email
            <a :href="mailtoHref" class="text-on-surface no-underline hover:opacity-70 font-medium">
              welcome@tapnam.com
            </a>
          </p>
        </div>
      </div>
    </div>
  </Teleport>
</template>
