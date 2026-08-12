<script setup>
import { onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import PageBanner from '../components/PageBanner.vue'
import BrandMark from '../components/BrandMark.vue'

onMounted(() => {
  document.title = 'About Us - tap-na'
})
</script>

<template>
  <div class="min-h-screen flex flex-col items-center overflow-x-hidden">
    <PageBanner />
    <main class="w-full max-w-md min-h-screen flex flex-col relative z-10 pb-28">
      <div class="h-[140px] shrink-0" aria-hidden="true" />
      <div class="page-sheet rounded-t-3xl px-6 pt-6 pb-10 space-y-6 flex-1">
        <div class="space-y-3">
          <BrandMark size="md" :to="'/'" />
          <div>
            <h1 class="text-2xl font-bold tracking-tight">About Us</h1>
            <p class="text-sm text-gray-400 mt-1">NFC business cards &amp; digital profiles</p>
          </div>
        </div>

        <section class="card-item-bg rounded-2xl p-5 space-y-3">
          <h2 class="text-lg font-semibold">Tap. Share. Connect Smarter</h2>
          <p class="text-sm text-gray-400 leading-relaxed">
            tap-na makes networking frictionless with NFC business cards and digital profiles.
            Share your details instantly — no typing, no friction.
          </p>
        </section>

        <section class="space-y-3">
          <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-400">What we do</h2>
          <div class="card-item-bg rounded-2xl p-4 flex gap-3">
            <span class="material-symbols-outlined text-2xl">nfc</span>
            <div>
              <p class="font-medium text-sm">Personal NFC cards</p>
              <p class="text-xs text-gray-400 mt-0.5">Tap to open your live digital business card.</p>
            </div>
          </div>
          <div class="card-item-bg rounded-2xl p-4 flex gap-3">
            <span class="material-symbols-outlined text-2xl">table_restaurant</span>
            <div>
              <p class="font-medium text-sm">Vanue Display NFC cards</p>
              <p class="text-xs text-gray-400 mt-0.5">On-site venue profiles with logo, menu &amp; reviews.</p>
            </div>
          </div>
          <div class="card-item-bg rounded-2xl p-4 flex gap-3">
            <span class="material-symbols-outlined text-2xl">qr_code_2</span>
            <div>
              <p class="font-medium text-sm">QR sharing</p>
              <p class="text-xs text-gray-400 mt-0.5">Let anyone scan and save your contact in seconds.</p>
            </div>
          </div>
        </section>

        <RouterLink
          to="/about/business-cards"
          class="block w-full py-4 rounded-full bg-white text-black font-bold text-center text-base hover:bg-gray-200 transition-colors no-underline"
        >
          About Connect cards
        </RouterLink>
        <RouterLink
          to="/"
          class="block w-full py-4 rounded-full bg-zinc-800 text-white font-bold text-center text-base hover:bg-zinc-700 transition-colors no-underline"
        >
          Browse cards
        </RouterLink>
      </div>
    </main>
  </div>
</template>
