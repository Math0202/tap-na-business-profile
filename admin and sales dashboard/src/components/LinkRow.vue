<script setup>
import { computed, h } from 'vue'
import { RouterLink } from 'vue-router'
import { isLoggedIn } from '../lib/profileStore'

const props = defineProps({
  icon: { type: String, required: true },
  label: { type: String, required: true },
  href: { type: String, default: '' },
  detail: { type: String, default: '' },
  external: { type: Boolean, default: false },
  trackKey: { type: String, default: '' }
})

const emit = defineEmits(['track'])

function onActivate() {
  if (props.trackKey) emit('track', props.trackKey, props.label)
}

const disabled = computed(() => !props.href)
const fallbackHref = computed(() => (isLoggedIn() ? '/profile' : '/login?next=/profile'))

const isInternal = computed(() => {
  if (!props.href) return true
  return props.href.startsWith('/') && !props.external
})

const classes = computed(() => [
  'card-item-bg rounded-2xl flex items-center p-4 cursor-pointer hover:bg-zinc-800 transition-colors no-underline',
  disabled.value ? 'opacity-40' : ''
])

/** Brand / action SVGs matching the personal profile (index) look. */
const BRAND_PATHS = {
  phone: {
    fill: true,
    d: 'M6.62 10.79a15.15 15.15 0 006.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z'
  },
  email: {
    fill: true,
    d: 'M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z'
  },
  whatsapp: {
    fill: true,
    d: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z'
  },
  linkedin: {
    fill: true,
    d: 'M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z'
  },
  youtube: {
    fill: true,
    d: 'M21.58 7.19c-.23-.86-.91-1.54-1.77-1.77C18.25 5 12 5 12 5s-6.25 0-7.81.42c-.86.23-1.54.91-1.77 1.77C2 8.75 2 12 2 12s0 3.25.42 4.81c.23.86.91 1.54 1.77 1.77C5.75 19 12 19 12 19s6.25 0 7.81-.42c.86-.23 1.54-.91 1.77-1.77.42-1.56.42-4.81.42-4.81s0-3.25-.42-4.81zM10 15V9l5.2 3L10 15z'
  },
  x: {
    fill: true,
    d: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z'
  },
  facebook: {
    fill: true,
    d: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z'
  },
  instagram: {
    fill: true,
    d: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z'
  },
  tiktok: {
    fill: true,
    d: 'M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15.3a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.73a8.18 8.18 0 0 0 4.76 1.52V6.79a4.85 4.85 0 0 1-1-.1z'
  },
  website: {
    fill: false,
    paths: [
      'M12 21a9 9 0 100-18 9 9 0 000 18z',
      'M3.6 9h16.8M3.6 15h16.8M12 3a14.5 14.5 0 010 18M12 3a14.5 14.5 0 000 18'
    ]
  },
  menu: { material: 'restaurant_menu' },
  review: { material: 'star' },
  checkin: { material: 'event_available' },
  feedback: { material: 'rate_review' }
}

const ICON_ALIASES = {
  call: 'phone',
  mail: 'email',
  chat: 'whatsapp',
  work: 'linkedin',
  play_circle: 'youtube',
  alternate_email: 'x',
  groups: 'facebook',
  photo_camera: 'instagram',
  music_note: 'tiktok',
  language: 'website',
  restaurant_menu: 'menu',
  star: 'review',
  event_available: 'checkin',
  rate_review: 'feedback'
}

const resolvedKey = computed(() => ICON_ALIASES[props.icon] || props.icon)
const brand = computed(() => BRAND_PATHS[resolvedKey.value] || null)

function IconMark() {
  const b = brand.value
  if (b?.material) {
    return h('span', { class: 'material-symbols-outlined text-[24px]' }, b.material)
  }
  if (b?.paths) {
    return h(
      'svg',
      { class: 'w-6 h-6', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', viewBox: '0 0 24 24' },
      b.paths.map((d) => h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d }))
    )
  }
  if (b?.d) {
    return h('svg', { class: 'w-6 h-6', fill: 'currentColor', viewBox: '0 0 24 24' }, [h('path', { d: b.d })])
  }
  return h('span', { class: 'material-symbols-outlined text-[24px]' }, props.icon)
}
</script>

<template>
  <a
    v-if="href && !isInternal"
    :href="href"
    :class="classes"
    target="_blank"
    rel="noopener noreferrer"
    @click="onActivate"
  >
    <div class="w-12 h-12 rounded-full bg-white flex items-center justify-center text-black mr-4 shadow-lg shrink-0">
      <IconMark />
    </div>
    <div class="min-w-0 flex-1 text-left">
      <template v-if="detail">
        <p class="text-[10px] uppercase tracking-wide text-gray-500 leading-none mb-1">{{ label }}</p>
        <p class="link-row-detail text-gray-200 font-medium text-sm truncate">{{ detail }}</p>
      </template>
      <span v-else class="link-row-detail text-gray-300 font-medium text-sm">{{ label }}</span>
    </div>
    <span class="material-symbols-outlined text-gray-500 text-[22px] shrink-0 ml-2">chevron_right</span>
  </a>
  <RouterLink
    v-else-if="href && isInternal"
    :to="href"
    :class="classes"
    @click="onActivate"
  >
    <div class="w-12 h-12 rounded-full bg-white flex items-center justify-center text-black mr-4 shadow-lg shrink-0">
      <IconMark />
    </div>
    <div class="min-w-0 flex-1 text-left">
      <template v-if="detail">
        <p class="text-[10px] uppercase tracking-wide text-gray-500 leading-none mb-1">{{ label }}</p>
        <p class="link-row-detail text-gray-200 font-medium text-sm truncate">{{ detail }}</p>
      </template>
      <span v-else class="link-row-detail text-gray-300 font-medium text-sm">{{ label }}</span>
    </div>
    <span class="material-symbols-outlined text-gray-500 text-[22px] shrink-0 ml-2">chevron_right</span>
  </RouterLink>
  <RouterLink
    v-else
    :to="fallbackHref"
    :class="classes"
    @click="onActivate"
  >
    <div class="w-12 h-12 rounded-full bg-white flex items-center justify-center text-black mr-4 shadow-lg shrink-0">
      <IconMark />
    </div>
    <div class="min-w-0 flex-1 text-left">
      <template v-if="detail">
        <p class="text-[10px] uppercase tracking-wide text-gray-500 leading-none mb-1">{{ label }}</p>
        <p class="link-row-detail text-gray-200 font-medium text-sm truncate">{{ detail }}</p>
      </template>
      <span v-else class="link-row-detail text-gray-300 font-medium text-sm">{{ label }}</span>
    </div>
    <span class="material-symbols-outlined text-gray-500 text-[22px] shrink-0 ml-2">chevron_right</span>
  </RouterLink>
</template>
