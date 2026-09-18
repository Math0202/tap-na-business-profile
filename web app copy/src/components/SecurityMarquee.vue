<template>
  <div class="security-marquee px-2 mb-8" aria-label="Secured by RLS, Turnstile and RSA Encryption">
    <div class="security-marquee__track">
      <span
        v-for="n in 4"
        :key="n"
        class="security-marquee__item"
        :aria-hidden="n > 1 ? 'true' : undefined"
      >
        <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1">lock</span>
        Secured by RLS, Turnstile &amp; RSA Encryption
        <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1">verified_user</span>
      </span>
    </div>
  </div>
</template>
