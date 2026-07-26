<script setup>
import { RouterLink } from 'vue-router'

defineProps({
  /** Image height in px */
  height: { type: Number, default: 40 },
  /** Optional link target; empty string = no link */
  to: { type: String, default: '/' },
  /** compact = eyebrow-sized mark above a page title */
  size: {
    type: String,
    default: 'md',
    validator: (v) => ['sm', 'md', 'lg'].includes(v)
  }
})

const heights = { sm: 28, md: 40, lg: 56 }
</script>

<template>
  <component
    :is="to ? RouterLink : 'div'"
    v-bind="to ? { to } : {}"
    class="brand-mark inline-flex items-center no-underline"
    :aria-label="to ? 'tap-na home' : 'tap-na'"
  >
    <img
      src="/tap-na_logo.png"
      alt="tap-na"
      class="brand-mark__img object-contain object-left select-none"
      :style="{ height: (height || heights[size] || 40) + 'px', width: 'auto' }"
      decoding="async"
    >
  </component>
</template>
