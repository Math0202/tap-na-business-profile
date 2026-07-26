<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageBanner from '../components/PageBanner.vue'
import LinkRow from '../components/LinkRow.vue'
import SecurityMarquee from '../components/SecurityMarquee.vue'
import ShareQrModal from '../components/ShareQrModal.vue'
import {
  loadPublicProfile,
  loadProfile,
  clearViewedProfile,
  avatarUrl,
  displayName,
  isProfileDeleted,
  isProfileDisabled,
  resolveSocialUrl,
  isLoggedIn
} from '../lib/profileStore'
import { downloadVcard, profileShareUrl, youtubeEmbedUrl } from '../lib/shareHelpers'
import { preferredShareSlug } from '../lib/cardLinkStore'
import { trackVisit, trackShare, trackClick, LOCAL_ID } from '../lib/adminStore'

const route = useRoute()
const router = useRouter()

const profile = ref(loadPublicProfile())
const shareOpen = ref(false)
const videoOpen = ref(false)
const shareModal = ref(null)
const videoEl = ref(null)
const embedSrc = ref('')
const useEmbed = ref(false)

const deleted = computed(() => isProfileDeleted(profile.value))
const disabled = computed(() => isProfileDisabled(profile.value))
const name = computed(() => displayName(profile.value))
const nameDisplay = computed(() => formatWrappedName(name.value))
const title = computed(() => {
  if (deleted.value) return 'Create your profile'
  return String(profile.value.title || '').trim()
})
const company = computed(() => (deleted.value ? '' : String(profile.value.company || '').trim()))
const avatar = computed(() => avatarUrl(profile.value))
const actionsBlocked = computed(() => disabled.value || deleted.value)
const hasVideo = computed(
  () => !deleted.value && !disabled.value && !!(profile.value.video && String(profile.value.video).trim())
)

/** Break long names onto two lines; hyphenate very long first/last names mid-word. */
function formatWrappedName(full) {
  const raw = String(full || '').trim()
  if (!raw) return 'No profile'
  const softBreak = (part, max = 12) => {
    if (part.length <= max) return part
    const mid = Math.ceil(part.length / 2)
    return `${part.slice(0, mid)}-\n${part.slice(mid)}`
  }
  const parts = raw.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${softBreak(parts[0])}\n${softBreak(parts.slice(1).join(' '))}`
  }
  return softBreak(parts[0], 14)
}

function filledHref(value, network) {
  if (deleted.value || !String(value || '').trim()) return ''
  return linkHref(value, network)
}

const shareCopy = computed(() => {
  if (deleted.value) return 'Create a profile first, then share your QR code.'
  if (disabled.value) return 'This card is disabled. Enable it in Profile to share again.'
  const first = (profile.value.name || '').split(' ')[0] || 'this'
  return `Scan this QR code to open ${first}'s digital business card.`
})

const shareSlug = computed(() => {
  const p = profile.value
  return (
    p.shareSlug ||
    preferredShareSlug(p.remoteProfileId || p.id || LOCAL_ID, { cardType: p.cardType }) ||
    preferredShareSlug(LOCAL_ID, { cardType: p.cardType })
  )
})

const shareUrl = computed(() =>
  profileShareUrl(shareSlug.value, undefined, { cardType: profile.value.cardType || 'personal' })
)

const shareText = computed(() => {
  const n = profile.value.name || 'this digital business card'
  return `Check out ${n}'s digital business card:`
})

function linkHref(value, network) {
  if (disabled.value || !value) return ''
  if (network === 'phone') return 'tel:' + value
  if (network === 'email') return 'mailto:' + value
  return resolveSocialUrl(network, value)
}

function refresh() {
  // /me always shows the logged-in owner's profile (not a tapped card)
  if (route.path === '/me' && isLoggedIn()) {
    clearViewedProfile()
    profile.value = loadProfile()
  } else {
    profile.value = loadPublicProfile()
  }
  document.title = deleted.value
    ? 'Digital Business Card'
    : (profile.value.name + ' - Digital Business Card')
}

function openShare() {
  if (actionsBlocked.value) {
    router.push(isLoggedIn() ? '/profile' : { path: '/login', query: { next: '/profile' } })
    return
  }
  trackClick(LOCAL_ID, 'share_open', 'Share / QR button')
  shareOpen.value = true
}

function downloadQr() {
  if (actionsBlocked.value) {
    router.push('/profile')
    return
  }
  trackClick(LOCAL_ID, 'download_qr', 'Download QR')
  shareOpen.value = true
  setTimeout(() => shareModal.value?.downloadQr(), 80)
}

function saveContact() {
  if (deleted.value || disabled.value || !profile.value.name) {
    router.push('/profile')
    return
  }
  trackClick(LOCAL_ID, 'save_contact', 'Save contact')
  const parts = profile.value.name.trim().split(/\s+/)
  const first = parts[0] || ''
  const last = parts.slice(1).join(' ') || ''
  downloadVcard(profile.value.name.replace(/\s+/g, '_') + '.vcf', [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'FN:' + profile.value.name,
    'N:' + last + ';' + first + ';;;',
    'TITLE:' + (profile.value.title || ''),
    'ORG:' + (profile.value.company || ''),
    profile.value.phone ? 'TEL;TYPE=CELL:' + profile.value.phone : '',
    profile.value.email ? 'EMAIL:' + profile.value.email : '',
    'URL:' + shareUrl.value,
    'NOTE:Digital business card',
    'END:VCARD'
  ])
}

function openVideo() {
  if (!profile.value.video || disabled.value || deleted.value) return
  trackClick(LOCAL_ID, 'play_video', 'Play video')
  const src = String(profile.value.video).trim()
  const yt = youtubeEmbedUrl(src)
  if (yt) {
    useEmbed.value = true
    embedSrc.value = yt
  } else {
    useEmbed.value = false
    embedSrc.value = ''
    if (videoEl.value) {
      videoEl.value.src = src
    }
  }
  videoOpen.value = true
}

function onLinkTrack(key, label) {
  trackClick(LOCAL_ID, key, label)
}

function onShareChannel(channel) {
  trackShare(LOCAL_ID, channel)
}

function onCopyLink() {
  trackShare(LOCAL_ID, 'copy link')
  trackClick(LOCAL_ID, 'copy_link', 'Copy link')
}

function onQrDownload() {
  trackClick(LOCAL_ID, 'download_qr', 'Download QR')
}

function closeVideo() {
  videoOpen.value = false
  embedSrc.value = ''
  if (videoEl.value) {
    videoEl.value.pause()
    videoEl.value.removeAttribute('src')
    videoEl.value.load()
  }
}

function onKeydown(e) {
  if (e.key === 'Escape') {
    shareOpen.value = false
    closeVideo()
  }
}

onMounted(() => {
  refresh()
  if (!deleted.value && !disabled.value) trackVisit(LOCAL_ID)
  window.openShareProfile = openShare
  document.addEventListener('keydown', onKeydown)
  if (route.hash === '#share') openShare()
})

onUnmounted(() => {
  if (window.openShareProfile === openShare) {
    delete window.openShareProfile
  }
  document.removeEventListener('keydown', onKeydown)
})

watch(() => route.hash, (hash) => {
  if (hash === '#share') openShare()
})

watch(() => route.path, () => {
  refresh()
})
</script>

<template>
  <div class="min-h-screen flex flex-col items-center overflow-x-hidden">
    <PageBanner />
    <main class="w-full max-w-md min-h-screen flex flex-col relative z-10 pb-20">
      <section class="relative w-full">
        <div class="w-full h-[160px]" aria-hidden="true" />
        <div class="absolute top-4 left-4 right-4 flex justify-end items-start z-20">
          <button
            v-show="hasVideo"
            type="button"
            aria-label="Play profile video"
            class="p-2 rounded-full bg-black/20"
            @click="openVideo"
          >
            <span class="material-symbols-outlined">play_circle</span>
          </button>
        </div>
        <div class="px-6 -mt-10 relative">
          <div class="flex items-end gap-4">
            <div class="profile-avatar w-36 h-36 rounded-full overflow-hidden shadow-xl shrink-0 border-[3px]">
              <img :src="avatar" alt="Portrait" class="w-full h-full object-cover" />
            </div>
            <div class="pb-2 flex-1 min-w-0">
              <h1 class="text-xl font-bold tracking-tight whitespace-pre-line break-words leading-tight" :title="name">
                {{ nameDisplay }}
              </h1>
              <p
                v-if="title"
                class="text-gray-400 text-sm font-medium mt-0.5 break-words"
                :title="title"
              >
                {{ title }}
              </p>
              <p
                v-if="company"
                class="text-gray-500 text-sm mt-0.5 break-words"
                :title="company"
              >
                {{ company }}
              </p>
              <div class="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Download QR code"
                  class="w-9 h-9 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors border border-zinc-700"
                  :class="{ 'opacity-40 pointer-events-none': actionsBlocked }"
                  :disabled="actionsBlocked"
                  @click="downloadQr"
                >
                  <span class="material-symbols-outlined text-[18px]">download</span>
                </button>
                <button
                  type="button"
                  aria-label="Share profile"
                  class="w-9 h-9 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors border border-zinc-700"
                  :class="{ 'opacity-40 pointer-events-none': actionsBlocked }"
                  :disabled="actionsBlocked"
                  @click="openShare"
                >
                  <span class="material-symbols-outlined text-[18px]">qr_code_2</span>
                </button>
                <button
                  type="button"
                  aria-label="Save contact"
                  class="w-9 h-9 rounded-full bg-white text-black hover:bg-gray-200 flex items-center justify-center transition-colors"
                  :class="{ 'opacity-40 pointer-events-none': actionsBlocked }"
                  :disabled="actionsBlocked"
                  @click="saveContact"
                >
                  <span class="material-symbols-outlined text-[18px]">person_add</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div class="page-sheet flex-1 mt-6">
        <div
          v-if="disabled"
          class="mx-6 mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3"
        >
          <div class="flex items-start gap-3">
            <span class="material-symbols-outlined text-amber-400 text-[22px]">pause_circle</span>
            <div class="min-w-0">
              <p class="text-amber-300 text-sm font-semibold">Card disabled</p>
              <p class="text-amber-200/70 text-xs mt-0.5">Your public card is hidden. Enable it again in Profile settings.</p>
              <RouterLink to="/profile" class="inline-block mt-2 text-xs font-semibold text-amber-300 underline underline-offset-2">
                Manage card status
              </RouterLink>
            </div>
          </div>
        </div>

        <section
          class="px-6 space-y-3"
          :class="{ 'opacity-40 pointer-events-none': disabled }"
        >
          <LinkRow v-if="filledHref(profile.phone, 'phone')" icon="phone" label="Number" track-key="phone" :href="filledHref(profile.phone, 'phone')" @track="onLinkTrack" />
          <LinkRow v-if="filledHref(profile.email, 'email')" icon="email" label="Email" track-key="email" :href="filledHref(profile.email, 'email')" @track="onLinkTrack" />
          <LinkRow v-if="filledHref(profile.whatsapp, 'whatsapp')" icon="whatsapp" label="WhatsApp" track-key="whatsapp" :href="filledHref(profile.whatsapp, 'whatsapp')" :external="true" @track="onLinkTrack" />
          <LinkRow v-if="filledHref(profile.linkedin, 'linkedin')" icon="linkedin" label="LinkedIn" track-key="linkedin" :href="filledHref(profile.linkedin, 'linkedin')" :external="true" @track="onLinkTrack" />
          <LinkRow v-if="filledHref(profile.youtube, 'youtube')" icon="youtube" label="YouTube" track-key="youtube" :href="filledHref(profile.youtube, 'youtube')" :external="true" @track="onLinkTrack" />
          <LinkRow v-if="filledHref(profile.x, 'x')" icon="x" label="X" track-key="x" :href="filledHref(profile.x, 'x')" :external="true" @track="onLinkTrack" />
          <LinkRow v-if="filledHref(profile.instagram, 'instagram')" icon="instagram" label="Instagram" track-key="instagram" :href="filledHref(profile.instagram, 'instagram')" :external="true" @track="onLinkTrack" />
          <LinkRow v-if="filledHref(profile.tiktok, 'tiktok')" icon="tiktok" label="TikTok" track-key="tiktok" :href="filledHref(profile.tiktok, 'tiktok')" :external="true" @track="onLinkTrack" />
          <LinkRow v-if="filledHref(profile.website, 'website')" icon="website" label="Website" track-key="website" :href="filledHref(profile.website, 'website')" :external="true" @track="onLinkTrack" />
        </section>

        <div class="px-6 mt-8 mb-4">
          <button
            type="button"
            class="w-full py-4 rounded-full bg-white text-black font-bold text-lg hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
            :class="{ 'opacity-40 pointer-events-none': actionsBlocked }"
            :disabled="actionsBlocked"
            @click="saveContact"
          >
            <span class="material-symbols-outlined">person_add</span>
            Save Contact
          </button>
        </div>
        <SecurityMarquee />
      </div>
    </main>

    <ShareQrModal
      ref="shareModal"
      :open="shareOpen"
      title="Share Profile"
      :copy-text="shareCopy"
      :share-text="shareText"
      :share-url="shareUrl"
      :file-base-name="profile.name || 'Profile'"
      @close="shareOpen = false"
      @share="onShareChannel"
      @copy="onCopyLink"
      @download="onQrDownload"
    />

    <div
      v-if="videoOpen"
      class="fixed inset-0 z-[100] flex items-center justify-center p-4"
    >
      <div class="absolute inset-0 bg-black/80" @click="closeVideo" />
      <div class="relative w-full max-w-md card-item-bg rounded-3xl p-4 shadow-2xl">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-lg font-bold">Profile video</h2>
          <button
            type="button"
            aria-label="Close"
            class="w-9 h-9 rounded-full bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center"
            @click="closeVideo"
          >
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <div class="rounded-2xl overflow-hidden bg-black aspect-video">
          <iframe
            v-if="useEmbed"
            :src="embedSrc"
            class="w-full h-full"
            title="Profile video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
          />
          <video v-else ref="videoEl" class="w-full h-full" controls playsinline />
        </div>
      </div>
    </div>
  </div>
</template>
