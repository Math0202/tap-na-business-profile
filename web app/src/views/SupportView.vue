<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import ShopHeader from '../components/ShopHeader.vue'
import ShopBottomNav from '../components/ShopBottomNav.vue'
import { apiShopSupport } from '../lib/api'
import { setPageSeo } from '../lib/seo'

const SUPPORT_EMAIL = 'auckmund@gmail.com'
const SUPPORT_WHATSAPP = '+264858117337'
const SUPPORT_WHATSAPP_DISPLAY = '+264 85 811 7337'

const router = useRouter()
const menuOpen = ref(false)
const name = ref('')
const email = ref('')
const phone = ref('')
const subject = ref('')
const message = ref('')
const submitting = ref(false)
const error = ref('')
const sent = ref(false)

function shopAll() {
  menuOpen.value = false
  router.push({ path: '/', hash: '#business-cards' })
}

const mailtoHref = `mailto:${SUPPORT_EMAIL}`
const whatsappHref = `https://wa.me/${SUPPORT_WHATSAPP.replace(/\D/g, '')}`

async function onSubmit() {
  if (submitting.value) return
  error.value = ''
  sent.value = false
  const n = name.value.trim()
  const e = email.value.trim()
  const m = message.value.trim()
  if (!n) {
    error.value = 'Please enter your name.'
    return
  }
  if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
    error.value = 'Please enter a valid email.'
    return
  }
  if (m.length < 10) {
    error.value = 'Please enter a message (at least 10 characters).'
    return
  }
  submitting.value = true
  try {
    const res = await apiShopSupport({
      name: n,
      email: e,
      phone: phone.value.trim(),
      subject: subject.value.trim(),
      message: m
    })
    if (!res.ok) {
      error.value = res.error || 'Could not send. Try WhatsApp or email instead.'
      return
    }
    sent.value = true
    name.value = ''
    email.value = ''
    phone.value = ''
    subject.value = ''
    message.value = ''
  } catch (err) {
    error.value = err?.message || 'Could not send. Try WhatsApp or email instead.'
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  document.documentElement.classList.add('shop-home')
  setPageSeo({
    title: 'Support — tap-na',
    description:
      'Contact Tap-Na support by form, WhatsApp, or email. Help with NFC Connect cards, orders, and profiles.',
    path: '/support'
  })
})

onUnmounted(() => {
  document.documentElement.classList.remove('shop-home')
})
</script>

<template>
  <div class="shop-page bg-surface text-on-surface font-body-md text-body-md min-h-screen">
    <ShopHeader
      :menu-open="menuOpen"
      @toggle-menu="menuOpen = !menuOpen"
      @close-menu="menuOpen = false"
      @shop-all="shopAll"
    />

    <main class="pt-16 min-h-screen bg-surface pb-24 md:pb-10">
      <div class="max-w-3xl mx-auto px-margin-mobile md:px-margin-desktop py-10 flex flex-col gap-10">
        <header class="flex flex-col gap-3">
          <p class="font-label-caps text-[11px] uppercase tracking-[0.2em] text-ink-muted">Support</p>
          <h1 class="font-headline-lg-mobile md:font-headline-lg text-[32px] md:text-[40px] font-semibold leading-tight">
            We’re here to help
          </h1>
          <p class="text-on-surface-variant text-base leading-relaxed max-w-xl">
            Questions about Connect cards, orders, claiming, or your profile? Send a message, WhatsApp us, or email directly.
          </p>
        </header>

        <section class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a
            :href="whatsappHref"
            target="_blank"
            rel="noopener noreferrer"
            class="bg-surface-container rounded-xl p-5 no-underline text-inherit flex gap-3 hover:opacity-90 transition-opacity"
          >
            <span class="material-symbols-outlined text-primary shrink-0">chat</span>
            <div>
              <p class="font-medium text-sm">WhatsApp</p>
              <p class="text-sm text-on-surface-variant mt-1">{{ SUPPORT_WHATSAPP_DISPLAY }}</p>
            </div>
          </a>
          <a
            :href="mailtoHref"
            class="bg-surface-container rounded-xl p-5 no-underline text-inherit flex gap-3 hover:opacity-90 transition-opacity"
          >
            <span class="material-symbols-outlined text-primary shrink-0">mail</span>
            <div>
              <p class="font-medium text-sm">Email us</p>
              <p class="text-sm text-on-surface-variant mt-1">{{ SUPPORT_EMAIL }}</p>
            </div>
          </a>
        </section>

        <section class="flex flex-col gap-4">
          <div class="flex flex-col gap-1">
            <h2 class="font-headline-lg-mobile text-[22px] uppercase font-semibold">Send a message</h2>
            <div class="h-1 w-12 bg-primary" />
          </div>

          <p
            v-if="sent"
            class="rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 px-4 py-3 text-sm"
          >
            Thanks — your message was sent. We’ll get back to you soon.
          </p>
          <p v-if="error" class="rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 px-4 py-3 text-sm">
            {{ error }}
          </p>

          <form class="flex flex-col gap-4" @submit.prevent="onSubmit">
            <div>
              <label class="field-label" for="support-name">Name</label>
              <input
                id="support-name"
                v-model="name"
                type="text"
                class="field-input w-full bg-surface-container border-0"
                autocomplete="name"
                maxlength="120"
                required
              >
            </div>
            <div>
              <label class="field-label" for="support-email">Email</label>
              <input
                id="support-email"
                v-model="email"
                type="email"
                class="field-input w-full bg-surface-container border-0"
                autocomplete="email"
                maxlength="160"
                required
              >
            </div>
            <div>
              <label class="field-label" for="support-phone">Phone (optional)</label>
              <input
                id="support-phone"
                v-model="phone"
                type="tel"
                class="field-input w-full bg-surface-container border-0"
                autocomplete="tel"
                maxlength="40"
              >
            </div>
            <div>
              <label class="field-label" for="support-subject">Subject (optional)</label>
              <input
                id="support-subject"
                v-model="subject"
                type="text"
                class="field-input w-full bg-surface-container border-0"
                maxlength="160"
                placeholder="Orders, claiming, profile…"
              >
            </div>
            <div>
              <label class="field-label" for="support-message">Message</label>
              <textarea
                id="support-message"
                v-model="message"
                rows="5"
                class="field-input w-full bg-surface-container border-0 resize-y min-h-[120px]"
                maxlength="4000"
                required
              />
            </div>
            <button
              type="submit"
              class="bg-primary text-on-primary py-4 font-button-text uppercase tracking-widest hover:opacity-90 transition-opacity disabled:opacity-50"
              :disabled="submitting"
            >
              {{ submitting ? 'Sending…' : 'Send message' }}
            </button>
          </form>
        </section>

        <p class="text-sm text-ink-muted">
          Prefer shopping first?
          <RouterLink to="/" class="text-primary no-underline">Back to shop</RouterLink>
          ·
          <RouterLink to="/about/business-cards" class="text-primary no-underline">About Connect cards</RouterLink>
        </p>
      </div>
    </main>

    <ShopBottomNav />
  </div>
</template>

<style>
html.shop-home,
html.shop-home body {
  background-color: #f9f9f9 !important;
  color: #1a1c1c;
}
</style>
