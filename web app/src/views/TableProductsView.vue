<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import PageBanner from '../components/PageBanner.vue'
import BrandMark from '../components/BrandMark.vue'

const SIGNUP_KEY = 'tapna_signup_lead'
const route = useRoute()
const router = useRouter()

const signupLead = ref(null)
const showPrereq = ref(false)
const toastVisible = ref(false)
const toastName = ref('')
let toastTimer = null

const products = [
  {
    name: 'Business Info',
    desc: 'Tap for venue profile · contact & socials',
    src: '/images/table/NFC%20business%20info%20card.png',
    alt: 'NFC business info card',
    preview: true
  },
  {
    name: 'Menu',
    desc: 'Tap phone to view menu',
    src: '/images/table/NFC%20-%20Menu.png',
    alt: 'NFC menu card'
  },
  {
    name: 'Custom Menu',
    desc: 'Branded menu tap card for your venue',
    src: '/images/table/NFC%20custom%20menu%20card.png',
    alt: 'NFC custom menu card'
  },
  {
    name: 'Google Review',
    desc: 'Tap to leave a Google review',
    src: '/images/table/NFC%20business%20review%20card.png',
    alt: 'NFC Google review card'
  },
  {
    name: 'WiFi & Contact',
    desc: 'Tap to connect · WiFi & contact details',
    src: '/images/table/NFC%20wifi%20and%20conact%20card.png',
    alt: 'NFC WiFi and contact card'
  }
]

onMounted(() => {
  document.title = 'Table NFC Tap Cards - tap-na'
  const isSignup = route.query.signup === '1'
  try {
    signupLead.value = JSON.parse(sessionStorage.getItem(SIGNUP_KEY) || 'null')
  } catch {
    signupLead.value = null
  }
  if (isSignup && (!signupLead.value?.name || !signupLead.value?.cell || !signupLead.value?.email)) {
    router.replace({ path: '/signup', query: { type: 'table' } })
    return
  }
  if (isSignup && signupLead.value) showPrereq.value = true
})

function orderCard(cardName) {
  const lead = signupLead.value || {}
  const subject = encodeURIComponent('Order Table / on-site NFC card – ' + cardName)
  const body = encodeURIComponent(
    'Hi tap-na,\n\nI would like to order: ' + cardName + ' (Table NFC Tap Card).\n\n' +
    'Name: ' + (lead.name || '') + '\n' +
    'Cell: ' + (lead.cell || '') + '\n' +
    'Email: ' + (lead.email || '') + '\n'
  )
  window.location.href = 'mailto:orders@tap-na.com?subject=' + subject + '&body=' + body

  toastName.value = cardName
  toastVisible.value = true
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastVisible.value = false }, 3200)
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
          <h1 class="text-2xl font-bold tracking-tight">Table NFC Tap Cards</h1>
          <p class="text-gray-400 text-sm mt-1">On-site cards for menus, info, reviews &amp; WiFi</p>
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
                Choose a Table card below to complete signup. An NFC card is required before your venue profile goes live.
              </p>
            </div>
          </div>
        </div>

        <section class="space-y-4 pb-4">
          <article
            v-for="product in products"
            :key="product.name"
            class="card-item-bg rounded-3xl overflow-hidden"
          >
            <div class="product-visual px-4 py-4">
              <img :src="product.src" :alt="product.alt" />
            </div>
            <div class="p-5">
              <h3 class="text-lg font-semibold">{{ product.name }}</h3>
              <p class="text-gray-400 text-sm mt-0.5">{{ product.desc }}</p>
              <button
                type="button"
                class="mt-4 w-full py-3.5 rounded-full bg-white text-black font-bold text-sm hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                @click="orderCard(product.name)"
              >
                <span class="material-symbols-outlined text-[18px]">shopping_bag</span>
                Order Mine
              </button>
              <RouterLink
                v-if="product.preview"
                to="/business"
                class="mt-3 block text-center text-xs font-semibold text-gray-400 hover:text-white transition-colors"
              >
                Preview business profile →
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
