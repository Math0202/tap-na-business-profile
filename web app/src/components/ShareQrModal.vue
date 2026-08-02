<script setup>
import { computed, ref, watch } from 'vue'
import QRCode from 'qrcode'

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: 'Share Profile' },
  copyText: { type: String, default: 'Scan this QR code to open this digital business card.' },
  shareText: { type: String, default: 'Check out this digital business card:' },
  shareUrl: { type: String, default: '' },
  fileBaseName: { type: String, default: 'Profile' },
  copyLinkLabel: { type: String, default: 'Copy profile link' }
})

const emit = defineEmits(['close', 'share', 'copy', 'download'])

const qrDataUrl = ref('')
const copyLabel = ref(props.copyLinkLabel)

const url = computed(() => {
  if (props.shareUrl) return props.shareUrl
  if (typeof window !== 'undefined') return window.location.href.split('#')[0]
  return ''
})

async function renderQr() {
  if (!url.value) return
  try {
    qrDataUrl.value = await QRCode.toDataURL(url.value, {
      width: 200,
      margin: 1,
      color: { dark: '#121212', light: '#ffffff' },
      errorCorrectionLevel: 'M'
    })
  } catch {
    qrDataUrl.value = ''
  }
}

watch(
  () => [props.open, url.value],
  ([isOpen]) => {
    if (isOpen) {
      copyLabel.value = props.copyLinkLabel
      renderQr()
    }
  },
  { immediate: true }
)

async function copyLink() {
  emit('copy')
  try {
    await navigator.clipboard.writeText(url.value)
    copyLabel.value = 'Link copied'
    setTimeout(() => {
      copyLabel.value = props.copyLinkLabel
    }, 2000)
  } catch {
    prompt('Copy this link:', url.value)
  }
}

function openShareChannel(channel) {
  emit('share', channel)
  const encodedUrl = encodeURIComponent(url.value)
  const encodedText = encodeURIComponent(props.shareText)
  const encodedBoth = encodeURIComponent(props.shareText + ' ' + url.value)
  let shareHref = ''

  switch (channel) {
    case 'whatsapp':
      shareHref = 'https://wa.me/?text=' + encodedBoth
      break
    case 'sms':
      shareHref = 'sms:?&body=' + encodedBoth
      break
    case 'email':
      shareHref =
        'mailto:?subject=' +
        encodeURIComponent(props.fileBaseName + ' — Digital Business Card') +
        '&body=' +
        encodedBoth
      break
    case 'telegram':
      shareHref = 'https://t.me/share/url?url=' + encodedUrl + '&text=' + encodedText
      break
    case 'linkedin':
      shareHref = 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodedUrl
      break
    case 'x':
      shareHref = 'https://twitter.com/intent/tweet?text=' + encodedText + '&url=' + encodedUrl
      break
    case 'facebook':
      shareHref = 'https://www.facebook.com/sharer/sharer.php?u=' + encodedUrl
      break
    case 'native':
      if (navigator.share) {
        navigator.share({
          title: props.fileBaseName + ' — Digital Business Card',
          text: props.shareText,
          url: url.value
        }).catch(() => {})
        return
      }
      copyLink()
      return
    default:
      return
  }
  window.open(shareHref, '_blank', 'noopener,noreferrer')
}

async function downloadQr() {
  if (!qrDataUrl.value) await renderQr()
  if (!qrDataUrl.value) return
  emit('download')
  const link = document.createElement('a')
  link.download = (props.fileBaseName || 'Profile').replace(/\s+/g, '_') + '_QR.png'
  link.href = qrDataUrl.value
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

defineExpose({ downloadQr, renderQr, qrDataUrl })
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="app-dialog-overlay fixed inset-0 z-[200] flex items-center justify-center p-6"
      aria-hidden="false"
    >
      <div class="absolute inset-0 bg-black/70" @click="emit('close')" />
      <div class="relative w-full max-w-sm card-item-bg rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-bold">{{ title }}</h2>
          <button
            type="button"
            aria-label="Close"
            class="w-9 h-9 rounded-full bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center transition-colors"
            @click="emit('close')"
          >
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
      <p class="text-gray-400 text-sm mb-5">{{ copyText }}</p>
      <div class="bg-white rounded-2xl p-4 flex items-center justify-center">
        <img v-if="qrDataUrl" :src="qrDataUrl" alt="QR code" class="w-[200px] h-[200px]" />
      </div>

      <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 mt-5 mb-3">Share via</p>
      <div class="grid grid-cols-4 gap-3">
        <button type="button" class="share-channel flex flex-col items-center gap-1.5" aria-label="Share on WhatsApp" @click="openShareChannel('whatsapp')">
          <span class="w-12 h-12 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-sm">
            <span class="material-symbols-outlined text-[22px]">chat</span>
          </span>
          <span class="text-[10px] font-medium text-gray-400">WhatsApp</span>
        </button>
        <button type="button" class="share-channel flex flex-col items-center gap-1.5" aria-label="Share via SMS" @click="openShareChannel('sms')">
          <span class="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm">
            <span class="material-symbols-outlined text-[22px]">sms</span>
          </span>
          <span class="text-[10px] font-medium text-gray-400">SMS</span>
        </button>
        <button type="button" class="share-channel flex flex-col items-center gap-1.5" aria-label="Share via Email" @click="openShareChannel('email')">
          <span class="w-12 h-12 rounded-full bg-sky-500 text-white flex items-center justify-center shadow-sm">
            <span class="material-symbols-outlined text-[22px]">mail</span>
          </span>
          <span class="text-[10px] font-medium text-gray-400">Email</span>
        </button>
        <button type="button" class="share-channel flex flex-col items-center gap-1.5" aria-label="Share on Telegram" @click="openShareChannel('telegram')">
          <span class="w-12 h-12 rounded-full bg-[#2AABEE] text-white flex items-center justify-center shadow-sm">
            <span class="material-symbols-outlined text-[22px]">send</span>
          </span>
          <span class="text-[10px] font-medium text-gray-400">Telegram</span>
        </button>
        <button type="button" class="share-channel flex flex-col items-center gap-1.5" aria-label="Share on LinkedIn" @click="openShareChannel('linkedin')">
          <span class="w-12 h-12 rounded-full bg-[#0A66C2] text-white flex items-center justify-center shadow-sm">
            <span class="material-symbols-outlined text-[22px]">work</span>
          </span>
          <span class="text-[10px] font-medium text-gray-400">LinkedIn</span>
        </button>
        <button type="button" class="share-channel flex flex-col items-center gap-1.5" aria-label="Share on X" @click="openShareChannel('x')">
          <span class="w-12 h-12 rounded-full bg-black text-white flex items-center justify-center shadow-sm border border-white/10">
            <span class="material-symbols-outlined text-[20px]">alternate_email</span>
          </span>
          <span class="text-[10px] font-medium text-gray-400">X</span>
        </button>
        <button type="button" class="share-channel flex flex-col items-center gap-1.5" aria-label="Share on Facebook" @click="openShareChannel('facebook')">
          <span class="w-12 h-12 rounded-full bg-[#1877F2] text-white flex items-center justify-center shadow-sm">
            <span class="material-symbols-outlined text-[22px]">public</span>
          </span>
          <span class="text-[10px] font-medium text-gray-400">Facebook</span>
        </button>
        <button type="button" class="share-channel flex flex-col items-center gap-1.5" aria-label="More share options" @click="openShareChannel('native')">
          <span class="w-12 h-12 rounded-full bg-zinc-600 text-white flex items-center justify-center shadow-sm">
            <span class="material-symbols-outlined text-[22px]">share</span>
          </span>
          <span class="text-[10px] font-medium text-gray-400">More</span>
        </button>
      </div>

      <button
        type="button"
        class="mt-5 w-full py-3 rounded-full bg-zinc-700 hover:bg-zinc-600 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
        @click="copyLink"
      >
        <span class="material-symbols-outlined text-[18px]">link</span>
        {{ copyLabel }}
      </button>
    </div>
    </div>
  </Teleport>
</template>
