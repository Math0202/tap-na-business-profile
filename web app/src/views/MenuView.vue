<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import BrandMark from '../components/BrandMark.vue'
import {
  loadPublicProfile,
  normalizeMenuImages,
  hasMenuContent
} from '../lib/profileStore'

const profile = ref(loadPublicProfile())
const page = ref(0)

const venue = computed(() => profile.value.company || profile.value.name || 'Menu')
const pdf = computed(() => String(profile.value.menuPdf || '').trim())
const images = computed(() => normalizeMenuImages(profile.value.menuImages))
const link = computed(() => String(profile.value.menuUrl || '').trim())
const hasContent = computed(() => hasMenuContent(profile.value))
const currentImage = computed(() => images.value[page.value] || '')

onMounted(() => {
  profile.value = loadPublicProfile()
  document.title = venue.value + ' · Menu'
  if (!pdf.value && images.value.length === 0 && link.value) {
    const href = /^https?:\/\//i.test(link.value) ? link.value : ('https://' + link.value)
    window.location.replace(href)
  }
})

function prevPage() {
  if (page.value > 0) page.value -= 1
}

function nextPage() {
  if (page.value < images.value.length - 1) page.value += 1
}
</script>

<template>
  <main class="w-full max-w-md min-h-screen mx-auto flex flex-col relative pb-24">
    <header class="px-6 pt-14 pb-4 flex items-center gap-3">
      <RouterLink
        to="/business"
        class="w-10 h-10 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center no-underline text-inherit"
        aria-label="Back"
      >
        <span class="material-symbols-outlined">arrow_back</span>
      </RouterLink>
      <div class="min-w-0 flex-1">
        <h1 class="text-xl font-bold tracking-tight truncate">Menu</h1>
        <p class="text-gray-400 text-xs truncate">{{ venue }}</p>
      </div>
      <BrandMark size="sm" />
    </header>

    <div v-if="!hasContent" class="px-6 py-16 text-center space-y-3">
      <span class="material-symbols-outlined text-4xl text-gray-500">restaurant_menu</span>
      <p class="text-sm text-gray-400">No menu has been uploaded yet.</p>
      <RouterLink to="/business" class="text-sm font-semibold underline">Back to profile</RouterLink>
    </div>

    <div v-else class="px-4 flex-1 flex flex-col gap-4">
      <div v-if="pdf" class="card-item-bg rounded-2xl overflow-hidden flex flex-col min-h-[70vh]">
        <iframe
          :src="pdf"
          title="Menu PDF"
          class="w-full flex-1 min-h-[70vh] bg-white"
        />
        <a
          :href="pdf"
          target="_blank"
          rel="noopener noreferrer"
          class="block text-center text-sm font-semibold py-3 border-t border-[var(--border)] no-underline text-inherit"
        >
          Open PDF
        </a>
      </div>

      <div v-if="images.length" class="space-y-3">
        <div class="card-item-bg rounded-2xl overflow-hidden">
          <img
            :src="currentImage"
            alt="Menu page"
            class="w-full h-auto object-contain bg-black/20 max-h-[75vh]"
          />
        </div>
        <div class="flex items-center justify-between gap-3 px-1">
          <button
            type="button"
            class="w-11 h-11 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center disabled:opacity-30"
            :disabled="page === 0"
            aria-label="Previous page"
            @click="prevPage"
          >
            <span class="material-symbols-outlined">chevron_left</span>
          </button>
          <p class="text-sm text-gray-400">
            Page {{ page + 1 }} / {{ images.length }}
          </p>
          <button
            type="button"
            class="w-11 h-11 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center disabled:opacity-30"
            :disabled="page >= images.length - 1"
            aria-label="Next page"
            @click="nextPage"
          >
            <span class="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
        <div class="flex gap-2 overflow-x-auto pb-1">
          <button
            v-for="(img, i) in images"
            :key="img + '-' + i"
            type="button"
            class="shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2"
            :class="i === page ? 'border-white' : 'border-transparent opacity-70'"
            @click="page = i"
          >
            <img :src="img" alt="" class="w-full h-full object-cover" />
          </button>
        </div>
      </div>

      <a
        v-if="link && (pdf || images.length)"
        :href="link.startsWith('http') ? link : ('https://' + link)"
        target="_blank"
        rel="noopener noreferrer"
        class="card-item-bg rounded-2xl p-4 flex items-center gap-3 no-underline text-inherit"
      >
        <span class="material-symbols-outlined">link</span>
        <span class="text-sm font-medium flex-1 truncate">Online menu link</span>
        <span class="material-symbols-outlined text-gray-500">open_in_new</span>
      </a>
    </div>
  </main>
</template>