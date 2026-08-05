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
  publicPage,
  normalizeMenuImages
} from '../lib/profileStore'
import {
  listCardsForProfile,
  preferredShareSlug,
  kindLabel,
  cardImageSrc,
  personalTypeLabel
} from '../lib/cardLinkStore'
import { LOCAL_ID } from '../lib/adminStore'
import { profileShareUrl } from '../lib/shareHelpers'
import { apiUploadAsset, apiUpdateMe, ensureApiSession, getApiToken } from '../lib/api'
import {
  BUSINESS_LINK_DEFS,
  normalizeLinkOrder,
  moveLinkOrder
} from '../lib/businessLinks'
import {
  DEFAULT_CHECKIN_FORM,
  DEFAULT_FEEDBACK_FORM,
  normalizeCheckinForm,
  normalizeFeedbackForm,
  newCustomField
} from '../lib/venueForms'

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
const menuPdf = ref('')
const menuImages = ref([])
const menuUploading = ref(false)
const menuFeedback = ref('')
const menuFeedbackClass = ref('text-xs text-gray-500 min-h-[1rem]')
const menuPdfInput = ref(null)
const menuImageInput = ref(null)
const googleReview = ref('')
const checkInUrl = ref('')
const feedbackUrl = ref('')
const linkOrder = ref(normalizeLinkOrder([]))
const showPhone = ref(false)
const showEmail = ref(false)
const showCheckin = ref(false)
const showFeedback = ref(false)
const showBooking = ref(true)
const checkinForm = ref(normalizeCheckinForm(DEFAULT_CHECKIN_FORM))
const feedbackForm = ref(normalizeFeedbackForm(DEFAULT_FEEDBACK_FORM))
const checkinEventsText = ref('')
const whatsapp = ref('')
const usePhoneAsWhatsapp = ref(false)
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
const primaryLinkedCard = computed(() => linkedCards.value[0] || null)
const linkedCardPreviewSrc = computed(() => {
  if (primaryLinkedCard.value) return cardImageSrc(primaryLinkedCard.value)
  return cardImageSrc({
    kind: isTable.value ? 'table' : 'personal',
    personalType: cardType.value === 'table' ? '' : 'business'
  })
})
const linkedCardPreviewLabel = computed(() => {
  const c = primaryLinkedCard.value
  if (!c) return isTable.value ? 'Table card' : 'Personal card'
  const tier = c.kind === 'personal' && c.personalType ? personalTypeLabel(c.personalType) : ''
  return tier ? `${kindLabel(c.kind)} · ${tier}` : kindLabel(c.kind)
})
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
    menuPdf.value = ''
    menuImages.value = []
    googleReview.value = ''
    checkInUrl.value = ''
    feedbackUrl.value = ''
    linkOrder.value = normalizeLinkOrder([])
    showPhone.value = false
    showEmail.value = false
    showCheckin.value = false
    showFeedback.value = false
    showBooking.value = true
    checkinForm.value = normalizeCheckinForm(DEFAULT_CHECKIN_FORM)
    feedbackForm.value = normalizeFeedbackForm(DEFAULT_FEEDBACK_FORM)
    checkinEventsText.value = ''
    whatsapp.value = ''
    usePhoneAsWhatsapp.value = false
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
    menuPdf.value = profile.menuPdf || ''
    menuImages.value = normalizeMenuImages(profile.menuImages)
    googleReview.value = profile.googleReview || ''
    checkInUrl.value = profile.checkInUrl || ''
    feedbackUrl.value = profile.feedbackUrl || ''
    linkOrder.value = normalizeLinkOrder(profile.linkOrder)
    showPhone.value = !!profile.showPhone
    showEmail.value = !!profile.showEmail
    showCheckin.value = !!profile.showCheckin
    showFeedback.value = !!profile.showFeedback
    showBooking.value = profile.showBooking !== false
    checkinForm.value = normalizeCheckinForm(profile.checkinForm)
    feedbackForm.value = normalizeFeedbackForm(profile.feedbackForm)
    checkinEventsText.value = (checkinForm.value.events || []).join('\n')
    whatsapp.value = profile.whatsapp || ''
    usePhoneAsWhatsapp.value = phonesMatch(profile.phone, profile.whatsapp)
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
    // Token may have gone stale — force re-auth once and retry
    if (!uploaded.ok && uploaded.status === 401 && (await ensureApiSession({ force: true }))) {
      uploaded = await apiUploadAsset(file, { kind })
    }
    if (uploaded.ok && uploaded.data?.url) {
      const url = uploaded.data.url
      if (isTable.value) logoData.value = url
      else avatarData.value = url

      // Persist to local + Supabase immediately so card taps see the logo
      const patch = isTable.value
        ? { logo: url, cardType: 'table' }
        : { avatar: url, cardType: cardType.value }
      const saved = saveProfile(patch)
      await ensureApiSession()
      const sync = await apiUpdateMe({
        cardType: saved.cardType,
        avatar: saved.avatar,
        logo: saved.logo
      })
      if (!sync.ok) {
        alert(
          sync.error
            ? `Image uploaded, but profile sync failed (${sync.error}). Tap Save Profile.`
            : 'Image uploaded, but profile sync failed. Tap Save Profile.'
        )
      }
      return
    }
    // Offline fallback: local preview only — never write data URLs to Supabase
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
        ? `Could not upload (${uploaded.error}). Showing a local preview only — it will not appear on scanned cards until upload succeeds.`
        : 'Could not upload. Showing a local preview only — it will not appear on scanned cards until upload succeeds.'
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
  if (!uploaded.ok && uploaded.status === 401 && (await ensureApiSession({ force: true }))) {
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

function phoneDigits(value) {
  return String(value || '').replace(/[^\d]/g, '')
}

function phonesMatch(a, b) {
  const da = phoneDigits(a)
  const db = phoneDigits(b)
  return !!(da && db && da === db)
}

function syncWhatsappFromPhone() {
  if (!usePhoneAsWhatsapp.value) return
  whatsapp.value = phone.value.trim()
}

function onUsePhoneAsWhatsapp(checked) {
  usePhoneAsWhatsapp.value = !!checked
  if (usePhoneAsWhatsapp.value) syncWhatsappFromPhone()
}

watch(phone, () => {
  if (usePhoneAsWhatsapp.value) syncWhatsappFromPhone()
})

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

function moveTile(key, direction) {
  linkOrder.value = moveLinkOrder(linkOrder.value, key, direction)
}

async function uploadMenuFile(file, { asPdf = false } = {}) {
  await ensureApiSession()
  let uploaded = await apiUploadAsset(file, { kind: 'menu' })
  if (!uploaded.ok && uploaded.status === 401 && (await ensureApiSession({ force: true }))) {
    uploaded = await apiUploadAsset(file, { kind: 'menu' })
  }
  if (!uploaded.ok || !uploaded.data?.url) {
    throw new Error(uploaded.error || 'Upload failed')
  }
  return uploaded.data.url
}

async function onMenuPdfChange(e) {
  const file = e.target.files && e.target.files[0]
  if (!file) return
  if (file.size > 15 * 1024 * 1024) {
    menuFeedback.value = 'PDF must be under 15 MB.'
    menuFeedbackClass.value = 'text-xs text-amber-400 min-h-[1rem]'
    e.target.value = ''
    return
  }
  menuUploading.value = true
  menuFeedback.value = 'Uploading PDF…'
  menuFeedbackClass.value = 'text-xs text-gray-400 min-h-[1rem]'
  try {
    menuPdf.value = await uploadMenuFile(file, { asPdf: true })
    menuFeedback.value = 'Menu PDF uploaded.'
    menuFeedbackClass.value = 'text-xs text-emerald-400 min-h-[1rem]'
  } catch (err) {
    menuFeedback.value = err?.message || 'Could not upload PDF.'
    menuFeedbackClass.value = 'text-xs text-red-400 min-h-[1rem]'
  } finally {
    menuUploading.value = false
    e.target.value = ''
  }
}

async function onMenuImagesChange(e) {
  const files = Array.from(e.target.files || [])
  if (!files.length) return
  const room = Math.max(0, 12 - menuImages.value.length)
  if (!room) {
    menuFeedback.value = 'You can upload up to 12 menu images.'
    menuFeedbackClass.value = 'text-xs text-amber-400 min-h-[1rem]'
    e.target.value = ''
    return
  }
  const batch = files.slice(0, room)
  menuUploading.value = true
  menuFeedback.value = `Uploading ${batch.length} image${batch.length === 1 ? '' : 's'}…`
  menuFeedbackClass.value = 'text-xs text-gray-400 min-h-[1rem]'
  try {
    const urls = []
    for (const file of batch) {
      if (file.size > 5 * 1024 * 1024) {
        throw new Error(`"${file.name}" is over 5 MB`)
      }
      urls.push(await uploadMenuFile(file))
    }
    menuImages.value = normalizeMenuImages([...menuImages.value, ...urls])
    menuFeedback.value = 'Menu images uploaded.'
    menuFeedbackClass.value = 'text-xs text-emerald-400 min-h-[1rem]'
  } catch (err) {
    menuFeedback.value = err?.message || 'Could not upload images.'
    menuFeedbackClass.value = 'text-xs text-red-400 min-h-[1rem]'
  } finally {
    menuUploading.value = false
    e.target.value = ''
  }
}

function removeMenuImage(index) {
  menuImages.value = menuImages.value.filter((_, i) => i !== index)
}

function moveMenuImage(index, direction) {
  const next = [...menuImages.value]
  const j = index + direction
  if (j < 0 || j >= next.length) return
  const tmp = next[index]
  next[index] = next[j]
  next[j] = tmp
  menuImages.value = next
}

function clearMenuPdf() {
  menuPdf.value = ''
}

const orderedTileDefs = computed(() =>
  normalizeLinkOrder(linkOrder.value)
    .map((key) => BUSINESS_LINK_DEFS.find((d) => d.key === key))
    .filter(Boolean)
)

function syncCheckinEventsFromText() {
  checkinForm.value.events = String(checkinEventsText.value || '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 30)
}

function addCheckinCustomField() {
  checkinForm.value.customFields = [...(checkinForm.value.customFields || []), newCustomField()]
}

function removeCheckinCustomField(id) {
  checkinForm.value.customFields = (checkinForm.value.customFields || []).filter((f) => f.id !== id)
}

function addFeedbackCustomField() {
  feedbackForm.value.customFields = [...(feedbackForm.value.customFields || []), newCustomField()]
}

function removeFeedbackCustomField(id) {
  feedbackForm.value.customFields = (feedbackForm.value.customFields || []).filter((f) => f.id !== id)
}

function customFieldOptionsText(field) {
  return (field.options || []).join('\n')
}

function setCustomFieldOptions(field, text) {
  field.options = String(text || '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20)
}

function saveLogin() {
  if (!newPassword.value) {
    loginFeedback.value = 'Enter a new password.'
    loginFeedbackClass.value = 'text-xs text-center min-h-[1rem] text-red-400'
    return
  }
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

async function onSave(e) {
  e.preventDefault()
  if (isTable.value) {
    if (!company.value.trim()) {
      return
    }
    if (!name.value.trim()) {
      name.value = company.value.trim()
    }
  } else if (!name.value.trim()) {
    tab.value = 'basics'
    return
  }
  const socials = normalizeSocialFields({
    whatsapp: (usePhoneAsWhatsapp.value ? phone.value : whatsapp.value).trim(),
    linkedin: linkedin.value.trim(),
    youtube: youtube.value.trim(),
    x: x.value.trim(),
    instagram: instagram.value.trim(),
    tiktok: tiktok.value.trim(),
    website: website.value.trim()
  })
  whatsapp.value = socials.whatsapp || ''
  if (usePhoneAsWhatsapp.value) usePhoneAsWhatsapp.value = phonesMatch(phone.value, whatsapp.value)
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

  // Never sync giant data: URLs to Supabase — keep cloud http(s) assets only
  const cloudSafe = (value, fallback = '') => {
    const v = String(value || '').trim()
    if (!v) return fallback
    if (v.startsWith('data:')) return fallback
    return v
  }
  const previous = loadProfile()

  try {
    syncCheckinEventsFromText()
    const nextCheckinForm = normalizeCheckinForm(checkinForm.value)
    const nextFeedbackForm = normalizeFeedbackForm(feedbackForm.value)

    const saved = saveProfile({
      cardType: cardType.value,
      name: name.value.trim(),
      title: title.value.trim(),
      company: company.value.trim(),
      phone: phone.value.trim(),
      email: email.value.trim(),
      address: address.value.trim(),
      menuUrl: menuUrl.value.trim(),
      menuPdf: String(menuPdf.value || '').trim(),
      menuImages: normalizeMenuImages(menuImages.value),
      googleReview: googleReview.value.trim(),
      checkInUrl: checkInUrl.value.trim(),
      feedbackUrl: feedbackUrl.value.trim(),
      linkOrder: normalizeLinkOrder(linkOrder.value),
      showPhone: !!showPhone.value,
      showEmail: !!showEmail.value,
      showCheckin: !!showCheckin.value,
      showFeedback: !!showFeedback.value,
      showBooking: !!showBooking.value,
      checkinForm: nextCheckinForm,
      feedbackForm: nextFeedbackForm,
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

    let authed = await ensureApiSession()
    if (!authed) authed = await ensureApiSession({ force: true })
    if (authed && getApiToken()) {
      const sync = await apiUpdateMe({
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
        menuPdf: cloudSafe(saved.menuPdf, cloudSafe(previous.menuPdf, '')),
        menuImages: normalizeMenuImages(saved.menuImages),
        googleReview: saved.googleReview,
        checkInUrl: saved.checkInUrl,
        feedbackUrl: saved.feedbackUrl,
        linkOrder: saved.linkOrder || [],
        showPhone: !!saved.showPhone,
        showEmail: !!saved.showEmail,
        showCheckin: !!saved.showCheckin,
        showFeedback: !!saved.showFeedback,
        showBooking: saved.showBooking !== false,
        checkinForm: saved.checkinForm || nextCheckinForm,
        feedbackForm: saved.feedbackForm || nextFeedbackForm,
        avatar: cloudSafe(saved.avatar, cloudSafe(previous.avatar, '/images/personal.png')),
        logo: cloudSafe(saved.logo, cloudSafe(previous.logo, '')),
        video: cloudSafe(saved.video, cloudSafe(previous.video, '')),
        disabled: saved.disabled
      })
      if (!sync.ok) {
        alert(sync.error || 'Saved on this device, but cloud sync failed. Try again.')
        return
      }
    }

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
  <main class="w-full max-w-md min-h-screen mx-auto flex flex-col relative pb-32">
    <header class="px-6 pt-16 pb-4 text-center">
      <BrandMark size="sm" class="mb-3 mx-auto" />
      <h1 class="text-2xl font-bold tracking-tight">
        {{ isTable ? 'Edit business profile' : 'Edit Profile' }}
      </h1>
      <p class="text-gray-400 text-sm mt-1">
        {{ isTable ? 'Set up what guests see when they tap your card' : 'Update your digital business card' }}
      </p>
    </header>

    <form class="px-6 space-y-5 flex-1" @submit="onSave">
      <div class="flex flex-col items-center gap-3 py-2">
        <div class="relative">
          <div
            class="relative w-28 h-28 overflow-hidden border-2 border-zinc-700 shadow-xl bg-zinc-800"
            :class="isTable ? 'rounded-3xl' : 'rounded-full'"
          >
            <img :src="previewSrc" :alt="isTable ? 'Business logo' : 'Profile photo'" class="w-full h-full object-cover" />
            <div
              v-if="avatarUploading"
              class="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-1"
            >
              <span class="material-symbols-outlined text-white text-[28px] animate-spin">progress_activity</span>
              <span class="text-[10px] text-white/80 font-medium">Uploading…</span>
            </div>
          </div>
          <label
            for="avatar-input"
            class="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-white text-black flex items-center justify-center cursor-pointer shadow-lg hover:bg-gray-200 transition-colors"
            :class="{ 'opacity-50 pointer-events-none': avatarUploading }"
            aria-label="Change photo"
          >
            <span class="material-symbols-outlined text-[18px]">photo_camera</span>
          </label>
          <input
            id="avatar-input"
            ref="avatarInput"
            type="file"
            accept="image/*"
            class="hidden"
            :disabled="avatarUploading"
            @change="onAvatarChange"
          />
        </div>
        <p class="text-gray-500 text-xs">
          {{
            avatarUploading
              ? 'Uploading…'
              : isTable
                ? 'Tap camera to change business logo'
                : 'Tap camera to change photo'
          }}
        </p>
        <div class="w-full max-w-xs space-y-2 pt-1">
          <button
            type="button"
            class="w-full py-3 rounded-full bg-zinc-700 text-white font-semibold text-sm hover:bg-zinc-600 transition-colors flex items-center justify-center gap-2"
            @click="onLogout"
          >
            <span class="material-symbols-outlined text-[18px]">logout</span>
            Log out
          </button>
          <button
            type="button"
            class="w-full py-3 rounded-full bg-red-500/15 text-red-400 border border-red-500/30 font-semibold text-sm hover:bg-red-500/25 transition-colors flex items-center justify-center gap-2"
            @click="showDeleteModal = true"
          >
            <span class="material-symbols-outlined text-[18px]">delete</span>
            Delete Profile
          </button>
          <button
            type="button"
            class="w-full py-3 rounded-full border border-[var(--border)] text-gray-200 font-semibold text-sm hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
            @click="openPasswordModal"
          >
            <span class="material-symbols-outlined text-[18px]">lock</span>
            Change password
          </button>
        </div>
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

      <div class="card-item-bg rounded-2xl p-4 space-y-3">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-semibold">Your NFC card</p>
            <p class="text-xs text-gray-400 mt-0.5">{{ linkedCardPreviewLabel }}</p>
            <p v-if="primaryLinkedCard?.serial" class="text-[11px] font-mono text-gray-500 mt-1">
              {{ primaryLinkedCard.serial }}
            </p>
          </div>
        </div>
        <div class="rounded-2xl border border-[var(--border)] bg-zinc-900/50 p-4 flex justify-center">
          <img
            :src="linkedCardPreviewSrc"
            :alt="linkedCardPreviewLabel"
            class="max-h-44 w-auto object-contain drop-shadow-lg"
          >
        </div>
        <p v-if="linkedCards.length > 1" class="text-[11px] text-gray-500">
          {{ linkedCards.length }} cards linked to this profile
        </p>
      </div>

      <!-- Personal card fields -->
      <section v-if="!isTable" class="space-y-4">
        <div class="field-group">
          <label class="field-label" for="field-name">Full name</label>
          <div class="field-shell">
            <span class="material-symbols-outlined field-icon">badge</span>
            <input id="field-name" v-model="name" type="text" class="field-input" placeholder="Name Surname" autocomplete="name" />
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

      <!-- Business / table card fields -->
      <section v-else class="space-y-4">
        <div class="field-group">
          <label class="field-label" for="field-business-name">Business Name</label>
          <div class="field-shell">
            <span class="material-symbols-outlined field-icon">storefront</span>
            <input
              id="field-business-name"
              v-model="company"
              type="text"
              class="field-input"
              placeholder="Your venue or business"
              autocomplete="organization"
              required
            />
          </div>
        </div>
        <div class="field-group">
          <label class="field-label" for="field-phone">Phone</label>
          <div class="field-shell">
            <span class="material-symbols-outlined field-icon">call</span>
            <input id="field-phone" v-model="phone" type="tel" class="field-input" placeholder="+264 81 000 0000" />
          </div>
          <label class="mt-2 flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input v-model="showPhone" type="checkbox" class="rounded border-zinc-600" />
            Show phone number on public profile
          </label>
          <p class="field-hint">Stored for your account — only shown publicly if you opt in.</p>
        </div>
        <div class="field-group">
          <label class="field-label" for="field-email">Email</label>
          <div class="field-shell">
            <span class="material-symbols-outlined field-icon">mail</span>
            <input id="field-email" v-model="email" type="email" class="field-input" placeholder="you@example.com" />
          </div>
          <label class="mt-2 flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input v-model="showEmail" type="checkbox" class="rounded border-zinc-600" />
            Show email on public profile
          </label>
          <p class="field-hint">Stored for your account — only shown publicly if you opt in.</p>
        </div>
        <div class="field-group space-y-3">
          <label class="field-label" for="field-menu">Menu</label>
          <p class="text-gray-500 text-xs">
            Add a link, upload a PDF, and/or upload menu page images (up to 12).
          </p>
          <div class="field-shell">
            <span class="material-symbols-outlined field-icon">link</span>
            <input
              id="field-menu"
              v-model="menuUrl"
              type="url"
              class="field-input"
              placeholder="Optional menu website link"
            />
          </div>

          <div class="flex flex-wrap gap-2">
            <label
              class="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-zinc-700 text-sm font-semibold cursor-pointer hover:bg-zinc-600"
              :class="{ 'opacity-50 pointer-events-none': menuUploading }"
            >
              <span class="material-symbols-outlined text-[18px]">picture_as_pdf</span>
              {{ menuPdf ? 'Replace PDF' : 'Upload PDF' }}
              <input
                ref="menuPdfInput"
                type="file"
                accept="application/pdf,.pdf"
                class="hidden"
                :disabled="menuUploading"
                @change="onMenuPdfChange"
              />
            </label>
            <label
              class="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-zinc-700 text-sm font-semibold cursor-pointer hover:bg-zinc-600"
              :class="{ 'opacity-50 pointer-events-none': menuUploading }"
            >
              <span class="material-symbols-outlined text-[18px]">photo_library</span>
              Add images
              <input
                ref="menuImageInput"
                type="file"
                accept="image/*"
                multiple
                class="hidden"
                :disabled="menuUploading"
                @change="onMenuImagesChange"
              />
            </label>
          </div>

          <div
            v-if="menuPdf"
            class="card-item-bg rounded-2xl p-3 flex items-center gap-3"
          >
            <span class="material-symbols-outlined text-[22px]">picture_as_pdf</span>
            <a
              :href="menuPdf"
              target="_blank"
              rel="noopener noreferrer"
              class="text-sm font-medium flex-1 truncate no-underline text-inherit"
            >
              Menu PDF uploaded
            </a>
            <button
              type="button"
              class="text-xs font-semibold text-red-400 px-2 py-1"
              @click="clearMenuPdf"
            >
              Remove
            </button>
          </div>

          <div v-if="menuImages.length" class="space-y-2">
            <div
              v-for="(img, index) in menuImages"
              :key="img + '-' + index"
              class="card-item-bg rounded-2xl p-2 flex items-center gap-2"
            >
              <img :src="img" alt="" class="w-12 h-12 rounded-lg object-cover shrink-0" />
              <span class="text-xs text-gray-400 flex-1">Page {{ index + 1 }}</span>
              <button
                type="button"
                class="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center disabled:opacity-30"
                :disabled="index === 0"
                aria-label="Move image up"
                @click="moveMenuImage(index, -1)"
              >
                <span class="material-symbols-outlined text-[16px]">keyboard_arrow_up</span>
              </button>
              <button
                type="button"
                class="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center disabled:opacity-30"
                :disabled="index === menuImages.length - 1"
                aria-label="Move image down"
                @click="moveMenuImage(index, 1)"
              >
                <span class="material-symbols-outlined text-[16px]">keyboard_arrow_down</span>
              </button>
              <button
                type="button"
                class="w-8 h-8 rounded-full bg-red-500/15 text-red-400 flex items-center justify-center"
                aria-label="Remove image"
                @click="removeMenuImage(index)"
              >
                <span class="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          </div>
          <p :class="menuFeedbackClass">{{ menuFeedback }}</p>
        </div>
        <div class="field-group">
          <label class="field-label" for="field-website-biz">Website</label>
          <div class="social-row">
            <div class="social-icon"><span class="material-symbols-outlined text-[20px]">language</span></div>
            <input id="field-website-biz" v-model="website" type="text" class="field-input" placeholder="www.yourwebsite.com" />
            <button type="button" class="social-test-btn" @click="testSocial('website')">Visit</button>
          </div>
        </div>
        <div class="field-group">
          <label class="field-label" for="field-google-review">Google Review</label>
          <div class="field-shell">
            <span class="material-symbols-outlined field-icon">star</span>
            <input id="field-google-review" v-model="googleReview" type="url" class="field-input" placeholder="https://g.page/r/…" />
          </div>
        </div>
      </section>

      <section v-if="!isTable" class="space-y-4">
        <div class="field-group">
          <label class="field-label" for="field-phone-personal">Phone</label>
          <div class="field-shell">
            <span class="material-symbols-outlined field-icon">call</span>
            <input id="field-phone-personal" v-model="phone" type="tel" class="field-input" placeholder="+264 81 000 0000" />
          </div>
          <p class="field-hint">Include country code for best results</p>
        </div>
        <div class="field-group">
          <label class="field-label" for="field-email-personal">Email</label>
          <div class="field-shell">
            <span class="material-symbols-outlined field-icon">mail</span>
            <input id="field-email-personal" v-model="email" type="email" class="field-input" placeholder="you@example.com" />
          </div>
        </div>
        <label class="flex items-center gap-3 card-item-bg rounded-2xl px-4 py-3 cursor-pointer">
          <input v-model="showBooking" type="checkbox" class="rounded border-zinc-600" />
          <span class="min-w-0">
            <span class="block text-sm font-semibold">Book a meeting button</span>
            <span class="block text-xs text-gray-500 mt-0.5">Let visitors request a meeting from your public card</span>
          </span>
        </label>
      </section>

      <section class="space-y-4">
        <p class="text-gray-500 text-xs">Enter a full link or a handle (e.g. @username). Tap Visit to verify.</p>

        <div class="field-group">
          <label class="field-label">WhatsApp</label>
          <div class="social-row">
            <div class="social-icon"><span class="material-symbols-outlined text-[20px]">chat</span></div>
            <input
              v-model="whatsapp"
              type="text"
              class="field-input"
              placeholder="+264 81 000 0000"
              :disabled="usePhoneAsWhatsapp"
            />
            <button type="button" class="social-test-btn" @click="testSocial('whatsapp')">Visit</button>
          </div>
          <label class="mt-2 flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              class="rounded border-zinc-600"
              :checked="usePhoneAsWhatsapp"
              @change="onUsePhoneAsWhatsapp($event.target.checked)"
            />
            Use my phone number for WhatsApp
          </label>
        </div>
        <template v-if="!isTable">
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
        </template>
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
        <div v-if="!isTable" class="field-group">
          <label class="field-label">Website</label>
          <div class="social-row">
            <div class="social-icon"><span class="material-symbols-outlined text-[20px]">language</span></div>
            <input v-model="website" type="text" class="field-input" placeholder="www.yourwebsite.com" />
            <button type="button" class="social-test-btn" @click="testSocial('website')">Visit</button>
          </div>
        </div>
        <p :class="socialFeedbackClass">{{ socialFeedback }}</p>
      </section>

      <section v-if="isTable" class="space-y-3">
        <div>
          <h2 class="text-sm font-semibold">Guest popups</h2>
          <p class="text-gray-500 text-xs mt-1">
            When enabled, these open as dialogs when someone opens your business page. Guests can close them.
          </p>
        </div>

        <label class="card-item-bg rounded-2xl px-4 py-3 flex items-center gap-3 cursor-pointer">
          <input v-model="showCheckin" type="checkbox" class="rounded border-zinc-600" />
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium">Events check-in popup</p>
            <p class="text-xs text-gray-500">Ask guests to check in when they open your page</p>
          </div>
        </label>

        <div v-if="showCheckin" class="card-item-bg rounded-2xl px-4 py-4 space-y-3">
          <div class="field-group">
            <label class="field-label">Popup title</label>
            <div class="field-shell">
              <input v-model="checkinForm.title" type="text" class="field-input" placeholder="Check in" />
            </div>
          </div>
          <div class="field-group">
            <label class="field-label">Intro text</label>
            <div class="field-shell !items-start">
              <textarea v-model="checkinForm.intro" class="field-textarea" rows="2" placeholder="Optional short message" />
            </div>
          </div>
          <div class="field-group">
            <label class="field-label">Event input</label>
            <div class="field-shell">
              <select v-model="checkinForm.eventMode" class="field-input">
                <option value="fixed">Fixed event name</option>
                <option value="text">Guest types event name</option>
                <option value="dropdown">Dropdown of events</option>
              </select>
            </div>
          </div>
          <div v-if="checkinForm.eventMode === 'fixed'" class="field-group">
            <label class="field-label">Event name</label>
            <div class="field-shell">
              <input v-model="checkinForm.eventName" type="text" class="field-input" placeholder="General visit" />
            </div>
          </div>
          <div v-if="checkinForm.eventMode === 'dropdown'" class="field-group">
            <label class="field-label">Events (one per line)</label>
            <div class="field-shell !items-start">
              <textarea
                v-model="checkinEventsText"
                class="field-textarea"
                rows="3"
                placeholder="Friday live&#10;Sunday brunch"
                @blur="syncCheckinEventsFromText"
              />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <label class="flex items-center gap-2 text-xs cursor-pointer">
              <input v-model="checkinForm.askName" type="checkbox" class="rounded border-zinc-600" />
              Collect name
            </label>
            <label class="flex items-center gap-2 text-xs cursor-pointer">
              <input v-model="checkinForm.askPhone" type="checkbox" class="rounded border-zinc-600" />
              Collect phone
            </label>
            <label class="flex items-center gap-2 text-xs cursor-pointer">
              <input v-model="checkinForm.askEmail" type="checkbox" class="rounded border-zinc-600" />
              Collect email
            </label>
            <label class="flex items-center gap-2 text-xs cursor-pointer">
              <input v-model="checkinForm.askGuests" type="checkbox" class="rounded border-zinc-600" />
              Guest count
            </label>
          </div>
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <p class="text-xs font-semibold text-gray-400">Custom fields</p>
              <button type="button" class="text-xs font-semibold text-white" @click="addCheckinCustomField">
                + Add field
              </button>
            </div>
            <div
              v-for="field in checkinForm.customFields"
              :key="field.id"
              class="rounded-xl bg-zinc-800/70 p-3 space-y-2"
            >
              <div class="flex gap-2">
                <input v-model="field.label" type="text" class="field-input flex-1" placeholder="Field label" />
                <button type="button" class="text-xs text-red-400 shrink-0" @click="removeCheckinCustomField(field.id)">
                  Remove
                </button>
              </div>
              <div class="flex gap-2 items-center">
                <select v-model="field.type" class="field-input flex-1">
                  <option value="text">Text</option>
                  <option value="textarea">Long text</option>
                  <option value="select">Dropdown</option>
                </select>
                <label class="flex items-center gap-1.5 text-[11px] shrink-0">
                  <input v-model="field.required" type="checkbox" class="rounded border-zinc-600" />
                  Required
                </label>
              </div>
              <textarea
                v-if="field.type === 'select'"
                class="field-textarea"
                rows="2"
                :value="customFieldOptionsText(field)"
                placeholder="Options, one per line"
                @input="setCustomFieldOptions(field, $event.target.value)"
              />
            </div>
          </div>
        </div>

        <label class="card-item-bg rounded-2xl px-4 py-3 flex items-center gap-3 cursor-pointer">
          <input v-model="showFeedback" type="checkbox" class="rounded border-zinc-600" />
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium">Feedback popup</p>
            <p class="text-xs text-gray-500">Ask for stars, comments, and guest details</p>
          </div>
        </label>

        <div v-if="showFeedback" class="card-item-bg rounded-2xl px-4 py-4 space-y-3">
          <div class="field-group">
            <label class="field-label">Popup title</label>
            <div class="field-shell">
              <input v-model="feedbackForm.title" type="text" class="field-input" placeholder="Share your feedback" />
            </div>
          </div>
          <div class="field-group">
            <label class="field-label">Intro / question</label>
            <div class="field-shell !items-start">
              <textarea
                v-model="feedbackForm.intro"
                class="field-textarea"
                rows="2"
                placeholder="How was your visit?"
              />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <label class="flex items-center gap-2 text-xs cursor-pointer">
              <input v-model="feedbackForm.askStars" type="checkbox" class="rounded border-zinc-600" />
              Star rating
            </label>
            <label v-if="feedbackForm.askStars" class="flex items-center gap-2 text-xs cursor-pointer">
              <input v-model="feedbackForm.starsRequired" type="checkbox" class="rounded border-zinc-600" />
              Stars required
            </label>
            <label class="flex items-center gap-2 text-xs cursor-pointer">
              <input v-model="feedbackForm.askMessage" type="checkbox" class="rounded border-zinc-600" />
              Comment box
            </label>
            <label v-if="feedbackForm.askMessage" class="flex items-center gap-2 text-xs cursor-pointer">
              <input v-model="feedbackForm.messageRequired" type="checkbox" class="rounded border-zinc-600" />
              Comment required
            </label>
            <label class="flex items-center gap-2 text-xs cursor-pointer">
              <input v-model="feedbackForm.askName" type="checkbox" class="rounded border-zinc-600" />
              Collect name
            </label>
            <label class="flex items-center gap-2 text-xs cursor-pointer">
              <input v-model="feedbackForm.askPhone" type="checkbox" class="rounded border-zinc-600" />
              Collect phone
            </label>
            <label class="flex items-center gap-2 text-xs cursor-pointer">
              <input v-model="feedbackForm.askEmail" type="checkbox" class="rounded border-zinc-600" />
              Collect email
            </label>
          </div>
          <div v-if="feedbackForm.askMessage" class="field-group">
            <label class="field-label">Comment label</label>
            <div class="field-shell">
              <input v-model="feedbackForm.messageLabel" type="text" class="field-input" placeholder="Your feedback" />
            </div>
          </div>
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <p class="text-xs font-semibold text-gray-400">Custom fields</p>
              <button type="button" class="text-xs font-semibold text-white" @click="addFeedbackCustomField">
                + Add field
              </button>
            </div>
            <div
              v-for="field in feedbackForm.customFields"
              :key="field.id"
              class="rounded-xl bg-zinc-800/70 p-3 space-y-2"
            >
              <div class="flex gap-2">
                <input v-model="field.label" type="text" class="field-input flex-1" placeholder="Field label" />
                <button type="button" class="text-xs text-red-400 shrink-0" @click="removeFeedbackCustomField(field.id)">
                  Remove
                </button>
              </div>
              <div class="flex gap-2 items-center">
                <select v-model="field.type" class="field-input flex-1">
                  <option value="text">Text</option>
                  <option value="textarea">Long text</option>
                  <option value="select">Dropdown</option>
                </select>
                <label class="flex items-center gap-1.5 text-[11px] shrink-0">
                  <input v-model="field.required" type="checkbox" class="rounded border-zinc-600" />
                  Required
                </label>
              </div>
              <textarea
                v-if="field.type === 'select'"
                class="field-textarea"
                rows="2"
                :value="customFieldOptionsText(field)"
                placeholder="Options, one per line"
                @input="setCustomFieldOptions(field, $event.target.value)"
              />
            </div>
          </div>
        </div>
      </section>

      <section v-if="isTable" class="space-y-3">
        <div>
          <h2 class="text-sm font-semibold">Tile order</h2>
          <p class="text-gray-500 text-xs mt-1">
            Change the order of contact and link tiles on your business profile.
          </p>
        </div>
        <div
          v-for="(tile, index) in orderedTileDefs"
          :key="tile.key"
          class="card-item-bg rounded-2xl px-3 py-2.5 flex items-center gap-2"
        >
          <span class="material-symbols-outlined text-[20px] text-gray-400 shrink-0">drag_handle</span>
          <span class="text-sm font-medium flex-1 min-w-0 truncate">{{ tile.label }}</span>
          <button
            type="button"
            class="w-9 h-9 rounded-full bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center disabled:opacity-30"
            aria-label="Move up"
            :disabled="index === 0"
            @click="moveTile(tile.key, -1)"
          >
            <span class="material-symbols-outlined text-[18px]">keyboard_arrow_up</span>
          </button>
          <button
            type="button"
            class="w-9 h-9 rounded-full bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center disabled:opacity-30"
            aria-label="Move down"
            :disabled="index === orderedTileDefs.length - 1"
            @click="moveTile(tile.key, 1)"
          >
            <span class="material-symbols-outlined text-[18px]">keyboard_arrow_down</span>
          </button>
        </div>
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
      </section>

      <button type="submit" class="w-full py-4 rounded-full bg-white text-black font-bold text-base hover:bg-gray-200 transition-colors flex items-center justify-center gap-2">
        <span class="material-symbols-outlined">save</span>
        Save Profile
      </button>
    </form>
  </main>

  <Teleport to="body">
    <div v-if="showPasswordModal" class="app-dialog-overlay fixed inset-0 z-[200] flex items-center justify-center p-6">
      <div class="absolute inset-0 bg-black/70" @click="showPasswordModal = false" />
      <div class="relative w-full max-w-sm card-item-bg rounded-3xl p-6 shadow-2xl space-y-4">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-lg font-bold">Change password</h2>
          <button
            type="button"
            class="w-9 h-9 rounded-full bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center"
            aria-label="Close"
            @click="showPasswordModal = false"
          >
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
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
        <p :class="loginFeedbackClass">{{ loginFeedback }}</p>
        <button
          type="button"
          class="w-full py-3.5 rounded-full bg-white text-black font-bold text-sm hover:bg-gray-200 transition-colors"
          @click="saveLogin"
        >
          Update password
        </button>
      </div>
    </div>
  </Teleport>

  <Teleport to="body">
    <div v-if="showDeleteModal" class="app-dialog-overlay fixed inset-0 z-[200] flex items-center justify-center p-6">
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
  </Teleport>

  <Teleport to="body">
    <div
      v-show="showToast"
      class="fixed left-1/2 -translate-x-1/2 bottom-24 z-[210] px-4 py-3 rounded-2xl bg-white text-black text-sm font-medium shadow-xl"
    >
      Profile saved
    </div>
  </Teleport>
</template>
