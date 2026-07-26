<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import PageBanner from '../components/PageBanner.vue'
import BrandMark from '../components/BrandMark.vue'
import LinkRow from '../components/LinkRow.vue'
import ShareQrModal from '../components/ShareQrModal.vue'
import {
  loadPublicProfile,
  logoUrl,
  isProfileDeleted,
  isProfileDisabled,
  resolveSocialUrl,
  isLoggedIn
} from '../lib/profileStore'
import { downloadVcard, profileShareUrl } from '../lib/shareHelpers'
import { preferredShareSlug } from '../lib/cardLinkStore'
import { trackVisit, trackShare, trackClick, LOCAL_ID } from '../lib/adminStore'

const router = useRouter()
const profile = ref(loadPublicProfile())
const shareOpen = ref(false)
const shareModal = ref(null)

const deleted = computed(() => isProfileDeleted(profile.value))
const disabled = computed(() => isProfileDisabled(profile.value))
const venueName = computed(
  () => profile.value.company || profile.value.name || 'Venue'
)
const name = computed(() => (deleted.value ? 'Business profile' : venueName.value))
const tagline = computed(() =>
  deleted.value
    ? 'Set up your venue'
    : (profile.value.title || profile.value.name || 'On-site venue')
)
const logo = computed(() => logoUrl(profile.value))
const actionsBlocked = computed(() => disabled.value || deleted.value)

const shareCopy = computed(() => {
  if (deleted.value) return 'Create a venue profile first, then share your QR code.'
  if (disabled.value) return 'This venue is disabled. Enable it in Profile to share again.'
  return 'Scan this QR code to open ' + name.value + '.'
})

const shareSlug = computed(() => {
  const p = profile.value
  return (
    p.shareSlug ||
    preferredShareSlug(p.remoteProfileId || p.id || LOCAL_ID, { cardType: 'table' }) ||
    preferredShareSlug(LOCAL_ID, { cardType: 'table' })
  )
})

const shareUrl = computed(() =>
  profileShareUrl(shareSlug.value, undefined, { cardType: 'table' })
)

function hrefOrEmpty(value, network) {
  if (actionsBlocked.value || !value) return ''
  if (network === 'phone') return 'tel:' + value
  if (network === 'email') return 'mailto:' + value
  return resolveSocialUrl(network === 'menu' || network === 'review' || network === 'site' ? 'website' : network, value)
}

const checkInHref = computed(() => {
  if (actionsBlocked.value) return ''
  if (profile.value.checkInUrl) return resolveSocialUrl('website', profile.value.checkInUrl)
  return '/checkin'
})

const feedbackHref = computed(() => {
  if (actionsBlocked.value) return ''
  if (profile.value.feedbackUrl) return resolveSocialUrl('website', profile.value.feedbackUrl)
  return '/feedback'
})

const checkInExternal = computed(() => /^https?:/i.test(checkInHref.value))
const feedbackExternal = computed(() => /^https?:/i.test(feedbackHref.value))

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
  if (deleted.value || disabled.value) {
    router.push('/profile')
    return
  }
  trackClick(LOCAL_ID, 'save_contact', 'Save contact')
  const n = venueName.value
  downloadVcard(n.replace(/\s+/g, '_') + '.vcf', [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'FN:' + n,
    'ORG:' + (profile.value.company || n),
    'TITLE:' + (profile.value.title || ''),
    profile.value.phone ? 'TEL;TYPE=WORK:' + profile.value.phone : '',
    profile.value.email ? 'EMAIL:' + profile.value.email : '',
    profile.value.website ? 'URL:' + resolveSocialUrl('website', profile.value.website) : '',
    profile.value.address
      ? 'ADR;TYPE=WORK:;;' + profile.value.address.replace(/,/g, '\\,') + ';;;;'
      : '',
    'URL:' + shareUrl.value,
    'NOTE:tap-na Table venue profile',
    'END:VCARD'
  ])
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

function onKeydown(e) {
  if (e.key === 'Escape') shareOpen.value = false
}

onMounted(() => {
  profile.value = loadPublicProfile()
  document.title = name.value + ' - tap-na Table'
  if (!deleted.value && !disabled.value) trackVisit(LOCAL_ID)
  window.openShareProfile = openShare
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  if (window.openShareProfile === openShare) delete window.openShareProfile
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="min-h-screen flex flex-col items-center overflow-x-hidden">
    <PageBanner banner-height="200px" />
    <main class="w-full max-w-md min-h-screen flex flex-col relative z-10 pb-28">
      <div class="h-[120px] shrink-0" aria-hidden="true" />
      <div class="page-sheet rounded-t-3xl px-6 pt-0 pb-10 flex-1">
        <div class="flex flex-col items-center -mt-12 mb-6 text-center">
          <img :src="logo" class="biz-logo" alt="Business logo" />
          <h1 class="mt-4 text-2xl font-bold tracking-tight max-w-[90%] truncate">{{ name }}</h1>
          <p class="text-gray-400 text-sm mt-1 max-w-[90%] truncate">{{ tagline }}</p>
          <p
            v-if="profile.address && !deleted"
            class="text-gray-500 text-xs mt-1 max-w-[90%] truncate"
          >
            {{ profile.address }}
          </p>
          <div class="mt-3 flex items-center justify-center gap-2">
            <button
              type="button"
              aria-label="Download QR code"
              class="w-9 h-9 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center border border-zinc-700"
              :class="{ 'opacity-40 pointer-events-none': actionsBlocked }"
              :disabled="actionsBlocked"
              @click="downloadQr"
            >
              <span class="material-symbols-outlined text-[18px]">download</span>
            </button>
            <button
              type="button"
              aria-label="Share profile"
              class="w-9 h-9 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center border border-zinc-700"
              :class="{ 'opacity-40 pointer-events-none': actionsBlocked }"
              :disabled="actionsBlocked"
              @click="openShare"
            >
              <span class="material-symbols-outlined text-[18px]">qr_code_2</span>
            </button>
            <button
              type="button"
              aria-label="Save contact"
              class="w-9 h-9 rounded-full bg-white text-black hover:bg-gray-200 flex items-center justify-center"
              :class="{ 'opacity-40 pointer-events-none': actionsBlocked }"
              :disabled="actionsBlocked"
              @click="saveContact"
            >
              <span class="material-symbols-outlined text-[18px]">person_add</span>
            </button>
          </div>
          <RouterLink
            v-if="isLoggedIn()"
            to="/venue"
            class="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold text-gray-400 hover:text-white no-underline"
          >
            <span class="material-symbols-outlined text-[16px]">analytics</span>
            Venue dashboard
          </RouterLink>
        </div>

        <div
          v-if="disabled"
          class="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3"
        >
          <p class="text-amber-300 text-sm font-semibold">Profile disabled</p>
          <p class="text-amber-200/70 text-xs mt-0.5">This venue profile is temporarily hidden.</p>
        </div>

        <section class="space-y-3" :class="{ 'opacity-40 pointer-events-none': disabled }">
          <LinkRow icon="phone" label="Number" track-key="phone" :href="hrefOrEmpty(profile.phone, 'phone')" @track="onLinkTrack" />
          <LinkRow icon="email" label="Email" track-key="email" :href="hrefOrEmpty(profile.email, 'email')" @track="onLinkTrack" />
          <LinkRow icon="whatsapp" label="WhatsApp" track-key="whatsapp" :href="hrefOrEmpty(profile.whatsapp, 'whatsapp')" :external="true" @track="onLinkTrack" />
          <LinkRow icon="website" label="Website" track-key="website" :href="hrefOrEmpty(profile.website, 'website')" :external="true" @track="onLinkTrack" />
          <LinkRow icon="menu" label="Menu" track-key="menu" :href="hrefOrEmpty(profile.menuUrl, 'menu')" :external="true" @track="onLinkTrack" />
          <LinkRow icon="review" label="Google review" track-key="review" :href="hrefOrEmpty(profile.googleReview, 'review')" :external="true" @track="onLinkTrack" />
          <LinkRow icon="checkin" label="Events check-in" track-key="checkin" :href="checkInHref" :external="checkInExternal" @track="onLinkTrack" />
          <LinkRow icon="feedback" label="Feedback" track-key="feedback" :href="feedbackHref" :external="feedbackExternal" @track="onLinkTrack" />
          <LinkRow icon="instagram" label="Instagram" track-key="instagram" :href="hrefOrEmpty(profile.instagram, 'instagram')" :external="true" @track="onLinkTrack" />
          <LinkRow icon="tiktok" label="TikTok" track-key="tiktok" :href="hrefOrEmpty(profile.tiktok, 'tiktok')" :external="true" @track="onLinkTrack" />
        </section>

        <div class="mt-10 flex flex-col items-center gap-1">
          <BrandMark size="sm" to="/about" />
          <p class="text-center text-[10px] uppercase tracking-[0.2em] text-gray-600">Table</p>
        </div>
      </div>
    </main>

    <ShareQrModal
      ref="shareModal"
      :open="shareOpen"
      title="Share venue"
      :copy-text="shareCopy"
      :share-text="'Check out ' + venueName + ' on tap-na:'"
      :share-url="shareUrl"
      :file-base-name="venueName"
      copy-link-label="Copy venue link"
      @close="shareOpen = false"
      @share="onShareChannel"
      @copy="onCopyLink"
      @download="onQrDownload"
    />
  </div>
</template>
