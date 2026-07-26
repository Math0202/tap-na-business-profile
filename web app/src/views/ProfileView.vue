<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import BrandMark from '../components/BrandMark.vue'
import {
  loadProfile,
  saveProfile,
  setDisabled,
  updateLoginCredentials,
  logout,
  deleteProfile,
  avatarUrl,
  logoUrl,
  isProfileDeleted,
  normalizeSocialFields,
  resolveSocialUrl,
  publicPage
} from '../lib/profileStore'
import { listCardsForProfile, preferredShareSlug, kindLabel } from '../lib/cardLinkStore'
import { LOCAL_ID } from '../lib/adminStore'
import { profileShareUrl } from '../lib/shareHelpers'
import { apiUploadAsset, apiUpdateMe, ensureApiSession } from '../lib/api'

const router = useRouter()

const tab = ref('basics')
const cardType = ref('personal')
const name = ref('')
const title = ref('')
const company = ref('')
const phone = ref('')
const email = ref('')
const address = ref('')
const menuUrl = ref('')
const googleReview = ref('')
const checkInUrl = ref('')
const feedbackUrl = ref('')
const whatsapp = ref('')
const linkedin = ref('')
const youtube = ref('')
const x = ref('')
const instagram = ref('')
const tiktok = ref('')
const website = ref('')
const loginEmail = ref('')
const loginPhone = ref('')
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const disabled = ref(false)
const avatarData = ref('/images/personal.png')
const logoData = ref('')
const videoData = ref('')
const videoUrlInput = ref('')
const videoFeedback = ref('')
const videoFeedbackClass = ref('text-xs text-gray-500 min-h-[1rem]')
const loginFeedback = ref('')
const loginFeedbackClass = ref('text-xs text-center min-h-[1rem]')
const socialFeedback = ref('')
const socialFeedbackClass = ref('text-xs text-center min-h-[1rem] text-gray-500')
const showDeleteModal = ref(false)
const showPasswordModal = ref(false)
const showToast = ref(false)
const avatarUploading = ref(false)
const avatarInput = ref(null)
const videoInput = ref(null)
const videoPreview = ref(null)

const isTable = computed(() => cardType.value === 'table')
const previewSrc = computed(() => {
  if (isTable.value) {
    if (logoData.value) return logoData.value
    return logoUrl({
      logo: logoData.value,
      avatar: avatarData.value,
      cardType: 'table',
      deleted: false
    })
  }
  return avatarUrl({ avatar: avatarData.value, deleted: false })
})
const hasVideo = computed(() => !!(videoData.value && String(videoData.value).trim()))
const isDataVideo = computed(() => String(videoData.value || '').startsWith('data:video'))
const shareSlug = ref('')
const linkedCards = computed(() => listCardsForProfile(LOCAL_ID))
const displaySlug = computed(() => {
  return (
    shareSlug.value ||
    preferredShareSlug(LOCAL_ID, { cardType: cardType.value }) ||
    linkedCards.value[0]?.serial ||
    ''
  )
})
const shareLink = computed(() =>
  displaySlug.value
    ? profileShareUrl(displaySlug.value, undefined, { cardType: isTable.value ? 'table' : 'personal' })
    : ''
)

function fillForm(profile) {
  if (isProfileDeleted(profile)) {
    name.value = ''
    title.value = ''
    company.value = ''
    phone.value = ''
    email.value = ''
    address.value = ''
    menuUrl.value = ''
    googleReview.value = ''
    checkInUrl.value = ''
    feedbackUrl.value = ''
    whatsapp.value = ''
    linkedin.value = ''
    youtube.value = ''
    x.value = ''
    instagram.value = ''
    tiktok.value = ''
    website.value = ''
    loginEmail.value = ''
    loginPhone.value = ''
    disabled.value = false
    avatarData.value = ''
    logoData.value = ''
    videoData.value = ''
    cardType.value = 'personal'
    shareSlug.value = ''
  } else {
    name.value = profile.name || ''
    title.value = profile.title || ''
    company.value = profile.company || ''
    phone.value = profile.phone || ''
    email.value = profile.email || ''
    address.value = profile.address || ''
    menuUrl.value = profile.menuUrl || ''
    googleReview.value = profile.googleReview || ''
    checkInUrl.value = profile.checkInUrl || ''
    feedbackUrl.value = profile.feedbackUrl || ''
    whatsapp.value = profile.whatsapp || ''
    linkedin.value = profile.linkedin || ''
    youtube.value = profile.youtube || ''
    x.value = profile.x || ''
    instagram.value = profile.instagram || ''
    tiktok.value = profile.tiktok || ''
    website.value = profile.website || ''
    loginEmail.value = profile.loginEmail || ''
    loginPhone.value = profile.loginPhone || ''
    disabled.value = !!profile.disabled
    avatarData.value = profile.avatar || '/images/personal.png'
    logoData.value = profile.logo || ''
    videoData.value = profile.video || ''
    cardType.value = profile.cardType === 'table' ? 'table' : 'personal'
    shareSlug.value = profile.shareSlug || ''
  }
  updateVideoUI()
}

function updateVideoUI() {
  if (!hasVideo.value) {
    videoUrlInput.value = ''
    videoFeedback.value = ''
    if (videoPreview.value) {
      videoPreview.value.removeAttribute('src')
      videoPreview.value.load()
    }
    return
  }
  if (isDataVideo.value) {
    videoUrlInput.value = ''
    videoFeedback.value = 'Uploaded video ready to save.'
    videoFeedbackClass.value = 'text-xs text-emerald-400 min-h-[1rem]'
  } else {
    videoUrlInput.value = videoData.value
    videoFeedback.value = 'Video link set. Save to show it on your card.'
    videoFeedbackClass.value = 'text-xs text-gray-500 min-h-[1rem]'
  }
}

function onDisabledChange() {
  setDisabled(disabled.value)
  loginFeedback.value = disabled.value ? 'Card disabled.' : 'Card enabled.'
  loginFeedbackClass.value = 'text-xs text-center min-h-[1rem] text-gray-400'
}

async function onAvatarChange(e) {
  const file = e.target.files && e.target.files[0]
  if (!file) return
  if (file.size > 3 * 1024 * 1024) {
    alert('Please choose an image under 3 MB.')
    e.target.value = ''
    return
  }
  const kind = isTable.value ? 'logo' : 'avatar'
  avatarUploading.value = true
  try {
    await ensureApiSession()
    let uploaded = await apiUploadAsset(file, { kind })
    // Token may have gone stale — re-auth once and retry before giving up
    if (!uploaded.ok && uploaded.status === 401 && (await ensureApiSession())) {
      uploaded = await apiUploadAsset(file, { kind })
    }
    if (uploaded.ok && uploaded.data?.url) {
      if (isTable.value) logoData.value = uploaded.data.url
      else avatarData.value = uploaded.data.url
      return
    }
    // Offline fallback: keep a local data URL so editing still works
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => reject(new Error('read failed'))
      reader.readAsDataURL(file)
    }).catch(() => null)
    if (dataUrl) {
      if (isTable.value) logoData.value = dataUrl
      else avatarData.value = dataUrl
    }
    const hint = uploaded.status === 401
      ? 'Could not upload to the cloud — please log out and log in again, then retry.'
      : uploaded.error
        ? `Saved locally (${uploaded.error})`
        : 'Saved locally'
    alert(hint)
  } finally {
    avatarUploading.value = false
    e.target.value = ''
  }
}

function onVideoUrlChange() {
  const url = videoUrlInput.value.trim()
  if (!url) {
    if (!isDataVideo.value) videoData.value = ''
    updateVideoUI()
    return
  }
  videoData.value = url
  updateVideoUI()
}

async function onVideoFileChange(e) {
  const file = e.target.files && e.target.files[0]
  if (!file) return
  if (file.size > 8 * 1024 * 1024) {
    videoFeedback.value = 'Please choose a video under 8 MB (or use a YouTube / video link instead).'
    videoFeedbackClass.value = 'text-xs text-amber-400 min-h-[1rem]'
    e.target.value = ''
    return
  }
  videoFeedback.value = 'Uploading video…'
  videoFeedbackClass.value = 'text-xs text-gray-400 min-h-[1rem]'
  await ensureApiSession()
  let uploaded = await apiUploadAsset(file, { kind: 'video' })
  if (!uploaded.ok && uploaded.status === 401 && (await ensureApiSession())) {
    uploaded = await apiUploadAsset(file, { kind: 'video' })
  }
  if (uploaded.ok && uploaded.data?.url) {
    videoData.value = uploaded.data.url
    updateVideoUI()
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    videoData.value = reader.result
    updateVideoUI()
    videoFeedback.value = uploaded.error
      ? `Saved locally (${uploaded.error})`
      : 'Uploaded video ready to save.'
    videoFeedbackClass.value = 'text-xs text-amber-400 min-h-[1rem]'
  }
  reader.onerror = () => {
    videoFeedback.value = 'Could not read that video file.'
    videoFeedbackClass.value = 'text-xs text-red-400 min-h-[1rem]'
  }
  reader.readAsDataURL(file)
}

function removeVideo() {
  videoData.value = ''
  if (videoInput.value) videoInput.value.value = ''
  updateVideoUI()
  videoFeedback.value = 'Video removed. Save profile to apply.'
  videoFeedbackClass.value = 'text-xs text-gray-500 min-h-[1rem]'
}

function testSocial(network) {
  const map = { whatsapp, linkedin, youtube, x, instagram, tiktok, website }
  const field = map[network]
  const url = resolveSocialUrl(network, field?.value || '')
  if (!url) {
    socialFeedback.value = 'Enter a handle or full link first.'
    socialFeedbackClass.value = 'text-xs text-center min-h-[1rem] text-amber-400'
    return
  }
  if (field) field.value = url
  socialFeedback.value = 'Opening ' + url
  socialFeedbackClass.value = 'text-xs text-center min-h-[1rem] text-emerald-400'
  window.open(url, '_blank', 'noopener,noreferrer')
}

function openPasswordModal() {
  currentPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  loginFeedback.value = ''
  loginFeedbackClass.value = 'text-xs text-center min-h-[1rem]'
  showPasswordModal.value = true
}

function saveLogin() {
  const result = updateLoginCredentials({
    loginEmail: loginEmail.value.trim(),
    loginPhone: loginPhone.value.trim(),
    currentPassword: currentPassword.value,
    newPassword: newPassword.value,
    confirmPassword: confirmPassword.value
  })
  if (!result.ok) {
    loginFeedback.value = result.error
    loginFeedbackClass.value = 'text-xs text-center min-h-[1rem] text-red-400'
    return
  }
  currentPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  loginFeedback.value = 'Password updated.'
  loginFeedbackClass.value = 'text-xs text-center min-h-[1rem] text-emerald-400'
  setTimeout(() => {
    showPasswordModal.value = false
    loginFeedback.value = ''
  }, 700)
}

function onSave(e) {
  e.preventDefault()
  if (!name.value.trim()) {
    tab.value = 'basics'
    return
  }
  const socials = normalizeSocialFields({
    whatsapp: whatsapp.value.trim(),
    linkedin: linkedin.value.trim(),
    youtube: youtube.value.trim(),
    x: x.value.trim(),
    instagram: instagram.value.trim(),
    tiktok: tiktok.value.trim(),
    website: website.value.trim()
  })
  whatsapp.value = socials.whatsapp || ''
  linkedin.value = socials.linkedin || ''
  youtube.value = socials.youtube || ''
  x.value = socials.x || ''
  instagram.value = socials.instagram || ''
  tiktok.value = socials.tiktok || ''
  website.value = socials.website || ''

  const urlFromField = videoUrlInput.value.trim()
  if (urlFromField && !isDataVideo.value) {
    videoData.value = urlFromField
  }

  try {
    const saved = saveProfile({
      cardType: cardType.value,
      name: name.value.trim(),
      title: title.value.trim(),
      company: company.value.trim(),
      phone: phone.value.trim(),
      email: email.value.trim(),
      address: address.value.trim(),
      menuUrl: menuUrl.value.trim(),
      googleReview: googleReview.value.trim(),
      checkInUrl: checkInUrl.value.trim(),
      feedbackUrl: feedbackUrl.value.trim(),
      whatsapp: socials.whatsapp,
      linkedin: socials.linkedin,
      youtube: socials.youtube,
      x: socials.x,
      instagram: socials.instagram,
      tiktok: socials.tiktok,
      website: socials.website,
      avatar: avatarData.value || '/images/personal.png',
      logo: logoData.value || '',
      video: videoData.value || '',
      disabled: disabled.value,
      loginEmail: loginEmail.value.trim(),
      loginPhone: loginPhone.value.trim()
    })

    // Push to the backend so card taps deliver the latest destinations
    import('../lib/api').then(async (m) => {
      await m.ensureApiSession()
      if (!m.getApiToken()) return
      m.apiUpdateMe({
        cardType: saved.cardType,
        name: saved.name,
        title: saved.title,
        company: saved.company,
        phone: saved.phone,
        email: saved.email,
        whatsapp: saved.whatsapp,
        linkedin: saved.linkedin,
        youtube: saved.youtube,
        x: saved.x,
        instagram: saved.instagram,
        tiktok: saved.tiktok,
        website: saved.website,
        address: saved.address,
        menuUrl: saved.menuUrl,
        googleReview: saved.googleReview,
        checkInUrl: saved.checkInUrl,
        feedbackUrl: saved.feedbackUrl,
        avatar: saved.avatar,
        logo: saved.logo,
        video: saved.video,
        disabled: saved.disabled
      })
    }).catch(() => {})

    showToast.value = true
    setTimeout(() => {
      showToast.value = false
      router.push(publicPage(saved))
    }, 700)
  } catch {
    alert('Could not save. The video may be too large for this browser. Try a shorter clip or a YouTube link.')
  }
}

function onLogout() {
  logout()
  router.push('/')
}

function confirmDelete() {
  deleteProfile()
  router.push('/')
}

watch(isDataVideo, (val) => {
  if (val && videoPreview.value) {
    videoPreview.value.src = videoData.value
  }
})

onMounted(() => {
  document.title = 'Edit Profile'
  fillForm(loadProfile())
})
</script>

<template>
  <main class="w-full max-w-md min-h-screen mx-auto flex flex-col relative pb-28">
    <header class="px-6 pt-16 pb-4">
      <BrandMark size="sm" class="mb-3" />
      <h1 class="text-2xl font-bold tracking-tight">Edit Profile</h1>
      <p class="text-gray-400 text-sm mt-1">Update your digital business card</p>
    </header>

    <form class="px-6 space-y-5 flex-1" @submit="onSave">
      <div class="flex flex-col items-center gap-3 py-2">
        <div class="relative">
          <div
            class="w-28 h-28 overflow-hidden border-2 border-zinc-700 shadow-xl bg-zinc-800"
            :class="isTable ? 'rounded-3xl' : 'rounded-full'"
          >
            <img :src="previewSrc" :alt="isTable ? 'Business logo' : 'Profile photo'" class="w-full h-full object-cover" />
          </div>
          <label
            for="avatar-input"
            class="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-white text-black flex items-center justify-center cursor-pointer shadow-lg hover:bg-gray-200 transition-colors"
            aria-label="Change photo"
          >
            <span class="material-symbols-outlined text-[18px]">photo_camera</span>
          </label>
          <input id="avatar-input" ref="avatarInput" type="file" accept="image/*" class="hidden" @change="onAvatarChange" />
        </div>
        <p class="text-gray-500 text-xs">
          {{ isTable ? 'Tap camera to change business logo' : 'Tap camera to change photo' }}
        </p>
      </div>

      <RouterLink
        v-if="isTable"
        to="/venue"
        class="card-item-bg rounded-2xl p-4 flex items-center gap-3 no-underline text-inherit hover:brightness-110 transition"
      >
        <div class="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center shrink-0">
          <span class="material-symbols-outlined text-[22px]">analytics</span>
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold">Venue dashboard</p>
          <p class="text-xs text-gray-400 mt-0.5">
            View and export check-ins &amp; customer feedback
          </p>
        </div>
        <span class="material-symbols-outlined text-gray-500">chevron_right</span>
      </RouterLink>

      <div class="card-item-bg rounded-2xl px-4 py-3">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <span class="material-symbols-outlined text-[22px] text-gray-300 shrink-0">credit_card</span>
            <span class="inline-flex items-center gap-2 text-sm font-semibold">
              <span class="w-2 h-2 rounded-full shrink-0" :class="disabled ? 'bg-red-400' : 'bg-emerald-400'" />
              <span :class="disabled ? 'text-red-400' : 'text-emerald-400'">{{ disabled ? 'Disabled' : 'Live' }}</span>
            </span>
          </div>
          <label class="relative inline-flex items-center cursor-pointer shrink-0" aria-label="Toggle card status">
            <input v-model="disabled" type="checkbox" class="sr-only peer" @change="onDisabledChange" />
            <div class="w-11 h-6 bg-emerald-500 peer-focus:outline-none rounded-full peer peer-checked:bg-red-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5" />
          </label>
        </div>
      </div>

      <section class="space-y-4">
        <div class="field-group">
          <label class="field-label" for="field-name">Full name</label>
          <div class="field-shell">
            <span class="material-symbols-outlined field-icon">badge</span>
            <input id="field-name" v-model="name" type="text" class="field-input" placeholder="Tangeni Matheus" autocomplete="name" />
          </div>
        </div>
        <div class="field-group">
          <label class="field-label" for="field-title">Job title</label>
          <div class="field-shell">
            <span class="material-symbols-outlined field-icon">work</span>
            <input id="field-title" v-model="title" type="text" class="field-input" placeholder="Software Developer" />
          </div>
        </div>
        <div class="field-group">
          <label class="field-label" for="field-company">Company</label>
          <div class="field-shell">
            <span class="material-symbols-outlined field-icon">apartment</span>
            <input id="field-company" v-model="company" type="text" class="field-input" placeholder="Your Company Name" />
          </div>
        </div>
      </section>

      <section class="space-y-4">
        <div class="field-group">
          <label class="field-label" for="field-phone">Phone</label>
          <div class="field-shell">
            <span class="material-symbols-outlined field-icon">call</span>
            <input id="field-phone" v-model="phone" type="tel" class="field-input" placeholder="+264 81 000 0000" />
          </div>
          <p class="field-hint">Include country code for best results</p>
        </div>
        <div class="field-group">
          <label class="field-label" for="field-email">Email</label>
          <div class="field-shell">
            <span class="material-symbols-outlined field-icon">mail</span>
            <input id="field-email" v-model="email" type="email" class="field-input" placeholder="you@example.com" />
          </div>
        </div>
        <div v-if="isTable" class="space-y-4">
          <div class="field-group">
            <label class="field-label" for="field-address">Address</label>
            <div class="field-shell">
              <span class="material-symbols-outlined field-icon">location_on</span>
              <input id="field-address" v-model="address" type="text" class="field-input" placeholder="Street, city" />
            </div>
          </div>
          <div class="field-group">
            <label class="field-label" for="field-menu">Menu link</label>
            <div class="field-shell">
              <span class="material-symbols-outlined field-icon">restaurant_menu</span>
              <input id="field-menu" v-model="menuUrl" type="url" class="field-input" placeholder="https://… or PDF link" />
            </div>
          </div>
          <div class="field-group">
            <label class="field-label" for="field-google-review">Google review link</label>
            <div class="field-shell">
              <span class="material-symbols-outlined field-icon">star</span>
              <input id="field-google-review" v-model="googleReview" type="url" class="field-input" placeholder="https://g.page/r/…" />
            </div>
          </div>
          <div class="field-group">
            <label class="field-label" for="field-checkin">Events check-in link</label>
            <div class="field-shell">
              <span class="material-symbols-outlined field-icon">event_available</span>
              <input id="field-checkin" v-model="checkInUrl" type="url" class="field-input" placeholder="Leave blank to use built-in check-in" />
            </div>
            <p class="field-hint">Optional. Blank uses tap-na’s check-in form.</p>
          </div>
          <div class="field-group">
            <label class="field-label" for="field-feedback">Feedback link</label>
            <div class="field-shell">
              <span class="material-symbols-outlined field-icon">rate_review</span>
              <input id="field-feedback" v-model="feedbackUrl" type="url" class="field-input" placeholder="Leave blank to use built-in feedback" />
            </div>
            <p class="field-hint">Optional. Blank uses tap-na’s feedback form.</p>
          </div>
        </div>
      </section>

      <section class="space-y-4">
        <p class="text-gray-500 text-xs">Enter a full link or a handle (e.g. @username). Tap Visit to verify.</p>

        <div class="field-group">
          <label class="field-label">WhatsApp</label>
          <div class="social-row">
            <div class="social-icon"><span class="material-symbols-outlined text-[20px]">chat</span></div>
            <input v-model="whatsapp" type="text" class="field-input" placeholder="+264 81 000 0000" />
            <button type="button" class="social-test-btn" @click="testSocial('whatsapp')">Visit</button>
          </div>
        </div>
        <div class="field-group">
          <label class="field-label">LinkedIn</label>
          <div class="social-row">
            <div class="social-icon"><span class="material-symbols-outlined text-[20px]">work</span></div>
            <input v-model="linkedin" type="text" class="field-input" placeholder="Paste your LinkedIn profile link" />
            <button type="button" class="social-test-btn" @click="testSocial('linkedin')">Visit</button>
          </div>
        </div>
        <div class="field-group">
          <label class="field-label">YouTube</label>
          <div class="social-row">
            <div class="social-icon"><span class="material-symbols-outlined text-[20px]">play_circle</span></div>
            <input v-model="youtube" type="text" class="field-input" placeholder="@channel or profile link" />
            <button type="button" class="social-test-btn" @click="testSocial('youtube')">Visit</button>
          </div>
        </div>
        <div class="field-group">
          <label class="field-label">X</label>
          <div class="social-row">
            <div class="social-icon"><span class="material-symbols-outlined text-[20px]">alternate_email</span></div>
            <input v-model="x" type="text" class="field-input" placeholder="@username or profile link" />
            <button type="button" class="social-test-btn" @click="testSocial('x')">Visit</button>
          </div>
        </div>
        <div class="field-group">
          <label class="field-label">Instagram</label>
          <div class="social-row">
            <div class="social-icon"><span class="material-symbols-outlined text-[20px]">photo_camera</span></div>
            <input v-model="instagram" type="text" class="field-input" placeholder="@username or profile link" />
            <button type="button" class="social-test-btn" @click="testSocial('instagram')">Visit</button>
          </div>
        </div>
        <div class="field-group">
          <label class="field-label">TikTok</label>
          <div class="social-row">
            <div class="social-icon"><span class="material-symbols-outlined text-[20px]">music_note</span></div>
            <input v-model="tiktok" type="text" class="field-input" placeholder="@username or profile link" />
            <button type="button" class="social-test-btn" @click="testSocial('tiktok')">Visit</button>
          </div>
        </div>
        <div class="field-group">
          <label class="field-label">Website</label>
          <div class="social-row">
            <div class="social-icon"><span class="material-symbols-outlined text-[20px]">language</span></div>
            <input v-model="website" type="text" class="field-input" placeholder="www.yourwebsite.com" />
            <button type="button" class="social-test-btn" @click="testSocial('website')">Visit</button>
          </div>
        </div>
        <p :class="socialFeedbackClass">{{ socialFeedback }}</p>
      </section>

      <section class="space-y-4">
        <div class="field-group">
          <label class="field-label" for="field-login-email">Login email</label>
          <div class="field-shell">
            <span class="material-symbols-outlined field-icon">alternate_email</span>
            <input id="field-login-email" v-model="loginEmail" type="email" class="field-input" placeholder="login@example.com" />
          </div>
        </div>
        <div class="field-group">
          <label class="field-label" for="field-login-phone">Login phone</label>
          <div class="field-shell">
            <span class="material-symbols-outlined field-icon">smartphone</span>
            <input id="field-login-phone" v-model="loginPhone" type="tel" class="field-input" placeholder="+264 81 000 0000" />
          </div>
        </div>
        <div class="card-item-bg rounded-2xl p-4 space-y-4">
          <p class="text-sm font-semibold">Change password</p>
          <div class="field-group">
            <label class="field-label" for="field-current-password">Current password</label>
            <div class="field-shell">
              <span class="material-symbols-outlined field-icon">lock</span>
              <input id="field-current-password" v-model="currentPassword" type="password" class="field-input" placeholder="Leave blank if not set yet" />
            </div>
          </div>
          <div class="field-group">
            <label class="field-label" for="field-new-password">New password</label>
            <div class="field-shell">
              <span class="material-symbols-outlined field-icon">key</span>
              <input id="field-new-password" v-model="newPassword" type="password" class="field-input" placeholder="At least 6 characters" />
            </div>
          </div>
          <div class="field-group">
            <label class="field-label" for="field-confirm-password">Confirm new password</label>
            <div class="field-shell">
              <span class="material-symbols-outlined field-icon">verified_user</span>
              <input id="field-confirm-password" v-model="confirmPassword" type="password" class="field-input" placeholder="Repeat new password" />
            </div>
          </div>
          <button type="button" class="w-full py-3 rounded-full bg-zinc-700 hover:bg-zinc-600 text-white font-semibold text-sm transition-colors" @click="saveLogin">
            Update login details
          </button>
          <p :class="loginFeedbackClass">{{ loginFeedback }}</p>
        </div>

        <div class="space-y-3 pt-1">
          <button type="button" class="w-full py-3.5 rounded-full bg-zinc-700 text-white font-semibold text-sm hover:bg-zinc-600 transition-colors flex items-center justify-center gap-2" @click="onLogout">
            <span class="material-symbols-outlined text-[18px]">logout</span>
            Log out
          </button>
          <button type="button" class="w-full py-3.5 rounded-full bg-zinc-700 text-white font-semibold text-sm hover:bg-zinc-600 transition-colors" @click="onReset">
            Reset to defaults
          </button>
          <button type="button" class="w-full py-3.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30 font-semibold text-sm hover:bg-red-500/25 transition-colors flex items-center justify-center gap-2" @click="showDeleteModal = true">
            <span class="material-symbols-outlined text-[18px]">delete</span>
            Delete Profile
          </button>
        </div>
      </section>

      <button type="submit" class="w-full py-4 rounded-full bg-white text-black font-bold text-base hover:bg-gray-200 transition-colors flex items-center justify-center gap-2">
        <span class="material-symbols-outlined">save</span>
        Save Profile
      </button>
    </form>
  </main>

  <div v-if="showDeleteModal" class="fixed inset-0 z-[100] flex items-center justify-center p-6">
    <div class="absolute inset-0 bg-black/70" @click="showDeleteModal = false" />
    <div class="relative w-full max-w-sm card-item-bg rounded-3xl p-6 shadow-2xl">
      <h2 class="text-lg font-bold">Delete profile?</h2>
      <p class="text-gray-400 text-sm mt-2">This removes your profile data from this device. You can create a new one later.</p>
      <div class="mt-5 flex gap-3">
        <button type="button" class="flex-1 py-3 rounded-full bg-zinc-700 hover:bg-zinc-600 font-semibold text-sm" @click="showDeleteModal = false">Cancel</button>
        <button type="button" class="flex-1 py-3 rounded-full bg-red-500 hover:bg-red-600 text-white font-semibold text-sm" @click="confirmDelete">Delete</button>
      </div>
    </div>
  </div>

  <div
    v-show="showToast"
    class="fixed left-1/2 -translate-x-1/2 bottom-24 z-[60] px-4 py-3 rounded-2xl bg-white text-black text-sm font-medium shadow-xl"
  >
    Profile saved
  </div>
</template>
