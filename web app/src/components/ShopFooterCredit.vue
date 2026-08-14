<script setup>
import { RouterLink } from 'vue-router'
import { AUCKMUND_HREF, AUCKMUND_LEGAL_NAME } from '../lib/brandLinks'

const year = new Date().getFullYear()
</script>

<template>
  <div class="flex flex-col gap-2 pt-8 border-t border-border-subtle">
    <slot />
    <p class="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      <RouterLink to="/privacy" class="text-on-surface no-underline hover:opacity-70">Privacy</RouterLink>
      <RouterLink to="/terms" class="text-on-surface no-underline hover:opacity-70">Terms</RouterLink>
    </p>
    <p class="text-xs text-on-surface-variant leading-relaxed">
      A division of
      <a
        :href="AUCKMUND_HREF"
        target="_blank"
        rel="noopener noreferrer"
        class="text-on-surface no-underline hover:opacity-70 font-medium"
      >{{ AUCKMUND_LEGAL_NAME }}</a>
    </p>
    <span class="text-[10px] uppercase font-label-caps text-ink-muted tracking-widest">
      © {{ year }} TAP.NA
    </span>
  </div>
</template>
