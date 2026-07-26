<script setup>
defineProps({
  bannerHeight: { type: String, default: '220px' }
})
</script>

<template>
  <div class="fixed-banner" aria-hidden="true">
    <div class="profile-banner w-full relative" :style="{ height: bannerHeight }">
      <div class="banner-overlay absolute inset-0" />
    </div>
    <div class="h-screen app-background" />
  </div>
</template>
