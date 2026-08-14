<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import ShopHeader from '../components/ShopHeader.vue'
import ShopFooterCredit from '../components/ShopFooterCredit.vue'
import { AUCKMUND_HREF, AUCKMUND_LEGAL_NAME } from '../lib/brandLinks'

const route = useRoute()
const router = useRouter()
const menuOpen = ref(false)
const isPrivacy = computed(() => route.name === 'privacy')

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
      <div class="max-w-3xl mx-auto px-margin-mobile md:px-margin-desktop py-10 flex flex-col gap-10">
        <header class="flex flex-col gap-4">
          <p class="font-label-caps text-[11px] uppercase tracking-[0.2em] text-ink-muted">
            Legal
          </p>
          <h1 class="font-headline-lg-mobile md:font-headline-lg text-[36px] md:text-[48px] leading-[1.1] font-semibold tracking-[-0.02em]">
            {{ isPrivacy ? 'Privacy policy' : 'Terms of use' }}
          </h1>
          <p class="text-on-surface-variant text-base leading-relaxed">
            Last updated 14 August 2026. tap-na (tapnam.com) is a division of
            <a
              :href="AUCKMUND_HREF"
              target="_blank"
              rel="noopener noreferrer"
              class="text-on-surface no-underline hover:opacity-70 font-medium"
            >{{ AUCKMUND_LEGAL_NAME }}</a>,
            Windhoek, Namibia.
          </p>
          <div class="flex flex-wrap gap-4 text-sm">
            <RouterLink
              to="/privacy"
              class="no-underline hover:opacity-70"
              :class="isPrivacy ? 'text-primary font-medium' : 'text-on-surface'"
            >
              Privacy
            </RouterLink>
            <RouterLink
              to="/terms"
              class="no-underline hover:opacity-70"
              :class="!isPrivacy ? 'text-primary font-medium' : 'text-on-surface'"
            >
              Terms
            </RouterLink>
          </div>
        </header>

        <article v-if="isPrivacy" class="flex flex-col gap-8 text-on-surface-variant leading-relaxed">
          <section class="flex flex-col gap-3">
            <h2 class="font-headline-lg-mobile text-[22px] uppercase font-semibold text-on-surface">Who we are</h2>
            <div class="h-1 w-12 bg-primary" />
            <p>
              This policy explains how tap-na collects and uses information when you visit tapnam.com, buy Connect or Venue Display cards, create a digital profile, or contact us.
            </p>
          </section>

          <section class="flex flex-col gap-3">
            <h2 class="font-headline-lg-mobile text-[22px] uppercase font-semibold text-on-surface">What we collect</h2>
            <div class="h-1 w-12 bg-primary" />
            <p>Depending on how you use tap-na, we may collect:</p>
            <ul class="list-disc pl-5 flex flex-col gap-2">
              <li>Order and quote details: name, email, phone, delivery address, and what you ordered.</li>
              <li>Account and profile details you save (name, role, company, photo, links, catalogue, meeting settings).</li>
              <li>Support messages you send through the site, email, or WhatsApp.</li>
              <li>Technical data such as device type, browser, and pages visited.</li>
              <li>Product analytics and session recordings (PostHog), with form fields masked so typed secrets are not stored in replay.</li>
            </ul>
          </section>

          <section class="flex flex-col gap-3">
            <h2 class="font-headline-lg-mobile text-[22px] uppercase font-semibold text-on-surface">How we use it</h2>
            <div class="h-1 w-12 bg-primary" />
            <ul class="list-disc pl-5 flex flex-col gap-2">
              <li>To process orders, invoices, delivery, and card claiming.</li>
              <li>To host the public profile you share when someone taps or scans your card.</li>
              <li>To answer support requests and improve the shop and product.</li>
              <li>To keep the service secure and understand how people use tap-na.</li>
            </ul>
          </section>

          <section class="flex flex-col gap-3">
            <h2 class="font-headline-lg-mobile text-[22px] uppercase font-semibold text-on-surface">Public profiles</h2>
            <div class="h-1 w-12 bg-primary" />
            <p>
              Information you put on a tap-na profile is meant to be shared. Anyone with the link, NFC tap, or QR code can see it. Do not publish details you do not want public.
            </p>
          </section>

          <section class="flex flex-col gap-3">
            <h2 class="font-headline-lg-mobile text-[22px] uppercase font-semibold text-on-surface">Sharing</h2>
            <div class="h-1 w-12 bg-primary" />
            <p>
              We do not sell your personal information. We may share it with service providers who help us run the shop (hosting, email, analytics, payments/invoicing) and when the law requires it. {{ AUCKMUND_LEGAL_NAME }} operates tap-na.
            </p>
          </section>

          <section class="flex flex-col gap-3">
            <h2 class="font-headline-lg-mobile text-[22px] uppercase font-semibold text-on-surface">Your choices</h2>
            <div class="h-1 w-12 bg-primary" />
            <p>
              You can update or delete profile content from your account, or ask us to correct or remove data we hold. Email
              <a href="mailto:welcome@tapnam.com" class="text-on-surface no-underline hover:opacity-70">welcome@tapnam.com</a>
              or use
              <RouterLink to="/support" class="text-on-surface no-underline hover:opacity-70">Support</RouterLink>.
            </p>
          </section>

          <section class="flex flex-col gap-3">
            <h2 class="font-headline-lg-mobile text-[22px] uppercase font-semibold text-on-surface">Contact</h2>
            <div class="h-1 w-12 bg-primary" />
            <p>
              tap-na / {{ AUCKMUND_LEGAL_NAME }}, Windhoek, Namibia.
              Email <a href="mailto:welcome@tapnam.com" class="text-on-surface no-underline hover:opacity-70">welcome@tapnam.com</a>.
            </p>
          </section>
        </article>

        <article v-else class="flex flex-col gap-8 text-on-surface-variant leading-relaxed">
          <section class="flex flex-col gap-3">
            <h2 class="font-headline-lg-mobile text-[22px] uppercase font-semibold text-on-surface">Using tap-na</h2>
            <div class="h-1 w-12 bg-primary" />
            <p>
              These terms cover the tapnam.com shop, Connect cards, Venue Display cards, digital profiles, and related services from tap-na, a division of {{ AUCKMUND_LEGAL_NAME }}.
            </p>
            <p>
              By ordering, creating an account, or using a tap-na profile, you agree to these terms.
            </p>
          </section>

          <section class="flex flex-col gap-3">
            <h2 class="font-headline-lg-mobile text-[22px] uppercase font-semibold text-on-surface">Orders and payment</h2>
            <div class="h-1 w-12 bg-primary" />
            <ul class="list-disc pl-5 flex flex-col gap-2">
              <li>Prices are shown in Namibian dollars unless we say otherwise.</li>
              <li>Orders are confirmed by quote or invoice. Payment is due as stated on the invoice.</li>
              <li>Connect cards are a once-off purchase unless we agree something else in writing.</li>
              <li>Windhoek delivery is free on qualifying shop orders. Other areas are arranged with you.</li>
              <li>Custom-printed cards are made to order and may not be returnable once production has started.</li>
            </ul>
          </section>

          <section class="flex flex-col gap-3">
            <h2 class="font-headline-lg-mobile text-[22px] uppercase font-semibold text-on-surface">Accounts and profiles</h2>
            <div class="h-1 w-12 bg-primary" />
            <p>
              You are responsible for the content on your profile and for keeping login details safe. Profile pages are public when shared by tap, QR, or link. You must have the right to use photos, logos, and text you upload.
            </p>
          </section>

          <section class="flex flex-col gap-3">
            <h2 class="font-headline-lg-mobile text-[22px] uppercase font-semibold text-on-surface">Acceptable use</h2>
            <div class="h-1 w-12 bg-primary" />
            <p>
              Do not use tap-na for unlawful, misleading, or abusive content, or to interfere with the service. We may suspend or remove accounts or profiles that break these terms.
            </p>
          </section>

          <section class="flex flex-col gap-3">
            <h2 class="font-headline-lg-mobile text-[22px] uppercase font-semibold text-on-surface">Our content</h2>
            <div class="h-1 w-12 bg-primary" />
            <p>
              tap-na branding, site design, and product materials belong to {{ AUCKMUND_LEGAL_NAME }}. You keep ownership of content you upload. We may use it only to provide the service.
            </p>
          </section>

          <section class="flex flex-col gap-3">
            <h2 class="font-headline-lg-mobile text-[22px] uppercase font-semibold text-on-surface">Liability</h2>
            <div class="h-1 w-12 bg-primary" />
            <p>
              We provide tap-na with reasonable care. We are not liable for loss caused by how you use a public profile, third-party sites you link to, or events outside our control (including network or device issues when a card is tapped). Our liability for a paid order is limited to the amount you paid for that order.
            </p>
          </section>

          <section class="flex flex-col gap-3">
            <h2 class="font-headline-lg-mobile text-[22px] uppercase font-semibold text-on-surface">Changes and law</h2>
            <div class="h-1 w-12 bg-primary" />
            <p>
              We may update these terms. The latest version is always on this page. Namibian law applies. Contact
              <a href="mailto:welcome@tapnam.com" class="text-on-surface no-underline hover:opacity-70">welcome@tapnam.com</a>
              or
              <RouterLink to="/support" class="text-on-surface no-underline hover:opacity-70">Support</RouterLink>.
            </p>
          </section>
        </article>

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
