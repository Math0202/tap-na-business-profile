<script setup>
import { computed } from 'vue'

const props = defineProps({
  bannerHeight: { type: String, default: '220px' },
  src: { type: String, default: '' }
})

const bannerStyle = computed(() => {
  const style = {
    height: props.bannerHeight,
    backgroundSize: '100% auto',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center top'
  }
  if (props.src && props.src.trim()) {
    style.backgroundImage = `url(${JSON.stringify(props.src.trim())})`
  }
  return style
})
</script>

<template>
  <div class="fixed-banner" aria-hidden="true">
    <div class="profile-banner w-full relative" :style="bannerStyle">
      <div class="banner-overlay absolute inset-0" />
    </div>
    <div class="h-screen app-background" />
  </div>
</template>
