<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import PageBanner from '../components/PageBanner.vue'
import BrandMark from '../components/BrandMark.vue'
import { loadProfile } from '../lib/profileStore'
import { PERSONAL_TYPES, personalCardImageSrc } from '../lib/teamRoles'

const personalCardOptions = [
  {
    id: 'professional',
    name: 'Professional',
    subtitle: 'Cobalt blue · NFC + QR',
    badge: 'Popular',
    badgeClass: 'bg-blue-500/20 text-blue-300'
  },
  {
    id: 'business',
    name: 'Business',
    subtitle: 'Charcoal gradient · NFC + QR',
    badge: 'Standard',
    badgeClass: 'bg-zinc-600/40 text-gray-300'
  },
  {
    id: 'executive_exclusive',
    name: 'Executive Exclusive',
    subtitle: 'Matte black · NFC + QR',
    badge: 'Premium',
    badgeClass: 'bg-amber-500/20 text-amber-300'
  }
]

const SIGNUP_KEY = 'tapna_signup_lead'
const route = useRoute()
const router = useRouter()

const signupLead = ref(null)
const showPrereq = ref(false)
const toastVisible = ref(false)
const toastName = ref('')
let toastTimer = null

onMounted(() => {
  document.title = 'Order NFC Cards - tap-na'
  const isSignup = route.query.signup === '1'
  try {
    signupLead.value = JSON.parse(sessionStorage.getItem(SIGNUP_KEY) || 'null')
  } catch {
    signupLead.value = null
  }
  if (isSignup && (!signupLead.value?.name || !signupLead.value?.cell || !signupLead.value?.email)) {
    router.replace('/signup')
    return
  }
  if (isSignup && signupLead.value) {
    showPrereq.value = true
  }
})

function orderCard(cardName, cardType) {
  toastName.value = cardName
  toastVisible.value = true
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastVisible.value = false }, 2500)

  const p = loadProfile()
  const lead = signupLead.value || {}
  const kind = cardType === 'table' ? 'Table / on-site NFC card' : 'Personal NFC business card'
  const subject = encodeURIComponent('Order ' + kind + ' – ' + cardName)
  const body = encodeURIComponent(
    'Hi,\n\nI would like to order the ' + cardName + ' (' + kind + ').\n\n' +
    'Name: ' + (lead.name || p.name || '') + '\n' +
    'Cell: ' + (lead.cell || p.phone || '') + '\n' +
    'Email: ' + (lead.email || p.email || '') + '\n' +
    'Card type: ' + cardType + '\n\nThanks!'
  )
  window.location.href = 'mailto:orders@tap-na.com?subject=' + subject + '&body=' + body
}
</script>

<template>
  <div class="min-h-screen flex flex-col items-center overflow-x-hidden">
    <PageBanner />
    <main class="w-full max-w-md min-h-screen flex flex-col relative z-10 pb-28">
      <div class="h-[160px] shrink-0" aria-hidden="true" />
      <div class="page-sheet rounded-t-3xl px-6 pt-6 space-y-6 flex-1">
        <header class="pb-1">
          <BrandMark size="sm" class="mb-3" />
          <h1 class="text-2xl font-bold tracking-tight">NFC Cards</h1>
          <p class="text-gray-400 text-sm mt-1">Personal cards or on-site Table cards</p>
        </header>

        <div
          v-if="showPrereq"
          class="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3"
        >
          <div class="flex items-start gap-3">
            <span class="material-symbols-outlined text-amber-400 text-[22px]">info</span>
            <div class="min-w-0">
              <p class="text-amber-300 text-sm font-semibold">
                Almost there, {{ (signupLead?.name || 'friend').split(' ')[0] }}
              </p>
              <p class="text-amber-200/70 text-xs mt-0.5 leading-relaxed">
                Choose a card below to complete signup. An NFC card is required before your digital profile goes live.
              </p>
            </div>
          </div>
        </div>

        <section class="space-y-3">
          <h2 class="text-xs font-semibold uppercase tracking-wide text-gray-400">Personal tap cards</h2>
          <p class="text-xs text-gray-500 -mt-1">Digital business cards for individuals</p>

          <article
            v-for="card in personalCardOptions"
            :key="card.id"
            class="card-item-bg rounded-3xl overflow-hidden"
          >
            <div class="bg-zinc-900 px-4 pt-5 pb-3 flex justify-center">
              <img
                :src="personalCardImageSrc(card.id)"
                :alt="`${PERSONAL_TYPES[card.id].label} Connect NFC business card`"
                class="w-full max-w-[280px] h-auto object-contain drop-shadow-xl"
              >
            </div>
            <div class="p-5">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <h3 class="text-lg font-semibold">{{ PERSONAL_TYPES[card.id].label }}</h3>
                  <p class="text-gray-400 text-sm mt-0.5">{{ card.subtitle }}</p>
                </div>
                <span class="shrink-0 text-xs font-medium px-2.5 py-1 rounded-full" :class="card.badgeClass">{{ card.badge }}</span>
              </div>
              <button
                type="button"
                class="mt-4 w-full py-3.5 rounded-full bg-white text-black font-bold text-sm hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                @click="orderCard(PERSONAL_TYPES[card.id].label, 'personal')"
              >
                <span class="material-symbols-outlined text-[18px]">shopping_bag</span>
                Order Mine
              </button>
            </div>
          </article>
        </section>

        <section class="space-y-3 pb-4">
          <h2 class="text-xs font-semibold uppercase tracking-wide text-gray-400">Table NFC tap cards</h2>
          <p class="text-xs text-gray-500 -mt-1">For on-site businesses — logo, menu, reviews &amp; more</p>

          <article class="card-item-bg rounded-3xl overflow-hidden">
            <div class="table-card-visual bg-zinc-900 px-4">
              <img src="/images/table/NFC%20business%20info%20card.png" alt="Table NFC business info card" class="relative z-10 max-h-40 w-auto object-contain mx-auto drop-shadow-lg" />
            </div>
            <div class="p-5">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <h3 class="text-lg font-semibold">Table Edition</h3>
                  <p class="text-gray-400 text-sm mt-0.5">Venue profile for restaurants, cafés &amp; shops</p>
                </div>
                <span class="shrink-0 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300">New</span>
              </div>
              <button type="button" class="mt-4 w-full py-3.5 rounded-full bg-white text-black font-bold text-sm hover:bg-gray-200 transition-colors flex items-center justify-center gap-2" @click="orderCard('Table Edition', 'table')">
                <span class="material-symbols-outlined text-[18px]">shopping_bag</span>
                Order Mine
              </button>
              <RouterLink to="/business" class="mt-3 block text-center text-xs font-semibold text-gray-400 hover:text-white transition-colors">
                Preview business profile →
              </RouterLink>
              <RouterLink to="/table" class="mt-1.5 block text-center text-xs font-semibold text-emerald-400/80 hover:text-emerald-300 transition-colors">
                Browse all Table cards →
              </RouterLink>
            </div>
          </article>
        </section>
      </div>
    </main>

    <div
      v-show="toastVisible"
      class="fixed left-1/2 -translate-x-1/2 bottom-24 z-[60] px-4 py-3 rounded-2xl bg-white text-black text-sm font-medium shadow-xl max-w-xs text-center"
    >
      Order request started for {{ toastName }}
    </div>
  </div>
</template>
