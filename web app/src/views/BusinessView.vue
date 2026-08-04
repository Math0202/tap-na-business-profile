<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import PageBanner from '../components/PageBanner.vue'
import BrandMark from '../components/BrandMark.vue'
import LinkRow from '../components/LinkRow.vue'
import ShareQrModal from '../components/ShareQrModal.vue'
import CheckinPopup from '../components/CheckinPopup.vue'
import FeedbackPopup from '../components/FeedbackPopup.vue'
import {
  loadPublicProfile,
  logoUrl,
  isProfileDeleted,
  isProfileDisabled,
  resolveSocialUrl,
  isLoggedIn,
  hasMenuContent,
  menuPageHref,
  normalizeMenuImages
} from '../lib/profileStore'
import { downloadVcard, profileShareUrl, vcardPhotoLine } from '../lib/shareHelpers'
import { preferredShareSlug } from '../lib/cardLinkStore'
import { trackVisit, trackShare, trackClick, LOCAL_ID } from '../lib/adminStore'
import { apiLogCardEvent } from '../lib/api'
import { normalizeLinkOrder, businessLinkDef } from '../lib/businessLinks'
import { normalizeCheckinForm, normalizeFeedbackForm } from '../lib/venueForms'

const route = useRoute()
const router = useRouter()
const profile = ref(loadPublicProfile())
const shareOpen = ref(false)
const shareModal = ref(null)
const activePopup = ref('') // '' | 'checkin' | 'feedback'
const popupQueue = ref([])

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


function filled(value) {
  return !!String(value || '').trim()
}

/** Pretty contact text for the row (not the href). */
function contactDetail(kind, value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (kind === 'phone' || kind === 'email') return raw
  if (kind === 'whatsapp') {
    if (/wa\.me\//i.test(raw)) {
      return raw.replace(/^https?:\/\//i, '').split(/[?#]/)[0]
    }
    const digits = raw.replace(/[^\d]/g, '')
    if (!digits) return raw
    return 'wa.me/' + digits
  }
  if (kind === 'instagram' || kind === 'tiktok' || kind === 'x') {
    let handle = raw
    handle = handle.replace(/^https?:\/\/(www\.)?/i, '')
    handle = handle.replace(/^(instagram\.com|tiktok\.com|x\.com|twitter\.com)\//i, '')
    handle = handle.split(/[/?#]/)[0].replace(/^@/, '')
    return handle ? '@' + handle : raw
  }
  if (kind === 'website' || kind === 'menu' || kind === 'review') {
    return raw.replace(/^https?:\/\//i, '').replace(/\/$/, '')
  }
  return raw
}

function hrefOrEmpty(value, network) {
  if (actionsBlocked.value || !value) return ''
  if (network === 'phone') return 'tel:' + value
  if (network === 'email') return 'mailto:' + value
  return resolveSocialUrl(network === 'menu' || network === 'review' || network === 'site' ? 'website' : network, value)
}

const checkinForm = computed(() => normalizeCheckinForm(profile.value.checkinForm))
const feedbackForm = computed(() => normalizeFeedbackForm(profile.value.feedbackForm))
const popupProfileId = computed(
  () => profile.value.remoteProfileId || profile.value.id || LOCAL_ID
)

function queueVenuePopups() {
  if (actionsBlocked.value) {
    activePopup.value = ''
    popupQueue.value = []
    return
  }
  const p = profile.value
  const q = []
  if (p.showCheckin) q.push('checkin')
  if (p.showFeedback) q.push('feedback')
  popupQueue.value = q
  activePopup.value = q[0] || ''
}

function advancePopup() {
  const q = popupQueue.value.slice(1)
  popupQueue.value = q
  activePopup.value = q[0] || ''
}

const visibleTiles = computed(() => {
  const p = profile.value
  return normalizeLinkOrder(p.linkOrder).map((key) => {
    const def = businessLinkDef(key)
    if (!def) return null
    if (key === 'phone') {
      if (!p.showPhone || !filled(p.phone)) return null
      return {
        ...def,
        detail: contactDetail('phone', p.phone),
        href: hrefOrEmpty(p.phone, 'phone'),
        external: false
      }
    }
    if (key === 'email') {
      if (!p.showEmail || !filled(p.email)) return null
      return {
        ...def,
        detail: contactDetail('email', p.email),
        href: hrefOrEmpty(p.email, 'email'),
        external: false
      }
    }
    if (key === 'whatsapp') {
      if (!filled(p.whatsapp)) return null
      return {
        ...def,
        detail: contactDetail('whatsapp', p.whatsapp),
        href: hrefOrEmpty(p.whatsapp, 'whatsapp'),
        external: true
      }
    }
    if (key === 'website') {
      if (!filled(p.website)) return null
      return {
        ...def,
        detail: contactDetail('website', p.website),
        href: hrefOrEmpty(p.website, 'website'),
        external: true
      }
    }
    if (key === 'menu') {
      if (!hasMenuContent(p)) return null
      const href = menuPageHref(p)
      const images = normalizeMenuImages(p.menuImages)
      const detail = p.menuPdf
        ? 'PDF menu'
        : images.length
          ? images.length + ' page' + (images.length === 1 ? '' : 's')
          : contactDetail('menu', p.menuUrl)
      return {
        ...def,
        detail,
        href,
        external: /^https?:/i.test(href)
      }
    }
    if (key === 'review') {
      if (!filled(p.googleReview)) return null
      return {
        ...def,
        detail: contactDetail('review', p.googleReview),
        href: hrefOrEmpty(p.googleReview, 'review'),
        external: true
      }
    }
    if (key === 'x') {
      if (!filled(p.x)) return null
      return {
        ...def,
        detail: contactDetail('x', p.x),
        href: hrefOrEmpty(p.x, 'x'),
        external: true
      }
    }
    if (key === 'instagram') {
      if (!filled(p.instagram)) return null
      return {
        ...def,
        detail: contactDetail('instagram', p.instagram),
        href: hrefOrEmpty(p.instagram, 'instagram'),
        external: true
      }
    }
    if (key === 'tiktok') {
      if (!filled(p.tiktok)) return null
      return {
        ...def,
        detail: contactDetail('tiktok', p.tiktok),
        href: hrefOrEmpty(p.tiktok, 'tiktok'),
        external: true
      }
    }
    return null
  }).filter(Boolean)
})

function openShare() {
  if (actionsBlocked.value) {
    router.push(isLoggedIn() ? '/profile' : { path: '/login', query: { next: '/profile' } })
    return
  }
  trackClick(LOCAL_ID, 'share_open', 'Share / QR button')
  logRemote('share:open')
  shareOpen.value = true
}

function downloadQr() {
  if (actionsBlocked.value) {
    router.push('/profile')
    return
  }
  trackClick(LOCAL_ID, 'download_qr', 'Download QR')
  logRemote('click:download_qr')
  shareOpen.value = true
  setTimeout(() => shareModal.value?.downloadQr(), 80)
}

async function saveContact() {
  if (deleted.value || disabled.value) {
    router.push('/profile')
    return
  }
  trackClick(LOCAL_ID, 'save_contact', 'Save contact')
  logRemote('click:save_contact')
  const n = venueName.value
  const photo = await vcardPhotoLine(logo.value || profile.value.logo || profile.value.avatar)
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
    photo,
    'NOTE:tap-na Table venue profile',
    'END:VCARD'
  ])
}


function eventVia() {
  try {
    const via = String(route.query.via || '').toLowerCase()
    if (via === 'qr' || via === 'nfc') return via
  } catch {}
  return ''
}

function logRemote(action) {
  const slug = shareSlug.value
  if (!slug) return
  apiLogCardEvent(slug, action, eventVia()).catch?.(() => {})
}

function onLinkTrack(key, label) {
  trackClick(LOCAL_ID, key, label)
  logRemote('click:' + (key || 'link'))
}

function onShareChannel(channel) {
  trackShare(LOCAL_ID, channel)
  logRemote('share:' + (channel || 'unknown'))
}

function onCopyLink() {
  trackShare(LOCAL_ID, 'copy link')
  trackClick(LOCAL_ID, 'copy_link', 'Copy link')
  logRemote('click:copy_link')
}

function onQrDownload() {
  trackClick(LOCAL_ID, 'download_qr', 'Download QR')
  logRemote('click:download_qr')
}

function onKeydown(e) {
  if (e.key !== 'Escape') return
  if (activePopup.value) {
    advancePopup()
    return
  }
  shareOpen.value = false
}

onMounted(() => {
  profile.value = loadPublicProfile()
  document.title = name.value + ' - tap-na Table'
  if (!deleted.value && !disabled.value) trackVisit(LOCAL_ID)
  window.openShareProfile = openShare
  document.addEventListener('keydown', onKeydown)
  queueVenuePopups()
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
          <h1 class="mt-4 text-2xl font-bold tracking-tight w-full max-w-[90%] block whitespace-nowrap overflow-hidden text-ellipsis" :title="name">{{ name }}</h1>
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
            to="/profile"
            class="inline-flex items-center gap-1.5 mt-3 mr-3 text-xs font-semibold text-gray-400 hover:text-white no-underline"
          >
            <span class="material-symbols-outlined text-[16px]">edit</span>
            Edit profile
          </RouterLink>
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
          <LinkRow
            v-for="tile in visibleTiles"
            :key="tile.key"
            :icon="tile.icon"
            :label="tile.label"
            :track-key="tile.trackKey"
            :detail="tile.detail"
            :href="tile.href"
            :external="!!tile.external"
            @track="onLinkTrack"
          />
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

    <CheckinPopup
      :open="activePopup === 'checkin'"
      :form="checkinForm"
      :venue-name="venueName"
      :profile-id="popupProfileId"
      @close="advancePopup"
    />
    <FeedbackPopup
      :open="activePopup === 'feedback'"
      :form="feedbackForm"
      :venue-name="venueName"
      :profile-id="popupProfileId"
      @close="advancePopup"
    />
  </div>
</template>
