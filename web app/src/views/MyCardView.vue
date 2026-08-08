<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import PageBanner from '../components/PageBanner.vue'
import LinkRow from '../components/LinkRow.vue'
import SecurityMarquee from '../components/SecurityMarquee.vue'
import ShareQrModal from '../components/ShareQrModal.vue'
import BookMeetingPopup from '../components/BookMeetingPopup.vue'
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
import { downloadVcard, profileShareUrl, youtubeEmbedUrl, vcardPhotoLine } from '../lib/shareHelpers'
import { preferredShareSlug, listCardsForProfile, cardImageSrc, kindLabel, personalTypeLabel } from '../lib/cardLinkStore'
import { trackVisit, trackShare, trackClick, LOCAL_ID } from '../lib/adminStore'
import { apiLogCardEvent, apiPublicCatalog } from '../lib/api'

const route = useRoute()
const router = useRouter()

const profile = ref(loadPublicProfile())
const sharedCatalogItems = ref(null)
const shareOpen = ref(false)
const videoOpen = ref(false)
const bookOpen = ref(false)
const shareModal = ref(null)
const videoEl = ref(null)
const embedSrc = ref('')
const useEmbed = ref(false)

const deleted = computed(() => isProfileDeleted(profile.value))
const disabled = computed(() => isProfileDisabled(profile.value))
const name = computed(() => displayName(profile.value))
const showBooking = computed(
  () => !deleted.value && !disabled.value && profile.value.showBooking !== false
)
const bookingProfileId = computed(
  () => String(profile.value.remoteProfileId || profile.value.id || '').trim()
)
const catalogItems = computed(() => {
  const list = Array.isArray(sharedCatalogItems.value)
    ? sharedCatalogItems.value
    : Array.isArray(profile.value.catalogItems)
      ? profile.value.catalogItems
      : []
  return list.filter((item) => item && item.active !== false && String(item.name || '').trim())
})
function formatCatalogPrice(price) {
  if (price === null || price === undefined || price === '') return ''
  return 'N$ ' + Number(price).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })
}
function catalogDetail(item) {
  const price = formatCatalogPrice(item.price)
  const desc = String(item.description || '').trim()
  if (price && desc) return price + ' · ' + desc
  return price || desc
}
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

const ownLinkedCards = computed(() => {
  if (!isLoggedIn()) return []
  const pid = profile.value.remoteProfileId || profile.value.id || LOCAL_ID
  return listCardsForProfile(pid)
})
const ownCardPreview = computed(() => {
  if (!isLoggedIn()) return null
  const card = ownLinkedCards.value[0]
  if (card) {
    return {
      src: cardImageSrc(card),
      label:
        card.kind === 'personal' && card.personalType
          ? `${kindLabel(card.kind)} · ${personalTypeLabel(card.personalType)}`
          : kindLabel(card.kind),
      serial: card.serial || ''
    }
  }
  const kind = profile.value.cardType === 'table' ? 'table' : 'personal'
  return {
    src: cardImageSrc({ kind, personalType: kind === 'personal' ? 'business' : '' }),
    label: kind === 'table' ? 'Table card' : 'Personal card',
    serial: shareSlug.value || ''
  }
})

const shareText = computed(() => {
  const n = profile.value.name || 'this digital business card'
  return `Check out ${n}'s digital business card:`
})

function contactDetail(kind, value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (kind === 'phone' || kind === 'email') return raw
  if (kind === 'whatsapp') {
    if (/wa\.me\//i.test(raw)) return raw.replace(/^https?:\/\//i, '').split(/[?#]/)[0]
    const digits = raw.replace(/[^\d]/g, '')
    return digits ? 'wa.me/' + digits : raw
  }
  if (kind === 'instagram' || kind === 'tiktok' || kind === 'x') {
    let handle = raw.replace(/^https?:\/\/(www\.)?/i, '')
    handle = handle.replace(/^(instagram\.com|tiktok\.com|x\.com|twitter\.com)\//i, '')
    handle = handle.split(/[/?#]/)[0].replace(/^@/, '')
    return handle ? '@' + handle : raw
  }
  if (kind === 'website' || kind === 'linkedin' || kind === 'youtube') {
    return raw.replace(/^https?:\/\//i, '').replace(/\/$/, '')
  }
  return raw
}

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
  loadSharedCatalogPreview()
}

async function loadSharedCatalogPreview() {
  sharedCatalogItems.value = null
  const id = String(profile.value.remoteProfileId || profile.value.id || '').trim()
  if (!id) return
  try {
    const res = await apiPublicCatalog(id)
    if (res.ok && Array.isArray(res.data?.catalogItems)) {
      sharedCatalogItems.value = res.data.catalogItems
    }
  } catch {
    /* keep local catalogItems */
  }
}

function openShare() {
  if (actionsBlocked.value) {
    router.push(isLoggedIn() ? '/profile' : { path: '/login', query: { next: '/profile' } })
    return
  }
  trackClick(LOCAL_ID, 'share_open', 'Share / QR button')
  logRemote('share:open')
  shareOpen.value = true
}

async function saveContact() {
  if (deleted.value || disabled.value || !profile.value.name) {
    router.push('/profile')
    return
  }
  trackClick(LOCAL_ID, 'save_contact', 'Save contact')
  logRemote('click:save_contact')
  const parts = profile.value.name.trim().split(/\s+/)
  const first = parts[0] || ''
  const last = parts.slice(1).join(' ') || ''
  const photo = await vcardPhotoLine(profile.value.avatar)
  const websiteRaw = String(profile.value.website || '').trim()
  const contactUrl = websiteRaw
    ? resolveSocialUrl('website', websiteRaw)
    : shareUrl.value
  downloadVcard(profile.value.name.replace(/\s+/g, '_') + '.vcf', [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'FN:' + profile.value.name,
    'N:' + last + ';' + first + ';;;',
    'TITLE:' + (profile.value.title || ''),
    'ORG:' + (profile.value.company || ''),
    profile.value.phone ? 'TEL;TYPE=CELL:' + profile.value.phone : '',
    profile.value.email ? 'EMAIL:' + profile.value.email : '',
    contactUrl ? 'URL:' + contactUrl : '',
    photo,
    'NOTE:Digital business card',
    'END:VCARD'
  ])
}

function openVideo() {
  if (!profile.value.video || disabled.value || deleted.value) return
  trackClick(LOCAL_ID, 'play_video', 'Play video')
  logRemote('click:play_video')
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
    bookOpen.value = false
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
    <main class="w-full max-w-md min-h-screen flex flex-col relative z-10 pb-32">
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
              <h1 class="text-xl font-bold tracking-tight whitespace-nowrap overflow-hidden text-ellipsis" :title="name">
                {{ name }}
              </h1>
              <p
                v-if="title"
                class="text-gray-400 text-sm font-medium mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis"
                :title="title"
              >
                {{ title }}
              </p>
              <p
                v-if="company"
                class="text-gray-500 text-sm mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis"
                :title="company"
              >
                {{ company }}
              </p>
              <div class="mt-2 flex items-center gap-2 flex-wrap">
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
                <RouterLink
                  v-if="isLoggedIn()"
                  to="/profile"
                  class="inline-flex items-center gap-1 h-9 px-3 rounded-full bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold border border-zinc-700 no-underline text-white"
                >
                  <span class="material-symbols-outlined text-[16px]">edit</span>
                  Edit profile
                </RouterLink>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div class="page-sheet flex-1 mt-6">
        <div
          v-if="ownCardPreview"
          class="mx-6 mb-4 rounded-2xl border border-[var(--border)] bg-zinc-900/40 p-4 space-y-3"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm font-semibold">Your NFC card</p>
              <p class="text-xs text-gray-400 mt-0.5">{{ ownCardPreview.label }}</p>
              <p v-if="ownCardPreview.serial" class="text-[11px] font-mono text-gray-500 mt-1">
                {{ ownCardPreview.serial }}
              </p>
            </div>
          </div>
          <div class="flex justify-center">
            <img
              :src="ownCardPreview.src"
              :alt="ownCardPreview.label"
              class="max-h-40 w-auto object-contain drop-shadow-lg"
            >
          </div>
        </div>

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
          <LinkRow
            v-if="filledHref(profile.phone, 'phone')"
            icon="phone"
            label="Number"
            track-key="phone"
            :detail="contactDetail('phone', profile.phone)"
            :href="filledHref(profile.phone, 'phone')"
            @track="onLinkTrack"
          />
          <LinkRow
            v-if="filledHref(profile.email, 'email')"
            icon="email"
            label="Email"
            track-key="email"
            :detail="contactDetail('email', profile.email)"
            :href="filledHref(profile.email, 'email')"
            @track="onLinkTrack"
          />
          <LinkRow
            v-if="filledHref(profile.whatsapp, 'whatsapp')"
            icon="whatsapp"
            label="WhatsApp"
            track-key="whatsapp"
            :detail="contactDetail('whatsapp', profile.whatsapp)"
            :href="filledHref(profile.whatsapp, 'whatsapp')"
            :external="true"
            @track="onLinkTrack"
          />
          <LinkRow
            v-if="filledHref(profile.linkedin, 'linkedin')"
            icon="linkedin"
            label="LinkedIn"
            track-key="linkedin"
            :detail="contactDetail('linkedin', profile.linkedin)"
            :href="filledHref(profile.linkedin, 'linkedin')"
            :external="true"
            @track="onLinkTrack"
          />
          <LinkRow
            v-if="filledHref(profile.youtube, 'youtube')"
            icon="youtube"
            label="YouTube"
            track-key="youtube"
            :detail="contactDetail('youtube', profile.youtube)"
            :href="filledHref(profile.youtube, 'youtube')"
            :external="true"
            @track="onLinkTrack"
          />
          <LinkRow
            v-if="filledHref(profile.x, 'x')"
            icon="x"
            label="X"
            track-key="x"
            :detail="contactDetail('x', profile.x)"
            :href="filledHref(profile.x, 'x')"
            :external="true"
            @track="onLinkTrack"
          />
          <LinkRow
            v-if="filledHref(profile.instagram, 'instagram')"
            icon="instagram"
            label="Instagram"
            track-key="instagram"
            :detail="contactDetail('instagram', profile.instagram)"
            :href="filledHref(profile.instagram, 'instagram')"
            :external="true"
            @track="onLinkTrack"
          />
          <LinkRow
            v-if="filledHref(profile.tiktok, 'tiktok')"
            icon="tiktok"
            label="TikTok"
            track-key="tiktok"
            :detail="contactDetail('tiktok', profile.tiktok)"
            :href="filledHref(profile.tiktok, 'tiktok')"
            :external="true"
            @track="onLinkTrack"
          />
          <LinkRow
            v-if="filledHref(profile.website, 'website')"
            icon="website"
            label="Website"
            track-key="website"
            :detail="contactDetail('website', profile.website)"
            :href="filledHref(profile.website, 'website')"
            :external="true"
            @track="onLinkTrack"
          />
        </section>

        <section
          v-if="catalogItems.length"
          class="px-6 mt-6 space-y-3"
          :class="{ 'opacity-40 pointer-events-none': disabled }"
        >
          <div class="flex items-center justify-between px-1">
            <p class="text-[10px] uppercase tracking-wide text-gray-500">Offers</p>
            <RouterLink to="/catalog" class="text-[11px] text-emerald-400 no-underline">View catalog</RouterLink>
          </div>
          <RouterLink
            v-for="item in catalogItems"
            :key="item.id"
            to="/catalog"
            class="card-item-bg rounded-2xl flex items-center p-4 no-underline text-inherit"
          >
            <div class="w-12 h-12 rounded-full bg-white overflow-hidden flex items-center justify-center text-black mr-4 shadow-lg shrink-0">
              <img
                v-if="item.images?.[0]"
                :src="item.images[0]"
                :alt="item.name"
                class="w-full h-full object-cover"
              >
              <span v-else class="material-symbols-outlined text-[24px]">inventory_2</span>
            </div>
            <div class="min-w-0 flex-1 text-left">
              <template v-if="catalogDetail(item)">
                <p class="text-[10px] uppercase tracking-wide text-gray-500 leading-none mb-1">{{ item.name }}</p>
                <p class="link-row-detail text-gray-200 font-medium text-sm truncate">{{ catalogDetail(item) }}</p>
              </template>
              <span v-else class="link-row-detail text-gray-300 font-medium text-sm">{{ item.name }}</span>
            </div>
            <span class="material-symbols-outlined text-gray-500 text-[22px] shrink-0 ml-2">chevron_right</span>
          </RouterLink>
        </section>

        <div class="px-6 mt-8 mb-4 space-y-3">
          <button
            v-if="showBooking"
            type="button"
            class="card-item-bg rounded-2xl flex items-center p-4 w-full cursor-pointer hover:bg-zinc-800 transition-colors text-left"
            :class="{ 'opacity-40 pointer-events-none': actionsBlocked }"
            :disabled="actionsBlocked"
            @click="bookOpen = true"
          >
            <div class="w-12 h-12 rounded-full bg-white flex items-center justify-center text-black mr-4 shadow-lg shrink-0">
              <span class="material-symbols-outlined text-[24px]">event</span>
            </div>
            <div class="min-w-0 flex-1">
              <span class="link-row-detail text-gray-300 font-medium text-sm">Book a meeting</span>
            </div>
            <span class="material-symbols-outlined text-gray-500 text-[22px] shrink-0 ml-2">chevron_right</span>
          </button>
          <button
            type="button"
            class="w-full py-4 rounded-full bg-white text-black font-bold text-lg hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
            :class="{ 'opacity-40 pointer-events-none': actionsBlocked }"
            :disabled="actionsBlocked"
            @click="saveContact"
          >
            <span class="material-symbols-outlined">person_add</span>
            Save to  Phone Book
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

    <BookMeetingPopup
      :open="bookOpen"
      :profile-id="bookingProfileId"
      :owner-name="name"
      @close="bookOpen = false"
    />

    <Teleport to="body">
      <div
        v-if="videoOpen"
        class="app-dialog-overlay fixed inset-0 z-[200] flex items-center justify-center p-4"
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
    </Teleport>
  </div>
</template>
