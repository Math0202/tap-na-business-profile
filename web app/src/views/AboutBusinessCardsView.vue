<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import ShopHeader from '../components/ShopHeader.vue'
import ShopFooterCredit from '../components/ShopFooterCredit.vue'
import { CONNECT_FEATURE_MATRIX, featureMarkLabel } from '../lib/featureMatrix'

const router = useRouter()
const menuOpen = ref(false)
const featureMatrix = CONNECT_FEATURE_MATRIX
const markLabel = featureMarkLabel

function shopAll() {
  menuOpen.value = false
  router.push({ path: '/', hash: '#business-cards' })
}

onMounted(() => {
  document.documentElement.classList.add('shop-home')
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

    <main class="pt-16 min-h-screen bg-surface pb-10">
      <div class="max-w-3xl mx-auto px-margin-mobile md:px-margin-desktop py-10 flex flex-col gap-14">
        <!-- Hero -->
        <header class="flex flex-col gap-4">
          <p class="font-label-caps text-[11px] uppercase tracking-[0.2em] text-ink-muted">
            Tap Namibia Connect
          </p>
          <h1 class="font-headline-lg-mobile md:font-headline-lg text-[36px] md:text-[48px] leading-[1.1] font-semibold tracking-[-0.02em]">
            NFC business cards in Namibia
          </h1>
          <p class="text-on-surface-variant text-base leading-relaxed max-w-2xl">
            <strong class="text-on-surface font-semibold">Tap - Share:</strong> Phone, Email, Website, Social-links, Products &amp; Services, Get Meeting booking. Connect business cards and Tap NFC cards from tap-na Windhoek.
          </p>
          <div class="flex flex-wrap gap-3 mt-2">
            <button
              type="button"
              class="bg-primary text-on-primary px-8 py-4 font-button-text uppercase tracking-widest hover:opacity-90 transition-opacity"
              @click="shopAll"
            >
              Packages
            </button>
            <a
              href="#how-to-claim"
              class="border border-primary text-primary px-8 py-4 font-button-text uppercase tracking-widest no-underline hover:bg-primary hover:text-on-primary transition-colors"
            >
              On-boarding
            </a>
          </div>
        </header>

        <!-- Why -->
        <section class="flex flex-col gap-5">
          <div class="flex flex-col gap-1">
            <h2 class="font-headline-lg-mobile text-[24px] uppercase font-semibold">Why Connect cards?</h2>
            <div class="h-1 w-12 bg-primary" />
          </div>
         
          <ul class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <li class="bg-surface-container rounded-xl p-4 flex gap-3">
              <span class="material-symbols-outlined text-primary shrink-0">swap_horiz</span>
              <div>
                <p class="font-medium text-sm">Convenience to exchange details</p>
                <p class="text-xs text-on-surface-variant mt-1">Share your contact info instantly with a tap or QR scan.</p>
              </div>
            </li>
            <li class="bg-surface-container rounded-xl p-4 flex gap-3">
              <span class="material-symbols-outlined text-primary shrink-0">badge</span>
              <div>
                <p class="font-medium text-sm">Personal card that is always on you</p>
                <p class="text-xs text-on-surface-variant mt-1">One card in your wallet — ready whenever you meet someone.</p>
              </div>
            </li>
            <li class="bg-surface-container rounded-xl p-4 flex gap-3">
              <span class="material-symbols-outlined text-primary shrink-0">event</span>
              <div>
                <p class="font-medium text-sm">Booking meetings on the go</p>
                <p class="text-xs text-on-surface-variant mt-1">Let people book time with you straight from your profile.</p>
              </div>
            </li>
            <li class="bg-surface-container rounded-xl p-4 flex gap-3">
              <span class="material-symbols-outlined text-primary shrink-0">savings</span>
              <div>
                <p class="font-medium text-sm">Saving time and money</p>
                <p class="text-xs text-on-surface-variant mt-1">Update online instead of reprinting stacks of paper cards.</p>
              </div>
            </li>
            <li class="bg-surface-container rounded-xl p-4 flex gap-3">
              <span class="material-symbols-outlined text-primary shrink-0">inventory_2</span>
              <div>
                <p class="font-medium text-sm">No need to carry a bunch of cards</p>
                <p class="text-xs text-on-surface-variant mt-1">.</p>
              </div>
            </li>
            <li class="bg-surface-container rounded-xl p-4 flex gap-3">
              <span class="material-symbols-outlined text-primary shrink-0">verified</span>
              <div>
                <p class="font-medium text-sm">Professional</p>
                <p class="text-xs text-on-surface-variant mt-1">A modern first impression that matches how you work.</p>
              </div>
            </li>
          </ul>
        </section>

        <!-- How it works -->
        <section class="flex flex-col gap-5">
          <div class="flex flex-col gap-1">
            <h2 class="font-headline-lg-mobile text-[24px] uppercase font-semibold">How connect cards works</h2>
            <div class="h-1 w-12 bg-primary" />
          </div>
          <ol class="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 list-none p-0 m-0">
            <li class="flex flex-col gap-3 sm:text-center bg-surface-container rounded-xl p-5">
              <span class="material-symbols-outlined text-primary text-[32px] sm:mx-auto" aria-hidden="true">contactless</span>
              <p class="font-label-caps text-[12px] uppercase tracking-[0.2em] text-on-surface">Tap</p>
              <p class="text-sm text-on-surface-variant leading-relaxed">
                Hold the card to a phone (NFC) or scan the QR. No app needed for visitors.
              </p>
            </li>
            <li class="flex flex-col gap-3 sm:text-center bg-surface-container rounded-xl p-5">
              <span class="material-symbols-outlined text-primary text-[32px] sm:mx-auto" aria-hidden="true">link</span>
              <p class="font-label-caps text-[12px] uppercase tracking-[0.2em] text-on-surface">Connect</p>
              <p class="text-sm text-on-surface-variant leading-relaxed">
                Their browser opens your live Tap-Na profile instantly — always the latest version.
              </p>
            </li>
            <li class="flex flex-col gap-3 sm:text-center bg-surface-container rounded-xl p-5">
              <span class="material-symbols-outlined text-primary text-[32px] sm:mx-auto" aria-hidden="true">ios_share</span>
              <p class="font-label-caps text-[12px] uppercase tracking-[0.2em] text-on-surface">Share</p>
              <p class="text-sm text-on-surface-variant leading-relaxed">
                They save your digital card, open links, browse your catalogue, or book a meeting.
              </p>
            </li>
          </ol>
        </section>

        <!-- How to claim -->
        <section id="how-to-claim" class="flex flex-col gap-5 scroll-mt-24">
          <div class="flex flex-col gap-1">
            <h2 class="font-headline-lg-mobile text-[24px] uppercase font-semibold">On-board your digital card</h2>
            <div class="h-1 w-12 bg-primary" />
          </div>
          <ol class="space-y-4">
            <li class="flex gap-4">
              <span class="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-label-caps text-xs shrink-0">1</span>
              <p class="text-sm text-on-surface-variant leading-relaxed pt-1">
                Order online. Delivery free in Windhoek within <strong class="text-on-surface">2–4 working days. Courier nationwide</strong>.
              </p>
            </li>
            <li class="flex gap-4">
              <span class="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-label-caps text-xs shrink-0">2</span>
              <p class="text-sm text-on-surface-variant leading-relaxed pt-1">
                Tap the card with your phone (or scan the QR on the card).
              </p>
            </li>
            <li class="flex gap-4">
              <span class="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-label-caps text-xs shrink-0">3</span>
              <p class="text-sm text-on-surface-variant leading-relaxed pt-1">
                You’ll see the <strong class="text-on-surface">On-boarding</strong> screen for your unique card.
              </p>
            </li>
            <li class="flex gap-4">
              <span class="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-label-caps text-xs shrink-0">4</span>
              <p class="text-sm text-on-surface-variant leading-relaxed pt-1">
                Enter your name and create your login (email + password).
              </p>
            </li>
            <li class="flex gap-4">
              <span class="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-label-caps text-xs shrink-0">5</span>
              <p class="text-sm text-on-surface-variant leading-relaxed pt-1">
                Finish your profile — photo, role, links, catalogue, meetings — then you’re live. Every future tap opens your profile.
              </p>
            </li>
          </ol>
        </section>
        <!-- Classes -->
        <section class="flex flex-col gap-5">
          <div class="flex flex-col gap-1">
            <h2 class="font-headline-lg-mobile text-[24px] uppercase font-semibold">Packages</h2>
            <div class="h-1 w-12 bg-primary" />
          </div>
          <div class="flex flex-col gap-4">
            <article class="border border-border-subtle rounded-xl p-5 flex flex-col gap-2">
              <div class="flex items-start justify-between gap-3">
                <h3 class="font-semibold text-lg">Professional</h3>
                <span class="font-label-caps text-[10px] uppercase tracking-widest bg-surface-container px-2 py-1">Solo</span>
              </div>
              <p class="text-sm text-on-surface-variant leading-relaxed">
                For solopreneurs, consultants, and freelancers.
              </p>
            </article>
            <article class="border border-border-subtle rounded-xl p-5 flex flex-col gap-2">
              <div class="flex items-start justify-between gap-3">
                <h3 class="font-semibold text-lg">Business</h3>
                <span class="font-label-caps text-[10px] uppercase tracking-widest bg-primary text-on-primary px-2 py-1">Best Seller</span>
              </div>
              <p class="text-sm text-on-surface-variant leading-relaxed">
                For teams. Meeting booking, share catalogue, team profiles, and company logo(W&amp;B) (charcoal card).
              </p>
            </article>
            <article class="border border-border-subtle rounded-xl p-5 flex flex-col gap-2">
              <div class="flex items-start justify-between gap-3">
                <h3 class="font-semibold text-lg">Executive Exclusive</h3>
                <span class="font-label-caps text-[10px] uppercase tracking-widest bg-surface-charcoal text-on-primary px-2 py-1">Executive</span>
              </div>
              <p class="text-sm text-on-surface-variant leading-relaxed">
                For team leads. Deactivate team profiles, manage company details (1 lead at a time), personal assistant, and stand-in when you’re away.
              </p>
            </article>
          </div>
        </section>

        <!-- Feature matrix -->
        <section class="flex flex-col gap-5">
          <div class="flex flex-col gap-1">
            <h2 class="font-headline-lg-mobile text-[24px] uppercase font-semibold">Features</h2>
            <div class="h-1 w-12 bg-primary" />
          </div>
          <div class="overflow-x-auto -mx-1 px-1 bg-surface-container rounded-xl p-4 md:p-6">
            <table class="w-full min-w-[560px] text-left text-sm border-collapse">
              <thead>
                <tr class="border-b border-border-subtle">
                  <th class="py-3 pr-4 font-label-caps text-[10px] uppercase tracking-widest text-ink-muted font-medium">
                    Feature
                  </th>
                  <th class="py-3 px-2 font-label-caps text-[10px] uppercase tracking-widest text-ink-muted font-medium text-center">
                    Solo
                  </th>
                  <th class="py-3 px-2 font-label-caps text-[10px] uppercase tracking-widest text-ink-muted font-medium text-center">
                    Business
                  </th>
                  <th class="py-3 pl-2 font-label-caps text-[10px] uppercase tracking-widest text-ink-muted font-medium text-center">
                    Executive
                  </th>
                </tr>
              </thead>
              <tbody class="text-on-surface-variant">
                <tr
                  v-for="(row, idx) in featureMatrix"
                  :key="row.feature"
                  :class="idx < featureMatrix.length - 1 ? 'border-b border-border-subtle/70' : ''"
                >
                  <td class="py-3 pr-4 text-on-surface">{{ row.feature }}</td>
                  <td
                    class="py-3 px-2 text-center"
                    :class="row.solo === 'yes' ? 'text-primary' : ''"
                  >{{ markLabel(row.solo) }}</td>
                  <td
                    class="py-3 px-2 text-center"
                    :class="row.business === 'yes' ? 'text-primary' : ''"
                  >{{ markLabel(row.business) }}</td>
                  <td
                    class="py-3 pl-2 text-center"
                    :class="row.executive === 'yes' ? 'text-primary' : ''"
                  >{{ markLabel(row.executive) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- Order -->
        <section class="flex flex-col gap-5">
          <div class="flex flex-col gap-1">
            <h2 class="font-headline-lg-mobile text-[24px] uppercase font-semibold">Ordering &amp; delivery</h2>
            <div class="h-1 w-12 bg-primary" />
          </div>
          <ul class="space-y-2 text-sm text-on-surface-variant leading-relaxed">
            <li>• Fully online store — order on tapnam.com.</li>
            <li>• Solo Cards are readily available, Business & Executive Cards are made on order.</li>
            <li>• Free delivery in Windhoek, Courier nationwide.</li>
            <li>• Delivery: 2–4 working days.</li>
            <li>• Quote on order -> invoice after payment and delivery as agreed with sales.</li>
          </ul>
        </section>

        <!-- FAQ -->
        <section class="flex flex-col gap-5">
          <div class="flex flex-col gap-1">
            <h2 class="font-headline-lg-mobile text-[24px] uppercase font-semibold">FAQ</h2>
            <div class="h-1 w-12 bg-primary" />
          </div>
          <div class="space-y-4">
            <div>
              <p class="font-medium text-sm">1. Are there other fees?</p>
              <p class="text-sm text-on-surface-variant mt-1 leading-relaxed">
                No. The card is a once-off purchase. Order a replacement only if a card is lost or damaged.
              </p>
            </div>
            <div>
              <p class="font-medium text-sm">2. Can I customise Professional?</p>
              <p class="text-sm text-on-surface-variant mt-1 leading-relaxed">
                No — Professional is a standard pack. Choose Business or Executive for company logo branding in B&amp;W.
              </p>
            </div>
            <div>
              <p class="font-medium text-sm">3. What if a phone has no NFC?</p>
              <p class="text-sm text-on-surface-variant mt-1 leading-relaxed">Use the QR code on the card.</p>
            </div>
            <div>
              <p class="font-medium text-sm">4. Who else uses Tap-Na?</p>
              <p class="text-sm text-on-surface-variant mt-1 leading-relaxed">
                We don’t disclose client names for privacy and security.
              </p>
            </div>
          </div>
        </section>

        <!-- CTA -->
        <section class="bg-surface-charcoal text-on-primary rounded-xl p-8 flex flex-col gap-4">
          <h2 class="text-2xl font-semibold leading-tight">Ready for your digital business card?</h2>
          
          <button
            type="button"
            class="self-start bg-surface-container-lowest text-primary px-8 py-4 font-button-text uppercase tracking-widest hover:opacity-90 transition-opacity"
            @click="shopAll"
          >
            View packages | Order now
          </button>
        </section>

        <p class="text-center">
          <RouterLink to="/about" class="text-sm text-ink-muted no-underline hover:text-primary">
            About Tap-Na
          </RouterLink>
        </p>
        <ShopFooterCredit />
      </div>
    </main>
  </div>
</template>

<style>
html.shop-home,
html.shop-home body {
  background-color: #f9f9f9 !important;
  color: #1a1c1c;
}
</style>
