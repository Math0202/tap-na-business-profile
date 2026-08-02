<script setup>
import { RouterView } from 'vue-router'
import FabMenu from './components/FabMenu.vue'
import CardBottomNav from './components/CardBottomNav.vue'
import VenueBottomNav from './components/VenueBottomNav.vue'
</script>

<template>
  <RouterView />
  <FabMenu />
  <CardBottomNav />
  <VenueBottomNav />
</template>
